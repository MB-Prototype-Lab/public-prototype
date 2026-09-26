// ─── Three-layer comparison (D24, 04-budget-benchmarks) ──────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Visible
//
//   Plan          state.plan     "Your plan"        what you intended
//   Self-reported state.mtd      "What you told me" what you think happened
//   Automated     —              not in prototype   what actually happened
//
// "Never blur these. The gaps between them are the product."
//
// TWO DIFFERENT GAPS exist for the same category and neither may stand in for
// the other. 04-budget-benchmarks names this as a trap:
//
//   over your plan   $429 against a $320 budget  = 34%
//   over your peers  $429 against a $370 peer    = 16%
//
// So every row labels both, and the figures are computed — never the seed's
// baked strings, which go stale the moment a tester logs anything (L17).

// A gap is worth surfacing when it is proportionally large AND materially big.
// Percentage alone flags $6 on a $4 category; dollars alone flags Housing for
// being Housing.
const CMP_PCT_THRESHOLD = 15;
const CMP_ABS_THRESHOLD = 25;

// The plan layer only exists once the user has actually built one. state.plan
// stays seeded with the persona's figures from bootV3 regardless, so without
// this gate every "vs your plan" figure grades the user against a budget they
// were told (on the budget tab) they do not have — and against a different
// household's numbers at that. One chokepoint: everything downstream reads
// hasPlan / vsPlan and degrades to peers-only on its own.
function cmpHasPlan() {
  return state.planStatus === "complete";
}

function cmpRow(category) {
  const hasPlan = cmpHasPlan();
  const plan = hasPlan ? catValue(state.plan, category) : 0;
  const user = catValue(state.mtd, category);
  const peer = benchPeerValue(category, benchOptsForUser());
  return {
    category: category,
    hasPlan: hasPlan,
    plan: plan,
    user: user,
    peer: peer,
    vsPlan: (hasPlan && plan) ? Math.round(((user - plan) / plan) * 100) : null,
    vsPeer: peer ? Math.round(((user - peer) / peer) * 100) : null
  };
}

function cmpAllRows() {
  return CATEGORIES.map(cmpRow);
}

// ─── "Worth a look" means OVER peers, not far from them ──────────────────────
// This used Math.abs on both the gap and the ranking, so a category far BELOW
// peers scored exactly like one far above. Against a persona who is under peers
// almost everywhere — which the seeded one is, LA prices against a modest
// budget — the section filled with the biggest UNDER-spends and presented them
// as things to look at.
//
// Signed now, and peers-only. A category over your own plan but under peers no
// longer qualifies; both gaps are still on the card, labelled distinctly, so
// L11 holds — what changed is which rows earn a card, not what a card says.
function cmpWorthNoticing(r) {
  if (r.peer == null) return false;
  const over = r.user - r.peer;
  // Both gates, as before: dollars stop a $6 gap on a $4 category qualifying,
  // percent stops Housing qualifying for being Housing.
  return over >= CMP_ABS_THRESHOLD &&
         r.vsPeer != null && r.vsPeer >= CMP_PCT_THRESHOLD;
}

// Impact is measured in DOLLARS, not percent. A percentage ranking puts a $9
// swing on a $30 category above a $180 swing on Housing, which is the opposite
// of "the top dollar areas" — the gap worth surfacing is the one moving real
// money. The percentage thresholds above still decide what QUALIFIES; this only
// decides the order.
// Dollars OVER peers, descending. Signed for the same reason as the filter —
// and dollars rather than percent, because a percentage ranking puts a $9 swing
// on a $30 category above a $180 swing on Housing.
function cmpImpact(r) {
  return r.peer == null ? 0 : (r.user - r.peer);
}

function renderComparison() {
  return `
    <h1 class="title" style="margin:0 0 4px;font-size:20px;">Where it's going</h1>
    <p class="helper" style="margin:0 0 14px;">
      ${cmpHasPlan()
        ? "Three ways of looking at the same month. The differences are the interesting part."
        : "Two ways of looking at the same month. Build a budget and your plan joins the picture."}
    </p>
    ${renderComparisonBody()}
  `;
}

/**
 * Legend + "Worth a look" + all twelve. Shared, because the Budget tab IS this
 * view once a budget exists — the tab used to render twelve sliders, an editing
 * surface, where the review surface belongs. Sliders still live on the
 * per-category screen and in the wizard.
 */
