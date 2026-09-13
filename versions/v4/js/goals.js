// ─── Goals engine (05-goals, L3) ─────────────────────────────────────────────
// Rebuilt to the v3 model. v2's Goals V2 module — frozen baselines, derived
// sprints, a seeded cohort, medals — is not carried over; it stays in
// versions/v2/ and remains testable from the gate.
//
// ── TWO TYPES WITH INVERTED MATH ─────────────────────────────────────────────
// This is the thing to get right, because the same card UI shows both:
//
//   SAVINGS      accumulates toward a target by a date.
//                pace = (progress %) ÷ (time elapsed %). >100 is GOOD.
//                "$620 of $3,000, and you're 41% of the pace you set."
//
//   SPEND LIMIT  a monthly ceiling.
//                pace = spend ÷ limit. >100 is BAD.
//                "$429 against a $320 ceiling."
//
// The seed uses two different status words for exactly this reason — "behind"
// for the savings goal, "over" for the spend limit. A single >100 check would
// congratulate someone for blowing their dining budget.

const GOAL_SAVINGS = "savings";
const GOAL_SPEND_LIMIT = "spend_limit";

/** Type is structural, not a stored flag: a period means a recurring ceiling. */
function goalType(goal) {
  return goal && goal.period ? GOAL_SPEND_LIMIT : GOAL_SAVINGS;
}

/**
 * A spend-limit goal tracks a live category rather than a stored number, so a
 * journal entry moves it (L17). The seed carries no category field, so it is
 * matched from the label once at boot — the same shaping the L11 observation
 * reframe does, and for the same reason: data/*.json stays verbatim.
 */
function goalInferCategory(goal) {
  if (goal.category) return goal.category;
  const label = String(goal.label || "").toLowerCase();
  return CATEGORIES.find(c => label.indexOf(c.toLowerCase()) !== -1) || null;
}

/** Current value — live from month-to-date for spend limits. */
function goalCurrent(goal) {
  if (goalType(goal) === GOAL_SPEND_LIMIT) {
    const cat = goalInferCategory(goal);
    if (cat) return catValue(state.mtd, cat);
  }
  return Number(goal.current) || 0;
}

/**
 * Pace, computed — never the stored pacePercent, which goes stale the moment
 * anything moves (same reasoning as the templated observation copy).
 */
function goalPace(goal) {
  const cur = goalCurrent(goal);
  const target = Number(goal.target) || 0;
  if (!target) return null;

  if (goalType(goal) === GOAL_SPEND_LIMIT) {
    return Math.round((cur / target) * 100);
  }

  // Savings: how far along you are, against how far along you should be.
  const elapsed = goalElapsedFraction(goal);
  const progress = cur / target;
  if (!elapsed) return Math.round(progress * 100);
  return Math.round((progress / elapsed) * 100);
}

/** 0–1 through the goal's window. Falls back to the seeded pace when undatable. */
function goalElapsedFraction(goal) {
  if (!goal.targetDate) return null;
  const end = new Date(goal.targetDate).getTime();
  const start = goal.startedAt ? new Date(goal.startedAt).getTime() : null;
  const now = Date.now();
  if (!end || !start || end <= start) return null;
  return Math.max(0.01, Math.min(1, (now - start) / (end - start)));
}

/**
 * ahead / on track / behind for savings; under / over for a spend limit.
 * Two vocabularies because they mean opposite things at the same number.
 */
function goalStatus(goal) {
  const pace = goalPace(goal);
  if (pace == null) return "unknown";
  if (goalType(goal) === GOAL_SPEND_LIMIT) {
    return pace > 100 ? "over" : (pace > 90 ? "close" : "under");
  }
  if (pace >= 110) return "ahead";
  if (pace >= 90) return "on track";
  return "behind";
}

/** Whether a status is the bad one — inverted between the two types. */
function goalStatusIsPoor(goal) {
  const s = goalStatus(goal);
  return s === "behind" || s === "over";
}

/**
 * Pace matters more than the raw figure (05-goals): "$620 of $3,000 means
 * little; 41% of the pace you set means something."
 */
function goalPaceLine(goal) {
  const pace = goalPace(goal);
  if (pace == null) return "";
  if (goalType(goal) === GOAL_SPEND_LIMIT) {
    return pace > 100
      ? pace - 100 + "% over your limit this month"
      : 100 - pace + "% of headroom left this month";
  }
  const s = goalStatus(goal);
  if (s === "ahead")    return pace + "% of the pace you set — ahead";
  if (s === "on track") return "right on the pace you set";
  return pace + "% of the pace you set";
}

// ── Event-based progress (05-goals) ──────────────────────────────────────────
// "Never ask someone to update a number directly. Ask something they actually
// know." The journal's q_balance emits a checking_balance event; savings goals
// consume it. The number moves as a CONSEQUENCE of an answer.

