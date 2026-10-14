'use strict';
const { onboardFully } = require('../common.cjs');

module.exports = {
  id: 'onboarding-full',
  title: 'Every onboarding question answered, film watched, then Home',
  browser: true,
  steps: onboardFully(),
};
