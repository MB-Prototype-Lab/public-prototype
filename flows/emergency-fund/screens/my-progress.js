// ─── My Progress (07-progress-bills, A3) ─────────────────────────────────────
// TAB: My Progress | NAV BAR: Visible
//
// The review surface. Mostly views over data other phases produce, which is why
// it is built late.
//
// REWRITTEN IN 5b. v2's section order (Profile → Budget Results → Assumptions →
// Comparisons → Goals → Commitments) was its own; A3 fixes a different one, so
// this file is deliberately a list of six calls in that order:
//
//   1 spend trend chart, with month-to-date above it
//   2 three-layer comparison — plan, journal, peers
//   3 bills calendar
//   4 subscription usage flags
//   5 badge and buddy level
//   6 kibble balance
//
// D19 binds hardest here: "the chart must never render empty or near-empty.
// Where six days is too thin to show a trend, show the month."

function renderMyProgress() {
  return `
    <h1 class="title" style="margin:0 0 14px;font-size:20px;">My progress</h1>
    ${renderMPTrend()}
    ${renderMPUpdate()}
    ${renderMPComparison()}
    ${renderMPBills()}
    ${renderMPSubscriptions()}
    ${renderMPBadges()}
    ${renderMPKibble()}
  `;
}

// ── 1. Spend trend ───────────────────────────────────────────────────────────
// Six days of journal detail sitting inside fabricated month-to-date totals
// (D19). The summary is the month; the chart is the days.

function mpDailyTotals() {
  const days = (state.journal || []).map(d => ({
    label: d.label,
    day: d.day,
    total: (d.entries || []).reduce((t, e) => t + (Number(e.amount) || 0), 0)
  }));
  // Today's own entries, so a tester's submission appears on the chart.
  const todayTotal = (state.journalEntries || []).reduce((t, e) => t + (Number(e.amount) || 0), 0);
  if (todayTotal > 0 || days.length === 0) {
    days.push({ label: "Today", day: journalDayIndex(), total: todayTotal });
  }
  return days;
}

function renderMPTrend() {
  const days = mpDailyTotals();
  const mtd = catTotal(state.mtd);
  const max = Math.max.apply(null, days.map(d => d.total).concat([1]));
  const avg = days.length ? days.reduce((t, d) => t + d.total, 0) / days.length : 0;

  // Hand-rolled SVG — no recharts under L1 (no npm, so no React chart libs).
  const W = 300, H = 90, gap = 6;
  const bw = days.length ? (W - gap * (days.length - 1)) / days.length : W;

  return `
    <div class="card">
      <div class="row" style="align-items:baseline;margin-bottom:2px;">
        <span class="helper">This month so far</span>
        <span class="journal-total">${budgetFmt(mtd)}</span>
      </div>
      <p class="helper" style="margin:0 0 12px;">
        ${budgetFmt(avg)} a day across the ${days.length} days you wrote about.
      </p>

      <svg class="mp-chart" viewBox="0 0 ${W} ${H + 18}" width="100%" height="${H + 18}"
           role="img" aria-label="Daily spending over the last ${days.length} days">
        ${days.map((d, i) => {
          const bh = Math.max(2, (d.total / max) * H);
          const x = i * (bw + gap);
          return `
            <rect x="${x}" y="${H - bh}" width="${bw}" height="${bh}" rx="3"
                  fill="${d.label === "Today" ? "var(--accent)" : "var(--accent-border)"}"></rect>
            <text x="${x + bw / 2}" y="${H + 13}" text-anchor="middle"
                  font-size="8" fill="var(--muted)">${h(mpShortLabel(d.label))}</text>`;
        }).join("")}
      </svg>
    </div>
  `;
}

function mpShortLabel(label) {
  if (label === "Today") return "today";
  if (label === "Yesterday") return "yest";
  const m = String(label).match(/^(\d+)/);
  return m ? m[1] + "d" : label;
}

