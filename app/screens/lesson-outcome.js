// ─── Lesson quiz · simulation · reward (06-education) ────────────────────────
// TAB: Education (sub-screens) | NAV BAR: Hidden
//
// The tail of a lesson: quiz → simulation → reward. 06-education biases toward
// the simulation — "a sandbox a user can push numbers through beats a
// multiple-choice question about what a rate means" — so the quiz is short and
// the simulation is the part with something to do.
//
// RETURN ROUTING: came from home, return to home; came from Education, return
// to Education. The per-stack nav already encodes that, so the reward screen
// just pops rather than guessing a destination.

// ── Quiz ─────────────────────────────────────────────────────────────────────

function lessonQuizStart() {
  const lesson = lessonV3(state.lessonFraming ? state.lessonFraming.lessonId : null)
              || lessonV3(state.currentLesson ? state.currentLesson.id : null);
  if (!lesson) { navBack(); return; }
  state.lessonQuiz = {
    lessonId: lesson.id,
    questions: lrQuizQuestions(lesson),
    index: 0,
    correct: 0,
    picked: null,
    wrong: []
  };
  go("lessonQuiz");
}

function renderLessonQuiz() {
  const q = state.lessonQuiz;
  // D19 — entered directly (admin jump, or a stale link) with no session.
  // Returning "" here rendered a genuinely blank screen.
  if (!q) return lessonOutcomeNoSession("quiz",
    "A quiz belongs to a lesson. Pick one and it'll turn up at the end.");
  const item = q.questions[q.index];
  if (!item) return `<div class="card"><p class="helper">No questions.</p></div>`;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <div class="row" style="align-items:flex-start;gap:10px;">
          <p class="helper" style="margin:0 0 4px;">Question ${q.index + 1} of ${q.questions.length}</p>
          <!-- Leaving lives top right, away from where the primary action
               lands. The skip control used to sit bottom right, which is
               exactly where Next appears once you answer. -->
          <button class="button secondary small" type="button"
                  onclick="lessonQuizExit()" title="Leave the quiz">✕ Exit</button>
        </div>
        <div class="journal-progress" aria-hidden="true">
          ${q.questions.map((_, i) => `<span class="journal-pip ${i <= q.index ? "on" : ""}"></span>`).join("")}
        </div>
        <h1 class="title" style="font-size:19px;margin:12px 0 0;">${h(item.prompt)}</h1>
      </div>

      <div class="journal-body">
        <div class="journal-options">
          ${item.options.map((opt, i) => {
            const isWrong = q.wrong.indexOf(i) !== -1;
            const isRight = q.picked === i && i === item.correct;
            return `
              <button class="journal-opt ${isRight ? "quiz-right" : ""} ${isWrong ? "quiz-wrong" : ""}"
                      type="button" ${isWrong || q.picked != null ? "disabled" : ""}
                      onclick="lessonQuizAnswer(${i})">
                <span class="journal-opt-label">${h(opt)}</span>
              </button>`;
          }).join("")}
        </div>
        ${q.picked != null ? `
          <p class="helper" style="margin-top:12px;">
            That's the one. ${LESSONS_V3.badges.xpCorrectAnswer} XP.
          </p>` : ""}
      </div>

      <div class="journal-foot">
        <span></span>
        ${q.picked != null
          ? `<button class="button" type="button" onclick="lessonQuizNext()">
               ${q.index >= q.questions.length - 1 ? "Try the calculator" : "Next"}
             </button>`
          : `<p class="helper" style="margin:0;">Pick the right one to carry on.</p>`}
      </div>
    </div>
  `;
}

// A wrong pick goes red and stays disabled; the question stays open until the
// right one is found. There is no skip — a question you can click past teaches
// nothing, and the button that did it sat where "Next" appears.
//
// Not being able to LEAVE is a different problem, and the top-right ✕ solves it:
// nav is hidden on this screen, so without an exit the tester would be trapped.
function lessonQuizAnswer(i) {
  const q = state.lessonQuiz;
  const item = q.questions[q.index];
  if (i === item.correct) { q.picked = i; q.correct++; }
  else if (q.wrong.indexOf(i) === -1) { q.wrong.push(i); }
  render();
}

function lessonQuizNext() {
  const q = state.lessonQuiz;
  // Guard, not just an absent button: this is the only advance path, and it
  // used to be reachable with nothing answered.
  if (q.picked == null) return;
  if (q.index >= q.questions.length - 1) { lessonSimStart(); return; }
  q.index++; q.picked = null; q.wrong = [];
  render();
}

/** Leave the quiz. The lesson stays done; only the quiz session is dropped. */
function lessonQuizExit() {
  state.lessonQuiz = null;
  if (typeof navGoTabRoot === "function") { navGoTabRoot("learn"); return; }
  go("learn");
}

// ── Simulation ───────────────────────────────────────────────────────────────

// ── Simulation specs and slider ranges ───────────────────────────────────────
//
// The calculator was reachable from v3's three lessons only. The other eighteen
// — the whole v2 catalog — went question, question, question, reward, and never
// got to put a number in. LESSON_SIM_V2 gives the ones a calculator genuinely
// helps a spec of their own, using the same three engines.
//
// Deliberately NOT all eighteen. "Loan vs lease" and "deductible vs premium"
// are comparisons, not arithmetic on a balance; bolting a payoff slider onto
// them would be a calculator for its own sake.
const LESSON_SIM_V2 = {
  // What a balance actually costs to clear.
  "interest-builds":         { type: "balance_calculator", defaults: { balance: 1000, apr: 24, monthlyPayment: 40 } },
  "interest-refresher":      { type: "balance_calculator", defaults: { balance: 1500, apr: 24, monthlyPayment: 60 } },
  "minimum-payments-trap":   { type: "balance_calculator", defaults: { balance: 3000, apr: 24, monthlyPayment: 75 } },
  "federal-vs-private":      { type: "balance_calculator", defaults: { balance: 8000, apr: 7,  monthlyPayment: 120 } },
  "income-driven-repayment": { type: "balance_calculator", defaults: { balance: 8000, apr: 7,  monthlyPayment: 60 } },
  // How long a target takes at a given pace.
  "three-month-rule":        { type: "savings_pace_calculator", defaults: { target: 9000, current: 620, monthlyContribution: 250 } },
  "where-to-keep-it":        { type: "savings_pace_calculator", defaults: { target: 3000, current: 620, monthlyContribution: 120 } },
  "budget-basics":           { type: "savings_pace_calculator", defaults: { target: 1000, current: 0,   monthlyContribution: 100 } },
  "why-start-now":           { type: "savings_pace_calculator", defaults: { target: 10000, current: 0,  monthlyContribution: 200 } },
  "401k-and-the-match":      { type: "savings_pace_calculator", defaults: { target: 6000, current: 0,   monthlyContribution: 250 } },
  "hidden-costs-buying":     { type: "savings_pace_calculator", defaults: { target: 10000, current: 2000, monthlyContribution: 400 } },
  "index-funds-explained":   { type: "savings_pace_calculator", defaults: { target: 10000, current: 500, monthlyContribution: 300 } },
  "risk-and-time-horizon":   { type: "savings_pace_calculator", defaults: { target: 10000, current: 1500, monthlyContribution: 200 } }
};

// Slider bounds, in ONE place. They used to be literals inside each renderer,
// which was fine until anything else set them: a value outside the range leaves the
// thumb pinned at an end while the readout shows a value it cannot reach. Now
// the renderers read these and every programmatic set clamps to them.
const LESSON_SIM_RANGES = {
  balance:             { min: 100, max: 10000, step: 100 },
  // step 0.5, not 1: the slider is seeded from the tester's own card and real
  // card rates land on halves (25.5, 23.4 rounds to 23.5, 22.5). At step 1 the
  // seed snapped to a whole number, so the calculator opened on a rate their
  // card does not charge.
  apr:                 { min: 0,   max: 36,    step: 0.5 },
  // step 5, not 10: a minimum payment is often an odd figure (2% of a balance),
  // and a 10-600 range has room for the finer grid.
  monthlyPayment:      { min: 10,  max: 600,   step: 5 },
  target:              { min: 500, max: 10000, step: 100 },
  // step 10, not 50: lessons.json ships `current: 620` as the emergency-fund
  // default, which a 50 grid cannot represent — the thumb would snap away from
  // the figure on the first touch.
  current:             { min: 0,   max: 10000, step: 10 },
  monthlyContribution: { min: 0,   max: 1000,  step: 10 }
};

/**
 * The simulation spec for ANY lesson — v3's from its data file, v2's from the
 * map above. One lookup so nothing downstream has to know which catalog a
 * lesson came from.
 */
function lessonSimSpec(lessonId) {
  const v3 = (typeof lessonV3 === "function") ? lessonV3(lessonId) : null;
  if (v3 && v3.simulation) return v3.simulation;
  return LESSON_SIM_V2[lessonId] || null;
}

/** Does this lesson have a calculator worth showing? */
function lessonSimAvailable(lessonId) {
  return !!lessonSimSpec(lessonId);
}

function lessonSimStart() {
  const lesson = lessonV3(state.lessonQuiz ? state.lessonQuiz.lessonId : null);
  if (!lesson) { navBack(); return; }
  lessonSimOpen(lesson.id, "v3");
}

/**
 * Open the calculator for a lesson from either catalog.
 *
 * `origin` decides where "Finish" goes, and it has to be carried rather than
 * inferred: the v3 reward reads lessonV3(), which knows nothing about the v2
 * catalog, so a v2 lesson arriving there falls through to home and loses its
 * badge XP.
 */
function lessonSimOpen(lessonId, origin) {
  const spec = lessonSimSpec(lessonId);
  if (!spec) return false;
  const values = lrSimDefaults({ simulation: spec });

  // Seed the rate from THEIR card. Framing already inferred it (an issuer +
  // card lookup in CARD_APR, or a rate they typed), so opening the calculator
  // on a generic 24% asks them to dial in a number the app already knows.
  //
  // This is a deliberate exception to the sandbox rule stated in lrSimDefaults
  // and lessons.json -- "never the user's real figures". It holds for the
  // BALANCE, which is the figure that would make the sandbox feel like a
  // judgement on them. A rate is not that: it is the subject of the lesson, it
  // is public information about a product, and it stays draggable.
  if (values.apr != null && typeof lessonProfileFigure === "function") {
    const rate = lessonProfileFigure(lessonId);
    if (rate != null) values.apr = lessonSimClamp("apr", rate);
  }

  state.lessonSim = {
    lessonId: lessonId,
    origin: origin || "v3",
    values: values
  };
  go("lessonSimulation");
  return true;
}

/**
 * The live range for a slider.
 *
 * Everything is static except the monthly payment, whose ceiling has to reach
 * the BALANCE. It was a flat $600 while balances go to $10,000, so "paid in
 * full" — the healthy outcome, and the thing the lesson actually teaches — was
 * unreachable for any balance above $600: the scenario clamped to 600 and the
 * box then reported two months and interest.
 *
 * Derived from the balance, never from the payment itself. A slider whose max
 * comes from its own value moves under the thumb and recoils on release; this
 * one only changes when the OTHER slider does. The floor keeps a small balance
 * from collapsing the track to nothing.
 */
const LESSON_SIM_PAYMENT_FLOOR_MAX = 600;

function lessonSimRange(key, values) {
  const r = LESSON_SIM_RANGES[key];
  if (!r) return null;
  if (key !== "monthlyPayment") return r;
  const v = values || (state.lessonSim && state.lessonSim.values) || {};
  const balance = Number(v.balance) || 0;
  return Object.assign({}, r, {
    max: Math.max(LESSON_SIM_PAYMENT_FLOOR_MAX, Math.ceil(balance / r.step) * r.step)
  });
}

/** A value held inside its slider's range and snapped to its step. */
function lessonSimClamp(key, value, values) {
  const r = lessonSimRange(key, values);
  const n = Number(value) || 0;
  if (!r) return n;
  // Round the STEP COUNT, then rebuild — and round the result to 2dp, because
  // multiplying a count back by a fractional step reintroduces float dust
  // (0.5 * 51 is exact, but not every step will be).
  const snapped = Math.round((Math.round(n / r.step) * r.step) * 100) / 100;
  return Math.max(r.min, Math.min(r.max, snapped));
}

// debouncedRender, not render: fires on every pointer move of the slider, and
// a full render replaces the element being dragged (see budgetSetPlan).
function lessonSimSet(key, value) {
  const v = state.lessonSim.values;
  v[key] = Number(value) || 0;
  // Dropping the balance shrinks the payment slider's ceiling, so a payment
  // left above the new max would sit off its own track — the thumb pins at the
  // end while the readout shows a figure it cannot reach.
  if (key === "balance") v.monthlyPayment = lessonSimClamp("monthlyPayment", v.monthlyPayment, v);
  debouncedRender();
}

function lessonSimToggle(i) {
  const rows = state.lessonSim.values.rows || [];
  if (rows[i]) rows[i].on = !rows[i].on;
  render();
}

function renderLessonSimulation() {
  const s = state.lessonSim;
  if (!s) return lessonOutcomeNoSession("calculator",
    "The calculators come with their lesson, loaded with figures to play with.");
  const spec = lessonSimSpec(s.lessonId);
  if (!spec) return lessonOutcomeNoSession("calculator",
    "The calculators come with their lesson, loaded with figures to play with.");
  const type = spec.type;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">Try it with numbers</h1>
        <p class="helper" style="margin:6px 0 0;">
          These are made-up figures to play with — not yours.
        </p>
      </div>
      <div class="journal-body">
        <!-- Sliders first. They are the thing to touch; the scenarios below are
             shortcuts INTO them, so they read as "or start from one of these"
             rather than as a menu you pick before the calculator appears. -->
        ${type === "balance_calculator"      ? renderSimBalance(s)   : ""}
        ${type === "savings_pace_calculator" ? renderSimSavings(s)   : ""}
        ${type === "subscription_tally"      ? renderSimSubs(s)      : ""}
        ${renderSimScenarios(s, spec)}
      </div>
      <div class="journal-foot">
        <span></span>
        <!-- Where "Finish" goes depends on which catalog the lesson came from:
             the v3 reward reads lessonV3(), which has never heard of a v2
             lesson and would drop it on home without its badge XP. -->
        <button class="button" type="button"
                onclick="${s.origin === "v2" ? "completeLesson()" : "lessonRewardStart()"}">
          Finish lesson
        </button>
      </div>
    </div>
  `;
}

