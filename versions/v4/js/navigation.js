// ─── Screen navigation ────────────────────────────────────────────────────────

// Captures all navigation-relevant state for history.pushState.
// Called after state.screen and any context fields are already set.
function getNavSnapshot() {
  return {
    screen:                state.screen,
    nav:                   JSON.parse(JSON.stringify(state.nav)),
    selectedBadge:         state.selectedBadge,
    selectedBudgetCategory:state.selectedBudgetCategory,
    selectedDebt:          state.selectedDebt,
    selectedOffer:         state.selectedOffer,
    debtAnalyzerIncluded:  JSON.parse(JSON.stringify(state.debtAnalyzerIncluded || {})),
    currentLesson:         state.currentLesson   ? JSON.parse(JSON.stringify(state.currentLesson))   : null,
    activeQuizIndex:       state.activeQuizIndex,
    activeQuizChoice:      state.activeQuizChoice,
    activeQuizWrongChoices:(state.activeQuizWrongChoices || []).slice(),
    rewardBadgeGains:      state.rewardBadgeGains ? JSON.parse(JSON.stringify(state.rewardBadgeGains)) : null,
    rewardXp:              state.rewardXp,
    rewardLessonTitle:     state.rewardLessonTitle,
  };
}

// Restores navigation state from a saved snapshot (used by popstate handler).
function restoreNavSnapshot(snap) {
  if (!snap) return;
  state.screen                  = snap.screen;
  if (snap.nav) state.nav       = snap.nav;
  state.selectedBadge           = snap.selectedBadge;
  state.selectedBudgetCategory  = snap.selectedBudgetCategory;
  state.selectedDebt            = snap.selectedDebt;
  state.selectedOffer           = snap.selectedOffer;
  state.debtAnalyzerIncluded    = snap.debtAnalyzerIncluded   || {};
  state.currentLesson           = snap.currentLesson          || null;
  state.activeQuizIndex         = snap.activeQuizIndex        || 0;
  state.activeQuizChoice        = snap.activeQuizChoice       ?? null;
  state.activeQuizWrongChoices  = snap.activeQuizWrongChoices || [];
  state.rewardBadgeGains        = snap.rewardBadgeGains       || null;
  state.rewardXp                = snap.rewardXp               || 0;
  state.rewardLessonTitle       = snap.rewardLessonTitle      || '';
}

// ─── Per-stack navigation (L5, architecture §7) ───────────────────────────────
// Every screen change goes through go() / navGoTab() / navBack() / navAdminJump().
// Assigning state.screen directly bypasses the stack AND the nav log — that was
// already v2's rule and it matters more now, because the stack is what decides
// where back lands.

function navStack()   { return state.nav.stacks[state.nav.activeStack]; }
function navDepth()   { return navStack().length; }
function navCurrent() { return navStack()[navStack().length - 1]; }

function navCommit(screen) {
  state.screen = screen;
  state.topbarMenuOpen = false;          // any navigation closes the overlay
  window.__navLog = [screen, ...window.__navLog].slice(0, 10);
  try { history.pushState(getNavSnapshot(), ''); } catch(e) {}
  render();
}

// PUSH onto the active stack. This is the default for every in-app link.
function go(screen) {
  if (state.screen === screen) { render(); return; }
  navStack().push(screen);
  navCommit(screen);
}

// SWITCH stacks — does not push. Returning to a tab resumes it where you left
// off, which is the behaviour that makes per-stack history worth having.
function navGoTab(key) {
  if (!state.nav.stacks[key]) return;
  state.nav.activeStack = key;
  navCommit(navCurrent());
}

// Return to Home itself, resetting the stack — "this flow is over".
//
// NOT the same as navGoHome(). A tab tap RESUMES that stack's top, which
// is right for tabs: leave Budget three screens deep, come back, pick up where
// you were. It is wrong for ending a flow, because the thing you just finished
// is still on top — calling navGoHome() after the share flow returns you
// to the share screen.
//
// Every "Done" at the end of a flow wants this one.
function navGoHome() {
  state.nav.activeStack = "home";
  state.nav.stacks.home = ["home"];
  navCommit("home");
}

