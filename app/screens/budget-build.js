// ─── Budget builder — three steps, and a Help me out toggle per line ─────────
// TAB: Budget (sub-screen) | NAV BAR: Hidden — full-bleed
//
// Replaces v3.1's single twelve-slider `spendingProfile` screen, and with it
// the six lifestyle questions and the "Which is closer?" reconciliation that
// followed. Those asked everyone the same six questions whether or not they
// needed them; this asks nothing unless the tester says they cannot estimate a
// line, and then asks only about that line.
//
// ── ONE SCREEN, THREE STEPS ──────────────────────────────────────────────────
// The step index lives on state.budgetBuild rather than in three screen ids.
// A screen here costs five wiring points (render.js x4, utils.js, state.js) and
// each one is a place to forget; three steps of one screen cost them once.
//
// ── EVERY LINE IS A SLIDER ───────────────────────────────────────────────────
// The steps group categories by how well a tester knows them, NOT by how the
// figure is entered. That distinction was misread once and built as a number
// field on step 1; it is not one. Rent is a figure you can state, which is why
// it opens on a good default and needs less dragging — not why it would need a
// keyboard.
//
// The thumb opens on the PEER figure for this profile, so it starts dead centre
// of the band drawn behind it and any move away from it is deliberate.

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

// The three steps must partition the taxonomy exactly — no category asked
// twice, none skipped. A skipped one would save at whatever the peer model
// opened it on, silently, and nothing on screen would ever have mentioned it.
// scripts/sweep.js asserts this; the function is here so both read the same
// definition.
function bbAllStepCategories() {
  return BB_STEPS.reduce((all, s) => all.concat(s.categories), []);
}

/**
 * Opening figures — the peer figure for THIS profile, category by category.
 *
 * benchOptsForUser() is the same set of options the band behind the thumb is
 * drawn with, and that identity is the point: the slider opens exactly on the
 * peer median, so the tester starts where people like them sit and every drag
 * away from it is a deliberate statement.
 *
 * It used to open on benchAllPeerValues({lifestyle: {}}) — the no-lifestyle
 * national figure — which left the thumb a little off the band it was being
 * compared against, for no reason a tester could see. Owner's call; it
 * supersedes "the start of the slider is unchanged logic" from the original
 * brief.
 */
function bbOpeningValues() {
  return benchAllPeerValues(benchOptsForUser());
}

/**
 * The session, with no navigation.
 *
 * Split out of bbStart() so a deep link (js/screen-url.js) can open the builder
 * at boot. go() at that point would render before navigation.js has seeded its
 * first history entry, and push a stack entry the link then has to overwrite.
 * Copying the six lines instead would leave two ideas of what a fresh builder
 * session is, and they would drift the first time one gains a field.
 */
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

/**
 * "Help me out" — this is a line I cannot estimate, ask me about it instead.
 *
 * Toggling ON disables the row's own input, because the two are alternatives:
 * a slider you have abandoned and a set of questions you have not answered yet
 * would leave the row showing a figure that means nothing. Toggling OFF hands
 * the line back and discards any answer the tree had reached — it was an answer
 * to a question the tester has just withdrawn.
 */
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

/**
 * Continue.
 *
 * Any line on this step still waiting on its questions goes first — that is
 * the whole contract of the toggle, and advancing past it would leave the line
 * sitting on a peer figure the tester explicitly said they could not vouch for.
 */
function bbNext() {
  const pending = bbPendingHelp();
  if (pending.length) { bbRunHelp(pending[0]); return; }
  bbAdvanceStep();
}

/**
 * Move on — the next step, or save if this was the last.
 *
 * Split out because the Help-me-out queue calls it too. Handing three lines
 * over used to walk you through one and drop you back on the step with the
 * toggle still lit, so Continue had to be pressed again for a question that had
 * already been answered. The queue now runs to the end and lands here.
 */
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
 * Hand one line to the estimator, in BUDGET mode.
 *
 * The estimator already asks about habits rather than dollars across all
 * twelve categories, which is the same job — the only difference is where the
 * answer lands. So it takes a target rather than being duplicated
 * (screens/spend-estimator.js); "mtd" writes what you have spent, "budget"
 * writes what you are planning.
 */
function bbRunHelp(category) {
  if (!isCategory(category)) return;
  hmoStart(category, { target: "budget" });
}

/**
 * The tree calls this back with the figure it reached.
 *
 * The toggle switches OFF. It stayed on before, leaving the row greyed with its
 * figure hidden — so a line the tester had just answered four questions about
 * looked exactly like one they had not started, and its own slider was still
 * disabled. Handing it back is what "done" should look like: the figure is
 * there, and it is theirs to move.
 */
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

/**
 * The running total the header bar shows — REVIEWED categories only.
 *
 * Not all twelve. "Budgeted so far" has to mean what it says, and a bar that
 * opens near full because ten unseen categories are already counted has nothing
 * left to show as the tester works. This one fills: roughly half after step 1,
 * most of the way after step 2, and over the line at the end if that is where
 * their answers land.
 */
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

/**
 * One line: its figure, its input, and the toggle that hands it over.
 *
 * The peer band behind the input is drawn with the tester's REAL options, so
 * what they are setting their figure against is on screen while they set it.
 * Its axis is budgetSliderMax(), which is derived from the seeded plan and the
 * peer figure and never from the value being dragged — a ceiling that moved
 * with the value would make the thumb recoil on release.
 */
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
        <label>Opening figures (ZIP-adjusted, no lifestyle)</label>
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
