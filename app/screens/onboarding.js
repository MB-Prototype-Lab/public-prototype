// Onboarding (D06): skipped financial answers keep the selected profile's
// values, or the default profile (D09, L26). Other skipped answers stay unset.
// Never block progress to collect data. Goal selection comes early to give
// the remaining questions a purpose and select the intro film.
// Contained setup sequences belong to standalone Flows.
const ONB_STEPS = ["name", "goal", "zip", "household", "place", "income",
                   "coverage", "miles", "buddy", "video"];

// Adult age ranges supply representative ages for the premium model.
const ONB_ADULT_AGES = [
  { id: "18-25", label: "18–25", age: 23 },
  { id: "26-34", label: "26–34", age: 30 },
  { id: "35-44", label: "35–44", age: 40 },
  { id: "45-54", label: "45–54", age: 50 },
  { id: "55-64", label: "55–64", age: 60 },
  { id: "65+",   label: "65 or older", age: 67 }
];
const ONB_MAX_ADULTS = 4;

// Kids under 13 and teens have different phone and grocery costs.
// Count anyone 18 or older as an adult to avoid inflating household estimates.
const ONB_KID_BUCKETS = [
  { id: "under13", label: "Kids 0–12" },
  { id: "teen",    label: "Kids 13–17" }
];
const ONB_MAX_KIDS_PER_BUCKET = 6;

// Rent and ownership come from the fund's housing fields, which allow both.
// `hoa` selects the HOA model; `home` selects the utilities model.
// Use `short` in prose to keep the utilities step compact; tiles use full labels.
const ONB_PLACE_TYPES = [
  { id: "aptSmall",   label: "Apartment · studio or 1 bedroom", short: "a small apartment", hoa: "none",  home: "apt1" },
  { id: "aptLarge",   label: "Apartment · 2 or more bedrooms",  short: "a 2-bed apartment",           hoa: "none",  home: "apt2" },
  { id: "condo",      label: "Condo or townhome",               short: "a condo or townhome",         hoa: "condo", home: "apt2" },
  { id: "houseSmall", label: "House · 2–3 bedrooms",            short: "a 2–3 bed house",             hoa: "house", home: "house2" },
  { id: "houseLarge", label: "House · 4 or more bedrooms",      short: "a 4-bed house",               hoa: "house", home: "house4" }
];

// ── Health coverage ──────────────────────────────────────────────────────────
// "employer" is the one answer the fund treats differently: it is the only
// coverage that ends with the paycheck, so it is the only one that gets an
// unemployed-insurance estimate.
const ONB_COVERAGE = [
  { id: "employer", label: "Through my job" },
  { id: "self",     label: "I buy it myself" },
  { id: "public",   label: "Medicaid or Medicare" },
  { id: "none",     label: "No coverage" }
];

// ── Miles a day ──────────────────────────────────────────────────────────────
// `miles` is the figure a range stands for. "I don't drive" is an answer, not a
// skip: without it a tester with no car would be charged fuel and upkeep for
// the smallest range.
const ONB_MILES = [
  { id: "none",   label: "I don't drive", miles: 0 },
  { id: "lt5",    label: "Under 5 miles",  miles: 3 },
  { id: "5to15",  label: "5–15 miles",     miles: 10 },
  { id: "15to30", label: "15–30 miles",    miles: 22 },
  { id: "30plus", label: "More than 30 miles", miles: 40 }
];

// Narration text lives in data/onboarding-script.json for the audio build.
// These literals cover a failed data load. The first selected goal chooses the
// film; secondary picks do not multiply script variants. Read at runtime so
// selection reflects the answers rather than a load-time default.
const ONB_VIDEO_DEFAULT_SCRIPT = "onboarding_intro";

const ONB_VIDEO_FALLBACK = [
  "A quick tour before we start. About a minute.",
  "Most days I'll ask a few short questions about what you spent. That's your Money Journal.",
  "Each answer fills in a bit more of the picture — where your money actually goes, and which parts move around.",
  "Once there's enough of it, I'll show you what's steady, what's drifting, and what you might not have clocked.",
  "You'll also see how you compare to peers — households near yours in size, income and area. Those are national figures, a mathematical aggregate, not other people's accounts.",
  "That's the whole thing. Answer a little most days and the picture fills itself in. Let's get you set up."
];

/** The goal they picked first, or null when the step was skipped. */
function onbPrimaryGoal() {
  const o = state.onboarding;
  const areas = (o && o.improveAreas) || [];
  return areas.length ? areas[0] : null;
}

/** Which of the five scripts plays. Falls back to the goal-free default. */
function onbVideoScriptId() {
  const goal = onbPrimaryGoal();
  if (!goal) return ONB_VIDEO_DEFAULT_SCRIPT;
  try {
    const hit = ONBOARDING_SCRIPT.scripts.find(x => x._goal === goal);
    return hit ? hit.id : ONB_VIDEO_DEFAULT_SCRIPT;
  } catch (e) { return ONB_VIDEO_DEFAULT_SCRIPT; }
}

function onbVideoScript() {
  try {
    const id = onbVideoScriptId();
    return ONBOARDING_SCRIPT.scripts.find(x => x.id === id) || null;
  } catch (e) { return null; }
}

function onbVideoSegmentIds() {
  const s = onbVideoScript();
  return s ? s.segments.map(seg => seg.id) : ["s1","s2","s3","s4","s5","s6"];
}

function onbVideoSegments() {
  const s = onbVideoScript();
  return s ? s.segments.map(seg => seg.text) : ONB_VIDEO_FALLBACK.slice();
}

// Detached audio for the segment in flight. Module-level rather than on `state`
// so the admin state inspector never tries to serialise a media element.
let onbAudioEl = null;

// Income-band IDs are local to this UI. The peer model derives its band from
// the annual figure, so multiple UI bands can resolve to one peer band.
// Keep each seed on its slider's step grid to prevent the thumb snapping on
// first touch. The open top uses a finite slider maximum for a usable track.
const ONB_INCOME_BANDS = [
  { id: "b1", label: "Under $35,000",        min: 0,      max: 35000,   step: 1000 },
  { id: "b2", label: "$35,000 – $60,000",    min: 35000,  max: 60000,   step: 1000 },
  { id: "b3", label: "$60,000 – $90,000",    min: 60000,  max: 90000,   step: 2500 },
  { id: "b4", label: "$90,000 – $140,000",   min: 90000,  max: 140000,  step: 2500 },
  { id: "b5", label: "$140,000 – $300,000",  min: 140000, max: 300000,  step: 10000 },
  { id: "b6", label: "$300,000+",            min: 300000, max: 1000000, step: 50000, openTop: true }
];

/**
 * The figure a band opens on: its midpoint, snapped to its own step.
 *
 * An open-topped band has no midpoint worth using — half of "$300,000+" as
 * drawn is $650,000, which is not a neutral guess about anyone. It opens on
 * its floor instead, and the copy says the slider is there to correct it.
 */
function onbIncomeSeed(band) {
  if (!band) return null;
  if (band.openTop) return band.min;
  const mid = (band.min + band.max) / 2;
  return Math.round(mid / band.step) * band.step;
}

// The first four goals have film scripts matched on `_goal`; other goals
// use the generic film. Additional goal-specific films require content.
const ONB_GOALS = [
  "Stop living paycheck to paycheck",
  "Build up some savings",
  "Get on top of what I owe",
  "Just understand where it goes",
  "Spend less on eating out",
  "Cancel what I don't use",
  "Be ready for a surprise bill"
];
const ONB_GOALS_MAX = 3;

// Default a blank buddy name only on leaving the buddy step forward.
// Keep the field empty on arrival so the placeholder remains a suggestion,
// and profileApply can supply a profile's buddy name when setup is skipped.
const ONB_BUDDY_DEFAULT_NAME = "Buddy";

function onbBuddyNameDefault(o) {
  if (!o || !o.buddy) return;
  if (o.buddy.name && String(o.buddy.name).trim()) return;
  o.buddy.name = ONB_BUDDY_DEFAULT_NAME;
  if (state.buddy) state.buddy.name = ONB_BUDDY_DEFAULT_NAME;
}

// All step changes use this seam so transition rules stay consistent.
// Leaving the buddy step forward defaults a blank name; Back preserves it.
function onbSetStep(o, i) {
  if (!o) return;
  const from = o.step;
  o.step = Math.max(0, Math.min(ONB_STEPS.length - 1, Number(i) || 0));
  if (ONB_STEPS[from] === "buddy" && o.step > from) onbBuddyNameDefault(o);
}

