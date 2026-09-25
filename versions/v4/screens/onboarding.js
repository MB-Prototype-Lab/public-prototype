// ─── Onboarding (01-onboarding, D06) ─────────────────────────────────────────
// TAB: None | NAV BAR: Hidden — full-bleed flow
//
// Seven steps. A single config constant bypasses the whole thing (D07) — see
// js/config.js. Flipping it must not require unwinding anything here.
//
//   1 name   2 improvement areas (multi-select)
//   3 ZIP   4 household   5 income band
//   6 buddy creation (five sub-steps)   7 intro video (how it works)
//
// PERSONA OVERRIDE (D09): steps 3, 4 and 5 override the hardcoded persona.
// Everything else falls back to persona.json. If a tester skips a field, the
// persona value stands — NEVER block progress to collect data.
//
// ── v3.1: WHY THE GOAL QUESTION IS SECOND ────────────────────────────────────
// It used to be sixth, which asked for a ZIP, a household size and an income
// band before the tester had any stake in the app. Asking what they want to
// improve first gives them a reason to answer the other three. It also means
// onbPrimaryGoal() — which picks one of five intro-film scripts — is settled
// five steps before the film plays, rather than one.
//
// ── v3.1: HOW TWO STEPS WERE REMOVED ─────────────────────────────────────────
// By taking their keys OUT OF THIS ARRAY, and nothing else. The housing/commute
// pair ("lifestyle") and the trial pitch ("trial") still have their renderers,
// their handlers and their copy exactly where they were, a few hundred lines
// down — unreachable, because no step is keyed to them.
//
// That is deliberate, and it is not laziness: this is a prototype under
// iteration, deleting them would orphan a dozen helpers into DEAD_BASELINE
// (onbCommuteDetail, onbSetLifestyle, onbTransportMonthly, ONB_CAR_CLASSES and
// the rest), and putting a step back is a one-word edit this way. Do not
// "clean up" the branches below on the grounds that nothing reaches them.
const ONB_STEPS = ["name", "goal", "zip", "household", "income", "buddy", "video"];

// Onboarding asks only the install-relevant lifestyle dimensions. The full six
// live in the standalone lifestyle wizard (LW_QUESTIONS); the dims not asked
// here keep their persona defaults (D09). Same dims and keys either way, so an
// answer means the same thing in both places.
const ONB_LIFESTYLE_DIMS = ["paysRent", "commute"];

// Intro "video" narration — one caption per segment. Narration text is data
// (data/onboarding-script.json) so the build-time TTS pipeline can read it; see
// scripts/gen-audio.sh. The literals below are the fallback for a failed load.
//
// The film branches on the tester's PRIMARY goal — the first thing they picked
// at step 6. Segments s1, s2, s5 and s6 are identical across all five scripts;
// only s3 and s4 change. Four goals with up to three picks is sixteen
// combinations, which is not authorable, so secondary picks change nothing.
//
// These are functions, not constants, because the goal is not known until step
// 6 and the film is step 8. A const evaluated at load time would always be the
// default.
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
function onbLifestyleQuestions() {
  return LW_QUESTIONS.filter(q => ONB_LIFESTYLE_DIMS.indexOf(q.dim) !== -1);
}

// Five bands, presented as ranges (01-onboarding). `annual` is the seed the
// slider opens on, and it is a representative figure inside the band so
// benchIncomeBand() maps it back to the same band without a second code path.
//
// min/max mirror PEER_BENCHMARKS.incomeBands, which is the peer model's actual
// lookup key and is a verbatim spec copy we never edit. The bands themselves
// therefore cannot change — the slider refines the FIGURE inside a band, it
// does not add bands.
//
// b5's data max is 999999999. A slider cannot express that without making the
// usable part of the track a couple of pixels wide, so it stops at 400k and the
// top of the track reads as open.
const ONB_INCOME_BANDS = [
  { id: "b1", label: "Under $35,000",      annual: 25000,  min: 0,      max: 35000 },
  { id: "b2", label: "$35,000 – $60,000",  annual: 47500,  min: 35000,  max: 60000 },
  { id: "b3", label: "$60,000 – $90,000",  annual: 75000,  min: 60000,  max: 90000 },
  { id: "b4", label: "$90,000 – $140,000", annual: 115000, min: 90000,  max: 140000 },
  { id: "b5", label: "Over $140,000",      annual: 175000, min: 140000, max: 400000, openTop: true }
];
// 500, not 1000: b2 seeds at 47,500. On a 1,000 grid that figure is not a valid
// stop, so the browser would snap the thumb the moment you touched it and the
// number shown before the drag would not be reachable after it. Every band's
// min and seed divides by 500.
const ONB_INCOME_STEP = 500;

// "If you could improve one thing about your money…" — multi-select, max 3,
// presets only. Folds into the single state.strategicGoal the app expects.
// The first four are the ones data/onboarding-script.json writes a film variant
// for (matched on `_goal`). Everything after them falls through to the default
// script -- which is the designed fallback, not a bug, but it does mean a tester
// picking one of the newer goals gets the generic film. Adding a variant is a
// content job; adding a goal is this list.
const ONB_GOALS = [
  "Stop living paycheck to paycheck",
  "Build up some savings",
  "Get on top of what I owe",
  "Just understand where it goes",
  "Spend less on eating out",
  "Cancel what I don't use",
  "Be ready for a surprise bill",
  "Save for something big",
  "Stop worrying about money",
  "Put money aside for a trip"
];
const ONB_GOALS_MAX = 3;

// Character creator sub-steps (Mii/Nintendogs style — one element per screen,
// each with a control suited to it). Buddy option lists + colour maps live in
// components/buddy.js and are read at render time (that file loads AFTER this
// one, so they must never be touched at top level here).
// Step 1 is BODY TYPE, not breed. It used to be a vertical list of nine breed
// NAMES -- a list of words for choosing a shape. The grid shows the shapes and
// the search turns a breed into them, which is the direction a tester actually
// thinks in: they know their dog is a husky-corgi, not which silhouette that is.
// `breed` still exists on the buddy and in the admin dropdowns; it is simply no
// longer what this step asks for.
//
// THEN THE CREATOR WENT AWAY. The owner cut the five sub-steps to two (meet the
// buddy; name it and pick its pronouns), then folded those two into ONE screen:
// art, greeting, name, pronouns. The body-type grid, the swatches, the pattern
// list and the separate name screen are NOT deleted -- their branches still sit
// in onbBuddyStep(), dormant the way "trial" is dormant in ONB_STEPS, so putting
// a string back here brings a screen back with nothing to rebuild.
const ONB_BUDDY_STEPS = ["meet"];

// The name a buddy gets when the tester leaves the box blank. It is shown as the
// box's faded PLACEHOLDER while they are on the step -- a suggestion, cleared by
// clicking -- and only becomes the name when they LEAVE the step forward
// (Continue or Skip, via onbSetStep). Never written on arrival: a real value
// in the box is exactly what read as pre-filled rather than suggested. Never in
// onbStart() either: js/profiles.js only fills in a profile's buddy name when
// the name is empty, so seeding it there would silently stop Skip all ->
// profile picker from naming the buddy. Only fills a blank name.
const ONB_BUDDY_DEFAULT_NAME = "Buddy";

function onbBuddyNameDefault(o) {
  if (!o || !o.buddy) return;
  if (o.buddy.name && String(o.buddy.name).trim()) return;
  o.buddy.name = ONB_BUDDY_DEFAULT_NAME;
  if (state.buddy) state.buddy.name = ONB_BUDDY_DEFAULT_NAME;
}

/**
 * Move onboarding to step `i`, and run what moving between steps needs.
 *
 * EVERY step change goes through here -- Continue, Back, Skip, the deep link
 * and the admin jump -- so a step-transition rule lives in one place. Today
 * there is one: leaving the buddy step FORWARD with a blank name makes the
 * buddy "Buddy". Back does not, so returning still shows the faded placeholder.
 */
function onbSetStep(o, i) {
  if (!o) return;
  const from = o.step;
  o.step = Math.max(0, Math.min(ONB_STEPS.length - 1, Number(i) || 0));
  if (ONB_STEPS[from] === "buddy" && o.step > from) onbBuddyNameDefault(o);
}

/**
 * The buddy sub-step worth its own page key, or "". Only the NAME screen: the
 * first sub-step shares the step's own key so existing links keep their meaning.
 * Read by scrollKey() (js/utils.js) and screenTitle() (js/screen-url.js).
 */
