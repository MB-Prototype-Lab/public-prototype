// ─── Bottom Navigation Bar ────────────────────────────────────────────────────
// Renders the 5-tab persistent nav in D34's order:
//   Goals | Budget | Progress | Learn | Market
// Home is NOT a tab — it is the top-left icon in the shared top bar (L5).
// Labels stay short: "Education"/"Marketplace" wrap at ~63px per tab, and D34
// names tab IDENTITY, not literal label text.
// Market is deliberately DEAD — D33 makes Marketplace a visible but
// non-interactive tab. The screens still exist and stay reachable from the admin
// jump list (L14); only the tab affordance is disabled.
// The Budget tab's internal screen id is `aboutMe`, not `budget`.
// Only listed screens show tabs; full-bleed flows and decision gates keep focus
// on their own controls. Chat also needs the bottom edge for its input bar.
const NAV_VISIBLE_SCREENS = ["home", "aboutMe",
  "myProgress", "goals", "learn", "topic", "simulation", "marketplace", "marketplaceDetail",
  "settings", "myDebts", "debtAnalyzer", "comparison", "accountBalances", "debtBalances",
  "budgetCategory"];

function renderNav() {
  if (!NAV_VISIBLE_SCREENS.includes(state.screen)) return "";

  const active = state.nav.activeStack;
  const tab = (key, label) =>
    `<button class="tab ${active === key ? "active" : ""}" type="button"
             onclick="navGoTab('${key}')">${label}</button>`;

  return `
    <nav class="bottom-tabs" aria-label="Primary navigation">
      ${tab("goals", "Goals")}
      ${tab("aboutMe", "Budget")}
      ${tab("myProgress", "Progress")}
      ${tab("learn", "Learn")}
      <button class="tab tab-disabled" type="button" disabled
              title="Not part of this prototype">Market</button>
    </nav>
  `;
}
