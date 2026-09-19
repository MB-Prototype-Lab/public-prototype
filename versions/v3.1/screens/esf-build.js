// ─── Emergency fund — the three capture screens ──────────────────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// One screen id, three steps on state.esf.step, the same shape as the budget
// builder next door: a screen costs five wiring points and each is a place to
// forget, so three steps of one screen cost them once.
//
// ── TYPED FIGURES ONLY ───────────────────────────────────────────────────────
// No sliders and no steppers. The builder next door is all sliders, deliberately
// so; here it is deliberately the opposite. A slider gets you close and not
// precise, and these are survival figures where the real number matters — and
// with two fields sharing a box there is no room for a stepper pair anyway.
//
// Number entry rides the SIMULATED KEYBOARD that already exists
// (components/keyboard.js): `inputmode="numeric"` is what selects its pad
// layer, and that pad already carries a Done key which commits the field and
// closes it. Nothing here needs to build a submit control.
//
// ── WATCH THE KEYBOARD LATCH ─────────────────────────────────────────────────
// Closing the pad removes 250px of layout, which pulls a button out from under
// a finger mid-press so no click is ever dispatched. kbdInit holds the close
// while a press is in flight. Any new control below the fields inherits that
// problem; do not work around it locally.

// ── ONE HEADER, EVERY STEP ───────────────────────────────────────────────────
// The per-step titles are gone on the owner's call. They named the step rather
// than the feature, so a tester three screens in had been told what KIND of
// number to expect but never what they were building or why. The progress pips
// carry the position; the header carries the point.
const ESF_TITLE_MAIN = "Emergency Savings Fund";

// Step 0 is an INTRO — no fields, no picture, just what this is and why. It
// exists because a tester arriving from a task card was previously asked for
// their rent before anything had explained what they were building.
const ESF_STEPS = [
  { id: "intro" },
  { id: "fixed",     heading: "Housing and Car Payments" },
  { id: "utilities", heading: "Keeping things running" },
  { id: "rest",      heading: "Living-related Expenses" }
];

// The plan screen is a step too, as far as the tester is concerned — it is
// where the flow ends. It lives in its own file but counts in the progress.
const ESF_TOTAL_STEPS = ESF_STEPS.length + 1;

// ── Buddy, per step ──────────────────────────────────────────────────────────
// Owner-supplied art (L22), one scene per step, matched to what that step asks
// about: the house and cars where rent and a car payment are collected, the
// living room where the phone and internet bills are.
//
// Not generated — D10 forbids that and it holds. A step with no entry here
// simply shows no banner, which is the right degradation: a missing image must
// never leave a gap where a picture was promised.
// These two are WIDE (roughly 2.36:1), authored for this banner rather than
// borrowed from elsewhere, so `cover` barely crops them — unlike the square-ish
// yard illustration the Home screen uses.
// `ratio` is the art's own aspect. The first two were drawn wide for this slot;
// the living-expenses and safe illustrations are near-square, so a shared fixed
// ratio would crop a third off one pair or letterbox the other. Each image
// brings its own.
// `maxH` is what keeps every screen off the scrollbar. The art's own aspect
// decides the shape; this decides how much vertical budget that step can spare
// for it, and it varies because the steps do not carry the same load. A 2.36
// image at frame width is naturally ~136px and needs no cap; a 1.79 one is
// ~180px and gets trimmed on the screens that cannot afford it.
//
// Measured, not guessed — every value here was set by checking
// scrollHeight against clientHeight on the real screen.
const ESF_STEP_IMAGE = {
  1: { src: "assets/img/buddy-home.jpg",            ratio: 2.36, maxH: 140 },
  2: { src: "assets/img/buddy-utilities.jpg",       ratio: 2.36, maxH: 112 },
  3: { src: "assets/img/buddy-living-expenses.jpg", ratio: 1.79, maxH: 66 }
};

// The plan screen's own art. Also used by the intro, which has the most room of
// any screen and so shows it largest.
const ESF_PLAN_IMAGE = { src: "assets/img/buddy-esf.jpg", ratio: 1.79, maxH: 150 };
const ESF_INTRO_IMAGE_MAX = 176;

