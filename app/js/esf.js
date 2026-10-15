// ─── Emergency fund — the expense model ──────────────────────────────────────
// Expense rows reuse the budget taxonomy; Buffer is a percentage, not a category.
//
// ── A VIEW, NOT A NEW TAXONOMY ───────────────────────────────────────────────
// Rows cover seven categories, including Other. Every lookup below keys on
// the bare 12-category strings, because those
// strings are the join key across peer-benchmarks, seed-state, monthToDateActuals
// and the help-me-out trees. A parallel set of keys here would be a second join
// key, which is the single most expensive mistake available in this codebase.
//
// Dining out, Subscriptions, Personal care, Entertainment and Shopping are not
// asked about; esfToBaseline() fills them from peers for the category budget.
//
// ── ROWS ARE SMALLER THAN CATEGORIES ─────────────────────────────────────────
// Screens are grouped by how hard a number is to RECALL, not by what it belongs
// to, so two categories split across screens: Transport becomes a car payment
// (typed, first capture step) and running costs (estimated, next step); Utilities becomes
// the locally-priced part and the nationally-priced part. Every row names its
// category, which is the seam back (esfExpensesByCategory).

// ── ROWS GROUP INTO BOXES ────────────────────────────────────────────────────
// `group` is what shares a card. Two rows with the same group sit side by side
// in one box; a group of one gets its own. That is how "Rent | Mortgage" and
// "Car Payments | Public Transportation" become single questions with two
// answers rather than four separate cards.
//
// Rows open blank for recalled amounts or on editable estimates. optIn rows
// contribute only after the tester adds them, to avoid counting included costs.
const ESF_ROWS = [
  // Box 1 — BOTH fields exist on purpose. Somebody can rent and carry a
  // mortgage at the same time, and which of the two carries a figure is what
  // tells us whether property tax and a HOA fee are theirs at all. Asking
  // "do you rent or own?" would get one answer where the truth is sometimes two.
  // Steps are 1-indexed here because step 0 is an INTRO with no fields on it.
  // BOTH are enterable and BOTH are counted — not an either/or. People rent and
  // carry a mortgage at the same time, and people with a car payment also buy
  // transit passes. An either/or picker would lose one of their figures.
  { id: "rent",     label: "Rent",     category: "Housing", step: 1, group: "roof",
    groupLabel: "What you pay for your home", prefill: false },
  { id: "mortgage", label: "Mortgage", category: "Housing", step: 1, group: "roof",
    prefill: false },

  // The payment only. Running costs are a step later, and a tester who folds
  // fuel in here would have it counted twice.
  { id: "carPayment", label: "Car Payments", category: "Transport", step: 1,
    group: "ride", groupLabel: "Getting around", prefill: false },
  { id: "transit", label: "Public Transportation", category: "Transport", step: 1,
    group: "ride", prefill: false },

  // ── Keeping things running ─────────────────────────────────────────────────
  { id: "power", label: "Home utilities", category: "Utilities", step: 2,
    group: "power", groupLabel: "Home utilities, including water, gas, and electricity",
    prefill: true, source: "power", bandWidth: 100 },

  // ONE row, not two. Both are priced nationally and arrive on the same kind of
  // bill; splitting them asked the tester to apportion something they have no
  // reason to have apportioned.
  { id: "connect", label: "Phone and internet", category: "Utilities", step: 2,
    group: "connect", groupLabel: "Staying Connected", prefill: true,
    source: "connectivity" },

  { id: "groceries", label: "Groceries", category: "Groceries", step: 2,
    group: "food", groupLabel: "Food Expenses (Groceries)", prefill: true, source: "groceries" },

  // ONE medical row, priced on what health cover would cost if the job went.
  // That is the whole point of the fund: the figure worth saving toward is the
  // one that applies when the paycheck has stopped, not the payroll deduction
  // that stops with it.
  //
  // It sits with the running costs rather than the conditional ones because
  // almost everybody has a medical figure — unlike property tax or a HOA fee,
  // which only some testers ever see.
  { id: "medical", label: "Medical (Insurance, Dental, Vision)", category: "Health", step: 2,
    group: "medical", prefill: true, source: "medical" },

  // ── Living-related expenses ────────────────────────────────────────────────
  // NO DEFAULT FIGURE. Every other estimate opens on a number because we can
  // work one out; this one we cannot — minimum payments depend on balances and
  // card count, which nothing asks for. A pre-filled guess here would be the
  // tool inventing debt the tester may not have.
  { id: "debt", label: "Credit Card and Loan Minimums", category: "Debt payments", step: 3,
    group: "debt", prefill: false, optIn: true, startAtZero: true, options: "debt" },

  // ── Housing extras ────────────────────────────────────────────────────────
  //
  // ANNUAL, because that is the number printed on the bill. Asking somebody to
  // divide their tax bill by twelve before they can answer is arithmetic, not
  // recall; the monthly figure is shown back to them instead.
  // `labelNote` rides alongside the bold label in lighter type. The caveat is
  // the thing a tester needs at the moment they read the label — telling them
  // underneath the box, after they have already typed, is too late.
  { id: "propertyTax", label: "Annual Property Tax", labelNote: "(may be included in mortgage)",
    category: "Housing", step: 3,
    group: "tax", prefill: true, cadence: "annual", source: "propertyTax", showIf: "owns",
    optIn: true },

  // Escrowed as often as property tax is, so it gets the same treatment.
  { id: "homeInsurance", label: "Home Insurance", labelNote: "(may be included in mortgage)",
    category: "Housing", step: 3,
    group: "homeInsurance", prefill: true, bill: "homeInsurance", showIf: "owns",
    optIn: true },

  { id: "hoa", label: "HOA, Condo, or Housing Fees", labelNote: "(if not included already)",
    category: "Housing", step: 3,
    group: "hoa", prefill: true, source: "hoa", showIf: "hoa", optIn: true },

  // The catch-all. Opens BLANK rather than on an estimate — there is nothing to
  // estimate, and a figure in a box called "anything else" would be the tool
  // inventing an expense the tester never mentioned.
  { id: "anythingElse", label: "Anything else to include", category: "Other", step: 3,
    group: "anythingElse", prefill: false },

  // Combine running costs so the tester need not recall three bills. Keep
  // components separate in the model for pricing and explanations.
  { id: "carCosts", label: "Car: Fuel + Insurance + Maintenance", category: "Transport", step: 2,
    group: "carRunning", groupLabel: "Car: Fuel + Insurance + Maintenance", prefill: true,
    source: "carCosts" }
];

