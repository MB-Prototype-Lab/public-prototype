'use strict';
// Boots app/index.html (or any copy of the app, such as a worktree of an older
// commit) in a fresh vm context: the page's scripts run in document order on the
// mini DOM, with a virtual clock, a seeded Math.random, and a recorded location,
// history, sessionStorage, clipboard and set of dialogs.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { documentFromHTML, eventClasses, Node } = require('./mini-dom.cjs');
const { createClock } = require('./virtual-clock.cjs');
const { PRELUDE_SRC } = require('./determinism.cjs');

const REPO = path.resolve(__dirname, '..', '..');
// Wednesday 15 April 2026, 15:00 UTC: a fixed, ordinary afternoon.
const DEFAULT_CLOCK = Date.UTC(2026, 3, 15, 15, 0, 0);
// A machine-independent address, so no snapshot contains a local path.
const DEFAULT_HREF = 'file:///moneybuddy/app/index.html';

function memoryStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: k => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { for (const k of Object.keys(data)) delete data[k]; },
    key: i => Object.keys(data)[i] || null,
    get length() { return Object.keys(data).length; },
  };
}

// The same screen list scripts/sweep.sh derives: every id render.js routes.
function routedScreens(folder = path.join(REPO, 'app')) {
  const src = fs.readFileSync(path.join(folder, 'js', 'render.js'), 'utf8');
  return [...new Set([...src.matchAll(/state\.screen === "([^"]+)"/g)].map(m => m[1]))].sort();
}

const scriptCache = new Map();
function compiled(file, source) {
  const key = file + '\0' + source.length + '\0' + source.slice(0, 64) + source.slice(-64);
  let s = scriptCache.get(key);
  if (!s || s.source !== source) {
    s = { source, script: new vm.Script(source, { filename: file }) };
    scriptCache.set(key, s);
  }
  return s.script;
}

// A RIFF/WAVE file's length in seconds, from its header.
function wavDuration(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(4096);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    if (n < 44 || head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') return NaN;
    let off = 12, byteRate = 0;
    while (off + 8 <= n) {
      const id = head.toString('ascii', off, off + 4); const size = head.readUInt32LE(off + 4);
      if (id === 'fmt ') byteRate = head.readUInt32LE(off + 16);
      if (id === 'data') return byteRate ? size / byteRate : NaN;
      off += 8 + size + (size % 2);
    }
    return NaN;
  } finally { fs.closeSync(fd); }
}

function makeLocation(href, onNavigate) {
  let url = new URL(href);
  const loc = {
    get href() { return url.href; },
    set href(v) { loc.assign(v); },
    get protocol() { return url.protocol; },
    get host() { return url.host; },
    get hostname() { return url.hostname; },
    get port() { return url.port; },
    get pathname() { return url.pathname; },
    get search() { return url.search; },
    get hash() { return url.hash; },
    get origin() { return url.origin; },
    assign(v) { onNavigate('assign', new URL(String(v), url).href); },
    replace(v) { onNavigate('replace', new URL(String(v), url).href); },
    reload() { onNavigate('reload', url.href); },
    toString() { return url.href; },
    _set(v) { url = new URL(String(v), url); },
  };
  return loc;
}

/**
 * @param {object} opts
 *   folder        app directory to load (default: this checkout's app/)
 *   href          the page address (default DEFAULT_HREF)
 *   navType       'navigate' | 'reload'
 *   storage       a memoryStorage() carried across reloads (the browser tab)
 *   clockStart    epoch ms for the virtual clock
 *   seed          Math.random seed
 *   coarsePointer true to behave like a touch device (no simulated keyboard)
 *   reducedMotion prefers-reduced-motion
 *   dialogs       {confirm: boolean, prompt: string|null}
 *   sourceOverrides {relPath: source => source}  in-memory edits (mutation tests)
 */
function loadApp(opts = {}) {
  const folder = path.resolve(opts.folder || path.join(REPO, 'app'));
  const clock = createClock(opts.clockStart === undefined ? DEFAULT_CLOCK : opts.clockStart);
  const storage = opts.storage || memoryStorage();
  const local = memoryStorage();
  const dialogs = Object.assign({ confirm: true, prompt: null }, opts.dialogs || {});
  const overrides = opts.sourceOverrides || {};
  const log = { errors: [], warnings: [], console: [], dialogs: [], clipboard: [], audio: [], navigations: [], history: [] };
  const app = { folder, clock, storage, log, left: null };

  const location = makeLocation(opts.href || DEFAULT_HREF, (kind, to) => {
    log.navigations.push({ kind, to });
    if (!app.left) app.left = { kind, to };
  });

  let ctx;
  const handlerCache = new Map();
  const reportError = err => {
    const msg = err && err.stack ? String(err.stack).split('\n').slice(0, 4).join('\n') : String(err);
    log.errors.push(msg);
    try {
      if (ctx && typeof ctx.onerror === 'function') ctx.onerror(err && err.message ? err.message : String(err), 'app', 0, 0, err);
    } catch (e) { log.errors.push('onerror threw: ' + e); }
  };
  clock.onError(reportError);

  // Media plays on the virtual clock. A file that is missing rejects play()
  // and fires `error`, as a browser does; a .wav plays for its real length and
  // fires `ended`; any other existing file plays without ending.
  const mediaFiles = new Map();
  function mediaDuration(src) {
    const rel = decodeURIComponent(String(src || '').split(/[?#]/)[0]);
    if (!rel || /^(data|blob|https?):/.test(rel)) return NaN;
    if (mediaFiles.has(rel)) return mediaFiles.get(rel);
    const file = path.join(folder, rel);
    let d = null;
    if (fs.existsSync(file)) d = /\.wav$/i.test(rel) ? wavDuration(file) : NaN;
    mediaFiles.set(rel, d);
    return d;
  }
  const media = {
    play(el) {
      const m = el._m;
      const src = el.getAttribute('src') || '';
      log.audio.push(src);
      const d = mediaDuration(src);
      if (d === null) {
        const err = new Error('The element has no supported sources.'); err.name = 'NotSupportedError';
        clock.setTimeout(() => doc._dispatch(el, new eventClasses.Event('error')), 0);
        const p = Promise.reject(err);
        p.catch(() => {});
        return p;
      }
      if (!m.paused) return Promise.resolve();
      if (m.ended) { m.ended = false; m.currentTime = 0; }
      m.paused = false;
      m.startedAt = clock.now();
      if (Number.isFinite(d)) {
        const remaining = Math.max(0, (d - m.currentTime) * 1000 / (m.playbackRate || 1));
        m.endTimer = clock.setTimeout(() => {
          m.currentTime = d; m.paused = true; m.ended = true; m.endTimer = null;
          doc._dispatch(el, new eventClasses.Event('ended'));
        }, remaining);
      }
      doc._dispatch(el, new eventClasses.Event('play'));
      return Promise.resolve();
    },
    pause(el) {
      const m = el._m;
      if (m.paused) return;
      m.currentTime = media.currentTime(el);
      m.paused = true;
      if (m.endTimer) { clock.clearTimeout(m.endTimer); m.endTimer = null; }
      doc._dispatch(el, new eventClasses.Event('pause'));
    },
    currentTime(el) {
      const m = el._m;
      if (m.paused) return m.currentTime;
      const d = mediaDuration(el.getAttribute('src') || '');
      const t = m.currentTime + (clock.now() - m.startedAt) / 1000 * (m.playbackRate || 1);
      return Number.isFinite(d) ? Math.min(t, d) : t;
    },
    seek(el, t) {
      const playing = !el._m.paused;
      if (playing) media.pause(el);
      el._m.currentTime = Math.max(0, t); el._m.ended = false;
      if (playing) media.play(el);
    },
    duration(el) { const d = mediaDuration(el.getAttribute('src') || ''); return d === null ? NaN : d; },
  };

  let windowNode = null;
  let pageSource = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
  if (overrides['index.html']) pageSource = overrides['index.html'](pageSource);
  const doc = documentFromHTML(pageSource, {
    compileHandler(src, node, prop) {
      let fn = handlerCache.get(src);
      if (fn === undefined) {
        try { fn = vm.runInContext('(function (event) {' + src + '\n})', ctx, { filename: prop }); }
        catch (err) { reportError(new Error('handler does not compile: ' + prop + '="' + src + '": ' + err.message)); fn = null; }
        handlerCache.set(src, fn);
      }
      return fn;
    },
    windowHandler(prop) { return typeof ctx[prop] === 'function' ? ctx[prop] : null; },
    reportError,
    media,
    log(kind, detail) {
      if (kind === 'play') log.audio.push(detail.getAttribute('src') || detail.src || '');
      if (kind === 'recursion') log.warnings.push('event "' + detail + '" re-dispatched itself recursively (stopped at the harness depth limit)');
    },
    get window() { return windowNode; },
  });
  windowNode = new Node(doc);
  windowNode.ownerDocument = doc;

  // History: same-document entries only; back() pops asynchronously, as a
  // browser does, and fires popstate.
  const entries = [{ state: null, url: location.href }];
  let index = 0;
  const history = {
    get state() { return entries[index].state; },
    get length() { return entries.length; },
    pushState(state, title, url) {
      const clone = state === undefined ? null : JSON.parse(JSON.stringify(state));
      if (url !== undefined && url !== null) location._set(url);
      entries.splice(index + 1, entries.length, { state: clone, url: location.href });
      index = entries.length - 1;
      log.history.push('push');
    },
    replaceState(state, title, url) {
      const clone = state === undefined ? null : JSON.parse(JSON.stringify(state));
      if (url !== undefined && url !== null) location._set(url);
      entries[index] = { state: clone, url: location.href };
    },
    back() { history.go(-1); },
    forward() { history.go(1); },
    go(delta) {
      const to = index + (delta || 0);
      if (to < 0 || to >= entries.length || to === index) return;
      clock.setTimeout(() => {
        index = to;
        location._set(entries[index].url);
        const e = new eventClasses.Event('popstate');
        e.state = entries[index].state === null ? null : JSON.parse(JSON.stringify(entries[index].state));
        doc._dispatch(windowNode, e);
      }, 0);
      log.history.push('go ' + delta);
    },
  };

  const navType = opts.navType || 'navigate';
  const mediaQuery = q => {
    const s = String(q);
    const matches = /pointer\s*:\s*coarse/.test(s) ? !!opts.coarsePointer
      : /prefers-reduced-motion\s*:\s*reduce/.test(s) ? !!opts.reducedMotion
      : /hover\s*:\s*none/.test(s) ? !!opts.coarsePointer
      : false;
    return { matches, media: s, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null };
  };

  const quietConsole = {};
  for (const level of ['log', 'info', 'debug', 'warn', 'error', 'trace']) {
    quietConsole[level] = (...args) => {
      if (level === 'warn' || level === 'error') log.console.push(level + ': ' + args.map(a => (a && a.message) || String(a)).join(' '));
    };
  }

  function AudioCtor(src) {
    const el = doc.createElement('audio');
    if (src !== undefined) el.setAttribute('src', String(src));
    return el;
  }
  function ImageCtor() { return doc.createElement('img'); }

  ctx = {
    console: quietConsole,
    document: doc,
    location,
    history,
    navigator: {
      userAgent: 'MoneyBuddy journey harness',
      language: 'en-US', languages: ['en-US'], maxTouchPoints: opts.coarsePointer ? 5 : 0,
      clipboard: { writeText: t => { log.clipboard.push(String(t)); return Promise.resolve(); } },
    },
    performance: {
      now: () => clock.now() - (opts.clockStart === undefined ? DEFAULT_CLOCK : opts.clockStart),
      getEntriesByType: t => (t === 'navigation' ? [{ type: navType }] : []),
      navigation: { type: navType === 'reload' ? 1 : 0 },
      mark() {}, measure() {},
    },
    sessionStorage: storage,
    localStorage: local,
    screen: { width: 390, height: 844, availWidth: 390, availHeight: 844 },
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    matchMedia: mediaQuery,
    getComputedStyle: el => (el && el.style) || {},
    scrollTo() {}, scrollBy() {},
    alert: m => { log.dialogs.push('alert: ' + String(m)); },
    confirm: m => { log.dialogs.push('confirm: ' + String(m)); return dialogs.confirm; },
    prompt: m => { log.dialogs.push('prompt: ' + String(m)); return dialogs.prompt; },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    requestAnimationFrame: clock.requestAnimationFrame, cancelAnimationFrame: clock.cancelAnimationFrame,
    requestIdleCallback: fn => clock.setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 0 }), 1),
    cancelIdleCallback: clock.clearTimeout,
    queueMicrotask, structuredClone, URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa,
    Audio: AudioCtor, Image: ImageCtor,
    __mbClock: { now: clock.now },
    __mbSeed: opts.seed === undefined ? 1 : opts.seed,
  };
  Object.assign(ctx, eventClasses);
  ctx.addEventListener = (t, fn, o) => windowNode.addEventListener(t, fn, o);
  ctx.removeEventListener = (t, fn, o) => windowNode.removeEventListener(t, fn, o);
  ctx.dispatchEvent = e => doc._dispatch(windowNode, e);
  vm.createContext(ctx);
  ctx.window = ctx; ctx.self = ctx; ctx.top = ctx; ctx.parent = ctx; ctx.frames = ctx;
  vm.runInContext(PRELUDE_SRC, ctx, { filename: 'prelude.js' });

  // Run every <script> in document order, inline ones included, each in its
  // own compile unit so top-level const/let are shared the way <script> tags
  // share them.
  for (const script of doc.querySelectorAll('script')) {
    const src = script.getAttribute('src');
    let file, source;
    if (src) {
      file = path.join(folder, src);
      const rel = path.relative(folder, file).split(path.sep).join('/');
      source = fs.readFileSync(file, 'utf8');
      if (overrides[rel]) source = overrides[rel](source);
    } else {
      file = 'index.html (inline)';
      source = script.textContent;
    }
    try { compiled(file, source).runInContext(ctx); } catch (err) { reportError(err); }
  }
  doc._dispatch(doc, new eventClasses.Event('DOMContentLoaded'));
  doc._dispatch(windowNode, new eventClasses.Event('load'));
  doc._dispatch(windowNode, new eventClasses.Event('pageshow'));

  Object.assign(app, {
    ctx, document: doc, window: windowNode, location, history,
    run: src => vm.runInContext(src, ctx),
    has: name => vm.runInContext('typeof ' + name + ' !== "undefined"', ctx),
    reseed: seed => ctx.__mbReseed(seed),
    compileHandler: (src, prop = 'onclick') => {
      try { vm.runInContext('(function (event) {' + src + '\n})', ctx); return null; }
      catch (err) { return err.message; }
    },
  });
  return app;
}

module.exports = { loadApp, memoryStorage, routedScreens, REPO, DEFAULT_CLOCK, DEFAULT_HREF };
