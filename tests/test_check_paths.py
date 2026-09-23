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
