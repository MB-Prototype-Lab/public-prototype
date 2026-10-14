'use strict';
// Reads the PR body's "## Phone and Tools changes" section, one line per
// channel, for both PR gates (tests/app-journeys.cjs --justify and the browser
// runner's --allow-declared), so they agree on what a declaration is.

// "Phone:" is the PM-facing name for the participant channel.
const CHANNEL_NAMES = { Participant: ['Phone', 'Participant'], Tools: ['Tools'], Wiring: ['Wiring'] };

// Placeholders that declare nothing: an aside after a word ("none (docs only)",
// "n/a.") still declares nothing; a dash must stand alone, since a description
// may be written as a bullet.
const NONE_WORD = /^(?:none|n\/a|na|nothing|no changes?|unchanged|tbd)(?![\w/])/i;
const NONE_MARK = /^[-–—]+[.!]?$/;

// The channel's line with comments removed, '' when it is empty, or undefined
// when the section or the line is missing. Comments go first, so a line inside
// the template's guidance never counts.
function declared(body, channel) {
  const text = String(body || '').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  const sec = /##[ \t]*Phone and Tools changes[ \t]*\n([\s\S]*?)(?:\n##\s|$)/i.exec(text);
  if (!sec) return undefined;
  for (const name of CHANNEL_NAMES[channel] || [channel]) {
    // [ \t], not \s: an empty line must not read the next line as its value.
    const m = new RegExp('^[ \\t]*[-*]?[ \\t]*' + name + '[ \\t]*:[ \\t]*(.*)$', 'im').exec(sec[1]);
    if (m) return m[1].trim();
  }
  return undefined;
}

// True for an empty line or a placeholder such as "none", "n/a" or "-".
function isNone(value) {
  const v = String(value == null ? '' : value).trim();
  return v === '' || NONE_WORD.test(v) || NONE_MARK.test(v);
}

// The line exists and says what changed.
function declaresChange(body, channel) {
  const d = declared(body, channel);
  return d !== undefined && !isNone(d);
}

module.exports = { CHANNEL_NAMES, declared, isNone, declaresChange };
