// ─── Emergency fund — the expense model ──────────────────────────────────────
// Spec: docs/emergency-fund-spec.md, as amended by the owner during the
// reconciliation pass. Where the two disagree, the amendments win and say so.
//
// ── SIX CATEGORIES, NOT A NEW TAXONOMY ───────────────────────────────────────
// The spec names seven "categories" of its own. They are NOT a second taxonomy:
// six of them are a VIEW over CATEGORIES (js/taxonomy.js) and the seventh —
// Buffer — turned out not to be a category at all but a percentage on the
// total. Every lookup below keys on the bare 12-category strings, because those
// strings are the join key across peer-benchmarks, seed-state, monthToDateActuals
// and the help-me-out trees. A parallel set of keys here would be a second join
// key, which is the single most expensive mistake available in this codebase.
//
// The six the owner excluded — Dining out, Subscriptions, Personal care,
// Entertainment, Shopping, Other — are dispensable in an emergency by
// definition, so they are not asked about and not carried. They still exist in
// the budget; see esfToBaseline().
//
// ── ROWS ARE SMALLER THAN CATEGORIES ─────────────────────────────────────────
// Screens are grouped by how hard a number is to RECALL, not by what it belongs
// to, so two categories split across screens: Transport becomes a car payment
// (typed, screen 1) and running costs (estimated, screen 3); Utilities becomes
// the locally-priced part and the nationally-priced part. esfRowsForCategory()
// is the seam back.

const ESF_CATEGORIES = ["Housing", "Utilities", "Groceries",
                        "Debt payments", "Transport", "Health"];

// ── ROWS GROUP INTO BOXES ────────────────────────────────────────────────────
// `group` is what shares a card. Two rows with the same group sit side by side
// in one box; a group of one gets its own. That is how "Rent | Mortgage" and
// "Car Payments | Public Transportation" become single questions with two
// answers rather than four separate cards.
//
// ── EVERY ROW IS A FIGURE, NEVER A TOGGLE ────────────────────────────────────
// There is no opt-in "Add it" anywhere. A row either opens blank because only
// the tester knows it, or opens on a local estimate they can overwrite. An
// opt-in row hides the cost of ignoring it: somebody who never taps it is told
// nothing, and their target is quietly short.
const ESF_ROWS = [
  // Box 1 — BOTH fields exist on purpose. Somebody can rent and carry a
  // mortgage at the same time, and which of the two carries a figure is what
  // tells us whether property tax and a HOA fee are theirs at all. Asking
  // "do you rent or own?" would get one answer where the truth is sometimes two.
  // Steps are 1-indexed here because step 0 is an INTRO with no fields on it.
  // BOTH are enterable and BOTH are counted — not an either/or. People rent and
  // carry a mortgage at the same time, and people with a car payment also buy
  // transit passes. A picker forced them to pick a side and lost the other
  // figure entirely.
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

  // ── The last step carries the DERIVED costs ────────────────────────────────
  // Property tax, the HOA fee and the three car running costs all moved off
  // step 1. Every one of them arrives pre-filled from a local estimate, so none
  // of them needs the tester's attention the way rent and a car payment do —
  // and crowding five boxes onto the opening screen left no room for anything
  // that makes the tool feel like more than a form.
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

  // ONE box for running a car. Fuel, insurance and upkeep were three fields
  // that nobody holds apart in their head — and three ranges stacked in one
  // card read as three questions rather than one. The components still exist
  // in the model; only the asking is combined.
  { id: "carCosts", label: "Car: Fuel + Insurance + Maintenance", category: "Transport", step: 2,
    group: "carRunning", groupLabel: "Car: Fuel + Insurance + Maintenance", prefill: true,
    source: "carCosts" }
];

// ─── Who lives here ──────────────────────────────────────────────────────────
// Onboarding asks for adults with age ranges and kids in two buckets. Everything
// downstream reads it through here, including the paths where it was never
// asked — the nine test profiles carry only a household size, and "skip all
// setup" fills nothing at all. Those fall back to adults-only at a middling
// age, which is what the peer model already assumed before the question
// existed, so no figure moves for a tester who skips.
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
 * Miles a month implied by a fuel figure — the tester's number read BACK to
 * them, which is the whole point of the subtext. "$210 of fuel" is unverifiable;
 * "about 640 miles a month" is something they can immediately recognise as too
 * high or too low.
 *
 * cost ÷ price per gallon = gallons, × the fleet average = miles.
 */
