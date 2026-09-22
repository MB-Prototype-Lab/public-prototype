// ─── App State ────────────────────────────────────────────────────────────────
// Owns the entire app state object. All seed data resets on page refresh —
// this is intentional for a prototype; no persistence layer exists yet.
//
// Key sections in the state object:
//   screen          — active screen key; always changed via go() in navigation.js
//   budget.*        — budget profile, categories, fixed overhead, debts, status
//   lessons/badges  — education content (seed data for the Learn tab)
//   tasks           — home screen daily task cards
//   userProfile     — user-entered name, income, housing (cleared by resetUserData)
//
// resetUserData() clears all user-entered fields (budget, debts, profile) while
// leaving seed/demo content (lessons, badges, tasks) intact.
//
// destinations[] drives two surfaces: the admin "Jump to screen" dropdown and
// the per-task destination picker in the home admin panel.

const destinations = [
  ["streak",         "Streak Splash"],
  ["onboarding",     "Onboarding"],
  ["login",          "Login Scene"],
  ["dailyUpdate",    "Daily Update"],
  ["dailySummary",   "Daily: Summary"],
  ["dailyShare",     "Daily: Share"],
  ["home",           "Home"],
  ["journalEntry",   "Money Journal"],
  ["journalConfirm", "Journal: Confirm"],
  ["journalDone",    "Journal: Done"],
  ["aboutMe",        "Budget"],
  ["budgetBuild",    "Budget: Build (3 steps)"],
  ["esfBuild",       "Emergency fund: Capture (4 steps)"],
  ["esfPlan",        "Emergency fund: The number"],
  ["helpMeOut",      "Budget: Help me out"],
  ["profilePicker",  "Starting profile"],
  ["spendingProfile","Budget: Spending Profile"],
  ["budgetCompare",  "Budget: Which is closer"],
  ["lifestyleWizard","Lifestyle Wizard"],
  ["budgetDone",     "Budget: Saved"],
  ["myProgress",     "My Progress"],
  ["learn",          "Learn"],
  ["topic",          "Topic Page"],
  ["reward-preview", "Reward Preview"],
  ["lessonFraming",  "Lesson: Framing"],
  ["lesson",         "Lesson Player"],
  ["lessonQuiz",     "Lesson: Quiz"],
  ["lessonSimulation","Lesson: Simulation"],
  ["lessonReward",   "Lesson: Reward"],
  ["quiz",           "Quiz"],
  ["simulation",     "Simulation"],
  ["marketplace",    "Marketplace"],
  ["reward",         "Reward"],

  // L14 — the v2 screens v3 never specified stay reachable HERE and nowhere
  // else: nothing in the five tabs or the daily tasks routes to them. The
  // Phase 6 sweep checks this list against every routable screen, so a screen
  // that drops out is a visible warning rather than a quiet orphan.
  ["comparison",     "Where it's going"],
  ["budgetCategory", "Budget — one category"],
  ["spendEstimator", "Spend estimator"],
  ["goals",          "Goals"],
  ["chat",           "Chat with Buddy"],
  ["budgetUpdateConfirm", "Budget: Update Confirm"],
  ["accountBalances", "Account Balances"],
  ["debtBalances",   "Debt Balances"],
  ["myDebts",        "My Debts"],
  ["debtAnalyzer",   "Debt Analyzer"],
  ["postResult",     "Post-result"],
  ["nextAction",     "Next Action"],
  ["commitment",     "Commitment"],
  ["finish",         "Finish"],
  ["marketplaceDetail", "Marketplace Detail"],
  ["settings",       "Settings"]
];

