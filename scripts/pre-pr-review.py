#!/usr/bin/env python3
"""Local, recoverable pre-PR review lifecycle. No network or destructive recovery.

The JSON evidence contract is implemented by required_checks() and verification().
Every mutation takes the common-directory lock; a stranded lock needs human
inspection. Git refs and evidence survive successful workspace cleanup.
"""
import argparse
import contextlib
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone

DEFAULT_BACKEND = 'independent-v1'
SCHEMA = 1
CONTAINER_RECORD_SCHEMA = 2
PATH_FIELDS = frozenset(('repository', 'original_checkout', 'artifact_dir', 'path',
                         'metadata_dir', 'source', 'verification_path', 'index', 'prepared_index'))
CHANNELS = ('phone', 'tools', 'wiring', 'tracking', 'browser')
IDENT = re.compile(r'[a-z0-9][a-z0-9-]{0,95}')
FLOW = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
TERMINAL = ('completed', 'superseded')
GIT_OPERATION_MARKERS = ('MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE', 'MERGE_AUTOSTASH',
                         'SQUASH_MSG', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD',
                         'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG', 'BISECT_START')


class Refusal(RuntimeError):
    pass


_helper_spec = importlib.util.spec_from_file_location('managed_checkout', Path(__file__).with_name('managed-checkout.py'))
managed = importlib.util.module_from_spec(_helper_spec)
_previous_bytecode = sys.dont_write_bytecode
try:
    sys.dont_write_bytecode = True
    _helper_spec.loader.exec_module(managed)
finally:
    sys.dont_write_bytecode = _previous_bytecode


def independent(record):
    return record.get('workspace_backend') == 'independent-v1'


def owner(record, role):
    return {'kind': 'pre-pr-review', 'id': record['id'], 'role': role,
            'token': record['workspace_token']}


def managed_call(function, *args):
    try:
        return function(*args)
    except managed.ManagedCheckoutError as error:
        raise Refusal(str(error)) from error


def run(root, *args, env=None, input=None, check=True):
    environment = dict(os.environ if env is None else env)
    environment['GIT_OPTIONAL_LOCKS'] = '0'
    result = subprocess.run(['git', '--literal-pathspecs', '-C', str(root), *args],
                            capture_output=True, input=input, env=environment)
    if check and result.returncode:
        raise Refusal(result.stderr.decode(errors='replace').strip() or
                      result.stdout.decode(errors='replace').strip() or 'Git command failed')
    return result


def git(root, *args, **kwargs):
    return run(root, *args, **kwargs).stdout.decode('utf-8', errors='surrogateescape').strip()


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('w', encoding='utf-8') as stream:
            json.dump(value, stream, indent=2, ensure_ascii=True)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def canonical_owned_path(path, directory=False):
    if path.is_symlink() or path.resolve() != path:
        raise Refusal('Managed artifact path is a symlink or alias; unknown target preserved: ' + str(path))
    if os.path.lexists(path) and not (path.is_dir() if directory else path.is_file()):
        raise Refusal('Managed artifact path has an unexpected filesystem type; preserved: ' + str(path))


