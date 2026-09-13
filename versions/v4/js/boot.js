// ─── Boot: seed state from the v3 data files ─────────────────────────────────
// Runs once, from js/navigation.js, before the first render().
//
// The seven data globals (PERSONA, SEED_STATE, …) are READ-ONLY source data —
// nothing may mutate them. Everything copied into `state` is deep-cloned so a
// later edit can never write back into the loaded spec.
//
// In-memory only (D03). No localStorage, no backend. A refresh returns to the
// gate, which re-boots this from scratch — that IS the reset.
//
// ── Slots that collide with live v2 code ─────────────────────────────────────
// Three v2 slot names are still owned by running v2 code, so the v3 data is
// parked under distinct names and the phase that rewires the consumer swaps it:
//
//   v2 state.budget (5 buckets)  → v3 seeds `state.plan` (12 categories) below.
//                                  Phase 2 retires the v2 budget screens.
//   v2 state.tasks  (task cards) → v3 parks `state.dailyTasks`. Phase 3.
//   v2 state.goals  (flat array) → v3 parks `state.strategicGoal` +
//                                  `state.tacticalGoals`. Phase 5.

function v3Clone(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

function bootV3() {
  // ── Identity ───────────────────────────────────────────────────────────────
  // Persona backs everything (D08). Onboarding overrides ONLY zip, household
  // size and income band (D09) — Phase 3 applies those on top of this.
  state.profile = v3Clone(PERSONA.identity);
  state.lifestyle = v3Clone(PERSONA.lifestyle);
  // The persona's answers are a fallback, not the user's — nothing is
  // "answered" until they say so (see state.lifestyleAnswered).
  state.lifestyleAnswered = {};
  state.lifestyleDetail = {};
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
  // Cleared on every boot. It was write-only until diamonds got an accrual rule
  // (lrDiamondsForLesson), so nothing noticed it surviving a reset — now a stale
  // `true` would credit a subscriber reward on a run that never saw the trial.
  state.trialAccepted = null;
  state.buddyLevel = PERSONA.state.buddyLevel;

  // D06/D07 — the only thing SKIP_ONBOARDING changes at boot.
  state.streak = SKIP_ONBOARDING
    ? PERSONA.state.streakDays              // 6 — straight to home
    : PERSONA.state.streakDaysIfOnboarded;  // 1 — after onboarding

  // ── The three spend layers (architecture §5) ───────────────────────────────
  // Plan layer, keyed by the 12-category taxonomy. This is v3's budget — it is
  // NOT v2's state.budget (5 nested buckets), which still backs the v2 budget
  // screens until Phase 2 replaces them. Two models coexist deliberately; see
  // the 0d divergence note in PROGRESS.md.
  state.plan = {};
  CATEGORIES.forEach(c => { state.plan[c] = catValue(SEED_STATE.budget.monthly, c); });
  state.planTotal = catTotal(state.plan);
  // Seeded only. Onboarding overwrites this with incomeAnnual / 12 — there is
  // no take-home estimate any more, the app uses the figure the tester gave.
  // The JSON key is still `monthlyIncomeNet` because the seeded persona's 4390
  // genuinely was a post-tax figure; the state field is not, hence the rename.
  // (Unrelated to state.userProfile.monthlyIncome, a v2 form field.)
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

  // ── Goals, v3 shape (Phase 5 wires the screens) ────────────────────────────
  // One strategic goal, several tactical. Two tactical TYPES with inverted
  // math: a savings goal accumulates toward a target (>100% is good); a
  // spend-limit goal is a monthly ceiling (>100% is bad). The seed uses two
  // different status words for exactly that reason — "behind" vs "over".
  state.strategicGoal = v3Clone(PERSONA.goals.strategic);
  state.tacticalGoals = v3Clone(PERSONA.goals.tactical);
  // Shape the seed the same way the L11 observation reframe does — in state, so
  // data/*.json stays verbatim. A spend-limit goal needs its category to track
  // month-to-date live, and a savings goal needs a start date to compute pace.
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

  // ── Daily tasks, v3 shape (Phase 3 wires home) ─────────────────────────────
  // Precomputed order (A7). Routes use their own vocabulary — see the route map
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

  // ── Entry point (D06/D07) ──────────────────────────────────────────────────
  // The whole seam is this one branch plus the streak above. Flipping
  // SKIP_ONBOARDING must not require unwinding anything else.
  // The home stack's ROOT is always "home" — it is where every task and every
  // tab-escape lands. A pre-home entry screen (login, later onboarding) is
  // PUSHED on top of it, so answering the prompt is a pop rather than a jump,
  // and the top bar's back arrow doubles as "skip".
  //
  // Seeding the root as the entry screen instead made login the permanent root,
  // and navGoHome() returned to login forever.
  // v3 lessons join the one Learn catalog, so they are browsable rather than
  // reachable only through their daily task (see lessons-v3.js).
  lessonV3MergeIntoCatalog();

  const entry = v3EntryScreen();
  state.nav.activeStack = "home";
  state.nav.stacks.home = entry === "home" ? ["home"] : ["home", entry];
  state.screen = entry;
}

// false → onboarding step 1 · true → straight to home.
// Phase 3 builds the onboarding screen; until it exists both paths land on
// home, so the flag is wired and testable now rather than retrofitted later.
function v3EntryScreen() {
  // Returning user: the login scene, which prompts for the daily update and
  // then lands on home. First run: onboarding (Phase 3b) — until that exists,
  // both paths go through login so the loop is walkable.
  if (SKIP_ONBOARDING) return "login";
  return typeof renderOnboarding === "function" ? "onboarding" : "login";
}

// L11 — obs_dining_over_peers ships typed `peer_gap` and headlined "than your
// peers", but its numbers (429 vs 320) are the PLAN comparison: 320 is the
// user's budget, not the benchmark. The real peer value is 370, a 16% gap.
// 04-budget-benchmarks says the seeded observation IS the plan comparison, and
// peer-benchmarks.json flags the discrepancy itself in `_note_gap`.
//
// So the numbers are right and the headline is wrong. Reframed here at boot
// rather than by editing data/*.json, which stays a byte-identical spec copy.
// Phase 2 adds the separate peer card (429 vs 370) alongside it — both framings
// must appear, labelled distinctly, and neither may stand in for the other.
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
