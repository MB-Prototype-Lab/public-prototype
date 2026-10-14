// ─── Observation registry (D18, architecture §6) ─────────────────────────────
// Screens ASK the registry what to show; they never hardcode an observation.
// That is what makes the Phase 6 "reachable from ≥2 screens" check mechanical
// rather than a hunt, and it means adding a surface is a data edit.
//
// Seven surface names are in use. They are regions, not screen ids — My
// Progress queries two of them.
//
//   home_tip · home_task · budget_comparison · progress · progress_bills
//   goals    · daily_update

/** Observations that name this surface, in seed order. */
function observationsFor(surface) {
  return (state.observations || []).filter(o =>
    Array.isArray(o.surfaces) && o.surfaces.indexOf(surface) !== -1);
}

function observationById(id) {
  return (state.observations || []).find(o => o.id === id) || null;
}

// ── Live figures ─────────────────────────────────────────────────────────────
// L17: a submitted journal entry moves month-to-date, so anything derived from
// it must be COMPUTED, not stored. The seed ships authored strings with baked
// figures ("34% above…") which go stale on the first entry.

/** Percent over a reference, rounded. Null when the reference is unusable. */
function obsPercentOver(actual, reference) {
  if (!reference) return null;
  return Math.round(((actual - reference) / reference) * 100);
}

/**
 * Recompute every derived value. Called after boot and after each journal
 * submit. Only touches fields the app derives — authored copy that does not
 * contain a figure is left alone.
 */
function observationsRecompute() {
  (state.observations || []).forEach(o => {
    if (o.type === "plan_gap" && o.category) {
      o.userValue = catValue(state.mtd, o.category);
      o.planValue = catValue(state.plan, o.category);
      o.gapPercent = obsPercentOver(o.userValue, o.planValue);
    }
    if (o.type === "subscription_flag" && o.subscription) {
      const sub = (state.subs || []).find(s => s.name === o.subscription);
      if (sub) {
        o.weeksSinceMention = sub.weeksSinceMention;
        o.resolved = sub.status === "active_used" && sub.lastMentionedDay >= journalDayIndex();
      }
    }
  });
}

/**
 * The peer-comparison counterpart to the seeded plan_gap (L11). Both framings
 * must appear and be labelled distinctly — "over your plan" and "over your
 * peers" are different numbers for the same category, and neither may stand in
 * for the other. 04-budget-benchmarks calls this out as a trap.
 *
 * Returns null when the peer model has nothing for the category.
 */
function observationPeerCounterpart(o) {
  if (!o || !o.category) return null;
  const peer = benchPeerValue(o.category, benchOptsForUser());
  if (peer == null) return null;
  const user = catValue(state.mtd, o.category);
  return {
    id: o.id + "__peer",
    type: "peer_gap",
    comparedTo: "peers",
    category: o.category,
    userValue: user,
    peerValue: peer,
    gapPercent: obsPercentOver(user, peer),
    headline: "You're spending more on dining out than your peers",
    surfaces: ["budget_comparison", "progress"]
  };
}

// ── Copy ─────────────────────────────────────────────────────────────────────
// Templated, so the number and the sentence can never disagree.
//
// Voice rules that bind here (A13, D26): no financial advice, ever — surface
// the number and the gap, never prescribe the action. Flags are framed as
// questions, not instructions. No exclamation marks on a financial figure.

function observationDetail(o) {
  if (!o) return "";

  if (o.type === "plan_gap") {
    const pct = o.gapPercent;
    if (pct == null) return o.detail || "";
    if (pct <= 0) return "You're within your plan for this month.";
    return pct + "% above your own budget for this month.";
  }

  if (o.type === "peer_gap") {
    const pct = o.gapPercent;
    if (pct == null) return o.detail || "";
    if (pct <= 0) return "That's in line with households like yours in your area.";
    return pct + "% above what households like yours spend in your area.";
  }

  if (o.type === "subscription_flag") {
    if (o.resolved) return "Heard about " + h(o.subscription) + " today — flag cleared.";
    const w = o.weeksSinceMention;
    const amt = o.monthlyAmount != null ? " It's $" + o.monthlyAmount + " a month." : "";
    return "You haven't mentioned watching anything on " + o.subscription +
           (w ? " in " + w + " weeks." : " in a while.") + amt;
  }

  return o.detail || "";
}

function observationHeadline(o) {
  if (!o) return "";
  if (o.type === "subscription_flag" && o.resolved) {
    return "Back in the rotation";
  }
  return o.headline || "";
}

/** The figure a card should lead with, or null when there isn't one. */
function observationFigure(o) {
  if (!o) return null;
  if (o.type === "plan_gap" || o.type === "peer_gap") {
    return o.gapPercent == null ? null : (o.gapPercent > 0 ? "+" : "") + o.gapPercent + "%";
  }
  if (o.type === "bill_flag") return budgetFmt ? budgetFmt(o.amount) : "$" + o.amount;
  if (o.type === "goal_pace") return o.pacePercent + "%";
  return null;
}
