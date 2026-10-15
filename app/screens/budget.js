// The Budget tab reviews the flat plan and spend comparison when the
// paywall is disabled. Before the first save, offer the single builder (L6).

function renderBudgetTab() {
  // L27 overrides D31 for this tab. Retain the budget view behind the flag
  // so turning the paywall off restores the same review surface.
  if (typeof BUDGET_PAYWALL !== "undefined" && BUDGET_PAYWALL) return renderBudgetPaywall();
  if (state.planStatus !== "complete") return renderBudgetEmpty();

  const total  = catTotal(state.plan);
  const income = state.monthlyIncome;
  const left   = income - total;
  const builtBy = BUDGET_BUILDER_LABELS[state.planBuiltWith] || state.planBuiltWith;

  return `
    <div class="row" style="align-items:baseline;margin-bottom:2px;">
      <h1 class="title" style="margin:0;font-size:20px;">Budget</h1>
      <button class="button secondary" style="font-size:11px;padding:6px 12px;"
              type="button" onclick="bbStart()">Rebuild</button>
    </div>
    <p class="helper" style="margin:0 0 14px;font-size:11px;">
      ${h(state.profile.zip)} · ${h(state.profile.householdSize)} person${state.profile.householdSize > 1 ? "s" : ""}${builtBy ? " · Built with " + h(builtBy) : ""}
    </p>

    <div class="card">
      <div class="row" style="align-items:baseline;">
        <span class="helper">Planned</span>
        <span class="journal-total">${budgetFmt(total)}</span>
      </div>
      <div class="row" style="align-items:baseline;margin-top:4px;">
        <span class="helper">Coming in each month</span>
        <span class="helper">${budgetFmt(income)}</span>
      </div>
      <div class="budget-bar" aria-hidden="true">
        <span style="width:${Math.min(100, income ? (total / income) * 100 : 0)}%"></span>
      </div>
      <p class="helper" style="margin:8px 0 0;">
        ${left >= 0
          ? budgetFmt(left) + " left over each month."
          : budgetFmt(Math.abs(left)) + " more than you bring in."}
      </p>
    </div>

    ${renderGoalSuggestions({ source: "budget" }, "Suggested Budget Goals")}

    <!-- Share the review body with comparison; category detail holds sliders. -->
    ${renderComparisonBody()}
  `;
}

// Derive the slider ceiling from seed and peer figures, never the value
// being dragged: a moving maximum makes the thumb recoil after repaint.
function budgetSliderMax(category) {
  const seeded = catValue(SEED_STATE.budget.monthly, category) || 0;
  let peer = 0;
  try { peer = benchPeerValue(category, benchOptsForUser()) || 0; } catch (e) { peer = 0; }
  // Round to a 50 grid so the ceiling is a stable, readable number.
  return Math.max(200, Math.ceil((Math.max(seeded, peer) * 2.2) / 50) * 50);
}

// Direct slider edits are a tweak, not a rebuild — they do not go through the
// seam, which exists to gate whole-budget replacement.
//
// `live` is set by the slider's oninput, which fires on every pointer move.
// render() replaces .screen's innerHTML, so an undebounced render destroys the
// very element being dragged — the browser's pointer capture dies with the old
// node and the thumb stops tracking. State still updates immediately; only the
// repaint waits. The admin number field passes no flag and stays instant.
function budgetSetPlan(category, amount, live) {
  if (!isCategory(category)) return;
  state.plan[category] = Math.max(0, Math.round(Number(amount) || 0));
  if (typeof ubTrailBudget === "function") ubTrailBudget(category, state.plan[category]);
  state.planTotal = catTotal(state.plan);
  observationsRecompute();
  if (!live) { render(); return; }
  // Live drag: paint the readout directly so the number tracks the thumb, and
  // leave the full repaint to the debounce. Deferring everything would freeze
  // the figure for the whole gesture — the slider would move and nothing else
  // would, which reads as broken in a different way.
  const el = document.getElementById("planAmt" + CATEGORIES.indexOf(category));
  if (el) el.textContent = budgetFmt(state.plan[category]);
  debouncedRender();
}

