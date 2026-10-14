'use strict';
const { tap, slide, call, wait, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'budget-builder',
  title: 'Budget builder (reached from Tools, as the Budget tab is a paywall): sliders, Help me out, save, then replace',
  matrix: 'profiles',
  browser: true,
  steps: p => skipToProfile(p).concat([
    call('navAdminJump', 'budgetBuild'),
    slide({ name: /^Housing\./, role: 'slider' }, 2000),
    tap({ name: 'Help me out', nth: 1 }),
    tap({ name: 'Help me out', nth: 1 }),
    tap('Continue'),
    slide({ name: /^Groceries\./, role: 'slider' }, 520),
    tap({ name: 'Back', nth: 1 }),
    tap('Continue'),
    tap('Continue'),
    slide({ name: /^Dining out\./, role: 'slider' }, 240),
    tap('Save budget'),
    expect({ screen: 'budgetDone' }),
    wait(2500),
    expect({ screen: 'aboutMe' }),
    call('navAdminJump', 'budgetBuild'),
    slide({ name: /^Dining out\./, role: 'slider' }, 200),
    tap('Save budget'),
    expect({ screen: 'budgetUpdateConfirm' }),
    tap('Keep mine'),
    call('navAdminJump', 'budgetBuild'),
    slide({ name: /^Shopping\./, role: 'slider' }, 150),
    tap('Save budget'),
    tap('Replace it'),
    wait(2500),
  ]),
};
