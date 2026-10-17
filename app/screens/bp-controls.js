// Shared tiles, financing rows and plan handlers keep finder, Your car,
// sheets and lease mode on one session model.

/** A row of tiles. */
function bpTiles(opts, current, onPick, cls) {
  return `
    <div class="bp-tiles ${cls || ""}" role="group">
      ${opts.map(o => `
        <button class="bp-tile ${current === o.id ? "on" : ""}" type="button"
                aria-pressed="${current === o.id}" onclick="${onPick(o.id)}">
          <span class="bp-tile-label">${o.emoji ? `<i class="bp-emoji" aria-hidden="true">${o.emoji}</i>` : ""}${h(o.label)}</span>
          ${o.sub ? `<span class="bp-tile-sub">${h(o.sub)}</span>` : ""}
        </button>`).join("")}
    </div>`;
}

/* Use full-width equal-cell grids rather than a wrapping cluster so edges
 * stay aligned. Two choices use two columns; three or four short labels use
 * compact grids; longer labels and examples use one per line. */
const BP_DOCK_SHORT = 11;

function bpDockLayout(opts, hasExamples) {
  if (hasExamples) return "bp-tiles-list";   // label over its example brands
  const short = opts.every(o => String(o.label).length <= BP_DOCK_SHORT);
  if (opts.length === 2) return "bp-tiles-2";
  if (short && opts.length === 3) return "bp-tiles-3";
  if (short && opts.length === 4) return "bp-tiles-2";
  return "bp-tiles-col";
}

/* D19: incomplete setup uses a plausible example car instead of undefined
 * labels and zero figures. */
function bpEnsureSetup() {
  const s = bpSession();
  const cat = bpCategory();
  const rows = (cat ? cat.setupInputs : []).filter(r => !r.showIf || r.showIf(s.setup));
  if (rows.every(r => r.typed ? Number(s.setup[r.id]) > 0 : !!s.setup[r.id])) return;
  s.setup = { type: "suv", tier: "everyday", fuel: "gas", condition: "new", price: 35000 };
}

// ── Paying for it ────────────────────────────────────────────────────────────

function bpFinance(field, value) {
  const s = bpSession();
  const from = s.pay[field];
  s.pay[field] = value;
  bpLog("bp_finance_changed", { field: field, from: from, to: value });
  render();
}

function bpSetDownAmount(raw) {
  const s = bpSession();
  const n = Math.max(0, Math.round(Number(String(raw || "").replace(/[^0-9.]/g, "")) || 0));
  bpLog("bp_finance_changed", { field: "downAmount", from: s.pay.downAmount, to: n });
  s.pay.downAmount = n;
  bpFieldCommitted();
}

function bpSetCredit(tier) {
  const s = bpSession();
  const from = s.pay.typedRate != null ? "typed" : s.pay.credit;
  s.pay.credit = tier;
  s.pay.typedRate = null;
  s.ui.rateOpen = false;
  bpLog("bp_credit_changed", { from: from, to: tier, typed: false });
  render();
}

function bpSetTypedRate(raw) {
  const s = bpSession();
  const n = Number(String(raw || "").replace(/[^0-9.]/g, ""));
  const from = s.pay.typedRate != null ? s.pay.typedRate : s.pay.credit;
  s.pay.typedRate = isFinite(n) && String(raw || "").trim() !== "" ? Math.min(40, Math.max(0, n)) : null;
  bpLog("bp_credit_changed", { from: from, to: s.pay.typedRate, typed: true });
  bpFieldCommitted();
}

/* Price edits update the selected pick. Clear per-car row overrides when
 * it changes because those figures describe the previous price. */
function bpSetPrice(raw) {
  const s = bpSession();
  const n = Math.round(Number(String(raw || "").replace(/[^0-9.]/g, "")) || 0);
  if (!n) { bpFieldCommitted(); return; }
  const from = s.setup.price;
  if (n !== from) {
    s.setup.price = n;
    s.cardRows = {};                 // per-car figures described a different car
    bpLog("bp_summary_edit", { field: "price", from: from, to: n });
  }
  bpFieldCommitted();
}

/** Which financing choices are open in the sheet. */
function bpOpenFin(field) {
  const s = bpSession();
  s.ui.fin = field;
  s.ui.sheet = "fin";
  render();
}