// Offer the single budget builder when no budget exists (L6).
function renderBudgetEmpty() {
  return `
    <h1 class="title" style="margin:0 0 4px;font-size:20px;">Monthly budget</h1>
    <p class="helper" style="margin:0 0 16px;">You haven't built one yet.</p>

    <!-- Explain that figures come first and Help me out is optional. -->
    <div class="card">
      <p class="task-title" style="margin:0 0 6px;">Let's build your budget</p>
      <p class="task-desc" style="margin:0 0 12px;">
        Start from what a household like yours spends around here, then move
        anything that is not you. Six quick questions afterwards are optional.
      </p>
      <button class="button full" type="button" onclick="bbStart()">Start</button>
      <p class="helper" style="font-size:10px;margin:10px 0 0;">
        About a minute · nothing is saved until you say so
      </p>
    </div>
  `;
}

// ─── Post-save ───────────────────────────────────────────────────────────────

// Return to the tab root after the saved confirmation. navGoTab would
// restore this confirmation from the stack instead of showing the budget.
const BUDGET_DONE_MS = 2000;

function renderBudgetDone() {
  const still = v3PrefersReducedMotion();
  // Auto-advance so the beat is a transition rather than a screen to dismiss.
  // The tap target below is the escape hatch — it can never strand anyone.
  budgetDoneArm(still ? 0 : BUDGET_DONE_MS);

  return `
    <div class="journal-shell budget-done" onclick="budgetDoneContinue()">
      <div class="journal-body budget-done-body">
        <p class="budget-done-title ${still ? "" : "budget-done-anim"}">Budget Saved!</p>
        <p class="budget-done-sub ${still ? "" : "budget-done-anim-late"}">
          ${budgetFmt(catTotal(state.plan))} a month across ${CATEGORIES.length} categories.
        </p>
      </div>
      <div class="journal-foot" style="justify-content:center;">
        <button class="button secondary" type="button" onclick="budgetDoneContinue()">
          See my budget
        </button>
      </div>
    </div>
  `;
}

// Module-level, not on `state` — the admin state inspector would serialise a
// timer id it can do nothing with, and render() runs often enough that the
// re-arm has to be idempotent.
let budgetDoneTimer = null;

function budgetDoneArm(ms) {
  if (budgetDoneTimer) return;
  budgetDoneTimer = setTimeout(function () {
    budgetDoneTimer = null;
    if (state.screen === "budgetDone") budgetDoneContinue();
  }, Math.max(0, ms));
}

function budgetDoneContinue() {
  if (budgetDoneTimer) { clearTimeout(budgetDoneTimer); budgetDoneTimer = null; }
  if (state.screen !== "budgetDone") return;
  navGoTabRoot("aboutMe");
}

function renderBudgetTabAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">Plan (12 categories)</p>
      <div class="input-group">
        <label>Status</label>
        <select onchange="state.planStatus=this.value;render()">
          ${["empty", "complete"].map(x =>
            `<option value="${x}" ${state.planStatus === x ? "selected" : ""}>${x}</option>`).join("")}
        </select>
      </div>
      <div class="input-group">
        <label>Built with</label>
        <div class="helper">${h(state.planBuiltWith || "—")} ${h(state.planBuiltDate || "")}</div>
      </div>
      ${CATEGORIES.map(c => `
        <div class="input-group" style="margin-bottom:6px;">
          <label>${h(catLabel(c))} — peer ${budgetFmt(benchPeerValue(c, benchOptsForUser()))}</label>
          <input type="number" min="0" value="${catValue(state.plan, c)}"
                 onchange="budgetSetPlan('${h(c)}', this.value)">
        </div>
      `).join("")}
      <div class="helper">Total: <strong>${budgetFmt(catTotal(state.plan))}</strong></div>
    </div>
  `;
}