const state = {
  // Navigation — opens on the streak splash on every fresh load/refresh.
  screen: "streak",

  // ── Per-stack navigation history (L5, architecture §7) ────────────────────
  // Each tab keeps its OWN stack, plus "home" which is reached by the top-left
  // icon rather than a tab. This is what lets the same screen back to two
  // different places: a lesson opened from a Home task backs to Home, the same
  // lesson opened from Education backs to Education — no special-casing.
  //
  // A tab tap SWITCHES stacks, it does not push. Otherwise back would walk
  // backwards through every tab switch, and a tester who tapped around four
  // tabs would need four backs to escape.
  nav: {
    activeStack: "home",
    stacks: {
      home:        ["home"],
      goals:       ["goals"],
      aboutMe:     ["aboutMe"],
      myProgress:  ["myProgress"],
      learn:       ["learn"],
      marketplace: ["marketplace"]
    }
  },

  // Top-bar hamburger overlay
  topbarMenuOpen: false,

  // Simulated iOS keyboard (components/keyboard.js). Desktop only — a real
  // phone has its own. The focused ELEMENT is not here: it is a DOM node, and
  // the admin state inspector serialises everything it finds on `state`.
  kbd: { open: false, layer: "abc", shift: false },

  // ── Daily loop ────────────────────────────────────────────────────────────
  // buddyPose cycles 1/3/4/5 ambiently; 2 and 6 are event-driven (chat, reward).
  buddyPose: 1,
  buddyIdleTimer: null,
  activeTaskId: null,
  dailyPromptAnswered: false,
  dailyPromptWatch: null,
  rememberDailyChoice: false,
  dailyPromptNoticeSeen: false,
  dailyPromptNoticeShown: false,
  onboarding: null,
  trialAccepted: null,

  // ── Daily update (Phase 4) ────────────────────────────────────────────────
  // One audio file per segment, so `index` IS the position — no playhead maths.
  du: { scriptId: null, index: 0, playing: false, timer: null, finished: false },

  // Share — anonymization ON by default (A11). The preview shows the literal
  // payload, so it can never drift from what would actually be posted.
  share: { anonymized: true, previewOpen: false, copied: false },
  streakRegisteredDay: null,
  goalDraft: null,
  goalSuggestions: [],

  // ── Lesson framing (D38) ──────────────────────────────────────────────────
  lessonFraming: null,
  lessonVariantId: null,
  lessonVariantScript: null,
  // Per-lesson framing result for THIS session (answers, inferred figure,
  // bucket, chosen variant). Skips re-asking on re-entry; cleared on refresh
  // (D03 — in-memory only, no persistent cooldown).
  lessonProfile: {},
  // Parked hyperframe plan + runtime figures for the later staging-area video.
  lessonVisualPlan: null,
  lessonQuiz: null,
  lessonSim: null,
  lessonReward: null,
  // XP per COURSE. A lesson belongs to several, and progress is on the lesson,
  // so a cross-cutting lesson moves all of them (lessons.json).
  courseXp: {},

  // ── Money Journal ─────────────────────────────────────────────────────────
  // journalSession:   the in-flight entry (null when not writing one)
  // journalAsked:     question id → day last asked. Drives cooldown, which is
  //                   what makes a second same-day entry ask DIFFERENT questions
  // journalRecurring: pattern follow-up answers. TRI-STATE values —
  //                   true | "weekdays" | false — never truthiness-checked
  // goalEvents:       emitted by q_balance, consumed by Phase 5's goals
  journalSession: null,
  journalAsked: {},

  // journalProfile:   profileKey → the signals answered, for the few questions
  //                   whose answer has to OUTLIVE the entry. journalAsked
  //                   records when a question was asked; this records what came
  //                   back, which is what lets one question unlock another.
  //                     streaming          → services the user pays for; becomes
  //                                          the option list for q_watched
  //                     statementWeek      → roughly when statements arrive
  //                     statementInterest  → appended, not replaced: the log of
  //                                          answers to the statement-photo
  //                                          demand test (L: no upload exists)
  journalProfile: {},
  journalRecurring: {},
  journalEntriesCount: 0,
  goalEvents: [],

  // ── Spend estimator (behavioral, extends the journal) ─────────────────────
  // estimator:       the in-flight category estimate (null when not running)
  // estimatorAsked:  question id → day last asked, so a behavioral question is
  //                  not re-asked the same day (shares the journal's day clock)
  estimator: null,
  estimatorAsked: {},
  selectedCategory: null,

  // ── Plan (12-category budget) ─────────────────────────────────────────────
  // "empty" until a builder saves through the seam. v2's state.budget is
  // vestigial and read only by my-progress until Phase 2b moves it.
  planStatus: "complete",
  planBuiltWith: null,
  planBuiltDate: null,
  lifestyleWizard: null,
  // v3.1 budget builder — three steps, per-line "Help me out". Holds the
  // figures until bbSubmit() puts them through the baseline seam (L6).
  budgetBuild: null,
  // The Help-me-out run for ONE category: its answers, its stage, and the
  // figure they land on. The queue of categories lives on budgetBuild.
  helpMeOut: null,

  // ── Emergency fund ────────────────────────────────────────────────────────
  // esf        the in-flight run: rows, buffer, coverage, screen-4 answers
  // expenses   the SAVED survival expense set, keyed on the taxonomy. Written
  //            by esfCommit and deliberately not ESF-local — the permanent
  //            expenses list reads it without re-running the wizard (spec §12)
  // esfGoal    the tactical savings goal the run created, kept by reference so
  //            an edit can find it again without matching on the label
  // esfEvents  session log for a moderated test. In-memory by design (D03):
  //            what one tester did in one sitting, read off the admin panel
  esf: null,
  expenses: null,
  esfGoal: null,
  esfEvents: [],
  // Set when the tester says they already have a fund and does not want to
  // build one. No figure, no goal — just a record that the question has been
  // answered, so the task is not put to them again.
  esfSelfReported: null,
  // Which of the nine starting profiles is applied, or null for the persona
  // seed. Written only by profileApply().
  activeProfileId: null,
  // The picker session — tier, then income level.
  profilePick: null,

  // Which of the six lifestyle dimensions the USER actually answered, as
  // opposed to inheriting from the persona. state.lifestyle is fully populated
  // at boot (bootV3), so it cannot tell the two apart — and the wizard needs
  // to, or every question opens pre-selected with a stranger's answer.
  // Onboarding step 5 sets the two it asks (ONB_LIFESTYLE_DIMS).
  lifestyleAnswered: {},

  // Figures the onboarding follow-up sliders collect: carMonthly, carAge,
  // transitWeekly, walkMonthly, and the derived transportMonthly. A stated
  // amount, not an answer key — the peer model never reads these, but the
  // budget prefers transportMonthly over its own guess when it is present.
  lifestyleDetail: {},

  // Admin panel collapse — persists across screens.
  //
  // Starts CLOSED. On a phone the panel is gone entirely (css/layout.css hides
  // both it and its expand tab under 768px), so a desktop that opened with dev
  // chrome beside the frame was the odd one out — and the demo link is opened
  // by people who are not developing. The expand tab is still there at any
  // width that has room for it, which is the difference from mobile: hidden,
  // not removed.
  //
  // State is in-memory (D03), so every refresh returns here. That is the point.
  adminCollapsed: true,

  // Lesson player stage style — toggled from admin panel.
  //
  //   "auto"     the default: video when the lesson HAS a storyboard and a
  //              personalized figure, clean otherwise
  //   "video"    force hyperframes (still needs a storyboard to show anything)
  //   "waveform" the animated bar — admin-only, never a default
  //   "clean"    nothing behind the captions
  //
  // L10: the narration is a recorded .wav, and an animated waveform that does
  // not correspond to it is decoration pretending to be a visualisation — so
  // waveform renders ONLY when explicitly selected here. A hardcoded "video"
  // default reversed that, because only `apr` has a storyboard: every other
  // lesson failed the storyboard test and fell through to the waveform.
  // "auto" gives the intended split — apr is video, the rest are clean.
  lpStageStyle: "auto",

  // ── Lesson playback session state ─────────────────────────────────────────
  // All playback variables consolidated here so navigation resets them cleanly
  // and render.js doesn't need to import globals from lesson.js.
  lessonPlayback: {
    sentences:       [],
    cues:            [],      // start second of each subtitle line (set on lesson open)
    total:           0,       // track length in seconds
    elapsed:         0,       // virtual playback clock in seconds
    lastTick:        0,       // Date.now() of the last ticker fire, for dt
    index:           0,
    playing:         false,
    ended:           false,
    completed:       false,
    currentLessonId: null,
    pendingAutoPlay: false,
    timer:           null,
    speed:           1,
    scrubWasPlaying: false,  // was it playing when the scrub started? resume after
    // True once live speech is driving the clock. Only ever set on lessons with
    // no generated .wav — which is all of them but interest-builds. While it is
    // set, lpTick's bar is capped inside the current line and only the voice's
    // own `onend` advances the caption, so the two cannot separate.
    speechDriven:    false
  },

  // Theme — picked from the admin panel, resets on page refresh (D03: no
  // persistence). Valid ids live in THEMES (js/theme.js). Default is Natural
  // Light — L21 as revised; it originally shipped Dark so the D36 cream had to
  // be chosen rather than defaulted into, and that call has been reversed.
  settings: { colorMode: "naturalLight" },

  // UI interaction state
  selectedBadge: "Credit Cards",
  selectedOffer: "Cashback Credit Card",

  // Reward screen — written dynamically by completeLesson(), not hardcoded

  // ─── Seed data ────────────────────────────────────────────────────────────

  tasks: [
    {
      title: "Saving for an emergency",
      description: "Work out what a month of survival costs, and what to save toward.",
      cta: "Start",
      tab: "goals",
      destination: "esfBuild",
      completed: false
    },
    {
      title: "Learn how interest builds",
      description: "A short lesson on why balances can grow faster than expected.",
      cta: "Learn",
      tab: "learn",
      lessonId: "interest-builds",
      completed: false
    },
    {
      title: "Review your emergency fund goal",
      description: "Track how close you are to your first savings milestone.",
      cta: "Review",
      tab: "other",
      destination: "myProgress",
      completed: true
    }
  ],

  // badges: persistent mastery objects per finance topic.
  // tier + level + progress drive the ring display.
  // Whether a badge has bonus content is now derived from lessons[].dailyTask,
  // not stored as a static flag — keeping the two in sync automatically.
  badges: [
    { name: "Emergency Fund",   tier: "Copper", level: 4, progress: 36 },
    { name: "Credit Cards",     tier: "Copper", level: 7, progress: 55 },
    { name: "Car Buying",       tier: "Copper", level: 3, progress: 24 },
    { name: "Home Buying",      tier: "Copper", level: 5, progress: 42 },
    { name: "Retirement",       tier: "Copper", level: 2, progress: 18 },
    { name: "Student Loans",    tier: "Copper", level: 6, progress: 61 },
    { name: "Health Insurance",  tier: "Copper", level: 1, progress: 12 },
    { name: "Investments",      tier: "Copper", level: 3, progress: 29 }
  ],

  goals: [
    { id: "g_seed_1", title: "Understand Home Buying", description: "Build confidence around the home buying process.", progress: 42, priority: 2 },
    { id: "g_seed_2", title: "Reduce Money Anxiety",   description: "Use repeated learning and budgeting practice to feel more grounded.", progress: 66, priority: 1 }
  ],

  // Tracks which goal is being edited in the goals screen
  // null = none; "new" = add form shown; else = goal.id being edited
  editingGoalId: null,

  milestones: [
    { title: "Emergency Fund",    current: "$1,240",          target: "$5,000",              progress: 25 },
    { title: "Credit Card Payoff",current: "$2,100 remaining",target: "$5,000 starting balance", progress: 58 }
  ],

  preferences: ["Low Fees", "Cashback", "Low APR", "Travel", "AI Tools"],

  offers: [
    { name: "Cashback Credit Card", category: "Credit Cards",  description: "Cashback card matching low-fee preferences.",                        match: "Matches Cashback and Low Fees" },
    { name: "High Yield Savings",   category: "Bank Accounts", description: "Savings account with simple fee structure.",                         match: "Matches Low Fees"             },
    { name: "Auto Refi Option",     category: "Refi",          description: "Refinance exploration for lower monthly pressure.",                  match: "Matches Low APR"              },
    { name: "Budgeting Software",   category: "Software",      description: "Tooling for tracking habits and recurring expenses.",                 match: "Matches Software"             },
    { name: "AI Finance Assistant", category: "AI Systems",    description: "AI system for personal finance learning and summaries.",             match: "Matches AI Tools"             },
    { name: "Auto Insurance Quote", category: "Insurance",     description: "Insurance comparison placeholder.",                                  match: "Matches price sensitivity"    }
  ],

  // ─── User profile ─────────────────────────────────────────────────────────
  // Fields populated by user input across screens. Flows between all screens
  // via this shared object. Resets on page refresh (desired behavior).
  // Use resetUserData() from admin panel to wipe without refreshing.
  userProfile: {
    name: "",
    monthlyIncome: "",
    housingCost: "",
    notes: ""
  },

  // ─── Education content ────────────────────────────────────────────────────
  // Lessons are the source of truth for the topic page. Each lesson knows:
  //   - which badges it contributes to (cross-badge XP design from PRD)
  //   - what type it is (drives visual treatment — lesson vs refresher)
  //   - whether it's tied to the daily task bonus path
  //   - its current completion status for this session
  lessons: [
    {
      id: "interest-builds",
      title: "How Interest Builds",
      description: "Why interest grows faster than you think — and how to stay ahead of it.",
      type: "lesson",        // "lesson" | "refresher" — drives content-type-tag styling
      badges: ["Credit Cards", "Car Buying", "Home Buying"], // 3 badges for prototype cross-badge reward demo
      xp: 40,                // base XP applied per badge on completion (before multipliers)
      dailyTask: true,       // true = bonusMultiplier applies; shown as bonus callout in UI
      status: "not-started"  // "not-started" | "in-progress" | "completed"
    },
    {
      id: "interest-refresher",
      title: "Interest Rates Refresher",
      description: "Quick recap of compound interest. Shorter, faster.",
      type: "refresher",     // visually distinct from lesson — different tag, different button color
      badges: ["Credit Cards", "Car Buying", "Home Buying", "Student Loans"],
      xp: 15,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "budget-basics",
      title: "Budget Basics",
      description: "Foundation of personal budgeting.",
      type: "lesson",
      badges: ["Emergency Fund", "Credit Cards", "Retirement"],
      xp: 35,
      dailyTask: false,
      status: "completed"    // pre-seeded completed so testers can see what that state looks like
    },

    // ── Credit Cards ──
    {
      id: "minimum-payments-trap",
      title: "The Minimum Payments Trap",
      description: "Why paying the minimum keeps you in debt far longer than you think.",
      type: "lesson",
      badges: ["Credit Cards", "Student Loans", "Car Buying"],
      xp: 30,
      dailyTask: false,
      status: "not-started"
    },

    // ── Emergency Fund ──
    {
      id: "three-month-rule",
      title: "The 3-Month Rule",
      description: "How to size your emergency fund and why three months is the baseline.",
      type: "lesson",
      badges: ["Emergency Fund", "Home Buying", "Retirement"],
      xp: 30,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "where-to-keep-it",
      title: "Where to Keep It",
      description: "High-yield savings vs checking — why separation matters.",
      type: "refresher",
      badges: ["Emergency Fund", "Investments"],
      xp: 15,
      dailyTask: false,
      status: "not-started"
    },

    // ── Car Buying ──
    {
      id: "total-cost-of-ownership",
      title: "Total Cost of Ownership",
      description: "Sticker price vs insurance, maintenance, and depreciation.",
      type: "lesson",
      badges: ["Car Buying", "Home Buying"],
      xp: 30,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "loan-vs-lease",
      title: "Loan vs Lease",
      description: "When each makes sense and the key trade-off.",
      type: "lesson",
      badges: ["Car Buying"],
      xp: 30,
      dailyTask: false,
      status: "not-started"
    },

    // ── Home Buying ──
    {
      id: "what-you-can-afford",
      title: "What You Can Actually Afford",
      description: "The 28% rule, DTI, and why pre-approval matters.",
      type: "lesson",
      badges: ["Home Buying", "Credit Cards", "Student Loans", "Car Buying"],
      xp: 35,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "hidden-costs-buying",
      title: "Hidden Costs of Buying",
      description: "Closing costs, property tax, HOA, and maintenance reserves.",
      type: "lesson",
      badges: ["Home Buying", "Car Buying", "Emergency Fund"],
      xp: 35,
      dailyTask: false,
      status: "not-started"
    },

    // ── Retirement ──
    {
      id: "why-start-now",
      title: "Why Start Now",
      description: "The compound growth advantage of starting in your 20s vs 30s.",
      type: "lesson",
      badges: ["Retirement", "Investments"],
      xp: 35,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "401k-and-the-match",
      title: "401k and the Match",
      description: "What employer matching is and why not taking it is leaving money behind.",
      type: "lesson",
      badges: ["Retirement", "Investments"],
      xp: 35,
      dailyTask: false,
      status: "not-started"
    },

    // ── Student Loans ──
    {
      id: "federal-vs-private",
      title: "Federal vs Private Loans",
      description: "Protections, flexibility, and why federal loans are the safer starting point.",
      type: "lesson",
      badges: ["Student Loans", "Home Buying"],
      xp: 30,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "income-driven-repayment",
      title: "Income-Driven Repayment",
      description: "What IDR is and when it makes sense for federal borrowers.",
      type: "refresher",
      badges: ["Student Loans", "Home Buying", "Retirement"],
      xp: 15,
      dailyTask: false,
      status: "not-started"
    },

    // ── Health Insurance ──
    {
      id: "deductible-vs-premium",
      title: "Deductible vs Premium",
      description: "The trade-off between monthly cost and out-of-pocket risk.",
      type: "lesson",
      badges: ["Health Insurance", "Emergency Fund"],
      xp: 30,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "hsa-basics",
      title: "HSA Basics",
      description: "What a Health Savings Account is and its triple tax advantage.",
      type: "refresher",
      badges: ["Health Insurance", "Investments", "Retirement"],
      xp: 15,
      dailyTask: false,
      status: "not-started"
    },

    // ── Investments ──
    {
      id: "index-funds-explained",
      title: "Index Funds Explained",
      description: "What they are and why low-cost beats stock picking for most people.",
      type: "lesson",
      badges: ["Investments", "Retirement"],
      xp: 35,
      dailyTask: false,
      status: "not-started"
    },
    {
      id: "risk-and-time-horizon",
      title: "Risk and Time Horizon",
      description: "How your timeline changes what you should own.",
      type: "lesson",
      badges: ["Investments", "Retirement", "Emergency Fund"],
      xp: 35,
      dailyTask: false,
      status: "not-started"
    }
  ],

  // ─── Quiz questions ───────────────────────────────────────────────────────
  // Each question is keyed to a lesson ID — not a free-floating pool.
  // In production, questions scale in difficulty and the pool grows per lesson.
  // For prototype: 3 questions per lesson (matches default quizQuestionsRequired).
  // correct: index into choices[] array (0-based).
  quizQuestions: [
    {
      id: "q1", lessonId: "interest-builds",
      question: "Which balance grows faster if left unpaid?",
      choices: ["10% APR", "24% APR", "APR does not matter"],
      correct: 1
    },
    {
      id: "q2", lessonId: "interest-builds",
      question: "What does APR stand for?",
      choices: ["Annual Payment Rate", "Annual Percentage Rate", "Applied Profit Ratio"],
      correct: 1
    },
    {
      id: "q3", lessonId: "interest-builds",
      question: "Which of these would cost the most over 5 years?",
      choices: ["$10,000 at 5% APR", "$10,000 at 22% APR", "$10,000 at 0% APR"],
      correct: 1
    },

    // ── minimum-payments-trap ──
    { id: "q4", lessonId: "minimum-payments-trap",
      question: "What happens to most of your minimum payment on a credit card?",
      choices: ["It reduces your balance", "It covers interest charges", "It increases your credit limit"],
      correct: 1 },
    { id: "q5", lessonId: "minimum-payments-trap",
      question: "How does paying more than the minimum help you?",
      choices: ["Instantly raises your credit score", "Reduces time and interest paid overall", "Waives your next payment"],
      correct: 1 },
    { id: "q6", lessonId: "minimum-payments-trap",
      question: "Who benefits most when you pay only the minimum?",
      choices: ["You, by preserving cash", "The bank, through extended interest charges", "Your credit score"],
      correct: 1 },

    // ── three-month-rule ──
    { id: "q7", lessonId: "three-month-rule",
      question: "What is the standard emergency fund target?",
      choices: ["1 month of expenses", "3–6 months of expenses", "12 months of income"],
      correct: 1 },
    { id: "q8", lessonId: "three-month-rule",
      question: "What risk does an emergency fund help you avoid?",
      choices: ["Missing investment gains", "Taking on credit card debt for unexpected costs", "Paying too much in taxes"],
      correct: 1 },
    { id: "q9", lessonId: "three-month-rule",
      question: "Where should you NOT put your emergency fund?",
      choices: ["High-yield savings account", "Invested in the stock market", "Separate savings account"],
      correct: 1 },

    // ── where-to-keep-it ──
    { id: "q10", lessonId: "where-to-keep-it",
      question: "What is the main advantage of a high-yield savings account for an emergency fund?",
      choices: ["Higher risk for higher returns", "Earns interest while staying accessible", "It's only FDIC insured"],
      correct: 1 },
    { id: "q11", lessonId: "where-to-keep-it",
      question: "Why should your emergency fund be separate from your checking account?",
      choices: ["To earn higher interest", "To avoid spending it on non-emergencies", "To reduce your tax liability"],
      correct: 1 },
    { id: "q12", lessonId: "where-to-keep-it",
      question: "Why is investing your emergency fund a bad idea?",
      choices: ["Markets rarely grow", "You may need to sell at a loss during an emergency", "Investments have no liquidity"],
      correct: 1 },

    // ── total-cost-of-ownership ──
    { id: "q13", lessonId: "total-cost-of-ownership",
      question: "Which cost is often overlooked when buying a car?",
      choices: ["Sticker price", "Depreciation in the first year", "Monthly loan payment"],
      correct: 1 },
    { id: "q14", lessonId: "total-cost-of-ownership",
      question: "What does 'total cost of ownership' include beyond the purchase price?",
      choices: ["Only fuel costs", "Insurance, maintenance, fuel, and depreciation", "Only insurance"],
      correct: 1 },
    { id: "q15", lessonId: "total-cost-of-ownership",
      question: "What is the best number to compare when choosing between two cars?",
      choices: ["Monthly payment", "Total cost of ownership", "Sticker price"],
      correct: 1 },

    // ── loan-vs-lease ──
    { id: "q16", lessonId: "loan-vs-lease",
      question: "What is the main advantage of leasing a car?",
      choices: ["You build equity over time", "Lower monthly payments", "No mileage restrictions"],
      correct: 1 },
    { id: "q17", lessonId: "loan-vs-lease",
      question: "When does buying a car make more financial sense than leasing?",
      choices: ["When you want a new car every 2 years", "When you plan to keep it long-term", "When you drive very little"],
      correct: 1 },
    { id: "q18", lessonId: "loan-vs-lease",
      question: "What happens at the end of a car lease?",
      choices: ["You own the car outright", "You return the car or buy it at residual value", "You automatically renew"],
      correct: 1 },

    // ── what-you-can-afford ──
    { id: "q19", lessonId: "what-you-can-afford",
      question: "What is the common housing affordability rule of thumb?",
      choices: ["50% of gross income", "28% of gross income", "15% of net income"],
      correct: 1 },
    { id: "q20", lessonId: "what-you-can-afford",
      question: "What does getting pre-approved for a mortgage tell you?",
      choices: ["The exact home you should buy", "Your actual borrowing limit based on income and debt", "That you're guaranteed the loan"],
      correct: 1 },
    { id: "q21", lessonId: "what-you-can-afford",
      question: "What does DTI stand for in home buying?",
      choices: ["Down to Income", "Debt-to-Income ratio", "Deposit Transfer Index"],
      correct: 1 },

    // ── hidden-costs-buying ──
    { id: "q22", lessonId: "hidden-costs-buying",
      question: "What are closing costs typically as a percentage of purchase price?",
      choices: ["0.5–1%", "2–5%", "10–15%"],
      correct: 1 },
    { id: "q23", lessonId: "hidden-costs-buying",
      question: "What is a standard annual home maintenance reserve?",
      choices: ["5% of home value", "1% of home value", "10% of mortgage payment"],
      correct: 1 },
    { id: "q24", lessonId: "hidden-costs-buying",
      question: "Which recurring cost is specific to condos and planned communities?",
      choices: ["Closing costs", "HOA fees", "Down payment"],
      correct: 1 },

    // ── why-start-now ──
    { id: "q25", lessonId: "why-start-now",
      question: "What makes starting retirement savings early so powerful?",
      choices: ["Higher contribution limits", "Compound growth over time", "Tax-free withdrawals"],
      correct: 1 },
    { id: "q26", lessonId: "why-start-now",
      question: "If two people save different amounts but one starts 10 years earlier, who likely ends up with more?",
      choices: ["The one who saves more per month", "The one who starts earlier", "They end up the same"],
      correct: 1 },
    { id: "q27", lessonId: "why-start-now",
      question: "What does compound growth mean?",
      choices: ["Your returns are taxed each year", "Your returns generate their own returns over time", "You earn a fixed interest rate"],
      correct: 1 },

    // ── 401k-and-the-match ──
    { id: "q28", lessonId: "401k-and-the-match",
      question: "What is an employer match in a 401k?",
      choices: ["A bonus paid at retirement", "Free money added when you contribute", "A mandatory contribution"],
      correct: 1 },
    { id: "q29", lessonId: "401k-and-the-match",
      question: "What happens to your taxable income when you contribute to a traditional 401k?",
      choices: ["It increases", "It decreases", "It stays the same"],
      correct: 1 },
    { id: "q30", lessonId: "401k-and-the-match",
      question: "What is the smartest first move with a 401k?",
      choices: ["Invest in individual stocks", "Contribute enough to get the full employer match", "Wait until you earn more"],
      correct: 1 },

    // ── federal-vs-private ──
    { id: "q31", lessonId: "federal-vs-private",
      question: "What is one key advantage of federal student loans over private loans?",
      choices: ["Always lower total cost", "Access to income-driven repayment plans", "No interest charged"],
      correct: 1 },
    { id: "q32", lessonId: "federal-vs-private",
      question: "What type of interest rate do most federal student loans have?",
      choices: ["Variable", "Fixed", "Adjustable"],
      correct: 1 },
    { id: "q33", lessonId: "federal-vs-private",
      question: "When should you consider private student loans?",
      choices: ["Before federal loans", "After exhausting federal options", "When you want lower monthly payments"],
      correct: 1 },

    // ── income-driven-repayment ──
    { id: "q34", lessonId: "income-driven-repayment",
      question: "What does income-driven repayment base your payment on?",
      choices: ["Your loan balance", "Your discretionary income", "Your credit score"],
      correct: 1 },
    { id: "q35", lessonId: "income-driven-repayment",
      question: "What can happen to remaining federal loan balances after 20–25 years on IDR?",
      choices: ["They disappear with no tax consequences", "They may be forgiven (and possibly taxed)", "They convert to private loans"],
      correct: 1 },
    { id: "q36", lessonId: "income-driven-repayment",
      question: "Does interest stop accruing on IDR plans?",
      choices: ["Yes, that's the main benefit", "No, interest still accrues", "Only if your payment is zero"],
      correct: 1 },

    // ── deductible-vs-premium ──
    { id: "q37", lessonId: "deductible-vs-premium",
      question: "What is a health insurance premium?",
      choices: ["What you pay when you visit a doctor", "Your monthly cost for coverage", "Your out-of-pocket maximum"],
      correct: 1 },
    { id: "q38", lessonId: "deductible-vs-premium",
      question: "What is a health insurance deductible?",
      choices: ["What you pay monthly regardless of use", "What you pay before insurance kicks in", "The maximum you'll ever pay"],
      correct: 1 },
    { id: "q39", lessonId: "deductible-vs-premium",
      question: "Who benefits most from a high-deductible health plan?",
      choices: ["People with frequent medical needs", "Healthy people who rarely use healthcare", "Retirees only"],
      correct: 1 },

    // ── hsa-basics ──
    { id: "q40", lessonId: "hsa-basics",
      question: "What makes an HSA a 'triple tax advantage'?",
      choices: ["Three different accounts", "Tax-free contributions, growth, and qualified withdrawals", "It triples your savings"],
      correct: 1 },
    { id: "q41", lessonId: "hsa-basics",
      question: "What type of health plan do you need to qualify for an HSA?",
      choices: ["Any employer plan", "A high-deductible health plan", "A government plan only"],
      correct: 1 },
    { id: "q42", lessonId: "hsa-basics",
      question: "What happens to unused HSA funds at the end of the year?",
      choices: ["They are forfeited", "They roll over to the next year", "They convert to cash"],
      correct: 1 },

    // ── index-funds-explained ──
    { id: "q43", lessonId: "index-funds-explained",
      question: "What does an index fund track?",
      choices: ["Individual stock picks", "A market index like the S&P 500", "Real estate prices"],
      correct: 1 },
    { id: "q44", lessonId: "index-funds-explained",
      question: "Why do index funds typically have lower fees than actively managed funds?",
      choices: ["They take more risk", "They don't require active management", "They're only for institutions"],
      correct: 1 },
    { id: "q45", lessonId: "index-funds-explained",
      question: "What advantage do index funds provide that individual stocks don't?",
      choices: ["Guaranteed returns", "Instant diversification across many companies", "Tax-free growth"],
      correct: 1 },

    // ── risk-and-time-horizon ──
    { id: "q46", lessonId: "risk-and-time-horizon",
      question: "What is 'time horizon' in investing?",
      choices: ["The limit on how much you can invest", "How long before you need the money", "The maximum return you expect"],
      correct: 1 },
    { id: "q47", lessonId: "risk-and-time-horizon",
      question: "If you need money in 2 years, what kind of investments are most appropriate?",
      choices: ["High-risk stocks for maximum growth", "Lower-risk investments to avoid losses", "Cryptocurrency for quick gains"],
      correct: 1 },
    { id: "q48", lessonId: "risk-and-time-horizon",
      question: "What is the general rule for someone with a 30-year investment horizon?",
      choices: ["Mostly bonds for safety", "More stocks since time corrects short-term drops", "Keep everything in cash"],
      correct: 1 }
  ],

  // ─── XP configuration (admin-editable) ───────────────────────────────────
  // These are the PRD's core tuning levers. All three are surfaced in the
  // Learn admin panel so they can be adjusted during user testing without
  // touching code.
  //   bonusMultiplier:       daily task lessons earn this multiple of base XP (PRD placeholder: 5x)
  //   discountedRate:        manual learning after daily bonus consumed (PRD placeholder: 0.5x)
  //   quizQuestionsRequired: questions answered correctly before quiz ends (default: 3)
  xpConfig: {
    bonusMultiplier: 5,
    discountedRate: 0.5,
    quizQuestionsRequired: 3
  },

  // ─── Tier definitions ─────────────────────────────────────────────────────
  // MVP tiers: Copper → Silver → Gold. The color drives the ring fill color
  // in renderBadgeRing(). maxLevel controls when the badge tier advances.
  // Progression: level increments per XP threshold; at maxLevel, tier advances
  // and level resets to 1. Final tier (Gold) caps at maxLevel with no advance.
  tiers: [
    { name: "Copper", color: "#b87333", maxLevel: 10 },
    { name: "Silver", color: "#a8a9ad", maxLevel: 10 },
    { name: "Gold",   color: "#ffd700", maxLevel: 10 }
  ],

  // ─── Active lesson session ────────────────────────────────────────────────
  // currentLesson: set to a lesson object when user enters a lesson screen.
  // quiz and lesson screens both read from this — keeps them in sync without
  // passing arguments through onclick strings.
  currentLesson: null,

  // activeQuizIndex: which question the user is currently on (0-based).
  // activeQuizChoice: index of the correct answer once chosen, or null.
  // activeQuizWrongChoices: all choice indices the user has tried and got wrong
  //   for the current question — these stay red and disabled permanently for
  //   that question. Cleared on next question or exit.
  activeQuizIndex: 0,
  activeQuizChoice: null,
  activeQuizWrongChoices: [],

  // ─── Recently active ──────────────────────────────────────────────────────
  // Ordered list of badge names by last access. Updated by selectLesson().
  // Drives the "Recently Active" section — this is resume behavior (where
  // the user left off), not a static flag on the badge object.
  recentlyActive: ["Credit Cards", "Emergency Fund"],

  // ─── Search ───────────────────────────────────────────────────────────────
  // searchQuery: the current value of the Learn tab search input.
  // Persisted in state so renderSearch() can re-filter on partial renders
  // without losing the input's value. Cleared when user navigates away.
  searchQuery: "",

  // ─── Chat with Buddy ──────────────────────────────────────────────────────
  // messages: the session transcript, [{ from:"user"|"buddy", text, link? }].
  // Append-only via chatRespond() (js/chat-router.js). Persisting it here (vs.
  // rebuilding per visit) is what lets the user follow a reply's link and come
  // back to the conversation intact. The greeting is NOT stored — chat.js
  // always renders CHAT_GREETING ahead of this array.
  chat: { messages: [], bubbles: [] },

  // ─── Reward session data ──────────────────────────────────────────────────
  // Written by completeLesson() before navigating to the reward screen.
  // The reward screen reads entirely from this — no hardcoded values.
  // Each entry: { name, tier, level, oldProgress, newProgress, xpBase, xpBonus, leveledUp, newTier, newLevel }
  rewardBadgeGains: [],
  rewardXp: 0,             // total XP across all badges (base + bonus combined)
  rewardLessonTitle: "",   // lesson title shown in reward screen header

  // Charity Points earned by this completion, itemised. Two awards can land —
  // the lesson's own bones and the daily task's — and before this they both
  // went silently into state.kibble, so the reward screen showed neither and
  // the total came to roughly double what the home card had promised.
  // Opened by lessonRewardStart / completeLesson, written through lrPointsRecord.
  rewardPoints: null,

  // ─── Budget ───────────────────────────────────────────────────────────────
  // Main budget dashboard state. Status drives which experience renders.
  // status values: "empty" | "in-progress" | "complete" | "refresh" | "checkup"
  selectedBudgetCategory: null,
  selectedDebt: null,
  debtAnalyzerExtraPayment: 200,
  debtAnalyzerIncluded: {},
  // ── v2 debt data (L14) ────────────────────────────────────────────────────
  // v3 never specified debts, so the v2 debt screens are kept off the main
  // paths and still need their instruments. Everything else that lived on
  // state.budget — 5 nested category buckets, fixedOverhead, the peer-average
  // profile — was retired in 2b along with the screens that read it. The v3
  // budget is state.plan (12 flat categories).
  budget: {
    fixedOverhead: [
      { name: "Debt Minimum Payments", amount: 150 }
    ],
    debts: [
      {
        id: "d_1", type: "creditCard", name: "Chase Sapphire",
        balance: 4200, apr: 22.99, minPayment: 95,
        remainingMonths: 0, payoffBehavior: "sometimes",
        repaymentType: "standard", pslfPaymentsMade: 0,
        contactName: "", customSubtype: "", revolving: true,
        expanded: false
      },
      {
        id: "d_2", type: "autoLoan", name: "Honda Civic Loan",
        balance: 11800, apr: 6.9, minPayment: 287,
        remainingMonths: 44,
        repaymentType: "standard", pslfPaymentsMade: 0,
        contactName: "", customSubtype: "", revolving: false,
        expanded: false
      },
      {
        id: "d_3", type: "studentLoan", name: "Federal Student Loan",
        balance: 28500, apr: 5.05, minPayment: 295,
        remainingMonths: 108,
        repaymentType: "standard", pslfPaymentsMade: 0,
        contactName: "", customSubtype: "", revolving: false,
        expanded: false
      }
    ]
  },

  // ── Lifestyle answers and derived sub-sliders ─────────────────────────────
  // answers: per theme, keyed by questionIndex → answerIndex (0–3)
  // lastUpdated: ISO date string or null
  lifestyleAnswers: {
    food:          { answers: {}, lastUpdated: null },
    entertainment: { answers: {}, lastUpdated: null },
    travel:        { answers: {}, lastUpdated: null },
    shopping:      { answers: {}, lastUpdated: null },
    other:         { answers: {}, lastUpdated: null }
  },


  // ── Point-in-time balance snapshots (for monthly tracking) ────────────────
  accountBalances: [],  // [{id, account, amount, date}]

  // ── Flow origin tracking (for post-flow return navigation) ────────────────
  // Set to the screen key where a multi-step input flow began.
  // Cleared when the flow completes (finish screen returns user here).
  flowOrigin: null,

  // ── Post-result loop context ──────────────────────────────────────────────
  // Describes what was just completed. Drives the context headline on post-result
  // screen and the impact-landing destination on the finish screen.
  // "budget" | "lifestyle" | "monthlyUpdate" | "goal" | null
  postResultContext:  null,
  postResultTheme:    null,   // lifestyle theme key when context === "lifestyle"
  postResultReaction: null,   // reaction selected on post-result screen
  nextAction:         null,   // action chosen on next-action screen
  monthlyUpdateGap:   null,   // detected gap from monthly update flow

  // ── Lifestyle chain step tracking ────────────────────────────────────────
  selectedLifestyleTheme: null,  // theme key active in lifestyle-chain screen
  lifestyleChainStep:     0,     // 0-based index of current question in chain

  // ── Commitments from post-result loop ────────────────────────────────────
  commitments: [],  // [{id, text, createdAt, goalId}]

  // ── Pending budget baseline ───────────────────────────────────────────────
  // Set by submitBudgetBaseline() when a builder saves over an EXISTING budget:
  // the baseline parks here while the shared update-confirm screen shows the
  // old → new comparison. Applied and cleared on confirm; cleared on discard.
  // A new budget from either builder is a pure override — the old "re-apply
  // lifestyle answers?" re-run prompt was removed with this seam.
  pendingBaseline: null,

};

