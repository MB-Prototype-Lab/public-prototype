// ─── Budget helpers ───────────────────────────────────────────────────────────
// SLIMMED IN 2b. This file used to carry v2's nested-bucket maths and a crude
// ZIP-index peer average (budgetCategoryTotal, budgetPeerAvg, budgetSignal,
// budgetPlanTotal, budgetMonthlyIncome, getZipIndex…). All of it is gone: the
// flat 12 lives in js/taxonomy.js and the real peer model in js/benchmarks.js.
//
// What survives is what still has consumers:
//   budgetFmt   — used in 15 files
//   debt totals — the v2 debt screens are features v3 never specified, so L14
//                 keeps them off the main paths, and they still need their sums.

/** Currency, no decimals — the app's single money formatter. */
function budgetFmt(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString();
}

/** Signed percentage difference, for "x% over" style copy. */
function budgetDelta(spend, peer) {
  if (!peer) return null;
  return Math.round(((spend - peer) / peer) * 100);
}

function debtTotalBalance() {
  return (state.budget.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
}

function debtTotalMinPayment() {
  return (state.budget.debts || []).reduce((s, d) => s + (Number(d.minPayment) || 0), 0);
}
