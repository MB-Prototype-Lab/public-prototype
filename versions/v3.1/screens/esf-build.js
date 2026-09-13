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
  2: { src: "assets/img/buddy-utilities.jpg",       ratio: 2.36, maxH: 108 },
  3: { src: "assets/img/buddy-living-expenses.jpg", ratio: 1.79, maxH: 104 }
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
  "Transport": "carRunning",
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

  if (row.id === "fuel") {
    const miles = esfImpliedMiles();
    if (!miles) return "";
    // Kept to one line — it wrapped at the full wording, and this note sits in
    // the tightest box on the screen.
    return "~" + miles.toLocaleString("en-US") + " mi/mo at $" +
           esfPerGallon().toFixed(2) + "/gal";
  }
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

  // A choice group is a segmented picker over ONE field. Two fields where one
  // is always zero is both uglier and more work than a toggle plus a box.
  if (lead.choice) {
    const picked = rows.find(esfRowPicked) || lead;
    return `
      <div class="item-card esf-row">
        <div class="esf-seg" role="group" aria-label="${h(rows.map(r => r.label).join(" or "))}">
          ${rows.map(r => `
            <button type="button" class="esf-seg-btn ${esfRowPicked(r) ? "on" : ""}"
                    aria-pressed="${esfRowPicked(r)}"
                    onclick="esfPickChoice('${h(group.id)}','${r.id}')">${h(r.label)}</button>
          `).join("")}
        </div>
        ${esfRenderField(picked, true)}
      </div>
    `;
  }

  // Three narrow fields need their own row; two sit comfortably side by side.
  const wide = rows.length >= 3 ? " esf-fields-narrow" : "";
  // A group label over ONE field already names it, so the field drops its own
  // label rather than saying the same thing twice in two type sizes.
  const bare = rows.length === 1 && !!lead.groupLabel;

  return `
    <div class="item-card esf-row">
      ${lead.groupLabel ? `<p class="esf-group-label">${h(lead.groupLabel)}</p>` : ""}
      <div class="esf-fields${wide}">${rows.map(r => esfRenderField(r, bare)).join("")}</div>
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
    </div>
  `;
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
        <p class="helper" style="margin:0 0 4px;">Step ${s.step + 1} of ${ESF_STEPS.length}</p>
        <div class="journal-progress" aria-hidden="true">
          ${ESF_STEPS.map((_, i) => `<span class="journal-pip ${i <= s.step ? "on" : ""}"></span>`).join("")}
        </div>
        <h1 class="title esf-title">${h(ESF_TITLE_MAIN)}</h1>
      </div>

      <div class="journal-body ${intro ? "esf-body-intro" : ""}">
        ${intro ? esfRenderIntro() : `
          ${step.heading ? `<p class="esf-step-heading">${h(step.heading)}</p>` : ""}

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
            <p class="esf-lead-sub">We can revise later if you don't know</p>
          ` : ""}

          ${esfGroupsForStep(s.step).map(esfRenderGroup).join("")}
        `}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="esfBack()">Back</button>
        <button class="button" type="button" onclick="esfNext()">
          ${last ? "See my number" : "Continue"}
        </button>
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
        Stated ${esfMoney(esfStatedMonthly())} (incl. unemployed insurance
        ${esfMoney(esfRowMonthly("unemployedInsurance"))}, excl. dining
        ${esfMoney(esfRowMonthly("diningOut"))}) · buffer
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