// Return to a TAB'S ROOT, resetting its stack — the any-tab counterpart to
// navGoHome(), and for the same reason.
//
// navGoTab() commits navCurrent(), i.e. the TOP of that stack. That is right for
// a tab tap (resume where you left off) and wrong for ending a flow, because the
// screen you just finished is still on top. Enter the budget wizard from the
// Budget tab and the aboutMe stack ends as
// ["aboutMe","spendingProfile","lifestyleWizard","budgetCompare","budgetDone"] — so
// "See my budget" called navGoTab('aboutMe') and committed budgetDone, the
// screen it was already on. The button did nothing.
function navGoTabRoot(key) {
  if (!state.nav.stacks[key]) return;
  state.nav.activeStack = key;
  state.nav.stacks[key] = [key];
  navCommit(key);
}

// POP. At depth 1 there is nowhere to go — the top bar shows home instead.
function navBack() {
  const st = navStack();
  if (st.length <= 1) {
    if (state.nav.activeStack !== "home") navGoHome();
    return;
  }
  st.pop();
  navCommit(navCurrent());
}

// Admin "Jump to screen" has no history — it teleports. RESET the owning stack
// to just that screen, or back would land somewhere the tester never was.
function navAdminJump(screen) {
  const key = state.nav.stacks[activeTabFor(screen)] ? activeTabFor(screen) : "home";
  state.nav.activeStack = key;
  state.nav.stacks[key] = [screen];
  navCommit(screen);
}

// Flow entry points that should return to Home when complete.
// Set flowOrigin so the finish screen knows where to send the user back.
const FLOW_ENTRY_SCREENS = ["lifestyleWizard", "accountBalances", "debtBalances"];

// Entry point for a Home daily task. Switches to the home stack FIRST, so the
// task's destination backs to Home rather than to whatever tab was last open.
function taskGo(destination) {
  if (FLOW_ENTRY_SCREENS.includes(destination)) {
    state.flowOrigin = "home";
    if (destination === "lifestyleWizard") {
      state.postResultContext = "budget";
    }
  }
  // Reset the home stack to its root before pushing, so the contract holds
  // literally: a screen reached from a Home task ALWAYS backs to Home. Tasks
  // are only tappable at home-stack depth 1 today, but relying on that makes
  // the guarantee incidental rather than enforced.
  state.nav.activeStack = "home";
  state.nav.stacks.home = ["home"];
  go(destination);
}

function completeAndReward() {
  go("reward");
}

// ─── Badge/offer selection ────────────────────────────────────────────────────

// Navigates to the topic page for a badge selected from the Learn tab.
// Updates recentlyActive so the badge surfaces at the top on next Learn visit.
function selectBadge(name) {
  state.selectedBadge = name;
  // Bubble this badge to the front of recentlyActive (cap at 3 entries)
  state.recentlyActive = [name, ...state.recentlyActive.filter(b => b !== name)].slice(0, 3);
  go("topic");
}

function currentBadge() {
  return state.badges.find(b => b.name === state.selectedBadge) || state.badges[0];
}


function goToCategory(category) {
  if (!isCategory(category)) return;
  state.selectedCategory = category;
  go("budgetCategory");
}

function goMyDebts(editId) {
  state.selectedDebt = editId || null;
  go("myDebts");
}

function goDebtAnalyzer() {
  // Initialize inclusion map on first entry — all debts included by default
  if (!state.debtAnalyzerIncluded || Object.keys(state.debtAnalyzerIncluded).length === 0) {
    state.debtAnalyzerIncluded = {};
    state.budget.debts.forEach(function(d) { state.debtAnalyzerIncluded[d.id] = true; });
  }
  go("debtAnalyzer");
}


function selectOffer(name) {
  state.selectedOffer = name;
  go("marketplaceDetail");
}

function currentOffer() {
  return state.offers.find(o => o.name === state.selectedOffer) || state.offers[0];
}

// ─── Education flow ───────────────────────────────────────────────────────────

