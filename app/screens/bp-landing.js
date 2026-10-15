// Answer the emergency-fund question in place before choosing a purchase.
// The Goals tab retains entry and ESF-return cards for this tool.

/** Open the tool fresh. Every door into it comes through here. */
function bpOpen() {
  bpStart("vehicle");
  go("bpLanding");
}

/* Has the tester already created or reported an emergency fund? */
function bpEsfAnswered() {
  if (state.esfSelfReported) return true;
  if (state.esfGoal) return true;
  return (state.tacticalGoals || []).some(g =>
    typeof esfLooksLikeEsfGoal === "function" && esfLooksLikeEsfGoal(g));
}

/**
 * Show the fund box? Decided once per run: somebody who already has a fund
 * (or already said so) is not asked again. Once the box is shown it stays for
 * the rest of the run, so the answer they just gave stays visible and changeable.
 */
function bpEsfBoxShown() {
  const s = bpSession();
  if (s.esfBox == null) s.esfBox = !bpEsfAnswered();
  return s.esfBox;
}

function bpPickCategory(id) {
  const s = bpSession();
  if (id !== "vehicle") return;          // the rest are named, not built
  s.category = id;
  bpLog("bp_landing_pick", { category: id, esfAnswer: s.esfAnswer || null });
  // The finder comes first, then Your car.
  bpfOpen();
}

/* Start One Now opens ESF and records a return flag for Back to your car.
 * The other answers remain on the landing. */
function bpEsfCheck(choice) {
  const s = bpSession();
  bpEsfBoxShown();
  bpLog("bp_esf_check", { choice: choice });
  s.esfAnswer = choice;
  // null = "Change" on the collapsed card: put the question back, and take the
  // self-reported flag with it if this box is what set it.
  if (choice == null) {
    if (state.esfSelfReported && state.esfSelfReported.via === "bigPurchase") state.esfSelfReported = null;
    s.esfDeferred = false;
    render();
    return;
  }
  if (choice === "have") {
    state.esfSelfReported = { at: todayISO(), via: "bigPurchase" };
    s.esfDeferred = false;
    render();
    return;
  }
  if (choice === "after") {
    if (state.esfSelfReported && state.esfSelfReported.via === "bigPurchase") state.esfSelfReported = null;
    s.esfDeferred = true;
    render();
    return;
  }
  // startFirst
  s.esfReturn = true;
  if (typeof esfStart === "function") esfStart();
}

/** "Back to your car" — resumes the SAME session; nothing typed is lost. */
function bpResumeAfterEsf() {
  const s = bpSession();
  s.esfReturn = false;
  go(s.category ? "bpFinder" : "bpLanding");
}

/**
 * Back from the landing returns to whatever opened it (the Goals card or the
 * Tools jump list).
 */
function bpLandingBack() {
  navBack();
}

// Use the supplied category tiles without redrawing them. Each includes
// its colored plate and corners; coming-soon rows dim the whole image.
const BP_CATEGORY_ICONS = {
  vehicle: "assets/cat-vehicle.png",
  boatRv:  "assets/cat-boatrv.png",
  home:    "assets/cat-home.png",
  trip:    "assets/cat-trip.png",
  other:   "assets/cat-other.png"
};

function bpCategoryIcon(id) {
  const src = BP_CATEGORY_ICONS[id];
  if (!src) return "";
  return '<img class="bp-cat-icon" src="' + h(src) + '" alt="" aria-hidden="true">';
}

const BP_LANDING_ROWS = [
  { id: "vehicle", label: "A vehicle" },
  { id: "boatRv",  label: "A boat or RV", soon: true },
  { id: "home",    label: "A home", soon: true },
  { id: "trip",    label: "A vacation", soon: true },
  { id: "other",   label: "Something else", soon: true }
];

// Give all three answers equal weight so none reads as preselected.
const BP_ESF_CHOICES = [
  // Keep labels without sub-lines to leave room for the question.
  { id: "have",       label: "Yes" },
  { id: "startFirst", label: "Start One Now" },
  { id: "after",      label: "Ask me later" }
];

/* Put the fund question before purchase selection. Yes and Ask me later
 * collapse it in place; Start One Now opens the fund journey. */
