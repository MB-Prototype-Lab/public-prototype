'use strict';
// Proof that the journey checks catch what they claim to: each mutation edits
// the app in memory (no file changes), runs the affected journeys, and
// compares with an unedited run. Breakage must be caught; harmless edits must
// pass. Screen coverage is a whole-suite property, so a spec with `drop`
// instead leaves journeys out of the whole suite and expects the coverage gate
// to fail. Run when the harness changes:  node tests/app-journeys.cjs --mutations
//
// A spec whose `find` text or dropped journey no longer exists reports STALE:
// update it to the current code rather than deleting it.

const path = require('node:path');
const { REPO } = require('../lib/app-vm.cjs');

const all = (find, replace) => src => src.split(find).join(replace);

const SPECS = [
  {
    id: 'goal-tap-advances', expect: 'caught', journeys: ['onboarding-full', 'onboarding-back-skip'],
    why: 'a goal tap that also moves to the next step',
    edits: { 'screens/onboarding.js': [['  else if (o.improveAreas.length < ONB_GOALS_MAX) { o.improveAreas.push(label); }\n  render();',
      '  else if (o.improveAreas.length < ONB_GOALS_MAX) { o.improveAreas.push(label); }\n  render();\n  setTimeout(onbNext, 250);']] },
  },
  {
    id: 'button-label', expect: 'caught', journeys: ['esf-full'],
    why: '"Build my fund" renamed to "Build my plan"',
    edits: { 'screens/esf-build.js': [['onclick="esfNext()">Build my fund</button>', 'onclick="esfNext()">Build my plan</button>']] },
  },
  {
    id: 'half-renamed-handler', expect: 'caught', journeys: ['lesson-framed'],
    why: 'a function renamed where it is defined but not where a button calls it',
    edits: { 'js/lessons-v3.js': [['function lessonV3Start(lessonId) {', 'function lessonStartRenamed(lessonId) {']] },
  },
  {
    id: 'esf-rounding', expect: 'caught', journeys: ['esf-full'], profiles: true,
    why: 'emergency-fund figures rounded up instead of to the nearest step',
    edits: { 'js/esf.js': [['return Math.max(0, Math.round((Number(n) || 0) / step) * step);', 'return Math.max(0, Math.ceil((Number(n) || 0) / step) * step);']] },
  },
  {
    id: 'screen-unrouted', expect: 'caught', journeys: ['budget-builder'],
    why: 'the budget replacement screen dropped from the router',
    edits: { 'js/render.js': [['  if (state.screen === "budgetUpdateConfirm") return renderBudgetUpdateConfirm();\n', '']] },
  },
  {
    id: 'page-patch-removed', expect: 'caught', journeys: ['picker-tour'],
    why: 'the paywall note no longer written when a plan is tapped',
    edits: { 'screens/budget-paywall.js': [['  uiPatchHTML("paywallNote",', '  (function () {})("paywallNote",']] },
  },
  {
    id: 'bubbling', expect: 'caught', journeys: ['esf-full'],
    why: 'Remove on a goal card also opening the card underneath',
    edits: { 'screens/goals.js': [['onclick="event.stopPropagation();goalsRemove(', 'onclick="goalsRemove(']] },
    extraSteps: true,
  },
  {
    id: 'continue-disabled', expect: 'caught', journeys: ['onboarding-full'],
    why: 'Continue on the name step never enabling',
    edits: { 'screens/onboarding.js': [['  if (key === "name")      return !!o.name;', '  if (key === "name")      return false;']] },
  },
  {
    id: 'trail-checkpoints-dropped', expect: 'caught', journeys: ['onboarding-full', 'journal', 'budget-builder'],
    why: 'setup, a journal entry and a saved budget no longer marking the value trail',
    edits: {
      'screens/onboarding.js': [['    ubTrailCheckpoint("setup");\n', '']],
      'js/journal.js': [['    ubTrailCheckpoint("journal");\n', '']],
      'js/budget-baseline.js': [['    ubTrailCheckpoint("budget");\n', '']],
    },
  },
  {
    id: 'trail-fragment-dropped', expect: 'caught', journeys: ['onboarding-full'],
    why: 'the screen address written without its #v= value trail',
    edits: { 'js/screen-url.js': [['url.hash = trail ? "v=" + trail : "";', 'url.hash = "";']] },
  },
  {
    id: 'fake-keypad-on-phones', expect: 'caught', journeys: ['keyboard-touch'],
    why: 'the simulated keyboard opening on a touch phone, over its own keyboard',
    edits: { 'components/keyboard.js': [['  try { return !window.matchMedia("(pointer: coarse)").matches; } catch (e) { return true; }', '  return true;']] },
  },
  {
    id: 'bp-plan-date-overflow', expect: 'caught', journeys: ['bp-car'],
    why: 'the Big purchase "save it by" month counted from today\'s day, so a year after 29 February reads as March',
    edits: { 'screens/bp-controls.js': [['  d.setDate(1);\n', '']] },
  },
  {
    id: 'tools-label', expect: 'tools', journeys: ['tools-tour'],
    why: 'a Tools heading reworded (reported as a Tools change, not a phone change)',
    edits: { 'index.html': [['<p class="admin-title" style="margin:0;">Admin Tools</p>', '<p class="admin-title" style="margin:0;">Tools</p>']] },
  },
  {
    id: 'login-value-to-checked', expect: 'wiring', journeys: ['tools-tour'],
    why: 'the Tools "Prompt answered" select reading .checked, which a select does not have',
    edits: { 'screens/login.js': [["state.dailyPromptAnswered=(this.value==='true')", "state.dailyPromptAnswered=(this.checked==='true')"]] },
  },
  {
    id: 'swap-to-untapped-fn', expect: 'wiring', journeys: ['tools-tour'],
    why: 'the Big purchase landing\'s Back button calling bpLeaseAfford, an existing function no journey taps, instead of bpLandingBack',
    edits: { 'screens/bp-landing.js': [['onclick="bpLandingBack()"', 'onclick="bpLeaseAfford()"']] },
  },
  {
    id: 'consistent-rename', expect: 'rename', journeys: ['picker-tour'],
    why: 'a handler renamed everywhere (reported as a rename only)',
    edits: { 'screens/budget-paywall.js': [[/budgetPaywallTap/, 'paywallPlanTap']] },
  },
  {
    id: 'journey-dropped', expect: 'coverage', drop: ['lesson-topic'],
    why: 'the topic lesson journey deleted, leaving its screens reached only by the Tools tour',
  },
  {
    id: 'dead-code-and-comment', expect: 'none', journeys: ['themes', 'onboarding-full'],
    why: 'an unused function added and a comment trimmed (nothing changes)',
    edits: {
      'js/theme.js': [['function themeCurrent() {\n', 'function themeUnusedProbe() {\n  return themeCurrent().id === "dark";\n}\n\nfunction themeCurrent() {\n']],
      'screens/onboarding.js': [['// "A" · "A and B" · "A, B and C" — a readable phrase for strategicGoal.label.\n', '']],
    },
  },
];

