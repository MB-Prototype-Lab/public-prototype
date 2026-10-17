#!/usr/bin/env python3
"""Opt-in real-app preservation and regression controls; never a unittest.

Run with an installed Node 22+ and Playwright/Chromium, for example:
python3 tests/pre_pr_review_real_app.py --source . --commit HEAD --out /tmp/review-evidence
MB_PLAYWRIGHT_MODULE and browser/library environment settings are inherited.
No installation occurs. Only a disposable local clone changes; evidence and the
clone are retained. These selected checks do not replace check-all or native
Windows desktop acceptance.
"""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def exercise(args):
    source = args.source.resolve()
    evidence = args.out.resolve()
    if evidence.exists() and any(evidence.iterdir()):
        raise RuntimeError('Evidence destination must be new or empty: ' + str(evidence))
    evidence.mkdir(parents=True, exist_ok=True)
    node = shutil.which(args.node)
    if not node:
        raise RuntimeError('Node executable unavailable: ' + args.node)
    env = os.environ.copy()
    env['PATH'] = str(Path(node).parent) + os.pathsep + env.get('PATH', '')
    if not env.get('MB_PLAYWRIGHT_MODULE'):
        installed = source / 'tests/browser/node_modules/playwright'
        if installed.exists():
            env['MB_PLAYWRIGHT_MODULE'] = str(installed)
    parent = Path(tempfile.mkdtemp(prefix='mb real app review ')).resolve()
    clone = parent / 'committed snapshot'
    results = []

    def run(name, argv, cwd=None, expected=0, contains=()):
        argv = [str(value) for value in argv]
        result = subprocess.run(argv, cwd=cwd or clone, env=env, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                encoding='utf-8')
        log = evidence / (name + '.log')
        log.write_text(result.stdout, encoding='utf-8')
        entry = {'name': name, 'command': argv, 'cwd': str(cwd or clone),
                 'exit_code': result.returncode, 'expected_exit_code': expected,
                 'log': str(log), 'assertions': list(contains)}
        results.append(entry)
        (evidence / 'commands.json').write_text(json.dumps({
            'source': str(source), 'requested_commit': args.commit,
            'disposable_root': str(parent), 'results': results}, indent=2) + '\n', encoding='utf-8')
        print(f'{name}: exit {result.returncode}', flush=True)
        if result.returncode != expected:
            raise AssertionError(f'{name}: expected exit {expected}, observed {result.returncode}; see {log}')
        for text in contains:
            if text not in result.stdout:
                raise AssertionError(f'{name}: intended evidence {text!r} absent; see {log}')
        return result.stdout.strip()

    def git(*argv):
        return run('git-' + str(len(results)), ['git', *argv])

    def original_state():
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, env=env)
        status = subprocess.check_output(['git', 'status', '--porcelain', '-z',
                                           '--untracked-files=all'], cwd=source, env=env)
        return head, status

    before = original_state()
    resolved = run('resolve-source', ['git', 'rev-parse', '--verify', args.commit + '^{commit}'], cwd=source)
    node_version = run('node-version', [node, '--version'], cwd=source)
    python_version = run('python-version', [sys.executable, '--version'], cwd=source)
    git_version = run('git-version', ['git', '--version'], cwd=source)
    if int(node_version.lstrip('v').split('.')[0]) < 22:
        raise RuntimeError('Node 22+ required; observed ' + node_version)
    browser_version = json.loads(run('browser-version', [node, '-e',
        "const spec=process.env.MB_PLAYWRIGHT_MODULE||'./tests/browser/node_modules/playwright';"
        "const pw=require(spec),version=require(spec+'/package.json').version;"
        "(async()=>{const b=await pw.chromium.launch({headless:true,"
        "args:['--disable-partial-raster',...JSON.parse(process.env.MB_CHROMIUM_ARGS||'[]')],"
        "...(process.env.MB_CHROMIUM_EXECUTABLE?{executablePath:process.env.MB_CHROMIUM_EXECUTABLE}:{})});"
        "console.log(JSON.stringify({channel:'chromium',version:b.version(),playwright_version:version}));"
        "await b.close()})().catch(e=>{console.error(e);process.exitCode=1})"], cwd=source))
    run('clone', ['git', 'clone', '--quiet', '--no-hardlinks', '--no-checkout',
                  str(source), str(clone)], cwd=parent)
    git('checkout', '--quiet', '--detach', resolved)
    git('config', 'user.name', 'Actual app acceptance fixture')
    git('config', 'user.email', 'acceptance@example.invalid')
    git('config', 'commit.gpgsign', 'false')
    git('config', 'core.autocrlf', 'false')
    finished = git('rev-parse', 'HEAD')
    assert finished == resolved
    git('switch', '-c', 'probe/neutral')
    # Never print or inspect protected datasets. This is a comment-only control.
    path = clone / 'app/js/theme.js'
    path.write_text(path.read_text(encoding='utf-8') +
                    '\n// Actual-app preservation acceptance control.\n', encoding='utf-8')
    git('add', '--', 'app/js/theme.js')
    git('commit', '--quiet', '-m', 'Comment-only preservation control')
    neutral = git('rev-parse', 'HEAD')
    run('neutral-journeys', [node, 'tests/app-journeys.cjs', '--against', finished,
        '--only', 'picker-tour', '--out', evidence / 'neutral-journeys'], contains=(
            'Participant (phone): none', 'Tools: none', 'Wiring (other): none'))
    run('baseline-esf-journeys', [node, 'tests/app-journeys.cjs', '--against', finished,
        '--only', 'esf-full', '--out', evidence / 'baseline-esf-journeys'], contains=(
            'Participant (phone): none',))
    run('neutral-browser', [node, 'tests/browser/app-journeys-browser.cjs', '--compare',
        finished, '--only', 'picker-tour', '--variants', 'naturalLight', '--out',
        evidence / 'neutral-browser'], contains=('Phone pictures changed: 0', 'PASS'))

    # Normal phone height can change even when tall screenshots and VM content match.
    git('switch', '-c', 'probe/geometry', neutral)
    path = clone / 'app/css/layout.css'
    path.write_text(path.read_text(encoding='utf-8') +
        '\n.phone { height: 700px; max-height: calc(100vh - 168px); }\n', encoding='utf-8')
    git('add', '--', 'app/css/layout.css')
    git('commit', '--quiet', '-m', 'Probe normal phone geometry regression')
    geometry = git('rev-parse', 'HEAD')
    run('geometry-journeys', [node, 'tests/app-journeys.cjs', '--against', finished,
        '--only', 'picker-tour', '--out', evidence / 'geometry-journeys'], contains=(
            'Participant (phone): none',))
    run('geometry-browser', [node, 'tests/browser/app-journeys-browser.cjs', '--compare',
        finished, '--only', 'picker-tour', '--variants', 'naturalLight', '--out',
        evidence / 'geometry-browser'], expected=1, contains=('FAIL', 'height'))

    git('switch', '-c', 'probe/phone-label', neutral)
    path = clone / 'app/screens/esf-build.js'
    text = path.read_text(encoding='utf-8')
    assert 'Build my fund' in text, 'Update fixture: expected ESF control label unavailable'
    path.write_text(text.replace('Build my fund', 'Build my plan'), encoding='utf-8')
    git('add', '--', 'app/screens/esf-build.js')
    git('commit', '--quiet', '-m', 'Probe emergency-fund control regression')
    phone = git('rev-parse', 'HEAD')
    run('phone-journeys', [node, 'tests/app-journeys.cjs', '--against', finished,
        '--only', 'esf-full', '--out', evidence / 'phone-journeys'], expected=1,
        contains=('Build my fund', 'Build my plan', 'JOURNEY'))

    # Dropping a feature lets the reviewed harness hide the real broken control.
    path = clone / 'tests/app-journeys/journeys/04-esf-full.cjs'
    text = path.read_text(encoding='utf-8')
    start = text.index('  steps: p =>')
    path.write_text(text[:start] + '  steps: p => skipToProfile(p),\n};\n', encoding='utf-8')
    git('add', '--', 'tests/app-journeys/journeys/04-esf-full.cjs')
    git('commit', '--quiet', '-m', 'Probe deliberately weakened journey coverage')
    weakened = git('rev-parse', 'HEAD')
    run('weakened-reviewed-harness', [node, 'tests/app-journeys.cjs', '--against', finished,
        '--only', 'esf-full', '--out', evidence / 'weakened-reviewed-harness'], contains=(
            'Participant (phone): none',))
    checkpoint = parent / 'unchanged checkpoint harness'
    git('worktree', 'add', '--detach', str(checkpoint), finished)
    run('checkpoint-harness-detects', [node, checkpoint / 'tests/app-journeys.cjs',
        '--folder', clone / 'app', '--only', 'esf-full'], cwd=checkpoint, expected=1,
        contains=('Build my fund', 'Build my plan', 'JOURNEY'))
    assert not git('status', '--porcelain')
    assert original_state() == before, 'Source checkout changed during disposable exercise'
    summary = {'source': str(source), 'requested_commit': args.commit, 'finished': finished,
               'neutral': neutral, 'geometry': geometry, 'phone': phone, 'weakened': weakened,
               'clone': str(clone), 'checkpoint': str(checkpoint), 'node': node,
               'node_version': node_version,
               'python_version': python_version, 'git_version': git_version,
               'playwright_version': browser_version['playwright_version'],
               'browser': browser_version,
               'environment': {key: env.get(key) for key in (
                   'MB_PLAYWRIGHT_MODULE', 'PLAYWRIGHT_BROWSERS_PATH', 'LD_LIBRARY_PATH',
                   'MB_CHROMIUM_ARGS', 'MB_CHROMIUM_EXECUTABLE')},
               'results': results, 'limitations': [
                   'Selected journeys and naturalLight only; not full verification.',
                   'No native Windows desktop acceptance is implied.']}
    (evidence / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print('PASS actual-app controls; evidence ' + str(evidence), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--commit', default='HEAD', help='Exact committed source revision to clone')
    parser.add_argument('--out', type=Path, required=True, help='New or empty evidence directory')
    parser.add_argument('--node', default=os.environ.get('MB_NODE', 'node'))
    exercise(parser.parse_args())
