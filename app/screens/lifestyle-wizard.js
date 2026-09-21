// ─── Lifestyle wizard (04-budget-benchmarks) ─────────────────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Hidden — full-bleed question flow
//
// The single budget builder (L6), replacing v2's 2 Minute Budget and Lifestyle
// Survey. Six questions, asked BEFORE the budget exists.
//
// "Answers feed lifestyleModifiers in peer-benchmarks.json and produce a
// starting budget across all twelve categories. The user then adjusts with
// sliders."
//
// So the starting budget IS the peer model run against their own answers —
// which is why no question asks for a figure. That is the pitch: you never have
// to guess at a number.

// The six dimensions, in spec order. `value` is usually the DATA key, but not
// always — paysRent values (rent/mortgage/family/other) map to the data keys
// "true"/"false"/"shared" via benchLifestyleKey, and "mostly walk" is stored as
// `none`. A value that resolves to no key silently contributes 1.0.
// `meaning` is what the option says about how you live, in behaviour rather
// than numbers (D26 — describe, never prescribe). The FIGURES beside it are
// computed at render time from the peer model, so they already carry the ZIP's
// cost-of-living multiplier; never author a dollar amount here.
const LW_QUESTIONS = [
  { dim: "foodie", prompt: "How into food are you?",
    help: "Eating out, good coffee, trying places.",
    options: [
      { label: "Not much",  value: "low",
        meaning: "Food is mostly fuel. You eat what's easy, and where it comes from isn't something you think about much." },
      { label: "Moderate",  value: "moderate",
        meaning: "You eat out when it suits you — a few times a week, nothing built around it." },
      { label: "Very into it", value: "high",
        meaning: "Eating out is something you do for its own sake. Good coffee, new places, the meal is the point." }
    ] },
  { dim: "cooksAtHome", prompt: "How often do you cook?",
    help: "Cooking at home pulls spending out of dining out and into groceries.",
    options: [
      { label: "Rarely",    value: "rarely",
        meaning: "The kitchen is mostly storage. Most meals turn up already made." },
      { label: "Sometimes", value: "sometimes",
        meaning: "You cook when there's time and pick something up when there isn't." },
      { label: "Usually",   value: "usually",
        meaning: "Groceries carry the week. Eating out is an occasion rather than a habit." }
    ] },
  { dim: "hobbySpend", prompt: "Hobbies and going out?",
    help: "Entertainment, gigs, kit, the stuff you do for fun.",
    options: [
      { label: "Low key",   value: "low",
        meaning: "Your free time costs close to nothing — home, outdoors, things you already own." },
      { label: "Moderate",  value: "moderate",
        meaning: "A night out here, a bit of kit there. It adds up without being the main line." },
      { label: "A lot",     value: "high",
        meaning: "Gigs, gear, going out. Your weekends have a price on them." }
    ] },
  { dim: "paysRent", prompt: "What's your housing setup?",
    help: "Housing is the single biggest swing between households.",
    // These values are NOT the data keys — benchLifestyleKey maps them:
    // rent/mortgage → "true", family → "false", other → "shared".
    options: [
      { label: "Rent",             value: "rent",
        meaning: "The whole housing cost lands on you each month, on someone else's terms." },
      { label: "Mortgage",         value: "mortgage",
        meaning: "The whole housing cost lands on you each month, and part of it is buying the place." },
      { label: "Live with family", value: "family",
        meaning: "Housing barely registers — you're covering a share of the bills rather than a market rate." },
      { label: "Other",            value: "other",
        meaning: "Housing is split with someone, so you carry part of a market rate instead of all of it." }
    ] },
  { dim: "commute", prompt: "How do you get around?",
    help: null,
    options: [
      { label: "Car",         value: "car",
        meaning: "A car means fuel, insurance, and the repair you didn't plan for." },
      { label: "Transit",     value: "transit",
        meaning: "Fares and passes. No repair bills, no parking." },
      { label: "Mostly walk", value: "none",     // stored as `none`, not "walk"
        meaning: "Getting around costs you almost nothing — the odd fare and not much else." }
    ] },
  { dim: "travelFrequency", prompt: "How often do you travel?",
    help: null,
    options: [
      { label: "Rarely",   value: "rare",
        meaning: "A trip is a rare thing, so nothing is going aside for one month to month." },
      { label: "Now and then", value: "moderate",
        meaning: "A couple of trips a year — enough that it shows up in an ordinary month." },
      { label: "Often",    value: "frequent",
        meaning: "You're away often, and the flights, rooms and everything around them sit in your normal spending." }
    ] }
];