// ─── Who lives here ──────────────────────────────────────────────────────────
// Onboarding asks for adults with age ranges and kids in two buckets. Everything
// downstream reads it through here. Profiles without age answers fall back to
// adults-only at a representative age so skipping still produces estimates.
function esfHousehold() {
  const p = state.profile || {};
  const size = Math.max(1, parseInt(p.householdSize, 10) || 1);
  const kids = { under13: 0, teen: 0 };
  let adults = Array.isArray(p.adults) ? p.adults.filter(Boolean) : null;

  if (p.kids) {
    kids.under13 = Math.max(0, parseInt(p.kids.under13, 10) || 0);
    kids.teen    = Math.max(0, parseInt(p.kids.teen, 10) || 0);
  }
  if (!adults || !adults.length) {
    const n = Math.max(1, size - kids.under13 - kids.teen);
    adults = [];
    for (let i = 0; i < n; i++) adults.push({ age: ESF_DEFAULT_ADULT_AGE });
  }

  const people = adults.length + kids.under13 + kids.teen;
  return {
    adults: adults,
    adultCount: adults.length,
    kids: kids,
    people: people,
    // Phone lines and the premium both count teenagers as people; groceries
    // weight them differently. Exposed separately so neither has to re-derive it.
    teens: kids.teen,
    youngKids: kids.under13
  };
}

// The middle of the ONB_ADULT_AGES bands — used only where onboarding never ran.
const ESF_DEFAULT_ADULT_AGE = 40;

/** Does health cover come through a job? The only coverage that ends with it. */
function esfHasEmployerCoverage() {
  return ((state.profile || {}).coverage || null) === "employer";
}

/** The onboarding place type, or null when it was never asked. */
function esfPlaceType() {
  return (state.profile || {}).placeType || null;
}

// ─── Driving ─────────────────────────────────────────────────────────────────

function esfDriving() {
  return esfData().driving || {};
}

/** Pump price where they live — a listed state, else the national average. */
function esfPerGallon() {
  const d = esfDriving();
  let st = null;
  try { st = (benchColMultipliers(state.profile.zip).county || {}).state || null; }
  catch (e) { st = null; }
  const byState = d.perGallonByState || {};
  return Number(byState[st]) || Number(d.nationalPerGallon) || 0;
}

/**
 * Insurance, from the two things this app actually knows: where they live, and
 * what their car payment implies about what the car is worth.
 *
 * NOT from demographics. Age, record and claims history are what really move a
 * premium and none of them are collected anywhere — so they are not in here, and
 * the row says as much rather than implying a precision it does not have.
 */
function esfInsuranceEstimate() {
  const d = esfDriving();

  // ── STATE AVERAGE, NOT A COST-OF-LIVING MULTIPLIER ─────────────────────────
  // Premiums are set by state regulation, minimum-coverage law, litigation
  // climate and weather losses. None of that tracks the price of a restaurant
   // meal, so the Transport COL index cannot represent their variation.
  //
  // The state figure is therefore the BASE, not a modifier on a national one.
  const base = esfInsuranceStateMonthly();

  const typical = Number(d.typicalCarPayment) || 0;
  const range = d.paymentFactorRange || [0.8, 1.4];
  let factor = 1;
  const payment = Number((state.esf && state.esf.rows && state.esf.rows.carPayment) || 0);
  if (typical && payment) {
    factor = Math.min(range[1], Math.max(range[0], payment / typical));
  }

  return esfRound(base * factor);
}

/**
 * The state's average full-coverage premium, monthly.
 *
 * Resolved from the ZIP's state through benchColMultipliers, which already does
 * the ZIP → county → state walk. Falls back to the national figure for a state
 * not in the table or a ZIP that resolves to nothing — never to zero, which
 * would quietly remove the largest component of running a car.
 */
function esfInsuranceStateMonthly() {
  const d = esfDriving();
  const national = Number(d.insuranceAnnualNational) || 0;
  const byState = d.insuranceAnnualByState || {};
  let annual = national;
  try {
    // The state CODE lives on the county row, not on `col.state` — that is the
    // state's data object (electricity rate and ratio) and carries no name.
    const col = benchColMultipliers(state.profile.zip);
    const code = col && col.county ? col.county.state : null;
    const hit = code ? Number(byState[String(code).toUpperCase()]) : NaN;
    if (isFinite(hit) && hit > 0) annual = hit;
  } catch (e) {}
  return annual / 12;
}

// ─── Phone and internet ──────────────────────────────────────────────────────

/**
 * Lines = adults plus kids old enough to carry a phone, capped.
 *
 * Count teenagers but not younger children, who do not need their own line.
 */
function esfPhoneLines() {
  const hh = esfHousehold();
  const cap = Number((esfData().connectivity || {}).maxLines) || 5;
  return Math.max(1, Math.min(cap, hh.adultCount + hh.teens));
}

/**
 * One figure for phone and internet together, priced NATIONALLY.
 *
 * No cost-of-living multiplier, ever. A carrier and an ISP charge the same
 * everywhere, and running them through the Utilities multiplier overstated the
 * bill by more than leaving them flat ever did.
 */
function esfConnectivity() {
  const c = esfData().connectivity || {};
  const lines = esfPhoneLines();
  const table = c.perLine || {};
  // Per-line price falls as lines are added; past the table's last entry the
  // cheapest rate stands rather than falling back to the single-line price.
  const rate = Number(table[String(lines)]) ||
               Number(table[String(Object.keys(table).length)]) || 0;
  return esfRound(rate * lines + (Number(c.internet) || 0));
}

// ─── Groceries ───────────────────────────────────────────────────────────────

