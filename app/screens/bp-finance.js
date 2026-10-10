// ─── Big Purchase — Screen 4: paying for it ──────────────────────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// MOVED TO THE END on the owner's review (2026-09-22): "the financing screen
// should come at the end for the user to make final adjustments to price and
// financing options." It used to sit inside the cost screen, where it competed
// with the thing that screen was for.
//
// Three settings, one row each, each opening its choices in an in-frame sheet
// (screens/bp-sheet.js). A typed "other" value lands in a field UNDER the row,
// inside #screenRoot, because the simulated keypad only listens there.

// ── Handlers ─────────────────────────────────────────────────────────────────

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

function bpGoPlan() {
  const card = bpSelectedCard();
  bpLog("bp_plan_opened", { card: card.id, payMode: bpSession().pay.mode });
  go("bpCommit");
}

// ── Render ───────────────────────────────────────────────────────────────────

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

/**
 * WHAT IT COSTS, kept apart from HOW YOU PAY (§ bpBreakdown).
 *
 * Four rows that sum to the five-year total, and year one beside it. The down
 * payment and the loan are NOT in here: they are the same money arriving in
 * instalments, and listing them alongside the price counts the car twice —
 * which is precisely what made the old screen unreadable.
 */
function renderBpCostOfCar(card, b) {
  const rows = [
    ["The " + bpTypeWord(card.inputs.type) + " itself", b.costs.price],
    ["Tax, fees and paperwork", b.costs.taxesFees],
    ["Keeping it on the road", b.costs.running],
    ["Interest to the lender", b.costs.interest]
  ].filter(r => r[1] > 0);
  return `
    <div class="card bp-costof">
      <p class="bp-box-head">What the ${h(bpTypeWord(card.inputs.type))} costs you over 5 years</p>
      ${rows.map(r => `
        <div class="bp-fin-sumrow"><span>${h(r[0])}</span><strong>${h(bpMoney(r[1]))}</strong></div>`).join("")}
      <div class="bp-fin-sumrow bp-fin-sumtotal"><span>Five-year total</span>
        <strong>${h(bpMoney(b.total))}</strong></div>
      ${/* NO YEAR-ONE LINE HERE (owner, 2026-09-27: "no need to include the
            year 1 cost on this step 3… just takes room and lots of
            confusion"). This box answers one question — what five years costs
            — and a second horizon inside it made the reader work out which of
            the two figures the rows above belonged to. Year one is on step 2,
            in the six rows, where it is one of a sequence rather than an
            aside. */ ""}
    </div>`;
}

/**
 * The estimated cost over 5 years, for this car and for the cheaper options.
 *
 * It took the place of the 💡 chips (owner: those belong in Ask Buddy), and it
 * is the one place the alternatives appear outside their own screen — each line
 * is a door back into it, for somebody who said "not interested" on screen 2
 * and changed their mind when they saw the payment.
 */
/**
 * The cheaper options, as two chips.
 *
 * It was a three-row list including the car you already chose — whose total sat
 * in the box directly above it, so the screen printed the same figure twice and
 * ran 178px past the bottom. What is left is the thing this block is for: what
 * else costs, and a way through to the comparison.
 */
/**
 * WE DO THE MATHS (owner, 2026-09-27: *"this screen is making users do math and
 * it shouldn't. it should show how much money is saved and then how much that
 * could be worth over the 5 years… we do the math, we offer the data-driven
 * insights, they make the decisions."*).
 *
 * These chips printed each option's five-year TOTAL — $124,500 beside a pick
 * costing $145,211 — which asked the tester to subtract two six-figure numbers
 * in their head to find the only thing they wanted to know. Each chip now
 * states the saving, and underneath it what that saving comes to if it is kept
 * rather than spent. Neither figure needs anything doing to it.
 *
 * The invested figure is `bpOpportunity()`, the same function behind the
 * options screen's money-saved row, so the two screens cannot disagree.
 */
function renderBpFiveYearList(card) {
  const alts = bpCards().filter(c => c.id !== card.id);
  if (!alts.length) return "";
  const pickSt = bpStack(card, 5);
  const pct = Math.round((Number(bpSession().savingsRate) || 0) * 100);
  return `
    <div class="bp-fiveyear">
      <p class="bp-box-head">Spend less, and over 5 years you could have</p>
      <div class="bp-altchips">
        ${alts.map(c => {
          const st = bpStack(c, 5);
          const saving = pickSt.trueCost - st.trueCost;
          const worth = bpOpportunity(pickSt, st);
          const label = c.id === "pick" ? "Your first pick" : (c.id === "used" ? "Used" : "Other brand");
          return `
            <button class="bp-altchip" type="button" onclick="bpPickFromFinance('${c.id}')">
              <span class="bp-altchip-what">${h(label)}</span>
              <strong>${h(bpMoney(saving))}</strong>
              <span class="bp-altchip-worth">worth ${h(bpMoney(worth))} at ${pct}%</span>
            </button>`;
        }).join("")}
      </div>
    </div>`;
}

/** A line in that list, tapped: switch to it and show the comparison. */
function bpPickFromFinance(id) {
  const s = bpSession();
  s.selected = id;
  s.ui.open = id;
  bpLog("bp_card_selected", { card: id, from: "financeList" });
  go("bpOptions");
}

