const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../gate/local-variants.js'), 'utf8');

function element() {
  return {
    children: [], hidden: true, textContent: '',
    appendChild(child) { this.children.push(child); },
    set innerHTML(_) { throw new Error('comparison text must not become HTML'); }
  };
}

function run(manifest, returnInfo, href = 'file:///tmp/My%20Project/index.html') {
  const section = element();
  const list = element();
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
      addEventListener(type, callback) { if (type === 'DOMContentLoaded') listeners.push(callback); },
      getElementById(id) { return id === 'localAlternatives' ? section : id === 'localAlternativesList' ? list : null; },
      createElement() { return element(); }
    }
  };
  vm.runInNewContext(source, context);
  listeners.forEach(callback => callback());
  return { section, list, redirects };
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
