// ─── Buddy in the Big Purchase Calculator ────────────────────────────────────
// The panel's MODEL. No DOM — screens/bp-buddy.js draws it, with the ESF
// panel's own classes, so the two look and behave as one thing (spec §11:
// "reuses the ESF panel unchanged").
//
// It is a separate model rather than a second caller of js/buddy-esf.js on
// purpose. That file's state lives on the ESF session and its entries resolve
// against ESF rows; pointing it at a car would mean teaching it about two tools
// at once. The ESF build stays byte-for-byte what it was.
//
// v1 is EXPLAIN-ONLY (§11): pick an entry, Buddy answers, back to the list. No
// lifestyle multipliers — miles a day is already an input, so the ESF's car
// questions would double-count it. The fixed three-button menu row is kept, and
// "Help me calculate this" is always disabled here: a missing button would
// shift the other two, which is what that row exists to prevent.
//
// Voice: D26 plus the owner's rule — facts only, never call a cost high, never
// recommend an option. The credit tier is "the score we used", never theirs.

function buddyBpData() {
  return (typeof BUDDY_BP !== "undefined" && BUDDY_BP) || {};
}

const BP_BUDDY_SCREENS = { bpLanding: "0", bpFinder: "pick", bpYourCar: "4", bpQuiz: "quiz", bpSetup: "1", bpCost: "2",
                           bpOptions: "3", bpFinance: "4", bpCommit: "5" };

function bpBuddyAvailable() {
  return !!state.bp && BP_BUDDY_SCREENS.hasOwnProperty(state.screen);
}

function bpBuddy() {
  const s = bpSession();
  if (!s.buddy) s.buddy = { open: false, forStep: null, thread: [], node: null, asked: {} };
  return s.buddy;
}

function bpBuddyStepKey() {
  return BP_BUDDY_SCREENS[state.screen] || "1";
}

function bpBuddyItems() {
  const def = (buddyBpData().steps || {})[bpBuddyStepKey()];
  return ((def && def.items) || []).filter(id => !!bpBuddyEntry(id));
}

function bpBuddyPrompt() {
  const def = (buddyBpData().steps || {})[bpBuddyStepKey()];
  return (def && def.prompt) || "What can I help with?";
}

function bpBuddyEntry(id) {
  return (buddyBpData().rows || {})[id] || null;
}

function bpBuddyOpen() {
  const b = bpBuddy();
  const key = bpBuddyStepKey();
  if (b.forStep !== key) bpBuddyReset(key);
  b.calc = false;                 // the list, not the finder's breakdown
  b.open = true;
  bpLog("chat_opened", { tool: "bp", step: key });
  render();
}

function bpBuddyClose() {
  bpBuddy().open = false;
  bpLog("chat_closed", { tool: "bp" });
  render();
}

function bpBuddyReset(key) {
  const b = bpBuddy();
  b.forStep = key == null ? bpBuddyStepKey() : key;
  b.thread = [];
  b.node = null;
  b.asked = {};
}

function bpBuddyStartOver() {
  bpBuddyReset();
  bpLog("chat_restart", { tool: "bp", step: bpBuddyStepKey() });
  render();
}

function bpBuddyToList() {
  bpBuddy().node = null;
  render();
}

function bpBuddyPick(id) {
  const b = bpBuddy();
  const entry = bpBuddyEntry(id);
  if (!entry) return;
  b.node = id;
  b.asked[id] = true;
  b.thread.push({ from: "user", text: entry.label });
  (entry.say || []).forEach(p => b.thread.push({ from: "buddy", text: p }));
  bpLog("chat_row_picked", { tool: "bp", rowId: id });
  render();
}

function bpBuddyInputTapped() {
  bpLog("chat_input_tapped", { tool: "bp", step: bpBuddyStepKey() });
}
