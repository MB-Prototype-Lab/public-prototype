// Shared money formatting and debt-catalog totals. Inherited debt screens
// remain off the main paths under L14.

/** Currency, no decimals — the app's single money formatter. */
function budgetFmt(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString();
}

function debtTotalBalance() {
  return (state.budget.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
}

function debtTotalMinPayment() {
  return (state.budget.debts || []).reduce((s, d) => s + (Number(d.minPayment) || 0), 0);
}
