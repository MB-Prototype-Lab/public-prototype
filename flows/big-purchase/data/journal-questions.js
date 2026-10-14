// GENERATED from journal-questions.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const JOURNAL_QUESTIONS =
{
  "_note": "Structured questions carry the parsing load (D11). Each has a priority score and cooldown. Selection: highest score among questions off cooldown, capped at 4 per entry.",
  "config": {
    "questionsPerEntry": 4,
    "freeTextAlwaysLast": true,
    "freeTextParsed": false
  },
  "questions": [
    {
      "id": "q_breakfast",
      "type": "multi_select",
      "prompt": "What did yesterday's breakfast look like?",
      "priority": 80,
      "cooldownDays": 1,
      "options": [
        {
          "label": "Ate at home",
          "category": "Groceries",
          "amount": 0,
          "zeroReason": "already_purchased"
        },
        {
          "label": "Coffee out",
          "category": "Dining out",
          "estimate": 5.75
        },
        {
          "label": "Coffee and food out",
          "category": "Dining out",
          "estimate": 11.4
        },
        {
          "label": "Skipped it",
          "category": null,
          "amount": 0
        }
      ]
    },
    {
      "id": "q_lunch",
      "type": "multi_select",
      "prompt": "And lunch?",
      "priority": 80,
      "cooldownDays": 1,
      "options": [
        {
          "label": "Brought it from home",
          "category": "Groceries",
          "amount": 0,
          "zeroReason": "already_purchased"
        },
        {
          "label": "Bought something quick",
          "category": "Dining out",
          "estimate": 14.5
        },
        {
          "label": "Sat down somewhere",
          "category": "Dining out",
          "estimate": 24.0
        },
        {
          "label": "Someone else paid",
          "category": null,
          "amount": 0
        }
      ]
    },
    {
      "id": "q_dinner",
      "type": "multi_select",
      "prompt": "How about dinner?",
      "priority": 78,
      "cooldownDays": 1,
      "options": [
        {
          "label": "Cooked at home",
          "category": "Groceries",
          "amount": 0,
          "zeroReason": "already_purchased"
        },
        {
          "label": "Takeout or delivery",
          "category": "Dining out",
          "estimate": 31.5
        },
        {
          "label": "Went out",
          "category": "Dining out",
          "estimate": 48.0
        },
        {
          "label": "Groceries on the way home",
          "category": "Groceries",
          "estimate": 42.0
        }
      ]
    },
    {
      "id": "q_getting_around",
      "type": "multi_select",
      "prompt": "How did you get around?",
      "priority": 65,
      "cooldownDays": 2,
      "options": [
        {
          "label": "Drove, no stops",
          "category": null,
          "amount": 0
        },
        {
          "label": "Filled up the tank",
          "category": "Transport",
          "estimate": 48.0
        },
        {
          "label": "Paid for parking",
          "category": "Transport",
          "estimate": 12.0
        },
        {
          "label": "Rideshare or transit",
          "category": "Transport",
          "estimate": 18.0
        },
        {
          "label": "Stayed home",
          "category": null,
          "amount": 0
        }
      ]
    },
    {
      "id": "q_watched",
      "type": "multi_select",
      "prompt": "Watch or listen to anything?",
      "priority": 60,
      "cooldownDays": 2,
      "signalOnly": true,
      "_note": "Engagement signal, not spend. Drives the unused-subscription observation. Follow-up to q_streaming: the options are the services the user said they pay for, so the Hulu option only appears for someone who has Hulu.",
      "options": [
        {
          "label": "Netflix",
          "signal": "Netflix"
        },
        {
          "label": "Hulu",
          "signal": "Hulu"
        },
        {
          "label": "YouTube",
          "signal": "YouTube Premium"
        },
        {
          "label": "Spotify",
          "signal": "Spotify"
        },
        {
          "label": "Nothing",
          "signal": null
        }
      ],
      "dependsOn": {
        "profileKey": "streaming"
      },
      "optionsFrom": "streaming"
    },
    {
      "id": "q_anything_big",
      "type": "fill_number",
      "prompt": "Anything bigger than usual?",
      "priority": 55,
      "cooldownDays": 3,
      "categoryDropdown": true,
      "placeholder": "Amount",
      "skippable": true
    },
    {
      "id": "q_balance",
      "type": "fill_number",
      "prompt": "Roughly what's in your checking account right now?",
      "priority": 40,
      "cooldownDays": 7,
      "placeholder": "Approximate is fine",
      "skippable": true,
      "updatesGoalProgress": true
    },
    {
      "id": "q_breakfast_habit",
      "type": "single_select",
      "prompt": "You've had coffee out five days running. Is that most days?",
      "priority": 70,
      "cooldownDays": 30,
      "triggeredBy": "pattern_detected",
      "_note": "Pattern follow-up. Answer sets a recurring assumption so future entries pre-fill.",
      "options": [
        {
          "label": "Yes, almost every day",
          "setsRecurring": true
        },
        {
          "label": "Only on work days",
          "setsRecurring": "weekdays"
        },
        {
          "label": "This week was unusual",
          "setsRecurring": false
        }
      ]
    },
    {
      "id": "q_streaming",
      "type": "multi_select",
      "prompt": "Which of these are you paying for?",
      "priority": 72,
      "cooldownDays": 30,
      "signalOnly": true,
      "profileKey": "streaming",
      "_note": "Setup question. Its answer becomes the option list for q_watched, which is what makes the unused-subscription observation reachable at all.",
      "options": [
        {
          "label": "Netflix",
          "signal": "Netflix"
        },
        {
          "label": "Hulu",
          "signal": "Hulu"
        },
        {
          "label": "Disney+",
          "signal": "Disney+"
        },
        {
          "label": "YouTube Premium",
          "signal": "YouTube Premium"
        },
        {
          "label": "Spotify",
          "signal": "Spotify"
        },
        {
          "label": "Max",
          "signal": "Max"
        },
        {
          "label": "None of these",
          "signal": null
        }
      ]
    },
    {
      "id": "q_statement_timing",
      "type": "single_select",
      "prompt": "Roughly when do your card and bank statements turn up?",
      "priority": 68,
      "cooldownDays": 30,
      "signalOnly": true,
      "profileKey": "statementWeek",
      "_note": "Setup question. A rough week is all we need — it unlocks q_statement_photo.",
      "options": [
        {
          "label": "First week of the month",
          "signal": "week1"
        },
        {
          "label": "Second week",
          "signal": "week2"
        },
        {
          "label": "Third week",
          "signal": "week3"
        },
        {
          "label": "Last week of the month",
          "signal": "week4"
        },
        {
          "label": "I'm not sure",
          "signal": "unsure"
        }
      ]
    },
    {
      "id": "q_statement_photo",
      "type": "single_select",
      "prompt": "If you photograph every page of your statement, I can read it and pull out what you spent. Worth doing?",
      "priority": 64,
      "cooldownDays": 3,
      "signalOnly": true,
      "dependsOn": {
        "profileKey": "statementWeek"
      },
      "profileKey": "statementInterest",
      "_note": "DEMAND TEST, not a feature (owner). Nothing uploads or gets analysed — the point is whether people want it once they know it exists. 'Not yet' is real signal too: repeated across entries it triangulates when statements land, which is why this has a short cooldown and the others do not.",
      "options": [
        {
          "label": "Yes — I'd do that",
          "signal": "yes"
        },
        {
          "label": "Not yet, it hasn't arrived",
          "signal": "not_yet"
        },
        {
          "label": "Maybe later",
          "signal": "maybe"
        },
        {
          "label": "No, I'd rather not",
          "signal": "no"
        }
      ]
    },
    {
      "id": "q_free_text",
      "type": "free_text",
      "prompt": "Anything else on your mind about yesterday?",
      "priority": 0,
      "cooldownDays": 0,
      "alwaysLast": true,
      "parsed": false,
      "_note": "D12 — accepts input, silently discarded. Never appears on the confirmation screen. Do not acknowledge it.",
      "placeholder": "Write as much or as little as you like",
      "attachments": [
        "image",
        "camera",
        "voice"
      ]
    }
  ]
}
;