// Enters a lesson from the topic page. Sets the lesson as the active session
// so lesson.js and quiz.js can read from state.currentLesson without needing
// arguments passed through onclick strings.
// The ONE door into a lesson. Both the Learn tab and a daily task come through
// here, so a lesson behaves identically however it was reached — a daily task
// is a bookmark into the app, not a parallel pipeline.
function selectLesson(id) {
  const lesson = state.lessons.find(l => l.id === id);
  if (!lesson) return;
  // Drop the previous lesson's script, video, quiz and calculator before this
  // one starts, or it inherits them — see lessonV3ClearSession. A v3 lesson
  // re-populates them a moment later in lessonOpenPlayer, which runs after this.
  if (typeof lessonV3ClearSession === "function") lessonV3ClearSession();
  state.currentLesson = lesson;
  // Mark in-progress only if not already completed — a revisit that gets
  // abandoned should not downgrade a completed lesson's status
  if (lesson.status !== "completed") lesson.status = "in-progress";
  // Reset quiz state for a clean session
  state.activeQuizIndex        = 0;
  state.activeQuizChoice       = null;
  state.activeQuizWrongChoices = [];
  go("reward-preview");
}

/**
 * Leave the preview and start the lesson itself.
 *
 * v3 lessons ask their framing questions first — that is what personalises the
 * script and the video figures — then open the player. v2 lessons go straight
 * to it. Both land on the same `lesson` screen and the same tail.
 */
function startCurrentLesson() {
  const lesson = state.currentLesson;
  if (lesson && lesson.isV3) { lessonV3Start(lesson.id); return; }
  go("lesson");
}

// Applies XP earned to a badge, handling level-up and tier-advance logic.
// Returns a result object used by completeLesson() to build the reward display.
//
// xpToApply: the final XP after multipliers have been applied by the caller.
// Progress is stored as 0–100. When it hits 100, the badge levels up and
// progress resets. When level hits tier.maxLevel, the badge advances to the
// next tier and level resets to 1.
function advanceBadge(badgeName, xpToApply) {
  const badge = state.badges.find(b => b.name === badgeName);
  if (!badge) return null;

  const oldTier     = badge.tier;
  const oldLevel    = badge.level;
  const oldProgress = badge.progress;

  // Apply XP as progress points (XP maps 1:1 to progress % for prototype simplicity)
  // In production this would use a configurable XP-per-level table
  let newProgress = oldProgress + Math.round(xpToApply);
  let newLevel    = oldLevel;
  let newTier     = oldTier;
  let leveledUp   = false;
  // levelUpHistory: one entry per level-up event in sequence.
  // Each entry records the tier+level the badge reached AFTER that level-up reset.
  // The reward screen uses this to drive per-event label changes and pulse animations
  // so a C7→C9 journey shows C7→C8 pulse, then C8→C9 pulse — not a single jump.
  const levelUpHistory = [];

  // Handle level-up: each time progress hits 100, the badge levels up.
  // Check for absolute max BEFORE incrementing so we don't push a spurious
  // levelUpHistory entry when the badge is already capped at the final tier+level.
  while (newProgress >= 100) {
    const tierDef = state.tiers.find(t => t.name === newTier);
    const isAbsoluteMax = tierDef
      && newLevel >= tierDef.maxLevel
      && !state.tiers[state.tiers.indexOf(tierDef) + 1];
    if (isAbsoluteMax) {
      newProgress = Math.min(newProgress, 99); // cap; loop will not re-enter
      break;
    }

    newProgress -= 100;
    newLevel++;
    leveledUp = true;

    // Check tier advance: if level exceeds the tier's cap, advance to next tier
    const currentTierDef = state.tiers.find(t => t.name === newTier);
    if (currentTierDef && newLevel > currentTierDef.maxLevel) {
      const tierIndex = state.tiers.indexOf(currentTierDef);
      const nextTier  = state.tiers[tierIndex + 1];
      if (nextTier) {
        newTier  = nextTier.name;
        newLevel = 1; // tier advance resets level to 1
      }
      // No else needed — isAbsoluteMax guard above handles the final tier case
    }

    // Record the state reached after this specific level-up.
    // The reward animation fires a separate label change + pulse for each entry.
    levelUpHistory.push({ tier: newTier, level: newLevel });
  }

  // Commit the updated values to state so the badge board reflects them immediately
  badge.progress = newProgress;
  badge.level    = newLevel;
  badge.tier     = newTier;

  return {
    name: badgeName,
    oldTier, oldLevel, oldProgress,
    newTier, newLevel, newProgress,
    leveledUp,
    tieredUp: newTier !== oldTier,
    levelUpHistory  // array of {tier, level} for each level-up event in sequence
  };
}

