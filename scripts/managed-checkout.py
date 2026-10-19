#!/usr/bin/env python3
"""Owned independent Git checkouts, transferred through offline explicit bundles.

No clone alternates, hardlinks, linked-worktree registration or shared Git config.
Uncertain interrupted creations are retained for inspection, never overwritten.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


class ManagedCheckoutError(RuntimeError):
    pass


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True)
    if result.returncode:
        raise ManagedCheckoutError(result.stderr.decode(errors='replace').strip())
    return result.stdout.decode('utf-8', errors='surrogateescape').strip()


def canonical(path):
    path = Path(path)
    if not path.is_absolute() or path.is_symlink() or path.resolve() != path:
        raise ManagedCheckoutError('Managed checkout path is noncanonical or symlinked; preserved')
    return path


def validate(path, owner, expected_branch):
    path = canonical(path)
    metadata = path / '.git'
    if not metadata.is_dir() or metadata.is_symlink():
        raise ManagedCheckoutError('Managed independent checkout requires its own .git directory; preserved')
    marker = metadata / 'moneybuddy-managed.json'
    if marker.is_symlink() or not marker.is_file():
        raise ManagedCheckoutError('Managed checkout ownership marker missing; preserved')
    try:
        saved = json.loads(marker.read_text(encoding='utf-8'))
    except (ValueError, OSError) as error:
        raise ManagedCheckoutError('Managed checkout ownership marker unreadable; preserved') from error
    if saved.get('schema') != 1 or saved.get('owner') != owner or not isinstance(saved.get('refs'), dict):
        raise ManagedCheckoutError('Managed checkout ownership mismatch; preserved')
    for base, dirs, files in os.walk(metadata, followlinks=False):
        for name in dirs + files:
            entry = Path(base) / name
            if entry.is_symlink() or (entry.is_file() and entry.stat().st_nlink > 1):
                raise ManagedCheckoutError('Managed Git metadata contains links; preserved')
    for name in ('commondir', 'gitdir', 'worktrees', 'objects/info/alternates', 'objects/info/http-alternates'):
        if os.path.lexists(metadata / name):
            raise ManagedCheckoutError('Managed checkout has shared Git metadata; preserved')
    entries = git(path, 'worktree', 'list', '--porcelain').splitlines()
    if sum(line.startswith('worktree ') for line in entries) != 1:
        raise ManagedCheckoutError('Managed checkout owns additional worktrees; preserved')
    if Path(git(path, 'rev-parse', '--absolute-git-dir')).resolve() != metadata:
        raise ManagedCheckoutError('Managed checkout Git directory changed; preserved')
    if Path(git(path, 'rev-parse', '--show-toplevel')).resolve() != path:
        raise ManagedCheckoutError('Managed checkout worktree redirected; preserved')
    config = git(path, 'config', '--local', '--list').lower()
    if any(line.startswith(('extensions.', 'core.worktree=')) for line in config.splitlines()):
        raise ManagedCheckoutError('Managed checkout repository format or worktree changed; preserved')
    symbolic = subprocess.run(['git', '-C', str(path), 'symbolic-ref', '-q', 'HEAD'], capture_output=True)
    actual = symbolic.stdout.decode().strip() if symbolic.returncode == 0 else None
    if actual != expected_branch:
        raise ManagedCheckoutError('Managed checkout branch identity changed; preserved')
    return git(path, 'rev-parse', '--verify', 'HEAD^{commit}')


def create(source, path, refs, head, branch, owner):
    path = canonical(path)
    if os.path.lexists(path):
        raise ManagedCheckoutError('Managed checkout destination already exists; preserved')
    path.parent.mkdir(parents=True, exist_ok=True)
    # Build the export before reserving the destination; no network/ref inference.
    with tempfile.TemporaryDirectory(prefix='moneybuddy-export-') as directory:
        bundle = Path(directory) / 'source.bundle'
        git(source, 'bundle', 'create', str(bundle), *refs)
        path.mkdir()
        git(path, '-c', 'init.defaultObjectFormat=sha1', '-c', 'init.defaultRefFormat=files', 'init', '--template=', '--object-format=sha1', '-b', 'managed-initial')
        for key in ('user.name', 'user.email', 'core.autocrlf', 'core.eol', 'commit.gpgsign', 'tag.gpgsign', 'user.signingkey', 'gpg.format'):
            value = subprocess.run(['git', '-C', str(source), 'config', '--get', key], capture_output=True)
            if value.returncode == 0:
                git(path, 'config', '--local', key, value.stdout.decode().rstrip('\n'))
        git(path, '-c', 'protocol.file.allow=always', 'fetch', '--no-tags', str(bundle), *[ref + ':' + ref for ref in refs])
        if branch:
            git(path, 'checkout', branch.removeprefix('refs/heads/'))
        else:
            git(path, 'checkout', '--detach', head)
        if git(path, 'rev-parse', 'HEAD') != head:
            raise ManagedCheckoutError('Managed checkout export HEAD changed; destination retained')
        marker = path / '.git/moneybuddy-managed.json'
        with marker.open('x', encoding='utf-8') as stream:
            json.dump({'schema': 1, 'owner': owner, 'refs': ref_inventory(path)}, stream, sort_keys=True)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
    validate(path, owner, branch)


def import_objects(source, target, ref):
    """Import only objects from one explicit ref; callers own durable CAS updates."""
    expected = git(source, 'rev-parse', '--verify', ref + '^{commit}')
    with tempfile.TemporaryDirectory(prefix='moneybuddy-import-') as directory:
        bundle = Path(directory) / 'review.bundle'
        git(source, 'bundle', 'create', str(bundle), ref)
        listed = git(target, 'bundle', 'list-heads', str(bundle)).splitlines()
        if listed != [expected + ' ' + ref]:
            raise ManagedCheckoutError('Exported review ref changed; import withheld')
        git(target, 'bundle', 'verify', str(bundle))
        # unbundle imports objects without FETCH_HEAD, refs or branch mutation.
        git(target, 'bundle', 'unbundle', str(bundle))
    return expected


def ref_inventory(path):
    return dict(line.split(' ', 1) for line in git(path, 'for-each-ref', '--format=%(refname) %(objectname)').splitlines())


def remove(path, owner, expected_head, expected_branch, allowed_ignored=None):
    if validate(path, owner, expected_branch) != expected_head:
        raise ManagedCheckoutError('Managed checkout HEAD changed; preserved')
    metadata = Path(path) / '.git'
    for name in ('MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE', 'MERGE_AUTOSTASH', 'SQUASH_MSG', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG', 'BISECT_START', 'index.lock', 'HEAD.lock'):
        if os.path.lexists(metadata / name):
            raise ManagedCheckoutError('Managed checkout Git operation pending; preserved')
    saved = json.loads((metadata / 'moneybuddy-managed.json').read_text(encoding='utf-8'))
    expected_refs = dict(saved['refs'])
    if expected_branch:
        expected_refs[expected_branch] = expected_head
    if ref_inventory(path) != expected_refs:
        raise ManagedCheckoutError('Managed checkout has unrelated or changed refs; preserved')
    # Use NUL paths, never parse quoted status names or delete ignored directories.
    allowed_ignored = allowed_ignored or {}
    dirty = git(path, 'status', '--porcelain=v1', '--untracked-files=no')
    others = subprocess.run(['git', '-C', str(path), 'ls-files', '--others', '-z'], capture_output=True, check=True).stdout
    if dirty:
        raise ManagedCheckoutError('Managed checkout has local content including ignored files; preserved')
    for raw in others.split(b'\0'):
        if not raw:
            continue
        name = raw.decode('utf-8', errors='surrogateescape')
        entry = Path(path) / name
        if name not in allowed_ignored or entry.is_symlink() or not entry.is_file() or entry.read_bytes() != allowed_ignored[name]:
            raise ManagedCheckoutError('Managed checkout has local content including ignored files; preserved')
    if any(line[:1] == 'S' or line[:1].islower() for line in git(path, 'ls-files', '-v').splitlines()):
        raise ManagedCheckoutError('Managed checkout index flags hide local content; preserved')
    shutil.rmtree(path)
