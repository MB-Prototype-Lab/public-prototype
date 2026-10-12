// ─── Big Purchase — the car finder's model ───────────────────────────────────
// NO DOM. screens/bp-finder.js draws it.
//
// Owner, 2026-09-29: the tool used to start from a car the tester already had
// in mind and hunt for a cheaper one. It now starts from the PERSON — how they
// live, what they earn, what peers spend — and names a specific make and model.
//
// ── ONE MONEY MODEL, STILL ───────────────────────────────────────────────────
// Every figure here comes out of bpBreakdown(), called on a card built from a
// catalog entry. Nothing in this file adds, rounds or multiplies a cost of its
// own, so a car priced on the finder costs exactly what it costs on steps 2–4.
// The used price is `alternatives.usedCut`, the same cut the options screen
// applies, for the same reason.
//
// ── PEERS ARE INFORMATION, NEVER A LINE ─────────────────────────────────────
// D26 and the owner (2026-09-28: "that rule cannot be broken. full stop"). The
// peer figure is shown as what peers spend. Nothing here computes a limit, a
// "too much", or a share of income anybody ought to stay under.

function bpfData() {
  return bpVData().finder || {};
}

function bpfModels() {
  return bpfData().models || [];
}

function bpfModel(id) {
  return bpfModels().find(m => m.id === id) || null;
}

function bpfTypes() {
  return bpfData().types || [];
}

function bpfTypeLabel(type) {
  const t = bpfTypes().find(x => x.id === type);
  return t ? t.label : bpVTypeLabel(type);
}

function bpfUses(type) {
  return ((bpfData().uses || {})[type]) || [];
}

function bpfUse(type, use) {
  return bpfUses(type).find(u => u.id === use) || null;
}

function bpfTiers() {
  return bpfData().tiers || ["value", "everyday", "premium"];
}

function bpfName(m) {
  return m ? m.make + " " + m.model : "";
}

/**
 * What the car is KNOWN for — its reputation, the line its marketing leads
 * with (owner, 2026-10-01: "what is the car known for? im sure it isn't known
 * for 5 seats and roomy back seats"). `why` (the spec line) stays in the data
 * as the fallback.
 */
function bpfKnown(m) {
  return m ? (m.known || m.why || "") : "";
}

/** The models in one type, one use, one tier — always three in the catalog. */
function bpfModelsIn(type, use, tier) {
  return bpfModels().filter(m => m.type === type && (!use || m.use === use) && (!tier || m.tier === tier));
}

/** "$34K–$42K" — the tier's range, derived from its own three cars. */
function bpfTierRange(type, use, tier) {
  const ps = bpfModelsIn(type, use, tier).map(m => m.price);
  if (!ps.length) return null;
  return { lo: Math.min.apply(null, ps), hi: Math.max.apply(null, ps) };
}

function bpfK(n) {
  return "$" + Math.round((Number(n) || 0) / 1000) + "K";
}

function bpfRangeLabel(r) {
  if (!r) return "";
  return r.lo === r.hi ? bpfK(r.lo) : bpfK(r.lo) + "–" + bpfK(r.hi);
}

// ── Cards: a catalog car, new or used, as the engine sees it ────────────────

function bpfUsedPrice(m) {
  const cut = Number((bpVData().alternatives || {}).usedCut) || 0.28;
  return bpRound(m.price * (1 - cut), 100);
}

function bpfInputs(m, cond) {
  const used = cond === "used";
  const inp = { type: m.type, tier: m.tier, fuel: m.fuel, condition: used ? "used" : "new",
                price: used ? bpfUsedPrice(m) : m.price };
  if (used) inp.age = bpfData().usedAge || "1-3";
  return inp;
}

function bpfCard(m, cond, id) {
  return { id: id || ("f:" + m.id + ":" + cond), label: bpfName(m), inputs: bpfInputs(m, cond) };
}

/**
 * The five lines the owner specified, plus the two parts of the monthly figure.
 * `monthly` is the whole monthly outgoing — the payment the screens print plus
 * the running cost they print — so it adds up from what the tester can see.
 */