function renderComparisonBody() {
  const rows = cmpAllRows();
  // Cap at 3 — a short list of the biggest dollar gaps, each with a path in.
  const flagged = rows.filter(cmpWorthNoticing)
    .sort((a, b) => cmpImpact(b) - cmpImpact(a))
    .slice(0, 3);

  return `
    ${renderComparisonSpendBanner()}
    ${renderBudgetBandLegend({ hasPlan: cmpHasPlan() })}

    ${flagged.length ? `
      <div class="section-title" style="margin:18px 0 4px;">Worth a look</div>
      <p class="helper" style="margin:0 0 8px;font-size:11px;">
        The categories where the biggest dollars are moving. Same three bars as
        below — your budget, peers, and what you've told me.
      </p>
      ${flagged.map(r => renderComparisonFlag(r)).join("")}
    ` : ""}

    <div class="section-title" style="margin:18px 0 8px;">All categories</div>
    ${rows.map(r => renderComparisonRow(r)).join("")}
  `;
}

/**
 * "You have not told me anything yet" — the banner above the whole list.
 *
 * Every band on the screen below can draw a budget and a peer range without
 * the tester having logged a thing, and every dot sits on zero. That is a
 * chart full of shapes saying nothing, and it looks like the app has decided
 * they spent nothing rather than that it has not been told.
 *
 * Owner's requirement: when no spend is registered, say so at the top and give
 * one route into the Money Journal. Gated on the WHOLE month being empty — a
 * per-category version of this would put a banner over eleven categories the
 * moment somebody logs one.
 */
function renderComparisonSpendBanner() {
  if (catTotal(state.mtd) > 0) return "";
  return `
    <div class="card cmp-nospend cmp-nospend-banner">
      <p class="task-title" style="margin:0 0 4px;">Track what you actually spend</p>
      <p class="task-desc" style="margin:0 0 12px;">
        Your budget is set and I know roughly where peers like you land. The
        missing piece is what is really happening — that comes from your Money
        Journal, a few quick questions at a time.
      </p>
      <button class="button full" type="button" onclick="mpStartUpdate()">
        Start my Money Journal ›
      </button>
    </div>`;
}

// ─── One category, on one track ──────────────────────────────────────────────
// Was three stacked bars. Three bars state three numbers and leave the reader
// to work out the relationship; the band puts them in one, which is the
// comparison the screen exists for.
//
// What does NOT change: both gaps still appear, still labelled distinctly.
// L11 is explicit that "34% over your plan" and "16% over peers" are different
// claims about the same category and neither may stand in for the other — the
// picture makes the relationship obvious, the pills keep it precise.
function renderComparisonRow(r) {
  return `
    <div class="card cmp-row">
      <div class="row" style="align-items:baseline;margin-bottom:12px;">
        <span class="budget-row-name">${h(catLabel(r.category))}</span>
        <span class="helper" style="font-size:11px;">${budgetFmt(r.user)} so far</span>
      </div>

      ${cmpBandCaption(r)}
      ${renderBudgetBand({ category: r.category, budget: r.plan, actual: r.user, peer: r.peer })}

      <div class="cmp-gaps">
        ${cmpGapPill(r.vsPlan, "vs your budget")}
        ${cmpGapPill(r.vsPeer, "vs peers")}
      </div>
    </div>
  `;
}

/**
 * The figures the track cannot state itself.
 *
 * A band is a position, not a number, so the caption carries the two the
 * tester would otherwise have to guess at. It also has to say when the peer
 * band ran off the right edge — the gray rule shows that the track was cut,
 * but only words can say what was cut off, and "peers are above this chart"
 * is one of the more interesting things the comparison can report.
 */
function cmpBandCaption(r) {
  const g = budgetBandGeometry({ budget: r.plan, actual: r.user, peer: r.peer });
  const peers = !g.hasPeer ? "—"
    : `${budgetFmt(g.peerLo)}–${budgetFmt(g.peerHi)}`;
  return `
    <div class="band-caption">
      ${r.hasPlan
        ? `<span>Budget <strong>${budgetFmt(r.plan)}</strong></span>`
        : `<span>No budget yet</span>`}
      <span>${g.clipped ? "Peers sit above this chart — " : "Peers "}<strong>${h(peers)}</strong></span>
    </div>`;
}

// The label is half the point — an unlabelled percentage is the trap.
function cmpGapPill(pct, label) {
  if (pct == null) return "";
  const over = pct > 0;
  const cls = Math.abs(pct) < CMP_PCT_THRESHOLD ? "pill" : (over ? "pill pill-warn" : "pill pill-good");
  return `<span class="${cls}" style="font-size:9px;padding:2px 7px;">
            ${over ? "+" : ""}${pct}% ${h(label)}
          </span>`;
}

