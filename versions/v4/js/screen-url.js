// ─── One URL per screen ───────────────────────────────────────────────────────
// v4 only. The reason this file exists, stated once so nobody removes it as
// dead weight:
//
// A Useberry round on the hosted prototype recorded the passcode gate, the
// first onboarding screen, and then nothing at all. Their tracker watches the
// page with a MutationObserver and, on every DOM change, compares
// `document.location.href` against the value it stored last time. Changed → it
// reports a new screen. Unchanged → silence. It does NOT hook history.pushState.
//
// js/navigation.js calls `history.pushState(snapshot, '')`, and that empty
// second argument means "same URL". So the two entries that registered were
// real page loads (gate → version) and all ~47 screens after them shared one
// URL and were invisible.
//
// This does not change how the app navigates. It changes what the address bar
// says while it does, which is the only thing a third-party tracker can see.
//
// ── WHAT IT UNLOCKS, beyond the reported defect ─────────────────────────────
// Useberry's Single Task block takes Path / URL / Trigger as a success
// criterion. URL is the robust one and was unusable while every screen shared
// an address. Per-task start URLs (below) are the other half: without them,
// every task makes the tester replay onboarding before reaching the thing
// being tested.

// ─── Where a URL is safe to write ────────────────────────────────────────────
// Chrome throws SecurityError for replaceState WITH A URL ARGUMENT on file://,
// because a file: document has an opaque origin and the "can the URL be
// rewritten" check compares origins. pushState(state, '') — no URL — is fine,
// which is exactly why the existing call never tripped it.
//
// So: http/https only. On file:// this whole module no-ops and the app behaves
// precisely as it did before, rather than throwing on every screen change and
// filling the dev error-catcher (index.html's catcher would surface ~47 of them
// in a single session).
function screenUrlEnabled() {
  try {
    return location.protocol === "http:" || location.protocol === "https:";
  } catch (e) { return false; }
}

// Our own query keys. Everything else in the query string belongs to somebody
// else and MUST survive a rewrite — see screenUrlWrite().
const SCREEN_URL_KEY  = "screen";
const SCREEN_URL_PROFILE = "profile";

/**
 * scrollKey() → a URL-safe slug.
 *
 *   home                        → home
 *   onboarding:3                → onboarding-3
 *   budgetBuild:1               → budget-build-1
 *   helpMeOut:Debt payments:ask → help-me-out-debt-payments-ask
 *
 * camelCase is split before the general replace, or `helpMeOut` would collapse
 * to `helpmeout` and a researcher reading the flow report has to decode it.
 */