/**
 * The shortcuts. A calculator that opens on one arbitrary set of numbers asks
 * the reader to invent a situation before they can learn anything; these are
 * the situations people actually turn up with, one tap away.
 *
 * Each is a case, never an instruction (D26) — "Minimum payments only" is a
 * thing that happens to people, not advice about what to do.
 */

// Bounds come from LESSON_SIM_RANGES, not from the call site — scenarios clamp
// against the same table, so a shortcut can never land outside its own slider.
function simSlider(label, key, value, fmt) {
  const r = lessonSimRange(key) || { min: 0, max: 1000, step: 1 };
  return `
    <div class="card sim-row">
      <div class="row" style="align-items:baseline;margin-bottom:6px;">
        <span class="budget-row-name">${h(label)}</span>
        <span class="budget-row-amt">${fmt ? fmt(value) : value}</span>
      </div>
      <input class="journal-slider" type="range" min="${r.min}" max="${r.max}" step="${r.step}"
             value="${value}" oninput="lessonSimSet('${key}', this.value)"
             aria-label="${h(label)}">
    </div>`;
}

// ── Three scenarios, from ordinary arithmetic ────────────────────────────────
// A calculator that opens on one set of numbers gives you nothing to judge them
// against. These three run the SAME engine the sliders drive, so a box can
// never disagree with the calculator below it.
//
// The labels describe the ARITHMETIC, not a choice. "About the minimum payment"
// is a fact about a ratio; "you should pay more than the minimum" would be
// advice (D26). Each box names its own ratio and lets the computed outcome
// speak. Nothing is marked as the one to pick.
//
// Ratios are the common ones, not invented: card minimums are typically around
// 2% of the balance, and emergency-fund targets are usually talked about in
// months of outgoings.
// Ordered HEALTHY, COMMON, BAD -- left to right. Reading order carries meaning:
// the first box is where the arithmetic is kindest, and the eye travels toward
// the one that costs most. The reverse order read as a warning first.
//
// APR IS NEVER IN A SCENARIO. It is the one figure the tester supplied, so it
// stays wherever they left it and all three outcomes are computed against it.
// That is what makes the boxes comparable: one variable moves, not two.
const LESSON_SIM_SCENARIOS = {
  balance_calculator: {
    _note: "The three things people actually do with a card balance, not three arbitrary fractions. Healthy is clearing the statement in full, which on most cards costs nothing at all — that is the lesson's own point, not a target we invented. Bad is the published minimum: interest plus about 1% of principal, floored near $25, which is how issuers actually compute it. Balance and APR stay put; only the payment moves.",
    rows: [
      { tone: "healthy", label: "Healthy outcome", detail: "Paid in full",   kind: "in_full" },
      { tone: "common",  label: "Common case",     detail: "A fifth a month", kind: "share", share: 0.20 },
      { tone: "bad",     label: "Bad outcome",     detail: "Minimum only",   kind: "minimum" }
    ]
  },
  savings_pace_calculator: {
    _note: "Target as a multiple of monthly outgoings, the usual way emergency funds are described. Current savings and contribution stay; only the target varies.",
    rows: [
      { tone: "healthy", label: "Healthy outcome", detail: "3 months' cover", months: 3 },
      { tone: "common",  label: "Common case",     detail: "1 month's cover", months: 1 },
      { tone: "bad",     label: "Bad outcome",     detail: "Half a month",    months: 0.5 }
    ]
  },
  subscription_tally: {
    _note: "The three states the rows can be in. No ratio involved — the arithmetic is a sum.",
    rows: [
      { tone: "healthy", label: "Healthy outcome", detail: "All off",     rows: "none" },
      { tone: "common",  label: "Common case",     detail: "Unused off",  rows: "used" },
      { tone: "bad",     label: "Bad outcome",     detail: "All running", rows: "all" }
    ]
  }
};

