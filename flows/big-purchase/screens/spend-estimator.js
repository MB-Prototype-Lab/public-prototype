// ─── Spend estimator (behavioral, extends the Money Journal) ─────────────────
// TAB: Budget (sub-screen) | NAV BAR: Hidden (full-bleed)
//
// Full-bleed like every other `.journal-shell` flow: the shell supplies its own
// padding and its `.journal-foot` owns the bottom edge, which a tab bar would
// collide with. That means `journal-mode` in render.js, and staying OUT of
// NAV_VISIBLE_SCREENS — the two go together for this markup.
//
// "Basically the Money Journal itself." It never asks a dollar figure — people
// remember their HABITS (how often, what type: specialty café vs donut shop),
// not their totals. Each option carries a full-rate monthly estimate; we scale
// by how far into the month we are (except bills already incurred, `fullMonth`)
// to triangulate month-to-date, and write it into the "What you told me" layer
// (state.mtd). Same day-clock cooldown as the journal, so nothing is re-asked.

function estimatorConfig() {
  return (typeof ESTIMATOR_QUESTIONS !== "undefined" && ESTIMATOR_QUESTIONS.config) || {};
}

function estimatorQuestionsFor(category) {
  const cats = (typeof ESTIMATOR_QUESTIONS !== "undefined" && ESTIMATOR_QUESTIONS.categories) || {};
  return cats[category] || [];
}

// A category has estimator coverage if the bank defines any questions for it.
function estimatorHasQuestions(category) {
  return estimatorQuestionsFor(category).length > 0;
}

function estimatorOnCooldown(qid) {
  const asked = state.estimatorAsked[qid];
  if (asked == null) return false;
  const cd = estimatorConfig().cooldownDays || 1;
  return (journalDayIndex() - asked) < cd;
}

// How far into the month we are — the fraction of a full month's spend that
// would have landed by now. Floored so an estimate on day 1 isn't ~zero.
function estimatorMonthFraction() {
  const d = new Date();
  const day = d.getDate();
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(0.05, Math.min(1, day / days));
}

// ─── What the app already knows ──────────────────────────────────────────────
// The estimator asks about HABITS because people don't remember totals. But for
// some categories the app is not guessing at all — it already holds the answer,
// and asking anyway is the app failing to listen.
//
// Subscriptions is the case that made this obvious. It asked "Just one or two /
// A handful / Quite a few" and scored 55, while state.subs held four named
// services adding to $60.46 and, if the tester had answered the setup question,
// state.journalProfile.streaming named the ones they said they pay for. Two
// exact sources, ignored, in favour of a three-way guess.
//
// So: where the app knows, it says so and offers the figure. Where it doesn't,
// it asks. This is a SEAM — estimatorKnown() is the only place that decides
// whether a category has a known figure, and adding another category is one
// branch here rather than a change to the flow.

/**
 * What we already hold for a category, or null to fall through to the questions.
 * Returns { amount, items, exactCount, estimatedCount, basis }.
 */
function estimatorKnown(category) {
  if (category === "Subscriptions") return estimatorKnownSubscriptions();
  return null;
}

/**
 * Named subscriptions and their real monthly prices.
 *
 * Two sources, deliberately merged rather than one preferred:
 *   state.subs                       — has the PRICE, seeded from the persona
 *   state.journalProfile.streaming   — has what the USER said they pay for
 *
 * Anything in both is exact. Anything the user named that we have no price for
 * is counted at the average of the ones we do know, and the copy says so — a
 * service we cannot price is still a service they are paying for, and silently
 * dropping it would under-report.
 */
function estimatorKnownSubscriptions() {
  const known = (state.subs || []).filter(s => s && s.name);
  const named = (typeof journalProfileSignals === "function")
    ? journalProfileSignals("streaming").filter(Boolean)
    : [];
  if (!known.length && !named.length) return null;

  const priced = {};
  known.forEach(s => { priced[s.name] = Number(s.monthly) || 0; });

  // If they told us which ones they have, that list governs — they may have
  // cancelled something the persona still lists, or added something it doesn't.
  const names = named.length ? named.slice() : known.map(s => s.name);

  const withPrice = names.filter(n => priced[n] != null);
  const average = withPrice.length
    ? withPrice.reduce((t, n) => t + priced[n], 0) / withPrice.length
    : 0;

  const items = names.map(n => ({
    name: n,
    monthly: priced[n] != null ? priced[n] : Math.round(average * 100) / 100,
    exact: priced[n] != null
  }));
  if (!items.length) return null;

  const amount = items.reduce((t, i) => t + i.monthly, 0);
  const estimatedCount = items.filter(i => !i.exact).length;
  return {
    amount: Math.round(amount * 100) / 100,
    items: items,
    exactCount: items.length - estimatedCount,
    estimatedCount: estimatedCount,
    // Subscriptions bill monthly whatever the date, so no month-fraction here —
    // the same reason est_sub_count carries fullMonth.
    fullMonth: true,
    basis: named.length ? "you told me" : "your account"
  };
}

