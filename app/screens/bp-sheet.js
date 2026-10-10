// ─── Big Purchase — in-frame sheets ──────────────────────────────────────────
// Spec §1 principle 9 and §9. Every chooser and info panel in this tool opens
// INSIDE the phone frame. Never alert(), confirm() or a native <select>: all
// three are drawn by the operating system, ignore the frame, and spill out of
// the bottom of the phone (the ESF's lesson — see screens/buddy-panel.js).
//
// Painted into #buddyRoot with the Buddy panel, for the same reason the panel
// lives there: the simulated keypad's 250px reflow cannot move it.
//
// Sheets:
//   pick          the range picker for one estimated cost row
//   credit        "Why does my score matter?" — the user's OWN loan at each tier
//   taxBreak      "A tax break for car loan interest"
//   taxBreakPage  the simulated in-app web page behind "See who qualifies"
//   rate          the savings-rate tiles behind every ✎

// ── Typed fields and the tap that blurs them ─────────────────────────────────
// A typed field commits on `change`, which fires on blur — and the blur happens
// on pointerdown of whatever is tapped next. If that is Continue and the change
// handler calls render(), the button is replaced before the finger lifts, and
// no click is ever dispatched on it. The keypad's press latch holds the LAYOUT
// still; it cannot hold the NODE. So when a press is in flight the field only
// queues its repaint, and the button's own handler renders (render() cancels
// the queued one). Tapping somewhere inert still repaints, 400ms later.
let bpPressInFlight = false;
document.addEventListener("pointerdown", function (e) {
  const t = e.target;
  bpPressInFlight = !!(t && t.closest && t.closest("button, [role='radio'], [role='button'], [role='checkbox']"));
}, true);
document.addEventListener("pointerup", function () {
  setTimeout(function () { bpPressInFlight = false; }, 0);
}, true);

function bpFieldCommitted() {
  if (bpPressInFlight) { debouncedRender(); return; }
  render();
}

function bpOpenSheet(name) {
  const s = bpSession();
  s.ui.sheet = name;
  if (name === "credit" || name === "taxBreak" || name === "taxBreakPage") {
    bpLog("bp_sheet_opened", { sheet: name });
  }
  render();
}

function bpCloseSheet() {
  const s = bpSession();
  s.ui.sheet = null;
  s.ui.pick = null;
  render();
}

function bpOpenPick(rowId) {
  const s = bpSession();
  s.ui.pick = rowId;
  s.ui.sheet = "pick";
  render();
}

function bpPickBand(rowId, mid) {
  const card = bpSelectedCard();
  const row = bpRowDef(rowId);
  bpSetRow(row && row.scope === "about" ? "pick" : card.id, rowId, mid);
  bpCloseSheet();
}

