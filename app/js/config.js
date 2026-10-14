// ─── Build configuration ──────────────────────────────────────────────────────
// Loads FIRST, before any data or app file. Nothing here depends on anything.

// DEPRECATED — a build-time entry switch kept off pending a decision on its
// replacement (docs/future-work.md). Do not extend it or flip it for a study:
// a shortened or returning-user start is a Flow (docs/app-contracts.md, "One
// product: no journey switches"). It is not the onboarding Skip button.
//
//   false → onboarding runs → streak shows 1  (PERSONA.state.streakDaysIfOnboarded)
//   true  → returning-user login → streak shows 6  (PERSONA.state.streakDays)
//
// Default is false per the spec.
const SKIP_ONBOARDING = false;

// RECORDED PRODUCT SETTING (docs/decisions.md L26) — the "Skip all setup"
// profile picker. Changing it is a product decision, never a study.
//
// Skipping used to be silent: every write in onbFinish() is guarded, so a
// skipped field fell through to the persona and the tester spent the session as
// Sam from Los Angeles without being told. The picker asks two questions and
// names the figures they are about to see.
//
//   true  -> "Skip all setup" opens the picker (screens/profile-picker.js)
//   false -> skip applies profileDefault() silently; the screen is never routed
//
// Flipping it must not require unwinding anything else. The nine profiles
// survive either way — the skip fallback and scripts/sweep.js's test matrix both
// read them.
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

// THE BUDGET TAB IS A PAYWALL.
//
// true  -> the Budget tab renders the Platinum wall (screens/budget-paywall.js)
// false -> the real budget comes back, unchanged
//
// ⚠ THIS OVERRIDES A SPEC DECISION. D31 is "No ads and no paywalls appear",
// and six places in v4 cited it. docs/decisions.md L27 records the override;
// without that record the next reader finds D31, calls this a bug, and removes
// it.
//
// A FLAG RATHER THAN A DELETION. It is a recorded product setting
// (docs/decisions.md L27), and turning it off must bring the real tab back
// without unwinding anything. The ten functions in screens/budget-v3.js are
// that tab; deleting its call site would orphan them into sweep.sh §7b's
// newly-unreferenced warning.
//
// ⚠ IT GUARDS THE TAB, NOT THE BUDGET. Owner's call, and deliberately narrow:
// the daily task, the Home task, budget-update-confirm's Rebuild and two deep
// links all reach budget screens without rendering the tab. They are listed in
// CLAUDE.md as known. Widening it is moving renderBudgetPaywall's guard into
// renderScreen() against a list of screen ids.
const BUDGET_PAYWALL = true;