function onbStart() {
  state.onboarding = {
    step: 0,
    video: null,           // built by onbVideoInit() on first use
    skipPrompt: false,     // name-step "skip this / skip all" confirmation
    name: "",
    zip: "",
    zipDeclined: false,    // "Maybe share later" — national figures, on request
    householdSize: null,   // derived from adults + kids; kept because the peer model reads it
    adultCount: null,
    adultAges: [],         // one ONB_ADULT_AGES id per adult, in order
    kids: { under13: 0, teen: 0 },
    placeType: null,
    coverage: null,
    miles: null,
    incomeBand: null,
    incomeExact: null,     // slider refinement inside the picked band
    lifestyle: Object.assign({}, PERSONA.lifestyle),   // persona is the fallback
    improveAreas: [],      // multi-select, max 3 (folds into strategicGoal)
    // The buddy step opens on the ILLUSTRATION rather than the persona's golden
    // retriever -- it is the one option with real art behind it, so it is what
    // the step should be showing off. PERSONA.buddy is untouched.
    buddy: Object.assign({}, PERSONA.buddy, {
      bodyType:   BUDDY_PROTOTYPE,
      breed:      BUDDY_PROTOTYPE,
      furColor:   BUDDY_PROTOTYPE,
      furPattern: BUDDY_PROTOTYPE,
      eyeColor:   BUDDY_PROTOTYPE,
      noseColor:  BUDDY_PROTOTYPE,
      size:       BUDDY_PROTOTYPE
    })
  };
  // An untouched buddy name has no persona fallback (D09). Default the
  // appearance pattern so the stage always has a value.
  state.onboarding.buddy.name = "";
  // Required on the buddy step and deliberately without a default.
  state.onboarding.buddy.pronouns = "";
  state.onboarding.buddy.furPattern = state.onboarding.buddy.furPattern || "solid";
  // Mirror the draft onto state.buddy because renderBuddyInner reads it.
  state.buddy = Object.assign({}, state.onboarding.buddy);
  return state.onboarding;
}

// ── Who lives with you — handlers ────────────────────────────────────────────

/** Household size follows from the answers; it is never asked separately. */
function onbSyncHousehold(o) {
  const kids = o.kids || {};
  const n = (o.adultCount || 0) + (kids.under13 || 0) + (kids.teen || 0);
  o.householdSize = n > 0 ? n : null;
}

function onbSetAdults(n) {
  const o = state.onboarding;
  o.adultCount = n;
  // Keep ages already chosen; trim or pad to the new count. A new adult opens
  // unanswered rather than on a guessed age.
  o.adultAges = (o.adultAges || []).slice(0, n);
  while (o.adultAges.length < n) o.adultAges.push(null);
  onbSyncHousehold(o);
  render();
}

function onbSetAdultAge(i, id) {
  const o = state.onboarding;
  if (!o.adultAges) o.adultAges = [];
  o.adultAges[i] = id || null;
  render();
}

function onbStepKids(bucket, delta) {
  const o = state.onboarding;
  const cur = (o.kids && o.kids[bucket]) || 0;
  o.kids[bucket] = Math.max(0, Math.min(ONB_MAX_KIDS_PER_BUCKET, cur + delta));
  onbSyncHousehold(o);
  render();
}

function onbPick(field, id) {
  const o = state.onboarding;
  o[field] = id;
  render();
}

function onbNext() {
  const o = state.onboarding;
  if (ONB_STEPS[o.step] === "video") onbVideoStop();   // silence narration on exit
  if (o.step < ONB_STEPS.length - 1) { onbSetStep(o, o.step + 1); render(); return; }
  onbFinish();
}

function onbBack() {
  const o = state.onboarding;
  if (ONB_STEPS[o.step] === "video") onbVideoStop();
  if (o.step > 0) { onbSetStep(o, o.step - 1); render(); return; }
  // On the first step, Back clears the answer: there is no earlier step.
  onbResetStep();
}

// Clear the current answer without changing steps.
function onbResetStep() {
  const o = state.onboarding;
  const key = ONB_STEPS[o.step];
  if (key === "zip") { o.zip = ""; o.zipDeclined = false; }
  if (key === "name") o.name = "";
  render();}

// Top-right Skip. Writes no value, so the starting profile's figure stands for
// the financial fields (onbFinish). The name step is special — it opens a
// confirmation instead (skip only this screen, or skip the whole setup).
function onbSkip() {
  const o = state.onboarding;
  const key = ONB_STEPS[o.step];
  if (key === "video") onbVideoStop();
  if (key === "name") { o.skipPrompt = true; render(); return; }
  if (o.step < ONB_STEPS.length - 1) { onbSetStep(o, o.step + 1); render(); return; }
  onbFinish();
}

// Skip only the name answer and advance to the goal question.
function onbSkipName() {
  const o = state.onboarding;
  o.skipPrompt = false;
  if (o.step < ONB_STEPS.length - 1) { onbSetStep(o, o.step + 1); }
  render();
}

// "Skip all setup" — hand over to the profile picker (L26), so the tester ends
// up with a profile somebody chose rather than the persona's by accident.
function onbSkipAll() {
  state.onboarding.skipPrompt = false;
  ppStart();
}

function onbSkipCancel() {
  state.onboarding.skipPrompt = false;
  render();
}

// Goal step: toggle one improvement area, capped at ONB_GOALS_MAX. Deselecting
// is always allowed; a new pick past the cap is ignored.
function onbToggleGoal(label) {
  const o = state.onboarding;
  const i = o.improveAreas.indexOf(label);
  if (i !== -1) { o.improveAreas.splice(i, 1); }
  else if (o.improveAreas.length < ONB_GOALS_MAX) { o.improveAreas.push(label); }
  render();
}

// Patch live text dependencies instead of rendering: replacing the focused
// input would lose the caret. `commit` allows an onchange repaint after editing.
function onbLiveInput(field, value, commit) {
  const o = state.onboarding;
  if (!o) return;

  if (field === "buddyName") {
    o.buddy.name = value;
    state.buddy.name = value;       // so the stage above updates on commit
  } else {
    o[field] = value;
  }

  if (commit) { render(); return; }

  uiSetEnabled("onbContinue", onbAnswered(ONB_STEPS[o.step], o));
  if (field === "zip") {
    uiPatchHTML("onbColChart", onbColChart(value));
    // Dismiss the keypad once five digits are entered so Continue is reachable.
    // Use kbdCommit to blur and dispatch change; kbdClose alone leaves focus and
    // does not commit the field.
    if (String(value).replace(/\D/g, "").length >= 5 &&
        typeof kbdCommit === "function" && state.kbd && state.kbd.open) {
      kbdCommit();
    }
  }
}

// The slider refines annual income; the peer model derives its band from it.

function onbIncomeBand(id) {
  return ONB_INCOME_BANDS.find(b => b.id === id) || null;
}

/** The figure in play: their slider position, else the band's seed. */
function onbIncomeValue(o) {
  const band = onbIncomeBand(o.incomeBand);
  if (!band) return null;
  return o.incomeExact != null ? o.incomeExact : onbIncomeSeed(band);
}

function onbSetIncomeBand(id) {
  const o = state.onboarding;
  const band = onbIncomeBand(id);
  o.incomeBand = id;
  // Re-seed on every band change. Carrying the old figure over would leave the
  // slider outside its own track, which the browser silently clamps — so the
  // number shown and the number stored would disagree.
  o.incomeExact = onbIncomeSeed(band);
  render();
}

// Patch the label only during a drag: rendering would replace the input
// that holds pointer capture.
function onbSetIncomeExact(value) {
  const o = state.onboarding;
  const band = onbIncomeBand(o.incomeBand);
  if (!band) return;
  const n = Math.round((Number(value) || 0) / band.step) * band.step;
  o.incomeExact = Math.max(band.min, Math.min(band.max, n));
  uiPatchHTML("onbIncomeLabel", onbIncomeLabelText(o));
  uiSetValue("onbIncomeTyped", onbIncomeTypedText(o.incomeExact));
}

/** Grouped digits, no currency mark — the box is a field, not a readout. */
function onbIncomeTypedText(v) {
  return v == null ? "" : Number(v).toLocaleString("en-US");
}

