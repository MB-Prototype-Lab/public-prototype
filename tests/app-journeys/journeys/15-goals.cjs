'use strict';
const { tap, type, expect } = require('../dsl.cjs');
const { skipToProfile, CALENDAR_EDGES } = require('../common.cjs');

module.exports = {
  id: 'goals',
  title: 'Goals: add a suggested goal, create one in your own words, remove one',
  clocks: CALENDAR_EDGES,
  steps: skipToProfile().concat([
    tap('Goals'),
    tap('Keep entertainment under $75 a month'),
    tap('Create your own'),
    type('In your own words', 'Save for a bike'),
    type('Amount', '600'),
    tap('Add it'),
    tap({ name: 'Remove', nth: 0 }),
    expect({ screen: 'goals' }),
  ]),
};
