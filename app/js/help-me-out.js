// ─── Help me out — the estimation model ──────────────────────────────────────
//
// A tester who cannot put a number on a budget line hands it over, and this
// works one out from questions about how they LIVE. Never "how much do you
// spend on petrol" — nobody knows that. "How far do you drive in a week", and
// the arithmetic is ours.
//
// ── WHY THIS REPLACED THE FLAT SUM ──────────────────────────────────────────
// The first version rode on the actuals estimator: a list of independent
// options, each carrying a monthly figure, added up. Two things were wrong.
//
// 1. It multiplied by how far into the month we are. Correct for "what have you
//    spent so far"; catastrophic for a budget. On the 4th of a 30-day month
//    every answer came out at 13% of itself — "light local driving" became $10
//    of transport, "a regular ongoing cost" became $20 of healthcare, and
//    picking the MOST expensive option still lowered the category, because the
//    peer default it replaced was eight times larger than anything the sum
//    could produce.
// 2. A sum of fixed options cannot express `miles x rate + insurance`. It has
//    no variables. So Transport's biggest line by far — insurance, $126-153 a
//    month before a wheel turns — simply was not in it, and no amount of
//    retuning the options would have put it there.
//
// ── THE SPLIT ────────────────────────────────────────────────────────────────
// FIGURES live in data/help-me-out.json, each with the source it came from.
// ARITHMETIC lives in HMO_MODELS below, one function per category.
//
// That is deliberate and it is the house rule about not paraphrasing data into
// literals, applied to a case where the model genuinely needs code: a rate
// table is data and belongs in JSON where it can be re-sourced; multiplying it
// by a slider is logic and belongs where it can be tested.

function hmoData() {
  return (typeof HELP_ME_OUT !== "undefined" && HELP_ME_OUT) || { trees: {} };
}

function hmoTree(category) {
  return (hmoData().trees || {})[category] || null;
}

function hmoHasTree(category) {
  const t = hmoTree(category);
  return !!(t && t.questions && t.questions.length);
}

// ── Progressive reveal ───────────────────────────────────────────────────────
// Every question for a category lives on ONE screen; later ones appear as
// earlier ones are answered. `showIf` names the question it depends on and the
// answers that reveal it — so "what kind of car" never appears to somebody who
// just said they have no car, and is not merely disabled either, because a
// disabled control still reads as something you failed to do.

/**
 * True when this question's precondition is met by the answers so far.
 *
 * `is` matches option ids; `gt` compares a slider numerically. The numeric form
 * exists because "what does a typical trip look like" is worth asking only when
 * there IS a trip, and a slider sitting at zero is a real answer rather than an
 * absent one.
 */
function hmoQuestionShows(q, answers) {
  const cond = q && q.showIf;
  if (!cond) return true;
  const given = (answers || {})[cond.q];
  if (given == null) return false;
  if (cond.gt != null) return (Number(given) || 0) > Number(cond.gt);
  if (!cond.is) return true;
  const vals = Array.isArray(given) ? given : [given];
  return vals.some(v => cond.is.indexOf(v) !== -1);
}

/**
 * Answers with every slider's default already in place.
 *
 * A slider is never "unanswered" — it is sitting at a value whether or not
 * anybody touched it, and the screen shows that value. Leaving it out of the
 * answers map until first drag means a question gated on it never reveals, and
 * the tester waits at a screen with nothing left to do.
 */
function hmoSeedAnswers(category) {
  const t = hmoTree(category);
  const out = {};
  if (!t) return out;
  t.questions.forEach(q => {
    if (q.type === "slider") out[q.id] = Number(q.default) || 0;
    if (q.type === "checklist") out[q.id] = [];
  });
  return out;
}

/**
 * The questions to render, in order, stopping after the first unanswered one.
 *
 * Revealing everything at once would put four questions on screen with three of
 * them meaningless; revealing one at a time is what makes it feel like a
 * conversation. The cut is AFTER the first unanswered question, so exactly one
 * open question is ever on screen and everything above it is answered.
 */
function hmoVisibleQuestions(category, answers) {
  const t = hmoTree(category);
  if (!t) return [];
  const out = [];
  for (let i = 0; i < t.questions.length; i++) {
    const q = t.questions[i];
    if (!hmoQuestionShows(q, answers)) continue;
    out.push(q);
    if (!hmoAnswered(q, answers)) break;      // stop at the first open one
  }
  return out;
}

/** A slider counts as answered the moment it is shown — it always has a value. */
function hmoAnswered(q, answers) {
  if (!q) return false;
  if (q.type === "slider") return true;
  const a = (answers || {})[q.id];
  if (q.type === "checklist") return Array.isArray(a);   // [] is a real answer
  return a != null;
}

