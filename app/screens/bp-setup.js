// ─── Big Purchase — Screen 1: What you're buying ─────────────────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
// Spec  6, as revised by the owner (2026-09-22): ONE QUESTION AT A TIME.
//
// Seven questions on one screen read as a form and intimidate. So the screen
// shows only the question being asked, with its choices docked at the BOTTOM,
// in thumb reach, directly above the footer. Each answer then collapses into a
// dropdown-style row at the top — "Type  SUV ▾" — which reopens that question
// in the dock when tapped. Answers after it are kept if they still apply.
//
// The rows come from the category's setupInputs (plus the two onboarding
// questions, ZIP and miles a day, asked ONLY when not already in state), so this
// screen knows nothing about cars.
//
// Headline: blank until a price is typed, then "Sticker price $35,000".

// ── The question list ────────────────────────────────────────────────────────

/** Every question on this screen, in order, for the current answers. */
function bpSetupQuestions() {
  const s = bpSession();
  const cat = bpCategory();
  const inputs = s.setup;
  const out = [];
  if (s.askZip) out.push({ id: "zip", label: "ZIP code", ask: "What's your ZIP code?", kind: "zip" });
  // NO MILEAGE QUESTION (spec section 6.1, owner's ruling). It is read from the shared
  // profile or assumed — see bpVMilesPerDay(). The row is gone, not hidden.
  (cat ? cat.setupInputs : []).forEach(r => {
    if (r.showIf && !r.showIf(inputs)) return;
    out.push(Object.assign({ kind: r.typed ? "typed" : "tiles" }, r));
  });
  return out;
}

/** The answer to a question, or null. */
function bpSetupAnswer(q) {
  const s = bpSession();
  if (q.id === "zip")   return state.profile.zip ? state.profile.zip : (s.zipDeclined ? "national" : null);
  if (q.id === "miles") return state.profile.milesRange || null;
  const v = s.setup[q.id];
  if (q.kind === "typed") return Number(v) > 0 ? v : null;
  return v || null;
}

/** What an answered row says. */
function bpSetupAnswerLabel(q) {
  const v = bpSetupAnswer(q);
  if (v == null) return "";
  if (q.id === "zip") return v === "national" ? "National averages" : v;
  if (q.kind === "typed") return bpMoney(v);
  const opt = (q.options(bpSession().setup) || []).find(o => o.id === v);
  return opt ? opt.label : String(v);
}

/** The question in the dock: the one being changed, else the first unanswered. */
function bpSetupCurrent() {
  const s = bpSession();
  const qs = bpSetupQuestions();
  if (s.ui.q) {
    const editing = qs.find(q => q.id === s.ui.q);
    if (editing) return editing;
    s.ui.q = null;
  }
  return qs.find(q => bpSetupAnswer(q) == null) || null;
}