/** Monthly outgoings, for the savings scenarios. Falls back to the peer plan. */
function lessonSimMonthlyOutgoings() {
  const total = (typeof catTotal === "function" && state.plan) ? catTotal(state.plan) : 0;
  return total > 0 ? total : 3000;
}

/**
 * The monthly payment a balance scenario describes.
 *
 *   in_full  the whole statement. On most cards that costs nothing at all --
 *            the grace period -- which is exactly what the lesson teaches, so
 *            the calculator has to agree with it (see lrSimBalance).
 *   share    a flat fraction of the balance. A fifth clears a card in about
 *            five months, which is what "paying it down" usually looks like.
 *   minimum  how issuers actually compute it: the month's interest plus about
 *            1% of principal, floored near $25. NOT a flat 2% -- that ignores
 *            the rate, and on a high-rate card it produces a payment that never
 *            clears anything, which is a different (and wrong) lesson.
 */
const LESSON_SIM_MIN_PAYMENT_FLOOR = 25;
const LESSON_SIM_MIN_PRINCIPAL_SHARE = 0.01;

function lessonSimPaymentFor(row, values) {
  const balance = Number(values.balance) || 0;
  if (row.kind === "in_full") return balance;
  if (row.kind === "minimum") {
    const monthlyInterest = balance * ((Number(values.apr) || 0) / 100 / 12);
    return Math.max(LESSON_SIM_MIN_PAYMENT_FLOOR,
                    Math.round(monthlyInterest + balance * LESSON_SIM_MIN_PRINCIPAL_SHARE));
  }
  return Math.max(10, Math.round(balance * (row.share || 0.1)));
}

