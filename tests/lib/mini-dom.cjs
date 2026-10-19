'use strict';
// The smallest DOM the app runs on: element trees built by tests/lib/html.cjs,
// attributes, form controls, focus, a selector engine, and capture/bubble event
// dispatch that runs inline on* attributes inside the app's own context.
//
// Fidelity goal: behave the same for before and after, and close enough to a
// browser that the app's own code paths run. It is not a browser; the browser
// layer (tests/browser) covers layout and pixels.

const html = require('./html.cjs');

// ── Events ───────────────────────────────────────────────────────────────────

class Event {
  constructor(type, init = {}) {
    this.type = String(type);
    this.bubbles = !!init.bubbles;
    this.cancelable = !!init.cancelable;
    this.composed = !!init.composed;
    this.detail = init.detail === undefined ? null : init.detail;
    this.key = init.key; this.code = init.code;
    this.relatedTarget = init.relatedTarget || null;
    this.pointerId = init.pointerId === undefined ? 1 : init.pointerId;
    this.button = init.button || 0;
    this.clientX = init.clientX || 0; this.clientY = init.clientY || 0;
    this.target = null; this.currentTarget = null; this.eventPhase = 0;
    this.defaultPrevented = false;
    this.isTrusted = false;
    this.timeStamp = 0;
    this._stop = false; this._stopNow = false;
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this._stop = true; }
  stopImmediatePropagation() { this._stop = true; this._stopNow = true; }
  composedPath() { return this._path ? this._path.slice() : []; }
}
const eventClasses = {
  Event,
  CustomEvent: class CustomEvent extends Event {},
  UIEvent: class UIEvent extends Event {},
  FocusEvent: class FocusEvent extends Event {},
  MouseEvent: class MouseEvent extends Event {},
  PointerEvent: class PointerEvent extends Event {},
  KeyboardEvent: class KeyboardEvent extends Event {},
  InputEvent: class InputEvent extends Event {},
};

// ── Selector engine ──────────────────────────────────────────────────────────
// Compound selectors with tag, #id, .class, [attr], [attr op value], :not(),
// :first-child, :last-child, :checked, :disabled; descendant and child
// combinators; comma lists. Anything else throws, loudly, so a selector the
// harness cannot evaluate is never silently treated as "no match".

const selectorCache = new Map();

