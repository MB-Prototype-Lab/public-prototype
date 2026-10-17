'use strict';
const { tap } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'picker-tour',
  title: 'Skip all setup into each of the nine profiles, then the paywall and every tab',
  matrix: 'profiles',
  browser: true,
  steps: p => skipToProfile(p).concat([
    tap('Budget'),
    tap('Start free trial $14.99 a month'),
    tap(/^Go yearly/),
    tap('Goals'),
    tap('Learn'),
    tap('Progress'),
    tap('Home'),
  ]),
};
