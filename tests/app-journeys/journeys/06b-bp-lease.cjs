'use strict';
const { tap, type, expect } = require('../dsl.cjs');
const { skipToProfile, CALENDAR_EDGES } = require('../common.cjs');

module.exports = {
  id: 'bp-lease',
  title: 'Big purchase lease: edit the calculator, choose Lease and its options, put the estimates back, then Your car\'s lease rows, Save it by and a lease goal',
  browser: true,
  clocks: CALENDAR_EDGES,
  steps: skipToProfile().concat([
    tap('Goals'),
    tap(/^Estimate a big purchase/),
    tap('Ask me later'),
    tap('A vehicle ›'),
    tap('Select a make'),
    tap('Toyota'),
    tap('Camry'),
    tap(/^New \$/),
    tap('See the real cost to own'),
    tap('See how we calculated this'),
    type('Sticker price, dollars', '31000', { clear: true }),
    type('Insurance, dollars', '180', { clear: true }),
    tap('Lease'),
    tap('$5K'),
    tap('24'),
    tap('15K'),
    tap('Put my estimates back'),
    tap('Close'),
    tap('Continue'),
    expect({ screen: 'bpYourCar' }),
    tap(/^Due at signing/),
    tap('$1,000'),
    tap(/^Lease length/),
    tap('36 months'),
    tap(/^Miles a year/),
    tap('10,000 miles'),
    tap(/^Save it by/),
    tap({ name: /^[A-Z][a-z]{2} \d{4}$/, role: 'option', nth: 17 }),   // 18 months out: Oct 2027 on the usual clock
    tap(/^Set goal: save /),
    expect({ screen: 'goals' }),
  ]),
};