// Typed income stays exact rather than snapping to the slider grid.
// Move to the matching band instead of silently clamping an out-of-band answer.
function onbSetIncomeTyped(value) {
  const o = state.onboarding;
  const n = Math.max(0, Math.round(Number(String(value).replace(/[^0-9.]/g, "")) || 0));
  if (!n) { render(); return; }
  const band = ONB_INCOME_BANDS.find(b => n >= b.min && n < b.max) ||
               ONB_INCOME_BANDS[ONB_INCOME_BANDS.length - 1];
  o.incomeBand = band.id;
  o.incomeExact = Math.min(n, band.max);
  render();
}

function onbIncomeLabelText(o) {
  const band = onbIncomeBand(o.incomeBand);
  const v = onbIncomeValue(o);
  if (!band || v == null) return "";
  const atTop = band.openTop && v >= band.max;
  // One line: the year figure, then the month in parentheses after it. The
  // month is the derived one, so it reads as a gloss rather than a second fact.
  return `${h(budgetFmt(v))}${atTop ? "+" : ""} a year ` +
         `(about ${h(budgetFmt(v / 12))} a month)`;
}

function onbIncomeSlider(o) {
  const band = onbIncomeBand(o.incomeBand);
  if (!band) return "";
  const v = onbIncomeValue(o);
  return `
    <div class="card onb-income-card">
      <p class="slider-readout" id="onbIncomeLabel">${onbIncomeLabelText(o)}</p>
      <input class="journal-slider" type="range"
             min="${band.min}" max="${band.max}" step="${band.step}"
             value="${v}"
             oninput="onbSetIncomeExact(this.value)"
             aria-label="Annual income">
      <div class="onb-income-typed">
        <label for="onbIncomeTyped">Or type it</label>
        <input id="onbIncomeTyped" inputmode="numeric" value="${onbIncomeTypedText(v)}"
               onchange="onbSetIncomeTyped(this.value)"
               aria-label="Annual income, typed">
      </div>
      <p class="task-desc" style="margin:8px 0 0;">
        <span class="onb-line">Slide the scale if you want to be more accurate.</span>
        <span class="onb-line">Otherwise we'll use the middle of the range.</span>
      </p>
    </div>`;
}

// "A" · "A and B" · "A, B and C" — a readable phrase for strategicGoal.label.
function onbJoinAreas(areas) {
  if (areas.length <= 1) return areas[0] || "";
  if (areas.length === 2) return areas[0] + " and " + areas[1];
  return areas.slice(0, -1).join(", ") + " and " + areas[areas.length - 1];
}

/**
 * Apply everything and land on home with a 1-day streak.
 * The name, ZIP, household size and income override the persona (D09); a
 * skipped answer keeps the starting profile's value.
 */
