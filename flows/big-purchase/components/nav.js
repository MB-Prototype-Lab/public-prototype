// ─── Bottom Navigation Bar ────────────────────────────────────────────────────
// Renders the 5-tab persistent nav in D34's order:
//   Goals | Budget | Progress | Learn | Market
// Home is NOT a tab — it is the top-left icon in the shared top bar (L5).
// Labels stay short: "Education"/"Marketplace" wrap at ~63px per tab, and D34
// names tab IDENTITY, not literal label text.
// Market is deliberately DEAD — D33 makes Marketplace a visible but
// non-interactive tab. The screens still exist and stay reachable from the admin
// jump list (L14); only the tab affordance is disabled.
// NOTE: the "Budget" tab's internal screen id is still `aboutMe` (rename was
// label-only) — go('aboutMe') is correct, not go('budget').
// Only visible on screens in NAV_VISIBLE_SCREENS. Excluded screens:
//   lesson        — full-height audiobook player; full-bleed, no tab context
//   quiz          — full-screen question flow; no tab context needed mid-quiz
//   reward-preview — pre-lesson interstitial; nav would distract from the preview
//   reward        — post-quiz celebration; nav bar would break the reward moment
//   lifestyleChain — full-screen question flow; no tab context needed mid-chain
//   postResult     — post-input reaction prompt; keep focus on the prompt
//   nextAction     — next action selection; keep focus on the choice
//   commitment     — commitment creation; keep focus on the input
//   chat           — full-screen chat; has its own Back button, and the input
//                    bar needs the bottom edge the nav would occupy
//   budgetUpdateConfirm — old→new budget comparison; a decision gate, keep
//                    focus on confirm/keep-editing/discard
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
