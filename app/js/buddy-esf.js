// ─── Buddy in the Emergency Savings Fund ─────────────────────────────────────
// The panel's MODEL — state, navigation, disclosures, logging. No DOM: the
// rendering lives in screens/buddy-panel.js, the same split chat-router.js and
// screens/chat.js already use.
//
// WHAT THIS IS
// A Buddy panel, opened from every ESF screen, that answers the question in
// front of the user: what a row means, what belongs in it, and — above all —
// what to take OUT of a later row so the same dollar is not counted twice.
//
// WHAT THIS IS NOT
// Not AI, not an LLM, and not the keyword matcher either. chatRoute() is
// untouched and still owns the Home chat. This is a tapped tree: the user picks
// from a list, Buddy answers, the user picks again. Nobody types.
//
// ── THE D26 LINE ─────────────────────────────────────────────────────────────
// Buddy gives the user what they need to decide. He does not decide, and he
// supports whatever they choose. Every string in data/buddy-esf.json is written
// to that standard, and the step-5 entries are where it is easiest to break:
// "what 3 months covers" is one sentence away from "6 is better". Say what an
// option covers, then stop.
//
// ── THE SPINE: STOP THE DOUBLE-COUNT ─────────────────────────────────────────
// The ESF asks for expenses across four screens, and the same dollar can be
// entered twice without the user ever noticing. Three live traps:
//
//   Rent including utilities      → then utilities again on step 2
//   An escrowed mortgage payment  → then property tax + insurance again on step 3
//   A lease including maintenance → then car running costs again on step 2
//
// Every one inflates the fund by thousands. Catching them needs something the
// ESF does not otherwise have: a fact stated on one step that changes a later
// one. That is what the disclosure store below is for.

/** The content pack. Mirrors esfData()'s shape — one accessor, no direct reads. */
function buddyEsfData() {
  return (typeof BUDDY_ESF !== "undefined" && BUDDY_ESF) || {};
}

// ── The disclosure store ─────────────────────────────────────────────────────
// `null` is LOAD-BEARING. "Never asked" and "asked, answered no" are different
// states: the first shows nothing, the second suppresses the question later. A
// boolean pair would collapse them and start nagging people who already said no.
const ESF_DISCLOSURE_KEYS = [
  "rentIncludesUtilities",
  "mortgageIncludesEscrow",
  "leaseIncludesMaintenance",
  "noCarAtAll"
];

function esfDisclosures() {
  const s = esfSession();
  if (!s.disclosures) {
    s.disclosures = {};
    ESF_DISCLOSURE_KEYS.forEach(k => { s.disclosures[k] = null; });
  }
  return s.disclosures;
}

// ── What a disclosure DOES ───────────────────────────────────────────────────
// One table, data rather than logic, so a new disclosure is an entry instead of
// a branch. Three effects, in order of force:
//
//   zero      sets the row to $0 and shows the note
//   suppress  hides the opt-in "Add it" button and shows the note in its place
//   note      changes nothing, says something
//
// FOUR RULES, and none of them is optional:
//
//   1. A disclosure sets a DEFAULT. It never locks a row. The user can always
//      open the dropdown and pick anything — Buddy advises, the user decides.
//   2. Touching the row RETIRES the note. Once s.touched[rowId] is true the
//      user has made their own call, and a line telling them what they should
//      have done is nagging.
//   3. The note REPLACES the "Based on" line, it does not join it. Height-
//      neutral, which matters: tap targets are already at 29px against a 44px
//      floor because these screens must not scroll at 430x940. A note that
//      added a line would cost a pixel somewhere.
//   4. Reversible from EITHER end. Changing the answer in Buddy unwinds the
//      effect; tapping the note itself reopens Buddy on that disclosure. A user
//      who mis-taps "my rent covers utilities" must be able to undo it without
//      hunting for where they said it.
const ESF_DISCLOSURE_EFFECTS = {
  rentIncludesUtilities: {
    rows: ["power"],
    effect: "zero",
    note: "Your rent covers this. Leave it at $0.",
    source: "rent"
  },
  mortgageIncludesEscrow: {
    rows: ["propertyTax", "homeInsurance"],
    effect: "suppress",
    note: "Already in your mortgage payment.",
    source: "mortgage"
  },
  leaseIncludesMaintenance: {
    rows: ["carCosts"],
    effect: "note",
    note: "Your lease covers upkeep. Fuel and insurance are still here.",
    source: "carPayment"
  },
  noCarAtAll: {
    rows: ["carCosts"],
    effect: "zero",
    note: "No car, no running costs.",
    source: "carCosts"
  }
};