// ─── The relative model ──────────────────────────────────────────────────────
// The preview is a RUNNING figure, not a recomputation. Q1 sets a rough
// starting point for Dining out; the user can drag it; Q2 then applies its own
// change ON TOP of where they left it. So a number you moved by hand is never
// silently thrown away two questions later.
//
// PEER_BENCHMARKS.lifestyleModifiers is already a per-dimension multiplier
// table, which makes that a straight ratio:
//
//   new = current × mods[dim][newAnswer][cat] / mods[dim][answerAlreadyApplied][cat]
//
// An unanswered dimension contributes 1.0, so the first answer is just the
// multiplier. Re-answering (via Back) divides the old one out with no special
// case. With no drags at all this lands on exactly what benchAllPeerValues
// would have produced — the product of the same six multipliers.

/** The 12 peer values with every lifestyle modifier at 1.0 — the starting point. */
function lwNeutralPreview() {
  return benchAllPeerValues({
    annualIncome:  state.profile.incomeAnnual,
    householdSize: state.profile.householdSize,
    zip:           state.profile.zip,
    lifestyle:     {}
  });
}

/** Categories this dimension actually moves. Guards the `_note` key. */
function lwTouchedCategories(dim) {
  const table = (PEER_BENCHMARKS.lifestyleModifiers || {})[dim];
  if (!table) return [];
  const seen = {};
  Object.keys(table).forEach(answerKey => {
    if (answerKey.charAt(0) === "_") return;
    const entry = table[answerKey];
    if (!entry) return;
    CATEGORIES.forEach(c => { if (typeof entry[c] === "number") seen[c] = true; });
  });
  return CATEGORIES.filter(c => seen[c]);
}

/** One dimension's multiplier for one category, or 1.0 when it says nothing. */
function lwModifier(dim, value, category) {
  const table = (PEER_BENCHMARKS.lifestyleModifiers || {})[dim];
  if (!table || value == null) return 1;
  const entry = table[benchLifestyleKey(dim, value)];
  if (!entry || typeof entry[category] !== "number") return 1;
  return entry[category];
}

// ─── Answers compose; drags ride on top ──────────────────────────────────────
// The preview used to be a RUNNING figure — each answer multiplied whatever was
// already on screen. That is stable in theory and drifted badly in practice:
//
//   pick Moderate -> drag Groceries to the floor -> pick Very into it
//
// scaled the DRAGGED figure by 1.12 instead of the option's own figure, so
// groceries stayed at the floor while dining out sat at its full starting
// value. Toggling between options a few times, with each result rounded to the
// nearest 5, walked the number somewhere neither answer implies. The reported
// case ended at $10 a month of groceries for "Very into it".
//
// The model now has two separable parts:
//
//   IMPLIED  the neutral peer figure times every APPLIED dimension's modifier.
//            Recomputed from the baseline every time, so it never accumulates
//            rounding and re-answering a question always lands on the same
//            number.
//   DRIFT    the tester's own adjustment, held as a RATIO of what was implied
//            when they dragged. It survives later answers, which is the point
//            of the design: "the questions after this one adjust from wherever
//            you leave it."
//
// Re-answering the SAME question clears the drift on the categories it moves,
// because the drag described the old answer. Answering a DIFFERENT question
// keeps it.

/** The neutral peer figure with every dimension EXCEPT `dim` folded in. */
function lwBaseWithout(dim, category) {
  const w = state.lifestyleWizard || {};
  // `applied` can be absent on a half-built session — an admin jump straight to
  // the screen, or a harness driving one handler in isolation. Default it here
  // rather than at each read.
  const applied = w.applied || {};
  let v = Number((w.neutral || {})[category]) || 0;
  LW_QUESTIONS.forEach(q => {
    if (q.dim === dim) return;
    if (applied[q.dim] == null) return;
    v *= lwModifier(q.dim, applied[q.dim], category);
  });
  return v;
}

/** What every CURRENT answer implies for a category, before any dragging. */
function lwImpliedNow(category) {
  const w = state.lifestyleWizard || {};
  const applied = w.applied || {};
  let v = Number((w.neutral || {})[category]) || 0;
  LW_QUESTIONS.forEach(q => {
    if (applied[q.dim] == null) return;
    v *= lwModifier(q.dim, applied[q.dim], category);
  });
  return Math.round(v / 5) * 5;
}

/** What this option IMPLIES for a category, before any dragging. */
function lwImplied(dim, value, category) {
  return Math.round((lwBaseWithout(dim, category) * lwModifier(dim, value, category)) / 5) * 5;
}

/** What `category` becomes if this dimension is answered `value`, drift included. */
function lwProjected(dim, value, category) {
  const w = state.lifestyleWizard;
  const drift = (w.drift && w.drift[category]) || 1;
  return Math.round((lwImplied(dim, value, category) * drift) / 5) * 5;
}