class Store:
    def __init__(self):
        self.root = Path(git(Path.cwd(), 'rev-parse', '--show-toplevel')).resolve()
        self.common = Path(git(self.root, 'rev-parse', '--path-format=absolute', '--git-common-dir')).resolve()
        self.directory = self.common / 'pre-pr-review'
        self.repo = str(self.common)
        canonical_owned_path(self.directory, directory=True)
        self.host_root = os.environ.get('MB_HOST_ROOT')
        self.mount_parent = Path(os.environ.get('MB_CONTAINER_PARENT', '/workspace'))
        if self.host_root:
            host = PureWindowsPath(self.host_root) if PureWindowsPath(self.host_root).is_absolute() else PurePosixPath(self.host_root)
            if not host.is_absolute() or self.mount_parent.resolve() != self.mount_parent:
                raise Refusal('Invalid host/container mount mapping')
            if self.root.parent != self.mount_parent or host.name != self.root.name:
                raise Refusal('Host/container checkout mapping does not match the mounted repository')
            try:
                self.common.relative_to(self.mount_parent)
            except ValueError:
                raise Refusal('Git common directory is outside the declared lifecycle mount')
            self.host_root = host

    def relative_path(self, value):
        path = Path(value)
        if not path.is_absolute() or path.resolve() != path:
            raise Refusal('Container record contains a noncanonical owned path: ' + str(value))
        try:
            return path.relative_to(self.mount_parent).as_posix()
        except ValueError:
            raise Refusal('Container record path escapes the declared lifecycle mount')

    def resolve_path(self, value):
        if not isinstance(value, dict) or set(value) != {'mount_path'}:
            raise Refusal('Container record requires explicit relative path identities')
        relative = value['mount_path']
        if not isinstance(relative, str) or not relative or any(part in ('', '.', '..') for part in relative.split('/')) or '\\' in relative or PurePosixPath(relative).is_absolute():
            raise Refusal('Invalid relative lifecycle path; record retained')
        path = self.mount_parent / relative
        self.relative_path(str(path))
        return str(path)

    def paths(self, value, encode=False, key=None):
        # Only typed path fields are translated. Commands, descriptions and SHA
        # values must retain their exact bytes for ownership/evidence checks.
        if key in PATH_FIELDS and value is not None:
            return {'mount_path': self.relative_path(value)} if encode else self.resolve_path(value)
        if key == 'reports' and isinstance(value, dict):
            if encode:
                return [{'path': {'mount_path': self.relative_path(path)}, 'sha256': digest}
                        for path, digest in value.items()]
        if key == 'reports' and isinstance(value, list) and not encode:
            result = {}
            for report in value:
                path = self.resolve_path(report['path'])
                if path in result:
                    raise Refusal('Duplicate evidence path identity')
                result[path] = report['sha256']
            return result
        if isinstance(value, dict):
            return {name: self.paths(item, encode, name) for name, item in value.items()}
        if isinstance(value, list):
            return [self.paths(item, encode) for item in value]
        return value

    def read_record(self, path):
        record = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(record, dict):
            raise Refusal('Review record must be a JSON object')
        if record.get('schema_version') == CONTAINER_RECORD_SCHEMA:
            if not self.host_root:
                raise Refusal('Container-managed review: use the checks review launcher; native mutation is disabled')
            record = self.paths(record)
            record['schema_version'] = SCHEMA
        elif self.host_root:
            raise Refusal('Legacy absolute-path review retained: finish and clean it in its original environment, then run checks review migrate ID for inspected conversion')
        return record

    def host_path(self, path):
        if not self.host_root:
            return path
        return self.host_root.parent.joinpath(*Path(self.relative_path(str(path))).parts)

    def execution_path(self, value):
        """Translate agent-supplied host paths; relative CLI paths keep their meaning."""
        if not self.host_root:
            return Path(value)
        path = Path(value)
        if path.is_absolute() and path.is_relative_to(self.mount_parent):
            self.relative_path(str(path))
            return path
        host = type(self.host_root)(str(value))
        if not host.is_absolute():
            return path
        if '..' in host.parts:
            raise Refusal('Host path contains traversal')
        try:
            relative = host.relative_to(self.host_root.parent)
        except ValueError:
            raise Refusal('Host path is outside declared lifecycle mounts')
        if not relative.parts or relative.parts[0] not in (self.host_root.name, self.host_root.name + '-reviews'):
            raise Refusal('Host path is outside declared lifecycle mounts')
        result = self.mount_parent.joinpath(*relative.parts)
        self.relative_path(str(result))
        return result

    def present(self, value):
        """Expose host locations to agents without persisting machine-specific paths."""
        if not self.host_root:
            return value
        if isinstance(value, list):
            return [self.present(item) for item in value]
        if not isinstance(value, dict):
            return value
        result = {key: self.present(item) for key, item in value.items()}
        for key in ('original_checkout', 'artifact_dir', 'path'):
            path = value.get(key)
            if isinstance(path, str) and Path(path).is_absolute() and Path(path).is_relative_to(self.mount_parent):
                result['host_' + key] = str(self.host_path(Path(path)))
        return result

    def artifact_path(self, ident):
        if not isinstance(ident, str) or not IDENT.fullmatch(ident):
            raise Refusal('Invalid explicit review ID')
        canonical_owned_path(self.directory, directory=True)
        directory = self.directory / ident
        canonical_owned_path(directory, directory=True)
        canonical_owned_path(directory / 'record.json')
        return directory

    @contextlib.contextmanager
    def lock(self, native_record=None):
        canonical_owned_path(self.directory, directory=True)
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / 'operation.lock'
        canonical_owned_path(self.directory, directory=True)
        canonical_owned_path(path)
        # A permanent advisory-lock inode survives interruption without leaving a
        # fictitious live owner. Never unlink it: that would split ownership.
        descriptor = os.open(path, os.O_RDWR | os.O_CREAT | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        stream = os.fdopen(descriptor, 'r+b')
        if os.fstat(stream.fileno()).st_nlink != 1:
            stream.close()
            raise Refusal('Operation lock has multiple filesystem owners; preserved without writing')
        locked = False
        try:
            try:
                if os.name == 'nt':
                    import msvcrt
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                locked = True
            except (OSError, BlockingIOError):
                raise Refusal('Another operation owns the review lock; wait and inspect: ' + str(path))
            stream.seek(0)
            raw = stream.read()
            if raw:
                try:
                    previous = json.loads(raw)
                except ValueError:
                    raise Refusal('Unrecognized operation lock; inspect it without deleting: ' + str(path))
                if not isinstance(previous, dict) or previous.get('kind') != 'pre-pr-review-advisory-v1':
                    raise Refusal('Legacy/uncertain operation lock; inspect it without deleting: ' + str(path))
            if not self.host_root:
                native_target = self.read_record(self.artifact_path(native_record) / 'record.json') if native_record else None
                for child in self.directory.iterdir():
                    if child.is_symlink() or not child.is_dir():
                        continue
                    record_path = child / 'record.json'
                    canonical_owned_path(record_path)
                    if record_path.is_file():
                        try:
                            saved = json.loads(record_path.read_text(encoding='utf-8'))
                        except (ValueError, OSError):
                            continue  # Existing record validation reports malformed evidence.
                        if isinstance(saved, dict) and saved.get('schema_version') == CONTAINER_RECORD_SCHEMA and not (native_target and native_target.get('schema_version') == SCHEMA):
                            raise Refusal('Container-managed lifecycle: use the checks review launcher for mutations')
            stream.seek(0)
            stream.truncate()
            stream.write(json.dumps({'kind': 'pre-pr-review-advisory-v1', 'pid': os.getpid(),
                                     'host': socket.gethostname(), 'acquired_at': now()}).encode())
            stream.flush()
            os.fsync(stream.fileno())
            yield
        finally:
            if locked:
                if os.name == 'nt':
                    import msvcrt
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
            stream.close()

    def save(self, record):
        directory = self.artifact_path(record['id'])
        record['updated_at'] = now()
        saved = self.paths(record, encode=True) if self.host_root else record
        if self.host_root:
            saved['schema_version'] = CONTAINER_RECORD_SCHEMA
        atomic(directory / 'record.json', saved)

    def discovery(self):
        records, errors = [], []
        canonical_owned_path(self.directory, directory=True)
        if not self.directory.exists():
            return records, errors
        for directory in sorted(self.directory.iterdir()):
            if directory.is_symlink():
                errors.append({'path': str(directory), 'error': 'Managed artifact directory is a symlink; target preserved'})
                continue
            if not directory.is_dir():
                continue
            path = directory / 'record.json'
            try:
                self.artifact_path(directory.name)
            except (Refusal, OSError, ValueError) as error:
                errors.append({'path': str(path), 'error': str(error)})
                continue
            if not path.exists():
                errors.append({'path': str(path), 'error': 'Missing record; evidence retained'})
                continue
            try:
                record = self.read_record(path)
                if not isinstance(record, dict) or record.get('schema_version') != SCHEMA or record.get('managed_by') != 'pre-pr-review.py':
                    errors.append({'path': str(path), 'error': 'Legacy/unrecognized record; not modified or adopted'})
                    continue
                self.validate_record(record, directory)
                if record['original_checkout'] == str(self.root):
                    records.append(record)
            except (OSError, ValueError, KeyError, TypeError, AttributeError, Refusal) as error:
                errors.append({'path': str(path), 'error': str(error)})
        return records, errors

    def validate_record(self, record, directory=None):
        if not isinstance(record, dict):
            raise Refusal('Review record must be a JSON object')
        if record.get('workspace_backend') not in (None, 'legacy-worktree', 'independent-v1'):
            raise Refusal('Unknown workspace backend; retained')
        if independent(record) and not re.fullmatch(r'[0-9a-f]{32}', record.get('workspace_token', '')):
            raise Refusal('Missing independent workspace ownership token')
        if record.get('phase') not in ('creating', 'ready', 'adopting', 'completed', 'superseded'):
            raise Refusal('Missing or invalid lifecycle phase; record retained')
        if not isinstance(record.get('description'), str) or not record['description'].strip():
            raise Refusal('Missing task description; record retained')
        if not isinstance(record.get('scopes'), list) or scopes_valid(record['scopes']) != record['scopes']:
            raise Refusal('Missing or invalid task scopes; record retained')
        if not isinstance(record.get('workers'), dict) or not isinstance(record.get('cleanup'), dict):
            raise Refusal('Missing worker/cleanup ownership inventory; record retained')
        for worker_id, worker in record['workers'].items():
            if (not isinstance(worker_id, str) or not worker_id.strip() or not isinstance(worker, dict)
                    or worker.get('role') not in ('reviewer', 'verifier', 'fixer')
                    or worker.get('state') not in ('active', 'stopped')):
                raise Refusal('Malformed worker ownership; record retained')
        if not isinstance(record.get('workspaces'), dict) or any(not isinstance(record['workspaces'].get(role), dict) for role in ('baseline', 'review')):
            raise Refusal('Missing managed workspace ownership; record retained')
        if not isinstance(record.get('selected_files'), list) or any(not isinstance(name, str) for name in record['selected_files']):
            raise Refusal('Missing exact checkpoint file selection; record retained')
        for field in ('predecessor', 'successor'):
            if record.get(field) is not None and (not isinstance(record[field], str) or not IDENT.fullmatch(record[field])):
                raise Refusal('Invalid lifecycle link; record retained: ' + field)
        ident = record.get('id', '')
        self.artifact_path(ident)
        if not isinstance(ident, str) or not IDENT.fullmatch(ident):
            raise Refusal('Invalid review ID')
        if directory and directory.name != ident:
            raise Refusal('Record ID does not match artifact directory')
        if record.get('repository') != self.repo:
            raise Refusal('Repository identity mismatch')
        original = Path(record['original_checkout'])
        if not original.is_absolute() or original.resolve() != original:
            raise Refusal('Invalid original checkout identity')
        parent = original.parent / (original.name + '-reviews') / ident
        expected = {'baseline': parent / 'finished', 'review': parent / 'reviewed'}
        for role, path in expected.items():
            if record['workspaces'][role]['path'] != str(path) or path.resolve() != path:
                raise Refusal('Managed workspace path/ownership mismatch: ' + role)
        if record.get('artifact_dir') != str(self.directory / ident):
            raise Refusal('Artifact directory identity mismatch')
        if record.get('checkpoint_ref') != 'refs/heads/checkpoint/pre-pr-' + ident or record.get('review_ref') != 'refs/heads/review/pre-pr-' + ident:
            raise Refusal('Retained ref ownership mismatch')
        if not editable_task_branch(record.get('original_branch')):
            raise Refusal('Missing or protected original task branch identity')
        for key in ('finished', 'main_tip', 'comparison_base'):
            if not re.fullmatch(r'[0-9a-f]{40,64}', record.get(key, '')):
                raise Refusal('Missing frozen SHA: ' + key)
        if record.get('required_checks') != required_checks(record['scopes']):
            raise Refusal('Required check contract changed or record was weakened')

    def get(self, ident):
        if not IDENT.fullmatch(ident):
            raise Refusal('Invalid explicit review ID')
        path = self.artifact_path(ident) / 'record.json'
        try:
            record = self.read_record(path)
        except (OSError, ValueError) as error:
            raise Refusal('Cannot read review record: ' + str(error))
        if record.get('schema_version') != SCHEMA or record.get('managed_by') != 'pre-pr-review.py':
            raise Refusal('Legacy record requires an explicit inspected migration; ownership/verification is not assumed')
        self.validate_record(record, path.parent)
        if record['original_checkout'] != str(self.root):
            raise Refusal('Run from the recorded original checkout: ' + record['original_checkout'])
        return record


def editable_task_branch(ref):
    if not isinstance(ref, str) or not ref.startswith('refs/heads/'):
        return False
    name = ref.removeprefix('refs/heads/')
    return name not in ('main', 'demo', 'PM', 'HoffDemo') and not name.startswith(('PM/', 'HoffDemo/', 'checkpoint/', 'review/'))


def scopes_valid(scopes):
    scopes = sorted(set(scopes))
    if not scopes:
        raise Refusal('Name the task scope with --scope')
    for scope in scopes:
        if scope in ('app', 'tooling', 'docs'):
            continue
        if not scope.startswith('flow:') or not FLOW.fullmatch(scope[5:]) or len(scope[5:]) > 64:
            raise Refusal('Invalid scope: ' + scope)
    return scopes


def validate_scope(scopes, names):
    code = [name for name in names if not name.endswith('.md')]
    if scopes == ['docs'] and code:
        raise Refusal('Docs-only scope omits implementation/verification changes: ' + ', '.join(code))
    flows = {name.split('/')[1] for name in code if name.startswith('flows/') and len(name.split('/')) > 2}
    missing = flows - {scope[5:] for scope in scopes if scope.startswith('flow:')}
    if missing:
        raise Refusal('Task scope omitted affected Flows: ' + ', '.join(sorted(missing)))
    if any(name.startswith('app/') for name in code) and 'app' not in scopes:
        raise Refusal('Task scope must include app for changed app implementation')


def required_checks(scopes):
    checks = []
    def add(ident, stage, command, comparison=None):
        item = {'id': ident, 'stage': stage, 'command_contains': command}
        if comparison:
            item['comparison'] = comparison
        checks.append(item)
    for stage in ('baseline', 'final'):
        add('check-all', stage, 'bash scripts/check-all.sh')
    add('markdown-links', 'final', 'scripts/check-markdown-links.py')
    if scopes != ['docs']:
        for kind, command in (('journeys', 'tests/app-journeys.cjs'), ('browser', 'tests/browser/app-journeys-browser.cjs')):
            add(kind, 'baseline', command)
            add(kind + '-checkpoint', 'final', command, 'checkpoint')
            add(kind + '-main', 'final', command, 'main')
    for scope in scopes:
        if not scope.startswith('flow:'):
            continue
        ident = scope[5:]
        for stage in ('baseline', 'final'):
            add('flow-' + ident + '-check', stage, 'scripts/flows.py check --id ' + ident)
            add('flow-' + ident + '-scope', stage, 'scripts/flows.py scope')
            add('flow-' + ident + '-runtime', stage, 'runtime')
            add('flow-' + ident + '-browser', stage, 'browser')
    return checks


def registrations(root):
    output = run(root, 'worktree', 'list', '--porcelain', '-z').stdout.decode('utf-8', errors='surrogateescape')
    entries = {}
    for block in output.split('\0\0'):
        fields = {}
        for line in block.split('\0'):
            key, _, value = line.partition(' ')
            if key:
                fields[key] = value
        if 'worktree' in fields:
            entries[str(Path(fields['worktree']).resolve())] = fields
    return entries


def sha(root, ref):
    return git(root, 'rev-parse', '--verify', ref + '^{commit}')


def branch(root):
    return git(root, 'symbolic-ref', '-q', 'HEAD')


def clean(root, ignored=False):
    # Status and worktree removal trust these index flags and can hide local
    # edits. Refuse uncertain cleanliness without changing the caller's index.
    entries = run(root, 'ls-files', '-v', '-z').stdout.split(b'\0')
    if any(entry and (entry[:1].islower() or entry[:1] == b'S') for entry in entries):
        return False
    args = ['status', '--porcelain=v1', '-z', '--untracked-files=all']
    if ignored:
        args.append('--ignored=matching')
    return not run(root, *args).stdout


def legacy_mutation_guard(store, record):
    if store.host_root and not independent(record) and any(os.path.lexists(w['path']) for w in record['workspaces'].values()):
        raise Refusal('Legacy linked review workspaces require cleanup in their original environment; no automatic independent migration')


def no_writers(record):
    active = [key for key, worker in record['workers'].items() if worker.get('state') != 'stopped']
    if active:
        raise Refusal('Workers still active or pending: ' + ', '.join(active))


def refs_valid(store, record):
    for key in ('finished', 'main_tip', 'comparison_base'):
        if sha(store.root, record[key]) != record[key]:
            raise Refusal('Frozen object unavailable: ' + key)
    if sha(store.root, record['checkpoint_ref']) != record['finished']:
        raise Refusal('Checkpoint ref moved; preserve and inspect')
    reviewed = sha(store.root, record['review_ref'])
    if independent(record) and reviewed != record.get('retained_review', record['finished']):
        intent = record.get('review_import') or {}
        if (intent.get('from') != record.get('retained_review', record['finished'])
                or intent.get('to') != reviewed):
            raise Refusal('Retained review ref changed outside the lifecycle; preserved')
    history_root = store.root
    if independent(record) and record['phase'] not in TERMINAL:
        path = Path(record['workspaces']['review']['path'])
        if path.exists():
            reviewed = workspace_valid(store, record, 'review', require_clean=False)
            history_root = path
    if run(history_root, 'merge-base', '--is-ancestor', record['finished'], reviewed, check=False).returncode:
        raise Refusal('Review no longer descends from the finished checkpoint')
    return reviewed


def workspace_valid(store, record, role, expected=None, require_clean=True, ignored=False):
    workspace = record['workspaces'][role]
    path = Path(workspace['path'])
    if independent(record):
        current = managed_call(managed.validate, path, owner(record, role), record['review_ref'] if role == 'review' else None)
        if expected and current != expected:
            raise Refusal('Managed workspace HEAD mismatch: ' + str(path))
        if require_clean:
            no_git_operation(path)
            if not clean(path, ignored):
                raise Refusal('Managed workspace has local content including ignored files: ' + str(path))
        return current
    registration = registrations(store.root).get(str(path))
    if not path.is_dir() or not registration:
        raise Refusal('Managed workspace absent or unregistered: ' + str(path))
    expected_branch = record['review_ref'] if role == 'review' else None
    if registration.get('branch') != expected_branch or (role == 'baseline' and 'detached' not in registration):
        raise Refusal('Managed workspace branch/registration mismatch: ' + str(path))
    if 'locked' in registration or 'prunable' in registration:
        raise Refusal('Managed workspace registration is locked or uncertain: ' + str(path))
    if Path(git(path, 'rev-parse', '--path-format=absolute', '--git-common-dir')).resolve() != store.common:
        raise Refusal('Workspace belongs to another repository')
    current = sha(path, 'HEAD')
    if registration.get('HEAD') != current or (expected and current != expected):
        raise Refusal('Managed workspace HEAD mismatch: ' + str(path))
    if require_clean:
        no_git_operation(path)
    if require_clean and not clean(path, ignored):
        raise Refusal('Managed workspace has local content' + (' including ignored files' if ignored else '') + ': ' + str(path))
    return current


def no_admin_operation(metadata):
    for name in GIT_OPERATION_MARKERS:
        if os.path.lexists(metadata / name):
            raise Refusal('Finish the in-progress Git operation before review/adoption/cleanup; metadata retained: ' + name)


def no_git_operation(root):
    no_admin_operation(Path(git(root, 'rev-parse', '--absolute-git-dir')))


def planned_files(root, files):
    selected = []
    for name in files:
        if '..' in Path(name).parts:
            raise Refusal('Select exact paths without parent aliases: ' + name)
        path = Path(name)
        if not path.is_absolute():
            path = root / path
        path = Path(os.path.abspath(path))
        try:
            relative = path.relative_to(root).as_posix()
        except ValueError:
            raise Refusal('Selected path is outside original checkout: ' + name)
        if relative in ('.', 'branching.md') or any(part in ('.git', '.worktrees') for part in Path(relative).parts):
            raise Refusal('Selected path is not an exact source file: ' + name)
        if path.parent.resolve() != path.parent or (path.is_dir() and not path.is_symlink()):
            raise Refusal('Select exact files without symlink parents: ' + name)
        tracked = bool(run(root, 'ls-files', '-z', '--', relative).stdout)
        if not os.path.lexists(path) and not tracked:
            raise Refusal('Selected file does not exist and is not tracked: ' + name)
        selected.append(relative)
    return sorted(set(selected))


@contextlib.contextmanager
def checkpoint_tree(store, selected):
    with tempfile.TemporaryDirectory(prefix='pre-pr-index-', dir=store.common) as temp:
        index = Path(temp) / 'checkpoint-index'
        env = dict(os.environ, GIT_INDEX_FILE=str(index))
        git(store.root, 'read-tree', 'HEAD', env=env)
        if selected:
            git(store.root, 'add', '-A', '--', *selected, env=env)
        tree = git(store.root, 'write-tree', env=env)
        yield tree, Path(temp)


def index_digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def checkpoint(store, record, tree, temp):
    current = sha(store.root, 'HEAD')
    if branch(store.root) != record['original_branch'] or current != record['finished']:
        raise Refusal('Original branch/HEAD changed during checkpoint preflight; no checkpoint applied')
    record['checkpoint_plan'] = {'before': current, 'tree': tree}
    if git(store.root, 'rev-parse', 'HEAD^{tree}') == tree:
        record['finished'] = current
        record['checkpoint_intent'] = None
        store.save(record)
        return current
    new = git(store.root, 'commit-tree', tree, '-p', current,
              input=b'Checkpoint finished task\n')
    index = Path(git(store.root, 'rev-parse', '--path-format=absolute', '--git-path', 'index'))
    prepared = Path(record['artifact_dir']) / 'checkpoint-index.prepared'
    before_index = index.read_bytes() if index.exists() else None
    before_digest = hashlib.sha256(before_index).hexdigest() if before_index is not None else None
    if before_index is not None:
        prepared.write_bytes(before_index)
    env = dict(os.environ, GIT_INDEX_FILE=str(prepared))
    if not prepared.exists():
        git(store.root, 'read-tree', current, env=env)
    git(store.root, 'reset', '-q', new, '--', *record['selected_files'], env=env)
    record['checkpoint_intent'] = {'before': current, 'after': new, 'tree': tree,
                                   'index': str(index), 'prepared_index': str(prepared),
                                   'before_index_sha256': before_digest,
                                   'prepared_index_sha256': index_digest(prepared),
                                   'lock_token': uuid.uuid4().hex}
    record['finished'] = new
    store.save(record)
    finish_checkpoint(store, record)
    return new


def finish_checkpoint(store, record):
    intent = record['checkpoint_intent']
    index = Path(git(store.root, 'rev-parse', '--path-format=absolute', '--git-path', 'index'))
    prepared = Path(record['artifact_dir']) / 'checkpoint-index.prepared'
    if str(index) != intent.get('index') or str(prepared) != intent.get('prepared_index'):
        raise Refusal('Interrupted checkpoint index ownership changed')
    lock = index.with_name(index.name + '.lock')
    owned_lock = False
    try:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, 'w') as stream:
                json.dump({'pre_pr_review': record['id'], 'token': intent['lock_token']}, stream)
                stream.flush()
                os.fsync(stream.fileno())
            owned_lock = True
        except FileExistsError:
            try:
                owner = json.loads(lock.read_text())
            except (OSError, ValueError):
                raise Refusal('Git index lock has uncertain ownership; inspect without deleting')
            if owner != {'pre_pr_review': record['id'], 'token': intent['lock_token']}:
                raise Refusal('Git index lock belongs to another operation; inspect without deleting')
            owned_lock = True
        current = sha(store.root, 'HEAD')
        if branch(store.root) != record['original_branch'] or current not in (intent['before'], intent['after']):
            raise Refusal('Original checkout advanced during checkpoint; preserve and inspect')
        digest = index_digest(index)
        if digest not in (intent['before_index_sha256'], intent['prepared_index_sha256']):
            raise Refusal('Original index changed during interrupted checkpoint; no unrelated entries overwritten')
        if index_digest(prepared) != intent['prepared_index_sha256']:
            raise Refusal('Prepared checkpoint index is missing/changed; no guessed recovery')
        if current == intent['before']:
            git(store.root, 'update-ref', record['original_branch'], intent['after'], intent['before'])
        if digest != intent['prepared_index_sha256']:
            # Keep the durable prepared copy for interruption recovery/evidence.
            temporary = index.with_name(index.name + '.pre-pr-' + intent['lock_token'])
            shutil.copyfile(prepared, temporary)
            os.replace(temporary, index)
        owner = json.loads(lock.read_text())
        if owner != {'pre_pr_review': record['id'], 'token': intent['lock_token']}:
            raise Refusal('Checkpoint index lock ownership changed; intent retained')
        lock.unlink()
        owned_lock = False
        record['finished'] = intent['after']
        record['checkpoint_intent'] = None
        store.save(record)
    finally:
        if owned_lock:
            try:
                owner = json.loads(lock.read_text())
                if owner == {'pre_pr_review': record['id'], 'token': intent['lock_token']}:
                    lock.unlink()
            except (OSError, ValueError):
                pass


