// ─── Usability tracking (Useberry) ───────────────────────────────────────────
// v4 only, off by default. USEBERRY_TRACKING in js/config.js is the switch and
// the only switch — see the note there about why this is the one sanctioned
// exception to D02, and why it has to stay narrow.
//
// ── WHY A SNIPPET RATHER THAN THEIR PROXY ───────────────────────────────────
// Useberry can serve a site two ways: through their proxy (nothing to install)
// or with this script tag on the page. Their own documentation says the proxy
// blocks resources carrying an `integrity` attribute and disrupts sites that
// depend on CSP or CORS, and that trigger elements — the "click this button to
// complete the task" success criterion — should be set up with the snippet
// when the proxy will not show them. This prototype is a hundred-odd scripts
// deep, so the proxy is the fragile option.
//
// ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────
// It injects one script tag. Nothing more.
//
// Their tracker exposes `useberryLive = {}` — an empty object with no methods.
// There is no supported API to push our own data to it; the only channel is an
// internal postMessage protocol between their script and their player
// (CAPTURE_EVENT / TRIGGER_COMPLETED / NAVIGATION). Imitating that protocol
// would be unversioned, undocumented and would fail SILENTLY the first time
// they change it — mid-study, during a paid Prolific round, with nothing to
// signal that the data stopped arriving. So we do not.
//
// What we give them instead is a page that behaves like a normal multi-page
// site: one URL and one <title> per screen (js/screen-url.js). That rides on
// documented behaviour, and it also drives their URL-based task-completion
// criterion, which is the thing that actually reports whether a task was done.

const USEBERRY_SRC =
  "https://api.useberry.com/integrations/liveUrl/scripts/useberryScript.js";

let useberryLoaded = false;

/** Would this build load the tracker? Exposed so admin and the sweep can ask. */
function useberryActive() {
  if (typeof USEBERRY_TRACKING === "undefined" || !USEBERRY_TRACKING) return false;
  // file:// cannot fetch it and has no test session behind it; attempting the
  // load there buys a console error and nothing else.
  try {
    return location.protocol === "http:" || location.protocol === "https:";
  } catch (e) { return false; }
}

/**
 * Load the tracker once. Called from js/navigation.js after the first render.
 *
 * After, not before: their recorder takes its first snapshot of the DOM when it
 * starts, and a snapshot of the empty shell before render() has painted would
 * make the opening frame of every session recording a blank phone.
 */
function useberryInit() {
  if (useberryLoaded || !useberryActive()) return false;
  useberryLoaded = true;
  try {
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.src = USEBERRY_SRC;
    s.async = true;
    // No onerror handler on purpose. If it fails to load, the prototype is
    // unchanged and the round produces no data — which is the correct outcome,
    // and one that must never turn into an app-visible error for a tester.
    document.body.appendChild(s);
    return true;
  } catch (e) {
    return false;
  }
}
