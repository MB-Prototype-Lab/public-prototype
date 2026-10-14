// Focused runtime checks for release configuration, refresh, gate and URL handling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const read = p => fs.readFileSync(p, 'utf8');
const html = read('app/index.html');
const refresh = read('app/js/refresh-pin.js');
// The refresh decision runs before anything else boots, from one shared file.
const headScripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
assert.deepEqual(headScripts.slice(0, 2), ['release-config.js', 'js/refresh-pin.js']);
assert(!/<script>\s*\/\/ On browser refresh/.test(html), 'no inline refresh redirect remains');
assert(html.indexOf('id="refreshPinToggle"') < html.indexOf('>Reset User Data<'), 'pin is one of the first Tools choices');
assert.equal((html.match(/onclick="refreshPinExit\(\)">Exit Prototype</g) || []).length, 1);
for (const tracking of [false, true]) {
  // Exercise the actual packager's bytes, not a manually duplicated config.
  const generated = cp.execFileSync('python3', ['-c', `import sys;sys.path.insert(0,'scripts');import publish;print((b'window.MB_RELEASE = Object.freeze('+publish.canonical({'tracking':${tracking ? 'True' : 'False'},'selector':'../../index.html'})+b');').decode())`], {encoding:'utf8'});
  for (const protocol of ['file:', 'https:', 'http:']) {
    let injected = 0, redirected;
    const context = vm.createContext({window:{}, URL,
      location:{protocol, href: protocol+'//example.test/versions/new/index.html?PROLIFIC_PID=p1&screen=home', replace:x=>redirected=x},
      document:{createElement:()=>({}), body:{appendChild:()=>injected++}},
      history:{state:{}, replaceState:(st, title, url)=>context.location.href = new URL(url, context.location.href).href},
      performance:{getEntriesByType:()=>[{type:'reload'}]}});
    vm.runInContext(generated + read('app/js/config.js') + read('app/js/useberry.js') + read('app/js/screen-url.js'), context);
    assert.equal(context.useberryActive(), tracking && protocol !== 'file:');
    assert.equal(context.useberryInit(), tracking && protocol !== 'file:');
    assert.equal(context.useberryInit(), false);
    assert.equal(injected, tracking && protocol !== 'file:' ? 1 : 0);
    vm.runInContext(refresh, context);
    assert.equal(redirected, '../../index.html');
    if (protocol !== 'file:') {
      context.screenUrlWrite('budget-done');
      const url = new URL(context.location.href);
      assert.equal(url.searchParams.get('PROLIFIC_PID'), 'p1');
      assert.equal(url.searchParams.get('screen'), 'budget-done');
    }
  }
}
for (const navigation of ['navigate', 'back_forward', 'reload']) {
  let redirected;
  const context = vm.createContext({window:{}, location:{replace:x=>redirected=x}, performance:{getEntriesByType:()=>[{type:navigation}]}});
  vm.runInContext(read('app/release-config.js') + refresh, context);
  assert.equal(redirected, navigation === 'reload' ? '../index.html' : undefined);
}
// Pin on refresh: one sessionStorage flag per tab; a one-shot marker for restarts.
const memoryStorage = (initial = {}) => {
  const data = {...initial};
  return {data, getItem: k => (k in data ? data[k] : null), setItem(k, v) { data[k] = String(v); }, removeItem(k) { delete data[k]; }};
};
const blockedStorage = {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); }};
function pinRun({navigation = 'reload', href = 'https://example.test/app/index.html', storage, embedded = false, elements} = {}) {
  const calls = {};
  const context = vm.createContext({URL, window: embedded ? {self: {}, top: {}} : {},
    location: {href, replace: x => calls.replaced = x, assign: x => calls.assigned = x},
    performance: {getEntriesByType: () => [{type: navigation}]}});
  if (storage) context.sessionStorage = storage;
  if (elements) context.document = {getElementById: id => elements[id] || null};
  vm.runInContext(read('app/release-config.js') + refresh, context);
  return {context, calls};
}
const pinned = () => memoryStorage({mb_refresh_pin: '1'});
const participant = 'https://example.test/app/index.html?PROLIFIC_PID=p1&screen=home#v=x';
assert.equal(pinRun({storage: memoryStorage()}).calls.replaced, '../index.html');
for (const navigation of ['navigate', 'back_forward']) {
  assert.equal(pinRun({navigation, storage: memoryStorage()}).calls.replaced, undefined);
  assert.equal(pinRun({navigation, storage: pinned(), href: participant}).calls.replaced, undefined);
}
{ // Pinned: restart in place, dropping only what would recreate the old session.
  const storage = pinned();
  const fresh = new URL(pinRun({storage, href: participant}).calls.replaced);
  assert.equal(fresh.searchParams.get('screen'), null);
  assert.equal(fresh.hash, '');
  assert.equal(fresh.searchParams.get('PROLIFIC_PID'), 'p1');
  assert.equal(storage.data.mb_refresh_restart, '1');
  // The restarted document is not sent away again, and the marker is spent.
  assert.equal(pinRun({storage, href: fresh.href}).calls.replaced, undefined);
  assert.equal(storage.data.mb_refresh_restart, undefined);
  assert.equal(storage.data.mb_refresh_pin, '1');
}
assert.equal(pinRun({storage: pinned(), href: 'file:///tmp/My%20Project/app/index.html'}).calls.replaced, undefined);
{ // Restart Flow's marker survives neither kind of load.
  const storage = memoryStorage({mb_refresh_restart: '1'});
  assert.equal(pinRun({storage}).calls.replaced, undefined);
  assert.equal(storage.data.mb_refresh_restart, undefined);
  const navigated = memoryStorage({mb_refresh_restart: '1'});
  pinRun({navigation: 'navigate', storage: navigated});
  assert.equal(navigated.data.mb_refresh_restart, undefined);
}
// Embedded previews ignore the pin and never load the selector inside the pane.
for (const storage of [memoryStorage(), pinned()]) {
  assert.equal(pinRun({storage, embedded: true}).calls.replaced, undefined);
  const stripped = new URL(pinRun({storage, embedded: true, href: participant}).calls.replaced);
  assert.equal(stripped.searchParams.get('screen'), null);
  assert.equal(stripped.searchParams.get('PROLIFIC_PID'), 'p1');
}
// Blocked storage reads as unpinned; the control says why it is unavailable.
const controls = () => ({refreshPinToggle: {checked: false, disabled: false}, refreshPinNote: {textContent: ''}, refreshPinExitButton: {disabled: false}});
{
  const elements = controls();
  const {context, calls} = pinRun({storage: blockedStorage, elements});
  assert.equal(calls.replaced, '../index.html');
  assert.equal(context.refreshPinAvailable(), false);
  context.refreshPinSync();
  assert.equal(elements.refreshPinToggle.disabled, true);
  assert.equal(elements.refreshPinToggle.checked, false);
  assert.match(elements.refreshPinNote.textContent, /blocks session storage/);
  assert.equal(elements.refreshPinExitButton.disabled, false);
  context.refreshPinSet(true); // Never throws.
}
{
  const elements = controls(), storage = pinned();
  const {context} = pinRun({navigation: 'navigate', storage, embedded: true, elements});
  context.refreshPinSync();
  assert.equal(elements.refreshPinToggle.disabled, true);
  assert.equal(elements.refreshPinToggle.checked, false);
  assert.equal(elements.refreshPinExitButton.disabled, true);
  assert.match(elements.refreshPinNote.textContent, /embedded/);
  storage.removeItem('mb_refresh_pin');
  context.refreshPinSet(true);
  assert.equal(storage.data.mb_refresh_pin, undefined, 'a pane cannot change the tab pin');
}
{
  const elements = controls(), storage = memoryStorage();
  const {context, calls} = pinRun({navigation: 'navigate', storage, elements});
  context.refreshPinSet(true);
  assert.equal(storage.data.mb_refresh_pin, '1');
  assert.equal(elements.refreshPinToggle.checked, true);
  assert.equal(elements.refreshPinToggle.disabled, false);
  assert.equal(elements.refreshPinExitButton.disabled, false);
  assert.match(elements.refreshPinNote.textContent, /restarts here/);
  context.refreshPinExit();
  assert.equal(calls.assigned, '../index.html');
  assert.equal(storage.data.mb_refresh_pin, '1', 'exit keeps the pin');
  context.refreshPinSet(false);
  assert.equal(storage.data.mb_refresh_pin, undefined);
  assert.equal(elements.refreshPinToggle.checked, false);
  assert.equal(Object.keys(storage.data).length, 0, 'the availability probe leaves nothing behind');
}

const elements = {};
const el = id => elements[id] ||= {style:{},value:'',focus(){},addEventListener(){}};
const gate = vm.createContext({document:{getElementById:el,addEventListener(){}}, location:{protocol:'file:'},sessionStorage:{setItem(){},getItem(){return null;}}});
vm.runInContext(read('gate/gate.js'), gate);
gate.gateInit();
assert.equal(el('passcodeScreen').style.display, 'flex');
el('gateInput').value = 'wrong';gate.gateSubmit();
assert.equal(el('gateError').style.display, 'block');
el('gateInput').value = '1337';gate.gateSubmit();
assert.equal(el('selectorScreen').style.display, 'flex');
console.log('Release tracking, refresh pin, participant URLs and passcode checks passed.');
