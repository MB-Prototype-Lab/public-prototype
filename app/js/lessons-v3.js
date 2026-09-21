// ─── Lesson framing + variant matching (D38, 06-education) ───────────────────
// The two gaps v2's pipeline does not cover:
//   1. the pre-lesson framing decision tree
//   2. answer-driven script personalization
//
// v2's lesson player is NOT rewritten (D38). It keeps its audio, its cue map
// and its subtitle rendering; the only hook is which sentence array it plays.
//
// ── THREE STRUCTURAL TRAPS IN THE DATA (architecture §12b) ───────────────────
// 1. The key is `tag`, SINGULAR — not `tags`. A `.tags` lookup collects
//    nothing, the tag set comes back empty, and every lesson silently plays its
//    fallback. You still get a script, just always the wrong one.
// 2. `next` lives at TWO levels — on the option for some questions, on the
//    question for others — and every lesson's f3 is terminal with neither.
//    Resolution order: option → question → done.
// 3. `nocard` is declared in apr_v5's matchTags but never emitted by any
//    answer. apr_v5 stays reachable via `no_debt`, so it is harmless. Do not
//    "fix" it by inventing a question.

function lessonV3(id) {
  return (LESSONS_V3.lessons || []).find(l => l.id === id) || null;
}

// ─── "Did today's task send me here?" ────────────────────────────────────────
// Two things hang off the answer: the daily-task XP bonus, and whether the
// reward screen itemises the task's Charity Points beside the lesson's own.
//
// It used to be the literal comparison `state.activeTaskId === "t_lesson_apr"`,
// written in two files. One hardcoded id, so a second lesson-routed daily task
// — an emergency-fund task, say — would silently pay no bonus and show no task
// line on the reward screen, while the home card that sent the tester there
// still promised bones. Nothing would error; the figures would just be wrong.
//
// The data already answers the question. A task carries a `route`, and the
// route grammar is the one navRouteTask parses: "name" or "name:param", where
// `lesson:apr` names a lesson. So ask the task list rather than a string.
//
// state.dailyTasks is the V3 array. state.tasks is v2's parked one and no v3
// screen renders it — see the table in js/utils.js appStateSnapshot.

/** The lesson id a task route points at, or null if it points elsewhere. */
function lessonRouteTarget(route) {
  const parts = String(route || "").split(":");
  return parts[0] === "lesson" && parts[1] ? parts[1] : null;
}

/** The daily task that opens this lesson, if there is one. */
function lessonDailyTask(lessonId) {
  if (!lessonId) return null;
  return (state.dailyTasks || []).find(t => lessonRouteTarget(t.route) === lessonId) || null;
}

/** True when the task currently in progress is the one that opens this lesson. */
function lessonIsActiveTask(lessonId) {
  const task = lessonDailyTask(lessonId);
  return !!(task && state.activeTaskId === task.id);
}

function lessonQuestion(lesson, qid) {
  return (lesson.framing || []).find(q => q.id === qid) || null;
}

/** The first question — always the first declared. */
function lessonFirstQuestion(lesson) {
  return (lesson.framing || [])[0] || null;
}

/**
 * Where an answer leads. TRAP 2: option-level `next` wins, then question-level,
 * then null meaning the tree is done.
 */
function lessonNextId(question, option) {
  if (option && option.next) return option.next;
  if (question && question.next) return question.next;
  return null;
}

// ── Session ──────────────────────────────────────────────────────────────────

function lessonFramingStart(lessonId) {
  const lesson = lessonV3(lessonId);
  if (!lesson) return null;
  const first = lessonFirstQuestion(lesson);
  state.lessonFraming = {
    lessonId: lessonId,
    questionId: first ? first.id : null,
    tags: [],
    inputs: {},        // structured answers: issuer / card / directRate / enteredApr / useAverage
    path: [],
    variantId: null
  };
  return state.lessonFraming;
}

/**
 * The options for the CURRENT question. Static for most, but a `card_select`
 * question generates its options at render time from CARD_APR by the issuer the
 * user already picked — that is the tiered "Amex → Platinum" filtering.
 */
function lessonEffectiveOptions(f, q) {
  if (q && q.type === "card_select") {
    const cards = (typeof CARD_APR !== "undefined" && CARD_APR.issuers[f.inputs.issuer]) || {};
    return Object.keys(cards).map(card => ({ label: card, card: card }));
  }
  return (q && q.options) || [];
}