/**
 * The disclosure in force on a row, or null.
 *
 * Rule 2 lives here: a touched row has no disclosure, whatever was said in the
 * panel. Returning the effect rather than a boolean lets the caller decide what
 * to do with it — the render needs the note, esfToggleRow needs the force.
 */
function esfDisclosureFor(rowId) {
  const s = esfSession();
  if (s.touched && s.touched[rowId]) return null;       // rule 2
  const d = esfDisclosures();
  let found = null;
  Object.keys(ESF_DISCLOSURE_EFFECTS).forEach(key => {
    if (d[key] !== true) return;                        // null and false do nothing
    const eff = ESF_DISCLOSURE_EFFECTS[key];
    if (eff.rows.indexOf(rowId) === -1) return;
    // A stronger effect wins. Somebody with no car AND a maintenance-inclusive
    // lease should see $0, not a note about upkeep.
    if (found && ESF_EFFECT_FORCE[found.effect] >= ESF_EFFECT_FORCE[eff.effect]) return;
    found = { key: key, effect: eff.effect, note: eff.note, source: eff.source };
  });
  return found;
}

const ESF_EFFECT_FORCE = { note: 1, suppress: 2, zero: 3 };

/**
 * Apply or unwind a disclosure's effect on the rows it touches.
 *
 * `zero` writes the row without setting `touched` — deliberately. Marking it
 * touched would mean the user had made the call themselves, which retires the
 * note (rule 2) and hides the explanation for the $0 they are looking at.
 */
function esfApplyDisclosure(key, value) {
  const s = esfSession();
  const eff = ESF_DISCLOSURE_EFFECTS[key];
  const d = esfDisclosures();
  const before = d[key];
  d[key] = value;
  if (!eff) return;

  eff.rows.forEach(rowId => {
    if (s.touched && s.touched[rowId]) return;          // rule 1 + 2: never overrule the user
    if (eff.effect === "zero") {
      // Unwinding restores the opening estimate, not a zero left behind.
      s.rows[rowId] = value === true ? 0 : (s.opening ? s.opening[rowId] : s.rows[rowId]);
    }
    if (eff.effect === "suppress" && value === true && s.added) {
      // An opt-in row already added is un-added: it is now a double-count.
      delete s.added[rowId];
    }
  });

  // An UNDO is losing a claim that was in force, which is true → anything else.
  // Keyed on the old value rather than the new one: "I changed my mind about
  // the escrow" and "I never said that" are the same event to the readout, and
  // both are the opposite of the one worth counting.
  //
  // disclosure_set with mortgageIncludesEscrow: true is the single most
  // valuable event in this feature — it is a double-count that did not happen.
  esfLog(before === true && value !== true ? "disclosure_undo" : "disclosure_set",
         { key: key, value: value, from: before, step: s.step });
}

// ── The panel's own state ────────────────────────────────────────────────────
// Parked on the ESF session so esfStart() clears it with everything else — a
// transcript surviving a restart would describe figures that no longer exist.
//
// The TRANSCRIPT resets when the step changes; the DISCLOSURES do not. That
// split is the whole feature: the panel always opens with nothing to scroll and
// a list matching the rows on screen, while "my rent covers utilities" said on
// step 1 still has to be true on step 2.
function esfBuddy() {
  const s = esfSession();
  if (!s.buddy) {
    s.buddy = {
      open: false,
      forStep: null,      // which step the transcript belongs to
      q: null,            // an in-flight lifestyle question set, or null
      thread: [],         // {from, text} — the accumulating transcript
      node: null,         // the entry currently being answered, or null for the list
      chips: [],          // the answer choices under the thread
      asked: {},          // entry id → true, for the ticks in the list
      applied: false      // did any figure get set — logged on close
    };
  }
  return s.buddy;
}

/** Which step's question list to show. The plan screen is a step too. */
function esfBuddyStepKey() {
  if (state.screen === "esfPlan") return "plan";
  return String(esfSession().step);
}

