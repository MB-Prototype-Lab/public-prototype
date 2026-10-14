'use strict';
// Runs one journey against one copy of the app and records, after every step,
// what the phone shows (participant), what Tools shows (tools) and the code
// behind each control (wiring). Comparing two runs is the caller's job.

const fs = require('node:fs');
const path = require('node:path');
const { loadApp, memoryStorage, routedScreens } = require('../lib/app-vm.cjs');
const { eventClasses } = require('../lib/mini-dom.cjs');
const { hashSeed } = require('../lib/determinism.cjs');
const controls = require('../lib/controls.cjs');
const snap = require('../lib/snapshot.cjs');

const CALL_ALLOWLIST = new Set(['navAdminJump', 'profileApply', 'themeSet']);
const SETTLE_MS = 450;

class JourneyError extends Error {}

const flushMicrotasks = () => new Promise(r => setImmediate(r));

function describeEl(el) {
  if (!el || !el.tagName || el.tagName === 'BODY') return '-';
  const role = controls.roleOf(el) || el.tagName.toLowerCase();
  return role + ' "' + controls.nameOf(el) + '"';
}

function focusTarget(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) if (n._isFocusable && n._isFocusable()) return n;
  return null;
}

function pointer(type, cancelable = true) {
  return new eventClasses.PointerEvent(type, { bubbles: true, cancelable, composed: true });
}