function lessonFramingAnswer(optionIndex) {
  const f = state.lessonFraming;
  if (!f) return;
  const lesson = lessonV3(f.lessonId);
  const q = lessonQuestion(lesson, f.questionId);
  if (!q) return;
  const opt = lessonEffectiveOptions(f, q)[optionIndex];
  if (!opt) return;

  // TRAP 1: `tag`, singular. Reading `.tags` here is the silent failure.
  if (opt.tag) f.tags.push(opt.tag);
  // Structured inputs the APR inference reads.
  if (opt.issuer)     f.inputs.issuer = opt.issuer;
  if (opt.card)       f.inputs.card = opt.card;
  if (opt.directRate) f.inputs.directRate = opt.directRate;
  if (opt.useAverage) f.inputs.useAverage = true;
  f.path.push({ questionId: q.id, label: opt.label, tag: opt.tag || null });

  const nextId = lessonNextId(q, opt);
  if (nextId && lessonQuestion(lesson, nextId)) { f.questionId = nextId; render(); return; }
  lessonFramingFinish();
}

/** The `fill_number` question (enter your APR). Terminal in the APR tree. */
function lessonFramingEnterNumber(value) {
  const f = state.lessonFraming;
  if (!f) return;
  const lesson = lessonV3(f.lessonId);
  const q = lessonQuestion(lesson, f.questionId);
  const num = Number(value);
  if (isFinite(num) && num > 0) f.inputs.enteredApr = num;
  f.path.push({ questionId: q.id, label: isFinite(num) && num > 0 ? num + "%" : "—", tag: null });
  const nextId = lessonNextId(q, null);
  if (nextId && lessonQuestion(lesson, nextId)) { f.questionId = nextId; render(); return; }
  lessonFramingFinish();
}

// Terminal — infer the figure, pick the variant, store the session profile, play.
function lessonFramingFinish() {
  const f = state.lessonFraming;
  const lesson = lessonV3(f.lessonId);
  f.questionId = null;
  const variant = lessonSelectVariant(lesson, f.tags, f.inputs);
  f.variantId = variant.id;

  const figure = lessonInferFigure(lesson, f.inputs);
  state.lessonProfile = state.lessonProfile || {};
  state.lessonProfile[lesson.id] = {
    inputs: Object.assign({}, f.inputs),
    figure: figure,
    bucket: variant.bucket || null,
    variantId: variant.id
  };
  lessonOpenPlayer(lesson, variant.id);
}

// ── Inference + bucketing (APR) ───────────────────────────────────────────────
// The audio stays general (the bucket); the specific number lives in the visual
// plan. "Don't know" → the market average (an about-average read); no card / no
// info → null, which plays the fallback.
/**
 * The CARD_APR entry a set of answers points at, or null. Entries are
 * `{ typical, low, high }`; a bare number is still accepted so the lookup keeps
 * working if the table is ever simplified back.
 */
function lessonCardEntry(inputs) {
  if (typeof CARD_APR === "undefined") return null;
  inputs = inputs || {};
  if (inputs.directRate) return CARD_APR.directRates[inputs.directRate] || null;
  if (inputs.issuer && inputs.card && CARD_APR.issuers[inputs.issuer]) {
    return CARD_APR.issuers[inputs.issuer][inputs.card] || null;
  }
  return null;
}

function lessonEntryRate(entry) {
  if (entry == null) return null;
  return typeof entry === "number" ? entry : entry.typical;
}

/** The band the video draws as "cards like yours". Falls back to the national spread. */
function lessonCardBand(inputs) {
  const entry = lessonCardEntry(inputs);
  if (entry && typeof entry === "object" && entry.low != null && entry.high != null) {
    return { low: entry.low, high: entry.high };
  }
  const fb = (typeof CARD_APR !== "undefined" && CARD_APR.typicalBand) || null;
  return fb ? { low: fb.low, high: fb.high } : null;
}

function lessonInferFigure(lesson, inputs) {
  if (!lesson.bucketDimension) return null;
  inputs = inputs || {};
  if (inputs.enteredApr != null) return inputs.enteredApr;
  const rate = lessonEntryRate(lessonCardEntry(inputs));
  if (rate != null) return rate;
  if (inputs.useAverage && typeof CARD_APR !== "undefined") return CARD_APR.marketAverage;
  return null;
}

/** What the video calls their card. Never a figure — the numbers are separate. */
function lessonCardName(inputs) {
  inputs = inputs || {};
  if (inputs.card) return inputs.card;
  if (inputs.directRate === "store_retail") return "a store card";
  if (inputs.directRate === "credit_union") return "a credit union card";
  return "your card";
}

function lessonBucketFor(lesson, figure) {
  if (figure == null || !lesson.bucketDimension) return null;
  if (lesson.bucketDimension.kind === "apr") {
    const avg = (typeof CARD_APR !== "undefined" && CARD_APR.marketAverage) || 22;
    const r = figure / avg;
    if (r < 0.85) return "deeply_below";
    if (r < 0.95) return "slightly_below";
    if (r <= 1.05) return "about_average";
    if (r <= 1.20) return "slightly_above";
    return "deeply_above";
  }
  return null;
}

