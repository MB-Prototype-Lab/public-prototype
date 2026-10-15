// Keep three category groups in one screen session to avoid duplicate routing.
// Every line uses a slider, initially centered on this profile's peer band;
// Help me out asks about only the lines the tester hands over.

const BB_STEPS = [
  {
    id: "exact",
    title: "The ones you already know",
    help: "Rent or mortgage, and what you subscribe to. These barely move from month to month, so a real figure beats an estimate.",
    categories: ["Housing", "Subscriptions"]
  },
  {
    id: "regular",
    title: "The regular ones",
    help: "These move a little but not wildly. Roughly right is all this needs.",
    categories: ["Transport", "Utilities", "Groceries", "Personal care", "Debt payments"]
  },
  {
    id: "flexible",
    title: "The ones that move",
    help: "These vary the most, and they are the ones your Money Journal will sharpen over time.",
    categories: ["Health", "Dining out", "Entertainment", "Shopping", "Other"]
  }
];

// The steps must partition the taxonomy exactly, with no omitted or repeated
// category. The sweep reads this same definition.
function bbAllStepCategories() {
  return BB_STEPS.reduce((all, s) => all.concat(s.categories), []);
}

// Use the same profile options for the opening figure and peer band so
// the thumb begins at the peer median.
function bbOpeningValues() {
  return benchAllPeerValues(benchOptsForUser());
}

// Initialize without navigation so deep links can create a session before
// the first history entry. Share this with bbStart to avoid divergent defaults.
function bbSessionInit() {
  const opening = bbOpeningValues();
  state.budgetBuild = {
    step: 0,
    opening: opening,                       // frozen: the band's axis anchor
    values: Object.assign({}, opening),
    help: {},                               // category -> true while toggled on
    helped: {}                              // category -> true once its tree ran
  };
  return state.budgetBuild;
}

function bbStart() {
  bbSessionInit();
  go("budgetBuild");
}

function bbSession() {
  if (!state.budgetBuild) bbStart();
  return state.budgetBuild;
}

function bbStep() {
  const b = state.budgetBuild;
  return BB_STEPS[Math.max(0, Math.min(BB_STEPS.length - 1, (b && b.step) || 0))];
}

function bbValue(category) {
  const b = state.budgetBuild;
  return Math.max(0, Math.round(Number((b && b.values && b.values[category])) || 0));
}

// `live` is set by the slider's oninput, which fires on every pointer move.
// render() reassigns .screen's innerHTML, so an undebounced render destroys the
// element being dragged and the thumb stops tracking. The number field passes
// no flag and repaints immediately.
function bbSet(category, amount, live) {
  if (!isCategory(category)) return;
  const b = bbSession();
  b.values[category] = Math.max(0, Math.round(Number(amount) || 0));
  // Last-value-wins, so a drag records where it came to rest rather than every
  // pixel of the way there (js/value-trail.js).
  if (typeof ubTrailBudget === "function") ubTrailBudget(category, b.values[category]);
  if (!live) { render(); return; }
  const el = document.getElementById("bbAmt" + CATEGORIES.indexOf(category));
  if (el) el.textContent = budgetFmt(b.values[category]) + " a month";
  debouncedRender();
}

// Help disables the slider until the question tree hands the line back.
// Turning help off clears its completion marker so it can be requested again.
function bbToggleHelp(category) {
  if (!isCategory(category)) return;
  const b = bbSession();
  if (b.help[category]) {
    delete b.help[category];
    delete b.helped[category];
  } else {
    b.help[category] = true;
  }
  render();
}

/** Lines on THIS step that asked for help and have not been asked yet. */
function bbPendingHelp() {
  const b = bbSession();
  return bbStep().categories.filter(c => b.help[c] && !b.helped[c]);
}

// Finish pending help before advancing; its peer default is not an answer
// the tester has confirmed.
function bbNext() {
  const pending = bbPendingHelp();
  if (pending.length) { bbRunHelp(pending[0]); return; }
  bbAdvanceStep();
}