function splitTopLevel(s, sep) {
  const out = []; let depth = 0, quote = null, cur = '';
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCompound(src) {
  const c = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let i = 0;
  const ident = () => { const m = /^-?[_a-zA-Z0-9 -￿-]+/.exec(src.slice(i)); if (!m) throw new SyntaxError('Unsupported selector: ' + src); i += m[0].length; return m[0]; };
  if (src[i] === '*') i++;
  else if (/[a-zA-Z]/.test(src[i] || '')) c.tag = ident().toLowerCase();
  while (i < src.length) {
    const ch = src[i];
    if (ch === '#') { i++; c.id = ident(); }
    else if (ch === '.') { i++; c.classes.push(ident()); }
    else if (ch === '[') {
      const end = src.indexOf(']', i);
      if (end === -1) throw new SyntaxError('Unsupported selector: ' + src);
      const body = src.slice(i + 1, end).trim();
      const m = /^([^\s~|^$*=]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?\s*$/.exec(body);
      if (!m) throw new SyntaxError('Unsupported selector: ' + src);
      c.attrs.push({ name: m[1].toLowerCase(), op: m[2] || null, value: m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] });
      i = end + 1;
    } else if (ch === ':') {
      i++;
      const name = ident().toLowerCase();
      if (name === 'not') {
        if (src[i] !== '(') throw new SyntaxError('Unsupported selector: ' + src);
        let depth = 0, j = i;
        for (; j < src.length; j++) { if (src[j] === '(') depth++; if (src[j] === ')') { depth--; if (depth === 0) break; } }
        c.pseudos.push({ name, arg: parseList(src.slice(i + 1, j)) });
        i = j + 1;
      } else if (['first-child', 'last-child', 'checked', 'disabled', 'enabled'].includes(name)) {
        c.pseudos.push({ name });
      } else throw new SyntaxError('Unsupported selector pseudo-class :' + name);
    } else throw new SyntaxError('Unsupported selector: ' + src);
  }
  return c;
}

function parseComplex(src) {
  const parts = [];        // [{compound, combinator}] left to right
  const tokens = src.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
  let comb = null;
  for (const tok of tokens) {
    if (tok === '>') { comb = '>'; continue; }
    if (tok === '+' || tok === '~') throw new SyntaxError('Unsupported selector combinator ' + tok);
    parts.push({ compound: parseCompound(tok), combinator: parts.length ? (comb || ' ') : null });
    comb = null;
  }
  if (!parts.length) throw new SyntaxError('Empty selector');
  return parts;
}

function parseList(src) {
  if (selectorCache.has(src)) return selectorCache.get(src);
  const list = splitTopLevel(src, ',').map(s => parseComplex(s));
  selectorCache.set(src, list);
  return list;
}

function matchesCompound(el, c) {
  if (el.nodeType !== 1) return false;
  if (c.tag && el.localName !== c.tag) return false;
  if (c.id !== null && el.getAttribute('id') !== c.id) return false;
  if (c.classes.length) {
    const cls = (el.getAttribute('class') || '').split(/\s+/);
    for (const k of c.classes) if (!cls.includes(k)) return false;
  }
  for (const a of c.attrs) {
    const v = el.getAttribute(a.name);
    if (v === null) return false;
    if (!a.op) continue;
    const want = a.value;
    if (a.op === '=' && v !== want) return false;
    if (a.op === '^=' && !(want && v.startsWith(want))) return false;
    if (a.op === '$=' && !(want && v.endsWith(want))) return false;
    if (a.op === '*=' && !(want && v.includes(want))) return false;
    if (a.op === '~=' && !v.split(/\s+/).includes(want)) return false;
    if (a.op === '|=' && !(v === want || v.startsWith(want + '-'))) return false;
  }
  for (const p of c.pseudos) {
    if (p.name === 'not' && matchesList(el, p.arg)) return false;
    if (p.name === 'first-child' && el.parentNode && el.parentNode.firstElementChild !== el) return false;
    if (p.name === 'last-child' && el.parentNode && el.parentNode.lastElementChild !== el) return false;
    if (p.name === 'checked' && !(el.checked || el.selected)) return false;
    if (p.name === 'disabled' && !el.disabled) return false;
    if (p.name === 'enabled' && el.disabled) return false;
  }
  return true;
}

function matchesComplex(el, parts, k = parts.length - 1) {
  if (!matchesCompound(el, parts[k].compound)) return false;
  if (k === 0) return true;
  const comb = parts[k].combinator;
  let p = el.parentNode;
  if (comb === '>') return !!p && p.nodeType === 1 && matchesComplex(p, parts, k - 1);
  for (; p && p.nodeType === 1; p = p.parentNode) if (matchesComplex(p, parts, k - 1)) return true;
  return false;
}

function matchesList(el, list) {
  for (const parts of list) if (matchesComplex(el, parts)) return true;
  return false;
}

// ── Nodes ────────────────────────────────────────────────────────────────────

class Node {
  constructor(doc) { this.ownerDocument = doc; this.parentNode = null; this.childNodes = []; this._listeners = null; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] || null; }
  get previousSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) - 1] || null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument; }
  hasChildNodes() { return this.childNodes.length > 0; }
  _detach(child) { const i = this.childNodes.indexOf(child); if (i !== -1) this.childNodes.splice(i, 1); child.parentNode = null; }
  appendChild(child) {
    if (child.nodeType === 11) { for (const c of child.childNodes.slice()) this.appendChild(c); return child; }
    if (child.parentNode) child.parentNode._detach(child);
    child.parentNode = this; this.childNodes.push(child);
    return child;
  }
  append(...nodes) { for (const n of nodes) this.appendChild(typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n); }
  insertBefore(child, ref) {
    if (!ref) return this.appendChild(child);
    if (child.parentNode) child.parentNode._detach(child);
    const i = this.childNodes.indexOf(ref);
    child.parentNode = this; this.childNodes.splice(i === -1 ? this.childNodes.length : i, 0, child);
    return child;
  }
  removeChild(child) { this._detach(child); return child; }
  remove() { if (this.parentNode) this.parentNode._detach(this); }
  replaceWith(...nodes) {
    const p = this.parentNode; if (!p) return;
    const next = this.nextSibling; p._detach(this);
    for (const n of nodes) p.insertBefore(typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n, next);
  }
  contains(other) { for (let n = other; n; n = n.parentNode) if (n === this) return true; return false; }
  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this.data;
    let s = ''; for (const c of this.childNodes) if (c.nodeType !== 8) s += c.textContent; return s;
  }
  set textContent(v) {
    for (const c of this.childNodes.slice()) this._detach(c);
    if (v !== null && v !== undefined && String(v) !== '') this.appendChild(this.ownerDocument.createTextNode(String(v)));
  }
  addEventListener(type, fn, opts) {
    if (typeof fn !== 'function' && !(fn && typeof fn.handleEvent === 'function')) return;
    const capture = typeof opts === 'boolean' ? opts : !!(opts && opts.capture);
    const once = !!(opts && typeof opts === 'object' && opts.once);
    if (!this._listeners) this._listeners = [];
    if (this._listeners.some(l => l.type === type && l.fn === fn && l.capture === capture)) return;
    this._listeners.push({ type, fn, capture, once });
  }
  removeEventListener(type, fn, opts) {
    if (!this._listeners) return;
    const capture = typeof opts === 'boolean' ? opts : !!(opts && opts.capture);
    this._listeners = this._listeners.filter(l => !(l.type === type && l.fn === fn && l.capture === capture));
  }
  dispatchEvent(evt) { return this.ownerDocument._dispatch(this, evt); }
}