// Called when the user completes the quiz for the current lesson.
// Calculates XP (base + bonus separately for reward display), applies it to
// all associated badges, builds the reward screen data, then navigates.
function completeLesson() {
  const lesson = state.currentLesson;
  if (!lesson) return;

  // Mark the lesson complete in state so topic page status updates
  lesson.status = "completed";

  // Sync any home task pointing at this lesson
  state.tasks.forEach(t => { if (t.lessonId === lesson.id) t.completed = true; });

  // Separate base and bonus XP so the reward screen can show them as two
  // distinct lines — PRD intent: bonus should feel like a bonus, not just
  // a merged larger number.
  const xpBase  = lesson.xp;

  // The daily-task bonus applies when the lesson was opened from TODAY'S task.
  // `lesson.dailyTask` is a static flag on the v2 catalog row — v2's
  // approximation of the same idea, from before tasks carried routes — so it is
  // permanently true for one lesson and permanently false for the rest. A v3
  // lesson opened from a daily task that isn't the seeded APR one therefore
  // earned nothing, because selectLesson prefers the v2 row and never reaches
  // the shim in lessonOpenPlayer that derives it.
  //
  // Ask the task list, and keep the seed flag as an OR so nothing v2 already
  // does regresses.
  const fromDailyTask = (typeof lessonIsActiveTask === "function" &&
                         lessonIsActiveTask(lesson.id)) || !!lesson.dailyTask;
  const xpBonus = fromDailyTask ? lesson.xp * (state.xpConfig.bonusMultiplier - 1) : 0;
  const xpTotal = xpBase + xpBonus; // total applied per badge

  // Apply XP to every badge this lesson contributes to and collect results
  const gains = lesson.badges.map(badgeName => {
    const result = advanceBadge(badgeName, xpTotal);
    if (!result) return null;
    return {
      ...result,
      xpBase,
      xpBonus,
      xpTotal
    };
  }).filter(Boolean);

  // Charity Points. The v3 path (lessonRewardStart) has already opened the
  // ledger and credited both the lesson and the daily task; a v2 lesson arrives
  // here with nothing open, so it earns its bones on the same rule rather than
  // showing an empty section. Closing it means a later task completion cannot
  // append to a reward that has already been rendered.
  if (typeof lrPointsOpen === "function" && !lrPointsOpen()) {
    lrPointsReset();
    lrAwardKibble({ total: xpTotal });
  }
  if (typeof lrPointsClose === "function") lrPointsClose();

  // Write reward screen data
  state.rewardBadgeGains   = gains;
  state.rewardXp           = xpTotal * gains.length; // total across all badges
  state.rewardLessonTitle  = lesson.title;

  // Reset quiz session state for next time
  state.activeQuizIndex        = 0;
  state.activeQuizChoice       = null;
  state.activeQuizWrongChoices = [];
  state.currentLesson          = null;
  // Same for the v3 side — this is the one funnel every lesson exits through.
  if (typeof lessonV3ClearSession === "function") lessonV3ClearSession();

  go("reward");
}

// ─── Navigation contract ──────────────────────────────────────────────────────
// All screen changes MUST go through go() or taskGo(). Direct state.screen
// assignment bypasses history tracking and the nav log.
//
// Tab → screens mapping (activeTabFor() in utils.js):
//   home        → home
//   aboutMe     → aboutMe, lifestyleWizard, myDebts, debtAnalyzer,
//                 lifestyle, lifestyleChain, accountBalances, debtBalances, goals
//   myProgress  → myProgress
//   learn       → learn, topic, reward-preview, lesson, quiz, simulation
//   marketplace → marketplace, marketplaceDetail
//
// Post-result flow (no tab active, no nav bar):
//   budget save / lifestyle save / monthly update complete
//     → postResult → nextAction → commit → finish → myProgress
//   "Adjust it" path: nextAction → Budget tab (mid-loop exit)
//   "Compare more" path: nextAction → myProgress (mid-loop exit)
//   "Make a goal" path: nextAction → commitment → finish → myProgress
//   "Accept" / "Review later": nextAction → finish → myProgress (or flowOrigin)
//
// Screens with no nav bar (intentionally excluded from NAV_VISIBLE_SCREENS):
//   lesson        — full-height audiobook player; full-bleed, no tab context
//   quiz          — full-screen question flow; no tab context needed mid-quiz
//   reward-preview — pre-lesson interstitial; no nav keeps focus on the preview
//   reward        — post-quiz celebration overlay; nav bar would break the moment
//   lifestyleChain — full-screen question flow; no tab context needed mid-chain
//   postResult     — post-input reaction prompt; keep focus on the prompt
//   nextAction     — next action selection; keep focus on the choice
//   commitment     — commitment creation; keep focus on the input
//   finish         — completion moment; keep focus on the confirmation
//
// ─── Boot ─────────────────────────────────────────────────────────────────────
// navigation.js loads last in the script order (after render.js), so render()
// is guaranteed to be defined before this call fires.
// replaceState seeds the initial history entry (screen: "home") so that
// pressing back from the second screen cleanly returns to Home.
// Seed state from the v3 data files before anything renders (js/boot.js).
bootV3();