/** The entries offered on this screen, in order. */
function esfBuddyItems() {
  const steps = buddyEsfData().steps || {};
  const def = steps[esfBuddyStepKey()];
  if (!def) return [];
  return (def.items || []).filter(id => {
    const entry = esfBuddyEntry(id);
    if (!entry) return false;
    // An entry tied to a row the user cannot see must not be offered. Property
    // tax on a renter's screen is a question about a field that is not there.
    if (!entry.row) return true;
    const row = esfRow(entry.row);
    return !row || esfRowShows(row);
  });
}

function esfBuddyPrompt() {
  const steps = buddyEsfData().steps || {};
  const def = steps[esfBuddyStepKey()];
  return (def && def.prompt) || "What can I help with?";
}

function esfBuddyEntry(id) {
  return (buddyEsfData().rows || {})[id] || null;
}

// ── Copy that depends on the user ────────────────────────────────────────────
// Most entries say one thing. A few cannot, because the figure they are
// explaining is built differently for different people, and an explanation that
// does not match the number on screen is worse than none.
//
// Medical is the case that forced this. It is priced as if the job stopped —
// an unsubsidized benchmark premium — but ONLY for somebody whose cover comes
// through work. For everybody else esfReplacementPremium() is 0 and the row is
// ordinary out-of-pocket costs. "This looks high on purpose" over $165 reads as
// a tool that does not know what it is showing you.
//
// A resolver returns a key into the entry's `sayIf` / `chipsIf`. Adding a
// conditional entry is a resolver plus a data key, not a branch in the render.
const ESF_BUDDY_VARIANTS = {
  employerCoverage: function () {
    return (typeof esfHasEmployerCoverage === "function" && esfHasEmployerCoverage())
      ? "employer" : "own";
  }
};

function esfBuddyVariant(entry) {
  if (!entry || !entry.variantOn) return null;
  const fn = ESF_BUDDY_VARIANTS[entry.variantOn];
  return fn ? fn() : null;
}

/** An entry's paragraphs, after the variant is resolved. */
function esfBuddySayFor(entry) {
  if (!entry) return [];
  const key = esfBuddyVariant(entry);
  if (key && entry.sayIf && entry.sayIf[key]) return entry.sayIf[key];
  return entry.say || [];
}

/** An entry's chips, after the variant is resolved. */
function esfBuddyChipsFor(entry) {
  if (!entry) return [];
  const key = esfBuddyVariant(entry);
  if (key && entry.chipsIf && entry.chipsIf[key]) return entry.chipsIf[key];
  return entry.chips || [];
}

/**
 * Find a chip anywhere in an entry's tree.
 *
 * Chips nest one level — "I'm not sure" answers with its own pair — so a flat
 * lookup over the current entry is not enough. Recursing keeps the data free to
 * grow another level without a change here.
 */
function esfBuddyFindChip(chips, chipId) {
  let hit = null;
  (chips || []).forEach(c => {
    if (hit) return;
    if (c.id === chipId) { hit = c; return; }
    hit = esfBuddyFindChip(c.chips, chipId);
  });
  return hit;
}

// ── Opening and closing ──────────────────────────────────────────────────────

function esfBuddyOpen() {
  const s = esfSession();
  const b = esfBuddy();
  const key = esfBuddyStepKey();

  // The transcript belongs to a step. Arriving on a different one starts fresh:
  // the list always matches the rows on screen, and the panel always opens with
  // nothing to scroll back through.
  if (b.forStep !== key) esfBuddyResetThread(key);

  b.open = true;
  esfLog("chat_opened", { step: key });
  render();
}

function esfBuddyClose() {
  const b = esfBuddy();
  b.open = false;
  esfLog("chat_closed", { applied: !!b.applied });
  render();
}

function esfBuddyResetThread(key) {
  const b = esfBuddy();
  b.forStep = key == null ? esfBuddyStepKey() : key;
  b.thread = [];
  b.node = null;
  b.chips = [];
  b.asked = {};
  b.q = null;
  b.applied = false;
}

/**
 * The menu's middle button: start the CURRENT thing over.
 *
 * Mid-questions that means the question set, because somebody who wants to
 * change an answer should not lose the explanation they read first. Anywhere
 * else it means the conversation. One label, one idea — "start over" starts
 * over whatever you are in the middle of — and it keeps the menu's three slots
 * fixed instead of needing a fourth button that only exists sometimes.
 */
