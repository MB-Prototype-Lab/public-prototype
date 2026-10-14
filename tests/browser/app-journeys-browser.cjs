#!/usr/bin/env node
'use strict';
// Real-browser journeys: replays the journeys marked `browser: true` in
// Chromium, in all four themes at phone width plus Tools at desktop width, on
// two copies of the repository (before and after), screenshots every new view,
// compares the pictures and writes a report a PM can open.
//
//   node tests/browser/app-journeys-browser.cjs --base DIR --head DIR --out DIR
//        [--only id,id] [--variants naturalLight,dark,...] [--allow-declared]
//
//   --compare REF   instead of --base: check REF out into a temporary worktree
//   --allow-declared  do not fail on changes the PR body declares (CI)
//
// Needs Playwright: (cd tests/browser && npm ci && npx playwright install chromium).

const { ensurePinnedEnv, PRELUDE_SRC, hashSeed } = require('../lib/determinism.cjs');
ensurePinnedEnv();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const controls = require('../lib/controls.cjs');
const { REPO, DEFAULT_CLOCK } = require('../lib/app-vm.cjs');
const { mediaDurations, shimSource } = require('./media-shim.cjs');
const { openComparer } = require('./pixels.cjs');
const { writeReport } = require('./report.cjs');
const journeysApi = require('../app-journeys.cjs');

const { chromium } = require(process.env.MB_PLAYWRIGHT_MODULE || path.join(__dirname, 'node_modules', 'playwright'));

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const SETTLE_MS = 450;
const FAIL_RATIO = 0.0005;          // more than 0.05% of pixels
const VARIANTS = [
  { id: 'naturalLight', theme: 'naturalLight', viewport: PHONE, shot: 'main.phone' },
  { id: 'light', theme: 'light', viewport: PHONE, shot: 'main.phone' },
  { id: 'dark', theme: 'dark', viewport: PHONE, shot: 'main.phone' },
  { id: 'naturalDark', theme: 'naturalDark', viewport: PHONE, shot: 'main.phone' },
  { id: 'tools-desktop', theme: 'naturalLight', viewport: DESKTOP, shot: '.page', tools: true },
];
// Grow the phone frame by however far the screen scrolls, so one picture holds
// the whole view; restored right after the picture.
async function growPhone(page) {
  return page.evaluate(() => {
    const sr = document.getElementById('screenRoot'), ph = document.querySelector('main.phone');
    if (!sr || !ph) return null;
    const before = ph.getAttribute('style');
    const extra = Math.max(0, sr.scrollHeight - sr.clientHeight);
    ph.style.maxHeight = 'none';
    ph.style.height = (ph.getBoundingClientRect().height + extra) + 'px';
    return before;
  }).catch(() => null);
}
async function restorePhone(page, before) {
  await page.evaluate(b => { const ph = document.querySelector('main.phone'); if (!ph) return; if (b === null) ph.removeAttribute('style'); else ph.setAttribute('style', b); }, before).catch(() => {});
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i], next = () => argv[++i];
    if (v === '--base') a.base = next();
    else if (v === '--head') a.head = next();
    else if (v === '--out') a.out = next();
    else if (v === '--compare') a.compare = next();
    else if (v === '--only') a.only = next().split(',');
    else if (v === '--variants') a.variants = next().split(',');
    else if (v === '--allow-declared') a.allowDeclared = true;
    else throw new Error('unknown argument ' + v);
  }
  return a;
}

// RegExps cannot cross into the page as-is.
const pack = q => JSON.parse(JSON.stringify(q, (k, v) => (v instanceof RegExp ? { __re: [v.source, v.flags] } : v)));
const REVIVE = `function (q) { return JSON.parse(JSON.stringify(q), function (k, v) { return v && v.__re ? new RegExp(v.__re[0], v.__re[1]) : v; }); }`;

class StepError extends Error {}

