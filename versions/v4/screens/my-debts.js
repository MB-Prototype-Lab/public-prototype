// --- My Debts ----------------------------------------------------------------
// TAB: Analysis (sub-screen) | NAV BAR: Visible -- Analysis tab highlighted
//
// -- V2 SCREEN, PARKED OFF THE MAIN PATH (L14) --------------------------------
// v3 never specified this screen, and nothing in the five tabs or the daily
// tasks routes to it. It stays because the decision was "keep the v2 screens,
// keep them reachable, do not widen the tester's surface" -- so its only door is
// the admin jump list.
//
// The header below says "Analysis tab", which is v2's nav. v3 has five tabs and
// Analysis is not one of them (L5/D34). Read that line as v2 history, not as a
// description of where this sits today.
//
// Before building on this: it renders v2 state (state.budget.debts), not any of
// the v3 data files, and it has no part in the plan / self-reported / peer model
// that the rest of v3 is arranged around (architecture section 5).
//
// PURPOSE
// All cashflow debt instruments in one place — view, add, edit, and remove
// individual debts. Excludes mortgage (that lives in the Housing budget category).
//
// NAVIGATION
//   Entry: "Your Debt" card on the Analysis budget dashboard
//   Exit:  ← Analysis back button; "Open Debt Analyzer" button → debt-analyzer
//
// STATES
//   Empty: prompt to add first debt instrument
//   Populated: list of debt cards with balance, APR, min payment, edit controls
//
// PRODUCTION NOTES
//   Debt data lives in state.budget.debts[]. Each debt has: id, name, balance,
//   apr, minPayment, type. Edits are inline — no separate edit screen.
//   The Debt Analyzer reads from the same debts array; changes here reflect
//   immediately in any open Debt Analyzer session.

// ─── Handlers ─────────────────────────────────────────────────────────────────

function addDebt() {
  state.selectedDebt = "new";
  render();
}

function addSampleDebt(type) {
  const templates = {
    creditCard:   { type:"creditCard",   name:"Sample Card",   balance:2500,  apr:19.99, minPayment:55,  remainingMonths:0,  payoffBehavior:"sometimes", repaymentType:"standard", pslfPaymentsMade:0, contactName:"", customSubtype:"", revolving:true,  expanded:false },
    studentLoan:  { type:"studentLoan",  name:"Student Loan",  balance:15000, apr:4.5,   minPayment:160, remainingMonths:96, repaymentType:"standard",   pslfPaymentsMade:0, contactName:"", customSubtype:"", revolving:false, expanded:false },
    personalLoan: { type:"personalLoan", name:"Personal Loan", balance:5000,  apr:11.5,  minPayment:120, remainingMonths:48, repaymentType:"standard",   pslfPaymentsMade:0, contactName:"", customSubtype:"", revolving:false, expanded:false }
  };
  state.budget.debts.push(Object.assign({ id: generateId("d") }, templates[type]));
  render();
}

function clearAllDebts() {
  state.budget.debts = [];
  render();
}

