'use strict';
// Pins everything that would make two runs of the same journey differ: time
// zone, locale, the clock and Math.random.
const { spawnSync } = require('node:child_process');

// Node reads the default locale only at startup, so the harness re-runs itself
// with a fixed environment instead of trying to change it in-process.
function ensurePinnedEnv() {
  if (process.env.MB_PINNED === '1') {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    if (opts.timeZone !== 'UTC' || !/^en-US/.test(opts.locale)) {
      throw new Error(`journey harness needs TZ=UTC and an en-US locale; got ${opts.timeZone} / ${opts.locale}`);
    }
    return;
  }
  const env = Object.assign({}, process.env, { TZ: 'UTC', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8', MB_PINNED: '1' });
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env });
  if (r.error) throw r.error;
  process.exit(r.status === null ? 1 : r.status);
}

// Evaluated inside the app's context before any app script. `__mbClock` and
// `__mbSeed` are provided by the loader. The browser layer reuses the Math.random
// part; Playwright's page.clock replaces Date there.
const PRELUDE_SRC = String.raw`
(function (g) {
  var RealDate = g.Date;
  var clock = g.__mbClock;
  if (clock) {
    class MbDate extends RealDate {
      constructor() {
        if (arguments.length === 0) super(clock.now());
        else super(...arguments);
      }
      static now() { return clock.now(); }
    }
    g.Date = MbDate;
  }
  // mulberry32, reseedable per step so one extra draw cannot shift every
  // later value in a journey.
  var a = (g.__mbSeed >>> 0) || 1;
  g.Math.random = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  g.__mbReseed = function (seed) { a = (seed >>> 0) || 1; };
})(globalThis);
`;

// A stable 32-bit hash for per-step seeds.
function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

module.exports = { ensurePinnedEnv, PRELUDE_SRC, hashSeed };
