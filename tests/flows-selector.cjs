'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function boot(data) {
  const nodes = {localFlows: {hidden: true}, localFlowsList: {children: [], appendChild(n) { this.children.push(n); }}};
  const document = {
    addEventListener(_, callback) { callback(); },
    getElementById(id) { return nodes[id]; },
    createElement(tag) { return {tag, children: [], appendChild(n) { this.children.push(n); }}; }
  };
  vm.runInNewContext(fs.readFileSync('gate/flows.js', 'utf8'), {window: {MB_FLOWS: data}, document});
  return nodes;
}
for (const bad of [undefined, null, {}, {schema: 2, flows: []}, {schema: 1, flows: 'bad'}]) {
  assert.equal(boot(bad).localFlows.hidden, true);
}
const valid = {id: 'emergency-fund', label: '<script>literal</script>', description: '<img src=x>', path: 'flows/emergency-fund/index.html'};
const nodes = boot({schema: 1, flows: [null, {...valid, path: 'https://evil.test'}, {...valid, id: '../app'}, valid, valid]});
assert.equal(nodes.localFlows.hidden, false);
assert.equal(nodes.localFlowsList.children.length, 1);
const row = nodes.localFlowsList.children[0];
assert.equal(row.tag, 'a');
assert.equal(row.className, 'gate-row');
assert.equal(row.href, valid.path);
assert.equal(row.children[0].className, 'gate-row-name');
assert.equal(row.children[0].textContent, valid.label);
assert.equal(row.children[1].className, 'gate-row-note');
assert.equal(row.children[1].textContent, valid.description);
// A blank description leaves no empty blurb beside the name.
assert.equal(boot({schema: 1, flows: [{...valid, description: ' '}]}).localFlowsList.children[0].children.length, 1);
const html = fs.readFileSync('index.html', 'utf8');
for (const retained of ['id="passcodeScreen"', 'id="localAlternatives"', 'gate/local-variants.js', 'app/index.html']) assert.ok(html.includes(retained));
// Variants start under the Prototype tab; local Flows sit only in the Flows tab.
const at = id => html.indexOf('id="' + id + '"');
assert.ok(at('selectorScreen') < at('gatePanelPrototype'));
assert.ok(at('gatePanelPrototype') < at('localPreview') && at('localAlternatives') < at('gatePanelFlows'));
assert.ok(at('gatePanelFlows') < at('localFlows'));
// A Flow comparison moves its variants below the Flows list, inside the stripped block.
const flowsPanel = html.slice(at('gatePanelFlows'));
const slotAt = flowsPanel.indexOf('id="localFlowVariantsSlot"');
assert.ok(flowsPanel.indexOf('id="localFlows"') < slotAt);
assert.ok(flowsPanel.indexOf('<!-- LOCAL PREVIEW START -->') < slotAt && slotAt < flowsPanel.indexOf('<!-- LOCAL PREVIEW END -->'));
assert.ok(html.indexOf('<!-- CATALOG -->') < at('gatePanelFlows') && html.indexOf('<!-- FLOW CATALOG -->') > at('gatePanelFlows'));
// gate.js decides the toggle after the local lists fill, so it must run last and synchronously.
assert.ok(html.indexOf('<script src="gate/gate.js"></script>') > html.indexOf('<!-- LOCAL SCRIPTS END -->'));
assert.ok(!/<script[^>]*(async|defer)/.test(html));
console.log('Flow selector checks passed');