function onbFinish() {
  const o = state.onboarding;

  // Apply the default profile only when none is selected. Guarded writes keep
  // answered fields; skipped fields retain that explicit starting point (L26).
  const fallback = (typeof profileDefault === "function" && profileDefault()) || null;
  if (fallback && !state.activeProfileId) profileApply(fallback.id);

  state.profile.name = o.name || (fallback ? fallback.name : "Me");
  if (o.zip) state.profile.zip = o.zip;
  // A declined ZIP requests national figures. Clear the profile's ZIP
  // explicitly so its default does not override that choice.
  if (o.zipDeclined) state.profile.zip = "";
  if (o.householdSize) state.profile.householdSize = o.householdSize;

  // Unanswered household details must not overwrite profile values.
  // The fund models fall back to household size when details are absent (D19).
  if (o.adultCount) {
    state.profile.adults = (o.adultAges || []).map(id => {
      const band = ONB_ADULT_AGES.find(a => a.id === id);
      return { ageRange: id, age: band ? band.age : null };
    });
    state.profile.kids = Object.assign({ under13: 0, teen: 0 }, o.kids);
  }
  if (o.placeType) state.profile.placeType = o.placeType;
  if (o.coverage)  state.profile.coverage = o.coverage;
  if (o.miles) {
    const m = ONB_MILES.find(x => x.id === o.miles);
    state.profile.milesRange = o.miles;
    state.profile.milesPerDay = m ? m.miles : null;
  }
  // Use the refined income or band seed for both annual and monthly figures.
  const income = onbIncomeValue(o);
  if (income != null) {
    state.profile.incomeAnnual = income;
    state.monthlyIncome = Math.round(income / 12);
  }

  state.lifestyle = Object.assign({}, o.lifestyle);
  state.buddy = Object.assign({}, o.buddy);
  // Set one buddy-name fallback so all screens agree, preserving the name
  // from profileApply when the draft's name is empty.
  if (!state.buddy.name) {
    state.buddy.name = (fallback && fallback.buddyName) || "Buddy";
  }

  // The multi-select folds into the single strategic goal the app renders as
  // "What you're here for" (goals.js). Keep the raw picks on `areas`.
  const areas = (o.improveAreas || []);
  state.strategicGoal = {
    id: "g_strategic_1",
    label: areas.length ? onbJoinAreas(areas) : "Get on top of my money",
    areas: areas.slice(),
    setDuringOnboarding: true
  };

  // D31 keeps lesson rewards ungated. With no trial question in onboarding,
  // default to the subscriber tier so its diamonds and reward section are reachable.
  if (state.trialAccepted == null) state.trialAccepted = true;

  // Setup leaves the budget empty; saving through the baseline seam completes it.
  state.planStatus = "empty";

  if (typeof ubTrailRecord === "function") {
    ubTrailRecord("zip", state.profile.zip);
    ubTrailRecord("hh", state.profile.householdSize);
    ubTrailRecord("inc", state.profile.incomeAnnual);
    ubTrailRecord("goal", areas.length ? areas[0] : "");
    // The buddy's SPECIES, not the name the tester typed for it.
    ubTrailRecord("buddy", (state.buddy && state.buddy.animal) || "");
    // Only fixed BUDDY_PRONOUNS IDs enter the URL; an unanswered step adds none.
    ubTrailRecord("pro", (state.buddy && state.buddy.pronouns) || "");
    ubTrailCheckpoint("setup");
  }

  state.streak = PERSONA.state.streakDaysIfOnboarded;   // 1 day (D06)
  state.onboarding = null;
  observationsRecompute();

  state.nav.stacks.home = ["home"];
  state.nav.activeStack = "home";
  navCommit("home");
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderOnboarding() {
  const o = state.onboarding || onbStart();
  const key = ONB_STEPS[o.step];
  const total = ONB_STEPS.length;

  // Pin the footer on every step and scroll content between it and the header.
  // Do not select this layout by step index: reordering steps would break it.
  const pinned = " onb-pinned";

  // The video body needs a flex column for .onb-video to size against.
  // Other steps keep block flow.
  const bodyCls = key === "video" ? " onb-body-video" : "";

  return `
    <div class="journal-shell${pinned}">
      <div class="journal-head onb-head">
        <div class="onb-head-progress">
          <p class="helper" style="margin:0 0 4px;">Step ${o.step + 1} of ${total}</p>
          <div class="journal-progress" aria-hidden="true">
            ${ONB_STEPS.map((_, i) => `<span class="journal-pip ${i <= o.step ? "on" : ""}"></span>`).join("")}
          </div>
        </div>
        <button class="onb-skip" type="button" onclick="onbSkip()">Skip</button>
      </div>
      <div class="journal-body${bodyCls}">${onbStepBody(key, o)}</div>
      <div class="journal-foot">
        ${o.step > 0
          ? `<button class="button secondary" type="button" onclick="onbBack()">Back</button>`
          : `<span></span>`}
        <button class="button" type="button" id="onbContinue" onclick="onbNext()"
                     ${onbAnswered(key, o) ? "" : "disabled"}>${h(onbContinueLabel(key, o))}</button>
      </div>
    </div>
    ${o.skipPrompt ? onbSkipPrompt() : ""}
  `;
}

// The footer button's words.
function onbContinueLabel(key, o) {

  return "Continue";
}

// Name-step skip confirmation. Reuses the shared .ls-modal-bg scrim.
function onbSkipPrompt() {
  const onName = ONB_STEPS[(state.onboarding || {}).step] === "name";
  const title = onName ? "No name, no problem" : "Skip this one?";
  const body = onName
    ? "I can just call you Buddy. Want to skip only this, or the whole setup?"
    : "Want to skip only this question, or the whole setup?";
  return `
    <div class="ls-modal-bg" onclick="onbSkipCancel()">
      <div class="card" style="max-width:300px;" onclick="event.stopPropagation()">
        <h1 class="title onb-title" style="margin:0 0 6px;">${h(title)}</h1>
        <p class="task-desc" style="margin:0 0 14px;">
          ${h(body)}
        </p>
        <button class="button full" style="margin-bottom:8px;" type="button"
                onclick="onbSkipName()">Just this screen</button>
        <button class="button secondary full" style="margin-bottom:8px;" type="button"
                onclick="onbSkipAll()">Skip all setup</button>
        <button class="onb-skip full" type="button" onclick="onbSkipCancel()">Keep going</button>
      </div>
    </div>
  `;
}

// Nothing blocks progress — an unanswered step is skippable and the starting
// profile's value stands (onbFinish).
function onbAnswered(key, o) {
  if (key === "name")      return !!o.name;
  if (key === "zip")       return !!o.zip;
  // Every adult needs an age range — the unemployed-insurance estimate is priced
  // per person by age, and a blank one would silently price that adult at zero.
  if (key === "household") return !!o.adultCount &&
                                  (o.adultAges || []).length === o.adultCount &&
                                  o.adultAges.every(Boolean);
  if (key === "place")     return !!o.placeType;
  if (key === "coverage")  return !!o.coverage;
  if (key === "miles")     return !!o.miles;
  if (key === "income")    return !!o.incomeBand;
  if (key === "goal")      return o.improveAreas.length > 0;
  // Same contract as the lesson player: Next unlocks when the piece ends.
  // Skip (top right) still exits at any point, so nothing is blocked (D09).
  if (key === "video")     return !!(o.video && o.video.finished);
  // The buddy step needs pronouns, which deliberately have no default. A blank
  // name is allowed: it MEANS "Buddy" (the placeholder), written on leaving.
  if (key === "buddy")     return !!o.buddy.pronouns;
  return true;
}

// Confirm the ZIP's place only once all five digits are present.
// Keep peer language descriptive (D23, D26).
function onbColChart(zip) {
  const digits = String(zip == null ? "" : zip).replace(/\D/g, "");

  // Wait for the complete ZIP so the county lookup cannot name a partial match.
  if (digits.length < 5) return "";

  const col = benchColIndex(zip);

  // An unsupported ZIP must say that national figures are being used.
  if (!col.supported) {
    return `
    <div class="note" style="margin-top:16px;">
      I don't know that one, so I'll use the national average for now. You'll still see what people like you spend — it just won't be tuned to your area.
    </div>`;
  }

  const where = col.place ? h(col.place) : "your area";

  // Confirm the place directly under the field so the result answers
  // whether the ZIP worked and what happens next.
  return `
    <p class="task-desc onb-zip-result">We'll use people like you in ${where}.</p>`;
}

// Name the national-average consequence of withholding a ZIP.
// Hide the offer once a full ZIP is present.
function onbZipLater(o) {
  const digits = String(o.zip == null ? "" : o.zip).replace(/\D/g, "");
  if (digits.length >= 5) return "";
  return `
    <div class="onb-zip-later">
      <button type="button" class="button onb-zip-later-btn" onclick="onbZipDecline()">Maybe share later</button>
      <p class="onb-zip-later-note">
        <span class="onb-line">Use the national average for now.</span>
        <span class="onb-line">I understand it may not show my area.</span>
      </p>
    </div>`;
}

// Leaves the field empty AND records the choice, because those are two
// different things downstream. onbFinish() applies a default profile to any
// unanswered field — that profile carries a real ZIP, so without this flag
// "use the national average" would quietly price the tester in Nashville.
function onbZipDecline() {
  const o = state.onboarding;
  o.zip = "";
  o.zipDeclined = true;
  onbNext();
}

// Explain what providing a ZIP adds to the peer comparison.
function onbColTeaser(typed) {

  return `
    <div class="note onb-col-teaser-card">
      <p class="task-title" style="margin:0 0 6px;font-size:13px;">How this helps</p>
      <p class="task-desc" style="margin:0 0 8px;">
        <span class="onb-line">Costs are different depending on where you live.</span>
        <span class="onb-line">If you enter your ZIP code, I can show you what people like you spend on rent, food, and everything else.</span>
      </p>
      <p class="task-desc" style="margin:0;font-style:italic;">You decide how to use it</p>
    </div>`;
}

function onbTileStep(o, field, options, title, help) {
  const tiles = `
    <div class="journal-options">
      ${options.map(opt => `
        <button class="journal-opt ${o[field] === opt.id ? "picked" : ""}" type="button"
                aria-pressed="${o[field] === opt.id}"
                onclick="onbPick('${field}','${opt.id}')">
          <span class="journal-opt-label">${h(opt.label)}</span>
        </button>`).join("")}
    </div>`;
  return `
    <h1 class="title onb-title" style="margin:0 0 6px;">${h(title)}</h1>
    <p class="helper" style="margin:0 0 14px;">${h(help)}</p>
    ${tiles}`;
}

// Use age-range selectors and counters so household details need no typing.
function onbHouseholdBody(o) {
  const kids = o.kids || {};
  const adultLabel = n => n === 1 ? "Just me" : n + " adults";

  const agePickers = (o.adultAges || []).map((picked, i) => `
    <label class="onb-age">
      <span>${i === 0 ? "Your age" : "Adult " + (i + 1)}</span>
      <select class="onb-select" onchange="onbSetAdultAge(${i}, this.value)"
              aria-label="${i === 0 ? "Your age" : "Age of adult " + (i + 1)}">
        <option value="" ${picked ? "" : "selected"} disabled>Pick a range</option>
        ${ONB_ADULT_AGES.map(a => `
          <option value="${a.id}" ${picked === a.id ? "selected" : ""}>${h(a.label)}</option>`).join("")}
      </select>
    </label>`).join("");

  const kidRows = ONB_KID_BUCKETS.map(b => {
    const n = kids[b.id] || 0;
    return `
    <div class="onb-count">
      <span class="onb-count-label">${h(b.label)}</span>
      <span class="onb-count-ctl">
        <button type="button" class="onb-count-btn" onclick="onbStepKids('${b.id}', -1)"
                ${n === 0 ? "disabled" : ""} aria-label="Fewer ${h(b.label)}">&minus;</button>
        <span class="onb-count-n" aria-live="polite">${n}</span>
        <button type="button" class="onb-count-btn" onclick="onbStepKids('${b.id}', 1)"
                ${n >= ONB_MAX_KIDS_PER_BUCKET ? "disabled" : ""} aria-label="More ${h(b.label)}">+</button>
      </span>
    </div>`;
  }).join("");

  return `
    <h1 class="title onb-title" style="margin:0 0 6px;">Who lives with you?</h1>
    <p class="helper" style="margin:0 0 12px;">Count yourself as one of the adults.</p>

    <div class="onb-adults" role="group" aria-label="Number of adults">
      ${[1, 2, 3, 4].slice(0, ONB_MAX_ADULTS).map(n => `
        <button class="journal-opt onb-adult-opt ${o.adultCount === n ? "picked" : ""}" type="button"
                aria-pressed="${o.adultCount === n}" onclick="onbSetAdults(${n})">
          <span class="journal-opt-label">${adultLabel(n)}</span>
        </button>`).join("")}
    </div>

    ${agePickers ? `<div class="onb-ages">${agePickers}</div>` : ""}

    <p class="onb-subhead">Any kids at home?</p>
    <div class="onb-kids">${kidRows}</div>`;
}

function onbStepBody(key, o) {
  if (key === "name") return `
    <h1 class="title onb-title" style="margin:0 0 6px;">Hi, I'm Buddy — your money companion.</h1>
    <p class="helper" style="margin:0 0 14px;">
      Nice to meet you! Sorry it's a bit awkward — but what should I call you?
    </p>
    <div class="input-group">
      <input placeholder="Your name" value="${h(o.name)}"
             oninput="onbLiveInput('name', this.value)"
             onchange="onbLiveInput('name', this.value)">
    </div>`;

  // Centred, one sentence per line. Each sentence is its own block rather than
  // a <br>, so a sentence too long for the width wraps under itself instead of
  // breaking the one-per-line rhythm for every line after it.
  if (key === "zip") return `
    <div class="onb-zip-step">
      <h1 class="title onb-title" style="margin:0 0 8px;">What's your ZIP code?</h1>
      <div class="onb-zip-ask">
        <p class="helper" style="margin:0 0 12px;">
          <span class="onb-line">It's how I find people like you and near you.</span>
          <span class="onb-line">Seeing how they spend may help you relate to how you spend.</span>
          <span class="onb-line">That's all I use it for and it's never shared.</span>
        </p>
        <div class="input-group" style="margin:0;">
          <input class="onb-zip-input" inputmode="numeric" maxlength="5"
                 placeholder="ZIP code" value="${h(o.zip)}"
                 oninput="onbLiveInput('zip', this.value)"
                 onchange="onbLiveInput('zip', this.value)">
        </div>
        <div id="onbColChart">${onbColChart(o.zip)}</div>
      </div>
      ${onbColTeaser(0)}
      ${onbZipLater(o)}
    </div>`;

  if (key === "household") return onbHouseholdBody(o);

  if (key === "place") return onbTileStep(o, "placeType", ONB_PLACE_TYPES,
    "What kind of place do you live in?",
    "Home size changes what power and water cost. Condos and townhomes usually have a monthly fee too.");

  if (key === "coverage") return onbTileStep(o, "coverage", ONB_COVERAGE,
    "Where does your health insurance come from?",
    "If it comes through your job, it would stop if your job did. We'll plan for that.");

  if (key === "miles") return onbTileStep(o, "miles", ONB_MILES,
    "How far do you drive on a normal day?",
    "Driving more means more gas or charging, and more wear on the car.");

  if (key === "income") return `
    <div class="onb-income-step">
      <h1 class="title onb-title" style="margin:0 0 8px;">How much do you make each year?</h1>
      <p class="helper" style="margin:0 0 12px;">
        <span class="onb-line">Start with your income range.</span>
        <span class="onb-line">Sharing your income range helps to fine tune finding people like you.</span>
      </p>
      <div class="journal-options">
        ${ONB_INCOME_BANDS.map(b => `
          <button class="journal-opt ${o.incomeBand === b.id ? "picked" : ""}" type="button"
                  onclick="onbSetIncomeBand('${b.id}')">
            <span class="journal-opt-label">${h(b.label)}</span>
          </button>`).join("")}
      </div>
      ${onbIncomeSlider(o)}
    </div>`;

  if (key === "goal") {
    const atMax = o.improveAreas.length >= ONB_GOALS_MAX;
    // Acknowledge the name without repeating the preceding step's greeting.
    return `
    <p class="helper" style="margin:0 0 4px;">
      ${o.name ? `Good to meet you, ${h(o.name)}.` : "Good to meet you."}
    </p>
    <h1 class="title onb-title" style="margin:0 0 6px;">What would you most like to improve?</h1>
    <p class="helper" style="margin:0 0 14px;">Pick up to ${ONB_GOALS_MAX} — we can always change these later.</p>
    <div class="journal-options">
      ${ONB_GOALS.map(g => {
        const on = o.improveAreas.indexOf(g) !== -1;
        const dim = !on && atMax;   // greyed once 3 are chosen
        return `
        <button class="journal-opt opt-check ${on ? "picked" : ""} ${dim ? "opt-check-dim" : ""}" type="button"
                ${dim ? "disabled" : ""}
                onclick="onbToggleGoal('${h(String(g).replace(/\\/g, "\\\\").replace(/'/g, "\\'"))}')">
          <span class="journal-opt-label">${h(g)}</span>
          <span class="opt-check-box" aria-hidden="true">${on ? "✓" : ""}</span>
        </button>`;
      }).join("")}
    </div>`;
  }

  if (key === "buddy") return onbBuddyStep(o);

  if (key === "video") return onbVideoBody(o);

  return "";
}

