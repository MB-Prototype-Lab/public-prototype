// ─── Badges, XP and rewards (06-education, L9) ───────────────────────────────
// "Per lesson. Metal tier plus level number, Overwatch-style. XP from correct
// answers, bonus XP when the lesson came from the daily task list. The badge is
// vanity — it unlocks nothing. That's the point."
//
// L9 resolves the two incompatible models: lessons.json's five-tier
// progression and XP values win, kept admin-tunable through v2's xpConfig
// panel so the multipliers can be adjusted mid-test without a code edit.
//
// ── PROGRESS IS ON THE LESSON, NOT THE COURSE ────────────────────────────────
// lessons.json's own note: "A lesson belongs to several courses. Progress is on
// the lesson, so cross-cutting lessons level faster." APR belongs to three
// courses, so finishing it moves all three. That is the design, not
// double-counting.

function lrTiers() { return LESSONS_V3.badges.tiers || ["bronze"]; }
function lrXpPerTier() { return LESSONS_V3.badges.xpPerTier || 500; }

/** Tier + level from raw XP. Caps at the final tier rather than overflowing. */
function lrRank(xp) {
  const per = lrXpPerTier();
  const tiers = lrTiers();
  const tierIdx = Math.min(tiers.length - 1, Math.floor((xp || 0) / per));
  const within = (xp || 0) - tierIdx * per;
  const level = Math.min(10, Math.floor((within / per) * 10) + 1);
  return {
    tier: tiers[tierIdx],
    tierIndex: tierIdx,
    level: level,
    xp: xp || 0,
    intoTier: within,
    pct: Math.min(100, Math.round((within / per) * 100)),
    maxed: tierIdx === tiers.length - 1 && within >= per
  };
}

function lrCourseXp(courseId) {
  return (state.courseXp && state.courseXp[courseId]) || 0;
}

/**
 * XP for finishing a lesson. Base values come from lessons.json; the
 * multipliers stay on v2's xpConfig so they remain hot-editable from the admin
 * panel during a test session.
 */
function lrComputeAward(lesson, correctCount, fromDailyTask) {
  const b = LESSONS_V3.badges;
  const cfg = state.xpConfig || {};
  const perCorrect = b.xpCorrectAnswer || 50;
  const complete = b.xpLessonComplete || 100;
  const bonus = fromDailyTask ? (b.xpBonusFromDailyTask || 50) : 0;

  const base = complete + perCorrect * (correctCount || 0);
  // v2's bonusMultiplier is a testing knob layered on the flat bonus.
  const mult = fromDailyTask ? (Number(cfg.bonusMultiplier) || 1) : 1;
  const total = Math.round(base + bonus * mult);

  return {
    base: base,
    bonus: Math.round(bonus * mult),
    total: total,
    perCorrect: perCorrect,
    correctCount: correctCount || 0,
    fromDailyTask: !!fromDailyTask
  };
}

/**
 * Apply an award to every course the lesson belongs to, and return per-course
 * before/after so the reward screen can animate the movement.
 */
function lrApplyAward(lesson, award) {
  if (!state.courseXp) state.courseXp = {};
  const gains = [];
  (lesson.courses || []).forEach(courseId => {
    const before = lrCourseXp(courseId);
    const after = before + award.total;
    state.courseXp[courseId] = after;
    gains.push({
      course: courseId,
      before: before,
      after: after,
      rankBefore: lrRank(before),
      rankAfter: lrRank(after),
      leveledUp: lrRank(after).level !== lrRank(before).level
                 || lrRank(after).tier !== lrRank(before).tier
    });
  });
  return gains;
}

// ── The Charity Points ledger ────────────────────────────────────────────────
// Finishing a lesson credited bones in two places — lrAwardKibble here, and
// homeCompleteTask for the daily task that sent you — and the screen the tester
// actually lands on showed neither. state.kibble simply went up, silently, by
// roughly double what the home card had promised.
//
// Both awards stand: one is for finishing the lesson, one is for doing today's
// task. They are different things. But they have to be VISIBLE and itemised, or
// the total looks like a discrepancy against the card that promised 25.
//
// The ledger is a per-completion record, opened by whichever reward path is
// running and closed by completeLesson (the one funnel every lesson exits
// through). homeCompleteTask only writes while a ledger is open, so finishing
// the journal task does not leave an entry lying around for the next lesson.

function lrPointsReset() {
  state.rewardPoints = { entries: [], bones: 0, diamonds: 0, open: true };
  return state.rewardPoints;
}

function lrPointsOpen() {
  return !!(state.rewardPoints && state.rewardPoints.open);
}

/** Record something already credited. Never credits on its own. */
function lrPointsRecord(kind, amount, label) {
  const n = Number(amount) || 0;
  if (!lrPointsOpen() || n <= 0) return;
  const p = state.rewardPoints;
  p.entries.push({ kind: kind, amount: n, label: label });
  if (kind === "diamonds") p.diamonds += n; else p.bones += n;
}

function lrPointsClose() {
  if (state.rewardPoints) state.rewardPoints.open = false;
}

/**
 * Diamonds are the subscriber tier (L16, buddy-responses: they "lean on your
 * plan tier"). They had a seeded balance and no accrual rule at all, so the
 * trial step at the end of onboarding decided nothing.
 *
 * One diamond per lesson while the trial is on. Off it, the reward screen still
 * shows the line — greyed, saying what the subscriber tier would have earned —
 * because a tier you can't see the value of is not a tier.
 */
