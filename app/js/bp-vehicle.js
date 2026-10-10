// ─── Big Purchase Calculator — the Vehicle category ──────────────────────────
// Spec: docs/big-purchase-spec.md §3.1 (the interface), §6, §7.4–7.5. NO DOM.
//
// Implements exactly the category interface the engine calls and nothing else.
// Every figure is read from data/big-purchase.json → vehicle, and two are
// borrowed from the emergency fund ON PURPOSE (§7.5): the state insurance
// average and the pump price / per-mile upkeep. Reusing them is what keeps the
// two tools from ever disagreeing about the same car.

function bpVData() {
  return bpData().vehicle || {};
}

// ── Where, and how far ───────────────────────────────────────────────────────

/** The state record for the tester's ZIP, or the national fallback. */
function bpVState() {
  const states = bpVData().states || {};
  let code = null;
  try {
    const col = benchColMultipliers((state.profile || {}).zip);
    code = col && col.county ? String(col.county.state || "").toUpperCase() : null;
  } catch (e) { code = null; }
  const hit = code && states[code] && typeof states[code] === "object" ? states[code] : null;
  const rec = Object.assign({}, states._national || {}, hit || {});
  rec.code = hit ? code : null;
  if (!hit && code) rec.name = code;            // a state we have no row for: name it, national figures
  return rec;
}

/** Cents per kWh where they live, from the same state table the Utilities row uses. */
function bpVCentsPerKwh() {
  try {
    const col = benchColMultipliers((state.profile || {}).zip);
    const c = col && col.state ? Number(col.state.centsPerKwh) : NaN;
    if (isFinite(c) && c > 0) return c;
  } catch (e) {}
  return Number(bpVData().nationalCentsPerKwh) || 16.5;
}

/**
 * Miles a day. THIS FEATURE NEVER ASKS (spec §6.1, owner's ruling): it reads
 * whatever the shared profile already holds and otherwise assumes a default.
 *
 * "I don't drive" is floored at `milesFloor` HERE and only here. Zero is the
 * right answer for the emergency fund — it reads 0 as "no car" and drops the
 * premium with it — but somebody buying a car does drive, so a zero would price
 * their fuel and upkeep at nothing. The onboarding band is left alone.
 */
function bpVMilesPerDay() {
  const d = bpVData();
  // The BAND the tester picked, priced for a car. The band's own midpoint is
  // the emergency fund's figure and is not reused: the owner set these for this
  // tool, and every car cost scales straight off the number.
  const band = (state.profile || {}).milesRange;
  const mapped = band ? Number((d.milesBandMidpoints || {})[band]) : NaN;
  if (isFinite(mapped)) return Math.max(Number(d.milesFloor) || 0, mapped);
  const m = typeof esfMilesPerDay === "function" ? esfMilesPerDay() : null;
  if (m == null) return Number(d.milesPerDayDefault) || 15;
  return Math.max(Number(d.milesFloor) || 0, m);
}

/**
 * Where they live, for the "costs are estimated for…" line.
 *
 * The BEA geography's own name is the nearest thing to a city the data holds:
 * "Nashville-Davidson--Murfreesboro--Franklin, TN (Metropolitan Statistical
 * Area)" becomes "Nashville". `benchColPlaceName()` is not used — it returns
 * "Davidson County, TN", and nobody says they live in a county. Falls back to
 * the county, then the state, so the line always names somewhere.
 */
function bpVCity() {
  try {
    const col = benchColMultipliers((state.profile || {}).zip);
    const geoName = col && col.geo ? String(col.geo.name || "") : "";
    if (geoName) {
      const city = geoName.split(",")[0].split("--")[0].split("-")[0].trim();
      if (city) return city;
    }
    if (col && col.county && col.county.name) return col.county.name;
  } catch (e) {}
  return bpVState().name;
}

/** True when the figure above came from something the tester actually said. */
function bpVMilesTold() {
  return typeof esfMilesPerDay === "function" && esfMilesPerDay() != null;
}

