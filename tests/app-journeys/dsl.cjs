'use strict';
// Journey steps as plain data. A query is a visible name (string or RegExp) or
// {name, role, near, nth, region}. Prefer what a tester reads on screen.

const q = (query, extra) => Object.assign(typeof query === 'object' && !(query instanceof RegExp) ? Object.assign({}, query) : { name: query }, extra || {});

module.exports = {
  tap: (query, opts = {}) => ({ op: 'tap', query: q(query, opts.query), expectDisabled: !!opts.expectDisabled }),
  type: (query, text, opts = {}) => ({ op: 'type', query: q(query), text: String(text), commit: opts.commit !== false }),
  choose: (query, option) => ({ op: 'choose', query: q(query), option }),
  slide: (query, value) => ({ op: 'slide', query: q(query), value }),
  check: (query, on = true) => ({ op: 'check', query: q(query), on }),
  tool: query => ({ op: 'tap', query: q(query, { region: 'tools' }) }),
  toolChoose: (query, option) => ({ op: 'choose', query: q(query, { region: 'tools' }), option }),
  toolCheck: (query, on = true) => ({ op: 'check', query: q(query, { region: 'tools' }), on }),
  // Only for things a tester reaches through Tools rather than the phone.
  call: (fn, ...args) => ({ op: 'call', fn, args }),
  wait: ms => ({ op: 'wait', ms }),
  browserBack: () => ({ op: 'back' }),
  reload: () => ({ op: 'reload' }),
  boot: (opts = {}) => ({ op: 'boot', opts }),
  expect: what => ({ op: 'expect', what }),
  note: text => ({ op: 'note', text }),
};
