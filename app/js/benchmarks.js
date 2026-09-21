// ─── Peer benchmark model (D20–D23) ──────────────────────────────────────────
// Peer values are an external mathematical aggregate — public spending data
// adjusted for where you live and how you live. NEVER real user data (D23).
// When a user asks, say exactly that.
//
// ── The spec states the formula as a one-liner. It is wrong in all three terms ──
//
//   peerValue = base[category][incomeBand][householdSize]
//             × colTier[zipPrefix][category]
//             × lifestyleMod[category]
//
// Verified against the raw JSON, what it actually is:
//
//   peerValue = base[cat][band][householdSize - 1]                  ARRAY INDEX
//             × benchColMultipliers(zip)[cat]                       BEA, PER CATEGORY
//             × Π lifestyleModifiers[dim][answer][cat]              PRODUCT OF 6
//             → round to nearest 5
//
// Every one of those three reads returns a plausible number when done wrong,
// which is why the worked_example self-test at the bottom is not optional.

const BENCH_LIFESTYLE_DIMS = ["foodie", "cooksAtHome", "hobbySpend",
                              "paysRent", "commute", "travelFrequency"];

/**
 * Annual income → band id (b1–b5). Onboarding collects a BAND, never a precise
 * figure (01-onboarding step 4), so this is mostly for the persona's $68,000.
 */
function benchIncomeBand(annualIncome) {
  const bands = PEER_BENCHMARKS.incomeBands;
  const n = Number(annualIncome) || 0;
  for (let i = 0; i < bands.length; i++) {
    if (n >= bands[i].min && n <= bands[i].max) return bands[i].id;
  }
  return bands[bands.length - 1].id;   // above the top band
}

/**
 * TRAP 1 — household size is an ARRAY INDEX, off by one from the size.
 * base[cat][band] is a 4-element array: ["hh1", "hh2", "hh3", "hh4+"].
 * Household 2 → index 1. 4 or more → index 3 (clamped).
 * Reading it as [householdSize] returns the NEXT household's figure and looks
 * entirely plausible.
 */
function benchHouseholdIndex(householdSize) {
  const n = parseInt(householdSize, 10) || 1;
  return Math.min(Math.max(n, 1), 4) - 1;
}

/**
 * TRAP 2 — cost of living is a TWO-STEP lookup, not colTier[zip][cat].
 * zipPrefixes maps a 3-digit prefix to a tier NAME ("900" → "very_high");
 * tiers[name][category] is the multiplier.
 * Unlisted prefixes fall back to "moderate" rather than failing.
 */
function benchColTierName(zip) {
  const prefix = String(zip == null ? "" : zip).trim().slice(0, 3);
  const tier = PEER_BENCHMARKS.colTiers.zipPrefixes[prefix];
  // Guard the `_note` key and anything unlisted.
  if (typeof tier !== "string" || tier.charAt(0) === "_") return "moderate";
  return PEER_BENCHMARKS.colTiers.tiers[tier] ? tier : "moderate";
}

/**
 * THE ONE CHOKEPOINT for "what does living here cost".
 *
 * Resolution order:
 *
 *   1. The ZIP's COUNTY (data/zip-cost-of-living.json). Every US ZIP is listed.
 *      The county names a BEA geography — its metro area, or its state's
 *      nonmetropolitan portion — and BEA's Regional Price Parities give the
 *      regional price level for each of four buckets. A per-category LOCAL
 *      modifier is then applied on top.
 *   2. The 3-digit prefix tier, if the ZIP is somehow absent. Coverage is 100%,
 *      so this is a guard, not a path anyone takes.
 *
 * ── WHY THIS REPLACED THE TIERS ─────────────────────────────────────────────
 * The prefix table mapped three digits to one of four hand-set tiers. So every
 * ZIP sharing a tier was IDENTICAL — Manhattan, Palo Alto, Santa Clara and Los
 * Angeles all resolved to the same figures — and `very_high` caps Housing at
 * 1.85, so nowhere in America could read higher. Santa Clara came out at 121%
 * of national against Rogers, Arkansas at 111%. BEA says 112.9 and 91.0, with
 * housing at 213.0 against 75.8: the real gap is twice as wide, both figures
 * were too high, and the housing difference was understated by a factor of two.
 *
 * ── LOCAL MODIFIERS ARE PER CATEGORY, FROM DIFFERENT SOURCES ────────────────
 * Housing moves with county rents; Utilities move with state electricity
 * prices; groceries do not track either. So each category takes its modifier
 * from the source that actually governs it, and categories with no credible
 * sub-metro source carry the regional figure unmodified rather than a
 * fabricated one. `flat` categories — Subscriptions, Debt payments — are 1.0
 * everywhere: a streaming plan and a loan repayment cost the same in Palo Alto
 * as in Helena.
 *
 * Returns { source, multipliers, geo, county, tierName? }.
 * `source` is "county" | "prefix" | "fallback".
 */
