'use strict';
const { tap, call, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'daily-update-night',
  title: 'The login scene at night (22:00 UTC): Not now, and the prompt stays answered',
  boot: { clock: Date.UTC(2026, 3, 15, 22, 0, 0) },
  steps: skipToProfile().concat([
    call('navAdminJump', 'login'),
    expect({ screen: 'login' }),
    tap('Not now'),
    call('navAdminJump', 'login'),
  ]),
};
