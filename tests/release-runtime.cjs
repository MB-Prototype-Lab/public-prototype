// Focused runtime checks for release configuration, refresh, gate and URL handling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const read = p => fs.readFileSync(p, 'utf8');
const html = read('app/index.html');
const refresh = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
for (const tracking of [false, true]) {
  // Exercise the actual packager's bytes, not a manually duplicated config.
  const generated = cp.execFileSync('python3', ['-c', `import sys;sys.path.insert(0,'scripts');import publish;print((b'window.MB_RELEASE = Object.freeze('+publish.canonical({'tracking':${tracking ? 'True' : 'False'},'selector':'../../index.html'})+b');').decode())`], {encoding:'utf8'});
  for (const protocol of ['file:', 'https:', 'http:']) {
    let injected = 0, redirected;
    const context = vm.createContext({window:{}, URL,
      location:{protocol, href: protocol+'//example.test/versions/new/index.html?PROLIFIC_PID=p1&screen=home', replace:x=>redirected=x},
      document:{createElement:()=>({}), head:{appendChild:()=>injected++}},
      history:{state:{}, replaceState:(st, title, url)=>context.location.href = new URL(url, context.location.href).href},
      performance:{getEntriesByType:()=>[{type:'reload'}]}});
    vm.runInContext(generated + read('app/js/config.js') + read('app/js/useberry.js') + read('app/js/screen-url.js'), context);
    assert.equal(context.useberryActive(), tracking && protocol !== 'file:');
    context.useberryInit(); context.useberryInit();
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
console.log('Release tracking, refresh, participant URLs and passcode checks passed.');
