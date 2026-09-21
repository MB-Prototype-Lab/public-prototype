#!/usr/bin/env python3
"""Deterministic static publication. Standard library only; never runs exported code."""
import argparse
import hashlib
import html
from html.parser import HTMLParser
import posixpath
from urllib.parse import unquote, urlsplit
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
IMMUTABLE = ('id', 'source_tag', 'commit', 'source_dir', 'public_path', 'format', 'tracking', 'digest')
PRESENTATION = ('label', 'description', 'order', 'state', 'ongoing_study')
CEILING = 800_000_000
ID = re.compile(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}\Z')
HEX = re.compile(r'[0-9a-f]{40}\Z')
SHA256 = re.compile(r'[0-9a-f]{64}\Z')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def git(*args, repo=ROOT):
    return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.PIPE)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


def file_digests(files):
    return {k: hashlib.sha256(v).hexdigest() for k, v in sorted(files.items())}


def digest(files):
    return hashlib.sha256(canonical(file_digests(files))).hexdigest()


def safe_path(path):
    return isinstance(path, str) and bool(path) and not path.startswith('/') and all(
        p not in ('', '.', '..') for p in path.split('/')) and not re.search(r'[^A-Za-z0-9_./-]', path)


def validate(catalog):
    require(isinstance(catalog, dict) and set(catalog) == {'schema', 'migration_baseline', 'snapshots'}, 'invalid catalog fields')
    require(type(catalog['schema']) is int and catalog['schema'] == 1, 'unsupported catalog schema')
    require(isinstance(catalog['migration_baseline'], str) and HEX.fullmatch(catalog['migration_baseline']), 'invalid migration baseline')
    require(isinstance(catalog['snapshots'], list) and catalog['snapshots'], 'empty or invalid snapshots')
    ids, paths = set(), set()
    for row in catalog['snapshots']:
        require(isinstance(row, dict) and set(row) == set(IMMUTABLE + PRESENTATION), 'invalid snapshot fields')
        require(isinstance(row['id'], str) and ID.fullmatch(row['id']), 'invalid snapshot id')
        require(row['id'] not in ids, 'duplicate snapshot id')
        ids.add(row['id'])
        require(row['source_tag'] == 'snapshot/' + row['id'], 'invalid source tag')
        require(isinstance(row['commit'], str) and HEX.fullmatch(row['commit']), 'full source SHA required')
        require(row['format'] in ('legacy-v1', 'static-v1'), 'unsupported packaging format')
        require(row['public_path'] == 'versions/' + row['id'] + '/index.html', 'invalid public path')
        require(row['public_path'] not in paths, 'conflicting public path')
        paths.add(row['public_path'])
        require(safe_path(row['source_dir']), 'unsafe source directory')
        require(row['source_dir'] == ('versions/' + row['id'] if row['format'] == 'legacy-v1' else 'app'), 'invalid source directory for format')
        if row['format'] == 'legacy-v1':
            require(row['commit'] == catalog['migration_baseline'], 'legacy source differs from migration baseline')
        require(type(row['tracking']) is bool, 'tracking must be boolean')
        require(isinstance(row['digest'], str) and SHA256.fullmatch(row['digest']), 'invalid content digest')
        require(all(isinstance(row[k], str) and len(row[k]) <= 1000 for k in ('label', 'description')), 'invalid presentation text')
        require(type(row['order']) is int and 0 <= row['order'] <= 100000, 'invalid order')
        require(row['state'] in ('active', 'archived', 'hidden', 'retired'), 'invalid lifecycle state')
        require(row['ongoing_study'] is None or type(row['ongoing_study']) is bool, 'invalid study status')
        require(not (row['state'] == 'retired' and row['ongoing_study'] is not False), 'resolve study before retirement')
    return catalog


def transition(catalog, previous):
    """Previous is a catalog or a manifest containing a catalog."""
    if 'catalog' in previous:
        previous = previous['catalog']
    validate(previous)
    require(catalog['migration_baseline'] == previous['migration_baseline'], 'migration baseline changed')
    current = {r['id']: r for r in catalog['snapshots']}
    for old in previous['snapshots']:
        require(old['id'] in current, 'missing retained build: ' + old['id'])
        new = current[old['id']]
        require(all(old[k] == new[k] for k in IMMUTABLE), 'immutable identity changed: ' + old['id'])
        demoted = old['state'] == 'active' and new['state'] != 'active'
        if demoted or new['state'] == 'retired':
            require(new['ongoing_study'] is False, 'resolve study before demotion/retirement')