/**
 * The VALUES a scenario implies, given where the sliders currently sit.
 *
 * Split out from the outcome so a scenario can be applied as well as displayed
 * -- the box shows what these figures produce, and clicking it moves the
 * sliders to exactly them. One source, so a box can never advertise an outcome
 * the sliders then fail to reproduce.
 *
 * Everything not named by the scenario is carried through untouched. For the
 * balance calculator that includes APR, deliberately: it is the tester's own
 * rate and all three outcomes are computed against it.
 */
function lessonSimScenarioValues(type, row, values) {
  if (type === "balance_calculator") {
    return Object.assign({}, values, {
      monthlyPayment: lessonSimClamp("monthlyPayment", lessonSimPaymentFor(row, values), values)
    });
  }
  if (type === "savings_pace_calculator") {
    return Object.assign({}, values, {
      target: lessonSimClamp("target", Math.round(lessonSimMonthlyOutgoings() * row.months))
    });
  }
  if (type === "subscription_tally") {
    return Object.assign({}, values, {
      rows: (values.rows || []).map(r => Object.assign({}, r, {
        on: row.rows === "all" ? true
          : row.rows === "none" ? false
          : r.status !== "flagged_unused"
      }))
    });
  }
  return Object.assign({}, values);
}

/** Run one scenario through the same engine the sliders drive. */
function lessonSimScenarioOutcome(type, row, values) {
  const v = lessonSimScenarioValues(type, row, values);
  if (type === "balance_calculator") {
    const out = lrSimBalance(v);
    if (out.monthsToPayoff == null) {
      return { headline: "Never", sub: "the interest outruns the payment" };
    }
    return {
      headline: out.monthsToPayoff + " mo",
      sub: budgetFmt(out.totalInterest) + " of interest",
      figure: budgetFmt(v.monthlyPayment) + " a month"
    };
  }
  if (type === "savings_pace_calculator") {
    const out = lrSimSavings(v);
    if (out.monthsToTarget == null) return { headline: "Never", sub: "nothing going in" };
    if (out.monthsToTarget === 0) return { headline: "Already there", sub: "", figure: budgetFmt(v.target) };
    return {
      headline: out.monthsToTarget + " mo",
      sub: "to reach it",
      figure: budgetFmt(v.target) + " target"
    };
  }
  if (type === "subscription_tally") {
    const out = lrSimSubscriptions(v.rows);
    return {
      headline: budgetFmt(out.monthlyTotal),
      sub: "a month",
      figure: budgetFmt(out.annualTotal) + " a year"
    };
  }
  return null;
}