function bpSetupComplete() {
  return bpSetupQuestions().every(q => bpSetupAnswer(q) != null);
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/** An answer lands; the dock moves on to the next unanswered question. */
function bpSetupAnswered() {
  bpSession().ui.q = null;
}

function bpSetupPick(id, value) {
  const s = bpSession();
  s.setup[id] = value;
  // An answer can take another row's answer off the table: diesel is not
  // offered for a motorcycle, and age means nothing for a new car.
  const cat = bpCategory();
  (cat ? cat.setupInputs : []).forEach(r => {
    if (r.typed || !s.setup[r.id]) return;
    if (r.showIf && !r.showIf(s.setup)) { delete s.setup[r.id]; return; }
    const ok = (r.options(s.setup) || []).some(o => o.id === s.setup[r.id]);
    if (!ok) delete s.setup[r.id];
  });
  bpSetupAnswered();
  render();
}

/** Reopen an answered question in the dock. Tapping the open one closes it. */
function bpSetupEdit(id) {
  const s = bpSession();
  s.ui.q = s.ui.q === id ? null : id;
  render();
}

function bpSetupPrice(raw) {
  const n = Math.round(Number(String(raw == null ? "" : raw).replace(/[^0-9.]/g, "")) || 0);
  bpSession().setup.price = n > 0 ? n : null;
  if (n > 0) bpSetupAnswered();
  bpFieldCommitted();
}

/** ZIP, written to the profile the same way onboarding does — it is the same fact. */
function bpSetupZip(raw) {
  const z = String(raw == null ? "" : raw).replace(/\D/g, "").slice(0, 5);
  const s = bpSession();
  if (z.length === 5) { state.profile.zip = z; s.zipDeclined = false; bpSetupAnswered(); }
  bpFieldCommitted();
}

function bpSetupZipDecline() {
  const s = bpSession();
  s.zipDeclined = true;
  state.profile.zip = "";          // national averages, exactly as onboarding's "Maybe share later"
  bpSetupAnswered();
  render();
}

function bpSetupMiles(id) {
  const m = (typeof ONB_MILES !== "undefined" ? ONB_MILES : []).find(x => x.id === id);
  state.profile.milesRange = id;
  state.profile.milesPerDay = m ? m.miles : null;
  bpSetupAnswered();
  render();
}

/**
 * Continue LOOKS disabled until every question is answered but is never
 * actually `disabled`. The price commits on blur, and the blur happens during
 * the very tap on Continue — a real disabled attribute is still set at that
 * moment, so the tap that should have worked lands on a dead button. Checked
 * here instead, after the field's change has already run.
 */
function bpSetupNext() {
  if (!bpSetupComplete()) { render(); return; }
  const i = bpSession().setup;
  bpLog("bp_setup_done", { type: i.type, tier: i.tier, fuel: i.fuel, condition: i.condition,
                           age: i.age || null, price: i.price });
  go("bpCost");
}

// ── Render ───────────────────────────────────────────────────────────────────

/** A row of tiles. Shared by all three screens. */
function bpTiles(opts, current, onPick, cls) {
  return `
    <div class="bp-tiles ${cls || ""}" role="group">
      ${opts.map(o => `
        <button class="bp-tile ${current === o.id ? "on" : ""}" type="button"
                aria-pressed="${current === o.id}" onclick="${onPick(o.id)}">
          <span class="bp-tile-label">${o.emoji ? `<i class="bp-emoji" aria-hidden="true">${o.emoji}</i>` : ""}${h(o.label)}</span>
          ${o.sub ? `<span class="bp-tile-sub">${h(o.sub)}</span>` : ""}
        </button>`).join("")}
    </div>`;
}

// FOUR numbered steps: what you're buying, what it costs, paying for it, the
// plan. "Ways to spend less" is deliberately NOT one of them — it is optional
// and most testers will never open it, so numbering it produced the thing the
// owner caught: a flow that jumped from step 2 to step 4 (2026-09-27).
const BP_TOTAL_STEPS = 4;

// `titleClass` is for a title that must hold ONE LINE on a 390px frame —
// "The frequently overlooked costs" is 31 characters and wraps at the shared
// 20px size. The class shrinks it to fit rather than letting it break.
function renderBpStepHead(step, title, headline, titleClass) {
  const pips = [];
  for (let i = 1; i <= BP_TOTAL_STEPS; i++) pips.push(i);
  return `
    <p class="helper" style="margin:0 0 4px;">Step ${step} of ${BP_TOTAL_STEPS}</p>
    <div class="journal-progress" aria-hidden="true">
      ${pips.map(i => `<span class="journal-pip ${i <= step ? "on" : ""}"></span>`).join("")}
    </div>
    <h1 class="title esf-title ${titleClass || ""}">${h(title)}</h1>
    ${headline || ""}`;
}

/**
 * How one question's choices are laid out.
 *
 * NEVER a wrapping cluster. A centred flex-wrap gave "2 + 2 + 1" with three
 * different left edges and a last row floating under a gap — not a pattern
 * anybody would ship. Every layout here is a full-width grid with equal cells,
 * so the edges line up whatever the option count:
 *
 *   2 short       → two across        4 short → two by two
 *   3 short       → three across      anything else, or options carrying
 *                                     example text → one per line
 *
 * "Short" is measured, not guessed: a long label in a narrow cell wraps, and a
 * wrapped label is the same raggedness by another route.
 */
const BP_DOCK_SHORT = 11;

function bpDockLayout(opts, hasExamples) {
  if (hasExamples) return "bp-tiles-list";   // label over its example brands
  const short = opts.every(o => String(o.label).length <= BP_DOCK_SHORT);
  if (opts.length === 2) return "bp-tiles-2";
  if (short && opts.length === 3) return "bp-tiles-3";
  if (short && opts.length === 4) return "bp-tiles-2";
  return "bp-tiles-col";
}

/** The choices for one question, rendered into the dock. */
function renderBpSetupDock(q) {
  if (!q) return "";
  const s = bpSession();
  const inputs = s.setup;
  if (q.id === "zip") {
    return `
      <div class="bp-dock-row">
        <input id="bpZip" class="esf-amount bp-zip" type="text" inputmode="numeric" maxlength="5"
               placeholder="5 digits" value="${h(state.profile.zip || "")}" aria-label="ZIP code"
               onchange="bpSetupZip(this.value)">
        <button class="bp-link" type="button" onclick="bpSetupZipDecline()">Maybe share later</button>
      </div>`;
  }
  if (q.kind === "typed") {
    const price = Number(inputs.price) || 0;
    return `
      <input id="bpPrice" class="esf-amount bp-price" type="text" inputmode="numeric"
             placeholder="$0" value="${price ? h(bpMoney(price)) : ""}"
             aria-label="Sticker price, dollars" onchange="bpSetupPrice(this.value)">`;
  }
  const examples = q.examples ? q.examples(inputs) : null;
  const opts = q.options(inputs).map(o => ({ id: o.id, label: o.label, sub: examples ? examples[o.id] : "" }));
  const onPick = q.id === "miles" ? (id => `bpSetupMiles('${id}')`) : (id => `bpSetupPick('${q.id}','${id}')`);
  return bpTiles(opts, bpSetupAnswer(q), onPick, bpDockLayout(opts, !!examples));
}

function renderBpSetup() {
  const s = bpSession();
  const price = Number(s.setup.price) || 0;
  const done = bpSetupComplete();
  const current = bpSetupCurrent();
  const answered = bpSetupQuestions().filter(q => bpSetupAnswer(q) != null);

  const headline = price
    ? `<p class="bp-headline-one"><span>Sticker price</span> <strong>${h(bpMoney(price))}</strong></p>`
    : "";

  return `
    <div class="journal-shell onb-pinned bp-shell">
      <div class="journal-head">${renderBpStepHead(1, "What you're buying", headline)}</div>
      <div class="journal-body">
        ${/* No lead line here: five question rows are the lead, and the room is needed. */ ""}
        ${/* PERSISTENT (owner, 2026-09-27): it used to disappear once the type
              was answered, which left no way back into the quiz after taking
              its suggestion. The label changes, the door does not close. */ ""}
        <button class="bp-quizlink" type="button" onclick="bpQuizStart()">
          <span>${bpSetupAnswer(bpSetupQuestions().find(q => q.id === "type") || {}) == null
            ? "Not sure what you need?" : "Change your mind?"}</span>
          <span class="bp-quizlink-go">Help me pick &rsaquo;</span>
        </button>
        ${/* Every question has its row from the start, in place (owner,
              2026-10-03); see renderBpfAnsRow. */ ""}
        <div class="bp-answers">
          ${bpSetupQuestions().map(q => {
            const a = bpSetupAnswer(q) != null;
            const isCurrent = !!(current && current.id === q.id);
            return renderBpfAnsRow(q.label, a ? bpSetupAnswerLabel(q) : "", `bpSetupEdit('${q.id}')`,
                                   isCurrent, !a && !isCurrent);
          }).join("")}
        </div>
        ${current ? "" : `<p class="bp-ask-done">That's everything. Tap an answer to change it.</p>`}
      </div>
      ${current ? `
        <div class="bp-dock">
          <p class="bp-ask">${h(current.ask)}</p>
          ${renderBpSetupDock(current)}
        </div>` : ""}
      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        ${renderBpBuddyButton()}
        <button class="button ${done ? "" : "bp-off"}" type="button" aria-disabled="${!done}"
                onclick="bpSetupNext()">Continue</button>
      </div>
    </div>`;
}

function renderBpSetupAdmin() {
  const s = bpSession();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — setup</p>
      <p class="helper">Answers: <code>${h(JSON.stringify(s.setup))}</code></p>
      <p class="helper">ZIP row ${s.askZip ? "asked" : "skipped (in state)"} ·
        ESF ${s.esfDeferred ? "deferred" : "answered"}</p>
      <p class="helper">Mileage is never asked here — ${h(bpVMilesLine())} (${bpVMilesPerDay()}/day).</p>
      <button class="button secondary" style="width:100%;font-size:11px;" type="button"
              onclick="bpAdminFillSetup()">Fill: Everyday SUV · Gas · New · $35,000</button>
    </div>
    ${renderBpAdminCommon()}`;
}

/**
 * D19 — no screen renders empty. Screens 2 and 3 reached by the admin jump,
 * with nothing answered, open on the spec's own example car rather than on
 * "undefined · $0".
 */
function bpEnsureSetup() {
  const s = bpSession();
  const cat = bpCategory();
  const rows = (cat ? cat.setupInputs : []).filter(r => !r.showIf || r.showIf(s.setup));
  if (rows.every(r => r.typed ? Number(s.setup[r.id]) > 0 : !!s.setup[r.id])) return;
  s.setup = { type: "suv", tier: "everyday", fuel: "gas", condition: "new", price: 35000 };
}

function bpAdminFillSetup() {
  const s = bpSession();
  s.setup = { type: "suv", tier: "everyday", fuel: "gas", condition: "new", price: 35000 };
  if (!state.profile.milesRange) bpSetupMiles("15to30");
  s.ui.q = null;
  render();
}
