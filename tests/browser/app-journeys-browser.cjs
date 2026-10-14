#!/usr/bin/env node
'use strict';
// Real-browser journeys: replays the journeys marked `browser: true` in
// Chromium, in all four themes at phone width plus Tools at desktop width.
//
//   node tests/browser/app-journeys-browser.cjs [--head DIR] [--out DIR]
//        one tree (default: this repository): fail if a journey stops early,
//        a control cannot be tapped or the page throws. No pictures are
//        compared; --out keeps a picture of every step and a report.
//   node tests/browser/app-journeys-browser.cjs --base DIR --head DIR --out DIR
//        two trees (before and after): screenshot every step on both, compare
//        each step's pictures and write a report a PM can open.
//   Options: [--only id,id] [--variants naturalLight,dark,...]
//   --compare REF   instead of --base: check REF out into a temporary worktree
//   --allow-declared  do not fail on changes the PR body declares (CI, pull requests)
//   --report    print and write the report but pass with changed pictures (CI,
//               pushes to main, whose PR already declared them); a journey that
//               breaks after the change, or a new page error, still fails
//
// When comparing, every journey must reach its last step on both sides. One
// that stops early after the change, or on both sides, fails the run; one that
// stopped only before the change counts as a phone change, like a changed picture.
//
// A picture is taken at boot and after every step, so states within one view (a
// picked tile, the open keyboard, a sheet) are compared too. Before and after
// are paired by the step number that starts each label, not the whole label,
// which carries live figures; a step only one side reached counts as a change.
//
// Needs Playwright: (cd tests/browser && npm ci && npx playwright install --with-deps chromium).

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
const { writeReport, STATUS_TEXT, countsAsChange } = require('./report.cjs');
const journeysApi = require('../app-journeys.cjs');
const { declaresChange, readAs } = require('../lib/pr-declarations.cjs');

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

// A mistyped option must not shrink the run to nothing and still pass.
class UsageError extends Error {}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i], next = () => { if (i + 1 >= argv.length) throw new UsageError(v + ' needs a value'); return argv[++i]; };
    if (v === '--base') a.base = next();
    else if (v === '--head') a.head = next();
    else if (v === '--out') a.out = next();
    else if (v === '--compare') a.compare = next();
    else if (v === '--only') a.only = next().split(',');
    else if (v === '--variants') a.variants = next().split(',');
    else if (v === '--allow-declared') a.allowDeclared = true;
    else if (v === '--report') a.report = true;
    else throw new UsageError('unknown argument ' + v);
  }
  return a;
}

// RegExps cannot cross into the page as-is.
const pack = q => JSON.parse(JSON.stringify(q, (k, v) => (v instanceof RegExp ? { __re: [v.source, v.flags] } : v)));
const REVIVE = `function (q) { return JSON.parse(JSON.stringify(q), function (k, v) { return v && v.__re ? new RegExp(v.__re[0], v.__re[1]) : v; }); }`;

class StepError extends Error {}

// Playwright's page clock swaps `performance` for a stand-in with no navigation
// entries, which would hide a reload from the app's refresh pin. Keep the real
// object aside before the clock installs, then hand its navigation timing back.
const KEEP_PERFORMANCE = 'window.__mbRealPerformance = window.performance;';
// The clock fakes requestAnimationFrame too; the real one waits for a drawn frame.
const KEEP_FRAME = 'window.__mbRealFrame = window.requestAnimationFrame.bind(window);';
const RESTORE_NAVIGATION = `(function () {
  var real = window.__mbRealPerformance, page = window.performance;
  delete window.__mbRealPerformance;
  if (!real || page === real) return;
  var byType = page.getEntriesByType;
  page.getEntriesByType = function (t) { return t === 'navigation' ? real.getEntriesByType(t) : byType.apply(this, arguments); };
  Object.defineProperty(page, 'navigation', { configurable: true, get: function () { return real.navigation; } });
})();`;

