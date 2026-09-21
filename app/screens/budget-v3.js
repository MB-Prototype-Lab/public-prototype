// ─── Budget (v3) ─────────────────────────────────────────────────────────────
// TAB: Budget | NAV BAR: Visible
//
// Replaces v2's about-me hub + budget-setup dashboard. Twelve flat categories
// (A2), each with a slider, plus the plan-vs-actual signal per row.
//
// Empty state: no budget yet → the wizard is the only door (L6). D19 still
// applies — the screen shows the seeded plan rather than a blank.

function renderBudgetV3() {
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

    <!-- Once a budget exists this tab is the REVIEW surface, not an editing one:
         the twelve rows are the three-layer comparison, and the sliders live on
         the per-category screen a row taps into. It used to render twelve
         sliders here, which meant the tab that says "your budget" was the only
         place you could never see how it was going. renderComparisonBody is
         shared with the standalone screen so there is one implementation. -->
    ${renderComparisonBody()}
  `;
}

// Per-row: plan vs what the journal says. The two gaps are NEVER blurred — this
// row shows the PLAN gap; the peer gap is its own card (L11, 2b).
function renderBudgetCategoryRow(category) {
  const plan   = catValue(state.plan, category);
  const actual = catValue(state.mtd, category);
  const pct    = plan ? Math.round(((actual - plan) / plan) * 100) : null;
  const over   = pct != null && pct > 0;
  const max    = budgetSliderMax(category);
  const idx    = CATEGORIES.indexOf(category);

  const catArg = h(category).replace(/'/g, "\\'");
  return `
    <div class="card budget-row">
      <div class="row budget-row-head" style="align-items:baseline;margin-bottom:2px;">
        <button class="budget-row-open" type="button" onclick="goToCategory('${catArg}')">
          <span class="budget-row-name">${h(catLabel(category))}</span>
        </button>
        <span class="budget-row-amt" id="planAmt${idx}">${budgetFmt(plan)}</span>
        <button class="budget-row-chev" type="button" onclick="goToCategory('${catArg}')"
                aria-label="Open ${h(catLabel(category))}">›</button>
      </div>
      <div class="row" style="align-items:baseline;margin-bottom:6px;">
        <span class="helper" style="font-size:11px;">
          You told me ${budgetFmt(actual)}
        </span>
        ${pct == null ? "" : `
          <span class="pill ${over ? "pill-warn" : "pill-good"}" style="font-size:9px;padding:2px 7px;">
            ${over ? "+" : ""}${pct}% vs plan
          </span>`}
      </div>
      <input class="journal-slider" type="range" min="0" max="${max}" step="5"
             value="${plan}"
             oninput="budgetSetPlan('${h(category)}', this.value, true)"
             aria-label="${h(catLabel(category))} planned amount">
    </div>
  `;
}

/**
 * The slider's ceiling. Derived ONLY from things a drag cannot change — the
 * seeded plan and the peer benchmark, both stable for the session.
 *
 * It used to be `Math.ceil(plan * 2.2)`, i.e. a function of the value the
 * slider controls. Undebounced that just churned; debounced it recoils — drag
 * 200 to 400 and 400ms later the re-render doubles the ceiling and the thumb
 * springs back to the same 45% while the number reads 400. Every drag ended
 * with the handle jumping.
 */
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

function renderBudgetObservationCards(surface) {
  const obs = observationsFor(surface);
  if (!obs.length) return "";
  return obs.map(o => `
    <div class="card obs-card">
      <div class="row" style="align-items:baseline;margin-bottom:3px;">
        <p class="task-title" style="margin:0;">${h(observationHeadline(o))}</p>
        ${observationFigure(o) ? `<span class="obs-figure">${h(observationFigure(o))}</span>` : ""}
      </div>
      <p class="helper" style="margin:0;">${h(observationDetail(o))}</p>
    </div>
  `).join("");
}

// No budget yet. One door — the wizard (L6). A picker with one option is a
// button, which is why v2's two-card fork is gone.
function renderBudgetEmpty() {
  return `
    <h1 class="title" style="margin:0 0 4px;font-size:20px;">Monthly budget</h1>
    <p class="helper" style="margin:0 0 16px;">You haven't built one yet.</p>

    <!-- v3.1's pitch is the opposite of v3's. v3 says "answer six questions and
         we will work out the numbers"; here the tester sets the numbers and the
         questions are an optional second opinion. The copy has to say which one
         this is, or the flow surprises them one screen in. -->
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

/**
 * "Budget Saved!" — a beat, then the Budget tab.
 *
 * This used to render the "budget_comparison" observation cards — the
 * dining-over-plan and car-insurance flags — which have nothing to do with
 * having just saved a budget and read as errors on the screen that confirms it.
 *
 * The continue is navGoTabRoot, not navGoTab: this screen is sitting ON the
 * aboutMe stack when the wizard was opened from the Budget tab, and navGoTab
 * re-commits that stack's top — this same screen. That is why "See my budget"
 * did nothing.
 */
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

function renderBudgetV3Admin() {
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