/**
 * The peer grocery figure, adjusted for WHO is in the household.
 *
 * The peer value already scales with household SIZE, so this is a ratio against
 * that size rather than a second per-person build-up — which would double-count
 * it. Four adults comes out at exactly the peer figure; two adults and two small
 * children comes out below it, because a five-year-old does not eat like an
 * adult.
 */
function esfGroceries() {
  const peer = Number(benchPeerValue("Groceries", benchOptsForUser())) || 0;
  const hh = esfHousehold();
  const w = (esfData().groceries || {}).weight || {};
  if (!hh.people) return esfRound(peer);

  const weighted = hh.adultCount * (Number(w.adult) || 1) +
                   hh.teens      * (Number(w.teen) || 1) +
                   hh.youngKids  * (Number(w.under13) || 1);
  return esfRound(peer * (weighted / hh.people));
}

// ─── Car ─────────────────────────────────────────────────────────────────────

/** Miles a day from onboarding. Zero is a real answer — "I don't drive". */
function esfMilesPerDay() {
  const p = state.profile || {};
  const m = Number(p.milesPerDay);
  if (isFinite(m) && p.milesRange) return m;
  return null;   // never asked
}

/** Fuel or charging, from miles driven and the local pump price. */
function esfFuelEstimate() {
  const d = esfDriving();
  const miles = esfMilesPerDay();
  if (miles === 0) return 0;
  const perDay = miles == null ? null : miles;
  const mpg = Number(d.milesPerGallon) || 25;
  const perGallon = esfPerGallon();
  if (perDay == null || !mpg || !perGallon) {
    // Never asked — fall back to the peer split, so the row still shows a
    // plausible figure rather than a zero (D19).
    return esfCarOpeningSplit(benchOptsForUser()).fuel;
  }
  return esfRound(perDay * ESF_DAYS_PER_MONTH * (perGallon / mpg));
}

/** Upkeep follows distance, at AAA's per-mile rate. */
function esfMaintenanceFromMiles() {
  const d = esfDriving();
  const miles = esfMilesPerDay();
  if (miles === 0) return 0;
  if (miles == null) return esfCarOpeningSplit(benchOptsForUser()).maintenance;
  return esfRound(miles * ESF_DAYS_PER_MONTH * (Number(d.maintenancePerMile) || 0));
}

const ESF_DAYS_PER_MONTH = 30.4;

/** Everything a car costs to run: fuel or charging, insurance, and upkeep. */
function esfCarCosts() {
  return esfRound(esfFuelEstimate() + esfCarInsurance() + esfMaintenanceFromMiles());
}

/**
 * Insurance, separate from the other two because it is NOT mileage-driven —
 * somebody who barely drives still pays most of a premium. Kept as its own
 * function so the combined box can still be taken apart.
 */
function esfCarInsurance() {
  // ── "I don't drive" IS TREATED AS "no car" ─────────────────────────────────
  // A parked car still carries insurance, so zeroing on mileage is wrong in
  // principle. It is kept because nothing in this flow asks whether the tester
  // OWNS a car — "I don't drive" is the only signal there is, and charging a
  // premium to somebody who told us they do not drive is the more visible of
  // the two errors. The honest fix is a car-ownership question in onboarding;
  // flagged in the spec's Open items rather than decided here.
  if (esfMilesPerDay() === 0) return 0;
  return esfInsuranceEstimate();
}

/**
 * Medical, priced on what cover costs once the job has gone.
 *
 * That is the honest figure for a fund whose whole purpose is surviving a lost
 * paycheck: an employer deduction stops when the employer does. Anyone already
 * buying their own cover, or on Medicaid or Medicare, keeps paying what they
 * pay — so for them this is just the peer figure.
 */
function esfMedical() {
  if (esfHasEmployerCoverage()) return esfReplacementPremium();
  return esfRound(benchPeerValue("Health", benchOptsForUser()));
}

// ─── The unemployed-insurance premium ────────────────────────────────────────

/** The ACA factor for one age, interpolated between the published anchors. */
function esfAgeFactor(age) {
  const curve = (esfData().aca || {}).ageCurve || {};
  const ages = Object.keys(curve).map(Number).sort((a, b) => a - b);
  if (!ages.length) return 1;
  const n = Number(age) || ESF_DEFAULT_ADULT_AGE;
  if (n <= ages[0]) return Number(curve[ages[0]]);
  if (n >= ages[ages.length - 1]) return Number(curve[ages[ages.length - 1]]);
  for (let i = 1; i < ages.length; i++) {
    if (n <= ages[i]) {
      const lo = ages[i - 1], hi = ages[i];
      const t = (n - lo) / (hi - lo);
      return Number(curve[lo]) + t * (Number(curve[hi]) - Number(curve[lo]));
    }
  }
  return 1;
}

/**
 * What health cover would cost if the paycheck stopped.
 *
 * Only ever non-zero for employer coverage — that is the only kind that ends
 * with the job. Priced the way the marketplace actually prices: a benchmark
 * plan for the area times the sum of each person's age factor, with children
 * at a flat factor and only the three oldest counted. Both of those are the
 * published rules rather than simplifications.
 *
 * Deliberately UNSUBSIDISED, which is conservative — someone whose income drops
 * to nothing usually qualifies for a large subsidy. Right for a safety net, but
 * the copy must not imply it is the only outcome.
 */
function esfReplacementPremium() {
  if (!esfHasEmployerCoverage()) return 0;

  const aca = esfData().aca || {};
  let benchmark = Number(aca.benchmarkSilver) || 0;
  try {
    const st = (benchColMultipliers(state.profile.zip).county || {}).state;
    const byState = aca.benchmarkByState || {};
    if (st && byState[st] != null) benchmark = Number(byState[st]);
  } catch (e) { /* national benchmark stands */ }

  const hh = esfHousehold();
  let factor = hh.adults.reduce((sum, a) => sum + esfAgeFactor(a && a.age), 0);

  const childFactor = Number(aca.childFactor) || 0;
  const counted = Math.min(hh.youngKids + hh.teens, Number(aca.maxChildrenCounted) || 3);
  factor += counted * childFactor;

  return esfRound(benchmark * factor);
}

// ─── Housing extras ──────────────────────────────────────────────────────────

