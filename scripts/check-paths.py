#!/usr/bin/env python3
"""Check literal local HTML/CSS asset references without a browser or network."""
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def check_tree(root):
    failures = []
    def check(source, url):
        url = url.strip()
        parsed = urlsplit(url)
        if not parsed.path or parsed.scheme or parsed.netloc or url.startswith('data:'):
            return
        target = (root/parsed.path.lstrip('/') if url.startswith('/') else source.parent/unquote(parsed.path)).resolve()
        # These two files are generated only while a local comparison is active.
        if (source.relative_to(root) == Path('index.html') and
                url in ('.local-preview/variants.js', '.local-preview/return.js') and
                not target.exists()):
            return
        if not target.is_relative_to(root.resolve()) or not target.is_file():
            failures.append(f'{source.relative_to(root)} -> {url}')
    class References(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key, value in attrs:
                if value and (key == 'src' or (key == 'href' and tag in ('link', 'a')) or key == 'poster'):
                    check(self.source, value)
    for path in root.rglob('*'):
        if any(part.startswith('.') for part in path.relative_to(root).parts):
            continue
        if path.suffix == '.html':
            parser = References(); parser.source = path; parser.feed(path.read_text())
        elif path.suffix == '.css':
            for url in re.findall(r'url\(\s*[\'"]?([^\'"\)]+)', path.read_text()):
                check(path, url)
    return failures


def check_checkout(checkout):
    # Validate editable app/gate/Flow packages, never historical exports or worktrees.
    import tempfile
    import shutil
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        for name in ('app', 'gate', 'flows'):
            source = checkout / name
            if name == 'flows' and not source.exists():
                continue
            shutil.copytree(source, root / name, symlinks=True,
                            ignore=shutil.ignore_patterns('.*'))
        shutil.copyfile(checkout / 'index.html', root / 'index.html')
        return check_tree(root)


if __name__ == '__main__':
    errors = check_checkout(ROOT)
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Local app, Flow and selector references resolve.')
