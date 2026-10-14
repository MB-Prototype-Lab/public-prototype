// ─── Big Purchase — shared controls ──────────────────────────────────────────
// No screen of its own. The choice tiles, the financing rows and the plan
// handlers that Your car (screens/bp-yourcar.js), the finder, the in-frame
// sheets and lease mode (js/bp-lease.js) all call. Handlers write the session
// through bpSession() and re-render.

// ── Choice tiles ─────────────────────────────────────────────────────────────

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

/**
 * How one question's choices are laid out.
 *
 * NEVER a wrapping cluster. A centred flex-wrap gave "2 + 2 + 1" with three
 * different left edges and a last row floating under a gap — not a pattern
 * anybody would ship. Every layout here is a full-width grid with equal cells,
 * so the edges line up whatever the option count:
 *
 *   2 short       → two across        4 short → two by two
 *   3 short       → three across      anything else, or options carrying
 *                                     example text → one per line
 *
 * "Short" is measured, not guessed: a long label in a narrow cell wraps, and a
 * wrapped label is the same raggedness by another route.
 */
const BP_DOCK_SHORT = 11;

function bpDockLayout(opts, hasExamples) {
  if (hasExamples) return "bp-tiles-list";   // label over its example brands
  const short = opts.every(o => String(o.label).length <= BP_DOCK_SHORT);
  if (opts.length === 2) return "bp-tiles-2";
  if (short && opts.length === 3) return "bp-tiles-3";
  if (short && opts.length === 4) return "bp-tiles-2";
  return "bp-tiles-col";
}

/**
 * D19 — no screen renders empty. Your car reached by the admin jump, with
 * nothing answered, opens on the spec's own example car rather than on
 * "undefined · $0".
 */
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

/**
 * The price, adjusted at the end. It applies to the card in hand — and if that
 * is an alternative, the alternatives are re-derived from the pick, so the
 * figure edited here is the pick's price either way.
 */
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

/**
 * One financing setting. The value sits in a pill with a caret so the row reads
 * as something you can change — as a plain right-aligned figure it read as a
 * statement of fact and nobody tapped it (owner, 2026-09-27).
 */
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

/**
 * Commit (§10). Saves the session, creates at most ONE goal, and stores the
 * reminder. A new commit replaces the old goal rather than adding a second —
 * two savings goals for the same car is a tester wondering which is theirs.
 */
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
  // The goal names the car itself when it came from the finder (owner, 2026-10-03):
  // "Save for the BMW X3 (new)", not "a used Premium SUV".
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
    stack5: bpStack(card, 5),
    // No 3-year stack: the secondary horizon was dropped (owner, 2026-09-26).
    toSave: afford.toSave,
    purchaseDate: date,
    goalId: goalId,
    remindBudget: !!s.plan.remind,
    budgetFigure: leasing ? bpLeaseFigures(card).payment : bpBudgetFigure(card),
    taskDue: (!goalId && s.plan.remind) ? date : null,   // §8: no goal → a task on the purchase date
    reminderClosed: false,
    savedAt: todayISO()
  };

  bpLog(goalId ? "bp_goal_set" : "bp_plan_saved", {
    target: afford.toSave, date: date, remindBudget: !!s.plan.remind, card: card.id, payMode: s.pay.mode
  });

  if (opts && opts.thenEsf && typeof esfStart === "function") {
    state.nav.stacks.goals = ["goals"];
    state.nav.activeStack = "goals";
    esfStart();
    return;
  }
  navGoTabRoot("goals");
}
