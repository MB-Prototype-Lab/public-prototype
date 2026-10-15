// ─── Build configuration ──────────────────────────────────────────────────────
// Loads FIRST, before any data or app file. Nothing here depends on anything.

// Version label for Tools subtitles.
const APP_VERSION = "v4";

// Frozen publication setting; local development is untracked. Participant URLs
// cannot override it. useberryActive additionally restricts injection to HTTP(S).
const USEBERRY_TRACKING = window.MB_RELEASE.tracking === true;

// THE BUDGET TAB IS A PAYWALL.
//
// true  -> the Budget tab renders the Platinum wall (screens/budget-paywall.js)
// false -> the Budget tab renders the category budget
//
// L27 overrides D31's no-paywalls rule for this tab only.
//
// A FLAG RATHER THAN A DELETION. It is a recorded product setting
// (docs/decisions.md L27), and turning it off must bring the real tab back
// without unwinding anything. screens/budget.js renders that tab.
//
// ⚠ IT GUARDS THE TAB, NOT THE BUDGET. Deliberately narrow
// (L27): chat, the ☰ menu, budget-update-confirm's Rebuild and two deep links
// all reach budget screens without rendering the tab; the paywall's Tools card
// lists them (renderBudgetPaywallAdmin). Widening it is moving
// renderBudgetPaywall's guard into renderScreen() against a list of screen ids.
const BUDGET_PAYWALL = true;
