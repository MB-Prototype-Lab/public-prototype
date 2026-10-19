"""Exercise source isolation using real Git bundles, without requiring Docker."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('container_runner', ROOT / 'container/runner.py')
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class ContainerCaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source space # café'
        self.source.mkdir()
        self.inputs = self.root / 'input'
        self.inputs.mkdir()
        self.work = self.root / 'work'
        self.git('init', '-b', 'main', '--quiet')
        self.git('config', 'user.name', 'Test')
        self.git('config', 'user.email', 'test@example.test')
        (self.source / 'keep.txt').write_bytes(b'committed\n')
        (self.source / 'delete.txt').write_text('delete')
        (self.source / 'script.sh').write_text('#!/bin/sh\n')
        for directory in ('tests/browser', 'container'):
            (self.source / directory).mkdir(parents=True)
            for name in ('package.json', 'package-lock.json'):
                (self.source / directory / name).write_bytes((ROOT / 'tests/browser' / name).read_bytes())
        self.git('add', '.')
        self.git('update-index', '--chmod=+x', 'script.sh')
        self.git('commit', '-qm', 'fixture')
        self.head = self.git('rev-parse', 'HEAD').decode().strip()
        self.git('bundle', 'create', str(self.inputs / 'repo.bundle'), '--all', 'HEAD')
        (self.inputs / 'head.txt').write_text(self.head)
        (self.inputs / 'mode.txt').write_text('working-copy')

    def git(self, *args):
        return runner.git(self.source, *args)

    def inventories(self):
        (self.inputs / 'files.z').write_bytes(self.git('ls-files', '-z', '--cached', '--others', '--exclude-standard'))
        (self.inputs / 'deleted.z').write_bytes(self.git('ls-files', '-z', '--deleted'))
        (self.inputs / 'index.z').write_bytes(self.git('ls-files', '--stage', '-z'))

    def test_overlay_preserves_source_git_and_bytes(self):
        (self.source / 'keep.txt').write_bytes(b'edited\r\n')
        (self.source / 'delete.txt').unlink()
        (self.source / 'new # café.txt').write_text('new')
        (self.source / 'branching.md').write_text('private')
        (self.source / '.worktrees').mkdir()
        (self.source / '.worktrees/private').write_text('private')
        self.inventories()
        before = self.git('status', '--porcelain=v1', '-z')
        repo, manifest = runner.capture(self.source, self.inputs, self.work)
        self.assertEqual((repo / 'keep.txt').read_bytes(), b'edited\r\n')
        self.assertFalse((repo / 'delete.txt').exists())
        self.assertFalse((repo / 'branching.md').exists())
        self.assertFalse((repo / '.worktrees').exists())
        self.assertEqual((repo / 'script.sh').stat().st_mode & 0o777, 0o755)
        self.assertEqual(self.git('status', '--porcelain=v1', '-z'), before)
        self.assertEqual(manifest['head'], self.head)
        self.assertEqual(manifest['deleted'], ['delete.txt'])
        self.assertEqual(runner.git(repo, 'rev-parse', 'main').decode().strip(), self.head)

    def test_staged_deletion_rename_and_mode(self):
        self.git('rm', 'delete.txt')
        self.git('mv', 'keep.txt', 'renamed.txt')
        self.git('update-index', '--chmod=-x', 'script.sh')
        self.inventories()
        repo, manifest = runner.capture(self.source, self.inputs, self.work)
        self.assertFalse((repo / 'delete.txt').exists())
        self.assertFalse((repo / 'keep.txt').exists())
        self.assertEqual((repo / 'renamed.txt').read_text(), 'committed\n')
        self.assertEqual((repo / 'script.sh').stat().st_mode & 0o777, 0o644)
        self.assertEqual(manifest['deleted'], ['delete.txt', 'keep.txt'])

    def test_committed_ignores_working_edits(self):
        (self.source / 'keep.txt').write_text('edit')
        (self.inputs / 'mode.txt').write_text('committed')
        repo, manifest = runner.capture(self.source, self.inputs, self.work)
        self.assertEqual((repo / 'keep.txt').read_text(), 'committed\n')
        self.assertEqual(manifest['files'], [])

    def test_capture_detects_concurrent_edit(self):
        self.inventories()
        original = runner.read_source
        calls = {}
        def changing(root, path):
            calls[path] = calls.get(path, 0) + 1
            data, kind = original(root, path)
            return (data + b'changed' if calls[path] > 1 else data), kind
        with mock.patch.object(runner, 'read_source', side_effect=changing):
            with self.assertRaisesRegex(runner.CaptureError, 'changed during capture'):
                runner.capture(self.source, self.inputs, self.work)

    def test_rejects_traversal_and_external_symlink(self):
        for name in ('../secret', '/secret', 'x/../../secret', 'C:/secret', 'x\\secret'):
            with self.subTest(name=name), self.assertRaises(runner.CaptureError):
                runner.permitted(name)
        outside = self.root / 'secret'
        outside.write_text('private')
        try:
            (self.source / 'link').symlink_to(outside)
        except OSError:
            self.skipTest('symlink creation unavailable')
        with self.assertRaisesRegex(runner.CaptureError, 'escapes checkout'):
            runner.read_source(self.source, 'link')

    def test_doctor_rejects_an_unreadable_checkout_mount(self):
        with mock.patch.dict(runner.os.environ, {'MB_CHECK_MOUNT_PROBE': '1'}):
            with self.assertRaisesRegex(runner.CaptureError, 'cannot read the mounted checkout'):
                runner.doctor(self.source)

    def test_dependency_manifest_drift_is_blocked(self):
        manifest = self.source / 'container/package-lock.json'
        manifest.write_bytes(manifest.read_bytes() + b'\n')
        with self.assertRaisesRegex(runner.CaptureError, 'differs from tests/browser'):
            runner.dependency_drift(self.source)

    def test_failed_execution_keeps_evidence(self):
        self.inventories()
        reports = self.root / 'reports'
        real_output = subprocess.check_output
        def versions(command, **kwargs):
            if command == ['node', '--version']:
                return 'test-version\n'
            return real_output(command, **kwargs)
        with mock.patch.object(runner.subprocess, 'check_output', side_effect=versions):
            code = runner.main(['--input-source', str(self.source), '--input-git', str(self.inputs),
                                '--work', str(self.work), '--reports', str(reports),
                                'exec', '--', 'python3', '-c', 'print("deliberate failure"); raise SystemExit(9)'])
        self.assertEqual(code, 1)
        result = json.loads((reports / 'result.json').read_text())
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['commands'][0]['exit_code'], 9)
        self.assertIn('deliberate failure', (reports / '01.log').read_text())
        self.assertTrue((reports / 'source.json').exists())


if __name__ == '__main__':
    unittest.main()
