'use strict';
// Unit checks for the harness's own pieces: the parser, the selector engine,
// the control finder, the clock, the rename detector, the series comparison's
// bases, the state removal list, the PR declaration parser, the typed-text
// check on the page address and title, and that the harness pins en-US and UTC
// whatever the machine's locale and time zone.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const html = require('../lib/html.cjs');
const { Document } = require('../lib/mini-dom.cjs');
const { createClock } = require('../lib/virtual-clock.cjs');
const controls = require('../lib/controls.cjs');
const snap = require('../lib/snapshot.cjs');

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('parser closes implied <p>, <li> and <option>, keeps raw <style>', () => {
  const doc = new Document();
  const root = doc.createElement('div');
  root.innerHTML = '<p>a<div>b</div><ul><li>1<li>2</ul><select><option>x<option selected>y</select><style>a<b{}</style>';
  assert.equal(root.querySelectorAll('li').length, 2);
  assert.equal(root.querySelector('p').textContent, 'a');
  assert.equal(root.querySelector('select').value, 'y');
  assert.equal(root.querySelector('style').textContent, 'a<b{}');
});

check('entities decode in text and attributes', () => {
  assert.equal(html.decodeEntities('&rsaquo; &amp; &#39; &#x2713; &unknown;'), '› & \' ✓ &unknown;');
});

check('selectors: compound, attribute operators, :not, combinators, lists', () => {
  const doc = new Document();
  const root = doc.createElement('div');
  root.innerHTML = '<section id="s"><button class="a b" role="radio" data-x="pre-mid-post">1</button><span><a href="#">2</a></span></section>';
  assert.equal(root.querySelectorAll("button, [role='radio'], a").length, 2);
  assert.ok(root.querySelector('#s > button.a.b[data-x^=pre][data-x$=post][data-x*=mid]'));
  assert.ok(root.querySelector('section a'));
  assert.equal(root.querySelector('section > a'), null);
  assert.equal(root.querySelectorAll('button:not(.c)').length, 1);
  assert.throws(() => root.querySelector('a + b'), /Unsupported/);
});

check('events capture, bubble, stop, and inline handlers see this and event', () => {
  const seen = [];
  const doc = new Document({ compileHandler: src => new Function('event', src) });
  const root = doc.createElement('div');
  doc.appendChild(root);
  root.innerHTML = '<div id="outer" onclick="this.dataset.hit=1"><button id="b" onclick="event.stopPropagation()">x</button></div>';
  root.addEventListener('click', () => seen.push('capture'), true);
  root.addEventListener('click', () => seen.push('bubble'));
  doc.getElementById('b').click();
  assert.deepEqual(seen, ['capture']);
  assert.equal(doc.getElementById('outer').getAttribute('data-hit'), null);
});

check('control names follow aria-label, labels, placeholder and text', () => {
  const doc = new Document();
  const body = doc.createElement('body');
  doc.appendChild(body);
  body.innerHTML = '<main class="phone"><button aria-label="Close">×</button><label for="z">ZIP</label><input id="z">' +
    '<input placeholder="Your name"><button>Save <b>now</b></button><div hidden><button>Hidden</button></div></main>';
  const names = controls.listControls(doc, 'phone').map(c => c.role + ':' + c.name);
  assert.deepEqual(names, ['button:Close', 'textbox:ZIP', 'textbox:Your name', 'button:Save now']);
  assert.throws(() => controls.findControl(doc, { name: /./, role: 'button' }), /ambiguous/);
});

check('virtual clock fires timers in due order and only when advanced', () => {
  const c = createClock(0);
  const order = [];
  c.setTimeout(() => order.push('b'), 20);
  c.setTimeout(() => order.push('a'), 10);
  const id = c.setInterval(() => order.push('i'), 15);
  c.advance(5);
  assert.deepEqual(order, []);
  c.advance(25);
  c.clearInterval(id);
  assert.deepEqual(order, ['a', 'i', 'b', 'i']);
});