function esfImpliedMiles() {
  const d = esfDriving();
  const perGallon = esfPerGallon();
  if (!perGallon) return 0;
  const gallons = esfRowValue("fuel") / perGallon;
  return Math.round(gallons * (Number(d.milesPerGallon) || 0));
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
  const rates = ((hmoTree("Transport") || {}).rates) || {};
  const base = Number((rates.insuranceMonthly || {}).midsize) || 0;

  let col = 1;
  try {
    const m = Number((benchColMultipliers(state.profile.zip).multipliers || {}).Transport);
    if (isFinite(m) && m > 0) col = m;
  } catch (e) { col = 1; }

  const typical = Number(d.typicalCarPayment) || 0;
  const range = d.paymentFactorRange || [0.8, 1.4];
  let factor = 1;
  const payment = Number((state.esf && state.esf.rows && state.esf.rows.carPayment) || 0);
  if (typical && payment) {
    factor = Math.min(range[1], Math.max(range[0], payment / typical));
  }

  return esfRound(base * col * factor);
}

/** Maintenance follows DISTANCE, so it is derived from the fuel figure. */
function esfMaintenanceEstimate() {
  const d = esfDriving();
  const miles = esfImpliedMiles();
  return esfRound(miles * (Number(d.maintenancePerMile) || 0));
}

// ─── Phone and internet ──────────────────────────────────────────────────────

/**
 * Lines = adults plus kids old enough to carry a phone, capped.
 *
 * The old figure was `min(householdSize, 4)`, which billed a line for a
 * toddler. Thirteen is the bucket boundary for exactly this reason.
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
  if (esfMilesPerDay() === 0) return 0;
  return esfCarOpeningSplit(benchOptsForUser()).carInsurance;
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
  if (!type) return esfOwnsHome();   // never asked — fall back to the old test
  return shown.indexOf(type) !== -1;
}

/**
 * HOA by PROPERTY TYPE, never by ZIP.
 *
 * Fees are bimodal — most houses carry none, condos and townhomes almost always
 * carry one — so a ZIP-based estimate hands a house owner in a condo-heavy area
 * a fee they do not pay. The area only scales a fee that exists.
 */