function onbSetBuddy(key, value) {
  const set = (k, v) => {
    state.onboarding.buddy[k] = v;
    state.buddy[k] = v;          // so the stage above updates live
  };
  set(key, value);
  render();
}

// ─── Meet your buddy ─────────────────────────────────────────────────────────
// The whole buddy step on one screen. The pronoun list lives in
// components/buddy.js and is read at render time: that file loads AFTER this
// one, so its constants must never be touched at top level here.
const ONB_BUDDY_COPY = ["Meet your buddy!",
                        "Buddy is here to help answer questions and join you on your financial journey! " +
                        "Let's give your buddy a name!"];


function onbBuddyStep(o) {
  const b = o.buddy || {};
  return `
    <div class="onb-buddy-step onb-buddy-step-meet">
      <h1 class="title onb-title">${h(ONB_BUDDY_COPY[0])}</h1>
      ${renderBuddyStage({ square: true, cls: "onb-buddy-stage" })}
      <p class="task-desc onb-buddy-sub" style="margin:0 0 14px;">${h(ONB_BUDDY_COPY[1])}</p>
      ${onbBuddyNameFields(b)}
    </div>`;
}

// Keep Buddy as a placeholder until the tester moves forward. Pronouns
// have no default, so Continue waits for an explicit choice.
function onbBuddyNameFields(b) {
  const pronouns = (typeof BUDDY_PRONOUNS !== "undefined") ? BUDDY_PRONOUNS : [];
  return `
    <div class="onb-buddy-fields">
      <div class="input-group">
        <label for="onbBuddyName">Name</label>
        <input id="onbBuddyName" placeholder="${h(ONB_BUDDY_DEFAULT_NAME)}" value="${h(b.name || "")}"
               oninput="onbLiveInput('buddyName', this.value)"
               onchange="onbLiveInput('buddyName', this.value, true)">
      </div>
      <div class="input-group">
        <label for="onbBuddyPronouns">Pronouns</label>
        <span class="onb-buddy-select">
          <select id="onbBuddyPronouns" class="onb-buddy-pronouns ${b.pronouns ? "" : "is-blank"}"
                  onchange="onbSetBuddy('pronouns', this.value)">
            <option value="" ${b.pronouns ? "" : "selected"}>Choose one</option>
            ${pronouns.map(p => `<option value="${h(p.id)}" ${b.pronouns === p.id ? "selected" : ""}>${h(p.label)}</option>`).join("")}
          </select>
        </span>
      </div>
    </div>`;
}

// The intro shares the lesson player's elapsed clock and segment cues.
// Cue estimates use DU_WPM; speech caps the clock while a voice is playing.
// Seek, speed and completion controls follow that same clock.

const ONB_VIDEO_TICK_MS = 100;
const ONB_VIDEO_SPEEDS  = [1, 1.5, 2];

function onbVideoSegMs(seg) {
  const words = String(seg || "").trim().split(/\s+/).length;
  // Same narration pace as the daily update (DU_WPM, architecture §10) so
  // retuning it moves both surfaces. Floor 1.6s so a two-word line still reads.
  const wpm = (typeof DU_WPM !== "undefined" && DU_WPM) || 165;
  return Math.max(1600, Math.round((words / wpm) * 60000));
}

function onbVideoInit() {
  const cues = [];
  let t = 0;
  onbVideoSegments().forEach(seg => { cues.push(t); t += onbVideoSegMs(seg) / 1000; });
  return {
    index: 0, playing: false, finished: false,
    elapsed: 0, total: Math.max(1, t), cues: cues,
    speed: 1, lastTick: 0, timer: null, gen: 0,
    // True once a voice — generated .wav or live speech — is driving the
    // clock. While it is, the tick is capped inside the current segment and
    // only the voice's own end event advances the caption. See onbVideoSpeak.
    speechDriven: false
  };
}

/** The video state, built on first use and after a restart. */
function onbVideo() {
  const o = state.onboarding;
  if (!o.video || !o.video.cues) o.video = onbVideoInit();
  return o.video;
}

function onbVideoIndexFor(elapsed, cues) {
  let idx = 0;
  for (let i = 0; i < cues.length; i++) {
    if (elapsed >= cues[i]) idx = i; else break;
  }
  return idx;
}

// Derive beat boundaries from the player's cue map so editing narration
// keeps the storyboard synchronized without separate timing edits.

