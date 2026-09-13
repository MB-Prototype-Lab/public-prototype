// ─── The value trail ─────────────────────────────────────────────────────────
// v4 only. What a tester actually SET — the figures they dragged sliders to and
// the options they picked — carried out of an unmoderated session without a
// backend, a database, or asking them to copy and paste anything.
//
// ── WHY IT RIDES IN THE URL ─────────────────────────────────────────────────
// The constraints rule out everything else. D02/D03: no network at runtime, no
// backend, no database, no localStorage; the whole thing is static files on
// GitHub Pages. Useberry has no public API to push custom data to — their
// tracker exposes `useberryLive = {}`, an empty object with no methods, and
// imitating the internal postMessage protocol behind it would be unversioned
// and would fail silently mid-study. Session recordings would capture all of
// this for free, because the app re-renders every screen as fresh HTML with
// real `value=` attributes — but recording storage starts at their Growth plan.
//
// What Useberry records for certain, on the free tier, automatically, is the
// URL. So the trail goes in the URL.
//
// ── IN THE FRAGMENT, AND ONLY AT A CHECKPOINT ───────────────────────────────
// Two rules keep this from wrecking the reports it is meant to fill:
//
//   1. THE FRAGMENT, not the query. `?screen=` is the screen's identity: it has
//      to be identical across testers or the flow report cannot aggregate, and
//      it is what a URL-based task-completion criterion matches on. Per-tester
//      data in there would make every screen a unique node and could stop
//      `?screen=budget-done` matching. A fragment is carried in the href their
//      NAVIGATION message sends and is ignored by URL matchers.
//
//   2. CHECKPOINTS ONLY. Written on the screen a tester lands on when something
//      is finished — budget saved, setup done, journal submitted — and cleared
//      on the next view. One URL per session carries it, not forty.
//
// Accepted costs, stated rather than discovered later: a tester who abandons
// mid-flow reaches no checkpoint and reports nothing, and the ~2,000-character
// URL ceiling makes this a compact snapshot, not an event log.
//
// ── ⚠ FREE TEXT MUST NEVER REACH IT ─────────────────────────────────────────
// A URL is not a private channel: it is recorded by a third party and sits in a
// researcher's report. Testers type their NAME in onboarding and write prose in
// the Money Journal, and Useberry's own policy is that testers stay
// pseudonymous. So ubTrailRecord() takes numbers, and takes a string only for a
// key declared in UB_TRAIL_ENUMS below — putting anything free-typed in there
// is a deliberate, reviewable act rather than an accident.

// Keys allowed to carry a short label instead of a number. Every one is a
// choice from a fixed list the app drew, never anything the tester typed.
const UB_TRAIL_ENUMS = ["goal", "buddy", "tier", "level"];

const UB_TRAIL_MAX_VALUE = 16;    // characters, for an enum value
const UB_TRAIL_MAX_URL   = 1600;  // leave room under the ~2000 ceiling

// Last-value-wins, insertion-ordered. A slider on `oninput` fires per pixel of
// drag; keeping every tick would fill the ceiling with one category. What a
// researcher wants is where it came to rest.
let ubTrail = {};
let ubTrailOrder = [];
let ubTrailPending = null;        // checkpoint name, consumed by the next render

function ubTrailReset() { ubTrail = {}; ubTrailOrder = []; ubTrailPending = null; }

/**
 * Record one committed value.
 *
 * Numbers pass. Strings pass only for a UB_TRAIL_ENUMS key — see the warning
 * above; this is the guard that keeps a typed name out of a third party's logs.
 */
function ubTrailRecord(key, value) {
  const k = String(key || "").replace(/[^A-Za-z0-9]+/g, "");
  if (!k) return false;

  let out = null;
  const n = Number(value);
  if (value !== "" && value !== null && value !== undefined && isFinite(n)) {
    out = String(Math.round(n));
  } else {
    const base = k.replace(/[A-Z].*$/, "");        // "goalX" is still the goal key
    if (UB_TRAIL_ENUMS.indexOf(k) === -1 && UB_TRAIL_ENUMS.indexOf(base) === -1) return false;
    out = String(value == null ? "" : value)
      .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .slice(0, UB_TRAIL_MAX_VALUE).toLowerCase();
    if (!out) return false;
  }

  if (!(k in ubTrail)) ubTrailOrder.push(k);
  ubTrail[k] = out;
  return true;
}

/**
 * A budget category → a short, stable key.
 *
 * First three letters of the first word. `sweep.js` §7e asserts the twelve are
 * distinct, so adding a thirteenth category that collides is a failed build
 * rather than two lines silently merging in a report.
 */
function ubTrailCatKey(category) {
  return String(category || "").replace(/[^A-Za-z ]/g, "").split(" ")[0]
    .slice(0, 3).toLowerCase();
}

/** A budget figure the tester set themselves. */
function ubTrailBudget(category, amount) {
  return ubTrailRecord(ubTrailCatKey(category), amount);
}

/**
 * A budget figure Help me out computed for them.
 *
 * A separate key, on purpose. It is the most interesting comparison in the
 * whole trail — what someone guessed versus what the questions produced — and
 * overwriting the first with the second would destroy exactly that.
 */
function ubTrailHelped(category, amount) {
  return ubTrailRecord(ubTrailCatKey(category) + "H", amount);
}

/** `name.key-value.key-value` — every character safe in form encoding. */
function ubTrailEncode(checkpoint) {
  const parts = [String(checkpoint || "at").replace(/[^A-Za-z0-9]+/g, "")];
  for (let i = 0; i < ubTrailOrder.length; i++) {
    const k = ubTrailOrder[i];
    const entry = k + "-" + ubTrail[k];
    if (parts.join(".").length + entry.length + 1 > UB_TRAIL_MAX_URL) break;
    parts.push(entry);
  }
  return parts.join(".");
}

/**
 * Mark that something finished.
 *
 * Does NOT write the URL itself. The screen change that follows a checkpoint —
 * go("budgetDone") and its render — would overwrite whatever this wrote a
 * moment later. So it parks the name and js/screen-url.js consumes it on the
 * next view, which puts the trail on the screen the tester actually lands on:
 * the same URL a task-completion criterion is watching.
 */
function ubTrailCheckpoint(name) {
  ubTrailPending = String(name || "at").replace(/[^A-Za-z0-9]+/g, "");
  return ubTrailPending;
}

/** Consumed by screenUrlSync(). Returns the fragment payload once, then null. */
function ubTrailTake() {
  if (!ubTrailPending) return null;
  const encoded = ubTrailEncode(ubTrailPending);
  ubTrailPending = null;
  return encoded;
}

/** For the admin panel and the sweep — what would be written right now. */
function ubTrailPreview() { return ubTrailEncode("preview"); }