def export(commit, source_dir, repo=ROOT):
    require(HEX.fullmatch(commit) and safe_path(source_dir), 'unsafe source')
    prefix = source_dir + '/'
    files = {}
    # git archive uses committed blobs only. Reject links/submodules, never extract paths.
    tree = git('ls-tree', '-rz', commit, '--', source_dir, repo=repo)
    for entry in tree.split(b'\0'):
        if entry:
            mode = entry.split(b' ', 1)[0]
            require(mode in (b'100644', b'100755'), 'links/submodules are not publishable')
    data = git('archive', '--format=tar', commit, source_dir, repo=repo)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive:
            if member.isdir():
                continue
            require(member.isfile() and member.name.startswith(prefix), 'unsafe archive entry')
            rel = member.name[len(prefix):]
            require(not PurePosixPath(rel).is_absolute() and '..' not in PurePosixPath(rel).parts, 'unsafe archive path')
            files[rel] = archive.extractfile(member).read()
    require('index.html' in files, 'snapshot missing index.html')
    return files


def package(row, repo=ROOT, require_tags=True):
    if require_tags:
        require(git('rev-parse', 'refs/tags/' + row['source_tag'] + '^{commit}', repo=repo).decode().strip() == row['commit'], 'moved source tag')
    else:
        # Missing tags are permitted only for offline preparation. Existing tags must match.
        try:
            tagged = git('rev-parse', 'refs/tags/' + row['source_tag'] + '^{commit}', repo=repo).decode().strip()
        except subprocess.CalledProcessError:
            tagged = None
        require(tagged is None or tagged == row['commit'], 'moved source tag')
    files = export(row['commit'], row['source_dir'], repo)
    if row['format'] == 'legacy-v1':
        flag = re.search(rb'const USEBERRY_TRACKING\s*=\s*(true|false)\s*;', files.get('js/config.js', b''))
        actual_tracking = bool(flag and flag.group(1) == b'true')
        require(row['tracking'] == actual_tracking, 'legacy tracking metadata differs from source')
    if row['format'] == 'static-v1':
        extensions = {'.html', '.js', '.css', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.wav', '.mp3', '.mp4', '.ogg', '.woff', '.woff2', '.ttf'}
        files = {p: b for p, b in files.items() if PurePosixPath(p).suffix.lower() in extensions and not any(x.startswith('.') for x in PurePosixPath(p).parts) and not p.startswith(('docs/', '.worktrees/'))}
        require('release-config.js' in files and b'src="release-config.js"' in files['index.html'], 'source does not support release configuration')
        files['release-config.js'] = b'window.MB_RELEASE = Object.freeze(' + canonical({'tracking': row['tracking'], 'selector': '../../index.html'}) + b');\n'
    return files


def selector(catalog, template, gate_js, css):
    rows = sorted(catalog['snapshots'], key=lambda r: (r['order'], r['id']))
    def card(row):
        tracking = 'Tracking on' if row['tracking'] else 'Tracking off'
        return ('<a class="gate-btn" href="' + row['public_path'] + '">' + html.escape(row['label']) +
                '<span class="gate-badge">' + tracking + '</span></a><p>' + html.escape(row['description']) + '</p>')
    active = ''.join(card(r) for r in rows if r['state'] == 'active')
    archived = ''.join(card(r) for r in rows if r['state'] == 'archived')
    listing = active + ('<details><summary>Older versions</summary>' + archived + '</details>' if archived else '')
    require('<!-- CATALOG -->' in template, 'selector template marker missing')
    return {'index.html': re.sub(r'<div id="localPreview">.*?</div>', '', template, flags=re.S).replace('<!-- CATALOG -->', listing).encode(), 'gate/gate.js': gate_js, 'gate/style.css': css, '.nojekyll': b''}


def validate_assets(output, prefixes):
    """Validate new snapshot literal HTML/CSS dependencies in the final hosted tree."""
    def check(source, value):
        url = urlsplit(value.strip())
        if url.scheme or url.netloc or not url.path:
            return
        target = posixpath.normpath(posixpath.join(posixpath.dirname(source), unquote(url.path)))
        require(target in output, 'missing published asset: ' + source + ' -> ' + value)
    class References(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key, value in attrs:
                if value and (key in ('src', 'poster') or key == 'href' and tag in ('link', 'a')):
                    check(self.source, value)
    for path, data in output.items():
        if path != 'index.html' and not any(path.startswith(prefix) for prefix in prefixes):
            continue
        if path.endswith('.html'):
            parser = References(); parser.source = path; parser.feed(data.decode('utf-8'))
        elif path.endswith('.css'):
            for value in re.findall(r"url\(\s*['\"]?([^'\"\)]+)", data.decode('utf-8')):
                check(path, value)


def validate_manifest(previous):
    require(isinstance(previous, dict) and set(previous) == {'schema', 'revision', 'catalog', 'snapshots', 'files'}, 'invalid publication manifest')
    require(previous['schema'] == 1 and HEX.fullmatch(previous['revision']), 'invalid manifest identity')
    validate(previous['catalog'])
    require(isinstance(previous['files'], dict) and 'index.html' in previous['files'], 'missing manifest files')
    for path, value in previous['files'].items():
        require(isinstance(path, str) and not path.startswith('/') and '..' not in PurePosixPath(path).parts and isinstance(value, str) and SHA256.fullmatch(value), 'invalid manifest file')
    require(set(previous['snapshots']) == {r['id'] for r in previous['catalog']['snapshots']}, 'manifest snapshot inventory mismatch')
    for row in previous['catalog']['snapshots']:
        source = previous['snapshots'][row['id']]
        require(isinstance(source, dict) and source and 'index.html' in source, 'missing snapshot file digests')
        require(hashlib.sha256(canonical(source)).hexdigest() == row['digest'], 'invalid previous snapshot digest')
        if row['state'] != 'retired':
            prefix = row['public_path'].rsplit('/', 1)[0] + '/'
            require({k[len(prefix):]: v for k, v in previous['files'].items() if k.startswith(prefix)} == source, 'previous hosted files differ from identity')


def build(catalog, revision, assets, repo=ROOT, previous=None, require_tags=True, ceiling=CEILING):
    validate(catalog)
    if previous is not None:
        validate_manifest(previous)
        transition(catalog, previous)
        require(subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor', previous['revision'], revision], capture_output=True).returncode == 0, 'stale or unrelated publication revision')
    output = selector(catalog, assets['index.html'].decode(), assets['gate/gate.js'], assets['gate/style.css'])
    snapshot_files = {}
    for row in catalog['snapshots']:
        files = package(row, repo, require_tags)
        require(digest(files) == row['digest'], 'content digest mismatch: ' + row['id'])
        hashes = file_digests(files)
        snapshot_files[row['id']] = hashes
        if previous and row['id'] in previous['snapshots']:
            require(hashes == previous['snapshots'][row['id']], 'published snapshot bytes changed')
        if row['state'] == 'retired':
            files = {'index.html': ('<!doctype html><meta charset="utf-8"><title>Build retired</title><h1>This build has been retired</h1><p>' + html.escape(row['label']) + '</p><a href="../../index.html">Return to selector</a>').encode()}
        prefix = row['public_path'].rsplit('/', 1)[0] + '/'
        output.update({prefix + k: v for k, v in files.items()})
    validate_assets(output, [r['public_path'].rsplit('/', 1)[0] + '/' for r in catalog['snapshots'] if r['format'] == 'static-v1'])
    manifest = {'schema': 1, 'revision': revision, 'catalog': catalog, 'snapshots': snapshot_files, 'files': file_digests(output)}
    output['publication-manifest.json'] = canonical(manifest) + b'\n'
    require(sum(map(len, output.values())) <= min(ceiling, CEILING), 'artifact exceeds size ceiling')
    return output


def read_json(data):
    def unique(pairs):
        result = {}
        for k, v in pairs:
            require(k not in result, 'duplicate JSON key: ' + k)
            result[k] = v
        return result
    return json.loads(data, object_pairs_hook=unique)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    check = sub.add_parser('check')
    check.add_argument('--base', help='Git revision whose catalog policy must be retained')
    pack = sub.add_parser('build')
    pack.add_argument('--revision', default='HEAD')
    pack.add_argument('--output', required=True)
    pack.add_argument('--previous', help='previous live publication manifest; required after bootstrap')
    pack.add_argument('--offline', action='store_true', help='local rehearsal only; permits missing source tags')
    pack.add_argument('--bootstrap-baseline', help='owner-verified SHA for first deployment only')
    pack.add_argument('--bootstrap-tag', help='administrator-approved initial publication tag')
    pack.add_argument('--main-ref', default='refs/remotes/origin/main')
    prepare = sub.add_parser('prepare')
    prepare.add_argument('--id', required=True)
    prepare.add_argument('--commit', required=True)
    prepare.add_argument('--label', required=True)
    prepare.add_argument('--tracking', choices=['on', 'off'], required=True)
    args = parser.parse_args()
    if args.command == 'prepare':
        row = dict(id=args.id, source_tag='snapshot/'+args.id, commit=git('rev-parse', args.commit+'^{commit}').decode().strip(), source_dir='app', public_path='versions/'+args.id+'/index.html', format='static-v1', tracking=args.tracking=='on', digest='0'*64, label=args.label, description='', order=0, state='active', ongoing_study=False)
        require(ID.fullmatch(args.id), 'invalid snapshot id')
        require(subprocess.run(['git', 'merge-base', '--is-ancestor', row['commit'], 'main'], capture_output=True).returncode == 0, 'snapshot source must be on local main')
        row['digest'] = digest(package(row, require_tags=False))
        print(json.dumps(row, indent=2))
    elif args.command == 'check':
        catalog = validate(read_json((ROOT/'publication/catalog.json').read_bytes()))
        require(not (ROOT/'versions').exists(), 'editable legacy directories reintroduced')
        if args.base:
            try:
                base = read_json(git('show', args.base+':publication/catalog.json'))
            except subprocess.CalledProcessError:
                # Only the initial migration is allowed to lack a catalog.
                require(git('rev-parse', args.base+'^{commit}').decode().strip() == catalog['migration_baseline'], 'base catalog unavailable')
            else:
                transition(catalog, base)
        migration = read_json((ROOT/'publication/migration.json').read_bytes())
        require(migration['baseline'] == catalog['migration_baseline'], 'migration baseline mismatch')
        require(set(migration['snapshots']) == {'v1', 'v2', 'v3', 'v3.1', 'v4'}, 'incomplete migration inventory')
        for row in catalog['snapshots']:
            require(digest(package(row, require_tags=False)) == row['digest'], 'snapshot digest mismatch')
        for snapshot_id, record in migration['snapshots'].items():
            row = next((r for r in catalog['snapshots'] if r['id'] == snapshot_id), None)
            require(row and row['digest'] == record['digest'] and row['source_tag'] == record['source_tag'] and row['format'] == 'legacy-v1', 'required migration snapshot missing or changed')
        print('Catalog policy and committed snapshot digests verified (missing tags allowed offline).')
    else:
        revision = git('rev-parse', args.revision+'^{commit}').decode().strip()
        catalog = read_json(git('show', revision+':publication/catalog.json'))
        previous = read_json(Path(args.previous).read_bytes()) if args.previous else None
        if not args.offline:
            require(args.revision.startswith('refs/tags/publish/'), 'deployment requires publication tag ref')
            require(revision == git('rev-parse', args.main_ref+'^{commit}').decode().strip(), 'stale publication: tag must equal current main')
            require(all(r['ongoing_study'] is not None for r in catalog['snapshots']), 'owner must confirm study status before cutover')
            if previous is None:
                require(args.bootstrap_baseline == catalog['migration_baseline'] and args.bootstrap_tag == args.revision, 'previous manifest required unless exact first publication is approved')
            for row in catalog['snapshots']:
                require(subprocess.run(['git', 'merge-base', '--is-ancestor', row['commit'], args.main_ref], capture_output=True).returncode == 0, 'source commit not on main')
        assets = {p: git('show', revision+':'+p) for p in ('index.html', 'gate/gate.js', 'gate/style.css')}
        output = build(catalog, revision, assets, previous=previous, require_tags=not args.offline)
        dest = Path(args.output).resolve()
        require(not dest.exists(), 'output already exists; use a fresh directory')
        dest.parent.mkdir(parents=True, exist_ok=True)
        # Validation completes before any destination appears; rename a complete temp tree.
        with tempfile.TemporaryDirectory(dir=dest.parent) as temp:
            tree = Path(temp)/'site'; tree.mkdir()
            for rel, data in output.items():
                target = tree/rel; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
            tree.rename(dest)
        print(f'Built {len(output)} files ({sum(map(len, output.values()))} bytes) at {dest}')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
        raise SystemExit('Publication stopped: '+str(exc))