function bpfFigures(card, opts) {
  const b = bpBreakdown(card);
  // Leasing (owner, 2026-10-03: also in "How we worked it out"): a new car on a
  // lease swaps the loan figures for the lease estimate (js/bp-lease.js). Five years
  // repeats the lease, and the peers' column opts out with {noLease: true}.
  if (!(opts && opts.noLease) && typeof bpLeasing === "function" && bpLeasing(card)) {
    const lf = bpLeaseFigures(card);
    return {
      sticker: Number(card.inputs.price) || 0,
      down: lf.due,
      payment: lf.payment,
      running: lf.running,
      monthly: lf.allIn,
      year1: lf.due + 12 * (lf.payment + lf.running),
      five: (lf.due + lf.payment * lf.term) * (60 / lf.term) + lf.running * 60,
      b: b,
      lease: lf
    };
  }
  return {
    sticker: Number(card.inputs.price) || 0,
    down: b.pay.down,
    payment: bpMonthlyPayment(b),
    running: b.running.monthly,
    monthly: bpMonthlyAllIn(b),
    year1: b.yearOne.total,
    five: b.total,
    b: b
  };
}

// ── The tester's pick ────────────────────────────────────────────────────────
// Choosing a car on the finder WRITES the session's setup, so the card the rest
// of the tool calls "pick" is that car. Edits made in Buddy's breakdown land on
// the pick card and carry into steps 1–4 untouched.

function bpfSelect(modelId, cond) {
  const s = bpSession();
  const m = bpfModel(modelId);
  if (!m) return;
  const f = bpfSession();
  const changed = !f.sel || f.sel.id !== modelId || f.sel.cond !== cond;
  f.sel = { id: modelId, cond: cond };
  s.setup = bpfInputs(m, cond);
  if (changed) {
    // Per-car edits describe the car that was on screen, not this one.
    s.cardRows = {};
    s.touched = {};
  }
  bpLog("bp_finder_pick", { model: modelId, cond: cond, via: f.path });
}

function bpfSelected() {
  const f = bpfSession();
  const m = f.sel ? bpfModel(f.sel.id) : null;
  return m ? { model: m, cond: f.sel.cond } : null;
}

// ── Peers ────────────────────────────────────────────────────────────────────

function bpfIncomeMonthly() {
  const a = Number((state.profile || {}).incomeAnnual) || 0;
  return a > 0 ? a / 12 : 0;
}

/**
 * What peers spend on a car each month: the payment, the running cost, and the
 * two together. Income band and household size from the profile, running cost
 * scaled by where they live.
 */
function bpfPeer() {
  const d = bpVData().peerSpend || {};
  const p = state.profile || {};
  const band = typeof benchIncomeBand === "function" ? benchIncomeBand(p.incomeAnnual) : "b3";
  const idx = typeof benchHouseholdIndex === "function" ? benchHouseholdIndex(p.householdSize) : 1;
  const pay = Number(((d.payment || {})[band] || [])[idx]) || 0;
  let col = 1;
  try {
    const c = benchColMultipliers(p.zip);
    col = Number(c && c.multipliers && c.multipliers.Transport) || 1;
  } catch (e) { col = 1; }
  const run = bpRound((Number(((d.running || {})[band] || [])[idx]) || 0) * col, 5);
  return { payment: pay, running: run, total: pay + run, band: band,
           household: Math.max(1, parseInt(p.householdSize, 10) || 1) };
}

/**
 * "Peers in Nashville with a similar income". No household size (2026-09-29):
 * onboarding no longer asks it, so the figure reads the profile's default and
 * naming that default would claim something the tester never told us.
 */
function bpfPeerWho() {
  return "Peers in " + bpVCity() + " with a similar income";
}

function bpfPct(n) {
  const inc = bpfIncomeMonthly();
  return inc > 0 ? Math.round((Number(n) || 0) / inc * 100) : null;
}

/**
 * The sticker price peers' monthly payment buys, on the SAME loan settings the
 * tester's own car is priced on. Found by bisection against the engine rather
 * than by a closed form, so tax, fees and rounding are exactly what the engine
 * does — a price computed any other way would buy a slightly different payment.
 */
