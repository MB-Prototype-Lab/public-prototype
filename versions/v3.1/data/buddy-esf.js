// GENERATED from buddy-esf.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const BUDDY_ESF =
{
  "_note": "Buddy's ESF panel — what he says, per screen and per row. Companion to data/buddy-responses.json, NOT part of it: that file is the keyword matcher's response library (message in, one response out), and this is a per-screen question tree the user navigates by tapping. Same dog, two different shapes, and folding this into that file would have meant one of the two shapes pretending to be the other. The keyword matcher is untouched by this feature and still owns the Home chat.",

  "_readingLevel": "5th grade. One idea per sentence. Nothing over 20 words. Every entry here sits behind the D26 advice deflect in js/chat-router.js — Buddy states facts and stops.",

  "_prototypeDataRule": "Owner's ruling: any figure Buddy needs that the model cannot supply is invented, plausible, and phrased as local. Invented figures live in data/*.json marked \"_prototype\": true, never as a literal buried in a model — a flagged entry is a to-do somebody can find.",

  "steps": {
    "_note": "Keyed by state.esf.step, which is 0-indexed because step 0 is the intro. The spec docs count these 1-5; the code counts 0-3 plus the esfPlan screen. Mapping: 0=intro, 1=fixed (Housing and Car Payments), 2=utilities (Keeping things running), 3=rest (Living-related Expenses), plan=esfPlan. Do not renumber one without the other.",

    "0": {
      "prompt": "What can I help with?",
      "items": ["whatIsIt", "whatYoullAsk", "howLong"]
    },
    "1": {
      "prompt": "What can I help with?",
      "items": ["rent", "mortgage", "carPayment", "transit", "bothRentAndMortgage"]
    },
    "2": {
      "prompt": "What can I help with?",
      "items": ["power", "connect", "groceries", "medical", "carCosts"]
    },
    "3": {
      "prompt": "What can I help with?",
      "items": ["debt", "propertyTax", "homeInsurance", "hoa", "anythingElse"]
    },
    "plan": {
      "prompt": "What can I help with?",
      "items": ["coverageMonths", "breathingRoom", "alreadySaved", "targetDate", "headlineNumber"]
    }
  },

  "rows": {
    "_note": "`row` ties an entry to an ESF row id so the panel can show its current figure and, later, write one back. Entries with no `row` are explainers that belong to the screen rather than to a field. `say` is an array of paragraphs. `chips` are the answer choices; a chip may carry `sets` (a disclosure), its own `say`, and `then` (\"list\" returns to the picker, \"row:<id>\" jumps to another entry).",

    "whatIsIt": {
      "label": "What is an emergency fund?",
      "say": [
        "It is money set aside for a bad month.",
        "A job loss. A big repair. Something you did not plan for.",
        "It sits in savings and you do not touch it otherwise."
      ]
    },

    "whatYoullAsk": {
      "label": "What will you ask me?",
      "say": [
        "Four screens of questions about what you pay each month.",
        "First your home and car. Then the bills that keep things running. Then a few that only some people have.",
        "At the end I show you the number and how long it takes to save."
      ]
    },

    "howLong": {
      "label": "How long does this take?",
      "say": [
        "A few minutes.",
        "Most rows already have a number in them. I worked those out from where you live and who lives with you.",
        "You only change the ones that look wrong."
      ]
    },

    "rent": {
      "label": "Rent",
      "row": "rent",
      "say": [
        "Rent is what you pay your landlord each month.",
        "Put in the whole payment, even if you split it with someone. Include parking or storage if they are on the same bill.",
        "If your rent covers utilities, say so — I'll help you skip them later."
      ],
      "chips": [
        {
          "id": "rentUtilsYes",
          "label": "My rent covers utilities",
          "sets": { "rentIncludesUtilities": true },
          "say": [
            "Got it. On the next screen, set Home utilities to $0.",
            "You already paid for them here. Counting them twice would make your fund bigger than it needs to be."
          ]
        },
        {
          "id": "rentUtilsNo",
          "label": "It doesn't",
          "sets": { "rentIncludesUtilities": false },
          "say": [
            "Good — then fill in Home utilities on the next screen.",
            "I'll have an estimate ready for you."
          ]
        }
      ]
    },

    "mortgage": {
      "label": "Mortgage",
      "row": "mortgage",
      "say": [
        "Your mortgage is what you send the bank each month.",
        "Most people's payment also covers property tax and home insurance. That is called escrow.",
        "If yours does, put the whole payment in."
      ],
      "chips": [
        {
          "id": "escrowYes",
          "label": "Mine includes tax and insurance",
          "sets": { "mortgageIncludesEscrow": true },
          "say": [
            "Then you are done with those.",
            "On the Living-related Expenses screen, leave Property Tax and Home Insurance alone.",
            "You have already counted them here."
          ]
        },
        {
          "id": "escrowNo",
          "label": "Mine is just the loan",
          "sets": { "mortgageIncludesEscrow": false },
          "say": [
            "Then add Property Tax and Home Insurance on the Living-related Expenses screen.",
            "I'll have estimates ready for you."
          ]
        },
        {
          "id": "escrowUnsure",
          "label": "I'm not sure",
          "say": [
            "Look at your mortgage statement. If it lists \"escrow\" or shows tax and insurance broken out, they are included.",
            "About 4 out of 5 mortgages include them. If you cannot check right now, assume yours does."
          ],
          "chips": [
            {
              "id": "escrowUnsureYes",
              "label": "Then mine probably does",
              "sets": { "mortgageIncludesEscrow": true },
              "say": [
                "Then leave Property Tax and Home Insurance alone on the Living-related Expenses screen."
              ]
            },
            {
              "id": "escrowUnsureNo",
              "label": "I'll check later",
              "say": [
                "Fair. I'll leave both rows there for you.",
                "Come back and tell me once you know — tap Mortgage again."
              ]
            }
          ]
        }
      ]
    },

    "carPayment": {
      "label": "Car payments",
      "row": "carPayment",
      "say": [
        "This is just your car loan or lease payment. Nothing else.",
        "Not gas. Not insurance. Not repairs. Those come on the next screen.",
        "Paying off two cars? Add them together."
      ],
      "chips": [
        {
          "id": "leaseMaintYes",
          "label": "My lease includes maintenance",
          "sets": { "leaseIncludesMaintenance": true },
          "say": [
            "Good to know. On the next screen, the Car row covers fuel, insurance and upkeep.",
            "Pick a lower range, since your upkeep is already paid here."
          ]
        },
        {
          "id": "leaseMaintNo",
          "label": "It doesn't",
          "sets": { "leaseIncludesMaintenance": false },
          "say": [
            "Then the Car row on the next screen covers all three — fuel, insurance and upkeep."
          ]
        }
      ]
    },

    "transit": {
      "label": "Public transportation",
      "row": "transit",
      "say": [
        "What you spend getting around without a car. Bus, train, subway.",
        "Use your monthly pass. No pass? Add up a normal month of fares.",
        "Rideshare counts too if you use it to get to work or the store."
      ]
    },

    "bothRentAndMortgage": {
      "label": "Should I fill in both?",
      "say": [
        "Usually no. Most people pay rent or a mortgage.",
        "Fill in both only if you really pay both. That happens when you own a home but rent somewhere else for work.",
        "Or you own a mobile home and rent the land it sits on.",
        "Or you own a place you rent out, and rent where you live."
      ]
    },

    "power": {
      "label": "Home utilities",
      "row": "power",
      "say": [
        "This is your water, gas and electricity.",
        "One figure for all three. Use a normal month, not your worst one."
      ]
    },

    "connect": {
      "label": "Phone and internet",
      "row": "connect",
      "say": [
        "This is your phone bill and your internet bill together.",
        "I counted a line for every adult and teenager in your household."
      ]
    },

    "groceries": {
      "label": "Groceries",
      "row": "groceries",
      "say": [
        "Groceries means food you cook and eat at home.",
        "Not restaurants or takeout. Those are not part of an emergency fund."
      ]
    },

    "medical": {
      "label": "Medical",
      "row": "medical",
      "_note": "TWO ANSWERS, because the row is built two ways. Somebody covered through work is priced on a replacement premium — what their own plan would cost once the job stopped — and that figure is deliberately large. Somebody who already buys their own is priced on ordinary out-of-pocket costs, and for them esfReplacementPremium() is 0. Saying 'this looks high on purpose' over $165 is a tool that does not know what it is showing you. Resolved by the employerCoverage variant in js/buddy-esf.js.",
      "variantOn": "employerCoverage",
      "sayIf": {
        "employer": [
          "This one looks high on purpose. Here is why.",
          "Your job pays most of your health insurance. If the job stops, that stops too.",
          "You would buy your own plan. That costs more.",
          "So this row is what your own plan would cost, not what comes out of your paycheck today."
        ],
        "own": [
          "This is insurance, copays, prescriptions, dental and vision.",
          "You already buy your own plan, so this number does not change if a job goes away.",
          "Put in what you actually pay."
        ]
      },
      "chipsIf": {
        "employer": [
          {
            "id": "medicalOk",
            "label": "That makes sense",
            "say": [
              "Good. Leave it where it is.",
              "This is the row people cut first, and it is the one that hurts most to be wrong about."
            ]
          },
          {
            "id": "medicalOwn",
            "label": "I already buy my own insurance",
            "say": [
              "Then put in what you actually pay instead.",
              "Your cost will not change if you lose a job."
            ]
          }
        ],
        "own": [
          {
            "id": "medicalWhatCounts",
            "label": "What counts here?",
            "say": [
              "Your premium, plus what you pay at the counter.",
              "Copays, prescriptions, dental and vision.",
              "Leave out anything a flexible spending account already covers."
            ]
          }
        ]
      }
    },

    "carCosts": {
      "label": "Car costs",
      "row": "carCosts",
      "say": [
        "This is fuel, insurance and upkeep.",
        "Not your car payment — that was the last screen.",
        "Insurance is the big one, and it does not change with how far you drive."
      ],
      "chips": [
        {
          "id": "noCar",
          "label": "I don't own a car at all",
          "sets": { "noCarAtAll": true },
          "say": [
            "Then this row is $0. I've set it for you.",
            "No car, no running costs."
          ]
        }
      ]
    },

    "debt": {
      "label": "Credit card and loan minimums",
      "row": "debt",
      "say": [
        "This is the smallest payment you must make each month. Not what you normally pay.",
        "If you lost your job, this is what keeps you out of trouble.",
        "Pick the row that sounds most like you."
      ]
    },

    "propertyTax": {
      "label": "Property tax",
      "row": "propertyTax",
      "say": [
        "This is the tax on your home. It comes once or twice a year, so I ask for the yearly amount.",
        "First: is it already in your mortgage payment? Most are."
      ],
      "chips": [
        {
          "id": "taxInMortgage",
          "label": "It's in my mortgage",
          "sets": { "mortgageIncludesEscrow": true },
          "say": [
            "Then skip this row. You counted it on the housing screen."
          ]
        },
        {
          "id": "taxSeparate",
          "label": "I pay it separately",
          "sets": { "mortgageIncludesEscrow": false },
          "say": [
            "Then add it here. I've worked out an estimate from typical home values where you live and your state's tax rate.",
            "Your tax bill has the real number if you want to check."
          ]
        },
        {
          "id": "taxUnsure",
          "label": "I'm not sure",
          "say": [
            "Look at your mortgage statement. If it lists \"escrow\", your tax is in there.",
            "About 4 out of 5 mortgages include it."
          ]
        }
      ]
    },

    "homeInsurance": {
      "label": "Home insurance",
      "row": "homeInsurance",
      "say": [
        "This protects your home.",
        "Like property tax, it is often inside your mortgage payment.",
        "Is yours?"
      ],
      "chips": [
        {
          "id": "insInMortgage",
          "label": "It's in my mortgage",
          "sets": { "mortgageIncludesEscrow": true },
          "say": [
            "Then skip this row too. You counted it on the housing screen."
          ]
        },
        {
          "id": "insSeparate",
          "label": "I pay it separately",
          "sets": { "mortgageIncludesEscrow": false },
          "say": [
            "Then add it here. I've put in an average premium for your area."
          ]
        }
      ]
    },

    "hoa": {
      "label": "HOA and housing fees",
      "row": "hoa",
      "say": [
        "Some neighborhoods and buildings charge a monthly fee.",
        "It covers things like landscaping, trash or a pool.",
        "Houses usually do not have one. Condos and townhomes usually do.",
        "Not sure? You would know — it is a separate bill every month."
      ]
    },

    "anythingElse": {
      "label": "Anything else",
      "row": "anythingElse",
      "say": [
        "Anything you must pay every month that I have not asked about.",
        "Good examples: child support, alimony, a storage unit, care for a family member.",
        "Leave out anything you could stop. Streaming, gym, eating out. Those are not part of a safety net."
      ],
      "chips": [
        {
          "id": "childcareQ",
          "label": "What about childcare?",
          "say": [
            "I leave childcare out on purpose.",
            "It is often the second biggest cost for a young family. But it mostly goes away if you lose a job.",
            "If you would still pay it, put it here."
          ]
        }
      ]
    },

    "coverageMonths": {
      "label": "Months of expenses covered",
      "_d26": "Says what each option covers and stops. No \"most people\", no \"we suggest\", no \"safer\". The forbidden sentence is \"We recommend 6 months\" — it was in the original spec header and was cut.",
      "say": [
        "This is how long your fund would last if your money stopped.",
        "3 months covers a short gap between jobs.",
        "6 months covers a longer search, or a job in a smaller field.",
        "9 months covers a long search, or work that comes and goes.",
        "You can change it whenever you want."
      ]
    },

    "breathingRoom": {
      "label": "Breathing room",
      "say": [
        "Emergencies bring costs nobody plans for. A car repair. A flight home.",
        "This adds a little on top of your monthly number.",
        "10% on $2,800 a month adds about $280 to each month you are covered."
      ]
    },

    "alreadySaved": {
      "label": "Already saved",
      "say": [
        "Money you could reach tomorrow if you had to.",
        "Checking, savings, cash.",
        "Not retirement accounts. Taking money out of a 401(k) early costs you taxes and a penalty."
      ]
    },

    "targetDate": {
      "label": "Target date",
      "say": [
        "When you would like the fund finished.",
        "A later date means saving less each month. An earlier one means more."
      ]
    },

    "headlineNumber": {
      "label": "What the big number means",
      "say": [
        "The big number is what is left to save. The smaller one underneath is the whole fund.",
        "They are different because you have already saved some."
      ]
    }
  }
}
;