// ── 1b. Update your spending ─────────────────────────────────────────────────
// The chart above says what has been recorded; this is how anything gets added
// to it. Without it, My Progress is read-only — you can see the gap and have no
// way to close it from the screen showing it to you.
//
// It opens a Money Journal entry rather than a form. journalSelectQuestions
// already ranks by priority and applies cooldowns, so a plain journalStart({})
// IS "the most important things to answer today" — there is no second selection
// rule to keep in step with the first.

function renderMPUpdate() {
  const logged = mpDailyTotals().filter(d => d.total > 0).length;
  return `
    <div class="card mp-update">
      <p class="task-title" style="margin:0 0 4px;">Anything to add today?</p>
      <p class="task-desc" style="margin:0 0 12px;">
        ${logged
          ? "A few quick questions and the chart above moves."
          : "Nothing recorded yet today. A few quick questions is all it takes."}
      </p>
      <button class="button full" type="button" onclick="mpStartUpdate()">
        Update my spending ›
      </button>
    </div>
  `;
}

// Pushes onto the myProgress stack (js/state.js), so Back returns here rather
// than to Home — the same screen reached from a Home task backs to Home,
// because the stack decides, not the screen (architecture §7).
function mpStartUpdate() {
  // Clear the task claim first. state.activeTaskId names the task whose flow you
  // are currently inside, and a bookmark task that was opened and abandoned
  // ("Set up your budget", then you wander off) leaves it set. journalSubmit
  // completes whatever activeTaskId names — so without this, updating your
  // spending from My Progress would tick off the budget task and pay out its
  // bones. This entry point is not inside any task.
  state.activeTaskId = null;
  journalStart({});
  go("journalEntry");
}

// ── 2. Three-layer comparison ────────────────────────────────────────────────
// Same data as the Budget tab, framed for review rather than editing.

function renderMPComparison() {
  if (state.planStatus !== "complete") {
    return `
      <div class="card">
        <div class="section-title" style="margin:0 0 6px;">Where it's going</div>
        <p class="helper" style="margin:0;">Build a budget to see how the layers line up.</p>
      </div>`;
  }
  return `
    <div class="card">
      <div class="section-title" style="margin:0 0 10px;">Where it's going</div>
      ${renderComparisonCompact(5)}
    </div>`;
}

// ── 3. Bills calendar ────────────────────────────────────────────────────────
// "A bill outside the budget is flagged." The seeded car insurance — $187, due
// in four days, not budgeted — is one of the four observations and must be
// reachable here as well as from home.

function renderMPBills() {
  const bills = (state.bills || []).slice().sort((a, b) => a.dueInDays - b.dueInDays);
  return `
    <div class="card">
      <div class="section-title" style="margin:0 0 10px;">Coming up</div>
      ${bills.length === 0 ? `<p class="helper" style="margin:0;">Nothing due that I know about.</p>` : ""}
      ${bills.map(b => `
        <div class="mp-bill ${b.flagged ? "mp-bill-flagged" : ""}">
          <div class="mp-bill-when">
            <span class="mp-bill-days">${h(b.dueInDays)}</span>
            <span class="mp-bill-unit">day${b.dueInDays === 1 ? "" : "s"}</span>
          </div>
          <div style="flex:1;">
            <p class="task-title" style="margin:0 0 1px;font-size:13px;">${h(b.name)}</p>
            <p class="helper" style="margin:0;font-size:11px;">
              ${b.inBudget ? "in your budget" : "not in this month's budget"}
            </p>
          </div>
          <span class="mp-bill-amt">${budgetFmt(b.amount)}</span>
        </div>
      `).join("")}
      <p class="helper" style="margin:10px 0 0;font-size:10px;">
        Bills get recorded in your journal. This is where you review them.
      </p>
    </div>
  `;
}

// ── 4. Subscription usage flags ──────────────────────────────────────────────
// Driven by the engagement signal from journal entries. "Frame it as a
// question, never an instruction — the app has no idea whether they still want
// it." So never "cancel Hulu".

