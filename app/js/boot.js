// ─── Boot: seed state from the data files ────────────────────────────────────
// Runs once, from js/navigation.js, before the first render().
//
// The data globals (PERSONA, SEED_STATE, …) are READ-ONLY source data —
// nothing may mutate them. Everything copied into `state` is deep-cloned so a
// later edit can never write back into the source data.
//
// In-memory only (D03). No localStorage, no backend. A refresh returns to the
// gate (or, with Pin on refresh, reloads this page), which re-boots this from
// scratch — that IS the reset.
//
// Keep category budgets, daily tasks and tactical/strategic goals under their
// own keys; state.budget, state.tasks and state.goals also serve off-path views.

function v3Clone(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

function bootApp() {
  // ── Identity ───────────────────────────────────────────────────────────────
  // Persona seeds the profile (D08). Onboarding applies answers over the
  // starting profile; skipped fields retain its values (D09, L26).
  state.profile = v3Clone(PERSONA.identity);
  state.lifestyle = v3Clone(PERSONA.lifestyle);
  state.buddy = v3Clone(PERSONA.buddy);
  // The buddy illustration's broken-asset latch lives in components/buddy.js,
  // not in `state`, so a reset has to clear it explicitly or a missing file from
  // a previous session keeps suppressing art that is now there.
  if (typeof buddyResetArt === "function") buddyResetArt();
  if (typeof onbFilmResetArt === "function") onbFilmResetArt();

  // ── Engagement counters (display-only, L16) ────────────────────────────────
  // Charity Points accrue and show; nothing spends them. Two non-converting
  // tiers: bones (state.kibble internally — the free/ad tier, accrues from
  // tasks) and diamonds (subscriber tier, seeded and shown, no accrual rule for
  // now). Buddy level is a shown number with no progression rule.
  state.kibble = PERSONA.state.kibbleBalance;
  state.charityDiamonds = PERSONA.state.diamondBalance || 0;
  // Reset subscriber eligibility so a fresh run cannot inherit reward access.
  state.trialAccepted = null;
  state.buddyLevel = PERSONA.state.buddyLevel;

  // D06 — onboarding completes with a one-day streak.
  state.streak = PERSONA.state.streakDaysIfOnboarded;

  // ── The three spend layers (architecture §5) ───────────────────────────────
  // Category budget, separate from state.budget's debt instruments.
  state.plan = {};
  CATEGORIES.forEach(c => { state.plan[c] = catValue(SEED_STATE.budget.monthly, c); });
  state.planTotal = catTotal(state.plan);
  // Onboarding overwrites this with incomeAnnual / 12, not a take-home estimate.
  // The seed key monthlyIncomeNet describes the persona's post-tax figure,
  // not the meaning of subsequent tester-entered income.
  state.monthlyIncome = SEED_STATE.budget.monthlyIncomeNet;

  // Self-reported = monthToDateActuals, NOT the sum of journalHistory. Six days
  // of journal detail (~$168 dining) sits inside fabricated month-to-date totals
  // ($429 dining) per D19. Getting this backwards breaks every observation.
  state.mtd = v3Clone(SEED_STATE.monthToDateActuals);
  state.journal = v3Clone(SEED_STATE.journalHistory);

  // ── Review surfaces ────────────────────────────────────────────────────────
  state.bills = v3Clone(PERSONA.bills.upcoming);
  state.subs = v3Clone(PERSONA.subscriptions.known);
  state.tipBanner = SEED_STATE.tipBanner.today;

  // ── Goals ────────────────────────────────────────────────────────────────
  // One strategic goal, several tactical. Two tactical TYPES with inverted
  // math: a savings goal accumulates toward a target (>100% is good); a
  // spend-limit goal is a monthly ceiling (>100% is bad). The seed uses two
  // different status words for exactly that reason — "behind" vs "over".
  state.strategicGoal = v3Clone(PERSONA.goals.strategic);
  // The ESF tool owns fund goals; omit the seed to avoid a duplicate target.
  state.tacticalGoals = v3Clone(PERSONA.goals.tactical)
    .filter(g => !/emergency\s*(savings\s*)?fund/i.test(String((g && g.label) || "")));
  // Shape the seed in state, as the L11 observation reframe does. A spend-limit
  // goal needs its category to track month-to-date live, and a savings goal
  // needs a start date to compute pace.
  state.tacticalGoals.forEach(g => {
    if (g.period) g.category = goalInferCategory(g);
    if (g.targetDate && !g.startedAt) {
      // The persona is six days in; date the goal from the start of its window
      // so the seeded 41% pace is reproduced rather than asserted.
      const end = new Date(g.targetDate);
      const start = new Date(end); start.setMonth(start.getMonth() - 12);
      g.startedAt = start.toISOString().slice(0, 10);
    }
  });

  // ── Daily tasks ──────────────────────────────────────────────────────────
  // Precomputed order. Routes use their own vocabulary — see the route map
  // in architecture §9; `lesson:apr` shows they can carry a parameter.
  state.dailyTasks = v3Clone(SEED_STATE.dailyTasks.today);

  // ── Observations ───────────────────────────────────────────────────────────
  state.observations = v3Clone(SEED_STATE.observations.seeded);
  v3ReframeDiningObservation();
  observationsRecompute();   // derive figures from live state, never the baked strings

  // Journal entries the tester submits append here and feed month-to-date
  // (L17). Empty at boot — the six seeded days live in state.journal.
  state.journalEntries = [];

  // Chat opens with the four opening bubbles (bubbles are the primary input
  // path — inputMode: bubbles_primary).
  state.chat = { messages: [], bubbles: (BUDDY_RESPONSES.openingBubbles || []).slice() };

  // ── Entry point (D06) ──────────────────────────────────────────────────────
  // The home stack's ROOT is always "home" — it is where every task and every
  // tab-escape lands. A pre-home entry screen (onboarding) is PUSHED on top of
  // it, so answering the prompt is a pop rather than a jump, and the top bar's
  // back arrow doubles as "skip".
  // Lessons join the one Learn catalog, so they are browsable rather than
  // reachable only through their daily task (see framed-lessons.js).
  framedLessonMergeIntoCatalog();

  const entry = appEntryScreen();
  state.nav.activeStack = "home";
  state.nav.stacks.home = entry === "home" ? ["home"] : ["home", entry];
  state.screen = entry;
}

// A session starts at onboarding (D06) unless a study link names another screen
// (?screen=, applied after this by js/screen-url.js). A Flow's generated
// starter replaces this to enter elsewhere (scripts/flows.py).
function appEntryScreen() {
  return "onboarding";
}

// L11 — obs_dining_over_peers ships typed `peer_gap` and headlined "than your
// peers", but its numbers (429 vs 320) are the PLAN comparison: 320 is the
// user's budget, not the benchmark. The real peer value comes from the peer
// model (benchPeerValue), so it follows the tester's own profile.
// peer-benchmarks.json flags the discrepancy itself in `_note_gap`.
//
// So the numbers are right and the headline is wrong. Reframed here at boot.
function v3ReframeDiningObservation() {
  const o = (state.observations || []).find(x => x.id === "obs_dining_over_peers");
  if (!o) return;
  o.type = "plan_gap";
  o.comparedTo = "plan";
  o.headline = "You're spending more on dining out than you planned";
  o.detail = "34% above your own budget for this month.";
  o.planValue = o.peerValue;   // 320 — mislabelled in the seed; it is the budget
  delete o.peerValue;          // the real peer value is derived, not seeded
}