const DEBT_TYPE_META = {
  creditCard:   { label: "Credit Card",         icon: "💳" },
  storeCard:    { label: "Store Card",           icon: "🏪" },
  personalLoan: { label: "Personal Loan",        icon: "🏦" },
  medicalDebt:  { label: "Medical Debt",         icon: "🏥" },
  autoLoan:     { label: "Auto Loan",            icon: "🚗" },
  studentLoan:  { label: "Student Loan",         icon: "🎓" },
  informal:     { label: "Informal / Personal",  icon: "🤝" },
  custom:       { label: "Custom",                icon: "⚙️" }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function debtMonthlyInterest(debt) {
  return Math.round(debt.balance * (debt.apr / 100 / 12));
}

function debtAvgApr() {
  const debts = state.budget.debts;
  if (!debts.length) return 0;
  const totalBal = debtTotalBalance();
  if (!totalBal) return 0;
  // Weighted average APR by balance
  const weighted = debts.reduce((s, d) => s + d.apr * d.balance, 0);
  return (weighted / totalBal).toFixed(1);
}

function debtTotalMonthlyInterest() {
  return state.budget.debts.reduce((s, d) => s + debtMonthlyInterest(d), 0);
}

function debtSignal(debt) {
  const meta = DEBT_TYPE_META[debt.type];
  if (debt.apr >= 20) return { label: "High APR", css: "worth-a-look strong" };
  if (debt.type === "studentLoan" && debt.repaymentType === "pslf" && debt.pslfPaymentsMade > 0) {
    return { label: "PSLF track", css: "on-track" };
  }
  if (debt.apr === 0) return { label: "0% APR", css: "on-track" };
  return { label: meta ? meta.label : "Debt", css: "context-only" };
}

function debtEffectivePayment(debt) {
  return debt.minPayment || 0;
}

// ─── CRUD helpers (called from inline onclick) ────────────────────────────────
function toggleDebtExpanded(id) {
  const debt = state.budget.debts.find(d => d.id === id);
  if (debt) { debt.expanded = !debt.expanded; render(); }
}

function removeDebt(id) {
  state.budget.debts = state.budget.debts.filter(d => d.id !== id);
  // Sync fixed overhead minimum line
  const minLine = state.budget.fixedOverhead.find(f => f.name === "Debt Minimum Payments");
  if (minLine) minLine.amount = debtTotalMinPayment();
  render();
}

function editDebt(id) {
  state.selectedDebt = id;
  render();
}

function cancelDebtEdit() {
  state.selectedDebt = null;
  render();
}

function saveDebt() {
  const typeEl   = document.getElementById("debtFormType");
  const nameEl   = document.getElementById("debtFormName");
  if (!typeEl || !nameEl) {
    const errEl = document.getElementById("debtFormError");
    if (errEl) errEl.style.display = "block";
    return;
  }

  const type = typeEl.value;
  const getVal = id => { const el = document.getElementById(id); return el ? el.value : ""; };
  const getNum = id => { const el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : 0; };

  const isRevolving = ["creditCard","storeCard"].includes(type)
    || (type === "custom" && getVal("debtFormCustomSubtype") === "Home Equity Line (HELOC)");

  const instrument = {
    id:               state.selectedDebt && state.selectedDebt !== "new"
                        ? state.selectedDebt
                        : generateId("d"),
    type:             type,
    name:             getVal("debtFormName") || "Unnamed Debt",
    balance:          getNum("debtFormBalance"),
    apr:              getNum("debtFormApr"),
    minPayment:       getNum("debtFormMinPayment"),
    remainingMonths:  getNum("debtFormRemainingMonths"),
    payoffBehavior:   getVal("debtFormPayoffBehavior") || "sometimes",
    repaymentType:    getVal("debtFormRepaymentType") || "standard",
    pslfPaymentsMade: getNum("debtFormPslfPayments"),
    contactName:      getVal("debtFormContactName"),
    customSubtype:    getVal("debtFormCustomSubtype"),
    revolving:        isRevolving,
    expanded:         false
  };

  const idx = state.budget.debts.findIndex(d => d.id === instrument.id);
  if (idx >= 0) {
    state.budget.debts[idx] = instrument;
  } else {
    state.budget.debts.push(instrument);
  }
  // Sync fixed overhead minimum line
  const minLine = state.budget.fixedOverhead.find(f => f.name === "Debt Minimum Payments");
  if (minLine) minLine.amount = debtTotalMinPayment();
  state.selectedDebt = null;
  render();
}

// ─── Field group visibility ───────────────────────────────────────────────────
// Called by the type dropdown to show/hide groups and reset all values.
function debtFormTypeChanged() {
  const type = document.getElementById("debtFormType")?.value;
  if (!type) return;

  // Reset all editable fields on type change
  ["debtFormName","debtFormBalance","debtFormApr","debtFormMinPayment","debtFormRemainingMonths"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.type === "text" ? "" : "0";
  });
  const pbHidden = document.getElementById("debtFormPayoffBehavior");
  if (pbHidden) pbHidden.value = "sometimes";
  document.querySelectorAll(".payoff-behavior-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.val === "sometimes");
  });

  const showPayoffGroup  = ["creditCard","storeCard"].includes(type);
  const showMonths       = ["personalLoan","autoLoan","studentLoan"].includes(type);
  const showStudentExtra = type === "studentLoan";
  const showPslfExtra    = showStudentExtra
    && document.getElementById("debtFormRepaymentType")?.value === "pslf";
  const showInformalExtra= type === "informal";
  const showCustomExtra  = type === "custom";

  const setDisplay = (id, show) => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? "" : "none";
  };
  setDisplay("debtFieldGroupPayoff",   showPayoffGroup);
  setDisplay("debtFieldGroupMonths",   showMonths);
  setDisplay("debtFieldGroupStudent",  showStudentExtra);
  setDisplay("debtFieldGroupPslf",     showPslfExtra);
  setDisplay("debtFieldGroupInformal", showInformalExtra);
  setDisplay("debtFieldGroupCustom",   showCustomExtra);
}

