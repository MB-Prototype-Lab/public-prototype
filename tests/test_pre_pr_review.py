"""Deterministic lifecycle acceptance against disposable real Git repositories.

These tests do not claim a browser, native Windows desktop, or delegated-agent
review happened. They verify the CLI's durable state and filesystem/Git gates.
Actual-app harness controls are opt-in in pre_pr_review_real_app.py.
"""

import json
import os
from pathlib import Path
import shutil
import sys
import unittest
from urllib.parse import quote

from pre_pr_review_fixture import ReviewFixture, SCRIPT


class PrePrReviewTest(unittest.TestCase):
    def setUp(self):
        self.fx = ReviewFixture()
        self.addCleanup(self.fx.close)

    def assert_preserved(self, record):
        self.assertEqual(self.fx.git('rev-parse', record['checkpoint_ref']).strip(),
                         record['finished'])
        self.assertTrue((self.fx.store / record['id'] / 'record.json').is_file())

    def assert_refused_without_move(self, record, *args):
        before = self.fx.git('rev-parse', 'HEAD').strip()
        result = self.fx.cli(*args, ok=False)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), before)
        self.assert_preserved(record)
        return result

    def test_checkpoint_exact_selection_preserves_other_index_and_worktree_bytes(self):
        self.fx.write('task.txt', 'selected complete worktree content\n')
        self.fx.write('new task.txt', 'selected new file\n')
        (self.fx.root / 'delete me.txt').unlink()
        self.fx.write('unrelated.txt', 'unrelated index version\n')
        self.fx.git('add', '--', 'unrelated.txt')
        staged = self.fx.git('ls-files', '--stage', '-z', '--', 'unrelated.txt')
        self.fx.write('unrelated.txt', 'unrelated unstaged version\n')
        self.fx.write('other untracked.txt', 'unrelated untracked bytes\n')
        record = self.fx.start('--file', 'task.txt', '--file', 'new task.txt',
                               '--file', 'delete me.txt', scope='tooling')
        self.assertEqual(self.fx.git('ls-files', '--stage', '-z', '--', 'unrelated.txt'), staged)
        self.assertEqual((self.fx.root / 'unrelated.txt').read_text(), 'unrelated unstaged version\n')
        self.assertEqual((self.fx.root / 'other untracked.txt').read_text(), 'unrelated untracked bytes\n')
        self.assertEqual(self.fx.git('show', 'HEAD:unrelated.txt'), 'initial unrelated\n')
        self.assertEqual(set(self.fx.git('diff-tree', '--no-commit-id', '--name-only', '-r', '-z',
                                         'HEAD').split('\0')) - {''},
                         {'task.txt', 'new task.txt', 'delete me.txt'})
        self.assertEqual(self.fx.git('show', 'HEAD:task.txt'), 'selected complete worktree content\n')
        self.assertNotIn('delete me.txt', self.fx.git('ls-tree', '--name-only', 'HEAD'))
        for kind in ('baseline', 'review'):
            tree = self.fx.tree(record, kind)
            self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=tree).strip(), record['finished'])
            self.assertEqual(self.fx.git('status', '--porcelain', root=tree), '')
            self.assertNotIn(str(self.fx.root) + os.sep, str(tree))
        self.assert_preserved(record)

    def test_literal_special_filenames_are_committed_without_wildcard_expansion(self):
        names = ['new # percent %.txt', 'trailing space .txt', '[brackets].txt']
        if os.name != 'nt':
            names += ['literal*.txt', ':colon.txt', 'line\nbreak.txt', 'trailing-space ']
        self.fx.write('literal-other.txt', 'must stay untracked\n')
        args = []
        for index, name in enumerate(names):
            self.fx.write(name, f'literal file {index}\n')
            args.extend(['--file', name])
        record = self.fx.start(*args, scope='tooling')
        changed = self.fx.git('diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD')
        self.assertEqual(set(changed.split('\0')) - {''}, set(names))
        self.assertIn('literal-other.txt', self.fx.git('ls-files', '--others', '--exclude-standard'))
        self.assert_preserved(record)

    def test_no_selection_reviews_head_and_never_commits_unrelated_dirt(self):
        self.fx.write('unrelated.txt', 'keep unrelated edit\n')
        record = self.fx.start()
        self.assertEqual(record['finished'], self.fx.finished)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), self.fx.finished)
        self.assertEqual((self.fx.root / 'unrelated.txt').read_text(), 'keep unrelated edit\n')

    def test_selected_symlink_is_a_blob_and_never_opens_its_target(self):
        if not hasattr(os, 'symlink'):
            self.skipTest('symlinks unavailable')
        outside = self.fx.parent / 'outside target.txt'
        outside.write_text('outside must remain untouched\n')
        try:
            (self.fx.root / 'task-link').symlink_to(outside)
        except OSError as error:
            self.skipTest(f'platform cannot create symlinks: {error}')
        self.fx.start('--file', 'task-link', scope='tooling')
        self.assertIn('120000 blob', self.fx.git('ls-tree', 'HEAD', '--', 'task-link'))
        self.assertEqual(outside.read_text(), 'outside must remain untouched\n')

    def test_path_guards_refuse_before_changing_head_or_index(self):
        self.fx.write('task.txt', 'pending\n')
        before = self.fx.git('rev-parse', 'HEAD')
        index = self.fx.git('ls-files', '--stage', '-z')
        for path in ('../outside', '.', 'docs', '.git/config', '.worktrees/unsafe',
                     'branching.md', 'task.txt/../unrelated.txt'):
            with self.subTest(path=path):
                self.fx.cli('start', '--description', 'Unsafe selection', '--scope', 'docs',
                             '--file', path, '--json', ok=False)
                self.assertEqual(self.fx.git('rev-parse', 'HEAD'), before)
                self.assertEqual(self.fx.git('ls-files', '--stage', '-z'), index)

    def test_main_detached_missing_main_and_unrelated_history_refuse_before_checkpoint(self):
        self.fx.write('task.txt', 'pending checkpoint\n')
        for mode in ('main', 'detached', 'missing-main', 'unrelated-main'):
            with self.subTest(mode=mode):
                if mode == 'main':
                    self.fx.git('symbolic-ref', 'HEAD', 'refs/heads/main')
                elif mode == 'detached':
                    self.fx.git('symbolic-ref', 'HEAD', 'refs/heads/work/finished-task')
                    self.fx.git('update-ref', '--no-deref', 'HEAD', self.fx.finished)
                elif mode == 'missing-main':
                    self.fx.git('symbolic-ref', 'HEAD', 'refs/heads/work/finished-task')
                    self.fx.git('update-ref', '-d', 'refs/heads/main')
                else:
                    tree = self.fx.git('rev-parse', 'HEAD^{tree}').strip()
                    orphan = self.fx.command(['git', 'commit-tree', tree, '-m', 'orphan main'])
                    self.assertEqual(orphan.returncode, 0, orphan.stderr)
                    self.fx.git('update-ref', 'refs/heads/main', orphan.stdout.strip())
                before = self.fx.git('rev-parse', 'HEAD')
                self.fx.cli('start', '--description', mode, '--scope', 'docs',
                             '--file', 'task.txt', '--json', ok=False)
                self.assertEqual(self.fx.git('rev-parse', 'HEAD'), before)

    def test_matching_start_resumes_same_session_without_new_refs(self):
        first = self.fx.start()
        refs = self.fx.git('show-ref')
        second = self.fx.start()
        self.assertEqual(first['id'], second['id'])
        self.assertEqual(self.fx.git('show-ref'), refs)
        self.assertEqual(len(self.fx.records()), 1)

    def test_changed_content_creates_successor_and_preserves_previous_checkpoint(self):
        first = self.fx.start()
        self.fx.write('task.txt', 'next completed task version\n')
        second = self.fx.start('--file', 'task.txt', description='Revised finished task', scope='tooling')
        self.assertNotEqual(first['id'], second['id'])
        self.assertNotEqual(first['finished'], second['finished'])
        self.assert_preserved(first)
        self.assert_preserved(second)
        self.assertTrue(self.fx.tree(first).exists())
        self.assertIn(first['id'], json.dumps(second))
        self.assertIn(second['id'], json.dumps(self.fx.record(first['id'])))

    def test_advanced_head_creates_successor_without_reusing_old_finished_sha(self):
        first = self.fx.start()
        self.fx.write('docs/task.md', 'new completed task revision\n')
        self.fx.git('add', '--', 'docs/task.md')
        self.fx.git('commit', '-m', 'advance original task')
        advanced = self.fx.git('rev-parse', 'HEAD').strip()
        second = self.fx.start(description='Advanced task')
        self.assertEqual(second['finished'], advanced)
        self.assertNotEqual(first['id'], second['id'])
        self.assert_preserved(first)

    def test_status_is_read_only_and_lists_legacy_and_corrupt_records(self):
        record = self.fx.start()
        legacy = self.fx.store / 'legacy-review' / 'record.json'
        legacy.parent.mkdir()
        legacy.write_text(json.dumps({'id': 'legacy-review', 'schema': 0}))
        corrupt = self.fx.store / 'corrupt-review' / 'record.json'
        corrupt.parent.mkdir()
        corrupt.write_text('{ invalid json\n')
        paths = [self.fx.store / record['id'] / 'record.json', legacy, corrupt]
        snapshots = {path: path.read_bytes() for path in paths}
        refs = self.fx.git('show-ref')
        result = self.fx.cli('status', '--json')
        self.assertIn('legacy-review', result.stdout)
        self.assertIn('corrupt-review', result.stdout)
        self.assertIn('legacy', result.stdout.lower())
        self.assertIn('corrupt', result.stdout.lower())
        self.assertEqual({path: path.read_bytes() for path in paths}, snapshots)
        self.assertEqual(self.fx.git('show-ref'), refs)

    def test_status_discovery_excludes_other_original_checkout(self):
        own = self.fx.start()
        other = self.fx.parent / 'other task checkout'
        self.fx.git('worktree', 'add', '-b', 'work/other-task', str(other), self.fx.finished)
        result = self.fx.cli('status', '--json', root=other)
        data = json.loads(result.stdout)
        self.assertNotIn(own['id'], json.dumps(data))
        self.assert_preserved(own)

    def test_resume_recreates_only_absent_clean_registered_workspace(self):
        record = self.fx.start()
        baseline = self.fx.tree(record, 'baseline')
        self.fx.git('worktree', 'remove', str(baseline))
        self.assertFalse(baseline.exists())
        self.fx.cli('resume', record['id'], '--json')
        self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=baseline).strip(), record['finished'])
        self.assertEqual(self.fx.git('status', '--porcelain', root=baseline), '')
        self.assert_preserved(record)

    def test_resume_recreates_physically_missing_owned_registered_trees_at_retained_commits(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        self.fx.write('docs/unrecoverable-worker-notes.md', 'Lost uncommitted fixture bytes\n',
                       root=self.fx.tree(record))
        for role in ('baseline', 'review'):
            tree = self.fx.tree(record, role)
            self.assertIn(str(tree), self.fx.worktrees())
            # Both directories belong exclusively to this disposable fixture.
            shutil.rmtree(tree)
            self.assertIn(str(tree), self.fx.worktrees())
        result = self.fx.cli('resume', record['id'], '--json')
        for role, expected in (('baseline', record['finished']), ('review', reviewed)):
            tree = self.fx.tree(record, role)
            self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=tree).strip(), expected)
            self.assertEqual(self.fx.git('status', '--porcelain', root=tree), '')
        self.assertFalse((self.fx.tree(record) / 'docs/unrecoverable-worker-notes.md').exists())
        self.assertIn('uncommitted', result.stdout.lower())
        self.assertIn('recover', result.stdout.lower())
        self.assert_preserved(record)

    def test_missing_tree_recovery_refuses_locked_or_mismatched_registration(self):
        for condition in ('locked', 'wrong-head'):
            with self.subTest(condition=condition):
                fixture = ReviewFixture()
                try:
                    record = fixture.start()
                    tree = fixture.tree(record, 'baseline')
                    if condition == 'locked':
                        fixture.git('worktree', 'lock', '--reason', 'Uncertain external owner', str(tree))
                    else:
                        fixture.git('switch', '--detach', fixture.base, root=tree)
                    shutil.rmtree(tree)
                    registrations = fixture.worktrees()
                    refs = fixture.git('show-ref')
                    fixture.cli('resume', record['id'], '--json', ok=False)
                    self.assertFalse(tree.exists())
                    self.assertEqual(fixture.worktrees(), registrations)
                    self.assertEqual(fixture.git('show-ref'), refs)
                finally:
                    fixture.close()

    def test_missing_registered_tree_with_staged_index_retains_recoverable_metadata(self):
        for role in ('baseline', 'review'):
            with self.subTest(role=role):
                fixture = ReviewFixture()
                try:
                    record = fixture.start()
                    tree = fixture.tree(record, role)
                    staged = f'Recoverable staged {role} worker correction\n'
                    fixture.write('docs/task.md', staged, root=tree)
                    fixture.git('add', '--', 'docs/task.md', root=tree)
                    metadata = Path(fixture.git('rev-parse', '--absolute-git-dir', root=tree).strip())
                    self.assertTrue(metadata.is_relative_to(fixture.common))
                    index = metadata / 'index'
                    index_bytes = index.read_bytes()
                    recovered = fixture.git('--git-dir=' + str(metadata), 'show', ':docs/task.md')
                    self.assertEqual(recovered, staged)
                    shutil.rmtree(tree)
                    registrations = fixture.worktrees()
                    fixture.cli('resume', record['id'], '--json', ok=False)
                    self.assertFalse(tree.exists())
                    self.assertEqual(index.read_bytes(), index_bytes)
                    self.assertEqual(fixture.git('--git-dir=' + str(metadata), 'show', ':docs/task.md'), staged)
                    self.assertEqual(fixture.worktrees(), registrations)
                    self.assertEqual(fixture.git('rev-parse', record['checkpoint_ref']).strip(), record['finished'])
                finally:
                    fixture.close()

    def test_missing_registered_tree_with_uncertain_index_metadata_is_preserved(self):
        for role in ('baseline', 'review'):
            for condition in ('missing-index', 'corrupt-index', 'locked-index'):
                with self.subTest(role=role, condition=condition):
                    fixture = ReviewFixture()
                    try:
                        record = fixture.start()
                        tree = fixture.tree(record, role)
                        metadata = Path(fixture.git('rev-parse', '--absolute-git-dir', root=tree).strip())
                        self.assertTrue(metadata.is_relative_to(fixture.common))
                        index = metadata / 'index'
                        lock = metadata / 'index.lock'
                        if condition == 'missing-index':
                            index.unlink()
                        elif condition == 'corrupt-index':
                            index.write_bytes(b'Unknown index contents must survive\n')
                        else:
                            self.assertFalse(lock.exists())
                            lock.write_bytes(b'Unknown index lock owner must survive\n')
                        snapshots = {path: path.read_bytes() if path.exists() else None for path in (index, lock)}
                        shutil.rmtree(tree)
                        registrations = fixture.worktrees()
                        fixture.cli('resume', record['id'], '--json', ok=False)
                        self.assertFalse(tree.exists())
                        self.assertTrue(metadata.is_dir())
                        self.assertEqual({path: path.read_bytes() if path.exists() else None
                                          for path in (index, lock)}, snapshots)
                        self.assertEqual(fixture.worktrees(), registrations)
                    finally:
                        fixture.close()

    def test_resume_does_not_overwrite_unregistered_content_at_recorded_path(self):
        record = self.fx.start()
        baseline = self.fx.tree(record, 'baseline')
        self.fx.git('worktree', 'remove', str(baseline))
        self.fx.write('unknown.txt', 'unknown content must survive\n', root=baseline)
        self.fx.cli('resume', record['id'], '--json', ok=False)
        self.assertEqual((baseline / 'unknown.txt').read_text(), 'unknown content must survive\n')
        self.assert_preserved(record)

    def test_resume_keeps_dirty_review_files_and_reports_blocker(self):
        record = self.fx.start()
        self.fx.write('docs/task.md', 'uncommitted worker correction\n', root=self.fx.tree(record))
        result = self.fx.cli('resume', record['id'], '--json', ok=False)
        self.assertTrue(result.stderr or result.stdout)
        self.assertEqual((self.fx.tree(record) / 'docs/task.md').read_text(),
                         'uncommitted worker correction\n')

    def test_main_advance_does_not_change_frozen_review_scope_on_resume(self):
        self.fx.git('update-ref', 'refs/heads/main', self.fx.finished)
        record = self.fx.start()
        later = self.fx.parent / 'later main checkout'
        self.fx.git('worktree', 'add', '-b', 'work/future-main', str(later), record['main_tip'])
        self.fx.write('docs/task.md', 'later main-only documentation\n', root=later)
        self.fx.git('add', '--', 'docs/task.md', root=later)
        self.fx.git('commit', '-m', 'future main-only commit', root=later)
        advanced = self.fx.git('rev-parse', 'HEAD', root=later).strip()
        self.fx.git('update-ref', 'refs/heads/main', advanced)
        self.fx.cli('resume', record['id'], '--json')
        resumed = self.fx.record(record['id'])
        self.assertEqual(resumed['main_tip'], record['main_tip'])
        self.assertEqual(resumed['comparison_base'], record['comparison_base'])
        self.assertEqual(resumed['finished'], record['finished'])

    def test_original_and_finished_urls_bind_exact_tree_and_encode_special_paths(self):
        record = self.fx.start(scope='app')
        for version, tree in [('original', self.fx.root), ('finished', self.fx.tree(record, 'baseline'))]:
            result = self.fx.cli('url', record['id'], '--version', version, '--json')
            data = json.loads(result.stdout)
            self.assertIn(quote(tree.name), data['url'])
            self.assertEqual(Path(data['path']), tree / 'index.html')
            self.assertIn(record['finished'], json.dumps(data))
            self.assertIn('%20', result.stdout)
            self.assertIn('%23', result.stdout)
            self.assertIn('%25', result.stdout)
        if os.name != 'nt':
            wsl = self.fx.cli('url', record['id'], '--version', 'finished', '--wsl-distro',
                              'PM Ubuntu # 24', '--json')
            self.assertIn('file://wsl.localhost/PM%20Ubuntu%20%23%2024/', wsl.stdout)
            self.fx.cli('url', record['id'], '--version', 'finished', '--wsl-distro',
                         '../escape', '--json', ok=False)

    def test_dirty_or_advanced_original_url_is_never_labelled_verified(self):
        record = self.fx.start(scope='app')
        self.fx.write('task.txt', 'new dirty task content\n')
        result = self.fx.cli('url', record['id'], '--version', 'original', '--json')
        data = json.loads(result.stdout)
        self.assertFalse(data.get('verified', False))
        self.assertIn('current', result.stdout.lower())
        self.fx.git('add', '--', 'task.txt')
        self.fx.git('commit', '-m', 'advance task after review')
        result = self.fx.cli('url', record['id'], '--version', 'original', '--json')
        self.assertFalse(json.loads(result.stdout).get('verified', False))
        self.assertIn(self.fx.git('rev-parse', 'HEAD').strip(), result.stdout)

    def test_missing_entry_never_substitutes_another_version(self):
        record = self.fx.start(scope='app')
        (self.fx.tree(record, 'baseline') / 'index.html').unlink()
        result = self.fx.cli('url', record['id'], '--version', 'finished', '--json')
        self.assertFalse(json.loads(result.stdout)['available'])
        self.assertNotIn(self.fx.root.as_uri(), result.stdout)

    def test_active_review_cannot_be_cleaned(self):
        record = self.fx.start()
        self.fx.cli('cleanup', record['id'], '--json', ok=False)
        self.assertTrue(self.fx.tree(record).exists())
        self.assertTrue(self.fx.tree(record, 'baseline').exists())
        self.assert_preserved(record)

    def test_empty_verified_flag_and_empty_evidence_are_not_adoption(self):
        record = self.fx.start()
        self.assert_refused_without_move(record, 'adopt', record['id'], '--verified')
        evidence = self.fx.store / record['id'] / 'empty-verification.json'
        for value in ({}, {'verified': True}, {'commands': []}):
            with self.subTest(value=value):
                evidence.write_text(json.dumps(value))
                self.assert_refused_without_move(record, 'adopt', record['id'],
                                                 '--verification', str(evidence), '--json')
        self.assertTrue(self.fx.tree(record).exists())

    def test_successful_independent_no_fix_review_completes_and_cleans_managed_trees(self):
        record = self.fx.start()
        path, _ = self.fx.evidence(record)
        self.fx.adopt(record, path)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), record['finished'])
        self.assertEqual(self.fx.git('status', '--porcelain'), '')
        self.assertEqual(self.fx.record(record['id'])['phase'], 'completed')
        self.assertFalse(self.fx.tree(record).exists())
        self.assertFalse(self.fx.tree(record, 'baseline').exists())
        self.assert_preserved(record)
        self.fx.git('rev-parse', record['review_ref'])
        self.assertTrue(path.is_file())
        self.fx.cli('cleanup', record['id'], '--json')
        self.fx.cli('cleanup', '--completed', '--json')
        self.assert_preserved(record)

    def test_successful_fix_fast_forwards_exact_reviewed_sha_and_retains_recovery_refs(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record, reviewed)
        self.fx.adopt(record, path)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), reviewed)
        self.assertEqual(self.fx.git('symbolic-ref', 'HEAD').strip(), record['original_branch'])
        self.assertEqual((self.fx.root / 'docs/task.md').read_text(),
                         'independent technical correction\n')
        self.assertEqual(self.fx.git('status', '--porcelain'), '')
        self.assertEqual(self.fx.git('rev-parse', record['review_ref']).strip(), reviewed)
        self.assert_preserved(record)

    def test_each_required_evidence_gate_blocks_an_otherwise_valid_review(self):
        record = self.fx.start()
        self.fx.commit_fix(record)
        path, good = self.fx.evidence(record)
        def missing_required(value):
            value['checks'] = [entry for entry in value['checks']
                               if (entry['stage'], entry['id']) != ('baseline', 'check-all')]
        def stale_check(value):
            value['checks'][0]['sha'] = self.fx.base
        mutations = {
            'stale-baseline': lambda value: value.update(baseline=self.fx.base),
            'stale-reviewed': lambda value: value.update(reviewed=record['finished']),
            'stale-main': lambda value: value.update(main_tip=record['finished']),
            'wrong-review': lambda value: value.update(review_id='other-review'),
            'missing-commands': lambda value: value.update(checks=[]),
            'missing-required-check': missing_required,
            'stale-command-sha': stale_check,
            'blocked-required-check': lambda value: value['checks'][0].update(status='BLOCKED'),
            'skipped-required-check': lambda value: value['checks'][0].update(status='SKIPPED'),
            'failed-required-check': lambda value: value['checks'][0].update(status='FAIL', exit_code=1),
            'contradictory-exit': lambda value: value['checks'][0].update(exit_code=1),
            'missing-report': lambda value: value['checks'][0].update(report='missing.log'),
            'empty-report': lambda value: value['checks'][0].update(report='empty.log'),
            'bare-pass-report': lambda value: value['checks'][0].update(report='bare-pass.log'),
            'unknown-verifier': lambda value: value.update(verifier_id='unregistered'),
            'fixer-as-verifier': lambda value: value.update(verifier_id='technical-fixer'),
            'unresolved-decision': lambda value: value.update(decisions=[{'status': 'pending'}]),
            'unresolved-coverage': lambda value: value.update(limitations=[{'status': 'BLOCKED'}]),
            'missing-unaffected-reason': lambda value: value.pop('participant_unaffected'),
            'missing-harness-assessment': lambda value: value.pop('harness'),
            'missing-cold-review': lambda value: value.pop('cold_review'),
            'stale-cold-review': lambda value: value['cold_review'].update(baseline=self.fx.base),
            'unregistered-cold-reviewer': lambda value: value['cold_review'].update(worker_id='unknown-reviewer'),
        }
        path.with_name('empty.log').write_text('')
        path.with_name('bare-pass.log').write_text('PASS')
        for name, mutate in mutations.items():
            with self.subTest(gate=name):
                candidate = json.loads(json.dumps(good))
                mutate(candidate)
                self.fx.write_evidence(path, candidate)
                self.assert_refused_without_move(record, 'adopt', record['id'],
                                                 '--verification', str(path), '--json')
        self.fx.write_evidence(path, good)
        self.fx.adopt(record, path)

    def test_skill_validation_accepts_container_and_legacy_commands(self):
        validator = Path('/opt/moneybuddy/validate-skill.py')
        if not validator.exists():
            validator = Path(__file__).resolve().parents[1] / 'container/validate-skill.py'
        for legacy in (False, True):
            with self.subTest(legacy=legacy):
                fixture = ReviewFixture()
                self.addCleanup(fixture.close)
                skill = '.claude/skills/example'
                fixture.write(skill + '/SKILL.md',
                              '---\nname: example\ndescription: Validate an example skill.\n---\n# Example\n')
                record = fixture.start('--file', skill + '/SKILL.md')
                path, evidence = fixture.evidence(record)
                executable = validator
                if legacy:
                    executable = fixture.parent / 'quick_validate.py'
                    shutil.copyfile(validator, executable)
                command = [sys.executable, str(executable), skill]
                result = fixture.command(command, root=fixture.tree(record))
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                log = path.with_name('skill-validation.log')
                log.write_text(result.stdout + result.stderr, encoding='utf-8')
                check = {'id': 'skill-validation', 'stage': 'final', 'sha': record['finished'],
                         'command': json.dumps(command), 'status': 'PASS', 'exit_code': 0,
                         'report': log.name}
                evidence['checks'].append(check)
                check['command'] = 'python3 unrelated-check.py'
                fixture.write_evidence(path, evidence)
                refused = fixture.cli('adopt', record['id'], '--verification', str(path), '--json', ok=False)
                self.assertIn('Required command was not recorded: skill-validation',
                              refused.stdout + refused.stderr)
                self.assertEqual(fixture.git('rev-parse', 'HEAD').strip(), record['finished'])
                check['command'] = json.dumps(command)
                fixture.write_evidence(path, evidence)
                fixture.adopt(record, path)

    def test_evidence_reports_cannot_escape_or_traverse_a_symlink(self):
        record = self.fx.start()
        path, good = self.fx.evidence(record)
        outside = self.fx.parent / 'unowned-report.log'
        outside.write_text('Outside evidence is not owned by this review.\n')
        for report in (str(outside), '../unowned-report.log'):
            with self.subTest(report=report):
                candidate = json.loads(json.dumps(good))
                candidate['checks'][0]['report'] = report
                self.fx.write_evidence(path, candidate)
                self.assert_refused_without_move(record, 'adopt', record['id'],
                                                 '--verification', str(path), '--json')
        link = path.with_name('linked-report.log')
        try:
            link.symlink_to(outside)
        except OSError:
            return  # Traversal cases above remain portable; native link privilege varies.
        candidate = json.loads(json.dumps(good))
        candidate['checks'][0]['report'] = link.name
        self.fx.write_evidence(path, candidate)
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')

    def test_normal_main_differences_do_not_waive_or_replace_checkpoint_preservation(self):
        record = self.fx.start(scope='app')
        path, evidence = self.fx.evidence(record)
        main = evidence['comparisons']['main']
        main['differences'] = ['Intended finished task documentation differs from frozen main.']
        main['channels']['tools']['status'] = 'DIFFERENT'
        for item in evidence['checks']:
            if item['id'].endswith('-main'):
                item.update(status='DIFFERENT', exit_code=1, journeys_healthy=True,
                            explanation=main['differences'][0])
        self.fx.write_evidence(path, evidence)
        self.fx.adopt(record, path)
        self.assertEqual(self.fx.record(record['id'])['phase'], 'completed')

    def test_status_lists_multiple_task_records_with_descriptions_and_explicit_resume(self):
        first = self.fx.start(description='First finished task')
        self.fx.write('docs/task.md', 'Second completed task revision\n')
        second = self.fx.start('--file', 'docs/task.md', description='Second finished task')
        response = json.loads(self.fx.cli('status', '--json').stdout)
        text = json.dumps(response)
        for record in (first, second):
            self.assertIn(record['id'], text)
            self.assertIn(record['description'], text)
        self.fx.cli('resume', second['id'], '--json')
        self.assert_preserved(first)
        self.assert_preserved(second)

    def test_unknown_operation_lock_is_preserved_and_never_treated_as_stale(self):
        self.fx.store.mkdir(exist_ok=True)
        lock = self.fx.store / 'operation.lock'
        unknown = b'Unknown prior lock owner; do not remove\n'
        lock.write_bytes(unknown)
        self.fx.cli('start', '--description', 'Blocked by unknown lock', '--scope', 'docs',
                     '--json', ok=False)
        self.assertEqual(lock.read_bytes(), unknown)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), self.fx.finished)
        self.assertFalse(self.fx.records())

    def test_ambiguous_live_candidates_report_both_descriptions_without_mutation(self):
        first = self.fx.start(description='First plausible finished review')
        self.fx.write('docs/task.md', 'Second completed task revision\n')
        second = self.fx.start('--file', 'docs/task.md', description='Second plausible finished review')
        # Model an interrupted predecessor transition: both retained records have
        # valid refs and worktrees, but neither is authoritatively superseded.
        first_current = self.fx.record(first['id'])
        first_current['phase'] = 'ready'
        self.fx.save_record(first_current)
        snapshots = {record['id']: (self.fx.store / record['id'] / 'record.json').read_bytes()
                     for record in (first, second)}
        head = self.fx.git('rev-parse', 'HEAD')
        refs = self.fx.git('show-ref')
        result = self.fx.cli('start', '--description', 'Ambiguous retry', '--scope', 'docs',
                             '--json', ok=False)
        for record in (first, second):
            self.assertIn(record['id'], result.stderr + result.stdout)
            self.assertIn(record['description'], result.stderr + result.stdout)
            self.assertEqual((self.fx.store / record['id'] / 'record.json').read_bytes(),
                             snapshots[record['id']])
        self.assertEqual(self.fx.git('rev-parse', 'HEAD'), head)
        self.assertEqual(self.fx.git('show-ref'), refs)

    def test_explicit_safe_legacy_import_preserves_backup_and_requires_new_independence(self):
        record = self.fx.start()
        path, _ = self.fx.evidence(record)
        legacy = self.fx.record(record['id'])
        legacy['schema_version'] = 0
        legacy['verification'] = {'fresh': True, 'reviewed': record['finished'], 'path': str(path)}
        self.fx.save_record(legacy)
        self.fx.cli('resume', record['id'], '--json', ok=False)
        self.fx.cli('resume', record['id'], '--import-legacy', '--json')
        backup = path.parent / 'record.legacy.json'
        self.assertEqual(json.loads(backup.read_text()), legacy)
        imported = self.fx.record(record['id'])
        self.assertIsNone(imported['verification'])
        self.assertEqual(imported['workers'], {})
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')
        self.assert_preserved(record)

    def test_foreign_legacy_import_is_refused_without_record_or_workspace_change(self):
        record = self.fx.start()
        legacy = self.fx.record(record['id'])
        legacy['schema_version'] = 0
        legacy['original_checkout'] = str(self.fx.parent / 'foreign checkout')
        self.fx.save_record(legacy)
        record_path = self.fx.store / record['id'] / 'record.json'
        before = record_path.read_bytes()
        self.fx.cli('resume', record['id'], '--import-legacy', '--json', ok=False)
        self.assertEqual(record_path.read_bytes(), before)
        self.assertFalse(record_path.with_name('record.legacy.json').exists())
        self.assertTrue(self.fx.tree(record).exists())
        self.assert_preserved(record)

    def test_start_retry_cleans_eligible_completed_retained_workspaces(self):
        record = self.fx.start()
        self.fx.completed_with_retained_worktrees(record)
        self.assertTrue(self.fx.tree(record).exists())
        retried = self.fx.start(description='Retry completed task cleanup')
        self.assertEqual(retried['id'], record['id'])
        self.assertFalse(self.fx.tree(record).exists())
        self.assertFalse(self.fx.tree(record, 'baseline').exists())
        self.assert_preserved(record)

    @unittest.skipIf(os.name == 'nt', 'POSIX signal fault; native Windows interruption exercised separately')
    def test_interrupted_checkpoint_after_ref_update_preserves_unrelated_index_on_resume(self):
        self.fx.write('docs/task.md', 'selected completed checkpoint\n')
        self.fx.write('unrelated.txt', 'unrelated staged version\n')
        self.fx.git('add', '--', 'unrelated.txt')
        staged = self.fx.git('ls-files', '--stage', '-z', '--', 'unrelated.txt')
        self.fx.write('unrelated.txt', 'unrelated unstaged version\n')
        env, marker = self.fx.interruption_env(['update-ref', 'refs/heads/work/finished-task'])
        result = self.fx.command([sys.executable, SCRIPT, 'start', '--description',
            'Interrupted selective checkpoint', '--scope', 'docs', '--file', 'docs/task.md', '--json'], env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), result.stderr + result.stdout)
        record = next(iter(self.fx.records().values()))
        actual = self.fx.git('rev-parse', 'HEAD').strip()
        self.assertNotEqual(actual, self.fx.finished)
        self.fx.cli('resume', record['id'], '--json')
        resumed = self.fx.record(record['id'])
        self.assertEqual(resumed['finished'], actual)
        self.assertEqual(self.fx.git('show', 'HEAD:docs/task.md'), 'selected completed checkpoint\n')
        self.assertEqual(self.fx.git('ls-files', '--stage', '-z', '--', 'unrelated.txt'), staged)
        self.assertEqual((self.fx.root / 'unrelated.txt').read_text(), 'unrelated unstaged version\n')
        self.assert_preserved(resumed)

    @unittest.skipIf(os.name == 'nt', 'POSIX signal fault; native Windows interruption exercised separately')
    def test_interrupted_after_worktree_remove_resumes_idempotent_cleanup(self):
        record = self.fx.start()
        path, _ = self.fx.evidence(record)
        env, marker = self.fx.interruption_env(['worktree', 'remove'])
        result = self.fx.command([sys.executable, SCRIPT, 'adopt', record['id'],
                                  '--verification', str(path), '--json'], env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), result.stderr + result.stdout)
        self.fx.cli('resume', record['id'], '--json')
        self.fx.cli('cleanup', record['id'], '--json')
        self.assertFalse(self.fx.tree(record).exists())
        self.assertFalse(self.fx.tree(record, 'baseline').exists())
        self.assertTrue(path.is_file())
        self.assert_preserved(record)

    def test_active_workers_and_role_reuse_block_adoption(self):
        record = self.fx.start()
        self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record)
        self.fx.worker(record, 'fixer', 'technical-fixer', state='active')
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')
        self.fx.cli('worker', record['id'], '--role', 'verifier', '--worker-id',
                     'technical-fixer', '--state', 'stopped', ok=False)
        self.fx.worker(record, 'fixer', 'technical-fixer')
        self.fx.adopt(record, path)

    def test_dirty_original_staged_unstaged_and_untracked_all_block_adoption(self):
        record = self.fx.start()
        self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record)
        for mode in ('unstaged', 'staged', 'untracked'):
            with self.subTest(mode=mode):
                name = 'temporary.txt' if mode == 'untracked' else 'unrelated.txt'
                prior = (self.fx.root / name).read_bytes() if (self.fx.root / name).exists() else None
                self.fx.write(name, 'unrelated user work must survive\n')
                if mode == 'staged':
                    self.fx.git('add', '--', name)
                self.assert_refused_without_move(record, 'adopt', record['id'],
                                                 '--verification', str(path), '--json')
                self.assertEqual((self.fx.root / name).read_text(), 'unrelated user work must survive\n')
                # Explicit fixture teardown of only the bytes this test created.
                if prior is None:
                    (self.fx.root / name).unlink()
                else:
                    (self.fx.root / name).write_bytes(prior)
                if mode == 'staged':
                    self.fx.git('add', '--', name)
        self.fx.adopt(record, path)

    def test_advanced_original_or_other_branch_never_receives_review_merge(self):
        record = self.fx.start()
        self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record)
        self.fx.git('switch', '-c', 'work/unrelated-checkout')
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')
        self.fx.git('switch', 'work/finished-task')
        self.fx.write('unrelated.txt', 'advanced original content\n')
        self.fx.git('add', '--', 'unrelated.txt')
        self.fx.git('commit', '-m', 'local work after checkpoint')
        advanced = self.fx.git('rev-parse', 'HEAD').strip()
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), advanced)

    def test_review_advance_after_verifier_stopped_invalidates_attestation(self):
        record = self.fx.start()
        self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record)
        self.fx.commit_fix(record, content='later unchecked correction\n')
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')

    def test_app_channels_and_main_comparison_remain_separate_adoption_gates(self):
        record = self.fx.start(scope='app')
        path, good = self.fx.evidence(record)
        mutations = {
            'missing-checkpoint': lambda value: value['comparisons'].pop('checkpoint'),
            'missing-main': lambda value: value['comparisons'].pop('main'),
            'stale-checkpoint': lambda value: value['comparisons']['checkpoint'].update(base=self.fx.base),
            'product-difference': lambda value: value['comparisons']['checkpoint'].update(differences=['Visible label changed']),
            'missing-browser-version': lambda value: value['browser'].pop('version'),
        }
        for channel in ('phone', 'tools', 'wiring', 'tracking', 'browser'):
            mutations['missing-' + channel] = lambda value, channel=channel: value['comparisons']['checkpoint']['channels'].pop(channel)
            mutations['different-' + channel] = lambda value, channel=channel: value['comparisons']['checkpoint']['channels'][channel].update(status='DIFFERENT')
        for option in ('--report', '--allow-declared', '--threshold 10'):
            def relax(value, option=option):
                next(item for item in value['checks'] if item['id'] == 'journeys-checkpoint')['command'] += ' ' + option
            mutations['waiver-' + option] = relax
        for name, mutate in mutations.items():
            with self.subTest(gate=name):
                candidate = json.loads(json.dumps(good))
                mutate(candidate)
                self.fx.write_evidence(path, candidate)
                self.assert_refused_without_move(record, 'adopt', record['id'],
                                                 '--verification', str(path), '--json')
        self.fx.write_evidence(path, good)
        self.fx.adopt(record, path)

    def test_flow_requires_its_own_checkpoint_comparison_and_checks(self):
        record = self.fx.start(scope='flow:sample')
        path, good = self.fx.evidence(record)
        for omitted in ('flows', 'flow-sample-runtime', 'flow-sample-browser', 'flow-sample-scope'):
            with self.subTest(omitted=omitted):
                candidate = json.loads(json.dumps(good))
                if omitted == 'flows':
                    candidate.pop('flows')
                else:
                    candidate['checks'] = [item for item in candidate['checks'] if item['id'] != omitted]
                self.fx.write_evidence(path, candidate)
                self.assert_refused_without_move(record, 'adopt', record['id'],
                                                 '--verification', str(path), '--json')
        self.fx.write_evidence(path, good)
        self.fx.adopt(record, path)

    def test_full_app_evidence_rejects_narrowed_or_missing_comparator_commands(self):
        cases = [('journeys', '--only esf-full', None),
                 ('browser', '--only picker-tour', None),
                 ('browser', '--variants naturalLight', None),
                 ('journeys-checkpoint', '--only esf-full', None),
                 ('browser-checkpoint', '--variants naturalLight', None),
                 ('journeys-main', '--only esf-full', None),
                 ('browser-main', '--variants naturalLight', None)]
        for ident in ('journeys-checkpoint', 'browser-checkpoint', 'journeys-main', 'browser-main'):
            cases.append((ident, None, '--against' if ident.startswith('journeys') else '--compare'))
        for ident, narrowed, missing_switch in cases:
            with self.subTest(check=ident, narrowed=narrowed, missing_switch=missing_switch):
                fixture = ReviewFixture()
                try:
                    record = fixture.start(scope='app')
                    path, evidence = fixture.evidence(record)
                    item = next(check for check in evidence['checks'] if check['id'] == ident)
                    if narrowed:
                        item['command'] += ' ' + narrowed
                    else:
                        self.assertIn(missing_switch, item['command'])
                        item['command'] = item['command'].replace(missing_switch + ' ', '')
                    fixture.write_evidence(path, evidence)
                    before = fixture.git('rev-parse', 'HEAD')
                    fixture.cli('adopt', record['id'], '--verification', str(path), '--json', ok=False)
                    self.assertEqual(fixture.git('rev-parse', 'HEAD'), before)
                    self.assertEqual(fixture.git('rev-parse', record['checkpoint_ref']).strip(), record['finished'])
                finally:
                    fixture.close()

    def test_ignored_collision_refuses_adoption_and_resume_preserving_original(self):
        record = self.fx.start()
        tree = self.fx.tree(record)
        relative = 'docs/new.md'
        exclude = Path(self.fx.git('rev-parse', '--git-path', 'info/exclude').strip())
        if not exclude.is_absolute():
            exclude = self.fx.root / exclude
        with exclude.open('a') as stream:
            stream.write('\n' + relative + '\n')
        self.fx.write(relative, 'private original notes\n')
        self.fx.write(relative, 'reviewed documentation\n', root=tree)
        self.fx.git('add', '-f', '--', relative, root=tree)
        self.fx.git('commit', '-m', 'add reviewed documentation', root=tree)
        reviewed = self.fx.git('rev-parse', 'HEAD', root=tree).strip()
        path, _ = self.fx.evidence(record, reviewed)
        for args in [('adopt', record['id'], '--verification', str(path), '--json'),
                     ('resume', record['id'], '--json')]:
            result = self.assert_refused_without_move(record, *args)
            self.assertIn('overwritten', result.stdout + result.stderr)
            self.assertEqual((self.fx.root / relative).read_text(), 'private original notes\n')
            self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), record['finished'])
        self.assertEqual(self.fx.record(record['id'])['phase'], 'adopting')
        (self.fx.root / relative).unlink()
        self.fx.write('ignored-cache/dependency.txt', 'installed dependency\n')
        self.fx.cli('resume', record['id'], '--json')
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), reviewed)
        self.assertEqual((self.fx.root / 'ignored-cache/dependency.txt').read_text(), 'installed dependency\n')

    def test_managed_hidden_index_flags_block_verification_and_verified_preview(self):
        record = self.fx.start()
        path, _ = self.fx.evidence(record)
        snapshots = {}
        for role, flag in [('baseline', '--assume-unchanged'), ('review', '--skip-worktree')]:
            tree = self.fx.tree(record, role)
            self.fx.git('update-index', flag, '--', 'docs/task.md', root=tree)
            self.fx.write('docs/task.md', 'hidden local notes\n', root=tree)
            index = Path(self.fx.git('rev-parse', '--git-path', 'index', root=tree).strip())
            if not index.is_absolute():
                index = tree / index
            snapshots[role] = (index, index.read_bytes())
        for role, (index, content) in snapshots.items():
            version = 'finished' if role == 'baseline' else 'reviewed'
            preview = json.loads(self.fx.cli('url', record['id'], '--version', version, '--json').stdout)
            self.assertTrue(preview['dirty'])
            self.assertFalse(preview['verified'])
            self.assertEqual(index.read_bytes(), content)
        # Verification/adoption must also refuse a workspace whose status hides edits.
        self.assert_refused_without_move(record, 'adopt', record['id'], '--verification', str(path), '--json')

    def test_hidden_index_flags_preserve_bytes_during_cleanup_retries(self):
        record = self.fx.start()
        path, _ = self.fx.evidence(record)
        snapshots = {}
        # Establish completion first, then introduce flags to exercise both cleanup paths.
        self.fx.completed_with_retained_worktrees(record, path)
        for role, flag in [('baseline', '--assume-unchanged'), ('review', '--skip-worktree')]:
            tree = self.fx.tree(record, role)
            self.fx.git('update-index', flag, '--', 'docs/task.md', root=tree)
            self.fx.write('docs/task.md', 'hidden local notes\n', root=tree)
            index = Path(self.fx.git('rev-parse', '--git-path', 'index', root=tree).strip())
            if not index.is_absolute():
                index = tree / index
            snapshots[role] = (index, index.read_bytes())
        for command in [('adopt', record['id'], '--verification', str(path), '--json'),
                        ('cleanup', record['id'], '--json')]:
            self.fx.cli(*command)
            for role, (index, content) in snapshots.items():
                self.assertTrue(self.fx.tree(record, role).exists(), 'cleanup removed hidden tracked edits')
                self.assertEqual((self.fx.tree(record, role) / 'docs/task.md').read_text(), 'hidden local notes\n')
                self.assertEqual(index.read_bytes(), content)

    def test_original_hidden_index_flags_block_adoption_without_changing_index(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record, reviewed)
        for flag, clear in [('--assume-unchanged', '--no-assume-unchanged'),
                            ('--skip-worktree', '--no-skip-worktree')]:
            self.fx.git('update-index', flag, '--', 'docs/task.md')
            self.fx.write('docs/task.md', 'private hidden notes\n')
            index = self.fx.root / '.git/index'
            before = index.read_bytes()
            preview = json.loads(self.fx.cli('url', record['id'], '--version', 'original', '--json').stdout)
            self.assertTrue(preview['dirty'])
            self.assertFalse(preview['verified'])
            self.assert_refused_without_move(record, 'adopt', record['id'], '--verification', str(path), '--json')
            self.assertEqual(index.read_bytes(), before)
            self.assertEqual((self.fx.root / 'docs/task.md').read_text(), 'private hidden notes\n')
            self.fx.git('update-index', clear, '--', 'docs/task.md')
            self.fx.write('docs/task.md', self.fx.git('show', 'HEAD:docs/task.md'))

    def test_completed_cleanup_refuses_dirty_ignored_advanced_or_mismatched_worktree(self):
        record = self.fx.start()
        self.fx.completed_with_retained_worktrees(record)
        tree = self.fx.tree(record)
        baseline = self.fx.tree(record, 'baseline')
        self.fx.write('ignored-cache/keep.txt', 'ignored evidence must survive\n', root=baseline)
        self.fx.write('untracked-worker.txt', 'untracked worker evidence\n', root=tree)
        self.fx.cli('cleanup', record['id'], '--json')
        self.assertTrue((baseline / 'ignored-cache/keep.txt').exists())
        self.assertTrue((tree / 'untracked-worker.txt').exists())
        (tree / 'untracked-worker.txt').unlink()
        self.fx.write('docs/task.md', 'advanced worker result\n', root=tree)
        self.fx.git('add', '--', 'docs/task.md', root=tree)
        self.fx.git('commit', '-m', 'retain later worker commit', root=tree)
        advanced = self.fx.git('rev-parse', 'HEAD', root=tree).strip()
        self.fx.cli('cleanup', record['id'], '--json')
        self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=tree).strip(), advanced)
        self.fx.git('switch', '-c', 'work/unrelated-review-branch', root=tree)
        self.fx.cli('cleanup', record['id'], '--json')
        self.assertTrue(tree.exists())
        self.assert_preserved(record)

    def test_cleanup_preserves_unknown_unregistered_content_and_managed_parent(self):
        record = self.fx.start()
        self.fx.completed_with_retained_worktrees(record)
        tree = self.fx.tree(record)
        unknown = tree.parent / 'unknown-neighbor.txt'
        unknown.write_text('unknown sibling must survive\n')
        self.fx.git('worktree', 'remove', str(tree))
        self.fx.write('unknown.txt', 'unregistered path content\n', root=tree)
        outcome = self.fx.cli('cleanup', record['id'], '--json')
        self.assertIn('retained', outcome.stdout)
        self.assertEqual((tree / 'unknown.txt').read_text(), 'unregistered path content\n')
        self.assertEqual(unknown.read_text(), 'unknown sibling must survive\n')
        self.assert_preserved(record)

    def test_completed_preview_falls_back_to_exact_original_and_evidence_can_go_stale(self):
        record = self.fx.start(scope='app')
        path, good = self.fx.evidence(record)
        self.fx.adopt(record, path)
        result = json.loads(self.fx.cli('url', record['id'], '--version', 'reviewed', '--json').stdout)
        self.assertTrue(result['available'])
        self.assertTrue(result['verified'])
        self.assertEqual(Path(result['path']), self.fx.root / 'index.html')
        report = path.parent / good['checks'][0]['report']
        report.unlink()
        result = json.loads(self.fx.cli('url', record['id'], '--version', 'reviewed', '--json').stdout)
        self.assertFalse(result['verified'])
        status = json.loads(self.fx.cli('status', record['id'], '--json').stdout)
        self.assertIn('false', json.dumps(status).lower())
        self.assert_preserved(record)

    def test_phase_completed_without_bound_adoption_does_not_authorize_cleanup(self):
        record = self.fx.start()
        edited = self.fx.record(record['id'])
        edited['phase'] = 'completed'
        edited['reviewed'] = record['finished']
        edited['adoption'] = None
        edited['workspaces']['review']['retained_head'] = record['finished']
        self.fx.save_record(edited)
        self.fx.cli('cleanup', record['id'], '--json', ok=False)
        self.assertTrue(self.fx.tree(record).exists())
        self.assertTrue(self.fx.tree(record, 'baseline').exists())
        self.assert_preserved(record)

    def test_completed_resume_and_adopt_never_report_missing_evidence_fresh(self):
        record = self.fx.start()
        path, good = self.fx.evidence(record)
        self.fx.adopt(record, path)
        (path.parent / good['checks'][0]['report']).unlink()
        for command in [('resume', record['id'], '--json'),
                        ('adopt', record['id'], '--verification', str(path), '--json')]:
            with self.subTest(command=command[0]):
                result = self.fx.command([sys.executable, SCRIPT, *command])
                if result.returncode == 0:
                    response = json.loads(result.stdout)
                    self.assertFalse(response['verification']['fresh'])
                else:
                    self.assertTrue(result.stderr or result.stdout)
        self.assert_preserved(record)

    def test_weakened_synthetic_harness_cannot_replace_independent_checkpoint_control(self):
        record = self.fx.start(scope='app')
        baseline = self.fx.tree(record, 'baseline')
        tree = self.fx.tree(record)
        # Prove setup first: unchanged fixture harness finds the visible label.
        runner = baseline / 'tests/normalization.py'
        passed = self.fx.command([sys.executable, runner, baseline / 'app/index.html'])
        self.assertEqual(passed.returncode, 0, passed.stderr)
        self.fx.write('app/index.html', '<title>Changed visible label</title>\n', root=tree)
        self.fx.write('tests/normalization.py', "print('PASS weakened synthetic harness')\n", root=tree)
        self.fx.git('add', '--', 'app/index.html', 'tests/normalization.py', root=tree)
        self.fx.git('commit', '-m', 'deliberate fixture regression with weakened harness', root=tree)
        reviewed = self.fx.git('rev-parse', 'HEAD', root=tree).strip()
        hidden = self.fx.command([sys.executable, tree / 'tests/normalization.py', tree / 'app/index.html'])
        self.assertEqual(hidden.returncode, 0, hidden.stderr)
        control = self.fx.command([sys.executable, runner, tree / 'app/index.html'])
        self.assertNotEqual(control.returncode, 0)
        self.assertIn('visible fixture label missing', control.stderr)
        path, evidence = self.fx.evidence(record, reviewed)
        control_report = path.with_name('independent-checkpoint-control.log')
        control_report.write_text('Passing baseline:\n' + passed.stdout +
                                  '\nWeakened harness:\n' + hidden.stdout +
                                  '\nUnchanged checkpoint harness:\n' + control.stderr)
        evidence['harness'].update(changed=True)
        self.fx.write_evidence(path, evidence)
        result = self.assert_refused_without_move(record, 'adopt', record['id'],
                                                  '--verification', str(path), '--json')
        self.assertIn('control', (result.stdout + result.stderr).lower())
        # Green revised summaries cannot waive a failed unchanged-harness control.
        for key in ('unchanged_checkpoint_control', 'selftests', 'negative_tests'):
            evidence['harness'][key] = {'status': 'PASS', 'exit_code': 0,
                'baseline': record['finished'], 'reviewed': reviewed,
                'command': json.dumps([sys.executable, str(runner), str(tree / 'app/index.html')]),
                'report': control_report.name}
        evidence['harness']['unchanged_checkpoint_control'].update(status='FAIL', exit_code=control.returncode)
        evidence['harness']['negative_tests'].update(regression_detected=False,
            regression_exit_code=0, expected_reason='visible fixture label missing', actual_reason='')
        self.fx.write_evidence(path, evidence)
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')

    @unittest.skipIf(os.name == 'nt', 'POSIX process signal fault; native Windows interruption exercised separately')
    def test_interrupted_worktree_creation_resumes_from_persisted_intent(self):
        env, marker = self.fx.interruption_env(['worktree', 'add'])
        result = self.fx.command([sys.executable, self.fx_script(), 'start', '--description',
                                  'Interrupted creation fixture', '--scope', 'docs', '--json'], env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), result.stderr + result.stdout)
        records = list(self.fx.records().values())
        self.assertEqual(len(records), 1)
        record = records[0]
        self.fx.cli('resume', record['id'], '--json')
        resumed = self.fx.record(record['id'])
        self.assertEqual(resumed['finished'], self.fx.finished)
        self.assertTrue(self.fx.tree(resumed).exists())
        self.assertTrue(self.fx.tree(resumed, 'baseline').exists())
        self.assert_preserved(resumed)

    @unittest.skipIf(os.name == 'nt', 'POSIX process signal fault; native Windows interruption exercised separately')
    def test_interrupted_after_real_merge_resumes_by_inspection_without_second_merge(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record, reviewed)
        env, marker = self.fx.interruption_env(['merge', '--ff-only'])
        result = self.fx.command([sys.executable, self.fx_script(), 'adopt', record['id'],
                                  '--verification', str(path), '--json'], env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), result.stderr + result.stdout)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), reviewed)
        reflog = self.fx.git('reflog', 'show', '--format=%H %gs', record['original_branch'])
        self.fx.cli('resume', record['id'], '--json')
        self.assertEqual(self.fx.git('reflog', 'show', '--format=%H %gs', record['original_branch']), reflog)
        self.assertEqual(self.fx.record(record['id'])['phase'], 'completed')
        self.assert_preserved(record)

    @unittest.skipIf(os.name == 'nt', 'POSIX signal fault; native Windows interruption exercised separately')
    def test_successor_ref_interruption_repairs_links_and_allows_completed_ancestor_cleanup(self):
        first = self.fx.start(description='Original finished task')
        self.fx.write('docs/task.md', 'Successor completed task revision\n')
        env, marker = self.fx.interruption_env(
            ['update-ref', 'refs/heads/review/pre-pr-'], last_arg_startswith=True)
        result = self.fx.command([sys.executable, SCRIPT, 'start', '--description',
            'Interrupted successor finished task', '--scope', 'docs',
            '--file', 'docs/task.md', '--json'], env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), result.stderr + result.stdout)
        records = self.fx.records()
        self.assertEqual(len(records), 2)
        successor = next(value for key, value in records.items() if key != first['id'])
        self.assertEqual(successor['predecessor'], first['id'])
        self.fx.cli('resume', successor['id'], '--json')
        predecessor = self.fx.record(first['id'])
        successor = self.fx.record(successor['id'])
        self.assertEqual(predecessor['phase'], 'superseded')
        self.assertEqual(predecessor['successor'], successor['id'])
        self.assertEqual(successor['predecessor'], predecessor['id'])
        retried = self.fx.start(description='Retry interrupted successor')
        self.assertEqual(retried['id'], successor['id'])
        self.fx.adopt(successor)
        self.fx.cli('cleanup', predecessor['id'], '--json')
        for record in (predecessor, successor):
            self.assertFalse(self.fx.tree(record).exists())
            self.assertFalse(self.fx.tree(record, 'baseline').exists())
            self.fx.git('rev-parse', record['review_ref'])
            self.assert_preserved(record)

    def test_completed_original_preview_loses_verification_when_retained_review_ref_advances(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record, reviewed)
        self.fx.completed_with_retained_worktrees(record, path)
        tree = self.fx.tree(record)
        self.fx.write('docs/task.md', 'Later review work after completion\n', root=tree)
        self.fx.git('add', '--', 'docs/task.md', root=tree)
        self.fx.git('commit', '-m', 'advance retained review ref', root=tree)
        advanced = self.fx.git('rev-parse', 'HEAD', root=tree).strip()
        self.assertNotEqual(advanced, reviewed)
        status = json.loads(self.fx.cli('status', record['id'], '--json').stdout)
        self.assertFalse(status['records'][0]['verification']['fresh'])
        preview = json.loads(self.fx.cli('url', record['id'], '--version', 'original', '--json').stdout)
        self.assertTrue(preview['available'])
        self.assertFalse(preview['verified'])
        self.assertEqual(preview['head'], reviewed)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), reviewed)
        self.assert_preserved(record)

    def test_cleaned_historical_preview_never_substitutes_advanced_original_task(self):
        record = self.fx.start(scope='app')
        self.fx.adopt(record)
        self.assertFalse(self.fx.tree(record).exists())
        self.assertFalse(self.fx.tree(record, 'baseline').exists())
        self.fx.write('docs/task.md', 'New original task after completed review\n')
        self.fx.git('add', '--', 'docs/task.md')
        self.fx.git('commit', '-m', 'advance original after no-fix completion')
        advanced = self.fx.git('rev-parse', 'HEAD').strip()
        self.assertNotEqual(advanced, record['finished'])
        for version in ('finished', 'reviewed'):
            with self.subTest(version=version):
                preview = json.loads(self.fx.cli('url', record['id'], '--version', version, '--json').stdout)
                self.assertFalse(preview['available'])
                self.assertFalse(preview.get('verified', False))
                self.assertTrue(preview.get('reason'))
        current = json.loads(self.fx.cli('url', record['id'], '--version', 'original', '--json').stdout)
        self.assertTrue(current['available'])
        self.assertFalse(current['verified'])
        self.assertEqual(current['head'], advanced)
        self.assertIn('current', current['identity'])
        self.assert_preserved(record)

    def test_status_isolates_malformed_recognized_record_and_preserves_healthy_record(self):
        healthy = self.fx.start(description='Healthy retained review')
        self.fx.write('docs/task.md', 'Later finished task revision\n')
        malformed = self.fx.start('--file', 'docs/task.md', description='Malformed retained review')
        broken = self.fx.record(malformed['id'])
        del broken['phase']
        self.fx.save_record(broken)
        paths = [self.fx.store / record['id'] / 'record.json' for record in (healthy, malformed)]
        before = {path: path.read_bytes() for path in paths}
        refs = self.fx.git('show-ref')
        response = json.loads(self.fx.cli('status', '--json').stdout)
        self.assertIn(healthy['id'], {record['id'] for record in response['records']})
        self.assertNotIn(malformed['id'], {record['id'] for record in response['records']})
        self.assertIn(malformed['id'], json.dumps(response['errors']))
        self.assertEqual({path: path.read_bytes() for path in paths}, before)
        self.assertEqual(self.fx.git('show-ref'), refs)

    def test_dirty_stopped_predecessor_is_preserved_through_successor_completion(self):
        first = self.fx.start(description='Review with unfinished retained correction')
        old_evidence, _ = self.fx.evidence(first)
        evidence_bytes = old_evidence.read_bytes()
        dirty = 'Uncommitted stopped-worker correction must survive\n'
        old_tree = self.fx.tree(first)
        self.fx.write('docs/task.md', dirty, root=old_tree)
        self.fx.write('docs/task.md', 'New completed original task revision\n')
        successor = self.fx.start('--file', 'docs/task.md', description='Newer completed task')
        self.assertNotEqual(successor['id'], first['id'])
        self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=old_tree).strip(), first['finished'])
        self.assertEqual((old_tree / 'docs/task.md').read_text(), dirty)
        self.assertEqual(old_evidence.read_bytes(), evidence_bytes)
        self.fx.adopt(successor)
        self.fx.cli('cleanup', first['id'], '--json')
        self.assertTrue(old_tree.exists())
        self.assertEqual((old_tree / 'docs/task.md').read_text(), dirty)
        self.assertEqual(old_evidence.read_bytes(), evidence_bytes)
        self.assertEqual((self.fx.root / 'docs/task.md').read_text(),
                         'New completed original task revision\n')
        self.assertFalse(self.fx.tree(successor).exists())
        for record in (first, successor):
            self.assert_preserved(record)
            self.fx.git('rev-parse', record['review_ref'])

    def test_actual_worker_stop_preserves_dirty_files_without_granting_verification(self):
        record = self.fx.start()
        self.fx.worker(record, 'reviewer', 'cold-reviewer')
        self.fx.worker(record, 'fixer', 'technical-fixer', state='active')
        tree = self.fx.tree(record)
        dirty = 'Uncommitted worker correction survives actual host stop\n'
        self.fx.write('docs/task.md', dirty, root=tree)
        self.fx.worker(record, 'fixer', 'technical-fixer', state='stopped')
        stopped = self.fx.record(record['id'])['workers']['technical-fixer']
        self.assertEqual(stopped['state'], 'stopped')
        self.assertFalse(stopped.get('verified_sha'))
        self.assertEqual((tree / 'docs/task.md').read_text(), dirty)
        self.fx.worker(record, 'verifier', 'independent-verifier', state='active')
        self.fx.worker(record, 'verifier', 'independent-verifier', state='stopped')
        stopped = self.fx.record(record['id'])['workers']['independent-verifier']
        self.assertEqual(stopped['state'], 'stopped')
        self.assertFalse(stopped.get('verified_sha'))
        self.assertEqual((tree / 'docs/task.md').read_text(), dirty)
        # Restore only this test's own bytes, without changing worker metadata.
        original = (self.fx.tree(record, 'baseline') / 'docs/task.md').read_text()
        self.fx.write('docs/task.md', original, root=tree)
        path, _ = self.fx.evidence(record, register=False)
        self.assert_refused_without_move(record, 'adopt', record['id'],
                                         '--verification', str(path), '--json')
        self.fx.worker(record, 'verifier', 'independent-verifier', state='stopped')
        self.fx.adopt(record, path)

    @unittest.skipIf(os.name == 'nt', 'POSIX symlink ownership faults; native Windows links require separate acceptance')
    def test_aliased_artifact_store_record_and_lock_never_mutate_external_targets(self):
        for condition in ('artifact-directory', 'whole-store', 'operation-lock', 'record-file'):
            with self.subTest(condition=condition):
                fixture = ReviewFixture()
                try:
                    record = fixture.start()
                    artifact = fixture.store / record['id']
                    record_path = artifact / 'record.json'
                    record_bytes = record_path.read_bytes()
                    index = Path(fixture.git('rev-parse', '--path-format=absolute', '--git-path', 'index').strip())
                    index_bytes = index.read_bytes()
                    refs = fixture.git('show-ref')
                    head = fixture.git('rev-parse', 'HEAD')
                    external = fixture.parent / ('external-' + condition)
                    if condition == 'artifact-directory':
                        alias = artifact
                        alias.rename(external)
                    elif condition == 'whole-store':
                        alias = fixture.store
                        alias.rename(external)
                    elif condition == 'operation-lock':
                        alias = fixture.store / 'operation.lock'
                        alias.rename(fixture.parent / 'retained-original-operation.lock')
                        external.write_bytes(b'')
                    else:
                        alias = record_path
                        alias.rename(external)
                    try:
                        alias.symlink_to(external, target_is_directory=external.is_dir())
                    except OSError as error:
                        self.skipTest(f'Platform cannot create ownership-test symlink: {error}')
                    def target_bytes():
                        if external.is_file():
                            return {'.': external.read_bytes()}
                        return {str(path.relative_to(external)): path.read_bytes()
                                for path in external.rglob('*') if path.is_file()}
                    external_bytes = target_bytes()
                    command = ('start', '--description', 'Aliased store retry', '--scope', 'docs', '--json') if (
                        condition == 'whole-store') else ('resume', record['id'], '--json')
                    fixture.cli(*command, ok=False)
                    self.assertTrue(alias.is_symlink())
                    self.assertEqual(alias.readlink(), external)
                    self.assertEqual(target_bytes(), external_bytes)
                    self.assertEqual(record_path.read_bytes(), record_bytes)
                    self.assertEqual(index.read_bytes(), index_bytes)
                    self.assertEqual(fixture.git('show-ref'), refs)
                    self.assertEqual(fixture.git('rev-parse', 'HEAD'), head)
                finally:
                    fixture.close()

    def test_missing_registered_tree_preserves_in_progress_merge_metadata(self):
        for role in ('baseline', 'review'):
            with self.subTest(role=role):
                fixture = ReviewFixture()
                try:
                    record = fixture.start()
                    tree = fixture.tree(record, role)
                    head = fixture.git('rev-parse', 'HEAD', root=tree).strip()
                    empty = fixture.git('commit-tree', head + '^{tree}', '-p', head,
                                        '-m', 'Empty descendant for pending merge', root=tree).strip()
                    fixture.git('merge', '--no-ff', '--no-commit', empty, root=tree)
                    self.assertEqual(fixture.git('status', '--porcelain', root=tree), '')
                    metadata = Path(fixture.git('rev-parse', '--path-format=absolute',
                                                '--git-dir', root=tree).strip())
                    retained = {path.name: path.read_bytes() for path in metadata.iterdir()
                                if path.is_file()}
                    self.assertIn('MERGE_HEAD', retained)
                    refs = fixture.git('show-ref')
                    shutil.rmtree(tree)  # Exact directory owned by this disposable fixture.
                    registrations = fixture.worktrees()
                    result = fixture.cli('resume', record['id'], '--json', ok=False)
                    self.assertIn('operation', (result.stdout + result.stderr).lower())
                    self.assertFalse(tree.exists())
                    self.assertEqual({path.name: path.read_bytes() for path in metadata.iterdir()
                                      if path.is_file()}, retained)
                    self.assertEqual(fixture.git('show-ref'), refs)
                    self.assertEqual(fixture.worktrees(), registrations)
                finally:
                    fixture.close()

    def test_completed_cleanup_retains_clean_tree_with_in_progress_merge(self):
        record = self.fx.start()
        self.fx.completed_with_retained_worktrees(record)
        tree = self.fx.tree(record)
        head = self.fx.git('rev-parse', 'HEAD', root=tree).strip()
        empty = self.fx.git('commit-tree', head + '^{tree}', '-p', head,
                            '-m', 'Empty descendant for pending merge', root=tree).strip()
        self.fx.git('merge', '--no-ff', '--no-commit', empty, root=tree)
        self.assertEqual(self.fx.git('status', '--porcelain', root=tree), '')
        metadata = Path(self.fx.git('rev-parse', '--path-format=absolute',
                                   '--git-dir', root=tree).strip())
        merge_head = (metadata / 'MERGE_HEAD').read_bytes()
        result = json.loads(self.fx.cli('cleanup', record['id'], '--json').stdout)
        self.assertEqual(result['cleanup']['review']['status'], 'retained')
        self.assertIn('operation', result['cleanup']['review']['reason'].lower())
        self.assertTrue(tree.exists())
        self.assertEqual((metadata / 'MERGE_HEAD').read_bytes(), merge_head)
        self.assert_preserved(record)

    @staticmethod
    def fx_script():
        return SCRIPT


if __name__ == '__main__':
    unittest.main()
