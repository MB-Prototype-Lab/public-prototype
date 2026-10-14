'use strict';
const { tap, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'esf-have-one',
  title: 'Emergency fund: Back from the first step, then "I already have one"',
  steps: skipToProfile().concat([
    tap({ name: 'Open', near: 'Saving for an emergency' }),
    tap({ name: 'Back', nth: 0 }),
    tap({ name: 'Open', near: 'Saving for an emergency' }),
    tap('Build my fund'),
    tap({ name: 'Back', nth: 1 }),
    tap('I already have one'),
    expect({ screen: 'goals' }),
  ]),
};
