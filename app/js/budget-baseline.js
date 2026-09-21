// ─── The budget-builder seam ─────────────────────────────────────────────────
// Every budget builder converts its flow into ONE normalized baseline and saves
// through submitBudgetBaseline(). Latest save wins, and an update over an
// existing budget is gated by the shared old→new confirm screen.
//
// Builders never write state.plan directly. That is the whole point of the
// seam: v2 had two builders behind it, v3 has one (L6), and a third could be
// added without touching anything downstream.
//
// PORTED IN PHASE 2 — v2's version converted an 8-amount payload into 5 nested
// buckets via HOUSING_SPLIT / BILLS_SPLIT. Under the flat 12 (A2) there is
// nothing to split: a baseline carries a monthly figure per category and the
// conversion disappears.

/**
 * Normalized baseline.
 *   source     builder id, shown as "Built with X"
 *   profile    { zip, householdSize, incomeAnnual }
 *   lifestyle  the six wizard dimensions, keyed for peer-benchmarks.json
 *   monthly    { <category>: amount } across all 12
 */
const BUDGET_BUILDER_LABELS = {
  lifestyleWizard: "Lifestyle wizard",   // v3's builder; v3.1 keeps the id readable
  budgetBuild: "Budget builder"
};

/** Build a baseline from the current plan — powers builder re-entry. */
function planToBaseline() {
  const monthly = {};
  CATEGORIES.forEach(c => { monthly[c] = catValue(state.plan, c); });
  return {
    source: state.planBuiltWith || null,
    at: state.planBuiltDate || null,
    profile: {
      zip: state.profile.zip,
      householdSize: state.profile.householdSize,
      incomeAnnual: state.profile.incomeAnnual
    },
    lifestyle: Object.assign({}, state.lifestyle),
    monthly: monthly
  };
}

/** Commit a baseline. Only called by submitBudgetBaseline / the confirm screen. */
function applyBudgetBaseline(baseline) {
  if (!baseline || !baseline.monthly) return;

  if (baseline.profile) {
    // D09 — onboarding/wizard inputs override the persona where they overlap.
    ["zip", "householdSize", "incomeAnnual"].forEach(k => {
      if (baseline.profile[k] != null && baseline.profile[k] !== "") {
        state.profile[k] = baseline.profile[k];
      }
    });
  }
  if (baseline.lifestyle) state.lifestyle = Object.assign({}, baseline.lifestyle);

  state.plan = {};
  CATEGORIES.forEach(c => { state.plan[c] = catValue(baseline.monthly, c); });
  state.planTotal = catTotal(state.plan);
  state.planBuiltWith = baseline.source || null;
  state.planBuiltDate = baseline.at || todayISO();
  state.planStatus = "complete";

  // Whatever route built it, this is where a budget becomes real — so it is
  // the checkpoint, and it catches every builder behind the seam rather than
  // one of them (js/value-trail.js).
  if (typeof ubTrailCheckpoint === "function") {
    CATEGORIES.forEach(c => { ubTrailBudget(c, catValue(state.plan, c)); });
    ubTrailCheckpoint("budget");
  }

  // The plan moved, so every plan-derived figure is stale.
  observationsRecompute();

  // Mark any daily task that pointed at building a budget.
  (state.tasks || []).forEach(t => {
    if (t.destination === "budgetBuild") t.completed = true;
  });
  // Route through homeCompleteTask rather than setting the flag directly —
  // doing it by hand marked the task done but skipped the Charity Points it
  // pays, so building a budget silently earned nothing.
  (state.dailyTasks || []).forEach(t => {
    if (t.route !== "budget") return;
    if (typeof homeCompleteTask === "function") homeCompleteTask(t.id);
    else t.completed = true;
  });
}

/**
 * The only way a builder saves.
 *   no existing budget → apply immediately
 *   existing budget    → park it and route to the old→new confirm gate
 */
function submitBudgetBaseline(baseline) {
  if (!baseline) return;
  baseline.at = baseline.at || todayISO();

  if (state.planStatus !== "complete") {
    applyBudgetBaseline(baseline);
    go("budgetDone");
    return;
  }

  state.pendingBaseline = baseline;
  go("budgetUpdateConfirm");
}

function confirmPendingBaseline() {
  if (!state.pendingBaseline) return;
  applyBudgetBaseline(state.pendingBaseline);
  state.pendingBaseline = null;
  go("budgetDone");
}

function discardPendingBaseline() {
  state.pendingBaseline = null;
  // Root, not navGoTab: this screen is sitting on top of the aboutMe stack, and
  // navGoTab would re-commit the top — i.e. this same screen.
  navGoTabRoot("aboutMe");
}

/** Old → new, per category, for the confirm gate. Only rows that changed. */
function baselineDiffRows(baseline) {
  if (!baseline) return [];
  return CATEGORIES.map(c => {
    const before = catValue(state.plan, c);
    const after  = catValue(baseline.monthly, c);
    return { category: c, before: before, after: after, delta: after - before };
  }).filter(r => Math.abs(r.delta) >= 1);
}
