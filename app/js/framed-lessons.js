// ─── Lesson framing + variant matching (D38) ─────────────────────────────────
// Framing selects a personalised script and visual plan for the shared player
// (D38); audio, cue maps and subtitle rendering stay with the player.
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

function framedLesson(id) {
  return (FRAMED_LESSONS.lessons || []).find(l => l.id === id) || null;
}

// ─── "Did today's task send me here?" ────────────────────────────────────────
// Two things hang off the answer: the daily-task XP bonus, and whether the
// reward screen itemises the task's Charity Points beside the lesson's own.
//
// The data already answers the question. A task carries a `route`, and the
// route grammar is the one navRouteTask parses: "name" or "name:param", where
// `lesson:apr` names a lesson. So ask the task list rather than a string.
//
// Read state.dailyTasks, not the off-path state.tasks array (js/utils.js).

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
  const lesson = framedLesson(lessonId);
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
  const lesson = framedLesson(f.lessonId);
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
  const lesson = framedLesson(f.lessonId);
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
  const lesson = framedLesson(f.lessonId);
  f.questionId = null;
  const variant = lessonSelectVariant(lesson, f.tags, f.inputs);
  f.variantId = variant.id;

  const figure = lessonInferFigure(lesson, f.inputs);
  state.lessonProfile = state.lessonProfile || {};
  state.lessonProfile[lesson.id] = {
    inputs: Object.assign({}, f.inputs),
    figure: figure,
    bucket: variant.bucket || null
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
 * fallback (FRAMED_LESSONS.matching).
 *
 * Unmatched tags are the DESIGN, not a gap: `unsure_apr`, `unknown_*` and all
 * of f3's confidence tags deliberately match no variant and fall through to the
 * fallback, whose own note says it "also serves every 'I don't know' path".
 * "I don't know" is a first-class answer, not a failure. Do not add variants
 * to cover them.
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

  // Lessons without a bucket dimension use tag overlap.
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
 * The APR animation with nothing personal in it, for a run with no card APR.
 *
 * The full storyboard needs the viewer's rate. These education beats use no
 * personal figures, so they can play without it, each
 * spanning the no-card script's lines that tell the same thing
 * (visualTemplate.figureFree in lessons.json). Timed from THAT script's cues --
 * the same lpTimingFor call renderLesson makes -- so the picture and the voice
 * run off one clock. Returns null when the lesson has no such cut, or the
 * script in hand is not the one the map was written against.
 */
function lessonFigureFreeStoryboard(lesson, sentences) {
  const vt = lesson && lesson.visualTemplate;
  const ff = vt && vt.figureFree;
  if (!ff || !Array.isArray(sentences) || !sentences.length) return null;
  if (ff.script && lessonScriptFor(ff.script) !== sentences) return null;
  return lessonCutStoryboard(vt, ff.beats, lesson.id, sentences);
}

/**
 * Cut `vt`'s spine to a line map: each entry plays one of its beats across the
 * given script lines, timed from those lines' cues (lpTimingFor -- the same
 * call the player makes, so picture and voice share one clock). Figure-free
 * by contract: callers only map beats that carry no {tokens}.
 */
function lessonCutStoryboard(vt, beats, lessonId, sentences) {
  if (!vt || !Array.isArray(beats) || !Array.isArray(sentences) || !sentences.length) return null;
  if (typeof lpTimingFor !== "function") return null;
  const t = lpTimingFor(lessonId, sentences.length, sentences);
  const total = Math.max(0.001, t.total);
  const byId = {};
  (vt.spine || []).forEach(b => { byId[b.id] = b; });
  const spine = [];
  beats.forEach(entry => {
    const src = byId[entry.beat];
    const first = entry.lines[0], last = entry.lines[1];
    if (!src || !(src.elements || []).length || first < 0 || last >= sentences.length) return;
    spine.push({
      id: entry.as || entry.beat,
      from: (t.cues[first] || 0) / total,
      to: last + 1 < t.cues.length ? t.cues[last + 1] / total : 1,
      hold: !!entry.hold,
      elements: src.elements
    });
  });
  return spine.length ? { kind: vt.kind, requiresFigures: false, spine: spine } : null;
}

/**
 * The stage plan for an older lesson that borrows another's beats
 * (LP_BORROWED_VISUALS, screens/lesson.js), or null. Without one the stage is
 * plain -- the older lessons never had a storyboard of their own.
 */
function lessonBorrowedVisualPlan(lessonId) {
  if (typeof LP_BORROWED_VISUALS === "undefined" || typeof LP_SCRIPTS === "undefined") return null;
  const map = LP_BORROWED_VISUALS[lessonId];
  const donor = map && framedLesson(map.from);
  const sentences = LP_SCRIPTS[lessonId];
  if (!donor || !donor.visualTemplate || !sentences) return null;
  const storyboard = lessonCutStoryboard(donor.visualTemplate, map.beats, lessonId, sentences);
  return storyboard ? { lessonId: lessonId, userFigure: null, marketAvg: null, bucket: null,
                        storyboard: storyboard } : null;
}

/**
 * Hand the selected script and visual plan to the shared player (D38).
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
  // No figure to plot (no card, rather-not-say, Skip): play the figure-free cut
  // instead of a blank stage. Card runs use the full spine.
  if (state.lessonVisualPlan && state.lessonVisualPlan.userFigure == null) {
    const cut = lessonFigureFreeStoryboard(lesson, state.lessonVariantScript);
    if (cut) state.lessonVisualPlan.storyboard = cut;
  }

  // Prefer the shared catalogue row: rewards match badge names, not course
  // slugs. For a direct player entry, map courses to badges in the fallback too.
  if (!state.currentLesson || state.currentLesson.id !== lesson.id) {
    state.currentLesson = state.lessons.find(l => l.id === lesson.id) || {
      id: lesson.id,
      title: lesson.title,
      description: (lesson.courses || []).join(" · "),
      badges: framedLessonBadges(lesson),
      xp: (FRAMED_LESSONS.badges && FRAMED_LESSONS.badges.xpLessonComplete) || 100,
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
  const lesson = framedLesson(f.lessonId);
  f.questionId = null;
  f.variantId = lessonSelectVariant(lesson, [], {}).id;
  lessonOpenPlayer(lesson, f.variantId);
}

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

/**
 * Entry point from a task route or the Learn tab. Every open asks the framing
 * questions again, even when this session already answered them: a tester who
 * once answered "no card" must still be able to see them.
 */
function framedLessonStart(lessonId) {
  if (!framedLesson(lessonId)) return;
  lessonFramingStart(lessonId);
  go("lessonFraming");
}

// ─── Framed lessons in the Learn tab ─────────────────────────────────────────
// Adapt FRAMED_LESSONS into state.lessons at boot so tasks and browsing use one
// catalogue. isFramed branches only at entry; the player and reward path are shared.

// Framed lessons use course slugs; the Learn tab groups by badge.
const LESSON_V3_COURSE_BADGES = {
  "interest-rates":  "Credit Cards",
  "credit-cards":    "Credit Cards",
  "mortgages":       "Home Buying",
  "savings":         "Emergency Fund",
  "getting-started": "Emergency Fund",
  "spending":        "Emergency Fund"
};

function framedLessonBadges(lesson) {
  const out = [];
  (lesson.courses || []).forEach(c => {
    const b = LESSON_V3_COURSE_BADGES[c];
    if (b && out.indexOf(b) === -1) out.push(b);
  });
  return out.length ? out : ["Credit Cards"];
}

/** A framed lesson in the shape Learn, topic and selectLesson expect. */
function framedLessonLearnRow(lesson) {
  return {
    id:          lesson.id,
    title:       lesson.title,
    description: "Built from your own answers, so the numbers are yours.",
    type:        "lesson",
    badges:      framedLessonBadges(lesson),
    xp:          (typeof FRAMED_LESSONS !== "undefined" && FRAMED_LESSONS.badges &&
                  FRAMED_LESSONS.badges.xpLessonComplete) || 40,
    dailyTask:   false,
    status:      "not-started",
    isFramed:        true      // the one bit selectLesson branches on
  };
}

/**
 * Clear per-run framing, script, visuals and outcomes so another lesson cannot
 * inherit this run's narration, video, quiz or calculator.
 *
 * `state.lessonProfile` is deliberately NOT cleared: it holds the latest
 * framing answers, which the calculator seeds from. Re-opening a lesson asks
 * again all the same. Only resetUserData() drops them.
 */
function framedLessonClearSession() {
  state.lessonVariantId     = null;
  state.lessonVariantScript = null;
  state.lessonVisualPlan    = null;
  state.lessonFraming       = null;
  state.lessonQuiz          = null;
  state.lessonSim           = null;
}

/** Append framed lessons to the shared catalogue. Idempotent on re-boot. */
function framedLessonMergeIntoCatalog() {
  if (typeof FRAMED_LESSONS === "undefined" || !FRAMED_LESSONS.lessons) return;
  FRAMED_LESSONS.lessons.forEach(l => {
    if (state.lessons.some(x => x.id === l.id)) return;
    state.lessons.push(framedLessonLearnRow(l));
  });
}
