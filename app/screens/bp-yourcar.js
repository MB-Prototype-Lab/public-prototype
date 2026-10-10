// ─── Big Purchase — Your car: pay for it, plan for it (one screen) ────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// Owner, 2026-10-03: once a car is chosen, ONE screen replaces steps 1 to 4:
// the car's name at the top, a single "Change your mind?" button that opens the
// other options, "Paying for it" (just price, loan or cash, down payment, loan
// length, credit score, amount financed) and "Planning for it" (the down payment,
// what is already saved, what is still to save, by when, and the goal). A sentence
// at the top says what the screen is doing.
//
// Nothing here has its own arithmetic: the pieces are the old steps' own
// controls (bpFinance/bpFinChoose, bpSetSaved, bpShiftMonths, bpCommit) and
// their own figures (bpStack, bpBreakdown, bpSaveToAfford), so a figure here is
// the figure the steps would have printed.
//
// "Choose a different car" opens the same options the cost screen offered
// (bpfOrigin and renderBpfSave), and trying one changes the car, the price and
// every figure on this screen at once.

function bpYcOpenAlts() {
  bpOpenSheet("bpYcAlts");
}

/** Back to the full finder, for somebody who wants a different car altogether. */
function bpYcSearchAll() {
  bpSession().ui.sheet = null;
  const f = bpfSession();
  f.view = "start";
  go("bpFinder");
}

function renderBpYcAltsSheet() {
  const body = `
    <div class="bpf-shell bpf-ycwrap">
      ${renderBpfSave()}
      <button class="button secondary full bpf-yc-all" type="button" onclick="bpYcSearchAll()">Search all cars</button>
    </div>`;
  return renderBpSheetFrame("Choose a different car", body);
}

function bpYcLeaseRow(field, label, value) {
  return `
    <button class="bp-setrow" type="button" onclick="bpYcOpenOpt('${field}')">
      <span class="bp-setrow-label">${h(label)}</span>
      <span class="bp-setrow-pill">${h(value)} <span class="bp-drop-caret" aria-hidden="true">&#9662;</span></span>
    </button>`;
}

