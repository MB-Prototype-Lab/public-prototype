"""Exercise the real Bash bootstrap with only Git and a Docker test double on PATH."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASH = shutil.which('bash')
GIT = shutil.which('git')
DOCKER_STUB = r'''
import json, os, pathlib, sys
args = sys.argv[1:]
record = {'args': args}
if args[0] == 'info':
    print(os.environ.get('TEST_DOCKER_OS', 'linux'))
elif args[:2] == ['image', 'inspect']:
    print('sha256:test-image')
elif args[0] == 'run':
    mounts = [args[i+1] for i, a in enumerate(args) if a == '--mount']
    if '--entrypoint' in args and '-c' in args:
        mount = next(m for m in mounts if 'target=/host' in m or 'target=/parent' in m)
        host = pathlib.Path(mount.split('source=', 1)[1].split(',target=', 1)[0])
        names = (args[-1] + '-reviews',) if 'target=/parent' in mount else (args[-3], args[-2])
        for name in names:
            (host / name).mkdir(parents=True, exist_ok=True)
    elif '/input/git' in ''.join(mounts):
        mount = next(m for m in mounts if 'target=/input/git' in m)
        inputs = pathlib.Path(mount.split('source=', 1)[1].split(',target=', 1)[0])
        record['head'] = (inputs / 'head.txt').read_text().strip()
        record['mode'] = (inputs / 'mode.txt').read_text().strip()
        record['files'] = (inputs / 'files.z').read_bytes().decode().split('\0')
        record['index'] = (inputs / 'index.z').read_text()
        record['bundle_exists'] = (inputs / 'repo.bundle').is_file()
        if os.environ.get('TEST_REWRITE_LAUNCHER'):
            pathlib.Path(os.environ['TEST_REWRITE_LAUNCHER']).write_text('exit 97\n')
with open(os.environ['TEST_DOCKER_LOG'], 'a') as stream:
    stream.write(json.dumps(record) + '\n')
if args[0] == 'run' and '--entrypoint' not in args:
    sys.exit(int(os.environ.get('TEST_DOCKER_EXIT', '0')))
'''


@unittest.skipUnless(BASH and GIT and os.name != 'nt', 'Bash launcher test requires POSIX Bash and Git')
class ContainerLauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.repo = self.base / 'PM project # café'
        self.repo.mkdir()
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        (self.bin / 'git').symlink_to(GIT)
        (self.bin / 'docker').write_text('#!' + sys.executable + '\n' + DOCKER_STUB)
        (self.bin / 'docker').chmod(0o755)
        self.launcher = ROOT / 'scripts/checks.sh'
        self.log = self.base / 'docker.jsonl'
        self.env = dict(os.environ, PATH=str(self.bin), TEST_DOCKER_LOG=str(self.log), MB_CHECK_RUN_ID='fixture')
        (self.repo / '.gitignore').write_text('.container-checks/\n')
        (self.repo / 'source # café.txt').write_text('committed\n')
        for command in (['init', '-b', 'main', '--quiet'], ['config', 'user.name', 'Test'],
                        ['config', 'user.email', 'test@example.test'], ['add', '.'], ['commit', '-qm', 'fixture']):
            subprocess.run([GIT, '-C', str(self.repo), *command], check=True, capture_output=True)

    def launch(self, *args):
        return subprocess.run([BASH, str(self.launcher), *args], cwd=self.repo,
                              env=self.env, text=True, capture_output=True)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_only_git_and_docker_preserve_paths_and_arguments(self):
        (self.repo / 'source # café.txt').write_text('working edit\n')
        result = self.launch('exec', '--', 'python3', '-c', 'print("hello space # café")', '--name=value with spaces')
        self.assertEqual(result.returncode, 0, result.stderr)
        call = next(c for c in self.calls() if 'head' in c)
        self.assertEqual(call['mode'], 'working-copy')
        self.assertTrue(call['bundle_exists'])
        self.assertIn('source # café.txt', call['files'])
        self.assertIn('source # café.txt', call['index'])
        self.assertEqual(call['args'][-6:], ['exec', '--', 'python3', '-c', 'print("hello space # café")', '--name=value with spaces'])
        mounts = [call['args'][i+1] for i, a in enumerate(call['args']) if a == '--mount']
        self.assertIn(f'type=bind,source={self.repo},target=/input/source,readonly', mounts)
        self.assertIn('none', call['args'])
        self.assertIn('MB_CHECK_IMAGE_ID=sha256:test-image', call['args'])

    def test_helper_forwards_effective_git_policy_without_credentials(self):
        global_config = self.base / 'global git settings'
        self.env['GIT_CONFIG_GLOBAL'] = str(global_config)
        for key in ('user.name', 'user.email'):
            subprocess.run([GIT, '-C', str(self.repo), 'config', '--unset', key], check=True)
        expected = {'user.name': 'PM café', 'user.email': 'pm@example.test',
                    'core.autocrlf': 'true', 'core.eol': 'lf',
                    'commit.gpgsign': 'true', 'tag.gpgsign': 'true',
                    'user.signingkey': 'test-signing-id', 'gpg.format': 'ssh'}
        for key, value in dict(expected, **{'core.eol': 'native', 'credential.helper': 'DO-NOT-FORWARD'}).items():
            subprocess.run([GIT, 'config', '--file', str(global_config), key, value], check=True)
        self.env['GIT_AUTHOR_NAME'] = 'Explicit author'
        result = self.launch('helper', 'flows', 'check')
        self.assertEqual(result.returncode, 0, result.stderr)
        call = next(c['args'] for c in self.calls() if 'scripts/flows.py' in c['args'])
        settings = [call[i+1] for i, arg in enumerate(call) if arg == '--env']
        values = dict(item.split('=', 1) for item in settings if '=' in item)
        count = int(values['GIT_CONFIG_COUNT'])
        actual = {values[f'GIT_CONFIG_KEY_{i}']: values[f'GIT_CONFIG_VALUE_{i}'] for i in range(count)}
        self.assertEqual(actual, expected)
        for name in ('GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_DATE',
                     'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_COMMITTER_DATE'):
            self.assertIn(name, settings)
        self.assertNotIn('DO-NOT-FORWARD', ' '.join(call))
        self.assertNotIn(str(global_config), ' '.join(call))

    def test_review_and_variants_do_not_require_host_relative_worktrees(self):
        # Model an ordinary host Git without the newer relative-worktree feature.
        # The launchers must delegate lifecycle operations without probing it.
        (self.bin / 'git').unlink()
        (self.bin / 'git').write_text('#!' + sys.executable + '\n' +
            'import os, sys\n' +
            'if sys.argv[1:3] == ["worktree", "add"]:\n'
            '    print("usage: git worktree add [--detach] PATH", file=sys.stderr)\n'
            '    sys.exit(129)\n' +
            'os.execv(' + repr(GIT) + ', [' + repr(GIT) + '] + sys.argv[1:])\n')
        (self.bin / 'git').chmod(0o755)
        before = (self.repo / '.git/config').read_bytes()
        for args, script in ((('review', 'status', '--json'), 'pre-pr-review'),
                             (('helper', 'local-variants', 'status'), 'local-variants')):
            with self.subTest(script=script):
                result = self.launch(*args)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(any('scripts/' + script + '.py' in c['args'] for c in self.calls()))
                self.assertEqual((self.repo / '.git/config').read_bytes(), before)

    def test_managed_checkouts_allow_tests_but_block_nested_helpers(self):
        marker = self.repo / '.git/moneybuddy-managed.json'
        marker.write_text('{}\n')
        for args in (('review', 'start'), ('helper', 'local-variants', 'create')):
            result = self.launch(*args)
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertIn('primary task checkout', result.stderr)
        result = self.launch('all')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(marker.read_text(), '{}\n')

    def test_each_run_builds_and_removes_only_its_own_tag(self):
        tags = []
        for run_id in ('first', 'second'):
            self.env['MB_CHECK_RUN_ID'] = run_id
            start = len(self.calls()) if self.log.exists() else 0
            result = self.launch('all')
            self.assertEqual(result.returncode, 0, result.stderr)
            calls = self.calls()[start:]
            build = next(c['args'] for c in calls if c['args'][0] == 'build')
            tag = build[build.index('--tag') + 1]
            tags.append(tag)
            self.assertTrue(tag.startswith('moneybuddy-checks:run-'))
            self.assertIn(['image', 'inspect', '--format', '{{.Id}}', tag], [c['args'] for c in calls])
            cleanups = [c['args'] for c in calls if c['args'][:2] == ['image', 'rm']]
            self.assertEqual(cleanups, [['image', 'rm', tag]])
            run = next(c['args'] for c in calls if 'head' in c)
            self.assertIn('sha256:test-image', run)
            self.assertNotIn('moneybuddy-checks:local', run)
            self.assertNotIn(tag, run)
        self.assertNotEqual(tags[0], tags[1])

    def test_running_launcher_is_not_reparsed_after_file_edit(self):
        self.launcher = self.base / 'editable launcher.sh'
        self.launcher.write_bytes((ROOT / 'scripts/checks.sh').read_bytes())
        self.env['TEST_REWRITE_LAUNCHER'] = str(self.launcher)
        result = self.launch('all')
        self.assertEqual(self.launcher.read_text(), 'exit 97\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Reports:', result.stdout)
        self.assertTrue(any(c['args'][:2] == ['image', 'rm'] for c in self.calls()))

    def test_external_evidence_keeps_checkout_free_of_ignored_debris(self):
        output = self.base / 'review evidence # café'
        output.mkdir()
        self.env['MB_CHECK_OUTPUT_ROOT'] = str(output)
        before = subprocess.check_output([GIT, '-C', str(self.repo), 'status', '--porcelain', '--ignored'])
        result = self.launch('all')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.repo / '.container-checks').exists())
        after = subprocess.check_output([GIT, '-C', str(self.repo), 'status', '--porcelain', '--ignored'])
        self.assertEqual(after, before)
        self.assertTrue((output / 'inputs/fixture/repo.bundle').is_file())
        self.assertTrue((output / 'reports/fixture').is_dir())
        call = next(c for c in self.calls() if 'head' in c)
        mounts = [call['args'][i+1] for i, a in enumerate(call['args']) if a == '--mount']
        self.assertIn(f'type=bind,source={self.repo},target=/input/source,readonly', mounts)
        self.assertIn(f'type=bind,source={output}/inputs/fixture,target=/input/git,readonly', mounts)
        self.assertIn(f'type=bind,source={output}/reports/fixture,target=/reports', mounts)
        self.assertIn(str(output / 'reports/fixture'), result.stdout)

    def test_committed_mode_and_failed_check_exit(self):
        self.env['TEST_DOCKER_EXIT'] = '1'
        result = self.launch('all', '--committed')
        self.assertEqual(result.returncode, 1, result.stderr)
        call = next(c for c in self.calls() if 'head' in c)
        self.assertEqual(call['mode'], 'committed')
        self.assertEqual(call['args'][-1], 'all')
        self.assertNotIn('--committed', call['args'])

    def test_exec_separator_preserves_literal_committed_flag(self):
        result = self.launch('exec', '--', 'example', '--committed')
        self.assertEqual(result.returncode, 0, result.stderr)
        call = next(c for c in self.calls() if 'head' in c)
        self.assertEqual(call['mode'], 'working-copy')
        self.assertEqual(call['args'][-4:], ['exec', '--', 'example', '--committed'])

    def test_missing_docker_is_blocked(self):
        (self.bin / 'docker').unlink()
        result = self.launch('all')
        self.assertEqual(result.returncode, 2)
        self.assertIn('Docker is unavailable', result.stderr)
        self.assertFalse(self.log.exists())

    def test_windows_container_engine_is_blocked(self):
        self.env['TEST_DOCKER_OS'] = 'windows'
        result = self.launch('all')
        self.assertEqual(result.returncode, 2)
        self.assertIn('Linux containers', result.stderr)
        self.assertFalse(any(c['args'][0] == 'build' for c in self.calls()))

    def test_run_id_collision_preserves_evidence(self):
        (self.repo / '.container-checks/reports/fixture').mkdir(parents=True)
        result = self.launch('all')
        self.assertEqual(result.returncode, 2)
        self.assertIn('Run ID already exists', result.stderr)
        self.assertFalse(any(c['args'][0] == 'run' for c in self.calls()))


if __name__ == '__main__':
    unittest.main()
