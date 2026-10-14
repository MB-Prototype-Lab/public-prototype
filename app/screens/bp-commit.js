// ─── Big Purchase — Screen 3: Plan for it ────────────────────────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
// Spec §8 and §10. The selected card from screen 2 becomes a savings goal and,
// if the box is ticked, a budget reminder. ONE date does two jobs: the goal's
// target date and the planned purchase date.
//
// "You picked…" confirms the choice and never grades it. No "great choice".

// ── Handlers ─────────────────────────────────────────────────────────────────

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