function esfBuddyStartOverHere() {
  const b = esfBuddy();
  if (b.q) { esfBuddyRestartLifestyle(); return; }
  esfBuddyStartOver();
}

/** "Start over" — clears this step's conversation and returns to a fresh list. */
function esfBuddyStartOver() {
  esfBuddyResetThread();
  esfLog("chat_restart", { step: esfBuddyStepKey() });
  render();
}

/** "Back to the list" — keeps the transcript, returns to the picker. */
function esfBuddyToList() {
  const b = esfBuddy();
  b.node = null;
  b.chips = [];
  b.q = null;          // abandon a half-answered question set with it
  render();
}

// ── Talking ──────────────────────────────────────────────────────────────────

function esfBuddySay(paras) {
  const b = esfBuddy();
  (paras || []).forEach(p => b.thread.push({ from: "buddy", text: p }));
}

function esfBuddyUserSaid(text) {
  esfBuddy().thread.push({ from: "user", text: text });
}

/**
 * Tapping a row in the question list.
 *
 * The user's tap is echoed into the transcript before Buddy answers, so the
 * panel reads as a conversation rather than a help file that changed its mind.
 */
function esfBuddyPick(id) {
  const b = esfBuddy();
  const entry = esfBuddyEntry(id);
  if (!entry) return;

  b.node = id;
  b.asked[id] = true;
  b.q = null;
  esfBuddyUserSaid(entry.label);
  esfBuddySay(esfBuddySayFor(entry));
  esfBuddySay(esfBuddyFigureLine(entry));
  b.chips = esfBuddyChipsFor(entry).map(c => c.id);
  esfLog("chat_row_picked", { rowId: entry.row || id });
  render();
}

/**
 * "Right now I've figured $420 a month." — appended under an entry's copy.
 *
 * Only where there IS an estimate. A blank typed row (rent, a car payment) has
 * no figure to report, and "I've figured $0" reads as a broken tool rather than
 * an empty box. Returns an array so it can be empty.
 */
function esfBuddyFigureLine(entry) {
  if (!entry || !entry.row) return [];
  const row = esfRow(entry.row);
  if (!row || !row.prefill) return [];
  const value = esfRowValue(entry.row);
  if (!value) return [];
  const annual = row.cadence === "annual";
  const based = typeof esfBasedOn === "function" ? esfBasedOn(entry.row) : "";
  return ["Right now I've figured " + esfMoney(value) + (annual ? " a year" : " a month") +
          (based ? ". " + based.replace(/^Based on /, "That's based on ") : ".")];
}

/**
 * Tapping an answer chip.
 *
 * A chip can carry a disclosure, its own reply, and its own follow-up chips.
 * Everything it does happens in that order: record, answer, offer.
 */
function esfBuddyChip(chipId) {
  const b = esfBuddy();
  const entry = esfBuddyEntry(b.node);
  if (!entry) return;
  const chip = esfBuddyFindChip(esfBuddyChipsFor(entry), chipId);
  if (!chip) return;

  esfBuddyUserSaid(chip.label);

  if (chip.sets) {
    Object.keys(chip.sets).forEach(key => {
      esfApplyDisclosure(key, chip.sets[key]);
      const eff = ESF_DISCLOSURE_EFFECTS[key];
      if (eff && eff.effect === "zero" && chip.sets[key] === true) b.applied = true;
    });
  }

  esfBuddySay(chip.say);
  b.chips = (chip.chips || []).map(c => c.id);
  esfLog("chat_question", { rowId: entry.row || b.node, optionId: chipId });
  render();
}

// ── Lifestyle questions ──────────────────────────────────────────────────────
// THE MECHANIC IS A MULTIPLIER, NOT A CALCULATION:
//
//     adjusted = the row's OPENING estimate  x  the product of every answer
//
// js/help-me-out.js computes figures from scratch — miles x rate + insurance.
// It throws the ESF's own estimate away and builds a new number. This does the
// opposite: the ESF has already priced this row for the ZIP, income band and
// household, and these questions adjust that for how the person actually lives.
//
// Three reasons that difference matters. The estimate stays the spine. It is a
// multiplier per option rather than a model per category, so it is far less
// content. And it can never disagree with the screen — a from-scratch tree can
// return a figure wildly apart from the dropdown beside it and leave the user
// with two numbers and no way to choose.
//
// So this is a new lightweight mode, NOT an extension of help-me-out, which
// stays where it is serving the budget builder.
//
// THE USER NEVER TYPES A FIGURE. They answer questions about how they live and
// the estimate moves. They can still type one into the row itself if they want
// to — the point is that they never have to.