/** "Based on the 15–30 miles a day you told us." / "Estimated at 15 miles a day." */
function bpVMilesLine() {
  if (!bpVMilesTold()) return "Estimated at " + bpVMilesPerDay() + " miles a day";
  const band = (typeof ONB_MILES !== "undefined")
    ? ONB_MILES.find(x => x.id === (state.profile || {}).milesRange) : null;
  if (!band) return "Based on the " + bpVMilesPerDay() + " miles a day you told us";
  return "Based on the " + band.label.toLowerCase().replace("i don't drive", "driving you told us about") +
         (/mile/.test(band.label) ? " a day you told us" : "");
}

const BP_DAYS_PER_MONTH = 30.4;

// ── Small lookups ────────────────────────────────────────────────────────────

function bpVAgeKey(inputs) {
  return inputs.condition === "used" ? (inputs.age || "1-3") : "new";
}

function bpVStartAge(inputs) {
  if (inputs.condition !== "used") return 0;
  const band = (bpVData().ages || []).find(a => a.id === inputs.age);
  return band ? Number(band.startAge) || 0 : 2;
}

function bpVFactor(table, key, fallback) {
  const t = ((bpVData().factors || {})[table]) || {};
  const v = Number(t[key]);
  return isFinite(v) && v > 0 ? v : (fallback == null ? 1 : fallback);
}