function renderMPSubscriptions() {
  const subs = state.subs || [];
  const flagged = subs.filter(s => s.status === "flagged_unused");
  return `
    <div class="card">
      <div class="section-title" style="margin:0 0 10px;">Subscriptions</div>
      ${subs.map(s => {
        const stale = s.status === "flagged_unused";
        return `
          <div class="row mp-sub">
            <div style="flex:1;">
              <p class="task-title" style="margin:0 0 1px;font-size:13px;">${h(s.name)}</p>
              <p class="helper" style="margin:0;font-size:11px;">
                ${stale
                  ? "not mentioned in " + h(s.weeksSinceMention) + " weeks"
                  : "mentioned recently"}
              </p>
            </div>
            <span class="helper" style="font-size:12px;">${budgetFmt(s.monthly)}/mo</span>
          </div>`;
      }).join("")}
      ${flagged.length ? `
        <div class="mp-sub-flag">
          <p class="task-title" style="margin:0 0 3px;font-size:13px;">
            Haven't heard about ${h(flagged[0].name)} in a while
          </p>
          <p class="helper" style="margin:0;">
            Still getting use out of it? Only you know.
          </p>
        </div>` : ""}
    </div>
  `;
}

// ── 5. Badge and buddy level ─────────────────────────────────────────────────
// The badge is vanity — it unlocks nothing, and that is the point
// (06-education). The 5-tier model from lessons.json lands in 5c.

function renderMPBadges() {
  const badges = (state.badges || []).slice(0, 4);
  return `
    <div class="card">
      <div class="row" style="margin-bottom:10px;">
        <div class="section-title" style="margin:0;">Level and badges</div>
        <span class="pill" style="font-size:10px;padding:3px 10px;">Level ${h(state.buddyLevel)}</span>
      </div>
      <p class="helper" style="margin:0 0 10px;font-size:11px;">
        Badges are for show — they don't unlock anything.
      </p>
      ${badges.length === 0 ? `<p class="helper" style="margin:0;">No badges yet.</p>` : ""}
      ${badges.map(b => `
        <div class="row mp-badge">
          <span style="font-size:12px;font-weight:700;">${h(b.name)}</span>
          <span class="helper" style="font-size:11px;">${h(b.tier)} ${h(b.level)}</span>
        </div>`).join("")}
    </div>
  `;
}

// ── 6. Kibble balance ────────────────────────────────────────────────────────
// Display-only (L16). Every sink is on the spec's deferred list.

function renderMPKibble() {
  return `
    <div class="card mp-kibble">
      <div>
        <p class="helper" style="margin:0 0 2px;">Charity Points</p>
        <p class="journal-total">💎 ${h(state.charityDiamonds)} · 🦴 ${h(state.kibble)}</p>
      </div>
      <p class="helper" style="margin:0;text-align:right;max-width:150px;font-size:11px;">
        Diamonds and bones donated on your behalf.
      </p>
    </div>
  `;
}

function renderMyProgressAdmin() {
  const days = mpDailyTotals();
  return `
    <div class="admin-card">
      <p class="admin-card-title">My Progress</p>
      <p class="helper" style="margin-bottom:10px;">
        Six sections in A3's order: trend · comparison · bills · subscriptions ·
        badges · kibble.
      </p>
      <div class="input-group">
        <label>Trend — ${days.length} days charted</label>
        <div class="helper" style="line-height:1.7;">
          ${days.map(d => `${h(d.label)} · ${budgetFmt(d.total)}`).join("<br>")}
        </div>
      </div>
      <div class="input-group">
        <label>Month-to-date (the fabricated depth D19 asks for)</label>
        <div class="helper">${budgetFmt(catTotal(state.mtd))}</div>
      </div>
      <div class="input-group">
        <label>Flagged bill</label>
        <div class="helper">
          ${(state.bills || []).filter(b => b.flagged).map(b =>
            `${h(b.name)} · ${budgetFmt(b.amount)} · ${h(b.dueInDays)}d`).join("<br>") || "none"}
        </div>
      </div>
      <div class="input-group">
        <label>Flagged subscription</label>
        <div class="helper">
          ${(state.subs || []).filter(s => s.status === "flagged_unused").map(s =>
            `${h(s.name)} · ${h(s.weeksSinceMention)}w`).join("<br>") || "none — all mentioned recently"}
        </div>
      </div>
    </div>
  `;
}