/** Every revealed question answered — the gate on the confirm step. */
function hmoComplete(category, answers) {
  const t = hmoTree(category);
  if (!t) return false;
  return t.questions
    .filter(q => hmoQuestionShows(q, answers))
    .every(q => hmoAnswered(q, answers));
}

/** A slider's value, falling back to its authored default. */
function hmoSliderValue(q, answers) {
  const a = (answers || {})[q.id];
  const n = Number(a);
  if (a != null && isFinite(n)) return n;
  return Number(q.default) || 0;
}

// ── Cost of living ───────────────────────────────────────────────────────────
// Every absolute figure a tree produces is a national one, so it goes through
// the category's own multiplier. That is not one ratio applied to twelve
// categories: ZIP_COST_OF_LIVING.method.categoryBucket says which BEA component
// prices each, and marks Subscriptions and Debt payments "flat" — a streaming
// plan and a loan repayment cost the same in Palo Alto as in Helena.
//
// Trees anchored on a peer figure declare `"col": "included"`, because
// benchPeerValue has already applied it and doing it twice would square it.

function hmoColMultiplier(category) {
  try {
    const col = benchColMultipliers(state.profile.zip);
    const m = Number((col.multipliers || {})[category]);
    return isFinite(m) && m > 0 ? m : 1;
  } catch (e) { return 1; }
}

/**
 * The monthly figure. NEVER pro-rated — a budget is a month by definition, and
 * scaling one by how far into the month we are is the bug this file exists to
 * remove.
 */
function hmoCompute(category, answers) {
  const t = hmoTree(category);
  if (!t) return 0;
  const model = HMO_MODELS[t.model];
  if (!model) return 0;
  const raw = Number(model(answers || {}, t.rates || {}, hmoContext(category))) || 0;
  const col = t.col === "included" ? 1 : hmoColMultiplier(category);
  return Math.max(0, Math.round((raw * col) / 5) * 5);
}

/** What every model gets alongside the answers. */
function hmoContext(category) {
  const p = state.profile || {};
  return {
    category: category,
    householdSize: Math.max(1, parseInt(p.householdSize, 10) || 1),
    zip: p.zip,
    incomeAnnual: p.incomeAnnual,
    // For models that must apply cost of living to SOME of their components
    // and not others. Most trees do not touch this — hmoCompute applies it to
    // the whole figure — but a category can be a mix of local and national
    // prices, and then one blanket multiplier is wrong.
    colMultiplier: hmoColMultiplier(category),
    // For the anchored models — already carries BEA prices and the county rent
    // ratio, so they modify it rather than rebuilding it from nothing.
    peer: (function () {
      try { return benchPeerValue(category, benchOptsForUser()) || 0; }
      catch (e) { return 0; }
    })()
  };
}

// ── The peer band on the confirm step ────────────────────────────────────────
// Conditioned on what they just SAID, not just on who they are. Somebody who
// answers "most nights" honestly must not be shown a band built from people who
// eat at home and told they are overspending — the band is there to place their
// answer, not to grade it.
//
// The mapping is the six dimensions in PEER_BENCHMARKS.lifestyleModifiers,
// which is exactly what that table is for. Where a tree reaches none of them —
// Utilities, Subscriptions, Medical, Personal care, Debt payments, five of the
// twelve — benchLifestyleMultiplier returns 1.0 on its own and the band is the
// plain profile figure. No special case; only the copy differs.

/** Tree answers → the lifestyle dimensions they imply. */
function hmoLifestyleFrom(category, answers) {
  const t = hmoTree(category);
  const out = {};
  if (!t) return out;
  t.questions.forEach(q => {
    if (!q.lifestyle || !hmoQuestionShows(q, answers)) return;
    const given = (answers || {})[q.id];
    if (given == null) return;
    const mapped = (q.lifestyle.map || {})[given];
    if (mapped != null) out[q.lifestyle.dim] = mapped;
  });
  return out;
}

/** The peer figure for somebody who answered this way. */
function hmoPeerValue(category, answers) {
  try {
    const opts = benchOptsForUser();
    opts.lifestyle = Object.assign({}, state.lifestyle, hmoLifestyleFrom(category, answers));
    return benchPeerValue(category, opts) || 0;
  } catch (e) { return 0; }
}

/** True when the answers actually moved the band — decides the copy. */
function hmoBandIsConditioned(category, answers) {
  return Object.keys(hmoLifestyleFrom(category, answers)).length > 0;
}

/**
 * Fold what the tree learned into state.lifestyle.
 *
 * Nothing in the v3.1 flow has written this since the six lifestyle questions
 * retired, so every peer band on every other screen has been running on the
 * persona's seeded answers. A tester who says they have no car should see
 * Transport bands move everywhere, not just on the screen where they said it.
 */
