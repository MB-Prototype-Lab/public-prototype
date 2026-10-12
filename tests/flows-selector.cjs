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
const card = nodes.localFlowsList.children[0];
assert.equal(card.children[0].textContent, valid.label);
assert.equal(card.children[0].href, valid.path);
assert.equal(card.children[1].textContent, valid.description);
const html = fs.readFileSync('index.html', 'utf8');
for (const retained of ['id="passcodeScreen"', 'id="localAlternatives"', 'gate/local-variants.js', 'app/index.html']) assert.ok(html.includes(retained));
assert.ok(html.indexOf('id="localFlows"') > html.indexOf('id="selectorScreen"'));
console.log('Flow selector checks passed');