/**
 * Move the sliders to a scenario.
 *
 * render(), not debouncedRender(): every slider on screen has to jump to its
 * new position at once. The debounce exists for the opposite case -- a drag
 * that must not destroy the element under the pointer.
 */
function lessonSimApplyScenario(i) {
  const s = state.lessonSim;
  if (!s) return;
  const spec = lessonSimSpec(s.lessonId);
  const set = spec && LESSON_SIM_SCENARIOS[spec.type];
  const row = set && set.rows[i];
  if (!row) return;
  s.values = lessonSimScenarioValues(spec.type, row, s.values);
  render();
}

function renderSimScenarios(s, spec) {
  const set = LESSON_SIM_SCENARIOS[spec.type];
  if (!set) return "";
  return `
    <div class="section-title" style="margin:18px 0 4px;">Three ways it can go</div>
    <p class="helper" style="margin:0 0 8px;font-size:11px;">
      Tap one to move the sliders there. Your rate stays where you left it, so
      all three are worked out against it.
    </p>
    <div class="sim-scenarios">
      ${set.rows.map((row, i) => {
        const out = lessonSimScenarioOutcome(spec.type, row, s.values);
        if (!out) return "";
        // A button, not a card: it sets the sliders, so it has to be reachable
        // by keyboard and announce itself as something you can press.
        return `
          <button class="card sim-out sim-scenario sim-scenario-${h(row.tone)}" type="button"
                  onclick="lessonSimApplyScenario(${i})">
            <span class="sim-scenario-tone">${h(row.label)}</span>
            <span class="sim-scenario-head">${h(out.headline)}</span>
            ${out.sub ? `<span class="sim-scenario-sub">${h(out.sub)}</span>` : ""}
            <span class="sim-scenario-sub">${h(row.detail)}</span>
          </button>`;
      }).join("")}
    </div>
    <p class="helper" style="margin:8px 0 14px;font-size:11px;">
      Labelled by the arithmetic, not by what anyone ought to do.
    </p>`;
}

