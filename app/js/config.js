// ─── Build configuration ──────────────────────────────────────────────────────
// Loads FIRST, before any data or app file. Nothing here depends on anything.

// D06/D07 — two entry variants, one flag. Flipping it must not require touching
// anything else; if you find yourself unwinding logic to make skip work, the
// wiring is wrong (01-onboarding.md is explicit about this).
//
//   false → onboarding runs → streak shows 1  (PERSONA.state.streakDaysIfOnboarded)
//   true  → straight to home → streak shows 6  (PERSONA.state.streakDays)
//
// Default is false per the spec. For a testing session aimed at the Money
// Journal, true gets there faster — the eight onboarding steps sit in front of
// the thing being measured.
const SKIP_ONBOARDING = false;

// TEMPORARY SCAFFOLDING — the "Skip all setup" profile picker.
//
// Skipping used to be silent: every write in onbFinish() is guarded, so a
// skipped field fell through to the persona and the tester spent the session as
// Sam from Los Angeles without being told. The picker asks two questions and
// names the figures they are about to see.
//
//   true  -> "Skip all setup" opens the picker (screens/profile-picker.js)
//   false -> skip applies profileDefault() silently; the screen is never routed
//
// Same rule as SKIP_ONBOARDING: flipping it must not require unwinding anything
// else. The nine profiles survive either way — the skip fallback and
// scripts/sweep.js's test matrix both read them.
//
// SKIP_ONBOARDING deliberately does NOT show the picker even when this is true.
// That flag exists to reach Home fast; stopping it for two questions defeats
// the one thing it is for. Two skip paths, two intents.
const PROFILE_PICKER = true;

// The version's own name, for admin-panel strings that would otherwise name a
// folder they are no longer in.
//
// v4 was copied from v3.1, and the copy brought four admin subtitles reading
// "v3.1 builder", "v3.1 step 1" and so on — accurate in the folder they were
// written in, wrong the moment the folder was duplicated. Historical comments
// in the source still say v3.1 on purpose (that IS where the design came from);
// this is only for text a tester reads on screen.
const APP_VERSION = "v4";

// Frozen publication setting; local development is untracked. Participant URLs
// cannot override it. useberryActive additionally restricts injection to HTTP(S).
const USEBERRY_TRACKING = window.MB_RELEASE.tracking === true;

// ESF-ONLY BUILD — the prototype narrowed to the emergency fund.
//
//   true  -> onboarding asks only what the emergency fund reads, then opens it;
//            the app shows Goals and the fund and nothing else
//   false -> the full app, exactly as it was
//
// Hides, never deletes. Every other screen, renderer and step is still in the
// code and still routed for the admin jump list; this only takes them out of
// what a tester walks through. Same rule as the two flags above: flipping it
// must not require unwinding anything else.
const ESF_ONLY = true;