def missing_workspace_metadata(store, record, role, expected, registration):
    workspace = record['workspaces'][role]
    path = Path(workspace['path'])
    if os.path.lexists(path) or path.resolve() != path:
        raise Refusal('Absent-workspace recovery requires an absent exact canonical path')
    wanted_branch = record['review_ref'] if role == 'review' else None
    if (not registration or registration.get('branch') != wanted_branch
            or (role == 'baseline' and 'detached' not in registration)
            or registration.get('HEAD') != expected or 'locked' in registration):
        raise Refusal('Absent workspace registration HEAD/branch/lock ownership is uncertain; retained')
    directory = store.common / 'worktrees'
    candidates = []
    if directory.is_dir() and not directory.is_symlink():
        for metadata in directory.iterdir():
            pointer = metadata / 'gitdir'
            if not metadata.is_dir() or metadata.is_symlink() or not pointer.is_file() or pointer.is_symlink():
                continue
            try:
                value = pointer.read_text(encoding='utf-8').strip()
                if (metadata / value).resolve() == path / '.git':
                    candidates.append(metadata)
            except OSError:
                continue
    if len(candidates) != 1:
        raise Refusal('Missing or ambiguous registered Git metadata; staged evidence retained')
    metadata = candidates[0]
    if workspace.get('metadata_dir') and workspace['metadata_dir'] != str(metadata):
        raise Refusal('Registered workspace metadata identity changed; retained')
    common_pointer = metadata / 'commondir'
    index = metadata / 'index'
    if (not common_pointer.is_file() or common_pointer.is_symlink()
            or (metadata / common_pointer.read_text(encoding='utf-8').strip()).resolve() != store.common):
        raise Refusal('Registered workspace common repository is uncertain; retained')
    if (not index.is_file() or index.is_symlink() or any(os.path.lexists(metadata / name) for name in ('locked', 'index.lock', 'HEAD.lock'))):
        raise Refusal('Registered workspace index is missing, symlinked or locked; staged evidence retained')
    no_admin_operation(metadata)
    environment = dict(os.environ, GIT_INDEX_FILE=str(index))
    prefix = ('--git-dir=' + str(metadata), '--work-tree=' + str(path))
    if git(store.root, *prefix, 'rev-parse', '--verify', 'HEAD^{commit}', env=environment) != expected:
        raise Refusal('Registered workspace metadata HEAD changed; retained')
    symbolic = run(store.root, *prefix, 'symbolic-ref', '-q', 'HEAD', env=environment, check=False)
    if (role == 'review' and (symbolic.returncode != 0 or symbolic.stdout.decode().strip() != wanted_branch)) or (role == 'baseline' and symbolic.returncode != 1):
        raise Refusal('Registered workspace metadata branch/detached identity changed; retained')
    if run(store.root, *prefix, 'ls-files', '--unmerged', '-z', env=environment).stdout:
        raise Refusal('Registered workspace has unmerged staged entries; evidence retained')
    cached = run(store.root, *prefix, 'diff', '--cached', '--quiet', '--ita-visible-in-index', expected, '--', env=environment, check=False)
    if cached.returncode != 0:
        raise Refusal('Registered workspace index has staged/intent-to-add data or is unreadable; evidence retained')
    return metadata, index_digest(index)