function bpFinChoose(field, value) {
  const s = bpSession();
  s.ui.sheet = null;
  if (field === "down") { bpFinance("down", value); return; }
  if (field === "term") { bpFinance("term", value); return; }
  if (field === "credit") {
    if (value === "other") { s.ui.rateOpen = true; render(); return; }
    bpSetCredit(value);
  }
}

/* Use a pill and caret to signal that a financing figure is editable. */
function bpFinRow(field, label, value) {
  return `
    <button class="bp-setrow" type="button" onclick="bpOpenFin('${field}')">
      <span class="bp-setrow-label">${h(label)}</span>
      <span class="bp-setrow-pill">${h(value)} <span class="bp-drop-caret" aria-hidden="true">&#9662;</span></span>
    </button>`;
}

function bpSetPayMode(mode) {
  const s = bpSession();
  if (s.pay.mode === mode) return;
  s.pay.mode = mode;
  bpLog("bp_pay_mode", { mode: mode });
  render();
}

// ── Planning for it ──────────────────────────────────────────────────────────

const BP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bpPlanDate(monthsOut) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsOut);
  return d;
}

function bpPlanDateISO(monthsOut) {
  const d = bpPlanDate(monthsOut);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
}

function bpPlanDateLabel(monthsOut) {
  const d = bpPlanDate(monthsOut);
  return BP_MONTHS[d.getMonth()] + " " + d.getFullYear();
}

/** "the used Everyday SUV" */
function bpCardNoun(card) {
  const cat = bpCategory();
  return "the " + (card.inputs.condition === "used" ? "used " : "new ") + cat.noun(card.inputs);
}

function bpSetSaved(raw) {
  const n = Math.max(0, Math.round(Number(String(raw || "").replace(/[^0-9.]/g, "")) || 0));
  bpSession().plan.saved = n;
  bpFieldCommitted();
}

/* Replace the previous purchase goal when saving so there is at most one
 * savings goal for this plan. */
function bpCommit(opts) {
  const s = bpSession();
  const card = bpSelectedCard();
  const leasing = typeof bpLeasing === "function" && bpLeasing(card);
  const afford = leasing ? bpLeaseAfford(card) : bpSaveToAfford(card);
  if (opts && opts.noGoal) afford.toSave = 0;     // "No, I don't need to save": plan only, no goal
  const st = afford.stack;
  const cat = bpCategory();
  const date = bpPlanDateISO(s.plan.monthsOut);
  const noun = bpCardNoun(card);
  // Use the finder's exact make/model in goal labels when available.
  const fsel = typeof bpfSelected === "function" ? bpfSelected() : null;
  const goalLabel = fsel
    ? "Save for the " + bpfName(fsel.model) + " (" + (fsel.cond === "used" ? "used" : "new") + ")"
    : "Save for " + noun.replace(/^the /, "a ");

  // Replace any previous big-purchase goal.
  const prev = state.bigPurchase && state.bigPurchase.goalId;
  state.tacticalGoals = (state.tacticalGoals || []).filter(g => !(g.type === "purchaseSaving" || g.id === prev));

  let goalId = null;
  if (afford.toSave > 0) {
    const goal = {
      id: generateId("g"),
      type: "purchaseSaving",
      category: s.category,
      label: goalLabel,
      target: afford.toSave,
      current: 0,
      period: null,                         // no period → a savings goal (js/goals.js)
      targetDate: date,
      startedAt: todayISO()
    };
    state.tacticalGoals.push(goal);
    goalId = goal.id;
  }

  const rows = {};
  bpRowsFor(card).forEach(r => {
    rows[r.id] = {
      value: bpRowValue(card, r.id),
      touched: bpRowTouched(card, r.id) || !!s.touched["all:" + r.id],
      scope: r.scope
    };
  });

  state.bigPurchase = {
    category: s.category,
    setup: Object.assign({}, s.setup),
    card: card.id,
    cardInputs: Object.assign({}, card.inputs),
    noun: noun,
    describe: cat.describe(card.inputs),
    rows: rows,
    payMode: leasing ? "lease" : s.pay.mode,
    financing: Object.assign({}, s.pay),
    savingsRate: s.savingsRate,
    toSave: afford.toSave,
    purchaseDate: date,
    goalId: goalId,
    savedAt: todayISO()
  };

  bpLog(goalId ? "bp_goal_set" : "bp_plan_saved", {
    target: afford.toSave, date: date, card: card.id, payMode: s.pay.mode
  });

  navGoTabRoot("goals");
}