class Text extends Node {
  constructor(doc, data) { super(doc); this.data = String(data); }
  get nodeType() { return 3; }
  get nodeName() { return '#text'; }
  get nodeValue() { return this.data; }
  set nodeValue(v) { this.data = String(v); }
}

class Comment extends Node {
  constructor(doc, data) { super(doc); this.data = String(data); }
  get nodeType() { return 8; }
  get nodeName() { return '#comment'; }
}

function camelToKebab(p) { return p.replace(/[A-Z]/g, m => '-' + m.toLowerCase()); }

function parseStyle(text) {
  const out = [];
  for (const decl of String(text || '').split(';')) {
    const k = decl.indexOf(':'); if (k === -1) continue;
    const name = decl.slice(0, k).trim().toLowerCase(); const value = decl.slice(k + 1).trim();
    if (!name) continue;
    const i = out.findIndex(d => d[0] === name);
    if (i === -1) out.push([name, value]); else out[i][1] = value;
  }
  return out;
}

function styleProxy(el) {
  const read = () => parseStyle(el.getAttribute('style'));
  const write = decls => { if (decls.length) el.setAttribute('style', decls.map(([k, v]) => k + ': ' + v + ';').join(' ')); else el.removeAttribute('style'); };
  const api = {
    getPropertyValue(name) { const d = read().find(x => x[0] === name.toLowerCase()); return d ? d[1] : ''; },
    setProperty(name, value) { const decls = read().filter(x => x[0] !== name.toLowerCase()); if (value !== null && value !== undefined && String(value) !== '') decls.push([name.toLowerCase(), String(value)]); write(decls); },
    removeProperty(name) { const old = api.getPropertyValue(name); write(read().filter(x => x[0] !== name.toLowerCase())); return old; },
  };
  return new Proxy(api, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'cssText') return el.getAttribute('style') || '';
      if (typeof p !== 'string') return undefined;
      return api.getPropertyValue(camelToKebab(p));
    },
    set(t, p, v) {
      if (p === 'cssText') { write(parseStyle(v)); return true; }
      api.setProperty(camelToKebab(String(p)), v); return true;
    },
  });
}

function classListOf(el) {
  const read = () => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  const write = list => el.setAttribute('class', list.join(' '));
  return {
    add(...names) { const l = read(); for (const n of names) if (!l.includes(n)) l.push(n); write(l); },
    remove(...names) { if (el.getAttribute('class') === null) return; write(read().filter(n => !names.includes(n))); },
    toggle(name, force) {
      const has = read().includes(name);
      const want = force === undefined ? !has : !!force;
      if (want && !has) this.add(name); if (!want && has) this.remove(name);
      return want;
    },
    contains(name) { return read().includes(name); },
    replace(a, b) { const l = read(); const i = l.indexOf(a); if (i === -1) return false; l[i] = b; write(l); return true; },
    item(i) { return read()[i] || null; },
    get length() { return read().length; },
    get value() { return el.getAttribute('class') || ''; },
    toString() { return el.getAttribute('class') || ''; },
    forEach(fn) { read().forEach(fn); },
  };
}

const DISPATCH_DEPTH_LIMIT = 64;
const SELECTION_TYPES = new Set(['text', 'search', 'url', 'tel', 'password']);
const FOCUSABLE = new Set(['input', 'select', 'textarea', 'button']);