function dispatchClick(app, el) {
  const doc = app.document;
  const isToggle = el.localName === 'input' && /^(checkbox|radio)$/.test(el.type);
  const wasChecked = isToggle ? el.checked : null;
  const down = el.dispatchEvent(pointer('pointerdown'));
  if (down) {
    const mouse = el.dispatchEvent(new eventClasses.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    if (mouse) {
      const f = focusTarget(el);
      if (f) f.focus();
      else { const a = doc.activeElement; if (a && a !== doc.body && a.blur) a.blur(); }
    }
  }
  if (!el.isConnected) return 'removed before click';
  el.dispatchEvent(pointer('pointerup'));
  el.dispatchEvent(new eventClasses.MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  if (isToggle) el.checked = el.type === 'radio' ? true : !wasChecked;
  const clicked = el.dispatchEvent(new eventClasses.MouseEvent('click', { bubbles: true, cancelable: true }));
  if (isToggle) {
    if (!clicked) el.checked = wasChecked;
    else if (el.checked !== wasChecked) {
      el.dispatchEvent(new eventClasses.Event('input', { bubbles: true }));
      el.dispatchEvent(new eventClasses.Event('change', { bubbles: true }));
    }
  }
  if (clicked && el.localName === 'a') {
    const href = el.getAttribute('href');
    if (href && !/^(#|javascript:)/i.test(href)) app.location.assign(href);
  }
  return null;
}

function resolve(app, query) {
  try { return controls.findControl(app.document, query); }
  catch (err) { throw new JourneyError(err.message); }
}

function typeText(app, query, text, commit, clear) {
  const c = resolve(app, query);
  if (c.disabled) throw new JourneyError('field is disabled: ' + controls.describe(c));
  dispatchClick(app, c.el);
  const kbd = () => app.document.getElementById('keyboardRoot');
  const keyFor = label => {
    const root = kbd();
    if (!root) return null;
    return root.querySelectorAll('button').find(b => b.getAttribute('aria-label') === label) || null;
  };
  const press = label => {
    const k = keyFor(label);
    if (!k) return false;
    dispatchClick(app, k);
    return true;
  };
  const open = () => !!app.run('state.kbd && state.kbd.open');
  if (clear) {
    // Select what the field holds, then delete it with whichever keyboard is up.
    const el = app.document.activeElement;
    if (!el || !el._supportsSelection()) throw new JourneyError('cannot select the contents of ' + controls.describe(c));
    el.select();
    if (open()) press('⌫');
    else if (el.value) {
      el.setRangeText('', el.selectionStart, el.selectionEnd, 'end');
      el.dispatchEvent(new eventClasses.Event('input', { bubbles: true }));
    }
  }
  for (const ch of text) {
    if (!open()) {
      // No simulated keyboard (touch device, or a field it does not serve):
      // type the way a real keyboard would.
      const el = app.document.activeElement;
      if (!el || el === app.document.body) throw new JourneyError('nothing focused to type into');
      if (el._supportsSelection()) el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end');
      else el.value = el.value + ch;
      el.dispatchEvent(new eventClasses.Event('input', { bubbles: true }));
      continue;
    }
    const label = ch === ' ' ? 'space' : ch.toLowerCase();
    const upper = ch !== ch.toLowerCase();
    // Walk the layers (abc → 123 → #+= → ABC) until the key is on screen.
    let found = !!keyFor(label);
    for (const sw of ['123', '#+=', 'ABC', '123']) {
      if (found) break;
      if (keyFor(sw)) press(sw);
      found = !!keyFor(label);
    }
    if (!found) throw new JourneyError('no key for "' + ch + '" on the simulated keyboard');
    if (upper) press('⇧');
    press(label);
  }
  if (commit) {
    if (open()) { if (!press('return')) { const done = kbd().querySelector('.kbd-done'); if (done) dispatchClick(app, done); } }
    else {
      const el = app.document.activeElement;
      if (el && el !== app.document.body) { el.dispatchEvent(new eventClasses.Event('change', { bubbles: true })); el.blur(); }
    }
  }
}

function chooseOption(app, query, option) {
  const c = resolve(app, query);
  const el = c.el;
  if (el.localName !== 'select') throw new JourneyError('not a select: ' + controls.describe(c));
  if (c.disabled) throw new JourneyError('select is disabled: ' + controls.describe(c));
  const opts = el.options;
  // An option by its text or value, a RegExp, or {index} when the labels vary
  // by profile (range dropdowns).
  const want = option instanceof RegExp ? o => option.test(o.text) || option.test(o.value)
    : option && typeof option === 'object' ? (o, i) => i === option.index
    : o => o.value === String(option) || o.text === String(option);
  const hit = opts.find(want);
  if (!hit) throw new JourneyError('select ' + controls.describe(c) + ' has no option ' + option + '; options: ' + opts.map(o => o.text + '=' + o.value).join(' | '));
  const f = focusTarget(el); if (f) f.focus();
  el.value = hit.value;
  el.dispatchEvent(new eventClasses.Event('input', { bubbles: true }));
  el.dispatchEvent(new eventClasses.Event('change', { bubbles: true }));
}

function slideTo(app, query, value) {
  const c = resolve(app, query);
  if (c.role !== 'slider') throw new JourneyError('not a slider: ' + controls.describe(c));
  if (c.disabled) throw new JourneyError('slider is disabled: ' + controls.describe(c));
  const el = c.el;
  el.focus();
  el.value = String(value);
  el.dispatchEvent(new eventClasses.Event('input', { bubbles: true }));
  app.clock.advance(SETTLE_MS);
  if (el.isConnected) el.dispatchEvent(new eventClasses.Event('change', { bubbles: true }));
}

function fireMediaErrors(app, fired) {
  for (const el of app.document.querySelectorAll('img, video, audio, source')) {
    if (fired.has(el) || !el.hasAttribute('onerror')) continue;
    const src = el.getAttribute('src');
    if (!src || /^(data|https?|blob):/.test(src)) continue;
    const file = path.join(app.folder, decodeURIComponent(src.split(/[?#]/)[0]));
    if (fs.existsSync(file)) continue;
    fired.add(el);
    el.dispatchEvent(new eventClasses.Event('error'));
  }
}

async function settle(app, seed, fired) {
  app.reseed(seed);
  app.clock.advance(SETTLE_MS);
  await flushMicrotasks();
  app.clock.advance(0);
  fireMediaErrors(app, fired);
  await flushMicrotasks();
}

// ── Recording ────────────────────────────────────────────────────────────────

function themeLine(app) {
  const stateText = () => JSON.stringify(snap.stableJson(app.run('state'), x => x));
  try {
    const before = stateText();
    const out = app.run(`(function () {
      var cur = state.settings.colorMode, html = {};
      THEMES.forEach(function (t) {
        state.settings.colorMode = t.id;
        html[t.id] = renderTopBar() + renderScreen() + renderNav();
      });
      state.settings.colorMode = cur;
      return html;
    })()`);
    const after = stateText();
    const groups = {};
    for (const [id, html] of Object.entries(out)) (groups[snap.sha(html)] = groups[snap.sha(html)] || []).push(id);
    const line = Object.keys(groups).length === 1 ? 'same' : Object.values(groups).map(g => g.join('+')).join(' | ');
    return 'themes ' + line + (before === after ? '' : ' · rendering changed state');
  } catch (err) {
    return 'themes error: ' + err.message;
  }
}

function recordStep(app, ctx, label) {
  const doc = app.document;
  const rewrite = ctx.rewrite;
  const phone = doc.querySelector('main.phone');
  const screenEl = doc.querySelector('.screen');
  const screenRoot = doc.getElementById('screenRoot');
  const state = app.run('state');
  const screen = state && state.screen;
  const key = app.has('scrollKey') ? app.run('scrollKey()') : screen;
  const arrived = key !== ctx.lastKey;
  ctx.lastKey = key;

  const fresh = (list, name) => { const from = ctx.seen[name] || 0; ctx.seen[name] = list.length; return list.slice(from); };
  const dialogs = fresh(app.log.dialogs, 'dialogs');
  const clipboard = fresh(app.log.clipboard, 'clipboard');
  const audio = fresh(app.log.audio, 'audio');
  const hist = fresh(app.log.history, 'history');
  const consoleLines = fresh(app.log.console, 'console');

  const stateJson = snap.stableJson(state, rewrite, ctx.aliases, ctx.liveRemoved);
  const stateText = JSON.stringify(stateJson);
  const flat = snap.flatten(stateJson);
  const delta = snap.stateDelta(ctx.prevFlat, flat);
  ctx.prevFlat = flat;
  const t = app.clock.pending();
  const kbd = state && state.kbd;

  const p = [];
  p.push('@@ ' + label);
  p.push('screen ' + screen + ' · key ' + key + ' · title ' + JSON.stringify(doc.title));
  p.push('nav ' + rewrite(JSON.stringify(state && state.nav)));
  p.push('url ' + rewrite(app.location.href.replace(/^file:\/\/\/moneybuddy\//, '<root>/')));
  if (app.left) p.push('left ' + app.left.kind + ' ' + app.left.to.replace(/^file:\/\/\/moneybuddy\//, '<root>/'));
  p.push('events dialogs ' + JSON.stringify(dialogs) + ' · clipboard ' + JSON.stringify(clipboard.map(c => snap.sha(rewrite(c)))) +
    ' · audio ' + JSON.stringify(audio) + ' · history ' + JSON.stringify(hist));
  p.push('focus ' + describeEl(doc.activeElement) + ' · kbd ' + (kbd && kbd.open ? kbd.layer : 'closed'));
  p.push('timers soon ' + t.soon + ' short ' + t.short + ' long ' + t.long + ' intervals ' + t.intervals);
  if (arrived) p.push(themeLine(app));
  p.push('classes .screen="' + ((screenEl && screenEl.getAttribute('class')) || '').split(/\s+/).sort().join(' ') +
    '" #screenRoot="' + ((screenRoot && screenRoot.getAttribute('class')) || '').split(/\s+/).sort().join(' ') + '"');
  p.push('text ' + JSON.stringify(rewrite(phone ? snap.visibleText(phone) : '')));
  p.push('state ' + snap.sha(stateText));
  p.push(...delta);
  p.push('html');
  if (phone) p.push(...snap.normalizeTree(phone, rewrite));

  const tl = [];
  const aside = doc.querySelector('aside.admin');
  const page = doc.querySelector('.page');
  const tab = doc.getElementById('adminExpandTab');
  tl.push('@@ ' + label);
  tl.push('collapsed ' + !!(page && page.classList.contains('admin-collapsed')) + ' · expand-tab ' + JSON.stringify(tab ? tab.getAttribute('style') || '' : null));
  if (consoleLines.length) tl.push('console ' + JSON.stringify(consoleLines.map(rewrite)));
  if (aside) tl.push(...snap.normalizeTree(aside, rewrite));

  const wl = ['@@ ' + label];
  for (const region of [phone, aside, tab]) {
    if (!region) continue;
    const els = [region].concat(region.querySelectorAll('*'));
    for (const el of els) {
      const handlers = el.attrs.filter(a => a[0].startsWith('on'));
      const ub = el.getAttribute('data-ub');
      if (!handlers.length && ub === null) continue;
      const who = el.tagName.toLowerCase() + (el.getAttribute('id') ? '#' + el.getAttribute('id') : '');
      for (const [k, v] of handlers) wl.push(who + ' ' + k + '=' + rewrite(v));
      if (ub !== null) wl.push(who + ' data-ub=' + rewrite(ub));
    }
  }

  return { label, screen, participant: p.join('\n'), tools: tl.join('\n'), wiring: wl.join('\n') };
}

// Every handler on screen must compile, and every global it reads must exist.
function checkHandlers(app, ctx) {
  const problems = [];
  const doc = app.document;
  for (const el of doc.querySelectorAll('*')) {
    for (const [k, v] of el.attrs) {
      if (!k.startsWith('on')) continue;
      const cacheKey = k + '\0' + v;
      if (ctx.handlersOk.has(cacheKey)) continue;
      const err = app.compileHandler(v, k);
      if (err) { problems.push(k + '="' + v + '" does not compile: ' + err); continue; }
      const missing = snap.handlerIdents(v).filter(id => !app.has(id));
      if (missing.length) { problems.push(k + '="' + v + '" uses undefined ' + missing.join(', ')); continue; }
      ctx.handlersOk.add(cacheKey);
    }
  }
  return problems;
}

// ── Typed text in the page address or title ─────────────────────────────────
// Useberry records the address (value trail included) and the title, so words
// a person typed, such as a name or a note, must never reach either.

const tokens = s => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
// The title's own wording around the screen name (js/screen-url.js screenTitle).
const TITLE_WORDS = ['moneybuddy', 'step', 'question', 'confirm'];

// Words the app writes there by itself: screen names as addresses and as
// titles, budget categories, the title's wording and the address it opened at.
function appWords(app, routed) {
  const words = new Set(TITLE_WORDS);
  const add = s => { for (const w of tokens(s)) words.add(w); };
  for (const s of routed) add(s.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
  add(app.run('typeof destinations === "undefined" ? "" : destinations.map(function (d) { return d[1]; }).join(" ")'));
  add(app.run('typeof CATEGORIES === "undefined" ? "" : CATEGORIES.join(" ")'));
  add(app.location.href);
  return words;
}

// The typed texts found in this address or title. A text is looked for word by
// word and, when it has several, written as one ("Riley Q" as "rileyq"). Words
// under four characters or without a letter, the app's own words and the value
// trail's checkpoint and keys are not looked for, so they raise no false alarm.
function typedLeaks(typed, href, title, own) {
  let addr = href;
  try { addr = decodeURIComponent(addr); } catch (e) { /* a stray %: read it as written */ }
  const frag = addr.split('#')[1] || '';
  const trailKeys = frag.startsWith('v=') ? frag.slice(2).split('.').map((p, i) => (i ? p.split('-')[0] : p).toLowerCase()) : [];
  const shown = new Set(tokens(addr + ' ' + title));
  return typed.filter(t => {
    const parts = tokens(t);
    return parts.concat(parts.length > 1 ? [parts.join('')] : [])
      .some(w => w.length >= 4 && /[a-z]/.test(w) && !own.has(w) && !trailKeys.includes(w) && shown.has(w));
  });
}

/**
 * @returns {{id, records, visits, errors, gate, warnings, liveRemoved, app}}
 *   records: [{label, screen, participant, tools, wiring}]
 *   visits:  [{screen, via}]  via = 'user' | 'tools' | 'boot'
 *   errors:  journey errors (a step could not be done) — always fatal
 *   gate:    app errors, uncompilable or dangling handlers, unrouted screens
 *   liveRemoved: state-aliases.cjs removal paths that matched a field this
 *            app's state still has
 */
async function runJourney(journey, opts = {}) {
  const folder = opts.folder;
  const routed = new Set(routedScreens(folder));
  const variant = opts.variant;
  const id = journey.id + (variant ? '@' + variant.id : '');
  const steps = typeof journey.steps === 'function' ? journey.steps(variant ? variant.params : journey.defaults || {}) : journey.steps;
  const ctx = { rewrite: snap.idRewriter(), aliases: opts.aliases || [], liveRemoved: new Set(), seen: {}, prevFlat: null, lastKey: null, handlersOk: new Set() };
  const records = [], visits = [], errors = [], gate = [];
  const fired = new WeakSet();
  const typed = [];
  const bootOpts = Object.assign({}, journey.boot || {}, variant && variant.clock !== undefined ? { clock: variant.clock } : {});
  const tab = { storage: memoryStorage(bootOpts.storage || {}) };

  const apps = [];
  const own = new Map();
  const boot = (o = {}) => {
    const merged = Object.assign({}, bootOpts, o);
    const app = loadApp({
      folder, href: merged.href, navType: merged.navType, storage: tab.storage,
      clockStart: merged.clock, seed: hashSeed(id + ':boot'), coarsePointer: merged.coarsePointer,
      reducedMotion: merged.reducedMotion, dialogs: merged.dialogs, sourceOverrides: opts.sourceOverrides,
    });
    ctx.seen = {};
    apps.push(app);
    own.set(app, appWords(app, routed));
    return app;
  };

  let app = boot();
  await settle(app, hashSeed(id + ':0'), fired);
  const note = (app0, via) => {
    const s = app0.run('typeof state !== "undefined" && state.screen');
    if (s) {
      visits.push({ screen: s, via });
      if (!routed.has(s)) gate.push(id + ': reached unrouted screen "' + s + '"');
    }
  };
  note(app, 'boot');
  records.push(recordStep(app, ctx, '000 boot'));
  gate.push(...checkHandlers(app, ctx).map(p => id + ' @ boot: ' + p));

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const n = String(i + 1).padStart(3, '0');
    let label = n + ' ' + step.op;
    let via = 'user';
    try {
      if (app.left && !['boot', 'reload', 'note', 'expect'].includes(step.op)) {
        throw new JourneyError('the page has navigated away (' + app.left.kind + ' ' + app.left.to + ')');
      }
      switch (step.op) {
        case 'tap': {
          const c = resolve(app, step.query);
          label += ' ' + controls.describe(c) + (step.query.region === 'tools' ? ' [tools]' : '');
          if (step.query.region === 'tools') via = 'tools';
          if (c.disabled && !step.expectDisabled) throw new JourneyError('control is disabled: ' + controls.describe(c));
          if (!c.disabled) dispatchClick(app, c.el);
          break;
        }
        case 'type':
          label += ' ' + JSON.stringify(step.text) + ' into ' + JSON.stringify(step.query.name) + (step.clear ? ', emptied first' : '');
          typeText(app, step.query, step.text, step.commit, step.clear);
          if (/[a-z]/i.test(step.text)) typed.push(step.text);
          break;
        case 'choose':
          label += ' ' + (step.option && typeof step.option === 'object' && !(step.option instanceof RegExp) ? 'option #' + step.option.index : JSON.stringify(String(step.option))) + ' in ' + JSON.stringify(String(step.query.name));
          if (step.query.region === 'tools') via = 'tools';
          chooseOption(app, step.query, step.option);
          break;
        case 'slide':
          label += ' ' + JSON.stringify(String(step.query.name)) + ' to ' + step.value;
          slideTo(app, step.query, step.value);
          break;
        case 'check': {
          const c = resolve(app, step.query);
          label += ' ' + controls.describe(c) + ' ' + step.on;
          if (step.query.region === 'tools') via = 'tools';
          if (c.el.checked !== step.on) dispatchClick(app, c.el);
          break;
        }
        case 'call':
          if (!CALL_ALLOWLIST.has(step.fn)) throw new JourneyError('call() is limited to ' + [...CALL_ALLOWLIST].join(', '));
          label += ' ' + step.fn + '(' + step.args.map(a => JSON.stringify(a)).join(', ') + ')';
          via = 'tools';
          app.run(step.fn + '(' + step.args.map(a => JSON.stringify(a)).join(', ') + ')');
          break;
        case 'wait':
          label += ' ' + step.ms + 'ms';
          app.clock.advance(step.ms);
          break;
        case 'back':
          app.history.back();
          break;
        case 'reload': {
          const href = app.location.href;
          app = boot({ href, navType: 'reload' });
          via = 'boot';
          break;
        }
        case 'boot':
          label += ' ' + JSON.stringify(step.opts);
          if (step.opts.newTab) tab.storage = memoryStorage();
          app = boot(step.opts);
          via = 'boot';
          break;
        case 'expect': {
          const w = step.what;
          const s = app.run('state.screen');
          if (w.screen && s !== w.screen) throw new JourneyError('expected screen ' + w.screen + ', on ' + s);
          if (w.text) {
            const txt = snap.visibleText(app.document.querySelector('main.phone'));
            const ok = w.text instanceof RegExp ? w.text.test(txt) : txt.includes(w.text);
            if (!ok) throw new JourneyError('expected text ' + w.text + ' on ' + s + '; saw: ' + txt.slice(0, 300));
          }
          if (w.left && !app.left) throw new JourneyError('expected the page to navigate away');
          label += ' ' + JSON.stringify(w, (k, v) => (v instanceof RegExp ? String(v) : v));
          continue;               // assertions are not recorded steps
        }
        case 'note':
          continue;
        default:
          throw new JourneyError('unknown step ' + step.op);
      }
    } catch (err) {
      errors.push(id + ' step ' + label + ': ' + (err instanceof JourneyError ? err.message : (err.stack || String(err)).split('\n').slice(0, 5).join('\n')));
      break;
    }
    await settle(app, hashSeed(id + ':' + (i + 1)), fired);
    if (!app.left) note(app, via);
    records.push(recordStep(app, ctx, label));
    gate.push(...checkHandlers(app, ctx).map(p => id + ' @ ' + label + ': ' + p));
    for (const t of typedLeaks(typed, app.location.href, app.document.title, own.get(app))) {
      gate.push(id + ' @ ' + label + ': typed text ' + JSON.stringify(t) + ' is in the page address or title');
    }
  }
  const warnings = [];
  for (const a of apps) {
    gate.push(...a.log.errors.map(e => id + ': app error: ' + e));
    warnings.push(...a.log.warnings.map(w => id + ': ' + w));
  }
  if (app.run('typeof window.__lastError !== "undefined" && window.__lastError')) {
    gate.push(id + ': window.__lastError ' + JSON.stringify(app.run('window.__lastError')));
  }
  return { id, records, visits, errors, gate: [...new Set(gate)], warnings: [...new Set(warnings)], liveRemoved: [...ctx.liveRemoved], app };
}

module.exports = { runJourney, JourneyError, CALL_ALLOWLIST, typedLeaks };
