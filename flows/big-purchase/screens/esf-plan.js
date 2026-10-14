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

/** Already saved — deducts from the goal. Defaults to nothing, typed by hand. */
function esfSetStartingBalance(raw) {
  const s = esfSession();
  const n = Number(String(raw == null ? "" : raw).replace(/[^0-9.]/g, ""));
  s.startingBalance = isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  esfLog("already_saved", { amount: s.startingBalance });
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

  // What the percentage is worth in dollars, computed BEFORE the goal is
  // rounded to $500 — otherwise the rounding lands in this figure and the extra
  // appears to change when the coverage does.
  const bufferAmount = esfBufferAmount();

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">Step ${ESF_TOTAL_STEPS} of ${ESF_TOTAL_STEPS}</p>
        <div class="journal-progress" aria-hidden="true">
          ${Array.from({ length: ESF_TOTAL_STEPS }, () => `<span class="journal-pip on"></span>`).join("")}
        </div>
        <h1 class="title esf-title">Emergency Savings Fund Goal</h1>
      </div>

      <div class="journal-body">
        <div class="esf-banner${esfBannerClass(ESF_PLAN_IMAGE)}" style="aspect-ratio:${ESF_PLAN_IMAGE.ratio} / 1;max-height:${ESF_PLAN_IMAGE.maxH}px;">
          <img src="${h(ESF_PLAN_IMAGE.src)}" alt="" aria-hidden="true">
        </div>

        <p class="esf-goal-figure">${h(esfMoney(esfGoalRemaining()))}</p>
        <p class="esf-goal-sub">still to save &middot; full fund ${h(esfMoney(esfTarget()))}</p>

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
          <div class="esf-inline">
            <select class="esf-select esf-inline-ctl" aria-label="Extra percentage"
                    onchange="esfSetBuffer(this.value)">
              ${choices.map(c => `
                <option value="${c}" ${Math.round(c * 100) === bufferPct ? "selected" : ""}>
                  ${c > 0 ? "+" : ""}${Math.round(c * 100)}%
                </option>`).join("")}
              ${inChoices ? "" : `<option value="${s.buffer}" selected>${bufferPct > 0 ? "+" : ""}${bufferPct}%</option>`}
            </select>
            <span class="esf-inline-note">adds ${h(esfMoney(bufferAmount))}</span>
          </div>
        </div>

        <div class="item-card esf-row">
          <p class="esf-group-label">Already saved</p>
          <div class="esf-inline">
            <input class="esf-amount esf-inline-ctl" type="text" inputmode="numeric"
                   value="${h(esfMoney(s.startingBalance || 0))}"
                   aria-label="Amount already saved"
                   onchange="esfSetStartingBalance(this.value)">
            <span class="esf-inline-note">of ${h(esfMoney(esfTarget()))}</span>
          </div>
        </div>

        <div class="item-card esf-row">
          <p class="esf-group-label">Target date: ${h(esfTargetDateLabel())}</p>
          <div class="esf-inline">
            <input class="esf-date esf-inline-ctl" type="date" value="${h(s.targetDate)}"
                   aria-label="Target date"
                   onchange="esfSetTargetDate(this.value)">
            <span class="esf-inline-note">${h(esfMoney(esfMonthlyContribution()))} a month</span>
          </div>
        </div>
      </div>

      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="esfPlanBack()">Back</button>
        ${renderEsfBuddyButton()}
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
        (medical ${esfMoney(esfRowMonthly("medical"))} is priced on losing work cover)
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