// A category worth a look: the same three bars as the list below, so the two
// sections read identically, plus the dollar gap and a path in. States the
// number and the gap; never prescribes an action (D26 — no financial advice).
function renderComparisonFlag(r) {
  const overPeer = r.peer != null && r.user > r.peer;
  const gap = cmpImpact(r);
  return `
    <div class="card cmp-row cmp-flag">
      <div class="row" style="align-items:baseline;margin-bottom:12px;">
        <span class="budget-row-name">${h(catLabel(r.category))}</span>
        <span class="obs-figure">${overPeer ? "+" : ""}${budgetFmt(gap)}</span>
      </div>

      ${cmpBandCaption(r)}
      ${renderBudgetBand({ category: r.category, budget: r.plan, actual: r.user, peer: r.peer })}

      <div class="cmp-gaps">
        ${cmpGapPill(r.vsPlan, "vs your budget")}
        ${cmpGapPill(r.vsPeer, "vs peers")}
      </div>

      <button class="button secondary full" style="font-size:12px;padding:8px 14px;margin-top:10px;"
              type="button" onclick="goToCategory('${h(r.category).replace(/'/g, "\\'")}')">
        Look into ${h(catLabel(r.category))} ›
      </button>
    </div>
  `;
}

function cmpFlagBar(r, v, cls) {
  const max = Math.max(r.plan, r.user, r.peer || 0, 1);
  return `<div class="cmp-bar"><span class="${cls}" style="width:${Math.max(2, (v / max) * 100)}%"></span></div>`;
}

// ─── Compact strip for My Progress (07-progress-bills) ───────────────────────
// "Same data as the budget tab, framed for review rather than editing."
function renderComparisonCompact(limit) {
  const rows = cmpAllRows()
    .filter(r => r.user > 0)
    .sort((a, b) => Math.abs(b.vsPlan || 0) - Math.abs(a.vsPlan || 0))
    .slice(0, limit || 5);

  // Every category is silent. Nothing has been logged, so there is no strip to
  // draw — and D19 forbids rendering the empty one. The prompt IS the content
  // here, and it is the only route from "I can see the gap" to closing it.
  if (!rows.length) return renderComparisonNoSpend();

  return `
    ${rows.map(r => `
      <div class="cmp-compact-band">
        <div class="row" style="align-items:baseline;margin-bottom:8px;">
          <span class="cmp-compact-name">${h(catLabel(r.category))}</span>
          <span class="helper" style="font-size:11px;">${budgetFmt(r.user)} so far</span>
          ${cmpGapPill(r.vsPlan, "vs budget")}
        </div>
        ${cmpBandCaption(r)}
        ${renderBudgetBand({ category: r.category, budget: r.plan, actual: r.user, peer: r.peer })}
      </div>
    `).join("")}
    <button class="button secondary full" style="margin-top:12px;" type="button"
            onclick="navGoTabRoot('aboutMe')">See all twelve</button>
  `;
}

/**
 * Nothing logged yet.
 *
 * The band can draw a budget and a peer range with no spend at all, but the
 * dot — the whole reason to look — would sit on zero, which reads as "you have
 * spent nothing" rather than "you have not told me yet". So the prompt
 * replaces the chart rather than sitting under it.
 *
 * mpStartUpdate() is the existing entry point (screens/my-progress.js). It
 * clears state.activeTaskId before opening the journal, which matters: without
 * that, an abandoned bookmark task gets completed and pays out its bones for a
 * flow the tester never started. Reuse it rather than writing a second door.
 */
function renderComparisonNoSpend() {
  return `
    <div class="cmp-nospend">
      <p class="task-title" style="margin:0 0 4px;">Nothing tracked yet</p>
      <p class="task-desc" style="margin:0 0 12px;">
        Your budget and where peers like you land are both here — what is
        missing is you. A few quick questions in your Money Journal and these
        fill in.
      </p>
      <button class="button full" type="button" onclick="mpStartUpdate()">
        Start my Money Journal ›
      </button>
    </div>`;
}

function renderComparisonAdmin() {
  const rows = cmpAllRows();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Three Layers</p>
      <p class="helper" style="margin-bottom:10px;">
        Flagged when |gap| ≥ ${CMP_PCT_THRESHOLD}% AND the difference is ≥
        ${budgetFmt(CMP_ABS_THRESHOLD)} — percentage alone flags trivial
        categories, dollars alone flags Housing for being Housing.
      </p>
      <div class="helper" style="line-height:1.9;">
        ${rows.map(r => `
          ${h(catLabel(r.category))}: ${budgetFmt(r.plan)} / ${budgetFmt(r.user)} / ${r.peer == null ? "—" : budgetFmt(r.peer)}
          ${cmpWorthNoticing(r) ? "<strong>⚑</strong>" : ""}
        `).join("<br>")}
      </div>
    </div>
  `;
}