function esfHoaEstimate() {
  const table = (esfData().hoa || {}).byPlaceType || {};
  const type = esfPlaceType();
  const base = Number(table[type]);
  if (!isFinite(base) || base <= 0) return 0;
  let mult = 1;
  try {
    const m = Number((benchColMultipliers(state.profile.zip).multipliers || {}).Housing);
    if (isFinite(m) && m > 0) mult = m;
  } catch (e) { mult = 1; }
  return esfRound(base * mult);
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
 * Only the two owner-only rows have one. Asking for rent and mortgage as
 * SEPARATE figures is what makes this possible — the moment somebody puts a
 * number against rent and leaves mortgage empty, they have told us they do not
 * own, and property tax and a HOA fee stop applying.
 *
 * This matters more than it looks. Both rows open on a local estimate and
 * contribute immediately, so without the filter a renter carries about $430 of
 * property tax and $405 of HOA they do not pay — roughly $5,000 of invented
 * target at six months' coverage, with nothing on screen to explain it.
 *
 * Both blank still shows them, per the owner's call that an unknown tester is
 * treated as an owner so more of the tool is visible during testing.
 */
function esfRowShows(row) {
  if (!row || !row.showIf) return true;
  if (row.showIf === "owns")     return esfOwnsHome();
  if (row.showIf === "hoa")      return esfHoaApplies();
  if (row.showIf === "employer") return esfHasEmployerCoverage();
  return true;
}

// ── Choice groups ────────────────────────────────────────────────────────────
// Two rows, one figure. Rent and a mortgage are the same question asked of two
// different people, and so are a car payment and a transit pass — so the box
// shows a segmented picker and ONE field rather than two fields where at least
// one is always going to sit at zero.
//
// The rows both still exist underneath, which is what keeps the category maths
// unchanged: whichever is picked carries the figure and the other contributes
// nothing.

/** Which row a choice group is currently answering. */
function esfPickFor(groupId) {
  const s = esfSession();
  if (s.pick && s.pick[groupId]) return s.pick[groupId];
  return ESF_PICK_DEFAULTS[groupId] || null;
}

/**
 * Defaults. `roof` opens on Mortgage deliberately — the owner's standing call
 * is that an unknown tester is treated as an owner so more of the tool is
 * visible during testing, and opening on Rent would hide the property tax and
 * HOA boxes on the last step before anybody had said anything.
 */
const ESF_PICK_DEFAULTS = { roof: "mortgage", ride: "carPayment" };

/** True when this row is the one its group is currently answering. */
function esfRowPicked(row) {
  if (!row || !row.choice) return true;
  return esfPickFor(row.group) === row.id;
}

/**
 * Switch which option a choice group is answering, CARRYING the figure over.
 *
 * Somebody who typed 1,800 and then realises they picked the wrong label meant
 * the number either way; making them retype it would be the tool punishing them
 * for its own default.
 */
function esfPickChoice(groupId, rowId) {
  const s = esfSession();
  if (!s.pick) s.pick = {};
  const previous = esfPickFor(groupId);
  if (previous === rowId) return;

  const carried = s.rows[previous];
  s.pick[groupId] = rowId;
  if (carried != null) {
    s.rows[rowId] = carried;
    s.touched[rowId] = !!s.touched[previous];
  }
  s.rows[previous] = null;
  render();
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
  // Household of one → 3 months, anyone else → 6. The spec words this as
  // "household of 1 AND no dependents", but a household of one HAS no
  // dependents, so household size answers it alone — which is lucky, because
  // onboarding does not collect dependents.
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
  // The spec says 6, and 6 is arithmetically impossible: coverage also defaults
  // to 6 months of expenses, so saving six months of expenses within six months
  // means banking 100% of your expenses every month. Against the seeded persona
  // that is a $5,840 monthly contribution on a $5,667 monthly income.
  //
  // The spec half-caught this — §7 warns that "6 months" means two different
  // things in this feature — but did not follow it through to the defaults.
  // 24 is a placeholder pending the owner's ruling, not a researched figure.
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

function esfRowsForCategory(category) {
  return ESF_ROWS.filter(r => r.category === category);
}

// ─── Opening figures ─────────────────────────────────────────────────────────

/**
 * Utilities is one peer figure and two rows, so this supplies the PROPORTION
 * and nothing else — the two rows always sum back to benchPeerValue.
 *
 * Deriving the split from the help-me-out rate table rather than inventing a
 * ratio keeps one definition of what a power bill costs relative to broadband.
 * The local/national division is that file's own: power and water follow the
 * place, a carrier and an ISP do not.
 *
 * Home size is not collected anywhere — it was cut from onboarding deliberately
 * — so household size proxies for it.
 */
/**
 * Power, water and gas for this home — the LOCAL part of utilities.
 *
 * Home size comes from the onboarding house-type question; before that existed
 * household size stood in for it, which is a far weaker proxy (two people in a
 * 4-bedroom house heat the same rooms as five).
 *
 * The cost-of-living multiplier is applied ONCE, here, and the underlying rate
 * stays national. Reaching for the state electricity ratio inside the model as
 * well squares it — that bug shipped once and overstated Los Angeles by 65%.
 */
function esfPowerEstimate() {
  const rates = ((hmoTree("Utilities") || {}).rates) || {};
  const home = esfHomeKey();
  const kwh = Number((rates.kwhByHome || {})[home]) || 0;
  const power = (kwh * (Number(rates.nationalCentsPerKwh) || 0)) / 100;
  const water = Number((rates.waterByHome || {})[home]) || 0;
  // Gas comes from this tool's own table — the shared one has none, so the row
  // was promising three utilities and pricing two.
  const gas = Number(((esfData().utilities || {}).gasByHome || {})[home]) || 0;

  let mult = 1;
  try {
    const m = Number((benchColMultipliers(state.profile.zip).multipliers || {}).Utilities);
    if (isFinite(m) && m > 0) mult = m;
  } catch (e) { mult = 1; }

  const figure = esfRound((power + water + gas) * mult);
  // No rate table (a failed data load) — the peer figure rather than a zero.
  if (!figure) return esfRound(benchPeerValue("Utilities", benchOptsForUser()));
  return figure;
}

/** The help-me-out home-size key for this profile's place type. */
function esfHomeKey() {
  const type = esfPlaceType();
  if (type && typeof ONB_PLACE_TYPES !== "undefined") {
    const match = ONB_PLACE_TYPES.find(p => p.id === type);
    if (match && match.home) return match.home;
  }
  // Never asked — household size is the old stand-in.
  const table = (esfData().utilitiesSplit || {}).homeByHousehold || {};
  const hh = Math.max(1, parseInt((state.profile || {}).householdSize, 10) || 1);
  return table[String(Math.min(hh, 4))] || "apt2";
}

function esfUtilitiesSplit() {
  const peer = Number(benchPeerValue("Utilities", benchOptsForUser())) || 0;
  const rates = ((hmoTree("Utilities") || {}).rates) || {};
  const table = (esfData().utilitiesSplit || {}).homeByHousehold || {};

  const hh = Math.max(1, parseInt((state.profile || {}).householdSize, 10) || 1);
  const home = table[String(Math.min(hh, 4))] || "apt2";

  const power = (Number((rates.kwhByHome || {})[home]) || 0) *
                (Number(rates.nationalCentsPerKwh) || 0) / 100;
  const water = Number((rates.waterByHome || {})[home]) || 0;
  const internet = Number(rates.internet) || 0;
  const phone = (Number(rates.phonePerLine) || 0) *
                Math.min(hh, Number(rates.maxLines) || 4);

  const local = power + water;
  const national = internet + phone;
  const whole = local + national;

  // No rate table (a failed data load) — split it evenly rather than putting
  // the whole bill on one row and drawing the others at zero. D19: fabricate a
  // plausible value, never render a blank.
  if (!whole) {
    const third = esfRound(peer / 3);
    return { power: third, cellPhone: third, internet: Math.max(0, esfRound(peer - third * 2)) };
  }

  // Three shares now, not two — "Staying Connected" splits the national part
  // into a phone bill and a broadband bill. The LAST one takes the remainder
  // rather than its own rounded fraction, so the three always add back to the
  // peer figure exactly instead of drifting by $5.
  const powerShare = esfRound(peer * (local / whole));
  const phoneShare = esfRound(peer * (phone / whole));
  return {
    power: powerShare,
    cellPhone: phoneShare,
    internet: Math.max(0, esfRound(peer - powerShare - phoneShare))
  };
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
    // named source falls through to the peer figure for its category, which is
    // still right for medical and the debt minimums.
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
    if (r.source === "unemployedInsurance") { out[r.id] = esfReplacementPremium(); return; }
    if (car[r.id] != null)           { out[r.id] = car[r.id]; return; }
    if (r.bill) {
      const monthly = esfBillEstimate(esfBills().find(b => b.id === r.bill));
      out[r.id] = r.cadence === "annual" ? esfRound(monthly * 12) : monthly;
      return;
    }
    if (r.bill) {
      // A local figure from data/emergency-fund.json — home insurance and HOA
      // carry the ZIP's housing multiplier, property tax is a ratio of what
      // housing actually costs there. Annual rows are stored annual.
      const monthly = esfBillEstimate(esfBills().find(b => b.id === r.bill));
      out[r.id] = r.cadence === "annual" ? esfRound(monthly * 12) : monthly;
      return;
    }
    out[r.id] = esfRound(benchPeerValue(r.category, opts));
  });

  return out;
}

