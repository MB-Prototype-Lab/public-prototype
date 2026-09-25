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

// USABILITY TRACKING — off by default, and only the owner turns it on.
//
// When true, js/useberry.js loads Useberry's tracker so a round of unmoderated
// testing records what testers do. A tester cannot switch it off; there is no
// URL parameter and no UI for it, on purpose — which build is being observed
// is a decision made here, in code, per version.
//
// ⚠ THIS IS THE ONE EXCEPTION TO D02 ("no live LLM, no API keys, no network at
// runtime"), and it is deliberately narrow: a third-party script, loaded only
// while this flag is true, only on http/https, carrying telemetry and nothing
// else. No app logic may ever depend on it — the prototype must behave
// identically with it off, which is how it ships.
//
// Flip this and gate/gate.js's VERSIONS[].tracking together. The gate never
// loads a version's scripts (it would collide two versions' globals), so it
// cannot read this value and keeps its own copy; scripts/sweep.js asserts the
// two agree rather than trusting anyone to remember.
const USEBERRY_TRACKING = true;

// THE BUDGET TAB IS A PAYWALL.
//
// true  -> the Budget tab renders the Platinum wall (screens/budget-paywall.js)
// false -> the real budget comes back, unchanged
//
// ⚠ THIS OVERRIDES A SPEC DECISION. D31 is "No ads and no paywalls appear",
// and six places in v4 cited it. plan.md §0 L27 records the override; without
// that record the next reader finds D31, calls this a bug, and removes it.
//
// A FLAG RATHER THAN A DELETION, for two reasons. "Do not delete unused code"
// is a hard rule and flipping this back must unwind nothing. And a deleted call
// site would orphan all ten functions in screens/budget-v3.js into sweep.sh
// §7b's newly-unreferenced warning — the only fix for which is padding
// DEAD_BASELINE with ten names that then misstate why they are there.
//
// ⚠ IT GUARDS THE TAB, NOT THE BUDGET. Owner's call, and deliberately narrow:
// the daily task, the Home task, budget-update-confirm's Rebuild and two deep
// links all reach budget screens without rendering the tab. They are listed in
// CLAUDE.md as known. Widening it is moving renderBudgetPaywall's guard into
// renderScreen() against a list of screen ids.
const BUDGET_PAYWALL = true;

// ─── One buddy, one picture ─────────────────────────────────────────────────
// ON: every buddy stage (Home, onboarding, anywhere renderBuddyStage is called)
// draws the one illustration there is, whatever state.buddy's appearance
// attributes say. The creator no longer asks for breed, coat or eyes, but a
// persona or profile buddy still carries them -- and without this, Home showed
// a text card ("golden retriever · cream fur") instead of the dog.
//
// A flag, not a deletion: when there is art per breed, turn it off and the
// attribute-driven stage (buddyIsPrototype() in components/buddy.js) comes back
// as it was. The description card stays either way as the missing-image
// fallback (L22) -- a broken file must degrade to words, never a blank stage.
const BUDDY_SINGLE_ART = true;
