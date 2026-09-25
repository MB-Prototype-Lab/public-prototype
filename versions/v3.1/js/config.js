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

// ─── Lesson framing: ask every time ─────────────────────────────────────────
// OFF (owner, 2026-09-25): every Begin on a framed lesson (APR) runs its card
// questions again. ON restores the earlier behaviour -- a re-open replays the
// variant from this session's stored answers without asking -- which left a
// tester who once answered "no card" unable to see the questions at all.
// state.lessonProfile is still written either way; the calculator seeds from it.
const LESSON_REUSE_FRAMING = false;