/** Is there an HOA row at all? Renters never see one. */
function esfHoaApplies() {
  const shown = (esfData().hoa || {}).shownFor || [];
  const type = esfPlaceType();
  if (!type) return esfOwnsHome();   // no place answer — use the ownership fallback
  return shown.indexOf(type) !== -1;
}

/**
 * HOA by PROPERTY TYPE, never by ZIP.
 *
 * Fees are bimodal — most houses carry none, condos and townhomes almost always
 * carry one — so a ZIP-based estimate can invent a fee for a house owner.
 */
function esfHoaEstimate() {
  const table = (esfData().hoa || {}).byPlaceType || {};
  const type = esfPlaceType();
  const base = Number(table[type]);
  if (!isFinite(base) || base <= 0) return 0;
  // No Housing multiplier: property type determines whether a fee exists.
  // National figures can understate expensive metros; this avoids inventing
  // large fees from an unrelated rent-derived index.
  return esfRound(base);
}

/**
 * Property tax, estimated but NOT counted until the tester adds it.
 *
 * Four in five mortgages escrow it, so a pre-filled figure double-counts for
 * most owners — and a number already in the box is accepted without thought
 * more readily than an empty one. The single place the err-high rule is
 * deliberately reversed.
 */
function esfPropertyTaxEstimate() {
  const t = esfData().propertyTax || {};
  let rate = Number(t.nationalRate) || 0;
  let mult = 1;
  try {
    const col = benchColMultipliers(state.profile.zip);
    const st = (col.county || {}).state;
    if (st && (t.rateByState || {})[st] != null) rate = Number(t.rateByState[st]);
    const m = Number((col.multipliers || {}).Housing);
    if (isFinite(m) && m > 0) mult = m;
  } catch (e) { /* national figures stand */ }
  // The multiplier is rent-derived and home values disperse further than rents,
  // so it is raised by a documented stub exponent before it prices a house.
  const disp = Number(t.valueDispersion) || 1;
  const value = (Number(t.nationalHomeValue) || 0) * Math.pow(mult, disp);
  return esfRound(value * rate / 12);
}

/**
 * Is this row's precondition met?
 *
 * Hidden rows must also be excluded from totals (esfRowMonthly). Ownership
 * and place type determine visibility, not the rent/mortgage amounts entered.
 */
function esfRowShows(row) {
  if (!row || !row.showIf) return true;
  if (row.showIf === "owns")     return esfOwnsHome();
  if (row.showIf === "hoa")      return esfHoaApplies();
  if (row.showIf === "employer") return esfHasEmployerCoverage();
  return true;
}

/** The boxes for a step, in order — rows sharing a `group` share a card. */
function esfGroupsForStep(step) {
  const out = [];
  esfRowsForStep(step).filter(esfRowShows).forEach(r => {
    const last = out[out.length - 1];
    if (last && last.id === r.group) { last.rows.push(r); return; }
    out.push({ id: r.group, rows: [r] });
  });
  return out;
}

// ── Behavioural knobs ────────────────────────────────────────────────────────
// Kept in ONE object so they can move without touching the flow (spec §8). The
// figures these sit beside live in data/emergency-fund.json instead — the house
// split is that a sourced number is data and a policy choice is code, and every
// value here is a policy choice with nobody to cite for it.
const ESF_CONFIG = {
  // Household of one → 3 months, anyone else → 6.
  coverageSingle: 3,
  coverageDefault: 6,
  coverageChoices: [3, 6, 9],

  // What each coverage length means, shown under the picker so the choice is
  // informed by something other than the number being bigger. Descriptive, never
  // prescriptive (D26) — "may be appropriate for", not "you should pick".
  coverageNotes: {
    3: "Lowest amount of coverage. May be appropriate for renters and individuals",
    6: "Typical amount of coverage. May be appropriate for homeowners and families",
    9: "Longer term savings to feel best coverage"
  },

  // Buffer is a percentage on the total, not a line item: "an increase over the
  // actual spend to allow for unspecified but likely expenses" (owner). It
  // therefore has no peer figure and no source — it is a margin the tester
  // dials, and the dropdown exists so the common answers are one tap.
  bufferDefault: 0.10,
  bufferChoices: [-0.20, -0.10, 0, 0.10, 0.20, 0.30],

  // Default months from today for the target date.
  //
  // 24 is a prototype placeholder, not a researched figure. The saving horizon
  // differs from coverage: saving six months of expenses in six months would
  // require banking a full month's expenses every month.
  targetMonths: 24,

  // The goal itself rounds to the nearest $500 — see esfTarget.
  targetRoundTo: 500,

  // Everything rounds to the nearest 5, matching PEER_BENCHMARKS.method.roundTo
  // so an ESF figure and the peer figure beside it never disagree by $2 for
  // reasons no tester could see.
  roundTo: 5
};

function esfData() {
  return (typeof EMERGENCY_FUND !== "undefined" && EMERGENCY_FUND) || {};
}

function esfRound(n) {
  const step = ESF_CONFIG.roundTo || 5;
  return Math.max(0, Math.round((Number(n) || 0) / step) * step);
}

function esfRow(id) {
  return ESF_ROWS.find(r => r.id === id) || null;
}

function esfRowsForStep(step) {
  return ESF_ROWS.filter(r => r.step === step);
}

// ─── Opening figures ─────────────────────────────────────────────────────────

/**
 * Power, water and gas for this home — the LOCAL part of utilities.
 *
 * Home size comes from onboarding, falling back to household size when absent.
 *
 * The cost-of-living multiplier is applied ONCE, here, and the underlying rate
 * stays national. Reaching for the state electricity ratio inside the model as
 * well would square it and overstate the estimate.
 */
