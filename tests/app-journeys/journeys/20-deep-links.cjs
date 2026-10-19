'use strict';
const { boot } = require('../dsl.cjs');

// ?screen= start links work on http(s) only; file:// ignores them.
const BASE = 'https://prototype.example/app/index.html';
const slugs = ['home', 'onboarding', 'onboarding-3', 'onboarding-8-name', 'budget-build', 'about-me',
  'comparison', 'my-progress', 'learn', 'goals', 'chat', 'settings', 'journal-entry', 'no-such-screen'];

module.exports = {
  id: 'deep-links',
  title: 'Every ?screen= start link on https, a profile link, an unknown slug, and the same link on file:// (ignored)',
  boot: { href: BASE },
  steps: slugs.map(s => boot({ href: BASE + '?screen=' + s, newTab: true })).concat([
    boot({ href: BASE + '?profile=above_at&screen=budget-build', newTab: true }),
    boot({ href: BASE + '?participant=p-123&screen=goals&useberry=1&tracking=true', newTab: true }),
    boot({ href: 'file:///moneybuddy/app/index.html?screen=goals', newTab: true }),
  ]),
};
