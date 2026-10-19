import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/check-markdown-links.py'
spec = importlib.util.spec_from_file_location('check_markdown_links', SCRIPT)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class MarkdownLinksTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        return path

    def check(self):
        return checker.check_checkout(self.root)

    def test_relative_root_and_encoded_paths(self):
        self.write('CLAUDE.md', '[Guide](docs/guide.md#hello-world)')
        self.write('docs/guide.md', '# Hello world\n[Root](../CLAUDE.md)\n'
                   '[Asset](/app/assets/a%20picture.svg?raw=1)\n'
                   '[Space](<a guide.md> "title")')
        self.write('docs/a guide.md', '# Other guide')
        self.write('app/assets/a picture.svg', '<svg/>')
        self.assertEqual(self.check(), [])

    def test_command_passes_baseline_then_fails_for_missing_file(self):
        target = self.write('docs/guide.md', '# Guide')
        self.write('AGENTS.md', '[Guide](docs/guide.md)')
        command = [sys.executable, str(SCRIPT), '--root', str(self.root)]
        baseline = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(baseline.returncode, 0, baseline.stderr)
        self.assertIn('resolve', baseline.stdout)
        target.unlink()
        regression = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(regression.returncode, 1)
        self.assertIn('AGENTS.md:1 -> docs/guide.md (missing file)', regression.stderr)

    def test_heading_regression_keeps_file_but_breaks_fragment(self):
        target = self.write('docs/guide.md', '# Original heading')
        self.write('README.md', '[Guide](docs/guide.md#original-heading)')
        self.assertEqual(self.check(), [])
        target.write_text('# Renamed heading')
        self.assertEqual(self.check(), [
            'README.md:1 -> docs/guide.md#original-heading (missing heading fragment)'])

    def test_github_heading_punctuation_formatting_and_duplicate_collisions(self):
        self.write('docs/guide.md', '# Hello, **World**: `state`?\n'
                   '# Hello, **World**: `state`?\n# Hello, World: state?-1\n'
                   '# Café &amp; tea\n# [Linked](other.md) heading\n'
                   'Setext title\n------------\n# Trailing ###\n'
                   '# _Emphasis_ and `under_score`\n')
        self.write('docs/other.md', '')
        self.write('CLAUDE.md', '\n'.join(f'[Heading](docs/guide.md#{anchor})' for anchor in (
            'hello-world-state', 'hello-world-state-1', 'hello-world-state-1-1',
            'caf%C3%A9--tea', 'linked-heading', 'setext-title', 'trailing',
            'emphasis-and-under_score')))
        self.assertEqual(self.check(), [])

    def test_same_document_fragments_and_fenced_headings(self):
        path = self.write('docs/guide.md', '# Present\n[Self](#present)\n'
                          '```md\n# Example only\n```\n')
        self.assertEqual(self.check(), [])
        path.write_text(path.read_text() + '[Wrong](#example-only)\n')
        self.assertEqual(self.check(), [
            'docs/guide.md:6 -> #example-only (missing heading fragment)'])

    def test_full_collapsed_shortcut_and_multiline_reference_links(self):
        self.write('docs/guide.md', '# Guide')
        self.write('CLAUDE.md', '[full][THE Guide]\n[collapsed][]\n[shortcut]\n'
                   '[multi][line]\n[the   guide]: docs/guide.md#guide "Title"\n'
                   '[collapsed]: <docs/guide.md>\n[shortcut]: docs/guide.md\n'
                   '[line]:\n  docs/guide.md#guide\n')
        self.assertEqual(self.check(), [])

    def test_reference_fragment_failure_reports_usage_line(self):
        self.write('docs/guide.md', '# Guide')
        self.write('CLAUDE.md', '[Guide][ref]\n\n[ref]: docs/guide.md#absent')
        self.assertEqual(self.check(), [
            'CLAUDE.md:1 -> docs/guide.md#absent (missing heading fragment)'])

    def test_fences_inline_code_comments_and_external_urls_are_ignored(self):
        self.write('CLAUDE.md', '```md\n[No](missing.md)\n```\n'
                   '~~~\n[No][missing]\n[missing]: absent.md\n~~~\n'
                   '`[Inline](absent.md)`\n``[Inline ` tick](absent.md)``\n'
                   '<!-- [Comment](absent.md) -->\n'
                   '[Web](https://example.invalid/no.md#missing)\n'
                   '[Mail](mailto:no@example.invalid) [Host](//example.invalid/missing)\n'
                   '[App](app://connector)\n\\[Escaped](missing.md)\n')
        self.assertEqual(self.check(), [])

    def test_nested_labels_parentheses_images_and_optional_titles(self):
        self.write('docs/a(b).md', '# Guide')
        self.write('docs/image.svg', '<svg/>')
        self.write('CLAUDE.md', '[Nested [label]](docs/a(b).md#guide "Title")\n'
                   '[Escaped](docs/a\\(b\\).md)\n![Alt](docs/image.svg)\n')
        self.assertEqual(self.check(), [])

    def test_maintained_source_roots_and_excluded_trees(self):
        sources = ('AGENTS.md', 'CLAUDE.md', 'README.md', '.github/pull_request_template.md',
                   'docs/nested/guide.md', 'app/docs/guide.md', 'flows/sample/docs/flow.md',
                   '.claude/skills/sample/SKILL.md')
        for name in sources:
            self.write(name, '[Bad](/missing.md)')
        for name in ('.worktrees/README.md', 'docs/.worktrees/README.md',
                     'flows/.worktrees/docs/flow.md', '.local-preview/README.md',
                     'publication-output/README.md', 'branching.md', 'app/screens/README.md'):
            self.write(name, '[Ignore](absent.md)')
        self.assertCountEqual(self.check(), [f'{name}:1 -> /missing.md (missing file)'
                                            for name in sources])

    def test_protected_and_worktree_targets_are_never_read(self):
        self.write('app/data/zip-cost-of-living.md', '# Secret')
        self.write('.worktrees/secret.md', '# Secret')
        self.write('CLAUDE.md', '[Data](app/data/zip-cost-of-living.md#secret)\n'
                   '[Worktree](.worktrees/secret.md#secret)')
        read_text = Path.read_text

        def guarded(path, *args, **kwargs):
            self.assertTrue(checker.permitted(path), f'Forbidden read: {path}')
            return read_text(path, *args, **kwargs)

        with patch.object(Path, 'read_text', guarded):
            errors = self.check()
        self.assertEqual(len(errors), 2)
        self.assertTrue(all('(excluded target)' in error for error in errors))

    def test_link_outside_checkout_is_rejected(self):
        self.write('README.md', '[Outside](../outside.md)')
        self.assertIn('target outside maintained checkout', self.check()[0])

    def test_symlink_cannot_bypass_exclusions(self):
        target = self.write('.worktrees/secret.md', '# Secret')
        self.write('CLAUDE.md', '[Secret](secret.md#secret)')
        try:
            (self.root / 'secret.md').symlink_to(target)
            (self.root / 'docs').symlink_to(target.parent, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest('Symlinks unavailable on this platform')
        self.assertEqual(len(self.check()), 1)
        self.assertIn('excluded', self.check()[0])


if __name__ == '__main__':
    unittest.main()