/** The storyboard for this run, as a hyperframes spine with real fractions. */
function onbStoryboard(v) {
  if (typeof ONBOARDING_STORYBOARD === "undefined") return null;
  const sb = ONBOARDING_STORYBOARD;
  const goal = onbPrimaryGoal();
  const mid = (sb.goals && (sb.goals[goal] || sb.goals._default)) || {};
  const ids = onbVideoSegmentIds();
  const total = Math.max(0.001, v.total);

  const spine = ids.map((id, i) => {
    const elements = sb.shared[id] || mid[id] || [];
    const from = (v.cues[i] || 0) / total;
    const to = i + 1 < ids.length ? (v.cues[i + 1] || total) / total : 1;
    return {
      id: id,
      from: Math.max(0, Math.min(1, from)),
      to: Math.max(0, Math.min(1, to)),
      // The last beat holds rather than fading, so the film settles on
      // something instead of emptying out.
      hold: i === ids.length - 1,
      elements: elements
    };
  }).filter(b => b.elements.length);

  return { kind: sb.kind, requiresFigures: false, spine: spine };
}

// The committed film is silent: narration and captions share a separate
// clock, and onbFilmSync drives the picture from it. Playback falls back from
// MP4 to hyperframes SVG to the buddy card, keeping the stage filled (D19).
const ONB_FILM_DIR = "assets/video/onboarding";

// Keep failure state outside state, across repaints; reset it on boot
// so a missing film does not disable playback in a fresh session.
let onbFilmBroken = false;
function onbFilmResetArt() { onbFilmBroken = false; }

/** The theme whose render we would play. */
function onbFilmTheme() {
  return (typeof themeCurrent === "function" && themeCurrent().id) || "naturalLight";
}

// Use the generated film index to choose an existing script and look
// before loading media, avoiding a blank stage while waiting for an error (D19).
function onbFilmEntry() {
  if (onbFilmBroken) return null;
  if (typeof ONBOARDING_FILMS === "undefined") return null;
  const script = onbVideoScriptId();

  // Their own look first — a theme that HAS a render always gets it.
  const own = ONBOARDING_FILMS[onbFilmTheme()];
  if (onbFilmEntryHas(own, script)) return own;

  return onbFilmAnyLook(script);
}

/** Does this index entry actually carry a render of `script`? */
function onbFilmEntryHas(entry, script) {
  if (!entry || !entry.look || !entry.scripts) return false;
  return entry.scripts.indexOf(script) !== -1;
}

// Prefer the theme's own render; otherwise borrow any available look.
// The film keeps its broadcast palette even inside a different theme's frame.

// Sort available looks so the fallback film choice is deterministic.
function onbFilmAnyLook(script) {
  const themes = Object.keys(ONBOARDING_FILMS).sort();
  for (let i = 0; i < themes.length; i++) {
    const e = ONBOARDING_FILMS[themes[i]];
    if (onbFilmEntryHas(e, script)) return e;
  }
  return null;
}

function onbFilmAvailable() { return !!onbFilmEntry(); }

/** Which render this tester should see: their look, their primary goal. */
function onbFilmSrc() {
  const entry = onbFilmEntry();
  if (!entry) return "";
  return ONB_FILM_DIR + "/" + entry.look + "/" + onbVideoScriptId() + ".mp4";
}

// Match letterbox space to the playing film's ground, keyed by look rather
// than theme because a theme can borrow another look. Apply only to films:
// the SVG draws in --on-dark and needs the stage's accent ground for contrast.
function onbFilmGroundStyle() {
  const entry = onbFilmEntry();
  if (!entry || typeof ONBOARDING_FILM_GROUNDS === "undefined") return "";
  const ground = ONBOARDING_FILM_GROUNDS[entry.look];
  return ground ? ` style="background:${h(ground)}"` : "";
}

/** The <video> could not load — drop to tier 2 and repaint. */
function onbFilmFailed(el) {
  if (onbFilmBroken) return;
  onbFilmBroken = true;
  render();
}

function onbVideoStage(v) {
  const storyboard = onbStoryboard(v);
  const plan = { lessonId: "onboarding", storyboard: storyboard, bucket: null };

  if (onbFilmAvailable()) {
    // `data-look` keys the element to the render it is showing, so switching
    // between two themes that SHARE a look does not reload the video, while
    // crossing from light to dark does. Muted + playsinline because the picture
    // carries no audio and an unmuted autoplay element is refused by some
    // browsers.
    return `
    <div class="lp-stage lp-stage-video onb-video-stage"${onbFilmGroundStyle()}>
      <video class="onb-film" id="onb-film" muted playsinline preload="auto"
             data-look="${h((onbFilmEntry() || {}).look || "")}"
             src="${h(onbFilmSrc())}" onerror="onbFilmFailed(this)"></video>
    </div>`;
  }

  if (!storyboard || typeof hyperframesCanRender !== "function" ||
      !hyperframesCanRender(plan)) {
    // Nothing to draw — fall back to the buddy card rather than a blank stage
    // (D19: no screen renders empty).
    return renderBuddyStage({ square: true });
  }
  return `
    <div class="lp-stage lp-stage-video onb-video-stage">
      <div class="lp-hyperframes" id="onb-video-frames">
        ${hyperframesMarkup(storyboard, plan, v.total, {})}
      </div>
    </div>`;
}

// Pause the picture while speech holds the elapsed clock at its segment
// cap. Letting CSS animations continue would trigger repeated drift rewinds.
function onbVideoHeld(v) {
  return !!(v && v.speechDriven && v.elapsed >= onbSpeechCap(v) - 0.001);
}


// Hold the film while speech finishes, glide small drift and snap seeks.
// Share the hyperframes constants so both pictures follow the same contract.
function onbFilmSync() {
  const el = document.getElementById("onb-film");
  if (!el) return false;
  const v = onbVideo();
  const playing = v.playing && !onbVideoHeld(v);
  const rate = v.speed || 1;
  try {
    const ms = Math.max(0, v.elapsed * 1000);
    const drift = ms - (Number(el.currentTime) || 0) * 1000;
    if (!playing || Math.abs(drift) > HF_SNAP_MS) {
      if (Math.abs(drift) > 120) el.currentTime = ms / 1000;
      if (el.playbackRate !== rate) el.playbackRate = rate;
    } else if (Math.abs(drift) > 120) {
      const want = rate * (1 + Math.max(-HF_GLIDE_MAX,
                             Math.min(HF_GLIDE_MAX, drift / HF_GLIDE_MS)));
      if (Math.abs(el.playbackRate - want) > 0.01) el.playbackRate = want;
    } else if (el.playbackRate !== rate) {
      el.playbackRate = rate;
    }
    // Do not play an ended film: play() would restart it from zero.
    // Hold its last frame; a real seek clears ended and allows playback.
    if (playing && el.paused && !el.ended) { const p = el.play(); if (p && p.catch) p.catch(function () {}); }
    if (!playing && !el.paused) el.pause();
  } catch (e) { /* a detached element mid-repaint — the next tick catches up */ }
  return true;
}

function onbVideoSyncFrames() {
  // The rendered film owns the picture when it is mounted; the SVG engine is
  // only reached when that file is missing or refused to play.
  if (onbFilmSync()) return;
  if (typeof hyperframesSync !== "function") return;
  const root = document.getElementById("onb-video-frames");
  if (!root) return;
  const v = onbVideo();
  // Pause hyperframes while the speech cap holds, preserving the last frame.
  hyperframesSync(root, {
    elapsedSec: v.elapsed,
    playing: v.playing && !onbVideoHeld(v),
    rate: v.speed || 1
  });
}

