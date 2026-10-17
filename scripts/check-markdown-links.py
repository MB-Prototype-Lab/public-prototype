#!/usr/bin/env python3
"""Validate maintained Markdown's local links, using only the standard library."""
import argparse
from html import unescape
import os
from pathlib import Path
import re
import unicodedata
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def permitted(path):
    # Apply before stat/read too: even linked examples must not open these paths.
    return '.worktrees' not in path.parts and not path.name.startswith('zip-cost-of-living.')


def markdown_files(root):
    """Explicit source roots avoid exports, data, local previews and worktrees."""
    for name in ('AGENTS.md', 'CLAUDE.md', 'README.md', '.github/pull_request_template.md'):
        path = root / name
        resolved = path.resolve()
        if (permitted(resolved) and resolved.is_relative_to(root)
                and not path.is_symlink() and path.is_file()):
            yield path
    directories = [root / 'docs', root / 'app/docs', root / '.claude/skills']
    flows = root / 'flows'
    if flows.is_dir():
        directories.extend(path / 'docs' for path in flows.iterdir()
                           if permitted(path) and not path.is_symlink() and path.is_dir())
    for directory in directories:
        resolved = directory.resolve()
        if directory.is_symlink() or not permitted(resolved) or not resolved.is_relative_to(root):
            continue
        for base, dirs, files in os.walk(directory, followlinks=False):
            dirs[:] = sorted(d for d in dirs if not d.startswith('.')
                             and not (Path(base) / d).is_symlink())
            for name in sorted(files):
                path = Path(base) / name
                if path.suffix.lower() == '.md' and permitted(path) and not path.is_symlink():
                    yield path


def prose(source):
    """Blank fenced examples and comments, retaining line numbers for diagnostics."""
    lines = []
    fence = None
    for line in source.splitlines(keepends=True):
        match = re.match(r'^\s{0,3}(`{3,}|~{3,})(.*)$', line)
        if fence:
            if match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
                fence = None
            lines.append('\n' if line.endswith('\n') else '')
        elif match:
            fence = match[1]
            lines.append('\n' if line.endswith('\n') else '')
        else:
            lines.append(line)
    return re.sub(r'<!--.*?-->', lambda m: '\n' * m[0].count('\n'), ''.join(lines), flags=re.S)


def without_code(text):
    return re.sub(r'(`+)(?!`)(.+?)(?<!`)\1(?!`)',
                  lambda m: re.sub(r'[^\n]', ' ', m[0]), text, flags=re.S)


def close_bracket(text, start, opening, closing):
    depth = 1
    i = start + 1
    while i < len(text):
        if text[i] == '\\':
            i += 2
            continue
        if text[i] == opening:
            depth += 1
        elif text[i] == closing:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def destination(text):
    text = text.lstrip()
    if text.startswith('<'):
        end = text.find('>')
        return text[1:end] if end != -1 else ''
    # A bare destination may contain balanced parentheses and an optional title.
    match = re.match(r'(?:\\.|[^\s])+', text)
    return match[0] if match else ''


def label_key(label):
    return ' '.join(label.split()).casefold()


def links(source):
    text = without_code(prose(source))
    definitions = {}
    definition = re.compile(r'^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:\n[ \t]+)?(.+)$', re.M)
    for match in definition.finditer(text):
        definitions.setdefault(label_key(match[1]), destination(match[2]))
    text = definition.sub(lambda m: ' ' * len(m[0].replace('\n', '')) + '\n' * m[0].count('\n'), text)
    i = 0
    while i < len(text):
        if text[i] == '\\':
            i += 2
            continue
        if text[i] != '[':
            i += 1
            continue
        end = close_bracket(text, i, '[', ']')
        if end is None:
            i += 1
            continue
        label = text[i + 1:end]
        after = end + 1
        url = None
        if after < len(text) and text[after] == '(':
            finish = close_bracket(text, after, '(', ')')
            if finish is not None:
                url = destination(text[after + 1:finish])
                after = finish + 1
        else:
            reference = re.match(r'[ \t]*(?:\n[ \t]*)?\[([^\]\n]*)\]', text[after:])
            if reference:
                key = label_key(reference[1] or label)
                url = definitions.get(key)
                after += reference.end()
            else:
                url = definitions.get(label_key(label))
        if url is not None:
            yield text.count('\n', 0, i) + 1, re.sub(r'\\([!"#$%&\'()*+,\-./:;<=>?@\[\]\\^_`{|}~])', r'\1', unescape(url))
        i = after


def headings(source):
    """GitHub heading slugs: lowercase, strip punctuation, suffix collisions."""
    text = prose(source)
    used = set()
    lines = text.splitlines()
    for index, line in enumerate(lines):
        match = re.match(r'^ {0,3}#{1,6}[ \t]+(.*)$', line)
        if match:
            title = re.sub(r'[ \t]+#+[ \t]*$', '', match[1]).strip()
        elif (line.strip() and index + 1 < len(lines)
              and re.fullmatch(r' {0,3}(?:=+|-+)[ \t]*', lines[index + 1])):
            title = line.strip()
        else:
            continue
        title = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', title)
        # Strip underscore emphasis, but retain underscores inside code spans.
        title = re.sub(r'(`+)(.+?)\1|(?<![\w\\])(_{1,2})(?=\S)(.+?)\3(?!\w)',
                       lambda m: m[2] if m[1] else m[4], title)
        title = unescape(re.sub(r'<[^>]*>', '', title)).lower()
        slug = ''.join(c for c in title if c in '-_ ' or
                       unicodedata.category(c)[0] in 'LN' or
                       unicodedata.category(c) == 'Mn').replace(' ', '-')
        candidate = slug
        suffix = 0
        while candidate in used:
            suffix += 1
            candidate = f'{slug}-{suffix}'
        used.add(candidate)
    return used


def check_checkout(root):
    root = root.resolve()
    errors = []
    anchors = {}
    for source in markdown_files(root):
        for line, url in links(source.read_text(encoding='utf-8')):
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc:
                continue
            path = unquote(parsed.path)
            target = (root / path.lstrip('/') if path.startswith('/')
                      else source.parent / path) if path else source
            reason = None
            if not permitted(target):
                reason = 'excluded target'
            else:
                target = target.resolve()
                if not target.is_relative_to(root) or not permitted(target):
                    reason = 'target outside maintained checkout or excluded'
                elif not target.is_file():
                    reason = 'missing file'
                elif parsed.fragment and target.suffix.lower() == '.md':
                    if target not in anchors:
                        anchors[target] = headings(target.read_text(encoding='utf-8'))
                    if unquote(parsed.fragment) not in anchors[target]:
                        reason = 'missing heading fragment'
            if reason:
                errors.append(f'{source.relative_to(root)}:{line} -> {url} ({reason})')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT, help='checkout to validate')
    args = parser.parse_args()
    errors = check_checkout(args.root)
    if errors:
        parser.exit(1, '\n'.join(errors) + '\n')
    print('Maintained Markdown local files and heading fragments resolve.')


if __name__ == '__main__':
    main()
