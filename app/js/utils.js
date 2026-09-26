// ─── Shared Utilities ─────────────────────────────────────────────────────────
// Helpers used across all screen files.
//
//   h(value)          — HTML-escape for safe injection into template strings
//   scrollTop()       — resets screenRoot scroll position after navigation
//   debouncedRender() — 400ms debounced render. Required for any `type="range"`
//                       on `oninput` (product sliders included, not just admin
//                       fields): render() reassigns .screen's innerHTML, which
//                       destroys the element being dragged.
//   activeTabFor(screen) — single source of truth for which bottom tab highlights
//                          on a given screen; used by renderNav() in nav.js

// Get an element by ID (global helper used in screen event handlers)
const $ = id => document.getElementById(id);

// HTML-escape a value for safe injection into template strings
function h(value) {
  return String(value ?? "")
    .replaceAll("&",  "&amp;")
    .replaceAll("<",  "&lt;")
    .replaceAll(">",  "&gt;")
    .replaceAll('"',  "&quot;")
    .replaceAll("'",  "&#039;");
}

/**
 * Enable or disable a button by id, WITHOUT rendering.
 *
 * The house rule is `onchange`, not `oninput`, because a full render() mid-
 * keystroke replaces the focused element and the caret goes with it. But that
 * left every "Continue" gated on a field disabled until the tester clicked
 * away — you typed your name and the button stayed grey.
 *
 * The way out is not oninput + render(). It is oninput + an imperative patch:
 * state updates on every keystroke, and only the one control that depends on it
 * is touched. Same shape journalSetNumber (js/journal.js) already uses to
 * repaint the journal's Next label.
 */
function uiSetEnabled(id, enabled) {
  const el = document.getElementById(id);
  if (!el) return;
  if (enabled) el.removeAttribute("disabled");
  else el.setAttribute("disabled", "disabled");
}

/** Replace one element's contents without touching the rest of the screen. */
function uiPatchHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/**
 * Write a field's value without a render(), for the same reason as the two
 * above: when a slider and a number box show the same figure, dragging one has
 * to move the other, and a repaint mid-drag destroys the element the pointer
 * is captured on. Skips the element if it is the one being typed in, so this
 * can never fight a caret.
 */
function uiSetValue(id, value) {
  const el = document.getElementById(id);
  if (!el || el === document.activeElement) return;
  el.value = value;
}

/**
 * What "the same view" means for holding scroll position.
 *
 * render() keeps the scroll offset when this string is unchanged and resets to
 * the top when it is not. A screen id alone is too coarse: several flows are
 * ONE screen with an internal position — the budget builder is three steps of
 * `budgetBuild`, the journal is four questions of `journalEntry` — and moving
 * between those is a new page to a tester even though state.screen never moved.
 * Scrolled to the bottom of step 2, Continue landed them at the bottom of step 3.
 *
 * The inverse case is why this is not simply "always reset": a slider drag, a
 * toggle, and a question revealing below the one just answered are all repaints
 * of the view you are already reading, and yanking those to the top loses the
 * tester's place mid-gesture.
 *
 * Add a line here when a new screen carries its own steps. Deliberately NOT
 * derived from the whole of `state` — answers change constantly within a step
 * and must not count as a new view.
 *
 * ⚠ IT HAS TWO CONSUMERS NOW, and they must not be split apart.
 * render() uses it to decide whether to hold the scroll offset, and
 * js/screen-url.js turns it into the URL and <title> a usability tracker
 * records. Both are asking the identical question — "is this a new page to a
 * tester?" — and the sentence above is the answer to it. A second function
 * answering the same question separately would drift, and the drift would be
 * invisible: the flow report would quietly stop matching what testers saw.
 */