function onbVideoBody(o) {
  const v = onbVideo();
  const segs = onbVideoSegments();
  const seg = segs[v.index] || segs[segs.length - 1];
  const pct = (v.total > 0 ? (v.elapsed / v.total) * 100 : 0).toFixed(2);
  const playLabel = v.finished ? "↻" : (v.playing ? "⏸" : "▶");

  return `
    <p class="helper" style="margin:0 0 4px;">How Money Buddy works</p>
    <h1 class="title onb-title" style="margin:0 0 12px;">A quick hello before we start</h1>
    <div class="onb-video">
      ${onbVideoStage(v)}
      <p class="onb-video-caption" id="onb-video-caption">${h(seg)}</p>

      <!-- Same control set as the lesson player, and the same ids-based
           repainting: nothing here calls render(), because a repaint mid-drag
           replaces the element the pointer is captured on. -->
      <div class="lp-ctrl-row onb-video-controls-foot">
        <button class="button secondary lp-ctrl-btn" type="button"
                onclick="onbVideoSeekBy(-ONB_VIDEO_SEEK_SEC)" aria-label="Back ten seconds"
                title="Back 10 seconds">↺ ${ONB_VIDEO_SEEK_SEC}</button>
        <button class="button lp-ctrl-btn" id="onb-video-playbtn" type="button"
                onclick="onbVideoPlayAction()">${playLabel}</button>
        <button class="button secondary lp-ctrl-btn" type="button"
                onclick="onbVideoSeekBy(ONB_VIDEO_SEEK_SEC)" aria-label="Forward ten seconds"
                title="Forward 10 seconds">↻ ${ONB_VIDEO_SEEK_SEC}</button>
        <button class="button secondary lp-speed-btn" id="onb-video-speed" type="button"
                onclick="onbVideoCycleSpeed()">${v.speed}×</button>
      </div>
      <div class="lp-progress-row">
        <span id="onb-video-time" class="lp-time-label">${lpFmtTime(Math.round(v.elapsed))}</span>
        <div class="lp-progress" id="onb-video-progress" role="slider" tabindex="0"
             aria-label="Intro position" aria-valuemin="0" aria-valuemax="100"
             aria-valuenow="${Math.round(Number(pct))}"
             onpointerdown="onbVideoScrubStart(event)" onkeydown="onbVideoScrubKey(event)">
          <div class="lp-progress-fill" id="onb-video-bar" style="width:${pct}%;"></div>
          <div class="lp-progress-knob" id="onb-video-knob" style="left:${pct}%;"></div>
        </div>
        <span class="lp-time-label">${lpFmtTime(Math.round(v.total))}</span>
      </div>
    </div>`;
}

// ── Direct repaints. None of these render() — see the note above. ─────────────

function onbVideoPaintCaption() {
  const v = onbVideo();
  const el = document.getElementById("onb-video-caption");
  if (el) el.textContent = onbVideoSegments()[v.index] || "";
}

function onbVideoPaintProgress() {
  const v = onbVideo();
  const pct = Math.max(0, Math.min(100, v.total > 0 ? (v.elapsed / v.total) * 100 : 0));
  const bar = document.getElementById("onb-video-bar");
  if (bar) bar.style.width = pct.toFixed(2) + "%";
  const knob = document.getElementById("onb-video-knob");
  if (knob) knob.style.left = pct.toFixed(2) + "%";
  const track = document.getElementById("onb-video-progress");
  if (track) track.setAttribute("aria-valuenow", String(Math.round(pct)));
  const time = document.getElementById("onb-video-time");
  if (time) time.textContent = lpFmtTime(Math.round(v.elapsed));
}

function onbVideoPaintPlayBtn() {
  const v = onbVideo();
  const btn = document.getElementById("onb-video-playbtn");
  if (btn) btn.textContent = v.finished ? "↻" : (v.playing ? "⏸" : "▶");
  // Continue is this step's Next and unlocks on completion, same as the lesson.
  uiSetEnabled("onbContinue", onbAnswered("video", state.onboarding));
}

// ── Clock ────────────────────────────────────────────────────────────────────

function onbVideoTick() {
  const v = onbVideo();
  const now = Date.now();
  v.elapsed += ((now - v.lastTick) / 1000) * v.speed;
  v.lastTick = now;
  // A voice is driving (see onbVideoSpeak). The bar still moves, but it stops
  // at the end of the segment being spoken and waits for `onEnd`/`onended` to
  // release it — otherwise the estimate runs the film past the narrator.
  if (v.speechDriven) v.elapsed = Math.min(v.elapsed, onbSpeechCap(v));

  if (v.elapsed >= v.total && !v.speechDriven) { onbVideoFinish(); return; }

  const idx = onbVideoIndexFor(v.elapsed, v.cues);
  if (idx !== v.index && !v.speechDriven) {
    v.index = idx;
    onbVideoPaintCaption();
    onbVideoSpeak();          // the new segment's voice rides along beside the clock
  }
  onbVideoPaintProgress();
  onbVideoSyncFrames();   // drift check only — the animation runs itself
}

function onbVideoClearTimer() {
  const o = state.onboarding;
  if (o && o.video && o.video.timer) { clearInterval(o.video.timer); o.video.timer = null; }
}

// Cancel any narration and the ticker — on pause or on leaving the step.
function onbVideoStop() {
  const o = state.onboarding;
  // Cancel shared narration only if this surface is playing. render() also
  // calls this after starting lesson speech, which must remain audible.
  const wasNarrating = !!(o && o.video && o.video.playing);
  if (o && o.video) {
    o.video.playing = false;
    o.video.speechDriven = false;   // no voice: use the estimated clock
    // A queued media callback can arrive after a synchronous restart. Bump the
    // generation as well as detaching handlers to invalidate stale work.
    o.video.gen = (o.video.gen || 0) + 1;
  }
  onbVideoClearTimer();
  onbVideoReleaseAudio();
  if (wasNarrating) narrationCancel();   // only silence what we started
}

/** Where gen-audio.sh writes this segment's narration. */
function onbVideoAudioSrc(index) {
  const segId = onbVideoSegmentIds()[index] || ("s" + (index + 1));
  return "assets/audio/onboarding/" + onbVideoScriptId() + "/" + segId + ".wav";
}

// L10 narration order: generated WAV, runtime browser speech, silent word
// clock. A playing voice advances segments on its end event and caps the
// clock meanwhile; without a voice, elapsed-time estimates advance captions.
function onbVideoSpeak() {
  const o = state.onboarding;
  if (!o || !o.video || !o.video.playing) return;
  const seg = onbVideoSegments()[o.video.index];
  if (!seg) return;

  // Live speech owns segment advancement: pin onStart and advance onEnd.
  // Cap the progress clock inside that segment so estimates cannot outrun speech.
  // This matches the lesson player's lpSpeakCurrent contract.
  const idx = o.video.index;
  const speakFallback = function () {
    const started = narrationSpeak(seg, {
      rate: o.video.speed || 1,
      onStart: function () {
        const v = onbVideo();
        if (!v || v.index !== idx) return;      // superseded by a seek
        v.speechDriven = true;
        // Move elapsed time forwards only. The tick may already be near the next
        // cue; snapping back to this cue would rewind the picture at each boundary.
        v.elapsed = Math.max(v.elapsed, v.cues[idx] || 0);
        v.lastTick = Date.now();
        onbVideoPaintProgress();
        onbVideoSyncFrames();
      },
      onEnd: function () {
        const v = onbVideo();
        if (!v || !v.playing || v.index !== idx) return;
        if (idx >= onbVideoSegments().length - 1) { onbVideoFinish(); return; }
        v.index = idx + 1;
        v.elapsed = v.cues[v.index] || v.elapsed;
        v.lastTick = Date.now();
        onbVideoPaintCaption();
        onbVideoPaintProgress();
        onbVideoSyncFrames();
        onbVideoSpeak();
      },
      onError: function () {
        const v = onbVideo();
        if (v) v.speechDriven = false;          // hand the clock back to the estimate
      }
    });
    if (!started) { const v = onbVideo(); if (v) v.speechDriven = false; }
  };

  onbVideoReleaseAudio();
  narrationCancel();
  if (typeof Audio === "undefined") { speakFallback(); return; }

  try {
    const a = new Audio(onbVideoAudioSrc(o.video.index));
    onbAudioEl = a;
    a.playbackRate = o.video.speed || 1;
    a.onerror = speakFallback;                 // missing or unavailable WAV: use runtime speech
    // Recorded audio also owns advancement: its real duration can differ from the
    // word-count estimate, so cap the clock until the clip ends.
    a.onplay = function () {
      const v = onbVideo();
      if (!v || v.index !== idx) return;
      v.speechDriven = true;
      // Move forwards only, as in the live-speech path, to avoid picture rewinds.
      v.elapsed = Math.max(v.elapsed, v.cues[idx] || 0);
      v.lastTick = Date.now();
      onbVideoPaintProgress();
      onbVideoSyncFrames();
    };
    a.onended = function () {
      const v = onbVideo();
      if (!v || !v.playing || v.index !== idx) return;
      if (idx >= onbVideoSegments().length - 1) { onbVideoFinish(); return; }
      v.index = idx + 1;
      v.elapsed = v.cues[v.index] || v.elapsed;
      v.lastTick = Date.now();
      onbVideoPaintCaption();
      onbVideoPaintProgress();
      onbVideoSyncFrames();
      onbVideoSpeak();
    };
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(speakFallback);  // autoplay blocked
  } catch (e) { speakFallback(); }
}

/**
 * Ceiling for the virtual clock while a voice drives it: just inside the
 * current segment, so the bar keeps moving but the caption cannot run ahead of
 * what is being said. Mirrors lpSpeechCap.
 */