/** Fold an answer into the preview and record it as applied. */
function lwApplyDimension(dim, value) {
  const w = state.lifestyleWizard;
  if (!w.anchors) w.anchors = {};
  if (!w.drift) w.drift = {};
  const cats = lwTouchedCategories(dim);

  // Changing your mind on THIS question throws away the drag made under the
  // previous answer — it was a refinement of an answer that no longer stands.
  // Without this the drag is carried into every later option and compounds.
  const isReanswer = w.applied[dim] != null && w.applied[dim] !== value;
  if (isReanswer) cats.forEach(c => { delete w.drift[c]; });

  const anchor = {};
  cats.forEach(c => {
    // The band is measured from the IMPLIED figure, not the drifted one, so
    // dragging cannot recentre its own bounds and ratchet them outwards.
    anchor[c] = lwImplied(dim, value, c);
    w.preview[c] = lwProjected(dim, value, c);
  });
  w.anchors[dim] = anchor;
  w.applied[dim] = value;
}

// ─── v3.1: the flow is inverted ──────────────────────────────────────────────
// v3 asks six lifestyle questions and derives a budget from the answers; the
// tester never types a figure. v3.1 does the opposite: THEY SET THE NUMBERS
// FIRST, on one screen of twelve sliders, and the questions afterwards are a
// second opinion rather than the source.
//
//   1  spending profile   twelve sliders, opening on ZIP-adjusted national
//                         averages. Save here, or carry on.
//   2  lifestyle questions the same six, meaning text kept, NO sliders under
//                         them — the answers only produce a figure to compare
//   3  which is closer     per category where the two differ: their figure,
//                         the midpoint, or the model's
//
// This is the A/B difference against v3. Keep the two readable side by side:
// the shared machinery (lwImpliedNow, submitBudgetBaseline, the peer model) is
// deliberately untouched so a diff shows the FLOW changing and nothing else.

function lwStart() {
  // Blank by default. state.lifestyle is fully populated from the persona at
  // boot (js/boot.js), so seeding from it pre-selected all six questions with
  // answers the tester never gave. Only dimensions they actually answered
  // elsewhere — onboarding step 5 asks two of the six — carry over.
  const answered = state.lifestyleAnswered || {};
  const answers = {};
  LW_QUESTIONS.forEach(q => {
    if (answered[q.dim] && state.lifestyle[q.dim] != null) answers[q.dim] = state.lifestyle[q.dim];
  });

  state.lifestyleWizard = {
    step: 0,
    answers: answers,
    applied: {},                 // which answer each dimension currently has folded in
    anchors: {},                 // per dimension, the figure each answer implied
    drift: {},                   // per category, the tester's drag as a ratio
    neutral: lwNeutralPreview(), // the peer figures with every modifier at 1.0
    travel: null,                // trips a year x cost a trip (see lwTravelBlock)
    // What the TESTER sets on the sliders in step 1. Held apart from `preview`
    // so the compare screen can put the two figures side by side — the whole
    // point of this flow is that they stay distinguishable.
    profile: lwNeutralPreview(),
    choices: {},                 // per category: "profile" | "mid" | "model"
    preview: lwNeutralPreview()
  };
  // Fold in whatever carried over, so the questions start from the same place
  // the rest of the flow will.
  Object.keys(answers).forEach(dim => lwApplyDimension(dim, answers[dim]));
  lwApplyStated();
  // Step 1 is the sliders. The questions are opt-in from there.
  go("spendingProfile");
}

/** Leave the profile screen for the questions. */
function lwToQuestions() {
  const w = state.lifestyleWizard;
  if (!w) { lwStart(); return; }
  w.step = 0;
  go("lifestyleWizard");
}

/**
 * Categories where the tester's figure and the model's disagree.
 *
 * Only these get a row on the compare screen. Lifestyle reaches 7 of the 12, so
 * the other five would be a row that asks nothing — and of those 7, any the
 * tester happened to leave on the model's own figure agree anyway.
 */
function lwDisagreements() {
  const w = state.lifestyleWizard;
  if (!w) return [];

  // Only categories an ANSWERED question actually moves. Two exclusions, both
  // deliberate:
  //
  //   - the five lifestyle never reaches (Utilities, Subscriptions, Health,
  //     Personal care, Debt payments). The model has no opinion about them
  //     beyond the default the tester already saw and chose to move.
  //   - dimensions left unanswered, which contribute a 1.0 multiplier. Asking
  //     about those would be asking the tester to defend an edit against the
  //     default they edited, which is not a question.
  const reached = {};
  LW_QUESTIONS.forEach(q => {
    if (w.applied[q.dim] == null) return;
    lwTouchedCategories(q.dim).forEach(c => { reached[c] = true; });
  });

  return CATEGORIES.filter(c => reached[c] && lwProfileValue(c) !== lwModelValue(c));
}

/** What the tester set on the sliders. */
function lwProfileValue(category) {
  const w = state.lifestyleWizard;
  return Math.round((Number((w.profile || {})[category]) || 0) / 5) * 5;
}

/** What the lifestyle answers imply — neutral x every applied modifier. */
function lwModelValue(category) {
  return lwImpliedNow(category);
}