/**
 * Collect tags from all framing answers, score each variant by overlap, play
 * the highest. Ties break by declaration order. Zero matches plays the
 * fallback (LESSONS_V3.matching).
 *
 * Unmatched tags are the DESIGN, not a gap: `unsure_apr`, `unknown_*` and all
 * of f3's confidence tags deliberately match no variant and fall through to the
 * fallback, whose own note says it "also serves every 'I don't know' path".
 * That is 06-education's "'I don't know' is a first-class answer, not a
 * failure". Do not add variants to cover them.
 */
function lessonSelectVariant(lesson, tags, inputs) {
  const variants = lesson.scriptVariants || [];
  const fallback = variants.find(v => v.isFallback) || variants[variants.length - 1];

  // Bucket lessons (APR): infer the figure, bucket it against the reference, and
  // match the bucket variant. No figure (no card / "I don't know" borrowing) →
  // the fallback, which is also the "before you borrow" script.
  if (lesson.bucketDimension) {
    const bucket = lessonBucketFor(lesson, lessonInferFigure(lesson, inputs || {}));
    if (bucket) {
      const hit = variants.find(v => v.bucket === bucket);
      if (hit) return hit;
    }
    return fallback;
  }

  // Tag overlap — the other lessons, until they get the same rework.
  let best = null, bestScore = 0;
  variants.forEach(v => {
    if (v.isFallback) return;
    const score = (v.matchTags || []).reduce((n, t) => n + (tags.indexOf(t) !== -1 ? 1 : 0), 0);
    if (score > bestScore) { best = v; bestScore = score; }   // > keeps the first on a tie
  });

  return best || fallback;
}

function lessonScriptFor(variantId) {
  return (typeof LESSON_SCRIPTS !== "undefined" && LESSON_SCRIPTS[variantId]) || null;
}

/**
 * Hand off to v2's player. The ONLY thing v3 changes is which sentence array it
 * plays — everything else about the player is untouched (D38).
 */
function lessonOpenPlayer(lesson, variantId) {
  state.lessonVariantId = variantId;
  state.lessonVariantScript = lessonScriptFor(variantId);

  // The data the staging-area video binds to. The narration stays general; every
  // specific figure the viewer sees comes from here. Built from the session
  // profile written when framing finished.
  const prof = (state.lessonProfile && state.lessonProfile[lesson.id]) || {};
  const inputs = prof.inputs || {};
  const avg = (typeof CARD_APR !== "undefined" && CARD_APR.marketAverage) || null;
  state.lessonVisualPlan = lesson.visualTemplate ? {
    lessonId: lesson.id,
    userFigure: prof.figure != null ? prof.figure : null,
    marketAvg: avg,
    gapPercent: (prof.figure != null && avg) ? Math.round(((prof.figure - avg) / avg) * 100) : null,
    bucket: prof.bucket || null,
    band: lessonCardBand(inputs),
    cardName: lessonCardName(inputs),
    storyboard: lesson.visualTemplate
  } : null;

  // v2's player keys its content off state.currentLesson. The lesson is in the
  // shared catalog now, so PREFER that row — it carries the real badge names.
  // Overwriting it with `badges: lesson.courses` put course slugs
  // ("interest-rates") where the reward screen expects badge names, so
  // completeLesson() matched nothing and the reward landed with 0 gains and 0 XP.
  // Fabricate a row only when the player was opened without selectLesson (an
  // admin jump), and map courses → badges there too.
  if (!state.currentLesson || state.currentLesson.id !== lesson.id) {
    state.currentLesson = state.lessons.find(l => l.id === lesson.id) || {
      id: lesson.id,
      title: lesson.title,
      description: (lesson.courses || []).join(" · "),
      badges: lessonV3Badges(lesson),
      xp: (LESSONS_V3.badges && LESSONS_V3.badges.xpLessonComplete) || 100,
      // Drives the "⚡ Daily Bonus" line on the reward screen. Derived from the
      // task's route, never a hardcoded id — see lessonIsActiveTask.
      dailyTask: lessonIsActiveTask(lesson.id),
      status: "in-progress"
    };
  }
  state.activeQuizIndex = 0;
  state.activeQuizChoice = null;
  state.activeQuizWrongChoices = [];
  go("lesson");
}

/** Skip framing entirely — plays the fallback, which is what it is for. */
function lessonSkipFraming() {
  const f = state.lessonFraming;
  if (!f) return;
  const lesson = lessonV3(f.lessonId);
  f.questionId = null;
  f.variantId = lessonSelectVariant(lesson, [], {}).id;
  lessonOpenPlayer(lesson, f.variantId);
}

