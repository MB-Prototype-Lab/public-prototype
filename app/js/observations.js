// ─── Observations (D18, architecture §6) ─────────────────────────────────────
// The four seeded observations live in state.observations, and every screen
// that shows one renders it through the copy helpers below. Each carries the
// seed's `surfaces` tags, but code reads only two of them: journalDone picks
// its cards by budget_comparison and progress. The other screens show the
// observations in seed order. D18 (reachable from ≥2 screens) is checked on
// the rendered screens by sweep §3.

/** Observations that name this surface, in seed order. */
function observationsFor(surface) {
  return (state.observations || []).filter(o =>
    Array.isArray(o.surfaces) && o.surfaces.indexOf(surface) !== -1);
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

// ── Copy ─────────────────────────────────────────────────────────────────────
// Templated, so the number and the sentence can never disagree.
//
// Voice rules that bind here (D26): no financial advice, ever — surface
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
  if (o.type === "plan_gap") {
    return o.gapPercent == null ? null : (o.gapPercent > 0 ? "+" : "") + o.gapPercent + "%";
  }
  if (o.type === "bill_flag") return budgetFmt ? budgetFmt(o.amount) : "$" + o.amount;
  if (o.type === "goal_pace") return o.pacePercent + "%";
  return null;
}