def reconcile_absent_workspace(store, record, role, expected, registration):
    metadata, digest = missing_workspace_metadata(store, record, role, expected, registration)
    workspace = record['workspaces'][role]
    workspace['recovery'] = {'status': 'unregister-intent', 'metadata_dir': str(metadata),
                             'index_sha256': digest, 'head': expected, 'at': now(),
                             'limitation': 'Only committed workspace state can be recreated; no recovery of removed uncommitted files is claimed'}
    store.save(record)
    # Repeat metadata/index gates immediately before exact non-forced Git removal.
    repeated, repeated_digest = missing_workspace_metadata(store, record, role, expected, registrations(store.root).get(workspace['path']))
    if repeated != metadata or repeated_digest != digest:
        raise Refusal('Absent workspace metadata changed before removal; retained')
    git(store.root, 'worktree', 'remove', workspace['path'])
    workspace['recovery']['status'] = 'registration-removed'
    store.save(record)


def create_workspaces(store, record):
    if store.host_root and not independent(record):
        raise Refusal('Legacy linked review creation requires its original environment; no automatic migration')
    reviewed = refs_valid(store, record)
    for role, expected in (('baseline', record['finished']), ('review', reviewed)):
        workspace = record['workspaces'][role]
        path = Path(workspace['path'])
        registration = registrations(store.root).get(str(path))
        if not os.path.lexists(path) and registration:
            reconcile_absent_workspace(store, record, role, expected, registration)
            registration = None
        if os.path.lexists(path) or registration:
            workspace_valid(store, record, role, expected)
            workspace['created'] = True
            store.save(record)
            continue
        if record['phase'] in TERMINAL or workspace.get('removed'):
            continue
        no_writers(record)
        # Exact paths were durably recorded before even creating the parent.
        path.parent.mkdir(parents=True, exist_ok=True)
        if independent(record):
            if workspace.get('created'):
                raise Refusal('Independent workspace disappeared; committed or uncommitted work may be lost; retained record requires inspection')
            managed_call(managed.create, store.root, path,
                         ['refs/heads/main', record['checkpoint_ref'], record['review_ref']], expected,
                         record['review_ref'] if role == 'review' else None, owner(record, role))
        elif role == 'baseline':
            git(store.root, 'worktree', 'add', '--detach', str(path), expected)
        else:
            git(store.root, 'worktree', 'add', str(path), record['review_ref'].removeprefix('refs/heads/'))
        workspace['created'] = True
        workspace['metadata_dir'] = str(Path(git(path, 'rev-parse', '--absolute-git-dir')).resolve())
        if workspace.get('recovery'):
            workspace['recovery']['status'] = 'committed-workspace-recreated'
        store.save(record)
    record['phase'] = 'ready'
    store.save(record)


def allocate_identity(store):
    review_root = store.root.parent / (store.root.name + '-reviews')
    if review_root.resolve() != review_root or (review_root.exists() and not review_root.is_dir()):
        raise Refusal('Managed review parent is a symlink, alias or non-directory; preserve and inspect')
    branches = git(store.root, 'for-each-ref', '--format=%(refname)', 'refs/heads').splitlines()
    for namespace in ('refs/heads/checkpoint', 'refs/heads/review'):
        if any(namespace.casefold() == existing.casefold() or namespace.casefold().startswith(existing.casefold() + '/') for existing in branches):
            raise Refusal('Managed branch namespace is occupied; existing refs preserved: ' + namespace)
    registered = registrations(store.root)
    for _ in range(32):
        ident = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-') + uuid.uuid4().hex[:8]
        parent = review_root / ident
        paths = (parent, parent / 'finished', parent / 'reviewed')
        if any(os.path.lexists(path) or str(path) in registered for path in paths):
            continue
        refs = ('refs/heads/checkpoint/pre-pr-' + ident, 'refs/heads/review/pre-pr-' + ident)
        if any(ref.casefold() == existing.casefold() or ref.casefold().startswith(existing.casefold() + '/') or existing.casefold().startswith(ref.casefold() + '/') for ref in refs for existing in branches):
            continue
        artifact = store.directory / ident
        try:
            artifact.mkdir(exist_ok=False)
        except FileExistsError:
            continue
        return ident, parent
    raise Refusal('Could not allocate an unused review identity; no existing record, ref or workspace was adopted')


def start(store, args):
    if os.path.lexists(store.common / 'moneybuddy-managed.json'):
        raise Refusal('Start reviews from the original checkout, not a managed review repository')
    no_git_operation(store.root)
    if not args.description.strip():
        raise Refusal('Description must identify the finished task')
    scopes = scopes_valid(args.scope)
    original_branch = branch(store.root)
    if not editable_task_branch(original_branch):
        raise Refusal('Review requires an editable task branch; protected and internal branches are preserved')
    if run(store.root, 'ls-files', '-u').stdout:
        raise Refusal('Resolve index conflicts before selecting checkpoint files')
    selected = planned_files(store.root, args.file)
    current = sha(store.root, 'HEAD')
    main_tip = sha(store.root, 'refs/heads/main')
    bases = git(store.root, 'merge-base', '--all', main_tip, current).splitlines()
    if len(bases) != 1:
        raise Refusal('A unique local-main merge base is required; no fetch is attempted')
    records, errors = store.discovery()
    if store.host_root:
        # Unrelated legacy records remain visible in status without blocking a
        # new task. Never create a duplicate of an unfinished legacy task.
        for error in errors:
            path = error.get('path')
            if not path:
                continue
            try:
                canonical_owned_path(Path(path))
                legacy = json.loads(Path(path).read_text(encoding='utf-8'))
            except (OSError, ValueError, Refusal):
                continue
            if isinstance(legacy, dict) and legacy.get('original_branch') == original_branch and legacy.get('phase') not in TERMINAL:
                raise Refusal('Unfinished legacy review for this task must be finished and cleaned in its original environment before migration: ' + str(legacy.get('id')))
    candidates = [r for r in records if r['original_branch'] == original_branch and r['phase'] != 'superseded']
    live = [r for r in candidates if r['phase'] != 'completed']
    if len(live) > 1:
        raise Refusal('Ambiguous reviews; use explicit resume ID: ' + json.dumps([{'id': r['id'], 'description': r['description']} for r in live]))
    with checkpoint_tree(store, selected) as (tree, temp):
        task_paths = [name for name in run(store.root, 'diff', '--name-only', '--no-renames', '-z', bases[0], tree).stdout.decode('utf-8', errors='surrogateescape').split('\0') if name]
        validate_scope(scopes, task_paths)
        existing = live[0] if live else next((r for r in reversed(candidates) if r['finished'] == current or r.get('reviewed') == current), None)
        if existing and current == existing['finished'] and tree == git(store.root, 'rev-parse', current + '^{tree}'):
            if existing['scopes'] != scopes:
                raise Refusal('Existing review scope differs; resume explicitly or advance the finished task')
            return resume(store, existing)
        if existing and existing['phase'] == 'completed' and current == existing.get('reviewed') and tree == git(store.root, 'rev-parse', current + '^{tree}'):
            return resume(store, existing)
        if existing:
            no_writers(existing)
            refs_valid(store, existing)
            for role in ('baseline', 'review'):
                entry = existing['workspaces'][role]
                if os.path.lexists(entry['path']) or str(Path(entry['path'])) in registrations(store.root):
                    expected = existing['finished'] if role == 'baseline' else sha(store.root, existing['review_ref'])
                    entry['retained_head'] = workspace_valid(store, existing, role, None if independent(existing) else expected, require_clean=False)
                    if role == 'review' and independent(existing):
                        refs_valid(store, existing)
                        retain_review(store, existing, entry['retained_head'])
        ident, parent = allocate_identity(store)
        record = {'schema_version': SCHEMA, 'managed_by': 'pre-pr-review.py', 'id': ident,
                  'workspace_backend': DEFAULT_BACKEND, 'workspace_token': uuid.uuid4().hex,
                  'repository': store.repo, 'original_checkout': str(store.root),
                  'original_branch': original_branch, 'description': args.description.strip(),
                  'scopes': scopes, 'selected_files': selected,
                  'initial_status': git(store.root, 'status', '--porcelain=v1', '--untracked-files=all'),
                  'main_tip': main_tip, 'comparison_base': bases[0], 'finished': current,
                  'checkpoint_ref': 'refs/heads/checkpoint/pre-pr-' + ident,
                  'review_ref': 'refs/heads/review/pre-pr-' + ident,
                  'artifact_dir': str(store.directory / ident), 'phase': 'creating',
                  'workers': {}, 'verification': None, 'adoption': None,
                  'cleanup': {}, 'created_at': now(), 'required_checks': required_checks(scopes),
                  'predecessor': existing['id'] if existing else None, 'successor': None, 'discovery_errors': errors,
                  'workspaces': {'baseline': {'path': str(parent / 'finished'), 'created': False},
                                 'review': {'path': str(parent / 'reviewed'), 'created': False}}}
        record['finished'] = checkpoint(store, record, tree, temp)
        record['checkpoint_intent'] = None
        store.save(record)
        ensure_refs(store, record)
        reconcile_predecessor(store, record)
        create_workspaces(store, record)
        record['cleanup_retries'] = retry_completed(store, original_branch, exclude={record['id']})
        store.save(record)
        return record