function bpSetSavingsRate(r) {
  const s = bpSession();
  const from = s.savingsRate;
  s.savingsRate = Number(r) || from;
  bpLog("bp_rate_changed", { from: from, to: s.savingsRate });
  s.ui.sheet = null;
  render();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderBpSheetFrame(title, body, foot) {
  return `
    <div class="esf-buddy-scrim" onclick="bpCloseSheet()"></div>
    <div class="esf-buddy bp-sheet" role="dialog" aria-modal="true" aria-label="${h(title)}">
      <div class="bp-sheet-head"><p class="esf-buddy-title">${h(title)}</p></div>
      <div class="bp-sheet-body">${body}</div>
      <div class="bp-sheet-foot">${foot || `<button class="button secondary full" type="button" onclick="bpCloseSheet()">Close</button>`}</div>
    </div>`;
}

function renderBpPickSheet() {
  const s = bpSession();
  const card = bpSelectedCard();
  const row = bpRowDef(s.ui.pick);
  if (!row) return "";
  const v = bpRowValue(card, row.id);
  const here = bpBandFor(v);
  const per = row.bucket === "monthly" ? "a month" : row.bucket === "yearly" ? "a year" : "when you buy";
  const label = row.labelFor ? row.labelFor(card.inputs) : row.label;
  const body = `
    <p class="bp-based" style="margin:0 0 10px;">${h(per.charAt(0).toUpperCase() + per.slice(1))}${
      row.scope === "car" && card.id !== "pick" ? " · this option only" : ""}</p>
    <div class="bp-sheet-list">
      ${bpBandOptions(v).map(b => {
        const on = b.zero ? v === 0 : (!!v && b.lo === here.lo);
        return `<button class="bp-opt ${on ? "on" : ""}" type="button" onclick="bpPickBand('${row.id}', ${b.mid})">
          ${h(b.zero ? "$0" : bpMoney(b.lo) + " – " + bpMoney(b.hi))}</button>`;
      }).join("")}
    </div>`;
  return renderBpSheetFrame(label, body);
}

/**
 * The credit sheet (§9.1). Every figure is recomputed for the SELECTED card at
 * each tier, so it is the user's own loan, not a generic example. "← you"
 * marks the tier currently selected — the score we used, not a real score.
 * No "improve your score" line; that belongs to the education layer.
 */
function renderBpCreditSheet() {
  const s = bpSession();
  const card = bpSelectedCard();
  const c = bpData().credit || {};
  const order = (c.order || []).slice().reverse();          // best rate first
  const rows = order.map(t => {
    const st = bpStack(card, 5, { mode: "loan", tier: t });
    const you = s.pay.typedRate == null && s.pay.credit === t;
    return `
      <tr class="${you ? "bp-you" : ""}">
        <td>${h((c.labels || {})[t] || t)}</td>
        <td>${h(bpPct(st.apr))}</td>
        <td>${h(bpMoney(bpRound(st.payment, 5)))}${you ? ` <span class="bp-you-mark">&larr; you</span>` : ""}</td>
        <td>${h(bpMoney(st.interest))}</td>
      </tr>`;
  }).join("");
  const body = `
    <table class="bp-table">
      <thead><tr><th>Score</th><th>Rate</th><th>Your payment</th><th>Interest, 5 yrs</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="bp-lead">A higher score usually means a lower rate.</p>
    <p class="bp-lead">Same car, same price. Only the score changes.</p>
    <p class="bp-based">Rates: Experian, Q2 2026.</p>`;
  return renderBpSheetFrame("Your credit score changes your rate", body);
}

function renderBpTaxSheet() {
  const body = `
    <p class="bp-lead">From 2025 through 2028, some people can deduct the interest
       on a new car loan from their federal taxes.</p>
    <p class="bp-lead">We don't count it in your numbers. Whether it applies
       depends on your income and the car.</p>`;
  const foot = `
    <div class="bp-row2">
      <button class="button full" type="button" onclick="bpOpenSheet('taxBreakPage')">See who qualifies &rsaquo;</button>
      <button class="button secondary full" type="button" onclick="bpCloseSheet()">Close</button>
    </div>`;
  return renderBpSheetFrame("A tax break for car loan interest", body, foot);
}

/** MoneyBuddy's own summary, simulating the in-app browser. Not IRS text. */
function renderBpTaxPage() {
  const tb = bpData().taxBreak || {};
  const body = `
    <div class="bp-page">
      <p class="bp-page-title">No tax on car loan interest</p>
      <p class="bp-page-src">IRS · One Big Beautiful Bill provisions</p>
      <p class="bp-page-h">What it is</p>
      <p>A federal deduction for interest paid on a loan used to buy a vehicle, for tax years 2025 through 2028.</p>
      <p class="bp-page-h">Who may qualify</p>
      <ul>
        <li>The vehicle is new, not used</li>
        <li>Its final assembly happened in the United States</li>
        <li>It is for personal use, not business</li>
        <li>It weighs under 14,000 pounds</li>
        <li>The loan was taken out after December 31, 2024</li>
        <li>It is a loan, not a lease</li>
      </ul>
      <p class="bp-page-h">How much</p>
      <p>Up to $10,000 of interest a year. The deduction shrinks for incomes above $100,000,
         or $200,000 for married couples filing jointly.</p>
      <p class="bp-page-h">How to claim</p>
      <p>You can claim it whether or not you itemize. You'll need the vehicle's VIN.
         Lenders send a form showing the interest paid.</p>
      <p>Rules can change. Check with the IRS or a tax professional.</p>
      <p class="bp-page-src">${h(tb.link || "irs.gov")}</p>
    </div>`;
  return renderBpSheetFrame("irs.gov", body);
}

function renderBpRateSheet() {
  const s = bpSession();
  const opts = ((bpData().opportunity || {}).options || [0.07]).map(r => ({ id: r, label: Math.round(r * 100) + "%" }));
  const body = `
    <p class="bp-lead">What the difference could grow to if it were saved at this rate each year.
       7% is the stock market's long-run average after inflation.</p>
    ${bpTiles(opts, s.savingsRate, id => `bpSetSavingsRate(${id})`, "bp-tiles-3")}
    <p class="bp-based">One change updates every option and the loan-or-cash comparison.</p>`;
  return renderBpSheetFrame("Savings rate", body);
}

/** Down payment, loan length or credit score — the choices behind one row. */
function renderBpFinSheet() {
  const s = bpSession();
  const d = bpData();
  const fin = d.financing || {};
  const credit = d.credit || {};
  const field = s.ui.fin;
  let title = "", opts = [], cur = null;
  if (field === "down") {
    title = "Down payment";
    const price = Number(bpSelectedCard().inputs.price) || 0;
    opts = (fin.downOptions || [0.1, 0.2]).map(p => ({ v: p, label: Math.round(p * 100) + "% · " + bpMoney(price * p) }))
             .concat([{ v: "'other'", label: "A different amount" }]);
    cur = s.pay.down === "other" ? "'other'" : s.pay.down;
  } else if (field === "term") {
    title = "Loan length";
    opts = (fin.terms || [36, 48, 60, 72]).map(t => ({ v: t, label: t + " months (" + (t / 12) + " years)" }));
    cur = s.pay.term;
  } else {
    title = "Credit score";
    opts = (credit.order || []).slice().reverse().map(t => ({ v: "'" + t + "'", label: (credit.labels || {})[t] || t }))
             .concat([{ v: "'other'", label: "I know my rate" }]);
    cur = s.pay.typedRate != null ? "'other'" : "'" + s.pay.credit + "'";
  }
  const body = `
    <div class="bp-sheet-list">
      ${opts.map(o => `<button class="bp-opt ${String(o.v) === String(cur) ? "on" : ""}" type="button"
                         onclick="bpFinChoose('${field}', ${o.v})">${h(o.label)}</button>`).join("")}
    </div>
    ${field === "credit" ? `<p class="bp-based" style="margin-top:10px;">Not your real score — just the one we use to
       pick a typical rate.</p>` : ""}`;
  return renderBpSheetFrame(title, body);
}

/**
 * Loan vs cash (§3.7), moved off the screen into its own sheet on the owner's
 * "way too much info" call. The block itself is unchanged: both figures, the
 * required closing line, and no verdict.
 */
function renderBpCvlSheet() {
  const s = bpSession();
  const card = bpSelectedCard();
  const cvl = bpCashVsLoan(card);
  const pct = Math.round(s.savingsRate * 100);
  const noFund = s.pay.mode === "cash" && (s.esfDeferred || !bpEsfAnswered());
  const body = `
    <div class="bp-block">
      <div class="bp-block-row"><span>With a loan: interest over 5 years</span><strong>${h(bpMoney(cvl.interest))}</strong></div>
      <div class="bp-block-row"><span>The same cash, if saved at ${pct}% a year, could grow by</span><strong>${h(bpMoney(cvl.growth))}</strong></div>
      <p class="bp-block-note">Loan interest is certain. Savings growth is not.</p>
      ${noFund ? `<p class="bp-block-note">Paying cash uses your savings. You told us you don't have an emergency fund yet.</p>` : ""}
    </div>
    <p class="bp-based" style="margin-top:10px;">Which way to pay is your call.</p>`;
  return renderBpSheetFrame("Loan or cash?", body);
}

/** The whole BP layer, painted into #buddyRoot by render(). */
function renderBpLayer() {
  if (!state.bp || ["bpLanding", "bpFinder", "bpYourCar", "bpSetup", "bpQuiz", "bpCost", "bpOptions", "bpFinance", "bpCommit"].indexOf(state.screen) === -1) return "";
  const s = state.bp;
  const sheet = s.ui && s.ui.sheet;
  if (sheet === "pick")         return renderBpPickSheet();
  if (sheet === "credit")       return renderBpCreditSheet();
  if (sheet === "taxBreak")     return renderBpTaxSheet();
  if (sheet === "taxBreakPage") return renderBpTaxPage();
  if (sheet === "rate")         return renderBpRateSheet();
  if (sheet === "fin")          return renderBpFinSheet();
  if (sheet === "cvl")          return renderBpCvlSheet();
  if (sheet === "bpfMake")      return renderBpfListSheet("make");
  if (sheet === "bpfModel")     return renderBpfListSheet("model");
  if (sheet === "bpYcAlts")     return renderBpYcAltsSheet();
  if (sheet === "bpYcOpt")      return renderBpYcOptSheet();
  if (sheet === "bpfPeerRange") return renderBpfPeerRangeSheet();
  return renderBpBuddyPanel();
}
