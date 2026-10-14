#!/usr/bin/env node
'use strict';
// Journey checks: a robot taps through the app the way a tester does and
// records what the phone shows after every tap.
//
//   node tests/app-journeys.cjs                 run every journey twice; fail on
//                                               app errors, broken handlers,
//                                               unvisited screens or any run-to-run
//                                               difference
//   node tests/app-journeys.cjs --against main  also compare with another commit:
//                                               the phone must be identical; Tools
//                                               text and handler wiring are reported
//   node tests/app-journeys.cjs --series A..B   compare every commit in A..B with A
//   node tests/app-journeys.cjs --justify --base SHA
//                                               CI: the PR body must declare any
//                                               phone, Tools or wiring change
//   node tests/app-journeys.cjs --trace ID      print one journey step by step
//   node tests/app-journeys.cjs --list          journeys and screen coverage
//   node tests/app-journeys.cjs --mutations     prove the checks catch breakage
//   node tests/app-journeys.cjs --selftest      harness unit checks
// Options: --only id[,id]  --out DIR (write the report files)  --report (never fail
// on differences; print them)

const { ensurePinnedEnv } = require('./lib/determinism.cjs');
ensurePinnedEnv();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { REPO, routedScreens } = require('./lib/app-vm.cjs');
const { runJourney } = require('./app-journeys/runner.cjs');
const snap = require('./lib/snapshot.cjs');
const { CHANNEL_NAMES, declared, isNone, unclosedNote, readAs } = require('./lib/pr-declarations.cjs');

const JOURNEY_DIR = path.join(__dirname, 'app-journeys', 'journeys');
const ALIASES = require('./app-journeys/state-aliases.cjs');

function parseArgs(argv) {
  const a = { only: null, out: null, report: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => argv[++i];
    if (v === '--only') a.only = next().split(',');
    else if (v === '--out') a.out = next();
    else if (v === '--against') a.against = next();
    else if (v === '--series') a.series = next();
    else if (v === '--justify') a.justify = true;
    else if (v === '--base') a.base = next();
    else if (v === '--trace') a.trace = next();
    else if (v === '--list') a.list = true;
    else if (v === '--mutations') a.mutations = true;
    else if (v === '--selftest') a.selftest = true;
    else if (v === '--report') a.report = true;
    else if (v === '--folder') a.folder = next();
    else if (v === '-h' || v === '--help') a.help = true;
    else throw new Error('unknown argument ' + v);
  }
  return a;
}

function loadJourneys(only) {
  const files = fs.readdirSync(JOURNEY_DIR).filter(f => f.endsWith('.cjs')).sort();
  const journeys = files.map(f => require(path.join(JOURNEY_DIR, f)));
  const ids = new Set();
  for (const j of journeys) {
    if (!j.id || ids.has(j.id)) throw new Error('journey ids must be unique: ' + j.id);
    ids.add(j.id);
  }
  if (!only) return journeys;
  const missing = only.filter(id => !ids.has(id));
  if (missing.length) throw new Error('no journey ' + missing.join(', '));
  return journeys.filter(j => only.includes(j.id));
}

// The nine skip-setup profiles (docs/decisions.md L26): three places by cost
// of living, three incomes relative to that place.
const PROFILES = [];
for (const tier of ['above', 'at', 'below']) for (const level of ['under', 'at', 'over']) {
  PROFILES.push({ id: tier + '_' + level, params: { tier, level } });
}

function expand(journeys) {
  const runs = [];
  for (const j of journeys) {
    if (j.matrix === 'profiles') for (const v of PROFILES) runs.push({ journey: j, variant: v });
    else runs.push({ journey: j, variant: null });
  }
  return runs;
}

async function runAll(runs, folder, opts = {}) {
  const results = [];
  for (const r of runs) {
    results.push(await runJourney(r.journey, { folder, variant: r.variant, aliases: ALIASES, sourceOverrides: opts.sourceOverrides }));
  }
  return results;
}

// ── Gates ────────────────────────────────────────────────────────────────────

function coverage(results, folder) {
  const routed = routedScreens(folder);
  const counts = Object.fromEntries(routed.map(s => [s, { user: 0, tools: 0, boot: 0 }]));
  for (const r of results) for (const v of r.visits) if (counts[v.screen]) counts[v.screen][v.via]++;
  const missing = routed.filter(s => !counts[s].user && !counts[s].tools && !counts[s].boot);
  return { routed, counts, missing };
}

