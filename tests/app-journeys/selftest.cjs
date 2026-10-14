'use strict';
// Unit checks for the harness's own pieces: the parser, the selector engine,
// the control finder, the clock, the rename detector, the PR declaration
// parser, and that a different machine locale or time zone changes nothing.

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
  const { renameMap } = require('../app-journeys.cjs');
  assert.ok(renameMap('button onclick=fooA(1)\nbutton onclick=fooA(2)', 'button onclick=fooB(1)\nbutton onclick=fooB(2)'));
  assert.equal(renameMap('button onclick=fooA(1)\nbutton onclick=barA(2)', 'button onclick=fooB(1)\nbutton onclick=fooB(2)'), null);
  assert.equal(renameMap('button onclick=fooA(1)', 'button onclick=fooA(2)'), null);
});

check('handler identifiers skip members, keys, locals and strings', () => {
  assert.deepEqual(snap.handlerIdents("state.a=true;render();go('x', {k: v})").sort(), ['go', 'render', 'state', 'v']);
  assert.deepEqual(snap.handlerIdents('const n = 1; (a, b) => a + n; event.preventDefault()'), []);
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

check('a different machine locale and time zone change nothing', () => {
  const script = path.join(__dirname, '..', 'app-journeys.cjs');
  const runWith = env => spawnSync(process.execPath, [script, '--only', 'onboarding-full,esf-have-one'],
    { env: Object.assign({}, process.env, env, { MB_PINNED: '' }), encoding: 'utf8' }).stdout;
  const a = runWith({ LC_ALL: 'en_US.UTF-8', TZ: 'UTC' });
  const b = runWith({ LC_ALL: 'de_DE.UTF-8', TZ: 'America/Los_Angeles' });
  assert.match(a, /^PASS /m);
  assert.equal(a, b);
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