/**
 * Entry point from a task route or the Learn tab. If the lesson was already
 * framed THIS session, skip the questions and replay the same variant (D03:
 * state is in-memory, so a refresh clears it and we ask again — no persistent
 * cooldown, which does not matter for the prototype).
 */
/**
 * The figure framing inferred for this lesson, or null.
 *
 * For APR that is the card's rate -- an issuer + card lookup in CARD_APR, or a
 * rate the tester typed. The calculator seeds its APR slider from this so it
 * opens on their card rather than on a generic default.
 */
function lessonProfileFigure(lessonId) {
  const prof = state.lessonProfile && state.lessonProfile[lessonId];
  return (prof && prof.figure != null) ? prof.figure : null;
}

function lessonV3Start(lessonId) {
  const lesson = lessonV3(lessonId);
  if (!lesson) return;
  const prof = state.lessonProfile && state.lessonProfile[lessonId];
  if (prof && prof.variantId) { lessonOpenPlayer(lesson, prof.variantId); return; }
  lessonFramingStart(lessonId);
  go("lessonFraming");
}

// ─── v3 lessons in the Learn tab ─────────────────────────────────────────────
// v3 lessons lived in their own catalog (LESSONS_V3) that the Learn tab never
// listed, so `apr` was reachable ONLY from its daily task — a lesson you could
// not find by browsing, on a pipeline of its own. Daily tasks are contextual
// bookmarks into the app, not a second front door, so the v3 lessons are
// adapted into state.lessons at boot and Learn/topic/selectLesson see one
// catalog. Only the ENTRY branches (on isV3); everything after is shared.

// v3 lessons tag themselves with course slugs; the Learn tab groups by badge.
const LESSON_V3_COURSE_BADGES = {
  "interest-rates":  "Credit Cards",
  "credit-cards":    "Credit Cards",
  "mortgages":       "Home Buying",
  "savings":         "Emergency Fund",
  "getting-started": "Emergency Fund",
  "spending":        "Emergency Fund"
};

function lessonV3Badges(lesson) {
  const out = [];
  (lesson.courses || []).forEach(c => {
    const b = LESSON_V3_COURSE_BADGES[c];
    if (b && out.indexOf(b) === -1) out.push(b);
  });
  return out.length ? out : ["Credit Cards"];
}

/** A v3 lesson in the shape the Learn tab, topic list and selectLesson expect. */
function lessonV3LearnRow(lesson) {
  return {
    id:          lesson.id,
    title:       lesson.title,
    description: "Built from your own answers, so the numbers are yours.",
    type:        "lesson",
    badges:      lessonV3Badges(lesson),
    xp:          (typeof LESSONS_V3 !== "undefined" && LESSONS_V3.badges &&
                  LESSONS_V3.badges.xpLessonComplete) || 40,
    dailyTask:   false,
    status:      "not-started",
    isV3:        true      // the one bit selectLesson branches on
  };
}

/**
 * Clear the per-run state a v3 lesson leaves behind.
 *
 * These fields had writers and no owner: `lessonOpenPlayer` sets the script,
 * the storyboard and the variant, the outcome screens set the quiz and the
 * calculator, and nothing on the shared path ever cleared them. Because
 * screens/lesson.js falls back through `state.lessonVariantScript ||
 * LP_SCRIPTS[id]` and gates its video on `state.lessonVisualPlan`, one APR run
 * left EVERY other lesson playing APR's narration over APR's video — and
 * `lessonLeaveForQuiz`'s branch on `lessonVariantId` sent them all into the v3
 * outcome chain, where a stale `lessonFraming.lessonId` handed them APR's quiz
 * and APR's calculator too.
 *
 * `state.lessonProfile` is deliberately NOT cleared: the framing answers are
 * durable for the prototype's lifetime, so re-opening a lesson does not re-ask
 * (owner's decision). Only resetUserData() drops those.
 */
function lessonV3ClearSession() {
  state.lessonVariantId     = null;
  state.lessonVariantScript = null;
  state.lessonVisualPlan    = null;
  state.lessonFraming       = null;
  state.lessonQuiz          = null;
  state.lessonSim           = null;
}

/** Append the v3 catalog to state.lessons. Idempotent — safe on re-boot. */
function lessonV3MergeIntoCatalog() {
  if (typeof LESSONS_V3 === "undefined" || !LESSONS_V3.lessons) return;
  LESSONS_V3.lessons.forEach(l => {
    if (state.lessons.some(x => x.id === l.id)) return;
    state.lessons.push(lessonV3LearnRow(l));
  });
}
