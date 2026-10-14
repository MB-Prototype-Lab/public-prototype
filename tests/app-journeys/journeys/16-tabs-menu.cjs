'use strict';
const { tap, type, browserBack, expect } = require('../dsl.cjs');
const { skipToProfile, CALENDAR_EDGES } = require('../common.cjs');

module.exports = {
  id: 'tabs-menu',
  title: 'Menu, Settings, Where my money goes, a category, the spend estimator, browser Back, Learn search, every tab',
  browser: true,
  clocks: CALENDAR_EDGES,
  steps: skipToProfile().concat([
    tap('Menu'),
    tap('Settings'),
    expect({ screen: 'settings' }),
    tap({ name: 'Back', nth: 0 }),
    tap('Menu'),
    tap('Where my money goes'),
    expect({ screen: 'comparison' }),
    tap('Look into Dining out ›'),
    expect({ screen: 'budgetCategory' }),
    tap("Update what you've spent ›"),
    browserBack(),
    browserBack(),
    tap('Look into Shopping ›'),
    tap('Build my budget ›'),
    browserBack(),
    tap('Goals'),
    tap('Budget'),
    tap('Progress'),
    tap('Learn'),
    type('Search topics or lessons…', 'credit'),
    tap('Home'),
    expect({ screen: 'home' }),
  ]),
};
