// ─── Build configuration ──────────────────────────────────────────────────────
// Loads FIRST, before any data or app file. Nothing here depends on anything.

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
