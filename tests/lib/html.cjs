'use strict';
// A small, tolerant HTML parser for the journey harness. It only has to read
// the markup this app writes (template literals and app/index.html), and it
// only has to read it the same way every time: comparisons are always
// before-vs-after through this same parser, never against a browser.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);
const RCDATA = new Set(['textarea', 'title']);
// Start tags that close an open <p>, as browsers do.
const CLOSES_P = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div',
  'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsaquo: '›',
  lsaquo: '‹', times: '×', rdquo: '”', ldquo: '“', rsquo: '’',
  lsquo: '‘', minus: '−', middot: '·', larr: '←', rarr: '→',
  uarr: '↑', darr: '↓', bull: '•', hellip: '…', mdash: '—',
  ndash: '–', check: '✓', copy: '©', deg: '°', plusmn: '±',
  divide: '÷', le: '≤', ge: '≥', ne: '≠', trade: '™',
  reg: '®', laquo: '«', raquo: '»', cent: '¢', pound: '£',
  euro: '€', frac12: '½', frac14: '¼', frac34: '¾', star: '☆',
};

function decodeEntities(s) {
  if (s.indexOf('&') === -1) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : m;
  });
}

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Tokenizer ────────────────────────────────────────────────────────────────

function tokenize(html) {
  const tokens = [];
  let i = 0;
  const n = html.length;
  let rawUntil = null;          // tag name whose end tag ends raw text
  while (i < n) {
    if (rawUntil) {
      const close = html.toLowerCase().indexOf('</' + rawUntil, i);
      const end = close === -1 ? n : close;
      if (end > i) tokens.push({ type: 'text', data: html.slice(i, end), raw: !RCDATA.has(rawUntil) });
      i = end;
      rawUntil = null;
      continue;
    }
    const lt = html.indexOf('<', i);
    if (lt === -1) { tokens.push({ type: 'text', data: html.slice(i) }); break; }
    if (lt > i) tokens.push({ type: 'text', data: html.slice(i, lt) });
    i = lt;
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      const stop = end === -1 ? n : end;
      tokens.push({ type: 'comment', data: html.slice(i + 4, stop) });
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      const end = html.indexOf('>', i);
      i = end === -1 ? n : end + 1;          // doctype / processing instruction
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(i, i + 64));
    if (!m) { tokens.push({ type: 'text', data: '<' }); i += 1; continue; }
    const isEnd = m[1] === '/';
    const name = m[2].toLowerCase();
    let j = i + m[0].length;
    const attrs = [];
    let selfClosing = false;
    while (j < n) {
      while (j < n && /\s/.test(html[j])) j++;
      if (html[j] === '>') { j++; break; }
      if (html[j] === '/' && html[j + 1] === '>') { selfClosing = true; j += 2; break; }
      if (html[j] === '/') { j++; continue; }
      const am = /^[^\s=>\/]+/.exec(html.slice(j, j + 256));
      if (!am) { j++; continue; }
      const aname = am[0].toLowerCase();
      j += am[0].length;
      while (j < n && /\s/.test(html[j])) j++;
      let value = '';
      if (html[j] === '=') {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, j + 1);
          const stop = end === -1 ? n : end;
          value = html.slice(j + 1, stop);
          j = stop + 1;
        } else {
          const vm = /^[^\s>]*/.exec(html.slice(j));
          value = vm[0];
          j += value.length;
        }
        value = decodeEntities(value);
      }
      if (!attrs.some(a => a[0] === aname)) attrs.push([aname, value]);
    }
    if (isEnd) tokens.push({ type: 'end', name });
    else {
      tokens.push({ type: 'start', name, attrs, selfClosing });
      if (!selfClosing && (RAW_TEXT.has(name) || RCDATA.has(name))) rawUntil = name;
    }
    i = j;
  }
  return tokens;
}

// ── Tree building ────────────────────────────────────────────────────────────
// `factory` builds the node objects, so the same parser feeds plain data trees
// (for normalization) and the mini DOM (for running the app).

const plainFactory = {
  element(name, attrs) { return { nodeType: 1, tagName: name, attrs: attrs.slice(), childNodes: [], parentNode: null }; },
  text(data) { return { nodeType: 3, data, parentNode: null }; },
  comment(data) { return { nodeType: 8, data, parentNode: null }; },
  append(parent, child) { child.parentNode = parent; parent.childNodes.push(child); },
};

function parseInto(root, html, factory = plainFactory) {
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const tagOf = node => (node.tagName || '').toLowerCase();
  const openIndex = name => {
    for (let k = stack.length - 1; k > 0; k--) if (tagOf(stack[k]) === name) return k;
    return -1;
  };
  for (const t of tokenize(html)) {
    if (t.type === 'text') {
      const data = t.raw ? t.data : decodeEntities(t.data);
      if (data) factory.append(top(), factory.text(data));
    } else if (t.type === 'comment') {
      factory.append(top(), factory.comment(t.data));
    } else if (t.type === 'start') {
      const name = t.name;
      if (CLOSES_P.has(name)) {
        const p = openIndex('p');
        if (p !== -1 && p === stack.length - 1) stack.length = p;
      }
      if (name === 'li') {
        const li = openIndex('li');
        if (li !== -1 && stack.slice(li + 1).every(nd => !['ul', 'ol'].includes(tagOf(nd)))) stack.length = li;
      }
      if (name === 'option' && tagOf(top()) === 'option') stack.pop();
      if ((name === 'td' || name === 'th') && ['td', 'th'].includes(tagOf(top()))) stack.pop();
      if (name === 'tr') {
        const tr = openIndex('tr');
        if (tr !== -1 && stack.slice(tr + 1).every(nd => ['td', 'th'].includes(tagOf(nd)))) stack.length = tr;
      }
      const el = factory.element(name, t.attrs);
      factory.append(top(), el);
      if (!VOID.has(name) && !t.selfClosing) stack.push(el);
    } else if (t.type === 'end') {
      const k = openIndex(t.name);
      if (k !== -1) stack.length = k;
    }
  }
  return root;
}

function parseFragment(html) {
  return parseInto({ nodeType: 11, childNodes: [], parentNode: null }, html);
}

// ── Serialization (browser-like, used by the mini DOM's innerHTML) ───────────

function serializeChildren(node) {
  let out = '';
  for (const c of node.childNodes) out += serializeNode(c);
  return out;
}

function serializeNode(node) {
  if (node.nodeType === 3) {
    const parent = node.parentNode && (node.parentNode.tagName || '').toLowerCase();
    return RAW_TEXT.has(parent) ? node.data : escapeText(node.data);
  }
  if (node.nodeType === 8) return '<!--' + node.data + '-->';
  if (node.nodeType !== 1) return serializeChildren(node);
  const name = node.tagName.toLowerCase();
  let out = '<' + name;
  for (const [k, v] of node.attrs) out += ' ' + k + '="' + escapeAttr(v) + '"';
  out += '>';
  if (VOID.has(name)) return out;
  return out + serializeChildren(node) + '</' + name + '>';
}

module.exports = {
  VOID, RAW_TEXT, RCDATA, decodeEntities, escapeText, escapeAttr, tokenize,
  parseInto, parseFragment, serializeNode, serializeChildren, plainFactory,
};
