// ─── The 12-category taxonomy (A2) ───────────────────────────────────────────
// The single most load-bearing contract in the build. Frozen, ordered, and the
// join key across four independent data surfaces:
//
//   PEER_BENCHMARKS.base[cat]              peer layer
//   SEED_STATE.budget.monthly[cat]         plan layer
//   SEED_STATE.monthToDateActuals[cat]     self-reported layer
//   JOURNAL_QUESTIONS[].options[].category journal entries
//
// Strings are used as object keys VERBATIM — note the space and lowercase in
// "Dining out". Do not slugify; every data file keys on the display string.
//
// There is no Savings category. Saving is a goal, not a budget line — v2's
// `savings` bucket has no equivalent here.
const CATEGORIES = [
  "Housing", "Groceries", "Dining out", "Transport",
  "Utilities", "Subscriptions", "Health", "Personal care",
  "Entertainment", "Shopping", "Debt payments", "Other"
];

// ── Always iterate CATEGORIES, never Object.keys(data) ───────────────────────
// Four of the data objects carry a `_note` key alongside their real entries:
//   monthToDateActuals (13) · PEER_BENCHMARKS.base (13) ·
//   colTiers.zipPrefixes (151) · lifestyleModifiers (7)
// Object.keys() on any of them yields a "_note" category that renders as a
// tile, corrupts a total, or fails a benchmark lookup. These helpers exist so
// nobody has to remember that.

/** Sum a {category: amount} map over the taxonomy only. Ignores `_note`. */
function catTotal(map) {
  if (!map) return 0;
  return CATEGORIES.reduce((sum, c) => sum + (Number(map[c]) || 0), 0);
}

/** Read one category from a data map, 0 when absent. */
function catValue(map, category) {
  return (map && Number(map[category])) || 0;
}

/** [{category, amount}] in taxonomy order — safe for rendering. */
function catRows(map) {
  return CATEGORIES.map(c => ({ category: c, amount: catValue(map, c) }));
}

/** True when the string is a real taxonomy member (guards journal writes). */
function isCategory(c) {
  return CATEGORIES.indexOf(c) !== -1;
}

// ─── Display labels ──────────────────────────────────────────────────────────
// A category's DATA KEY and its DISPLAY NAME are different things, and this is
// the seam between them.
//
// "Health" is the join key across five independent surfaces — PEER_BENCHMARKS
// .base and .colTiers, SEED_STATE.budget.monthly, SEED_STATE.monthToDateActuals,
// ESTIMATOR_QUESTIONS.categories, and ZIP_COST_OF_LIVING's categoryBucket and
// weights. Renaming the key means editing all of them, including
// peer-benchmarks.json, which js/benchmarks.js documents as a never-edited
// verbatim spec copy. Every file missed is a lookup that silently returns
// undefined and contributes 1.0 or 0 — the exact class of plausible-looking
// wrong number this taxonomy exists to prevent.
//
// So the owner's "change the name across all screens" is done where it was
// asked: on the screens. Data keys never move.
//
// USE catLabel() ANYWHERE A CATEGORY IS SHOWN TO A TESTER. Use the bare string
// for every lookup, every object key, and every comparison.
const CATEGORY_LABELS = {
  "Health": "Medical & Dental"
};

/** What a tester should see for this category. */
function catLabel(category) {
  return CATEGORY_LABELS[category] || category;
}