function esfPowerEstimate() {
  const rates = ((hmoTree("Utilities") || {}).rates) || {};
  const home = esfHomeKey();
  const kwh = Number((rates.kwhByHome || {})[home]) || 0;
  const power = (kwh * (Number(rates.nationalCentsPerKwh) || 0)) / 100;
  const water = Number((rates.waterByHome || {})[home]) || 0;
  // Gas comes from this tool's table; the shared utilities rates have none.
  const gas = Number(((esfData().utilities || {}).gasByHome || {})[home]) || 0;

  // ── THREE UTILITIES, TWO GEOGRAPHIES ───────────────────────────────────────
  // The Utilities multiplier is an ELECTRICITY RATE ratio and nothing else —
  // built from EIA state cents-per-kWh, not municipal water or pipeline gas.
  //
  // Power keeps the rate ratio. Water and gas take the composite regional price
  // level, which is what "things cost a bit more here" actually looks like:
  // 1.18 in San Carlos rather than 2.60.
  const u = esfData().utilities || {};
  const cap = Number(u.electricityCapMultiplier) || Infinity;
  const power$ = power * Math.min(esfUtilitiesRateMultiplier(), cap);
  const local$ = (water + gas) * esfGeneralPriceLevel();

  const figure = esfRound(power$ + local$);
  // No rate table (a failed data load) — the peer figure rather than a zero.
  if (!figure) return esfRound(benchPeerValue("Utilities", benchOptsForUser()));
  return figure;
}

/**
 * The Utilities cost-of-living multiplier — an ELECTRICITY RATE ratio.
 *
 * Named for what it is rather than for the category it is filed under, because
 * the category name is what invited it to be applied to water and gas.
 */
function esfUtilitiesRateMultiplier() {
  try {
    const m = Number((benchColMultipliers(state.profile.zip).multipliers || {}).Utilities);
    if (isFinite(m) && m > 0) return m;
  } catch (e) {}
  return 1;
}

/**
 * The composite regional price level (BEA RPP, all items) as a multiplier.
 *
 * For costs that are genuinely local but do not track any single category's
 * index — municipal water, piped gas. Far milder than the housing or
 * electricity columns, which is the point: 1.18 in San Carlos against 2.02 and
 * 2.60. Falls back to 1, never to another category's multiplier.
 */
function esfGeneralPriceLevel() {
  try {
    const col = benchColMultipliers(state.profile.zip);
    const all = col && col.geo ? Number(col.geo.all) / 100 : NaN;
    if (isFinite(all) && all > 0) return all;
  } catch (e) {}
  return 1;
}

/** The help-me-out home-size key for this profile's place type. */
function esfHomeKey() {
  const type = esfPlaceType();
  if (type && typeof ONB_PLACE_TYPES !== "undefined") {
    const match = ONB_PLACE_TYPES.find(p => p.id === type);
    if (match && match.home) return match.home;
  }
  // No place answer — household size is the fallback proxy.
  const table = (esfData().utilitiesSplit || {}).homeByHousehold || {};
  const hh = Math.max(1, parseInt((state.profile || {}).householdSize, 10) || 1);
  return table[String(Math.min(hh, 4))] || "apt2";
}

/**
 * Opening figures for the three car fields, split so they SUM to the peer
 * Transport figure.
 *
 * That identity is the point: the peer model already says what running a car
 * costs for this profile in this place, and three fields that quietly add up to
 * something else would put the tool at odds with every other Transport figure
 * in the app. So insurance is priced first (it is the one with its own
 * evidence), the remainder buys a mileage, and AAA's own split of operating
 * cost divides that between fuel and maintenance.
 *
 * Reads nothing off the session, so it is safe during esfStart().
 */
function esfCarOpeningSplit(opts) {
  const d = esfDriving();
  const rates = ((hmoTree("Transport") || {}).rates) || {};
  const opPerMile = Number((rates.opCostPerMile || {}).midsize) || 0;
  const maintPerMile = Number(d.maintenancePerMile) || 0;

  const insurance = esfInsuranceEstimate();
  const peer = Number(benchPeerValue("Transport", opts)) || 0;

  if (!opPerMile || opPerMile <= maintPerMile) {
    return { fuel: 0, carInsurance: insurance, maintenance: 0 };
  }

  const miles = Math.max(0, peer - insurance) / opPerMile;
  return {
    fuel: esfRound(miles * (opPerMile - maintPerMile)),
    carInsurance: insurance,
    maintenance: esfRound(miles * maintPerMile)
  };
}

/**
 * What every row opens on.
 *
 * The estimated rows read benchPeerValue for their category — the same model
 * the budget builder opens its sliders on, so a tester who does both sees the
 * same figures in both places rather than two tools disagreeing about what
 * groceries cost.
 *
 * Transport is the one category whose peer figure does NOT cover both its rows:
 * PEER_BENCHMARKS prices running costs (AAA operating cost plus insurance) and
 * carries no loan repayment at all, so the whole figure belongs to the running
 * row and the car payment opens blank. That is not a gap to paper over — a car
 * payment is a number people know exactly, which is why it sits on screen 1.
 */
function esfOpeningValues() {
  const opts = benchOptsForUser();
  const car = esfCarOpeningSplit(opts);
  const out = {};

  ESF_ROWS.forEach(r => {
    if (!r.prefill) { out[r.id] = null; return; }
    // Each estimated row names the model that fills it. Anything without a
    // named source falls through to the peer figure for its category.
    if (r.source === "power")        { out[r.id] = esfPowerEstimate(); return; }
    if (r.source === "connectivity") { out[r.id] = esfConnectivity(); return; }
    if (r.source === "groceries")    { out[r.id] = esfGroceries(); return; }
    if (r.source === "carCosts")     { out[r.id] = esfCarCosts(); return; }
    if (r.source === "medical")      { out[r.id] = esfMedical(); return; }
    if (r.source === "hoa")          { out[r.id] = esfHoaEstimate(); return; }
    // Annual rows store the ANNUAL figure — the estimate is monthly, so it is
    // scaled here and divided back out by esfRowMonthly. One conversion, one
    // place.
    if (r.source === "propertyTax")  { out[r.id] = esfRound(esfPropertyTaxEstimate() * 12); return; }
    if (car[r.id] != null)           { out[r.id] = car[r.id]; return; }
    if (r.bill) {
      // A local figure from data/emergency-fund.json, carrying the ZIP's
      // multiplier for the bill's category. Annual rows are stored annual.
      const monthly = esfBillEstimate(esfBills().find(b => b.id === r.bill));
      out[r.id] = r.cadence === "annual" ? esfRound(monthly * 12) : monthly;
      return;
    }
    out[r.id] = esfRound(benchPeerValue(r.category, opts));
  });

  return out;
}