async function newPage(browser, tree, variant, seedId) {
  const ctx = await browser.newContext({ viewport: variant.viewport, deviceScaleFactor: 1, locale: 'en-US',
    timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light' });
  await ctx.addInitScript({ content: controls.SOURCE });
  await ctx.addInitScript({ content: 'window.__mbReviveQuery = ' + REVIVE + ';' });
  await ctx.addInitScript({ content: 'window.__mbSeed = ' + hashSeed(seedId) + ';\n' + PRELUDE_SRC });
  await ctx.addInitScript({ content: shimSource(mediaDurations(path.join(tree, 'app'))) });
  const page = await ctx.newPage();
  await page.clock.install({ time: DEFAULT_CLOCK });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));
  return { ctx, page, errors };
}

async function waitApp(page) {
  await page.waitForFunction(() => typeof state !== 'undefined' && !!state.screen, null, { timeout: 15000 });
}

async function settle(page, seed) {
  await page.evaluate(s => { if (window.__mbReseed) window.__mbReseed(s); }, seed).catch(() => {});
  await page.clock.runFor(SETTLE_MS);
  await page.evaluate(() => Promise.all(Array.from(document.images).filter(i => !i.complete)
    .map(i => new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))))
    .catch(() => {});
}

async function find(page, query) {
  const res = await page.evaluate(q => {
    try {
      const c = window.__mbControls.findControl(document, window.__mbReviveQuery(q));
      window.__mbTarget = c.el;
      return { ok: true, desc: window.__mbControls.describe(c), disabled: c.disabled, role: c.role };
    } catch (e) { return { ok: false, message: String(e.message || e) }; }
  }, pack(query));
  if (!res.ok) throw new StepError(res.message);
  return Object.assign(res, { handle: await page.evaluateHandle(() => window.__mbTarget) });
}

async function click(handle) {
  await handle.click({ timeout: 5000 });
}

async function typeText(page, query, text, commit) {
  const f = await find(page, query);
  if (f.disabled) throw new StepError('field is disabled: ' + f.desc);
  await click(f.handle);
  const keyHandle = label => page.evaluateHandle(l => {
    const root = document.getElementById('keyboardRoot');
    return root ? Array.from(root.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === l) || null : null;
  }, label);
  const has = async label => (await (await keyHandle(label)).jsonValue()) !== null;
  const press = async label => { const h = await keyHandle(label); if (await h.jsonValue() === null) return false; await h.asElement().click({ timeout: 5000 }); return true; };
  const open = () => page.evaluate(() => !!(state.kbd && state.kbd.open));
  for (const ch of text) {
    if (!(await open())) { await page.keyboard.type(ch); continue; }
    const label = ch === ' ' ? 'space' : ch.toLowerCase();
    let found = await has(label);
    for (const sw of ['123', '#+=', 'ABC', '123']) { if (found) break; if (await has(sw)) await press(sw); found = await has(label); }
    if (!found) throw new StepError('no key for "' + ch + '"');
    if (ch !== ch.toLowerCase()) await press('⇧');
    await press(label);
  }
  if (commit) {
    if (await open()) { if (!(await press('return'))) { const d = page.locator('#keyboardRoot .kbd-done'); if (await d.count()) await d.click(); } }
    else await page.keyboard.press('Tab');
  }
}

