'use strict';
const { tap, tool, toolCheck, reload, boot, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'refresh-pin',
  title: 'Refresh without the pin returns to the selector; with Pin on refresh it restarts fresh; Exit and Reset',
  steps: skipToProfile().concat([
    reload(),
    expect({ left: true }),
    boot(),
    tool('›'),
    toolCheck('Pin on refresh', true),
    tap('Skip'),
    tap('Just this screen'),
    reload(),
    expect({ screen: 'onboarding' }),
    tool('›'),
    tool('Reset User Data'),
    tool('Exit Prototype'),
    expect({ left: true }),
    boot({ href: 'https://prototype.example/app/index.html?screen=goals' }),
    reload(),
    expect({ left: true }),
    boot({ href: 'https://prototype.example/app/index.html' }),
    expect({ screen: 'onboarding' }),
  ]),
};