class Element extends Node {
  constructor(doc, name, attrs) {
    super(doc);
    this.localName = String(name).toLowerCase();
    this.attrs = attrs ? attrs.map(([k, v]) => [String(k).toLowerCase(), String(v)]) : [];
    this._style = null; this._classList = null;
    this._value = null; this._checked = null; this._selected = null;
    this._selStart = null; this._selEnd = null;
    this.scrollTop = 0; this.scrollLeft = 0;
    this._media = null;
  }
  get nodeType() { return 1; }
  get tagName() { return this.localName.toUpperCase(); }
  get nodeName() { return this.tagName; }
  // attributes
  getAttribute(k) { k = String(k).toLowerCase(); const a = this.attrs.find(x => x[0] === k); return a ? a[1] : null; }
  setAttribute(k, v) { k = String(k).toLowerCase(); v = String(v); const a = this.attrs.find(x => x[0] === k); if (a) a[1] = v; else this.attrs.push([k, v]); }
  removeAttribute(k) { k = String(k).toLowerCase(); this.attrs = this.attrs.filter(x => x[0] !== k); }
  hasAttribute(k) { return this.getAttribute(k) !== null; }
  toggleAttribute(k, force) { const has = this.hasAttribute(k); const want = force === undefined ? !has : !!force; if (want && !has) this.setAttribute(k, ''); if (!want && has) this.removeAttribute(k); return want; }
  get attributes() { return this.attrs.map(([name, value]) => ({ name, value })); }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get classList() { return this._classList || (this._classList = classListOf(this)); }
  get style() { return this._style || (this._style = styleProxy(this)); }
  get dataset() {
    const el = this;
    const key = p => 'data-' + camelToKebab(String(p));
    return new Proxy({}, {
      get(t, p) { return typeof p === 'string' ? (el.getAttribute(key(p)) ?? undefined) : undefined; },
      set(t, p, v) { el.setAttribute(key(p), v); return true; },
      deleteProperty(t, p) { el.removeAttribute(key(p)); return true; },
      has(t, p) { return el.hasAttribute(key(p)); },
      ownKeys() { return el.attrs.filter(a => a[0].startsWith('data-')).map(a => a[0].slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())); },
      getOwnPropertyDescriptor(t, p) { return el.hasAttribute(key(p)) ? { enumerable: true, configurable: true, value: el.getAttribute(key(p)) } : undefined; },
    });
  }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { this.toggleAttribute('hidden', !!v); }
  get title() { return this.getAttribute('title') || ''; }
  get tabIndex() { const t = this.getAttribute('tabindex'); return t === null ? (this._focusableTag() ? 0 : -1) : parseInt(t, 10); }
  // tree
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get childElementCount() { return this.children.length; }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get nextElementSibling() { const p = this.parentNode; if (!p) return null; const s = p.childNodes; for (let i = s.indexOf(this) + 1; i < s.length; i++) if (s[i].nodeType === 1) return s[i]; return null; }
  get previousElementSibling() { const p = this.parentNode; if (!p) return null; const s = p.childNodes; for (let i = s.indexOf(this) - 1; i >= 0; i--) if (s[i].nodeType === 1) return s[i]; return null; }
  get innerHTML() { return html.serializeChildren(this); }
  set innerHTML(v) {
    for (const c of this.childNodes.slice()) this._detach(c);
    html.parseInto(this, String(v === null || v === undefined ? '' : v), this.ownerDocument._factory);
  }
  get outerHTML() { return html.serializeNode(this); }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }
  insertAdjacentHTML(pos, markup) {
    const frag = this.ownerDocument.createDocumentFragment();
    html.parseInto(frag, String(markup), this.ownerDocument._factory);
    const nodes = frag.childNodes.slice();
    if (pos === 'beforeend') nodes.forEach(n => this.appendChild(n));
    else if (pos === 'afterbegin') { const first = this.firstChild; nodes.forEach(n => this.insertBefore(n, first)); }
    else if (pos === 'beforebegin' && this.parentNode) nodes.forEach(n => this.parentNode.insertBefore(n, this));
    else if (pos === 'afterend' && this.parentNode) { const next = this.nextSibling; nodes.forEach(n => this.parentNode.insertBefore(n, next)); }
  }
  // selectors
  querySelectorAll(sel) { const list = parseList(String(sel)); const out = []; walk(this, n => { if (n !== this && matchesList(n, list)) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByTagName(tag) { tag = String(tag).toLowerCase(); const out = []; walk(this, n => { if (n !== this && (tag === '*' || n.localName === tag)) out.push(n); }); return out; }
  getElementsByClassName(name) { return this.querySelectorAll('.' + String(name).trim().split(/\s+/).join('.')); }
  matches(sel) { return matchesList(this, parseList(String(sel))); }
  closest(sel) { const list = parseList(String(sel)); for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matchesList(n, list)) return n; return null; }
  // geometry: the VM has no layout
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
  getClientRects() { return []; }
  get offsetWidth() { return 0; } get offsetHeight() { return 0; } get offsetTop() { return 0; } get offsetLeft() { return 0; }
  get clientWidth() { return 0; } get clientHeight() { return 0; }
  get scrollHeight() { return 0; } get scrollWidth() { return 0; }
  scrollIntoView() {} scrollTo() {} scrollBy() {}
  setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
  getAnimations() { return []; }
  animate() { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; }
  // focus
  _focusableTag() {
    if (this.localName === 'a') return this.hasAttribute('href');
    if (this.localName === 'input' && (this.getAttribute('type') || '').toLowerCase() === 'hidden') return false;
    return FOCUSABLE.has(this.localName) || this.hasAttribute('tabindex') || this.getAttribute('contenteditable') === 'true';
  }
  _isFocusable() { return this._focusableTag() && !this.disabled && this.isConnected; }
  focus() { this.ownerDocument._focus(this); }
  blur() { this.ownerDocument._blur(this); }
  click() { this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })); }
  // form controls
  get type() {
    if (this.localName === 'input') return (this.getAttribute('type') || 'text').toLowerCase();
    if (this.localName === 'button') return (this.getAttribute('type') || 'submit').toLowerCase();
    if (this.localName === 'select') return this.hasAttribute('multiple') ? 'select-multiple' : 'select-one';
    if (this.localName === 'textarea') return 'textarea';
    return undefined;
  }
  get name() { return this.getAttribute('name') || ''; }
  get placeholder() { return this.getAttribute('placeholder') || ''; }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { this.toggleAttribute('disabled', !!v); }
  get min() { return this.getAttribute('min') || ''; }
  get max() { return this.getAttribute('max') || ''; }
  get step() { return this.getAttribute('step') || ''; }
  _sanitize(v) {
    if (this.localName !== 'input' || this.type !== 'range') return v;
    const min = parseFloat(this.getAttribute('min')); const max = parseFloat(this.getAttribute('max'));
    const lo = Number.isFinite(min) ? min : 0; const hi = Number.isFinite(max) ? max : 100;
    let n = parseFloat(v);
    if (!Number.isFinite(n)) n = hi < lo ? lo : lo + (hi - lo) / 2;
    const stepAttr = this.getAttribute('step');
    const step = stepAttr === 'any' ? 0 : (parseFloat(stepAttr) || 1);
    n = Math.min(Math.max(n, lo), Math.max(hi, lo));
    if (step > 0) { n = lo + Math.round((n - lo) / step) * step; if (n > hi) n -= step; n = parseFloat(n.toFixed(10)); }
    return String(n);
  }
  get value() {
    const tag = this.localName;
    if (tag === 'select') { const o = this.options[this.selectedIndex]; return o ? o.value : ''; }
    if (tag === 'option') { const v = this.getAttribute('value'); return v !== null ? v : this.textContent.replace(/\s+/g, ' ').trim(); }
    if (tag === 'textarea') return this._value !== null ? this._value : this.textContent;
    if (tag === 'input') {
      const t = this.type;
      if (t === 'checkbox' || t === 'radio') { const v = this.getAttribute('value'); return v === null ? 'on' : v; }
      const raw = this._value !== null ? this._value : (this.getAttribute('value') || '');
      return this._sanitize(raw);
    }
    if (tag === 'button') return this.getAttribute('value') || '';
    return undefined;
  }
  set value(v) {
    v = v === null || v === undefined ? '' : String(v);
    const tag = this.localName;
    if (tag === 'select') { const opts = this.options; opts.forEach(o => { o._selected = false; }); const o = opts.find(x => x.value === v); if (o) o._selected = true; else if (opts.length) opts.forEach(x => { x._selected = false; x._deselectAll = true; }); return; }
    if (tag === 'option') { this.setAttribute('value', v); return; }
    if (tag === 'input' || tag === 'textarea') {
      this._value = tag === 'input' ? this._sanitize(v) : v;
      if (this._supportsSelection()) { this._selStart = this._selEnd = this._value.length; }
      return;
    }
    if (tag === 'button') this.setAttribute('value', v);
  }
  get defaultValue() { return this.localName === 'textarea' ? this.textContent : (this.getAttribute('value') || ''); }
  get valueAsNumber() { const n = parseFloat(this.value); return Number.isFinite(n) ? n : NaN; }
  get checked() { if (this._checked !== null) return this._checked; return this.hasAttribute('checked'); }
  set checked(v) {
    v = !!v; this._checked = v;
    if (v && this.type === 'radio' && this.name) {
      for (const other of this.ownerDocument.querySelectorAll('input[type="radio"]')) if (other !== this && other.name === this.name) other._checked = false;
    }
  }
  get defaultChecked() { return this.hasAttribute('checked'); }
  get selected() {
    if (this._selected !== null) return this._selected;
    const sel = this.closest('select');
    if (!sel) return this.hasAttribute('selected');
    return sel.options[sel.selectedIndex] === this;
  }
  set selected(v) {
    const sel = this.closest('select');
    if (sel && v && sel.type === 'select-one') sel.options.forEach(o => { o._selected = false; });
    this._selected = !!v;
  }
  get options() { return this.localName === 'select' ? this.querySelectorAll('option') : undefined; }
  get selectedOptions() { return this.localName === 'select' ? this.options.filter(o => o.selected) : undefined; }
  get selectedIndex() {
    if (this.localName !== 'select') return undefined;
    const opts = this.options;
    const dirty = opts.findIndex(o => o._selected === true);
    if (dirty !== -1) return dirty;
    if (opts.some(o => o._deselectAll)) return -1;
    let last = -1; opts.forEach((o, i) => { if (o._selected === null && o.hasAttribute('selected')) last = i; });
    if (last !== -1) return last;
    if (this.type === 'select-one') { const first = opts.findIndex(o => !o.disabled); return first; }
    return -1;
  }
  set selectedIndex(i) { const opts = this.options; opts.forEach((o, k) => { o._selected = k === i; o._deselectAll = false; }); }
  get text() { return this.localName === 'option' ? this.textContent.replace(/\s+/g, ' ').trim() : this.textContent; }
  get form() { return this.closest('form'); }
  get labels() { const id = this.id; const out = []; if (id) for (const l of this.ownerDocument.querySelectorAll('label')) if (l.getAttribute('for') === id) out.push(l); const wrap = this.parentNode && this.parentElement && this.parentElement.closest('label'); if (wrap && !out.includes(wrap)) out.push(wrap); return out; }
  _supportsSelection() { return this.localName === 'textarea' || (this.localName === 'input' && SELECTION_TYPES.has(this.type)); }
  get selectionStart() { if (!this._supportsSelection()) return null; if (this._selStart === null) this._selStart = this._selEnd = this.value.length; return this._selStart; }
  set selectionStart(v) { if (this._supportsSelection()) this._selStart = v; }
  get selectionEnd() { if (!this._supportsSelection()) return null; if (this._selEnd === null) this._selStart = this._selEnd = this.value.length; return this._selEnd; }
  set selectionEnd(v) { if (this._supportsSelection()) this._selEnd = v; }
  setSelectionRange(s, e) {
    if (!this._supportsSelection()) throw new Error("InvalidStateError: The input element's type does not support selection.");
    const len = this.value.length; this._selStart = Math.min(s, len); this._selEnd = Math.min(Math.max(e, this._selStart), len);
  }
  setRangeText(text, start, end, mode) {
    if (!this._supportsSelection()) throw new Error("InvalidStateError: The input element's type does not support selection.");
    const v = this.value;
    if (start === undefined) { start = this.selectionStart; end = this.selectionEnd; }
    start = Math.min(start, v.length); end = Math.min(Math.max(end, start), v.length);
    this._value = v.slice(0, start) + text + v.slice(end);
    const caret = start + String(text).length;
    if (mode === 'end') { this._selStart = this._selEnd = caret; }
    else if (mode === 'start') { this._selStart = this._selEnd = start; }
    else if (mode === 'select') { this._selStart = start; this._selEnd = caret; }
  }
  select() { if (this._supportsSelection()) { this._selStart = 0; this._selEnd = this.value.length; } }
  checkValidity() { return true; } reportValidity() { return true; } setCustomValidity() {}
  // media (audio/video): recorded, never actually played
  get _m() { return this._media || (this._media = { paused: true, currentTime: 0, ended: false, playbackRate: 1, muted: false, volume: 1 }); }
  get src() { return this.getAttribute('src') || ''; }
  set src(v) { this.setAttribute('src', v); if (this._media) { this._media.currentTime = 0; this._media.ended = false; } }
  get currentSrc() { return this.src; }
  get paused() { return this._m.paused; }
  get ended() { return this._m.ended; }
  get _media_host() { return this.ownerDocument._hooks.media || null; }
  get currentTime() { const h = this._media_host; return h ? h.currentTime(this) : this._m.currentTime; }
  set currentTime(v) { const h = this._media_host; if (h) h.seek(this, Number(v) || 0); else this._m.currentTime = Number(v) || 0; }
  get duration() { const h = this._media_host; return h ? h.duration(this) : NaN; }
  get readyState() { return 0; }
  get playbackRate() { return this._m.playbackRate; }
  set playbackRate(v) { this._m.playbackRate = Number(v); }
  get muted() { return this._m.muted; } set muted(v) { this._m.muted = !!v; }
  get volume() { return this._m.volume; } set volume(v) { this._m.volume = Number(v); }
  play() {
    const h = this._media_host;
    if (h) return h.play(this);
    this._m.paused = false; this.ownerDocument._log('play', this); return Promise.resolve();
  }
  pause() { const h = this._media_host; if (h) h.pause(this); else this._m.paused = true; }
  load() {}
  canPlayType() { return ''; }
  // images
  get complete() { return true; } get naturalWidth() { return 0; } get naturalHeight() { return 0; }
  getContext() { return null; }
}