function scrollKey() {
  const s = state.screen;
  if (s === "profilePicker" && state.profilePick) {
    // Tier then level reveal on one screen — the same view growing, so the
    // key deliberately does not move as they answer.
    return s;
  }
  if (s === "budgetBuild" && state.budgetBuild) return s + ":" + state.budgetBuild.step;
  if (s === "esfBuild" && state.esf) return s + ":" + state.esf.step;
  // Category AND stage, but never the answers: revealing the next question is
  // the same view growing, and holding position is what keeps it readable.
  if (s === "helpMeOut" && state.helpMeOut) {
    return s + ":" + state.helpMeOut.category + ":" + state.helpMeOut.stage;
  }
  if (s === "lifestyleWizard" && state.lifestyleWizard) return s + ":" + state.lifestyleWizard.step;
  if (s === "spendEstimator" && state.estimator) {
    return s + ":" + state.estimator.stage + ":" + state.estimator.qIndex;
  }
  if (s === "journalEntry" && state.journalSession) return s + ":" + state.journalSession.qIndex;
  if (s === "onboarding" && state.onboarding) {
    // The buddy step is two screens to a tester -- meet, then name -- so the name
    // screen gets its own key. The meet screen keeps the bare step, so an old
    // ?screen=onboarding-5 link still means "the start of the buddy step".
    const o = state.onboarding;
    const sub = (typeof onbBuddySubKey === "function") ? onbBuddySubKey(o) : "";
    return s + ":" + o.step + (sub ? ":" + sub : "");
  }
  return s;
}

// Scroll the screen content area back to the top
function scrollTop() {
  const root = document.getElementById("screenRoot");
  if (root) root.scrollTop = 0;
}

// Debounced render — waits 400ms after the last call before rendering.
//
// Two callers, same reason: replacing .screen's innerHTML mid-interaction
// destroys the element the user is working in.
//   · admin number/text inputs — so mid-typing keystrokes don't re-render
//   · any `type="range"` on `oninput` — the dragged node would be replaced and
//     the browser's pointer capture dies with it (see budgetSetPlan)
// Select dropdowns still use render() directly (no debounce needed).
let _debouncedRenderTimer = null;
function debouncedRender() {
  clearTimeout(_debouncedRenderTimer);
  _debouncedRenderTimer = setTimeout(render, 400);
}

/**
 * Drop any render queued by debouncedRender(). Called at the top of render()
 * so a pending repaint can never land AFTER a newer one.
 *
 * Without this, a slider drag leaves a render queued for up to 400ms; if the
 * user focuses a text input inside that window the queued render wipes the
 * field mid-keystroke. Removing a focused input from the DOM fires no `change`
 * event, so the typed value is lost silently — and every non-slider input here
 * commits on `onchange`.
 */
function debouncedRenderCancel() {
  clearTimeout(_debouncedRenderTimer);
  _debouncedRenderTimer = null;
}

// Map a screen name to its active bottom-tab identifier
/** @returns {string} Today's date as YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The diagnostic state snapshot, as an object. Separate from copyAppState() so
 * the sweep can assert on what actually gets emitted — a check that rebuilds
 * its own object from `state` proves nothing about this function.
 *
 * ── READ boot.js §"parked v2 names" BEFORE ADDING A KEY ──────────────────────
 * v2's names survive alongside v3's and several are vestigial. The obvious
 * spelling is usually the dead one:
 *
 *     v3 (live)                        v2 (parked, do NOT report)
 *     state.dailyTasks                 state.tasks
 *     state.strategicGoal              state.goals
 *     state.tacticalGoals
 *     state.journal / .journalEntries  —
 *
 * This shipped once reading `state.goals` and `state.tasks`, which are the v2
 * arrays no v3 screen renders. That is the same defect it was written to fix —
 * a snapshot naming keys that look authoritative and describe nothing on
 * screen — so it is worth the noise of spelling the trap out here.
 */
