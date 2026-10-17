'use strict';
const { tap, wait, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'lesson-framing-skipped',
  title: 'The APR lesson with "no card", Back to the lesson list, another lesson with its questions skipped, then leaving the quiz',
  steps: skipToProfile().concat([
    tap({ name: 'Open', near: 'See what APR really costs you' }),
    tap('Begin Lesson'),
    tap({ name: 'Back', nth: 1 }),
    tap('Begin Lesson'),
    tap('I don\'t have a credit card'),
    tap('No'),
    expect({ screen: 'lesson' }),
    tap('‹'),
    expect({ screen: 'lessonFraming' }),
    tap('How much is enough'),
    tap({ name: 'Skip', nth: 0 }),
    wait(75000),
    tap('Next'),
    tap('✕ Exit'),
  ]),
};