function onbSpeechCap(v) {
  const next = v.cues[v.index + 1];
  if (next == null) return v.total;
  return Math.max(v.cues[v.index] || 0, next - 0.05);
}

/** Stop and detach the segment audio, so a stale element cannot fire onended. */
function onbVideoReleaseAudio() {
  if (!onbAudioEl) return;
  try {
    onbAudioEl.onended = null;
    onbAudioEl.onerror = null;
    onbAudioEl.pause();
  } catch (e) {}
  onbAudioEl = null;
}

function onbVideoFinish() {
  const v = onbVideo();
  onbVideoStop();
  v.elapsed  = v.total;
  v.index    = onbVideoSegments().length - 1;
  v.finished = true;
  onbVideoPaintCaption();
  onbVideoPaintProgress();
  onbVideoPaintPlayBtn();
  onbVideoSyncFrames();
}

// ── Controls ─────────────────────────────────────────────────────────────────

function onbVideoPlay() {
  const v = onbVideo();
  if (v.playing || v.finished) return;
  v.playing  = true;
  v.lastTick = Date.now();
  v.timer    = setInterval(onbVideoTick, ONB_VIDEO_TICK_MS);
  onbVideoPaintPlayBtn();
  onbVideoSyncFrames();
  onbVideoSpeak();
}

function onbVideoPause() {
  onbVideoStop();
  onbVideoPaintPlayBtn();
  onbVideoSyncFrames();
}

function onbVideoPlayAction() {
  const v = onbVideo();
  if (v.finished) onbVideoRestart(); else if (v.playing) onbVideoPause(); else onbVideoPlay();
}

function onbVideoRestart() {
  const o = state.onboarding;
  onbVideoStop();
  const gen = (o.video && o.video.gen) || 0;
  o.video = onbVideoInit();
  o.video.gen = gen;                 // carry it forward, or a stale callback matches again
  onbVideoPaintCaption();
  onbVideoPaintProgress();
  onbVideoPlay();
}

// Seek by seconds, matching the lesson player's controls.
const ONB_VIDEO_SEEK_SEC = 10;

function onbVideoSeekBy(seconds) {
  const v = onbVideo();
  onbVideoApplyElapsed(v.elapsed + seconds);
}

function onbVideoCycleSpeed() {
  const v = onbVideo();
  v.speed = ONB_VIDEO_SPEEDS[(ONB_VIDEO_SPEEDS.indexOf(v.speed) + 1) % ONB_VIDEO_SPEEDS.length];
  const btn = document.getElementById("onb-video-speed");
  if (btn) btn.textContent = v.speed + "×";
  if (onbAudioEl) { try { onbAudioEl.playbackRate = v.speed; } catch (e) {} }
  onbVideoSyncFrames();
  // The ticker reads v.speed live each tick — nothing more to do.
}

/** Seek to an absolute time and repaint everything that follows the clock. */
function onbVideoApplyElapsed(sec) {
  const v = onbVideo();
  v.elapsed = Math.max(0, Math.min(v.total, sec));
  if (v.finished && v.elapsed < v.total) v.finished = false;
  const idx = onbVideoIndexFor(v.elapsed, v.cues);
  const changed = idx !== v.index;
  v.index = idx;
  // The voice has to follow the handle. Without the release it would finish the
  // segment it was already on and advance from THERE, narrating a passage the
  // viewer has scrubbed past.
  if (changed) {
    v.speechDriven = false;
    onbVideoPaintCaption();
    onbVideoSpeak();
  }
  onbVideoPaintProgress();
  onbVideoPaintPlayBtn();
  onbVideoSyncFrames();
  if (v.playing) v.lastTick = Date.now();
}

// Measure drag geometry once at pointerdown. Reading after each width
// write would force synchronous layout on every pointermove.
let onbScrubRect = null;
let onbScrubWasPlaying = false;

function onbVideoScrubStart(e) {
  const track = document.getElementById("onb-video-progress");
  const v = onbVideo();
  if (!track) return;
  onbScrubWasPlaying = v.playing;
  if (v.playing) onbVideoPause();
  track.classList.add("scrubbing");   // drop the smoothing so the bar tracks the finger
  onbScrubRect = track.getBoundingClientRect();
  try { track.setPointerCapture(e.pointerId); } catch (err) {}
  track.onpointermove   = onbVideoScrubTo;
  track.onpointerup     = onbVideoScrubEnd;
  track.onpointercancel = onbVideoScrubEnd;
  onbVideoScrubTo(e);
}

function onbVideoScrubTo(e) {
  const v = onbVideo();
  if (!v.total) return;
  let r = onbScrubRect;
  if (!r) {
    const track = document.getElementById("onb-video-progress");
    if (!track) return;
    r = onbScrubRect = track.getBoundingClientRect();
  }
  if (!r.width) return;
  onbVideoApplyElapsed(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.total);
}

function onbVideoScrubEnd(e) {
  const track = document.getElementById("onb-video-progress");
  const v = onbVideo();
  if (track) {
    try { track.releasePointerCapture(e.pointerId); } catch (err) {}
    track.classList.remove("scrubbing");
    track.onpointermove = null; track.onpointerup = null; track.onpointercancel = null;
  }
  onbScrubRect = null;
  if (onbScrubWasPlaying && !v.finished) onbVideoPlay();
  onbScrubWasPlaying = false;
}

/** Arrow keys nudge the scrubber, so the control is reachable without a pointer. */
function onbVideoScrubKey(e) {
  const step = 5;
  if (e.key === "ArrowRight" || e.key === "ArrowUp")   { e.preventDefault(); onbVideoApplyElapsed(onbVideo().elapsed + step); }
  if (e.key === "ArrowLeft"  || e.key === "ArrowDown") { e.preventDefault(); onbVideoApplyElapsed(onbVideo().elapsed - step); }
}

// Restart clears profile and household answers so skipped fields cannot
// reuse a previous tester's data. Reset the trial answer too so finishing
// setup grants the same subscriber tier as a fresh run.
function onbRestart() {
  state.activeProfileId = null;
  state.profilePick = null;
  state.profile = deepClone(PERSONA.identity);
  state.trialAccepted = null;
  onbStart();
  go("onboarding");
}

function renderOnboardingAdmin() {
  const o = state.onboarding;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Onboarding</p>
      <!-- The profile is here as well as on the picker's own card: this is the
           card you are looking at while wondering why a figure looks wrong, and
           "which profile am I" is the first thing that answers it. -->
      ${renderProfileAdminSwitcher()}
      ${!o ? `<p class="helper">Not running.</p>` : `
        <div class="input-group">
          <label>Step ${o.step + 1}/${ONB_STEPS.length} — ${h(ONB_STEPS[o.step])}</label>
          <select onchange="onbSetStep(state.onboarding,parseInt(this.value,10));render()">
            ${ONB_STEPS.map((s, i) => `<option value="${i}" ${o.step === i ? "selected" : ""}>${i + 1}. ${h(s)}</option>`).join("")}
          </select>
        </div>
        <div class="input-group">
          <label>Written at the end — name, ZIP, household and income override the persona (D09)</label>
          <div class="helper" style="line-height:1.7;">
            name → ${h(o.name || "—")}<br>
            zip → ${h(o.zipDeclined ? "declined (national figures)" : (o.zip || "—"))}<br>
            household → ${h(o.householdSize || "—")}<br>
            income band → ${h(o.incomeBand || "—")}
            ${onbIncomeValue(o) != null
              ? ` · ${h(budgetFmt(onbIncomeValue(o)))}/yr
                  · ${h(budgetFmt(onbIncomeValue(o) / 12))}/mo`
              : ""}<br>
            place → ${h(o.placeType || "—")} · coverage → ${h(o.coverage || "—")} · miles → ${h(o.miles || "—")}<br>
            goal areas → ${h((o.improveAreas || []).join(", ") || "—")}
          </div>
        </div>
        <p class="helper" style="font-size:10px;">
          A skipped name, ZIP, household or income keeps the starting
          profile's value: the default profile unless one is applied above
          (L26). A skipped place, coverage or miles stays unset, and the
          emergency fund estimates from household size. Lifestyle stays as the
          persona seeded it. Skipping never blocks.
        </p>
      `}
      <button class="button secondary full" type="button" onclick="onbRestart()">Restart onboarding</button>
    </div>
  `;
}
