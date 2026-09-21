// ─── Budget band — the stylised box-and-whiskers track ───────────────────────
//
// One horizontal track carrying, at most, four marks:
//
//   the peer BAND     where households like you land — the peer figure +/-10%
//   the peer MEDIAN   a tick at the peer figure itself
//   the BUDGET        what you planned
//   the DOT           what you have actually spent (view), or what you are
//                     setting (build, where the dot is the slider thumb)
//
// It replaces the three stacked Budget / Peers / You bars everywhere they were
// rendered. Three bars state three numbers and leave the reader to do the
// arithmetic; one track puts them in a spatial relationship, which is the
// comparison the screen is actually for.
//
// ── HAND-ROLLED, IN CSS PERCENTAGES, NOT SVG ────────────────────────────────
// L1 rules out chart libraries, so this is built by hand like every other
// visualisation here (thermometer, badge-ring, renderMPTrend). It is the one
// that is NOT SVG, deliberately: a band track is a one-dimensional layout, and
// `left: %` inside a fluid container is exactly that, at any width, with the
// dot staying circular. An SVG would need either a fixed viewBox (wrong at
// 390px) or preserveAspectRatio="none" (which flattens the dot into an
// ellipse).
//
// ── THE SCALE IS FULL-MONTH, AND THAT IS A CHOICE ───────────────────────────
// Budget, peers and spend are all monthly figures, and spend-to-date is
// compared against them as-is. Early in the month that flatters the tester --
// five days in, nobody is over. The owner's call, for now: pro-rating is built
// (see bandScale) and switched off, so turning it on later is one constant.

// The owner's peer spread. Not researched dispersion -- a stated +/-10% around
// the modelled peer figure, so the band means "about what peers like you
// spend", never "the middle 50% of a real distribution". The copy on every
// surface has to stay inside that claim.
const BAND_PEER_SPREAD = 0.10;

// The 10% of breathing room past the largest mark, so nothing sits welded to
// the right edge.
const BAND_HEADROOM = 1.1;

// ── The pro-rate switch ──────────────────────────────────────────────────────
// Off: every figure is a full month and spend-to-date is compared against it.
// On:  the peer band and the budget mark scale to how far into the month we
//      are, so all three are "so far this month".
//
// Spend is NEVER scaled either way -- it is already a to-date figure, and
// scaling it would be counting the month twice.
const BAND_PRORATE = false;

function bandScale() {
  if (!BAND_PRORATE) return 1;
  return (typeof estimatorMonthFraction === "function") ? estimatorMonthFraction() : 1;
}

/**
 * Everything the track needs, as numbers. Pure -- no DOM, no state reads --
 * so the geometry can be asserted in a harness without stubbing a browser.
 *
 *   budget   the plan figure
 *   actual   spend to date (view mode only; 0 in build)
 *   peer     the modelled peer figure, or null when there isn't one
 *   hi       the track's right edge. Supply it in BUILD mode; omit it and the
 *            owner's view rule applies.
 *
 * ── THE RIGHT EDGE FITS EVERYTHING ON THE TRACK ─────────────────────────────
 * hi is 1.1 x the largest mark -- budget, spend, or the TOP OF THE PEER BAND.
 * Peers are in that max, so every mark is always visible with a tenth of the
 * track as breathing room past the highest one.
 *
 * This was briefly the other way round, with peers excluded so that a band
 * sitting above everything else would run off the edge and be marked. Against
 * the seeded persona that fired on five of twelve categories -- LA prices
 * against a modest budget -- so the chart drew nothing at all on nearly half
 * its rows. "Peers spend far more than you planned" is better said by a band
 * sitting hard right of the budget mark than by an empty track and a rule.
 *
 * ── WHY BUILD MODE STILL SUPPLIES ITS OWN ───────────────────────────────────
 * There the budget IS the value being dragged, so an edge computed from the
 * marks would move under the thumb -- the recoil that budgetSliderMax() was
 * written to kill (screens/budget-v3.js). Build passes that stable ceiling
 * instead. It is always well clear of the peer band (budgetSliderMax is at
 * least 2.2x the peer figure, against a band top of 1.1x), so peers stay on
 * screen there too -- a slider also needs somewhere to drag TO, which an edge
 * pinned to the current marks would not leave.
 */