// Share advancement with the help queue so all handed-over lines complete
// before moving to the next step or saving.
function bbAdvanceStep() {
  const b = bbSession();
  if (b.step < BB_STEPS.length - 1) { b.step++; render(); return; }
  bbSubmit();
}

function bbBack() {
  const b = bbSession();
  if (b.step > 0) { b.step--; render(); return; }
  navBack();
}

/**
 * Hand one line to Help me out, its own question engine (L25): it asks how the
 * tester lives and calls bbApplyHelp with the figure.
 */
function bbRunHelp(category) {
  if (!isCategory(category)) return;
  hmoStart(category);
}

// Turn the help toggle off after the tree returns a figure, exposing the
// result on the row's editable slider.
function bbApplyHelp(category, amount) {
  const b = bbSession();
  if (!isCategory(category)) return;
  b.values[category] = Math.max(0, Math.round(Number(amount) || 0));
  // Its own key, never overwriting the tester's own guess. Guessed-vs-computed
  // is the most interesting comparison the trail carries.
  if (typeof ubTrailHelped === "function") ubTrailHelped(category, b.values[category]);
  b.helped[category] = true;
  delete b.help[category];
}

/** Every category asked about up to and including the current step. */
function bbCategoriesSoFar() {
  const b = bbSession();
  return BB_STEPS.slice(0, b.step + 1)
    .reduce((all, s) => all.concat(s.categories), []);
}

// Count only reviewed categories in Budgeted so far, so unseen defaults
// do not fill the bar before the tester reaches them.
function bbTotalSoFar() {
  return bbCategoriesSoFar().reduce((t, c) => t + bbValue(c), 0);
}

/** All twelve — what actually gets saved. */
function bbTotal() {
  const b = bbSession();
  return catTotal(b.values);
}

