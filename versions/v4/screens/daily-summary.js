// ─── Daily update — completion summary (08-video-updates) ────────────────────
// TAB: None | NAV BAR: Hidden
//
// "A summary screen: the observations, stacked, in plain language."
//
// The share sheet and its anonymization preview are Phase 4b. The streak
// registers at the END of that flow, not here — 03-home-daily-loop is explicit
// that it lands "after a completed journal entry, at the end of the share flow".

function renderDailySummary() {
  const obs = state.observations || [];
  const variant = duScript() ? duScript().variant.replace(/_/g, " ") : "";

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">That's your week</h1>
        <p class="helper" style="margin:6px 0 0;">
          ${h(state.streak)} day${state.streak === 1 ? "" : "s"} in a row${variant ? " · reading: " + h(variant) : ""}.
        </p>
      </div>

      <div class="journal-body">
        ${obs.map(o => `
          <div class="card">
            <div class="row" style="align-items:baseline;margin-bottom:3px;">
              <p class="task-title" style="margin:0;">${h(observationHeadline(o))}</p>
              ${observationFigure(o) ? `<span class="obs-figure">${h(observationFigure(o))}</span>` : ""}
            </div>
            <p class="helper" style="margin:0;">${h(observationDetail(o))}</p>
          </div>
        `).join("")}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="duStart(state.du.scriptId)">Watch again</button>
        <button class="button" type="button" onclick="go('dailyShare')">Share</button>
      </div>
    </div>
  `;
}

// The streak registers at the END of the share flow (03-home-daily-loop), which
// is now screens/daily-share.js — so skipping share means skipping the streak,
// exactly as the spec describes the ordering.
function dailySummaryDone() {
  navGoHome();
}

function renderDailySummaryAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">Summary</p>
      <p class="helper" style="margin-bottom:10px;">
        Observations stacked in plain language. Copy is templated, so the
        figures follow month-to-date rather than the seed's baked strings (L17).
      </p>
      <div class="helper" style="line-height:1.8;">
        ${(state.observations || []).map(o =>
          `${h(o.id)}${observationFigure(o) ? " · " + h(observationFigure(o)) : ""}`).join("<br>")}
      </div>
      <p class="helper" style="font-size:10px;margin-top:10px;">
        The streak registers at the END of the share flow, not here.
      </p>
    </div>
  `;
}