function screenSlug(key) {
  return String(key == null ? "" : key)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** destinations[] → { screenId: label }, built once on first use. */
let screenLabelMap = null;
function screenLabel(screenId) {
  if (!screenLabelMap) {
    screenLabelMap = {};
    // destinations[] (js/state.js) is already the app's one human-readable name
    // per screen, and sweep.js already asserts it covers every routed screen.
    // A second list here would be a second thing to keep in step.
    (typeof destinations !== "undefined" ? destinations : []).forEach(function (d) {
      screenLabelMap[d[0]] = d[1];
    });
  }
  return screenLabelMap[screenId] || screenId;
}

/**
 * The <title>, which Useberry sends alongside the URL in its NAVIGATION
 * message — so this is what a researcher reads in the report, not just a slug.
 *
 * Steps are rendered 1-based because "step 4 of 7" is what a human means; the
 * SLUG stays 0-based and mechanical, matching state, so the two can never
 * disagree about which step is which.
 */
function screenTitle() {
  const s = state.screen;
  const base = screenLabel(s);
  let detail = "";

  if (s === "onboarding" && state.onboarding && typeof ONB_STEPS !== "undefined") {
    detail = "step " + ((state.onboarding.step || 0) + 1) + " of " + ONB_STEPS.length;
  } else if (s === "budgetBuild" && state.budgetBuild && typeof BB_STEPS !== "undefined") {
    detail = "step " + ((state.budgetBuild.step || 0) + 1) + " of " + BB_STEPS.length;
  } else if (s === "helpMeOut" && state.helpMeOut) {
    const cat = typeof catLabel === "function"
      ? catLabel(state.helpMeOut.category) : state.helpMeOut.category;
    detail = cat + (state.helpMeOut.stage === "confirm" ? ", confirm" : "");
  } else if (s === "journalEntry" && state.journalSession) {
    detail = "question " + ((state.journalSession.qIndex || 0) + 1);
  } else if (s === "lifestyleWizard" && state.lifestyleWizard) {
    detail = "step " + ((state.lifestyleWizard.step || 0) + 1);
  } else if (s === "spendEstimator" && state.estimator) {
    detail = state.estimator.stage;
  }

  return "MoneyBuddy — " + base + (detail ? " (" + detail + ")" : "");
}

/**
 * Write the URL, preserving every parameter we did not put there.
 *
 * THE PARAM WE DO NOT OWN IS THE WHOLE POINT. Useberry passes participant ids
 * through as URL parameters — PROLIFIC_PID by default — so building the query
 * string from scratch would drop the identifier partway through a paid Prolific
 * round, and nothing on either side would report it. Rebuild from what is
 * already there and set only our own keys.
 *
 * replaceState, never pushState: navCommit() has already pushed its entry, so
 * replacing that entry's URL leaves back/forward behaving exactly as before.
 * Screens with internal steps never pushed an entry and still do not — they
 * just change the address, which is all the tracker needs.
 */
function screenUrlWrite(slug, trail) {
  if (!screenUrlEnabled()) return false;
  try {
    const url = new URL(location.href);
    url.searchParams.set(SCREEN_URL_KEY, slug);
    // The deep-link parameter is an INPUT, not a description of where you are.
    // Leaving it on would make every later screen look like it was reached by
    // a profile link, and the tester's own choices would be invisible.
    url.searchParams.delete(SCREEN_URL_PROFILE);
    // The value trail rides in the FRAGMENT and only on a checkpoint view.
    // Query-side it would make every screen a unique URL — killing flow
    // aggregation across testers and possibly stopping `?screen=budget-done`
    // from matching a task-completion criterion. Cleared on every other view,
    // so exactly one URL a session carries it (js/value-trail.js).
    url.hash = trail ? "v=" + trail : "";
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    return true;
  } catch (e) { return false; }
}

/**
 * Called from render() when — and only when — the view actually changed.
 *
 * render() is the right home for this and navCommit() is not: onboarding steps,
 * builder steps and Help-me-out stages all change what the tester is looking at
 * without touching the nav stack. render() is the one choke point they share.
 *
 * Ordering is correct by construction. render() rewrites the DOM well before
 * this runs, and a MutationObserver callback is a microtask that fires after
 * the whole synchronous pass — so the tracker always reads the finished URL,
 * never the previous one.
 */
function screenUrlSync() {
  const slug = screenSlug(scrollKey());
  if (!slug) return;
  try { document.title = screenTitle(); } catch (e) {}
  const trail = (typeof ubTrailTake === "function") ? ubTrailTake() : null;
  screenUrlWrite(slug, trail);
}

// ─── Deep links ──────────────────────────────────────────────────────────────
// A per-task start URL, so a Useberry task can begin where it is actually about
// rather than replaying onboarding first.
//
// AN ALLOWLIST, NOT A ROUTER, and the distinction is the design. A dozen
// screens are meaningless without something chosen earlier — budgetCategory
// needs a category, lesson needs a lesson, helpMeOut needs a live session. A
// cold link to those lands on the D19 placeholder, which is a screen that says
// "this turns up at the end of setting a budget". That is correct behaviour for
// an admin jump and reads as broken to a tester who was sent there on purpose.
// So they are absent, and an unrecognised slug falls back to the normal entry
// screen. Never a blank, never a placeholder anyone was aimed at.
//
// Add an entry when a screen can genuinely stand on its own. The opener's job
// is to leave the minimum state that screen needs, exactly as the product path
// would have left it — reuse the flow's own start function rather than
// hand-assembling state, or the link and the product drift apart.
const SCREEN_LINKS = {
  "home":            function () { return "home"; },
  "onboarding":      function () { return screenLinkOnboarding(0); },
  "budget-build":    function () { if (typeof bbSessionInit === "function") bbSessionInit(); return "budgetBuild"; },
  "about-me":        function () { return "aboutMe"; },
  "comparison":      function () { return "comparison"; },
  "my-progress":     function () { return "myProgress"; },
  "learn":           function () { return "learn"; },
  "goals":           function () { return "goals"; },
  "chat":            function () { return "chat"; },
  "settings":        function () { return "settings"; },
  "journal-entry":   function () { if (typeof journalStart === "function") journalStart({}); return "journalEntry"; }
};

/** Onboarding at a given step — the one screen whose steps are worth linking. */
function screenLinkOnboarding(step) {
  if (typeof onbStart === "function") onbStart();
  if (state.onboarding && typeof ONB_STEPS !== "undefined") {
    const max = ONB_STEPS.length - 1;
    state.onboarding.step = Math.max(0, Math.min(max, Number(step) || 0));
  }
  return "onboarding";
}

/** Read one query parameter without assuming URL/URLSearchParams parsed cleanly. */
function screenLinkParam(name) {
  try { return new URL(location.href).searchParams.get(name); }
  catch (e) { return null; }
}

/**
 * Apply ?profile= and ?screen= at boot. Called from js/navigation.js between
 * bootV3() and the seeding replaceState, so the profile is committed before
 * the screen opens and the screen has complete figures behind it.
 *
 *   ?profile=at_at
 *   ?screen=budget-build
 *   ?profile=above_at&screen=budget-build
 *
 * Profile FIRST, deliberately. A builder opened before the profile is applied
 * seeds its twelve sliders from whatever profile was there a moment ago, and
 * every figure the tester then sees is anchored on the wrong place.
 */
function screenLinkApply() {
  if (!screenUrlEnabled()) return null;

  const wantProfile = screenLinkParam(SCREEN_URL_PROFILE);
  if (wantProfile && typeof profileApply === "function") profileApply(wantProfile);

  const slug = screenSlug(screenLinkParam(SCREEN_URL_KEY) || "");
  if (!slug) return null;

  // "onboarding-3" → the onboarding opener at step 3. Handled before the plain
  // lookup so the stepped form does not need its own seven entries.
  const stepped = slug.match(/^onboarding-(\d+)$/);
  const opener = stepped ? function () { return screenLinkOnboarding(stepped[1]); }
                         : SCREEN_LINKS[slug];
  if (typeof opener !== "function") return null;

  let target = null;
  try { target = opener(); } catch (e) { return null; }
  if (!target) return null;

  // Seed the stack rather than calling go(): navigation has not booted yet and
  // there is no entry to push onto. Home stays underneath so the top bar's back
  // arrow and navGoHome() behave the way they do on every other path.
  state.nav.activeStack = "home";
  state.nav.stacks.home = target === "home" ? ["home"] : ["home", target];
  state.screen = target;
  return target;
}
