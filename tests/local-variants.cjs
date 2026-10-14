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

function run(manifest, returnInfo, href = 'file:///tmp/My%20Project/index.html', { storage, navigation = 'navigate', flows } = {}) {
  const section = element();
  const list = element();
  const launch = element('button');
  const selector = element();
  const title = element('h2');
  const slot = element();
  const tabs = element();
  const prototypeTab = element('button');
  const flowsTab = element('button');
  const body = element('body');
  const nodes = { localAlternatives: section, localAlternativesList: list, localCompare: launch,
    selectorScreen: selector, localAlternativesTitle: title, localFlowVariantsSlot: slot,
    gateTabs: tabs, gateTabPrototype: prototypeTab, gateTabFlows: flowsTab };
  const listeners = [];
  const redirects = [];
  const selectedTabs = [];
  const url = new URL(href);
  const context = {
    URL,
    window: { MB_LOCAL_VARIANTS: manifest, MB_LOCAL_RETURN: returnInfo, MB_FLOWS: flows },
    gateSelectTab(name, remember) { selectedTabs.push([name, remember]); },
    location: {
      href: url.href, protocol: url.protocol, pathname: url.pathname,
      replace(value) { redirects.push(value); }
    },
    performance: { getEntriesByType: () => [{ type: navigation }] },
    document: {
      body,
      addEventListener(type, callback) { if (type === 'DOMContentLoaded') listeners.push(callback); },
      getElementById(id) { return Object.hasOwn(nodes, id) ? nodes[id] : null; },
      createElement(tag) { return element(tag); }
    }
  };
  if (storage) context.sessionStorage = storage;
  vm.runInNewContext(source, context);
  listeners.forEach(callback => callback());
  return { section, list, redirects, launch, selector, body, title, slot, tabs, prototypeTab, flowsTab, selectedTabs };
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
// Rows match the Flow list and open in this tab; no separate new-tab links.
const row = rendered.list.children[0];
assert.equal(row.tag, 'a');
assert.equal(row.className, 'gate-row');
assert.equal(row.href, '.worktrees/a/app/index.html');
assert.equal(row.target, undefined);
assert.equal(row.children.length, 2);
assert.equal(row.children[0].className, 'gate-row-name');
assert.equal(row.children[0].textContent, unsafe.label);
assert.equal(row.children[1].className, 'gate-row-note');
assert.equal(row.children[1].textContent, unsafe.description);
assert.equal(rendered.list.children[1].href, '.worktrees/b/app/index.html');
assert.equal(run({ active: true, variants: [{ ...valid('a'), description: ' ' }] }).list.children[0].children.length, 1);
// App variants stay on the Prototype tab, which counts them and is suggested.
assert.equal(rendered.slot.children.length, 0);
assert.equal(rendered.title.textContent, 'Prototype variants');
assert.equal(rendered.tabs.attributes['data-default-tab'], 'prototype');
assert.equal(rendered.prototypeTab.children.length, 1);
assert.equal(rendered.prototypeTab.children[0].className, 'local-tab-count');
assert.equal(rendered.prototypeTab.children[0].children[0].textContent, ' (2)');
assert.equal(rendered.prototypeTab.children[0].children[0].attributes['aria-hidden'], 'true');
assert.equal(rendered.prototypeTab.children[0].children[1].className, 'gate-sr-only');
assert.equal(rendered.prototypeTab.children[0].children[1].textContent, ', 2 variants');
assert.equal(rendered.flowsTab.children.length, 0);
assert.equal(run({ active: true, variants: [valid('a')] }).prototypeTab.children[0].children[1].textContent, ', 1 variant');
assert.equal(run({ active: true, target: { kind: 'app', label: 'ignored', path: 'app/index.html' },
  variants: [valid('a')] }).title.textContent, 'Prototype variants');

const primary = 'file:///tmp/My%20Project/index.html';
const variantRoot = 'file:///tmp/My%20Project/.worktrees/a/index.html';
assert.deepEqual(run(undefined, { href: primary }, variantRoot).redirects, [primary]);
assert.deepEqual(run(undefined, { href: 'file:///tmp/other/index.html' }, variantRoot).redirects, []);
assert.deepEqual(run(undefined, { href: primary }, primary).redirects, []);
assert.deepEqual(run(undefined, { href: primary }, 'https://example.com/.worktrees/a/index.html').redirects, []);
// A variant Flow page itself never redirects; its exits reach the worktree root first.
assert.deepEqual(run(undefined, { href: primary }, 'file:///tmp/My%20Project/.worktrees/a/flows/x/index.html').redirects, []);

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
  assert.equal(result.list.children[0].href, `.worktrees/${id}/app/index.html`);
}