const LR_DIAMONDS_PER_LESSON = 1;

function lrDiamondsForLesson() {
  return state.trialAccepted === true ? LR_DIAMONDS_PER_LESSON : 0;
}

/** Kibble for finishing. Accrues and shows; nothing spends it (L16). */
function lrAwardKibble(award) {
  const k = Math.max(10, Math.round(award.total / 10));
  state.kibble += k;
  lrPointsRecord("bones", k, "Finishing the lesson");
  const d = lrDiamondsForLesson();
  if (d > 0) {
    state.charityDiamonds = (state.charityDiamonds || 0) + d;
    lrPointsRecord("diamonds", d, "Finishing the lesson");
  }
  return k;
}

// ── Quiz ─────────────────────────────────────────────────────────────────────
// lessons.json ships ONE question per lesson, which is thin for a quiz, so v2's
// 48-question pool tops it up to xpConfig.quizQuestionsRequired (L9). The
// lesson's own question always comes first — it is the one written for it.

function lrQuizQuestions(lesson) {
  const want = (state.xpConfig && state.xpConfig.quizQuestionsRequired) || 3;
  const own = (lesson.quiz || []).map((q, i) => ({
    id: lesson.id + "_q" + i,
    prompt: q.prompt,
    options: q.options,
    correct: q.correct,
    source: "lesson"
  }));
  if (own.length >= want) return own.slice(0, want);

  // Top up from v2's pool, preferring questions whose lesson shares a course.
  const pool = (state.quizQuestions || []).map(q => ({
    id: q.id,
    prompt: q.question,
    options: q.choices,
    correct: q.correct,
    source: "pool"
  }));
  return own.concat(pool.slice(0, want - own.length));
}

// ── Simulations ──────────────────────────────────────────────────────────────
// "Bias toward simulation over quiz. A sandbox a user can push numbers through
// beats a multiple-choice question about what a rate means."
//
// SANDBOX, with ONE recorded exception. lessons.json says the same: a lesson is
// a safe place to try a number, which it stops being if the number is yours.
// That rule is about the BALANCE -- a made-up debt is something to poke at, and
// your real one is a judgement.
//
// The APR is seeded from the tester's own card (lessonSimOpen). A rate is not
// the same kind of figure: it is the subject of the lesson, it is public
// information about a product rather than a fact about them, and it stays
// draggable. Opening on a generic 24% asked them to dial in a number that
// framing had already worked out.

function lrSimDefaults(lesson) {
  const sim = lesson.simulation || {};
  if (sim.defaults) return Object.assign({}, sim.defaults);
  if (sim.type === "subscription_tally") {
    // seedFrom names the persona, but these are illustrative rows, not the
    // user's own subscription list — same sandbox rule.
    return {
      // `status` rides along so the "only the ones you use" preset has
      // something to key on — it is the persona's own engagement flag, which is
      // the case the lesson is about.
      rows: (PERSONA.subscriptions.known || []).map(s => ({
        name: s.name, monthly: s.monthly, status: s.status, on: true
      }))
    };
  }
  return {};
}

/** Months to clear a balance, and what the interest costs. Null if it never clears. */
function lrSimBalance(v) {
  const apr = (Number(v.apr) || 0) / 100 / 12;
  let bal = Number(v.balance) || 0;
  const pay = Number(v.monthlyPayment) || 0;
  let months = 0, interest = 0;

  // PAYING IN FULL COSTS NOTHING. The grace period is the first thing the APR
  // lesson teaches -- "if the balance is cleared before the due date, on most
  // cards none of it costs you anything" -- and the loop below contradicted it:
  // it charged a month of interest first, so clearing a $1,000 balance showed
  // two months and $22. The calculator has to agree with the lesson it ends.
  if (bal > 0 && pay >= bal) return { monthsToPayoff: 1, totalInterest: 0 };

  if (pay <= bal * apr) return { monthsToPayoff: null, totalInterest: null };
  while (bal > 0 && months < 1200) {
    const i = bal * apr;
    interest += i;
    bal = bal + i - pay;
    months++;
  }
  return { monthsToPayoff: months, totalInterest: Math.round(interest) };
}

function lrSimSavings(v) {
  const target = Number(v.target) || 0;
  const cur = Number(v.current) || 0;
  const per = Number(v.monthlyContribution) || 0;
  if (cur >= target) return { monthsToTarget: 0, targetDate: "already there" };
  if (per <= 0) return { monthsToTarget: null, targetDate: null };
  const months = Math.ceil((target - cur) / per);
  const d = new Date(); d.setMonth(d.getMonth() + months);
  return {
    monthsToTarget: months,
    targetDate: d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  };
}

function lrSimSubscriptions(rows) {
  const on = (rows || []).filter(r => r.on);
  const monthly = on.reduce((t, r) => t + (Number(r.monthly) || 0), 0);
  const off = (rows || []).filter(r => !r.on)
    .reduce((t, r) => t + (Number(r.monthly) || 0), 0);
  return {
    monthlyTotal: monthly,
    annualTotal: monthly * 12,
    savingsIfCancelled: off * 12
  };
}
