'use strict';
// Exercise the real pairing, repeat run, report and final gate without Chromium.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { compareGeometry } = require('./geometry.cjs');

const GEOMETRY = { x: 0, y: 24, width: 390, height: 796, clientWidth: 388, clientHeight: 638,
  scrollWidth: 388, scrollHeight: 1142, scrollLeft: 0, scrollTop: 0 };
function loadRunner() {
  const file = path.join(__dirname, 'app-journeys-browser.cjs');
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(__dirname);
  const ordinaryRequire = mod.require.bind(mod);
  mod.require = name => /playwright(?:$|\/)/.test(name) ? { chromium: {} } : ordinaryRequire(name);
  mod._compile(fs.readFileSync(file, 'utf8'), file);
  return mod.exports;
}

async function runCase(options = {}) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-browser-selftest-'));
  const runner = loadRunner();
  const argv = process.argv, body = process.env.PR_BODY, log = console.log;
  let compares = 0;
  const result = (dir, retry, head) => {
    fs.mkdirSync(dir, { recursive: true });
    const geometry = head && options.geometry ? { ...GEOMETRY, ...options.geometry } : { ...GEOMETRY };
    const side = head ? 'head' : 'base';
    const stage = retry ? 'retry' : 'initial';
    const shots = (options.twoCheckpoints ? ['000', '001'] : ['000']).flatMap(step => {
      const change = retry && options[side + 'Second'];
      if (retry && options[side + 'Missing']) return [];
      if (step === '001' && ((!head && options.baseInitiallyMissingSecond) || change === 'absent')) return [];
      const part = step === '001' && change === 'replaced' ? 'selector' : 'phone';
      const file = path.join(dir, step + '-' + part + '.png');
      fs.writeFileSync(file, 'test image');
      return [{ label: step + ' boot', step, part,
        file: step === '001' && change === 'file' ? undefined : step === '001' && change === 'unreadable' ? file + '.missing' : file,
        geometry: head && (options.missingGeometry || (retry && options.retryMissingGeometry)) || (step === '001' && change === 'geometry') ? undefined : geometry }];
    });
    return { id: 'picker-tour', variant: 'naturalLight', shots,
      failure: options[stage + side + 'Failure'] || null, pageErrors: options[stage + side + 'Errors'] || [] };
  };
  try {
    const tree = path.resolve(__dirname, '../..');
    process.argv = [process.execPath, 'app-journeys-browser.cjs', '--base', tree, '--head', tree, '--only', 'picker-tour',
      '--variants', 'naturalLight', '--out', path.join(out, 'report'), ...(options.mode ? [options.mode] : [])];
    process.env.PR_BODY = options.body || '## Phone and Tools changes\nPhone: none\nTools: declared Tools wording\n';
    console.log = () => {};
    const ok = await runner.main({ launch: async () => ({ close: async () => {} }),
      runTree: async (browser, tree, plan, dir) => [result(dir, false, dir.endsWith('/head'))],
      runOne: async (browser, tree, variant, journey, dir) => result(dir, true, dir.endsWith('/head')),
      openComparer: async () => ({ close: async () => {}, compare: async () => ({ sameSize: true, sizeA: [390, 1324], sizeB: [390, 1324],
        diffPixels: options.pixelChanged && ++compares === 1 ? 1000 : 0, totalPixels: 516360, diffPng: null }) }),
    });
    const data = JSON.parse(fs.readFileSync(path.join(out, 'report/results.json'), 'utf8'));
    return { ok, ...data, html: fs.readFileSync(path.join(out, 'report/index.html'), 'utf8') };
  } finally {
    process.argv = argv;
    if (body === undefined) delete process.env.PR_BODY; else process.env.PR_BODY = body;
    console.log = log;
    fs.rmSync(out, { recursive: true, force: true });
  }
}

