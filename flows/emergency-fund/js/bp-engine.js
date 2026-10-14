// ─── Big Purchase Calculator — the engine ────────────────────────────────────
// Spec: docs/big-purchase-spec.md §3. NO DOM, and CATEGORY-BLIND.
//
// This file knows about cost buckets, loans, depreciation as a number, savings
// growth and save-to-afford. It does not know what a car is. Everything
// vehicle-shaped comes through the category interface (§3.1), which a config
// file registers with bpRegisterCategory(). A future Home or Boat calculator is
// a new config, not a change here — if building one needs an edit to this file,
// this file was wrong.
//
// FIGURES are data (data/big-purchase.json), ARITHMETIC is code. Nothing below
// carries a rate, a fee or a factor as a literal.
//
// -- THE ONE DEFINITION THAT MATTERS (spec section 3.3) ----------------------
//   trueCost(N) = price + sum(upfront) + sum(monthly) x 12N
//               + sum(yearly) x (N - 1) + interestPaid(N)
//
// NO RESALE CREDIT (owner, 2026-09-26): "I do not want resale value at all...
// it should never be included." The price is counted ONCE, in full, and
// nothing is credited back for what the thing might sell for later. That is
// not the double count this section used to warn about: counting the price
// AND depreciation would be, and depreciation is now absent entirely.

function bpData() {
  return (typeof BIG_PURCHASE !== "undefined" && BIG_PURCHASE) || {};
}

// ── Category registry ────────────────────────────────────────────────────────
const BP_CATEGORY_REGISTRY = {};

function bpRegisterCategory(cfg) {
  if (cfg && cfg.id) BP_CATEGORY_REGISTRY[cfg.id] = cfg;
}

function bpCategory() {
  const s = state.bp;
  return BP_CATEGORY_REGISTRY[(s && s.category) || "vehicle"] || null;
}

// ── Rounding ─────────────────────────────────────────────────────────────────
function bpRound(n, step) {
  const st = step || 5;
  return Math.max(0, Math.round((Number(n) || 0) / st) * st);
}

function bpMoney(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US");
}

/** "$44,900" — headline figures are rounded to $100; they are estimates. */
/**
 * NOTHING ON THESE SCREENS USES THIS ANY MORE (2026-09-27).
 *
 * Rounding the big figures to the nearest hundred was meant to stop an
 * estimate looking more precise than it is. What it actually did was print the
 * same number differently in two places — $760 of running costs as "$800" in
 * the summary and "$760" in the table beneath it, and a five-year total that
 * moved by $11 between screen 2 and screen 3. The owner reads down a screen
 * and adds things up; that has to work. Kept because it costs nothing and the
 * argument for it is not wrong, only outweighed.
 */
function bpMoney100(n) {
  return bpMoney(Math.round((Number(n) || 0) / 100) * 100);
}

function bpPct(apr) {
  const n = Number(apr) || 0;
  return (Math.round(n * 100) / 100) + "%";
}

// ── The session ──────────────────────────────────────────────────────────────
// One run of the tool. Parked on state.bp and cleared by bpStart(), the same
// lifetime the ESF session has — a transcript or an override surviving a
// restart would describe a car that no longer exists.

function bpStart(category) {
  const d = bpData();
  const fin = d.financing || {};
  const profile = state.profile || {};
  state.bp = {
    category: category || "vehicle",
    stage: "landing",
    esfDeferred: false,
    esfReturn: false,
    // The ZIP row is asked ONLY if the answer is not already in state — and that
    // is decided once, here. Deciding it at render time would make the row vanish
    // the moment it was answered, taking the field out from under the finger.
    // There is no mileage row: this feature never asks (spec section 6.1).
    askZip: !profile.zip && profile.zip !== "",
    setup: {},
    pay: {
      mode: fin.defaultMode || "loan",
      down: fin.defaultDown != null ? fin.defaultDown : 0.2,   // a fraction, or "other"
      downAmount: null,                                        // typed, when down is "other"
      term: fin.defaultTerm || 60,
      credit: (d.credit || {}).defaultTier || "600-660",
      typedRate: null                                          // APR, pick only (§3.4)
    },
    about: {},              // "About you" rows — apply to every card (§3.9)
    cardRows: {},           // card id → { rowId: value } — "About the car", selected card only
    touched: {},            // "card:row" → true
    savingsRate: ((d.opportunity || {}).defaultRate) || 0.07,
    selected: "pick",
    plan: {
      saved: 0,
      monthsOut: ((d.plan || {}).defaultMonthsOut) || 12,
      remind: false
    },
    ui: { sheet: null, pick: null, edit: null },
    buddy: null
  };
  bpLog("bp_started", { category: state.bp.category });
  return state.bp;
}