def ensure_refs(store, record):
    for key in ('checkpoint_ref', 'review_ref'):
        result = run(store.root, 'show-ref', '--verify', '--hash', record[key], check=False)
        if result.returncode:
            git(store.root, 'update-ref', record[key], record['finished'], '0' * len(record['finished']))
        elif result.stdout.decode().strip() != record['finished']:
            raise Refusal('Creating review ref collision; no ref overwritten: ' + record[key])


def reconcile_predecessor(store, record):
    ident = record.get('predecessor')
    if not ident:
        return
    previous = store.get(ident)
    if previous['original_branch'] != record['original_branch']:
        raise Refusal('Successor intent belongs to a different task branch')
    successor = previous.get('successor')
    if successor and successor != record['id']:
        raise Refusal('Conflicting successor intent; preserve both reviews: ' + previous['description'] + ' / ' + record['description'])
    if successor == record['id']:
        if previous['phase'] != 'superseded':
            raise Refusal('Reciprocal successor link has an inconsistent predecessor phase')
        return
    if previous['phase'] not in ('ready', 'completed'):
        raise Refusal('Predecessor is not ready for the recorded successor intent')
    no_writers(previous)
    reviewed = refs_valid(store, previous)
    refs_valid(store, record)
    registered = registrations(store.root)
    for role in ('baseline', 'review'):
        workspace = previous['workspaces'][role]
        if os.path.lexists(workspace['path']) or workspace['path'] in registered:
            expected = previous['finished'] if role == 'baseline' else reviewed
            workspace['retained_head'] = workspace_valid(store, previous, role, expected, require_clean=False)
            if not clean(Path(workspace['path']), ignored=True):
                previous.setdefault('retention_notices', []).append({'role': role, 'path': workspace['path'], 'head': expected,
                    'reason': 'Local content preserved in superseded workspace; cleanup waits for exact clean ownership'})
    previous['successor'] = record['id']
    previous['phase'] = 'superseded'
    store.save(previous)


def refresh_verification(store, record):
    if not record.get('verification'):
        return
    try:
        current = verification(store, record, Path(record['verification']['path']), refs_valid(store, record))
        if current['reports'] != record['verification']['reports']:
            raise Refusal('Recorded verification reports changed')
        record['verification']['fresh'] = True
        record['verification'].pop('error', None)
    except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        record['verification']['fresh'] = False
        record['verification']['error'] = str(error)
    store.save(record)


def resume(store, record):
    legacy_mutation_guard(store, record)
    no_writers(record)
    if record.get('checkpoint_intent'):
        finish_checkpoint(store, record)
    plan = record.get('checkpoint_plan')
    if record['phase'] == 'creating' and plan and git(store.root, 'rev-parse', record['finished'] + '^{tree}') != plan['tree']:
        raise Refusal('Checkpoint preparation is incomplete; no refs created at the old commit. Preserve artifacts and inspect.')
    if record['phase'] == 'creating':
        ensure_refs(store, record)
    refs_valid(store, record)
    if independent(record) and record.get('review_import'):
        target = record['review_import']['to']
        workspace_valid(store, record, 'review', target, require_clean=False)
        retain_review(store, record, target)
    reconcile_predecessor(store, record)
    if record['phase'] == 'adopting':
        recover_adoption(store, record)
    refresh_verification(store, record)
    if record['phase'] == 'completed':
        cleanup_chain(store, record)
        record['cleanup_retries'] = retry_completed(store, record['original_branch'], exclude={record['id']})
        store.save(record)
        return record
    if record['phase'] == 'superseded':
        completed = completed_descendant(store, record)
        if completed:
            cleanup_chain(store, completed)
            return store.get(record['id'])
        return record
    create_workspaces(store, record)
    record['cleanup_retries'] = retry_completed(store, record['original_branch'], exclude={record['id']})
    store.save(record)
    return record


def changed_paths(store, record, reviewed):
    names = set()
    history_root = store.root
    if independent(record) and record['phase'] not in TERMINAL and Path(record['workspaces']['review']['path']).is_dir():
        history_root = Path(record['workspaces']['review']['path'])
    for base, head in ((record['comparison_base'], record['finished']), (record['finished'], reviewed)):
        names.update(name for name in run(history_root, 'diff', '--name-only', '--no-renames', '-z', base, head).stdout.decode('utf-8', errors='surrogateescape').split('\0') if name)
    return sorted(names)


def report_file(record, relative):
    if not isinstance(relative, str) or not relative.strip():
        raise Refusal('Every evidence item requires a nonempty report path')
    base = Path(record['artifact_dir'])
    canonical_owned_path(base, directory=True)
    path = Path(relative)
    if not path.is_absolute():
        path = base / path
    try:
        parts = path.relative_to(base).parts
    except ValueError:
        raise Refusal('Evidence report escapes the review artifact directory')
    current = base
    for part in parts:
        if part in ('.', '..'):
            raise Refusal('Evidence path traversal is not permitted')
        current = current / part
        if current.is_symlink():
            raise Refusal('Evidence must not traverse a symlink')
    if path.resolve() != path or not path.is_file():
        raise Refusal('Evidence report missing or unusable: ' + str(path))
    content = path.read_bytes().strip()
    if not content or content in (b'{}', b'[]', b'null', b'PASS', b'pass', b'true'):
        raise Refusal('Empty or unsupported summary is not actual evidence: ' + str(path))
    return path


