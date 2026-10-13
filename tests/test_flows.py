import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('flows', Path(__file__).resolve().parents[1] / 'scripts/flows.py')
flows = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flows)


class FlowsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='contained flows ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.email', 'test@example.com')
        self.git('config', 'user.name', 'Test')
        self.write('app/index.html', '<script src="release-config.js"></script><script src="js/config.js"></script><script src="js/navigation.js"></script>')
        self.write('app/release-config.js', '')
        self.write('app/js/config.js', '')
        self.write('app/js/navigation.js', 'bootV3();')
        self.write('app/docs/excluded.json', '{}')
        self.write('app/.secret', 'hidden')
        self.write('app/source.py', 'not static')
        self.git('add', '.')
        self.git('commit', '-m', 'baseline')
        self.base = self.git('rev-parse', 'HEAD').strip()
        flows.catalog(self.root)

    def git(self, *args):
        return flows.git(self.root, *args).decode()

    def write(self, path, data):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data)
        return target

    def create(self, ident='sample'):
        flows.create(self.root, ident, self.base, 'Sample <label>', 'Purpose')

    def inventory(self):
        return {str(p.relative_to(self.root / 'app')): p.read_bytes() for p in (self.root / 'app').rglob('*') if p.is_file()}

    def test_committed_only_export_contained_and_app_unchanged(self):
        self.write('app/js/config.js', '// dirty')
        self.write('app/untracked.js', '// untracked')
        before = self.inventory()
        self.create()
        flows.check(self.root)
        package = self.root / 'flows/sample'
        self.assertEqual((package / 'js/config.js').read_text(), '')
        for absent in ('docs', '.secret', 'source.py', 'untracked.js'):
            self.assertFalse((package / absent).exists())
        self.assertEqual(before, self.inventory())
        self.assertEqual(json.loads((package / 'flow.json').read_text())['allowed_screens'], ['onboarding'])
        self.assertLess((package / 'index.html').read_text().index('flow-config.js'), (package / 'index.html').read_text().index('js/config.js'))

    def test_unsafe_ids_sources_and_collisions_preserve_catalog(self):
        before = (self.root / 'flows/catalog.js').read_bytes()
        for ident in ('../app', 'A', '-a', 'a/b', 'a..b', 'a' * 65):
            with self.assertRaises(ValueError):
                self.create(ident)
        with self.assertRaises(ValueError):
            flows.create(self.root, 'sample', 'HEAD', 'x', 'x')
        self.assertEqual(before, (self.root / 'flows/catalog.js').read_bytes())
        self.create()
        package = (self.root / 'flows/sample/flow.json').read_bytes()
        with self.assertRaises(ValueError):
            self.create()
        self.assertEqual(package, (self.root / 'flows/sample/flow.json').read_bytes())

    def test_linked_source_and_failed_catalog_roll_back(self):
        self.write('outside.js', 'outside')
        (self.root / 'app/link.js').symlink_to('../outside.js')
        self.git('add', 'app/link.js')
        self.git('commit', '-m', 'link')
        linked = self.git('rev-parse', 'HEAD').strip()
        with self.assertRaisesRegex(ValueError, 'linked'):
            flows.create(self.root, 'linked', linked, 'x', 'x')
        self.assertFalse((self.root / 'flows/linked').exists())
        before = (self.root / 'flows/catalog.js').read_bytes()
        with patch.object(flows, 'atomic_write', side_effect=OSError('interrupted')):
            with self.assertRaises(OSError):
                self.create()
        self.assertFalse((self.root / 'flows/sample').exists())
        self.assertEqual(before, (self.root / 'flows/catalog.js').read_bytes())
        self.assertFalse(list((self.root / 'flows').glob('.creating-*')))

    def test_malformed_source_entry_fails_before_install(self):
        self.write('app/index.html', '<script src="release-config.js"></script><script src="js/config.js"></script>')
        self.git('add', 'app/index.html')
        self.git('commit', '-m', 'malformed source missing navigation entry')
        broken = self.git('rev-parse', 'HEAD').strip()
        before = {p.name: p.read_bytes() for p in (self.root / 'flows').iterdir()}
        with self.assertRaisesRegex(ValueError, 'required configuration/runtime'):
            flows.create(self.root, 'broken', broken, 'Broken', 'Bad entry')
        self.assertFalse((self.root / 'flows/broken').exists())
        self.assertEqual(before, {p.name: p.read_bytes() for p in (self.root / 'flows').iterdir()})

    def test_scope_covers_staged_unstaged_untracked_and_integration(self):
        flows.scope(self.root, self.base, 'flow')
        self.write('app/new.js', 'new')
        with self.assertRaisesRegex(ValueError, 'app/new.js'):
            flows.scope(self.root, self.base, 'flow')
        flows.scope(self.root, self.base, 'app-integration')
        self.git('add', 'app/new.js')
        with self.assertRaises(ValueError):
            flows.scope(self.root, self.base, 'flow')

    def test_stale_metadata_symlink_and_invalid_policy(self):
        self.create()
        target = self.root / 'flows/sample/flow-config.js'
        target.write_text('stale')
        with self.assertRaisesRegex(ValueError, 'stale'):
            flows.check(self.root)
        flows.catalog(self.root)
        target.unlink()
        outside = self.write('outside', 'unchanged')
        target.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            flows.catalog(self.root)
        self.assertEqual(outside.read_text(), 'unchanged')
        m = json.loads((self.root / 'flows/sample/flow.json').read_text())
        m['allowed_screens'] = ['goals']
        with self.assertRaises(ValueError):
            flows.validate_metadata(m, 'sample')

    def test_scope_rejects_staged_change_when_worktree_matches_base(self):
        self.write('app/js/config.js', '// staged product change')
        self.git('add', 'app/js/config.js')
        self.write('app/js/config.js', '')
        with self.assertRaisesRegex(ValueError, 'app/js/config.js'):
            flows.scope(self.root, self.base, 'flow')
        flows.scope(self.root, self.base, 'app-integration')

    def test_dependencies_negative_and_dynamic_prefixes(self):
        valid = {'index.html': b'<script src="js/main.js"></script>', 'js/main.js': b'const asset = `assets/img/${name}.png`;', 'assets/img/example.png': b'image'}
        flows.validate_dependencies(valid)
        for html in ('<script src="../app/js/main.js"></script>', '<img src="/tmp/a.png">', '<script src="https://evil.test/a.js"></script>', '<link href="../../index.html" rel="stylesheet">', '<img src="%2e%2e/app/a.png">'):
            with self.subTest(html=html), self.assertRaises(ValueError):
                flows.validate_dependencies({'index.html': html.encode()})
        for js in ('const x="assets/missing/";', 'const x="../app/a.js";', 'const x="flows/other/a.js";', 'const x="assets/../a.png";', 'const x="file:///tmp/a.png";', 'const x="//server/a.js";', 'const html=`<img src="assets/missing.png">`;'):
            with self.subTest(js=js), self.assertRaises(ValueError):
                flows.validate_dependencies({'js/main.js': js.encode()})
        flows.validate_dependencies({'index.html': b'<a href="../../index.html">Exit</a>'})
        flows.validate_dependencies({'screens/onboarding.js': b'const x="assets/audio/onboarding/";'})
        with self.assertRaises(ValueError):
            flows.validate_dependencies({'screens/other.js': b'const x="assets/audio/onboarding/";'})

    def test_catalog_write_failure_restores_both_discovery_files(self):
        self.create()
        paths = [self.root / 'flows/catalog.json', self.root / 'flows/catalog.js', self.root / 'flows/sample/flow-config.js']
        before = {p: p.read_bytes() for p in paths}
        real = flows.atomic_write
        calls = []
        def interrupted(path, content):
            calls.append(path)
            if len(calls) == 3:
                raise OSError('interrupted')
            real(path, content)
        with patch.object(flows, 'atomic_write', side_effect=interrupted):
            with self.assertRaises(OSError):
                flows.catalog(self.root)
        self.assertEqual(before, {p: p.read_bytes() for p in paths})


if __name__ == '__main__':
    unittest.main()
