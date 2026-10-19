#!/usr/bin/env python3
"""Run checks against captured source in a disposable, independent Git repository."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import signal
import subprocess
import sys
import time


class CaptureError(ValueError):
    pass


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.STDOUT)


def permitted(path):
    p = PurePosixPath(path)
    if not path or p.is_absolute() or '..' in p.parts or '\\' in path or ':' in p.parts[0]:
        raise CaptureError(f'Unsafe source path: {path!r}')
    excluded = {'.git', '.worktrees', 'node_modules', '__pycache__', '.checks', '.check-reports', 'check-reports', '.container-checks'}
    return not any(part in excluded for part in p.parts) and path != 'branching.md'


def inventory(path):
    return sorted(set(os.fsdecode(x) for x in path.read_bytes().split(b'\0') if x))


def read_source(root, name):
    path = root / name
    # Parent symlinks must not permit copying files outside the selected checkout.
    if not path.parent.resolve().is_relative_to(root.resolve()):
        raise CaptureError(f'Source escapes checkout: {name}')
    if path.is_symlink():
        target = os.readlink(path)
        if not path.resolve().is_relative_to(root.resolve()):
            raise CaptureError(f'Symlink escapes checkout: {name}')
        return os.fsencode(target), 'symlink'
    if not path.is_file():
        raise CaptureError(f'Selected source file is missing or not regular: {name}')
    return path.read_bytes(), 'file'


def capture(source, inputs, work):
    head = (inputs / 'head.txt').read_text().strip()
    if len(head) not in (40, 64) or any(c not in '0123456789abcdef' for c in head):
        raise CaptureError('head.txt must contain a full commit SHA')
    mode = (inputs / 'mode.txt').read_text().strip()
    if mode not in ('committed', 'working-copy'):
        raise CaptureError('Unknown source mode')
    repo = work / 'repo'
    if repo.exists():
        raise CaptureError('Disposable work directory already contains a repository')
    repo.mkdir(parents=True)
    git(repo, 'init', '--quiet')
    git(repo, 'config', 'user.name', 'MoneyBuddy checks')
    git(repo, 'config', 'user.email', 'checks@localhost')
    git(repo, 'config', 'core.autocrlf', 'false')
    git(repo, 'fetch', '--quiet', '--update-head-ok', str(inputs / 'repo.bundle'), '+refs/*:refs/*', 'HEAD')
    git(repo, 'checkout', '--quiet', '--detach', head)
    if git(repo, 'rev-parse', 'HEAD').decode().strip() != head:
        raise CaptureError('Captured commit does not match selected HEAD')
    manifest = {'schema_version': 1, 'mode': mode, 'head': head, 'files': [], 'deleted': []}
    if mode == 'working-copy':
        files = [p for p in inventory(inputs / 'files.z') if permitted(p)]
        deleted = {p for p in inventory(inputs / 'deleted.z') if permitted(p)}
        head_paths = {os.fsdecode(p) for p in git(repo, 'ls-files', '-z').split(b'\0') if p}
        deleted.update(p for p in head_paths - set(files) if permitted(p))
        index_modes = {}
        index_path = inputs / 'index.z'
        index_data = index_path.read_bytes() if index_path.exists() else git(repo, 'ls-files', '-s', '-z')
        for row in index_data.split(b'\0'):
            if row:
                metadata, name = row.split(b'\t', 1)
                index_modes[os.fsdecode(name)] = metadata.split()[0]
        for name in sorted(deleted):
            dest = repo / name
            if not dest.parent.resolve().is_relative_to(repo.resolve()):
                raise CaptureError(f'Deletion escapes checkout: {name}')
            if dest.is_file() or dest.is_symlink():
                dest.unlink()
        manifest['deleted'] = sorted(deleted)
        for name in files:
            if name in deleted:
                continue
            content, kind = read_source(source, name)
            dest = repo / name
            if not dest.parent.resolve().is_relative_to(repo.resolve()):
                raise CaptureError(f'Destination escapes checkout: {name}')
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.is_symlink():
                dest.unlink()
            if kind == 'symlink':
                if dest.exists():
                    dest.unlink()
                dest.symlink_to(os.fsdecode(content))
            else:
                dest.write_bytes(content)
                dest.chmod(0o755 if index_modes.get(name) == b'100755' else 0o644)
            manifest['files'].append({'path': name, 'kind': kind, 'sha256': hashlib.sha256(content).hexdigest()})
        # Re-read every selected input after the copy, so mixed captures cannot pass.
        for item in manifest['files']:
            content, kind = read_source(source, item['path'])
            if kind != item['kind'] or hashlib.sha256(content).hexdigest() != item['sha256']:
                raise CaptureError('Source changed during capture: ' + item['path'])
        for name in deleted:
            if (source / name).exists() or (source / name).is_symlink():
                raise CaptureError('Deleted source reappeared during capture: ' + name)
    return repo, manifest


def dependency_drift(repo):
    image = Path('/opt/moneybuddy/browser')
    for name in ('package.json', 'package-lock.json'):
        actual = repo / 'tests/browser' / name
        copied = repo / 'container' / name
        if actual.exists() and copied.exists() and actual.read_bytes() != copied.read_bytes():
            raise CaptureError(f'container/{name} differs from tests/browser/{name}; synchronize dependency manifests and rebuild')
        if image.exists() and actual.read_bytes() != (image / name).read_bytes():
            raise CaptureError('Image dependency inputs are stale; rebuild the checks image')


def run_command(command, repo, report, env, number):
    log = report / f'{number:02d}.log'
    with log.open('w', encoding='utf-8') as output:
        output.write('$ ' + repr(command) + '\n')
        output.flush()
        process = subprocess.Popen(command, cwd=repo, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   text=True, encoding='utf-8', errors='replace', start_new_session=True)
        try:
            for line in process.stdout:
                print(line, end='', flush=True)
                output.write(line)
                output.flush()
            code = process.wait()
        except BaseException:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait()
            raise
        finally:
            process.stdout.close()
    return {'command': command, 'exit_code': code, 'log': log.name}


def commands(args, report):
    if args.command == 'all':
        return [['bash', 'scripts/check-all.sh']]
    if args.command == 'compare':
        vm = ['node', 'tests/app-journeys.cjs', '--against', args.base, '--out', str(report / 'journeys')]
        browser = ['node', 'tests/browser/app-journeys-browser.cjs', '--compare', args.base, '--out', str(report / 'browser')]
        if args.report_only:
            vm.append('--report')
            browser.append('--report')
        return [vm, browser]
    if args.command.startswith('ci-'):
        return [['bash', '/opt/moneybuddy/ci.sh', args.command]]
    return [args.argv[1:] if args.argv and args.argv[0] == '--' else args.argv]


def doctor(source=Path('/input/source')):
    if os.environ.get('MB_CHECK_MOUNT_PROBE') == '1':
        try:
            with (source / 'index.html').open('rb') as probe:
                probe.read(1)
        except OSError as error:
            raise CaptureError('Docker cannot read the mounted checkout index.html: ' + str(error)) from error
        print('PASS     Read-only checkout mount is readable')
    for command in (['git', '--version'], ['node', '--version'], ['python3', '--version']):
        subprocess.run(command, check=True)
    subprocess.run(['node', '-e', 'require(process.env.MB_PLAYWRIGHT_MODULE).chromium.launch({headless:true}).then(async b=>{console.log("Playwright "+require(process.env.MB_PLAYWRIGHT_MODULE+"/package.json").version);console.log("Chromium "+b.version());await b.close()}).catch(e=>{console.error(e);process.exit(1)})'], check=True)
    print('PASS     Container toolchain and Chromium launch')
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-source', type=Path, default=Path('/input/source'))
    parser.add_argument('--input-git', type=Path, default=Path('/input/git'))
    parser.add_argument('--work', type=Path, default=Path('/work'))
    parser.add_argument('--reports', type=Path, default=Path('/reports'))
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('all', 'doctor', 'ci-app', 'ci-publication', 'ci-browser', 'ci-deploy'):
        sub.add_parser(name)
    compare = sub.add_parser('compare')
    compare.add_argument('--base', required=True)
    compare.add_argument('--report', dest='report_only', action='store_true')
    execute = sub.add_parser('exec')
    execute.add_argument('argv', nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    if args.command == 'doctor':
        try:
            return doctor(args.input_source)
        except (CaptureError, OSError, subprocess.CalledProcessError) as error:
            print('BLOCKED  Container toolchain or Chromium launch failed: ' + str(error), file=sys.stderr)
            return 2
    report = args.reports
    report.mkdir(parents=True, exist_ok=True)
    if any(report.iterdir()):
        raise CaptureError('Report directory must be empty for a new run')
    result = {'status': 'INCOMPLETE', 'command': args.command, 'image': os.environ.get('MB_CHECK_IMAGE_ID', 'unrecorded'),
              'started': time.time(), 'commands': []}
    status_file = report / 'result.json'
    status_file.write_text(json.dumps(result, indent=2) + '\n')
    try:
        repo, manifest = capture(args.input_source, args.input_git, args.work)
        (report / 'source.json').write_text(json.dumps(manifest, indent=2) + '\n')
        dependency_drift(repo)
        if args.command == 'ci-deploy':
            origin = (args.input_git / 'origin.txt').read_text().strip()
            if not origin:
                raise CaptureError('Deployment requires origin.txt')
            git(repo, 'remote', 'add', 'origin', origin)
        result['versions'] = {name: subprocess.check_output(command, text=True).strip() for name, command in
                              [('git', ['git', '--version']), ('node', ['node', '--version']), ('python', ['python3', '--version'])]}
        if os.environ.get('MB_PLAYWRIGHT_MODULE'):
            probe = 'const p=require(process.env.MB_PLAYWRIGHT_MODULE);p.chromium.launch({headless:true}).then(async b=>{console.log(JSON.stringify({playwright:require(process.env.MB_PLAYWRIGHT_MODULE+"/package.json").version,chromium:b.version()}));await b.close()}).catch(e=>{console.error(e);process.exit(1)})'
            result['versions'].update(json.loads(subprocess.check_output(['node', '-e', probe], text=True)))
        if args.command == 'compare':
            args.base = git(repo, 'rev-parse', '--verify', args.base + '^{commit}').decode().strip()
            result['base'] = args.base
        temp = args.work / 'tmp'
        temp.mkdir(exist_ok=True)
        env = dict(os.environ, MB_REPORT_DIR=str(report), RUNNER_TEMP=str(temp),
                   MB_CHECK_LOG_DIR=str(report / 'checks'), PYTHONDONTWRITEBYTECODE='1')
        for command in commands(args, report):
            if not command:
                raise CaptureError('exec requires a command')
            result['commands'].append(run_command(command, repo, report, env, len(result['commands']) + 1))
            status_file.write_text(json.dumps(result, indent=2) + '\n')
        codes = [item['exit_code'] for item in result['commands']]
        code = 1 if any(c not in (0, 2) for c in codes) else 2 if 2 in codes else 0
        result['status'] = {0: 'PASS', 1: 'FAIL', 2: 'BLOCKED'}[code]
    except (CaptureError, OSError, subprocess.CalledProcessError) as error:
        result['status'] = 'BLOCKED'
        detail = str(error)
        if isinstance(error, subprocess.CalledProcessError) and error.output:
            detail += '\n' + (error.output.decode(errors='replace') if isinstance(error.output, bytes) else error.output)
        result['error'] = detail
        print('BLOCKED  ' + detail, file=sys.stderr)
        code = 2
    except KeyboardInterrupt:
        result['status'] = 'INCOMPLETE'
        code = 130
    finally:
        result['finished'] = time.time()
        status_file.write_text(json.dumps(result, indent=2) + '\n')
        print(f'Reports: {report}', flush=True)
    return code


if __name__ == '__main__':
    raise SystemExit(main())
