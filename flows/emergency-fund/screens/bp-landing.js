// ─── Big Purchase — landing (with the emergency fund question) ───────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
// Spec §4 and §5, as revised by the owner (2026-09-22): the fund question is
// NOT its own screen. It is a highlighted box at the bottom of the landing,
// answered in place, so picking what to buy is never held up behind it.
//
// Also home to the Goals-tab surfaces the tool leaves behind: the entry card,
// "Back to your car" after an ESF detour, and the two budget reminders (§8).

// ── Entry ────────────────────────────────────────────────────────────────────

/** Open the tool fresh. Every door into it comes through here. */
function bpOpen() {
  bpStart("vehicle");
  go("bpLanding");
}

/** Already answered the fund question, one way or the other? (§5) */
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
  // The finder comes first now (owner, 2026-09-29); steps 1–4 follow it.
  bpfOpen();
}

/**
 * The fund box's three answers.
 *
 * "Start mine first" hands over to the ESF and parks a flag, so when the fund
 * is committed the Goals tab offers "Back to your car" (renderBpGoalsCards).
 * The other two answer in place and leave the tester on the landing.
 */
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
 * Back from the landing. Arrived from onboarding → the question they left it
 * on, answers intact (owner's call: the demographics, not the Goals tab).
 * Arrived from the Goals card → the Goals card.
 */
function bpLandingBack() {
  const s = bpSession();
  const o = state.bpOnbReturn;
  if (s.fromOnboarding && o && typeof ONB_STEPS !== "undefined") {
    o.step = Math.max(0, Math.min(ONB_STEPS.length - 1, o.step || 0));
    state.onboarding = o;
    state.bpOnbReturn = null;
    state.nav.activeStack = "home";
    state.nav.stacks.home = ["onboarding"];
    navCommit("onboarding");
    return;
  }
  navBack();
}

// ── Render ───────────────────────────────────────────────────────────────────

// ── Category icons ───────────────────────────────────────────────────────────
// THE OWNER'S OWN ARTWORK (2026-09-27), not drawn here. Three rounds of hand-
// built icons were rejected — emoji ("janky and old"), flat line icons, then
// two-tone SVG silhouettes ("the icons continue to look like shit") — and the
// owner ended the argument by supplying the set they wanted: "use the ones
// here". These five files are that image, sliced into its tiles, and that is
// the whole story. Do not redraw them.
//
// Each file carries its own coloured plate and rounded corners, so the row
// renders the image and nothing else; the CSS plate that backed the SVGs is
// gone. A coming-soon row still dims the whole thing with opacity.
//
// `assets/` is new for these. Everything else the app ships lives under
// `assets/img`, `audio` or `video`; these sit at the top of it because they
// belong to a screen rather than to the buddy or a lesson.
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

// THREE SIDE-BY-SIDE BUTTONS, equal columns. "Start One Now" is the one drawn
// as a primary — owner's call to highlight it. That is a visual weight, not a
// recommendation: the copy still asks a question and all three answers are one
// tap from here.
const BP_ESF_CHOICES = [
  // No sub-lines (owner, 2026-09-27). Three labels, nothing under them: the
  // options do not need explaining and the box has to hold one line for its
  // question.
  { id: "have",       label: "Yes" },
  { id: "startFirst", label: "Start One Now" },
  { id: "after",      label: "Ask me later" }
];

/**
 * The fund box. AT THE TOP of the landing (owner, 2026-09-27) — it is the
 * decision worth making before picking anything, and at the bottom it was
 * something you scrolled past on the way out.
 *
 * Answering does NOT navigate: the card collapses to a one-line confirmation
 * and the tester still picks a category themselves.
 */
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
  // ── WHY THIS LOOKS THE WAY IT DOES (owner, 2026-09-27) ───────────────────
  // "This doesn't indicate a user should make a selection. It looks like it's
  // preselected and something will happen, but nothing does… having the start
  // one now selected in green isn't working."
  //
  // Exactly right, and it was my doing: one tinted button among three plain
  // ones is the universal look of a CHOSEN option, so the box read as answered
  // and the tester walked past it into the car. Three things changed:
  //
  //   1. NO HIGHLIGHTED ANSWER. All three are identical, so none of them can
  //      be mistaken for a selection already made. (The `strong` flag is gone
  //      from the data, not just from the CSS.)
  //   2. AN INSTRUCTION, NOT A HINT. A small "TAP ONE TO CONTINUE" eyebrow
  //      above the question says what to do in four words.
  //   3. THE BOX LOOKS UNFINISHED. A dashed border and an accent spine down
  //      the left read as something outstanding; the answered state is solid,
  //      with a tick. The tester can see the state change they make.
  return `
    <div class="bp-esf-box bp-esf-ask">
      ${/* WHY IT IS HERE, FIRST (owner, 2026-10-01: "the ESF needs to explain
            why its here. it just kinda pops up out of nowhere"). The eyebrow
            ties it to the purchase, the first sentence says what a purchase
            does to the month, the second is the owner's own line, verbatim,
            and only then the question, with its answers last, in thumb
            reach. "Tap one to continue" gave way to "Before you buy": the
            dashed, spined box still reads as unanswered on its own. */ ""}
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
        ${/* THE PURPOSE, FIRST (owner, 2026-09-28): "the big purchase
              calculator and each screen aren't very clear what the purpose
              is... The main page should have an image of Buddy considering a
              big purchase with a message like let's help find the right
              choice for you." The art is the existing Buddy pose, not new art
              (D10: never generate buddy art); a dedicated "considering a
              purchase" image is the owner's to supply and drops in here.
              SUPPLIED 2026-09-29: Buddy beside a car with a bow on it,
              assets/img/buddy-car.jpg, as a full-width banner. */ ""}
        ${/* The banner moved to the finder's first view (owner, 2026-10-01),
              under "Find the right car for you". This screen is the tool's
              value in one line and two: evaluate the purchase, see the real
              cost, find what fits. */ ""}
        <h1 class="title esf-title bp-land-title">Thinking about a big purchase?</h1>
      </div>

      <div class="journal-body">
        <p class="bp-lead">We'll show you what it really costs to own, and help you find the one that fits your life.</p>
        ${renderBpEsfBox()}
        ${/* THREE SECTIONS, SPREAD (owner, 2026-10-01: "too crowded… more
              space between the three sections… primary action buttons towards
              the bottom"). The category list is one block so the body's
              space-between pins it to the bottom, in thumb reach. */ ""}
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

  const prompt = bpReminderDue();
  if (prompt) out.push(renderBpReminder(prompt));

  const bp = state.bigPurchase;
  if (bp && bp.budgetIntent && !bp.budgetIntentSeen) {
    out.push(`
      <div class="card bp-goal-card">
        <p class="task-title" style="margin:0 0 4px;">Noted</p>
        <p class="helper" style="margin:0 0 10px;">${h(bpMoney(bp.budgetIntent.monthly))} a month for
          ${h(bp.noun)}. This prototype doesn't change your budget yet.</p>
        <button class="button secondary full" type="button"
                onclick="state.bigPurchase.budgetIntentSeen=true;render()">OK</button>
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

/**
 * Which reminder, if any, is due (§8).
 *   Goal set + box ticked   → when the goal is reached
 *   No goal  + box ticked   → when the purchase date arrives, as a task
 */
function bpReminderDue() {
  const bp = state.bigPurchase;
  if (!bp || !bp.remindBudget || bp.reminderClosed) return null;
  if (bp.goalId) {
    const g = (state.tacticalGoals || []).find(x => x.id === bp.goalId);
    if (g && goalCurrent(g) >= (Number(g.target) || 0)) return { source: "goal" };
    return null;
  }
  if (bp.taskDue && todayISO() >= bp.taskDue) return { source: "task" };
  return null;
}

function renderBpReminder(p) {
  const bp = state.bigPurchase;
  if (p.source === "goal") {
    return `
      <div class="card bp-goal-card">
        <p class="task-title" style="margin:0 0 4px;">You reached your ${bp.payMode === "loan" ? "down payment" : "savings"} goal</p>
        <p class="helper" style="margin:0 0 10px;">Want to add ${h(bpMoney(bp.budgetFigure))} a month to your
          budget for this car?</p>
        <div class="bp-row2">
          <button class="button full" type="button" onclick="bpBudgetAnswer('goal','added')">Add it</button>
          <button class="button secondary full" type="button" onclick="bpBudgetAnswer('goal','declined')">Not now</button>
        </div>
      </div>`;
  }
  return `
    <div class="card bp-goal-card">
      <p class="task-title" style="margin:0 0 10px;">Did you buy ${h(bp.noun)}?</p>
      <div class="bp-stack">
        <button class="button full" type="button" onclick="bpBudgetAnswer('task','added')">
          Yes — add ${h(bpMoney(bp.budgetFigure))} a month to my budget</button>
        <button class="button secondary full" type="button" onclick="bpBudgetAnswer('task','notYet')">
          Not yet — ask me in 2 weeks</button>
        <button class="button secondary full" type="button" onclick="bpBudgetAnswer('task','declined')">
          I decided not to</button>
      </div>
    </div>`;
}

/**
 * The answer to either reminder. Nothing enters the budget without the tap,
 * and for the prototype "Add it" records INTENT and confirms — budget
 * write-through is out of scope (§8).
 */
function bpBudgetAnswer(source, answer) {
  const bp = state.bigPurchase;
  if (!bp) return;
  bpLog("bp_budget_prompt", { source: source, answer: answer });
  if (answer === "added") {
    bp.budgetIntent = { monthly: bp.budgetFigure, at: todayISO() };
    bp.reminderClosed = true;
  } else if (answer === "notYet") {
    const d = new Date();
    d.setDate(d.getDate() + (((bpData().plan || {}).notYetDays) || 14));
    bp.taskDue = d.toISOString().slice(0, 10);
  } else {
    bp.reminderClosed = true;
  }
  render();
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
          by ${h(bp.purchaseDate)} · remind ${bp.remindBudget ? "yes" : "no"}</p>
        <button class="button secondary" style="width:100%;font-size:11px;margin-top:4px;" type="button"
                onclick="bpAdminReachGoal()">Mark the goal reached</button>
        <button class="button secondary" style="width:100%;font-size:11px;margin-top:4px;" type="button"
                onclick="bpAdminDueToday()">Make the purchase date today</button>
      </div>` : ""}
    <div class="admin-card">
      <p class="admin-card-title">Big purchase log (${(state.bpEvents || []).length})</p>
      ${events.length
        ? events.map(e => `<p class="helper">${h(e.at)} · <code>${h(e.event)}</code> ${h(JSON.stringify(e.detail))}</p>`).join("")
        : `<p class="helper">Nothing logged yet. In-memory only — it resets on refresh (D03).</p>`}
    </div>`;
}

function bpAdminReachGoal() {
  const bp = state.bigPurchase;
  if (!bp) return;
  const g = (state.tacticalGoals || []).find(x => x.id === bp.goalId);
  if (g) g.current = g.target;
  bp.reminderClosed = false;
  navGoTabRoot("goals");
}

function bpAdminDueToday() {
  const bp = state.bigPurchase;
  if (!bp) return;
  bp.taskDue = todayISO();
  bp.reminderClosed = false;
  navGoTabRoot("goals");
}
