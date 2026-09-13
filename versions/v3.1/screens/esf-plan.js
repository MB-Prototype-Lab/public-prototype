// ─── Emergency fund — the number, and the plan ───────────────────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// ── ONE NUMBER, NOT TWO ──────────────────────────────────────────────────────
// The spec put two cards here — "What I spend now" against "If my pay stopped"
// — and called the choice between them the experiment. The owner cut it, and
// the reasoning holds: an emergency fund sized on the assumption that you keep
// your employer's health cover is not covering the emergency, so the higher
// figure is the only honest target and there is nothing to choose between.
//
// What survives is the INSIGHT, not the choice. The health-cover adjustment is
// stated on this screen with its own line, because a target built on $3,000 a
// month when the tester just entered $2,700 reads as a bug unless something
// names the difference.
//
// ── NO ADVICE, ANYWHERE ──────────────────────────────────────────────────────
// D26. The spec's own header read "We recommend 6 months of expenses", which is
// one of the forbidden shapes verbatim. Coverage is stated as a setting with a
// correction beside it — which is what the spec's §1.1 asked for anyway.

function esfCoverageChoices() {
  return ESF_CONFIG.coverageChoices || [3, 6];
}

function esfSetCoverage(months) {
  const s = esfSession();
  const n = parseInt(months, 10);
  s.coverageMonths = isFinite(n) && n > 0 ? n : null;
  esfLog("coverage_changed", { months: esfCoverageMonths() });
  render();
}

function esfSetBuffer(pct) {
  const s = esfSession();
  const n = Number(pct);
  s.buffer = isFinite(n) ? n : 0;
  esfLog("buffer_changed", { buffer: s.buffer, monthly: esfBufferedMonthly() });
  render();
}

/** Typed straight into the buffer field — accepts "15", "15%", "-5". */
function esfSetBufferRaw(raw) {
  const s = esfSession();
  const n = Number(String(raw == null ? "" : raw).replace(/[^0-9.\-]/g, ""));
  s.buffer = isFinite(n) ? n / 100 : 0;
  esfLog("buffer_changed", { buffer: s.buffer, monthly: esfBufferedMonthly() });
  render();
}

function esfSetTargetDate(value) {
  const s = esfSession();
  if (value) s.targetDate = value;
  render();
}

function esfPlanBack() {
  const s = esfSession();
  s.step = ESF_STEPS.length - 1;
  go("esfBuild");
}

/** "Target date: March 2027" — never a bare month count next to a coverage one. */
function esfTargetDateLabel() {
  const s = esfSession();
  const d = new Date(s.targetDate);
  if (!isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderEsfPlan() {
  const s = esfSession();
  const months = esfCoverageMonths();
  const bufferPct = Math.round((Number(s.buffer) || 0) * 100);
  const choices = ESF_CONFIG.bufferChoices || [];
  const inChoices = choices.some(c => Math.round(c * 100) === bufferPct);
  const notes = ESF_CONFIG.coverageNotes || {};

  // The dollar value the percentage is worth, so the tester sees what they are
  // actually adding rather than having to do the arithmetic from a percent.
  const bufferAmount = esfTarget() - esfRound(esfSurvivalMonthly() * months);

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title esf-title">${h(ESF_TITLE_MAIN)}</h1>
      </div>

      <div class="journal-body">
        <p class="esf-step-heading">Emergency Savings Fund Goal</p>

        <div class="esf-banner${esfBannerClass(ESF_PLAN_IMAGE)}" style="aspect-ratio:${ESF_PLAN_IMAGE.ratio} / 1;max-height:${ESF_PLAN_IMAGE.maxH}px;">
          <img src="${h(ESF_PLAN_IMAGE.src)}" alt="" aria-hidden="true">
        </div>

        <p class="esf-goal-figure">${h(esfMoney(esfTarget()))}</p>

        <div class="item-card esf-row">
          <p class="esf-group-label">Months of expenses covered</p>
          <p class="helper esf-row-help" style="margin-top:0;">
            Choose coverage based on your own situation.
          </p>
          <div class="esf-seg" role="group" aria-label="Months of expenses covered">
            ${esfCoverageChoices().map(m => `
              <button type="button" class="esf-seg-btn ${months === m ? "on" : ""}"
                      aria-pressed="${months === m}"
                      onclick="esfSetCoverage(${m})">${m} months</button>`).join("")}
          </div>
          ${notes[months] ? `<p class="helper esf-row-help">${h(notes[months])}</p>` : ""}
        </div>

        <div class="item-card esf-row">
          <p class="esf-group-label">Breathing room for surprise costs</p>
          <div class="esf-fields">
            <div class="esf-field">
              <label class="esf-field-label" for="esfBufferPct">Extra</label>
              <select id="esfBufferPct" class="esf-select" onchange="esfSetBuffer(this.value)">
                ${choices.map(c => `
                  <option value="${c}" ${Math.round(c * 100) === bufferPct ? "selected" : ""}>
                    ${c > 0 ? "+" : ""}${Math.round(c * 100)}%
                  </option>`).join("")}
                ${inChoices ? "" : `<option value="${s.buffer}" selected>${bufferPct > 0 ? "+" : ""}${bufferPct}%</option>`}
              </select>
            </div>
            <div class="esf-field">
              <label class="esf-field-label" for="esfBufferAmt">That adds</label>
              <input id="esfBufferAmt" class="esf-amount" type="text" readonly
                     value="${h(esfMoney(bufferAmount))}"
                     aria-label="Amount the extra adds to the goal">
            </div>
          </div>
        </div>

        <div class="item-card esf-row">
          <p class="esf-group-label">Target date: ${h(esfTargetDateLabel())}</p>
          <p class="helper esf-row-help" style="margin-top:0;">
            That works out to <strong>${h(esfMoney(esfMonthlyContribution()))}</strong> a month.
            Move the date and this moves with it.
          </p>
          <input class="esf-date" type="date" value="${h(s.targetDate)}"
                 aria-label="Target date"
                 onchange="esfSetTargetDate(this.value)">
        </div>
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="esfPlanBack()">Back</button>
        <button class="button" type="button" onclick="esfCommit()">Set my goal</button>
      </div>
    </div>
  `;
}

function renderEsfPlanAdmin() {
  const s = esfSession();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Plan</p>
      <p class="helper">
        Survival ${esfMoney(esfSurvivalMonthly())} a month
        (unemployed insurance ${esfMoney(esfRowMonthly("unemployedInsurance"))} is a ROW now,
        not an uplift; dining out is captured but excluded)
        × ${(1 + (s.buffer || 0)).toFixed(2)} = ${esfMoney(esfBufferedMonthly())}
      </p>
      <p class="helper">
        × ${esfCoverageMonths()} months = <strong>${esfMoney(esfTarget())}</strong>,
        over ${esfMonthsToTarget()} months → ${esfMoney(esfMonthlyContribution())} a month
      </p>
      <p class="helper">
        Setting the goal also seeds the budget through the baseline seam — the six
        survival categories carry these figures, the other six open on peer values.
      </p>
    </div>
  `;
}