function goalsConsumeEvents() {
  const unread = (state.goalEvents || []).filter(e => !e.consumed);
  if (!unread.length) return 0;
  let applied = 0;

  unread.forEach(evt => {
    if (evt.kind === "checking_balance") {
      // A checking balance is evidence about savings-type goals, not spending.
      (state.tacticalGoals || []).forEach(g => {
        if (goalType(g) !== GOAL_SAVINGS) return;
        g.current = Math.max(0, Number(evt.amount) || 0);
        g.lastUpdatedFrom = "checking_balance";
        applied++;
      });
    }
    evt.consumed = true;
  });
  return applied;
}

// ── Contextual suggestions (05-goals) ────────────────────────────────────────
// "Goals mostly happen elsewhere. After a meaningful action the app offers one
// to three suggestions drawn from whatever is on screen. The last option is
// always create your own."
//
// Scoped: on the overall budget they span categories; inside a category they
// are specific to it.

const GOALS_IN_FLIGHT_CAP = 4;

/** True once enough goals are in flight — the CTA becomes "update your goals". */
function goalsAtCapacity() {
  return (state.tacticalGoals || []).length >= GOALS_IN_FLIGHT_CAP;
}

/**
 * 1–3 suggestions for a context, plus "create your own" last.
 * context: { source: "budget"|"journal"|"lesson", category? }
 */
function goalsSuggestFor(context) {
  const ctx = context || {};
  const have = (state.tacticalGoals || []).map(g => String(g.label).toLowerCase());
  const out = [];

  const push = (label, target, period, category) => {
    if (out.length >= 3) return;
    if (have.indexOf(label.toLowerCase()) !== -1) return;
    out.push({ label, target, period, category });
  };

  // Without a built budget there is no plan to aim at, so the peer benchmark is
  // the only honest reference. Same shape of suggestion, different yardstick —
  // still just the number and the gap, never an instruction (D26).
  const planless = typeof cmpHasPlan === "function" && !cmpHasPlan();

  if (ctx.category) {
    // Scoped to one category — specific, not spanning.
    if (planless) {
      const peer = cmpRow(ctx.category).peer;
      if (peer) push(`Keep ${ctx.category.toLowerCase()} under ${budgetFmt(peer)} a month`,
                     peer, "monthly", ctx.category);
    } else {
      const plan = catValue(state.plan, ctx.category);
      if (plan) push(`Keep ${ctx.category.toLowerCase()} under ${budgetFmt(plan)} a month`,
                     plan, "monthly", ctx.category);
    }
  } else if (planless) {
    // Overall, no plan: the categories furthest over peers.
    cmpAllRows()
      .filter(r => r.peer > 0 && r.vsPeer != null && r.vsPeer > 10)
      .sort((a, b) => b.vsPeer - a.vsPeer)
      .slice(0, 2)
      .forEach(r => push(`Keep ${r.category.toLowerCase()} under ${budgetFmt(r.peer)} a month`,
                         r.peer, "monthly", r.category));
  } else {
    // Overall: the categories with the biggest gap — over plan OR over peers —
    // so each suggestion is earned and tied to the comparison observations.
    const impact = r => Math.max(r.vsPlan || 0, r.vsPeer || 0);
    cmpAllRows()
      .filter(r => r.plan > 0 &&
                   ((r.vsPlan != null && r.vsPlan > 10) || (r.vsPeer != null && r.vsPeer > 10)))
      .sort((a, b) => impact(b) - impact(a))
      .slice(0, 2)
      .forEach(r => push(`Keep ${r.category.toLowerCase()} under ${budgetFmt(r.plan)} a month`,
                         r.plan, "monthly", r.category));
  }

  if (ctx.source === "journal") push("Log something every day this week", 7, "weekly", null);
  if (out.length < 1) push("Build a $1,000 cushion", 1000, null, null);

  return out;
}

function goalsAddSuggested(sug) {
  state.tacticalGoals.push({
    id: generateId("g"),
    label: sug.label,
    target: sug.target,
    current: sug.category ? catValue(state.mtd, sug.category) : 0,
    category: sug.category || null,
    period: sug.period || null,
    targetDate: sug.period ? null : goalsDefaultTargetDate(),
    startedAt: todayISO()
  });
  render();
}

function goalsDefaultTargetDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d.toISOString().slice(0, 10);
}

function goalsAddCustom(label, target) {
  if (!label) return;
  state.tacticalGoals.push({
    id: generateId("g"),
    label: label,
    target: Number(target) || 0,
    current: 0,
    category: null,
    period: null,
    targetDate: goalsDefaultTargetDate(),
    startedAt: todayISO()
  });
  state.goalDraft = null;
  render();
}

function goalsRemove(id) {
  state.tacticalGoals = (state.tacticalGoals || []).filter(g => g.id !== id);
  render();
}
