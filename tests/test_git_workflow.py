"""Exercise documented Git operations without remote services or real branch changes."""
from pathlib import Path
import subprocess
import tempfile
import unittest


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'user.name', 'Test')
        (self.repo/'flow.txt').write_text('initial\n')
        self.git('add', 'flow.txt')
        self.git('commit', '-m', 'base')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')

    def git(self, *args, check=True):
        result = subprocess.run(['git', '-C', str(self.repo), *args], capture_output=True, text=True)
        if check and result.returncode:
            self.fail(result.stderr)
        return result

    def commit_file(self, filename, text):
        (self.repo/filename).write_text(text)
        self.git('add', filename)
        self.git('commit', '-m', filename)

    def test_dirty_start_ahead_main_and_task_resume(self):
        self.commit_file('local.txt', 'unfinished main work\n')
        local_tip = self.git('rev-parse', 'HEAD').stdout
        self.assertIn('local.txt', self.git('log', '--oneline', 'origin/main..main').stdout)
        (self.repo/'flow.txt').write_text('dirty work\n')
        before = self.git('status', '--porcelain').stdout
        self.assertTrue(before)
        # Inspection must be non-mutating. The documented start stops here to
        # establish scope instead of stashing/resetting or changing branches.
        self.git('branch', '-avv')
        self.git('log', '--oneline', 'origin/main..main')
        self.assertEqual(before, self.git('status', '--porcelain').stdout)
        self.assertEqual((self.repo/'flow.txt').read_text(), 'dirty work\n')
        # Once this work is identified as the requested task, a branch can carry it.
        self.git('switch', '-c', 'work/task-1', 'main')
        self.git('add', 'flow.txt')
        self.git('commit', '-m', 'task change')
        task_tip = self.git('rev-parse', 'HEAD').stdout
        self.git('switch', 'main')
        self.assertEqual(local_tip, self.git('rev-parse', 'HEAD').stdout)
        self.git('switch', '-c', 'work/task-2', 'main')
        self.commit_file('other.txt', 'independent\n')
        self.git('switch', 'work/task-1')
        self.assertEqual(task_tip, self.git('rev-parse', 'HEAD').stdout)
        self.assertFalse((self.repo/'other.txt').exists())
        self.assertNotEqual(self.git('switch', '-c', 'work/task-1', check=False).returncode, 0)

    def test_merge_sync_and_preserved_product_conflict(self):
        self.git('switch', '-c', 'work/task')
        self.commit_file('feature.txt', 'feature\n')
        self.git('switch', 'main')
        self.commit_file('shared.txt', 'incoming\n')
        self.git('switch', 'work/task')
        self.git('merge', '--no-edit', 'main')
        self.assertTrue((self.repo/'feature.txt').exists())
        self.assertTrue((self.repo/'shared.txt').exists())
        self.assertEqual(len(self.git('rev-list', '--parents', '-n', '1', 'HEAD').stdout.split()), 3)
        self.commit_file('flow.txt', 'task product choice\n')
        self.git('switch', 'main')
        self.commit_file('flow.txt', 'main product choice\n')
        self.git('switch', 'work/task')
        self.assertNotEqual(self.git('merge', '--no-edit', 'main', check=False).returncode, 0)
        self.assertIn('UU flow.txt', self.git('status', '--porcelain').stdout)
        conflict = (self.repo/'flow.txt').read_text()
        self.assertIn('task product choice', conflict)
        self.assertIn('main product choice', conflict)
        self.assertTrue((self.repo/'feature.txt').exists())
        # Leave the resolution choice to the PM, as documented; neither side lost.


if __name__ == '__main__':
    unittest.main()