// A Flow comparison: the same section, moved under the Flows list.
const flowsData = { schema: 1, flows: [{ id: 'emergency-fund', label: 'Emergency fund', description: '',
  path: 'flows/emergency-fund/index.html' }] };
const flowTarget = { kind: 'flow', id: 'emergency-fund', label: 'Recorded name', path: 'flows/emergency-fund/index.html' };
const flowVariant = id => ({ ...valid(id), href: `.worktrees/${id}/flows/emergency-fund/index.html` });
{
  const result = run({ active: true, target: flowTarget, variants: [flowVariant('variant-A'), flowVariant('variant-B'), valid('variant-C')] },
    undefined, undefined, { flows: flowsData });
  assert.equal(result.section.hidden, false);
  assert.equal(result.slot.children[0], result.section);
  assert.equal(result.list.children.length, 2, 'an app href does not belong to a Flow comparison');
  assert.equal(result.list.children[0].href, '.worktrees/variant-A/flows/emergency-fund/index.html');
  assert.equal(result.title.textContent, 'Emergency fund variants', 'the primary\'s current name');
  assert.equal(result.tabs.attributes['data-default-tab'], 'flows');
  assert.equal(result.flowsTab.children[0].children[0].textContent, ' (2)');
  assert.equal(result.prototypeTab.children.length, 0);
  assert.equal(result.launch.hidden, false);
  result.launch.events.click();
  const ws = result.body.children[0];
  assert.equal(ws.children[0].children[1].textContent, 'Compare Emergency fund variants');
  assert.equal(ws.attributes['aria-label'], 'Compare Emergency fund variants');
  const flowCount = ws.children[0].children[2].children[0];
  assert.equal(flowCount.children.length, 3);
  const flowSelect = ws.children[2].children[0].children[0].children[0].children[1];
  assert.equal(flowSelect.children[2].textContent, 'Local Emergency fund');
  flowCount.value = '3'; flowCount.events.change();
  assert.equal(ws.children[2].children[2].children[1].src, 'flows/emergency-fund/index.html');
  ws.children[0].children[0].events.click(); // Back to versions returns to the Flows tab.
  assert.deepEqual(result.selectedTabs, [['flows', false]]);
  assert.equal(result.launch.focused, true);
}
{ // Without the primary's own copy there is no baseline; one variant alone has nothing to compare.
  const unlisted = run({ active: true, target: flowTarget, variants: [flowVariant('variant-A')] });
  assert.equal(unlisted.section.hidden, false);
  assert.equal(unlisted.title.textContent, 'Recorded name variants');
  assert.equal(unlisted.launch.hidden, true);
  const two = run({ active: true, target: flowTarget, variants: [flowVariant('variant-A'), flowVariant('variant-B')] });
  assert.equal(two.launch.hidden, false);
  two.launch.events.click();
  assert.equal(two.body.children[0].children[0].children[2].children[0].children.length, 2);
}
for (const target of [null, [], 'flow', { kind: 'other' }, { ...flowTarget, id: 'Emergency-fund', path: 'flows/Emergency-fund/index.html' },
  { ...flowTarget, id: '../app', path: 'flows/../app/index.html' }, { ...flowTarget, path: 'app/index.html' },
  { ...flowTarget, path: 'flows/emergency-fund/index.html?x' }, { ...flowTarget, label: ' ' }, { ...flowTarget, label: 7 },
  { kind: 'app', path: 'flows/emergency-fund/index.html' }, { kind: 'flow', id: 'a'.repeat(65), label: 'Long', path: `flows/${'a'.repeat(65)}/index.html` }]) {
  const result = run({ active: true, target, variants: [flowVariant('variant-A'), valid('variant-B')] }, undefined, undefined, { flows: flowsData });
  assert.equal(result.section.hidden, true, JSON.stringify(target));
  assert.equal(result.list.children.length, 0);
  assert.equal(result.tabs.attributes['data-default-tab'], undefined);
}

console.log('Local selector manifest and return navigation verified.');