// ─── Screen 4 — bills that do not arrive monthly ─────────────────────────────
// Every row is OPT-IN and adds nothing until tapped. The tool assumes the
// tester already counted the cost inside what they typed earlier, which is the
// safe direction: a double-count silently inflates the target by thousands and
// nothing on screen would ever explain it, whereas an omission is what the
// buffer exists to absorb.

/** Does this bill's precondition hold — owner, has a car, or always? */
function esfBillShows(bill, session) {
  const s = session || esfSession();
  if (!bill || !bill.showIf || bill.showIf === "always") return true;
  if (bill.showIf === "owns")   return !!s.owns;
  if (bill.showIf === "hasCar") return !!s.hasCar;
  return true;
}

function esfBills() {
  return ((esfData().irregularBills || {}).bills) || [];
}

function esfVisibleBills() {
  const s = esfSession();
  return esfBills().filter(b => esfBillShows(b, s));
}

/**
 * The estimate for one bill, before any override the tester typed.
 *
 * `ratioOfHousing` tracks whatever they actually entered for rent or mortgage,
 * because property tax is the most place-variable bill on the list and a flat
 * national figure would be wrong everywhere. `monthly` figures named a category
 * get that category's cost-of-living multiplier — through benchColMultipliers,
 * never around it.
 */