/**
 * Wide art fills the width; near-square art is sized by HEIGHT instead and
 * centred at its natural width.
 *
 * A 1.03:1 illustration stretched across a 322px frame would be 322px tall and
 * eat the screen, and cropping it to a banner shape cuts exactly the part that
 * carries the meaning — the labelled drawers, the money in the case. Below this
 * threshold the picture is shown whole and small rather than partial and large.
 */
const ESF_WIDE_RATIO = 1.6;

function esfBannerClass(img) {
  return img && img.ratio < ESF_WIDE_RATIO ? " esf-banner-tall" : "";
}

// The Plaid mark, inline. It has to be inline: the app runs on file:// with no
// network, so a hosted logo would render as a broken image. `currentColor`
// means it inherits the button's text colour and works in all four themes
// without a second asset.
const ESF_PLAID_MARK = `
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 2l3.5 3.5-2.1 2.1L12 6.2l-1.4 1.4-2.1-2.1L12 2zm10 10l-3.5 3.5-2.1-2.1
                                 1.4-1.4-1.4-1.4 2.1-2.1L22 12zM2 12l3.5-3.5 2.1 2.1L6.2 12l1.4 1.4-2.1 2.1L2 12z
                                 m10 10l-3.5-3.5 2.1-2.1 1.4 1.4 1.4-1.4 2.1 2.1L12 22z"/>
  </svg>`;