// Saves through the seam, never into state.plan directly (L6).
function bbSubmit() {
  const b = bbSession();
  const monthly = {};
  CATEGORIES.forEach(c => { monthly[c] = bbValue(c); });
  submitBudgetBaseline({
    source: "budgetBuild",
    profile: {
      zip: state.profile.zip,
      householdSize: state.profile.householdSize,
      incomeAnnual: state.profile.incomeAnnual
    },
    lifestyle: Object.assign({}, state.lifestyle),
    monthly: monthly
  });
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderBudgetBuild() {
  const b = bbSession();
  const step = bbStep();
  const pending = bbPendingHelp();

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">Step ${b.step + 1} of ${BB_STEPS.length}</p>
        <div class="journal-progress" aria-hidden="true">
          ${BB_STEPS.map((_, i) => `<span class="journal-pip ${i <= b.step ? "on" : ""}"></span>`).join("")}
        </div>
        <h1 class="title" style="font-size:21px;margin:12px 0 0;">${h(step.title)}</h1>
        <p class="helper" style="margin:6px 0 0;">${h(step.help)}</p>
      </div>

      <div class="journal-body">
        ${renderBudgetTotalBar({
          total: bbTotalSoFar(),
          income: state.monthlyIncome,
          label: "Budgeted so far"
        })}

        ${step.categories.map(c => bbRow(c, step)).join("")}

        <p class="helper" style="margin:14px 0 0;font-size:11px;">
          ${pending.length
            ? "Continue and I'll ask about " +
              (pending.length === 1
                ? h(catLabel(pending[0]).toLowerCase())
                : pending.length + " lines you asked for help with") + "."
            : "Nothing is saved until the last step."}
        </p>
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="bbBack()">Back</button>
        <button class="button" type="button" onclick="bbNext()">
          ${pending.length
            ? "Continue"
            : (b.step < BB_STEPS.length - 1 ? "Continue" : "Save budget")}
        </button>
      </div>
    </div>
  `;
}

// Keep the peer band visible while editing. Derive the axis from stable
// seed and peer figures, never the dragged value, to prevent thumb recoil.
function bbRow(category, step) {
  const b = bbSession();
  const idx = CATEGORIES.indexOf(category);
  const value = bbValue(category);
  const helping = !!b.help[category];
  const done = !!b.helped[category];
  const peer = benchPeerValue(category, benchOptsForUser());
  const catArg = h(category).replace(/'/g, "\\'");

  return `
    <div class="bb-row ${helping ? "bb-row-helping" : ""}">
      <div class="bb-row-head">
        <span class="bb-row-name">${h(catLabel(category))}</span>
        <div class="bb-help">
          <span class="bb-help-label" id="bbHelpLabel${idx}">Help me out</span>
          <button class="bb-toggle ${helping ? "on" : ""}" type="button"
                  role="switch" aria-checked="${helping ? "true" : "false"}"
                  aria-labelledby="bbHelpLabel${idx}"
                  onclick="bbToggleHelp('${catArg}')">
            <span class="bb-toggle-knob" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <p class="bb-row-amt" id="bbAmt${idx}">
        ${helping && !done ? "&nbsp;" : budgetFmt(value) + " a month"}
      </p>

      <div class="bb-row-input ${helping ? "is-disabled" : ""}">
        ${renderBudgetBandSlider({
          category: category,
          value: value,
          peer: peer,
          max: budgetSliderMax(category),
          disabled: helping,
          oninput: `bbSet('${catArg}', this.value, true)`
        })}
      </div>

      ${helping ? `
        <p class="helper" style="margin:6px 0 0;font-size:10px;">
          I'll ask a couple of questions about this when you continue.
        </p>` : (done ? `
        <p class="helper hmo-done" style="margin:6px 0 0;font-size:10px;">
          Worked out from what you told me — move it if it looks wrong.
        </p>` : "")}
    </div>
  `;
}

function renderBudgetBuildAdmin() {
  const b = state.budgetBuild;
  if (!b) {
    return `<div class="admin-card">
      <p class="admin-card-title">Budget builder</p>
      <p class="helper">Not started.</p></div>`;
  }
  const step = bbStep();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Budget builder — step ${b.step + 1}/${BB_STEPS.length}</p>
      <p class="helper" style="margin-bottom:10px;">
        <strong>${h(step.id)}</strong> · ${step.categories.length} lines ·
        so far ${budgetFmt(bbTotalSoFar())} of ${budgetFmt(state.monthlyIncome)} ·
        all twelve ${budgetFmt(bbTotal())}
      </p>
      <div class="input-group">
        <label>This step — value · help · asked</label>
        <div class="helper" style="line-height:1.8;">
          ${step.categories.map(c => `
            ${h(catLabel(c))}: <strong>${budgetFmt(bbValue(c))}</strong>
            · help ${b.help[c] ? "on" : "off"}
            · ${b.helped[c] ? "asked" : "—"}
            <em>(peer ${budgetFmt(benchPeerValue(c, benchOptsForUser()))})</em>`).join("<br>")}
        </div>
      </div>
      <div class="input-group">
        <label>Opening figures (peer model: ZIP, income, household and lifestyle)</label>
        <div class="helper">${budgetFmt(catTotal(b.opening))} across ${CATEGORIES.length}</div>
      </div>
      <div class="input-group">
        <label>Step coverage</label>
        <div class="helper">
          ${(function () {
            const covered = bbAllStepCategories();
            const missing = CATEGORIES.filter(c => covered.indexOf(c) === -1);
            const twice = covered.filter((c, i) => covered.indexOf(c) !== i);
            if (!missing.length && !twice.length) {
              return covered.length + " of " + CATEGORIES.length + " categories, each exactly once.";
            }
            return "<strong>BROKEN</strong> — " +
              (missing.length ? "never asked: " + missing.map(h).join(", ") + ". " : "") +
              (twice.length ? "asked twice: " + twice.map(h).join(", ") + "." : "");
          })()}
        </div>
      </div>
    </div>
  `;
}