function esfBillEstimate(bill) {
  if (!bill) return 0;
  if (bill.basis === "ratioOfHousing") {
    // Reads state.esf DIRECTLY, never esfSession(). This runs from
    // esfOpeningValues(), which runs from esfStart() — and esfSession() starts a
    // session when it finds none, so going through it here recurses until the
    // stack gives out. Anything called while the session is being built has to
    // tolerate there not being one yet.
    //
    // Rent and mortgage are summed because somebody can carry both, and it
    // falls back to the peer housing figure while they are still blank: the
    // fields open empty by design, and "about $0 a month" on a row the tester
    // is being asked about reads as broken (D19).
    const s = state.esf;
    let housing = 0;
    if (s && s.rows) {
      housing = (Number(s.rows.rent) || 0) + (Number(s.rows.mortgage) || 0);
    }
    if (!housing) {
      try { housing = Number(benchPeerValue("Housing", benchOptsForUser())) || 0; }
      catch (e) { housing = 0; }
    }
    return esfRound(housing * (Number(bill.value) || 0));
  }
  const base = Number(bill.value) || 0;
  if (!bill.col) return esfRound(base);
  try {
    const m = Number((benchColMultipliers(state.profile.zip).multipliers || {})[bill.col]);
    return esfRound(base * (isFinite(m) && m > 0 ? m : 1));
  } catch (e) { return esfRound(base); }
}

/** The figure in play for a bill — the tester's own if they changed it. */
function esfBillValue(billId) {
  const s = esfSession();
  const typed = s.billAmounts[billId];
  if (typed != null && isFinite(Number(typed))) return Number(typed);
  return esfBillEstimate(esfBills().find(b => b.id === billId));
}

/** Only bills actually added contribute. An untouched row is worth zero. */
function esfBillsTotal() {
  const s = esfSession();
  return esfVisibleBills()
    .filter(b => s.added[b.id])
    .reduce((sum, b) => sum + esfBillValue(b.id), 0);
}

// ─── The session ─────────────────────────────────────────────────────────────