function debtFormSetPayoff(val) {
  const el = document.getElementById("debtFormPayoffBehavior");
  if (el) el.value = val;
  document.querySelectorAll(".payoff-behavior-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.val === val);
  });
}

// ─── Form renderer ────────────────────────────────────────────────────────────
function renderDebtForm(existing) {
  const d     = existing || {};
  const type  = d.type || "creditCard";
  const isNew = !existing;
  const pb    = d.payoffBehavior || "sometimes";

  const typeOptions = Object.entries(DEBT_TYPE_META).map(([key, meta]) =>
    `<option value="${key}" ${type === key ? "selected" : ""}>${meta.icon} ${h(meta.label)}</option>`
  ).join("");

  const repaymentOptions = [
    ["standard", "Standard"],
    ["idr",      "Income-Driven (IDR)"],
    ["pslf",     "PSLF Track"]
  ].map(([val, lbl]) =>
    `<option value="${val}" ${(d.repaymentType||"standard") === val ? "selected" : ""}>${lbl}</option>`
  ).join("");

  const customSubtypes = [
    "Buy Now Pay Later (BNPL)", "Home Equity Line (HELOC)", "Payday / Cash Advance Loan",
    "Tax Debt / IRS Payment Plan", "Business Debt", "Lawsuit / Legal Judgment", "Other"
  ];
  const customSubtypeOptions = customSubtypes.map(s =>
    `<option value="${s}" ${d.customSubtype === s ? "selected" : ""}>${s}</option>`
  ).join("");

  const showPayoff   = ["creditCard","storeCard"].includes(type);
  const showMonths   = ["personalLoan","autoLoan","studentLoan"].includes(type);
  const showStudent  = type === "studentLoan";
  const showPslf     = showStudent && d.repaymentType === "pslf";
  const showInformal = type === "informal";
  const showCustom   = type === "custom";

  const payoffBtn = (val, label) =>
    `<button type="button" class="payoff-behavior-btn${pb === val ? " active" : ""}"
             data-val="${val}" onclick="debtFormSetPayoff('${val}')"
             style="flex:1;padding:8px 4px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
       ${label}
     </button>`;

  return `
    <div class="card" style="margin-bottom:14px;border-color:var(--accent);border-width:2px;">
      <div class="section-title" style="margin-bottom:14px;">${isNew ? "Add Debt" : "Edit: " + h(d.name || "")}</div>

      <div class="input-group">
        <label>Type</label>
        <select id="debtFormType" onchange="debtFormTypeChanged()">
          ${typeOptions}
        </select>
      </div>

      <div class="input-group">
        <label>Name / Nickname</label>
        <input id="debtFormName" type="text" placeholder="e.g. Chase Sapphire, Car Loan" value="${h(d.name || "")}">
      </div>

      <!-- Credit/store card: payoff behavior -->
      <div id="debtFieldGroupPayoff" style="display:${showPayoff ? "" : "none"};">
        <div class="input-group">
          <label>How often do you pay the full balance?</label>
          <input type="hidden" id="debtFormPayoffBehavior" value="${pb}">
          <div style="display:flex;gap:6px;margin-top:4px;">
            ${payoffBtn("always","Always")}
            ${payoffBtn("sometimes","Sometimes")}
            ${payoffBtn("rarely","Rarely")}
          </div>
        </div>
      </div>

      <!-- Student loan: repayment type -->
      <div id="debtFieldGroupStudent" style="display:${showStudent ? "" : "none"};">
        <div class="input-group">
          <label>Repayment type</label>
          <select id="debtFormRepaymentType" onchange="debtFormTypeChanged()">
            ${repaymentOptions}
          </select>
        </div>
      </div>

      <!-- PSLF field -->
      <div id="debtFieldGroupPslf" style="display:${showPslf ? "" : "none"};">
        <div class="input-group">
          <label>Qualifying payments made (0–120)</label>
          <input id="debtFormPslfPayments" type="number" min="0" max="120"
                 value="${d.pslfPaymentsMade || 0}">
        </div>
      </div>

      <!-- Informal / Personal: contact -->
      <div id="debtFieldGroupInformal" style="display:${showInformal ? "" : "none"};">
        <div class="input-group">
          <label>Who (name or relationship)</label>
          <input id="debtFormContactName" type="text" placeholder="e.g. Mom, Friend"
                 value="${h(d.contactName || "")}">
        </div>
      </div>

      <!-- Custom: subtype -->
      <div id="debtFieldGroupCustom" style="display:${showCustom ? "" : "none"};">
        <div class="input-group">
          <label>Subtype</label>
          <select id="debtFormCustomSubtype">${customSubtypeOptions}</select>
        </div>
      </div>

      <div class="input-group">
        <label>Current balance ($)</label>
        <input id="debtFormBalance" type="number" min="0" value="${d.balance || 0}">
      </div>

      <div class="input-group">
        <label>Minimum monthly payment ($)</label>
        <input id="debtFormMinPayment" type="number" min="0" value="${d.minPayment || 0}">
      </div>

      <div class="input-group">
        <label>APR (%)</label>
        <input id="debtFormApr" type="number" min="0" step="0.01" value="${d.apr || 0}">
      </div>

      <!-- Loan types: months remaining -->
      <div id="debtFieldGroupMonths" style="display:${showMonths ? "" : "none"};">
        <div class="input-group">
          <label>Months remaining</label>
          <input id="debtFormRemainingMonths" type="number" min="0" value="${d.remainingMonths || 0}">
        </div>
      </div>

      <div id="debtFormError" class="caption" style="color:var(--danger);display:none;margin-top:10px;">
        Please fill in the debt type and name before saving.
      </div>

      <div class="row" style="margin-top:10px;gap:8px;">
        <button class="button secondary" style="flex:1;" type="button" onclick="cancelDebtEdit()">Cancel</button>
        <button class="button full" style="flex:2;" type="button" onclick="saveDebt()">Save</button>
      </div>
    </div>
  `;
}

