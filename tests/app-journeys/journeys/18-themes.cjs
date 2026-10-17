'use strict';
const { tap, tool } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'themes',
  title: 'The Tools theme picker in all four themes, on Home, Goals, Budget and an onboarding step',
  steps: [
    tool('Dark'),
    tool('Light'),
  ].concat(skipToProfile(), [
    tool('Natural Dark'),
    tap('Goals'),
    tool('Dark'),
    tap('Budget'),
    tool('Light'),
    tap('Home'),
    tool('Natural Light'),
  ]),
};