// A per-task start URL, applied after the seed and before the first history
// entry so the entry describes where the tester actually landed. No-ops on
// file:// and for any slug that is not deep-linkable (js/screen-url.js).
if (typeof screenLinkApply === "function") screenLinkApply();

try { history.replaceState(getNavSnapshot(), ''); } catch(e) {}
render();

// Tracking, if this build has it switched on. AFTER the first render, so the
// tracker's first DOM snapshot is of a painted screen rather than an empty
// shell (js/useberry.js).
if (typeof useberryInit === "function") useberryInit();

// One delegated focusin/focusout pair on #screenRoot, attached after the first
// render so the element exists. Covers every field in the app, including screens
// that do not exist yet — which is the point of delegating it (components/keyboard.js).
kbdInit();

// Restore navigation state when the user presses browser back/forward.
// Guard against null state — srcdoc iframes can fire popstate with e.state=null
// in some browsers, which would spuriously recreate the baby budget iframe.
window.addEventListener('popstate', function(e) {
  if (!e.state) return;
  restoreNavSnapshot(e.state);
  render();
});



// ─── Daily-task route map (architecture §9) ───────────────────────────────────
// seed-state's dailyTasks use their own vocabulary, matching no screen id, and
// a route can carry a parameter ("lesson:apr").
//
// ── A TASK IS ONE OF TWO THINGS, AND THEY NAVIGATE DIFFERENTLY ───────────────
//
// 1. A BOOKMARK into another tab — "See what APR really costs you" opens the
//    Learn tab's lesson; "Set up your budget" opens the Budget tab. The owner's
//    framing: daily tasks are contextual bookmarks sending you to other spots in
//    the application. Tapping one must be indistinguishable from tapping the
//    same thing in that tab. So: navGoTabRoot — switch stacks and start clean.
//
// 2. A FLOW launched from Home — money_journal and subscription_confirm open a
//    journal entry, which is not a tab and has nowhere else to belong. taskGo is
//    right for those: reset the home stack, push, and back out to Home.
//
// These used to go through taskGo indiscriminately, which pushed the string
// "learn" onto the HOME stack and left activeStack as "home". The lesson opened,
// but renderNav highlights by activeStack (components/nav.js) — so the HOME tab
// stayed lit while a Learn screen was on display, Back went to Home instead of
// Learn, and the Learn tab's own stack still held whatever was there before. The
// reward screen then exited with go('learn'), pushing a second "learn" on top of
// the mess, so Back replayed the reward you had just finished.
//
// `subscription_confirm` is NOT a screen (L12) — it deep-links into a journal
// entry focused on q_watched, which is where the engagement signal driving the
// Hulu flag actually comes from. The deep link bypasses that question's 2-day
// cooldown, or the task could open an entry missing its own question.
function navRouteTask(route) {
  if (!route) return;
  const parts = String(route).split(":");
  const name = parts[0], param = parts[1];

  // ── Flows from Home ──
  if (name === "money_journal")       { journalStart({}); taskGo("journalEntry"); return; }
  if (name === "subscription_confirm"){ journalStart({ focusQuestionId: "q_watched" }); taskGo("journalEntry"); return; }

  // ── Bookmarks into a tab ──
  if (name === "lesson" && param)     { navGoTabRoot("learn"); selectLesson(param); return; }
  if (name === "budget")              { navGoTabRoot("aboutMe"); return; }

  taskGo(name);
}