function walk(node, fn) {
  for (const c of node.childNodes) {
    if (c.nodeType !== 1) continue;
    fn(c);
    walk(c, fn);
  }
}

class DocumentFragment extends Node {
  get nodeType() { return 11; }
  querySelectorAll(sel) { return Element.prototype.querySelectorAll.call(this, sel); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

class Document extends Node {
  constructor(hooks = {}) {
    super(null);
    this.ownerDocument = this;
    this._hooks = hooks;           // { compileHandler(src), reportError(err), log(kind, detail), window }
    this._active = null;
    this.title = '';
    this.readyState = 'loading';
    const doc = this;
    this._factory = {
      element(name, attrs) { return new Element(doc, name, attrs); },
      text(data) { return new Text(doc, data); },
      comment(data) { return new Comment(doc, data); },
      append(parent, child) { parent.appendChild(child); },
    };
  }
  get nodeType() { return 9; }
  get nodeName() { return '#document'; }
  get documentElement() { return this.childNodes.find(c => c.nodeType === 1) || null; }
  get head() { return this.documentElement && this.documentElement.querySelector('head'); }
  get body() { return this.documentElement && this.documentElement.querySelector('body'); }
  get defaultView() { return this._hooks.window || null; }
  get activeElement() {
    if (this._active && this._active.isConnected) return this._active;
    this._active = null;
    return this.body;
  }
  createElement(name) { return new Element(this, name, []); }
  createElementNS(ns, name) { return new Element(this, name, []); }
  createTextNode(data) { return new Text(this, data); }
  createComment(data) { return new Comment(this, data); }
  createDocumentFragment() { return new DocumentFragment(this); }
  createEvent() { return new Event(''); }
  getElementById(id) { id = String(id); let found = null; const visit = n => { for (const c of n.childNodes) { if (found) return; if (c.nodeType !== 1) continue; if (c.getAttribute('id') === id) { found = c; return; } visit(c); } }; visit(this); return found; }
  querySelectorAll(sel) { const list = parseList(String(sel)); const out = []; walk(this, n => { if (matchesList(n, list)) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByTagName(tag) { return Element.prototype.getElementsByTagName.call(this, tag); }
  getElementsByClassName(name) { return this.querySelectorAll('.' + String(name).trim().split(/\s+/).join('.')); }
  hasFocus() { return true; }
  _log(kind, detail) { if (this._hooks.log) this._hooks.log(kind, detail); }

  // Focus moves the way a browser's does: blur and focusout on the old element,
  // then focus and focusin on the new one.
  _focus(el) {
    if (!el._isFocusable()) return;
    const old = this._active && this._active.isConnected ? this._active : null;
    if (old === el) return;
    this._active = el;
    if (old) {
      this._dispatch(old, new eventClasses.FocusEvent('blur', { relatedTarget: el }));
      this._dispatch(old, new eventClasses.FocusEvent('focusout', { bubbles: true, relatedTarget: el }));
    }
    if (el._supportsSelection() && el._selStart === null) el._selStart = el._selEnd = el.value.length;
    this._dispatch(el, new eventClasses.FocusEvent('focus', { relatedTarget: old }));
    this._dispatch(el, new eventClasses.FocusEvent('focusin', { bubbles: true, relatedTarget: old }));
  }
  _blur(el) {
    if (this._active !== el) return;
    this._active = null;
    this._dispatch(el, new eventClasses.FocusEvent('blur', {}));
    this._dispatch(el, new eventClasses.FocusEvent('focusout', { bubbles: true }));
  }

  // Event handlers that dispatch events which re-enter them recurse until the
  // engine's stack runs out, at a depth that varies by machine. Stop at a fixed
  // depth instead, with the same kind of error, so runs stay identical, and log
  // it so the recursion is reported rather than hidden.
  _dispatch(target, evt) {
    this._depth = (this._depth || 0) + 1;
    try {
      if (this._depth > DISPATCH_DEPTH_LIMIT) {
        this._log('recursion', evt.type);
        throw new RangeError('Maximum call stack size exceeded (event "' + evt.type + '" re-dispatched ' + DISPATCH_DEPTH_LIMIT + ' levels deep)');
      }
      return this._dispatchOnce(target, evt);
    } finally { this._depth--; }
  }

  _dispatchOnce(target, evt) {
    evt.target = target;
    const path = [];
    for (let n = target; n; n = n.parentNode) path.push(n);
    const win = this._hooks.window;
    if (path[path.length - 1] === this && win) path.push(win);
    evt._path = path;
    const run = (node, phase) => {
      evt.currentTarget = node;
      evt.eventPhase = phase;
      const listeners = (node._listeners || []).filter(l => l.type === evt.type &&
        (phase === 2 || (phase === 1 ? l.capture : !l.capture)));
      for (const l of listeners) {
        if (l.once) node.removeEventListener(l.type, l.fn, l.capture);
        try { typeof l.fn === 'function' ? l.fn.call(node, evt) : l.fn.handleEvent(evt); }
        catch (err) { this._report(err); }
        if (evt._stopNow) return;
      }
      if (phase === 1) return;
      this._inline(node, evt);
    };
    for (let i = path.length - 1; i > 0 && !evt._stop; i--) run(path[i], 1);
    if (!evt._stop) run(target, 2);
    if (evt.bubbles) for (let i = 1; i < path.length && !evt._stop; i++) run(path[i], 3);
    evt.currentTarget = null;
    evt.eventPhase = 0;
    return !evt.defaultPrevented;
  }

  // The on<type> attribute (or a property set from script) on one node.
  _inline(node, evt) {
    const prop = 'on' + evt.type;
    let fn = null;
    if (node.nodeType === 1 && node.hasAttribute(prop)) {
      fn = this._hooks.compileHandler ? this._hooks.compileHandler(node.getAttribute(prop), node, prop) : null;
    } else if (node === this._hooks.window) {
      fn = this._hooks.windowHandler ? this._hooks.windowHandler(prop) : null;
    } else if (typeof node[prop] === 'function') fn = node[prop];
    if (typeof fn !== 'function') return;
    try {
      const r = fn.call(node, evt);
      if (r === false) evt.preventDefault();
    } catch (err) { this._report(err); }
  }

  _report(err) { if (this._hooks.reportError) this._hooks.reportError(err); else throw err; }
}

// Build a Document from a full HTML page.
function documentFromHTML(source, hooks) {
  const doc = new Document(hooks);
  html.parseInto(doc, source, doc._factory);
  // A page without <html>/<body> still needs them for document.body.
  if (!doc.documentElement) {
    const root = doc.createElement('html'); const body = doc.createElement('body');
    for (const c of doc.childNodes.slice()) body.appendChild(c);
    root.appendChild(body); doc.appendChild(root);
  }
  doc.readyState = 'complete';
  return doc;
}

module.exports = { Event, eventClasses, Node, Element, Text, Comment, Document, DocumentFragment, documentFromHTML, parseList, matchesList };