function hmoApplyLifestyle(category, answers) {
  const learned = hmoLifestyleFrom(category, answers);
  Object.keys(learned).forEach(dim => {
    state.lifestyle[dim] = learned[dim];
    if (state.lifestyleAnswered) state.lifestyleAnswered[dim] = true;
  });
}

// ─── The models ──────────────────────────────────────────────────────────────
// One per category. Each takes (answers, rates, ctx) and returns a NATIONAL
// monthly figure; hmoCompute applies cost of living on the way out.
//
// Read every number out of `rates`. A literal here is a figure with no source
// attached, which is how a plausible-looking wrong estimate gets in.

const HMO_WEEKS_PER_MONTH = 52 / 12;      // 4.333, not 4

const HMO_MODELS = {

  // miles x (fuel + maintenance) + insurance + whatever they ride on top.
  //
  // Insurance is the whole reason this model exists. At AAA's rates a light
  // local driver's fuel and maintenance is about $19 a month and their
  // insurance is about $130 — so a question set that asks only about driving
  // captures under a fifth of the category, which is what produced $10.
  transport: function (a, r, ctx) {
    if (a.car === "none") {
      return Number((r.transitMonthly || {})[a.transit]) || 0;
    }
    const miles = Number(a.miles) || 0;
    const perMile = Number((r.opCostPerMile || {})[a.vehicle]) || 0;
    const insurance = Number((r.insuranceMonthly || {})[a.vehicle]) || 0;
    const transit = Number((r.transitMonthly || {})[a.transit]) || 0;
    const shared = a.car === "shared" ? Number(r.sharedShare) || 1 : 1;
    return (miles * HMO_WEEKS_PER_MONTH * perMile + insurance) * shared + transit;
  },

  // Named services at their published prices, plus however many more they have
  // at the average of the ones they named. A service we cannot price is still a
  // service they pay for; dropping it silently under-reports.
  subscriptions: function (a, r) {
    const picked = Array.isArray(a.services) ? a.services : [];
    const prices = r.services || {};
    let sum = 0, known = 0;
    picked.forEach(id => {
      const p = Number(prices[id]);
      if (isFinite(p)) { sum += p; known++; }
    });
    const others = Math.max(0, Number(a.others) || 0);
    const average = known ? sum / known : (Number(r.fallbackAverage) || 0);
    return sum + others * average;
  },

  // Anchored on the peer figure, which already carries BEA housing prices and
  // the county's own rent ratio — so this modifies rather than rebuilding, and
  // declares col:"included" so the multiplier is not applied twice.
  housing: function (a, r, ctx) {
    const base = Number(ctx.peer) || 0;
    const arrangement = Number((r.arrangement || {})[a.arrangement]);
    const size = Number((r.bedrooms || {})[a.bedrooms]);
    const utils = a.utilitiesIncluded === "yes" ? Number(r.utilitiesIncluded) || 1 : 1;
    return base * (isFinite(arrangement) ? arrangement : 1) *
                  (isFinite(size) ? size : 1) * utils;
  },

  // USDA Cost of Food at Home, by household size — which the profile already
  // knows, so it is not a question. The store tier and how much they cook are
  // what the tester actually contributes.
  groceries: function (a, r, ctx) {
    const plan = (r.usdaMonthly || {})[a.store] || r.usdaMonthly.standard || [];
    const idx = Math.min(Math.max(ctx.householdSize, 1), plan.length) - 1;
    const base = Number(plan[idx]) || 0;
    const cooks = Number((r.cooks || {})[a.cooks]);
    return base * (isFinite(cooks) ? cooks : 1);
  },

  // Consumption by home size at the NATIONAL electricity price, plus the fixed
  // services on top.
  //
  // The national rate is deliberate and was a bug once. This model reached for
  // state.utilitiesRatio directly to price local electricity — but
  // benchColLocalModifier ALREADY returns exactly that ratio for Utilities, so
  // hmoCompute's multiplier carries it. Applying it here too squared it: Los
  // Angeles came out at 1.353 x 1.648 x 1.648, a 65% overstatement, with every
  // figure still looking like a plausible power bill.
  //
  // Same shape as the trap the benchmark module warns about — anything that
  // reaches past benchColMultipliers to price a place is double-counting
  // something that chokepoint already did.
  utilities: function (a, r, ctx) {
    // POWER is the only part that follows the local multiplier. Broadband and
    // a mobile plan are priced nationally — a carrier does not charge 2.2x in
    // Los Angeles — so applying the category multiplier to the whole figure
    // (which is what col:"apply" would do) overstates it by more than the
    // double-count did. Water sits with power: it is a local utility.
    const kwh = Number((r.kwhByHome || {})[a.home]) || 0;
    const power = (kwh * (Number(r.nationalCentsPerKwh) || 0)) / 100;
    const water = a.included === "all" ? 0 : Number((r.waterByHome || {})[a.home]) || 0;
    const local = (power + water) * (Number(ctx.colMultiplier) || 1);

    const internet = a.included === "all" ? 0 : Number(r.internet) || 0;
    const phone = (Number(r.phonePerLine) || 0) * Math.min(ctx.householdSize, Number(r.maxLines) || 4);
    return local + internet + phone;
  },

  // The premium branch is the one that matters. Somebody buying their own cover
  // is a different order of magnitude from somebody whose employer takes it out
  // of a paycheck, and the old three-bucket question could not express either.
  medical: function (a, r, ctx) {
    const premium = a.premium === "self"
      ? (Number(r.marketplacePremium) || 0) * Math.min(ctx.householdSize, 2)
      : 0;
    const visits = Number((r.visitsMonthly || {})[a.visits]) || 0;
    const scripts = Number((r.prescriptionsMonthly || {})[a.prescriptions]) || 0;
    const dental = Number((r.dentalMonthly || {})[a.dental]) || 0;
    const people = a.premium === "self" ? 1 : Math.min(ctx.householdSize, 2);
    return premium + (visits + scripts + dental) * people;
  },

  // Per meal, frequency x price tier, so the arithmetic is inspectable. The old
  // values were close; the month fraction was doing the damage.
  dining: function (a, r) {
    const coffee = (Number((r.coffeePerWeek || {})[a.coffee]) || 0) *
                   (Number((r.coffeePrice || {})[a.coffeeTier]) || 0) * HMO_WEEKS_PER_MONTH;
    const lunch  = (Number((r.lunchPerWeek || {})[a.lunch]) || 0) *
                   (Number(r.lunchPrice) || 0) * HMO_WEEKS_PER_MONTH;
    const dinner = (Number((r.dinnerPerWeek || {})[a.dinner]) || 0) *
                   (Number((r.dinnerPrice || {})[a.dinnerTier]) || 0) * HMO_WEEKS_PER_MONTH;
    return coffee + lunch + dinner;
  },

  personalCare: function (a, r, ctx) {
    const cuts = (Number((r.cutsPerYear || {})[a.haircut]) || 0) *
                 (Number((r.cutPrice || {})[a.haircutTier]) || 0) / 12;
    const gym = Number((r.gymMonthly || {})[a.gym]) || 0;
    const other = Number((r.everythingElse || {})[a.other]) || 0;
    const people = Math.min(ctx.householdSize, Number(r.maxPeople) || 2);
    return (cuts + other) * people + gym;
  },

  // Balance x the issuer's own minimum formula, or what they say they pay.
  debt: function (a, r) {
    if (a.kinds === "none") return 0;
    const balance = Number((r.balanceBand || {})[a.balance]) || 0;
    const rate = Number((r.minimumRate || {})[a.approach]) || 0;
    const floor = Number(r.minimumFloor) || 0;
    const loans = Number((r.loanMonthly || {})[a.loans]) || 0;
    const cards = a.kinds === "loans" ? 0 : Math.max(balance * rate, balance > 0 ? floor : 0);
    return cards + (a.kinds === "cards" ? 0 : loans);
  },

  entertainment: function (a, r) {
    const nights = (Number((r.nightsPerMonth || {})[a.going]) || 0) *
                   (Number(r.nightPrice) || 0);
    const events = (Number((r.eventsPerYear || {})[a.events]) || 0) *
                   (Number(r.eventPrice) || 0) / 12;
    const gear = Number((r.hobbyMonthly || {})[a.hobby]) || 0;
    return nights + events + gear;
  },

  shopping: function (a, r, ctx) {
    const clothes = (Number((r.clothingPerYear || {})[a.clothes]) || 0) / 12;
    const online = Number((r.onlineMonthly || {})[a.online]) || 0;
    const household = Number((r.householdGoods || {})[a.household]) || 0;
    const people = Math.min(ctx.householdSize, Number(r.maxPeople) || 3);
    return (clothes * people) + online + household;
  },

  // Travel is lumpy rather than monthly, so it is trips a year over twelve —
  // the same treatment the retired wizard gave it, kept because it was right.
  other: function (a, r) {
    const trips = (Number(a.trips) || 0) * (Number((r.tripCost || {})[a.tripStyle]) || 0) / 12;
    const gifts = Number((r.giftsMonthly || {})[a.gifts]) || 0;
    const misc = Number((r.miscMonthly || {})[a.misc]) || 0;
    return trips + gifts + misc;
  }
};
