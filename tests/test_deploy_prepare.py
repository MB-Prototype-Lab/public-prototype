"""Exercise deployment preparation without network access or Git mutations."""
import importlib.util
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
spec = importlib.util.spec_from_file_location('publish', SCRIPTS / 'publish.py')
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)
URL = 'https://mb-prototype-lab.github.io/public-prototype/publication-manifest.json'
REF = 'refs/tags/publish/rehearsal'
SHA = 'a' * 40


class DeployPrepareTests(unittest.TestCase):
    def execute(self, response=None, error=None, invalid=False, mismatch=False,
                fetched=None, main_sha=SHA, head_sha=SHA, tag_sha=SHA):
        with tempfile.TemporaryDirectory() as directory:
            env = {'PUBLICATION_REF': REF, 'RUNNER_TEMP': directory}
            catalog = {'snapshots': []}
            body = response if response is not None else json.dumps(
                {'revision': 'revision', 'catalog': catalog}).encode()
            def git(*args):
                if args[0] == 'show':
                    return json.dumps({} if mismatch else catalog).encode()
                value = main_sha if args[1] == 'refs/remotes/origin/main^{commit}' else (
                    head_sha if args[1] == 'HEAD' else tag_sha)
                return (value + '\n').encode()
            argv = ['deploy-prepare.py'] + ([] if fetched is None else ['--fetched-origin-main', fetched])
            with patch('sys.argv', argv), \
                 patch.dict(os.environ, env, clear=True), \
                 patch.dict('sys.modules', {'publish': publish}), \
                 patch.object(publish, 'git', side_effect=git), \
                 patch.object(publish, 'validate_manifest', side_effect=ValueError('invalid manifest') if invalid else None), \
                 patch('subprocess.run') as run, \
                 patch('urllib.request.urlopen', side_effect=error, return_value=io.BytesIO(body)) as fetch:
                try:
                    runpy.run_path(str(SCRIPTS / 'deploy-prepare.py'), run_name='__main__')
                except (SystemExit, ValueError, urllib.error.URLError):
                    self.assertEqual(run.call_count, 1 if fetched is None else 0, 'failure must not invoke packaging')
                    raise
                self.assertEqual(fetch.call_args.args[0].full_url, URL)
                if fetched is not None:
                    self.assertEqual(run.call_count, 1, 'prefetched mode only invokes packaging')
                command = run.call_args.args[0]
                if '--previous' in command:
                    self.assertEqual(Path(command[command.index('--previous') + 1]).read_bytes(), body)
                return command

    def test_valid_manifest_is_forwarded_to_packaging(self):
        command = self.execute()
        self.assertIn('--previous', command)
        self.assertNotIn('--bootstrap-baseline', command)

    def test_host_fetched_main_skips_authenticated_git_fetch(self):
        command = self.execute(fetched=SHA)
        self.assertEqual(command[:3], ['python3', 'scripts/publish.py', 'build'])

    def test_host_fetch_binding_rejects_stale_or_invalid_sources(self):
        cases = [
            ({'fetched': 'main'}, 'full commit SHA'),
            ({'fetched': SHA, 'main_sha': 'b' * 40}, 'bundled origin/main differs'),
            ({'fetched': SHA, 'head_sha': 'b' * 40}, 'not at the freshly fetched main'),
            ({'fetched': SHA, 'tag_sha': 'b' * 40}, 'tag no longer matches'),
        ]
        for options, message in cases:
            with self.subTest(options=options), self.assertRaisesRegex(ValueError, message):
                self.execute(**options)

    def test_404_stops_before_packaging(self):
        error = urllib.error.HTTPError(URL, 404, 'missing', {}, None)
        with self.assertRaisesRegex(SystemExit, 'Cannot retrieve previous manifest; deployment stopped'):
            self.execute(error=error)

    def test_other_network_failures_stop(self):
        for error in [urllib.error.HTTPError(URL, 403, 'forbidden', {}, None),
                      urllib.error.HTTPError(URL, 500, 'failed', {}, None),
                      urllib.error.URLError('offline')]:
            with self.subTest(error=error), self.assertRaises((SystemExit, urllib.error.URLError)):
                self.execute(error=error)

    def test_invalid_manifest_stops(self):
        for options in [{'response': b'not json'}, {'invalid': True}, {'mismatch': True}]:
            with self.subTest(options=options), self.assertRaises(ValueError):
                self.execute(**options)


if __name__ == '__main__':
    unittest.main()
