'use strict';
const { tap, type, slide, call, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'journal',
  title: 'Money journal from Home: four questions, a note, adjust an estimate, confirm, another entry from Progress',
  browser: true,
  steps: skipToProfile().concat([
    tap({ name: 'Open', near: 'Do your money journal' }),
    expect({ screen: 'journalEntry' }),
    tap('Coffee out about $6'),
    tap('Next'),
    tap('Sat down somewhere about $24'),
    tap({ name: 'Back', nth: 1 }),
    tap('Next'),
    tap('Next'),
    tap('Takeout or delivery about $32'),
    tap('Next'),
    tap('Hulu'),
    tap('Netflix'),
    tap('Next'),
    type('Write as much or as little as you like', 'Long day'),
    tap('🖼 Image'),
    tap('Review'),
    expect({ screen: 'journalConfirm' }),
    slide('Adjust Takeout or delivery', 40),
    tap('Confirm'),
    expect({ screen: 'journalDone' }),
    tap('Write another entry'),
    tap('Only on work days'),
    tap('Next'),
    call('navAdminJump', 'myProgress'),
    tap('Update my spending ›'),
    tap({ name: 'Back', nth: 0 }),
  ]),
};