function benchColMultipliers(zip) {
  const z = String(zip == null ? "" : zip).trim().slice(0, 5);
  const table = (typeof ZIP_COST_OF_LIVING !== "undefined") ? ZIP_COST_OF_LIVING : null;

  if (table && table.zips) {
    // Exact ZIP, then its 3-digit prefix. The prefix step catches PO-box-only
    // and "unique" ZIPs that no county dataset lists — without it they drop to
    // the tier table and read as exactly the national average, which is how
    // Syracuse's 13201 came out at 100%.
    let countyId = table.zips[z];
    let via = "county";
    if (countyId == null && table.prefixes) {
      countyId = benchColPrefixCounty(z.slice(0, 3), table.prefixes);
      via = "prefixCounty";
    }
    const county = (countyId != null && table.counties) ? table.counties[String(countyId)] : null;
    const geo = county ? (table.geos || {})[String(county.geo)] : null;
    if (county && geo) {
      return {
        source: via,
        geo: geo,
        county: county,
        state: (table.states || {})[county.state] || null,
        multipliers: benchColCategoryValues(geo, county, table)
      };
    }
  }

  const tiers = PEER_BENCHMARKS.colTiers.tiers;
  const prefix = z.slice(0, 3);
  const named = PEER_BENCHMARKS.colTiers.zipPrefixes[prefix];
  const modeled = typeof named === "string" && named.charAt(0) !== "_" && !!tiers[named];
  const tierName = benchColTierName(zip);
  return {
    source: modeled ? "prefix" : "fallback",
    tierName: tierName,
    geo: null,
    county: null,
    multipliers: tiers[tierName] || tiers.moderate
  };
}

/**
 * The twelve multipliers for one place: the BEA bucket that prices each
 * category, times that category's own local modifier.
 *
 * Iterates CATEGORIES, so the `_note` keys sitting alongside real data in the
 * source files can never leak in.
 */
function benchColCategoryValues(geo, county, table) {
  const bucketOf = (table.method && table.method.categoryBucket) || {};
  const state = (table.states || {})[county.state] || {};
  const out = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const bucket = bucketOf[cat];
    if (bucket === "flat" || !bucket) { out[cat] = 1; continue; }
    const base = Number(geo[bucket]);
    if (!isFinite(base)) { out[cat] = 1; continue; }
    out[cat] = (base / 100) * benchColLocalModifier(cat, county, state);
  }
  return out;
}

/**
 * The local modifier for one category. Only two categories have one, and each
 * comes from its own source — see the file's `method.localModifier`.
 *
 * Everything else returns 1.0 deliberately: there is no credible county-level
 * feed for grocery, restaurant or healthcare prices, and inventing per-county
 * food variation would produce exactly the plausible-looking wrong number this
 * whole model exists to remove.
 */
function benchColLocalModifier(category, county, state) {
  if (category === "Housing")   return Number(county.housingRatio) || 1;
  if (category === "Utilities") return Number(state.utilitiesRatio) || 1;
  return 1;
}

/**
 * Is this area actually modeled, or is the national baseline standing in?
 *
 * One definition, two entry points: callers holding a resolved lookup use the
 * predicate directly, callers holding only a ZIP use the wrapper below. Written
 * twice they would eventually disagree.
 *
 * (Don't name the wrapper in this comment — sweep.sh §7b counts a mention as a
 * reference, and then it can neither report it as orphaned nor accept it in
 * DEAD_BASELINE.)
 */
