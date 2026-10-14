'use strict';
// Turns what the app shows into stable text, so before and after can be
// compared line by line. Three channels:
//   participant  the phone: markup, text, title, navigation, focus, state
//   tools        the Tools panel beside the phone
//   wiring       the raw handler code and click-tracking names behind controls
// Handler code is replaced by § in the first two, so renaming a function never
// shows up as a change in what a tester sees.

const crypto = require('node:crypto');
const controls = require('./controls.cjs');

const GENERATED_ID = /\b([a-z]{1,6})_\d{13}_[0-9a-z]{1,6}\b/g;

function idRewriter() {
  const seen = new Map();
  return s => String(s).replace(GENERATED_ID, (m, prefix) => {
    if (!seen.has(m)) seen.set(m, prefix + '_#' + (seen.size + 1));
    return seen.get(m);
  });
}

const collapse = s => s.replace(/\s+/g, ' ');

function normStyle(v) {
  return String(v).split(';').map(d => d.trim()).filter(Boolean).map(d => {
    const k = d.indexOf(':');
    return k === -1 ? collapse(d) : d.slice(0, k).trim().toLowerCase() + ': ' + collapse(d.slice(k + 1).trim());
  }).join('; ');
}

function normCss(text) {
  return collapse(String(text).replace(/\/\*[\s\S]*?\*\//g, ' ')).trim();
}

// Pretty-printed, normalized markup: one element or text run per line,
// attributes sorted, handlers as §, form state read from properties.
function normalizeTree(root, rewrite, opts = {}) {
  const lines = [];
  const skip = opts.skip || (() => false);
  const visit = (node, depth) => {
    const pad = '  '.repeat(depth);
    // Merge adjacent text nodes (comments removed) before printing.
    let pending = null;
    const flush = () => {
      if (pending === null) return;
      // Whitespace-only runs are layout noise here; spacing between inline
      // text still shows in the visible-text line.
      const t = collapse(pending);
      if (t.trim()) lines.push(pad + JSON.stringify(rewrite(t)));
      pending = null;
    };
    for (const c of node.childNodes) {
      if (c.nodeType === 8) continue;
      if (c.nodeType === 3) { pending = (pending || '') + c.data; continue; }
      if (c.nodeType !== 1) continue;
      flush();
      if (skip(c)) continue;
      const tag = c.tagName.toLowerCase();
      const attrs = [];
      for (const [k, v] of c.attrs || Array.from(c.attributes).map(a => [a.name, a.value])) {
        if (k === 'data-ub') continue;
        if (k.startsWith('on')) { attrs.push(k + '=§'); continue; }
        if (k === 'class') { const cls = String(v).split(/\s+/).filter(Boolean).sort().join(' '); if (cls) attrs.push('class="' + cls + '"'); continue; }
        if (k === 'style') { const st = normStyle(v); if (st) attrs.push('style="' + rewrite(st) + '"'); continue; }
        if (k === 'value' && (tag === 'input' || tag === 'textarea')) continue;
        if (k === 'checked' && tag === 'input') continue;
        if (k === 'selected' && tag === 'option') continue;
        attrs.push(v === '' ? k : k + '="' + rewrite(collapse(v)) + '"');
      }
      if (tag === 'input' || tag === 'textarea' || tag === 'select') attrs.push(':value="' + rewrite(collapse(String(c.value))) + '"');
      if (tag === 'input' && /^(checkbox|radio)$/i.test(c.getAttribute('type') || '')) attrs.push(':checked=' + !!c.checked);
      if (tag === 'option') attrs.push(':selected=' + !!c.selected);
      attrs.sort();
      lines.push(pad + '<' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + '>');
      if (tag === 'style') { const css = normCss(c.textContent); if (css) lines.push(pad + '  ' + JSON.stringify(css)); continue; }
      if (tag === 'script' || tag === 'textarea') continue;
      visit(c, depth + 1);
    }
    flush();
  };
  visit(root, 0);
  return lines;
}

function visibleText(root) {
  return collapse(controls.textOf(root)).trim();
}

// ── State ────────────────────────────────────────────────────────────────────

// aliases (tests/app-journeys/state-aliases.cjs): {key, as} names a renamed key
// the same on both sides wherever it appears; {removed: 'a.*.c'} leaves out the
// value at that dot path from the root, `*` matching any key or index. When
// given, `matched` collects each removal path that left out a value the state
// still has.
function stableJson(value, rewrite, aliases = [], matched = null) {
  const seen = new WeakSet();
  const removed = aliases.filter(a => a.removed).map(a => {
    const segs = a.removed.split('.');
    // Wildcards alone would leave out whole levels of state, the root's included.
    if (segs.every(s => s === '*')) throw new Error('state-aliases.cjs: removal path "' + a.removed + '" is all wildcards');
    return { path: a.removed, segs };
  });
  // The removal paths that still match below this child, and those that end at it.
  const below = (paths, depth, key, name) => {
    if (!paths.length) return { sub: paths, ends: paths };
    const sub = paths.filter(p => p.segs[depth] === '*' || p.segs[depth] === key || p.segs[depth] === name);
    return { sub, ends: sub.filter(p => p.segs.length === depth + 1) };
  };
  const omit = (ends, v) => {
    if (!ends.length) return false;
    if (matched && v !== undefined && typeof v !== 'function') for (const p of ends) matched.add(p.path);
    return true;
  };
  const walk = (v, key, paths, depth) => {
    if (v === undefined || typeof v === 'function') return undefined;
    if (typeof v === 'number') {
      if (/timer$/i.test(key || '') && v) return '<timer>';
      return Number.isFinite(v) ? v : String(v);
    }
    if (typeof v === 'string') return rewrite(v);
    if (v === null || typeof v !== 'object') return v;
    if (typeof v.nodeType === 'number') return '<node>';
    if (seen.has(v)) return '<cycle>';
    seen.add(v);
    let out;
    if (Array.isArray(v)) {
      out = [];
      for (let i = 0; i < v.length; i++) {
        const { sub, ends } = below(paths, depth, String(i));
        if (omit(ends, v[i])) continue;
        const w = walk(v[i], String(i), sub, depth + 1);
        out.push(w === undefined ? null : w);
      }
    } else {
      out = {};
      const keys = Object.keys(v).map(k => [k, aliasFor(k, aliases)]).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
      for (const [k, name] of keys) {
        const { sub, ends } = below(paths, depth, k, name);
        if (omit(ends, v[k])) continue;
        const w = walk(v[k], k, sub, depth + 1);
        if (w !== undefined) out[name] = w;
      }
    }
    seen.delete(v);
    return out;
  };
  return walk(value, '', removed, 0);
}

function aliasFor(key, aliases) {
  for (const a of aliases) if (a.key === key) return a.as;
  return key;
}

function flatten(obj, prefix = '', out = {}) {
  if (obj === null || typeof obj !== 'object') { out[prefix || '/'] = JSON.stringify(obj); return out; }
  const keys = Array.isArray(obj) ? obj.map((_, i) => i) : Object.keys(obj);
  if (!keys.length) { out[prefix || '/'] = Array.isArray(obj) ? '[]' : '{}'; return out; }
  for (const k of keys) flatten(obj[k], prefix + '/' + k, out);
  return out;
}

function sha(text) { return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12); }

function stateDelta(prevFlat, flat, limit = 30) {
  const out = [];
  const keys = new Set(Object.keys(prevFlat || {}).concat(Object.keys(flat)));
  for (const k of [...keys].sort()) {
    const a = prevFlat ? prevFlat[k] : undefined; const b = flat[k];
    if (a === b) continue;
    const show = v => (v === undefined ? '∅' : v.length > 120 ? v.slice(0, 117) + '…' : v);
    out.push('  ~ ' + k + ' ' + show(a) + ' → ' + show(b));
  }
  if (out.length > limit) return out.slice(0, limit).concat(['  … ' + (out.length - limit) + ' more']);
  return out;
}

// ── Handler identifiers ──────────────────────────────────────────────────────

const KEYWORDS = new Set(('break case catch class const continue debugger default delete do else export extends ' +
  'finally for function if import in instanceof let new return super switch this throw try typeof var void while ' +
  'with yield await async of true false null undefined NaN Infinity event arguments').split(' '));

// Identifiers a handler reads from the global scope.
function handlerIdents(src) {
  const toks = [];
  const re = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\d[\d.eE_xXa-fA-F]*|[A-Za-z_$][\w$]*|=>|\.\.\.|[^\s]/g;
  let m;
  while ((m = re.exec(src))) toks.push(m[0]);
  const locals = new Set();
  const out = new Set();
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!/^[A-Za-z_$][\w$]*$/.test(t) || KEYWORDS.has(t)) continue;
    const prev = toks[i - 1], next = toks[i + 1];
    if (prev === '.') continue;                                          // member access
    if (['var', 'let', 'const', 'function'].includes(prev)) { locals.add(t); continue; }
    if (next === '=>') { locals.add(t); continue; }
    if (next === ':' && (prev === '{' || prev === ',')) continue;       // object literal key
    out.add(t);
  }
  // Parenthesized arrow parameters: (a, b) => …
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] !== '=>' || toks[i - 1] !== ')') continue;
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (toks[j] === ')') depth++;
      if (toks[j] === '(') { depth--; if (depth === 0) break; }
      if (depth === 1 && /^[A-Za-z_$][\w$]*$/.test(toks[j])) locals.add(toks[j]);
    }
  }
  return [...out].filter(t => !locals.has(t));
}

// ── Diff ─────────────────────────────────────────────────────────────────────

// A small Myers-free LCS line diff; inputs here are a few hundred lines.
function lineDiff(a, b, context = 3, limit = 80) {
  const n = a.length, m = b.length;
  if (n * m > 4e6) return ['  (too large to diff: ' + n + ' vs ' + m + ' lines)'];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
    else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) { ops.push(['+', b[j]]); j++; }
    else { ops.push(['-', a[i]]); i++; }
  }
  const keep = new Array(ops.length).fill(false);
  ops.forEach((o, k) => { if (o[0] !== ' ') for (let d = -context; d <= context; d++) if (ops[k + d]) keep[k + d] = true; });
  const out = [];
  let gap = false;
  ops.forEach((o, k) => {
    if (!keep[k]) { if (!gap && out.length) out.push('  …'); gap = true; return; }
    gap = false; out.push(o[0] + ' ' + o[1]);
  });
  return out.length > limit ? out.slice(0, limit).concat(['  … ' + (out.length - limit) + ' more diff lines']) : out;
}

module.exports = { idRewriter, normalizeTree, visibleText, stableJson, flatten, sha, stateDelta, handlerIdents, KEYWORDS, lineDiff, normCss, normStyle };