function esfStepDef() {
  const s = esfSession();
  return ESF_STEPS[Math.min(s.step, ESF_STEPS.length - 1)];
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/** A typed figure. Strips whatever the tester typed around the number. */
function esfSetRow(rowId, raw) {
  const s = esfSession();
  const n = Number(String(raw == null ? "" : raw).replace(/[^0-9.]/g, ""));
  s.rows[rowId] = isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  s.touched[rowId] = true;
  delete s.declined[rowId];
  render();
}

/** Rent or own is an assumption with a one-tap correction, never a question. */
function esfToggleOwns() {
  const s = esfSession();
  s.owns = !s.owns;
  render();
}

/** A range was picked — the row takes that range's midpoint. */
function esfSetRange(rowId, mid) {
  const s = esfSession();
  const n = Number(mid);
  s.rows[rowId] = isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  s.touched[rowId] = true;
  render();
}

function esfToggleExplain(key) {
  const s = esfSession();
  if (!s.explain) s.explain = {};
  s.explain[key] = !s.explain[key];
  render();
}

/**
 * Hand one line to the Help-me-out trees.
 *
 * The trees are keyed on the taxonomy, and two ESF rows share a category with
 * another row — so a tree's answer lands on the row that OWNS the category's
 * estimate, never on the typed one. Transport's tree prices running costs; it
 * has nothing to say about a car loan.
 */
const ESF_HELP_ROW_FOR_CATEGORY = {
  "Groceries": "groceries",
  "Debt payments": "debt",
  "Transport": "carCosts",
  "Health": "medical",
  "Utilities": "power"
};

function esfRunHelp(category) {
  const s = esfSession();
  if (!isCategory(category) || !hmoHasTree(category)) return;
  s.returnTo = "esf";
  if (!s.help) s.help = {};
  s.help[category] = true;
  hmoStart(category, { target: "esf" });
}

/** The tree calls back with the figure it reached. */
function esfApplyHelp(category, amount) {
  const s = esfSession();
  const rowId = ESF_HELP_ROW_FOR_CATEGORY[category];
  if (!rowId) return;
  s.rows[rowId] = Math.max(0, Math.round(Number(amount) || 0));
  s.touched[rowId] = true;
  if (s.help) delete s.help[category];
}

function esfNext() {
  const s = esfSession();
  if (s.step < ESF_STEPS.length - 1) { s.step++; render(); return; }
  esfLog("capture_done", { stated: esfStatedMonthly(), untouched: esfRowsRemaining() });
  go("esfPlan");
}

function esfBack() {
  const s = esfSession();
  if (s.step > 0) { s.step--; render(); return; }
  // Back off the FIRST fund screen reopens onboarding at its first question.
  // navBack() popped to the Goals tab, which is where the fund ends rather than
  // where it began — so "back" moved the tester forwards.
  if (typeof ESF_ONLY !== "undefined" && ESF_ONLY && typeof onbStart === "function") {
    onbStart();
    go("onboarding");
    return;
  }
  navBack();
}

// ── Where a figure came from ─────────────────────────────────────────────────
// A disclosure, never a question flow. Each line names the source rather than
// describing it vaguely — "we estimated this" tells a tester nothing about
// whether to trust it.

function esfRowSource(rowId) {
  const place = (benchColIndex(state.profile.zip) || {}).place;
  const where = place ? " for " + place : " for your area";
  if (rowId === "power") {
    return "Typical power and water for a household your size, priced at your state's own electricity rate" + where + ".";
  }
  if (rowId === "connect") {
    return "Published average broadband, plus a mobile line for each person in your household. Priced the same everywhere — a carrier doesn't charge more in one city than another.";
  }
  if (rowId === "groceries") {
    return "USDA's cost of food at home for a household your size, adjusted" + where + ".";
  }
  if (rowId === "debt") {
    return "The smallest payment a lender would accept on a typical balance — not what people usually pay.";
  }
  if (rowId === "carRunning") {
    return "AAA's running costs — fuel, upkeep and insurance. Insurance is most of it before a wheel turns.";
  }
  if (rowId === "propertyTax") {
    return "About 14% of what housing costs" + where + ", which is roughly what owners pay in tax on it.";
  }
  if (rowId === "hoa") {
    return "The typical monthly fee where a building or neighborhood charges one" + where + ".";
  }
  if (rowId === "medical") {
    return "Typical out-of-pocket costs for visits, prescriptions and dental" + where + ".";
  }
  return "Based on public spending data for households like yours" + where + ".";
}

// ── Render ───────────────────────────────────────────────────────────────────

function esfMoney(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
}

/**
 * One field. `inputmode="numeric"` is what opens the simulated number pad —
 * components/keyboard.js picks the layer off the input, and that pad already
 * carries its own Done key, which commits the field and puts the keyboard away.
 * No separate submit control is needed or wanted here.
 */
/**
 * "Based on …" — what an estimate was built from, in one line.
 *
 * An auditable estimate earns an override; an unexplained one gets a shrug. The
 * drivers named here are the ones the tester actually answered, so the line
 * doubles as a receipt for the onboarding questions.
 */
function esfBasedOn(rowId) {
  const hh = typeof esfHousehold === "function" ? esfHousehold() : null;
  const zip = (state.profile || {}).zip;
  const where = zip ? " in " + zip : "";
  const place = (typeof ONB_PLACE_TYPES !== "undefined" &&
                 ONB_PLACE_TYPES.find(p => p.id === esfPlaceType())) || null;
  const people = hh ? hh.people : null;
  const peopleWord = people === 1 ? "1 person" : people + " people";

  if (rowId === "power") {
    return "Based on " + (place ? place.label.toLowerCase() : "your home") +
           where + " with " + peopleWord + ".";
  }
  if (rowId === "connect") {
    // The split is shown because the combined figure is the one people query —
    // "that seems high" is answerable by "$110 of it is four phone lines".
    const c = esfData().connectivity || {};
    const lines = esfPhoneLines();
    const internet = Number(c.internet) || 0;
    const phone = Math.max(0, esfConnectivity() - internet);
    return lines + " phone line" + (lines === 1 ? "" : "s") + " (" + esfMoney(phone) +
           ") plus internet (" + esfMoney(internet) + ").";
  }
  if (rowId === "groceries") {
    const kids = hh ? hh.youngKids + hh.teens : 0;
    return "Based on " + (hh ? hh.adultCount : 1) + " adult" + (hh && hh.adultCount === 1 ? "" : "s") +
           (kids ? " and " + kids + " kid" + (kids === 1 ? "" : "s") : "") + ". Groceries only.";
  }
  if (rowId === "carCosts") {
    const miles = esfMilesPerDay();
    if (miles === 0) return "Based on not driving.";
    return "Based on " + (miles == null ? "typical" : miles) + " miles a day" + where + ".";
  }
  // ONE LINE. Say what to include, not how it was derived — a tester checking
  // this row needs to know whether their dental bill belongs in it, and the
  // pricing method is the thing they care least about.
  if (rowId === "medical") {
    return "Insurance, copays, prescriptions, dental and vision.";
  }
  // No "Based on" for debt — there is no estimate behind it. What the tester
  // needs is what counts, not where a number came from.
  if (rowId === "debt") return "The smallest payment you must make each month on credit cards and loans.";
  if (rowId === "hoa") return "Based on a " + (place ? place.label.toLowerCase() : "home") + where + ".";
  if (rowId === "propertyTax") return "Based on typical home values and tax rates" + where + ".";
  if (rowId === "homeInsurance") return "Based on average premiums" + where + ".";
  return "";
}

/** A range dropdown — the only control on an estimated row. */
function esfRenderRangeField(row) {
  const value = esfRowValue(row.id);
  // The debt row offers labelled combinations rather than dollar bands.
  const combos = row.options === "debt";
  const options = combos ? esfDebtOptions() : esfBandOptions(value, row);
  const here = combos ? null : esfBandFor(value, row);
  const annual = row.cadence === "annual";

  return `
    <div class="esf-field esf-field-wide">
      <select class="esf-range" aria-label="${h(row.label)}, a ${annual ? "year" : "month"}"
              onchange="esfSetRange('${row.id}', this.value)">
        ${options.map(b => {
          const on = combos
            ? Math.round(b.mid) === Math.round(value)
            : (b.zero ? value === 0 : (!!value && b.lo === here.lo));
          return `<option value="${b.mid}" ${on ? "selected" : ""}>${h(esfBandLabel(b, row))}</option>`;
        }).join("")}
      </select>
    </div>`;
}

function esfRenderField(row, bare) {
  const s = esfSession();
  const value = s.rows[row.id];
  const blank = value == null;
  const annual = row.cadence === "annual";
  const note = esfFieldNote(row);

  // `bare` drops the label: a choice group's segmented picker already names
  // what the field is, and repeating it underneath reads as a second question.
  //
  // An ANNUAL row puts its monthly conversion beside the box rather than under
  // it. "$5,160" and "$430 per month" are the same fact twice, and stacking
  // them read as two separate figures.
  const inlineNote = annual && note;

  return `
    <div class="esf-field${bare ? " esf-field-wide" : ""}">
      ${bare ? "" : `
        <label class="esf-field-label" for="esfIn_${row.id}">${h(row.label)}${
          row.labelNote ? `<span class="esf-label-note">${h(row.labelNote)}</span>` : ""
        }</label>`}
      <span class="esf-input-row">
        <input id="esfIn_${row.id}" class="esf-amount" type="text" inputmode="numeric"
               value="${blank ? "" : h(esfMoney(value))}"
               placeholder="$0"
               aria-label="${h(row.label)}, dollars ${annual ? "a year" : "a month"}"
               onchange="esfSetRow('${row.id}', this.value)">
        ${inlineNote ? `<span class="esf-field-inline">${h(note)}</span>` : ""}
      </span>
      ${note && !inlineNote ? `<span class="esf-field-unit">${h(note)}</span>` : ""}
    </div>
  `;
}

/**
 * The line under a field.
 *
 * Only where it earns its place. "a month" used to sit under every field and
 * said nothing — the header now states once that this is all monthly. What is
 * left either converts a figure the tester entered in another cadence, or reads
 * their number back in units they can actually check.
 */
function esfFieldNote(row) {
  if (row.cadence === "annual") return esfMoney(esfRowMonthly(row.id)) + " per month";

  // The car box is one combined figure now, so there is no per-component note
  // to write — the "Based on" line above it names the drivers instead.
  // Insurance and maintenance carry no note on purpose. Only the fuel figure
  // converts into something a tester can check — miles. "Estimated from your
  // area" under the other two says nothing they can act on and cost two lines
  // on the one screen this step has to fit inside.
  return "";
}

/**
 * One box. Rows sharing a `group` sit side by side inside it, which is what
 * makes "Rent | Mortgage" read as one question with two answers.
 */
function esfRenderGroup(group) {
  const rows = group.rows;
  const lead = rows[0];
  const help = rows.map(r => r.help).filter(Boolean)[0];
  const qualifier = rows.map(r => {
    const bill = r.bill && esfBills().find(b => b.id === r.bill);
    return bill && bill.qualifier;
  }).filter(Boolean)[0];

  // ── Opt-in: estimated, but worth nothing until added ──────────────────────
  if (lead.optIn) {
    const added = esfRowAdded(lead.id);
    return `
      <div class="item-card esf-row ${added ? "esf-row-on" : ""}">
        <div class="esf-optin-head">
          <span class="esf-field-label">${h(lead.label)}${
            lead.labelNote ? `<span class="esf-label-note">${h(lead.labelNote)}</span>` : ""
          }</span>
          <button type="button" class="${added ? "esf-added" : "esf-add"}"
                  aria-pressed="${added}" onclick="esfToggleRow('${lead.id}')">
            ${added ? "Added" : "Add it"}
            ${added || lead.startAtZero ? "" :
              `<span class="esf-add-figure">${h(esfMoney(esfRowMonthly(lead.id, true)))}/mo</span>`}
          </button>
        </div>
        ${added ? `<div class="esf-fields">${esfRenderRangeField(lead)}</div>` : ""}
      </div>`;
  }

  // Three narrow fields need their own row; two sit comfortably side by side.
  const wide = rows.length >= 3 ? " esf-fields-narrow" : "";
  // A group label over ONE field already names it, so the field drops its own
  // label rather than saying the same thing twice in two type sizes.
  const bare = rows.length === 1 && !!lead.groupLabel;

  return `
    <div class="item-card esf-row">
      ${lead.groupLabel ? `<p class="esf-group-label">${h(lead.groupLabel)}</p>` : ""}
      ${rows.map(r => {
        // An estimated row is a description line and a range. A typed row keeps
        // its number box — rent and a car payment are figures people know.
        if (!r.prefill) return "";
        const based = esfBasedOn(r.id);
        return `<div class="esf-estimate">
          ${rows.length > 1 || !lead.groupLabel
            ? `<span class="esf-field-label">${h(r.label)}${
                r.labelNote ? `<span class="esf-label-note">${h(r.labelNote)}</span>` : ""}</span>`
            : ""}
          ${based ? `<p class="esf-based">${h(based)}</p>` : ""}
          <div class="esf-fields">${esfRenderRangeField(r)}</div>
        </div>`;
      }).join("")}
      ${rows.some(r => !r.prefill)
        ? `<div class="esf-fields">${rows.filter(r => !r.prefill).map(r => esfRenderField(r, bare)).join("")}</div>`
        : ""}
      ${help ? `<p class="helper esf-row-help">${h(help)}</p>` : ""}
      ${qualifier ? `<p class="helper esf-qualifier">${h(qualifier)}</p>` : ""}
    </div>
  `;
}

/** The intro — centred in the screen, no fields, no picture. */
function esfRenderIntro() {
  return `
    <div class="esf-intro">
      <div class="esf-banner${esfBannerClass(ESF_PLAN_IMAGE)}"
           style="aspect-ratio:${ESF_PLAN_IMAGE.ratio} / 1;max-height:${ESF_INTRO_IMAGE_MAX}px;">
        <img src="${h(ESF_PLAN_IMAGE.src)}" alt="" aria-hidden="true">
      </div>
      <p>An Emergency Savings Fund is a cushion for hard times</p>
      <p>It helps reduce financial anxiety when unfortunate events like job loss
         and major unexpected expenses happen</p>
      <p>Let's start with understanding your regular <strong>Monthly Expenses</strong>
         that you think must be paid every month</p>

      <div class="esf-intro-choices">
        <button class="button full" type="button" onclick="esfNext()">Build my fund</button>
        <button class="button secondary full" type="button" onclick="esfSkipToGoal()">
          I already have one
        </button>
      </div>
    </div>
  `;
}

/**
 * "I already have one" — done, and stop asking.
 *
 * NO FIGURE IS COLLECTED, deliberately. Plenty of people are comfortable with
 * what they have set aside and have no wish to track it here; for them the
 * useful outcome is not a goal, it is the tool never surfacing as a task again.
 * Asking for a number to create a goal nobody wanted would be charging them for
 * the privilege of opting out.
 *
 * So this marks the task complete and leaves the Goals tab alone.
 */
function esfSkipToGoal() {
  state.esfSelfReported = { at: todayISO() };
  esfLog("already_have_one", {});
  esfCompleteTasks();
  navGoTabRoot("goals");
}

/**
 * Tick the emergency-fund task off in both task systems.
 *
 * There are two — `state.tasks` keys on `destination`, the Home daily loop on
 * `route` — and a task ticked in one still shows as outstanding in the other.
 * The daily one goes through homeCompleteTask rather than setting the flag by
 * hand, because that is what pays the Charity Points.
 */
function esfCompleteTasks() {
  (state.tasks || []).forEach(t => {
    if (t.destination === "esfBuild") t.completed = true;
  });
  (state.dailyTasks || []).forEach(t => {
    if (t.route !== "emergency_fund") return;
    if (typeof homeCompleteTask === "function") homeCompleteTask(t.id);
    else t.completed = true;
  });
}

function renderEsfBuild() {
  const s = esfSession();
  const step = esfStepDef();
  const last = s.step === ESF_STEPS.length - 1;
  const intro = step.id === "intro";
  // The bank-connect offer sits on the first step that actually asks for a
  // figure, not on the intro — an offer to skip the work belongs beside the
  // work, not before anybody knows what it is.
  const first = s.step === 1;
  const banner = ESF_STEP_IMAGE[s.step] || null;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">Step ${s.step + 1} of ${ESF_TOTAL_STEPS}</p>
        <div class="journal-progress" aria-hidden="true">
          ${Array.from({ length: ESF_TOTAL_STEPS }, (_, i) =>
            `<span class="journal-pip ${i <= s.step ? "on" : ""}"></span>`).join("")}
        </div>
        <h1 class="title esf-title">${h(intro ? ESF_TITLE_MAIN : (step.heading || ESF_TITLE_MAIN))}</h1>
      </div>

      <div class="journal-body ${intro ? "esf-body-intro" : ""}">
        ${intro ? esfRenderIntro() : `
          ${banner ? `
            <div class="esf-banner${esfBannerClass(banner)}" style="aspect-ratio:${banner.ratio} / 1;max-height:${banner.maxH}px;">
              <img src="${h(banner.src)}" alt="" aria-hidden="true">
            </div>
          ` : ""}

          ${first ? `
            <button type="button" class="esf-plaid" title="Not part of this prototype">
              ${ESF_PLAID_MARK}<span>Automate this for me - connect my financial accounts</span>
            </button>

            <p class="esf-lead">Let's start with your <strong>Monthly Expenses</strong></p>
          ` : ""}

          ${s.step === 2 ? `
            <p class="esf-lead"><strong>Monthly Expenses</strong> - Use your best guess</p>
          ` : ""}

          ${esfGroupsForStep(s.step).map(esfRenderGroup).join("")}
        `}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="esfBack()">Back</button>
        ${intro ? "" : `
          <button class="button" type="button" onclick="esfNext()">
            ${last ? "See my number" : "Continue"}
          </button>`}
      </div>
    </div>
  `;
}

function renderEsfBuildAdmin() {
  const s = esfSession();
  const events = (state.esfEvents || []).slice(-8).reverse();

  return `
    <div class="admin-card">
      <p class="admin-card-title">Emergency fund — step ${s.step + 1} of ${ESF_STEPS.length}</p>
      <p class="helper">
        Stated ${esfMoney(esfStatedMonthly())} (medical ${esfMoney(esfRowMonthly("medical"))},
        priced as if work cover had stopped) · buffer
        ${Math.round((s.buffer || 0) * 100)}% → ${esfMoney(esfBufferedMonthly())} a month
      </p>
      <p class="helper">
        Coverage ${esfCoverageMonths()} months → target <strong>${esfMoney(esfTarget())}</strong> ·
        ${esfRowsRemaining()} of ${ESF_ROWS.length} rows still an estimate
      </p>
      <p class="helper">
        Assuming they ${s.owns ? "own" : "rent"} and ${s.hasCar ? "have" : "have no"} car —
        both are one-tap corrections on step 1, neither is collected by onboarding.
      </p>
    </div>

    <div class="admin-card">
      <p class="admin-card-title">Session log (${(state.esfEvents || []).length})</p>
      ${events.length
        ? events.map(e => `<p class="helper">${h(e.at)} · <code>${h(e.event)}</code> ${h(JSON.stringify(e.detail))}</p>`).join("")
        : `<p class="helper">Nothing logged yet. In-memory only — it resets on refresh (D03).</p>`}
    </div>
  `;
}