function onbBuddySubKey(o) {
  if (!o || ONB_STEPS[o.step] !== "buddy" || !(o.buddyIndex > 0)) return "";
  return ONB_BUDDY_STEPS[o.buddyIndex] || "";
}

function onbStart() {
  state.onboarding = {
    step: 0,
    lwIndex: 0,
    buddyIndex: 0,         // sub-step within the character creator
    video: null,           // built by onbVideoInit() on first use
    skipPrompt: false,     // name-step "skip this / skip all" confirmation
    name: "",
    zip: "",
    householdSize: null,
    incomeBand: null,
    incomeExact: null,     // slider refinement inside the picked band
    lifestyle: Object.assign({}, PERSONA.lifestyle),   // persona is the fallback
    // Figures the commute follow-up sliders collect (running cost, fare, car
    // age). Separate from `lifestyle` because these are amounts, not answer
    // keys — nothing in the peer model reads them.
    lifestyleDetail: {},
    // Which lifestyle dims the tester actually picked here. The persona fills
    // state.lifestyle regardless, so this is the only way the budget wizard can
    // tell "you already told me this" from "a stranger's default".
    lifestyleAnswered: {},
    improveAreas: [],      // multi-select, max 3 (folds into strategicGoal)
    // The creator opens on the ILLUSTRATION rather than the persona's golden
    // retriever -- it is the one option with real art behind it, so it is what
    // the creator should be showing off. PERSONA.buddy is untouched, so a
    // SKIP_ONBOARDING run still boots to the description frame.
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
  // Cosmetic name has no persona fallback (D09 override): an untouched or
  // skipped buddy shows as "Buddy", never "Biscuit". Appearance fields still
  // carry over from the persona; the new pattern attribute gets a default so the
  // stage is never blank.
  state.onboarding.buddy.name = "";
  // Required on the name screen and deliberately without a default.
  state.onboarding.buddy.pronouns = "";
  state.onboarding.buddy.furPattern = state.onboarding.buddy.furPattern || "solid";
  // Mirror onto state.buddy, which is what the stage actually renders from
  // (renderBuddyInner). Without this the draft says prototype while the stage
  // above it still describes a golden retriever, and the default only takes
  // effect once the tester taps something.
  state.buddy = Object.assign({}, state.onboarding.buddy);
  return state.onboarding;
}

function onbNext() {
  const o = state.onboarding;
  if (ONB_STEPS[o.step] === "video") onbVideoStop();   // silence narration on exit
  // Step 5 is the lifestyle subset — advance within it before moving on.
  if (ONB_STEPS[o.step] === "lifestyle" && o.lwIndex < onbLifestyleQuestions().length - 1) {
    o.lwIndex++; render(); return;
  }
  // The buddy step is a multi-element creator — walk its sub-steps too.
  if (ONB_STEPS[o.step] === "buddy" && o.buddyIndex < ONB_BUDDY_STEPS.length - 1) {
    o.buddyIndex++;
    render(); return;
  }
  if (o.step < ONB_STEPS.length - 1) { onbSetStep(o, o.step + 1); render(); return; }
  onbFinish();
}

function onbBack() {
  const o = state.onboarding;
  if (ONB_STEPS[o.step] === "video") onbVideoStop();
  if (ONB_STEPS[o.step] === "lifestyle" && o.lwIndex > 0) { o.lwIndex--; render(); return; }
  if (ONB_STEPS[o.step] === "buddy" && o.buddyIndex > 0) { o.buddyIndex--; render(); return; }
  if (o.step > 0) { onbSetStep(o, o.step - 1); render(); return; }
}

// Top-right Skip. Writes no value, so the persona fallback stands for the
// financial fields. The name step is special — it opens a confirmation instead
// (skip only this screen, or skip the whole setup).
function onbSkip() {
  const o = state.onboarding;
  const key = ONB_STEPS[o.step];
  if (key === "video") onbVideoStop();
  if (key === "name") { o.skipPrompt = true; render(); return; }
  o.lwIndex = 0;   // skip the entire lifestyle block in one go
  if (o.step < ONB_STEPS.length - 1) { onbSetStep(o, o.step + 1); render(); return; }
  onbFinish();
}

// "Just this screen" from the name-skip prompt — leave o.name blank (→ "Buddy")
// and move on to ZIP.
function onbSkipName() {
  const o = state.onboarding;
  o.skipPrompt = false;
  if (o.step < ONB_STEPS.length - 1) { onbSetStep(o, o.step + 1); }
  render();
}

// "Skip all setup" — hand over to the profile picker, or, with the picker
// switched off, finish right here on the default profile. Either way the tester
// ends up with a profile somebody chose rather than the persona's by accident.
function onbSkipAll() {
  state.onboarding.skipPrompt = false;
  if (typeof PROFILE_PICKER !== "undefined" && PROFILE_PICKER &&
      typeof ppStart === "function") { ppStart(); return; }
  if (typeof profileDefault === "function") {
    const d = profileDefault();
    if (d) profileApply(d.id);
  }
  onbFinish();
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

/**
 * Every free-text field in onboarding writes through here.
 *
 * It never calls render(): a full repaint mid-keystroke replaces the input the
 * caret is in, and the tester loses their place at the third character. Instead
 * it patches the only two things that depend on the value — the Continue
 * button's disabled state and, for ZIP, the cost-of-living chart. `commit` is
 * passed by onchange where a real repaint IS wanted once the field is done.
 */
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
  if (field === "zip") uiPatchHTML("onbColChart", onbColChart(value));
}

// ── Income: a band, then a slider inside it ──────────────────────────────────
// "Over $140,000" covered a software director and a surgeon with one figure.
// The five bands stay — they are PEER_BENCHMARKS.incomeBands, the peer model's
// lookup key, and that file is a verbatim spec copy. The slider refines the
// figure WITHIN the picked band, so the band lookup is untouched and the
// budget's monthly figure stops being the same number for everyone above 140k.

function onbIncomeBand(id) {
  return ONB_INCOME_BANDS.find(b => b.id === id) || null;
}

/** The figure in play: their slider position, else the band's seed. */
function onbIncomeValue(o) {
  const band = onbIncomeBand(o.incomeBand);
  if (!band) return null;
  return o.incomeExact != null ? o.incomeExact : band.annual;
}

function onbSetIncomeBand(id) {
  const o = state.onboarding;
  const band = onbIncomeBand(id);
  o.incomeBand = id;
  // Re-seed on every band change. Carrying the old figure over would leave the
  // slider outside its own track, which the browser silently clamps — so the
  // number shown and the number stored would disagree.
  o.incomeExact = band ? band.annual : null;
  render();
}

function onbSetIncomeExact(value) {
  const o = state.onboarding;
  const band = onbIncomeBand(o.incomeBand);
  if (!band) return;
  const n = Math.round((Number(value) || 0) / ONB_INCOME_STEP) * ONB_INCOME_STEP;
  o.incomeExact = Math.max(band.min, Math.min(band.max, n));
  // Patch the label only. A render() here would replace the <input> the pointer
  // is captured on and the thumb would stop tracking mid-drag.
  uiPatchHTML("onbIncomeLabel", onbIncomeLabelText(o));
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
    <div class="card" style="margin-top:14px;">
      <p class="slider-readout" id="onbIncomeLabel">${onbIncomeLabelText(o)}</p>
      <input class="journal-slider" type="range"
             min="${band.min}" max="${band.max}" step="${ONB_INCOME_STEP}"
             value="${v}"
             oninput="onbSetIncomeExact(this.value)"
             aria-label="Annual income">
      <p class="helper" style="margin:8px 0 0;font-size:11px;">
        ${band.openTop
          ? "Drag to your figure — the top of the track covers anything above it."
          : "Drag to your figure. This is what the budget works from."}
      </p>
    </div>`;
}

// Step 5 picks. Records the dim as USER-answered as well as writing the value,
// so the budget wizard can pre-select exactly the questions already answered
// here and leave the other four blank.
function onbSetLifestyle(dim, value) {
  const o = state.onboarding;
  o.lifestyle[dim] = value;
  if (!o.lifestyleAnswered) o.lifestyleAnswered = {};
  o.lifestyleAnswered[dim] = true;
  render();
}

/**
 * Is this option selected — because the TESTER picked it, not because the
 * persona seeded it?
 *
 * o.lifestyle is seeded Object.assign({}, PERSONA.lifestyle) so the four
 * dimensions onboarding never asks still reach state.lifestyle. That seeding
 * also pre-selected "Car", because persona.json's commute is the string "car"
 * and it matches an option value exactly. paysRent never showed the same bug
 * only because its persona value is the boolean `true` while the option values
 * are strings — it never matched anything, so it looked fine by accident.
 *
 * lifestyleAnswered already tracks exactly this distinction for the budget
 * wizard; the display just wasn't reading it.
 */
function onbLifestylePicked(o, dim, value) {
  const answered = o.lifestyleAnswered || {};
  return !!answered[dim] && o.lifestyle[dim] === value;
}

// ── The commute follow-up ────────────────────────────────────────────────────
// A transport answer on its own is a category, not a cost. Each option opens
// the slider that suits it — a car's running cost, a fare per week, or the odd
// ride — so the figure the budget uses is theirs rather than a peer average.
//
// These describe what the number MEANS. They never suggest a different choice
// (D26): "about what a mainstream sedan runs", never "a cheaper car would".

const ONB_CAR_CLASSES = [
  { upTo: 275,      label: "an older economy car, bought used" },
  { upTo: 425,      label: "an economy car" },
  { upTo: 600,      label: "a mainstream sedan or small SUV" },
  { upTo: 850,      label: "a large or premium car" },
  { upTo: Infinity, label: "a luxury car, or a big payment on any car" }
];

const ONB_COMMUTE_DETAIL = {
  car:     { key: "carMonthly",    min: 150, max: 1200, step: 25, def: 400 },
  transit: { key: "transitWeekly", min: 0,   max: 120,  step: 5,  def: 30  },
  none:    { key: "walkMonthly",   min: 0,   max: 150,  step: 5,  def: 40  }
};
const ONB_CAR_AGE = { key: "carAge", min: 0, max: 20, step: 1, def: 6 };

function onbCarClass(monthly) {
  const hit = ONB_CAR_CLASSES.find(c => monthly <= c.upTo);
  return hit ? hit.label : ONB_CAR_CLASSES[ONB_CAR_CLASSES.length - 1].label;
}

/** Stored figure for one detail slider, falling back to its default. */
function onbDetail(o, spec) {
  const d = o.lifestyleDetail || {};
  return d[spec.key] != null ? Number(d[spec.key]) : spec.def;
}

function onbSetDetail(key, value, kind) {
  const o = state.onboarding;
  if (!o.lifestyleDetail) o.lifestyleDetail = {};
  o.lifestyleDetail[key] = Number(value) || 0;
  // Label-only patch — a render() would destroy the slider mid-drag.
  uiPatchHTML("onbDetailLabel", onbDetailLabelText(o, kind));
  if (kind === "car") uiPatchHTML("onbCarAgeLabel", onbCarAgeLabelText(o));
}

function onbDetailLabelText(o, kind) {
  const spec = ONB_COMMUTE_DETAIL[kind];
  if (!spec) return "";
  const v = onbDetail(o, spec);
  if (kind === "transit") {
    const monthly = Math.round((v * 52) / 12);
    return `${h(budgetFmt(v))} a week · about ${h(budgetFmt(monthly))} a month`;
  }
  return `${h(budgetFmt(v))} a month`;
}

function onbCarAgeLabelText(o) {
  const yrs = onbDetail(o, ONB_CAR_AGE);
  if (yrs === 0) return "Brand new";
  // Same open-top treatment as income band b5, for the same reason: a slider
  // maximum that reads as an exact value lies about everyone above it.
  if (yrs >= ONB_CAR_AGE.max) return `${ONB_CAR_AGE.max}+ years old`;
  return `${yrs} year${yrs === 1 ? "" : "s"} old`;
}

/** Monthly transport figure implied by the commute answers, or null. */
function onbTransportMonthly(o) {
  if (!o || !(o.lifestyleAnswered || {}).commute) return null;
  const kind = o.lifestyle.commute;
  const spec = ONB_COMMUTE_DETAIL[kind];
  if (!spec) return null;
  const v = onbDetail(o, spec);
  return kind === "transit" ? Math.round((v * 52) / 12) : v;
}

function onbCommuteDetail(o, q) {
  if (q.dim !== "commute") return "";
  if (!(o.lifestyleAnswered || {}).commute) return "";
  const kind = o.lifestyle.commute;
  const spec = ONB_COMMUTE_DETAIL[kind];
  if (!spec) return "";
  const v = onbDetail(o, spec);

  const caption =
    kind === "car"     ? `At that level you're describing ${h(onbCarClass(v))} — fuel, insurance and repairs included.`
  : kind === "transit" ? "Fares and passes, before anything you'd pay for the odd ride."
  :                      "The occasional fare or ride, rather than something you pay every month.";

  const heading =
    kind === "car"     ? "What does running it cost you?"
  : kind === "transit" ? "What do fares run you?"
  :                      "What does getting around cost you?";

  return `
    <div class="card" style="margin-top:14px;">
      <div class="row" style="align-items:baseline;margin-bottom:6px;">
        <span class="budget-row-name">${h(heading)}</span>
        <span class="budget-row-amt" id="onbDetailLabel">${onbDetailLabelText(o, kind)}</span>
      </div>
      <input class="journal-slider" type="range"
             min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${v}"
             oninput="onbSetDetail('${spec.key}', this.value, '${kind}')"
             aria-label="${h(heading)}">
      <p class="helper" style="margin:8px 0 0;font-size:11px;">${caption}</p>
    </div>
    ${kind === "car" ? `
      <div class="card" style="margin-top:10px;">
        <div class="row" style="align-items:baseline;margin-bottom:6px;">
          <span class="budget-row-name">How old is it?</span>
          <span class="budget-row-amt" id="onbCarAgeLabel">${onbCarAgeLabelText(o)}</span>
        </div>
        <input class="journal-slider" type="range"
               min="${ONB_CAR_AGE.min}" max="${ONB_CAR_AGE.max}" step="${ONB_CAR_AGE.step}"
               value="${onbDetail(o, ONB_CAR_AGE)}"
               oninput="onbSetDetail('${ONB_CAR_AGE.key}', this.value, 'car')"
               aria-label="Age of your car">
        <p class="helper" style="margin:8px 0 0;font-size:11px;">
          Newer cars tend to carry more payment and less repair; older ones the
          other way round.
        </p>
      </div>` : ""}`;
}

// "A" · "A and B" · "A, B and C" — a readable phrase for strategicGoal.label.
function onbJoinAreas(areas) {
  if (areas.length <= 1) return areas[0] || "";
  if (areas.length === 2) return areas[0] + " and " + areas[1];
  return areas.slice(0, -1).join(", ") + " and " + areas[areas.length - 1];
}

/**
 * Apply everything and land on home with a 1-day streak.
 * Only ZIP, household size and income touch the persona (D09).
 */
function onbFinish() {
  const o = state.onboarding;

  // ── What a SKIPPED field falls back to ─────────────────────────────────────
  // Every write below is guarded, which is correct — a field the tester left
  // alone must not clobber one they answered. What was wrong is what sat behind
  // the guard: the persona, so skipping quietly made you Sam from Los Angeles
  // on $68,000 and nothing said so. The default profile is an explicit,
  // documented starting point instead.
  //
  // And the name was its own bug: `o.name || "Buddy"` made the TESTER "Buddy",
  // the same as the dog. The person is "Me"; only the dog is Buddy.
  const fallback = (typeof profileDefault === "function" && profileDefault()) || null;
  if (fallback && !state.activeProfileId) profileApply(fallback.id);

  state.profile.name = o.name || (fallback ? fallback.name : "Me");
  if (o.zip) state.profile.zip = o.zip;
  if (o.householdSize) state.profile.householdSize = o.householdSize;
  // The slider's figure if they moved it, else the band's seed. This also
  // drives the budget's monthly figure — which until now was frozen at the
  // seeded persona's $4,390 no matter which band you picked, so "Under $35,000"
  // and "Over $140,000" produced an identical budget.
  const income = onbIncomeValue(o);
  if (income != null) {
    state.profile.incomeAnnual = income;
    state.monthlyIncome = Math.round(income / 12);
  }

  state.lifestyle = Object.assign({}, o.lifestyle);
  state.lifestyleAnswered = Object.assign({}, o.lifestyleAnswered || {});
  state.lifestyleDetail = Object.assign({}, o.lifestyleDetail || {});
  // The commute sliders are a stated figure, so they beat the peer model's
  // guess for Transport. Only when the tester actually answered the question —
  // otherwise the peer value stands.
  const transport = onbTransportMonthly(o);
  if (transport != null) state.lifestyleDetail.transportMonthly = transport;
  state.buddy = Object.assign({}, o.buddy);
  // Name it here rather than leaving it blank for the screens to paper over.
  // An unnamed buddy is currently "Buddy" on Home and in Chat but "Your buddy"
  // in the character frame — three fallbacks for one empty string, which is two
  // too many and one of them says something different. Setting it once means
  // every surface agrees, and profileApply's earlier write survives this
  // assign rather than being clobbered by o.buddy's empty name.
  if (!state.buddy.name) {
    state.buddy.name = (fallback && fallback.buddyName) || "Buddy";
  }

  // The multi-select folds into the single strategic goal the app renders as
  // "What you're here for" (goals-v3.js). Keep the raw picks on `areas`.
  const areas = (o.improveAreas || []);
  state.strategicGoal = {
    id: "g_strategic_1",
    label: areas.length ? onbJoinAreas(areas) : "Get on top of my money",
    areas: areas.slice(),
    setDuringOnboarding: true
  };

  // The trial pitch is out of the flow (see ONB_STEPS), so nobody answers it —
  // and state.trialAccepted gates diamonds (lrDiamondsForLesson) and the
  // subscriber section of the reward screen. Left null those would be
  // unreachable. D31 said nothing is gated either way, so everyone gets the
  // subscriber tier. Guarded rather than assigned, so onbTrial's answer still
  // wins if that step is ever put back into ONB_STEPS.
  if (state.trialAccepted == null) state.trialAccepted = true;

  // The budget is NOT built here — the setup wizard is the first thing the
  // Budget tab shows (spec 04: "the wizard, before the budget exists"). We only
  // carry the lifestyle answers forward (written above), which pre-fill the
  // wizard when the tester opens Budget or taps the "Set up your budget" task.
  // Leaving planStatus empty is what makes renderBudgetEmpty (the wizard door)
  // appear on first visit.
  state.planStatus = "empty";

  if (typeof ubTrailRecord === "function") {
    ubTrailRecord("zip", state.profile.zip);
    ubTrailRecord("hh", state.profile.householdSize);
    ubTrailRecord("inc", state.profile.incomeAnnual);
    ubTrailRecord("goal", areas.length ? areas[0] : "");
    // The buddy's SPECIES, not the name the tester typed for it.
    ubTrailRecord("buddy", (state.buddy && state.buddy.animal) || "");
    // One of three fixed ids (BUDDY_PRONOUNS), never typed -- so it may ride
    // in the URL. Blank when the buddy step was skipped, and then not recorded.
    ubTrailRecord("pro", (state.buddy && state.buddy.pronouns) || "");
    if (transport != null) ubTrailRecord("comm", transport);
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
  // Trial has its own two buttons — no generic Skip / Continue there.
  const showControls = key !== "trial";

  // EVERY step pins Back/Continue and scrolls its content between the header
  // and the footer. This used to be `o.step >= 5`, an index picked when the
  // goal question sat sixth — it is second now, and it is still the step that
  // overflows hardest at ten options, so the old test selected exactly the
  // wrong ones. An index into a list that gets reordered is a trap; there is no
  // version of it that stays correct.
  //
  // Applying it everywhere costs nothing: a short step simply does not scroll,
  // and its footer sits at the bottom of the screen either way.
  const pinned = " onb-pinned";

  // The film step is the one body that has to be a flex COLUMN: .onb-video
  // sizes itself against it, and a plain block gave it nothing to size against.
  // Scoped to this step, because the other eight want a normal block flow.
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
        ${showControls
          ? `<button class="onb-skip" type="button" onclick="onbSkip()">Skip</button>`
          : ""}
      </div>
      <div class="journal-body${bodyCls}">${onbStepBody(key, o)}</div>
      <div class="journal-foot">
        ${o.step > 0 || o.lwIndex > 0 || o.buddyIndex > 0
          ? `<button class="button secondary" type="button" onclick="onbBack()">Back</button>`
          : `<span></span>`}
        ${showControls
          ? `<button class="button" type="button" id="onbContinue" onclick="onbNext()"
                     ${onbAnswered(key, o) ? "" : "disabled"}>${h(onbContinueLabel(key, o))}</button>`
          : ""}
      </div>
    </div>
    ${o.skipPrompt ? onbSkipPrompt() : ""}
  `;
}

// The footer button's words.
function onbContinueLabel(key, o) {
  // The one-screen buddy step reads "Continue" like every other step (owner's
  // call). Kept as the single place a step could word its button differently.
  return "Continue";
}

// Name-step skip confirmation. Reuses the shared .ls-modal-bg scrim.
function onbSkipPrompt() {
  return `
    <div class="ls-modal-bg" onclick="onbSkipCancel()">
      <div class="card" style="max-width:300px;" onclick="event.stopPropagation()">
        <h1 class="title onb-title" style="margin:0 0 6px;">No name, no problem</h1>
        <p class="task-desc" style="margin:0 0 14px;">
          I can just call you Buddy. Want to skip only this, or the whole setup?
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

// Nothing blocks progress — an unanswered step is skippable and the persona
// value stands (D09).
function onbAnswered(key, o) {
  if (key === "name")      return !!o.name;
  if (key === "zip")       return !!o.zip;
  if (key === "household") return !!o.householdSize;
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

// Cost-of-living comparison shown on the ZIP step, once all five digits are in.
// Nation is the 100% baseline; the ZIP's index sits next to it. Descriptive
// only, never prescriptive (D26); "peers", never "average users" (D23).
function onbColChart(zip) {
  const digits = String(zip == null ? "" : zip).replace(/\D/g, "");

  // Wait for the whole ZIP. It used to draw at three digits, which was the old
  // prefix model showing through — three digits named a tier. A ZIP now
  // resolves to its county, and four digits of a five-digit code identify
  // nothing, so a partial chart would be a figure for somewhere else.
  if (digits.length < 5) return onbColTeaser(digits.length);

  const col = benchColIndex(zip);

  // Every US ZIP is modeled, so this is a guard rather than a path — but a ZIP
  // that is genuinely nonsense should say so plainly rather than draw a chart
  // that implies we looked something up.
  if (!col.supported) {
    return `
    <div class="note" style="margin-top:16px;">
      I don't recognise that one, so I'll use the national average for now. Your peer numbers still work — they're just not tuned to local costs.
    </div>`;
  }

  const zipPct    = 100 + col.pct;
  const nationPct = 100;
  const scaleMax  = Math.max(nationPct, zipPct);
  const nationW   = nationPct / scaleMax * 100;
  const zipW      = zipPct / scaleMax * 100;
  const markerX   = Math.max(6, Math.min(94, nationPct / scaleMax * 100));

  const where = col.place ? h(col.place) : "your area";

  let text;
  if (col.pct > 0) {
    text = `Compared to the national average, the cost of living in ${where} is <strong>${col.pct}% higher</strong>. This helps put your spending in context next to your peers.`;
  } else if (col.pct < 0) {
    text = `Compared to the national average, the cost of living in ${where} is <strong>${Math.abs(col.pct)}% lower</strong>. This helps put your spending in context next to your peers.`;
  } else {
    text = `The cost of living in ${where} is <strong>about the same</strong> as the national average. This helps put your spending in context next to your peers.`;
  }

  return `
    <div class="onb-col-chart">
      <div class="onb-col-row">
        <div class="onb-col-head"><span>Nation</span><span>${nationPct}%</span></div>
        <div class="cmp-bar"><span style="width:${nationW}%;background:var(--muted);"></span></div>
      </div>
      <div class="onb-col-row">
        <div class="onb-col-head"><span>Your ZIP</span><span>${zipPct}%</span></div>
        <div class="cmp-bar"><span style="width:${zipW}%;background:var(--accent);"></span></div>
      </div>
      <div class="onb-col-baseline" style="left:${markerX}%;" aria-hidden="true"></div>
      <!-- No label on the line: the axis caption below already names it, and
           two "national average" strings a few pixels apart read as a bug. -->
      <p class="onb-col-axis">Cost of living · national average = 100%</p>
    </div>
    <p class="helper onb-col-text">${text}</p>
    ${onbColHousingLine(col)}`;
}

// The composite is a weighted basket, and most of that basket is priced
// nationally — so even Silicon Valley lands near 120%, which reads as wrong to
// anyone who knows what their own rent is. Housing is where nearly all the
// variation actually lives, so name it.
function onbColHousingLine(col) {
  const h1 = col.housingIndex;
  if (!h1 || !isFinite(h1)) return "";
  const mult = Math.round(h1 * 10) / 10;
  let phrase;
  if (h1 >= 1.15)      phrase = `runs about <strong>${mult}× the national average</strong>`;
  else if (h1 <= 0.85) phrase = `runs about <strong>${mult}× the national average</strong>`;
  else                 phrase = `is <strong>close to the national average</strong>`;
  return `
    <p class="helper onb-col-text" style="margin-top:8px;">
      Housing there ${phrase} — that's where most of the difference sits. The rest
      of a budget, from groceries to streaming, is priced much the same everywhere.
    </p>`;
}

// Before there is anything to chart. The step was a bare input with no reason
// to fill it in; this says what typing it buys.
function onbColTeaser(typed) {
  if (typed > 0) {
    return `
    <p class="helper onb-col-teaser">
      ${5 - typed} more digit${5 - typed === 1 ? "" : "s"} and I'll show you the comparison.
    </p>`;
  }
  return `
    <div class="note onb-col-teaser-card">
      <p class="task-title" style="margin:0 0 4px;font-size:13px;">There's a number waiting behind this one</p>
      <p class="task-desc" style="margin:0;">
        Type your ZIP and I'll show you how your corner of the country compares
        to the rest of it. Some places run a third above the national average,
        some a fifth below — and housing swings further than that.
      </p>
    </div>`;
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

  if (key === "zip") return `
    <h1 class="title onb-title" style="margin:0 0 6px;">Where are you these days?</h1>
    <p class="helper" style="margin:0 0 14px;">
      A ZIP is plenty — it just helps me learn what things cost near you. Nothing gets shared.
    </p>
    <div class="input-group">
      <input inputmode="numeric" maxlength="5" placeholder="ZIP code" value="${h(o.zip)}"
             oninput="onbLiveInput('zip', this.value)"
             onchange="onbLiveInput('zip', this.value)">
    </div>
    <div id="onbColChart">${onbColChart(o.zip)}</div>`;

  if (key === "household") {
    const HH_LABELS = { 1: "Only me", 2: "2 people", 3: "3 people", 4: "4 or more people" };
    return `
    <h1 class="title onb-title" style="margin:0 0 6px;">Who's in your corner?</h1>
    <p class="helper" style="margin:0 0 14px;">How many people share your place, counting you?</p>
    <div class="journal-options">
      ${[1, 2, 3, 4].map(n => `
        <button class="journal-opt ${o.householdSize === n ? "picked" : ""}" type="button"
                onclick="state.onboarding.householdSize=${n};render()">
          <span class="journal-opt-label">${HH_LABELS[n]}</span>
        </button>`).join("")}
    </div>
    <p class="helper" style="margin:14px 0 0;">
      This helps me size things up — costs like groceries and utilities shift a lot depending on how many people share a home.
    </p>`;
  }

  if (key === "income") return `
    <h1 class="title onb-title" style="margin:0 0 6px;">Roughly what comes in each year?</h1>
    <p class="helper" style="margin:0 0 14px;">Pick the band that fits, then nudge it to your figure.</p>
    <div class="journal-options">
      ${ONB_INCOME_BANDS.map(b => `
        <button class="journal-opt ${o.incomeBand === b.id ? "picked" : ""}" type="button"
                onclick="onbSetIncomeBand('${b.id}')">
          <span class="journal-opt-label">${h(b.label)}</span>
        </button>`).join("")}
    </div>
    ${onbIncomeSlider(o)}`;

  // A subset of the standalone budget builder's questions — same dimensions and
  // keys, so an answer means the same thing either way; onboarding just asks the
  // install-relevant few (housing, commute, travel) and lets the rest keep their
  // persona defaults.
  if (key === "lifestyle") {
    const lwq = onbLifestyleQuestions();
    const q = lwq[o.lwIndex];
    return `
      <p class="helper" style="margin:0 0 4px;">A few quick ones about how you live (${o.lwIndex + 1}/${lwq.length})</p>
      <h1 class="title onb-title" style="margin:0 0 6px;">${h(q.prompt)}</h1>
      ${q.help ? `<p class="helper" style="margin:0 0 14px;">${h(q.help)}</p>` : ""}
      <div class="journal-options">
        ${q.options.map(opt => `
          <button class="journal-opt ${onbLifestylePicked(o, q.dim, opt.value) ? "picked" : ""}" type="button"
                  onclick="onbSetLifestyle('${q.dim}','${opt.value}')">
            <span class="journal-opt-label">${h(opt.label)}</span>
          </button>`).join("")}
      </div>
      ${onbCommuteDetail(o, q)}`;
  }

  if (key === "goal") {
    const atMax = o.improveAreas.length >= ONB_GOALS_MAX;
    // Second step now, so it opens with the name they just typed. Deliberately
    // NOT "nice to meet you" — step 1 says that, and hearing it twice in a row
    // reads as the app having lost its place.
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
                onclick="onbToggleGoal('${h(g).replace(/'/g, "\\'")}')">
          <span class="journal-opt-label">${h(g)}</span>
          <span class="opt-check-box" aria-hidden="true">${on ? "✓" : ""}</span>
        </button>`;
      }).join("")}
    </div>`;
  }

  if (key === "buddy") return onbBuddyStep(o);

  if (key === "video") return onbVideoBody(o);

  // D32 — the trial popup still appears. Accept or decline, the experience
  // afterward is identical HERE. D31 ("no paywalls anywhere") is overridden
  // for the Budget tab only — see plan.md §0 L27 and js/config.js — so this
  // step's own promise had to change with it; the old closing line said
  // nothing was locked, which the Budget tab now contradicts.
  return `
    <div class="card">
      <p class="pill" style="display:inline-block;font-size:9px;padding:3px 9px;margin-bottom:10px;">7 days free</p>
      <h1 class="title onb-title" style="margin:0 0 6px;">Last thing — want to try Platinum with me?</h1>
      <p class="task-desc" style="margin:0 0 12px;">
        Seven days free, then $6.99 a month. Cancel any time.
      </p>
      <ul class="onb-trial-list">
        <li>Daily updates on how you're doing</li>
        <li>Video updates on reported spending</li>
        <li>Peer comparisons for every category</li>
        <li>Unlimited journal entries and history</li>
        <li>All lessons and simulations</li>
      </ul>
      <button class="button full" style="margin-bottom:8px;" type="button"
              onclick="onbTrial(true)">Start free trial</button>
      <button class="button secondary full" type="button"
              onclick="onbTrial(false)">Not right now</button>
      <p class="helper" style="font-size:10px;margin:12px 0 0;">
        Answer either way — this step changes nothing on its own.
      </p>
    </div>`;
}

function onbSetBuddy(key, value) {
  const set = (k, v) => {
    state.onboarding.buddy[k] = v;
    state.buddy[k] = v;          // so the stage above updates live
  };
  set(key, value);

  // Picking the illustration on the FIRST step fills the rest in. The image is
  // one fixed picture with its background baked in, so it cannot show a
  // prototype breed with chocolate fur -- and leaving the later steps on real
  // values would put the tester in a state the stage has to silently ignore.
  // Filling them makes the remaining steps show what actually applies.
  //
  // Only forward, and only from breed: picking a real breed later is how a
  // tester leaves prototype mode, and that must not drag the others with it.
  if (key === "breed" && value === BUDDY_PROTOTYPE) {
    ["furColor", "furPattern", "eyeColor", "noseColor", "size"]
      .forEach(k => set(k, BUDDY_PROTOTYPE));
  }
  render();
}

// ─── Character creator (one element per sub-step, Mii/Nintendogs style) ───────
// Reads the shared option lists from components/buddy.js at render time.
const ONB_BUDDY_COPY = {
  meet:       ["Meet your buddy!",
               "Buddy is here to help answer questions and join you on your financial journey! " +
               "Let's give your buddy a name!"],
  bodyType:   ["Now the fun part — let's give me a look.", "Scroll to pick your buddy's body type"],
  breed:      ["Now the fun part — let's give me a look.", "Scroll and pick a breed."],
  furColor:   ["What colour is my coat?",                  "Tap a colour."],
  furPattern: ["Any markings?",                            "Scroll and pick a pattern."],
  eyeColor:   ["And my eyes?",                             "Tap a colour."],
  name:       ["What should you call me?",                 "Pick a name and my pronouns."]
};

function onbBuddyStep(o) {
  const sub = ONB_BUDDY_STEPS[o.buddyIndex];
  const b = o.buddy || {};
  const copy = ONB_BUDDY_COPY[sub] || ["Design your buddy", ""];
  // "(1/5)" meant something with five screens. With one it is noise.
  const count = ONB_BUDDY_STEPS.length > 1
    ? `Your buddy (${o.buddyIndex + 1}/${ONB_BUDDY_STEPS.length})` : "Your buddy";

  // Meet: the whole buddy step on one screen. The greeting heads it -- in the
  // slot the small "Your buddy" counter used to hold -- then the portrait, the
  // line asking for a name, and the name and pronouns centred under that.
  // Continue unlocks once a pronoun is picked (onbAnswered).
  if (sub === "meet") {
    return `
    <div class="onb-buddy-step onb-buddy-step-meet">
      <h1 class="title onb-title">${h(copy[0])}</h1>
      ${renderBuddyStage({ square: true, cls: "onb-buddy-stage" })}
      <p class="task-desc onb-buddy-sub" style="margin:0 0 14px;">${h(copy[1])}</p>
      ${onbBuddyNameFields(b)}
    </div>`;
  }

  let control;
  if (sub === "bodyType") {
    control = onbBodyTypeControl(o);
  } else if (sub === "breed") {
    control = onbBuddyScrollList("breed", BUDDY_BREEDS, b.breed);
  } else if (sub === "furPattern") {
    control = onbBuddyScrollList("furPattern", BUDDY_FUR_PATTERNS, b.furPattern);
  } else if (sub === "furColor") {
    control = onbBuddySwatches("furColor", BUDDY_FUR_COLORS, BUDDY_FUR_COLOR_CSS, b.furColor);
  } else if (sub === "eyeColor") {
    control = onbBuddySwatches("eyeColor", BUDDY_EYE_COLORS, BUDDY_EYE_COLOR_CSS, b.eyeColor);
  } else {
    control = onbBuddyNameFields(b);
  }

  // Wrapped in a flex column so the control below the stage takes the space the
  // header and stage leave, rather than sitting at a fixed height with a gap
  // under it. See .onb-buddy-step in css/components.css.
  return `
    <div class="onb-buddy-step${sub === "bodyType" ? " onb-buddy-step-body" : ""}">
      <p class="helper onb-buddy-count">${h(count)}</p>
      <h1 class="title onb-title" style="margin:0 0 6px;">${h(copy[0])}</h1>
      <p class="helper onb-buddy-sub" style="margin:0 0 12px;">${h(copy[1])}</p>
      ${renderBuddyStage({ square: true, cls: "onb-buddy-stage" })}
      ${control}
    </div>`;
}

/**
 * The name box and the pronouns dropdown, each under its own label.
 *
 * "Buddy" is the name box's PLACEHOLDER, not its value: faded, and gone the
 * moment the box is clicked (CSS, .onb-buddy-fields input:focus::placeholder)
 * so the tester can type straight in. Left blank, the buddy becomes "Buddy"
 * when they move on (onbSetStep). The dropdown's blank option has value "", so
 * nothing is chosen for the tester and Continue stays locked until they choose.
 */
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

// ─── Body type: a 3x3 grid, and a breed search that filters it ───────────────
// Nine rounded tiles, Mii-style. The label sits OUTSIDE the tile; inside is a
// placeholder circle whose size is the only thing telling the eight unbuilt
// types apart (BUDDY_BODY_TYPES in components/buddy.js). The prototype tile
// carries the real illustration, because it is the one that exists.
//
// The grid shows two rows and half of the third, so it reads as scrollable
// without a scrollbar having to say so.

function onbBodyTypeControl(o) {
  const q = (o && o.bodySearch) || "";
  return `
    <div class="body-search">
      <input class="body-search-input" type="text" inputmode="search"
             placeholder="Search a breed — try &quot;husky corgi mix&quot;"
             value="${h(q)}"
             oninput="onbBodySearch(this.value)"
             onfocus="onbBodySearchOpen()"
             onkeydown="onbBodySearchKey(event)"
             aria-label="Search a dog breed to filter body types">
      <button class="body-search-clear" type="button" aria-label="Clear search"
              onclick="onbBodySearchClear()">&times;</button>
    </div>
    <p class="helper body-search-match" id="onbBodyMatch">${onbBodyMatchLine(o)}</p>
    <div class="buddy-body-grid" id="onbBodyGrid">${onbBodyGrid(o)}</div>`;
}

/** The tiles themselves — patched on its own, so typing never rebuilds the input. */
function onbBodyGrid(o) {
  const b = (o && o.buddy) || {};
  const visible = (typeof breedVisibleBodies === "function")
    ? breedVisibleBodies((o && o.bodySearch) || "")
    : BUDDY_BODY_TYPES.map(t => t.id);

  return BUDDY_BODY_TYPES.filter(t => visible.indexOf(t.id) !== -1).map(t => {
    const picked = b.bodyType === t.id;
    // The prototype is the one with art. Everything else gets its circle.
    const inner = t.id === BUDDY_PROTOTYPE
      ? `<img class="body-tile-img" src="${BUDDY_PROTOTYPE_IMG}" alt=""
              onerror="this.style.display='none'">`
      : `<span class="body-tile-dot" style="width:${t.dot}px;height:${t.dot}px;"></span>`;
    return `
      <button class="body-tile ${picked ? "picked" : ""}" type="button"
              aria-pressed="${picked}"
              onclick="onbSetBuddy('bodyType','${h(t.id)}')">
        <span class="body-tile-square">${inner}</span>
        <span class="body-tile-label">${h(t.label)}</span>
      </button>`;
  }).join("");
}

/** What the search found, in words. Patched alongside the grid. */
function onbBodyMatchLine(o) {
  const q = (o && o.bodySearch) || "";
  if (!q.trim() || typeof breedMatch !== "function") {
    return "Nine shapes. Pick whichever looks most like your dog.";
  }
  const m = breedMatch(q);
  if (m.generic) return "A bit of everything — all nine still showing.";
  if (!m.breeds.length) return "No breed by that name. All nine still showing.";

  const names = m.breeds.slice(0, 3).map(n => h(n)).join(" + ") +
                (m.breeds.length > 3 ? " +" + (m.breeds.length - 3) + " more" : "");
  const shapes = m.bodies.length === 1 ? "one shape" : m.bodies.length + " shapes";
  // Saying WHY a third shape appeared: a cross throws builds neither parent has,
  // and a tester who sees an unexplained extra tile reads it as a bug.
  const because = m.crossAdded.length
    ? ", including what the cross itself can throw"
    : "";
  return names + " — " + shapes + because + ".";
}

// ─── Search mode ─────────────────────────────────────────────────────────────
// Focusing the field hands it the screen: the portrait, title and subtitle go
// away, the search rises to the top and the grid takes everything left. What
// rises above the keyboard is the thing being chosen from, not the dog.
//
// ⚠ IT IS A DOM CLASS, NOT STATE, and that is deliberate twice over.
//
// First, it cannot re-render. render() reassigns the screen's innerHTML, which
// destroys the focused <input>, drops the caret and closes the keyboard — a
// focus handler that re-rendered would shut the mode it had just opened.
// Toggling a class touches no node.
//
// Second, nothing has to remember to clear it. Picking a tile goes through
// onbSetBuddy() → render(), and the rebuilt markup simply has no class, so the
// mode ends by construction rather than by someone maintaining a flag. The
// FILTER is the thing that is state (o.bodySearch), and it survives both
// transitions on purpose: a grid that silently refilled would be the app
// undoing the tester's work behind their back.

function onbBodyStepEl() {
  return document.querySelector(".onb-buddy-step-body");
}

function onbBodySearchOpen() {
  const el = onbBodyStepEl();
  if (el && el.classList) el.classList.add("searching");
}

/** Leave search mode. The blur is what closes the simulated keyboard. */
function onbBodySearchClose() {
  const el = onbBodyStepEl();
  if (el && el.classList) el.classList.remove("searching");
  const inp = document.querySelector(".body-search-input");
  if (inp && inp.blur) inp.blur();
}

/**
 * Enter means "done searching", not "submit".
 *
 * There is no form here and nothing to post — the grid has been filtering on
 * every keystroke already, so the only thing left for Enter to do is give the
 * screen back with the filter intact.
 */
function onbBodySearchKey(e) {
  if (!e) return;
  if (e.key === "Enter" || e.keyCode === 13) {
    if (e.preventDefault) e.preventDefault();
    onbBodySearchClose();
  }
}

/**
 * Filter as they type, WITHOUT re-rendering.
 *
 * render() reassigns the screen's innerHTML, which destroys the focused input
 * and takes the caret with it — the reason this app's inputs commit on
 * `onchange`. A search box cannot wait for blur, so it uses the same escape
 * hatch onbLiveInput does: patch the two fragments that changed and leave the
 * <input> itself alone (uiPatchHTML, js/utils.js).
 */
function onbBodySearch(value) {
  const o = state.onboarding;
  if (!o) return;
  o.bodySearch = value;
  uiPatchHTML("onbBodyGrid", onbBodyGrid(o));
  uiPatchHTML("onbBodyMatch", onbBodyMatchLine(o));
}

/** The × inside the field. Clears the filter and hands focus back. */
function onbBodySearchClear() {
  const o = state.onboarding;
  if (!o) return;
  o.bodySearch = "";
  const el = document.querySelector(".body-search-input");
  if (el) { el.value = ""; }
  uiPatchHTML("onbBodyGrid", onbBodyGrid(o));
  uiPatchHTML("onbBodyMatch", onbBodyMatchLine(o));
  if (el && el.focus) el.focus();
}

// Vertical scrollable list — breed, fur pattern.
function onbBuddyScrollList(key, options, current) {
  return `
    <div class="buddy-scroll-list">
      ${options.map(opt => `
        <button class="buddy-scroll-opt ${current === opt ? "picked" : ""}" type="button"
                onclick="onbSetBuddy('${key}','${h(opt).replace(/'/g, "\\'")}')">
          <span>${h(String(opt).replace(/_/g, " "))}</span>
          ${current === opt ? `<span aria-hidden="true">✓</span>` : ""}
        </button>`).join("")}
    </div>`;
}

// Circular colour swatches — fur colour, eye colour. Fill comes from the shared
// colour map; the current pick is named beneath (a circle alone isn't labelled).
function onbBuddySwatches(key, options, cssMap, current) {
  return `
    <div class="buddy-swatch-row">
      ${options.map(opt => `
        <button class="buddy-swatch-circle ${current === opt ? "picked" : ""}" type="button"
                aria-label="${h(opt)}"
                onclick="onbSetBuddy('${key}','${h(opt).replace(/'/g, "\\'")}')">
          <span class="buddy-swatch-fill" style="background:${cssMap[opt] || "var(--muted)"};"></span>
        </button>`).join("")}
    </div>
    <p class="helper buddy-swatch-label">${current ? h(String(current)) : "&nbsp;"}</p>`;
}

// ─── Intro video ─────────────────────────────────────────────────────────────
// REBUILT to the lesson player's model (screens/lesson.js) so step 8 and a
// lesson behave the same way: an elapsed-time clock against a per-segment CUE
// map, with skip / scrub / speed acting on that clock and a Next that unlocks
// on completion.
//
// It used to be event-driven — each segment's audio `onended` advanced to the
// next — which gave the captions nothing to seek against. There was no clock to
// scrub, no position to skip to and no rate to change, which is why the controls
// were Restart and Play and nothing else.
//
// Cue times come from onbVideoSegMs(), i.e. word count at DU_WPM, the same pace
// the build-time TTS renders at. The clock stays authoritative and the audio
// rides along beside it, exactly as lpSpeakCurrent documents for the lesson.

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

// ── The stage ────────────────────────────────────────────────────────────────
// Was renderBuddyStage(): a text card describing the buddy, which never moved
// while the film narrated over it for forty seconds. Now it runs the same
// hyperframes engine the lesson player uses.
//
// Beat boundaries come from the player's OWN cue map rather than being declared
// as fractions the way lessons.json does. Beat N spans segment N, so rewriting a
// line re-cuts the beats automatically — the cues and the beats read one source.

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

// ── The rendered film (v3.1) ─────────────────────────────────────────────────
// tools/film renders this piece properly, in HeyGen HyperFrames, once per
// script x theme. The .mp4 is a committed asset exactly like the daily update's
// .wav files — a build-time artifact, no runtime dependency, and it plays from
// file:// as a plain <video>.
//
// It is rendered SILENT on purpose. The narration is still live browser speech,
// so the film is pure picture and onbFilmSync drives it from the same clock the
// captions use — the identical job the CSS animations were doing, on one node.
//
// THREE TIERS, and the lower two are not sentiment (D19 forbids an empty
// screen, and file:// video playback is the one thing no headless check here
// can settle):
//   1  the rendered .mp4
//   2  the hand-rolled hyperframes SVG, if that file is missing or will not play
//   3  the buddy card, if there is no storyboard at all
const ONB_FILM_DIR = "assets/video/onboarding";

// Module-level, so it survives a render but NOT a reboot — reset in bootV3 the
// same way buddyImgBroken is. Without that, one missing file would keep the
// film on tier 2 for the rest of the session.
let onbFilmBroken = false;
function onbFilmResetArt() { onbFilmBroken = false; }

/** The theme whose render we would play. */
function onbFilmTheme() {
  return (typeof themeCurrent === "function" && themeCurrent().id) || "naturalLight";
}

/**
 * The render that serves this tester's theme, or null.
 *
 * The film has TWO looks, dark and light, and each serves two themes — a
 * broadcast palette only reads as broadcast if it commits, so it is not
 * repainted per theme. data/onboarding-films.js is generated by the render and
 * carries both the mapping and what exists.
 *
 * Asking it beats pointing a <video> at a maybe-path and relying on an `error`
 * event to fall back — that event is the one thing no headless check here can
 * confirm, and D19 forbids the blank stage that would follow if it never fired.
 */
function onbFilmEntry() {
  if (onbFilmBroken) return null;
  if (typeof ONBOARDING_FILMS === "undefined") return null;
  const script = onbVideoScriptId();

  // Their own look first — a theme that HAS a render always gets it.
  const own = ONBOARDING_FILMS[onbFilmTheme()];
  if (onbFilmEntryHas(own, script)) return own;

  if (!ONB_FILM_ANY_LOOK) return null;
  return onbFilmAnyLook(script);
}

/** Does this index entry actually carry a render of `script`? */
function onbFilmEntryHas(entry, script) {
  if (!entry || !entry.look || !entry.scripts) return false;
  return entry.scripts.indexOf(script) !== -1;
}

// ONE RENDER SERVES EVERY THEME — TEMPORARY, and meant to be undone.
//
// The film has two looks and only `light` is rendered, so the two dark themes
// had nothing of their own and dropped to the SVG engine: the same onboarding
// step showing two different pieces of work depending on a colour setting the
// tester picked for unrelated reasons. Owner's call is to play the render that
// exists on all four themes until the rest are rendered.
//
// It is a FALLBACK, not a remapping — a theme with its own render still gets
// it (onbFilmEntry checks that first). So this needs no unwinding: render the
// dark look and the dark themes stop falling through on their own. Setting it
// false restores strict per-theme matching.
//
// Known trade, accepted: the picture does not repaint per theme by design (a
// broadcast palette only reads as broadcast if it commits), so on a dark theme
// this is a light-palette film in a dark frame.
const ONB_FILM_ANY_LOOK = true;

/**
 * Any rendered look carrying this script, or null.
 *
 * Sorted so the choice is deterministic — Object.keys order is stable for
 * string keys in practice, but the film a tester sees should not rest on that.
 */
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

/**
 * Paint the stage the film's own ground, so it stops framing the picture.
 *
 * The stage is 100:72 and so is the film, but a squeezed viewport still
 * letterboxes -- and before this those bars were `--accent`, a green edge round
 * a cream film. Matching them makes the leftover invisible, which is also what
 * lets the stage shrink on a short screen without looking wrong.
 *
 * ⚠ ONLY WHEN A FILM IS PLAYING. The SVG fallback (tier 2) draws entirely in
 * `--on-dark` -- the only colour token in components/hyperframes.js -- and
 * paints no ground of its own, so it relies on `.lp-stage`'s accent. Painting
 * the stage cream underneath it would be light ink on near-white: invisible,
 * and only on the themes with no render, where it would read as the animation
 * being broken rather than as a colour choice.
 *
 * Keyed on the LOOK that is playing, not the tester's theme. A dark theme with
 * no dark render borrows the light film (ONB_FILM_ANY_LOOK), and the stage has
 * to follow the film rather than the theme or it reintroduces the mismatch.
 */
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

/**
 * Is the clock pinned at the speech cap, waiting for a line that is running
 * longer than its word-count estimate?
 *
 * This has to be asked of the PICTURE too, not just the bar. onbVideoTick
 * freezes `elapsed` at the cap, but the hyperframes are native CSS animations
 * on wall clock -- they kept going. So every 100ms tick found them further on
 * than the frozen clock, and hyperframesSync's drift check yanked currentTime
 * backwards: roughly eight 120ms rewinds a second, for as long as the overrun
 * lasted. That is the flicker, and it fires on any segment the narrator takes
 * longer over than 165 wpm predicts -- a two- or three-sentence line, because
 * sentence-final pauses are not in the estimate.
 */
function onbVideoHeld(v) {
  return !!(v && v.speechDriven && v.elapsed >= onbSpeechCap(v) - 0.001);
}

/** Drive the animation clock from the player's clock. */
/**
 * Point the rendered film at the player's clock.
 *
 * Same contract as hyperframesSync, on one element instead of twenty
 * animations: hold exactly while the voice is finishing a line, glide a small
 * correction rather than jump-cutting it, snap a real seek. The constants are
 * the shared ones, so retuning the drift behaviour moves both surfaces.
 */
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
    // `!el.ended`: a film that ran out a few ms before the clock is also
    // `paused`, and play() on an ENDED element restarts it from 0 (HTML
    // standard) -- the film replayed itself at the finish. Its last frame is
    // the right picture; a real seek above clears `ended` and play resumes.
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
  // Held → hand hyperframesSync `playing: false`, which pauses each animation
  // and pins it to the cap. The picture holds its last frame while the narrator
  // finishes, which is what capping the clock always meant.
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
  // Was THIS surface using the shared narration seam? render() calls this on
  // every render that is not the onboarding video step, and the lesson player
  // starts its own speech a few lines EARLIER in that same render — so
  // cancelling unconditionally killed the lesson's voice before it could speak.
  const wasNarrating = !!(o && o.video && o.video.playing);
  if (o && o.video) {
    o.video.playing = false;
    o.video.speechDriven = false;   // no voice, so the estimate is the clock again
    // A media `ended`/`error` handler can still be queued when we stop. If a
    // restart re-arms `playing` in the same synchronous turn, that stale
    // callback lands afterwards and starts a second voice over the same
    // segments. Bumping the generation invalidates anything already in flight —
    // belt and braces alongside detaching the handlers in onbVideoReleaseAudio.
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

/**
 * Give the current segment a voice. Does NOT drive advancement — the clock is
 * authoritative, so a seek lands the caption and the voice in the same place.
 *
 * Under L10, Web Speech is a BUILD-TIME generator and never a runtime player —
 * runtime plays the .wav that scripts/gen-audio.sh produced, exactly like the
 * daily update and the lesson player. That .wav is absent until gen-audio.sh has
 * been run, so a load or autoplay failure falls back to runtime speech, and a
 * browser with no voice falls back to silence. Captions move either way.
 */
function onbVideoSpeak() {
  const o = state.onboarding;
  if (!o || !o.video || !o.video.playing) return;
  const seg = onbVideoSegments()[o.video.index];
  if (!seg) return;

  // ── THE SYNC CONTRACT (architecture §10) ───────────────────────────────────
  // No .wav has ever been generated for the onboarding intro on this machine
  // (gen-audio.sh needs macOS `say`), so this path is what actually runs — and
  // it ran a 165 wpm word-count clock against a browser voice reading at its
  // own pace. Caption, voice and scrub bar all disagreed within a few segments.
  //
  // When live speech is driving, SPEECH is the clock: the segment index is
  // pinned on `onStart` and only advances on `onEnd`, and onbVideoTick's bar is
  // capped inside the current segment (onbSpeechCap). Identical to the lesson
  // player's lpSpeakCurrent — same contract, same reasons.
  const idx = o.video.index;
  const speakFallback = function () {
    const started = narrationSpeak(seg, {
      rate: o.video.speed || 1,
      onStart: function () {
        const v = onbVideo();
        if (!v || v.index !== idx) return;      // superseded by a seek
        v.speechDriven = true;
        // FORWARDS ONLY. onbSpeechCap lets the tick run to just short of the
        // NEXT cue, so elapsed is normally ahead of this segment's start --
        // snapping to it unconditionally jumps the clock BACKWARDS, and
        // onbVideoSyncFrames faithfully rewinds every hyperframes animation to
        // match. That rewind is the flicker seen at each segment boundary.
        // Taking the cue only when the clock is behind the voice keeps the
        // correction that matters and drops the one that was visible.
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
    a.onerror = speakFallback;                 // not generated yet → speak it live
    // A generated .wav has the same job as live speech here: it is the voice,
    // so it is the clock. The clip's real length is not the word-count estimate
    // either, so leaving the bar on the estimate would drift the same way.
    a.onplay = function () {
      const v = onbVideo();
      if (!v || v.index !== idx) return;
      v.speechDriven = true;
      // Forwards only, exactly as in the live-speech path above: snapping down
      // to this segment's start rewinds the hyperframes and shows as a flicker.
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

// ±10 seconds — same control as the lesson player (lpSeekBy). It used to jump
// ±1 segment behind "◀ Back" / "Next ▶", which reads as stepping through the
// onboarding rather than seeking inside the film.
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

// ── Scrubbing ────────────────────────────────────────────────────────────────
// Geometry for the drag in progress, measured once at pointerdown. Reading it
// per pointermove forces a synchronous layout every frame, right after the bar's
// width was written — the classic read-after-write thrash.
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

function onbTrial(accepted) {
  state.trialAccepted = accepted;
  onbFinish();
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
      <p class="helper" style="font-size:10px;margin:0 0 12px;">
        SKIP_ONBOARDING = ${SKIP_ONBOARDING} · PROFILE_PICKER = ${PROFILE_PICKER}
      </p>
      ${!o ? `<p class="helper">Not running.</p>` : `
        <div class="input-group">
          <label>Step ${o.step + 1}/${ONB_STEPS.length} — ${h(ONB_STEPS[o.step])}</label>
          <select onchange="state.onboarding.lwIndex=0;state.onboarding.buddyIndex=0;onbSetStep(state.onboarding,parseInt(this.value,10));render()">
            ${ONB_STEPS.map((s, i) => `<option value="${i}" ${o.step === i ? "selected" : ""}>${i + 1}. ${h(s)}</option>`).join("")}
          </select>
        </div>
        <div class="input-group">
          <label>Overrides the persona (D09 — only these three)</label>
          <div class="helper" style="line-height:1.7;">
            zip → ${h(o.zip || "—")}<br>
            household → ${h(o.householdSize || "—")}<br>
            income band → ${h(o.incomeBand || "—")}
            ${onbIncomeValue(o) != null
              ? ` · ${h(budgetFmt(onbIncomeValue(o)))}/yr
                  · ${h(budgetFmt(onbIncomeValue(o) / 12))}/mo`
              : ""}
          </div>
        </div>
        <div class="input-group">
          <label>Commute detail — collected by the budget wizard now, not here</label>
          <div class="helper" style="line-height:1.7;">
            ${(o.lifestyleAnswered || {}).commute
              ? `${h(o.lifestyle.commute)} → ${h(budgetFmt(onbTransportMonthly(o) || 0))} a month
                 ${o.lifestyle.commute === "car"
                   ? `<br>${h(onbCarClass(onbDetail(o, ONB_COMMUTE_DETAIL.car)))}
                      · ${h(onbCarAgeLabelText(o))}`
                   : ""}`
              : "not asked during onboarding — the wizard collects it, and the peer value stands until it does"}
          </div>
        </div>
        <p class="helper" style="font-size:10px;">
          Everything else falls back to persona.json. Skipping never blocks.
        </p>
      `}
      <button class="button secondary full" type="button" onclick="onbStart();go('onboarding')">Restart onboarding</button>
    </div>
  `;
}
