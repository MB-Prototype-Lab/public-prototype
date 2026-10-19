"""Portable record ownership and host preview tests; real relative Git when available."""
import importlib.util
import json
import os
import shutil
from pathlib import Path, PureWindowsPath
import unittest
from unittest.mock import patch

from pre_pr_review_fixture import ReviewFixture, SCRIPT

spec = importlib.util.spec_from_file_location('container_review', SCRIPT)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
preview_spec = importlib.util.spec_from_file_location('container_preview', SCRIPT.with_name('local-variants.py'))
preview = importlib.util.module_from_spec(preview_spec)
preview_spec.loader.exec_module(preview)


class ContainerReviewTest(unittest.TestCase):
    def setUp(self):
        self.fx = ReviewFixture()
        self.addCleanup(self.fx.close)
        self.record = self.fx.start()
        self.env = {'MB_HOST_ROOT': 'C:/PM projects/' + self.fx.root.name,
                    'MB_CONTAINER_PARENT': str(self.fx.parent)}

    def store(self):
        with patch.dict(os.environ, self.env), patch.object(Path, 'cwd', return_value=self.fx.root):
            return review.Store()

    def test_portable_record_round_trip_preserves_evidence_and_rejects_traversal(self):
        store = self.store()
        record = self.record
        evidence = str(store.directory / record['id'] / 'verification.json')
        record['verification'] = {'path': evidence, 'reports': {evidence: 'a' * 64}}
        store.save(record)
        raw = json.loads((store.directory / record['id'] / 'record.json').read_text())
        self.assertEqual(raw['schema_version'], 2)
        self.assertEqual(raw['original_checkout'], {'mount_path': self.fx.root.name})
        self.assertNotIn(str(self.fx.parent), json.dumps(raw))
        loaded = store.get(record['id'])
        self.assertEqual(loaded, record)
        raw['workspaces']['review']['path'] = {'mount_path': '../outside'}
        path = store.directory / record['id'] / 'record.json'
        path.write_text(json.dumps(raw))
        before = path.read_bytes()
        with self.assertRaisesRegex(review.Refusal, 'Invalid relative'):
            store.get(record['id'])
        self.assertEqual(path.read_bytes(), before)

    def test_native_record_is_preserved_in_container(self):
        store = self.store()
        path = store.directory / self.record['id'] / 'record.json'
        before = path.read_bytes()
        with self.assertRaisesRegex(review.Refusal, 'Legacy absolute-path review retained'):
            store.get(self.record['id'])
        with self.assertRaisesRegex(review.Refusal, 'Legacy absolute-path review retained'):
            review.import_legacy(store, self.record['id'])
        self.assertEqual(path.read_bytes(), before)

    def test_native_backend_cannot_mutate_container_lifecycle(self):
        store = self.store()
        store.save(self.record)
        with store.lock():
            pass
        result = self.fx.cli('resume', self.record['id'], '--json', ok=False)
        self.assertIn('checks review launcher', result.stdout)

    def test_host_preview_windows_and_wsl_encoding(self):
        entry = self.fx.parent / (self.fx.root.name + '-reviews') / 'review-id/reviewed/index.html'
        with patch.dict(os.environ, self.env):
            url = preview.browser_url(entry)
        self.assertTrue(url.startswith('file:///C:/PM%20projects/'))
        self.assertIn('%23', url)
        self.assertIn('caf%C3%A9', url)
        env = dict(self.env, MB_HOST_ROOT='/home/PM/' + self.fx.root.name, MB_WSL_DISTRO='Ubuntu PM')
        with patch.dict(os.environ, env):
            url = preview.browser_url(entry)
        self.assertTrue(url.startswith('file://wsl.localhost/Ubuntu%20PM/home/PM/'))
        self.assertNotIn(str(self.fx.parent), url)

    def test_host_output_and_absolute_input_mapping_do_not_change_records(self):
        store = self.store()
        before = json.dumps(self.record, sort_keys=True)
        output = store.present(self.record)
        self.assertTrue(output['host_artifact_dir'].startswith('C:\\PM projects\\'))
        self.assertTrue(output['workspaces']['review']['host_path'].startswith('C:\\PM projects\\'))
        self.assertEqual(store.execution_path(output['host_artifact_dir']), Path(self.record['artifact_dir']))
        self.assertEqual(json.dumps(self.record, sort_keys=True), before)
        with self.assertRaisesRegex(review.Refusal, 'outside declared'):
            store.execution_path('C:/unrelated/evidence.json')

    def test_invalid_mount_mapping_refused(self):
        self.env['MB_HOST_ROOT'] = 'C:/other-checkout'
        with self.assertRaisesRegex(review.Refusal, 'does not match'):
            self.store()

    def test_relative_worktree_capability_checked_before_checkpoint(self):
        help_result = self.fx.command(['git', 'worktree', 'add', '-h'])
        if 'relative-paths' in help_result.stdout + help_result.stderr:
            self.skipTest('Old-Git refusal applies only before relative worktree support')
        self.fx.env.update(self.env)
        before = self.fx.git('rev-parse', 'HEAD')
        self.fx.write('task.txt', 'must not checkpoint on unsupported Git\n')
        result = self.fx.cli('start', '--description', 'container attempt', '--scope', 'tooling', '--file', 'task.txt', '--json', ok=False)
        self.assertIn('--relative-paths support', result.stdout)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD'), before)

    def test_completed_cleaned_native_review_migrates_with_evidence(self):
        self.fx.adopt(self.record)
        before = self.fx.record(self.record['id'])
        self.env['MB_HOST_ROOT'] = str(self.fx.root)
        self.fx.env.update(self.env)
        result = json.loads(self.fx.cli('migrate', self.record['id'], '--json').stdout)
        self.assertEqual(result['phase'], 'completed')
        raw = self.fx.record(self.record['id'])
        self.assertEqual(raw['schema_version'], 2)
        backup = self.fx.store / self.record['id'] / 'record.native-v1.json'
        self.assertEqual(json.loads(backup.read_text()), before)
        self.assertEqual(result['verification']['reports'], before['verification']['reports'])
        resumed = json.loads(self.fx.cli('resume', self.record['id'], '--json').stdout)
        self.assertTrue(resumed['verification']['fresh'])

    def test_windows_legacy_paths_migrate_without_rewriting_evidence(self):
        self.fx.adopt(self.record)
        original = self.fx.record(self.record['id'])
        evidence = Path(original['verification']['path']).read_bytes()
        def windows(value):
            if isinstance(value, str) and value.startswith(str(self.fx.parent) + '/'):
                return str(PureWindowsPath('C:/PM projects').joinpath(*Path(value).relative_to(self.fx.parent).parts))
            if isinstance(value, dict):
                return {windows(key): windows(item) for key, item in value.items()}
            if isinstance(value, list):
                return [windows(item) for item in value]
            return value
        self.fx.save_record(windows(original))
        result = review.migrate_container(self.store(), self.record['id'])
        self.assertEqual(result['verification']['reports'], original['verification']['reports'])
        self.assertEqual(Path(original['verification']['path']).read_bytes(), evidence)

    def test_migration_refuses_retained_workspaces(self):
        self.fx.completed_with_retained_worktrees(self.record)
        self.env['MB_HOST_ROOT'] = str(self.fx.root)
        path = self.fx.store / self.record['id'] / 'record.json'
        before = path.read_bytes()
        with self.assertRaisesRegex(review.Refusal, 'worktrees remain registered or present'):
            review.migrate_container(self.store(), self.record['id'])
        self.assertEqual(path.read_bytes(), before)
        self.assertTrue(self.fx.tree(self.record).is_dir())

    def test_migration_refuses_active_or_stale_review_without_rewriting(self):
        self.env['MB_HOST_ROOT'] = str(self.fx.root)
        store = self.store()
        path = self.fx.store / self.record['id'] / 'record.json'
        before = path.read_bytes()
        with self.assertRaisesRegex(review.Refusal, 'completed review'):
            review.migrate_container(store, self.record['id'])
        self.assertEqual(path.read_bytes(), before)
        self.fx.adopt(self.record)
        completed = self.fx.record(self.record['id'])
        evidence_path = Path(completed['verification']['path'])
        evidence_path.write_text(evidence_path.read_text() + '\n')
        before = path.read_bytes()
        with self.assertRaisesRegex(review.Refusal, 'evidence changed'):
            review.migrate_container(store, self.record['id'])
        self.assertEqual(path.read_bytes(), before)

    def test_container_variants_use_relative_worktree_links(self):
        help_result = self.fx.command(['git', 'worktree', 'add', '-h'])
        self.fx.env.update(self.env)
        command = ['python3', SCRIPT.with_name('local-variants.py'), 'create', '--option', 'A', 'One option']
        before = self.fx.git('rev-parse', 'HEAD')
        result = self.fx.command(command)
        if 'relative-paths' not in help_result.stdout + help_result.stderr:
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('--relative-paths support', result.stderr)
            self.assertEqual(self.fx.git('rev-parse', 'HEAD'), before)
        else:
            self.assertEqual(result.returncode, 0, result.stderr)
            pointer = (self.fx.root / '.worktrees/variant-A/.git').read_text().strip().removeprefix('gitdir: ')
            self.assertFalse(Path(pointer).is_absolute())
            self.assertIn('file:///C:/PM%20projects/', result.stdout)

    def test_relative_review_survives_container_mount_relocation_and_adopts(self):
        help_result = self.fx.command(['git', 'worktree', 'add', '-h'])
        if 'relative-paths' not in help_result.stdout + help_result.stderr:
            self.skipTest('Requires Git with --relative-paths')
        fx = ReviewFixture()
        self.addCleanup(fx.close)
        host_root = 'C:/PM projects/' + fx.root.name
        fx.env.update({'MB_HOST_ROOT': host_root, 'MB_CONTAINER_PARENT': str(fx.parent)})
        record = json.loads(fx.cli('start', '--description', 'Portable review', '--scope', 'docs', '--json').stdout)
        fx.evidence(record)
        old_parent = fx.parent
        moved = old_parent.with_name(old_parent.name + ' remounted')
        self.assertFalse(moved.exists())
        old_parent.rename(moved)
        self.addCleanup(shutil.rmtree, moved)
        fx.parent = moved
        fx.root = moved / fx.root.name
        fx.common = fx.root / '.git'
        fx.store = fx.common / 'pre-pr-review'
        fx.env['MB_CONTAINER_PARENT'] = str(moved)
        resumed = json.loads(fx.cli('resume', record['id'], '--json').stdout)
        self.assertTrue(resumed['workspaces']['review']['path'].startswith(str(moved)))
        host_evidence = str(PureWindowsPath(host_root) / '.git/pre-pr-review' / record['id'] / 'verification.json')
        adopted = json.loads(fx.cli('adopt', record['id'], '--verification', host_evidence, '--json').stdout)
        self.assertEqual(adopted['phase'], 'completed')
        self.assertTrue(adopted['verification']['fresh'])
        self.assertFalse(Path(resumed['workspaces']['review']['path']).exists())

    def test_real_relative_worktrees_when_supported(self):
        help_result = self.fx.command(['git', 'worktree', 'add', '-h'])
        if 'relative-paths' not in help_result.stdout + help_result.stderr:
            self.skipTest('Requires Git with --relative-paths; executed in the checks image')
        fx = ReviewFixture()
        self.addCleanup(fx.close)
        fx.env.update({'MB_HOST_ROOT': 'C:/PM projects/' + fx.root.name,
                       'MB_CONTAINER_PARENT': str(fx.parent)})
        record = json.loads(fx.cli('start', '--description', 'Container review', '--scope', 'docs', '--json').stdout)
        for role in ('baseline', 'review'):
            pointer = (fx.tree(record, role) / '.git').read_text().strip().removeprefix('gitdir: ')
            self.assertFalse(Path(pointer).is_absolute())
            self.assertEqual(fx.git('rev-parse', 'HEAD', root=fx.tree(record, role)).strip(), record['finished'])
        resumed = json.loads(fx.cli('resume', record['id'], '--json').stdout)
        self.assertEqual(resumed['id'], record['id'])
        shown = json.loads(fx.cli('url', record['id'], '--json').stdout)
        self.assertTrue(shown['url'].startswith('file:///C:/PM%20projects/'))


if __name__ == '__main__':
    unittest.main()
