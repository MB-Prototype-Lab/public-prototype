// GENERATED from test-profiles.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const TEST_PROFILES =
{
  "_note": "Nine starting profiles: three cost-of-living tiers x three income levels. Used two ways — the picker a tester sees when they skip setup, and the matrix scripts/sweep.js drives every feature through. TEMPORARY SCAFFOLDING: PROFILE_PICKER in js/config.js takes the screen out of the flow, and this file goes with it when the real onboarding is the only door.",

  "_sources": {
    "costOfLiving": "BEA Regional Price Parities 2023, already in zip-cost-of-living.json. Tiers were chosen empirically from that file by RPP, preferring recognisable metros over rural counties whose rent ratios sit at the data's cap.",
    "income": "US Census American Community Survey 5-year estimates, 2019-2023, median household income by county."
  },

  "defaults": {
    "name": "Me",
    "buddyName": "Buddy",
    "householdSize": 2,
    "_householdNote": "FIXED across all nine on purpose. Household size drives groceries harder than anything else in the model, so varying it as well would confound the two axes this matrix exists to isolate. Change it here and every profile moves together.",
    "zipTier": "at",
    "incomeLevel": "at"
  },

  "zipTiers": [
    { "id": "above", "zip": "95054",
      "label": "Costs more than most places",
      "place": "Santa Clara County, CA",
      "rpp": 112.9,
      "medianIncome": 164281 },
    { "id": "at", "zip": "37203",
      "label": "About what most places cost",
      "place": "Davidson County, TN",
      "rpp": 97.4,
      "medianIncome": 75664 },
    { "id": "below", "zip": "72201",
      "label": "Costs less than most places",
      "place": "Pulaski County, AR",
      "rpp": 89.1,
      "medianIncome": 60385 }
  ],

  "incomeLevels": [
    { "id": "under", "factor": 0.75, "label": "Below what's typical there" },
    { "id": "at",    "factor": 1.00, "label": "About typical there" },
    { "id": "over",  "factor": 1.25, "label": "Above what's typical there" }
  ],

  "_bandNote": "peer-benchmarks.json has five income bands, and +/-25% does not always cross one. Santa Clara at and +25% are both b5; Little Rock at and +25% are both b3 — so those pairs produce identical peer figures. That is the peer model working as specified, but it is invisible, so profileResolve() returns the resolved band and the admin card shows it. Raising income and seeing nothing move is then explained rather than mysterious."
}
;
