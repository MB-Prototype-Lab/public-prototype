import importlib.util
import json
from pathlib import Path
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
        manifest = (self.root / '.local-preview/variants.js').read_text()
        self.assertIn('.worktrees/variant-A/app/index.html', manifest)
        self.cli('close')
        self.cli('cleanup', *[v['id'] for v in state['variants']])
        next_state = self.create()
        self.assertEqual([v['id'] for v in next_state['variants']], ['variant-A-2', 'variant-B-2'])
        self.cli('--session', state['id'], 'cleanup', 'variant-A')
        self.assertTrue(self.path(next_state['variants'][0]).exists())
        self.assertEqual(module.option_letter(26), 'Z')
        self.assertEqual(module.option_letter(27), 'AA')
        self.assertEqual(module.option_letter(52), 'AZ')
        self.assertEqual(module.option_letter(53), 'BA')

    def test_legacy_session_cleanup(self):
        state = self.create()
        self.cli('close')
        self.cli('cleanup', *[v['id'] for v in state['variants']])
        legacy = {'id': state['id'] + '-1', 'branch': 'variant/' + state['id'] + '-1',
                  'label': 'Legacy', 'description': 'Existing comparison'}
        self.git('worktree', 'add', '-b', legacy['branch'], str(self.path(legacy)), state['checkpoint'])
        state['status'] = 'closed'
        state['variants'] = [legacy]
        module.save(self.root, state)
        self.cli('cleanup', legacy['id'])
        self.assertFalse(self.path(legacy).exists())
        self.git('rev-parse', legacy['branch'])

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


if __name__ == '__main__':
    unittest.main()