function appStateSnapshot() {
  var s = {
    screen: state.screen,
    nav: state.nav,
    // The three layers, never blurred (architecture §5)
    plan: state.plan,
    planTotal: state.planTotal,
    planStatus: state.planStatus,
    mtd: state.mtd,
    // Journal: the SEEDED history and the tester's own submissions, which are
    // what feed month-to-date (L17). journalSession is the in-flight entry and
    // is null everywhere except mid-journal, so it is useless on its own.
    journal: state.journal,
    journalEntries: state.journalEntries,
    journalSession: state.journalSession,
    // Observations carry the computed figures, not just ids — the id says which
    // observation fired, the figures say what it fired on, and "the dining
    // number looks wrong" is the report this exists to answer.
    observations: state.observations,
    // v3 goals + tasks. NOT state.goals / state.tasks — see the table above.
    strategicGoal: state.strategicGoal,
    tacticalGoals: state.tacticalGoals,
    dailyTasks: state.dailyTasks,
    buddy: state.buddy,
    kibble: state.kibble,
    streak: state.streak,
    courseXp: state.courseXp,
    theme: state.settings && state.settings.colorMode,
    // Inherited v2 surfaces still reachable from the admin jump (L14)
    legacy: { debts: state.budget.debts, fixedOverhead: state.budget.fixedOverhead,
              goals: state.goals, tasks: state.tasks,
              selectedBadge: state.selectedBadge, selectedDebt: state.selectedDebt,
              selectedOffer: state.selectedOffer }
  };
  return s;
}

// Copies the snapshot to the clipboard. Admin panel "Copy State" button.
function copyAppState() {
  var s = appStateSnapshot();
  navigator.clipboard.writeText(JSON.stringify(s, null, 2))
    .then(function() { alert('State copied to clipboard'); })
    .catch(function() { prompt('Copy this state (Ctrl+A, Ctrl+C):', JSON.stringify(s, null, 2)); });
}

/**
 * Generates a collision-resistant ID with a named prefix.
 * @param {string} prefix - e.g. "g", "c", "ab", "d"
 * @returns {string} e.g. "g_1719000000000_x4k2r"
 */
function generateId(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function activeTabFor(screen) {
  if (screen === "streak")            return "home";
  if (screen === "login")             return "home";
  if (screen === "dailyUpdate")       return "home";
  if (screen === "dailySummary")      return "home";
  if (screen === "dailyShare")        return "home";
  if (screen === "onboarding")        return "home";
  if (["journalEntry","journalConfirm","journalDone"].includes(screen)) return "home";   // splash → no nav, but keep mapping defined
  // Budget sub-screens
  if (screen === "goals")             return "goals";    // v3: Goals is its own tab (D34)
  if (["profilePicker"].includes(screen)) return "home";
  if (["budgetBuild", "helpMeOut", "spendingProfile", "budgetCompare", "lifestyleWizard","budgetDone"].includes(screen)) return "aboutMe";
  // The emergency fund lives under Goals — it ends in one, even though it seeds
  // the budget on the way through.
  if (["esfBuild", "esfPlan"].includes(screen)) return "goals";
  if (screen === "myDebts")           return "aboutMe";
  if (screen === "debtAnalyzer")      return "aboutMe";
  if (screen === "comparison")        return "aboutMe";
  if (screen === "budgetCategory")    return "aboutMe";
  if (screen === "spendEstimator")    return "aboutMe";
  if (screen === "accountBalances")   return "aboutMe";
  if (screen === "debtBalances")      return "aboutMe";
  if (screen === "budgetUpdateConfirm") return "aboutMe";
  if (screen === "chat")              return "home";
  if (screen === "settings")          return "home";
  // The post-result loop is entered from a flow, and lands back on home.
  if (["postResult", "nextAction", "commitment", "finish"].includes(screen)) return "home";
  if (screen === "reward")            return "learn";
  // Marketplace sub-screen
  if (screen === "marketplaceDetail") return "marketplace";
  // Learn sub-screens
  if (["topic", "reward-preview", "lessonFraming", "lesson", "lessonQuiz", "lessonSimulation", "lessonReward", "quiz", "simulation"].includes(screen)) return "learn";
  // Anything unmapped falls back to home rather than naming a stack that does
  // not exist — navAdminJump would otherwise have nowhere to reset.
  return state.nav && state.nav.stacks[screen] ? screen : "home";
}

