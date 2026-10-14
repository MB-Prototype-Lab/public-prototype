'use strict';
const { tap, type, choose } = require('../dsl.cjs');

const key = label => tap({ name: label, region: 'keyboard' });

module.exports = {
  id: 'keyboard',
  title: 'The simulated keyboard: capitals, numbers and symbols, backspace, Done, the ZIP keypad and a typed income',
  steps: [
    type('Your name', 'Jo-Ann 2', { commit: false }),
    key('⌫'),
    key('⌫'),
    key('ABC'),
    key('⇧'),
    key('b'),
    key('Done'),
    tap('Continue'),
    tap('Build up some savings'),
    tap('Continue'),
    type('ZIP code', '9021', { commit: false }),
    key('⌫'),
    key('Done'),
    tap('Maybe share later'),
    tap('Just me'),
    choose('Your age', '45–54'),
    tap('Continue'),
    tap('House · 2–3 bedrooms'),
    tap('Continue'),
    tap('$90,000 – $140,000'),
    type('Annual income, typed', '101500'),
    tap('Continue'),
  ],
};
