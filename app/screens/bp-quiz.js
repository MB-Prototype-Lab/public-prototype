// ─── Big Purchase — "Help me pick" (the four-question quiz) ──────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// NEW on the owner's review (2026-09-26): "the experience assumes the user has
// a car in mind, but they may not." Everything else in this tool prices a car
// the tester names. This is the one screen for somebody who cannot name one
// yet: four questions about how they live, and a suggested SHAPE of vehicle.
//
// ── IT SUGGESTS, IT DOES NOT CHOOSE ─────────────────────────────────────────
// The answer arrives as "Sounds like an SUV", with the answers that produced it
// listed underneath, and two ways out: take it, or pick for yourself. Nothing
// in the calculator moves until the tester taps Use this. D26 is not really at
// stake — this is not money advice — but the same restraint applies: it names
// what fits, never what they ought to buy or spend.
//
// Same docked pattern as screen 1: one question at a time, choices at the
// bottom in thumb reach, answered questions collapsing into rows above.

function bpQuizData() {
  return (bpVData().quiz || {});
}

function bpQuizQuestions() {
  return bpQuizData().questions || [];
}

function bpQuizSession() {
  const s = bpSession();
  if (!s.quiz) s.quiz = { answers: {}, editing: null };
  return s.quiz;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Open the quiz. Answers from a previous run are KEPT — the link back into it
 * is permanent now, and somebody returning to change one answer should not be
 * made to give the other four again.
 */
function bpQuizStart() {
  const s = bpSession();
  if (!s.quiz) s.quiz = { answers: {}, editing: null };
  else s.quiz.editing = null;
  bpLog("bp_quiz_started", { returning: Object.keys(s.quiz.answers || {}).length > 0 });
  go("bpQuiz");
}

function bpQuizAnswer(qid, optId) {
  const q = bpQuizSession();
  q.answers[qid] = optId;
  q.editing = null;
  bpLog("bp_quiz_answered", { question: qid, option: optId });
  render();
}

function bpQuizEdit(qid) {
  const q = bpQuizSession();
  q.editing = q.editing === qid ? null : qid;
  render();
}

/** The question in the dock: the one being changed, else the first unanswered. */
function bpQuizCurrent() {
  const q = bpQuizSession();
  const qs = bpQuizQuestions();
  if (q.editing) {
    const hit = qs.find(x => x.id === q.editing);
    if (hit) return hit;
    q.editing = null;
  }
  return qs.find(x => !q.answers[x.id]) || null;
}

function bpQuizOption(question, optId) {
  return (question.options || []).find(o => o.id === optId) || null;
}

/**
 * The suggestion: the highest-scoring type, plus a tier and fuel nudge where
 * the answers point somewhere clearly. Ties fall to the earlier type in the
 * data file's own order, which runs smallest to largest.
 */
function bpQuizResult() {
  const q = bpQuizSession();
  const scores = {};
  let tier = null, fuel = null, condition = null, answered = 0;
  bpQuizQuestions().forEach(question => {
    const opt = bpQuizOption(question, q.answers[question.id]);
    if (!opt) return;
    answered++;
    Object.keys(opt.scores || {}).forEach(type => {
      scores[type] = (scores[type] || 0) + Number(opt.scores[type] || 0);
    });
    if (opt.tier) tier = opt.tier;
    if (opt.fuel) fuel = opt.fuel;
    if (opt.condition) condition = opt.condition;
  });
  const order = (bpVData().types || []).map(t => t.id);
  let best = null;
  order.forEach(type => {
    if (best == null || (scores[type] || 0) > (scores[best] || 0)) best = type;
  });

  // "No preference" on fuel: decide it from the answers they DID give rather
  // than making them think about drivetrains. Short city trips are where a
  // hybrid earns most; hauling and long highway miles are where it earns least.
  if (!fuel) {
    const a = q.answers;
    if (a.use === "haul" && best === "truck") fuel = "diesel";
    else if (a.where === "city" || a.use === "commute") fuel = "hybrid";
    else fuel = "gas";
  }
  // A drivetrain the category does not offer on this shape of vehicle.
  const offered = (bpVData().fuels || []).filter(f => !(f.hideFor || []).includes(best)).map(f => f.id);
  if (offered.indexOf(fuel) === -1) fuel = "gas";

  return {
    type: best,
    tier: tier || "everyday",          // Standard unless an answer says otherwise
    fuel: fuel,
    condition: condition || "new",
    scores: scores,
    complete: answered === bpQuizQuestions().length
  };
}

function bpQuizComplete() {
  const q = bpQuizSession();
  return bpQuizQuestions().every(x => !!q.answers[x.id]);
}

/**
 * Take the suggestion and go. The quiz answers EVERY setup row — type, brand,
 * fuel, condition — so screen 1 opens on the one thing the quiz cannot know
 * (owner: "we have the answers needed to pre-fill these questions and jump to
 * price screen"). Each prefilled answer is still a tappable row up top.
 */
function bpQuizUse() {
  const s = bpSession();
  const r = bpQuizResult();
  s.setup.type = r.type;
  s.setup.tier = r.tier;
  s.setup.fuel = r.fuel;
  s.setup.condition = r.condition;
  if (r.condition === "used" && !s.setup.age) s.setup.age = "1-3";
  s.ui.q = null;
  bpLog("bp_quiz_used", { type: r.type, tier: r.tier, fuel: r.fuel, condition: r.condition });
  go("bpSetup");
}

function bpQuizSkip() {
  bpLog("bp_quiz_skipped", { complete: bpQuizComplete() });
  go("bpSetup");
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderBpQuizResult() {
  const q = bpQuizSession();
  const r = bpQuizResult();
  const picked = bpQuizQuestions().map(question => {
    const opt = bpQuizOption(question, q.answers[question.id]);
    return opt ? opt.label : null;
  }).filter(Boolean);

  return `
    <div class="card bp-quiz-result">
      <p class="bp-quiz-said">Sounds like</p>
      <p class="bp-quiz-type">${h((r.condition === "used" ? "A used " : "A new ") +
        bpVTierLabel(r.tier) + " " + bpVTypeLabel(r.type))}</p>
      <p class="bp-quiz-extra">${h(bpVFuelLabel(r.fuel))}</p>
      <p class="bp-quiz-why">From your answers: ${h(picked.join(" · "))}</p>
      <button class="button full" type="button" onclick="bpQuizUse()">Use this — just the price left</button>
      <button class="button secondary full" type="button" style="margin-top:8px;"
              onclick="bpQuizSkip()">I'll pick myself</button>
    </div>`;
}

function renderBpQuiz() {
  const q = bpQuizSession();
  const current = bpQuizCurrent();
  const answered = bpQuizQuestions().filter(x => q.answers[x.id]);

  return `
    <div class="journal-shell onb-pinned bp-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">Before step 1</p>
        <h1 class="title esf-title">Help me pick</h1>
      </div>
      <div class="journal-body">
        <p class="bp-lead">A few questions about how you drive. We'll fill in the answers for you, and
           you can change any of them.</p>
        ${/* Every question has its row from the start, in place (owner,
              2026-10-03); see renderBpfAnsRow. */ ""}
        <div class="bp-answers">
          ${bpQuizQuestions().map(x => {
            const opt = bpQuizOption(x, q.answers[x.id]);
            const isCurrent = !!(current && current.id === x.id);
            return renderBpfAnsRow(x.short || x.ask.replace(/\?$/, ""), opt ? opt.label : "",
                                   `bpQuizEdit('${x.id}')`, isCurrent, !opt && !isCurrent);
          }).join("")}
        </div>
        ${current ? "" : renderBpQuizResult()}
      </div>
      ${current ? `
        <div class="bp-dock">
          <p class="bp-ask">${h(current.ask)}</p>
          ${bpTiles((current.options || []).map(o => ({ id: o.id, label: o.label, sub: o.sub || "" })),
                    q.answers[current.id],
                    id => `bpQuizAnswer('${current.id}','${id}')`,
                    // An option carrying a line of context needs the full width
                    // to say it — the same layout the brand examples use.
                    bpDockLayout(current.options || [], (current.options || []).some(o => o.sub)))}
        </div>` : ""}
      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="bpQuizSkip()">Back</button>
        ${renderBpBuddyButton()}
        <span></span>
      </div>
    </div>`;
}

function renderBpQuizAdmin() {
  const q = bpQuizSession();
  const r = bpQuizResult();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — help me pick</p>
      <p class="helper">Answers: <code>${h(JSON.stringify(q.answers))}</code></p>
      <p class="helper">Scores: <code>${h(JSON.stringify(r.scores))}</code> →
        <strong>${h(bpVTypeLabel(r.type))}</strong>${r.tier ? " · " + h(bpVTierLabel(r.tier)) : ""}${
        r.fuel ? " · " + h(bpVFuelLabel(r.fuel)) : ""}</p>
      <p class="helper" style="font-size:10px;">Options carry their own scores in
        <code>big-purchase.json → vehicle.quiz</code>. A new question is a data entry, not a branch.</p>
    </div>
    ${renderBpAdminCommon()}`;
}
