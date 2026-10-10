// ─── Big Purchase — Screen 3: Plan for it ────────────────────────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
// Spec §8 and §10. The selected card from screen 2 becomes a savings goal and,
// if the box is ticked, a budget reminder. ONE date does two jobs: the goal's
// target date and the planned purchase date.
//
// "You picked…" confirms the choice and never grades it. No "great choice".

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

// ── Handlers ─────────────────────────────────────────────────────────────────

function bpSetSaved(raw) {
  const n = Math.max(0, Math.round(Number(String(raw || "").replace(/[^0-9.]/g, "")) || 0));
  bpSession().plan.saved = n;
  bpFieldCommitted();
}

function bpShiftMonths(delta) {
  const p = bpSession().plan;
  p.monthsOut = Math.max(1, Math.min(60, (Number(p.monthsOut) || 12) + delta));
  render();
}

function bpToggleRemind() {
  const p = bpSession().plan;
  p.remind = !p.remind;
  render();
}

/**
 * "Things to keep in mind" — the three largest non-price rows of the chosen
 * stack, each stated as a fact. Ranked by what they add up to over 5 years so
 * a monthly bill and a one-off tax bill compare on the same footing.
 */
function bpKeepInMind(card) {
  const st = bpStack(card);
  const cat = bpCategory();
  // No value-lost item: resale and depreciation are out of this tool entirely
  // (owner, 2026-09-26), and a "keep in mind" built on a figure that appears
  // nowhere else would be the only place it surfaced.
  const items = [];
  if (st.interest > 0) items.push({ text: "Loan interest: " + bpMoney(st.interest) + " over 5 years", size: st.interest });
  st.lines.forEach(l => {
    const row = bpRowDef(l.id);
    if (!row || !l.value) return;
    const label = row.labelFor ? row.labelFor(card.inputs) : row.label;
    if (l.bucket === "monthly") items.push({ text: label + ": " + bpBandLabel(l.value) + " a month", size: l.value * 60 });
    else if (l.bucket === "yearly") items.push({ text: label + ": " + bpBandLabel(l.value) + " a year", size: l.value * 4 });
    else items.push({ text: label + ": " + bpBandLabel(l.value) + " when you buy", size: l.value });
  });
  return items.sort((a, b) => b.size - a.size).slice(0, 3).map(i => i.text);
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

// ── Render ───────────────────────────────────────────────────────────────────

function renderBpCommit() {
  const s = bpSession();
  bpEnsureSetup();
  const card = bpSelectedCard();
  const a = bpSaveToAfford(card);
  const st = a.stack;
  const loan = st.mode === "loan";
  const cat = bpCategory();
  const none = a.toSave === 0;

  const headline = `
    <div class="bp-headline">
      <strong class="bp-hl-big bp-hl-center">${h(bpMoney(a.toSave))}</strong>
      <span class="bp-hl-cap">${none ? "your savings already cover it"
        : (loan ? "still to save for the down payment" : "still to save to buy it")}</span>
    </div>`;

  // ONE line, not two saying the same thing: bpCardNoun() already carries the
  // condition and the noun, so repeating them beside the price read as a stutter
  // ("the new Premium SUV · New Premium SUV · $75,000").
  const inputs = card.inputs;
  const choiceLine = "You picked " + bpCardNoun(card) + " · " + bpMoney(inputs.price) +
                     " · " + bpVFuelLabel(inputs.fuel);

  // ONE SCREEN, NO SCROLLING (owner, 2026-09-27). The choice card became a
  // single line — its three lines repeated screen 4 — and "things to keep in
  // mind" dropped to the two largest. Everything a tester still has to DO here
  // (the saved figure, the date, the reminder) is untouched.
  return `
    <div class="journal-shell onb-pinned bp-plan-shell">
      <div class="journal-head bp-head bp-head-tight">${renderBpStepHead(4, "Plan for it", headline)}</div>
      <div class="journal-body">
        ${none ? "" : `
          <p class="bp-planline">${h(choiceLine)}</p>
          <ul class="bp-keep">${bpKeepInMind(card).slice(0, 2).map(t => `<li>${h(t)}</li>`).join("")}</ul>

          <div class="bp-math">
            <div class="bp-math-row"><span>${loan ? "Down payment" : "Price, tax and fees"}</span>
              <strong>${h(bpMoney(loan ? st.down : st.price + st.upfront - a.extras))}</strong></div>
            ${a.extras ? `<div class="bp-math-row"><span>+ Paid on the day</span><strong>${h(bpMoney(a.extras))}</strong></div>` : ""}
            <div class="bp-math-row"><label for="bpSaved">− Already saved</label>
              <input id="bpSaved" class="esf-amount bp-row-input" type="text" inputmode="numeric" placeholder="$0"
                     value="${a.saved ? h(bpMoney(a.saved)) : ""}" aria-label="Already saved, dollars"
                     onchange="bpSetSaved(this.value)"></div>
            ${loan ? "" : `<div class="bp-math-row"><span>− Trade-in</span><strong>${h(bpMoney(a.tradeIn))}</strong></div>`}
            <div class="bp-math-row bp-math-total"><span>= Still to save</span><strong>${h(bpMoney(a.toSave))}</strong></div>
          </div>
        `}

        <div class="bp-q">
          <p class="bp-q-label">${none ? "When do you plan to buy?"
            : "To save " + h(bpMoney(a.toSave)) + " for the " + (loan ? "down payment" : "purchase") + ", by when?"}</p>
          <div class="bp-date">
            <button class="bp-step" type="button" aria-label="A month earlier" onclick="bpShiftMonths(-1)">&lsaquo;</button>
            <strong class="bp-date-val">${h(bpPlanDateLabel(s.plan.monthsOut))}</strong>
            <button class="bp-step" type="button" aria-label="A month later" onclick="bpShiftMonths(1)">&rsaquo;</button>
            ${none ? "" : `<span class="bp-date-note">${h(bpMoney(a.monthly))} a month<br><small>to save</small></span>`}
          </div>
        </div>

        <button class="bp-check ${s.plan.remind ? "on" : ""}" type="button" role="checkbox"
                aria-checked="${s.plan.remind}" onclick="bpToggleRemind()">
          <span class="bp-box" aria-hidden="true">${s.plan.remind ? "&#10003;" : ""}</span>
          <span>${none ? "Remind me to budget for this when I buy it"
                       : "Remind me to budget for this when I reach my goal"}</span>
        </button>

        ${s.esfDeferred ? `
          <button class="button secondary full" type="button" style="margin-top:12px;"
                  onclick="bpCommit({thenEsf:true})">Start your emergency fund</button>` : ""}
      </div>
      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        ${renderBpBuddyButton()}
        <button class="button" type="button" onclick="bpCommit()">${none ? "Done" : "Set my goal"}</button>
      </div>
    </div>`;
}

function renderBpCommitAdmin() {
  bpEnsureSetup();
  const card = bpSelectedCard();
  const a = bpSaveToAfford(card);
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — save to afford</p>
      <p class="helper">Card <strong>${h(card.id)}</strong> · ${h(a.stack.mode)} · cash needed
        ${h(bpMoney(a.cashNeeded))} (extras ${h(bpMoney(a.extras))}) − saved ${h(bpMoney(a.saved))}
        − trade ${h(bpMoney(a.tradeIn))} → <strong>${h(bpMoney(a.toSave))}</strong> over ${a.months} months
        = ${h(bpMoney(a.monthly))}/mo</p>
      <p class="helper">Reminder figure ${h(bpMoney(bpBudgetFigure(card)))}/mo (${a.stack.mode === "loan" ? "the payment" : "running costs"}).</p>
      <p class="helper" style="font-size:10px;">Trade-in comes off only for cash: with a loan it already reduced the principal.</p>
    </div>
    ${renderBpAdminCommon()}`;
}
