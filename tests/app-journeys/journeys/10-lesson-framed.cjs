'use strict';
const { tap, slide, wait, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'lesson-framed',
  title: 'The APR lesson from its Home task: card questions, player, quiz (a wrong answer first), calculator, reward; then once more skipping the questions',
  browser: true,
  steps: skipToProfile().concat([
    tap({ name: 'Open', near: 'See what APR really costs you' }),
    expect({ screen: 'reward-preview' }),
    tap('Begin Lesson'),
    tap('Chase'),
    tap('Freedom Unlimited'),
    expect({ screen: 'lesson' }),
    tap('⏸'),
    tap('▶'),
    tap('Forward ten seconds'),
    tap('1×'),
    wait(75000),
    tap('Next'),
    tap('About $24'),
    tap('About $240'),
    tap('Next'),
    tap('24% APR'),
    tap('Next'),
    tap('Annual Percentage Rate'),
    tap('Try the calculator'),
    slide('Balance', 2500),
    tap(/^Bad outcome/),
    tap('Finish lesson'),
    expect({ screen: 'reward' }),
    wait(5000),
    tap('Back to Learn'),
    expect({ screen: 'learn' }),
    tap('Home'),
  ]),
};