async function runSteps(page, journey, variant, steps, id, shoot) {
  let lastKey = null;
  const checkpoint = async (label, force) => {
    const key = await page.evaluate(() => (typeof scrollKey === 'function' ? scrollKey() : (typeof state !== 'undefined' ? state.screen : location.pathname))).catch(() => 'navigated');
    if (key !== lastKey || force) await shoot(label, key);
    lastKey = key;
  };
  await checkpoint('000 boot', true);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let label = String(i + 1).padStart(3, '0') + ' ' + step.op;
    switch (step.op) {
      case 'tap': {
        const f = await find(page, step.query);
        label += ' ' + f.desc;
        if (f.disabled && !step.expectDisabled) throw new StepError('control is disabled: ' + f.desc);
        if (!f.disabled) await click(f.handle);
        break;
      }
      case 'type': label += ' ' + JSON.stringify(step.text); await typeText(page, step.query, step.text, step.commit); break;
      case 'choose': {
        const f = await find(page, step.query);
        const o = step.option;
        const opt = o instanceof RegExp ? await f.handle.evaluate((el, src) => { const re = new RegExp(src[0], src[1]); const m = Array.from(el.options).find(x => re.test(x.text) || re.test(x.value)); return m ? { value: m.value } : null; }, [o.source, o.flags])
          : o && typeof o === 'object' ? { index: o.index } : await f.handle.evaluate((el, want) => { const m = Array.from(el.options).find(x => x.value === want || x.text === want); return m ? { value: m.value } : null; }, String(o));
        if (!opt) throw new StepError('no option ' + o + ' in ' + f.desc);
        await f.handle.selectOption(opt);
        label += ' ' + f.desc;
        break;
      }
      case 'slide': {
        const f = await find(page, step.query);
        await f.handle.evaluate((el, v) => { el.focus(); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, step.value);
        await page.clock.runFor(SETTLE_MS);
        await f.handle.evaluate(el => { if (el.isConnected) el.dispatchEvent(new Event('change', { bubbles: true })); });
        break;
      }
      case 'check': {
        const f = await find(page, step.query);
        if ((await f.handle.evaluate(el => !!el.checked)) !== step.on) await click(f.handle);
        break;
      }
      case 'call':
        await page.evaluate(src => (0, eval)(src), step.fn + '(' + step.args.map(a => JSON.stringify(a)).join(', ') + ')');
        label += ' ' + step.fn + '(' + step.args.join(', ') + ')';
        break;
      case 'wait': await page.clock.runFor(step.ms); label += ' ' + step.ms + 'ms'; break;
      case 'back': await page.evaluate(() => history.back()); await page.clock.runFor(50); break;
      case 'expect': {
        const w = step.what;
        const s = await page.evaluate(() => state.screen);
        if (w.screen && s !== w.screen) throw new StepError('expected screen ' + w.screen + ', on ' + s);
        continue;
      }
      case 'note': continue;
      default: throw new StepError('step "' + step.op + '" is not supported in the browser');
    }
    await settle(page, hashSeed(id + ':' + (i + 1)));
    await checkpoint(label, i === steps.length - 1);
  }
}

// The selector gate around the app: passcode, Local Prototype, refresh without
// and with the pin. Browser only; the VM journeys start inside the app.
const GATE_JOURNEY = { id: 'gate', title: 'Passcode, selector, Local Prototype, refresh without and with Pin on refresh' };

async function runGate(page, tree, shoot) {
  const root = pathToFileURL(path.join(tree, 'index.html')).href;
  await page.goto(root);
  await shoot('000 passcode', 'passcode');
  await page.fill('#gateInput', '1337');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#selectorScreen', { state: 'visible' });
  await shoot('001 selector', 'selector');
  await page.getByRole('link', { name: 'Local Prototype', exact: true }).click();
  await waitApp(page);
  await settle(page, hashSeed('gate:2'));
  await shoot('002 Local Prototype', 'app');
  await page.reload();
  await page.waitForSelector('#selectorScreen', { state: 'visible' });
  await shoot('003 refresh returns to the selector', 'selector-again');
  await page.getByRole('link', { name: 'Local Prototype', exact: true }).click();
  await waitApp(page);
  await page.click('#adminExpandTab');
  await page.getByLabel('Pin on refresh', { exact: true }).check();
  await settle(page, hashSeed('gate:5'));
  await shoot('004 Pin on refresh checked', 'pinned');
  await page.reload();
  await waitApp(page);
  await settle(page, hashSeed('gate:6'));
  await shoot('005 pinned refresh restarts the app', 'restarted');
  await page.getByRole('button', { name: 'Exit Prototype', exact: true }).click();
  await page.waitForSelector('#selectorScreen', { state: 'visible' });
  await shoot('006 Exit Prototype', 'exited');
}

