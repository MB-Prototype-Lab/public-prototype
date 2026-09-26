// ─── Budget update confirm ───────────────────────────────────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Hidden — a decision gate
//
// Gates EVERY builder update. A first budget applies straight away; saving over
// an existing one parks the baseline here and shows old → new per category, so
// a rebuild can never silently overwrite a budget the user tuned by hand.
//
// PORTED IN PHASE 2 — v2's version diffed 8 nested amounts. Under the flat 12
// the diff is per category (baselineDiffRows in js/budget-baseline.js).

function renderBudgetUpdateConfirm() {
  const pending = state.pendingBaseline;
  // D19 — this screen only has content mid-rebuild. Reached any other way it
  // still shows the budget it would have been comparing against.
  if (!pending) {
    return `
      <div class="journal-shell">
        <div class="journal-head">
          <h1 class="title" style="font-size:21px;margin:0;">Nothing to compare</h1>
          <p class="helper" style="margin:6px 0 0;">
            This is where a rebuilt budget gets checked against your current one.
          </p>
        </div>
        <div class="journal-body">
          <div class="card">
            <div class="row" style="align-items:baseline;">
              <span class="helper">Your budget now</span>
              <span class="journal-total">${budgetFmt(catTotal(state.plan))}</span>
            </div>
            <p class="helper" style="margin:8px 0 0;">
              Across ${CATEGORIES.length} categories${state.planBuiltWith ? ", built with " + h(BUDGET_BUILDER_LABELS[state.planBuiltWith] || state.planBuiltWith) : ""}.
            </p>
          </div>
        </div>
        <div class="journal-foot">
          <button class="button secondary" type="button" onclick="bbStart()">Rebuild it</button>
          <button class="button" type="button" onclick="navGoTab('aboutMe')">Back to budget</button>
        </div>
      </div>`;
  }

  const rows     = baselineDiffRows(pending);
  const oldTotal = catTotal(state.plan);
  const newTotal = catTotal(pending.monthly);
  const delta    = newTotal - oldTotal;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">Replace your budget?</h1>
        <p class="helper" style="margin:6px 0 0;">
          You already have one. Here's what would change.
        </p>
      </div>

      <div class="journal-body">
        <div class="card">
          <div class="row" style="align-items:baseline;">
            <span class="helper">Now</span>
            <span class="budget-row-amt">${budgetFmt(oldTotal)}</span>
          </div>
          <div class="row" style="align-items:baseline;margin-top:4px;">
            <span class="helper">After</span>
            <span class="journal-total">${budgetFmt(newTotal)}</span>
          </div>
          <p class="helper" style="margin:8px 0 0;">
            ${delta === 0 ? "Same total." :
              delta > 0 ? budgetFmt(delta) + " more per month." :
                          budgetFmt(Math.abs(delta)) + " less per month."}
          </p>
        </div>

        ${rows.length === 0 ? `
          <div class="card"><p class="helper" style="margin:0;">
            No category changes by more than a pound.
          </p></div>
        ` : `
          <div class="section-title" style="margin:16px 0 8px;">
            ${rows.length} categor${rows.length === 1 ? "y" : "ies"} change
          </div>
          ${rows.map(r => `
            <div class="card budget-row">
              <div class="row" style="align-items:baseline;">
                <span class="budget-row-name">${h(catLabel(r.category))}</span>
                <span class="helper">
                  ${budgetFmt(r.before)} →
                  <strong style="color:var(--text);">${budgetFmt(r.after)}</strong>
                </span>
              </div>
            </div>
          `).join("")}
        `}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="discardPendingBaseline()">Keep mine</button>
        <button class="button" type="button" onclick="confirmPendingBaseline()">Replace it</button>
      </div>
    </div>
  `;
}