function renderBpYcPaying(card, st, b, loan) {
  const leasing = bpLeasing(card);
  const lf = leasing ? bpLeaseFigures(card) : null;
  const s = bpSession();
  const credit = bpData().credit || {};
  const typed = s.pay.typedRate != null;
  const downLabel = s.pay.down === "other" ? bpMoney(st.down)
                    : Math.round(Number(s.pay.down) * 100) + "% · " + bpMoney(st.down);
  const creditLabel = typed ? "Your rate · " + bpPct(s.pay.typedRate)
                            : ((credit.labels || {})[s.pay.credit] || s.pay.credit);
  return `
    <section class="bp-yc-sec">
      <h2 class="bp-yc-band">Paying for it</h2>
      <div class="bp-yc-card">
        <div class="bp-priceline">
          <label class="bp-setrow-label" for="bpFinPrice">Price</label>
          <input id="bpFinPrice" class="esf-amount bp-price-inline" type="text" inputmode="numeric"
                 value="${h(bpMoney(s.setup.price))}" aria-label="Price, dollars"
                 onchange="bpSetPrice(this.value)">
        </div>
        ${/* Loan, Cash or Lease (owner, 2026-10-03: leasing on this screen only).
              Lease is for a new car; for a used one it is shown but off. */ ""}
        <div class="bp-seg bp-seg3" role="group" aria-label="Loan, cash or lease">
          <button type="button" class="${!leasing && loan ? "on" : ""}" aria-pressed="${!leasing && loan}" onclick="bpYcSetMode('loan')">Loan</button>
          <button type="button" class="${!leasing && !loan ? "on" : ""}" aria-pressed="${!leasing && !loan}" onclick="bpYcSetMode('cash')">Cash</button>
          <button type="button" class="${leasing ? "on" : ""} ${bpLeaseAvailable(card) ? "" : "bp-seg-off"}" aria-pressed="${leasing}"
                  ${bpLeaseAvailable(card) ? "" : 'aria-disabled="true" title="Leasing is for new cars"'}
                  onclick="bpYcSetMode('lease')">Lease</button>
        </div>
        ${leasing ? `
          ${bpYcLeaseRow("leaseDue", "Due at signing", lf.due ? bpMoney(lf.due) : "$0")}
          ${bpYcLeaseRow("leaseTerm", "Lease length", lf.term + " months")}
          ${bpYcLeaseRow("leaseMiles", "Miles a year", lf.miles.toLocaleString("en-US"))}
          ${bpFinRow("credit", "Credit score", creditLabel)}
          ${typed || s.ui.rateOpen ? `
            <input class="esf-amount bp-inline-input" type="text" inputmode="decimal" placeholder="Your APR %"
                   value="${typed ? h(String(s.pay.typedRate)) : ""}"
                   aria-label="Your loan rate, percent" onchange="bpSetTypedRate(this.value)">` : ""}
          <div class="bp-fin-sum">
            <div class="bp-fin-sumrow"><span>Monthly lease payment</span>
              <strong>${h(bpMoney(lf.payment))}</strong></div>
          </div>
        ` : loan ? `
          ${bpFinRow("down", "Down payment", downLabel)}
          ${s.pay.down === "other" ? `
            <input class="esf-amount bp-inline-input" type="text" inputmode="numeric" placeholder="$0"
                   value="${s.pay.downAmount != null ? h(bpMoney(s.pay.downAmount)) : ""}"
                   aria-label="Down payment, dollars" onchange="bpSetDownAmount(this.value)">` : ""}
          ${bpFinRow("term", "Loan length", st.term + " months")}
          ${bpFinRow("credit", "Credit score", creditLabel)}
          ${typed || s.ui.rateOpen ? `
            <input class="esf-amount bp-inline-input" type="text" inputmode="decimal" placeholder="Your APR %"
                   value="${typed ? h(String(s.pay.typedRate)) : ""}"
                   aria-label="Your loan rate, percent" onchange="bpSetTypedRate(this.value)">` : ""}
          <div class="bp-fin-sum">
            <div class="bp-fin-sumrow"><span>Amount financed</span>
              <strong>${h(bpMoney(b.pay.loanAmount))}</strong></div>
          </div>
        ` : `<p class="bp-based">Paying cash: nothing borrowed, so no interest and no payment.</p>`}
      </div>
    </section>`;
}

/** "Do you need to save for the down payment?" Yes opens the sum; No leaves the goal out. */
function bpYcSetNeed(yes) {
  bpSession().plan.needSave = !!yes;
  render();
}

function bpYcNeeds() {
  return bpSession().plan.needSave !== false;
}

/**
 * Planning for it (owner, 2026-10-03). One question first: do you need to save for
 * the down payment? Yes opens the three lines (down payment, minus what is already
 * saved, equals what is needed, highlighted), then the month as a dropdown with the
 * monthly amount under it. No leaves the box shut and sets no goal. A lease reads
 * "due at signing" in place of "down payment". The same figures as before
 * (bpSaveToAfford / bpLeaseAfford); only the order and the controls changed.
 */