// Exercise the user controls; no workspace internals or frame DOM are exposed.
const session = run({ active: true, variants: [unsafe, valid('b'), valid('c')] });
session.launch.events.click();
const workspace = session.body.children[0];
const toolbar = workspace.children[0];
const back = toolbar.children[0];
assert.equal(toolbar.children[1].textContent, 'Compare Prototype variants');
assert.equal(workspace.attributes['aria-label'], 'Compare Prototype variants');
const count = toolbar.children[2].children[0];
// No session storage here: the pin is offered but explains why it cannot stick.
assert.equal(toolbar.children[3].children[0].disabled, true);
assert.match(toolbar.children[3].children[1].textContent, /unavailable/);
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
assert.deepEqual(session.selectedTabs, [['prototype', false]]);
assert.equal(session.launch.focused, true);
session.launch.events.click();
assert.equal(session.body.children[1].children[2].children.length, 2);
assert.notEqual(session.body.children[1].children[2].children[0].children[1], a);
assert.equal(run({ active: true, variants: [valid('a')] }).body.children.length, 0);
for (const href of ['javascript:alert(1)', 'https://example.com', '//example.com', '.worktrees/a/app/index.html?x']) {
  assert.equal(run({ active: true, variants: [{ ...valid('a'), href }] }).section.hidden, true);
}
console.log('Comparison assignments, frame lifetime, tools, restart and exit verified.');