// ─── Debt card renderer (collapsed + expanded) ────────────────────────────────
function renderDebtCard(debt) {
  const meta    = DEBT_TYPE_META[debt.type] || { label: "Debt", icon: "💰" };
  const signal  = debtSignal(debt);
  const payment = debtEffectivePayment(debt);
  const interest = debtMonthlyInterest(debt);

  const collapsedRow = `
    <div style="display:flex;align-items:center;gap:10px;cursor:pointer;"
         onclick="toggleDebtExpanded('${debt.id}')">
      <span style="font-size:20px;flex-shrink:0;">${meta.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${h(debt.name)}
        </div>
        <div class="helper" style="margin-top:1px;">
          ${h(meta.label)} · ${debt.apr}% APR · ${budgetFmt(payment)}/mo
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:15px;font-weight:850;">${budgetFmt(debt.balance)}</div>
        <span class="debt-card-chevron${debt.expanded ? " open" : ""}">▾</span>
      </div>
    </div>
    <div style="margin-top:8px;">
      <span class="budget-signal-pill ${signal.css}">${h(signal.label)}</span>
    </div>
  `;

  if (!debt.expanded) {
    return `<div class="item-card" style="margin-bottom:10px;">${collapsedRow}</div>`;
  }

  // Expanded: show all relevant fields
  const fieldRow = (label, value) =>
    `<div class="row" style="padding:4px 0;border-bottom:1px solid var(--line);">
       <span class="helper">${label}</span>
       <span style="font-size:13px;font-weight:850;">${value}</span>
     </div>`;

  let extraFields = "";
  if ((debt.type === "creditCard" || debt.type === "storeCard") && debt.payoffBehavior) {
    const pbLabels = { always: "Always pays in full", sometimes: "Sometimes pays in full", rarely: "Rarely pays in full" };
    extraFields += fieldRow("Payoff behavior", pbLabels[debt.payoffBehavior] || debt.payoffBehavior);
  }
  if (debt.remainingMonths > 0)
    extraFields += fieldRow("Months Remaining", debt.remainingMonths);
  if (debt.type === "studentLoan") {
    const repayLabels = { standard: "Standard", idr: "Income-Driven (IDR)", pslf: "PSLF Track" };
    extraFields += fieldRow("Repayment Type", repayLabels[debt.repaymentType] || "Standard");
    if (debt.repaymentType === "pslf")
      extraFields += fieldRow("PSLF Payments Made", debt.pslfPaymentsMade + " / 120");
  }
  if (debt.type === "informal" && debt.contactName)
    extraFields += fieldRow("Contact", h(debt.contactName));
  if (debt.type === "custom" && debt.customSubtype)
    extraFields += fieldRow("Subtype", h(debt.customSubtype));

  const expandedSection = `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
      ${fieldRow("Balance", budgetFmt(debt.balance))}
      ${fieldRow("APR", debt.apr + "%")}
      ${fieldRow("Min Payment/mo", budgetFmt(payment))}
      ${fieldRow("Est. Interest/mo", budgetFmt(interest))}
      ${extraFields}
      <div class="row" style="margin-top:12px;gap:8px;padding-top:0;border-bottom:none;">
        <button class="button secondary" style="flex:1;font-size:12px;" type="button"
                onclick="editDebt('${debt.id}')">Edit</button>
        <button class="button secondary" style="flex:1;font-size:12px;color:var(--danger);border-color:var(--danger);"
                type="button" onclick="removeDebt('${debt.id}')">Remove</button>
      </div>
    </div>
  `;

  return `
    <div class="item-card" style="margin-bottom:10px;">
      ${collapsedRow}
      ${expandedSection}
    </div>
  `;
}