// ─── Two destinations, one set of questions ──────────────────────────────────
// "How often do you get coffee" answers the same thing whether the figure is
// going to be what you SPENT or what you are PLANNING to spend. So the flow
// takes a target rather than being duplicated:
//
//   "mtd"     the default — writes state.mtd, the "what you told me" layer
//   "budget"  writes back into the budget builder's line (bbApplyHelp)
//
// Two behaviours differ, and both deliberately:
//   · the day-clock cooldown does not apply in budget mode. It exists so the
//     journal does not re-ask about today; letting it latch here would mean
//     setting a budget silently blocks the tester from estimating that
//     category's actuals for the rest of the session.
//   · cancelling in budget mode hands the line back — it turns the "Help me
//     out" toggle off. Otherwise Continue re-opens the same questions they
//     just backed out of, forever.
function estimatorStart(category, opts) {
  if (!isCategory(category)) return;
  const target = (opts && opts.target) || "mtd";
  const all = estimatorQuestionsFor(category);
  let qs = target === "budget" ? all.slice() : all.filter(q => !estimatorOnCooldown(q.id));
  // The day clock is seeded and never advances within a session (journalDayIndex
  // is SEED_STATE.journalHistory.length + 1; D03 wipes on refresh), so the
  // config's cooldownDays:1 latches PERMANENTLY the moment a question is
  // answered — `(day - day) < 1` is always true. Without this fallback the
  // category's primary CTA leads to a dead-end "I'll ask again tomorrow" screen
  // for the rest of the session, and a mis-tapped answer can never be corrected
  // (the estimator is the only way to touch actuals — nothing takes a dollar
  // figure). Partial cooldowns still apply; only a fully-latched set reopens.
  if (!qs.length) qs = all;
  const known = estimatorKnown(category);
  state.estimator = { category: category, questions: qs, qIndex: 0, answers: {},
                      adjusted: null, confirmed: false,
                      target: target,
                      // "known" → show what we hold first; "ask" → the questions.
                      stage: known ? "known" : "ask",
                      known: known, usedKnown: false };
  go("spendEstimator");
}

/** Take the figure we already hold and go straight to the confirmation. */
function estimatorUseKnown() {
  const e = state.estimator;
  if (!e || !e.known) return;
  e.stage = "ask";
  e.qIndex = e.questions.length;   // land on the result step
  e.adjusted = Math.round(e.known.amount);
  e.usedKnown = true;
  e.confirmed = false;             // the tick is still theirs to give
  render();
}

/** "That's not right" — fall through to the habit questions after all. */
function estimatorAskInstead() {
  const e = state.estimator;
  if (!e) return;
  e.stage = "ask";
  e.qIndex = 0;
  e.adjusted = null;
  e.usedKnown = false;
  e.confirmed = false;
  render();
}

function estimatorSetAnswer(qid, optIndex) {
  const e = state.estimator;
  if (!e) return;
  e.answers[qid] = optIndex;
  // A different answer means a different estimate, so any correction the user
  // typed and any tick they gave are about a figure that no longer exists.
  e.adjusted = null;
  e.confirmed = false;
  render();
}

// An unanswered question contributes nothing to the sum, so skipping through
// would quietly under-report — answer-or-stay keeps the estimate honest and
// guarantees the result step is reached with every question answered.
function estimatorAnswered(q) {
  return !!(q && state.estimator && state.estimator.answers[q.id] != null);
}

function estimatorNext() {
  const e = state.estimator;
  if (!e || e.qIndex >= e.questions.length) return;
  if (!estimatorAnswered(e.questions[e.qIndex])) return;
  e.qIndex++;
  render();
}