function esfLifestyleSet(rowId) {
  return ((esfData().lifestyleModifiers || {})[rowId]) || null;
}

/** True when a row has questions to offer. */
function esfHasLifestyle(rowId) {
  const set = esfLifestyleSet(rowId);
  return !!(set && set.questions && set.questions.length);
}

/**
 * The figure the multipliers apply to.
 *
 * The OPENING estimate, never the current value. Running the questions twice
 * would otherwise compound — a second pass would scale a figure that had
 * already been scaled, and answering the same way twice would move the number
 * both times.
 */
function esfLifestyleBase(rowId) {
  const s = esfSession();
  const opening = s.opening ? s.opening[rowId] : null;
  return Number(opening) || Number(esfRowValue(rowId)) || 0;
}

function esfLifestyleQuestion(rowId, index) {
  const set = esfLifestyleSet(rowId);
  if (!set) return null;
  return set.questions[index] || null;
}

function esfLifestyleOption(rowId, questionId, optionId) {
  const set = esfLifestyleSet(rowId);
  if (!set) return null;
  const q = (set.questions || []).find(x => x.id === questionId);
  if (!q) return null;
  return (q.options || []).find(o => o.id === optionId) || null;
}

/** base x every chosen multiplier, rounded the way every other ESF figure is. */
function esfLifestyleResult(rowId, answers) {
  const set = esfLifestyleSet(rowId);
  if (!set) return 0;
  let n = esfLifestyleBase(rowId);
  (set.questions || []).forEach(q => {
    const chosen = answers[q.id];
    if (!chosen) return;
    const opt = (q.options || []).find(o => o.id === chosen);
    if (opt) n = n * (Number(opt.x) || 1);
  });
  return esfRound(n);
}

/** Start the questions for a row. */
function esfBuddyAskLifestyle(rowId) {
  const b = esfBuddy();
  if (!esfHasLifestyle(rowId)) return;
  b.q = { rowId: rowId, index: 0, answers: {}, done: false };
  // Echo the BUTTON'S OWN WORDS. A tapped control and the bubble it produces
  // saying two different things makes the transcript stop being a record of
  // what the user did.
  esfBuddyUserSaid("Help me calculate this");
  esfBuddyAskCurrent();
  esfLog("chat_help_started", { rowId: rowId });
  render();
}

/** Push the question the flow is currently on. */
function esfBuddyAskCurrent() {
  const b = esfBuddy();
  if (!b.q) return;
  const q = esfLifestyleQuestion(b.q.rowId, b.q.index);
  if (!q) return;
  esfBuddySay([q.ask]);
}

/**
 * An answer was picked.
 *
 * Records it, echoes the label into the transcript, and either asks the next
 * question or works out the figure.
 */
function esfBuddyAnswerLifestyle(optionId) {
  const b = esfBuddy();
  if (!b.q || b.q.done) return;
  const q = esfLifestyleQuestion(b.q.rowId, b.q.index);
  if (!q) return;
  const opt = esfLifestyleOption(b.q.rowId, q.id, optionId);
  if (!opt) return;

  b.q.answers[q.id] = optionId;
  esfBuddyUserSaid(opt.label);
  esfLog("chat_question", { rowId: b.q.rowId, questionId: q.id, optionId: optionId });

  b.q.index++;
  if (esfLifestyleQuestion(b.q.rowId, b.q.index)) { esfBuddyAskCurrent(); render(); return; }

  // Out of questions — offer the figure. Buddy PROPOSES, the user confirms;
  // he never writes a figure into the row without the tap.
  b.q.done = true;
  const amount = esfLifestyleResult(b.q.rowId, b.q.answers);
  esfBuddySay([esfLifestyleSummary(b.q.rowId, b.q.answers, amount)]);
  b.chips = [];
  render();
}

