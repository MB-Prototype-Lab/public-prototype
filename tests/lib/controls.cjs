'use strict';
// Finds a control the way a tester does: by what it says and what it is.
// Written against the standard DOM API only, so the same source runs on the
// mini DOM (Node) and in a real page (the browser layer injects SOURCE).

function controlsFactory() {
  const INLINE = new Set(['span', 'b', 'strong', 'em', 'i', 'small', 'sup', 'sub', 'a', 'label',
    'abbr', 'code', 's', 'u', 'mark', 'q', 'cite', 'time', 'var', 'kbd', 'samp', 'bdi', 'bdo', 'data', 'del', 'ins']);
  const INTERACTIVE = new Set(['button', 'link', 'textbox', 'searchbox', 'slider', 'checkbox', 'radio',
    'combobox', 'clickable', 'tab', 'switch', 'menuitem', 'menuitemradio', 'menuitemcheckbox', 'option', 'spinbutton']);
  const REGIONS = {
    phone: ['main.phone'],
    tools: ['aside.admin', '#adminExpandTab'],
    keyboard: ['#keyboardRoot'],
    page: ['body'],
  };

  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  function styleHides(el) {
    const st = (el.getAttribute('style') || '').replace(/\s+/g, '').toLowerCase();
    return st.includes('display:none') || st.includes('visibility:hidden');
  }

  function hiddenBy(el, stopAt) {
    for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true' || styleHides(n)) return true;
      if (n === stopAt) break;
    }
    return false;
  }

  function textOf(el) {
    let s = '';
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType === 3) { s += c.data; continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'template') continue;
      if (c.hasAttribute('hidden') || c.getAttribute('aria-hidden') === 'true' || styleHides(c)) continue;
      if (tag === 'img') { s += ' ' + (c.getAttribute('alt') || '') + ' '; continue; }
      if (tag === 'br') { s += ' '; continue; }
      if (tag === 'input' || tag === 'select' || tag === 'textarea') continue;
      const inner = textOf(c);
      s += INLINE.has(tag) ? inner : ' ' + inner + ' ';
    }
    return s;
  }

  function roleOf(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit.trim().split(/\s+/)[0];
    const tag = el.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset', 'image'].includes(t)) return 'button';
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'range') return 'slider';
      if (t === 'hidden') return null;
      return 'textbox';
    }
    if (el.hasAttribute('onclick') || el.hasAttribute('onpointerdown')) return 'clickable';
    return null;
  }

  function nameOf(el) {
    const doc = el.ownerDocument;
    const aria = norm(el.getAttribute('aria-label'));
    if (aria) return aria;
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = norm(by.split(/\s+/).map(id => { const n = doc.getElementById(id); return n ? textOf(n) : ''; }).join(' '));
      if (t) return t;
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      const t = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'input' && ['button', 'submit', 'reset'].includes(t)) return norm(el.getAttribute('value'));
      const id = el.getAttribute('id');
      if (id) {
        for (const l of Array.from(doc.querySelectorAll('label'))) {
          if (l.getAttribute('for') === id) { const s = norm(textOf(l)); if (s) return s; }
        }
      }
      const wrap = el.parentNode && el.parentNode.closest ? el.parentNode.closest('label') : null;
      if (wrap) { const s = norm(textOf(wrap)); if (s) return s; }
      return norm(el.getAttribute('placeholder')) || norm(el.getAttribute('title'));
    }
    if (tag === 'img') return norm(el.getAttribute('alt'));
    return norm(textOf(el)) || norm(el.getAttribute('title'));
  }

  function regionRoots(doc, region) {
    const sels = REGIONS[region || 'phone'];
    if (!sels) throw new Error('unknown region ' + region);
    return sels.map(s => doc.querySelector(s)).filter(Boolean);
  }

  function isDisabled(el) {
    return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
  }

  function listControls(doc, region) {
    const out = [];
    for (const root of regionRoots(doc, region)) {
      const all = [root].concat(Array.from(root.querySelectorAll('*')));
      for (const el of all) {
        const role = roleOf(el);
        if (!role || !INTERACTIVE.has(role)) continue;
        if (hiddenBy(el, root)) continue;
        out.push({ el, role, name: nameOf(el), disabled: isDisabled(el) });
      }
    }
    return out;
  }

  function matchText(value, want) {
    if (want instanceof RegExp || (want && typeof want.test === 'function')) return want.test(value);
    return value === norm(want);
  }

  function containsText(value, want) {
    if (want instanceof RegExp || (want && typeof want.test === 'function')) return want.test(value);
    return value.toLowerCase().includes(norm(want).toLowerCase());
  }

  function describe(c) {
    return c.role + ' "' + c.name + '"' + (c.disabled ? ' (disabled)' : '');
  }

  // query: {name, role, near, nth, region}
  function findControls(doc, query) {
    const q = typeof query === 'string' ? { name: query } : query;
    let list = listControls(doc, q.region);
    if (q.role) list = list.filter(c => c.role === q.role);
    if (q.name !== undefined) list = list.filter(c => matchText(c.name, q.name));
    if (q.near !== undefined && list.length > 1) {
      const roots = regionRoots(doc, q.region);
      const scored = list.map(c => {
        let d = 0;
        for (let n = c.el.parentNode; n && n.nodeType === 1; n = n.parentNode, d++) {
          if (roots.includes(n)) return { c, d: Infinity };
          if (containsText(norm(textOf(n)), q.near)) return { c, d };
        }
        return { c, d: Infinity };
      }).filter(x => x.d !== Infinity);
      const best = Math.min(...scored.map(x => x.d));
      list = scored.filter(x => x.d === best).map(x => x.c);
    }
    return list;
  }

  function findControl(doc, query) {
    const q = typeof query === 'string' ? { name: query } : query;
    const list = findControls(doc, q);
    const label = JSON.stringify(q, (k, v) => (v instanceof RegExp ? String(v) : v));
    if (q.nth !== undefined) {
      if (!list[q.nth]) throw new Error('no control #' + q.nth + ' for ' + label + '; found ' + list.length);
      return list[q.nth];
    }
    if (list.length === 1) return list[0];
    if (!list.length) {
      const visible = listControls(doc, q.region).slice(0, 60).map(describe).join('\n    ');
      throw new Error('no control matches ' + label + '\n  visible controls:\n    ' + visible);
    }
    throw new Error('ambiguous control ' + label + ', ' + list.length + ' matches:\n    ' + list.map(describe).join('\n    '));
  }

  return { norm, textOf, roleOf, nameOf, hiddenBy, listControls, findControls, findControl, describe, regionRoots, isDisabled };
}

const api = controlsFactory();
module.exports = Object.assign({}, api, {
  // For page.addInitScript: defines window.__mbControls.
  SOURCE: 'window.__mbControls = (' + controlsFactory.toString() + ')();',
});
