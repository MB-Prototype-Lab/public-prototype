// ─── Budget category detail (04-budget-benchmarks) ───────────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Visible
//
// Reached by tapping a category on the budget tab or a "Worth a look" flag.
// Read-only by design: it shows the three-layer comparison for one category and
// the goals scoped to it. Two edit affordances, kept distinct (owner's model):
//   • the PLAN is editable here (a slider, same seam as the list)
//   • the ACTUALS are updated through a clear CTA that opens the behavioral
//     estimator (Money-Journal style) — you never type a dollar figure.

// The plan slider is the SAME track as the comparison above it, made
// draggable — so the peer band a tester is setting their plan against stays on
// screen, in the same place, while they set it.
//
// Its ceiling is budgetSliderMax(), derived from the seeded plan and the peer
// figure and never from the value being dragged. A ceiling that moved with the
// value is what made the old thumb recoil on release.
function renderBudgetCategory() {
  const category = isCategory(state.selectedCategory) ? state.selectedCategory : CATEGORIES[0];
  const r = cmpRow(category);
  const idx = CATEGORIES.indexOf(category);
  const max = budgetSliderMax(category);
  const hasData = catValue(state.mtd, category) > 0;
  const catArg = h(category).replace(/'/g, "\\'");

  return `
    <h1 class="title" style="margin:0 0 4px;font-size:20px;">${h(catLabel(category))}</h1>
    <p class="helper" style="margin:0 0 14px;">
      Your plan, what you've told me, and peers — for this one category.
    </p>

    ${hasData ? "" : renderCategoryNoSpend(category)}

    ${renderComparisonRow(r)}

    ${r.hasPlan ? `
    <div class="card">
      <div class="row" style="align-items:baseline;margin-bottom:2px;">
        <span class="budget-row-name">Your plan</span>
        <!-- id is budgetSetPlan's live-drag target (budget-v3.js) — keep in step -->
        <span class="budget-row-amt" id="planAmt${idx}">${budgetFmt(r.plan)}</span>
      </div>
      ${renderBudgetBandSlider({
        category: category,
        value: r.plan,
        peer: r.peer,
        max: max,
        oninput: `budgetSetPlan('${catArg}', this.value, true)`
      })}
      <p class="helper" style="font-size:11px;margin:6px 0 0;">
        Drag to adjust your monthly plan. The shaded stretch is where peers like
        you land.
      </p>
    </div>` : `
    <div class="card">
      <p class="helper" style="margin:0 0 10px;">
        You haven't built a budget yet, so there's no plan to compare against here.
      </p>
      <button class="button full" type="button" onclick="navGoTabRoot('aboutMe')">Build my budget ›</button>
    </div>`}

    <button class="button full" style="margin-top:12px;" type="button"
            onclick="estimatorStart('${catArg}')">
      ${hasData ? "Update what you've spent" : "Help me estimate what you've spent"} ›
    </button>
    <p class="helper" style="font-size:11px;margin:6px 0 0;text-align:center;">
      A few quick questions about your habits — I'll work out the number.
    </p>

    ${renderGoalSuggestions({ source: "budget", category: category }, h(catLabel(category)) + " goals")}
  `;
}

/**
 * This one category has nothing logged against it.
 *
 * The screen-wide banner in comparison.js is gated on the whole month being
 * empty; this is the per-category case, and it is the one the owner described
 * — you are looking at a category, its dot is on zero, and nothing on screen
 * explains why. The estimator button below does a different job (it asks about
 * habits and writes a figure); this offers the journal, which is where real
 * spend comes from.
 */
function renderCategoryNoSpend(category) {
  return `
    <div class="card cmp-nospend cmp-nospend-banner">
      <p class="task-title" style="margin:0 0 4px;">
        Nothing tracked for ${h(catLabel(category))} yet
      </p>
      <p class="task-desc" style="margin:0 0 12px;">
        The dot below sits at zero because I have not been told, not because
        nothing was spent. Your Money Journal is where that comes from.
      </p>
      <button class="button full" type="button" onclick="mpStartUpdate()">
        Start my Money Journal ›
      </button>
    </div>`;
}

function renderBudgetCategoryAdmin() {
  const category = isCategory(state.selectedCategory) ? state.selectedCategory : CATEGORIES[0];
  const r = cmpRow(category);
  return `
    <div class="admin-card">
      <p class="admin-card-title">Category — ${h(catLabel(category))}</p>
      <div class="helper" style="line-height:1.9;">
        plan <strong>${budgetFmt(r.plan)}</strong> ·
        you told me <strong>${budgetFmt(r.user)}</strong> ·
        peers <strong>${r.peer == null ? "—" : budgetFmt(r.peer)}</strong><br>
        vs plan ${r.vsPlan == null ? "—" : r.vsPlan + "%"} ·
        vs peers ${r.vsPeer == null ? "—" : r.vsPeer + "%"}
      </div>
      <div class="input-group" style="margin-top:10px;">
        <label>Jump to a different category</label>
        <select onchange="state.selectedCategory=this.value;render()">
          ${CATEGORIES.map(c => `<option value="${h(c)}" ${c === category ? "selected" : ""}>${h(catLabel(c))}</option>`).join("")}
        </select>
      </div>
    </div>
  `;
}
