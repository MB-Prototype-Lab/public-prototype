// GENERATED from seed-state.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const SEED_STATE =
{
  "_note": "Six days of fabricated history (D16). Loaded into memory on mount, discarded on refresh (D03). Day 6 is 'yesterday' relative to the session.",

  "budget": {
    "_note": "The plan layer. Produced by the lifestyle wizard; these are the persona defaults.",
    "monthly": {
      "Housing": 2150,
      "Groceries": 420,
      "Dining out": 320,
      "Transport": 210,
      "Utilities": 165,
      "Subscriptions": 60,
      "Health": 95,
      "Personal care": 55,
      "Entertainment": 90,
      "Shopping": 140,
      "Debt payments": 275,
      "Other": 80
    },
    "totalMonthly": 4060,
    "monthlyIncomeNet": 4390
  },

  "journalHistory": [
    {
      "day": 1,
      "label": "6 days ago",
      "entries": [
        { "category": "Dining out", "description": "Coffee and a breakfast sandwich", "amount": 11.4, "confidence": "confirmed" },
        { "category": "Dining out", "description": "Lunch with a coworker", "amount": 22.0, "confidence": "estimated" },
        { "category": "Transport", "description": "Gas", "amount": 48.0, "confidence": "confirmed" }
      ],
      "engagementSignals": ["Netflix"]
    },
    {
      "day": 2,
      "label": "5 days ago",
      "entries": [
        { "category": "Groceries", "description": "Weekly shop", "amount": 96.3, "confidence": "confirmed" },
        { "category": "Dining out", "description": "Coffee", "amount": 5.75, "confidence": "confirmed" },
        { "category": "Personal care", "description": "Haircut", "amount": 40.0, "confidence": "estimated" }
      ],
      "engagementSignals": ["Spotify"]
    },
    {
      "day": 3,
      "label": "4 days ago",
      "entries": [
        { "category": "Dining out", "description": "Coffee", "amount": 5.75, "confidence": "confirmed" },
        { "category": "Dining out", "description": "Dinner out", "amount": 54.2, "confidence": "estimated" },
        { "category": "Entertainment", "description": "Movie tickets", "amount": 28.0, "confidence": "confirmed" }
      ],
      "engagementSignals": ["YouTube Premium"]
    },
    {
      "day": 4,
      "label": "3 days ago",
      "entries": [
        { "category": "Dining out", "description": "Coffee", "amount": 5.75, "confidence": "confirmed" },
        { "category": "Groceries", "description": "Corner store run", "amount": 18.4, "confidence": "estimated" },
        { "category": "Dining out", "description": "Takeout", "amount": 31.5, "confidence": "estimated" }
      ],
      "engagementSignals": []
    },
    {
      "day": 5,
      "label": "2 days ago",
      "entries": [
        { "category": "Dining out", "description": "Coffee", "amount": 5.75, "confidence": "confirmed" },
        { "category": "Shopping", "description": "New running shoes", "amount": 88.0, "confidence": "confirmed" },
        { "category": "Groceries", "description": "Ate at home", "amount": 0, "confidence": "confirmed", "zeroReason": "already_purchased" }
      ],
      "engagementSignals": ["Netflix"],
      "balanceReported": 1840
    },
    {
      "day": 6,
      "label": "Yesterday",
      "entries": [
        { "category": "Dining out", "description": "Coffee", "amount": 5.75, "confidence": "confirmed" },
        { "category": "Dining out", "description": "Lunch out", "amount": 19.8, "confidence": "estimated" },
        { "category": "Transport", "description": "Parking", "amount": 12.0, "confidence": "confirmed" }
      ],
      "engagementSignals": ["Spotify", "Netflix"]
    }
  ],

  "monthToDateActuals": {
    "_note": "Fabricated to plausible full-month depth so budget-vs-actuals renders. Six days of journal detail sits inside these totals (D19).",
    "Housing": 2150,
    "Groceries": 318,
    "Dining out": 429,
    "Transport": 186,
    "Utilities": 158,
    "Subscriptions": 60.46,
    "Health": 40,
    "Personal care": 74,
    "Entertainment": 112,
    "Shopping": 203,
    "Debt payments": 275,
    "Other": 46
  },

  "observations": {
    "_note": "All four must be reachable from at least two screens (D18, Phase 6).",
    "seeded": [
      {
        "id": "obs_dining_over_peers",
        "type": "peer_gap",
        "category": "Dining out",
        "headline": "You're spending more on dining out than your peers",
        "detail": "34% above what households like yours spend in your area.",
        "userValue": 429,
        "peerValue": 320,
        "surfaces": ["home_tip", "budget_comparison", "daily_update", "progress"]
      },
      {
        "id": "obs_hulu_unused",
        "type": "subscription_flag",
        "headline": "Haven't heard about Hulu in a while",
        "detail": "You haven't mentioned watching anything on Hulu in three weeks. It's $18.99 a month.",
        "subscription": "Hulu",
        "monthlyAmount": 18.99,
        "surfaces": ["home_task", "progress", "daily_update"]
      },
      {
        "id": "obs_emergency_behind",
        "type": "goal_pace",
        "headline": "Your emergency fund is behind pace",
        "detail": "At 41% of where you planned to be by now.",
        "goalId": "g_tactical_1",
        "pacePercent": 41,
        "surfaces": ["goals", "daily_update", "progress"]
      },
      {
        "id": "obs_insurance_unbudgeted",
        "type": "bill_flag",
        "headline": "Car insurance is due in four days",
        "detail": "$187, and it isn't in this month's budget.",
        "amount": 187,
        "dueInDays": 4,
        "surfaces": ["home_task", "progress_bills", "budget_comparison"]
      }
    ]
  },

  "dailyTasks": {
    "_note": "Precomputed order (A7). Scoring engine specified in 03-home-daily-loop.md but not run at runtime.",
    "today": [
      { "id": "t_journal", "label": "Do your money journal", "route": "money_journal", "kibble": 20, "priority": 1 },
      { "id": "t_budget", "label": "Set up your budget", "route": "budget", "kibble": 15, "priority": 2 },
      { "id": "t_lesson_apr", "label": "See what APR really costs you", "route": "lesson:apr", "kibble": 25, "priority": 3 }
    ]
  },

  "tipBanner": {
    "_note": "Strict character limit: 90 characters (E019).",
    "today": "Dining out is your biggest gap this month. Small swaps add up fast."
  }
}
;