function renderSimBalance(s) {
  const v = s.values;
  const out = lrSimBalance(v);
  return `
    ${simSlider("Balance", "balance", v.balance, budgetFmt)}
    ${simSlider("APR", "apr", v.apr, x => x + "%")}
    ${simSlider("Monthly payment", "monthlyPayment", v.monthlyPayment, budgetFmt)}
    <div class="card sim-out">
      ${out.monthsToPayoff == null ? `
        <p class="du-figure du-figure-sm">Never</p>
        <p class="helper" style="margin:4px 0 0;">
          At that payment the interest grows faster than the balance falls.
        </p>
      ` : `
        <p class="du-figure du-figure-sm">${out.monthsToPayoff} months</p>
        <p class="helper" style="margin:4px 0 0;">
          and ${budgetFmt(out.totalInterest)} of interest along the way.
        </p>`}
    </div>`;
}

function renderSimSavings(s) {
  const v = s.values;
  const out = lrSimSavings(v);
  return `
    ${simSlider("Target", "target", v.target, budgetFmt)}
    ${simSlider("Saved so far", "current", v.current, budgetFmt)}
    ${simSlider("Each month", "monthlyContribution", v.monthlyContribution, budgetFmt)}
    <div class="card sim-out">
      ${out.monthsToTarget == null ? `
        <p class="du-figure du-figure-sm">—</p>
        <p class="helper" style="margin:4px 0 0;">Nothing going in means nothing arrives.</p>
      ` : `
        <p class="du-figure du-figure-sm">${out.monthsToTarget} months</p>
        <p class="helper" style="margin:4px 0 0;">getting there around ${h(out.targetDate)}.</p>`}
    </div>`;
}

