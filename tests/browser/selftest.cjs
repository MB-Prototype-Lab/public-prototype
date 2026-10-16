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
    const file = path.join(dir, '000-phone.png');
    fs.writeFileSync(file, 'test image');
    const geometry = head && options.geometry ? { ...GEOMETRY, ...options.geometry } : { ...GEOMETRY };
    return { id: 'picker-tour', variant: 'naturalLight', shots: [{ label: '000 boot', step: '000', part: 'phone', file,
      geometry: head && options.missingGeometry ? undefined : geometry }], failure: null, pageErrors: [] };
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
  return true;
}

module.exports = { run, runCase };