check('rename detection accepts consistent renames only', () => {
  const { renameMap, compare } = require('../app-journeys.cjs');
  assert.ok(renameMap('button onclick=fooA(1)\nbutton onclick=fooA(2)', 'button onclick=fooB(1)\nbutton onclick=fooB(2)'));
  assert.equal(renameMap('button onclick=fooA(1)\nbutton onclick=barA(2)', 'button onclick=fooB(1)\nbutton onclick=fooB(2)'), null);
  assert.equal(renameMap('button onclick=fooA(1)', 'button onclick=fooA(2)'), null);
  // Journeys as {id: [wiring per step]}, compared the way --against does.
  // `defined` lists the global names that side's app defines, when it matters.
  const runs = (journeys, defined) => Object.entries(journeys).map(([id, steps]) =>
    ({ id, errors: [], gate: [], defines: defined && (name => defined.includes(name)),
      records: steps.map((wiring, i) => ({ label: String(i), participant: '', tools: '', wiring })) }));
  const judge = (base, head, baseDefined, headDefined) => {
    const c = compare(runs(base, baseDefined), runs(head, headDefined));
    return { renames: Object.fromEntries(c.renames), useberry: Object.fromEntries(c.useberry), wiring: c.wiring.map(d => d.id + '@' + d.where) };
  };
  const nothing = { renames: {}, useberry: {} };
  // A consistent rename, its click-tracking names included, across journeys.
  assert.deepEqual(judge(
    { a: ['button onclick=fooA(1)\nbutton data-ub=home/fooA:1', 'x onclick=go()'], b: ['button onclick=fooA(2)'] },
    { a: ['button onclick=fooB(1)\nbutton data-ub=home/fooB:1', 'x onclick=go()'], b: ['button onclick=fooB(2)'] }),
    { renames: { 'fooA→fooB': 3 }, useberry: {}, wiring: [] });
  // Two handlers swapped: each new name was already in use.
  assert.deepEqual(judge({ a: ['button onclick=fooA()\nbutton onclick=fooB()'] }, { a: ['button onclick=fooB()\nbutton onclick=fooA()'] }),
    Object.assign({ wiring: ['a@0'] }, nothing));
  // A flipped literal and a property read instead of another.
  assert.deepEqual(judge({ a: ['button onclick=setOn(true)'] }, { a: ['button onclick=setOn(false)'] }), Object.assign({ wiring: ['a@0'] }, nothing));
  assert.deepEqual(judge({ a: ["select onchange=state.x=(this.value==='true')"] }, { a: ["select onchange=state.x=(this.checked==='true')"] }),
    Object.assign({ wiring: ['a@0'] }, nothing));
  // One name renamed two ways, or kept in a step that did not change.
  assert.deepEqual(judge({ a: ['button onclick=fooA()'], b: ['button onclick=fooA()'] }, { a: ['button onclick=fooB()'], b: ['button onclick=fooC()'] }),
    Object.assign({ wiring: ['a@0', 'b@0'] }, nothing));
  assert.deepEqual(judge({ a: ['button onclick=fooA()', 'i onclick=fooA()'] }, { a: ['button onclick=fooB()', 'i onclick=fooA()'] }),
    Object.assign({ wiring: ['a@0'] }, nothing));
  // A switch to a function that existed but no journey had tapped, or a new
  // name while the old function stays: not renames. A real one still is.
  const remind = [{ a: ['button onclick=testOldHandler()'] }, { a: ['button onclick=bpLeaseAfford()'] }];
  assert.deepEqual(judge(...remind, ['testOldHandler', 'bpLeaseAfford'], ['testOldHandler', 'bpLeaseAfford']), Object.assign({ wiring: ['a@0'] }, nothing));
  assert.deepEqual(judge(...remind, ['testOldHandler'], ['testOldHandler', 'bpLeaseAfford']), Object.assign({ wiring: ['a@0'] }, nothing));
  assert.deepEqual(judge(...remind, ['testOldHandler'], ['bpLeaseAfford']), { renames: { 'testOldHandler→bpLeaseAfford': 1 }, useberry: {}, wiring: [] });
  // A click-tracking name that changed with no handler rename behind it.
  assert.deepEqual(judge({ a: ['button onclick=fooA()\nbutton data-ub=home/fooA'] }, { a: ['button onclick=fooA()\nbutton data-ub=home/fooZ'] }),
    { renames: {}, useberry: { 'home/fooA→home/fooZ': 1 }, wiring: [] });
});