function renderBpEsfBox() {
  if (!bpEsfBoxShown()) return "";
  const s = bpSession();
  const chosen = BP_ESF_CHOICES.find(c => c.id === s.esfAnswer);
  if (chosen) {
    const said = { have: "You have an emergency fund.",
                   startFirst: "You're starting an emergency fund first.",
                   after: "You'll look at an emergency fund after this." }[chosen.id];
    return `
      <div class="bp-esf-box bp-esf-done">
        <p class="bp-esf-said"><span aria-hidden="true">&#10003;</span> ${h(said)}</p>
        <button class="bp-link" type="button" onclick="bpEsfCheck(null)">Change</button>
      </div>`;
  }
  // A dashed border and accent spine signal an unanswered question.
  // A solid confirmation with a tick makes the tester's choice visible.
  return `
    <div class="bp-esf-box bp-esf-ask">
      ${/* Explain why the fund question relates to the purchase before asking it. */ ""}
      <p class="bp-esf-eyebrow">Before you buy</p>
      <p class="bp-esf-why">A big purchase adds a new monthly bill, so it may help to have an
         Emergency Savings Fund first.</p>
      <p class="bp-esf-why">It helps pay your bills in hard times.</p>
      <p class="bp-esf-q">Do you have an Emergency Savings Fund?</p>
      <div class="bp-esf-opts">
        ${BP_ESF_CHOICES.map(c => `
          <button class="bp-esf-opt" type="button" onclick="bpEsfCheck('${c.id}')">
            <span class="bp-esf-opt-label">${h(c.label)}</span>
            ${c.sub ? `<span class="bp-esf-opt-sub">${h(c.sub)}</span>` : ""}
          </button>`).join("")}
      </div>
    </div>`;
}

function renderBpLanding() {
  return `
    <div class="journal-shell onb-pinned bp-land-shell">
      <div class="journal-head">
        ${ ""}
        ${ ""}
        <h1 class="title esf-title bp-land-title">Thinking about a big purchase?</h1>
      </div>

      <div class="journal-body">
        <p class="bp-lead">We'll show you what it really costs to own, and help you find the one that fits your life.</p>
        ${renderBpEsfBox()}
        ${/* Keep the category list as one block so space-between places it within
         * thumb reach at the bottom. */ ""}
        <div class="bp-land-pick">
        <p class="bp-q-label">What are you thinking about buying?</p>
        <div class="bp-stack">
          ${BP_LANDING_ROWS.map(r => `
            <button class="bp-cat" type="button" ${r.soon ? "disabled aria-disabled=\"true\"" : ""}
                    onclick="bpPickCategory('${r.id}')">
              ${bpCategoryIcon(r.id)}
              <span class="bp-cat-label">${h(r.label)}</span>
              <span class="bp-cat-mark">${r.soon ? "Coming soon" : "&rsaquo;"}</span>
            </button>`).join("")}
        </div>
        </div>
      </div>

      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="bpLandingBack()">Back</button>
        ${renderBpBuddyButton()}
        <span></span>
      </div>
    </div>`;
}

function renderBpLandingAdmin() {
  return renderBpAdminCommon();
}

// ── Goals-tab surfaces ───────────────────────────────────────────────────────

/** Rendered by renderGoalsV3 above the tracked goals. */
function renderBpGoalsCards() {
  const out = [];
  const s = state.bp;

  if (s && s.esfReturn && bpEsfAnswered()) {
    out.push(`
      <div class="card bp-goal-card">
        <p class="task-title" style="margin:0 0 4px;">Your emergency fund is set</p>
        <p class="helper" style="margin:0 0 10px;">Pick up where you left off with the car.</p>
        <button class="button full" type="button" onclick="bpResumeAfterEsf()">Back to your car</button>
      </div>`);
  }

  out.push(`
    <button class="card bp-entry" type="button" onclick="bpOpen()">
      <span>
        <span class="task-title" style="display:block;margin:0 0 2px;">Estimate a big purchase</span>
        <span class="helper" style="display:block;margin:0;">What it really costs to own, and cheaper options.</span>
      </span>
      <span class="bp-cat-mark" aria-hidden="true">&rsaquo;</span>
    </button>`);

  return out.join("");
}

// ── Admin, shared by every bp screen ─────────────────────────────────────────

function renderBpAdminCommon() {
  const events = (state.bpEvents || []).slice(-10).reverse();
  const bp = state.bigPurchase;
  return `
    ${bp ? `
      <div class="admin-card">
        <p class="admin-card-title">Saved plan</p>
        <p class="helper">${h(bp.noun)} · ${h(bp.payMode)} · to save ${h(bpMoney(bp.toSave))}
          by ${h(bp.purchaseDate)}</p>
      </div>` : ""}
    <div class="admin-card">
      <p class="admin-card-title">Big purchase log (${(state.bpEvents || []).length})</p>
      ${events.length
        ? events.map(e => `<p class="helper">${h(e.at)} · <code>${h(e.event)}</code> ${h(JSON.stringify(e.detail))}</p>`).join("")
        : `<p class="helper">Nothing logged yet. In-memory only — it resets on refresh (D03).</p>`}
    </div>`;
}