function renderSimSubs(s) {
  const rows = s.values.rows || [];
  const out = lrSimSubscriptions(rows);
  return `
    <p class="helper" style="margin:0 0 10px;">Switch things off and watch the total move.</p>
    ${rows.map((r, i) => `
      <div class="row sim-sub-row">
        <label class="share-toggle" style="flex:1;">
          <input type="checkbox" ${r.on ? "checked" : ""} onchange="lessonSimToggle(${i})">
          <span><strong>${h(r.name)}</strong></span>
        </label>
        <span class="helper">${budgetFmt(r.monthly)}/mo</span>
      </div>`).join("")}
    <div class="card sim-out">
      <p class="du-figure du-figure-sm">${budgetFmt(out.annualTotal)}</p>
      <p class="helper" style="margin:4px 0 0;">a year, at ${budgetFmt(out.monthlyTotal)} a month.</p>
      ${out.savingsIfCancelled > 0 ? `
        <p class="helper" style="margin:8px 0 0;">
          The ones you switched off came to ${budgetFmt(out.savingsIfCancelled)} a year.
        </p>` : ""}
    </div>`;
}

// ── Reward ───────────────────────────────────────────────────────────────────

function lessonRewardStart() {
  const lesson = lessonV3(state.lessonSim ? state.lessonSim.lessonId : null);
  if (!lesson) { navGoHome(); return; }
  const correct = state.lessonQuiz ? state.lessonQuiz.correct : 0;
  // Gates both the XP bonus and the task's own Charity Points line. Asked of
  // the task list rather than a hardcoded id, so a second lesson-routed daily
  // task works without a code change (js/lessons-v3.js lessonIsActiveTask).
  const fromTask = lessonIsActiveTask(lesson.id);

  // v3 progression still accrues — course XP and Charity Points are v3's own
  // ledgers and nothing else writes them.
  // Open the Charity Points ledger BEFORE anything credits, so both the
  // lesson's own bones and the daily task's are itemised on the reward screen
  // instead of landing silently in state.kibble.
  lrPointsReset();

  const award = lrComputeAward(lesson, correct, fromTask);
  state.lessonReward = {
    lessonId: lesson.id,
    award: award,
    gains: lrApplyAward(lesson, award),
    kibble: lrAwardKibble(award)
  };
  if (fromTask) homeCompleteTask(state.activeTaskId);

  // …but the screen the user lands on is the shared reward screen, not a v3-only
  // one (owner's call). completeLesson() reads state.currentLesson — which every
  // lesson now has, v3 included, since they share one catalog — applies badge XP,
  // writes the reward display state and navigates there itself.
  if (state.currentLesson) { completeLesson(); return; }
  go("lessonReward");   // reached only by an admin jump with no lesson selected
}

function renderLessonReward() {
  const r = state.lessonReward;
  if (!r) return lessonOutcomeNoSession("reward",
    "Finish a lesson and this is where the XP lands.");
  const lesson = lessonV3(r.lessonId);

  return `
    <div class="journal-shell">
      <div class="journal-head" style="text-align:center;">
        <h1 class="title" style="font-size:22px;margin:0;">${h(lesson.title)}</h1>
        <p class="helper" style="margin:6px 0 0;">Done.</p>
      </div>

      <div class="journal-body">
        <div class="card" style="text-align:center;">
          <p class="du-figure">${r.award.total} XP</p>
          <p class="helper" style="margin:4px 0 0;">
            ${r.award.correctCount} right · ${LESSONS_V3.badges.xpLessonComplete} for finishing
            ${r.award.bonus ? " · " + r.award.bonus + " daily-task bonus" : ""}
          </p>
          <p class="helper" style="margin:8px 0 0;">🦴 ${r.kibble} bones</p>
        </div>

        <div class="section-title" style="margin:18px 0 8px;">Courses this moved</div>
        ${r.gains.map(g => `
          <div class="card reward-course">
            <div class="row" style="align-items:baseline;margin-bottom:4px;">
              <span class="budget-row-name">${h(String(g.course).replace(/-/g, " "))}</span>
              <span class="pill" style="font-size:9px;padding:2px 8px;">
                ${h(g.rankAfter.tier)} ${g.rankAfter.level}
              </span>
            </div>
            <div class="goal-bar" aria-hidden="true"><span style="width:${g.rankAfter.pct}%"></span></div>
            ${g.leveledUp ? `<p class="helper" style="margin:6px 0 0;">Levelled up.</p>` : ""}
          </div>`).join("")}

        <p class="helper" style="margin:12px 0 0;font-size:11px;">
          Badges are for show — they don't unlock anything.
        </p>

        ${renderGoalSuggestions({ source: "lesson" })}
      </div>

      <div class="journal-foot">
        <span></span>
        <button class="button" type="button" onclick="lessonReturnFromLesson()">Done</button>
      </div>
    </div>
  `;
}

