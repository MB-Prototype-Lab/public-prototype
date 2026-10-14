'use strict';
const { tap, check, call, wait, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

// The returning-user login is only reachable from Tools in the full app.
const daily = [
  call('navAdminJump', 'login'),
  expect({ screen: 'login' }),
  check('Remember my choice', true),
  check('Remember my choice', false),
  tap({ name: 'Yes', role: 'button' }),
  expect({ screen: 'dailyUpdate' }),
  tap('Play'),
  wait(8000),
  tap('Pause'),
  tap('Segment 3'),
  tap('Resume'),
  wait(90000),
  expect({ screen: 'dailySummary' }),
  tap('Watch again'),
  tap('Skip'),
  tap('Share'),
  expect({ screen: 'dailyShare' }),
  tap(/^Hide my figures/),
  tap('Show exactly what would be posted'),
  tap('Copy to clipboard'),
];

module.exports = {
  id: 'daily-update',
  title: 'Daily update from the login prompt: play, pause, jump, summary, share with figures hidden, copy',
  browser: true,
  steps: skipToProfile().concat(daily),
};
