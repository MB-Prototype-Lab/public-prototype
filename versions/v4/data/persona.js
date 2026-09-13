// GENERATED from persona.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const PERSONA =
{
  "_note": "Fixed persona. Onboarding inputs override zip, householdSize, and incomeAnnual where the tester provides them (D09). Everything else always falls back to these values.",

  "identity": {
    "name": "Sam",
    "age": 34,
    "householdSize": 2,
    "incomeAnnual": 68000,
    "zip": "90066",
    "city": "Los Angeles",
    "state": "CA",
    "housingStatus": "renting",
    "overridableByOnboarding": ["zip", "householdSize", "incomeAnnual", "name"]
  },

  "lifestyle": {
    "_note": "Set by the lifestyle wizard. These values are the persona default; the wizard overwrites them if the tester completes it.",
    "foodie": "moderate",
    "cooksAtHome": "sometimes",
    "hobbySpend": "low",
    "paysRent": true,
    "commute": "car",
    "travelFrequency": "rare"
  },

  "state": {
    "healthState": "slightly_behind",
    "streakDays": 6,
    "streakDaysIfOnboarded": 1,
    "buddyLevel": 3,
    "kibbleBalance": 240,
    "diamondBalance": 12,
    "journalEntriesCompleted": 6
  },

  "buddy": {
    "breed": "golden_retriever",
    "furColor": "cream",
    "eyeColor": "brown",
    "noseColor": "black",
    "size": "medium",
    "name": ""
  },

  "goals": {
    "strategic": {
      "id": "g_strategic_1",
      "label": "Stop living paycheck to paycheck",
      "setDuringOnboarding": true
    },
    "tactical": [
      {
        "id": "g_tactical_1",
        "label": "Build a $3,000 emergency fund",
        "target": 3000,
        "current": 620,
        "pacePercent": 41,
        "status": "behind",
        "targetDate": "2027-02-01"
      },
      {
        "id": "g_tactical_2",
        "label": "Keep dining out under $320 a month",
        "target": 320,
        "current": 429,
        "pacePercent": 134,
        "status": "over",
        "period": "monthly"
      }
    ]
  },

  "connectedAccounts": {
    "_note": "No real connection in the prototype. These exist so account-aware screens render (D19).",
    "hasBankConnection": false,
    "selfReportedBalance": 1840,
    "selfReportedBalanceAsOf": "day_5",
    "stocks": [
      { "symbol": "VTI", "shares": 4, "selfReported": true },
      { "symbol": "AAPL", "shares": 6, "selfReported": true }
    ]
  },

  "subscriptions": {
    "_note": "mentionedInJournal drives the unused-subscription observation (D18).",
    "known": [
      { "name": "Netflix", "monthly": 15.49, "lastMentionedDay": 1, "status": "active_used" },
      { "name": "Spotify", "monthly": 11.99, "lastMentionedDay": 2, "status": "active_used" },
      { "name": "Hulu", "monthly": 18.99, "lastMentionedDay": null, "status": "flagged_unused", "weeksSinceMention": 3 },
      { "name": "YouTube Premium", "monthly": 13.99, "lastMentionedDay": 3, "status": "active_used" }
    ]
  },

  "bills": {
    "upcoming": [
      { "name": "Car insurance", "amount": 187, "dueInDays": 4, "inBudget": false, "flagged": true },
      { "name": "Rent", "amount": 2150, "dueInDays": 12, "inBudget": true, "flagged": false },
      { "name": "Phone", "amount": 62, "dueInDays": 9, "inBudget": true, "flagged": false }
    ]
  }
}
;