async function runOne(browser, tree, variant, journey, outDir) {
  const variantParams = journey.matrix === 'profiles' ? { id: 'at_at', params: { tier: 'at', level: 'at' } } : null;
  const id = journey.id + (variantParams ? '@' + variantParams.id : '');
  const steps = typeof journey.steps === 'function' ? journey.steps(variantParams.params) : journey.steps;
  const { ctx, page, errors } = await newPage(browser, tree, variant, id + ':boot');
  const shots = [];
  const dir = path.join(outDir, variant.id, journey.id);
  fs.mkdirSync(dir, { recursive: true });
  const shoot = async (label, key) => {
    const file = path.join(dir, String(shots.length).padStart(3, '0') + '.png');
    const inApp = page.url().includes('/app/');
    const before = inApp ? await growPhone(page) : null;
    await page.locator(inApp ? variant.shot : 'body').first().screenshot({ path: file, animations: 'disabled', caret: 'hide', mask: [page.locator('video')] });
    if (inApp) await restorePhone(page, before);
    shots.push({ label, key, file });
  };
  let failure = null;
  try {
    if (journey === GATE_JOURNEY) await runGate(page, tree, shoot);
    else {
      await page.goto(pathToFileURL(path.join(tree, 'app', 'index.html')).href);
      await waitApp(page);
      await page.evaluate(t => themeSet(t), variant.theme);
      if (variant.tools) await page.evaluate(() => { state.adminCollapsed = false; render(); });
      await settle(page, hashSeed(id + ':0'));
      await runSteps(page, journey, variant, steps, id, shoot);
    }
  } catch (err) {
    failure = (err instanceof StepError ? '' : 'harness: ') + String(err && err.message || err).split('\n')[0];
  }
  await ctx.close();
  return { id: journey.id, variant: variant.id, shots, failure, pageErrors: errors };
}

async function runTree(browser, tree, plan, outDir) {
  const results = [];
  // Variants in parallel, journeys in order within each.
  await Promise.all(plan.map(async ({ variant, journeys }) => {
    for (const j of journeys) results.push(await runOne(browser, tree, variant, j, outDir));
  }));
  return results;
}