function renderBpYcPlanning(a, loan) {
  const s = bpSession();
  const st = a.stack;
  const leasing = !!a.lease;
  const yes = bpYcNeeds();
  const none = a.toSave === 0;
  const what = leasing ? "signing costs" : (loan ? "the down payment" : "the purchase");
  const base = leasing ? a.lease.due : (loan ? st.down : st.price + st.upfront - a.extras);
  return `
    <section class="bp-yc-sec">
      <h2 class="bp-yc-band">Planning for it</h2>
      <div class="bp-yc-card">
        <p class="bp-yc-q">Do you need to save for ${h(what)}?</p>
        <div class="bp-seg" role="group" aria-label="Save for ${h(what)}">
          <button type="button" class="${yes ? "on" : ""}" aria-pressed="${yes}" onclick="bpYcSetNeed(true)">Yes</button>
          <button type="button" class="${yes ? "" : "on"}" aria-pressed="${!yes}" onclick="bpYcSetNeed(false)">No</button>
        </div>
        ${yes ? `
          <div class="bp-math">
            <div class="bp-math-row"><span>${leasing ? "Due at signing" : (loan ? "Down payment" : "Price, tax and fees")}</span>
              <strong>${h(bpMoney(base))}</strong></div>
            ${a.extras ? `<div class="bp-math-row"><span>+ Paid on the day</span><strong>${h(bpMoney(a.extras))}</strong></div>` : ""}
            <div class="bp-math-row"><label for="bpSaved">− Already saved</label>
              <input id="bpSaved" class="esf-amount bp-row-input" type="text" inputmode="numeric" placeholder="$0"
                     value="${a.saved ? h(bpMoney(a.saved)) : ""}" aria-label="Already saved, dollars"
                     onchange="bpSetSaved(this.value)"></div>
            ${loan || leasing ? "" : `<div class="bp-math-row"><span>− Trade-in</span><strong>${h(bpMoney(a.tradeIn))}</strong></div>`}
            <div class="bp-math-row bp-math-need"><span>= Need to save</span><strong>${h(bpMoney(a.toSave))}</strong></div>
          </div>
          ${none ? `<p class="bp-yc-per">You already have what you need for ${h(what)}.</p>` : `
            <button class="bp-setrow bp-yc-when" type="button" onclick="bpYcOpenOpt('monthsOut')">
              <span class="bp-setrow-label">Save it by</span>
              <span class="bp-setrow-pill">${h(bpPlanDateLabel(s.plan.monthsOut))} <span class="bp-drop-caret" aria-hidden="true">&#9662;</span></span>
            </button>
            <p class="bp-yc-per">That is <strong>${h(bpMoney(a.monthly))} a month</strong> for ${h(String(a.months))} months.</p>`}
        ` : `<p class="bp-yc-per">No goal needed. You can still finish here.</p>`}
      </div>
    </section>`;
}

function renderBpYourCar() {
  const sel = bpfSelected();
  if (!sel) { bpfSession().view = "start"; return renderBpFinder(); }
  const s = bpSession();
  s.selected = "pick";
  bpEnsureSetup();
  const m = sel.model, cond = sel.cond;
  const card = bpSelectedCard();
  const st = bpStack(card, 5);
  const b = bpBreakdown(card);
  const a = bpLeasing(card) ? bpLeaseAfford(card) : bpSaveToAfford(card);
  const loan = s.pay.mode === "loan";
  const none = a.toSave === 0;
  const what = bpLeasing(card) ? "signing costs" : (loan ? "the down payment" : "the purchase");
  const goal = bpYcNeeds() && !none;
  return `
    <div class="journal-shell onb-pinned bpf-shell bp-yc-shell">
      <div class="journal-head">
        <h1 class="title esf-title bpf-car-title">${renderBpfLogo(m.make)}<span>${h(bpfName(m))} (${cond === "used" ? "Used" : "New"})</span></h1>
        <p class="bp-yc-lead">Choose how to pay, then plan your savings.</p>
      </div>
      <div class="journal-body">
        <button class="bp-quizlink" type="button" onclick="bpYcOpenAlts()">
          <span>Change your mind?</span>
          <span class="bp-quizlink-go">Choose a different car &rsaquo;</span>
        </button>
        ${renderBpYcPaying(card, st, b, loan)}
        ${renderBpYcPlanning(a, loan)}
      <div class="bp-yc-cta">
        <button class="button full" type="button" onclick="bpCommit(${goal ? "" : "{noGoal:true}"})">${goal
          ? "Set goal: save " + h(bpMoney(a.toSave)) + " for " + h(what)
          : "Done"}</button>
      </div>
      </div>
      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        ${renderBpBuddyButton()}
        <span></span>
      </div>
    </div>`;
}

function renderBpYourCarAdmin() {
  const s = bpSession();
  const card = bpSelectedCard();
  const a = bpLeasing(card) ? bpLeaseAfford(card) : bpSaveToAfford(card);
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — your car</p>
      <p class="helper">${h(card.label || card.id)} · ${h(s.pay.mode)} · still to save ${h(bpMoney(a.toSave))}
        over ${a.months} months = ${h(bpMoney(a.monthly))}/mo</p>
    </div>
    ${renderBpAdminCommon()}`;
}