/** Halfway, on the same 5s every other figure in the budget lands on. */
function lwMidValue(category) {
  return Math.round(((lwProfileValue(category) + lwModelValue(category)) / 2) / 5) * 5;
}

/** The figure a category resolves to, given the row's current selection. */
function lwResolved(category) {
  const w = state.lifestyleWizard;
  const pick = (w && w.choices && w.choices[category]) || "profile";
  if (pick === "model") return lwModelValue(category);
  if (pick === "mid")   return lwMidValue(category);
  return lwProfileValue(category);
}

function lwChoose(category, pick) {
  const w = state.lifestyleWizard;
  if (!w.choices) w.choices = {};
  w.choices[category] = pick;
  render();
}

/** After the last question. Skips the compare screen when nothing disagrees. */
function lwToCompare() {
  if (!lwDisagreements().length) { lwSubmitProfile(); return; }
  go("budgetCompare");
}

/**
 * Overwrite peer guesses with figures the tester actually stated.
 *
 * Onboarding's commute follow-up asks what running a car, or a week of fares,
 * actually costs them. A stated figure beats a peer average, so it replaces
 * Transport rather than modifying it.
 *
 * Runs AFTER the answers are folded in, on purpose: applying it before would
 * let lwApplyDimension('commute', …) multiply a figure that already accounts
 * for their commute. Running it after leaves `applied.commute` untouched, so if
 * they change the commute answer later in the wizard the ratio still scales
 * from their own number instead of snapping back to the peer one.
 */
function lwApplyStated() {
  const w = state.lifestyleWizard;
  const stated = state.lifestyleDetail || {};
  if (stated.transportMonthly != null) {
    w.preview.Transport = Math.round(Number(stated.transportMonthly) / 5) * 5;
  }
}

// Pick an option. Does NOT advance — the tester confirms with Continue, so a
// mis-tap is recoverable and the description below has something to describe.
function lwAnswer(dim, value) {
  const w = state.lifestyleWizard;
  if (w.answers[dim] === value) return;
  w.answers[dim] = value;
  lwApplyDimension(dim, value);
  if (dim === "travelFrequency") {
    // Other just moved, so its travel/everything-else split has to be redrawn
    // from the new figure rather than the old one.
    if (w.travel) w.travel.residual = null;
    lwTravelSyncToAnswer(value);
    w.preview.Other = lwOtherResidual() + lwTravelMonthly();
  }
  render();
}

function lwNext() {
  const w = state.lifestyleWizard;
  if (w.step < LW_QUESTIONS.length - 1) { w.step++; render(); return; }
  lwToCompare();
}

function lwBack() {
  const w = state.lifestyleWizard;
  if (w.step > 0) { w.step--; render(); return; }
  navBack();
}

// The starting budget IS the running preview — the peer model walked forward
// one answer at a time, with the user's own drags left in place. Rebuilding it
// from benchAllPeerValues here (as this used to) threw away every adjustment
// they made on the way through.
function lwBuildPreview() {
  const w = state.lifestyleWizard;
  if (!w.preview) {
    w.neutral = lwNeutralPreview();
    w.preview = lwNeutralPreview();
    w.applied = {};
    w.anchors = {};
    w.drift = {};
    Object.keys(w.answers).forEach(dim => lwApplyDimension(dim, w.answers[dim]));
    lwApplyStated();
  }
  return w.preview;
}

// debouncedRender, not render: fires on every pointer move of the slider, and
// a full render replaces the element being dragged (see budgetSetPlan). The
// readout is painted directly so the figure still tracks during the gesture.
function lwAdjust(category, amount) {
  const w = state.lifestyleWizard;

  // On the profile screen the tester is setting THEIR figure, which is a
  // different thing from the running preview the questions build. Writing both
  // to one map is what would make the compare screen show a category against
  // itself.
  if (state.screen === "spendingProfile") {
    const cap = budgetSliderMax(category);
    if (!w.profile) w.profile = lwNeutralPreview();
    w.profile[category] = Math.max(0, Math.min(cap, Math.round(Number(amount) || 0)));
    const pel = document.getElementById("lwAmt" + CATEGORIES.indexOf(category));
    if (pel) pel.textContent = budgetFmt(w.profile[category]) + " a month";
    debouncedRender();
    return;
  }

  const bounds = lwBoundsForCategory(category);
  let v = Math.max(0, Math.round(Number(amount) || 0));
  // Clamp in the handler too, not just on the element. A later answer can move
  // a category the tester already dragged, and the browser only enforces
  // min/max on the input it is attached to.
  if (bounds) v = Math.max(bounds.min, Math.min(bounds.max, v));
  w.preview[category] = v;

  // Record the drag as a RATIO of what the current answers imply, not as an
  // absolute. That is what lets a later question move this category and still
  // respect "I want a bit less than that" — and what stops a raw figure being
  // carried into an option it was never chosen under.
  const implied = lwImpliedNow(category);
  if (!w.drift) w.drift = {};
  if (implied > 0) w.drift[category] = v / implied;
  else delete w.drift[category];

  const el = document.getElementById("lwAmt" + CATEGORIES.indexOf(category));
  if (el) el.textContent = budgetFmt(w.preview[category]) + " a month";
  debouncedRender();
}