def verification(store, record, path, reviewed):
    path = report_file(record, str(path.absolute()))
    try:
        evidence = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise Refusal('Invalid verification artifact: ' + str(error))
    if not isinstance(evidence, dict):
        raise Refusal('Verification must be an independent structured artifact')
    for key, expected in (('schema_version', SCHEMA), ('review_id', record['id']),
                          ('baseline', record['finished']), ('reviewed', reviewed), ('main_tip', record['main_tip'])):
        if evidence.get(key) != expected:
            raise Refusal('Verification missing/stale binding: ' + key)
    no_writers(record)
    verifier_id = evidence.get('verifier_id')
    verifier = record['workers'].get(verifier_id)
    if not verifier or verifier.get('role') != 'verifier' or verifier.get('state') != 'stopped':
        raise Refusal('Evidence must name a registered, stopped independent verifier')
    if any(key == verifier_id and worker.get('role') == 'fixer' for key, worker in record['workers'].items()):
        raise Refusal('Verifier cannot be the fixer')
    if verifier.get('verified_sha') != reviewed:
        raise Refusal('Verifier ownership stopped at another reviewed SHA')
    cold_review = evidence.get('cold_review')
    if not isinstance(cold_review, dict):
        raise Refusal('Stopped cold reviewer and findings report are required')
    reviewer_id = cold_review.get('worker_id')
    reviewer = record['workers'].get(reviewer_id)
    if not reviewer or reviewer.get('role') != 'reviewer' or reviewer.get('state') != 'stopped' or reviewer_id == verifier_id:
        raise Refusal('Cold reviewer must be registered, stopped and distinct from verifier')
    if cold_review.get('baseline') != record['finished'] or cold_review.get('status') != 'complete':
        raise Refusal('Cold review must bind the finished checkpoint')
    report_file(record, cold_review.get('report'))
    checks = evidence.get('checks')
    if not isinstance(checks, list) or not checks:
        raise Refusal('Nonempty command-level verification is required')
    indexed = {}
    cold_report = report_file(record, cold_review['report'])
    reports = {str(path): hashlib.sha256(path.read_bytes()).hexdigest(), str(cold_report): hashlib.sha256(cold_report.read_bytes()).hexdigest()}
    def report(relative):
        target = report_file(record, relative)
        reports[str(target)] = hashlib.sha256(target.read_bytes()).hexdigest()
    for item in checks:
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or item.get('stage') not in ('baseline', 'final'):
            raise Refusal('Malformed check entry')
        key = (item['id'], item['stage'])
        if key in indexed:
            raise Refusal('Duplicate check entry: ' + str(key))
        indexed[key] = item
        expected_sha = record['finished'] if item['stage'] == 'baseline' else reviewed
        if item.get('sha') != expected_sha:
            raise Refusal('Check has stale SHA: ' + item['id'])
        command = item.get('command')
        if not isinstance(command, str) or not command.strip():
            raise Refusal('Actual command required: ' + item['id'])
        report(item.get('report'))
    required = list(record['required_checks'])
    changed = changed_paths(store, record, reviewed)
    validate_scope(record['scopes'], changed)
    actual_flows = {name.split('/')[1] for name in changed if name.startswith('flows/') and len(name.split('/')) > 2 and not name.endswith('.md')}
    missing_flows = actual_flows - {scope[5:] for scope in record['scopes'] if scope.startswith('flow:')}
    if missing_flows:
        raise Refusal('Task scope omitted affected Flows: ' + ', '.join(sorted(missing_flows)))
    if any('/skills/' in '/' + name and name.endswith('SKILL.md') for name in changed):
        required.append({'id': 'skill-validation', 'stage': 'final',
                         'command_contains_any': ('validate-skill.py', 'quick_validate.py')})
    for requirement in required:
        item = indexed.get((requirement['id'], requirement['stage']))
        if not item:
            raise Refusal('Required check missing: ' + requirement['stage'] + '/' + requirement['id'])
        markers = requirement.get('command_contains_any', (requirement.get('command_contains'),))
        if not any(marker in item['command'] for marker in markers):
            raise Refusal('Required command was not recorded: ' + requirement['id'])
        comparison = requirement.get('comparison')
        if requirement['id'] in ('journeys', 'browser', 'journeys-checkpoint', 'browser-checkpoint', 'journeys-main', 'browser-main'):
            partial = ('only', 'variants', 'trace', 'folder', 'list', 'selftest', 'mutations', 'series', 'justify')
            if any(re.search(r'(?<![\w-])--' + option + r'''(?=$|[\s=,'"\\\]])''', item['command']) for option in partial):
                raise Refusal('Required full-app check may not narrow coverage or select another mode: ' + requirement['id'])
        if comparison:
            expected_base = record['finished'] if comparison == 'checkpoint' else record['main_tip']
            option = '--against' if requirement['id'].startswith('journeys-') else '--compare'
            # Commands may be shell strings or JSON argv/wrapper descriptions.
            # Their authenticity remains the independent verifier's boundary.
            switch = r'(?<![\w-])' + option + r'''[\s,'"\\]+''' + re.escape(expected_base) + r'''(?=$|[\s,'"\\\]])'''
            if not re.search(switch, item['command']):
                raise Refusal('Comparison command must use ' + option + ' with the frozen full SHA: ' + requirement['id'])
            if comparison == 'checkpoint' and any(option in item['command'] for option in ('--report', '--allow-declared', '--threshold', '--relax')):
                raise Refusal('Checkpoint preservation may not relax comparison rules')
        if comparison == 'main' and item.get('status') == 'DIFFERENT':
            if item.get('exit_code') not in (0, 1) or item.get('journeys_healthy') is not True or not isinstance(item.get('explanation'), str) or not item['explanation'].strip():
                raise Refusal('Main differences require healthy journeys and a recorded explanation')
        elif item.get('status') != 'PASS' or type(item.get('exit_code')) is not int or item['exit_code'] != 0:
            raise Refusal('Required check is failed, skipped or BLOCKED: ' + requirement['id'])
    # An extra failed required-looking command cannot be hidden by a green summary.
    for item in checks:
        if item.get('status') not in ('PASS', 'DIFFERENT'):
            raise Refusal('Unresolved check failure/BLOCKED evidence: ' + item['id'])
        if item.get('status') == 'PASS' and item.get('exit_code') != 0:
            raise Refusal('Check exit status contradicts PASS: ' + item['id'])
        if item.get('status') == 'DIFFERENT' and not item['id'].endswith('-main'):
            raise Refusal('Only the normal main comparison may report intended differences')
    def comparison(value, base, preservation):
        if not isinstance(value, dict) or value.get('base') != base or value.get('head') != reviewed:
            raise Refusal('Missing/stale comparison identity')
        report(value.get('report'))
        differences = value.get('differences')
        if not isinstance(differences, list) or any(not isinstance(item, str) or not item.strip() for item in differences):
            raise Refusal('Comparison differences must be an explicit list of explanations')
        if preservation and differences:
            raise Refusal('Checkpoint behavior differences require a separate product adoption decision')
        channels = value.get('channels')
        if not isinstance(channels, dict):
            raise Refusal('Separate Phone, Tools, wiring, tracking and browser evidence required')
        for name in CHANNELS:
            channel = channels.get(name)
            allowed = ('PASS',) if preservation else ('PASS', 'DIFFERENT')
            if not isinstance(channel, dict) or channel.get('status') not in allowed:
                raise Refusal('Missing or unresolved comparison channel: ' + name)
            report(channel.get('report'))
            if channel['status'] == 'DIFFERENT' and not differences:
                raise Refusal('Main channel differences require task/main-only explanations')
    if record['scopes'] == ['docs']:
        unaffected = evidence.get('participant_unaffected')
        if not isinstance(unaffected, dict) or not isinstance(unaffected.get('reason'), str) or not unaffected['reason'].strip():
            raise Refusal('Docs-only evidence must explain why participant and Flow comparisons are unaffected')
        if any(not name.endswith('.md') for name in changed):
            raise Refusal('Docs-only scope cannot waive participant checks for implementation/harness changes')
        report(unaffected.get('report'))
    else:
        comparisons = evidence.get('comparisons', {})
        comparison(comparisons.get('checkpoint'), record['finished'], True)
        comparison(comparisons.get('main'), record['main_tip'], False)
        if not isinstance(evidence.get('browser'), dict) or not evidence['browser'].get('channel') or not evidence['browser'].get('version'):
            raise Refusal('Record actual browser channel and version')
        report(evidence['browser'].get('report'))
    for scope in record['scopes']:
        if scope.startswith('flow:'):
            flow = evidence.get('flows', {}).get(scope[5:], {})
            comparison(flow.get('checkpoint'), record['finished'], True)
            comparison(flow.get('main'), record['main_tip'], False)
    harness = evidence.get('harness')
    if not isinstance(harness, dict):
        raise Refusal('Independent harness assessment is required')
    report(harness.get('report'))
    harness_changed = any(name.startswith(('tests/', 'scripts/')) for name in changed)
    if harness.get('changed') is not harness_changed:
        raise Refusal('Harness change assessment disagrees with the complete task and fix diffs')
    if harness_changed:
        for name in ('unchanged_checkpoint_control', 'selftests', 'negative_tests'):
            control = harness.get(name)
            if not isinstance(control, dict) or control.get('status') != 'PASS' or not isinstance(control.get('command'), str) or not control['command'].strip():
                raise Refusal('Harness changes require successful independent controls: ' + name)
            if type(control.get('exit_code')) is not int or control['exit_code'] != 0:
                raise Refusal('Harness control command must succeed: ' + name)
            if control.get('baseline') != record['finished'] or control.get('reviewed') != reviewed:
                raise Refusal('Harness control must bind checkpoint and reviewed SHA: ' + name)
            report(control.get('report'))
        negative = harness['negative_tests']
        if negative.get('regression_detected') is not True or type(negative.get('regression_exit_code')) is not int or negative['regression_exit_code'] == 0 or negative.get('actual_reason') != negative.get('expected_reason') or not isinstance(negative.get('expected_reason'), str) or not negative['expected_reason'].strip():
            raise Refusal('A deliberate affected regression must be detected for its expected reason')
    for key in ('decisions', 'limitations'):
        entries = evidence.get(key)
        if not isinstance(entries, list):
            raise Refusal('Explicit decision and limitation inventories are required')
        for item in entries:
            if not isinstance(item, dict) or item.get('status') != 'resolved' or not isinstance(item.get('explanation'), str) or not item['explanation'].strip():
                raise Refusal('Unresolved ' + key + ' blocks automatic adoption')
            if key == 'decisions' and item.get('kind') != 'technical':
                raise Refusal('Approved product differences require separate explicit adoption')
            report(item.get('report'))
    return {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'reports': reports, 'reviewed': reviewed, 'verifier_id': verifier_id,
            'validated_at': now(), 'fresh': True}


def original_valid(store, record, expected):
    no_git_operation(store.root)
    if branch(store.root) != record['original_branch'] or sha(store.root, 'HEAD') != expected or sha(store.root, record['original_branch']) != expected:
        raise Refusal('Original checkout/branch advanced or changed; adoption withheld')
    entry = registrations(store.root).get(str(store.root))
    if not entry or entry.get('branch') != record['original_branch']:
        raise Refusal('Original branch worktree registration changed')
    if not clean(store.root):
        raise Refusal('Original checkout has staged, unstaged or untracked content; preserve it before adoption')


def retain_review(store, record, reviewed):
    if not independent(record):
        return
    if any(entry.get('branch') == record['review_ref'] for entry in registrations(store.root).values()):
        raise Refusal('Retained review branch is checked out elsewhere; import withheld')
    workspace_valid(store, record, 'review', reviewed, require_clean=False)
    if managed_call(managed.import_objects, Path(record['workspaces']['review']['path']), store.root, record['review_ref']) != reviewed:
        raise Refusal('Review advanced during object export; import withheld')
    previous = record.get('retained_review', record['finished'])
    current = sha(store.root, record['review_ref'])
    pending = record.get('review_import')
    if pending and pending != {'from': previous, 'to': reviewed}:
        raise Refusal('Interrupted retained-ref import has another target; preserve and inspect')
    if current == reviewed and (current == previous or pending):
        record['retained_review'] = reviewed
        record['review_import'] = None
        store.save(record)
        return
    if current != previous:
        raise Refusal('Retained review ref changed outside the lifecycle; preserved')
    record['review_import'] = {'from': previous, 'to': reviewed}
    store.save(record)
    if any(entry.get('branch') == record['review_ref'] for entry in registrations(store.root).values()):
        raise Refusal('Retained review branch is checked out elsewhere; import withheld')
    workspace_valid(store, record, 'review', reviewed, require_clean=False)
    git(store.root, 'update-ref', record['review_ref'], reviewed, previous)
    record['retained_review'] = reviewed
    record['review_import'] = None
    store.save(record)


def recover_adoption(store, record):
    intent = record.get('adoption')
    if not isinstance(intent, dict) or intent.get('status') != 'intent':
        raise Refusal('Adoption phase lacks a durable exact intent')
    reviewed = refs_valid(store, record)
    if reviewed != intent.get('to'):
        raise Refusal('Interrupted adoption review ref advanced; inspection required')
    current = sha(store.root, 'HEAD')
    expected_original = record['finished'] if current == record['finished'] else reviewed
    original_valid(store, record, expected_original)
    workspace_valid(store, record, 'review', reviewed)
    # Revalidate all evidence after interruption; a moved/disappeared report is stale.
    verified = verification(store, record, Path(intent['verification_path']), reviewed)
    if verified['reports'] != intent['verification_reports']:
        raise Refusal('Interrupted adoption evidence changed; inspection required')
    if current != reviewed:
        # The intent was saved before Git ran. Complete it only after inspecting
        # both the actual original HEAD and all unchanged verification reports.
        original_valid(store, record, record['finished'])
        if refs_valid(store, record) != reviewed:
            raise Refusal('Review moved while resuming adoption')
        retain_review(store, record, reviewed)
        git(store.root, 'merge', '--ff-only', '--no-overwrite-ignore', reviewed)
    original_valid(store, record, reviewed)
    retain_review(store, record, reviewed)
    record['reviewed'] = reviewed
    record['verification'] = verified
    record['phase'] = 'completed'
    record['adoption'] = {'status': 'no-fix' if reviewed == record['finished'] else 'adopted',
                          'from': record['finished'], 'to': reviewed, 'completed_at': now(), 'recovered': True}
    record['workspaces']['review']['retained_head'] = reviewed
    record['workspaces']['baseline']['retained_head'] = record['finished']
    store.save(record)