function bpVTierDown(tier) {
  const order = bpVData().tierOrder || [];
  const i = order.indexOf(tier);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

function bpVTypeLabel(id) {
  const t = (bpVData().types || []).find(x => x.id === id);
  return t ? t.label : "Vehicle";
}

function bpVFuelLabel(id) {
  const f = (bpVData().fuels || []).find(x => x.id === id);
  return f ? f.label : "";
}

function bpVTierLabel(id) {
  return (bpVData().tierLabels || {})[id] || "";
}

function bpVAgeLabel(id) {
  const a = (bpVData().ages || []).find(x => x.id === id);
  return a ? a.label : "";
}

/** "Everyday SUV" — the noun the copy uses. */
function bpVNoun(inputs) {
  return bpVTierLabel(inputs.tier) + " " + bpVTypeLabel(inputs.type);
}

// ── Estimators (§7.5) ────────────────────────────────────────────────────────

function bpVSalesTax(inputs, ctx) {
  const st = bpVState();
  const trade = st.creditsTradeIn ? ctx.about("tradeIn") : 0;
  return bpRound((Number(st.salesTax) || 0) * Math.max(0, (Number(inputs.price) || 0) - trade), 5);
}

function bpVFees() {
  const st = bpVState();
  return bpRound((Number(st.titleFee) || 0) + (Number(st.registration) || 0) + (Number(st.docFee) || 0), 5);
}

/**
 * Insurance a month, on a FULL-COVERAGE policy.
 *
 * The ESF's state figure is the average premium written in that state, and most
 * of those policies are liability-only on a car that is already paid off. Every
 * car here is being bought, usually on a loan that requires comprehensive and
 * collision, so the base is scaled up before the type, tier and age factors run
 * (owner, 2026-09-27: "insurance seems way too low").
 */
function bpVInsurance(inputs) {
  const base = (typeof esfInsuranceStateMonthly === "function" ? esfInsuranceStateMonthly() : 140) *
    (Number((bpVData().factors || {}).insuranceFullCoverage) || 1);
  return bpRound(base *
    bpVFactor("insuranceType", inputs.type) *
    bpVFactor("insuranceTier", inputs.tier) *
    bpVFactor("insuranceCondition", bpVAgeKey(inputs)), 5);
}

/** Fuel or charging a month: miles × the cost of one mile for this vehicle. */
function bpVCostPerMile(inputs) {
  const d = bpVData();
  if (inputs.fuel === "electric") {
    return (Number((d.kWhPerMile || {})[inputs.type]) || 0.3) * bpVCentsPerKwh() / 100;
  }
  let mpg = Number((d.mpg || {})[inputs.type]) || 25;
  if (inputs.fuel === "hybrid") mpg *= Number(d.hybridMpgFactor) || 1;
  if (inputs.fuel === "diesel") mpg *= Number(d.dieselMpgFactor) || 1;
  return bpVPerGallon(inputs) / mpg;
}

/**
 * THIS TOOL'S OWN PUMP PRICE (owner, 2026-09-27: "gas price is higher than $4
 * too"). The emergency fund prices a bill being paid this month, where the EIA
 * national average is the right figure; this prices five years of fuel from
 * whenever the car is bought. A state already dearer than the owner's figure
 * keeps its own — California does not get cheaper because a floor was put
 * under everywhere else.
 */
function bpVPerGallon(inputs) {
  const d = bpVData();
  const base = Math.max(Number(d.pumpPricePerGallon) || 0,
    typeof esfPerGallon === "function" ? esfPerGallon() : 3.15);
  return base + (inputs && inputs.fuel === "diesel" ? (Number(d.dieselPremiumPerGallon) || 0) : 0);
}

/** "$4.25" — a pump price, which is the one figure here that needs its cents. */
function bpVGallonLabel(inputs) {
  return "$" + bpVPerGallon(inputs).toFixed(2);
}

function bpVFuel(inputs) {
  return bpRound(bpVMilesPerDay() * BP_DAYS_PER_MONTH * bpVCostPerMile(inputs), 5);
}

/**
 * Upkeep — a TIME base plus a MILEAGE rate, not cents per mile alone.
 *
 * The flat per-mile model this replaces ran about a third of the real figure
 * for an ordinary driver, and collapsed to almost nothing at low mileage, which
 * is false: oil degrades by date, tires age out, batteries and fluids run on a
 * calendar. Both the condition and tier factors are centred on 1.00 at the
 * baseline the $400 + 6¢ describes — a NEW STANDARD car, averaged over five
 * years of ownership.
 *
 * This matters well beyond one row: upkeep and the loan rate are the two costs
 * that eat a used car's sticker advantage. Understate upkeep and the used
 * option wins by too much, and the comparison teaches the wrong lesson.
 */
function bpVUpkeep(inputs) {
  const u = bpVData().upkeep || {};
  const milesPerYear = bpVMilesPerDay() * 365;
  const perYear = ((Number(u.base) || 0) + milesPerYear * (Number(u.perMile) || 0)) *
    bpVFactor("upkeepAge", bpVAgeKey(inputs)) *
    bpVFactor("upkeepTier", inputs.tier) *
    bpVFactor("upkeepFuel", inputs.fuel) *
    bpVFactor("upkeepType", inputs.type);
  return bpRound(perYear / 12, 5);
}

function bpVSubscriptions(inputs) {
  return Number((bpVData().subscriptions || {})[inputs.tier]) || 0;
}

function bpVRenewal() {
  return bpRound(Number(bpVState().renewal) || 0, 5);
}

/**
 * Value kept after N years, walking the retention curve from the car's own age.
 * A used car starts at its age band, so it skips the steep first year — that is
 * the whole of why its value-lost row is smaller.
 */
function bpVResale(inputs, years) {
  const r = bpVData().retention || {};
  const adj = Number((r.tierAdjust || {})[inputs.tier] || 0) + Number((r.fuelAdjust || {})[inputs.fuel] || 0);
  let v = Number(inputs.price) || 0;
  const start = bpVStartAge(inputs);
  for (let y = start + 1; y <= start + years; y++) {
    const base = y === 1 ? r.year1 : (y <= 5 ? r.years2to5 : r.year6plus);
    v *= Math.min(0.98, Math.max(0.5, (Number(base) || 0.85) + adj));
  }
  return Math.round(v);
}

function bpVLoanRate(inputs, tier) {
  const c = bpData().credit || {};
  const row = (c.tiers || {})[tier] || (c.tiers || {})[c.defaultTier] || {};
  const base = Number(inputs.condition === "used" ? row.used : row.new) || 0;
  return base + (inputs.type === "motorcycle" ? (Number(c.motorcycleAdd) || 0) : 0);
}

// ── The cost rows (§7.4) ─────────────────────────────────────────────────────
// scope "car"   → an edit applies to the selected card only
// scope "about" → an edit applies to every card
// `costless` rows are shown in the stack but are not a cost: a trade-in is a way
// of paying, not a discount, and reduces true cost only through sales tax.
const BP_VEHICLE_ROWS = [
  { id: "salesTax", label: "Sales tax", bucket: "upfront", scope: "car", estimate: bpVSalesTax,
    based: function (inputs) {
      const st = bpVState();
      const pct = Math.round((Number(st.salesTax) || 0) * 10000) / 100;
      return "Based on " + pct + "% in " + st.name +
        (st.creditsTradeIn ? ", less your trade-in." : ". " + st.name + " taxes the full price, even with a trade-in.");
    } },
  { id: "fees", label: "Title, registration and fees", bucket: "upfront", scope: "car", estimate: bpVFees,
    based: function () { return "Title, first registration and the dealer's paperwork fee in " + bpVState().name + "."; } },
  { id: "tradeIn", label: "Trade-in", bucket: "none", scope: "about", typed: true, costless: true, default: 0,
    based: function () { return "What you'd get for your current car, after paying off any loan on it."; } },
  { id: "charger", label: "Home charger", bucket: "upfront", scope: "car",
    showIf: i => i.fuel === "electric", estimate: () => Number(bpVData().charger) || 0,
    based: function () { return "A Level 2 charger, installed."; } },
  { id: "gear", label: "Riding gear", bucket: "upfront", scope: "car",
    showIf: i => i.type === "motorcycle", estimate: () => Number(bpVData().gear) || 0,
    based: function () { return "Helmet, jacket and gloves."; } },

  { id: "insurance", label: "Insurance", bucket: "monthly", scope: "car", estimate: bpVInsurance,
    based: function (inputs) {
      return "Based on full coverage in " + bpVState().name + " for a " +
        (inputs.condition === "used" ? "used " : "new ") + bpVNoun(inputs).toLowerCase() + ".";
    } },
  { id: "fuel", label: "Fuel", bucket: "monthly", scope: "car", estimate: bpVFuel,
    labelFor: i => i.fuel === "electric" ? "Charging" : "Fuel",
    based: function (inputs) {
      if (inputs.fuel === "electric") return bpVMilesLine() + ", at your state's electricity rate.";
      const d = bpVData();
      const mpg = Math.round((Number((d.mpg || {})[inputs.type]) || 25) *
        (inputs.fuel === "hybrid" ? (Number(d.hybridMpgFactor) || 1) : 1) *
        (inputs.fuel === "diesel" ? (Number(d.dieselMpgFactor) || 1) : 1));
      return bpVMilesLine() + ", at about " + mpg + " mpg and " +
        bpVGallonLabel(inputs) + " a gallon.";
    } },
  { id: "upkeep", label: "Upkeep and repairs", bucket: "monthly", scope: "car", estimate: bpVUpkeep,
    based: function (inputs) {
      return bpVMilesLine() + ", for " +
        (inputs.condition === "used" ? "a " + bpVAgeLabel(inputs.age).replace(" yrs", " year") + " old " : "a new ") +
        bpVTierLabel(inputs.tier).toLowerCase() + " " + bpVTypeLabel(inputs.type).toLowerCase() + ".";
    } },
  // NO SUBSCRIPTIONS ROW (owner, 2026-09-27): "that is an add-on that I
  // wouldn't consider for a car alone." Satellite radio and the connected-car
  // app are things a person opts into, not a cost of owning the car, and a
  // screen that claims to price the car should not price them. The figures
  // stay in the data file and bpVSubscriptions() still reads them, so putting
  // the row back is one entry in this array.
  { id: "other", label: "Parking, tolls, anything else", bucket: "monthly", scope: "about", typed: true, default: 0 },

  { id: "renewal", label: "Registration renewal", bucket: "yearly", scope: "car", estimate: bpVRenewal,
    based: function () { return "Each year after the first, in " + bpVState().name + "."; } }
];

// ── Alternatives (§3.8) ──────────────────────────────────────────────────────
//   New, above Value  → used 1–3 yrs (−20%)  +  one tier down, new (−35%)
//   New, Value        → used only
//   Used, above Value → one tier down, same age (−35%)
//   Used, Value       → none — already the lowest-cost option compared
function bpVAlternatives(inputs) {
  const a = bpVData().alternatives || {};
  const price = Number(inputs.price) || 0;
  const out = [];
  const down = bpVTierDown(inputs.tier);
  if (inputs.condition === "new") {
    out.push({
      id: "used",
      label: "Used, " + bpVAgeLabel(a.usedAge || "1-3").replace(" yrs", " years") + " old",
      inputs: Object.assign({}, inputs, { condition: "used", age: a.usedAge || "1-3",
                                          price: bpRound(price * (1 - (Number(a.usedCut) || 0.2)), 100) })
    });
  }
  if (down) {
    out.push({
      id: "tier",
      label: (inputs.condition === "used" ? "Used" : "New") + ", " + bpVTierLabel(down) + " tier",
      inputs: Object.assign({}, inputs, { tier: down,
                                          price: bpRound(price * (1 - (Number(a.tierCut) || 0.35)), 100) })
    });
  }
  return out;
}

function bpVDescribe(inputs) {
  const cond = inputs.condition === "used" ? "Used " + bpVAgeLabel(inputs.age) : "New";
  return bpVNoun(inputs) + " · " + bpVFuelLabel(inputs.fuel) + " · " + cond;
}

/** Only a financed NEW vehicle can qualify (§9.2). Used cars and leases can't. */
function bpVTaxBreak(inputs) {
  const tb = bpData().taxBreak || {};
  if (tb.expires && todayISO() > tb.expires) return null;
  if (tb.newOnly && inputs.condition !== "new") return null;
  return tb.id || null;
}

// ── Screen 1's rows (§6) ─────────────────────────────────────────────────────
// Declarative so the screen can render them and the Continue gate can count
// them without either knowing about cars.
const BP_VEHICLE_SETUP = [
  { id: "type",      label: "Type",      ask: "What kind of vehicle?", options: () => bpVData().types || [] },
  { id: "tier",      label: "Brand",     ask: "What kind of brand?", options: () => (bpVData().tierOrder || []).map(t => ({ id: t, label: bpVTierLabel(t) })),
    examples: i => ((bpVData().tierExamples || {})[i.type || "car"]) || {} },
  { id: "fuel",      label: "Runs on",   ask: "What does it run on?", options: i => (bpVData().fuels || []).filter(f => !(f.hideFor || []).includes(i.type)) },
  { id: "condition", label: "Condition", ask: "New or used?", options: () => [{ id: "new", label: "New" }, { id: "used", label: "Used" }] },
  { id: "age",       label: "Age",       ask: "How old is it?", options: () => bpVData().ages || [], showIf: i => i.condition === "used" },
  { id: "price",     label: "Price",     ask: "What's the sticker price?", typed: true }
];

bpRegisterCategory({
  id: "vehicle",
  label: "A vehicle",
  setupInputs: BP_VEHICLE_SETUP,
  costRows: BP_VEHICLE_ROWS,
  horizons: { primary: 5, secondary: 3 },
  resaleValue: bpVResale,
  loanRate: bpVLoanRate,
  taxBreak: bpVTaxBreak,
  alternatives: bpVAlternatives,
  describe: bpVDescribe,
  noun: bpVNoun
});
