'use strict';
const { tap, wait, expect } = require('../dsl.cjs');

// With the system's reduce-motion setting on, the "Budget Saved!" beat moves on
// at once and the buddy holds one pose (components/buddy.js buddyStartIdle).
// The Budget tab is a paywall, so this starts from a study's budget start link.
module.exports = {
  id: 'reduced-motion',
  title: 'Reduced motion: save a budget from its start link (no "Budget Saved!" pause), then Home with a still buddy',
  boot: { reducedMotion: true, href: 'https://prototype.example/app/index.html?profile=at_at&screen=budget-build' },
  steps: [
    expect({ screen: 'budgetBuild' }),
    tap('Continue'),
    tap('Continue'),
    tap('Save budget'),
    tap('Replace it'),
    expect({ screen: 'aboutMe' }),
    tap('Home'),
    wait(15000),
    expect({ screen: 'home' }),
  ],
};