// Pin on refresh: the toolbar shares the tab's pin and keeps the layout while pinned.
const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: k => (k in data ? data[k] : null), setItem(k, v) { data[k] = String(v); }, removeItem(k) { delete data[k]; } };
};
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
assert.match(read('gate/gate.js'), /GATE_SESSION_KEY = "mb_gate_unlocked"/);
assert.match(read('app/js/refresh-pin.js'), /REFRESH_PIN_KEY = "mb_refresh_pin"/);
assert.match(source, /PIN_KEY = "mb_refresh_pin"/);
assert.match(source, /UNLOCK_KEY = "mb_gate_unlocked"/);
const three = { active: true, variants: [valid('a'), valid('b'), valid('c')] };
const href = id => id === 'local' ? 'app/index.html' : `.worktrees/${id}/app/index.html`;
{
  const storage = memoryStorage({ mb_gate_unlocked: '1' });
  const first = run(three, undefined, undefined, { storage });
  first.launch.events.click();
  const ws = first.body.children[0];
  const pinLabel = ws.children[0].children[3];
  const pin = pinLabel.children[0];
  assert.equal(pin.type, 'checkbox');
  assert.equal(pin.checked, false);
  assert.equal(pinLabel.children[1].textContent, 'Pin on refresh');
  assert.equal(storage.data.mb_compare_layout, undefined); // Nothing is kept while unpinned.
  pin.checked = true; pin.events.change();
  assert.equal(storage.data.mb_refresh_pin, '1');
  assert.deepEqual(JSON.parse(storage.data.mb_compare_layout),
    { v: 1, target: 'app/index.html', count: 2, slots: ['a', 'b', 'c', 'local'].map(href), tools: [] });
  const wsCount = ws.children[0].children[2].children[0];
  wsCount.value = '3'; wsCount.events.change();
  const wsStage = ws.children[2];
  const aSelect = wsStage.children[0].children[0].children[0].children[1];
  aSelect.value = '1'; aSelect.events.change(); // Pane 1 shows B, pane 2 shows A.
  wsStage.children[0].children[0].children[2].children[0].events.click(); // Tools on A.
  const savedLayout = JSON.parse(storage.data.mb_compare_layout);
  assert.deepEqual(savedLayout, { v: 1, target: 'app/index.html', count: 3, slots: ['b', 'a', 'c', 'local'].map(href), tools: [href('a')] });

  // Refresh: same layout, fresh panes, still pinned.
  const again = run(three, undefined, undefined, { storage, navigation: 'reload' });
  const restored = again.body.children[0];
  assert.ok(restored, 'pinned refresh reopens the workspace');
  assert.equal(again.selector.style.display, 'none');
  assert.equal(restored.children[0].children[2].children[0].value, '3');
  assert.equal(restored.children[0].children[3].children[0].checked, true);
  const rStage = restored.children[2];
  assert.equal(rStage.children[0].children[1].src, href('b'));
  assert.equal(rStage.children[0].style.gridColumn, '1');
  assert.equal(rStage.children[1].children[1].src, href('a'));
  assert.equal(rStage.children[1].style.gridColumn, '2');
  assert.equal(rStage.children[2].children[1].src, href('c'));
  const aTools = rStage.children[1].children[0].children[2].children[0];
  assert.equal(aTools.textContent, 'Hide tools');
  assert.equal(aTools.attributes['aria-pressed'], 'true');
  assert.equal(rStage.style.gridTemplateColumns, '460px 920px 460px');
  assert.deepEqual(JSON.parse(storage.data.mb_compare_layout), savedLayout);

  // Back to versions leaves the pin set; the next refresh stays on the selector.
  restored.children[0].children[0].events.click();
  assert.equal(storage.data.mb_compare_layout, undefined);
  assert.equal(storage.data.mb_refresh_pin, '1');
  assert.equal(again.selector.style.display, 'flex');
  assert.equal(run(three, undefined, undefined, { storage, navigation: 'reload' }).body.children.length, 0);
}
{ // Variants that left the manifest fall back to the defaults. Records from
  // before comparison targets carry none and still restore the app layout.
  const record = JSON.stringify({ v: 1, count: 2, slots: ['gone', 'c'].map(href), tools: [href('gone')] });
  const storage = memoryStorage({ mb_gate_unlocked: '1', mb_refresh_pin: '1', mb_compare_layout: record });
  const stale = run(three, undefined, undefined, { storage, navigation: 'reload' }).body.children[0].children[2];
  assert.equal(stale.children[0].children[1].src, href('c'));
  assert.equal(stale.children[1].children[1].src, href('a'));
  assert.equal(stale.style.gridTemplateColumns, '460px 460px');
}
{ // Only a pinned, unlocked refresh restores; every load clears the record.
  const record = JSON.stringify({ v: 1, count: 1, slots: [], tools: [] });
  for (const [initial, navigation] of [
    [{ mb_refresh_pin: '1', mb_compare_layout: record }, 'reload'],
    [{ mb_gate_unlocked: '1', mb_compare_layout: record }, 'reload'],
    [{ mb_gate_unlocked: '1', mb_refresh_pin: '1', mb_compare_layout: record }, 'navigate'],
    [{ mb_gate_unlocked: '1', mb_refresh_pin: '1', mb_compare_layout: '{bad' }, 'reload'],
    [{ mb_gate_unlocked: '1', mb_refresh_pin: '1', mb_compare_layout: JSON.stringify({ v: 2 }) }, 'reload']]) {
    const storage = memoryStorage(initial);
    assert.equal(run(three, undefined, undefined, { storage, navigation }).body.children.length, 0);
    assert.equal(storage.data.mb_compare_layout, undefined);
  }
  const closed = memoryStorage({ mb_gate_unlocked: '1', mb_refresh_pin: '1', mb_compare_layout: record });
  run(undefined, undefined, undefined, { storage: closed, navigation: 'reload' });
  assert.equal(closed.data.mb_compare_layout, undefined);
}
{ // A tab pinned elsewhere is pinned here too; unpinning drops the kept layout.
  const storage = memoryStorage({ mb_refresh_pin: '1' });
  const shared = run(three, undefined, undefined, { storage });
  shared.launch.events.click();
  const pin = shared.body.children[0].children[0].children[3].children[0];
  assert.equal(pin.checked, true);
  assert.ok(storage.data.mb_compare_layout);
  pin.checked = false; pin.events.change();
  assert.equal(storage.data.mb_refresh_pin, undefined);
  assert.equal(storage.data.mb_compare_layout, undefined);
}
{ // A layout kept for one comparison target never reopens another.
  const flowManifest = { active: true, target: flowTarget, variants: [flowVariant('variant-A'), flowVariant('variant-B')] };
  const appRecord = JSON.stringify({ v: 1, target: 'app/index.html', count: 2, slots: [], tools: [] });
  const storage = memoryStorage({ mb_gate_unlocked: '1', mb_refresh_pin: '1', mb_compare_layout: appRecord });
  assert.equal(run(flowManifest, undefined, undefined, { storage, navigation: 'reload', flows: flowsData }).body.children.length, 0);
  assert.equal(storage.data.mb_compare_layout, undefined);
  const legacy = memoryStorage({ mb_gate_unlocked: '1', mb_refresh_pin: '1', mb_compare_layout: JSON.stringify({ v: 1, count: 2, slots: [], tools: [] }) });
  assert.equal(run(flowManifest, undefined, undefined, { storage: legacy, navigation: 'reload', flows: flowsData }).body.children.length, 0);
  storage.setItem('mb_compare_layout', JSON.stringify({ v: 1, target: 'flows/emergency-fund/index.html', count: 3, slots: [], tools: [] }));
  const reopened = run(flowManifest, undefined, undefined, { storage, navigation: 'reload', flows: flowsData }).body.children[0];
  assert.equal(reopened.children[0].children[2].children[0].value, '3');
  assert.equal(JSON.parse(storage.data.mb_compare_layout).target, 'flows/emergency-fund/index.html');
}
console.log('Comparison pin, layout restore and Back to versions verified.');
