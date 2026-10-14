'use strict';
// Reads the PR body's "## Phone and Tools changes" section, one line per
// channel, for both PR gates (tests/app-journeys.cjs --justify and the browser
// runner's --allow-declared), so they agree on what a declaration is.

// "Phone:" is the PM-facing name for the participant channel.
const CHANNEL_NAMES = { Participant: ['Phone', 'Participant'], Tools: ['Tools'], Wiring: ['Wiring'] };

// Ways of writing "nothing changed". "none" may carry any trailing text ("none
// (docs only)"); the other words only punctuation or an aside in brackets or
// after a dash ("N/A — docs"), so "unchanged except the label wording" stays a
// description; a hyphen joined to the word ("no-change banner") is not an aside.
// Longer phrases come first so "no" does not stop at "no changes".
const NONE_LEAD = /^none(?![\w/])/i;
const NONE_WORDS = new RegExp('^(?:not applicable|no (?:visual |visible )?changes?|nothing(?: changed| changes| visible)?|' +
  'n/a|na|no|unchanged|same(?: as (?:main|before))?|tbd)(?![\\w/])(.*)$', 'i');
const ASIDE = /^(?:\s*$|\s*[.,;:!?…()[\]]|\s+[-–—]|[–—])/;
const ONLY_MARKS = /^[\p{P}\p{S}\s]*$/u;   // empty, "-", "—", "*", "...", "…"
const BULLET = /^[\s\-–—*•+]+/;
const WRAPPER = /^[\s`*_()[\]"']+|[\s`*_()[\]"']+$/g;

const normalize = body => String(body || '').replace(/\r\n?/g, '\n');

// The channel's line with comments removed, '' when it is empty, or undefined
// when the section or the line is missing. Comments go first, so a line inside
// the template's guidance never counts.
function declared(body, channel) {
  const text = normalize(body).replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  const sec = /##[ \t]*Phone and Tools changes[ \t]*\n([\s\S]*?)(?:\n##\s|$)/i.exec(text);
  if (!sec) return undefined;
  for (const name of CHANNEL_NAMES[channel] || [channel]) {
    // [ \t], not \s: an empty line must not read the next line as its value.
    const m = new RegExp('^[ \\t]*[-*]?[ \\t]*' + name + '[ \\t]*:[ \\t]*(.*)$', 'im').exec(sec[1]);
    if (m) return m[1].trim();
  }
  return undefined;
}

// True for an empty line or a way of writing "nothing changed", after leading
// bullets and surrounding markdown or brackets: "(none)", "`n/a`", "- none".
function isNone(value) {
  const raw = String(value == null ? '' : value).trim();
  if (ONLY_MARKS.test(raw)) return true;
  const v = raw.replace(BULLET, '').replace(WRAPPER, '');
  if (NONE_LEAD.test(v)) return true;
  const m = NONE_WORDS.exec(v);
  return !!m && ASIDE.test(m[1]);
}

// The line exists and says what changed.
function declaresChange(body, channel) {
  const d = declared(body, channel);
  return d !== undefined && !isNone(d);
}

// An unclosed "<!--" hides everything after it, the declaration lines included.
function unclosedNote(body) {
  return /<!--/.test(normalize(body).replace(/<!--[\s\S]*?-->/g, '')) ? ' (an unclosed "<!--" hides everything after it)' : '';
}

// What the gate read when a line declares no change, for its message.
function readAs(body, channel) {
  const d = declared(body, channel);
  const label = (CHANNEL_NAMES[channel] || [channel])[0];
  if (d === undefined) return 'the PR body has no "' + label + ':" line under "## Phone and Tools changes"' + unclosedNote(body);
  return 'the PR says ' + (d ? '"' + d + '"' : 'nothing (an empty "' + label + ':" line)') + ', which declares no change';
}

module.exports = { CHANNEL_NAMES, declared, isNone, declaresChange, unclosedNote, readAs };