function bpGoOptionsFromFinance() {
  const s = bpSession();
  s.ui.open = null;
  bpLog("bp_explore_opened", { from: "financeList" });
  go("bpOptions");
}

function renderBpFinance() {
  const s = bpSession();
  const card = bpSelectedCard();
  const st = bpStack(card, 5);
  const credit = bpData().credit || {};
  const loan = s.pay.mode === "loan";
  const typed = s.pay.typedRate != null;
  const downLabel = s.pay.down === "other" ? bpMoney(st.down)
                    : Math.round(Number(s.pay.down) * 100) + "% · " + bpMoney(st.down);
  const creditLabel = typed ? "Your rate · " + bpPct(s.pay.typedRate)
                            : ((credit.labels || {})[s.pay.credit] || s.pay.credit);
  const b = bpBreakdown(card);

  // THE HEADLINE IS WHAT YOU PAY, NOT WHAT IT COSTS (owner, 2026-09-27): the
  // cash you need on the day, and the payment after that. The five-year totals
  // live in their own list below, where they are compared rather than mixed in.
  // The monthly figure is the WHOLE monthly figure (owner, 2026-09-27): the
  // loan payment plus what it costs to run. A payment on its own is the number
  // a dealer quotes, and it is never what leaves the account.
  const perMonth = bpMonthlyAllIn(b);
  const headline = loan ? `
    <div class="bp-headline">
      <div class="bp-hl-pair bp-hl-split">
        <div><strong class="bp-hl-big">${h(bpMoney(b.pay.down))}</strong><span>down payment</span></div>
        <div><strong class="bp-hl-big">${h(bpMoney(perMonth))}</strong>
             <span>per month<br>(car payment + running it)</span></div>
      </div>
    </div>` : `
    <div class="bp-headline">
      <strong class="bp-hl-big bp-hl-center">${h(bpMoney(st.price + st.upfront))}</strong>
      <span class="bp-hl-cap">cash on the day</span>
    </div>`;

  // The price of the car in hand. When an alternative is selected it is DERIVED
  // from the pick's price, so it is shown rather than typed — editing it here
  // would silently rewrite the pick and move every other option with it.
  const priceRow = card.id === "pick" ? `
    <div class="bp-priceline">
      <label class="bp-setrow-label" for="bpFinPrice">Price</label>
      <input id="bpFinPrice" class="esf-amount bp-price-inline" type="text" inputmode="numeric"
             value="${h(bpMoney(s.setup.price))}" aria-label="Price, dollars"
             onchange="bpSetPrice(this.value)">
    </div>` : `
    <div class="bp-priceline">
      <span class="bp-setrow-label">Price</span>
      <span class="bp-price-fixed">${h(bpMoney(card.inputs.price))}</span>
      <span class="bp-price-from">your first pick was ${h(bpMoney(s.setup.price))}</span>
    </div>`;

  return `
    <div class="journal-shell onb-pinned bp-fin-shell">
      <div class="journal-head bp-head bp-head-tight">${renderBpStepHead(3, "Paying for it", headline)}</div>
      <div class="journal-body">
        <div class="card bp-finbox">
          <p class="bp-box-head">${h(bpCostSubject(card.inputs))}</p>
          ${priceRow}

          <div class="bp-seg" role="group" aria-label="Loan or cash">
            <button type="button" class="${loan ? "on" : ""}" aria-pressed="${loan}" onclick="bpSetPayMode('loan')">Loan</button>
            <button type="button" class="${loan ? "" : "on"}" aria-pressed="${!loan}" onclick="bpSetPayMode('cash')">Cash</button>
          </div>

          ${loan ? `
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
              ${/* "Amount financed" (owner, 2026-09-27) — the term that
                    appears on the paperwork they will actually sign. "The
                    lender puts in" was me being chatty about a line that has a
                    real name. */ ""}
              <div class="bp-fin-sumrow"><span>Amount financed</span>
                <strong>${h(bpMoney(b.pay.loanAmount))}</strong></div>
            </div>
          ` : `<p class="bp-based">Paying cash: nothing borrowed, so no interest and no payment.</p>`}
        </div>

        ${renderBpCostOfCar(card, b)}
        ${renderBpFiveYearList(card)}
      </div>
      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        ${renderBpBuddyButton()}
        <button class="button" type="button" onclick="bpGoPlan()">Plan for this</button>
      </div>
    </div>`;
}

function renderBpFinanceAdmin() {
  const s = bpSession();
  const card = bpSelectedCard();
  const st = bpStack(card, 5);
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — financing</p>
      <p class="helper">Card <strong>${h(card.id)}</strong> · ${h(s.pay.mode)} · principal
        ${h(bpMoney(st.principal))} at ${h(bpPct(st.apr))} over ${st.term} months → payment
        ${h(bpMoney(bpRound(st.payment, 5)))}, interest while owned ${h(bpMoney(st.interest))}</p>
      <p class="helper" style="font-size:10px;">A typed rate applies to the selected card only; the other
        options keep their tier rate, so the used card still carries its higher one.</p>
    </div>
    ${renderBpAdminCommon()}`;
}