function esfStart() {
  // Clear FIRST. esfOpeningValues() prices property tax off whatever housing
  // figures it can see, and it reads state.esf directly — so computing the
  // opening values while the previous run is still parked there carries that
  // run's rent and mortgage into this one's estimate. A tester who backs out
  // and starts again would inherit numbers they thought they had discarded.
  state.esf = null;
  const opening = esfOpeningValues();
  state.esf = {
    step: 0,
    opening: opening,                 // frozen — what the tool guessed
    rows: Object.assign({}, opening),  // live — what the tester settled on
    touched: {},                      // row id → true once they changed it
    declined: {},                     // row id → true for "I don't have one"
    added: {},                        // bill id → true once added
    billAmounts: {},                  // bill id → a typed override
    extras: [],                       // screen 4's blank box: {id, label, amount}
    buffer: ESF_CONFIG.bufferDefault,
    coverageMonths: null,             // null → derived from household size
    startingBalance: 0,
    insuranceOverride: null,
    targetDate: esfDefaultTargetDate(),
    owns: esfOwnsHome(),
    hasCar: benchLifestyleKey("commute", (state.lifestyle || {}).commute) !== "none"
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
 * Matches on the label as well as the id, because the seeded goal ("Build a
 * $3,000 emergency fund") was authored long before this tool existed and has
 * no id of ours to match on.
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
 * Does the tester own their home? It gates the three owner-only bills on
 * step 4, and nothing else reads it.
 *
 * ── DO NOT ROUTE THIS THROUGH benchLifestyleKey ──────────────────────────────
 * It is the obvious thing to reach for and it CANNOT answer this question.
 * That function maps the wizard's four options onto the peer model's three data
 * keys, and it deliberately collapses "rent" and "mortgage" into the same
 * `"true"` — because the peer model only cares whether somebody carries a full
 * housing cost, not who holds the deed. Asking it about ownership returns a
 * confident, plausible, wrong answer: every mortgage-holder reads as a
 * non-owner, and the only people who read as owners are those living rent-free
 * with family. The raw value still has the distinction; the mapped key does not.
 *
 * ── THE DEFAULT IS `true`, ON PURPOSE ───────────────────────────────────────
 * Nothing in the flow asks yet — the persona seeds paysRent as a bare boolean,
 * which says nothing about ownership — so the fallback decides what every
 * tester sees. Owner's call: default to owning, because the failure modes are
 * not symmetric while this is in testing. An owner treated as a renter is never
 * offered property tax, home insurance or HOA at all, and nothing on screen
 * hints that three rows were withheld. A renter treated as an owner sees three
 * extra opt-in rows that default to off and cost nothing to ignore.
 *
 * Onboarding is the real source. This already reads both places it could land,
 * so when that question ships the irrelevant rows drop out with no change here.
 */
function esfOwnsHome() {
  // What they actually typed beats everything. Box 1 asks for rent AND mortgage
  // as separate figures precisely so this can be read off real numbers rather
  // than inferred — and it handles the case a single question cannot, somebody
  // carrying both.
  // An APARTMENT settles it: nobody owning their home calls it an apartment,
  // so there is no property tax and no home insurance to ask about. Condos and
  // houses are ambiguous — either can be rented — so they fall through to the
  // housing figures below.
  const place = esfPlaceType();
  if (place === "aptSmall" || place === "aptLarge") return false;

  // The segmented picker in box 1 IS the answer — whichever side it is on says
  // whether the roof is owned, whether or not a figure has been typed yet.
  const s = state.esf;
  if (s) {
    const pick = (s.pick && s.pick.roof) || ESF_PICK_DEFAULTS.roof;
    if (pick === "mortgage") return true;
    if (pick === "rent") return false;
  }

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

/** A row's live figure. A declined row is zero, not blank. */
function esfRowValue(rowId) {
  const s = esfSession();
  if (s.declined[rowId]) return 0;
  const v = s.rows[rowId];
  return v == null ? 0 : (Number(v) || 0);
}

/** Untouched estimates are what the "this will sharpen" line counts. */
function esfRowsRemaining() {
  const s = esfSession();
  return ESF_ROWS.filter(r => !s.touched[r.id] && !s.declined[r.id]).length;
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
// bill and useless on a $2,000 mortgage, so the step follows the magnitude —
// which is the same reason the adjustment control was a percentage, back when
// there was one.

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
 * $4,500 ($354/mo)". The conversion used to sit on its own line under the box,
 * which cost a line on the tightest screen and read as a second figure rather
 * than the same one restated.
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
  // invisible on screen and impossible to argue with. The same applies to the
  // unpicked half of a choice group.
  if (!esfRowShows(row) || !esfRowPicked(row)) return 0;
  // An opt-in row is estimated but weightless until the tester adds it.
  if (row && row.optIn && !esfRowAdded(row.id)) return 0;
  const value = esfRowValue(rowId);
  return row && row.cadence === "annual" ? value / 12 : value;
}

/**
 * Everything the tester stated that they would still be paying, before the
 * crisis adjustment or the buffer.
 *
 * `survival: false` rows are asked but not counted. Dining out is the only one
 * so far: it is captured because the emergency fund seeds the budget and the
 * budget wants all twelve categories, but an emergency fund sized to keep
 * somebody ordering takeaway is not what the owner asked for — it is one of the
 * six dispensable categories by their own ruling.
 */
function esfStatedMonthly() {
  return esfRound(ESF_ROWS
    .filter(r => r.survival !== false)
    .reduce((sum, r) => sum + esfRowMonthly(r.id), 0));
}

/**
 * The health-cover adjustment — the ONE thing that moves if the paycheck stops.
 *
 * Stated, never asked. The spec offered the tester a choice between "what I
 * spend now" and "if my pay stopped"; the owner cut it, and the reasoning is
 * sound: an emergency fund sized on the assumption that you keep your
 * employer's insurance is not covering the emergency. So the higher figure is
 * the only honest target and there is nothing to choose between.
 *
 * It must still be VISIBLE. A target built on $3,000 a month when the tester
 * stated $2,700 reads as a bug unless something on screen names the difference.
 */
// The flat "marketplace premium x up to two adults" estimate that used to live
// here is gone — it is priced by the ACA age curve now (esfReplacementPremium,
// above), which is what onboarding's adult ages were added for. Two definitions
// of the same name sat in this file for a while and the later one silently won,
// which is exactly the shadowing trap CLAUDE.md warns about.

/**
 * Everything that would still be owed if the paycheck stopped.
 *
 * The health adjustment used to be added HERE, on top of the stated figure, and
 * stated once on the plan screen as "if your pay stopped". It is now a row of
 * its own — "Unemployed Insurance", sitting beside what they pay today — so it
 * is already inside esfStatedMonthly() and adding it again would double it.
 * This wrapper stays because the plan screen and the admin card both read it,
 * and because the two concepts are worth keeping named apart.
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
 * This is what makes it reusable (spec §12): a saved object other modules can
 * read, not wizard output. Rows fold into their category, and screen-4 bills
 * fold into whichever category they name — property tax into Housing, plates
 * into Transport — so the budget receives one figure per category and never has
 * to know ESF's row structure.
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
 * The emergency fund runs BEFORE the budget, so it seeds it: the six survival
 * categories carry what the tester actually stated, and the six dispensable
 * ones open on the peer figure — exactly what the budget builder would have
 * opened them on anyway, so nothing arrives blank (D19).
 *
 * The buffer and the health adjustment are deliberately NOT carried. Both are
 * emergency-fund concepts: a budget line called "buffer" means nothing, and a
 * replacement premium is a cost you would face if your pay stopped, not one you
 * are paying this month.
 */
function esfToBaseline() {
  const stated = esfExpensesByCategory();
  const peers = benchAllPeerValues(benchOptsForUser());
  const monthly = {};

  // A category the tester was ASKED about carries their figure; everything else
  // opens on the peer value. Keyed on whether a row covers it rather than on
  // ESF_CATEGORIES, because the two have come apart: Dining out is asked (so
  // the budget gets a real number) but is not a survival category (so it stays
  // out of the emergency target). Testing membership of ESF_CATEGORIES here
  // would throw the tester's own dining figure away and substitute a peer one.
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
 * The budget goes through submitBudgetBaseline(), which is the only way a
 * builder is allowed to write state.plan. That also means the old→new confirm
 * gate fires by itself if a budget already exists, which is exactly right: an
 * emergency fund re-run should not silently rewrite a budget the tester built
 * afterwards.
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
    declined: Object.assign({}, s.declined),
    extras: (s.extras || []).slice(),
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
  // applyBudgetBaseline rather than submitBudgetBaseline: the latter owns its
  // own routing and would send them to budgetDone, or to the old→new confirm
  // gate when a budget already exists. Neither is where "Set my goal" should
  // end up. The tradeoff is real and worth knowing — this writes the plan
  // without showing that comparison — and it is defensible only because the
  // emergency fund runs BEFORE the budget by design, so in the intended order
  // there is nothing to overwrite. If the order ever changes, this needs the
  // gate back.
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