function bpfPeerPrice(type) {
  const target = bpfPeer().payment;
  if (!target) return 0;
  // Priced as a LOAN whatever the tester said about paying: a payment is the
  // thing being matched, and a cash buyer's car has none, which would send the
  // search to the top of its range.
  const s = bpSession();
  const key = [type, target, s.pay.down, s.pay.downAmount, s.pay.term, s.pay.credit,
               (state.profile || {}).zip].join("|");
  if (s.finderPeerPrice && s.finderPeerPrice.key === key) return s.finderPeerPrice.price;
  let lo = 0, hi = 300000;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const card = { id: "f:peer", inputs: { type: type, tier: "everyday", fuel: "gas", condition: "new", price: mid } };
    const pay = bpRound(bpStack(card, 5, { mode: "loan" }).payment, 5);
    if (pay > target) hi = mid; else lo = mid;
  }
  const price = bpRound(lo, 100);
  s.finderPeerPrice = { key: key, price: price };
  return price;
}

/** The tier whose range holds the peer price, else the nearest one. */
function bpfPeerTier(type, use) {
  const price = bpfPeerPrice(type);
  let best = null, gap = Infinity;
  bpfTiers().forEach(t => {
    const r = bpfTierRange(type, use, t);
    if (!r) return;
    const g = price < r.lo ? r.lo - price : (price > r.hi ? price - r.hi : 0);
    if (g < gap) { gap = g; best = t; }
  });
  return best;
}

/**
 * The car peers' payment buys: the dearest one in the catalog, new or used, at
 * or under the peer price. Same use first — it has to be the same kind of car
 * or it answers a different question — then anything of the same type, then
 * the cheapest used car of that type as a floor so the row is never empty.
 */
function bpfPeerCar(type, use) {
  const price = bpfPeerPrice(type);
  const pool = [];
  bpfModels().filter(m => m.type === type).forEach(m => {
    pool.push({ model: m, cond: "new", price: m.price });
    pool.push({ model: m, cond: "used", price: bpfUsedPrice(m) });
  });
  const pick = list => list.filter(x => x.price <= price)
                           .sort((a, b) => b.price - a.price)[0] || null;
  return pick(pool.filter(x => x.model.use === use)) ||
         pick(pool) ||
         pool.sort((a, b) => a.price - b.price)[0] || null;
}

// ── The quiz ─────────────────────────────────────────────────────────────────

function bpfQuiz() {
  return bpfData().quiz || {};
}

function bpfQuizQuestions() {
  return bpfQuiz().questions || [];
}

function bpfQuizOption(q, id) {
  return (q.options || []).find(o => o.id === id) || null;
}

/** Scores per bucket, and the winner. Ties fall to the order of `buckets`. */
function bpfQuizResult() {
  const a = bpfSession().quiz.answers;
  const scores = {};
  let green = null;
  bpfQuizQuestions().forEach(q => {
    const o = bpfQuizOption(q, a[q.id]);
    if (!o) return;
    Object.keys(o.scores || {}).forEach(k => { scores[k] = (scores[k] || 0) + Number(o.scores[k] || 0); });
    if (o.green) green = o.green;
  });
  const order = bpfQuiz().buckets || [];
  const ranked = order.slice().sort((x, y) => (scores[y] || 0) - (scores[x] || 0) || order.indexOf(x) - order.indexOf(y));
  const split = k => { const p = String(k).split("."); return { type: p[0], use: p[1] }; };
  return { best: split(ranked[0] || "suv.city"), also: ranked.slice(1, 3).map(split),
           scores: scores, green: green };
}

/** The three cars for a bucket and tier, drivetrain they asked for first. */
function bpfCarsFor(type, use, tier, green) {
  const cars = bpfModelsIn(type, use, tier).slice();
  if (green) cars.sort((x, y) => (y.fuel === green) - (x.fuel === green));
  return cars;
}

// ── Session ──────────────────────────────────────────────────────────────────

function bpfSession() {
  const s = bpSession();
  if (!s.finder) {
    s.finder = {
      view: "start",           // start · know · quiz · cars · car
      path: null,              // "know" | "quiz"
      know: { make: null, model: null, cond: null },
      quiz: { answers: {}, editing: null },
      bucket: null,            // { type, use } — the quiz's answer, or a runner-up tapped
      tier: null,
      sel: null                // { id, cond }
    };
  }
  return s.finder;
}