/**
 * "Shopping once or twice a week at regular grocery stores, I'd put you around
 * $460 a month."
 *
 * Built from the labels they actually picked, so the figure is visibly a
 * consequence of their own answers rather than something that arrived.
 */
function esfLifestyleSummary(rowId, answers, amount) {
  const set = esfLifestyleSet(rowId);
  const picked = (set.questions || [])
    .map(q => {
      const opt = (q.options || []).find(o => o.id === answers[q.id]);
      if (!opt) return null;
      // `short` is the option worded as a sentence fragment. The label itself
      // is written to be recognised in a dropdown — "Higher-end stores (Whole
      // Foods)" — and the brand in brackets is what makes it land there, but it
      // reads badly mid-sentence. Lowercasing the label instead was worse: it
      // turned Whole Foods into whole foods.
      return opt.short || opt.label;
    })
    .filter(Boolean);
  const row = esfRow(rowId);
  const per = row && row.cadence === "annual" ? " a year" : " a month";
  const lead = picked.length ? picked.join(", ") + " — " : "";
  return lead + "I'd put you around " + esfMoney(amount) + per + ".";
}

/** The figure currently on offer, or null when the flow has not finished. */
function esfBuddyPendingFigure() {
  const b = esfBuddy();
  if (!b.q || !b.q.done) return null;
  return esfLifestyleResult(b.q.rowId, b.q.answers);
}

/**
 * "Use $460" — the handback.
 *
 * The figure is SNAPPED TO THE BAND THAT CONTAINS IT and applied through
 * esfSetRange, which is what the dropdown itself uses. Owner's ruling: "if peer
 * expense default is $200, but the user confirms $300 through chat, the
 * dropdown will change to the number that includes $300." So the control ends
 * up on a band the user could have picked by hand, not on a loose figure that
 * no option matches.
 *
 * THE PANEL STAYS OPEN and returns to the question list. The row updates behind
 * it, visible because the screen underneath never went away — that visible
 * change is the most convincing moment in the feature, and closing the panel
 * would throw it away.
 */
function esfBuddyApplyFigure() {
  const b = esfBuddy();
  const amount = esfBuddyPendingFigure();
  if (amount == null) return;
  const rowId = b.q.rowId;
  const row = esfRow(rowId);
  const from = esfRowValue(rowId);
  const band = esfBandFor(amount, row);

  esfSetRange(rowId, band.mid);          // sets `touched`, so the row stops being an estimate
  b.applied = true;
  esfLog("chat_applied", { rowId: rowId, from: from, to: amount, band: band.lo + "-" + band.hi });

  esfBuddySay(["Done — I've set " + (row ? row.label : rowId) + " to " +
               esfMoney(band.lo) + " – " + esfMoney(band.hi) + ". You can change it on the screen whenever you want."]);
  b.q = null;
  b.node = null;                          // back to the list, transcript intact
  b.chips = [];
  render();
}

/** "Start these questions over" — same row, clean slate. */
function esfBuddyRestartLifestyle() {
  const b = esfBuddy();
  if (!b.q) return;
  const rowId = b.q.rowId;
  esfLog("chat_restart", { rowId: rowId });
  b.q = { rowId: rowId, index: 0, answers: {}, done: false };
  esfBuddySay(["Let's go again."]);
  esfBuddyAskCurrent();
  render();
}

/**
 * The disabled input box, tapped.
 *
 * It does nothing on purpose — free text in a decision-tree prototype tests the
 * tree's coverage instead of the idea. But HOW MANY testers tap it anyway is
 * the demand for the real thing, so the tap is the measurement.
 */
function esfBuddyInputTapped() {
  esfLog("chat_input_tapped", { step: esfBuddyStepKey() });
}

/**
 * Tapping a disclosure note on a row — rule 4, the undo path.
 *
 * Opens the panel on the entry where the claim was made, so the user lands on
 * the question they answered rather than on a list they have to search.
 */
function esfBuddyReopenDisclosure(rowId) {
  const found = esfDisclosureFor(rowId);
  if (!found) return;
  esfBuddyOpen();
  const b = esfBuddy();
  if (b.node !== found.source) esfBuddyPick(found.source);
}

/** True when the panel should offer itself on this screen. */
function esfBuddyAvailable() {
  return ["esfBuild", "esfPlan"].indexOf(state.screen) !== -1;
}