function sameRun(a, b) {
  if (a.records.length !== b.records.length) return 'step count ' + a.records.length + ' vs ' + b.records.length;
  for (let i = 0; i < a.records.length; i++) {
    for (const ch of ['participant', 'tools', 'wiring']) {
      if (a.records[i][ch] !== b.records[i][ch]) return 'step ' + a.records[i].label + ' (' + ch + ')';
    }
  }
  return null;
}

function printGateSummary(results, cov, nondeterministic) {
  const errors = results.flatMap(r => r.errors);
  const gate = results.flatMap(r => r.gate);
  const warnings = [...new Set(results.flatMap(r => r.warnings))];
  for (const e of errors) console.log('JOURNEY  ' + e);
  for (const g of gate) console.log('GATE     ' + g);
  for (const n of nondeterministic) console.log('UNSTABLE ' + n);
  if (cov.missing.length) console.log('COVERAGE no journey reaches: ' + cov.missing.join(', '));
  for (const w of warnings) console.log('WARNING  ' + w);
  const steps = results.reduce((n, r) => n + r.records.length, 0);
  const ok = !errors.length && !gate.length && !nondeterministic.length && !cov.missing.length;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + results.length + ' journey runs, ' + steps + ' recorded steps, ' +
    (cov.routed.length - cov.missing.length) + '/' + cov.routed.length + ' screens reached' +
    (warnings.length ? ', ' + warnings.length + ' warnings' : ''));
  return ok;
}

// ── Comparison ───────────────────────────────────────────────────────────────

const TOKEN = /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S/g;

