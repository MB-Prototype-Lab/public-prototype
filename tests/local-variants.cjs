const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../gate/local-variants.js'), 'utf8');

function element(tag = "div") {
  return {
    tag, children: [], hidden: true, textContent: '', style: {}, events: {}, attributes: {},
    classList: { add() {}, remove() {} },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, callback) { this.events[type] = callback; },
    focus() { this.focused = true; },
    remove() { this.removed = true; },
    replaceChild(next, old) { this.children[this.children.indexOf(old)] = next; },
    appendChild(child) { this.children.push(child); },
    set innerHTML(_) { throw new Error('comparison text must not become HTML'); }
  };
}

function run(manifest, returnInfo, href = 'file:///tmp/My%20Project/index.html') {
  const section = element();
  const list = element();
  const launch = element('button');
  const selector = element();
  const body = element('body');
  const listeners = [];
  const redirects = [];
  const url = new URL(href);
  const context = {
    URL,
    window: { MB_LOCAL_VARIANTS: manifest, MB_LOCAL_RETURN: returnInfo },
    location: {
      href: url.href, protocol: url.protocol, pathname: url.pathname,
      replace(value) { redirects.push(value); }
    },
    document: {
      body,
      addEventListener(type, callback) { if (type === 'DOMContentLoaded') listeners.push(callback); },
      getElementById(id) { return id === 'localAlternatives' ? section : id === 'localAlternativesList' ? list : id === 'localCompare' ? launch : id === 'selectorScreen' ? selector : null; },
      createElement(tag) { return element(tag); }
    }
  };
  vm.runInNewContext(source, context);
  listeners.forEach(callback => callback());
  return { section, list, redirects, launch, selector, body };
}

const valid = id => ({ id, label: `Option ${id}`, description: `Description ${id}`,
  href: `.worktrees/${id}/app/index.html` });

for (const manifest of [undefined, null, {}, { active: true },
  { active: true, variants: [] }, { active: false, variants: [valid('a')] },
  { active: true, variants: 'bad' }]) {
  const result = run(manifest);
  assert.equal(result.section.hidden, true);
  assert.equal(result.list.children.length, 0);
}

const unsafe = { ...valid('a'), label: '<img src=x onerror=evil()>',
  description: '<script>alert(1)</script>' };
const rendered = run({ active: true, variants: [unsafe, valid('b'), valid('b'),
  { ...valid('bad'), href: '../escape' }, valid('../escape')] });
assert.equal(rendered.section.hidden, false);
assert.equal(rendered.list.children.length, 2);
assert.equal(rendered.list.children[0].children[0].textContent, unsafe.label);
assert.equal(rendered.list.children[0].children[1].textContent, unsafe.description);
assert.equal(rendered.list.children[0].children[0].href, '.worktrees/a/app/index.html');
assert.equal(rendered.list.children[0].children[2].target, '_blank');
assert.equal(rendered.list.children[0].children[2].rel, 'noopener');
assert.equal(rendered.list.children[1].children[0].href, '.worktrees/b/app/index.html');

const primary = 'file:///tmp/My%20Project/index.html';
const variantRoot = 'file:///tmp/My%20Project/.worktrees/a/index.html';
assert.deepEqual(run(undefined, { href: primary }, variantRoot).redirects, [primary]);
assert.deepEqual(run(undefined, { href: 'file:///tmp/other/index.html' }, variantRoot).redirects, []);
assert.deepEqual(run(undefined, { href: primary }, primary).redirects, []);
assert.deepEqual(run(undefined, { href: primary }, 'https://example.com/.worktrees/a/index.html').redirects, []);

const windowsPrimary = 'file:///C:/Users/PM/My%20Project/index.html';
const windowsVariant = 'file:///C:/Users/PM/My%20Project/.worktrees/a/index.html';
assert.deepEqual(run(undefined, { href: windowsPrimary }, windowsVariant).redirects, [windowsPrimary]);