// Wipes user-entered profile data and re-renders. Called from admin panel.
function resetUserData() {
  // The value trail is user-entered data too, and it is the kind that LEAVES:
  // it rides in a URL a third party records. Left behind, the next tester on
  // this browser would carry the previous one's figures into their checkpoint
  // (js/value-trail.js).
  if (typeof ubTrailReset === "function") ubTrailReset();
  state.userProfile = { name: "", monthlyIncome: "", housingCost: "", notes: "" };
  state.budget.debts         = [];
  state.selectedDebt         = null;
  state.debtAnalyzerIncluded = {};
  state.selectedOffer        = null;
  state.rewardBadgeGains     = null;
  state.rewardXp             = 0;
  state.rewardLessonTitle    = "";
  state.rewardPoints         = null;
  state.accountBalances      = [];
  state.commitments          = [];
  state.flowOrigin           = null;
  state.postResultContext    = null;
  state.postResultTheme      = null;
  state.postResultReaction   = null;
  state.nextAction           = null;
  state.monthlyUpdateGap     = null;
  state.editingGoalId        = null;
  state.pendingBaseline      = null;
  state.lessonPlayback       = { sentences: [], cues: [], total: 0, elapsed: 0, lastTick: 0, index: 0, playing: false, ended: false, completed: false, currentLessonId: null, pendingAutoPlay: false, timer: null, speed: 1, scrubWasPlaying: false };
  state.chat                 = { messages: [], bubbles: [] };
  // Lesson framing answers and the derived visual plan. Without these a reset
  // re-seeds the figures but the lesson never re-asks its framing questions.
  state.lessonFraming        = null;
  state.lessonProfile        = {};
  state.lessonVisualPlan     = null;
  // Estimator cooldowns are keyed to the day clock, which bootV3() re-seeds —
  // leaving them behind makes every category open on "All caught up" with no
  // data behind it.
  state.estimator            = null;
  state.estimatorAsked       = {};
  state.selectedCategory     = null;
  // Setup answers that unlock follow-ups — without this, a reset leaves the
  // streaming list and statement week behind and the follow-ups stay unlocked
  // against questions the user no longer appears to have answered.
  state.journalProfile       = {};
  state.kbd                  = { open: false, layer: "abc", shift: false };
  // Re-seed from the v3 data files so reset returns to the seeded start state
  // rather than an empty one (D03: refresh does the same thing via the gate).
  bootV3();
  render();
}
