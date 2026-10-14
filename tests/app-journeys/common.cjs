'use strict';
// Step sequences several journeys share.
const { tap, type, choose, slide, wait, expect } = require('./dsl.cjs');

const TIER = {
  above: 'Costs more than most places',
  at: 'About what most places cost',
  below: 'Costs less than most places',
};
const LEVEL = {
  under: /^Below what's typical there/,
  at: /^About typical there/,
  over: /^Above what's typical there/,
};

// Skip all setup and choose a profile in the picker; ends at Home.
function skipToProfile(p = { tier: 'at', level: 'at' }) {
  return [
    tap('Skip'),
    tap('Skip all setup'),
    tap(TIER[p.tier]),
    tap({ name: LEVEL[p.level], role: 'button' }),
    tap('Start'),
    expect({ screen: 'home' }),
  ];
}

// Every onboarding question answered, ending at Home.
function onboardFully() {
  return [
    type('Your name', 'Riley Q'),
    tap('Continue'),
    tap('Build up some savings'),
    tap('Be ready for a surprise bill'),
    tap('Continue'),
    type('ZIP code', '37203'),
    tap('Continue'),
    tap('2 adults'),
    choose('Your age', '26–34'),
    choose('Age of adult 2', '35–44'),
    tap('More Kids 0–12'),
    tap('Continue'),
    tap('Condo or townhome'),
    tap('Continue'),
    tap('$60,000 – $90,000'),
    slide('Annual income', 82500),
    tap('Continue'),
    tap('Through my job'),
    tap('Continue'),
    tap('5–15 miles'),
    tap('Continue'),
    type('Name', 'Scout'),
    choose('Pronouns', /^She/),
    tap('Continue'),
    tap('▶'),
    wait(50000),
    tap('Continue'),
    expect({ screen: 'home' }),
  ];
}

module.exports = { TIER, LEVEL, skipToProfile, onboardFully };