// The same generated metadata must work from Linux, Windows drives, and WSL shares.
for (const root of [primary, windowsPrimary,
  'file://wsl.localhost/Ubuntu/home/pm/My%20Project/index.html',
  'file://wsl$/Ubuntu/home/pm/My%20Project/index.html']) {
  const variant = new URL('.worktrees/variant-A/index.html', root).href;
  assert.deepEqual(run(undefined, { href: '../../index.html' }, variant).redirects, [root]);
  assert.deepEqual(run(undefined, { href: '../../../index.html' }, variant).redirects, []);
  assert.deepEqual(run(undefined, { href: '../../index.html' }, root).redirects, []);
}

for (const id of ['variant-A', 'variant-B', 'variant-AA', 'variant-A-2']) {
  const result = run({ active: true, variants: [valid(id)] });
  assert.equal(result.list.children[0].children[0].href, `.worktrees/${id}/app/index.html`);
}

console.log('Local selector manifest and return navigation verified.');

// Exercise the user controls; no workspace internals or frame DOM are exposed.
const session = run({ active: true, variants: [unsafe, valid('b'), valid('c')] });
session.launch.events.click();
const workspace = session.body.children[0];
const toolbar = workspace.children[0];
const back = toolbar.children[0];
const count = toolbar.children[2].children[0];
const stage = workspace.children[2];
const pane = i => stage.children[i];
const select = i => pane(i).children[0].children[0].children[1];
const actions = i => pane(i).children[0].children[2].children;
const frame = i => pane(i).children[1];
const choose = (i, value) => { select(i).value = String(value); select(i).events.change(); };
const resize = value => { count.value = String(value); count.events.change(); };
assert.equal(stage.children.length, 2); // Lazy creation.
assert.equal(count.value, '2');
assert.equal(count.children.length, 4);
assert.equal(select(0).children[0].textContent, unsafe.label);
assert.equal(frame(0).title, unsafe.label + ' — interactive preview');
const a = frame(0), b = frame(1);
choose(1, 2); // B -> C, retaining B.
assert.equal(stage.children.length, 3);
assert.equal(pane(1).hidden, true);
assert.equal(pane(2).style.gridColumn, '2');
choose(2, 1); // C -> B.
assert.equal(frame(1), b);
assert.equal(pane(1).hidden, false);
choose(0, 1); // Visible variant swaps assignments.
assert.equal(pane(1).style.gridColumn, '1');
assert.equal(pane(0).style.gridColumn, '2');
assert.equal(select(1).focused, true);
assert.equal(frame(0), a);
resize(1);
assert.equal(pane(0).hidden, true);
resize(3);
assert.equal(pane(0).style.gridColumn, '2');
assert.equal(pane(2).style.gridColumn, '3');
assert.equal(frame(0), a);
actions(0)[0].events.click();
assert.equal(stage.style.gridTemplateColumns, '460px 920px 460px');
assert.equal(actions(0)[0].attributes['aria-pressed'], 'true');
assert.equal(frame(0), a);
actions(0)[0].events.click();
assert.equal(stage.style.gridTemplateColumns, '460px 460px 460px');
actions(0)[1].events.click();
assert.notEqual(frame(0), a);
assert.equal(frame(0).src, '.worktrees/a/app/index.html');
assert.equal(frame(1), b);
resize(4);
assert.equal(frame(3).src, 'app/index.html');
assert.equal(actions(3)[2].href, 'app/index.html');
assert.equal(actions(3)[2].rel, 'noopener');
resize(0); // Invalid synthetic input cannot corrupt assignments.
assert.equal(pane(3).hidden, false);
back.events.click();
assert.equal(workspace.removed, true);
assert.equal(session.selector.style.display, 'flex');
assert.equal(session.launch.focused, true);
session.launch.events.click();
assert.equal(session.body.children[1].children[2].children.length, 2);
assert.notEqual(session.body.children[1].children[2].children[0].children[1], a);
assert.equal(run({ active: true, variants: [valid('a')] }).body.children.length, 0);
for (const href of ['javascript:alert(1)', 'https://example.com', '//example.com', '.worktrees/a/app/index.html?x']) {
  assert.equal(run({ active: true, variants: [{ ...valid('a'), href }] }).section.hidden, true);
}
console.log('Comparison assignments, frame lifetime, tools, restart and exit verified.');