function estimatorPrev() {
  const e = state.estimator;
  if (e && e.qIndex > 0) { e.qIndex--; render(); }
}

// Σ(option.monthly × month-fraction), fullMonth options counted in full.
// Rounded on the same grid as the peer column (PEER_BENCHMARKS.method.roundTo) —
// these two sit side by side in every cmpRow, so a different step would show up
// as a permanent small gap that traces back to nothing on screen.
function estimatorCompute() {
  const e = state.estimator;
  if (!e) return 0;
  const frac = estimatorMonthFraction();
  let sum = 0;
  e.questions.forEach(q => {
    const i = e.answers[q.id];
    if (i == null) return;
    const opt = q.options[i];
    if (!opt) return;
    const m = Number(opt.monthly) || 0;
    sum += q.fullMonth ? m : m * frac;
  });
  const step = (typeof PEER_BENCHMARKS !== "undefined" &&
                PEER_BENCHMARKS.method && PEER_BENCHMARKS.method.roundTo) || 5;
  return Math.round(sum / step) * step;
}

/** The figure that will actually be written: the user's correction, or ours. */
function estimatorFinalValue() {
  const e = state.estimator;
  if (!e) return 0;
  return (e.adjusted == null) ? estimatorCompute() : e.adjusted;
}

// Editing the number is itself a change of mind, so it clears the confirmation
// — you cannot tick the box, then alter the figure, and have the old tick stand.
function estimatorSetAdjusted(value) {
  const e = state.estimator;
  if (!e) return;
  const n = Math.max(0, Math.round(Number(value) || 0));
  e.adjusted = n;
  e.confirmed = false;
  // The provenance line claims the figure IS the sum of their subscriptions, so
  // it tracks the value rather than the gesture: change it and the claim drops,
  // type it back and the claim is true again.
  if (e.known) e.usedKnown = (n === Math.round(e.known.amount));
  render();
}

function estimatorToggleConfirm() {
  const e = state.estimator;
  if (!e) return;
  e.confirmed = !e.confirmed;
  render();
}

function estimatorSubmit() {
  const e = state.estimator;
  if (!e) return;
  // Belt and braces: the button is disabled until confirmed, but nothing may
  // write this layer without an explicit affirmative.
  if (!e.confirmed) return;
  // Nothing answered → say nothing. Writing the 0 the sum would produce reads
  // as "you spent nothing here" and would overwrite a real self-reported figure.
  //
  // Taking the already-known figure answers no questions, so it has to be
  // exempt — otherwise the whole known path silently discards and the category
  // keeps whatever it had. Same for a figure the user typed in themselves.
  const answeredSomething = e.questions.some(q => e.answers[q.id] != null);
  if (!answeredSomething && e.adjusted == null) { estimatorDiscard(); return; }
  const est = estimatorFinalValue();   // the user's correction, if they made one

  if (e.target === "budget") {
    // A budget line, not a spend figure. Nothing is committed to state.plan
    // here either — the builder holds it until its own save goes through the
    // baseline seam (L6).
    if (typeof bbApplyHelp === "function") bbApplyHelp(e.category, est);
    state.estimator = null;
    navBack();   // back to the builder step that sent us
    return;
  }

  // Writes the "What you told me" layer for this category (L17). Spend-limit
  // goals track state.mtd live, so any goal on this category moves as a result.
  if (isCategory(e.category)) state.mtd[e.category] = est;
  // Day-clock cooldown, shared idea with the journal — don't re-ask today.
  e.questions.forEach(q => { if (e.answers[q.id] != null) state.estimatorAsked[q.id] = journalDayIndex(); });
  observationsRecompute();
  state.estimator = null;
  navBack();   // back to the category detail
}