def adopt(store, record, path):
    legacy_mutation_guard(store, record)
    no_writers(record)
    if record['phase'] == 'completed':
        refresh_verification(store, record)
        cleanup_chain(store, record)
        return record
    if record['phase'] == 'adopting':
        recover_adoption(store, record)
        cleanup_chain(store, record)
        return record
    if record['phase'] != 'ready':
        raise Refusal('Only a ready, nonsuperseded review may be adopted')
    reviewed = refs_valid(store, record)
    workspace_valid(store, record, 'baseline', record['finished'])
    workspace_valid(store, record, 'review', reviewed)
    verified = verification(store, record, path, reviewed)
    record['verification'] = verified
    record['reviewed'] = reviewed
    store.save(record)
    try:
        original_valid(store, record, record['finished'])
    except Refusal as error:
        record['adoption'] = {'status': 'withheld', 'reason': str(error), 'at': now()}
        store.save(record)
        raise
    record['verification'] = verified
    record['phase'] = 'adopting'
    record['adoption'] = {'status': 'intent', 'from': record['finished'], 'to': reviewed,
                          'verification_path': verified['path'], 'verification_reports': verified['reports'], 'started_at': now()}
    store.save(record)
    # Immediately repeat mutable gates after persisting intent, before Git moves HEAD.
    no_writers(record)
    if refs_valid(store, record) != reviewed:
        raise Refusal('Review advanced immediately before adoption')
    workspace_valid(store, record, 'review', reviewed)
    original_valid(store, record, record['finished'])
    repeated = verification(store, record, path, reviewed)
    if repeated['reports'] != verified['reports']:
        raise Refusal('Verification changed immediately before adoption')
    retain_review(store, record, reviewed)
    git(store.root, 'merge', '--ff-only', '--no-overwrite-ignore', reviewed)
    recover_adoption(store, record)
    cleanup_chain(store, record)
    return record


def completed_descendant(store, record):
    seen = set()
    while record['phase'] == 'superseded' and record.get('successor'):
        if record['id'] in seen:
            raise Refusal('Successor cycle; no cleanup')
        seen.add(record['id'])
        successor = store.get(record['successor'])
        if successor.get('predecessor') != record['id'] or successor['original_branch'] != record['original_branch']:
            raise Refusal('Successor ownership mismatch; no cleanup')
        record = successor
    if record['phase'] != 'completed':
        return None
    adoption = record.get('adoption')
    verified = record.get('verification')
    if (not isinstance(adoption, dict) or adoption.get('status') not in ('adopted', 'no-fix')
            or adoption.get('from') != record['finished'] or adoption.get('to') != record.get('reviewed')
            or not adoption.get('completed_at') or not isinstance(verified, dict)
            or verified.get('reviewed') != record.get('reviewed') or not verified.get('reports')):
        raise Refusal('Completed phase lacks successful adopted/no-fix evidence; no workspace cleanup')
    if adoption['status'] == 'no-fix' and record['reviewed'] != record['finished']:
        raise Refusal('No-fix completion has a changed reviewed commit; inspect before cleanup')
    return record


def cleanup_one(store, record):
    legacy_mutation_guard(store, record)
    if not completed_descendant(store, record):
        raise Refusal('Cleanup requires a successfully completed task (or its eligible superseded review)')
    no_writers(record)
    refs_valid(store, record)
    refresh_verification(store, record)
    for role in ('baseline', 'review'):
        workspace = record['workspaces'][role]
        path = Path(workspace['path'])
        try:
            expected = record['finished'] if role == 'baseline' else workspace.get('retained_head')
            if not expected:
                raise Refusal('No frozen cleanup HEAD; ownership is incomplete')
            entry = registrations(store.root).get(str(path))
            if not os.path.lexists(path) and entry:
                reconcile_absent_workspace(store, record, role, expected, entry)
                entry = None
            if not os.path.lexists(path) and not entry:
                workspace['removed'] = True
                record['cleanup'][role] = {'status': 'removed', 'at': now()}
                store.save(record)
                continue
            workspace_valid(store, record, role, expected, ignored=True)
            record['cleanup'][role] = {'status': 'intent', 'head': expected, 'path': str(path), 'at': now()}
            store.save(record)
            # Never force removal, prune registrations, or remove an unregistered directory.
            if independent(record):
                managed_call(managed.remove, path, owner(record, role), expected,
                             record['review_ref'] if role == 'review' else None)
            else:
                git(store.root, 'worktree', 'remove', str(path))
            workspace['removed'] = True
            record['cleanup'][role] = {'status': 'removed', 'at': now()}
        except Refusal as error:
            record['cleanup'][role] = {'status': 'retained', 'reason': str(error), 'at': now()}
        store.save(record)
    return record


def cleanup_chain(store, record):
    cleanup_one(store, record)
    completed = record
    predecessor = record.get('predecessor')
    seen = {record['id']}
    retries = []
    while predecessor and predecessor not in seen:
        seen.add(predecessor)
        try:
            previous = store.get(predecessor)
            if previous.get('successor') != record['id']:
                raise Refusal('Predecessor successor link changed; no cleanup')
            cleanup_one(store, previous)
            retries.append({'id': predecessor, 'cleanup': previous['cleanup']})
        except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError) as error:
            retries.append({'id': predecessor, 'status': 'retained', 'reason': str(error)})
            break
        record = previous
        predecessor = previous.get('predecessor')
    if retries:
        completed['cleanup_predecessors'] = retries
        store.save(completed)


def retry_completed(store, original_branch, exclude=None):
    results = []
    records, errors = store.discovery()
    excluded = exclude or set()
    for record in records:
        if record['id'] in excluded or record['original_branch'] != original_branch or record['phase'] != 'completed':
            continue
        try:
            cleanup_chain(store, record)
            results.append({'id': record['id'], 'cleanup': record['cleanup']})
        except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError) as error:
            results.append({'id': record['id'], 'status': 'retained', 'reason': str(error)})
    if errors:
        results.append({'discovery_errors': errors})
    return results


def worker(store, record, args):
    legacy_mutation_guard(store, record)
    if record['phase'] != 'ready':
        raise Refusal('Workers may register only on a ready review')
    if not args.worker_id.strip():
        raise Refusal('Worker ID must be explicit')
    existing = record['workers'].get(args.worker_id)
    if existing and existing['role'] != args.role:
        raise Refusal('Worker role is immutable; independent verifier and fixer IDs must differ')
    if args.state == 'active' and args.role == 'fixer':
        active_fixers = [key for key, item in record['workers'].items() if item['role'] == 'fixer' and item['state'] != 'stopped' and key != args.worker_id]
        if active_fixers:
            raise Refusal('A fixer already owns the review workspace')
    reviewed = refs_valid(store, record)
    item = {'role': args.role, 'state': args.state, 'updated_at': now()}
    if args.state == 'stopped':
        workspace_valid(store, record, 'review', reviewed, require_clean=False)
        item['stopped_sha'] = reviewed
        item['worktree_clean'] = clean(Path(record['workspaces']['review']['path']))
        if args.role == 'verifier' and item['worktree_clean']:
            item['verified_sha'] = reviewed
        record['workspaces']['review']['retained_head'] = reviewed
    record['workers'][args.worker_id] = item
    store.save(record)
    return record


def url(store, record, args):
    version = args.version
    reviewed = refs_valid(store, record)
    if version == 'original':
        target = store.root
        expected = record.get('reviewed') if record['phase'] == 'completed' else record['finished']
    elif version == 'finished':
        target = Path(record['workspaces']['baseline']['path'])
        expected = record['finished']
    else:
        target = Path(record['workspaces']['review']['path'])
        expected = record.get('reviewed', record['finished'])
    if record['phase'] == 'completed' and not target.exists():
        if version == 'finished' and record.get('reviewed') != record['finished']:
            return {'available': False, 'id': record['id'], 'version': version,
                    'reason': 'Exact finished workspace was cleaned; checkpoint ref is retained. Reviewed original is a different version.'}
        expected = record.get('reviewed')
        if branch(store.root) != record['original_branch'] or sha(store.root, 'HEAD') != expected or not clean(store.root):
            return {'available': False, 'id': record['id'], 'version': version,
                    'reason': 'Historical workspace was cleaned; original checkout is no longer the exact clean reviewed result'}
        target = store.root
    if not target.is_dir():
        return {'available': False, 'id': record['id'], 'version': version, 'reason': 'Workspace absent; resume explicitly to recreate it'}
    actual = sha(target, 'HEAD')
    dirty = not clean(target)
    if target != store.root:
        role = 'baseline' if version == 'finished' else 'review'
        workspace_valid(store, record, role, record['finished'] if role == 'baseline' else reviewed, require_clean=False)
    elif branch(target) != record['original_branch']:
        return {'available': False, 'id': record['id'], 'version': version, 'reason': 'Original task branch changed'}
    entry = target / 'index.html'
    if not entry.is_file() or entry.is_symlink():
        return {'available': False, 'id': record['id'], 'version': version, 'reason': 'Selector entry is missing or unusable'}
    module_path = Path(__file__).resolve().with_name('local-variants.py')
    spec = importlib.util.spec_from_file_location('moneybuddy_local_variants', module_path)
    module = importlib.util.module_from_spec(spec)
    previous_bytecode = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous_bytecode
    result = {'available': True, 'id': record['id'], 'version': version,
              'url': module.browser_url(store.host_path(entry), args.wsl_distro), 'path': str(store.host_path(entry)),
              'head': actual, 'expected_head': expected, 'dirty': dirty,
              'identity': 'current task work' if dirty or actual != expected else 'exact recorded commit',
              'verified': False}
    if not dirty and actual == expected and record.get('verification') and actual == reviewed and reviewed == record.get('reviewed'):
        try:
            current = verification(store, record, Path(record['verification']['path']), reviewed)
            result['verified'] = current['reports'] == record['verification']['reports']
        except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError):
            pass
    return result