function budgetBandGeometry(o) {
  const opts  = o || {};
  const scale = bandScale();

  const budget = Math.max(0, Number(opts.budget) || 0) * scale;
  const actual = Math.max(0, Number(opts.actual) || 0);          // never scaled
  const hasPeer = opts.peer != null && isFinite(Number(opts.peer)) && Number(opts.peer) > 0;
  const peer   = hasPeer ? Math.max(0, Number(opts.peer)) * scale : null;
  const peerLo = hasPeer ? peer * (1 - BAND_PEER_SPREAD) : null;
  const peerHi = hasPeer ? peer * (1 + BAND_PEER_SPREAD) : null;

  let hi = Math.max(0, Number(opts.hi) || 0);
  if (!hi) hi = BAND_HEADROOM * Math.max(budget, actual, peerHi || 0);
  hi = Math.max(hi, 1);

  const pct = v => (v == null ? null : Math.max(0, Math.min(100, (v / hi) * 100)));

  return {
    hi: hi,
    budget: budget, actual: actual,
    peer: peer, peerLo: peerLo, peerHi: peerHi,
    hasPeer: hasPeer,
    // A GUARD, not a designed state. With hi computed above nothing can
    // overflow -- but a caller supplying its own hi (build mode does) could
    // hand over one tighter than the peer band, and a band silently drawn to
    // the edge would read as "peers top out exactly here". So the overflow
    // stays detectable and marked wherever it comes from.
    clipped:      hasPeer && peerHi > hi,
    bandOffChart: hasPeer && peerLo >= hi,
    pct: {
      budget: pct(budget), actual: pct(actual),
      peer:   pct(peer),   peerLo: pct(peerLo), peerHi: pct(peerHi)
    }
  };
}

/**
 * The marks, without the track element around them -- so build mode can lay a
 * real <input type="range"> over exactly the same picture.
 */
function budgetBandMarks(g, opts) {
  const o = opts || {};
  const out = [];

  if (g.hasPeer && !g.bandOffChart) {
    const left  = g.pct.peerLo;
    const width = Math.max(1.5, g.pct.peerHi - g.pct.peerLo);
    out.push(`<span class="band-peer" style="left:${left}%;width:${width}%"></span>`);
    // The median only reads as a median while the band around it is visible.
    if (g.pct.peer > left && g.pct.peer < 100) {
      out.push(`<span class="band-peer-mid" style="left:${g.pct.peer}%"></span>`);
    }
  }

  // Peers run past the right edge. A gray rule at the edge says the track has
  // been cut rather than that peers happen to sit at the maximum -- without it
  // a clipped band is indistinguishable from one that merely reaches the end.
  if (g.clipped) out.push(`<span class="band-clip" aria-hidden="true"></span>`);

  if (o.showBudget !== false && g.budget > 0) {
    out.push(`<span class="band-budget" style="left:${g.pct.budget}%"></span>`);
  }
  if (o.showDot) {
    out.push(`<span class="band-dot" style="left:${g.pct.actual}%"></span>`);
  }
  return out.join("");
}

/**
 * A sentence describing the track, for the aria-label. A picture built out of
 * positioned <span>s has no text of its own, so without this the whole
 * comparison is silent to a screen reader.
 */
function budgetBandLabel(category, g, mode) {
  const money = v => (typeof budgetFmt === "function" ? budgetFmt(v) : String(Math.round(v)));
  const parts = [catLabel(category) + "."];
  if (mode === "build") {
    parts.push("Setting " + money(g.budget) + " a month.");
  } else {
    if (g.budget > 0) parts.push("Budget " + money(g.budget) + ".");
    parts.push("Spent " + money(g.actual) + " so far.");
  }
  if (g.hasPeer) {
    parts.push("Peers like you spend about " + money(g.peerLo) + " to " + money(g.peerHi) + ".");
    if (g.clipped) parts.push("That is above the top of this chart.");
  }
  return parts.join(" ");
}

/**
 * VIEW mode -- read-only. The dot is spend to date.
 *
 * opts: { category, budget, actual, peer }
 */
function renderBudgetBand(opts) {
  const o = opts || {};
  const g = budgetBandGeometry(o);
  return `
    <div class="band" role="img" aria-label="${h(budgetBandLabel(o.category, g, "view"))}">
      <div class="band-track">
        ${budgetBandMarks(g, { showDot: true })}
      </div>
    </div>`;
}

