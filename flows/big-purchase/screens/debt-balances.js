// ─── Debt Balances ─────────────────────────────────────────────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Visible — Budget tab highlighted
//
// PURPOSE
// Records point-in-time debt balance snapshots with date stamps. Separate from
// my-debts.js (which is the full debt catalog with APR/min payment/type details).
// This screen is purely about logging current balances over time for trend tracking.
//
// NAVIGATION
//   Entry: Budget → Debt Balances card; Account Balances → "Next" in monthly update flow
//   Exit:  ← Budget; completing monthly update → net position check → optional budget prompt
//
// STATES
//   Debt dropdown populated from state.budget.debts (the debt catalog).
//   Shows existing balance entries as a timeline list.
//
// PRODUCTION NOTES
//   After completing monthly update (account + debt balances), the app computes:
//   net = sum(accountBalances) - sum(debtBalances)
//   Expected net is derived from budget state.
//   If gap > 10%, prompt user to revisit the 2 Minute Budget sliders.

function renderDebtBalances() {
  const debts    = (state.budget && state.budget.debts) || [];
  const entries  = (state.accountBalances || []).filter(e => e.type === "debt");
  const isInFlow = !!state.flowOrigin;

  return `
    <div class="card" style="margin-bottom:14px;">
<h1 class="title" style="margin:0;font-size:20px;">Debt Balances</h1>
      <p class="subtitle" style="margin:4px 0 0;">What do you owe right now?</p>
    </div>

    ${isInFlow ? `
      <div class="card" style="margin-bottom:12px;background:var(--accent-soft);">
        <p class="helper" style="margin:0;font-weight:700;">Monthly update — step 2 of 2</p>
        <p class="helper" style="margin:4px 0 0;">Log current debt balances to complete your monthly check-in.</p>
      </div>
    ` : ""}

    <!-- Add new entry form -->
    <div class="card" style="margin-bottom:12px;">
      <div class="section-title" style="margin-bottom:10px;">Add Balance Entry</div>
      <div class="input-group" style="margin-bottom:8px;">
        <label>Debt</label>
        <select id="debtSelect">
          ${debts.length > 0
            ? debts.map(d => `<option value="${h(d.id)}">${h(d.name)}</option>`).join("")
            : `<option value="">No debts in catalog</option>`}
          <option value="custom">Other / Custom</option>
        </select>
      </div>
      <div class="input-group" id="debtCustomGroup" style="display:none;margin-bottom:8px;">
        <label>Debt name</label>
        <input id="debtCustomName" type="text" placeholder="e.g. Store card">
      </div>
      <div class="input-group" style="margin-bottom:8px;">
        <label>Current balance</label>
        <input id="debtAmount" type="number" placeholder="0" min="0" step="1">
      </div>
      <div class="input-group" style="margin-bottom:12px;">
        <label>As of date</label>
        <input id="debtDate" type="date" value="${todayISO()}">
      </div>
      <button class="button primary" type="button" onclick="saveDebtBalance()">Save Entry</button>

      ${debts.length === 0 ? `
        <p class="helper" style="margin-top:10px;">No debts in your catalog yet.
          <button class="button secondary" style="font-size:11px;padding:4px 10px;margin-left:6px;"
                  type="button" onclick="goMyDebts(null)">Add Debts</button>
        </p>
      ` : ""}
    </div>

    ${entries.length > 0 ? `
      <div class="section-title" style="margin:16px 0 8px;">Balance History</div>
      ${[...entries].reverse().map(e => `
        <div class="item-card" style="margin-bottom:8px;">
          <div>
            <div class="task-title" style="font-size:13px;">${h(e.account)}</div>
            <p class="task-desc">${budgetFmt(e.amount)} · ${h(e.date)}</p>
          </div>
          <button class="button secondary" style="font-size:11px;padding:4px 10px;"
                  type="button" onclick="removeDebtBalance('${h(e.id)}')">Remove</button>
        </div>
      `).join("")}
    ` : ""}

    ${isInFlow ? `
      <div style="margin-top:20px;">
        <button class="button primary full" type="button" onclick="completeMonthlyUpdate()">
          Complete Monthly Update
        </button>
        <button class="button secondary full" style="margin-top:8px;" type="button"
                onclick="skipMonthlyUpdate()">Skip for now</button>
      </div>
    ` : ""}
  `;
}

function saveDebtBalance() {
  const selEl    = document.getElementById("debtSelect");
  const customEl = document.getElementById("debtCustomName");
  const amtEl    = document.getElementById("debtAmount");
  const dateEl   = document.getElementById("debtDate");

  let account = "Debt";
  if (selEl) {
    if (selEl.value === "custom" && customEl && customEl.value.trim()) {
      account = customEl.value.trim();
    } else if (selEl.value && selEl.value !== "custom") {
      const debt = (state.budget.debts || []).find(d => d.id === selEl.value);
      account = debt ? debt.name : selEl.value;
    }
  }

  const amount = amtEl ? parseFloat(amtEl.value) || 0 : 0;
  const date   = dateEl && dateEl.value ? dateEl.value : todayISO();

  if (amount <= 0) return;

  state.accountBalances = state.accountBalances || [];
  state.accountBalances.push({ id: generateId("db"), account, amount, date, type: "debt" });
  render();
}

function removeDebtBalance(id) {
  state.accountBalances = (state.accountBalances || []).filter(e => e.id !== id);
  render();
}

function completeMonthlyUpdate() {
  checkMonthlyUpdateGap();
}

function skipMonthlyUpdate() {
  const origin = state.flowOrigin || "aboutMe";
  state.flowOrigin = null;
  go(origin);
}

function checkMonthlyUpdateGap() {
  const acctEntries = (state.accountBalances || []).filter(function(e) { return e.type === "account"; });
  const debtEntries = (state.accountBalances || []).filter(function(e) { return e.type === "debt"; });
  if (acctEntries.length === 0 && debtEntries.length === 0) {
    skipMonthlyUpdate();
    return;
  }

  // Compare actual monthly spend (from 3-month balance trend) against plan total.
  // Both are monthly figures — comparable units. Budget signal uses the same logic.
  const actualMonthlySpend = catTotal(state.mtd);   // 2b: month-to-date across the 12
  const planMonthlySpend   = catTotal(state.plan);

  const gap = planMonthlySpend > 0
    ? Math.abs((actualMonthlySpend - planMonthlySpend) / planMonthlySpend)
    : 0;

  const totalAcct = acctEntries.reduce(function(s, e) { return s + e.amount; }, 0);
  const totalDebt = debtEntries.reduce(function(s, e) { return s + e.amount; }, 0);

  if (gap > 0.10 && planMonthlySpend > 0) {
    state.monthlyUpdateGap = {
      actualMonthlySpend,
      planMonthlySpend,
      gapPct:    Math.round(gap * 100),
      direction: actualMonthlySpend > planMonthlySpend ? "over" : "under",
      loggedAcct: totalAcct,
      loggedDebt: totalDebt
    };
  } else {
    state.monthlyUpdateGap = null;
  }

  if (!state.flowOrigin) state.flowOrigin = "aboutMe";
  state.postResultContext = "monthlyUpdate";
  go("postResult");
}