// Save goes through the seam — never straight into state.plan (L6).
// Both exits go through the one seam (L6). Only the figures differ, and the
// `source` records which route produced them — that is A/B data, not bookkeeping.

function lwSubmitBaseline(source, monthly) {
  const w = state.lifestyleWizard;
  submitBudgetBaseline({
    source: source,
    profile: {
      zip: state.profile.zip,
      householdSize: state.profile.householdSize,
      incomeAnnual: state.profile.incomeAnnual
    },
    lifestyle: Object.assign({}, w.answers),
    monthly: monthly
  });
}

/** Saved straight off the sliders, without answering anything. */
function lwSubmitProfile() {
  const w = state.lifestyleWizard;
  const monthly = {};
  CATEGORIES.forEach(c => { monthly[c] = lwProfileValue(c); });
  lwSubmitBaseline(Object.keys(w.answers).length ? "profile+lifestyle" : "profile", monthly);
}

/** Saved after the questions, with each disagreement resolved on the compare screen. */
function lwSubmitCompared() {
  const monthly = {};
  CATEGORIES.forEach(c => { monthly[c] = lwResolved(c); });
  lwSubmitBaseline("profile+lifestyle", monthly);
}

// Kept: v3's own path still calls it, and the two files stay diffable.
function lwSubmit() {
  const w = state.lifestyleWizard;
  lwSubmitBaseline("lifestyleWizard", Object.assign({}, w.preview));
}