/**
 * "Came from home, return to home; came from Education, return to Education."
 * The per-stack nav already knows which — the lesson was pushed onto whichever
 * stack launched it — so this pops rather than guessing.
 */
function lessonReturnFromLesson() {
  state.lessonFraming = null;
  state.lessonQuiz = null;
  state.lessonSim = null;
  state.lessonVariantScript = null;
  state.activeTaskId = null;
  if (state.nav.activeStack === "home") { navGoHome(); return; }
  state.nav.stacks[state.nav.activeStack] = [state.nav.stacks[state.nav.activeStack][0]];
  navCommit(state.nav.stacks[state.nav.activeStack][0]);
}

function renderLessonOutcomeAdmin() {
  const q = state.lessonQuiz, r = state.lessonReward;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Lesson outcome</p>
      <div class="input-group">
        <label>Quiz</label>
        <div class="helper">
          ${q ? `${q.questions.length} questions (${q.questions.filter(x => x.source === "lesson").length} from lessons.json, rest from v2's pool) · ${q.correct} right` : "not started"}
        </div>
      </div>
      <div class="input-group">
        <label>Questions required (v2 knob, L9)</label>
        <input type="number" min="1" max="10" value="${(state.xpConfig && state.xpConfig.quizQuestionsRequired) || 3}"
               onchange="state.xpConfig.quizQuestionsRequired=parseInt(this.value,10)||3;render()">
      </div>
      <div class="input-group">
        <label>Daily-task bonus multiplier (v2 knob, L9)</label>
        <input type="number" min="1" max="10" step="0.5" value="${(state.xpConfig && state.xpConfig.bonusMultiplier) || 1}"
               onchange="state.xpConfig.bonusMultiplier=parseFloat(this.value)||1;render()">
      </div>
      <div class="input-group">
        <label>Course XP — progress is on the LESSON, so cross-cutting ones move several</label>
        <div class="helper" style="line-height:1.7;">
          ${Object.keys(state.courseXp || {}).length
            ? Object.keys(state.courseXp).map(c => {
                const rk = lrRank(state.courseXp[c]);
                return `${h(c)}: ${state.courseXp[c]} XP → ${h(rk.tier)} ${rk.level}`;
              }).join("<br>")
            : "none yet"}
        </div>
      </div>
      ${r ? `<div class="input-group"><label>Last award</label>
        <div class="helper">${r.award.base} base + ${r.award.bonus} bonus = ${r.award.total} · ${r.kibble} bones</div></div>` : ""}
    </div>
  `;
}


// D19 — a screen reached without its session still says something useful and
// offers a way onward, rather than rendering blank or a bare "nothing here".
function lessonOutcomeNoSession(what, line) {
  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">No ${h(what)} open</h1>
        <p class="helper" style="margin:6px 0 0;">${h(line)}</p>
      </div>
      <div class="journal-body">
        <div class="card">
          <p class="task-title" style="margin:0 0 8px;">Lessons</p>
          ${(LESSONS_V3.lessons || []).map(l => `
            <button class="button secondary full" style="margin-bottom:6px;" type="button"
                    onclick="lessonV3Start('${h(l.id)}')">${h(l.title)}</button>`).join("")}
        </div>
      </div>
      <div class="journal-foot">
        <span></span>
        <button class="button" type="button" onclick="navGoTab('learn')">Browse lessons</button>
      </div>
    </div>
  `;
}