async function run() {
  assert.equal(compareGeometry(GEOMETRY, { ...GEOMETRY }).same, true);
  assert.equal(compareGeometry(GEOMETRY, { ...GEOMETRY, x: 1 }).same, false);
  assert.equal(compareGeometry(GEOMETRY, { ...GEOMETRY, scrollTop: 1 }).same, false);
  assert.equal(compareGeometry(undefined, undefined).same, false);
  assert.equal(compareGeometry(GEOMETRY, undefined).validAfter, false);
  assert.equal((await runCase()).ok, true);
  const shorter = await runCase({ geometry: { height: 676, clientHeight: 518 }, mode: '--allow-declared' });
  assert.equal(shorter.ok, false, 'declared Tools changes cannot waive Phone geometry');
  assert.equal(shorter.summary.phoneChanged, 1);
  assert.equal(shorter.summary.toolsChanged, 0);
  assert.equal(shorter.summary.flaky, 0);
  assert.match(shorter.html, /Phone height: 796 → 676 px/);
  const scroll = await runCase({ geometry: { scrollTop: 1 } });
  assert.equal(scroll.ok, false);
  assert.equal(scroll.summary.phoneChanged, 1);
  const missing = await runCase({ missingGeometry: true });
  assert.equal(missing.ok, false);
  assert.equal(missing.summary.flaky, 0);

  const healthy = await runCase({ pixelChanged: true });
  assert.equal(healthy.ok, true);
  assert.equal(healthy.summary.flaky, 1);
  assert.equal(healthy.summary.broken, 0);
  const declared = '## Phone and Tools changes\nPhone: approved picture changes\nTools: approved Tools changes\n';
  for (const mode of [undefined, '--report', '--allow-declared']) {
    for (const problem of [
      { retryheadFailure: 'control disappeared on the retry' },
      { retryheadErrors: ['new retry page error'] },
      { retrybaseFailure: 'before stopped', retryheadFailure: 'after stopped' },
      { headMissing: true },
      { retryMissingGeometry: true },
    ]) {
      const broken = await runCase({ pixelChanged: true, mode, body: declared, ...problem });
      assert.equal(broken.ok, false, JSON.stringify({ mode, problem }));
      assert.equal(broken.summary.brokenAfter, 1);
      assert.equal(broken.summary.flaky, 0);
      assert.ok(broken.rows[0].retry);
      assert.match(broken.html, /Repeat check/);
    }
  }
  const stopped = await runCase({ pixelChanged: true, retryheadFailure: 'control disappeared on the retry',
    retryheadErrors: ['new retry page error'], mode: '--report' });
  assert.equal(stopped.rows[0].retry.headFailure, 'control disappeared on the retry');
  assert.deepEqual(stopped.rows[0].pageErrors, ['new retry page error']);
  assert.match(stopped.html, /control disappeared on the retry/);
  assert.match(stopped.html, /new retry page error/);
  for (const mode of [undefined, '--report', '--allow-declared']) {
    const beforeOnly = await runCase({ pixelChanged: true, retrybaseFailure: 'before stopped', mode, body: declared });
    assert.equal(beforeOnly.summary.brokenBeforeOnly, 1);
    assert.equal(beforeOnly.summary.brokenAfter, 0);
    assert.equal(beforeOnly.summary.flaky, 0);
    assert.equal(beforeOnly.ok, !!mode);
  }
  const firstFailure = await runCase({ pixelChanged: true, initialheadFailure: 'first run stopped', mode: '--report' });
  assert.equal(firstFailure.ok, false);
  assert.equal(firstFailure.rows[0].headFailure, 'first run stopped');
  const firstError = await runCase({ pixelChanged: true, initialheadErrors: ['first page error'], mode: '--report' });
  assert.equal(firstError.ok, false);
  assert.deepEqual(firstError.rows[0].headPageErrors, ['first page error']);
  assert.deepEqual(firstError.rows[0].pageErrors, ['first page error']);
  const beforeMissing = await runCase({ pixelChanged: true, baseMissing: true, mode: '--report' });
  assert.equal(beforeMissing.ok, true);
  assert.equal(beforeMissing.summary.brokenBeforeOnly, 1);
  assert.equal(beforeMissing.summary.flaky, 0);
  const commonErrors = await runCase({ pixelChanged: true, retrybaseErrors: ['shared error'], retryheadErrors: ['shared error'] });
  assert.deepEqual(commonErrors.rows[0].retry.basePageErrors, ['shared error']);
  assert.deepEqual(commonErrors.rows[0].retry.headPageErrors, ['shared error']);
  assert.equal(commonErrors.summary.flaky, 0, 'page errors do not provide a healthy repeat');
  const complete = await runCase({ pixelChanged: true, twoCheckpoints: true });
  assert.equal(complete.ok, true);
  assert.equal(complete.summary.flaky, 1);
  assert.equal(complete.rows[0].items[1].status, 'same');
  for (const mode of [undefined, '--report', '--allow-declared']) {
    for (const headSecond of ['absent', 'replaced', 'geometry', 'file', 'unreadable']) {
      const incomplete = await runCase({ pixelChanged: true, twoCheckpoints: true, headSecond, mode, body: declared });
      assert.equal(incomplete.ok, false, JSON.stringify({ mode, headSecond }));
      assert.equal(incomplete.summary.brokenAfter, 1);
      assert.equal(incomplete.summary.flaky, 0);
      assert.deepEqual(incomplete.rows[0].retry.missingAfter, ['001 phone']);
      assert.equal(incomplete.rows[0].items[1].status, 'same', 'the lost checkpoint initially matched');
      assert.match(incomplete.html, /Missing after: 001 phone/);
    }
    const beforeIncomplete = await runCase({ pixelChanged: true, twoCheckpoints: true, baseSecond: 'absent', mode, body: declared });
    assert.equal(beforeIncomplete.summary.brokenBeforeOnly, 1);
    assert.equal(beforeIncomplete.summary.flaky, 0);
    assert.equal(beforeIncomplete.ok, !!mode);
    const expectedAbsent = await runCase({ pixelChanged: true, twoCheckpoints: true, baseInitiallyMissingSecond: true,
      initialbaseFailure: 'before initially stopped', retrybaseFailure: 'before stopped again', mode, body: declared });
    assert.deepEqual(expectedAbsent.rows[0].retry.missingBefore, [], 'initially absent before-only frames are not required');
    assert.equal(expectedAbsent.summary.brokenAfter, 0);
    assert.equal(expectedAbsent.summary.brokenBeforeOnly, 1);
    assert.equal(expectedAbsent.ok, !!mode);
  }
  return true;
}

module.exports = { run, runCase };
