"""Disposable real-Git fixtures for the pre-PR lifecycle CLI.

These fixtures model lifecycle safety, not MoneyBuddy browser acceptance. Actual
app journey/browser exercises remain separate and must use the real app harness.
The helper is always exercised through its public command line.
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


SOURCE = Path(__file__).resolve().parents[1]
SCRIPT = SOURCE / 'scripts/pre-pr-review.py'


class ReviewFixture:
    """A private repository with a local main and a named, finished task branch."""

    def __init__(self, backend="independent-v1"):
        self.backend = backend
        self.temp = tempfile.TemporaryDirectory(prefix='pre pr review # % ')
        self.parent = Path(self.temp.name).resolve()
        self.root = self.parent / 'PM task café # %'
        self.root.mkdir()
        self.env = os.environ.copy()
        for key in list(self.env):
            if key.startswith('GIT_'):
                del self.env[key]
        self.env.update({'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull,
                         'GIT_TERMINAL_PROMPT': '0', 'LC_ALL': 'C',
                         'GIT_AUTHOR_DATE': '2026-04-15T15:00:00+00:00',
                         'GIT_COMMITTER_DATE': '2026-04-15T15:00:00+00:00'})
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Lifecycle Test')
        self.git('config', 'user.email', 'lifecycle@example.invalid')
        self.git('config', 'core.autocrlf', 'false')
        self.git('config', 'commit.gpgsign', 'false')
        self.write('.gitignore', 'ignored-cache/\n')
        self.write('index.html', '<!doctype html><title>Selector fixture</title>\n')
        self.write('app/index.html', '<!doctype html><title>App fixture</title>\n')
        self.write('flows/sample/index.html', '<!doctype html><title>Flow fixture</title>\n')
        self.write('flows/sample/flow.json', json.dumps({'schema': 1, 'id': 'sample',
                                                        'label': 'Sample fixture'}))
        self.write('docs/task.md', 'Initial task documentation.\n')
        self.write('task.txt', 'initial task\n')
        self.write('unrelated.txt', 'initial unrelated\n')
        self.write('delete me.txt', 'delete this selected task file\n')
        self.write('tests/normalization.py',
                   "import pathlib, sys\n"
                   "subject=pathlib.Path(sys.argv[1])\n"
                   "assert 'App fixture' in subject.read_text(), 'visible fixture label missing'\n"
                   "print('PASS synthetic label control')\n")
        self.git('add', '--all')
        self.git('commit', '-m', 'fixture base')
        self.base = self.git('rev-parse', 'HEAD').strip()
        self.git('switch', '-c', 'work/finished-task')
        self.write('docs/task.md', 'Finished task documentation.\n')
        self.git('add', '--', 'docs/task.md')
        self.git('commit', '-m', 'finish synthetic task')
        self.finished = self.git('rev-parse', 'HEAD').strip()
        self.common = Path(self.git('rev-parse', '--path-format=absolute',
                                    '--git-common-dir').strip())
        self.store = self.common / 'pre-pr-review'

    def close(self):
        # The helper owns sibling worktrees outside root. Only the temporary parent
        # created by this fixture is disposable; never follow a record to delete it.
        self.temp.cleanup()

    def write(self, name, content, root=None):
        path = (root or self.root) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        return path

    def command(self, argv, root=None, env=None):
        if self.backend == 'legacy-worktree' and len(argv) > 1 and str(argv[0]) == sys.executable and Path(argv[1]) == SCRIPT:
            # Exercise compatibility with already deployed linked-worktree records.
            # The module seam is test-only; production CLI has no legacy-create option.
            code = ("import importlib.util,sys; "
                    "s=importlib.util.spec_from_file_location('legacy_review',sys.argv[1]); "
                    "m=importlib.util.module_from_spec(s);s.loader.exec_module(m); "
                    "m.DEFAULT_BACKEND='legacy-worktree';sys.argv=sys.argv[1:];sys.exit(m.main())")
            argv = [sys.executable, '-c', code, SCRIPT, *argv[2:]]
        return subprocess.run([str(arg) for arg in argv], cwd=root or self.root,
                              env=self.env if env is None else env,
                              capture_output=True, text=True, encoding='utf-8')

    def git(self, *args, root=None, check=True):
        result = self.command(['git', *args], root=root)
        if check and result.returncode:
            raise AssertionError(f'git {args}: {result.stderr}{result.stdout}')
        return result.stdout if check else result

    def cli(self, *args, root=None, ok=True, env=None):
        command = [sys.executable, SCRIPT, *args]
        result = self.command(command, root=root, env=env)
        if ok and result.returncode:
            raise AssertionError(f'CLI {args}: {result.stderr}{result.stdout}')
        if not ok and result.returncode == 0:
            raise AssertionError(f'CLI unexpectedly accepted {args}: {result.stdout}')
        return result

    def records(self):
        return {path.parent.name: json.loads(path.read_text(encoding='utf-8'))
                for path in self.store.glob('*/record.json')}

    def record(self, ident):
        return json.loads((self.store / ident / 'record.json').read_text(encoding='utf-8'))

    def save_record(self, record):
        path = self.store / record['id'] / 'record.json'
        path.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')

    def start(self, *args, description='Finished synthetic task', scope='docs'):
        before = set(self.records())
        result = self.cli('start', '--description', description, '--scope', scope,
                          *args, '--json')
        response = json.loads(result.stdout)
        records = self.records()
        added = set(records) - before
        if len(added) == 1:
            return records[added.pop()]
        ident = response.get('id') or response.get('record', {}).get('id')
        if ident in records:
            return records[ident]
        raise AssertionError(f'Start did not identify its review: {response}')

    def tree(self, record, kind='review'):
        return Path(record['workspaces'][kind]['path'])

    def commit_fix(self, record, content='independent technical correction\n'):
        tree = self.tree(record)
        self.write('docs/task.md', content, root=tree)
        self.git('add', '--', 'docs/task.md', root=tree)
        self.git('commit', '-m', 'fix: correct synthetic documentation', root=tree)
        return self.git('rev-parse', 'HEAD', root=tree).strip()

    def worktrees(self):
        result = self.command(['git', 'worktree', 'list', '--porcelain', '-z'])
        if result.returncode:
            raise AssertionError(result.stderr)
        return result.stdout

    def worker(self, record, role, worker_id, state='stopped'):
        self.cli('worker', record['id'], '--role', role, '--worker-id', worker_id,
                 '--state', state)

    def evidence(self, record, reviewed=None, register=True):
        """Generate real subprocess logs for a *synthetic* attestation fixture.

        Contract slots name the production commands. They are passed as an
        argument to this fixture's Python verifier, never falsely recorded as
        commands that executed the MoneyBuddy checks. Real-app coverage is tested
        separately by pre_pr_review_real_app.py.
        """
        reviewed = reviewed or self.git('rev-parse', 'HEAD', root=self.tree(record)).strip()
        directory = self.store / record['id']
        runner = directory / 'synthetic-verifier.py'
        runner.write_text('''import json, pathlib, subprocess, sys
root, expected, slot = sys.argv[1:]
actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
assert actual == expected, (actual, expected)
print(json.dumps({'fixture': 'synthetic lifecycle only', 'root': root, 'head': actual,
                  'contract_slot': slot, 'observed': 'exact real Git HEAD'}))
''', encoding='utf-8')
        checks = []
        slots = [('check-all', 'baseline', 'bash scripts/check-all.sh'),
                 ('check-all', 'final', 'bash scripts/check-all.sh'),
                 ('markdown-links', 'final', 'scripts/check-markdown-links.py')]
        if record['scopes'] != ['docs']:
            for kind, command in [('journeys', 'tests/app-journeys.cjs'),
                                  ('browser', 'tests/browser/app-journeys-browser.cjs')]:
                switch = '--against' if kind == 'journeys' else '--compare'
                slots += [(kind, 'baseline', command),
                          (kind + '-checkpoint', 'final', command + ' ' + switch + ' ' + record['finished']),
                          (kind + '-main', 'final', command + ' ' + switch + ' ' + record['main_tip'])]
        for scope in record['scopes']:
            if scope.startswith('flow:'):
                ident = scope[5:]
                for stage in ('baseline', 'final'):
                    for suffix, command in [('check', 'scripts/flows.py check --id ' + ident),
                                            ('scope', 'scripts/flows.py scope'),
                                            ('runtime', 'runtime'), ('browser', 'browser')]:
                        slots.append((f'flow-{ident}-{suffix}', stage, command))
        for ident, stage, slot in slots:
            head = record['finished'] if stage == 'baseline' else reviewed
            root = self.tree(record, 'baseline' if stage == 'baseline' else 'review')
            argv = [sys.executable, str(runner), str(root), head, slot]
            result = self.command(argv, root=root)
            if result.returncode:
                raise AssertionError(result.stderr + result.stdout)
            log = f'{stage}-{ident}.log'
            (directory / log).write_text(result.stdout + result.stderr, encoding='utf-8')
            checks.append({'id': ident, 'stage': stage, 'sha': head, 'status': 'PASS',
                           'command': json.dumps(argv), 'exit_code': result.returncode,
                           'report': log})
        report = 'independent-observations.json'
        observed = {'fixture': 'synthetic lifecycle only; no app/browser or agent acceptance',
                    'finished': record['finished'], 'reviewed': reviewed,
                    'main_tip': record['main_tip'],
                    'diff': self.git('diff', '--stat', record['finished'], reviewed, root=self.tree(record)),
                    'clean_review': not self.git('status', '--porcelain', root=self.tree(record)),
                    'tracked_scope': self.git('diff', '--name-only', record['comparison_base'], reviewed, root=self.tree(record))}
        (directory / report).write_text(json.dumps(observed, indent=2), encoding='utf-8')
        evidence = {'schema_version': 1, 'review_id': record['id'],
                    'baseline': record['finished'], 'reviewed': reviewed,
                    'main_tip': record['main_tip'], 'verifier_id': 'independent-verifier',
                    'checks': checks, 'decisions': [], 'limitations': [],
                    'harness': {'changed': False, 'report': report},
                    'cold_review': {'worker_id': 'cold-reviewer', 'baseline': record['finished'],
                                    'status': 'complete', 'report': report}}
        def comparison(base):
            return {'base': base, 'head': reviewed, 'differences': [], 'report': report,
                    'channels': {name: {'status': 'PASS', 'report': report}
                                 for name in ('phone', 'tools', 'wiring', 'tracking', 'browser')}}
        if record['scopes'] == ['docs']:
            evidence['participant_unaffected'] = {
                'reason': 'Fixture task and correction change documentation only.', 'report': report}
        else:
            evidence['comparisons'] = {'checkpoint': comparison(record['finished']),
                                       'main': comparison(record['main_tip'])}
            evidence['browser'] = {'channel': 'synthetic fixture; no browser executed',
                                   'version': 'fixture-v1', 'report': report}
        for scope in record['scopes']:
            if scope.startswith('flow:'):
                evidence.setdefault('flows', {})[scope[5:]] = {
                    'checkpoint': comparison(record['finished']),
                    'main': comparison(record['main_tip'])}
        path = directory / 'verification.json'
        path.write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
        if register:
            self.worker(record, 'reviewer', 'cold-reviewer')
            if reviewed != record['finished']:
                self.worker(record, 'fixer', 'technical-fixer')
            self.worker(record, 'verifier', evidence['verifier_id'])
        return path, evidence

    def write_evidence(self, path, evidence):
        path.write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')

    def adopt(self, record, path=None):
        if path is None:
            path, _ = self.evidence(record)
        return self.cli('adopt', record['id'], '--verification', str(path), '--json')

    def completed_with_retained_worktrees(self, record, path=None):
        """Ignored fixture files retain trees under cleanup's stronger clean gate."""
        if path is None:
            path, _ = self.evidence(record)
        for kind in ('review', 'baseline'):
            self.write('ignored-cache/fixture-retention.txt', 'fixture cleanup retention\n',
                       root=self.tree(record, kind))
        self.adopt(record, path)
        for kind in ('review', 'baseline'):
            (self.tree(record, kind) / 'ignored-cache/fixture-retention.txt').unlink()
            (self.tree(record, kind) / 'ignored-cache').rmdir()

    def interruption_env(self, prefix, *, last_arg_startswith=False):
        """POSIX integration fault: kill the helper after real Git side effects.

        This does not patch helper internals. Git is executed normally first, then
        the CLI process is interrupted at its external command boundary.
        """
        bindir = self.parent / 'interrupt-bin'
        bindir.mkdir(exist_ok=True)
        wrapper = bindir / 'git'
        real_git = shutil.which('git', path=self.env.get('PATH'))
        marker = self.parent / 'interrupted-command.json'
        wrapper.write_text('#!' + sys.executable + '\n' +
                           'import json, os, pathlib, signal, subprocess, sys\n' +
                           'args=sys.argv[1:]\n' +
                           f'code=subprocess.call([{real_git!r}, *args])\n' +
                           f'prefix={list(prefix)!r}\n' +
                           f'last_arg_startswith={last_arg_startswith!r}\n' +
                           f'marker=pathlib.Path({str(marker)!r})\n' +
                           'def matches(i):\n' +
                           ' part=args[i:i+len(prefix)]\n' +
                           ' if len(part) != len(prefix): return False\n' +
                           ' if last_arg_startswith: return part[:-1] == prefix[:-1] and part[-1].startswith(prefix[-1])\n' +
                           ' return part == prefix\n' +
                           'matched=any(matches(i) for i in range(len(args)))\n' +
                           'if code == 0 and matched and not marker.exists():\n' +
                           ' marker.write_text(json.dumps(args))\n' +
                           ' os.kill(os.getppid(), signal.SIGTERM)\n' +
                           'sys.exit(code)\n', encoding='utf-8')
        wrapper.chmod(0o755)
        env = self.env.copy()
        env['PATH'] = str(bindir) + os.pathsep + self.env.get('PATH', '')
        return env, marker


class LegacyReviewFixture(ReviewFixture):
    def __init__(self):
        super().__init__(backend='legacy-worktree')