function buildOverrides(spec, appDir) {
  const fs = require('node:fs');
  const overrides = {};
  const stale = [];
  for (const [rel, pairs] of Object.entries(spec.edits)) {
    const src = fs.readFileSync(path.join(appDir, rel), 'utf8');
    for (const [find] of pairs) {
      const present = find instanceof RegExp ? find.test(src) : src.includes(find);
      if (!present) stale.push(rel + ': ' + String(find).slice(0, 80));
    }
    overrides[rel] = s => pairs.reduce((acc, [find, replace]) =>
      (find instanceof RegExp ? all(find.source, replace)(acc) : acc.replace(find, replace)), s);
  }
  return { overrides, stale };
}

function outcome(cmp, results) {
  const gate = results.flatMap(r => r.errors.concat(r.gate));
  if (cmp.participant.length || gate.length) return 'caught';
  if (cmp.tools.length) return 'tools';
  if (cmp.wiring.length || cmp.useberry.size) return 'wiring';
  if (cmp.renames.size) return 'rename';
  return 'none';
}

// The whole suite with and without the dropped journeys. The full suite must
// reach every screen, or the spec proves nothing.
async function dropOutcome(h, spec, journeys, appDir) {
  const results = await h.runAll(h.expand(journeys), appDir);
  const full = h.coverage(results, appDir).missing;
  if (full.length) return { got: 'none', detail: ' (the full suite already misses ' + full.join(', ') + ')' };
  const missing = h.coverage(results.filter(r => !spec.drop.includes(r.id.split('@')[0])), appDir).missing;
  return missing.length ? { got: 'coverage', detail: ' (' + missing.join(', ') + ')' } : { got: 'none', detail: '' };
}

async function run(h) {
  const appDir = path.join(REPO, 'app');
  const journeys = h.loadJourneys(null);
  let ok = true;
  const report = (spec, got, detail) => {
    const pass = got === spec.expect;
    if (!pass) ok = false;
    console.log((pass ? 'ok       ' : 'MISSED   ') + spec.id.padEnd(22) + ' expected ' + spec.expect.padEnd(7) + ' got ' + got + detail + ' — ' + spec.why);
  };
  for (const spec of SPECS) {
    if (spec.drop) {
      const unknown = spec.drop.filter(id => !journeys.some(j => j.id === id));
      if (unknown.length) { ok = false; console.log('STALE    ' + spec.id + ': no journey ' + unknown.join(', ')); continue; }
      const { got, detail } = await dropOutcome(h, spec, journeys, appDir);
      report(spec, got, detail);
      continue;
    }
    const js = journeys.filter(j => spec.journeys.includes(j.id));
    let runs = h.expand(js);
    if (!spec.profiles) runs = runs.filter(r => !r.variant || r.variant.id === 'at_at' || r.variant.clock !== undefined);
    const { overrides, stale } = buildOverrides(spec, appDir);
    if (stale.length) {
      ok = false;
      console.log('STALE    ' + spec.id + ': ' + stale.join('; '));
      continue;
    }
    const base = await h.runAll(runs, appDir);
    const mutated = await h.runAll(runs, appDir, { sourceOverrides: overrides });
    const cmp = h.compare(base, mutated);
    const got = outcome(cmp, mutated);
    report(spec, got, got === 'rename' ? ' (' + [...cmp.renames.keys()].join(', ') + ')' : '');
  }
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + SPECS.length + ' mutations');
  return ok;
}

module.exports = { run, SPECS };
