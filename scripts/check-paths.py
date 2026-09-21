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


if __name__ == '__main__':
    # Only the app and gate are editable. Historical source may contain unused
    # templates; publication verifies exact migration bytes, not new behavior.
    import tempfile
    import shutil
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        for name in ('app', 'gate'):
            shutil.copytree(ROOT/name, root/name)
        shutil.copyfile(ROOT/'index.html', root/'index.html')
        errors = check_tree(root)
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Local app and selector references resolve.')