// ─── Bills priced from data ──────────────────────────────────────────────────
// A row that names a `bill` opens on that bill's figure from
// data/emergency-fund.json. Home insurance is the only one.

function esfBills() {
  return ((esfData().irregularBills || {}).bills) || [];
}

/**
 * The estimate for one bill. A bill that names a category (`col`) gets that
 * category's cost-of-living multiplier — through benchColMultipliers, never
 * around it.
 */
function esfBillEstimate(bill) {
  if (!bill) return 0;
  const base = Number(bill.value) || 0;
  if (!bill.col) return esfRound(base);
  try {
    const m = Number((benchColMultipliers(state.profile.zip).multipliers || {})[bill.col]);
    return esfRound(base * (isFinite(m) && m > 0 ? m : 1));
  } catch (e) { return esfRound(base); }
}

// ─── The session ─────────────────────────────────────────────────────────────

function esfStart() {
  // Clear FIRST: opening car insurance reads state.esf's car payment. A new
  // run must not inherit the previous run's inputs.
  state.esf = null;
  const opening = esfOpeningValues();
  state.esf = {
    step: 0,
    opening: opening,                 // frozen — what the tool guessed
    rows: Object.assign({}, opening),  // live — what the tester settled on
    touched: {},                      // row id → true once they changed it
    added: {},                        // opt-in row id → true once added
    buffer: ESF_CONFIG.bufferDefault,
    coverageMonths: null,             // null → derived from household size
    startingBalance: 0,
    targetDate: esfDefaultTargetDate()
  };
  go("esfBuild");
}

function esfSession() {
  if (!state.esf) esfStart();
  return state.esf;
}

/** True when this goal is the one the emergency fund created. */
function esfIsEsfGoal(goal) {
  return !!(goal && state.esfGoal && goal.id === state.esfGoal.id);
}

/**
 * Any goal that IS an emergency fund, however it got there.
 *
 * Match labels too: a seed or manually created goal need not carry our id.
 */
function esfLooksLikeEsfGoal(goal) {
  if (!goal) return false;
  if (esfIsEsfGoal(goal)) return true;
  return /emergency\s*(savings\s*)?fund/i.test(String(goal.label || ""));
}

/**
 * Reopen the tool from the goal card.
 *
 * RESUMES rather than restarts: the session is still on state.esf with every
 * figure the tester entered, so it rewinds to the intro and walks forward
 * through their own numbers. Calling esfStart() here would wipe them and hand
 * back peer estimates, which is the opposite of "open my fund again".
 *
 * It lands on the intro rather than the plan screen deliberately — "open the
 * tool" should open the tool. If reviewing the number turns out to be the
 * common case, landing on esfPlan instead is a one-line change.
 */
function esfReopen() {
  if (state.esf) { state.esf.step = 0; go("esfBuild"); return; }
  esfStart();
}

/**
 * Ownership gates housing extras. Apartments are excluded; other places count
 * as owned during a session so testers can see the opt-in rows. Outside a
 * session use ownsHome, then raw paysRent, defaulting to true.
 * Do not use benchLifestyleKey: it merges rent and mortgage into the same key
 * because the peer model measures housing cost, not ownership.
 */
function esfOwnsHome() {
  // An APARTMENT settles it: nobody owning their home calls it an apartment,
  // so there is no property tax and no home insurance to ask about. Condos and
  // houses are ambiguous — either can be rented — so they fall through to the
  // session check, then the profile and raw paysRent fallback.
  const place = esfPlaceType();
  if (place === "aptSmall" || place === "aptLarge") return false;

  // Inside a running session anyone not in an apartment counts as an owner,
  // whatever they type for rent or mortgage, so the owner-only rows stay
  // visible during testing.
  if (state.esf) return true;

  const profile = state.profile || {};
  if (profile.ownsHome != null) return !!profile.ownsHome;

  const raw = (state.lifestyle || {}).paysRent;
  if (raw === "mortgage" || raw === "own") return true;
  if (raw === "rent") return false;       // an explicit answer still wins
  return true;
}

function esfDefaultTargetDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + ESF_CONFIG.targetMonths);
  return d.toISOString().slice(0, 10);
}

/** A row's live figure. A blank row is zero. */
function esfRowValue(rowId) {
  const s = esfSession();
  const v = s.rows[rowId];
  return v == null ? 0 : (Number(v) || 0);
}

/** Untouched estimates are what the "this will sharpen" line counts. */
function esfRowsRemaining() {
  const s = esfSession();
  return ESF_ROWS.filter(r => !s.touched[r.id]).length;
}

// ─── The arithmetic ──────────────────────────────────────────────────────────

/** Household of one → 3 months, everyone else → 6, unless overridden. */
function esfCoverageMonths() {
  const s = esfSession();
  if (s.coverageMonths) return s.coverageMonths;
  const hh = Math.max(1, parseInt((state.profile || {}).householdSize, 10) || 1);
  return hh === 1 ? ESF_CONFIG.coverageSingle : ESF_CONFIG.coverageDefault;
}

// ─── Ranges ──────────────────────────────────────────────────────────────────
// Estimated figures are picked from a dropdown of ranges, never typed. Nobody
// knows their power bill to the dollar, and a range is both easier to answer and
// more honest about what an estimate is.
//
// Band width scales with the figure. A flat $50 band is absurd on a $60 phone
// bill and useless on a $2,000 mortgage, so the step follows the magnitude.

const ESF_BANDS = [
  { under: 100,   width: 25 },
  { under: 500,   width: 50 },
  { under: 1500,  width: 100 },
  { under: 6000,  width: 250 },
  { under: Infinity, width: 1000 }
];

/**
 * How wide a band is at this figure.
 *
 * A row can override it. Home utilities does: it is three bills in one figure
 * — power, water and gas — so it runs from under $100 to past $700 depending on
 * the house and the season, and $50 steps would make a dropdown nobody wants to
 * scroll.
 */
