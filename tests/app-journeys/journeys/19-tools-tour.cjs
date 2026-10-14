'use strict';
const path = require('node:path');
const { tool, toolChoose, toolCheck, call } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');
const { routedScreens } = require('../../lib/app-vm.cjs');

// Every routed screen through the Tools jump, then the Tools panel's own
// controls. Screens come from this checkout's router, so a new screen is
// toured automatically.
const screens = routedScreens(path.join(__dirname, '..', '..', '..', 'app'));

module.exports = {
  id: 'tools-tour',
  title: 'Every routed screen through the Tools jump list, then the Tools panel controls',
  steps: [
    tool('›'),
  ].concat(skipToProfile(), screens.map(s => call('navAdminJump', s)), [
    call('navAdminJump', 'home'),
    toolCheck('Pin on refresh', true),
    toolCheck('Pin on refresh', false),
    tool('Copy State'),
    tool('‹'),
    tool('›'),
    tool('Reset User Data'),
  ]),
};