function renderLifestyleWizard() {
  const w = state.lifestyleWizard || (lwStart(), state.lifestyleWizard);
  const q = LW_QUESTIONS[w.step];
  const picked = w.answers[q.dim];
  const opt = q.options.find(o => o.value === picked);

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">Question ${w.step + 1} of ${LW_QUESTIONS.length}</p>
        <div class="journal-progress" aria-hidden="true">
          ${LW_QUESTIONS.map((_, i) => `<span class="journal-pip ${i <= w.step ? "on" : ""}"></span>`).join("")}
        </div>
        <h1 class="title" style="font-size:21px;margin:12px 0 0;">${h(q.prompt)}</h1>
        ${q.help ? `<p class="helper" style="margin:6px 0 0;">${h(q.help)}</p>` : ""}
      </div>

      <div class="journal-body">
        <div class="journal-options">
          ${q.options.map(o => `
            <button class="journal-opt ${picked === o.value ? "picked" : ""}" type="button"
                    onclick="lwAnswer('${q.dim}','${o.value}')">
              <span class="journal-opt-label">${h(o.label)}</span>
            </button>
          `).join("")}
        </div>

        ${opt ? lwMeaningBlock(q, opt) : `
          <p class="helper" style="margin:16px 0 0;">
            Pick the one that sounds most like you and I'll show what it means.
          </p>`}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="lwBack()">Back</button>
        <button class="button" type="button" onclick="lwNext()" ${opt ? "" : "disabled"}>
          ${w.step < LW_QUESTIONS.length - 1 ? "Continue" : "See the budget"}
        </button>
      </div>
    </div>
  `;
}

// What the pick means, then the categories it moves — each with a slider seeded
// where that option puts it. The figures come from the peer model, so the ZIP's
// cost of living is already in them; the copy above says what the behaviour is,
// never what to do about it (D26).
// ─── Travel: the arithmetic, shown ───────────────────────────────────────────
// Picking "Now and then" produced $85 and the tester read it as a travel
// budget. It never was. travelFrequency multiplies exactly one category —
// "Other", the catch-all — and "Now and then" is x1.0, an exact no-op, so the
// figure was Other's untouched peer base and identical to never answering at
// all. The option's copy talked about trips while the number talked about
// miscellaneous spending.
//
// There is no Travel category and there should not be one: CATEGORIES is the
// join key across four data files, and peer-benchmarks.json has no Travel base
// to compare against. So travel becomes a NAMED LINE INSIDE Other — trips a
// year x a typical trip, divided by twelve — and Other renders as that plus
// everything else, summing to the category total.
//
// The frequency answer still has a job: it seeds trips-a-year.
const LW_TRIPS_FOR = { rare: 1, moderate: 3, frequent: 8 };
const LW_TRIPS_RANGE = { min: 0, max: 12, step: 1 };
const LW_TRIP_COST_RANGE = { min: 0, max: 4000, step: 50 };
const LW_TRIP_COST_DEFAULT = 900;

function lwTravel() {
  const w = state.lifestyleWizard;
  if (!w) return null;
  if (!w.travel) {
    const answer = w.answers.travelFrequency;
    w.travel = {
      trips: LW_TRIPS_FOR[answer] != null ? LW_TRIPS_FOR[answer] : 3,
      costPerTrip: LW_TRIP_COST_DEFAULT
    };
  }
  return w.travel;
}

/** Monthly accrual implied by the two figures. Rounded to the budget's 5s. */
function lwTravelMonthly() {
  const t = lwTravel();
  if (!t) return 0;
  return Math.round(((Number(t.trips) || 0) * (Number(t.costPerTrip) || 0)) / 12 / 5) * 5;
}

/** Re-seed trips when the frequency answer changes, unless it was hand-set. */
function lwTravelSyncToAnswer(value) {
  const w = state.lifestyleWizard;
  if (!w) return;
  const seeded = LW_TRIPS_FOR[value];
  if (seeded == null) return;
  if (!w.travel) { lwTravel(); return; }
  if (!w.travel.tripsTouched) w.travel.trips = seeded;
}

function lwSetTravel(field, value) {
  const w = state.lifestyleWizard;
  const t = lwTravel();
  const range = field === "trips" ? LW_TRIPS_RANGE : LW_TRIP_COST_RANGE;
  const n = Math.max(range.min, Math.min(range.max, Math.round(Number(value) || 0)));
  t[field] = n;
  if (field === "trips") t.tripsTouched = true;
  // Travel is a PART of Other, so the category moves with it — the rest of
  // Other holds still.
  const other = lwOtherResidual();
  w.preview.Other = other + lwTravelMonthly();
  const amt = document.getElementById("lwAmt" + CATEGORIES.indexOf("Other"));
  if (amt) amt.textContent = budgetFmt(w.preview.Other) + " a month";
  const line = document.getElementById("lwTravelLine");
  if (line) line.innerHTML = lwTravelLineText();
  debouncedRender();
}

/** Everything in Other that is NOT the travel accrual. */
function lwOtherResidual() {
  const w = state.lifestyleWizard;
  if (!w) return 0;
  if (w.travel && w.travel.residual != null) return w.travel.residual;
  const residual = Math.max(0, (Number(w.preview.Other) || 0) - lwTravelMonthly());
  if (w.travel) w.travel.residual = residual;
  return residual;
}

function lwTravelLineText() {
  const t = lwTravel();
  const monthly = lwTravelMonthly();
  const trips = Number(t.trips) || 0;
  if (trips === 0 || monthly === 0) {
    return "No trips planned, so nothing is going aside for one.";
  }
  return `${trips} trip${trips === 1 ? "" : "s"} a year at about
    ${h(budgetFmt(t.costPerTrip))} each works out to
    <strong>${h(budgetFmt(monthly))} a month</strong> set aside.`;
}

function lwTravelBlock() {
  const t = lwTravel();
  const residual = lwOtherResidual();
  return `
    <div class="card">
      <p class="task-title" style="margin:0 0 8px;font-size:13px;">Trips</p>
      <div class="row" style="align-items:baseline;margin-bottom:6px;">
        <span class="budget-row-name">Trips a year</span>
        <span class="budget-row-amt">${t.trips}</span>
      </div>
      <input class="journal-slider" type="range"
             min="${LW_TRIPS_RANGE.min}" max="${LW_TRIPS_RANGE.max}" step="${LW_TRIPS_RANGE.step}"
             value="${t.trips}" oninput="lwSetTravel('trips', this.value)"
             aria-label="Trips a year">

      <div class="row" style="align-items:baseline;margin:14px 0 6px;">
        <span class="budget-row-name">A typical trip</span>
        <span class="budget-row-amt">${budgetFmt(t.costPerTrip)}</span>
      </div>
      <input class="journal-slider" type="range"
             min="${LW_TRIP_COST_RANGE.min}" max="${LW_TRIP_COST_RANGE.max}" step="${LW_TRIP_COST_RANGE.step}"
             value="${t.costPerTrip}" oninput="lwSetTravel('costPerTrip', this.value)"
             aria-label="Cost of a typical trip">

      <p class="helper" id="lwTravelLine" style="margin:12px 0 0;">${lwTravelLineText()}</p>
      <p class="helper" style="margin:8px 0 0;font-size:10px;">
        That sits inside Other, alongside ${h(budgetFmt(residual))} a month of
        everything else.
      </p>
    </div>`;
}

function lwMeaningBlock(q, opt) {
  const cats = lwTouchedCategories(q.dim);
  const zip = state.profile.zip;
  // Travel gets the arithmetic instead of a bare Other slider — see above.
  if (q.dim === "travelFrequency") {
    return `
      <div class="card lw-meaning">
        <p class="task-title" style="margin:0 0 4px;font-size:13px;">${h(opt.label)}</p>
        <p class="task-desc" style="margin:0;">${h(opt.meaning || "")}</p>
        <p class="helper" style="margin:10px 0 0;font-size:11px;">
          Trips are lumpy rather than monthly, so this works out what they come
          to across a year. Change either figure if it looks wrong.
        </p>
      </div>
      ${lwTravelBlock()}`;
  }
  return `
    <div class="card lw-meaning">
      <p class="task-title" style="margin:0 0 4px;font-size:13px;">${h(opt.label)}</p>
      <p class="task-desc" style="margin:0;">${h(opt.meaning || "")}</p>
      ${cats.length ? `
        <p class="helper" style="margin:10px 0 0;font-size:11px;">
          That moves ${cats.length === 1 ? "one category" : cats.length + " categories"}.
          Nothing changes yet — at the end you pick whichever figure is closer
          to true, yours or mine.
        </p>` : `
        <p class="helper" style="margin:10px 0 0;font-size:11px;">
          This one shapes how I read the rest rather than moving a category on
          its own.
        </p>`}
    </div>
  `;
}

// ─── Bounding a slider to the option that was picked ─────────────────────────
// "Moderate" on food reached a thousand in groceries, which made the
// description above the slider a claim about somebody else.
//
// The band is ±25% around what THIS option projects for THIS category. The
// projection is lwProjected, which reads the running preview — so the BEA
// cost-of-living multiplier, the household-size array index and every other
// answered dimension are already inside it. Never re-derive from
// PEER_BENCHMARKS.colTiers: that table is a retired guard and reading it
// directly reintroduces the flattening the cost-of-living rebuild fixed.
//
// The bands OVERLAP between neighbouring options and leave small gaps between
// distant ones — some figures are reachable from two options and a few from
// none. That is the deliberate trade against hard contiguous boundaries: it is
// the more forgiving of the two at the edges, where a tester is likeliest to be
// between two answers anyway.
//
// The top option keeps an open ceiling. "A lot" of hobby spend should be able
// to exceed its own +25% — there is no option above it to promote to.
const LW_BAND = 0.25;

function lwOptionBounds(q, opt, category) {
  if (!q || !opt) return null;
  // Travel is the exception, and has to be. Its Other figure is COMPOSED — a
  // trips-a-year accrual plus the rest of the category — not the modifier table
  // times a base, so a band measured off that table describes a number the
  // screen never shows. lwTravelBlock owns those figures and clamps them itself.
  if (q.dim === "travelFrequency") return null;
  const w = state.lifestyleWizard;
  const anchors = (w && w.anchors && w.anchors[q.dim]) || null;
  // The anchor when this option is the applied one; the projection otherwise
  // (Back to a question, before re-picking).
  const projected = (anchors && w.applied[q.dim] === opt.value && anchors[category] != null)
    ? anchors[category]
    : lwProjected(q.dim, opt.value, category);
  if (!projected) return null;
  const isTop = q.options[q.options.length - 1].value === opt.value;
  const floor = Math.round((projected * (1 - LW_BAND)) / 5) * 5;
  const ceil  = Math.round((projected * (1 + LW_BAND)) / 5) * 5;
  const hardMax = budgetSliderMax(category);
  return {
    min: Math.max(0, floor),
    max: isTop ? Math.max(ceil, hardMax) : Math.min(ceil, hardMax),
    openTop: isTop,
    optionLabel: opt.label
  };
}

/** Bounds for whatever question is on screen, or null when it isn't bounded. */
function lwBoundsForCategory(category) {
  const w = state.lifestyleWizard;
  if (!w || !w.applied) return null;
  // Question screens only. `step` still points at the last question once the
  // review opens, so without this the review's twelve full-range sliders would
  // silently clamp to the last question's band.
  if (state.screen !== "lifestyleWizard") return null;
  const q = LW_QUESTIONS[w.step];
  if (!q) return null;
  const opt = q.options.find(o => o.value === w.answers[q.dim]);
  if (!opt) return null;
  if (lwTouchedCategories(q.dim).indexOf(category) === -1) return null;
  return lwOptionBounds(q, opt, category);
}

// ─── Review: the starting budget, with sliders ───────────────────────────────

// ─── Step 1: the spending profile ────────────────────────────────────────────
// Was the LAST screen in v3 — the review of a budget the questions had already
// built. Here it is the first thing the tester sees, and the figures on it are
// theirs rather than a result.
//
// Opening values are ZIP-adjusted national averages: lwNeutralPreview() is
// benchAllPeerValues with `lifestyle: {}`, so it carries the peer table's own
// non-linearity (housing barely moves with household size, groceries move a
// lot) and the BEA multiplier for their area, with nothing about how they live
// folded in yet. That is exactly what "start them at the average" should mean.
//
// Full slider range here. The +/-25% option bands belong to the question
// screens and no option has been chosen yet.
function renderSpendingProfile() {
  const w = state.lifestyleWizard || (lwStart(), state.lifestyleWizard);
  if (!w.profile) w.profile = lwNeutralPreview();
  const total = catTotal(w.profile);
  const income = state.monthlyIncome;
  const left = income - total;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">What do you spend?</h1>
        <p class="helper" style="margin:6px 0 0;">
          Starting from the national average for a household your size, adjusted
          for ${h(state.profile.zip)}. Move anything that is not you.
        </p>
      </div>

      <div class="journal-body">
        <div class="card">
          <div class="row" style="align-items:baseline;">
            <span class="helper">Monthly total</span>
            <span class="journal-total">${budgetFmt(total)}</span>
          </div>
          <div class="row" style="align-items:baseline;margin-top:4px;">
            <!-- Onboarding stopped estimating tax and uses the figure the
                 tester gave, divided by twelve, so a post-tax label would be a
                 claim we cannot back. -->
            <span class="helper">Coming in each month</span>
            <span class="helper">${budgetFmt(income)}</span>
          </div>
          <p class="helper" style="margin:8px 0 0;color:${left < 0 ? "var(--warn)" : "var(--muted)"};">
            ${left >= 0
              ? budgetFmt(left) + " left over each month."
              : budgetFmt(Math.abs(left)) + " more than you bring in."}
          </p>
        </div>

        ${CATEGORIES.map(c => renderBudgetSliderRow(c, w.profile[c], v => v)).join("")}

        <p class="helper" style="margin:14px 0 0;font-size:11px;">
          Happy with these? Save and you are done. Or answer six quick questions
          about how you live and I will tell you where I would have guessed
          differently.
        </p>
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="lwToQuestions()">Fine-tune</button>
        <button class="button" type="button" onclick="lwSubmitProfile()">Save budget</button>
      </div>
    </div>
  `;
}

