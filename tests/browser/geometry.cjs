'use strict';

// Evaluated in Chromium before the phone grows to hold the full screen.
function measurePhoneGeometry() {
  const phone = document.querySelector('main.phone');
  const screen = document.getElementById('screenRoot');
  if (!phone || !screen) throw new Error('normal phone geometry is unavailable');
  const rect = phone.getBoundingClientRect();
  // Chromium lays out on a 1/64 CSS-pixel grid; retain subpixel and 1px shifts.
  const unit = value => Math.round(value * 64) / 64;
  return {
    x: unit(rect.x), y: unit(rect.y), width: unit(rect.width), height: unit(rect.height),
    clientWidth: screen.clientWidth, clientHeight: screen.clientHeight,
    scrollWidth: screen.scrollWidth, scrollHeight: screen.scrollHeight,
    scrollLeft: unit(screen.scrollLeft), scrollTop: unit(screen.scrollTop),
  };
}

const FIELDS = {
  x: 'Phone horizontal position', y: 'Phone vertical position',
  width: 'Phone width', height: 'Phone height',
  clientWidth: 'Screen viewport width', clientHeight: 'Screen viewport height',
  scrollWidth: 'Scrollable content width', scrollHeight: 'Scrollable content height',
  scrollLeft: 'Horizontal scrolling position', scrollTop: 'Vertical scrolling position',
};
const validGeometry = value => !!value && Object.keys(FIELDS).every(key => Number.isFinite(value[key]));

function compareGeometry(before, after) {
  const validBefore = validGeometry(before), validAfter = validGeometry(after);
  if (!validBefore || !validAfter) return { same: false, validBefore, validAfter,
    changes: ['Normal phone geometry missing ' + (!validBefore && !validAfter ? 'on both versions' : !validBefore ? 'before the change' : 'after the change')] };
  const changes = Object.entries(FIELDS).filter(([key]) => before[key] !== after[key])
    .map(([key, label]) => label + ': ' + before[key] + ' → ' + after[key] + ' px');
  return { same: changes.length === 0, validBefore, validAfter, changes };
}

module.exports = { measurePhoneGeometry, compareGeometry, validGeometry };
