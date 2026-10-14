import importlib.util
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location('check_paths', Path(__file__).resolve().parents[1] / 'scripts/check-paths.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class CheckPathsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_only_root_optional_generated_scripts_may_be_absent(self):
        selector = self.root / 'index.html'
        selector.write_text('<script src=".local-preview/variants.js"></script>'
                            '<script src=".local-preview/return.js"></script>')
        self.assertEqual(checker.check_tree(self.root), [])

        (self.root / 'other.html').write_text('<script src=".local-preview/variants.js"></script>')
        self.assertEqual(checker.check_tree(self.root), ['other.html -> .local-preview/variants.js'])

    def test_checkout_includes_flow_discovery_and_assets(self):
        (self.root / 'app').mkdir()
        (self.root / 'gate').mkdir()
        flow = self.root / 'flows/sample'
        (flow / 'assets').mkdir(parents=True)
        (self.root / 'index.html').write_text('<script src="flows/catalog.js"></script>')
        (self.root / 'flows/catalog.js').write_text('window.MB_FLOWS = {};')
        (flow / 'index.html').write_text('<img src="assets/sample.png"><a href="../../index.html">Exit</a>')
        image = flow / 'assets/sample.png'
        image.write_bytes(b'image')
        # Hidden authoring directories never enter the validation tree.
        (flow / '.worktrees').mkdir()
        (flow / '.worktrees/broken.html').write_text('<img src="missing.png">')
        self.assertEqual(checker.check_checkout(self.root), [])
        image.unlink()
        self.assertEqual(checker.check_checkout(self.root), ['flows/sample/index.html -> assets/sample.png'])

    def test_checkout_without_flows_and_missing_catalog_diagnostic(self):
        (self.root / 'app').mkdir()
        (self.root / 'gate').mkdir()
        selector = self.root / 'index.html'
        selector.write_text('<p>App-only checkout</p>')
        self.assertEqual(checker.check_checkout(self.root), [])
        selector.write_text('<script src="flows/catalog.js"></script>')
        self.assertEqual(checker.check_checkout(self.root), ['index.html -> flows/catalog.js'])

    def test_other_broken_references_still_fail(self):
        (self.root / 'index.html').write_text('<script src=".local-preview/other.js"></script>'
                                              '<a href="missing.html">Broken</a>')
        (self.root / 'gate.css').write_text('body { background: url(missing.png); }')
        self.assertCountEqual(checker.check_tree(self.root), [
            'index.html -> .local-preview/other.js',
            'index.html -> missing.html',
            'gate.css -> missing.png',
        ])


if __name__ == '__main__':
    unittest.main()