function bpSession() {
  if (!state.bp) bpStart();
  return state.bp;
}

// ── Cards ────────────────────────────────────────────────────────────────────
// "Your pick" plus up to two alternatives the category generates (§3.8). Every
// card is priced on the FULL stack — every estimator and the loan rate re-run —
// never on sticker. That is the thesis of the tool.

function bpPickInputs() {
  return Object.assign({}, bpSession().setup);
}

function bpCards() {
  const cat = bpCategory();
  if (!cat) return [];
  const pick = { id: "pick", label: "Your pick", inputs: bpPickInputs() };
  const alts = (cat.alternatives(pick.inputs) || []).slice(0, 2);
  return [pick].concat(alts);
}

function bpCard(id) {
  return bpCards().find(c => c.id === id) || bpCards()[0] || null;
}

function bpSelectedCard() {
  const s = bpSession();
  const card = bpCards().find(c => c.id === s.selected);
  if (card) return card;
  s.selected = "pick";          // an alternative that no longer exists
  return bpCard("pick");
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function bpRowDef(rowId) {
  const cat = bpCategory();
  return cat ? (cat.costRows.find(r => r.id === rowId) || null) : null;
}

/** The rows that apply to this card — electric-only rows drop out of a gas car. */
function bpRowsFor(card) {
  const cat = bpCategory();
  if (!cat || !card) return [];
  return cat.costRows.filter(r => !r.showIf || r.showIf(card.inputs));
}

/**
 * A row's live figure on one card.
 *
 * Scope decides where an edit lives (§3.9). An "about you" row is one value for
 * every card — a trade-in is the same car whichever you buy. An "about the car"
 * row is per card: an insurance quote for a new Lexus says nothing about a used
 * Toyota, so alternatives keep their estimates until selected and edited.
 */
function bpRowValue(card, rowId) {
  const s = bpSession();
  const row = bpRowDef(rowId);
  if (!row || !card) return 0;
  if (row.scope === "about") {
    const v = s.about[rowId];
    return v == null ? (Number(row.default) || 0) : Number(v) || 0;
  }
  const own = (s.cardRows[card.id] || {})[rowId];
  if (own != null) return Number(own) || 0;
  return bpEstimate(card, rowId);
}

/** What the tool would have said, before anybody edited it. */
function bpEstimate(card, rowId) {
  const row = bpRowDef(rowId);
  if (!row || !row.estimate) return Number(row && row.default) || 0;
  return Math.max(0, Number(row.estimate(card.inputs, bpContext(card))) || 0);
}

/** What an estimator may read beyond the card: the about-you rows it depends on. */
function bpContext(card) {
  const s = bpSession();
  return {
    card: card,
    about: function (rowId) {
      const row = bpRowDef(rowId);
      const v = s.about[rowId];
      return v == null ? (Number(row && row.default) || 0) : Number(v) || 0;
    }
  };
}

function bpRowTouched(card, rowId) {
  return !!bpSession().touched[(card ? card.id : "") + ":" + rowId];
}

function bpSetRow(cardId, rowId, value) {
  const s = bpSession();
  const row = bpRowDef(rowId);
  if (!row) return;
  const n = Math.max(0, Math.round(Number(String(value == null ? "" : value).replace(/[^0-9.]/g, "")) || 0));
  const card = bpCard(cardId);
  const from = bpRowValue(card, rowId);
  if (row.scope === "about") {
    s.about[rowId] = n;
  } else {
    if (!s.cardRows[cardId]) s.cardRows[cardId] = {};
    s.cardRows[cardId][rowId] = n;
  }
  s.touched[(row.scope === "about" ? "all" : cardId) + ":" + rowId] = true;
  bpLog("bp_row_changed", { rowId: rowId, card: row.scope === "about" ? "all" : cardId, from: from, to: n });
}

// ── Loans ────────────────────────────────────────────────────────────────────

function bpPayment(principal, apr, term) {
  const P = Math.max(0, Number(principal) || 0);
  const n = Math.max(1, Number(term) || 1);
  const r = (Number(apr) || 0) / 100 / 12;
  if (!P) return 0;
  if (!r) return P / n;
  return P * r / (1 - Math.pow(1 + r, -n));
}

/**
 * Interest paid, and the balance still owed, after `months` of payments.
 * Walked month by month so a term shorter than the horizon simply stops.
 */
function bpAmortize(principal, apr, term, months) {
  const r = (Number(apr) || 0) / 100 / 12;
  // THE SCHEDULE RUNS ON THE PAYMENT THE TESTER IS SHOWN (2026-09-27). It used
  // to run on $1,389.23 while every screen printed $1,390, so a year of
  // payments was $16,671 where the tester adding up what they had been shown
  // got $16,680 — and the owner did exactly that arithmetic. Rounding once,
  // here, means the payment, the interest and every total built on them are
  // the same $1,390 the screens print.
  const pay = bpRound(bpPayment(principal, apr, term), 5);
  let bal = Math.max(0, Number(principal) || 0);
  let interest = 0;
  const stop = Math.min(Number(term) || 0, months);
  for (let m = 0; m < stop && bal > 0.005; m++) {
    const i = bal * r;
    interest += i;
    bal = Math.max(0, bal + i - pay);
  }
  return { interest: interest, balance: bal, payment: pay };
}

/** The APR a card carries. A typed rate applies to the user's pick ONLY (§3.4). */
function bpRate(card) {
  const s = bpSession();
  const cat = bpCategory();
  if (card && card.id === "pick" && s.pay.typedRate != null) return Number(s.pay.typedRate) || 0;
  return cat ? cat.loanRate(card.inputs, s.pay.credit) : 0;
}

/** The rate at a given tier, ignoring any typed rate — the credit sheet's table. */
function bpRateAtTier(card, tier) {
  const cat = bpCategory();
  return cat ? cat.loanRate(card.inputs, tier) : 0;
}

function bpDownPayment(card) {
  const s = bpSession();
  const price = Number(card.inputs.price) || 0;
  if (s.pay.down === "other") return Math.min(price, Math.max(0, Number(s.pay.downAmount) || 0));
  return Math.round(price * (Number(s.pay.down) || 0));
}

// ── The stack ────────────────────────────────────────────────────────────────

/**
 * Everything one card costs over N years.
 *
 * `opts.mode` and `opts.tier` let the sheets ask "what if" without touching the
 * session: the credit sheet prices the same car at every tier, and the
 * cash-vs-loan block prices a cash buyer's car as if it were financed.
 */
function bpStack(card, years, opts) {
  const s = bpSession();
  const cat = bpCategory();
  const o = opts || {};
  const N = years || ((bpData().horizons || {}).primary) || 5;
  const price = Number(card.inputs.price) || 0;
  const mode = o.mode || s.pay.mode;

  const buckets = { upfront: 0, monthly: 0, yearly: 0 };
  const lines = [];
  bpRowsFor(card).forEach(r => {
    if (!buckets.hasOwnProperty(r.bucket) || r.costless) return;
    const v = bpRowValue(card, r.id);
    buckets[r.bucket] += v;
    lines.push({ id: r.id, bucket: r.bucket, value: v });
  });

  // ── RESALE IS NOT IN ANY TOTAL (owner, 2026-09-26) ────────────────────────
  // "I don't want resale value at all… it should never be included." So the
  // cost of the car is the PRICE, in full, and nothing is credited back for
  // what it might sell for one day. The curve is still computed — the category
  // owns it and a later feature may want it — but nothing downstream reads it.
  //
  // This is NOT the double count §3.3 warns about: the price is counted once
  // and depreciation is not counted at all. Counting both would be the error.
  const resale = cat ? cat.resaleValue(card.inputs, N) : price;
  const valueLost = Math.max(0, price - resale);

  // Financing. The loan covers the price plus the tax and fees charged on the
  // day, less what is put down and the trade-in (§3.4). The other upfront costs
  // — a charger, riding gear — are paid in cash on the day and never financed.
  const salesTax = bpRowValue(card, "salesTax");
  const fees = bpRowValue(card, "fees");
  const tradeIn = bpRowValue(card, "tradeIn");
  const down = mode === "loan" ? bpDownPayment(card) : 0;
  const apr = o.tier ? bpRateAtTier(card, o.tier) : bpRate(card);
  const term = s.pay.term;
  let principal = 0, payment = 0, interest = 0, balance = 0;
  if (mode === "loan") {
    principal = Math.max(0, price + salesTax + fees - down - tradeIn);
    // Only interest paid WHILE OWNED counts. If the term runs past N the rest
    // of the balance is repaid from the sale, and that is already in valueLost.
    const am = bpAmortize(principal, apr, term, 12 * N);
    payment = am.payment;
    interest = am.interest;
    balance = am.balance;
  }

  const trueCost = price + buckets.upfront + buckets.monthly * 12 * N +
                   buckets.yearly * Math.max(0, N - 1) + interest;

  return {
    years: N, price: price, mode: mode,
    upfront: buckets.upfront, monthly: buckets.monthly, yearly: buckets.yearly,
    lines: lines,
    resale: resale, valueLost: valueLost,
    down: down, tradeIn: tradeIn, principal: principal, apr: apr, term: term,
    payment: payment, interest: interest, balanceAtSale: balance,
    trueCost: trueCost,
    monthlyToOwn: trueCost / (12 * N)
  };
}

/**
 * THE FIVE FIGURES. One definition, read by every screen (owner, 2026-09-27:
 * "I need to be clear about the cost of the car… right now it's all of them at
 * once and really confusing").
 *
 * The confusion was never arithmetic, it was two different questions answered
 * in one column:
 *
 *   WHAT IT COSTS   price, taxes and fees, running costs, loan interest.
 *                   These add up to the five-year total. Money gone.
 *   HOW YOU PAY     down payment, loan amount, monthly payment.
 *                   These are the same money arriving in instalments — adding
 *                   them to the list above counts the car twice.
 *
 * So they are returned as two groups and must be shown as two groups. The only
 * figures that cross between them are the two totals, which is why the totals
 * are the things the comparison compares.
 */
/**
 * The loan payment AS IT IS SHOWN — rounded once, here, and read from here by
 * every screen that prints it or adds it to something.
 *
 * Step 3's headline used to round the SUM of the raw payment and the running
 * cost, while step 2 rounded the payment on its own. $1,395 + $760 came to
 * $2,155 → "$2,150", beside a screen showing "$1,400" and "$760" (owner,
 * 2026-09-27: *"step 2 shows 2150 monthly, which doesn't match… $1,400 +
 * $760"*). Rounding the parts and rounding the total are different sums; a
 * figure the tester is invited to add up must be built from the parts they can
 * see.
 */
function bpMonthlyPayment(b) {
  return bpRound(b.pay.payment, 5);
}

/** The whole monthly outgoing: the payment shown, plus the running cost shown. */
function bpMonthlyAllIn(b) {
  return bpMonthlyPayment(b) + b.running.monthly;
}

function bpBreakdown(card, years) {
  const N = years || 5;
  const st = bpStack(card, N);
  const taxesFees = bpRowValue(card, "salesTax") + bpRowValue(card, "fees");
  const extras = st.upfront - taxesFees;                 // charger, riding gear
  const runningMonthly = st.monthly;
  const yearlyCosts = st.yearly;

  // What it costs, over the whole horizon. These four sum to `total`.
  const costs = {
    price: st.price,
    taxesFees: taxesFees + extras,
    running: runningMonthly * 12 * N + yearlyCosts * Math.max(0, N - 1),
    interest: st.interest
  };
  const total = costs.price + costs.taxesFees + costs.running + costs.interest;

  // ── YEAR ONE, IN ITS PARTS ────────────────────────────────────────────────
  // What actually leaves the account in the first twelve months, split so each
  // screen can label exactly what it is showing.
  //
  // `atPurchase` differs by how you pay, and that is not a rounding detail: a
  // loan rolls the tax and fees into the principal, so they are NOT cash on the
  // day — they arrive inside the payment. Paying cash, they are due at once.
  //
  // The registration RENEWAL is deliberately absent: it falls due each year
  // AFTER the first. Counting it here is what made screen 2's summary disagree
  // with its own table by exactly one renewal.
  const atPurchase = st.mode === "loan" ? st.down + extras : st.price + taxesFees + extras;
  const yearOne = {
    atPurchase: atPurchase,
    payments: st.mode === "loan" ? st.payment * 12 : 0,
    running: runningMonthly * 12,
    total: atPurchase + (st.mode === "loan" ? st.payment * 12 : 0) + runningMonthly * 12
  };

  return {
    mode: st.mode,
    costs: costs,
    total: total,                       // year 5 (or N) — everything
    running: { monthly: runningMonthly, year: runningMonthly * 12 },
    upfront: { taxesFees: taxesFees, extras: extras, total: taxesFees + extras },
    pay: {
      down: st.down,
      loanAmount: st.principal,
      payment: st.payment,
      term: st.term,
      apr: st.apr,
      cashOnDay: st.mode === "loan" ? st.down + extras : st.price + taxesFees + extras
    },
    yearOne: yearOne,
    stack: st
  };
}

/** Cash leaving the account on the day: the down payment (or the whole price) plus the upfront bucket. */
function bpCashAtPurchase(st) {
  if (st.mode === "loan") return st.down + st.upfront;
  return Math.max(0, st.price + st.upfront - st.tradeIn);
}

// ── Opportunity cost (§3.6) ──────────────────────────────────────────────────

/**
 * What the difference between two cards is WORTH after N years if the cheaper
 * one's savings were put aside at the savings rate.
 *
 * Month by month rather than the spec's closed form: the closed form assumes
 * the payment runs all 60 months, and a 36-month loan stops paying at 36. For a
 * 60- or 72-month loan the two agree exactly. `endDiff` is subtracted because
 * the pricier car usually sells for more.
 */
function bpOpportunity(pickSt, altSt, rate) {
  const i = rate != null ? Number(rate) : bpSession().savingsRate;
  const N = pickSt.years;
  const months = 12 * N;
  const monthlyRate = i / 12;
  let fv = (bpCashAtPurchase(pickSt) - bpCashAtPurchase(altSt)) * Math.pow(1 + i, N);
  for (let m = 1; m <= months; m++) {
    const out = st => (st.mode === "loan" && m <= st.term ? st.payment : 0) +
                      st.monthly + (m > 12 && (m - 1) % 12 === 0 ? st.yearly : 0);
    fv += (out(pickSt) - out(altSt)) * Math.pow(1 + monthlyRate, months - m);
  }
  // No end-of-term adjustment: resale is out of this tool entirely, so there is
  // no "the pricier car sells for more" credit to subtract. What is left is
  // what the cheaper car leaves in the pocket, month by month, grown.
  return fv;
}

// ── Cash vs loan (§3.7) ──────────────────────────────────────────────────────

/**
 * Loan interest against what the same cash could grow by. Shown whichever way
 * the user pays; a cash buyer's figure is priced as if the car were financed on
 * the loan settings, so the comparison is still visible.
 *
 * NO VERDICT. The block never says which is better. The closing sentence —
 * "Loan interest is certain. Savings growth is not." — is required and never
 * removed: the two figures look comparable and are not the same kind of number.
 */
function bpCashVsLoan(card) {
  const s = bpSession();
  const st = bpStack(card, null, { mode: "loan" });
  const i = s.savingsRate;
  const years = Math.min(st.term, 12 * st.years) / 12;
  return {
    interest: st.interest,
    growth: st.principal * (Math.pow(1 + i, years) - 1),
    rate: i
  };
}

// ── Save to afford (§3.5) ────────────────────────────────────────────────────

/**
 * What is still to save before the day of purchase.
 *
 * ── A DELIBERATE DEPARTURE FROM THE SPEC'S FORMULA ──────────────────────────
 * §3.5 subtracts the trade-in from the cash needed in both modes. With a loan
 * that counts it twice, because §3.4 has already taken it off the principal —
 * the down payment and the trade-in are two separate things paid in. So the
 * trade-in comes off only for a cash buyer, where it is part of paying.
 *
 * Other upfront costs (a charger, riding gear) are cash on the day in both
 * modes, so they are in both — §3.5 lists them for cash only, which would
 * leave a loan buyer $1,400 short at the charger.
 */
function bpSaveToAfford(card) {
  const s = bpSession();
  const st = bpStack(card);
  const extras = st.lines.filter(l => l.bucket === "upfront" && l.id !== "salesTax" && l.id !== "fees")
                         .reduce((sum, l) => sum + l.value, 0);
  const cashNeeded = st.mode === "loan"
    ? st.down + extras
    : st.price + st.upfront;
  const saved = Math.max(0, Number(s.plan.saved) || 0);
  const trade = st.mode === "loan" ? 0 : st.tradeIn;
  const step = ((bpData().plan || {}).roundTo) || 100;
  const raw = Math.max(0, cashNeeded - saved - trade);
  const toSave = raw > 0 ? Math.max(step, Math.round(raw / step) * step) : 0;
  const months = Math.max(1, Number(s.plan.monthsOut) || 12);
  return {
    stack: st, cashNeeded: cashNeeded, extras: extras, saved: saved, tradeIn: trade,
    toSave: toSave, months: months,
    monthly: toSave ? Math.ceil(toSave / months) : 0
  };
}

/**
 * The figure the budget reminder offers — cash leaving the account each month.
 * The PAYMENT for a loan, the running costs for a cash buyer (§8). Depreciation
 * never leaves the account, so it is never in this number.
 */
function bpBudgetFigure(card) {
  const st = bpStack(card);
  return bpRound(st.mode === "loan" ? st.payment : st.monthly, 5);
}

// ── Bands (the ESF range-dropdown pattern, generalised) ──────────────────────
// Estimated rows are picked from ranges, never typed. The step follows the
// magnitude — a flat band is absurd on a $30 registration and useless on a
// $2,400 tax bill.
const BP_BANDS = [
  { under: 100,   width: 25 },
  { under: 500,   width: 25 },
  { under: 1000,  width: 100 },
  { under: 3000,  width: 200 },
  { under: 10000, width: 500 },
  { under: Infinity, width: 1000 }
];

function bpBandFor(value) {
  const v = Math.max(0, Number(value) || 0);
  const w = (BP_BANDS.find(b => v < b.under) || BP_BANDS[BP_BANDS.length - 1]).width;
  const lo = Math.floor(v / w) * w;
  return { lo: lo, hi: lo + w, mid: lo + w / 2, width: w };
}

function bpBandOptions(value) {
  const here = bpBandFor(value);
  const out = [{ lo: 0, hi: 0, mid: 0, zero: true }];
  for (let i = -4; i <= 5; i++) {
    const lo = here.lo + i * here.width;
    if (lo < 0) continue;
    if (lo === 0 && here.lo > 0 && i < 0 && here.width === here.lo) continue;
    out.push({ lo: lo, hi: lo + here.width, mid: lo + here.width / 2 });
  }
  return out;
}

function bpBandLabel(value) {
  const v = Number(value) || 0;
  if (!v) return "$0";
  const b = bpBandFor(v);
  return bpMoney(b.lo) + " – " + bpMoney(b.hi);
}

// ── Log (§12) ────────────────────────────────────────────────────────────────
// In-memory under D03, same lifetime and cap as the ESF's.
const BP_LOG_CAP = 300;

function bpLog(event, detail) {
  if (!state.bpEvents) state.bpEvents = [];
  if (state.bpEvents.length >= BP_LOG_CAP) return;
  state.bpEvents.push({
    at: new Date().toISOString().slice(11, 19),
    event: event,
    detail: detail || {}
  });
}