function git(args) { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = path.resolve(args.out || path.join(REPO, '.journeys', 'browser'));
  const head = path.resolve(args.head || REPO);
  let base = args.base ? path.resolve(args.base) : null;
  let cleanup = null;
  if (!base && args.compare) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-browser-base-'));
    base = path.join(dir, 'base');
    git(['worktree', 'add', '--detach', '--quiet', base, args.compare]);
    cleanup = () => { try { git(['worktree', 'remove', '--force', base]); } catch (e) {} fs.rmSync(dir, { recursive: true, force: true }); };
  }
  if (!base) throw new Error('give --base DIR or --compare REF');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const all = journeysApi.loadJourneys(args.only);
  const subset = all.filter(j => j.browser);
  const tour = all.filter(j => j.id === 'tools-tour');
  const variants = VARIANTS.filter(v => !args.variants || args.variants.includes(v.id));
  const plan = variants.map(v => ({ variant: v, journeys: v.tools ? subset.concat(tour, args.only ? [] : [GATE_JOURNEY]) : subset }));

  const browser = await chromium.launch({ headless: true, args: JSON.parse(process.env.MB_CHROMIUM_ARGS || '[]'),
    ...(process.env.MB_CHROMIUM_EXECUTABLE ? { executablePath: process.env.MB_CHROMIUM_EXECUTABLE } : {}) });
  let ok = true;
  try {
    const t0 = Date.now();
    const baseRes = await runTree(browser, base, plan, path.join(out, 'shots', 'base'));
    const headRes = await runTree(browser, head, plan, path.join(out, 'shots', 'head'));
    const comparer = await openComparer(browser);
    const rows = [];
    for (const h of headRes) {
      const b = baseRes.find(r => r.id === h.id && r.variant === h.variant);
      const n = Math.max(b.shots.length, h.shots.length);
      const items = [];
      for (let i = 0; i < n; i++) {
        const bs = b.shots[i], hs = h.shots[i];
        const item = { label: (hs || bs).label, base: bs && path.relative(out, bs.file), head: hs && path.relative(out, hs.file) };
        if (!bs || !hs) item.status = 'missing';
        else {
          const r = await comparer.compare(fs.readFileSync(bs.file), fs.readFileSync(hs.file));
          const changed = !r.sameSize || r.diffPixels / r.totalPixels > FAIL_RATIO;
          item.status = changed ? 'changed' : 'same';
          item.diffPixels = r.diffPixels; item.size = [r.sizeA, r.sizeB];
          if (r.diffPng && changed) {
            const file = path.join(out, 'diffs', h.variant, h.id, String(i).padStart(3, '0') + '.png');
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, Buffer.from(r.diffPng.split(',')[1], 'base64'));
            item.diff = path.relative(out, file);
          }
        }
        items.push(item);
      }
      rows.push({ id: h.id, variant: h.variant, items, baseFailure: b.failure, headFailure: h.failure,
        pageErrors: h.pageErrors.filter(e => !b.pageErrors.includes(e)) });
    }
    // A difference must reproduce: re-run both sides of each changed journey once.
    for (const row of rows.filter(r => r.items.some(i => i.status === 'changed'))) {
      const variant = variants.find(v => v.id === row.variant);
      const journey = row.id === 'gate' ? GATE_JOURNEY : all.find(j => j.id === row.id);
      const tmp = path.join(out, 'recheck');
      const b2 = await runOne(browser, base, variant, journey, path.join(tmp, 'base'));
      const h2 = await runOne(browser, head, variant, journey, path.join(tmp, 'head'));
      for (const [i, item] of row.items.entries()) {
        if (item.status !== 'changed' || !b2.shots[i] || !h2.shots[i]) continue;
        const r = await comparer.compare(fs.readFileSync(b2.shots[i].file), fs.readFileSync(h2.shots[i].file));
        if (r.sameSize && r.diffPixels / r.totalPixels <= FAIL_RATIO) item.status = 'flaky';
      }
    }
    await comparer.close();

    const body = process.env.PR_BODY || '';
    const phoneDeclared = args.allowDeclared && !/^none\.?$/i.test(journeysApi.declared(body, 'Participant') || 'none');
    const toolsDeclared = args.allowDeclared && !/^none\.?$/i.test(journeysApi.declared(body, 'Tools') || 'none');
    const summary = { base: describeTree(base), head: describeTree(head), seconds: Math.round((Date.now() - t0) / 1000), phoneChanged: 0, toolsChanged: 0, flaky: 0, failures: 0 };
    for (const row of rows) {
      const changed = row.items.filter(i => i.status === 'changed' || i.status === 'missing').length;
      if (row.variant === 'tools-desktop') summary.toolsChanged += changed; else summary.phoneChanged += changed;
      summary.flaky += row.items.filter(i => i.status === 'flaky').length;
      if (row.baseFailure !== row.headFailure || row.pageErrors.length) summary.failures++;
    }
    const report = writeReport(out, rows, summary, VARIANTS);
    console.log('Browser journeys: ' + rows.length + ' runs per side, ' + rows.reduce((n, r) => n + r.items.length, 0) + ' screenshots compared in ' + summary.seconds + 's');
    for (const row of rows) {
      const bad = row.items.filter(i => i.status !== 'same');
      if (!bad.length && !row.headFailure && !row.baseFailure && !row.pageErrors.length) continue;
      console.log('  ' + row.variant + ' / ' + row.id + ': ' + bad.map(i => i.status + ' @ ' + i.label).join('; ') +
        (row.baseFailure || row.headFailure ? ' [before: ' + (row.baseFailure || 'ok') + ' | after: ' + (row.headFailure || 'ok') + ']' : '') +
        (row.pageErrors.length ? ' [new page errors: ' + row.pageErrors.join(' | ') + ']' : ''));
    }
    console.log('Phone pictures changed: ' + summary.phoneChanged + ' · Tools pictures changed: ' + summary.toolsChanged + ' · flaky (did not reproduce): ' + summary.flaky + ' · journeys that broke: ' + summary.failures);
    console.log('Report: ' + pathToFileURL(report).href);
    if (summary.failures) ok = false;
    if (summary.phoneChanged && !phoneDeclared) ok = false;
    if (summary.toolsChanged && !toolsDeclared) ok = false;
  } finally {
    await browser.close();
    if (cleanup) cleanup();
  }
  console.log(ok ? 'PASS' : 'FAIL');
  return ok;
}

function describeTree(dir) {
  try { return execFileSync('git', ['-C', dir, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' }).trim(); }
  catch (e) { return dir; }
}

main().then(ok => process.exit(ok ? 0 : 1), err => { console.error(err && err.stack || err); process.exit(2); });
