// ─── Which is closer? (v3.1 only) ────────────────────────────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Hidden — full-bleed
//
// The last step of v3.1's inverted budget flow, and the screen that carries the
// whole idea of it.
//
// The tester set twelve figures on the spending profile, then answered six
// lifestyle questions. Those answers imply figures of their own. Rather than
// silently overwriting one with the other — which is what "the model knows
// best" would look like, and what v3 effectively does — this asks.
//
// ── ONLY DISAGREEMENTS GET A ROW ─────────────────────────────────────────────
// Lifestyle reaches 7 of the 12 categories. The other five would be a row with
// the same number on both sides, asking nothing. And of those 7, any the tester
// happened to leave on the model's own figure agree anyway. lwDisagreements()
// is the filter; an empty result skips this screen entirely (lwToCompare).
//
// ── THEIR FIGURE IS THE DEFAULT ──────────────────────────────────────────────
// They set it deliberately, so the model has to win the row rather than the
// other way round. A screen that opened on the model's answer would be asking
// them to defend their own budget.
//
// COPY: descriptive, never prescriptive (D26). "What I'd expect" is a statement
// about a model. "What you should spend" is advice, and this file must not
// drift into it.

function renderBudgetCompare() {
  const w = state.lifestyleWizard;
  // D19 — reached by an admin jump with no session behind it.
  if (!w || !w.profile) {
    return `
      <div class="card">
        <h1 class="title" style="font-size:20px;margin:0 0 6px;">Which is closer?</h1>
        <p class="helper" style="margin:0;">
          This turns up at the end of setting a budget, once there is something
          to compare.
        </p>
      </div>
      <div class="flow-footer">
        <button class="button secondary" type="button" onclick="navGoTabRoot('aboutMe')">Back to Budget</button>
      </div>`;
  }

  const rows = lwDisagreements();
  const total = CATEGORIES.reduce((t, c) => t + lwResolved(c), 0);
  const income = state.monthlyIncome;
  const left = income - total;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title onb-title" style="margin:0;">Which is closer?</h1>
        <p class="helper" style="margin:6px 0 0;">
          Your answers put ${rows.length === 1 ? "one category" : "these " + rows.length + " categories"}
          somewhere else. Pick whichever is nearer the truth — I have no way of
          knowing which.
        </p>
      </div>

      <div class="journal-body">
        ${rows.map(c => renderCompareRow(c)).join("")}

        <div class="card" style="margin-top:14px;">
          <div class="row" style="align-items:baseline;">
            <span class="helper">Monthly total</span>
            <span class="journal-total">${budgetFmt(total)}</span>
          </div>
          <p class="helper" style="margin:8px 0 0;color:${left < 0 ? "var(--warn)" : "var(--muted)"};">
            ${left >= 0
              ? budgetFmt(left) + " left over each month."
              : budgetFmt(Math.abs(left)) + " more than you bring in."}
          </p>
        </div>
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button"
                onclick="state.lifestyleWizard.step=${LW_QUESTIONS.length - 1};go('lifestyleWizard')">Back</button>
        <button class="button" type="button" onclick="lwSubmitCompared()">Save budget</button>
      </div>
    </div>
  `;
}

// Three tap targets, ordered low to high so the row reads as a scale rather
// than as two sides and a compromise.
function renderCompareRow(category) {
  const w = state.lifestyleWizard;
  const pick = (w.choices && w.choices[category]) || "profile";
  const mine  = { key: "profile", label: "You said",     value: lwProfileValue(category) };
  const mid   = { key: "mid",     label: "Between",      value: lwMidValue(category) };
  const model = { key: "model",   label: "I'd expect",   value: lwModelValue(category) };
  const opts = mine.value <= model.value ? [mine, mid, model] : [model, mid, mine];

  return `
    <div class="card compare-row">
      <p class="compare-cat">${h(catLabel(category))}</p>
      <div class="compare-opts">
        ${opts.map(o => `
          <button class="compare-opt ${pick === o.key ? "picked" : ""}" type="button"
                  onclick="lwChoose('${h(category)}','${o.key}')">
            <span class="compare-opt-label">${h(o.label)}</span>
            <span class="compare-opt-figure">${h(budgetFmt(o.value))}</span>
          </button>`).join("")}
      </div>
    </div>`;
}

function renderBudgetCompareAdmin() {
  const w = state.lifestyleWizard;
  if (!w || !w.profile) {
    return `<div class="admin-card"><p class="admin-card-title">Compare</p>
      <p class="helper">No budget session running.</p></div>`;
  }
  const rows = lwDisagreements();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Which is closer (${h(APP_VERSION)})</p>
      <p class="helper" style="margin-bottom:8px;">
        ${rows.length} of ${CATEGORIES.length} categories disagree. The rest pass
        through on the tester's own figure.
      </p>
      <div class="input-group">
        <label>Row by row — slider · mid · model → resolved</label>
        <div class="helper" style="line-height:1.8;">
          ${rows.length ? rows.map(c => `
            ${h(catLabel(c))}: ${budgetFmt(lwProfileValue(c))} ·
            ${budgetFmt(lwMidValue(c))} ·
            ${budgetFmt(lwModelValue(c))}
            → <strong>${budgetFmt(lwResolved(c))}</strong>
            <em>(${h((w.choices && w.choices[c]) || "profile")})</em>`).join("<br>")
            : "none — this screen is skipped"}
        </div>
      </div>
    </div>`;
}