// The page renders with reduced motion, so CSS animations land on their last
// frame at once and every picture is the same. The app's own script asks
// matchMedia instead and gets the journey's preference, as in the VM
// (tests/lib/app-vm.cjs), so it takes the same path in both layers (the
// "Budget Saved!" beat, the buddy's idle poses).
function scriptMotion(reduce) {
  return `(function (reduce) {
  var mm = window.matchMedia;
  window.matchMedia = function (q) {
    if (!/prefers-reduced-motion\\s*:\\s*reduce/.test(String(q))) return mm.call(window, q);
    var noop = function () {};
    return { matches: reduce, media: String(q), onchange: null, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop };
  };
})(${!!reduce});`;
}

// Pages booted as a touch phone, where a person taps rather than clicks.
const TOUCH_PAGES = new WeakSet();
// A tap also draws Chromium's tap highlight, which fades on real time, outside
// the page clock; pictures would catch it part-way.
const NO_TAP_HIGHLIGHT = `document.addEventListener('DOMContentLoaded', function () {
  var s = document.createElement('style');
  s.textContent = '* { -webkit-tap-highlight-color: transparent !important; }';
  document.head.appendChild(s);
});`;

async function newPage(browser, tree, variant, seedId, boot = {}) {
  // A touch screen makes Chromium report a coarse pointer, as a phone does, so
  // the app leaves its simulated keyboard closed (components/keyboard.js).
  const ctx = await browser.newContext({ viewport: variant.viewport, deviceScaleFactor: 1, locale: 'en-US',
    timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light', hasTouch: !!boot.coarsePointer });
  await ctx.addInitScript({ content: controls.SOURCE });
  await ctx.addInitScript({ content: 'window.__mbReviveQuery = ' + REVIVE + ';' });
  await ctx.addInitScript({ content: 'window.__mbSeed = ' + hashSeed(seedId) + ';\n' + PRELUDE_SRC });
  await ctx.addInitScript({ content: shimSource(mediaDurations(path.join(tree, 'app'))) });
  await ctx.addInitScript({ content: scriptMotion(boot.reducedMotion) });
  await ctx.addInitScript({ content: KEEP_PERFORMANCE });
  await ctx.addInitScript({ content: KEEP_FRAME });
  if (boot.coarsePointer) await ctx.addInitScript({ content: NO_TAP_HIGHLIGHT });
  const page = await ctx.newPage();
  if (boot.coarsePointer) TOUCH_PAGES.add(page);
  // Paused on the start time, the page's clock moves only when a step runs it,
  // as in the VM. Installing a minute early lets the pause jump forward to it.
  await page.clock.install({ time: DEFAULT_CLOCK - 60000 });
  await page.clock.pauseAt(DEFAULT_CLOCK);
  await ctx.addInitScript({ content: RESTORE_NAVIGATION });
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
  return Object.assign(res, { page, handle: await page.evaluateHandle(() => window.__mbTarget), touch: TOUCH_PAGES.has(page) });
}

// A real click lands on whatever is on top. When that is another control (an
// open sheet, say), a person could not tap this one either: the journey's fault.
async function click(f) {
  try {
    // Scroll the control into view, then let a frame draw before the click: the
    // page hears of a scroll only in the next frame, so a view that keeps its
    // offset from scroll events (Big purchase's "How we worked it out") would
    // otherwise repaint at the old offset in some runs and the new one in others.
    await f.handle.scrollIntoViewIfNeeded({ timeout: 5000 });
    await Promise.race([f.handle.evaluate(() => new Promise(r => window.__mbRealFrame(r))), new Promise(r => setTimeout(r, 1000))]);
    if (f.touch) await f.handle.tap({ timeout: 5000 });
    else await f.handle.click({ timeout: 5000 });
  } catch (err) {
    const covered = /([^\n]*intercepts pointer events)/.exec(String(err && err.message).replace(/\x1b\[[0-9;]*m/g, ''));
    if (covered) throw new StepError('cannot tap ' + f.desc + ': ' + covered[1].replace(/^\s*-\s*/, ''));
    throw err;
  }
  // A tap holds the control :active for Chromium's minimum of 150 ms of real
  // time, which the paused page clock does not count: wait it out, so a picture
  // never catches the pressed look on some runs and not others.
  if (f.touch) {
    const pressed = () => f.page.evaluate(() => !!document.querySelector(':active')).catch(() => false);
    for (const end = Date.now() + 2000; Date.now() < end && await pressed();) await new Promise(r => setTimeout(r, 20));
  }
}

async function typeText(page, query, text, commit, clear) {
  const f = await find(page, query);
  if (f.disabled) throw new StepError('field is disabled: ' + f.desc);
  await click(f);
  const keyHandle = label => page.evaluateHandle(l => {
    const root = document.getElementById('keyboardRoot');
    return root ? Array.from(root.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === l) || null : null;
  }, label);
  const has = async label => (await (await keyHandle(label)).jsonValue()) !== null;
  const press = async label => { const h = await keyHandle(label); if (await h.jsonValue() === null) return false; await h.asElement().click({ timeout: 5000 }); return true; };
  const open = () => page.evaluate(() => !!(state.kbd && state.kbd.open));
  if (clear) {
    // Select what the field holds, then delete it with whichever keyboard is up.
    const filled = await page.evaluate(() => { const el = document.activeElement; if (!el || typeof el.select !== 'function') return null; el.select(); return el.value !== ''; });
    if (filled === null) throw new StepError('cannot select the contents of ' + f.desc);
    if (await open()) await press('⌫');
    else if (filled) await page.keyboard.press('Backspace');
  }
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
  await shoot('000 boot');
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let label = String(i + 1).padStart(3, '0') + ' ' + step.op;
    switch (step.op) {
      case 'tap': {
        const f = await find(page, step.query);
        label += ' ' + f.desc;
        if (f.disabled && !step.expectDisabled) throw new StepError('control is disabled: ' + f.desc);
        if (!f.disabled) await click(f);
        break;
      }
      case 'type': label += ' ' + JSON.stringify(step.text); await typeText(page, step.query, step.text, step.commit, step.clear); break;
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
        if ((await f.handle.evaluate(el => !!el.checked)) !== step.on) await click(f);
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
    await shoot(label);
  }
}

// The selector gate around the app: passcode, Local Prototype, refresh without
// and with the pin. Browser only; the VM journeys start inside the app.
const GATE_JOURNEY = { id: 'gate', title: 'Passcode, selector, Local Prototype, refresh without and with Pin on refresh' };

async function runGate(page, tree, shoot) {
  const root = pathToFileURL(path.join(tree, 'index.html')).href;
  await page.goto(root);
  await shoot('000 passcode');
  await page.fill('#gateInput', '1337');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#selectorScreen', { state: 'visible' });
  await shoot('001 selector');
  await page.getByRole('link', { name: 'Local Prototype', exact: true }).click();
  await waitApp(page);
  await settle(page, hashSeed('gate:2'));
  await shoot('002 Local Prototype');
  await page.reload();
  await page.waitForSelector('#selectorScreen', { state: 'visible' });
  await shoot('003 refresh returns to the selector');
  await page.getByRole('link', { name: 'Local Prototype', exact: true }).click();
  await waitApp(page);
  await page.click('#adminExpandTab');
  await page.getByLabel('Pin on refresh', { exact: true }).check();
  await settle(page, hashSeed('gate:5'));
  await shoot('004 Pin on refresh checked');
  await page.reload();
  await waitApp(page);
  await settle(page, hashSeed('gate:6'));
  await shoot('005 pinned refresh restarts the app');
  await page.click('#adminExpandTab');      // the restart closed Tools
  await page.getByRole('button', { name: 'Exit Prototype', exact: true }).click();
  await page.waitForSelector('#selectorScreen', { state: 'visible' });
  await shoot('006 Exit Prototype');
}

async function runOne(browser, tree, variant, journey, outDir) {
  const variantParams = journey.matrix === 'profiles' ? { id: 'at_at', params: { tier: 'at', level: 'at' } } : null;
  const id = journey.id + (variantParams ? '@' + variantParams.id : '');
  const steps = typeof journey.steps === 'function' ? journey.steps(variantParams.params) : journey.steps;
  const { ctx, page, errors } = await newPage(browser, tree, variant, id + ':boot', journey.boot);
  const shots = [];
  // Without a folder the steps are only counted: one tree, nothing to keep.
  const dir = outDir && path.join(outDir, variant.id, journey.id);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const shoot = async label => {
    const step = stepOf(label);
    if (shots.some(s => s.step === step)) throw new Error('two pictures for step ' + step);
    if (!dir) { shots.push({ label, step }); return; }
    const file = path.join(dir, step + '.png');
    // The pointer rests where the last click landed, and Chromium updates which
    // element it hovers only on a later frame: park it in the page margin first,
    // so no picture shows a hover look on some runs and not others.
    await page.mouse.move(0, 0);
    const inApp = page.url().includes('/app/');
    const before = inApp ? await growPhone(page) : null;
    await page.locator(inApp ? variant.shot : 'body').first().screenshot({ path: file, animations: 'disabled', caret: 'hide', mask: [page.locator('video')] });
    if (inApp) await restorePhone(page, before);
    shots.push({ label, step, file });
  };
  let failure = null;
  try {
    if (journey === GATE_JOURNEY) await runGate(page, tree, shoot);
    else {
      await page.goto(pathToFileURL(path.join(tree, 'app', 'index.html')).href);
      await waitApp(page);
      await page.evaluate(t => themeSet(t), variant.theme);
      // Phone journeys are shown with Tools open; the Tools tour opens it itself.
      if (variant.tools && journey.browser) await page.click('#adminExpandTab');
      await settle(page, hashSeed(id + ':0'));
      await runSteps(page, journey, variant, steps, id, shoot);
    }
  } catch (err) {
    failure = (err instanceof StepError ? '' : 'harness: ') + String(err && err.message || err).split('\n')[0];
  }
  await ctx.close();
  return { id: journey.id, variant: variant.id, shots, failure, pageErrors: errors };
}

// The step number that starts a picture's label.
function stepOf(label) {
  const m = /^\d+(?= )/.exec(label);
  if (!m) throw new Error('picture label without a step number: ' + label);
  return m[0];
}

// One entry per step either side pictured, in step order: { step, b, h }, with b
// or h missing for a step only one side reached.
function pairShots(before, after) {
  const byStep = new Map();
  for (const s of before) byStep.set(s.step, { step: s.step, b: s });
  for (const s of after) byStep.set(s.step, Object.assign(byStep.get(s.step) || { step: s.step }, { h: s }));
  return [...byStep.values()].sort((x, y) => Number(x.step) - Number(y.step));
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
  const comparing = !!(args.base || args.compare);
  if (!comparing && args.allowDeclared) throw new UsageError('--allow-declared needs --base DIR or --compare REF');
  if (!comparing && args.report) throw new UsageError('--report needs --base DIR or --compare REF');
  if (args.report && args.allowDeclared) throw new UsageError('--report never fails on changed pictures, so --allow-declared has nothing to allow; use one');
  const out = comparing || args.out ? path.resolve(args.out || path.join(REPO, '.journeys', 'browser')) : null;
  const head = path.resolve(args.head || REPO);
  let base = args.base ? path.resolve(args.base) : null;

  const every = journeysApi.loadJourneys();
  const unknownJourneys = (args.only || []).filter(id => !every.some(j => j.id === id));
  if (unknownJourneys.length) throw new UsageError('no journey ' + unknownJourneys.join(', '));
  const unknownVariants = (args.variants || []).filter(id => !VARIANTS.some(v => v.id === id));
  if (unknownVariants.length) throw new UsageError('no variant ' + unknownVariants.join(', ') + '; variants are ' + VARIANTS.map(v => v.id).join(', '));
  const all = args.only ? every.filter(j => args.only.includes(j.id)) : every;
  const subset = all.filter(j => j.browser);
  const tour = all.filter(j => j.id === 'tools-tour');
  const variants = VARIANTS.filter(v => !args.variants || args.variants.includes(v.id));
  const plan = variants.map(v => ({ variant: v, journeys: v.tools ? subset.concat(tour, args.only ? [] : [GATE_JOURNEY]) : subset }));
  const idle = (args.only || []).filter(id => !plan.some(p => p.journeys.some(j => j.id === id)));
  if (idle.length) throw new UsageError(idle.join(', ') + ' would not run: the phone variants run ' + every.filter(j => j.browser).map(j => j.id).join(', ') + '; tools-desktop also runs tools-tour');
  if (!plan.some(p => p.journeys.length)) throw new UsageError('nothing to run');
  if (!comparing) return checkTree(head, plan, out);

  let cleanup = null;
  if (!base) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-browser-base-'));
    base = path.join(dir, 'base');
    git(['worktree', 'add', '--detach', '--quiet', base, args.compare]);
    cleanup = () => { try { git(['worktree', 'remove', '--force', base]); } catch (e) {} fs.rmSync(dir, { recursive: true, force: true }); };
  }
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const browser = await launch();
  let ok = true;
  try {
    const t0 = Date.now();
    const baseRes = await runTree(browser, base, plan, path.join(out, 'shots', 'base'));
    const headRes = await runTree(browser, head, plan, path.join(out, 'shots', 'head'));
    const comparer = await openComparer(browser);
    const rows = [];
    for (const h of headRes) {
      const b = baseRes.find(r => r.id === h.id && r.variant === h.variant);
      const items = [];
      for (const { step, b: bs, h: hs } of pairShots(b.shots, h.shots)) {
        const item = { step, label: (hs || bs).label, base: bs && path.relative(out, bs.file), head: hs && path.relative(out, hs.file) };
        if (!hs) item.status = 'onlyBefore';
        else if (!bs) item.status = 'onlyAfter';
        else {
          const r = await comparer.compare(fs.readFileSync(bs.file), fs.readFileSync(hs.file));
          const changed = !r.sameSize || r.diffPixels / r.totalPixels > FAIL_RATIO;
          item.status = changed ? 'changed' : 'same';
          item.diffPixels = r.diffPixels; item.size = [r.sizeA, r.sizeB];
          if (r.diffPng && changed) {
            const file = path.join(out, 'diffs', h.variant, h.id, step + '.png');
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
      const again = new Map(pairShots(b2.shots, h2.shots).map(p => [p.step, p]));
      for (const item of row.items) {
        const p = item.status === 'changed' && again.get(item.step);
        if (!p || !p.b || !p.h) continue;
        const r = await comparer.compare(fs.readFileSync(p.b.file), fs.readFileSync(p.h.file));
        if (r.sameSize && r.diffPixels / r.totalPixels <= FAIL_RATIO) item.status = 'flaky';
      }
    }
    await comparer.close();

    const body = process.env.PR_BODY || '';
    const phoneDeclared = args.allowDeclared && declaresChange(body, 'Participant');
    const toolsDeclared = args.allowDeclared && declaresChange(body, 'Tools');
    const summary = { base: describeTree(base), head: describeTree(head), seconds: Math.round((Date.now() - t0) / 1000), phoneChanged: 0, toolsChanged: 0, flaky: 0, broken: 0, brokenAfter: 0, brokenBeforeOnly: 0 };
    for (const row of rows) {
      const changed = row.items.filter(i => countsAsChange(i.status)).length;
      if (row.variant === 'tools-desktop') summary.toolsChanged += changed; else summary.phoneChanged += changed;
      summary.flaky += row.items.filter(i => i.status === 'flaky').length;
      // A journey that stops early after the change, or on both sides (its
      // coverage is lost), or raises new page errors, fails the run. One that
      // stopped only before the change now goes further: a phone change.
      row.broken = !!(row.baseFailure || row.headFailure || row.pageErrors.length);
      if (!row.broken) continue;
      summary.broken++;
      if (row.headFailure || row.pageErrors.length) summary.brokenAfter++; else summary.brokenBeforeOnly++;
    }
    const report = writeReport(out, rows, summary, VARIANTS);
    console.log('Browser journeys: ' + rows.length + ' runs per side, ' + rows.reduce((n, r) => n + r.items.length, 0) + ' screenshots compared in ' + summary.seconds + 's');
    for (const row of rows) {
      const bad = row.items.filter(i => i.status !== 'same');
      if (!bad.length && !row.broken) continue;
      console.log('  ' + row.variant + ' / ' + row.id + ':' + (row.broken ? ' BROKEN' : '') + (bad.length ? ' ' + bad.map(i => STATUS_TEXT[i.status].toLowerCase() + ' @ ' + i.label).join('; ') : '') +
        (row.baseFailure || row.headFailure ? ' [before: ' + (row.baseFailure || 'finished') + ' | after: ' + (row.headFailure || 'finished') + ']' : '') +
        (row.pageErrors.length ? ' [new page errors: ' + row.pageErrors.join(' | ') + ']' : ''));
    }
    console.log('Phone pictures changed: ' + summary.phoneChanged + ' · Tools pictures changed: ' + summary.toolsChanged + ' · flaky (did not reproduce): ' + summary.flaky +
      ' · journeys that broke: ' + summary.broken + (summary.brokenBeforeOnly ? ' (' + summary.brokenBeforeOnly + ' only before the change)' : ''));
    console.log('Report: ' + pathToFileURL(report).href);
    if (summary.brokenAfter) ok = false;
    if (args.report) {
      // Changed pictures are reported, not failed: the PR that made them declared them.
      if (summary.phoneChanged || summary.toolsChanged || summary.brokenBeforeOnly) console.log('--report: changed pictures are reported, not failed' + (summary.brokenAfter ? '; the journeys that broke still fail' : ''));
    } else {
      // In CI, say what the PR body said, as --justify does.
      const undeclared = (what, channel) => {
        ok = false;
        if (args.allowDeclared) console.log('DECLARE  ' + what + ' changed, but ' + readAs(body, channel) + '; say what changed and why');
      };
      if ((summary.phoneChanged || summary.brokenBeforeOnly) && !phoneDeclared) undeclared('the phone', 'Participant');
      if (summary.toolsChanged && !toolsDeclared) undeclared('Tools pictures', 'Tools');
    }
  } finally {
    await browser.close();
    if (cleanup) cleanup();
  }
  console.log(ok ? 'PASS' : 'FAIL');
  return ok;
}

// One tree, nothing to compare: every journey must reach its last step without
// a page error. Pictures and a report only when --out names a folder.
async function checkTree(tree, plan, out) {
  if (out) {
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
  }
  const browser = await launch();
  try {
    const t0 = Date.now();
    const results = await runTree(browser, tree, plan, out && path.join(out, 'shots'));
    const rows = results.map(r => ({ id: r.id, variant: r.variant, headFailure: r.failure, pageErrors: r.pageErrors,
      broken: !!(r.failure || r.pageErrors.length),
      items: r.shots.filter(s => s.file).map(s => ({ label: s.label, head: path.relative(out, s.file) })) }));
    const summary = { head: describeTree(tree), seconds: Math.round((Date.now() - t0) / 1000), broken: rows.filter(r => r.broken).length };
    console.log('Browser journeys: ' + rows.length + ' runs, ' + results.reduce((n, r) => n + r.shots.length, 0) + ' pictures in ' + summary.seconds + 's');
    for (const row of rows.filter(r => r.broken)) {
      console.log('  ' + row.variant + ' / ' + row.id + ': BROKEN' + (row.headFailure ? ' [' + row.headFailure + ']' : '') +
        (row.pageErrors.length ? ' [page errors: ' + row.pageErrors.join(' | ') + ']' : ''));
    }
    console.log('Journeys that broke: ' + summary.broken);
    if (out) console.log('Report: ' + pathToFileURL(writeReport(out, rows, summary, VARIANTS)).href);
    console.log(summary.broken ? 'FAIL' : 'PASS');
    return !summary.broken;
  } finally {
    await browser.close();
  }
}

// Partial raster redraws only the changed part of a tile, so an anti-aliased
// rounded edge comes out a shade different depending on what was redrawn
// before; whole-tile raster draws the same page the same way every run.
function launch() {
  return chromium.launch({ headless: true, args: ['--disable-partial-raster'].concat(JSON.parse(process.env.MB_CHROMIUM_ARGS || '[]')),
    ...(process.env.MB_CHROMIUM_EXECUTABLE ? { executablePath: process.env.MB_CHROMIUM_EXECUTABLE } : {}) });
}

function describeTree(dir) {
  try { return execFileSync('git', ['-C', dir, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' }).trim(); }
  catch (e) { return dir; }
}

main().then(ok => process.exit(ok ? 0 : 1), err => {
  console.error(err instanceof UsageError ? 'app-journeys-browser: ' + err.message : err && err.stack || err);
  process.exit(2);
});