function benchColSupported(col) {
  return !!col && col.source !== "fallback";
}

function benchZipSupported(zip) {
  return benchColSupported(benchColMultipliers(zip));
}

/**
 * The headline cost-of-living index for a ZIP, where 1.0 is the national
 * average.
 *
 * This is BEA's own published All-items figure for the geography, PLUS the
 * weighted deviation each local modifier introduces:
 *
 *     index = all/100 + Σ weight[c] × (final[c] − base[c])
 *
 * Where no local modifier applies the sum is zero and the index IS BEA's
 * number, exactly.
 *
 * Two things it deliberately is NOT:
 *
 *   · Not an unweighted mean of the twelve. That is what it used to be, and it
 *     made Housing — the only category that really swings — one twelfth of the
 *     headline, flattening every real difference toward 1.0.
 *   · Not a recomputation from the weights either. BEA's real weights are
 *     place-specific (where housing is expensive, people spend a larger share
 *     of income on it), so one national weight set reproduces published
 *     All-items to about half a point typically and is off by ten in San Jose.
 *     Anchoring on the published figure and weighting only the deviation is
 *     exact where it can be and honest where it cannot.
 *
 * Returns { index, pct, housingIndex, place, source, supported }.
 */
function benchColIndex(zip) {
  const col = benchColMultipliers(zip);
  const table = (typeof ZIP_COST_OF_LIVING !== "undefined") ? ZIP_COST_OF_LIVING : null;
  const m = col.multipliers || {};

  let index;
  if (col.geo && table) {
    const weights = (table.method && table.method.weights) || {};
    const bucketOf = (table.method && table.method.categoryBucket) || {};
    index = Number(col.geo.all) / 100;
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const bucket = bucketOf[cat];
      if (bucket === "flat" || !bucket) continue;
      const base = Number(col.geo[bucket]) / 100;
      const w = Number(weights[cat]) || 0;
      if (isFinite(base) && isFinite(m[cat])) index += w * (m[cat] - base);
    }
  } else {
    // Prefix fallback has no published composite, so weight what we have.
    const weights = (table && table.method && table.method.weights) || null;
    let sum = 0, wsum = 0;
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const v = Number(m[cat]);
      const w = weights ? (Number(weights[cat]) || 0) : 1;
      if (isFinite(v)) { sum += v * w; wsum += w; }
    }
    index = wsum ? sum / wsum : 1;
  }

  return {
    index: index,
    pct: Math.round((index - 1) * 100),
    // Housing is where nearly all the variation lives, and the composite alone
    // understates that to anyone who knows their own rent. Surfaced separately.
    housingIndex: Number(m.Housing) || null,
    place: benchColPlaceName(col),
    county: col.county ? col.county.state + ":" + col.county.name : null,
    tierName: col.tierName || null,
    source: col.source,
    supported: benchColSupported(col)
  };
}

/**
 * A county for a 3-digit prefix, widening to its numeric neighbours if that
 * exact prefix has no ZIP in the source data.
 *
 * ZIP prefixes are assigned geographically, so the neighbours of a prefix are
 * its neighbours on the ground. Prefix 205 is a case in point: it holds only
 * government "unique" ZIPs, so no county dataset lists it, and 20500 — the
 * White House — resolved to nothing at all. 204 is the Maryland side of the
 * same metro.
 *
 * A good neighbour, not a precise answer, and it only ever runs for a ZIP no
 * county dataset covers.
 */
// Prefixes belonging to US territories, which BEA does not price and Zillow
// does not cover. They must never borrow from a numeric neighbour: 969 is Guam
// and the Northern Marianas, 968 is Honolulu, and they are 3,700 miles apart.
const BENCH_TERRITORY_PREFIXES = [[0, 9], [962, 966], [969, 969]];

function benchColIsTerritory(n) {
  return BENCH_TERRITORY_PREFIXES.some(r => n >= r[0] && n <= r[1]);
}

