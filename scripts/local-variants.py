#!/usr/bin/env python3
"""Agent-operated local comparisons. No network operations or recursive discovery."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(value, encoding='utf-8')
    os.replace(temporary, path)


def save(root, state):
    atomic(root / '.local-preview/sessions' / (state['id'] + '.json'), json.dumps(state, indent=2))


def records(root):
    result = {}
    for record in git(root, 'worktree', 'list', '--porcelain', '-z').split('\0\0'):
        fields = dict(line.split(' ', 1) for line in record.split('\0') if ' ' in line)
        if 'worktree' in fields:
            result[str(Path(fields['worktree']).resolve())] = fields.get('branch')
    return result


def option_letter(number):
    """One-based spreadsheet lettering: A through Z, then AA, AB, ..."""
    letters = ''
    while number:
        number, remainder = divmod(number - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def available_names(root, count):
    """Keep letters aligned across a comparison; never reuse retained branches."""
    branches = {name.casefold() for name in git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads').splitlines()}
    registered = {path.casefold() for path in records(root)}
    # Consult Git registration and exact candidate paths; never search worktrees.
    directory = root / '.worktrees'
    serial = 1
    while True:
        suffix = '' if serial == 1 else '-' + str(serial)
        names = ['variant-' + option_letter(n) + suffix for n in range(1, count + 1)]
        if all(not os.path.lexists(directory / name) and
               str(directory / name).casefold() not in registered and
               ('refs/heads/variant/' + name).casefold() not in branches for name in names):
            return names
        serial += 1


def location(root, variant):
    ident = variant['id']
    if not re.fullmatch(r'(?:[a-z0-9][a-z0-9-]*|variant-[A-Z]+(?:-[1-9][0-9]*)?)', ident):
        raise RuntimeError('Invalid managed variant identity')
    path = root / '.worktrees' / ident
    if path.resolve() != path or variant['branch'] != 'variant/' + ident:
        raise RuntimeError('Managed path or branch identity changed')
    return path


def valid(root, variant):
    path = location(root, variant)
    registered = records(root).get(str(path))
    if not path.exists():
        return False
    if registered != 'refs/heads/' + variant['branch']:
        raise RuntimeError('Worktree registration/branch mismatch: ' + str(path))
    return True


def refresh(root, state):
    if state['status'] == 'closed':
        atomic(root / '.local-preview/variants.js', 'window.MB_LOCAL_VARIANTS = {"active": false, "variants": []};\n')
        return
    variants = []
    for variant in state['variants']:
        if variant.get('removed'):
            continue
        if not valid(root, variant):
            print('Missing worktree: ' + variant['id'], file=sys.stderr)
            continue
        path = location(root, variant)
        atomic(path / '.local-preview/return.js', 'window.MB_LOCAL_RETURN = ' + json.dumps({'href': '../../index.html'}) + ';\n')
        if state['status'] not in ('closed', 'creating'):
            variants.append({key: variant[key] for key in ('id', 'label', 'description')} | {'href': '.worktrees/' + variant['id'] + '/app/index.html'})
    manifest = {'active': state['status'] not in ('closed', 'creating'), 'variants': variants}
    atomic(root / '.local-preview/variants.js', 'window.MB_LOCAL_VARIANTS = ' + json.dumps(manifest, ensure_ascii=True) + ';\n')


def checkpoint(root, files, message):
    if not files:
        return
    paths = []
    for name in files:
        path = root / name
        relative = path.resolve().relative_to(root)
        if not relative.parts or relative.parts[0] in ('.git', '.worktrees', '.local-preview') or relative.as_posix() == 'branching.md' or path.is_dir():
            raise RuntimeError('Select individual task files only: ' + name)
        paths.append(relative.as_posix())
    # Literal pathspecs prevent a filename from selecting unrelated files.
    specs = [':(literal)' + path for path in paths]
    git(root, 'add', '--', *specs)
    git(root, 'commit', '--only', '-m', message, '--', *specs)


def current(root):
    return git(root, 'symbolic-ref', '--short', 'HEAD')


def clean(root):
    if git(root, 'status', '--porcelain', '--untracked-files=all'):
        raise RuntimeError('Working tree must be clean: ' + str(root))


def run(root, args):
    directory = root / '.local-preview'
    active = directory / 'current'
    state = None
    ident = args.session or (active.read_text().strip() if active.exists() else None)
    if ident:
        if not re.fullmatch(r'[a-f0-9]{12}', ident):
            raise RuntimeError('Invalid session identity')
        state = json.loads((directory / 'sessions' / (ident + '.json')).read_text())
        if state['root'] != str(root) or state['id'] != ident:
            raise RuntimeError('Session belongs to another checkout')
    if args.command == 'create':
        if state and state['status'] != 'closed':
            raise RuntimeError('Close or resume the current comparison first')
        branch = current(root)
        if branch in ('main', 'master', 'demo') or branch.startswith(('variant/', 'HoffDemo')):
            raise RuntimeError('Start from the current feature branch')
        if not args.option:
            raise RuntimeError('Supply at least one --option LABEL DESCRIPTION')
        ident = uuid.uuid4().hex[:12]
        if (directory / 'sessions' / (ident + '.json')).exists():
            raise RuntimeError('Session identity collision; retry creation')
        names = available_names(root, len(args.option))
        print(git(root, 'status', '--short'))
        checkpoint(root, args.file, 'Checkpoint local comparison task files')
        state = {'id': ident, 'root': str(root), 'branch': branch, 'checkpoint': git(root, 'rev-parse', 'HEAD'), 'status': 'creating', 'variants': []}
        for vid, (label, description) in zip(names, args.option):
            variant = {'id': vid, 'label': label, 'description': description, 'branch': 'variant/' + vid}
            path = location(root, variant)
            if path.exists() or 'refs/heads/' + variant['branch'] in git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads').splitlines():
                raise RuntimeError('Variant branch/path collision')
            state['variants'].append(variant)
        save(root, state)
        atomic(active, ident)
        # Save the entire creation intent first so failures remain recoverable.
        for variant in state['variants']:
            git(root, 'worktree', 'add', '-b', variant['branch'], str(location(root, variant)), state['checkpoint'])
        state['status'] = 'active'
    elif state is None:
        raise RuntimeError('No comparison registered')
    elif args.command in ('status', 'refresh'):
        if args.command == 'refresh' and args.resume:
            if state['status'] != 'creating':
                raise RuntimeError('--resume only applies to interrupted creation')
            for variant in state['variants']:
                if valid(root, variant):
                    continue
                path = location(root, variant)
                if str(path) in records(root):
                    raise RuntimeError('Missing registered worktree; repair Git registration before resuming')
                branches = git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads').splitlines()
                if 'refs/heads/' + variant['branch'] in branches:
                    if git(root, 'rev-parse', variant['branch']) != state['checkpoint']:
                        raise RuntimeError('Interrupted variant branch advanced; preserve and inspect it')
                    git(root, 'worktree', 'add', str(path), variant['branch'])
                else:
                    git(root, 'worktree', 'add', '-b', variant['branch'], str(path), state['checkpoint'])
        if state['status'] == 'creating' and all(valid(root, v) for v in state['variants']):
            state['status'] = 'active'
    elif args.command == 'close':
        state['status'] = 'closed'
    elif args.command in ('adopt', 'cleanup'):
        selected = [v for v in state['variants'] if v['id'] in args.variant]
        if len(selected) != len(set(args.variant)) or not selected:
            raise RuntimeError('Select registered variant IDs explicitly')
        if args.command == 'adopt':
            if len(selected) != 1 or state['status'] not in ('active', 'merging', 'verification'):
                raise RuntimeError('Adopt one alternative from an active comparison')
            variant = selected[0]
            if not valid(root, variant):
                raise RuntimeError('Chosen worktree is missing')
            if current(root) != state['branch']:
                raise RuntimeError('Return the primary checkout to the original branch')
            path = location(root, variant)
            if state.get('winner') and state['winner'] != variant['id']:
                raise RuntimeError('Resume the recorded adoption before choosing another winner')
            clean(root)
            checkpoint(path, args.file, 'Complete local alternative for adoption')
            clean(path)
            if args.verified:
                if state['status'] not in ('merging', 'verification'):
                    raise RuntimeError('Merge and verify before closing adoption')
                git(root, 'merge-base', '--is-ancestor', variant['branch'], 'HEAD')
                state['status'] = 'closed'
            else:
                state['winner'] = variant['id']
                state['status'] = 'merging'
                save(root, state)
                git(root, 'merge', '--no-edit', variant['branch'])
                state['status'] = 'verification'
        else:
            if state['status'] != 'closed':
                raise RuntimeError('Close the comparison before cleanup')
            for variant in selected:
                if valid(root, variant):
                    clean(location(root, variant))
                    git(root, 'worktree', 'remove', str(location(root, variant)))
                variant['removed'] = True
                save(root, state)
    save(root, state)
    # Archived cleanup must not replace a newer comparison's manifest.
    if not active.exists() or active.read_text().strip() == state['id']:
        refresh(root, state)
    print(json.dumps(state, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--session', help='Archived session ID (status or cleanup)')
    sub = parser.add_subparsers(dest='command', required=True)
    create = sub.add_parser('create')
    create.add_argument('--option', nargs=2, action='append', metavar=('LABEL', 'DESCRIPTION'))
    create.add_argument('--file', action='append', default=[])
    for command in ('status', 'close'):
        sub.add_parser(command)
    refresh_parser = sub.add_parser('refresh')
    refresh_parser.add_argument('--resume', action='store_true')
    adopt = sub.add_parser('adopt')
    adopt.add_argument('variant', nargs=1)
    adopt.add_argument('--file', action='append', default=[])
    adopt.add_argument('--verified', action='store_true', help='Confirm affected checks passed after merge')
    cleanup = sub.add_parser('cleanup')
    cleanup.add_argument('variant', nargs='+')
    args = parser.parse_args()
    lock = None
    try:
        root = Path(git(Path.cwd(), 'rev-parse', '--show-toplevel')).resolve()
        common = Path(git(root, 'rev-parse', '--git-common-dir'))
        common = (root / common).resolve()
        if common != root / '.git':
            raise RuntimeError('Run from the primary checkout; nested comparisons are not supported')
        if args.session and args.command not in ('status', 'cleanup'):
            raise RuntimeError('--session is only for status or cleanup')
        directory = root / '.local-preview'
        directory.mkdir(exist_ok=True)
        if directory.is_symlink():
            raise RuntimeError('Local metadata directory must not be a symlink')
        candidate = directory / 'operation.lock'
        candidate.mkdir()
        lock = candidate
        run(root, args)
        return 0
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        return 1
    finally:
        if lock:
            lock.rmdir()


if __name__ == '__main__':
    sys.exit(main())