check('a series compares each commit with its merge base, so a later sync with main is not blamed on it', async () => {
  const { seriesCompare, compare } = require('../app-journeys.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-series-'));
  const g = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=' + path.join(dir, 'no-hooks')].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  // One file per channel; a "run" of a commit reads them back as one step.
  const commit = (files, msg) => {
    for (const [f, v] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), v);
    g('add', '.'); g('commit', '-q', '-m', msg);
    return g('rev-parse', 'HEAD');
  };
  try {
    g('init', '-q', '-b', 'main');
    const m0 = commit({ phone: 'A', tools: 'T0', wiring: 'W0' }, 'm0');
    g('checkout', '-q', '-b', 'work');
    const b1 = commit({ tools: 'T1' }, 'b1: Tools change on the branch');
    g('checkout', '-q', 'main');
    const m1 = commit({ phone: 'B' }, 'm1: main changes the phone');
    g('checkout', '-q', 'work');
    g('merge', '-q', '--no-edit', 'main');
    const b2 = g('rev-parse', 'HEAD');
    const b3 = commit({ phone: 'C' }, 'b3: the branch changes the phone');
    const ran = [];
    const runAt = async sha => {
      ran.push(sha);
      const read = f => g('show', sha + ':' + f);
      return [{ id: 'j', errors: [], gate: [], records: [{ label: '001 step', participant: read('phone'), tools: read('tools'), wiring: read('wiring') }] }];
    };
    // The trap is real: b1 against main's tip shows main's phone change.
    assert.equal(compare(await runAt(m1), await runAt(b1)).participant.length, 1);
    ran.length = 0;
    const rows = [];
    await seriesCompare('main', [b1, b2, b3], runAt, r => rows.push(r), args => g(...args));
    const summary = rows.map(r => [r.mergeBase, r.parent, r.vsBase.participant.length, r.vsParent.tools.length]);
    assert.deepEqual(summary, [[m0, m0, 0, 1], [m1, b1, 0, 0], [m1, b2, 1, 0]]);
    assert.equal(ran.length, new Set(ran).size, 'each commit runs once');
    // From an older base the merged main commit is in the range; the merge's
    // Tools are compared with the branch before it, not with that main commit.
    rows.length = 0;
    await seriesCompare(m0, [b1, m1, b2, b3], runAt, r => rows.push(r), args => g(...args));
    assert.deepEqual(rows.map(r => [r.parent, r.vsParent.tools.length]), [[m0, 1], [m0, 0], [b1, 0], [b2, 0]]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('handler identifiers skip members, keys, locals and strings', () => {
  assert.deepEqual(snap.handlerIdents("state.a=true;render();go('x', {k: v})").sort(), ['go', 'render', 'state', 'v']);
  assert.deepEqual(snap.handlerIdents('const n = 1; (a, b) => a + n; event.preventDefault()'), []);
});

check('state digests leave out listed removed paths and nothing else, and report live ones', () => {
  const aliases = [{ key: 'isV3', as: 'isNew' }, { removed: 'lifestyleWizard', why: 't' },
    { removed: 'xpConfig.discountedRate', why: 't' }, { removed: 'goals.*.legacy', why: 't' }];
  const digest = s => JSON.stringify(snap.stableJson(s, x => x, aliases));
  const state = (extra = {}) => Object.assign({ isNew: true, xpConfig: { rate: 1, discount: 0 }, goals: [{ id: 1, legacyNote: 'a' }, { id: 2 }], legacy: 1 }, extra);
  const withFields = state({ lifestyleWizard: null, xpConfig: { rate: 1, discount: 0, discountedRate: 0.5 },
    goals: [{ id: 1, legacyNote: 'a', legacy: true }, { id: 2, legacy: false }] });
  assert.equal(digest(withFields), digest(state()));
  assert.equal(digest(Object.assign(withFields, { isNew: undefined, isV3: true })), digest(state()));
  assert.deepEqual(Object.keys(snap.flatten(snap.stableJson(withFields, x => x, aliases))).filter(k => /discountedRate|wizard|goals\/\d+\/legacy$/i.test(k)), []);
  // An unlisted difference, and siblings of listed paths, still show.
  assert.notEqual(digest(state({ xpConfig: { rate: 2, discount: 0 } })), digest(state()));
  assert.notEqual(digest(state({ xpConfig: { rate: 1, discount: 1 } })), digest(state()));
  assert.notEqual(digest(state({ goals: [{ id: 1, legacyNote: 'b' }, { id: 2 }] })), digest(state()));
  assert.notEqual(digest(state({ legacy: 2 })), digest(state()));
  // Paths that matched a value the state still has are reported; null counts.
  const matched = new Set();
  snap.stableJson(Object.assign({}, withFields, { lifestyleWizard: null }), x => x, aliases.concat([{ removed: 'absent.field', why: 't' }]), matched);
  assert.deepEqual([...matched].sort(), ['goals.*.legacy', 'lifestyleWizard', 'xpConfig.discountedRate']);
  matched.clear();
  snap.stableJson(state(), x => x, aliases, matched);
  assert.deepEqual([...matched], []);
  // Wildcards alone would blank whole levels of state, the root's included.
  for (const removed of ['*', '*.*']) assert.throws(() => snap.stableJson(state(), x => x, [{ removed, why: 't' }]), /all wildcards/);
  // The reviewed list itself is well formed.
  for (const a of require('./state-aliases.cjs')) {
    const ok = a.removed ? /^[^.\s]+(\.[^.\s]+)*$/.test(a.removed) && !a.removed.split('.').every(s => s === '*') &&
      typeof a.why === 'string' && a.why.trim() !== ''
      : typeof a.key === 'string' && typeof a.as === 'string';
    assert.ok(ok, 'state-aliases.cjs entry ' + JSON.stringify(a));
  }
});

check('PR declarations are read from the "Phone and Tools changes" section', () => {
  const { declared } = require('../lib/pr-declarations.cjs');
  const body = '## Problem\nx\n## Phone and Tools changes\nPhone: none\nTools: wording of a Tools heading\n## Limitations\n';
  assert.equal(declared(body, 'Participant'), 'none');
  assert.equal(declared(body, 'Tools'), 'wording of a Tools heading');
  assert.equal(declared(body, 'Wiring'), undefined);
  assert.equal(declared(body.replace(/\n/g, '\r\n'), 'Tools'), 'wording of a Tools heading');
  assert.equal(declared('## Phone and Tools changes\nPhone:\nTools: none\n', 'Participant'), '');
  // Guidance inside a comment never counts, even across lines.
  const commented = '## Phone and Tools changes\n<!-- e.g.\nPhone: the dark background is darker -->\nPhone: none <!-- or say why -->\n';
  assert.equal(declared(commented, 'Participant'), 'none');
  assert.equal(declared(commented.replace(/\n/g, '\r\n'), 'Participant'), 'none');
  assert.equal(declared('## Phone and Tools changes\n<!--\nPhone: a change\n-->\n', 'Participant'), undefined);
});

check('ways of writing "nothing changed" declare no change; descriptions do', () => {
  const { isNone, declaresChange } = require('../lib/pr-declarations.cjs');
  for (const v of ['', 'none', 'None.', 'none (docs only)', 'none except the dark background', '(none)', '`none`', '**none**',
    '[none]', '"none"', '- none', '-none', '* none', '*', '...', '…', '-', '—', '–', 'no', 'No.', 'not applicable',
    'Not applicable.', 'no visual change', 'No visual changes.', 'same', 'Same as main', 'n/a', 'N/A.', '`n/a`', '(n/a)',
    'N/A — docs', 'N/A (docs only)', 'na', 'nothing', 'Nothing changed', 'no change', 'no changes.', 'No changes; docs only',
    'unchanged', 'Unchanged.', 'TBD', 'TBD — later']) assert.equal(isNone(v), true, JSON.stringify(v));
  for (const v of ['the dark background is one step darker', '- the dark background is darker', '— the dark background is darker',
    'unchanged except the strict-mode label wording', 'nothing changed except the label', 'no change except the colour',
    'same layout, darker background', 'nav bar colour', 'nonexistent screen removed', 'no-change banner added',
    'N/A buttons restyled', 'TBD button added', 'Tools heading reworded']) assert.equal(isNone(v), false, JSON.stringify(v));
  const body = v => '## Phone and Tools changes\nPhone: ' + v + '\nTools: none\n';
  assert.equal(declaresChange(body('(none)'), 'Participant'), false);
  assert.equal(declaresChange(body('a darker background'), 'Participant'), true);
  assert.equal(declaresChange('## Problem\n', 'Participant'), false);
});

check('gate messages say what was read and name an unclosed comment', () => {
  const { readAs, unclosedNote } = require('../lib/pr-declarations.cjs');
  const open = '## Phone and Tools changes\n<!-- say what changed\nPhone: none\nTools: none\n';
  assert.match(readAs(open, 'Participant'), /no "Phone:" line .*unclosed "<!--"/);
  assert.equal(unclosedNote('## Phone and Tools changes\n<!-- ok -->\nPhone: none\n'), '');
  assert.match(readAs('## Phone and Tools changes\nPhone: n/a\n', 'Participant'), /says "n\/a", which declares no change/);
  assert.match(readAs('## Phone and Tools changes\r\nTools:\r\n', 'Tools'), /nothing \(an empty "Tools:" line\)/);
});

check('typed text is found in the page address or title, written as one word too, without false alarms', () => {
  const { typedLeaks } = require('./runner.cjs');
  const own = new Set(['budget', 'home', 'moneybuddy']);
  const page = 'https://x.example/app/index.html?screen=home';
  const at = (typed, href, title = 'MoneyBuddy — Home') => typedLeaks(typed, href, title, own);
  assert.deepEqual(at(['Riley Q'], page + '#v=setup.buddy-rileyq'), ['Riley Q']);
  assert.deepEqual(at(['Long day'], page + '#v=journal.note-long-day'), ['Long day']);
  assert.deepEqual(at(['Scout'], page, 'MoneyBuddy — Home · Scout'), ['Scout']);
  // Short words, the app's own words and the trail's checkpoint are not looked for.
  assert.deepEqual(at(['Al', 'Budget', 'Setup notes'], page.replace('home', 'al-budget') + '#v=setup.zip-37203'), []);
  // A word inside a longer one is not the word.
  assert.deepEqual(at(['Long day'], page + '#v=journal.note-longer'), []);
});

check('the harness pins en-US and UTC whatever the machine locale and time zone', () => {
  const probe = path.join(__dirname, 'locale-probe.cjs');
  const runWith = env => spawnSync(process.execPath, [probe],
    { env: Object.assign({}, process.env, { MB_PINNED: '' }, env), encoding: 'utf8' });
  const us = runWith({ LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8', TZ: 'UTC' });
  const de = runWith({ LC_ALL: 'de_DE.UTF-8', LANG: 'de_DE.UTF-8', TZ: 'America/Los_Angeles' });
  for (const r of [us, de]) assert.equal(r.status, 0, r.stderr);
  const a = JSON.parse(us.stdout), b = JSON.parse(de.stdout);
  assert.equal(a.locale, 'en-US');
  assert.equal(a.timeZone, 'UTC');
  assert.ok(a.steps > 0);
  assert.deepEqual(b, a);
  // Claiming to be pinned already under another locale must refuse to run.
  const fake = runWith({ LC_ALL: 'de_DE.UTF-8', LANG: 'de_DE.UTF-8', TZ: 'America/Los_Angeles', MB_PINNED: '1' });
  assert.notEqual(fake.status, 0);
  assert.match(fake.stderr, /journey harness needs TZ=UTC/);
});

async function run() {
  let failed = 0;
  for (const c of checks) {
    try { await c.fn(); console.log('ok       ' + c.name); }
    catch (err) { failed++; console.log('FAIL     ' + c.name + '\n         ' + String(err && err.message || err).split('\n').join('\n         ')); }
  }
  console.log((failed ? 'FAIL' : 'PASS') + '  ' + checks.length + ' harness self-checks');
  return !failed;
}

module.exports = { run };