function benchColPrefixCounty(prefix, prefixes) {
  if (prefixes[prefix] != null) return prefixes[prefix];
  const n = parseInt(prefix, 10);
  if (!isFinite(n) || benchColIsTerritory(n)) return null;
  for (let d = 1; d <= 3; d++) {
    for (const candidate of [n - d, n + d]) {
      if (candidate < 0 || candidate > 999 || benchColIsTerritory(candidate)) continue;
      const key = String(candidate).padStart(3, "0");
      if (prefixes[key] != null) return prefixes[key];
    }
  }
  return null;
}

/** "Santa Clara County, CA" — what to call the place we resolved. */
function benchColPlaceName(col) {
  if (!col || !col.county) return null;
  return col.county.name + " County, " + col.county.state;
}

/**
 * TRAP 3a — the wizard's answer labels do not all match the data keys, and a
 * missed key silently contributes 1.0 instead of the real multiplier.
 *   paysRent: DATA keys are the STRINGS "true" / "false" / "shared", not
 *             booleans. Option values map onto them: rent/mortgage → "true"
 *             (carries full housing), family → "false" (minimal, living
 *             rent-free), other → "shared" (a middle housing tier).
 *   commute:  "mostly walk" is stored as `none` — the label appears nowhere
 */
function benchLifestyleKey(dim, value) {
  if (dim === "paysRent") {
    if (value === true  || value === "yes" || value === "true"
        || value === "rent" || value === "mortgage")             return "true";
    if (value === false || value === "no"  || value === "false"
        || value === "family")                                   return "false";
    if (value === "other" || value === "shared")                 return "shared";
    return String(value);
  }
  if (dim === "commute") {
    if (value === "mostly walk" || value === "walk" || value === "none") return "none";
  }
  return String(value == null ? "" : value);
}

/**
 * TRAP 3b — lifestyle is a PRODUCT across all six dimensions, not one lookup.
 * A category can be touched by several: Dining out is modified by both `foodie`
 * and `cooksAtHome`. Dimensions that do not name the category contribute 1.0.
 *
 * Reach is only 7 of the 12 categories — Utilities, Subscriptions, Health,
 * Personal care and Debt payments are never lifestyle-adjusted.
 */
function benchLifestyleMultiplier(category, lifestyle) {
  const mods = PEER_BENCHMARKS.lifestyleModifiers;
  const answers = lifestyle || {};
  let m = 1;
  for (let i = 0; i < BENCH_LIFESTYLE_DIMS.length; i++) {
    const dim = BENCH_LIFESTYLE_DIMS[i];
    const table = mods[dim];
    if (!table) continue;
    const entry = table[benchLifestyleKey(dim, answers[dim])];
    if (entry && typeof entry[category] === "number") m *= entry[category];
  }
  return m;
}

/**
 * Peer value for one category, rounded to the nearest 5 (method.roundTo).
 * opts: { annualIncome, householdSize, zip, lifestyle }
 * Returns null for anything outside the taxonomy.
 */
function benchPeerValue(category, opts) {
  if (!isCategory(category)) return null;
  const o = opts || {};
  const bases = PEER_BENCHMARKS.base[category];
  if (!bases) return null;

  const band = benchIncomeBand(o.annualIncome);
  const row  = bases[band];
  if (!row) return null;

  const base = Number(row[benchHouseholdIndex(o.householdSize)]) || 0;
  const col  = Number(benchColMultipliers(o.zip).multipliers[category]) || 1;
  const life = benchLifestyleMultiplier(category, o.lifestyle);

  const step = PEER_BENCHMARKS.method.roundTo || 5;
  return Math.round((base * col * life) / step) * step;
}

/** All 12 peer values as {category: value}, in taxonomy order. */
function benchAllPeerValues(opts) {
  const out = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    out[CATEGORIES[i]] = benchPeerValue(CATEGORIES[i], opts);
  }
  return out;
}

/** Benchmark inputs for the current user — persona, with onboarding on top (D09). */
function benchOptsForUser() {
  const p = state.profile || {};
  return {
    annualIncome:  p.incomeAnnual,
    householdSize: p.householdSize,
    zip:           p.zip,
    lifestyle:     state.lifestyle
  };
}