def status_record(store, record):
    result = dict(record)
    result['observed'] = {}
    if record['phase'] == 'creating' and record.get('checkpoint_plan') and not record.get('checkpoint_intent'):
        if git(store.root, 'rev-parse', record['finished'] + '^{tree}') != record['checkpoint_plan']['tree']:
            result['recovery'] = {'status': 'incomplete-checkpoint', 'reason': 'No trustworthy prepared intent; no old-HEAD review may be created'}
    for role, workspace in record['workspaces'].items():
        try:
            expected = record['finished'] if role == 'baseline' else refs_valid(store, record)
            head = workspace_valid(store, record, role, expected, require_clean=False)
            result['observed'][role] = {'head': head, 'clean': clean(Path(workspace['path'])), 'available': True}
        except Refusal as error:
            result['observed'][role] = {'available': False, 'reason': str(error)}
    if record.get('verification'):
        result['verification'] = dict(record['verification'])
        try:
            current = verification(store, record, Path(record['verification']['path']), refs_valid(store, record))
            if current['reports'] != record['verification']['reports']:
                raise Refusal('Recorded verification reports changed')
            result['verification']['fresh'] = True
        except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError) as error:
            result['verification']['fresh'] = False
            result['verification']['error'] = str(error)
    return result


def import_legacy(store, ident):
    if store.host_root:
        return store.get(ident)  # Never reinterpret native absolute identities in a container.
    if not IDENT.fullmatch(ident):
        raise Refusal('Invalid explicit review ID')
    path = store.artifact_path(ident) / 'record.json'
    legacy = json.loads(path.read_text(encoding='utf-8'))
    if legacy.get('managed_by') == 'pre-pr-review.py' and legacy.get('schema_version') == SCHEMA:
        return store.get(ident)
    # Import only records whose retained refs, origin and sibling ownership can
    # be proved by the current contract. Unknown temporary paths stay untouched.
    record = dict(legacy)
    record.update(schema_version=SCHEMA, managed_by='pre-pr-review.py',
                  required_checks=required_checks(scopes_valid(record.get('scopes', []))),
                  workers={}, verification=None, adoption=None, cleanup={}, phase='ready')
    store.validate_record(record, path.parent)
    if record['original_checkout'] != str(store.root):
        raise Refusal('Legacy original checkout does not match')
    reviewed = refs_valid(store, record)
    workspace_valid(store, record, 'baseline', record['finished'])
    workspace_valid(store, record, 'review', reviewed)
    backup = path.with_name('record.legacy.json')
    if backup.exists():
        raise Refusal('Legacy backup already exists; inspect before importing')
    atomic(backup, legacy)
    record['legacy_import'] = {'source': str(backup), 'at': now(), 'new_independent_verification_required': True}
    store.save(record)
    return record


def migrate_container(store, ident):
    """Convert completed, cleaned native ownership after proving retained evidence."""
    if not store.host_root:
        raise Refusal('Migration requires the checks review launcher and explicit host mounts')
    path = store.artifact_path(ident) / 'record.json'
    legacy = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(legacy, dict) or legacy.get('managed_by') != 'pre-pr-review.py':
        raise Refusal('Unrecognized legacy ownership; migration withheld')
    if legacy.get('schema_version') == CONTAINER_RECORD_SCHEMA:
        return store.get(ident)
    if legacy.get('schema_version') != SCHEMA or legacy.get('phase') != 'completed':
        raise Refusal('Migration requires a completed review: finish and clean managed worktrees in the original environment first')

    def mapped(value):
        host_path = type(store.host_root)(value)
        if not host_path.is_absolute() or '..' in host_path.parts:
            raise Refusal('Invalid legacy absolute path; migration withheld')
        try:
            relative = host_path.relative_to(store.host_root.parent)
        except ValueError:
            raise Refusal('Legacy path is outside the declared host mounts')
        if not relative.parts or relative.parts[0] not in (store.host_root.name, store.host_root.name + '-reviews'):
            raise Refusal('Legacy path is outside the declared host mounts')
        target = store.mount_parent.joinpath(*relative.parts)
        store.relative_path(str(target))
        return str(target)

    def translate(value, key=None):
        if key in PATH_FIELDS and value is not None:
            return mapped(value)
        if key == 'reports' and isinstance(value, dict):
            return {mapped(name): digest for name, digest in value.items()}
        if isinstance(value, dict):
            return {name: translate(item, name) for name, item in value.items()}
        if isinstance(value, list):
            return [translate(item) for item in value]
        return value

    record = translate(legacy)
    store.validate_record(record, path.parent)
    if record['original_checkout'] != str(store.root):
        raise Refusal('Legacy original checkout does not match declared host mount')
    no_writers(record)
    no_git_operation(store.root)
    reviewed = refs_valid(store, record)
    if not completed_descendant(store, record):
        raise Refusal('Completed adoption identity is missing; migration withheld')
    registered = run(store.root, 'worktree', 'list', '--porcelain', '-z').stdout.decode('utf-8', errors='surrogateescape')
    registered_paths = {part.removeprefix('worktree ') for part in registered.split('\0') if part.startswith('worktree ')}
    host_registered = {type(store.host_root)(value) for value in registered_paths}
    for role, workspace in record['workspaces'].items():
        source = legacy['workspaces'][role]['path']
        if (not workspace.get('removed') or os.path.lexists(workspace['path'])
                or (workspace.get('metadata_dir') and os.path.lexists(workspace['metadata_dir']))
                or type(store.host_root)(source) in host_registered or workspace['path'] in registered_paths):
            raise Refusal('Managed worktrees remain registered or present; clean them in the original environment before migration')
    verified = verification(store, record, Path(record['verification']['path']), reviewed)
    if verified['reports'] != record['verification']['reports']:
        raise Refusal('Independent evidence changed; migration withheld')
    backup = path.with_name('record.native-v1.json')
    canonical_owned_path(backup)
    if backup.exists():
        if json.loads(backup.read_text(encoding='utf-8')) != legacy:
            raise Refusal('Migration backup differs; evidence retained without overwrite')
    else:
        atomic(backup, legacy)
    record['container_migration'] = {'source': str(backup), 'at': now()}
    store.save(record)
    return record


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest='command', required=True)
    start_parser = commands.add_parser('start')
    start_parser.add_argument('--description', required=True)
    start_parser.add_argument('--file', action='append', default=[])
    start_parser.add_argument('--scope', action='append', required=True)
    status_parser = commands.add_parser('status')
    status_parser.add_argument('id', nargs='?')
    for name in ('resume', 'adopt', 'worker', 'url', 'migrate'):
        command = commands.add_parser(name)
        command.add_argument('id')
        if name == 'resume':
            command.add_argument('--import-legacy', action='store_true')
        if name == 'adopt':
            command.add_argument('--verification', type=Path, required=True)
        elif name == 'worker':
            command.add_argument('--role', choices=('reviewer', 'verifier', 'fixer'), required=True)
            command.add_argument('--worker-id', required=True)
            command.add_argument('--state', choices=('active', 'stopped'), required=True)
        elif name == 'url':
            command.add_argument('--version', choices=('original', 'finished', 'reviewed'), default='reviewed')
            command.add_argument('--wsl-distro')
    cleanup_parser = commands.add_parser('cleanup')
    selection = cleanup_parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('id', nargs='?')
    selection.add_argument('--completed', action='store_true')
    for command in commands.choices.values():
        command.add_argument('--json', action='store_true')
    return result


def main():
    args = parser().parse_args()
    try:
        store = Store()
        if getattr(args, 'verification', None) is not None:
            args.verification = store.execution_path(args.verification)
        if hasattr(args, 'file'):
            args.file = [str(store.execution_path(value)) for value in args.file]
        if args.command == 'status':
            records, errors = store.discovery()
            if args.id:
                try:
                    records = [store.get(args.id)]
                except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError) as error:
                    records = []
                    errors.append({'id': args.id, 'error': str(error)})
            output = {'records': [], 'errors': errors}
            for record in records:
                try:
                    output['records'].append(status_record(store, record))
                except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError) as error:
                    output['errors'].append({'id': record['id'], 'error': str(error)})
        elif args.command == 'url':
            output = url(store, store.get(args.id), args)
        else:
            native_record = args.id if not store.host_root and args.command in ('resume', 'adopt', 'worker', 'cleanup') else None
            with store.lock(native_record=native_record):
                if args.command == 'start':
                    output = start(store, args)
                elif args.command == 'migrate':
                    output = migrate_container(store, args.id)
                elif args.command == 'cleanup' and args.completed:
                    records, errors = store.discovery()
                    output = {'records': [], 'errors': errors}
                    for record in records:
                        if record['phase'] in TERMINAL:
                            try:
                                output['records'].append(cleanup_one(store, record))
                            except Refusal as error:
                                output['errors'].append({'id': record['id'], 'error': str(error)})
                else:
                    record = import_legacy(store, args.id) if args.command == 'resume' and args.import_legacy else store.get(args.id)
                    if args.command == 'resume':
                        output = resume(store, record)
                    elif args.command == 'adopt':
                        output = adopt(store, record, args.verification)
                    elif args.command == 'cleanup':
                        output = cleanup_one(store, record)
                    else:
                        output = worker(store, record, args)
        output = store.present(output)
        if args.json or args.command == 'status':
            print(json.dumps(output, indent=2, ensure_ascii=True))
        elif args.command == 'url':
            print((output['url'] + '\n' + output['identity'] + ' at ' + output['head']) if output['available'] else 'Preview unavailable: ' + output['reason'])
        elif 'id' in output:
            print(output['id'] + ': ' + output['phase'] + '\nEvidence: ' + output.get('host_artifact_dir', output['artifact_dir']))
        else:
            print(json.dumps(output, indent=2))
        return 0
    except (Refusal, OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        if args.json:
            print(json.dumps({'error': str(error), 'command': args.command}))
        else:
            print('Review withheld: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
