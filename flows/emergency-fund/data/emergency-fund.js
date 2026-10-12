// GENERATED from emergency-fund.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const EMERGENCY_FUND =
{
  "_note": "Emergency fund tool. Unlike its neighbours this file is NOT a byte-identical copy of anything in 'v3 Files/spec/' — the ESF spec (docs/emergency-fund-spec.md) ships no data file, so these figures were sourced for it. Every figure carries the source it came from; the arithmetic that consumes them lives in js/esf.js.",

  "irregularBills": {
    "_note": "Screen 4 — bills that do not arrive monthly. Each row is opt-in: the tool ASSUMES the tester already counted the cost inside what they typed earlier, and [Add it] is the correction. So a row left untouched adds nothing, which is the safe direction for a double-count and the wrong direction for an omission. `showIf` gates which rows appear at all; `basis` says how the estimate is built.",

    "bills": [
      { "id": "propertyTax", "label": "Property tax", "showIf": "owns",
        "basis": "ratioOfHousing", "value": 0.14, "category": "Housing",
        "_source": "Census ACS 2023: median real estate taxes paid $3,057/yr against median monthly owner cost with a mortgage of $1,828 — about 14% of the monthly housing figure. Expressed as a ratio so it tracks the ZIP's own housing cost rather than a national flat rate; property tax is the most place-variable bill on this list." },

      { "id": "homeInsurance", "label": "Home insurance", "showIf": "owns",
        "basis": "monthly", "value": 110, "col": "Housing", "category": "Housing",
        "qualifier": "Often bundled into a mortgage payment too.",
        "_source": "NAIC Homeowners Insurance Report: US average annual premium about $1,320, so roughly $110 a month." },

      { "id": "hoa", "label": "HOA or condo fee", "showIf": "owns",
        "basis": "monthly", "value": 250, "col": "Housing", "category": "Housing",
        "_source": "Census ACS median monthly HOA fee for units that carry one. The spec's mock shows $0 here; a real median is better, because the row is opt-in — somebody with no HOA simply never taps it, whereas $0 makes the row look broken." },

      { "id": "carInsurance", "label": "Car insurance", "showIf": "hasCar",
        "basis": "monthly", "value": 145, "col": "Transport", "category": "Transport",
        "overlaps": "transportRunning",
        "_source": "AAA Your Driving Costs 2025 full-coverage average, the same table the Transport help-me-out tree prices insurance from.",
        "_overlapNote": "FLAGGED FOR THE OWNER. The Screen 3 'Gas, insurance, upkeep' estimate ALREADY contains car insurance — it is the largest single part of it. Adding this row on top double-counts about $145 a month, roughly $900 on a six-month target. It is safe only because the row is opt-in and defaults to off. Deleting this entry is the clean fix if the owner agrees." },

      { "id": "plates", "label": "Plates and tags", "showIf": "hasCar",
        "basis": "monthly", "value": 15, "category": "Transport",
        "_source": "Average US annual vehicle registration and title cost of roughly $180. Varies more by state than almost anything else here — several states charge a flat $30 a year, several charge a percentage of vehicle value." },

      { "id": "school", "label": "School costs", "showIf": "always",
        "basis": "monthly", "value": 60, "category": "Other",
        "_source": "NRF Back-to-School survey: about $720 a year per household on school supplies, fees and clothing. Shown to everyone rather than gated on dependents, because onboarding does not collect dependents and a household of one simply never taps it." }
    ],

    "_omitted": {
      "yearlySubscriptions": "The spec's Screen 4 lists a 'Yearly subscriptions' row at about $25 a month. Deliberately NOT built: Subscriptions is one of the six categories the owner excluded from the emergency fund as dispensable, so a row that adds it back contradicts that ruling. Restoring it is one entry in the bills array."
    }
  },

  "utilitiesSplit": {
    "_note": "Utilities is ONE category in the taxonomy but TWO input rows on Screen 2, split by how well a tester recalls them. The peer figure stays authoritative for the total; this table only supplies the PROPORTION, so the two rows always sum back to it.",
    "_source": "Same EIA and published-average figures the Utilities help-me-out tree uses (data/help-me-out.json). Power and water are the locally-priced part, broadband and mobile the nationally-priced part — the same division that file documents.",
    "homeByHousehold": { "_note": "Home size is not collected anywhere, so household size proxies for it. Keys are help-me-out's own kwhByHome ids.", "1": "apt1", "2": "apt2", "3": "house2", "4": "house3" }
  },

  "driving": {
    "_note": "Backs the three car-related fields. The tester types a dollar figure and the subtext reads it BACK to them in units they can sanity-check — 'about 640 miles a month' means something, '$210 of fuel' does not.",

    "nationalPerGallon": 3.15,
    "_gallonSource": "EIA US regular all-formulations retail average. National on purpose: fuel is the most locally-variable price on this list, but no per-ZIP feed ships with this prototype, so only the states that diverge far enough to be visibly wrong are listed below and everywhere else takes the national figure. Inventing a per-county gas price would be exactly the plausible-looking fabrication the peer model exists to avoid.",
    "perGallonByState": {
      "CA": 4.65, "HI": 4.55, "WA": 4.30, "NV": 3.95, "OR": 3.85, "AK": 3.70
    },

    "milesPerGallon": 25,
    "_mpgSource": "EPA/FHWA average on-road fuel economy for the US light-duty fleet. One figure rather than per-vehicle: the tester has not been asked what they drive at this point in the flow, and the Transport help-me-out tree is where that detail belongs.",

    "maintenancePerMile": 0.10,
    "_maintenanceSource": "AAA Your Driving Costs 2025, maintenance/repair/tyres component — the same table the Transport tree prices operating cost from. Derived from the miles the fuel figure implies rather than asked, because it is the one car cost nobody can state and it scales with distance more than with anything else.",

    "typicalCarPayment": 740,
    "_paymentSource": "Experian State of the Automotive Finance Market, average new-vehicle monthly payment. Used ONLY as a proxy for what the car is worth when estimating insurance — a bigger payment means a pricier car to replace.",
    "paymentFactorRange": [0.8, 1.4],
    "_paymentFactorNote": "Clamped hard. The payment is weak evidence about premium and unclamped it would let a $1,500 truck note triple somebody's insurance estimate.",

    "_demographicsNote": "The owner asked for demographics in the insurance estimate. Age, driving record and claims history are the three things that actually move a premium and NONE of them are collected anywhere in this app. What is available is the ZIP and the car payment, so the estimate uses those and says so. Adding an age question would move this materially.",

    "_insuranceNote": "STATE, not a cost-of-living multiplier. Premiums are set by state regulation, minimum-coverage law, litigation climate and weather losses — none of which track the price of a restaurant meal, so the Transport COL index is the wrong instrument and was pricing Louisiana and Maine alike. The spread is close to threefold end to end, which is far wider than any COL column, so the state figure has to be the base rather than a modifier on a national one.",
    "insuranceAnnualNational": 1680,
    "insuranceAnnualByState": {
      "LA": 2900, "FL": 2870, "NY": 2620, "NV": 2450, "MI": 2400, "DE": 2250,
      "CO": 2180, "GA": 2100, "TX": 2050, "RI": 2040, "CA": 2000, "SC": 1960,
      "MD": 1930, "CT": 1880, "NJ": 1860, "OK": 1810, "AZ": 1790, "KY": 1780,
      "MS": 1760, "AR": 1720, "AL": 1660, "MO": 1650, "MN": 1620, "TN": 1600,
      "KS": 1580, "PA": 1570, "NE": 1540, "IL": 1520, "WV": 1510, "AK": 1500,
      "UT": 1490, "NM": 1480, "MT": 1470, "WA": 1460, "OR": 1440, "NC": 1430,
      "IN": 1410, "WI": 1380, "SD": 1370, "ND": 1360, "VA": 1350, "MA": 1340,
      "IA": 1320, "OH": 1290, "ID": 1240, "NH": 1220, "WY": 1200, "HI": 1190,
      "VT": 1180, "ME": 1140
    },
    "_insuranceSource": "NAIC average annual full-coverage auto premium by state. ANCHORS, not researched constants — refresh from the NAIC Auto Insurance Database Report at build. Full coverage on purpose: it errs high, which is correct for a safety net, and it avoids needing a vehicle-age question nothing asks."
  },

  "utilities": {
    "_note": "GAS, which the shared help-me-out rates do not carry. That model prices power and water only, so the row promised 'water, gas, and electricity' and quietly billed two of the three — about $55 a month missing on a house. Kept in THIS file rather than added to help-me-out.json, because that table also feeds the budget builder and changing it would move a figure in a tool nobody asked us to touch.",
    "_source": "EIA Residential Energy Consumption Survey: average residential natural gas spend by dwelling size, annualised and divided by twelve.",
    "gasByHome": { "studio": 22, "apt1": 28, "apt2": 38, "house2": 55, "house3": 66, "house4": 80 },

    "_multiplierNote": "THREE utilities, TWO geographies. The Utilities cost-of-living multiplier is an ELECTRICITY RATE ratio — it is built from EIA state cents-per-kWh and nothing else. Applying it to water and gas said a San Carlos water bill is 2.6x the national one, which it is not: water is a municipal charge and gas has its own pipeline economics. Water and gas now take the composite regional price level (BEA RPP, geo.all) instead, which is what 'things cost a bit more here' actually looks like — 1.18 in San Carlos, not 2.60. Same class of error the _note in zip-cost-of-living.json warns about: one ratio applied to something that does not vary that way.",

    "electricityCapMultiplier": 1.6,
    "_electricityCapSource": "A DOCUMENTED STUB, like propertyTax.valueDispersion. kwhByHome is national-average usage, and usage runs INVERSE to rate: the high-rate states are mild-climate coastal ones where households use far less power. Coastal California averages roughly 500-700 kWh a month against a national 900-1300, while its rate ratio is about 2.6 — so multiplying national usage by the full rate ratio overstates twice and produced a $557 power bill for a 4-bed in 94070. Net of the usage difference the real multiple is nearer 1.4-1.7, so the rate ratio is capped here. The honest fix is regionalised kwhByHome, which needs a climate-zone table this prototype does not carry. The cap only ever bites above 1.6; every ZIP at or below it is unaffected."
  },

  "debt": {
    "_note": "The credit-card and loan row has no estimate behind it — nothing in onboarding asks how many cards or loans somebody carries. So instead of a dollar band, the dropdown offers the COMBINATIONS, each labelled with what it stands for: '$285 (1 loan + 1 card)'. The tester recognises their own situation rather than guessing at a figure, and the label does the explaining a description line would otherwise have to.",
    "_source": "Card issuers set a minimum payment at roughly 2% of the balance with a floor near $35, which is where most small balances land. $250 is a typical monthly payment on a personal or student loan. Both are anchors to re-source at build.",
    "_optionsNote": "SIX options, not every combination. Cards 0-3 x loans 0-3 produced sixteen, which is a scroll and a decision rather than a recognition. These are ranges covering the situations people actually land in, and the label says the situation rather than the arithmetic.",
    "options": [
      { "label": "Nothing owed",                  "lo": 0,   "hi": 0 },
      { "label": "A card or two",                 "lo": 35,  "hi": 75 },
      { "label": "Several cards",                 "lo": 75,  "hi": 200 },
      { "label": "A loan, maybe a card",          "lo": 250, "hi": 350 },
      { "label": "A loan and a few cards",        "lo": 350, "hi": 600 },
      { "label": "More than one loan, plus cards", "lo": 600, "hi": 1000 }
    ]
  },

  "connectivity": {
    "_note": "Phone and internet are ONE row and are priced NATIONALLY — no cost-of-living multiplier. A carrier and an ISP charge the same in Palo Alto as in Helena, and applying the Utilities multiplier to them overstated the bill by more than it corrected.",
    "_source": "Published carrier and ISP list prices. Per-line price falls as lines are added, which is how every US family plan is actually sold.",
    "perLine": { "1": 65, "2": 55, "3": 45, "4": 40, "5": 36 },
    "internet": 75,
    "maxLines": 5,
    "_linesNote": "Lines = adults + kids 13 and over, capped at 5. The old model used min(householdSize, 4), which billed a phone line for a toddler."
  },

  "groceries": {
    "_note": "Adjusts the peer grocery figure for WHO is in the household, not just how many. The peer value already scales with household size, so this is a ratio against that size — it comes out at 1.0 for a household of adults and only moves when young children are in it.",
    "_source": "USDA Cost of Food at Home, which prices a child aged 1-8 at roughly two thirds of an adult and a teenager at about an adult's cost.",
    "weight": { "adult": 1.0, "teen": 1.0, "under13": 0.7 }
  },

  "aca": {
    "_note": "The unemployed-insurance estimate. Only ever shown when health coverage comes through a job — that is the only coverage that ends with the paycheck.",
    "_source": "CMS publishes benchmark silver premiums by rating area and the standard age curve is public. Rating areas are not in this repo, so the benchmark is stubbed at a national figure with a handful of states that diverge far enough to be visibly wrong.",
    "benchmarkSilver": 480,
    "benchmarkByState": { "NY": 610, "VT": 690, "WV": 700, "AK": 750, "CA": 450, "MD": 390, "NH": 360 },
    "ageCurve": { "21": 1.0, "30": 1.135, "40": 1.278, "50": 1.786, "60": 2.714, "67": 3.0 },
    "childFactor": 0.765,
    "maxChildrenCounted": 3,
    "_childNote": "Under-21s all price at the same factor, and only the three oldest count — both are the published ACA rules, not simplifications."
  },

  "hoa": {
    "_note": "Branches on PROPERTY TYPE, never on ZIP. HOA fees are bimodal: most houses have none, condos and townhomes almost always carry one. A ZIP-based estimate hands a house owner in a condo-heavy ZIP a fee they do not pay.",
    "_source": "Census ACS median monthly HOA fee for units that carry one, scaled by the area's housing cost multiplier.",
    "byPlaceType": { "condo": 350, "houseSmall": 0, "houseLarge": 0, "aptSmall": 0, "aptLarge": 0 },
    "shownFor": ["condo", "houseSmall", "houseLarge"]
  },

  "propertyTax": {
    "_note": "Estimated but NOT counted until the tester adds it. About four in five mortgages escrow property tax, so a pre-filled figure double-counts for most owners — and a number already in the box gets accepted without thought more readily than an empty one. This is the one place the err-high rule is deliberately reversed.",
    "_source": "County effective tax rates against Zillow home values. Neither is in this repo yet, so this is a state-level stub: effective rate applied to a typical home value scaled by the area's housing multiplier.",
    "nationalHomeValue": 420000,
    "rateByState": { "NJ": 0.0223, "IL": 0.0205, "NH": 0.0193, "CT": 0.0179, "TX": 0.0163, "NY": 0.0154, "OH": 0.0152, "PA": 0.0141, "IA": 0.0149, "MI": 0.0138, "WI": 0.0151, "MA": 0.0104, "WA": 0.0084, "OR": 0.0086, "FL": 0.0079, "GA": 0.0083, "NC": 0.0070, "TN": 0.0056, "AR": 0.0061, "AZ": 0.0060, "NV": 0.0049, "UT": 0.0052, "HI": 0.0032, "AL": 0.0040, "CO": 0.0051, "CA": 0.0071 },
    "nationalRate": 0.0099,

    "valueDispersion": 1.35,
    "_dispersionNote": "STUB CALIBRATION, not a sourced figure. The county multiplier this scales is derived from RENTS, and home VALUES spread further than rents do — a metro renting at 2.4x national sells at more than 2.4x national. Without it San Francisco priced at about $850k, roughly half of what it is, and the tax estimate came out half as well. Replace the whole thing the moment county ZHVI is in the repo; this exists so the coastal figures are not visibly wrong in a demo."
  },

  "lifestyleModifiers": {
    "_note": "Buddy's lifestyle questions. THE MECHANIC IS A MULTIPLIER, NOT A CALCULATION: adjusted = the row's opening estimate x the product of every answer chosen. The ESF has already priced this row for their ZIP, income band and household, and these questions adjust that for how the person actually lives — they never rebuild the figure from scratch. Three reasons it works this way. The estimate stays the spine. It is a multiplier per option rather than a model per category, so it is far less content. And it can never disagree with the screen the way a from-scratch answer can, leaving the user with two numbers and no way to choose.",

    "_midIsOne": "THE MID OPTION IS ALWAYS EXACTLY 1.00 and every set must contain one. Owner's ruling: we assume the peer benchmark describes somebody living in the middle, so the middle answer must not move the figure. This is a DOCUMENTED ASSUMPTION, NOT A SOURCED FACT — peer benchmarks are population averages, not mid-tier averages. It sits alongside valueDispersion in the known-stubs list: directionally sound, not defensible.",

    "_prototype": true,
    "_prototypeNote": "Every x below is invented. Reasoned rather than random — the direction and the RELATIVE SIZE of each is what has to survive a tester saying 'that seems about right' — but none is sourced. They live here rather than as literals in js/buddy-esf.js because a figure buried in a model is invisible, and a flagged entry in the data file is a to-do somebody can find.",

    "_storeNames": "Brand names are in the option labels on purpose. 'Mid-tier grocery' does not land at a 5th-grade reading level; 'Kroger' does.",

    "groceries": {
      "opening": "Groceries means food you cook and eat at home. Not restaurants or takeout.",
      "questions": [
        { "id": "frequency", "ask": "How often do you shop for food?",
          "options": [
            { "id": "daily",    "label": "Most days",                   "short": "shopping most days",        "x": 1.15 },
            { "id": "weekly34", "label": "Three or four times a week",  "short": "shopping three or four times a week", "x": 1.08 },
            { "id": "weekly12", "label": "Once or twice a week",        "short": "shopping once or twice a week", "x": 1.00 },
            { "id": "biweekly", "label": "Every two weeks",             "short": "shopping every two weeks",  "x": 0.95 },
            { "id": "monthly",  "label": "About once a month",          "short": "shopping about once a month", "x": 0.90 }
          ],
          "_why": "More trips means more unplanned items. The spread is deliberately narrow — where you shop moves the bill far more than how often." },
        { "id": "where", "ask": "Where do you shop most?",
          "options": [
            { "id": "warehouse", "label": "Warehouse clubs (Sam's, Costco)",  "short": "at warehouse clubs", "x": 0.85 },
            { "id": "value",     "label": "Value stores (Walmart, Aldi)",     "short": "at value stores",    "x": 0.90 },
            { "id": "midtier",   "label": "Regular grocery stores (Kroger, HEB)", "short": "at regular grocery stores", "x": 1.00 },
            { "id": "premium",   "label": "Higher-end stores (Whole Foods)",  "short": "at higher-end stores", "x": 1.30 }
          ],
          "_why": "The widest lever in the set, which matches how people actually talk about their grocery bill." },
        { "id": "diet", "ask": "Is anyone eating differently?",
          "options": [
            { "id": "same",    "label": "No, we all eat the same",   "short": "everyone eating the same", "x": 1.00 },
            { "id": "special", "label": "Someone has a special diet", "short": "with a special diet in the house", "x": 1.12 },
            { "id": "organic", "label": "We buy a lot of organic",    "short": "buying a lot of organic", "x": 1.15 }
          ] }
      ]
    },

    "power": {
      "opening": "This is your water, gas and electricity together.",
      "questions": [
        { "id": "athome", "ask": "When is someone usually home?",
          "options": [
            { "id": "allday",   "label": "Someone's home all day",       "short": "with someone home all day",    "x": 1.18 },
            { "id": "mix",      "label": "It's a mix",                   "short": "with people in and out",       "x": 1.08 },
            { "id": "evenings", "label": "Mostly mornings and evenings", "short": "out most of the day",          "x": 1.00 }
          ] },
        { "id": "climate", "ask": "Do you run heat or air conditioning?",
          "options": [
            { "id": "most",   "label": "Most of the year",           "short": "running heat or air most of the year", "x": 1.25 },
            { "id": "season", "label": "Just summer, or just winter", "short": "heating or cooling one season",        "x": 1.00 },
            { "id": "rarely", "label": "Hardly ever",                 "short": "hardly using heat or air",             "x": 0.82 }
          ] },
        { "id": "cooking", "ask": "How often do you cook at home?",
          "options": [
            { "id": "most",   "label": "Most nights",        "short": "cooking most nights",       "x": 1.06 },
            { "id": "some",   "label": "A few times a week", "short": "cooking a few times a week", "x": 1.00 },
            { "id": "rarely", "label": "Hardly ever",        "short": "hardly cooking",             "x": 0.95 }
          ],
          "_why": "Barely moves it, on purpose. Heating and cooling are the biggest slice of a power bill and an oven is a small one — the relative size of these three is the part a tester will judge." }
      ],
      "_climateWhy": "The widest lever here, for the same reason: heating and cooling dominate the bill."
    },

    "connect": {
      "opening": "This is your phone bill and your internet bill together.",
      "questions": [
        { "id": "lines", "ask": "How many phone lines are on your bill?",
          "options": [
            { "id": "one",   "label": "Just one",     "short": "one phone line",         "x": 0.58 },
            { "id": "two",   "label": "Two",          "short": "two lines",              "x": 0.79 },
            { "id": "three", "label": "Three",        "short": "three lines",            "x": 1.00 },
            { "id": "four",  "label": "Four",         "short": "four lines",             "x": 1.17 },
            { "id": "five",  "label": "Five or more", "short": "five or more lines",     "x": 1.32 }
          ],
          "_why": "Not linear, because carriers charge less per line as lines are added. Three is the mid option because the opening estimate counts a line for every adult and teenager, which lands near three for a typical household." },
        { "id": "plans", "ask": "What kind of plans are they?",
          "options": [
            { "id": "unlimited", "label": "Unlimited data",        "short": "on unlimited data",   "x": 1.00 },
            { "id": "mixed",     "label": "A mix",                 "short": "on a mix of plans",   "x": 0.90 },
            { "id": "smaller",   "label": "Smaller data plans",    "short": "on smaller plans",    "x": 0.80 },
            { "id": "basic",     "label": "Basic phones, no data", "short": "on basic phones",     "x": 0.62 }
          ] },
        { "id": "internet", "ask": "What about home internet?",
          "options": [
            { "id": "fast",  "label": "A fast plan",      "short": "with a fast internet plan",  "x": 1.12 },
            { "id": "basic", "label": "A basic plan",     "short": "with a basic internet plan", "x": 1.00 },
            { "id": "none",  "label": "I don't have one", "short": "with no home internet",      "x": 0.72 }
          ] }
      ]
    },

    "carCosts": {
      "opening": "This is fuel, insurance and upkeep. Not your car payment.",
      "questions": [
        { "id": "miles", "ask": "How far do you drive on a normal day?",
          "options": [
            { "id": "over60", "label": "More than 60 miles", "short": "driving more than 60 miles a day", "x": 1.70 },
            { "id": "m4060",  "label": "40 to 60 miles",     "short": "driving 40 to 60 miles a day",     "x": 1.45 },
            { "id": "m2040",  "label": "20 to 40 miles",     "short": "driving 20 to 40 miles a day",     "x": 1.22 },
            { "id": "m1020",  "label": "10 to 20 miles",     "short": "driving 10 to 20 miles a day",     "x": 1.00 },
            { "id": "under10","label": "Under 10 miles",     "short": "driving under 10 miles a day",     "x": 0.85 },
            { "id": "none",   "label": "I don't drive much at all", "short": "hardly driving",            "x": 0.62 }
          ],
          "_why": "Never reaches zero, and that is the point. Insurance is most of this row before a wheel turns, so driving nothing still costs most of the middle answer. A tester who drives five miles a day and sees the figure barely move will assume the model is broken unless the copy says why." },
        { "id": "vehicle", "ask": "What do you drive?",
          "options": [
            { "id": "truck", "label": "A truck or van",     "short": "in a truck or van", "x": 1.28 },
            { "id": "suv",   "label": "An SUV or crossover", "short": "in an SUV",         "x": 1.14 },
            { "id": "sedan", "label": "A sedan",             "short": "in a sedan",        "x": 1.00 },
            { "id": "small", "label": "A small car",         "short": "in a small car",    "x": 0.88 }
          ] },
        { "id": "fuel", "ask": "Gas or electric?",
          "options": [
            { "id": "gas",      "label": "Gas",      "short": "running on gas", "x": 1.00 },
            { "id": "hybrid",   "label": "Hybrid",   "short": "a hybrid",       "x": 0.88 },
            { "id": "electric", "label": "Electric", "short": "electric",       "x": 0.78 }
          ] }
      ]
    },

    "medical": {
      "opening": "This is insurance, copays, prescriptions, dental and vision.",
      "_note": "NOT about how often you see a doctor — that does not move a premium, and asking it would imply it does. The two levers here are the plan you would buy and whether anyone needs care all year. Neither is already in the model: the estimate prices a mid-level plan on the ages in the household, so household size and age must NOT appear here or they are counted twice.",
      "questions": [
        { "id": "plan", "ask": "What kind of plan would you buy?",
          "options": [
            { "id": "better", "label": "Better coverage, less to pay at the doctor",  "short": "on better coverage",   "x": 1.25 },
            { "id": "mid",    "label": "Something in the middle",                     "short": "on a mid-level plan",  "x": 1.00 },
            { "id": "basic",  "label": "The cheapest one, more to pay at the doctor", "short": "on the cheapest plan", "x": 0.80 }
          ] },
        { "id": "care", "ask": "Does anyone need care all year round?",
          "options": [
            { "id": "specialist", "label": "Someone sees a specialist",        "short": "with someone seeing a specialist",   "x": 1.15 },
            { "id": "medication", "label": "Someone takes regular medication", "short": "with someone on regular medication", "x": 1.08 },
            { "id": "none",       "label": "No, nothing regular",              "short": "with nobody needing regular care",   "x": 1.00 }
          ] }
      ]
    }
  },

  "crisis": {
    "_note": "What changes if the paycheck stops. The owner's ruling: ONLY health cover moves. Housing, debt, transport, food and utilities are all carried at their stated figures, and the tool states the adjustment rather than offering a choice about it — an emergency fund that assumes you keep your employer's insurance is not covering the emergency.",
    "replacementPremiumFrom": "helpMeOut:Health.marketplacePremium",
    "_premiumNote": "Read from data/help-me-out.json rather than restated here, so the marketplace premium has exactly one definition. Copying it would leave two figures free to drift.",
    "maxCovered": 2,
    "_maxCoveredNote": "Premium is charged per adult, capped at two, matching the medical help-me-out model's own treatment of the same figure."
  }
}
;