function estimatorDiscard() {
  const e = state.estimator;
  // Backing out of a budget line hands it back to the tester rather than
  // leaving it flagged for questions they have just declined — otherwise
  // Continue walks them straight back into the same flow.
  if (e && e.target === "budget" && typeof bbToggleHelp === "function") {
    const b = state.budgetBuild;
    if (b && b.help && b.help[e.category]) bbToggleHelp(e.category);
  }
  state.estimator = null;
  navBack();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderSpendEstimator() {
  const e = state.estimator;
  // D19 — reached with no session: an admin jump, or a reset mid-flow. This
  // used to return one twenty-character line with no heading and no way back,
  // which is a dead end rather than a screen. Every comparable surface has a
  // real fallback (lessonOutcomeNoSession); this one was missed because the
  // sweep's screen list did not include it.
  if (!e) {
    return `
      <div class="card">
        <h1 class="title" style="font-size:20px;margin:0 0 6px;">Nothing to estimate yet</h1>
        <p class="helper" style="margin:0 0 4px;">
          This turns up when a category needs a closer look — it asks how often
          you do something rather than what it costs, and works the figure out
          from there.
        </p>
        <p class="helper" style="margin:0;">
          Open it from a category on your budget when you want one.
        </p>
      </div>
      <div class="flow-footer">
        <button class="button secondary" type="button" onclick="navGoTabRoot('aboutMe')">Back to Budget</button>
      </div>`;
  }
  const cat = e.category;
  const qs = e.questions;

  // Everything for this category was already asked today (cooldown).
  if (!qs.length) {
    return `
      <div class="journal-shell">
        <div class="journal-head">
          <h1 class="title" style="font-size:20px;margin:0 0 6px;">All caught up on ${h(catLabel(cat))}</h1>
          <p class="helper" style="margin:0;">You already told me about this today — I'll ask again tomorrow.</p>
        </div>
        <div class="journal-body"></div>
        <div class="journal-foot">
          <span></span>
          <button class="button" type="button" onclick="estimatorDiscard()">Back</button>
        </div>
      </div>`;
  }

  // Known step — what the app already holds, before it asks anything.
  if (e.stage === "known" && e.known) {
    return renderEstimatorKnown(e);
  }

  // Result step — the confirmation. This write REPLACES the category's
  // self-reported figure (architecture §5), so when there is already one it has
  // to be on screen: the user is confirming a change, not just reading a number.
  if (e.qIndex >= qs.length) {
    const est = estimatorFinalValue();
    const current = catValue(state.mtd, cat);
    const replacing = current > 0 && current !== est;
    return `
      <div class="journal-shell">
        <div class="journal-head">
          <h1 class="title" style="font-size:20px;margin:0;">
            ${e.target === "budget" ? "Here's what I'd budget" : "Here's my estimate"}
          </h1>
        </div>
        <div class="journal-body">
          <div class="card">
            <p class="helper" style="margin:0 0 2px;">
              ${h(catLabel(cat))} ${e.target === "budget" ? "a month" : "so far this month"}
            </p>
            <p class="journal-total">${budgetFmt(est)}</p>
            ${e.usedKnown ? `
              <p class="helper" style="margin:6px 0 0;">
                From your ${h(e.known.items.length)} subscription${e.known.items.length === 1 ? "" : "s"} —
                not an estimate.
              </p>` : ""}
            ${replacing && e.target !== "budget" ? `
              <p class="helper" style="margin:8px 0 0;">
                This replaces what you'd told me before — ${budgetFmt(current)}
                ${est < current ? "down" : "up"} to ${budgetFmt(est)}.
              </p>` : ""}

            <!-- The figure is the user's to correct, not just to accept. -->
            <div class="input-group" style="margin-top:12px;">
              <label for="estAmt">Adjust it if that's not right</label>
              <input id="estAmt" type="number" min="0" step="5" value="${est}"
                     onchange="estimatorSetAdjusted(this.value)"
                     aria-label="${h(catLabel(cat))} month-to-date estimate">
            </div>
          </div>

          <!-- Nothing commits until this is ticked. A write here REPLACES the
               category's self-reported figure (architecture §5), so the user
               affirms the change rather than a button doing it on their behalf. -->
          <label class="est-confirm">
            <input type="checkbox" ${e.confirmed ? "checked" : ""}
                   onchange="estimatorToggleConfirm()">
            <span>${e.target === "budget"
              ? `Yes — budget ${budgetFmt(est)} a month for ${h(catLabel(cat))}`
              : (replacing
                  ? `Yes — replace ${budgetFmt(current)} with ${budgetFmt(est)}`
                  : `Yes — record ${budgetFmt(est)} for ${h(catLabel(cat))}`)}</span>
          </label>
        </div>
        <div class="journal-foot">
          <button class="button secondary" type="button" onclick="estimatorPrev()">Back</button>
          <button class="button" type="button" onclick="estimatorSubmit()"
                  ${e.confirmed ? "" : "disabled"}>Use this</button>
        </div>
      </div>`;
  }

  // Question step.
  const q = qs[e.qIndex];
  const total = qs.length;
  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">${h(catLabel(cat))} · ${e.qIndex + 1} of ${total}</p>
        <div class="journal-progress" aria-hidden="true">
          ${qs.map((_, i) => `<span class="journal-pip ${i <= e.qIndex ? "on" : ""}"></span>`).join("")}
        </div>
      </div>
      <div class="journal-body">
        <h1 class="title" style="font-size:20px;margin:0 0 12px;">${h(q.prompt)}</h1>
        <div class="journal-options">
          ${q.options.map((opt, i) => `
            <button class="journal-opt ${e.answers[q.id] === i ? "picked" : ""}" type="button"
                    onclick="estimatorSetAnswer('${h(q.id)}',${i})">
              <span class="journal-opt-label">${h(opt.label)}</span>
            </button>`).join("")}
        </div>
      </div>
      <div class="journal-foot">
        ${e.qIndex > 0
          ? `<button class="button secondary" type="button" onclick="estimatorPrev()">Back</button>`
          : `<button class="button secondary" type="button" onclick="estimatorDiscard()">Cancel</button>`}
        <button class="button" type="button" onclick="estimatorNext()"
                ${estimatorAnswered(q) ? "" : "disabled"}>
          ${e.qIndex === total - 1 ? "See the estimate" : "Next"}
        </button>
      </div>
    </div>
  `;
}

/**
 * "I already know this one."
 *
 * Lists what we hold, item by item, so the figure is checkable rather than
 * asserted — and offers the questions anyway, because the app being confident
 * is not the same as the app being right.
 */
function renderEstimatorKnown(e) {
  const k = e.known;
  const cat = e.category;
  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">${h(catLabel(cat))}</p>
        <h1 class="title" style="font-size:20px;margin:0 0 6px;">I already know this one</h1>
        <p class="helper" style="margin:0;">
          No need to guess — here's what ${k.basis === "you told me" ? "you've told me" : "I have on file"}.
        </p>
      </div>

      <div class="journal-body">
        <div class="card">
          <div class="row" style="align-items:baseline;margin-bottom:10px;">
            <span class="helper">Every month</span>
            <span class="journal-total">${budgetFmt(k.amount)}</span>
          </div>
          ${k.items.map(item => `
            <div class="row est-known-row">
              <span>${h(item.name)}</span>
              <span class="helper">
                ${budgetFmt(item.monthly)}${item.exact ? "" : " · estimated"}
              </span>
            </div>`).join("")}
          ${k.estimatedCount ? `
            <p class="helper" style="margin:10px 0 0;font-size:11px;">
              ${h(k.estimatedCount)} of these ${k.estimatedCount === 1 ? "doesn't have" : "don't have"}
              a price on file, so ${k.estimatedCount === 1 ? "it's" : "they're"} counted at the
              average of the ones that do.
            </p>` : ""}
        </div>
      </div>

      <div class="journal-foot" style="flex-direction:column;align-items:stretch;gap:8px;">
        <button class="button full" type="button" onclick="estimatorUseKnown()">
          Use ${budgetFmt(k.amount)}
        </button>
        <button class="button secondary full" type="button" onclick="estimatorAskInstead()">
          That's not right — ask me instead
        </button>
        <button class="onb-skip full" type="button" onclick="estimatorDiscard()">Cancel</button>
      </div>
    </div>
  `;
}

function renderSpendEstimatorAdmin() {
  const e = state.estimator;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Spend estimator</p>
      ${e
        ? `<p class="helper" style="line-height:1.7;">
             Estimating <strong>${h(catLabel(e.category))}</strong> — ${e.questions.length} question(s),
             on ${Math.min(e.qIndex + 1, e.questions.length)}.<br>
             Month elapsed: ${Math.round(estimatorMonthFraction() * 100)}% ·
             running estimate ${budgetFmt(estimatorCompute())}<br>
             target <strong>${h(e.target || "mtd")}</strong> ·
             stage <strong>${h(e.stage)}</strong> ·
             already known ${e.known ? budgetFmt(e.known.amount) + " (" + h(e.known.basis) + ")" : "—"}
             ${e.usedKnown ? " · <strong>used</strong>" : ""}
           </p>`
        : `<p class="helper">Not running. Reached from a category detail's "Update actuals".</p>`}
    </div>
  `;
}
