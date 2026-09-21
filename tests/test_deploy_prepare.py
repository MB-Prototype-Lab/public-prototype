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


class DeployPrepareTests(unittest.TestCase):
    def execute(self, response=None, error=None, bootstrap=REF, invalid=False, mismatch=False):
        with tempfile.TemporaryDirectory() as directory:
            env = {'PUBLICATION_REF': REF, 'BOOTSTRAP_PUBLICATION_REF': bootstrap,
                   'VERIFIED_MIGRATION_BASELINE': 'baseline', 'RUNNER_TEMP': directory}
            catalog = {'snapshots': []}
            body = response if response is not None else json.dumps(
                {'revision': 'revision', 'catalog': catalog}).encode()
            def git(*args):
                return json.dumps({} if mismatch else catalog).encode() if args[0] == 'show' else b'head'
            with patch.dict(os.environ, env, clear=True), \
                 patch.dict('sys.modules', {'publish': publish}), \
                 patch.object(publish, 'git', side_effect=git), \
                 patch.object(publish, 'validate_manifest', side_effect=ValueError('invalid manifest') if invalid else None), \
                 patch('subprocess.run') as run, \
                 patch('urllib.request.urlopen', side_effect=error, return_value=io.BytesIO(body)) as fetch:
                try:
                    runpy.run_path(str(SCRIPTS / 'deploy-prepare.py'), run_name='__main__')
                except (SystemExit, ValueError, urllib.error.URLError):
                    self.assertEqual(run.call_count, 1, 'failure must not invoke packaging')
                    raise
                self.assertEqual(fetch.call_args.args[0].full_url, URL)
                command = run.call_args.args[0]
                if '--previous' in command:
                    self.assertEqual(Path(command[command.index('--previous') + 1]).read_bytes(), body)
                return command

    def test_valid_manifest_is_forwarded_to_packaging(self):
        command = self.execute()
        self.assertIn('--previous', command)
        self.assertNotIn('--bootstrap-baseline', command)

    def test_exact_404_bootstrap(self):
        error = urllib.error.HTTPError(URL, 404, 'missing', {}, None)
        command = self.execute(error=error)
        self.assertEqual(command[-4:], ['--bootstrap-baseline', 'baseline', '--bootstrap-tag', REF])
        for bootstrap in ['', 'refs/tags/publish/other']:
            with self.subTest(bootstrap=bootstrap), self.assertRaises(SystemExit):
                self.execute(error=error, bootstrap=bootstrap)

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