// Is b the same wiring as a with identifiers consistently renamed?
function renameMap(aText, bText) {
  const a = aText.split('\n'), b = bText.split('\n');
  if (a.length !== b.length) return null;
  const fwd = new Map(), back = new Map(), counts = new Map();
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const ta = a[i].match(TOKEN) || [], tb = b[i].match(TOKEN) || [];
    if (ta.length !== tb.length) return null;
    for (let k = 0; k < ta.length; k++) {
      if (ta[k] === tb[k]) continue;
      if (!/^[A-Za-z_$]/.test(ta[k]) || !/^[A-Za-z_$]/.test(tb[k])) return null;
      if ((fwd.has(ta[k]) && fwd.get(ta[k]) !== tb[k]) || (back.has(tb[k]) && back.get(tb[k]) !== ta[k])) return null;
      fwd.set(ta[k], tb[k]); back.set(tb[k], ta[k]);
      const key = ta[k] + '→' + tb[k];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function compare(baseResults, headResults) {
  const out = { participant: [], tools: [], wiring: [], renames: new Map() };
  const byId = new Map(baseResults.map(r => [r.id, r]));
  for (const h of headResults) {
    const b = byId.get(h.id);
    if (!b) { out.participant.push({ id: h.id, where: 'journey is new', diff: [] }); continue; }
    const be = b.errors.join('\n'), he = h.errors.join('\n');
    if (be !== he) out.participant.push({ id: h.id, where: 'journey errors differ', diff: snap.lineDiff(be.split('\n'), he.split('\n')) });
    const n = Math.max(b.records.length, h.records.length);
    for (const ch of ['participant', 'tools', 'wiring']) {
      for (let i = 0; i < n; i++) {
        const br = b.records[i], hr = h.records[i];
        const bt = br ? br[ch] : '(no step)', ht = hr ? hr[ch] : '(no step)';
        if (bt === ht) continue;
        if (ch === 'wiring') {
          const m = br && hr ? renameMap(bt, ht) : null;
          if (m) { for (const [k, c] of m) out.renames.set(k, (out.renames.get(k) || 0) + c); continue; }
        }
        out[ch].push({ id: h.id, where: (hr || br).label, diff: snap.lineDiff(bt.split('\n'), ht.split('\n')) });
        if (ch === 'participant') break;          // later steps follow from the first change
      }
    }
  }
  return out;
}

function formatComparison(cmp, baseName, headName) {
  const lines = [];
  const section = (title, list) => {
    if (!list.length) { lines.push(title + ': none'); return; }
    const ids = [...new Set(list.map(d => d.id))];
    lines.push(title + ': ' + list.length + ' step' + (list.length === 1 ? '' : 's') + ' in ' + ids.length + ' journey' + (ids.length === 1 ? '' : 's'));
    for (const d of list.slice(0, 40)) {
      lines.push('  ' + d.id + ' @ ' + d.where);
      for (const l of d.diff.slice(0, 30)) lines.push('    ' + l);
    }
    if (list.length > 40) lines.push('  … ' + (list.length - 40) + ' more');
  };
  lines.push('Comparing ' + headName + ' with ' + baseName);
  section('Participant (phone)', cmp.participant);
  section('Tools', cmp.tools);
  if (cmp.renames.size) lines.push('Wiring renames: ' + [...cmp.renames].map(([k, c]) => k + ' (' + c + ')').join(', '));
  section('Wiring (other)', cmp.wiring);
  return lines.join('\n');
}

function git(args, opts = {}) {
  return execFileSync('git', args, Object.assign({ cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, opts)).trim();
}

async function withWorktree(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-journeys-'));
  const wt = path.join(dir, 'ref');
  git(['worktree', 'add', '--detach', '--quiet', wt, 'HEAD']);
  try { return await fn(wt); }
  finally {
    try { git(['worktree', 'remove', '--force', wt]); } catch (e) { /* already gone */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function checkout(wt, ref) { git(['-C', wt, 'checkout', '--detach', '--quiet', ref]); }

// ── Modes ────────────────────────────────────────────────────────────────────

async function gateMode(args, journeys) {
  const folder = args.folder ? path.resolve(args.folder) : path.join(REPO, 'app');
  const runs = expand(journeys);
  const first = await runAll(runs, folder);
  const second = await runAll(runs, folder);
  const nondeterministic = [];
  first.forEach((r, i) => { const why = sameRun(r, second[i]); if (why) nondeterministic.push(r.id + ': ' + why); });
  const cov = coverage(first, folder);
  if (args.only) cov.missing = [];            // coverage is a whole-suite property
  return printGateSummary(first, cov, nondeterministic);
}

async function againstMode(args, journeys) {
  const runs = expand(journeys);
  const head = await runAll(runs, path.join(REPO, 'app'));
  const cov = coverage(head, path.join(REPO, 'app'));
  if (args.only) cov.missing = [];
  const gatesOk = printGateSummary(head, cov, []);
  const sha = git(['rev-parse', '--short', args.against]);
  const base = await withWorktree(async wt => { checkout(wt, args.against); return runAll(runs, path.join(wt, 'app')); });
  const cmp = compare(base, head);
  const text = formatComparison(cmp, args.against + ' (' + sha + ')', 'working tree');
  console.log(text);
  if (args.out) { fs.mkdirSync(args.out, { recursive: true }); fs.writeFileSync(path.join(args.out, 'against.txt'), text + '\n'); }
  return { ok: gatesOk && (args.report || !cmp.participant.length), cmp };
}

async function seriesMode(args, journeys) {
  const [baseRef, headRef] = args.series.split('..');
  const commits = git(['rev-list', '--reverse', baseRef + '..' + (headRef || 'HEAD')]).split('\n').filter(Boolean);
  const runs = expand(journeys);
  const rows = [];
  let failed = false;
  await withWorktree(async wt => {
    checkout(wt, baseRef);
    const base = await runAll(runs, path.join(wt, 'app'));
    let prev = base;
    for (const c of commits) {
      checkout(wt, c);
      const subject = git(['log', '-1', '--format=%h %s', c]);
      const res = await runAll(runs, path.join(wt, 'app'));
      const vsBase = compare(base, res);
      const vsPrev = compare(prev, res);
      const gate = res.flatMap(r => r.errors.concat(r.gate));
      const row = {
        commit: subject,
        participant: vsBase.participant.length,
        tools: vsPrev.tools.length,
        renames: [...vsPrev.renames].map(([k, n]) => k + ' (' + n + ')'),
        wiring: vsPrev.wiring.length,
        gate: gate.length,
      };
      if (row.participant || row.gate) failed = true;
      rows.push(row);
      console.log((row.participant || row.gate ? 'FAIL ' : 'ok   ') + subject);
      if (row.participant) console.log(formatComparison({ participant: vsBase.participant, tools: [], wiring: [], renames: new Map() }, baseRef, c).split('\n').slice(1, 25).map(l => '       ' + l).join('\n'));
      if (row.tools) console.log('       Tools changed in ' + row.tools + ' steps (vs previous commit)');
      if (row.renames.length) console.log('       Wiring renames: ' + row.renames.join(', '));
      if (row.wiring) console.log('       Wiring changed in ' + row.wiring + ' steps (vs previous commit)');
      if (row.gate) console.log('       ' + gate.slice(0, 5).join('\n       '));
      prev = res;
    }
  });
  const text = rows.map(r => [r.participant ? 'PHONE CHANGED' : 'phone same', r.tools ? 'tools changed' : '', r.renames.length ? 'renames ' + r.renames.join(', ') : '', r.wiring ? 'wiring changed' : '', r.gate ? 'GATE' : '', '·', r.commit].filter(Boolean).join(' ')).join('\n');
  if (args.out) {
    fs.mkdirSync(args.out, { recursive: true });
    fs.writeFileSync(path.join(args.out, 'series.txt'), text + '\n');
    fs.writeFileSync(path.join(args.out, 'series.json'), JSON.stringify(rows, null, 2) + '\n');
  }
  console.log((failed ? 'FAIL' : 'PASS') + '  ' + commits.length + ' commits compared with ' + baseRef);
  return args.report || !failed;
}

async function justifyMode(args, journeys) {
  if (!args.base) throw new Error('--justify needs --base SHA');
  const { ok: gatesOk, cmp } = await againstMode(Object.assign({}, args, { against: args.base, report: true }), journeys);
  const body = process.env.PR_BODY || '';
  const problems = [];
  const notes = [];
  const channels = [['Participant', cmp.participant.length], ['Tools', cmp.tools.length], ['Wiring', cmp.wiring.length + cmp.renames.size]];
  // The browser check compares pictures, so it sees phone and Tools changes this
  // check cannot (a colour, a 1px shift). A declared change there is not an error
  // here; wiring has no picture, so only this check can confirm it.
  const pictured = ['Participant', 'Tools'];
  for (const [name, n] of channels) {
    const d = declared(body, name);
    const label = CHANNEL_NAMES[name][0];
    if (d === undefined) { problems.push('the PR body needs a "' + label + ':" line under "## Phone and Tools changes"' + unclosedNote(body)); continue; }
    const none = isNone(d);
    if (n && none) problems.push(label + ' changed in ' + n + ' step(s), but ' + readAs(body, name) + '; say what changed and why');
    if (!n && !none) {
      if (pictured.includes(name)) notes.push(label + ': the journeys show no change; the PR declares one, which only the browser picture check may see');
      else problems.push(label + ' did not change; the PR should say "' + label + ': none"');
    }
  }
  for (const n of notes) console.log('NOTE     ' + n);
  for (const p of problems) console.log('JUSTIFY  ' + p);
  console.log((problems.length ? 'FAIL' : 'PASS') + '  PR declaration of phone, Tools and wiring changes');
  return gatesOk && !problems.length;
}

async function traceMode(args, journeys) {
  const runs = expand(journeys.filter(j => j.id === args.trace.split('@')[0]));
  const want = args.trace.includes('@') ? args.trace : null;
  for (const r of runs) {
    const res = await runJourney(r.journey, { folder: path.join(REPO, 'app'), variant: r.variant, aliases: ALIASES });
    if (want && res.id !== want) continue;
    console.log('# ' + res.id);
    for (const rec of res.records) {
      const L = rec.participant.split('\n');
      console.log(rec.label + '\n    ' + L.find(l => l.startsWith('screen')) + '\n    ' + L.find(l => l.startsWith('text')).slice(0, 240));
    }
    for (const e of res.errors.concat(res.gate, res.warnings)) console.log('!! ' + e);
    if (!want) break;
  }
  return true;
}

async function listMode(args, journeys) {
  const runs = expand(journeys);
  const results = await runAll(runs, path.join(REPO, 'app'));
  for (const j of journeys) {
    const rs = results.filter(r => r.id === j.id || r.id.startsWith(j.id + '@'));
    console.log(j.id.padEnd(28) + String(rs.length).padStart(2) + ' run(s) ' + String(rs.reduce((n, r) => n + r.records.length, 0)).padStart(5) + ' steps  ' + (j.title || ''));
  }
  const cov = coverage(results, path.join(REPO, 'app'));
  console.log('\nScreen coverage (user / tools / boot visits):');
  for (const s of cov.routed) { const c = cov.counts[s]; console.log('  ' + s.padEnd(26) + String(c.user).padStart(5) + String(c.tools).padStart(6) + String(c.boot).padStart(6)); }
  if (cov.missing.length) console.log('Not reached: ' + cov.missing.join(', '));
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 25).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return true; }
  if (args.selftest) return require('./app-journeys/selftest.cjs').run();
  if (args.mutations) return require('./app-journeys/mutations.cjs').run({ loadJourneys, expand, runAll, compare, formatComparison, coverage, sameRun });
  const journeys = loadJourneys(args.only);
  if (args.trace) return traceMode(args, journeys);
  if (args.list) return listMode(args, journeys);
  if (args.justify) return justifyMode(args, journeys);
  if (args.series) return seriesMode(args, journeys);
  if (args.against) return (await againstMode(args, journeys)).ok;
  return gateMode(args, journeys);
}

if (require.main === module) {
  main().then(ok => process.exit(ok ? 0 : 1), err => { console.error(err && err.stack || err); process.exit(2); });
}

module.exports = { loadJourneys, expand, runAll, compare, formatComparison, coverage, renameMap, PROFILES };