/**
 * BUILD mode -- the track IS the slider.
 *
 * A native <input type="range"> is laid over the marks with a transparent
 * track, so the band shows through and the thumb is the dot. That is not a
 * shortcut: hand-rolling the drag would mean re-implementing pointer capture,
 * keyboard stepping and focus, and the house rule about sliders
 * (debouncedRender, and a frozen max) already assumes a real range input.
 *
 * `max` is the caller's stable ceiling, and the SAME number is the track's
 * right edge -- so the thumb's own position and the marks underneath it are
 * measured on one scale. Two scales here would put the thumb somewhere other
 * than the figure it is showing.
 *
 * opts: { category, value, peer, max, oninput }
 */
function renderBudgetBandSlider(opts) {
  const o = opts || {};
  const max = Math.max(1, Math.round(Number(o.max) || 0));
  const value = Math.max(0, Math.min(max, Math.round(Number(o.value) || 0)));
  const g = budgetBandGeometry({ budget: value, actual: 0, peer: o.peer, hi: max });

  return `
    <div class="band band-build">
      <div class="band-track" aria-hidden="true">
        ${budgetBandMarks(g, { showBudget: false })}
      </div>
      <input class="band-range" type="range" min="0" max="${max}" step="5"
             value="${value}" ${o.disabled ? "disabled" : ""}
             oninput="${o.oninput || ""}"
             aria-label="${h(budgetBandLabel(o.category, g, "build"))}">
    </div>`;
}

/**
 * The running budget against income.
 *
 * Same grammar as the band — a rail, a fill, a reference mark — which is why it
 * lives here rather than in the builder: two bars stacked on one screen that
 * measure things differently would be read as measuring the same thing.
 *
 * The right edge follows the band's own rule, 1.1 x the larger of the two. That
 * matters more here than it looks: pinning the rail to income would cap the
 * fill at 100% the moment the budget crosses it, so every degree of overspend
 * from one dollar to one thousand would draw an identical full bar. The mark
 * moving left as the total grows is what makes the overrun legible.
 *
 * opts: { total, income, label }
 */
function renderBudgetTotalBar(opts) {
  const o = opts || {};
  const total  = Math.max(0, Number(o.total) || 0);
  const income = Math.max(0, Number(o.income) || 0);
  const hi = Math.max(1, BAND_HEADROOM * Math.max(total, income));
  const pct = v => Math.max(0, Math.min(100, (v / hi) * 100));
  const over = income > 0 && total > income;
  const left = income - total;

  return `
    <div class="bb-total">
      <div class="bb-total-head">
        <span class="bb-total-label">${h(o.label || "Budgeted so far")}</span>
        <p class="bb-total-value">${budgetFmt(total)}</p>
      </div>
      <div class="bb-total-bar" role="img"
           aria-label="${h(budgetFmt(total) + " budgeted against " + budgetFmt(income) + " coming in.")}">
        <span class="bb-total-fill ${over ? "over" : ""}" style="width:${pct(total)}%"></span>
        ${income > 0 ? `<span class="bb-total-mark" style="left:${pct(income)}%"></span>` : ""}
      </div>
      <div class="bb-total-foot">
        <span class="${over ? "over" : ""}">
          ${income <= 0
            ? "&nbsp;"
            : (left >= 0
                ? budgetFmt(left) + " left over each month"
                : budgetFmt(Math.abs(left)) + " more than you bring in")}
        </span>
        <span>${budgetFmt(income)} coming in</span>
      </div>
    </div>`;
}

/**
 * The legend. Written once, because four surfaces render bands and each one
 * describing the colours in its own words is how they drift apart.
 *
 * D23 -- peers are a calculated aggregate, never real user data, and the note
 * says so wherever the band appears.
 */
function renderBudgetBandLegend(opts) {
  const o = opts || {};
  return `
    <div class="card cmp-legend">
      ${o.hasPlan ? `<div><span class="band-key band-key-budget"></span>Your budget</div>` : ""}
      <div><span class="band-key band-key-peer"></span>Peers like you</div>
      ${o.showDot === false ? "" : `<div><span class="band-key band-key-you"></span>What you told me</div>`}
      <p class="helper" style="margin:10px 0 0;font-size:10px;">
        The shaded stretch is roughly where peers like you land — public
        spending data for households your size and income, adjusted for where
        you live. Not real people, and not a target.
      </p>
    </div>`;
}