function esfBandWidth(value, row) {
  if (row && row.bandWidth) return row.bandWidth;
  const v = Math.max(0, Number(value) || 0);
  const band = ESF_BANDS.find(b => v < b.under) || ESF_BANDS[ESF_BANDS.length - 1];
  return band.width;
}

/** The band a figure falls in: its floor, ceiling and midpoint. */
function esfBandFor(value, row) {
  const v = Math.max(0, Number(value) || 0);
  const w = esfBandWidth(v, row);
  const lo = Math.floor(v / w) * w;
  return { lo: lo, hi: lo + w, mid: lo + w / 2, width: w };
}

const ESF_BANDS_BELOW = 4;
const ESF_BANDS_ABOVE = 5;

/**
 * The ranges offered for a row, centred on where its figure currently sits.
 *
 * A zero option comes first — "none of this applies to me" is a real answer for
 * a HOA fee or a car, and without it the lowest choice would still charge them
 * something.
 */
function esfBandOptions(value, row) {
  const here = esfBandFor(value, row);
  const out = [{ lo: 0, hi: 0, mid: 0, zero: true }];
  for (let i = -ESF_BANDS_BELOW; i <= ESF_BANDS_ABOVE; i++) {
    const lo = here.lo + i * here.width;
    if (lo < 0) continue;
    if (lo === 0 && here.width === here.lo) continue;
    out.push({ lo: lo, hi: lo + here.width, mid: lo + here.width / 2 });
  }
  return out;
}

/**
 * The debt row's options: every plausible mix of cards and loans, each labelled
 * with what it stands for.
 *
 * This row is the one estimate the app cannot make — minimums depend on card
 * count and balances, and onboarding asks for neither. Offering dollar bands
 * would ask the tester to convert their situation into a number in their head.
 * Offering "1 loan + 1 card" asks them to recognise it instead, and the figure
 * comes out the other side.
 */
function esfDebtOptions() {
  const list = (esfData().debt || {}).options || [];
  return list.map(o => {
    const lo = Number(o.lo) || 0;
    const hi = Number(o.hi) || 0;
    if (!hi) return { mid: 0, zero: true, note: o.label };
    return { lo: lo, hi: hi, mid: esfRound((lo + hi) / 2), note: o.label };
  });
}

/**
 * "$100 – $150", or "$0" for the zero option.
 *
 * An ANNUAL band carries its monthly equivalent in parentheses — "$4,000 –
 * $4,500 ($354/mo)" — the same amount restated, not a second cost.
 */
function esfBandLabel(band, row) {
  if (band && band.zero && band.note) return band.note;
  if (!band || band.zero) return esfMoney(0);
  // A debt option leads with the SITUATION and carries its range after it —
  // "A loan, maybe a card ($250 – $350)". The tester is recognising their own
  // circumstances, not picking a number, so the words come first.
  if (band.note) return band.note + " (" + esfMoney(band.lo) + " – " + esfMoney(band.hi) + ")";
  const span = esfMoney(band.lo) + " – " + esfMoney(band.hi);
  if (row && row.cadence === "annual") {
    return span + " (" + esfMoney(band.mid / 12) + "/mo)";
  }
  return span;
}

// ─── Opt-in rows ─────────────────────────────────────────────────────────────
// Property tax and home insurance are estimated but contribute NOTHING until
// the tester adds them. Four in five mortgages escrow both, so a pre-filled
// figure double-counts for most owners — and a number already sitting in a box
// gets accepted without thought more readily than an empty one. The single
// place the err-high rule is deliberately reversed.

function esfRowAdded(rowId) {
  const s = esfSession();
  return !!(s.added && s.added[rowId]);
}

function esfToggleRow(rowId) {
  const s = esfSession();
  if (!s.added) s.added = {};
  if (s.added[rowId]) delete s.added[rowId];
  else s.added[rowId] = true;
  esfLog("row_toggled", { row: rowId, added: !!s.added[rowId] });
  render();
}

/**
 * A row's contribution to a MONTH.
 *
 * Annual rows store the annual figure, because that is what the tester read off
 * the bill and what the field shows them. Everything downstream is monthly, so
 * the divide happens here and exactly here — a second one anywhere else divides
 * a property tax bill by 144.
 */
function esfRowMonthly(rowId, ignoreOptIn) {
  const row = esfRow(rowId);
  // `ignoreOptIn` asks what the row WOULD contribute — what the Add-it button
  // has to show, since a figure of $0 tells the tester nothing about whether
  // adding it is worth a tap.
  if (ignoreOptIn && row) {
    const raw = esfRowValue(rowId);
    return row.cadence === "annual" ? raw / 12 : raw;
  }
  // A row the tester never sees must not be in their total. Filtering only the
  // render would leave property tax silently priced into a renter's target —
  // invisible on screen and impossible to argue with.
  if (!esfRowShows(row)) return 0;
  // An opt-in row is estimated but weightless until the tester adds it.
  if (row && row.optIn && !esfRowAdded(row.id)) return 0;
  const value = esfRowValue(rowId);
  return row && row.cadence === "annual" ? value / 12 : value;
}

/** Everything the tester stated that they would still be paying, before the buffer. */
function esfStatedMonthly() {
  return esfRound(ESF_ROWS.reduce((sum, r) => sum + esfRowMonthly(r.id), 0));
}

/**
 * Everything that would still be owed if the paycheck stopped.
 *
 * The medical row already includes replacement cover for employer-insured
 * households. Do not add a second premium to the stated total.
 */
function esfSurvivalMonthly() {
  return esfStatedMonthly();
}

/**
 * The buffer applies to the WHOLE survival figure, health adjustment included.
 * It covers "unspecified but likely" costs, and a month spent on the
 * replacement premium is as exposed to those as any other month.
 */
function esfBufferedMonthly() {
  const s = esfSession();
  return esfRound(esfSurvivalMonthly() * (1 + (Number(s.buffer) || 0)));
}

/**
 * The goal, rounded to the nearest $500.
 *
 * $19,140 reads as a precise figure when every input behind it was a range;
 * $19,000 says "estimate" without needing a disclaimer to say it.
 */
function esfTarget() {
  const raw = esfBufferedMonthly() * esfCoverageMonths();
  const step = ESF_CONFIG.targetRoundTo || 500;
  return Math.max(step, Math.round(raw / step) * step);
}