// ─── Self-test (PEER_BENCHMARKS.worked_example) ──────────────────────────────
// The spec shipped a worked example so the model can verify itself on build:
// Dining out, b3, household 2, ZIP 90066, foodie moderate + cooks sometimes →
// 275 × 1.34 × 1.0 = 370.
//
// ── WHY IT NO LONGER ASSERTS 370 ────────────────────────────────────────────
// The 1.34 was the `very_high` tier's Dining-out multiplier, and that tier is
// exactly what this model replaced: it gave Manhattan, Palo Alto, Santa Clara
// and Los Angeles all the same figures. BEA prices restaurant meals inside
// "Services: Other", which for Los Angeles is 107.1 — so the col factor is now
// 1.071 and the peer value is 295.
//
// That is a DELIBERATE change to a number the spec states, so it is recorded
// here rather than absorbed: peer-benchmarks.json is a verbatim spec copy and
// is never edited, and `worked_example.result` still reads 370.
//
// Worth knowing about the new figure: BEA's "Other services" bucket lumps
// restaurants together with healthcare and insurance, which vary far less by
// place, so 1.071 probably understates a Los Angeles restaurant bill. It is
// still the best sourced number available — the alternative is inventing a
// dining-out uplift, which is the class of plausible-looking fabrication this
// whole model exists to remove.
//
// So the test now checks the three factors SEPARATELY. That is strictly
// stronger than the old single assertion, which the original comment already
// admitted several wrong readings could satisfy: the persona is household 2
// with every lifestyle modifier at 1.0, so a wrong array index or a broken
// lifestyle product both still produced 370.
function benchSelfTest() {
  const w = PEER_BENCHMARKS.worked_example;
  const checks = [];

  // 1. Base lookup — the array-index-off-by-one trap. Unchanged by this model.
  const base = PEER_BENCHMARKS.base[w.category].b3[benchHouseholdIndex(2)];
  checks.push({ name: "base b3 household 2", expected: w.base_b3_hh2, actual: base });

  // 2. Lifestyle product across six dimensions. Also unchanged.
  const life = benchLifestyleMultiplier(w.category, PERSONA.lifestyle);
  checks.push({ name: "lifestyle multiplier", expected: w.lifestyleMultiplier, actual: life });

  // 3. Cost of living — the factor this model replaced. Assert it against the
  //    source that replaced it, so the check still has teeth.
  const col = benchColMultipliers(PERSONA.identity.zip);
  const bucket = ((ZIP_COST_OF_LIVING.method || {}).categoryBucket || {})[w.category];
  const expectedCol = col.geo ? Number(col.geo[bucket]) / 100 : null;
  const actualCol = Number(col.multipliers[w.category]);
  checks.push({
    name: "cost of living (BEA " + bucket + ")",
    expected: expectedCol == null ? null : Math.round(expectedCol * 1000) / 1000,
    actual: Math.round(actualCol * 1000) / 1000
  });

  // 4. End to end — the three factors actually multiply.
  const step = PEER_BENCHMARKS.method.roundTo || 5;
  const composed = Math.round((base * actualCol * life) / step) * step;
  const actual = benchPeerValue(w.category, benchOptsForPersona());
  checks.push({ name: "base x col x lifestyle", expected: composed, actual: actual });

  const failed = checks.filter(c => c.expected == null || c.actual == null ||
                                    Math.abs(c.expected - c.actual) > 1e-6);
  return {
    pass: failed.length === 0,
    checks: checks,
    failed: failed,
    // What the spec's own worked example said, and what the model says now.
    specResult: w.result,
    actual: actual,
    detail: w._check + "  —  col is now BEA " + bucket + ", so " +
            base + " x " + (Math.round(actualCol * 1000) / 1000) + " x " + life + " = " + actual
  };
}

/** The persona's own benchmark inputs — what the worked example describes. */
function benchOptsForPersona() {
  return {
    annualIncome:  PERSONA.identity.incomeAnnual,   // 68000 → b3
    householdSize: PERSONA.identity.householdSize,  // 2 → index 1
    zip:           PERSONA.identity.zip,            // 90066 → Los Angeles County
    lifestyle:     PERSONA.lifestyle                // foodie moderate, cooks sometimes
  };
}
