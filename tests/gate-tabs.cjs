// Prototype / Flows toggle on the root selector: default, remembered tab,
// empty-panel fallback, ARIA state, keyboard, and failure isolation.
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('gate/gate.js', 'utf8');

function element() {
  return {
    style: {}, value: '', hidden: false, tabIndex: 0, attrs: {}, handlers: {}, entries: false, focused: 0,
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
    querySelector(selector) { assert.equal(selector, 'a[href]'); return this.entries ? {} : null; },
    focus() { this.focused += 1; },
  };
}

function boot({ prototype = true, flows = true, stored, unlocked = true, storageThrows = false, domThrows = false } = {}) {
  const elements = {};
  const el = id => elements[id] ||= element();
  el('gatePanelPrototype').entries = prototype;
  el('gatePanelFlows').entries = flows;
  if (domThrows) el('gatePanelFlows').querySelector = () => { throw new Error('broken DOM'); };
  const store = { mb_gate_unlocked: unlocked ? '1' : null, mb_gate_tab: stored ?? null };
  const sessionStorage = {
    getItem(key) { if (storageThrows) throw new Error('blocked'); return store[key] ?? null; },
    setItem(key, value) { if (storageThrows) throw new Error('blocked'); store[key] = String(value); },
  };
  const context = vm.createContext({ document: { getElementById: el, addEventListener() {} }, location: { protocol: 'file:' }, sessionStorage });
  vm.runInContext(source, context);
  context.gateInit();
  return { el, store, context };
}

function selected({ el }) {
  const prototype = el('gateTabPrototype').attrs['aria-selected'] === 'true';
  const flows = el('gateTabFlows').attrs['aria-selected'] === 'true';
  assert.notEqual(prototype, flows);
  assert.equal(el('gatePanelPrototype').hidden, !prototype);
  assert.equal(el('gatePanelFlows').hidden, !flows);
  assert.equal(el('gateTabPrototype').tabIndex, prototype ? 0 : -1);
  assert.equal(el('gateTabFlows').tabIndex, flows ? 0 : -1);
  return prototype ? 'prototype' : 'flows';
}

function key(target, name) {
  let prevented = false;
  target.handlers.keydown.forEach(fn => fn({ key: name, preventDefault() { prevented = true; } }));
  return prevented;
}

// Both sides listed: the toggle is a real tablist and Prototype is the default.
let gate = boot();
assert.equal(gate.el('selectorScreen').style.display, 'flex');
assert.equal(gate.el('gateTabs').hidden, false);
assert.equal(gate.el('gateTabs').attrs.role, 'tablist');
assert.equal(gate.el('gateTabFlows').attrs.role, 'tab');
assert.equal(gate.el('gatePanelFlows').attrs.role, 'tabpanel');
assert.equal(selected(gate), 'prototype');
assert.equal(gate.store.mb_gate_tab, null, 'the automatic default is not remembered');

// A person's choice is remembered for the session, so Exit Flow lands on Flows.
gate.el('gateTabFlows').handlers.click.forEach(fn => fn());
assert.equal(selected(gate), 'flows');
assert.equal(gate.store.mb_gate_tab, 'flows');
assert.equal(selected(boot({ stored: 'flows' })), 'flows');
assert.equal(selected(boot({ stored: 'other' })), 'prototype');

// Keyboard: arrows wrap and move focus; Home/End jump; other keys are ignored.
gate = boot();
assert.equal(key(gate.el('gateTabPrototype'), 'ArrowRight'), true);
assert.equal(selected(gate), 'flows');
assert.equal(gate.el('gateTabFlows').focused, 1);
assert.equal(key(gate.el('gateTabFlows'), 'ArrowRight'), true);
assert.equal(selected(gate), 'prototype');
assert.equal(gate.store.mb_gate_tab, 'prototype');
assert.equal(key(gate.el('gateTabPrototype'), 'ArrowLeft'), true);
assert.equal(selected(gate), 'flows');
assert.equal(key(gate.el('gateTabFlows'), 'Home'), true);
assert.equal(selected(gate), 'prototype');
assert.equal(key(gate.el('gateTabPrototype'), 'End'), true);
assert.equal(selected(gate), 'flows');
assert.equal(key(gate.el('gateTabFlows'), 'Enter'), false);
assert.equal(selected(gate), 'flows');

// Published before any Flow snapshot: no toggle, no tab roles, Prototype shown,
// and the remembered choice survives for when Flows return.
gate = boot({ flows: false, stored: 'flows' });
assert.equal(gate.el('gateTabs').hidden, true);
assert.equal(gate.el('gateTabs').attrs.role, undefined);
assert.equal(gate.el('gateTabPrototype').attrs.role, undefined);
assert.equal(gate.el('gatePanelPrototype').attrs.role, undefined);
assert.equal(selected(gate), 'prototype');
assert.equal(gate.store.mb_gate_tab, 'flows');

// Only Flows listed: show Flows without a toggle.
gate = boot({ prototype: false });
assert.equal(gate.el('gateTabs').hidden, true);
assert.equal(selected(gate), 'flows');

// Blocked storage or a broken DOM never blocks access to the selector.
gate = boot({ storageThrows: true });
assert.equal(gate.el('passcodeScreen').style.display, 'flex', 'blocked storage re-asks, as before');
gate.el('gateInput').value = '1337';
gate.context.gateSubmit();
assert.equal(gate.el('selectorScreen').style.display, 'flex');
assert.equal(selected(gate), 'prototype');
gate.el('gateTabFlows').handlers.click.forEach(fn => fn());
assert.equal(selected(gate), 'flows');
gate = boot({ domThrows: true });
assert.equal(gate.el('selectorScreen').style.display, 'flex');
assert.equal(gate.el('gatePanelPrototype').hidden, false);

// Passcode path: the toggle is decided when the selector appears.
gate = boot({ unlocked: false, stored: 'flows' });
assert.equal(gate.el('passcodeScreen').style.display, 'flex');
gate.el('gateInput').value = '1337';
gate.context.gateSubmit();
assert.equal(gate.el('selectorScreen').style.display, 'flex');
assert.equal(selected(gate), 'flows');

console.log('Selector toggle checks passed.');
