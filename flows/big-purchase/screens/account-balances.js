// ─── Account Balances ──────────────────────────────────────────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Visible — Budget tab highlighted
//
// PURPOSE
// Records point-in-time bank/cash account balance snapshots with date stamps.
// The trend over time is the output (visible in My Progress).
// Also serves as the first step of the Update This Month flow.
//
// NAVIGATION
//   Entry: Budget → Account Balances card; Budget Setup → Update This Month
//   Exit:  ← Budget (or → debtBalances if in monthly update flow)
//
// STATES
//   Shows existing balance entries as a timeline list.
//   Add form appears inline when adding a new entry.
//
// PRODUCTION NOTES
//   Accounts: Checking, Savings, Cash, Investment, Brokerage, or custom (typed in).
//   Monthly update flow: account balances → debt balances (2-step).
//   After completing both steps, net position is compared to budget estimate.
//   If gap > 10%, prompt to update the 2 Minute Budget sliders.

const ACCOUNT_TYPES = ["Checking", "Savings", "Cash", "Investment", "Brokerage", "Custom"];

function renderAccountBalances() {
  const entries  = state.accountBalances || [];
  const isInFlow = state.flowOrigin !== null && state.flowOrigin !== "aboutMe";

  return `
    <div class="card" style="margin-bottom:14px;">
<h1 class="title" style="margin:0;font-size:20px;">Account Balances</h1>
      <p class="subtitle" style="margin:4px 0 0;">What's sitting in your accounts today?</p>
    </div>

    ${isInFlow ? `
      <div class="card" style="margin-bottom:12px;background:var(--accent-soft);">
        <p class="helper" style="margin:0;font-weight:700;">Monthly update — step 1 of 2</p>
        <p class="helper" style="margin:4px 0 0;">Log current account balances, then we'll check your debt balances.</p>
      </div>
    ` : ""}

    <!-- Add new entry form -->
    <div class="card" style="margin-bottom:12px;">
      <div class="section-title" style="margin-bottom:10px;">Add Balance Entry</div>
      <div class="input-group" style="margin-bottom:8px;">
        <label>Account</label>
        <select id="acctType" onchange="onAcctTypeChange()">
          ${ACCOUNT_TYPES.map(t => `<option value="${h(t)}">${h(t)}</option>`).join("")}
        </select>
      </div>
      <div class="input-group" id="acctCustomGroup" style="display:none;margin-bottom:8px;">
        <label>Account name</label>
        <input id="acctCustomName" type="text" placeholder="e.g. High-yield savings">
      </div>
      <div class="input-group" style="margin-bottom:8px;">
        <label>Balance</label>
        <input id="acctAmount" type="number" placeholder="0" min="0" step="1">
      </div>
      <div class="input-group" style="margin-bottom:12px;">
        <label>As of date</label>
        <input id="acctDate" type="date" value="${todayISO()}">
      </div>
      <button class="button primary" type="button" onclick="saveAccountBalance()">Save Entry</button>
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
                  type="button" onclick="removeAccountBalance('${h(e.id)}')">Remove</button>
        </div>
      `).join("")}
    ` : ""}

    ${isInFlow ? `
      <div style="margin-top:20px;">
        <button class="button primary full" type="button" onclick="continueMonthlyUpdate()">
          Next: Debt Balances →
        </button>
        <button class="button secondary full" style="margin-top:8px;" type="button"
                onclick="skipToDebtBalances()">Skip to Debt Balances</button>
      </div>
    ` : ""}
  `;
}

function onAcctTypeChange() {
  const sel = document.getElementById("acctType");
  const cg  = document.getElementById("acctCustomGroup");
  if (cg) cg.style.display = sel && sel.value === "Custom" ? "" : "none";
}

function saveAccountBalance() {
  const typeEl   = document.getElementById("acctType");
  const customEl = document.getElementById("acctCustomName");
  const amtEl    = document.getElementById("acctAmount");
  const dateEl   = document.getElementById("acctDate");

  const account = typeEl && typeEl.value === "Custom" && customEl && customEl.value.trim()
    ? customEl.value.trim()
    : (typeEl ? typeEl.value : "Account");
  const amount = amtEl ? parseFloat(amtEl.value) || 0 : 0;
  const date   = dateEl && dateEl.value ? dateEl.value : todayISO();

  if (amount <= 0) return;

  state.accountBalances = state.accountBalances || [];
  state.accountBalances.push({ id: generateId("ab"), account, amount, date, type: "account" });
  render();
}

function removeAccountBalance(id) {
  state.accountBalances = (state.accountBalances || []).filter(e => e.id !== id);
  render();
}

function continueMonthlyUpdate() {
  go("debtBalances");
}

function skipToDebtBalances() {
  go("debtBalances");
}