// ─── Screen renderer ──────────────────────────────────────────────────────────
function renderMyDebts() {
  const debts   = state.budget.debts || [];
  const isAdding = state.selectedDebt === "new";
  const editingDebt = state.selectedDebt && state.selectedDebt !== "new"
    ? debts.find(d => d.id === state.selectedDebt)
    : null;
  const showForm = isAdding || !!editingDebt;

  const totalBal  = debtTotalBalance();
  const totalMin  = debtTotalMinPayment();
  const avgApr    = debtAvgApr();
  const totalInt  = debtTotalMonthlyInterest();

  return `
    <!-- Header -->
    <div class="card" style="margin-bottom:14px;">
<div class="row" style="align-items:flex-start;">
        <div>
          <h1 class="title" style="margin:0;font-size:20px;">My Debts</h1>
          <p class="subtitle" style="margin:4px 0 0;">
            ${debts.length} account${debts.length !== 1 ? "s" : ""}
            ${totalBal > 0 ? " · " + budgetFmt(totalBal) + " total" : ""}
          </p>
        </div>
        ${debts.length > 0 ? `
          <button class="button" style="font-size:12px;padding:10px 14px;" type="button"
                  onclick="goDebtAnalyzer()">📊 Analyzer</button>
        ` : ""}
      </div>
    </div>

    ${debts.length > 0 ? `
      <!-- Summary metrics -->
      <div class="card" style="margin-bottom:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div class="helper">Total balance</div>
            <div style="font-size:18px;font-weight:850;">${budgetFmt(totalBal)}</div>
          </div>
          <div>
            <div class="helper">Avg APR</div>
            <div style="font-size:18px;font-weight:850;">${avgApr}%</div>
          </div>
          <div>
            <div class="helper">Total min/mo</div>
            <div style="font-size:18px;font-weight:850;">${budgetFmt(totalMin)}</div>
          </div>
          <div>
            <div class="helper">Est. interest/mo</div>
            <div style="font-size:18px;font-weight:850;">${budgetFmt(totalInt)}</div>
          </div>
        </div>
      </div>
    ` : ""}

    <!-- Add / Edit form (shown inline when editing or adding) -->
    ${showForm ? renderDebtForm(editingDebt || null) : ""}

    <!-- Debt instrument cards -->
    ${debts.length > 0
      ? debts.map(d => renderDebtCard(d)).join("")
      : (!showForm ? `
          <div class="card" style="text-align:center;padding:32px 16px;">
            <div style="font-size:32px;margin-bottom:12px;">💳</div>
            <p style="font-size:14px;font-weight:850;margin:0 0 6px;">No debts added yet</p>
            <p class="helper" style="margin:0 0 16px;">
              Add credit cards, loans, and other cashflow debt.<br>
              Mortgages are tracked separately in Housing.
            </p>
            <button class="button full" type="button" onclick="addDebt()">
              + Add Your First Debt
            </button>
          </div>
        ` : "")
    }

    <!-- Add Debt button (shown when debts exist and form is not open) -->
    ${debts.length > 0 && !showForm ? `
      <button class="button secondary full" style="margin-bottom:8px;" type="button"
              onclick="addDebt()">+ Add Debt</button>
    ` : ""}

    ${debts.length > 0 ? `
      <div class="flow-footer" style="margin-top:4px;">
        <button class="button full" type="button" onclick="goDebtAnalyzer()">
          📊 Open Debt Analyzer →
        </button>
      </div>
    ` : ""}
  `;
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function renderMyDebtsAdmin() {
  const debts = state.budget.debts;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Debt Instruments</p>
      <p class="helper" style="margin-bottom:10px;">
        ${debts.length} account${debts.length !== 1 ? "s" : ""}
        · total ${budgetFmt(debtTotalBalance())}
        · min/mo ${budgetFmt(debtTotalMinPayment())}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <button class="button secondary" style="font-size:11px;" type="button"
                onclick="addSampleDebt('creditCard')">+ Credit Card</button>
        <button class="button secondary" style="font-size:11px;" type="button"
                onclick="addSampleDebt('studentLoan')">+ Student Loan</button>
        <button class="button secondary" style="font-size:11px;" type="button"
                onclick="addSampleDebt('personalLoan')">+ Personal Loan</button>
      </div>
      ${debts.length ? `
        <button class="button secondary" style="font-size:11px;color:var(--danger);border-color:var(--danger);"
                type="button" onclick="clearAllDebts()">Clear All Debts</button>
      ` : ""}
    </div>

    ${debts.length ? `
      <div class="admin-card">
        <p class="admin-card-title">Balances</p>
        ${debts.map((d, i) => `
          <div class="input-group">
            <label>${DEBT_TYPE_META[d.type]?.icon || "💰"} ${h(d.name)} — balance ($)</label>
            <input type="number" min="0" value="${d.balance}"
                   oninput="state.budget.debts[${i}].balance=parseFloat(this.value)||0;debouncedRender()">
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
}