/** What the breathing-room percentage is worth, before the goal is rounded. */
function esfBufferAmount() {
  const months = esfCoverageMonths();
  return esfRound((esfBufferedMonthly() - esfSurvivalMonthly()) * months);
}

/** Months between today and the target date, floored at one. */
function esfMonthsToTarget() {
  const s = esfSession();
  const end = new Date(s.targetDate).getTime();
  if (!isFinite(end)) return ESF_CONFIG.targetMonths;
  const months = (end - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(1, Math.round(months));
}

/**
 * What is left to save: the full fund minus what they already have.
 *
 * This is the GOAL as the tester experiences it — the number they have to go
 * and find. esfTarget() is the size of the finished fund and stays the anchor
 * for everything derived from expenses (coverage months, the buffer), but a
 * tester with $40,000 banked against a $74,000 fund is being asked for
 * $34,000, and that is the figure the plan screen leads on.
 */
function esfGoalRemaining() {
  const s = esfSession();
  return Math.max(0, esfTarget() - (Number(s.startingBalance) || 0));
}

function esfMonthlyContribution() {
  return esfRound(esfGoalRemaining() / esfMonthsToTarget());
}

// ─── Committing ──────────────────────────────────────────────────────────────

/**
 * The expense set, keyed on the TAXONOMY rather than on ESF's own rows.
 *
 * Rows fold into their category so other modules can read the saved expense
 * set without knowing ESF's row structure.
 */
function esfExpensesByCategory() {
  const out = {};
  CATEGORIES.forEach(c => { out[c] = 0; });
  ESF_ROWS.forEach(r => { out[r.category] += esfRowMonthly(r.id); });
  CATEGORIES.forEach(c => { out[c] = esfRound(out[c]); });
  return out;
}

/**
 * ESF → a budget baseline, for submitBudgetBaseline().
 *
 * The emergency fund runs BEFORE the budget, so it seeds it: every category a
 * row asks about carries what the tester actually stated, and the rest open on
 * the peer figure — exactly what the budget builder would have opened them on
 * anyway, so nothing arrives blank (D19).
 *
 * The buffer is not carried. The medical row's replacement-cover estimate is
 * carried as part of Health, just like every other asked category.
 */
function esfToBaseline() {
  const stated = esfExpensesByCategory();
  const peers = benchAllPeerValues(benchOptsForUser());
  const monthly = {};

  // A category the tester was ASKED about carries their figure; everything else
  // opens on the peer value. Keyed on whether a row covers it, so the
  // catch-all row's Other figure is carried too.
  const asked = {};
  ESF_ROWS.forEach(r => { asked[r.category] = true; });

  CATEGORIES.forEach(c => {
    monthly[c] = asked[c] ? stated[c] : esfRound(peers[c]);
  });

  return {
    source: "emergencyFund",
    profile: {
      zip: state.profile.zip,
      householdSize: state.profile.householdSize,
      incomeAnnual: state.profile.incomeAnnual
    },
    lifestyle: Object.assign({}, state.lifestyle),
    monthly: monthly
  };
}

/**
 * Commit: save the expense set, create the goal, seed the budget.
 *
 * The goal goes through the EXISTING model rather than a new one — a tactical
 * goal with no `period` is a savings goal (js/goals.js), so pace, status and
 * the "behind / on track / ahead" vocabulary all come free and the card renders
 * on the Goals tab like any other.
 *
 * User-approved exception to the budget confirmation contract: creating or
 * editing this goal immediately replaces the budget and returns to Goals.
 * It uses applyBudgetBaseline so normalization and task rewards stay shared.
 */
function esfCommit() {
  const s = esfSession();

  // The saved expense set (spec §12) — shared state, not ESF-local, so the
  // permanent "Your monthly expenses" list and anything later can read it
  // without re-running the wizard.
  state.expenses = {
    byCategory: esfExpensesByCategory(),
    rows: Object.assign({}, s.rows),
    touched: Object.assign({}, s.touched),
    bills: Object.assign({}, s.added),
    builtAt: todayISO()
  };

  const target = esfTarget();
  state.esfGoal = {
    id: generateId("g"),
    label: "Emergency fund",
    target: target,
    current: Math.max(0, Number(s.startingBalance) || 0),
    category: null,
    period: null,                       // no period → a savings goal
    targetDate: s.targetDate,
    startedAt: todayISO(),
    coverageMonths: esfCoverageMonths(),
    monthlyFigure: esfBufferedMonthly()
  };
  // EXACTLY ONE emergency fund on the Goals tab, ever. Re-running the tool
  // replaces the goal rather than adding a second one — and the seeded
  // "Build a $3,000 emergency fund" counts as one, so it goes too. Two funds
  // with different targets is a tester wondering which one is theirs.
  state.tacticalGoals = (state.tacticalGoals || []).filter(g => !esfLooksLikeEsfGoal(g));
  state.tacticalGoals.push(state.esfGoal);

  esfLog("goal_set", {
    target: target,
    coverageMonths: esfCoverageMonths(),
    buffer: s.buffer,
    medical: esfRowMonthly("medical"),
    untouchedRows: esfRowsRemaining()
  });

  // Seed the budget, then land on Goals so the tester sees what they just made.
  //
  // ESF saves replace even an existing budget, without confirmation. Discard
  // any older pending builder proposal so it cannot overwrite this later.
  state.pendingBaseline = null;
  applyBudgetBaseline(esfToBaseline());
  navGoTabRoot("goals");
}

// ─── Session log ─────────────────────────────────────────────────────────────
// Enough to watch a moderated test, and no more. D03 forbids a backend and
// localStorage, so this lives and dies with the page — which is the right
// lifetime for it: the thing being captured is what one tester did in one
// sitting, with somebody watching. The admin panel is the readout.

const ESF_LOG_CAP = 200;

function esfLog(event, detail) {
  if (!state.esfEvents) state.esfEvents = [];
  if (state.esfEvents.length >= ESF_LOG_CAP) return;
  state.esfEvents.push({
    at: new Date().toISOString().slice(11, 19),
    event: event,
    detail: detail || {}
  });
}