// Shared by the wizard review and the Budget tab.
// max comes from budgetSliderMax(), which is derived from the seeded plan and
// the peer figure — never from `amount`, which is what the drag changes. A
// value-derived ceiling moves under the thumb and makes it recoil on release.
/**
 * One category's slider.
 *
 * `bounds` is optional. Without it the track runs 0 to budgetSliderMax, which
 * is what the review screen and the Budget tab want — by then every answer is
 * in and the figure is the tester's to set.
 *
 * WITH it, the track is limited to the band the chosen option implies. On a
 * question screen the description above and the number below have to agree:
 * picking "Not much" for food and then dragging groceries to a thousand leaves
 * the copy describing someone else. Going past the band means the answer above
 * is the wrong one.
 *
 * The period is spelled out on the figure itself. It was only ever in the
 * aria-label — screen-reader only, never rendered — so at the moment a tester
 * looked at "$85" beside "Other", nothing on screen said it was a month.
 */
function renderBudgetSliderRow(category, amount, _fmt, bounds) {
  const min = bounds ? bounds.min : 0;
  const max = bounds ? bounds.max : budgetSliderMax(category);
  const idx = CATEGORIES.indexOf(category);
  const value = Math.max(min, Math.min(max, Number(amount) || 0));
  return `
    <div class="card budget-row">
      <div class="row" style="align-items:baseline;margin-bottom:6px;">
        <span class="budget-row-name">${h(catLabel(category))}</span>
        <span class="budget-row-amt" id="lwAmt${idx}">${budgetFmt(value)} a month</span>
      </div>
      <input class="journal-slider" type="range" min="${min}" max="${max}" step="5"
             value="${value}"
             oninput="lwAdjust('${h(category)}', this.value)"
             aria-label="${h(catLabel(category))} monthly amount">
      ${bounds ? `
        <p class="helper" style="margin:6px 0 0;font-size:10px;">
          ${h(budgetFmt(bounds.min))} to ${bounds.openTop
            ? h(budgetFmt(bounds.max)) + " and up"
            : h(budgetFmt(bounds.max))} — the range for ${h(bounds.optionLabel)}.
        </p>` : ""}
    </div>
  `;
}

function renderLifestyleWizardAdmin() {
  const w = state.lifestyleWizard;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Lifestyle Wizard</p>
      ${!w ? `<p class="helper">Not started.</p>` : `
        <div class="input-group">
          <label>Answers (data keys, not labels)</label>
          <div class="helper" style="line-height:1.7;">
            ${LW_QUESTIONS.map(q => `${h(q.dim)} → <strong>${h(w.answers[q.dim] || "—")}</strong>`).join("<br>")}
          </div>
        </div>
        <p class="helper" style="font-size:10px;">
          paysRent values map to "true"/"false"/"shared"; "mostly walk" is stored
          as <code>none</code>. A missed key contributes 1.0 silently.
        </p>
        ${w.preview ? `
          <div class="input-group">
            <label>Preview total</label>
            <div class="helper">${budgetFmt(catTotal(w.preview))}</div>
          </div>` : ""}
      `}
    </div>
  `;
}
