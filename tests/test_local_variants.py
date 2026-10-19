import importlib.util
import json
import os
from pathlib import Path, PureWindowsPath
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/local-variants.py'
spec = importlib.util.spec_from_file_location('variants', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VariantsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='local variants ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.git('init', '-b', 'work/test')
        self.git('config', 'user.email', 'test@example.com')
        self.git('config', 'user.name', 'Test')
        self.write('.gitignore', '.worktrees/\n.local-preview/\n')
        self.write('app/index.html', 'app')
        self.write('flows/sample/flow.json', json.dumps({'schema': 1, 'id': 'sample', 'label': 'Sample flow'}))
        self.write('flows/sample/index.html', 'flow')
        self.write('index.html', 'selector')
        self.write('task', 'initial\n')
        self.write('unrelated', 'original\n')
        self.git('add', '.')
        self.git('commit', '-m', 'initial')

    def write(self, name, text, root=None):
        path = (root or self.root) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def git(self, *args, root=None):
        return module.git(root or self.root, *args)

    def cli(self, *args, ok=True, root=None):
        result = subprocess.run(['python3', str(SCRIPT), *args], cwd=root or self.root, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0 if ok else 1, result.stderr + result.stdout)
        return result

    def state(self):
        ident = (self.root / '.local-preview/current').read_text()
        return json.loads((self.root / '.local-preview/sessions' / (ident + '.json')).read_text())

    def create(self, *args):
        self.cli('create', '--option', 'A <test>', 'first', '--option', 'B', 'second', *args)
        return self.state()

    def path(self, variant):
        return self.root / '.worktrees' / variant['id']

    def manifest(self):
        text = (self.root / '.local-preview/variants.js').read_text()
        prefix = 'window.MB_LOCAL_VARIANTS = '
        self.assertTrue(text.startswith(prefix))
        return json.loads(text[len(prefix):].rstrip().rstrip(';'))

    def test_url_command_needs_no_session_or_metadata(self):
        result = self.cli('url')
        self.assertIn('Selector: file:', result.stdout)
        self.assertFalse((self.root / '.local-preview').exists())
        explicit = self.cli('url', '--wsl-distro', 'PM Ubuntu')
        self.assertIn('file://wsl.localhost/PM%20Ubuntu/', explicit.stdout)
        self.assertIn('local%20variants%20', explicit.stdout)
        self.assertFalse((self.root / '.local-preview').exists())

    def test_checkpoint_preserves_unrelated_index_and_work(self):
        self.write('task', 'task change\n')
        self.write('new task', 'new')
        self.write('unrelated', 'staged\n')
        self.git('add', 'unrelated')
        self.write('unrelated', 'unstaged\n')
        self.write('other', 'untracked')
        state = self.create('--file', 'task', '--file', 'new task')
        self.assertEqual(self.git('diff', '--cached', '--name-only'), 'unrelated')
        self.assertEqual(self.git('show', 'HEAD:unrelated'), 'original')
        self.assertEqual((self.root / 'other').read_text(), 'untracked')
        for variant in state['variants']:
            self.assertEqual(self.git('rev-parse', 'HEAD', root=self.path(variant)), state['checkpoint'])
            self.assertEqual((self.path(variant) / 'task').read_text(), 'task change\n')
            self.assertEqual((self.path(variant) / '.local-preview/return.js').read_text(),
                             'window.MB_LOCAL_RETURN = {"href": "../../index.html"};\n')
        self.cli('create', '--option', 'C', 'third', ok=False)
        self.cli('create', '--option', 'C', 'third', root=self.path(state['variants'][0]), ok=False)

    def test_adoption_preserves_advanced_original_and_retains_variants(self):
        state = self.create()
        winner = state['variants'][1]
        self.write('unrelated', 'advance\n')
        self.git('add', 'unrelated')
        self.git('commit', '-m', 'advance original')
        advanced = self.git('rev-parse', 'HEAD')
        self.write('task', 'winner\n', root=self.path(winner))
        self.cli('adopt', winner['id'], '--file', 'task')
        self.git('merge-base', '--is-ancestor', advanced, 'HEAD')
        self.assertEqual(self.state()['status'], 'verification')
        self.assertEqual((self.root / 'task').read_text(), 'winner\n')
        self.cli('adopt', winner['id'], '--verified')
        self.assertEqual(self.state()['status'], 'closed')
        self.assertTrue(self.path(winner).exists())
        self.assertIn('"active": false', (self.root / '.local-preview/variants.js').read_text())
        self.cli('cleanup', winner['id'])
        self.assertFalse(self.path(winner).exists())
        self.git('rev-parse', winner['branch'])

    def test_flow_comparison_opens_that_flow(self):
        result = self.cli('create', '--flow', 'sample', '--option', 'A', 'first', '--option', 'B', 'second')
        state = self.state()
        self.assertEqual(state['target'], {'kind': 'flow', 'id': 'sample', 'label': 'Sample flow'})
        manifest = self.manifest()
        self.assertEqual(manifest['target'], {'kind': 'flow', 'id': 'sample', 'label': 'Sample flow',
                                              'path': 'flows/sample/index.html'})
        self.assertEqual([v['href'] for v in manifest['variants']],
                         ['.worktrees/variant-A/flows/sample/index.html', '.worktrees/variant-B/flows/sample/index.html'])
        self.assertIn('Comparing: Sample flow', result.stdout)
        self.assertIn('/.worktrees/variant-A/flows/sample/index.html', result.stdout)
        self.assertNotIn('/app/index.html', result.stdout)
        for variant in state['variants']:
            # Exit and refresh from a variant Flow reach the worktree root, which returns here.
            self.assertEqual((self.path(variant) / '.local-preview/return.js').read_text(),
                             'window.MB_LOCAL_RETURN = {"href": "../../index.html"};\n')

    def test_unusable_flow_is_refused_before_any_commit(self):
        self.write('flows/mismatch/flow.json', json.dumps({'id': 'other', 'label': 'Mismatch'}))
        self.write('flows/mismatch/index.html', 'flow')
        self.write('flows/blank/flow.json', json.dumps({'id': 'blank', 'label': ' '}))
        self.write('flows/blank/index.html', 'flow')
        self.write('flows/dir/flow.json', json.dumps({'id': 'dir', 'label': 'Directory'}))
        self.write('flows/dir/index.html/inner', 'not an entry')
        (self.root / 'flows/linked').mkdir()
        os.symlink('../sample/flow.json', self.root / 'flows/linked/flow.json')
        self.write('flows/linked/index.html', 'flow')
        self.git('add', 'flows')
        self.git('commit', '-m', 'unusable flows')
        self.write('flows/fresh/flow.json', json.dumps({'id': 'fresh', 'label': 'Fresh'}))
        self.write('flows/fresh/index.html', 'flow')
        self.write('flows/wrong/flow.json', json.dumps({'id': 'nope', 'label': 'Wrong'}))
        self.write('flows/wrong/index.html', 'flow')
        head = self.git('rev-parse', 'HEAD')
        for args in (['../app'], ['Sample'], ['a--b'], ['a' * 65], ['missing'], ['mismatch'], ['blank'],
                     ['dir'], ['linked'], ['fresh'],
                     ['wrong', '--file', 'flows/wrong/flow.json', '--file', 'flows/wrong/index.html']):
            with self.subTest(args=args):
                self.cli('create', '--option', 'A', 'first', '--flow', *args, ok=False)
                self.assertEqual(self.git('rev-parse', 'HEAD'), head)
                self.assertFalse((self.root / '.local-preview/current').exists())
                self.assertFalse((self.root / '.worktrees').exists())

    def test_uncommitted_flow_selected_with_file_is_accepted(self):
        self.write('flows/fresh/flow.json', json.dumps({'id': 'fresh', 'label': 'Fresh'}))
        self.write('flows/fresh/index.html', 'flow')
        state = self.create('--flow', 'fresh', '--file', 'flows/fresh/flow.json', '--file', 'flows/fresh/index.html')
        self.assertEqual(state['target'], {'kind': 'flow', 'id': 'fresh', 'label': 'Fresh'})
        self.assertEqual(self.git('show', state['checkpoint'] + ':flows/fresh/index.html'), 'flow')

    def test_session_without_target_compares_the_app(self):
        state = self.create()
        del state['target']
        module.save(self.root, state)
        self.cli('refresh')
        manifest = self.manifest()
        self.assertEqual(manifest['target'], {'kind': 'app', 'label': 'Prototype', 'path': 'app/index.html'})
        self.assertEqual(manifest['variants'][0]['href'], '.worktrees/variant-A/app/index.html')

    def test_invalid_target_refuses_refresh_but_close_and_cleanup_work(self):
        state = self.create('--flow', 'sample')
        before = (self.root / '.local-preview/variants.js').read_text()
        state['target'] = {'kind': 'flow', 'id': '../app', 'label': 'Escape'}
        module.save(self.root, state)
        self.cli('refresh', ok=False)
        self.assertEqual((self.root / '.local-preview/variants.js').read_text(), before)
        self.cli('close')
        self.assertFalse(self.manifest()['active'])
        self.cli('cleanup', *[v['id'] for v in state['variants']])
        self.assertFalse(self.path(state['variants'][0]).exists())

    def test_flow_adoption_keeps_changes_inside_that_flow(self):
        self.cli('create', '--flow', 'sample', '--option', 'A', 'app edit', '--option', 'B', 'moved',
                 '--option', 'C', 'flow only')
        state = self.state()
        head = self.git('rev-parse', 'HEAD')
        app_edit, moved, winner = state['variants']
        self.write('app/index.html', 'changed app', root=self.path(app_edit))
        refused = self.cli('adopt', app_edit['id'], '--file', 'app/index.html', ok=False)
        self.assertIn('outside flows/sample/', refused.stderr)
        self.assertIn('app/index.html', refused.stderr)
        # A move into the Flow must still show the app/ deletion.
        self.git('mv', 'app/index.html', 'flows/sample/moved.html', root=self.path(moved))
        self.git('commit', '-m', 'move', root=self.path(moved))
        self.assertIn('app/index.html', self.cli('adopt', moved['id'], ok=False).stderr)
        self.assertEqual(self.state()['status'], 'active')
        self.assertNotIn('winner', self.state())
        self.assertEqual(self.git('rev-parse', 'HEAD'), head)
        self.write('flows/sample/index.html', 'winning flow', root=self.path(winner))
        self.write('flows/catalog.json', '{}', root=self.path(winner))
        self.cli('adopt', winner['id'], '--file', 'flows/sample/index.html', '--file', 'flows/catalog.json')
        self.assertEqual(self.state()['status'], 'verification')
        self.assertEqual((self.root / 'flows/sample/index.html').read_text(), 'winning flow')
        self.assertEqual((self.root / 'app/index.html').read_text(), 'app')
        self.cli('adopt', winner['id'], '--verified')
        self.assertEqual(self.state()['status'], 'closed')

    def test_variant_missing_its_flow_is_omitted(self):
        state = self.create('--flow', 'sample')
        (self.path(state['variants'][0]) / 'flows/sample/index.html').unlink()
        result = self.cli('refresh')
        self.assertIn('Missing flows/sample/index.html in variant-A', result.stderr)
        self.assertEqual([v['id'] for v in self.manifest()['variants']], ['variant-B'])
        self.assertNotIn('.worktrees/variant-A/', result.stdout)
        self.assertIn('.worktrees/variant-B/flows/sample/index.html', result.stdout)

    def test_archived_flow_cleanup_keeps_current_app_comparison(self):
        old = self.create('--flow', 'sample')
        self.cli('close')
        current = self.create()
        self.cli('--session', old['id'], 'cleanup', old['variants'][0]['id'])
        manifest = self.manifest()
        self.assertEqual(manifest['target']['kind'], 'app')
        self.assertEqual(manifest['variants'][0]['id'], current['variants'][0]['id'])

    def test_dirty_cleanup_and_original_refused(self):
        winner = self.create()['variants'][0]
        self.write('other', 'keep')
        self.cli('adopt', winner['id'], ok=False)
        self.write('dirty', 'keep', root=self.path(winner))
        self.cli('close')
        self.cli('cleanup', winner['id'], ok=False)
        self.assertTrue((self.path(winner) / 'dirty').exists())

    def test_conflict_is_recoverable(self):
        winner = self.create()['variants'][0]
        self.write('task', 'original choice\n')
        self.git('add', 'task')
        self.git('commit', '-m', 'original choice')
        self.write('task', 'variant choice\n', root=self.path(winner))
        self.cli('adopt', winner['id'], '--file', 'task', ok=False)
        self.assertEqual(self.state()['status'], 'merging')
        self.assertTrue(self.git('ls-files', '--unmerged'))
        self.write('task', 'resolved choice\n')
        self.git('add', 'task')
        self.git('commit', '-m', 'Resolve choices')
        self.cli('adopt', winner['id'], '--verified')
        self.assertEqual(self.state()['status'], 'closed')

    def test_missing_and_wrong_branch(self):
        state = self.create()
        missing, changed = state['variants']
        self.git('worktree', 'remove', str(self.path(missing)))
        self.cli('refresh')
        manifest = (self.root / '.local-preview/variants.js').read_text()
        self.assertNotIn(missing['id'], manifest)
        self.git('switch', '-c', 'other', root=self.path(changed))
        self.cli('refresh', ok=False)

    def test_archived_cleanup_does_not_hide_current_comparison(self):
        old = self.create()
        self.cli('close')
        current = self.create()
        self.cli('--session', old['id'], 'cleanup', old['variants'][0]['id'])
        self.assertIn(current['variants'][0]['id'], (self.root / '.local-preview/variants.js').read_text())

    def test_readable_names_and_retained_branch_collision(self):
        state = self.create()
        self.assertEqual([v['id'] for v in state['variants']], ['variant-A', 'variant-B'])
        self.assertEqual([v['branch'] for v in state['variants']], ['variant/test-A', 'variant/test-B'])
        manifest = (self.root / '.local-preview/variants.js').read_text()
        self.assertIn('.worktrees/variant-A/app/index.html', manifest)
        self.cli('close')
        self.cli('cleanup', *[v['id'] for v in state['variants']])
        next_state = self.create()
        self.assertEqual([v['id'] for v in next_state['variants']], ['variant-A-2', 'variant-B-2'])
        self.assertEqual([v['branch'] for v in next_state['variants']], ['variant/test-A-2', 'variant/test-B-2'])
        self.cli('--session', state['id'], 'cleanup', 'variant-A')
        self.assertTrue(self.path(next_state['variants'][0]).exists())
        self.assertEqual(module.option_letter(26), 'Z')
        self.assertEqual(module.option_letter(27), 'AA')
        self.assertEqual(module.option_letter(52), 'AZ')
        self.assertEqual(module.option_letter(53), 'BA')

    def test_task_branch_names_are_deterministic(self):
        for task, expected in [('work/nested/task', 'nested/task'), ('design-task', 'design-task')]:
            with self.subTest(task=task):
                self.git('branch', '-m', task)
                state = self.create()
                self.assertEqual([v['branch'] for v in state['variants']],
                                 ['variant/' + expected + '-A', 'variant/' + expected + '-B'])
                for variant in state['variants']:
                    self.assertEqual(self.git('symbolic-ref', '--short', 'HEAD', root=self.path(variant)),
                                     variant['branch'])
                self.cli('close')
                self.cli('cleanup', *[v['id'] for v in state['variants']])

    def test_branch_collision_aligns_all_option_suffixes(self):
        self.git('branch', 'variant/Test-B')
        state = self.create()
        self.assertEqual([v['branch'] for v in state['variants']], ['variant/test-A-2', 'variant/test-B-2'])
        self.assertEqual([v['id'] for v in state['variants']], ['variant-A-2', 'variant-B-2'])
        self.git('rev-parse', 'variant/Test-B')

    def test_branch_namespace_collision_leaves_no_creation(self):
        self.git('branch', '-m', 'work/nested/task')
        self.git('branch', 'variant/nested')
        head = self.git('rev-parse', 'HEAD')
        result = self.cli('create', '--option', 'A', 'first', ok=False)
        self.assertIn('namespace is occupied', result.stderr)
        self.assertEqual(self.git('rev-parse', 'HEAD'), head)
        self.assertFalse((self.root / '.local-preview/current').exists())

    def test_legacy_session_cleanup(self):
        state = self.create()
        self.cli('close')
        self.cli('cleanup', *[v['id'] for v in state['variants']])
        for ident in [state['id'] + '-1', 'variant-A']:
            with self.subTest(ident=ident):
                legacy = {'id': ident, 'branch': 'variant/' + ident,
                          'label': 'Legacy', 'description': 'Existing comparison'}
                self.git('worktree', 'add', '-b', legacy['branch'], str(self.path(legacy)), state['checkpoint'])
                state['status'] = 'closed'
                state['variants'] = [legacy]
                module.save(self.root, state)
                self.cli('cleanup', legacy['id'])
                self.assertFalse(self.path(legacy).exists())
                self.git('rev-parse', legacy['branch'])

    def test_wrong_task_branch_mapping_is_refused(self):
        state = self.create()
        self.cli('close')
        state['status'] = 'closed'
        state['variants'][0]['branch'] = 'variant/another-task-A'
        module.save(self.root, state)
        result = self.cli('cleanup', state['variants'][0]['id'], ok=False)
        self.assertIn('Managed path or branch identity changed', result.stderr)
        self.assertTrue(self.path(state['variants'][0]).exists())

    def test_literal_files_and_managed_path_collision(self):
        self.write('task*', 'literal star')
        self.write('task-other', 'unrelated')
        self.create('--file', 'task*')
        self.assertEqual(self.git('show', 'HEAD:task*'), 'literal star')
        self.assertIn('?? task-other', self.git('status', '--short'))
        self.cli('close')
        import argparse
        args = argparse.Namespace(command='create', session=None, option=[('A', 'one')], file=[])
        self.write('.worktrees/variant-A-2/preserve', 'keep')
        module.run(self.root, args)
        self.assertEqual(self.state()['variants'][0]['id'], 'variant-A-3')
        self.assertEqual((self.root / '.worktrees/variant-A-2/preserve').read_text(), 'keep')

    def test_partial_creation_records_intent_and_collision_preserves_work(self):
        import argparse
        args = argparse.Namespace(command='create', session=None, option=[('A', 'one'), ('B', 'two')], file=[])
        original = module.git
        count = 0
        def interrupted(root, *args):
            nonlocal count
            if args[:2] == ('worktree', 'add'):
                count += 1
                if count == 2:
                    raise RuntimeError('interrupted')
            return original(root, *args)
        with patch.object(module, 'git', side_effect=interrupted):
            with self.assertRaisesRegex(RuntimeError, 'interrupted'):
                module.run(self.root, args)
        state = self.state()
        self.assertEqual(state['status'], 'creating')
        self.assertTrue(self.path(state['variants'][0]).exists())
        self.cli('status')
        self.cli('refresh', '--resume')
        self.assertEqual(self.state()['status'], 'active')
        for variant in state['variants']:
            self.assertEqual(self.git('rev-parse', 'HEAD', root=self.path(variant)), state['checkpoint'])
        self.cli('close')
        ident = state['id']
        with patch.object(module.uuid, 'uuid4') as mocked:
            mocked.return_value.hex = ident
            with self.assertRaisesRegex(RuntimeError, 'collision'):
                module.run(self.root, args)
        self.assertEqual(self.state()['id'], state['id'])


class BrowserUrlTests(unittest.TestCase):
    def test_native_platform_paths(self):
        with patch.dict(module.os.environ, {}, clear=True), patch.object(module.platform, 'release', return_value='Linux'):
            self.assertEqual(module.browser_url(Path('/home/PM/My app #1/index.html')),
                             'file:///home/PM/My%20app%20%231/index.html')
        self.assertEqual(module.browser_url(PureWindowsPath('C:/Users/PM/My app #1/index.html')),
                         'file:///C:/Users/PM/My%20app%20%231/index.html')
        self.assertEqual(module.browser_url(PureWindowsPath('//server/share/My app/index.html')),
                         'file://server/share/My%20app/index.html')

    def test_wsl_uses_windows_translation(self):
        for translated, expected in [
            ('//wsl.localhost/Ubuntu-24.04/home/PM/My app/index.html',
             'file://wsl.localhost/Ubuntu-24.04/home/PM/My%20app/index.html'),
            ('D:/My app/index.html', 'file:///D:/My%20app/index.html')]:
            with self.subTest(translated=translated), patch.dict(module.os.environ, {'WSL_DISTRO_NAME': 'Ubuntu-24.04'}, clear=True), patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, translated, '')) as run:
                self.assertEqual(module.browser_url(Path('/home/PM/My app/index.html')), expected)
                self.assertEqual(run.call_args.args[0], ['wslpath', '-w', '/home/PM/My app/index.html'])

    def test_wsl_fallback_and_explicit_distro(self):
        with patch.dict(module.os.environ, {'WSL_DISTRO_NAME': 'Ubuntu-24.04'}, clear=True), patch.object(module.subprocess, 'run', side_effect=FileNotFoundError):
            self.assertEqual(module.browser_url(Path('/home/PM/café #1/index.html')),
                             'file://wsl.localhost/Ubuntu-24.04/home/PM/caf%C3%A9%20%231/index.html')
            self.assertEqual(module.browser_url(Path('/home/PM/index.html'), 'Another Distro'),
                             'file://wsl.localhost/Another%20Distro/home/PM/index.html')
            with self.assertRaisesRegex(RuntimeError, 'Invalid WSL'):
                module.browser_url(Path('/home/PM/index.html'), '../escape')

    def test_container_on_wsl_kernel_keeps_internal_linux_urls(self):
        environment = {'MB_CONTAINER': '1', 'WSL_DISTRO_NAME': 'Inherited host distro',
                       'MB_WSL_DISTRO': 'Unmapped host distro'}
        with patch.dict(module.os.environ, environment, clear=True), patch.object(module.platform, 'release', return_value='microsoft-standard-WSL2'), patch.object(module.subprocess, 'run') as run:
            self.assertEqual(module.browser_url(Path('/tmp/fixture #1/index.html')),
                             'file:///tmp/fixture%20%231/index.html')
            run.assert_not_called()
            self.assertEqual(module.browser_url(Path('/home/PM/index.html'), 'Explicit distro'),
                             'file://wsl.localhost/Explicit%20distro/home/PM/index.html')

    def test_container_mapped_wsl_host_url_uses_explicit_host_distro(self):
        environment = {'MB_CONTAINER': '1', 'MB_HOST_ROOT': '/home/PM/project',
                       'MB_CONTAINER_PARENT': '/workspace', 'MB_WSL_DISTRO': 'Ubuntu PM'}
        with patch.dict(module.os.environ, environment, clear=True), patch.object(module.platform, 'release', return_value='microsoft-standard-WSL2'):
            self.assertEqual(module.browser_url(Path('/workspace/project/index.html')),
                             'file://wsl.localhost/Ubuntu%20PM/home/PM/project/index.html')

    def test_unknown_wsl_distro_does_not_print_linux_url(self):
        with patch.dict(module.os.environ, {}, clear=True), patch.object(module.platform, 'release', return_value='microsoft-standard-WSL2'), patch.object(module.subprocess, 'run', side_effect=FileNotFoundError):
            with self.assertRaisesRegex(RuntimeError, 'url --wsl-distro'):
                module.browser_url(Path('/home/PM/index.html'))


if __name__ == '__main__':
    unittest.main()
