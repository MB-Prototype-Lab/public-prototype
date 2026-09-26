"""Single-app integration wiring and generated data contract."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'


class AppStructureTests(unittest.TestCase):
    def test_json_wrappers_match_and_load(self):
        scripts = re.findall(r'<script src="([^"]+)"', (APP / 'index.html').read_text())
        for source in (APP / 'data').glob('*.json'):
            with self.subTest(data=source.name):
                wrapper = source.with_suffix('.js')
                body = wrapper.read_text()
                match = re.search(r'^const [A-Z_][A-Z_0-9]*\s*=\s*([\s\S]*);\s*$', body, re.M)
                self.assertIsNotNone(match)
                self.assertEqual(json.loads(source.read_text()), json.loads(match[1]))
                self.assertIn(wrapper.relative_to(APP).as_posix(), scripts)

    def test_single_app_and_dependency_order(self):
        self.assertFalse((ROOT / 'versions').exists())
        html = (APP / 'index.html').read_text()
        scripts = re.findall(r'<script src="([^"]+)"', html)
        self.assertEqual(len(scripts), len(set(scripts)))
        for directory in ('js', 'screens', 'components'):
            for source in (APP / directory).glob('*.js'):
                self.assertIn(source.relative_to(APP).as_posix(), scripts)
        for before, after in (
            ('release-config.js', 'js/config.js'),
            ('data/emergency-fund.js', 'js/esf.js'),
            ('data/buddy-esf.js', 'js/buddy-esf.js'),
            ('js/budget-baseline.js', 'js/esf.js'),
            ('js/esf.js', 'js/buddy-esf.js'),
            ('js/buddy-esf.js', 'screens/buddy-panel.js'),
        ):
            self.assertLess(scripts.index(before), scripts.index(after))
        self.assertIn('id="buddyRoot"', html)


if __name__ == '__main__':
    unittest.main()
