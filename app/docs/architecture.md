# v4 Architecture — cross-cutting contracts

> Current editable source is `app/`, migrated from v4. Historical v3/v4
> terminology explains inherited contracts. Root `docs/app-contracts.md` records
> later behavior; `docs/workflow.md` and `docs/publishing.md` govern operations.

**Status: built.** Phases 0-6 are complete and four rounds of manual-test fixes
have landed on top. This file was written before the build and describes the
contracts as they now stand — where a decision has moved since, the section says
so and names the decision that moved it.

This file covers only what *many* screens depend on — the contracts that are
expensive to change once code exists. Per-screen layout, copy, and interaction
detail live in per-phase docs written just before that phase is built.

Read alongside:
- `plan.md` §0 — the twenty-two locked decisions (L1–L22). Authoritative.
- `v3 Files/spec/docs/DECISIONS.md` — D01–D40. Beats every other spec doc.
- `v3 Files/spec/docs/ASSUMPTIONS.md` — A1–A13. A1 is overridden by L1.

---

## 1. The runtime constraint — read this first

v3 is vanilla JS with no build step (L1), and the app is opened as a **`file://`
page**: the gate navigates directly to `app/index.html`.

**Consequence: `fetch()` and `XMLHttpRequest` cannot read local files.** Chrome
and Firefox both treat `file://` as an opaque origin and block them. There is no
dev server to fall back on — the spec assumed Vite (A1), and we overrode that.

v2 never hit this because it has **zero runtime data loading** — all data is
inline in `js/state.js` (verified: no `fetch`, no XHR, no `.json` anywhere in
v2). v3 ships seven JSON files, so this is new and it has to be solved once, up
front.

### The contract: data ships as script-wrapped JSON

Each spec JSON gets a sibling `.js` that assigns it to a global, loaded by a
plain `<script>` tag like everything else:

```js
// app/data/peer-benchmarks.js
// GENERATED from peer-benchmarks.json — do not hand-edit. See scripts/wrap-data.sh
const PEER_BENCHMARKS =
{ ...exact JSON, byte-for-byte... }
;
```

Both files are kept:

| File | Role |
|---|---|
| `data/*.json` | Verbatim copy of the spec. **Never edited.** Diffable against `v3 Files/spec/data/`. |
| `data/zip-cost-of-living.json` | The one exception — authored here, with no spec twin to diff against. Derived from public datasets; the derivation is recorded in its own `method._note`. |
| `data/*.js` | Generated wrapper. What the app actually loads. |

**Two authored files are `.js` with no `.json` sibling** — `data/lesson-scripts.js`
and `data/onboarding-storyboard.js`. Neither is spec data and neither has a
reason to be JSON: `wrap-data.sh` hard-errors on any `.json` it has no global
mapped for, so a JSON twin would mean editing the generator to gain nothing.
The rule is: **JSON when something outside the app has to read it** (the spec
diff, or `gen-audio.sh`'s TTS extractor), plain `.js` otherwise.
That is why `onboarding-script.json` *is* JSON and its storyboard is not.

`scripts/wrap-data.sh` regenerates the `.js` from the `.json`. It is run by hand
when data changes — that's not a build step in the npm sense, and nothing about
opening `index.html` depends on it having been run recently.

<!-- Why keep both rather than only the .js: the .json stays byte-identical to
     the spec, so "did we drift from the spec's numbers?" is one diff away.
     Collapsing to .js only saves seven files and loses that check. -->

**Globals** (load order: data before everything that reads it):

| Global | Source |
|---|---|
| `PERSONA` | `persona.json` |
| `SEED_STATE` | `seed-state.json` |
| `JOURNAL_QUESTIONS` | `journal-questions.json` |
| `PEER_BENCHMARKS` | `peer-benchmarks.json` |
| `DAILY_SCRIPTS` | `daily-scripts.json` |
| `BUDDY_RESPONSES` | `buddy-responses.json` |
| `LESSONS_V3` | `lessons.json` |
| `ZIP_COST_OF_LIVING` | `zip-cost-of-living.json` — **authored here, not a spec copy** |

<!-- LESSONS_V3, not LESSONS — v2's state.lessons still exists and holds the
     48-question quiz pool we're keeping (L9). Two different things; distinct
     names, per the repo's "everything is global, keep names unique" rule. -->

### Repo integration

The root selector opens app/ locally. Published selectors are generated from
publication/catalog.json; never add copied version folders or manual gate rows.
Release configuration loads before app config and supplies immutable tracking plus
the selector return path. See repository-root docs/publishing.md.

---

## 2. Data → state

`state` remains the single source of truth and is still rebuilt by `render()`
after every mutation. The seven globals are **read-only source data**; they are
never mutated. Boot copies what it needs into `state`.

```
boot()
  ├─ state.profile     ← PERSONA.identity, overridden by onboarding (D09)
  ├─ state.budget      ← SEED_STATE.budget.monthly          (plan layer)
  ├─ state.journal     ← SEED_STATE.journalHistory          (journal layer)
  ├─ state.mtd         ← SEED_STATE.monthToDateActuals      (fabricated depth, D19)
  ├─ state.goals       ← PERSONA.goals                      (strategic + tactical)
  ├─ state.bills       ← PERSONA.bills.upcoming
  ├─ state.subs        ← PERSONA.subscriptions.known
  ├─ state.observations← SEED_STATE.observations.seeded     (see §6)
  ├─ state.tasks       ← SEED_STATE.dailyTasks.today
  └─ state.kibble/streak/buddyLevel ← PERSONA.state
```

**Only ZIP, household size, and income are overridable by onboarding** (D09).
Everything else falls back to the persona. A skipped field keeps the persona
value — never block progress to collect data.

**In-memory only** (D03). No localStorage, no backend. v2's refresh-returns-to-
gate behavior carries forward unchanged.

---

## 3. Time model

The persona is **six days in**. Journal history runs `day: 1` (labelled "6 days
ago") through `day: 6` (yesterday). The entry a tester makes is about
*yesterday* — journal questions are previous-day recall (D11).

```
day 1 ... day 6   = seeded history (SEED_STATE.journalHistory)
today             = the tester's session; their entry covers yesterday
```

- `SKIP_ONBOARDING = false` → onboarding runs → streak shows **1** (`streakDaysIfOnboarded`)
- `SKIP_ONBOARDING = true`  → straight to home → streak shows **6** (`streakDays`)

Bills are **relative**: `dueInDays: 4` for the car insurance. Resolve against
real today at render time so "due in four days" stays true whenever it's opened.

<!-- v2's goals module had a simulated clock (clockOffsetDays) driving
     goalsTodayISO(). That module is not carried to v3 (L3). If admin time
     travel is wanted later, add ONE offset helper here and route all date math
     through it from the start — retrofitting it is what made v2 need a grep
     gate against todayISO(). -->

`SKIP_ONBOARDING` lives in `js/config.js`, loaded first. Flipping it must not
require touching anything else (01-onboarding is explicit: "if you find yourself
unwinding logic to make skip work, the wiring is wrong").

---

## 4. The 12-category taxonomy

The single most load-bearing contract in the build. Frozen, ordered, and the
join key across four independent data surfaces.

```js
const CATEGORIES = ["Housing", "Groceries", "Dining out", "Transport",
  "Utilities", "Subscriptions", "Health", "Personal care", "Entertainment",
  "Shopping", "Debt payments", "Other"];
```

Joins: `PEER_BENCHMARKS.base[cat]` · `SEED_STATE.budget.monthly[cat]` ·
`SEED_STATE.monthToDateActuals[cat]` · `JOURNAL_QUESTIONS[].options[].category`.

**There is no Savings category.** Saving is a goal, not a budget line. v2's
`savings` bucket does not survive the port.

v2's 5×3 nested model is replaced entirely, not remapped — it folds Utilities
under Housing and has no Health / Personal care / Other. Category strings are
used as object keys verbatim, including the space and lowercase in `"Dining
out"`. Do not slugify; the data files key on the display string.

<!-- Do this in Phase 0, before the journal writes entries against it. Every
     later phase reads this shape. -->

---

## 5. Three layers, never blurred

| Layer | Source | UI label |
|---|---|---|
| Plan | `SEED_STATE.budget.monthly` | "Your plan" |
| Self-reported | `SEED_STATE.monthToDateActuals` | "What you told me" |
| Automated | bank connection | **not in prototype** |

**The self-reported layer is `monthToDateActuals`, not the sum of
`journalHistory`.** This is easy to get backwards and the numbers don't survive
it: six days of journal entries total roughly $150 of dining out, but the
observation is built on **$429**. 07-progress-bills states the relationship —
*"six days of journal detail sits inside fabricated month-to-date totals"*
(D19).

```
monthToDateActuals[cat]   → the comparison figure ("what you told me")
journalHistory[day]       → the drill-down detail behind it
```

Comparisons, observations, and the daily update all read the month-to-date
figure. The six days are what you show when someone taps into a category.

**A submitted entry adds to month-to-date, and observations recompute** (L17).
This is the loop the prototype exists to test — input with no visible
consequence teaches testers the app is a mock.

Two consequences:

1. **Observation copy must be templated, not static.** `seed-state.json` ships
   authored strings with baked figures (*"34% above what households like yours
   spend"*). Once numbers move, those go stale on first entry. Store the
   template, compute the figure at render.
2. **The layer is correctable, and confirmation is the guard.** The
   self-reported layer has two writers with deliberately different semantics:

   | Writer | Semantics | Why |
   |---|---|---|
   | `journalSubmit` (`js/journal.js`) | **adds** — `mtd[cat] += amount` | each entry is one more thing that happened |
   | `estimatorSubmit` (`screens/spend-estimator.js`) | **replaces** — `mtd[cat] = est` | it is a fresh estimate of the whole month; adding would double on a re-run |

   So a figure *can* go down, and the seeded gap *can* close — a correction is a
   legitimate thing for a user to make, not a bug to design out. What keeps that
   from happening by accident is that **neither writer commits silently**: both
   pass through a confirmation step that states the resulting figure before it
   lands (`screens/journal-confirm.js`; the estimator's result step, which shows
   the current figure alongside the new one when it is replacing something).

   **Any future writer of `state.mtd` needs the same confirmation step.** In a
   full build the journal is ongoing rather than one-shot, and the confirmation
   summarises the day's entries before they commit — same rule, more entries.

The gaps between layers are the product. Two *different* gaps exist for the same
category and must never substitute for one another:

- **vs plan** — $429 against a $320 budget = **34% over**
- **vs peers** — $429 against the peer benchmark (**$295** under the BEA model;
  the spec's own worked example said $370 under the retired tier table — §5)

Per L11, the seeded dining observation is the **plan** comparison, and the peer
comparison gets its own distinct card.

### Peer benchmark formula

The spec states it as a one-liner. **The one-liner is misleading** — verified
against the actual data, *all three* terms differ from how it reads:

```
peerValue = base[category][incomeBand][householdSize - 1]        // ARRAY INDEX
          × benchColMultipliers(zip)[category]                       // BEA, see below
          × Π lifestyleModifiers[dim][answer][category]              // PRODUCT of 6
          → round to nearest 5
```

1. **Household size is an array index, off by one.** `base[cat][band]` is a
   **4-element array**, not an object keyed by household size:
   `"b3": [180, 275, 330, 385]` for Dining out. Household 1 → index 0,
   2 → index 1, 3 → index 2, **4+ → index 3 (clamp)**. Reading it as
   `[householdSize]` returns the wrong household's figure and still looks
   plausible — the classic silent-wrong-number bug.
2. **Cost of living no longer comes from `colTiers` at all.** The spec's
   two-step prefix→tier→multiplier lookup is retired — it gave Manhattan, Palo
   Alto, Santa Clara and Los Angeles the same figures. **Always go through
   `benchColMultipliers(zip)`**, which resolves the ZIP's county to a BEA
   geography; `colTiers` survives only as its last-resort guard. See "Cost of
   living: BEA Regional Price Parities, per category" below. (If you do read
   `colTiers` directly for any reason, its own trap still applies: `zipPrefixes`
   gives a tier *name*, and `tiers[name][category]` is the multiplier.)
3. **Lifestyle is a product across all six dimensions**, not one lookup. A
   category can be touched by several — Dining out is modified by *both*
   `foodie` and `cooksAtHome`. Dimensions that don't name a category contribute
   1.0.

Coverage is every ZIP in the 50 states and DC. US territories have no BEA
figures and report themselves unsupported rather than being given an invented
one; A12's CA/AR/NY/VA prefix list is superseded.

### Two answer-key traps in `lifestyleModifiers`

The wizard's answer labels do **not** all match the data keys:

| Dimension | Data keys | Wizard asks | Trap |
|---|---|---|---|
| `paysRent` | `"true"` / `"false"` | "Do you pay rent or a mortgage? (yes/no)" | Keys are **strings**, not booleans. A boolean `true` misses the table |
| `commute` | `car` / `transit` / **`none`** | "(car / transit / **mostly walk**)" | "mostly walk" → `none`. The label appears nowhere in the data |
| `foodie`, `cooksAtHome`, `hobbySpend`, `travelFrequency` | match their labels | — | fine |

A missed key silently contributes 1.0 instead of the real multiplier, so the
number stays plausible and the bug never surfaces.

### Which categories lifestyle actually reaches

Only **7 of the 12**. The other five always get 1.0:

```
foodie          → Dining out, Groceries        hobbySpend      → Entertainment, Shopping
cooksAtHome     → Dining out, Groceries        paysRent        → Housing
commute         → Transport                    travelFrequency → Other

never modified: Utilities · Subscriptions · Health · Personal care · Debt payments
```

So the "product of six" only ever multiplies more than one term for **Dining out
and Groceries**. Still implement it as a product — but that's the blast radius.

<!-- The worked_example confirms the product reading: foodie=moderate gives
     Dining out 1.0 and cooksAtHome=sometimes gives Dining out 1.0, so the
     product is 1.0 and the example's stated lifestyleMultiplier is 1.0. A
     single-lookup reading would coincidentally agree HERE and diverge for any
     persona whose modifiers aren't all 1.0. Same for the household index: the
     persona is household 2, and [1] vs a naive [2] both return a number.
     These are exactly the bugs that ship silently. -->
<!-- VERIFIED 2026-08-07 by full recompute from the raw JSON:
     base=275 (b3, index 1) × col=1.34 (900→very_high) × life=1.0
     = 368.5 → 370. Matched worked_example exactly at the time.
     SUPERSEDED: the col factor is now BEA (Los Angeles "Other services" =
     107.1), so the product is 295. The base and lifestyle readings this note
     was written to verify are unchanged and still assert 275 and 1.0. -->

### Cost of living: BEA Regional Price Parities, per category

`benchColMultipliers(zip)` is the single chokepoint. Resolution order:

1. **The ZIP's county** (`data/zip-cost-of-living.json` — all 31,913 US ZIPs).
   The county names a **BEA geography**: its metro area, or its state's
   nonmetropolitan portion. BEA's Regional Price Parities give the regional
   price level for four buckets — Housing, Utilities, Goods, Other services —
   where 100 is the national average.
2. **The ZIP's 3-digit prefix → the county most of that prefix sits in**, for
   PO-box-only and "unique" ZIPs no county dataset lists. Widens to numeric
   neighbours if the prefix itself is unlisted, but never across a territory
   boundary — 969 is Guam and 968 is Honolulu.
3. **The old 4-tier prefix table**, as a guard. `peer-benchmarks.json` is a
   verbatim spec copy and is never edited; it is simply no longer the model.

**Why it replaced the tiers.** Three digits mapped to one of four hand-set
tiers, so every ZIP sharing a tier was *identical* — Manhattan, Palo Alto, Santa
Clara and Los Angeles all resolved to the same figures. `very_high` caps Housing
at 1.85, so nowhere could read higher. And the headline averaged twelve
categories unweighted, making Housing one twelfth of it. Santa Clara came out at
121% against Rogers, Arkansas at 111%. BEA says **112.9 and 91.0**, with housing
at **213.0 against 75.8**.

### Local modifiers are per category, from different sources

Housing moves with county rents. Utilities move with state electricity prices.
Groceries track neither. So each category takes its modifier from the source
that actually governs it:

| Category | Regional base | Local modifier |
|---|---|---|
| Housing | BEA Housing | **county** — rent vs the median rent of its own BEA region |
| Utilities | BEA Utilities | **state** — residential ¢/kWh vs national |
| Groceries · Shopping · Transport | BEA Goods | none |
| Dining out · Health · Personal care · Entertainment · Other | BEA Other services | none |
| Subscriptions · Debt payments | **1.0** | none — priced nationally |

The empty cells are deliberate. There is no credible county-level feed for
grocery, restaurant or healthcare prices, so those carry the regional figure
unmodified — fabricating per-county food variation would produce exactly the
plausible-looking wrong number this model exists to remove. The housing ratio is
measured against the county's **own region**, not the nation: BEA has already
priced the region, and comparing to the nation would count it twice.

### The headline index is anchored, not recomputed

```
index = all/100 + Σ weight[c] × (final[c] − base[c])
```

BEA's own published All-items figure, plus the weighted deviation each local
modifier introduces. Where no modifier applies the sum is zero and the index
**is** BEA's number, exactly.

Deliberately not a recomputation from the weights: BEA's real weights are
place-specific — where housing is expensive people spend a larger share on it —
so one national weight set reproduces published All-items to about half a point
typically and is off by ten in San Jose. The weights themselves were recovered
by least squares across all 488 geographies and are shares of **PCE**, not
household out-of-pocket spending, which is why Health lands near Housing.

Coverage is the 50 states and DC. BEA prices no US territory, so a Puerto Rico
or Saipan ZIP reports itself **unsupported** rather than being given an invented
figure.

**Regenerate with `scripts/build-cost-of-living.py`, then `scripts/wrap-data.sh`.**
The generator is the audit trail for 767KB of derived numbers — it names every
source and every derivation.

### `benchSelfTest` no longer asserts 370

The spec's `worked_example` is Dining out, b3, household 2, ZIP 90066 →
`275 × 1.34 × 1.0 = 370`. That **1.34 was the `very_high` tier's** Dining-out
multiplier, i.e. the thing this model replaced. BEA prices restaurant meals
inside "Services: Other", which for Los Angeles is 107.1 — so the peer value is
now **295**.

The test therefore checks the three factors *separately*: the base lookup (the
array-index trap), the lifestyle product (the six-dimension trap), and the cost
of living against the source that replaced it. That is stronger than the old
single assertion, which its own comment admitted several wrong readings could
satisfy — the persona is household 2 with every lifestyle modifier at 1.0, so a
wrong array index still produced 370.

Worth knowing: BEA's "Other services" lumps restaurants with healthcare and
insurance, which vary far less by place, so 1.071 probably understates a Los
Angeles restaurant bill. It is still the best sourced figure available.

### The wizard: answers compose, drags ride on top

**This replaces the running-preview model.** That version multiplied whatever
was already on screen, which is stable in theory and drifted badly in practice:
picking Moderate, dragging Groceries to the floor, then picking "Very into it"
scaled the *dragged* figure rather than the option's own. Toggling between
options with each result rounded to the nearest 5 walked the number somewhere
neither answer implies — the reported case ended at **$10 a month of groceries
for "Very into it"** while Dining out sat at its untouched starting value.

Two separable parts now:

| | |
|---|---|
| **Implied** | the neutral peer figure × every applied dimension's modifier (`lwImpliedNow`, `lwBaseWithout`). Recomputed from the baseline every time, so it never accumulates rounding and re-answering always lands on the same number |
| **Drift** | the tester's adjustment, held as a **ratio** of what was implied when they dragged (`w.drift[category]`, set in `lwAdjust`) |

`preview = implied × drift`. Consequences worth knowing:

- **Answering a different question keeps the drag.** That is the original
  design — "the questions after this one adjust from wherever you leave it" —
  and it still holds, because the ratio applies to whatever the new answer
  implies.
- **Re-answering the same question clears it**, for the categories that
  dimension moves. The drag was a refinement of an answer that no longer stands,
  and carrying it forward is what compounded.
- **Order no longer matters.** Answering foodie → cooks → hobby gives the same
  twelve figures as the reverse. Asserted.
- **Bands are measured from `implied`, not from `preview`**, so dragging cannot
  recentre its own bounds.
- `lwBaseWithout` and `lwImpliedNow` default `applied` to `{}` — a half-built
  session (admin jump, or one handler driven in isolation) reaches them.

### The wizard walks the product, it does not recompute it

`benchAllPeerValues` is the right answer for a one-shot calculation. The
lifestyle wizard is not one — the tester can drag a slider on Q1 and then answer
Q2, and recomputing would silently throw the drag away.

So the wizard holds a **running** preview and applies each answer as a ratio
against whatever is already folded in:

```
new = current × mods[dim][newAnswer][cat] / mods[dim][answerAlreadyApplied][cat]
```

An unanswered dimension contributes 1.0, so the first answer is just the
multiplier; re-answering via Back divides the old one out with no special case;
and with no drags at all it lands on the same figures `benchAllPeerValues` would
have produced, because it is the same six multipliers in the same order. The
running state lives in `state.lifestyleWizard.{preview, applied}`
(`screens/lifestyle-wizard.js`).

### Sliders are bounded by the option that was picked

`renderBudgetSliderRow` takes an optional `bounds`. Without it the track runs 0
to `budgetSliderMax` — the review screen and the Budget tab, where every answer
is in and the figure is the tester's. **With** it, on a question screen, the
track is limited to ±25% of what that option projects for that category
(`lwOptionBounds`). Picking "Not much" for food and then dragging groceries to a
thousand left the description above the slider talking about somebody else.

Three things that are easy to get wrong here:

- **The band is measured from `w.anchors[dim]`, not the live preview.** Once an
  option is applied, `lwProjected(dim, sameValue, cat)` just returns the current
  figure — so a band built from it recentres on every drag and ratchets outwards
  a quarter at a time until the bound means nothing. `lwApplyDimension` records
  what each answer implied; that is the anchor.
- **`lwBoundsForCategory` returns null off the question screen.** `w.step` still
  points at the last question when the review opens, so without the
  `state.screen` guard the review's twelve full-range sliders would silently
  clamp to the last question's band.
- **`travelFrequency` is exempt.** Its Other figure is composed, not
  modifier-derived — see below.

Bands **overlap** between neighbouring options and leave small gaps between
distant ones. That is the deliberate trade against hard contiguous boundaries:
more forgiving at the edges, where a tester is likeliest to be between two
answers. The top option keeps an open ceiling — "A lot" of hobby spend has no
option above it to be promoted to.

### Travel is a named line inside Other

`travelFrequency` multiplies exactly one category — `Other`, the catch-all — and
its middle option is **×1.0, an exact no-op**. So "Now and then" produced Other's
untouched peer base, identical to never answering, while the option's copy
talked about trips. The number and the words described different things.

There is no Travel category and there should not be one: `CATEGORIES` is the
join key across four data files and `peer-benchmarks.json` has no Travel base to
compare against. Instead the question asks **trips a year × a typical trip ÷ 12**
and Other renders as that accrual plus a residual, summing to the category
total. The frequency answer seeds trips-a-year (rare 1, moderate 3, frequent 8)
and stops seeding once the tester moves it.

Because that figure is composed rather than `base × multipliers`, the ±25% band
above does not apply to it — `lwOptionBounds` returns null for this dimension
and `lwTravelBlock` clamps its own two sliders.

### Every figure names its period

The cadence used to live only in `aria-label` — screen-reader only, never
rendered — so at the moment a tester looked at "$85" beside "Other", nothing on
screen said it was a month. `renderBudgetSliderRow` now spells it out on the
figure, in words. The onboarding commute sliders use the same wording.

The review's income line is **"Coming in each month"**, not "Take-home":
onboarding stopped estimating tax (see §5, `monthlyIncome`), so a post-tax label
would be a claim the app cannot back.

**`state.lifestyleAnswered`** is the companion to this. `state.lifestyle` is
fully populated from the persona at boot, so it cannot tell "you told me this"
from "a stranger's default" — and the wizard needs to, or every question opens
pre-selected. The wizard pre-selects only dimensions marked here.

**In v3.1 nothing marks them, and that is the current state.** Onboarding used
to ask two (`ONB_LIFESTYLE_DIMS` — housing and commute) at its step 5; that step
is no longer in `ONB_STEPS`, so `state.lifestyleAnswered` is empty when
onboarding finishes and all six wizard questions open blank. `ONB_LIFESTYLE_DIMS`
and its renderer are still in `screens/onboarding.js`, unreachable, so restoring
the step is a one-word edit. **v3 still asks them** — it is the A/B control and
its step order is unchanged.

### Deriving `incomeBand`

Bands are `b1`–`b5` with `min`/`max` on **annual** income:
`b1` ≤35k · `b2` 35–60k · `b3` 60–90k · `b4` 90–140k · `b5` 140k+.
The persona's $68,000 → `b3`.

**The band is still the peer model's only lookup key**, and `ONB_INCOME_BANDS`
now mirrors `PEER_BENCHMARKS.incomeBands`' `min`/`max` so the two cannot drift.
The five bands are fixed by that file, which is spec data — a sixth band is not
available, which is why the fix for "over $140,000 is everything upwards" is a
**slider inside the band**, not more bands.

Onboarding collects the band, then refines the *figure* within it
(`onbSetIncomeBand` → `onbSetIncomeExact`, `screens/onboarding.js`). `b5`'s
track stops at **$400,000** and reads as open at the top; its data max is
`999999999`, which no slider can express usefully.

`ONB_INCOME_STEP` is **500, not 1000** — `b2` seeds at $47,500, and on a 1,000
grid that figure is not a valid stop, so the browser would snap the thumb the
moment you touched it. Every band's `min` and `annual` divides by 500. Adding a
band means re-checking that.

### `monthlyIncome`: what the tester said, not a take-home estimate

`state.monthlyIncome` (renamed from `monthlyIncomeNet`) is
`profile.incomeAnnual / 12`, written by `onbFinish()`. **There is no post-tax
factor** — the app uses the figure given, and the name no longer claims
otherwise.

Before this it was written once at boot from `SEED_STATE.budget.monthlyIncomeNet`
and never again, so every income band produced the same $4,390 budget. The JSON
key keeps its old name because the seeded persona's 4,390 genuinely *was* a
post-tax figure; only the state field changed. Not to be confused with
`state.userProfile.monthlyIncome`, an unrelated v2 form field.

### Stated figures beat peer guesses

`state.lifestyleDetail` holds amounts the tester typed — `carMonthly`, `carAge`,
`transitWeekly`, `walkMonthly`, and the derived `transportMonthly`. The peer
model never reads them; the **wizard** does, through `lwApplyStated()`
(`screens/lifestyle-wizard.js`), which overwrites `preview.Transport` after the
answers are folded in.

Order matters. Running it *before* the fold-in would let
`lwApplyDimension('commute', …)` multiply a figure that already accounts for
their commute. Running it after leaves `applied.commute` untouched, so a later
commute change still scales from **their** number rather than snapping back to
the peer one.

### Iterate `CATEGORIES`, never `Object.keys(data)`

Several data objects carry a `_note` key alongside their real entries:

| Object | Keys | `_note`? |
|---|---|---|
| `SEED_STATE.budget.monthly` | 12 | no |
| `SEED_STATE.monthToDateActuals` | 13 | **yes** |
| `PEER_BENCHMARKS.base` | 13 | **yes** |
| `PEER_BENCHMARKS.colTiers.zipPrefixes` | 151 | **yes** |
| `PEER_BENCHMARKS.lifestyleModifiers` | 7 | **yes** |

`Object.keys(monthToDateActuals)` yields a `_note` "category" that will render
as a tile, blow up a total, or fail a benchmark lookup. **Always drive
iteration from `CATEGORIES`** (§4) and index into the data, never the reverse.
Same for ZIP prefix lookups — `_note` is a key there too.

**Self-test on build** — `benchSelfTest`, from
`PEER_BENCHMARKS.worked_example`: Dining out, band b3, household 2, ZIP 90066,
foodie moderate. Base **275** and lifestyle **1.0** still reproduce the spec
exactly; the cost-of-living factor is BEA's **1.071**, not the retired tier's
1.34, so the result is **295**. Each factor is asserted separately, which the
old single assertion could not do — see "`benchSelfTest` no longer asserts 370"
in §5. If any of the three doesn't reproduce, the wiring is wrong.

---

### The lesson calculator: one engine, both catalogs

Three sim types live in `js/lesson-rewards.js` (`lrSimBalance`,
`lrSimSavings`, `lrSimSubscriptions`); `screens/lesson-outcome.js` renders them
as **"Try it with numbers"** (`lessonSimulation`).

`screens/simulation.js` is the **v2 stub** and a different screen — it is not
this. `render.js` says so at its `adminSubtitle` line; don't conflate them.

**`lessonSimSpec(lessonId)` is the lookup.** v3's three lessons carry a
`simulation` block in `lessons.json`; `LESSON_SIM_V2` gives thirteen of the
eighteen v2 lessons a spec using the same three engines. Nothing downstream
needs to know which catalog a lesson came from.

Five v2 lessons deliberately have none — "loan vs lease", "deductible vs
premium", "HSA basics", "what you can afford", "total cost of ownership" are
comparisons, not arithmetic on a balance. A calculator bolted onto them would be
a calculator for its own sake.

**`origin` has to be carried, not inferred.** The v3 reward
(`lessonRewardStart`) reads `lessonV3()`, which has never heard of a v2 lesson —
one arriving there falls through to home and loses its badge XP. So
`state.lessonSim.origin` decides where Finish goes: `completeLesson()` for v2,
`lessonRewardStart()` for v3. `quizFinish()` (`screens/quiz.js`) is where the v2
flow picks the calculator up, and it only inserts a step — the XP and badge path
is identical either way.

### The calculator's shape: sliders, then three outcomes

Sliders first, **Healthy · Common · Bad** beneath them, left to right. The boxes
are buttons: each shows what its own figures produce and **moves the sliders
there** when tapped. One source for both — `lessonSimScenarioValues` returns the
values, `lessonSimScenarioOutcome` runs them through the same engine the sliders
drive — so a box can never advertise an outcome the sliders then fail to
reproduce.

**APR is never part of a scenario.** It is seeded from the tester's own card
(`lessonProfileFigure`) and stays wherever they leave it, so all three outcomes
are computed against one rate. That is what makes them comparable: one variable
moves, not two.

This is a **recorded exception** to the sandbox rule in `lrSimDefaults` and
`lessons.json`. That rule is about the *balance* — a made-up debt is something to
poke at and a real one is a judgement. A rate is the subject of the lesson and
public information about a product, and it stays draggable. `LESSON_SIM_RANGES.apr`
steps by **0.5** so a real card rate is expressible; at step 1 the seed snapped
to a rate the card does not charge.

The preset chips this replaces are gone. They were a second, worse version of the
same feature.

### Why the slider bounds live in one table

The bounds used to be literals at each `simSlider` call. They are now
`LESSON_SIM_RANGES`, in one place, because anything that sets a slider
programmatically — a scenario, a default, a seeded rate — can land outside its
range and leave the thumb pinned at an end while the readout shows a figure it
cannot reach. `lessonSimClamp` holds every one of them to the same table.

That check has now caught three bugs, none of them in the code it was written
for:

- `lessons.json` ships `current: 620` for the emergency-fund calculator against
  a **step-50** grid, so the thumb snapped away from the shipped figure on first
  touch. `current` is step 10 now.
- An authored `$75` payment sat off a step-10 grid. `monthlyPayment` is step 5 —
  a minimum payment is usually an odd figure.
- The APR seeded from a real card (25.5%) snapped to 26 on a **step-1** grid, so
  the calculator opened on a rate the card does not charge. `apr` is step 0.5.

`lessonSimClamp` rounds the step *count* and rebuilds, then rounds to 2dp —
multiplying a count back by a fractional step reintroduces float dust.

### The estimator asks only what it does not already know

`screens/spend-estimator.js` exists because people remember **habits**, not
totals — "specialty café most days", not "$155". But for some categories the app
is not guessing at all, and asking anyway is the app failing to listen.

Subscriptions was the case that proved it. The estimator asked "Just one or two
/ A handful / Quite a few" and scored **$55**, while `state.subs` held four
named services adding to **$60.46** — and the seeded month-to-date for that
category was already $60.46. So the flow took a correct figure and replaced it
with a bucketed guess.

**`estimatorKnown(category)` is the seam.** It is the only place that decides
whether a category has a figure the app already holds; adding another category
is one branch there, not a change to the flow. When it returns something, the
estimator opens on a **known step** that itemises what we hold and offers two
ways out — take the figure, or ask the questions anyway. When it returns null,
nothing changes.

Two sources are merged for Subscriptions, deliberately rather than one winning:

| Source | Holds |
|---|---|
| `state.subs` | the **price**, seeded from the persona |
| `state.journalProfile.streaming` | what the **user said** they pay for |

If they answered the setup question, their list governs — they may have
cancelled something the persona still lists. A service they named that we have
no price for is counted at the average of the ones we do know and **labelled as
estimated**: dropping it would under-report, and pricing it silently would
assert something we don't have.

Two behaviours worth keeping if this is touched:

- **Taking the known figure answers no questions**, so `estimatorSubmit`'s
  "nothing answered → say nothing" guard has to exempt it, or the whole path
  silently discards and the category keeps whatever it had.
- **The provenance line tracks the value, not the gesture.** It claims the
  figure *is* the sum of their subscriptions, so editing it drops the claim and
  typing it back restores it.

## 6. Observation registry

Four seeded observations (D18), each carrying a `surfaces[]` array naming where
it must appear. D18 and Phase 6 both require every observation reachable from
**at least two screens**.

| id | type | surfaces |
|---|---|---|
| `obs_dining_over_peers` | `peer_gap` | home_tip, budget_comparison, daily_update, progress |
| `obs_hulu_unused` | `subscription_flag` | home_task, progress, daily_update |
| `obs_emergency_behind` | `goal_pace` | goals, daily_update, progress |
| `obs_insurance_unbudgeted` | `bill_flag` | home_task, progress_bills, budget_comparison |

**Contract:** screens ask the registry what to show; they never hardcode an
observation.

```js
observationsFor("progress")   // → array of observations naming that surface
```

This is what makes the Phase 6 reachability check mechanical rather than a
hunt — and it means adding a surface is a data edit, not a code edit.

**Seven surface names are in use.** They are not screen ids; map them once:

| Surface | Screen / region |
|---|---|
| `home_tip` | Home — tip banner |
| `home_task` | Home — daily task list |
| `budget_comparison` | Budget — three-layer comparison (only the confirm gate now; the tab itself renders "Worth a look" instead) |
| `progress` | My Progress — main body |
| `progress_bills` | My Progress — bills calendar |
| `goals` | Goals tab |
| `daily_update` | Daily update sequence |

<!-- Note `progress` and `progress_bills` are two surfaces on ONE screen. The
     map is surface → region, not surface → screen, so a screen may query more
     than one key. -->
<!-- Reachability arithmetic: dining 4 surfaces, hulu 3, emergency 3,
     insurance 3 — every observation clears the ≥2 bar with room to spare, so
     Phase 6 should pass by construction. If it doesn't, a surface key got
     typo'd rather than a screen being missed. -->

<!-- L11 applies here: obs_dining_over_peers ships typed `peer_gap` with the
     PLAN numbers (429 vs 320). Reframe its headline to "over your plan" and
     add a separate peer card at 429 vs the derived peer value. Fix it in
     state at boot, not by
     editing data/*.json — that file stays a verbatim spec copy (§1). -->

---

## 7. Navigation contract

Five tabs (D34) plus Home as a top-left icon (L5).

```js
state.nav = {
  activeStack: "home",
  stacks: {
    home:     ["home"],
    goals:    ["goals"],
    budget:   ["aboutMe"],       // v2's screen id, kept deliberately
    progress: ["myProgress"],
    learn:    ["learn"],
    market:   ["marketplace"]
  }
}
```

| Action | Effect |
|---|---|
| Tab tap | switch `activeStack`. **Does not push.** Stack resumes where you left it |
| Home icon tap | switch `activeStack` to `home`. Same mechanism, different affordance |
| `go(screen)` | push onto the active stack |
| `taskGo(screen)` | set `activeStack = "home"`, then push — this is what makes a task-launched screen back to Home |
| `back()` | pop the active stack |
| `navGoTabRoot(key)` | switch `activeStack` **and reset it to `[key]`** — "this flow is over" |
| Admin "Jump to screen" | **reset** that stack to `[screen]` — a jump has no history |

**A daily task is one of two things, and they navigate differently** — see
`navRouteTask`. A **bookmark** into another tab (`lesson:apr`, `budget`) uses
`navGoTabRoot`, so tapping the task is indistinguishable from tapping the same
thing in that tab. A **flow launched from Home** (`money_journal`,
`subscription_confirm`) uses `taskGo`, because a journal entry is not a tab and
has nowhere else to belong. Routing bookmarks through `taskGo` pushed the string
`"learn"` onto the *home* stack and left `activeStack` as `"home"` — so the Home
tab stayed lit over a Learn screen, and Back went to Home.

**No screen may `go()` a tab root.** `go('home')` / `go('learn')` push a tab key
onto the current stack as though it were a sub-screen. Ten call sites did this;
each is now `navGoTabRoot` (forward into a tab, or an escape hatch out of a
dead-end screen), `navGoHome` (a flow ending), or `navBack` (a button that says
Back). The reward screen's `go('home')` is what made Back replay a finished
reward.

`navGoTabRoot` exists because `navGoTab` commits that stack's **top**, which is
right for a tab tap and wrong for ending a flow — the screen you just finished
is still on it. Open the budget wizard from the Budget tab and the stack ends as
`["aboutMe","lifestyleWizard","lifestyleWizardReview","budgetDone"]`, so
"See my budget" called `navGoTab('aboutMe')` and re-committed `budgetDone`: the
screen it was already on. It is the any-tab counterpart to `navGoHome()`, and
the same distinction. **Every "Done" at the end of a flow wants one of those
two, never `navGoTab`.**

Per-tab stacks are what let the *same* screen back to two different places: a
lesson opened from a Home task backs to Home, the same lesson opened from
Education backs to Education. No special-casing.

`history.pushState` / `popstate` stay in sync so browser back keeps working
(v2 already does this via `getNavSnapshot` / `restoreNavSnapshot`).

**All screen changes go through `go()` or `taskGo()`.** Direct `state.screen`
assignment bypasses the stack and the nav log — this was already v2's rule and
it matters more now.

<!-- activeTabFor() inverts: the stack now owns which tab is active. Keep
     activeTabFor as a fallback for admin jumps only, or delete it. Do not let
     two things claim to know the active tab. -->
<!-- state.flowOrigin is a one-slot version of this idea. Retire it once stacks
     land — check the finish-screen path first. -->

---

## 8. Shared top bar

**v2 has no shared top bar** — every screen renders its own header. v3 needs
one, because 03-home puts kibble, streak, buddy level, and a hamburger overlay
up there, and L5 puts the home/back control there too.

```
┌──────────────────────────────────────────┐
│ [◄ or ⌂]   kibble · streak · level   [☰] │
└──────────────────────────────────────────┘
```

Left slot is contextual:

| Condition | Left slot |
|---|---|
| Stack depth > 1 | **Back** |
| Stack depth = 1 (tab root) | **Home icon** |
| Full-screen / nav hidden | **Back only** — home icon hidden |
| On Home | nothing |

Home icon: inline SVG, ≤44px tap target, not larger. No icon library under L1.

### The offset trap

`.screen-scroll` currently reserves `bottom: 78px` for the nav, and that value is
duplicated in **three** places — the CSS default, the four full-bleed mode
classes, and an inline fallback in `render()`. The top bar adds a matching
`top:` offset with the **same three-places problem**.

Full-bleed screens (login scene, onboarding, journal flow, lesson, daily update)
must zero *both*. Every new full-bleed screen needs a mode class or it renders
with a dead band top and bottom.

<!-- Worth collapsing to a single CSS custom property (--topbar-h / --nav-h) set
     once and referenced everywhere, rather than carrying v2's triplication into
     a build that doubles it. Small refactor, done in Phase 0, pays for itself. -->

---

## 9. Routes and the journal question contract

### Route map

`SEED_STATE.dailyTasks.today` uses its own route vocabulary, matching no screen
id. Routes can carry a parameter (`lesson:apr`).

| Route | Resolves to |
|---|---|
| `money_journal` | journal entry flow |
| `subscription_confirm` | **journal entry, focused on `q_watched`** (L12 — no dedicated screen) |
| `budget` | `aboutMe` |
| `lesson:<id>` | lesson player for that lesson id |

<!-- Two of the four daily tasks now land in the journal (t_journal, t_hulu).
     The Hulu task must enter visibly differently — pre-focused on the watched
     question — or it reads as a broken duplicate.
     Frame it as a question, never an instruction: "Haven't heard about Hulu in
     a while", not "cancel Hulu" (07-progress-bills is explicit). -->

**`q_watched` is `signalOnly: true`** — its options carry a `signal` name, not a
category or estimate, so it produces **no financial entry**. That's correct for
the Hulu task: the payoff is the flag clearing, not a dollar amount.

It also carries `cooldownDays: 2`, so normal priority selection may skip it.
**A task-initiated deep link must bypass cooldown**, or the Hulu task can route
to an entry that doesn't contain the question it exists to ask.

### Question selection

`config`: `questionsPerEntry: 4`, `freeTextAlwaysLast: true`, `freeTextParsed: false`.

Nine questions ship, but they are **not one flat pool** — three carry flags that
take them out of ordinary priority scoring:

| Question | Flag | Behavior |
|---|---|---|
| `q_free_text` | `alwaysLast: true`, `parsed: false` | Always appended, outside the count of 4. Silently discarded (D12) — never on the confirmation screen, never acknowledged. Carries `attachments: [image, camera, voice]`, all inert |
| `q_breakfast_habit` | `triggeredBy: "pattern_detected"` | Fires on a detected repeat, not by score. `cooldownDays: 30` |
| `q_watched` | `signalOnly: true` | Produces a signal, not a financial entry |

So ordinary selection draws **4 by priority from the 6 scoreable questions**,
skipping anything on cooldown, then appends free text.

### The journal is where goal progress comes from

`q_balance` — *"Roughly what's in your checking account right now?"* — carries
**`updatesGoalProgress: true`**. This is not a goals-tab feature that happens to
live in the journal; it is 05-goals' entire event-based update mechanism,
implemented as a journal question.

```
Phase 1 (journal)  →  emits a goal-progress event
Phase 5 (goals)    →  consumes it
```

**Consequence for sequencing:** Phase 1 must emit that event even though nothing
consumes it until Phase 5. Cheap to include now, expensive to retrofit — the
alternative is reopening the journal submit path months later.

Also note `setsRecurring` on `q_breakfast_habit` is **tri-state**, not boolean:
`true` · `"weekdays"` · `false`. A truthiness check gets `"weekdays"` wrong.

---

## 10. Audio pipeline

Under L10, **Web Speech is a build-time generator, not a runtime player.**
Runtime plays `.wav`, same as v2's lesson player.

```
script text → say -v Samantha -o seg.aiff → afconvert → seg.wav
           → afinfo duration → written back into the timings block
```

macOS `say` is offline, keyless, and the same voice family Safari's Web Speech
exposes — so D04's *intent* holds even though its "no build-time audio assets"
clause does not.

**One file per segment.** Each file's duration *is* that segment's timing, and a
single segment can be re-cut without redoing the script.

### Timing model is inverted from the spec

`speechSynthesis` `boundary` events don't fire for recorded audio. So:

- Static timings in `daily-scripts.json` become **primary**, not fallback.
- Timings are extracted once at generation time and written back.
- The `<audio>` element is the clock (`elapsed = audio.currentTime`).

This is closer to D29's stated production pipeline ("script → TTS → timing
extraction → timings written back") than the spec's own prototype shortcut, and
it removes cross-browser variance in whether boundary events fire at all.

**D29's structural rules still bind:**
- Segment text and timings **never share an object**. Segments carry ids;
  timings are keyed by id.
- Visual cues reference **segment ids, never timestamps**.
- A segment with no timing estimates from word count at **165 wpm**.

Same generator serves the 15 lesson script bodies (L8).

### The sync contract: whatever is speaking is the clock

**Audio and subtitle stay together, and the scrub bar moves both.** This binds
on every narrated surface, not just the one that was reported.

| Surface | The clock |
|---|---|
| Daily update | its `<audio>` element — already exact |
| Lesson player, lesson **with** a `.wav` | `audio.currentTime` — already exact |
| Lesson player, lesson **without** one | the utterance's `onstart`/`onend` |
| Onboarding intro | the `.wav`'s `onplay`/`onended`, else the utterance's |

The 165-wpm figure is a **word-count estimate**, and a browser voice reads at
whatever pace it likes. Where the estimate was the clock, the two separated
within a few lines: the caption moved on mid-sentence and the bar agreed with
neither. Only `interest-builds` has a generated `.wav`, so that was every v3
lesson and the whole intro film.

So when a voice is driving, `speechDriven` goes true and:

- **the line index is pinned on start** — the caption on screen is provably the
  line being spoken, so the clock snaps to that line's cue rather than wherever
  the estimate had drifted to;
- **the tick keeps the bar moving but is capped** inside the current line
  (`lpSpeechCap` / `onbSpeechCap`, one twentieth of a second short of the next
  cue), so a fast estimate cannot run the film past the narrator;
- **only the voice's own end event advances**, which is also what ends the piece.

165 wpm survives as the total-length figure for the first paint, and as the
whole clock on a browser with no speech engine at all (`onError` hands it back).

**Seeking cancels and re-speaks.** `lpApplyElapsed` / `onbVideoApplyElapsed`
drop the current utterance when the line changes; without that the voice
finishes the line it was on and advances from *there*, narrating a passage the
viewer has already scrubbed past.

`narrationSpeak` carries `onStart`/`onEnd`/`onError` and keeps the generation
guard, so a superseded line's callbacks are still dropped — see the cancel trap
at the top of `js/narration.js`.

### The snap is forwards only

Three sites pin the clock to the current cue when a voice starts: the lesson
player's live speech, the onboarding player's live speech, and the onboarding
`.wav`'s `onplay`. All three take `Math.max(elapsed, cue)` rather than the cue
outright.

The cap (`lpSpeechCap` / `onbSpeechCap`) lets the tick run to just short of the
*next* cue, so `elapsed` is normally **ahead** of the current one. An
unconditional snap therefore moves the clock **backwards**, and
`hyperframesSync` faithfully rewinds every animation to match — which is what
showed as a flicker at each segment boundary. Forwards-only keeps the
correction that matters (the voice is ahead of a slow estimate) and drops the
one that was visible.

### The keyboard's press latch, and the event that defeats it

Closing the simulated keyboard removes 250px of `padding-bottom`, so closing it
mid-gesture moves the button out from under the finger and the `click` is never
dispatched. `kbdInit` therefore holds the close while a button press is in
flight and lets `kbdSyncAfterRender()` (called from `render()`) close once the
field is gone.

**The latch has to be checked in `focusin` as well as `focusout`.** Chrome and
Edge focus a `<button>` on mousedown, so pressing Continue fires `focusin` with
the *button* as target — a path that closed the keyboard synchronously and
defeated the latch completely. The first fix guarded only `focusout` and looked
correct in a harness that never fired `focusin`.

Two consequences worth keeping in mind:

- **This bug is invisible on macOS.** Safari and Firefox do not focus buttons on
  mousedown, so the same code behaves correctly there.
- **Any test must fire the whole sequence** — `pointerdown → focusout(field) →
  focusin(button) → pointerup → click` — and should be run against a
  deliberately reverted fix to confirm it fails.

When a press does *not* re-render, focus is handed back to the field: the
keyboard is still up, and a caret sitting on a button is not.

### 165 wpm is the one pacing knob

`DU_WPM` (`screens/daily-update.js`) sets the pace for **every narrated
surface**: the daily update, the onboarding narrator (`onbVideoSegMs`) and now
the lesson player (`lpCuesFromWords`). Retune it once and all three move.

The lesson player used to synthesize a flat `LP_DEFAULT_LINE_SEC = 10` per line
instead — roughly double what a sentence takes to say, so every line ended in a
long silence. Worse, **`components/hyperframes.js` expressed its entrances as a
fraction of the total runtime**, and the cap was 9% — which over that inflated
70-second runtime meant a **6.3-second fade-in**. The two compounded into text
drifting into view while the narrator finished a sentence and moved on.

Entrances and exits are now wall-clock seconds (`HF_IN_SEC`, `HF_OUT_SEC`,
`HF_MARK_SEC`), converted to keyframe percentages through `hfFrac(sec, totalSec,
cap)`. A beat snaps in, holds for its line, and snaps out at any runtime. The
fraction cap survives as a ceiling so a very short beat cannot spend most of its
life easing in.

**Storyboard beat boundaries ARE script line boundaries.** The APR spine in
`lessons.json` is cut from `lpCuesFromWords(apr_about_average)` — now **ten
lines and nine beats**, `what` spanning lines 1–2 and every other beat one line.
The other four buckets have different tail lengths, so their beats drift by a
fraction of a line. Rewriting a script means recutting the fractions.

The ninth beat is **`cost`**, and it is there because the script is deliberately
figure-free: narration says the gap between two rates is worth turning into
money, and the beat is where the money appears — what a carried balance costs
for a year at their rate against the typical one, and the difference. It states
its own condition (only on a balance carried past the due date), because a
figure without that is a scare number rather than an explanation. Naming the
amount is fine; telling anyone what to do about it is not (D26).

**The onboarding storyboard does not have that problem**, and the difference is
worth copying if a third storyboard ever appears. `data/onboarding-storyboard.js`
declares only *elements per segment id*; `onbStoryboard()` (`screens/onboarding.js`)
builds the `from`/`to` fractions at render time from the player's own `v.cues`.
Beat N spans segment N by construction, so rewriting a line re-cuts the beats
automatically — the cues and the beats read one source instead of two that have
to be kept in step by hand.

### The intro film branches on the primary goal

`ONB_GOALS` is four goals with up to three picks — sixteen combinations, which
is not authorable. So the film uses a **shared spine with a goal-specific
middle**: segments `s1`, `s2`, `s5` and `s6` are word-for-word identical across
all five scripts and only `s3`/`s4` change, keyed on `improveAreas[0]`.
Secondary picks change nothing. `data/onboarding-script.json` and
`data/onboarding-storyboard.js` are keyed the same way and must be edited
together.

The five scripts are written out in full rather than composed at load time
because `gen-audio.sh` cuts one `.wav` per script/segment pair and the player
addresses them by path (`assets/audio/onboarding/<scriptId>/<segId>.wav`) — a
composed script would have no folder of its own.

**`hyperframesCanRender()` takes a `requiresFigures` flag.** It gates on
`userFigure` + `marketAvg` because the APR storyboard *plots* a number. A
storyboard that only explains something has no figure by design and declares
`requiresFigures: false`. The flag defaults to on, so the lesson path is
unchanged.

### Verified against the shipped scripts

All three variants have **7 segments each, every segment timed, every `cue`
resolving** to a declared type. Nothing to repair.

One asymmetry: **`number_reveal` is declared in `visualCues.types` but no
segment uses it.** Seven of the eight types are exercised. Build the eight
renderers anyway — it costs little and the type is clearly intended — but don't
hunt for the script that triggers it.

---

## 11. Screen wiring checklist

Every new screen needs all five, or the admin panel silently degrades to the
generic "Jump to screen" fallback. v3 adds ~15 screens = ~75 wiring points.

1. `screens/<name>.js` → `render<Name>()` (+ optional `render<Name>Admin()`)
2. `<script>` tag in `index.html`, in the screens block
3. `js/render.js` → `renderScreen()` · `adminSubtitle()` · `renderAdmin()` · jump list
4. `js/utils.js` → `activeTabFor` (or the stack map, per §7)
5. `js/state.js` → `destinations[]`

Plus, new in v3: a **full-bleed mode class** if the screen hides the nav (§8).

<!-- Candidate for a tiny node script that greps for screens missing any of the
     five and prints the gaps. Cheap to write, and it turns the most mechanical
     failure mode in the build into a check rather than a memory test. -->

---

## 12. Standing rules

### Code — inherited from v2 (root `CLAUDE.md`)

- **Surgical edits.** Fix one thing at a time. Never collapse files together.
- **`.item-card` is `display:block`, not flex.** Trailing children drop to their
  own line. Fix per-instance with scoped inline flex; never change the global rule.
- **Inputs use `onchange`, not `oninput`.** Full re-render on every keystroke
  destroys focus. **Sliders** are the deliberate exception — product sliders as
  much as admin ones, because a `type="range"` on `oninput` + `render()`
  destroys the element being dragged. Freeze the slider's `max` too: a ceiling
  derived from the value it controls makes the thumb recoil. Paired with
  `debouncedRender()`.
- **Always `h()`-escape** anything interpolated into an HTML template literal.
- **Style with CSS variables only**, never hardcoded hex — **all four themes**
  must work, not just the one you are looking at (§14).
- **Iterate `CATEGORIES`, never `Object.keys(data)`** — `_note` keys (§5).

### Copy — cross-cutting, applies to every surface

- **No financial advice. Ever. Anywhere** (D26). Not in buddy replies, not in
  observations, not in lesson scripts, not in empty states, not in a tip banner.
  Surface the number and the gap; never prescribe the action.
  - **Any question asking what to do must hit the safeguard reply.** Enforced by
    `chatIsAdviceSeeking()` in `js/chat-router.js`, checked *before* keyword
    scoring (L20). The response library's own keywords are a floor, not the
    guard — they miss "help me decide", "can I afford", "is it a good idea",
    "what would you do", and nine more.
  - Deflection being over-eager is the **safe** failure. A wrongly-deflected
    question costs one retry; a missed one means the prototype gave financial
    advice.
  - **Copy written later is bound by this too** — especially the 15 lesson
    script bodies (L8), which are the largest block of unwritten prose left.
    The forbidden shapes are imperatives: "you should", "we recommend",
    "cancel your", "switch to", "you must", "the best option is".
- **Frame flags as questions, not instructions.** "Haven't heard about Hulu in a
  while" — not "cancel Hulu." The app has no idea whether they still want it.
- **No exclamation marks in financial observations** (A13). The buddy may be
  encouraging; the numbers stay matter-of-fact.
- **Voice: warm, plain, second person, sentence case.**
- **Tip banner is a hard 90-character limit.**
- **"Peers", never "average users"** — the data is an external mathematical
  aggregate, never other people's real data (D23). If a user asks, say exactly
  that.
- **Vocabulary is fixed** (00-overview): Buddy · Money Journal (never "expense
  tracker") · Kibble · Streak · Peers · Observation.

### Quality floor — verified in Phase 6, designed for from the start

- **No screen renders empty** (D19). Where six days is too thin, fabricate a
  plausible value. This is a *design* constraint, not a final-pass fix — a
  screen built without it usually can't be retrofitted cheaply.
- **Every observation reachable from ≥2 screens** (D18) — guaranteed by the
  registry in §6 rather than by inspection.
- **`prefers-reduced-motion` respected**: idle animation stops, transitions
  become instant, the daily update plays as timed static frames.
- **Tap targets ≥44px. Keyboard focus visible throughout.**
- **Mobile viewport first** — the phone frame is 390px; that's the design width.

---

## 12b. Lesson framing trees — three structural traps

Verified against `lessons.json`. The decision trees are well-formed (no dangling
`next`), but their shape is irregular in ways that break a naive traversal.

**1. The key is `tag`, singular — not `tags`.** One tag per option, not an array.
A `.tags` lookup silently collects nothing, the tag set comes back empty, and
every lesson plays its fallback variant. The failure is invisible: you get a
script, just always the wrong one.

**2. `next` lives at two different levels.**

| Question | `next` location |
|---|---|
| `apr/f1`, `apr/f2_unknown`, `apr/f2_nocard`, `emergency-fund/f1`, `subscription-audit/f1` | **per option** |
| `apr/f2_known`, `emergency-fund/f2_amount`, `subscription-audit/f2` | **on the question** |
| `apr/f3`, `emergency-fund/f3`, `subscription-audit/f3` | **neither — terminal** |

Resolution order: option-level `next` → question-level `next` → terminal. All
three lessons end on an `f3` that has no `next` anywhere, so "no next" means
*done*, not *malformed*.

**3. `nocard` is declared but never emitted.** `apr_v5.matchTags` is
`["no_debt", "nocard"]`, but no framing option produces `nocard` — `apr/f1`'s
"I don't have a credit card" carries only `next: f2_nocard`, no `tag`.
`apr_v5` stays reachable via `no_debt`, so nothing breaks. Either add
`tag: "nocard"` to that option or leave it; **don't "fix" it by inventing a
question.**

### Unmatched tags are the design, not a bug

Many answer tags match no variant: `unsure_apr`, `unknown_balance`,
`unknown_debt`, `other_debt`, and all of `f3`'s confidence tags (`confident` ·
`partial` · `new`). They fall through to the fallback — and `apr_default`'s own
note says *"Also serves every 'I don't know' path."*

That is 06-education's *"'I don't know' is a first-class answer, not a failure"*
implemented in data. Don't add variants to "cover" them.

<!-- Coverage per lesson: apr 14 answer tags → 8 variant tags; emergency-fund
     11 → 7; subscription-audit 10 → 7. Every unmatched tag routes to the
     lesson's isFallback variant. All three lessons have exactly one. -->

---

## 13. Buddy representation (L15, revised by L22)

**L22 (2026-08-22): owner-supplied static illustrations are allowed**, selected
by buddy state. Two things are unchanged and one is new:

- **Unchanged — nothing is generated here.** D10's prohibition is on *Claude*
  generating art. The images come from the owner, which is what D10 asked for.
- **Unchanged — no sprite sheets.** These are separate files chosen by state,
  not one sheet addressed by `background-position`. D39's cropping machinery
  stays unbuilt.
- **New — the image is preferred, the description is the fallback.** No image
  set covers every breed × coat × pattern × eyes × nose × size × pose, and D19
  forbids a screen rendering empty, so a missing image degrades to the
  description rather than to a gap. The frame below is therefore **not** deleted
  now that art exists; it is load-bearing.

The seam this rides on was built deliberately (see the note at the end of this
section): `renderBuddyStage` is the frame and `renderBuddyInner` is the content,
kept apart so only the content changes.

### The first image: `prototype`

**`prototype` is a MODE, not a breed.** The illustration is one fixed picture
with its background painted in, so it cannot vary by breed, coat, eyes or size.
Rather than pretend otherwise, `prototype` is the **first value in every
attribute list** (`BUDDY_BREEDS`, `BUDDY_FUR_COLORS`, `BUDDY_FUR_PATTERNS`,
`BUDDY_EYE_COLORS`, plus the admin-only `BUDDY_NOSE_COLORS` / `BUDDY_SIZES`),
and `buddyIsPrototype()` is true when **any** attribute holds it.

- **Picking it on `breed` fills the rest in** (`onbSetBuddy`). Leaving the later
  steps on real values would put the tester in a state the stage has to ignore —
  "prototype breed, chocolate fur" describes nothing the picture can show.
- **Leaving is one attribute at a time.** Picking a real breed does *not* reset
  the others, so the image persists until every attribute is real. The cascade
  is deliberately one-directional.
- **Both colour pickers need a swatch entry.** Fur and eyes render as circles,
  not labels, so a value missing from `BUDDY_FUR_COLOR_CSS` /
  `BUDDY_EYE_COLOR_CSS` draws a blank. `prototype` uses a neutral checker — not
  a coat colour, which would imply a dog the picture may not be.

**The asset was cropped before shipping.** The supplied file was a phone
screenshot: 762×635 carrying a status bar, the dynamic island and rounded dark
corners. Dropping that into the app's own phone frame would have put a status
bar inside a status bar. The chrome occupies rows 35–89, so the shipped asset is
the same image from row 90 down — **762×545**, re-encoded RGB (the alpha channel
was uniformly opaque). Done with stdlib `zlib`/`struct`; there is no Pillow or
ImageMagick on the build machine.

**Fitting:** `.buddy-img` is `position: absolute; inset: 0` so it fills the
stage's *padding box* — edge to edge, ignoring the 22px padding that exists to
inset text — and escapes `.buddy-inner`'s 240px `max-width` without that rule
knowing art exists. `object-fit: cover` because the background is meant to fill
the card; letterboxing against the sage would read as a mistake. The stage is
square on Home and in the creator while the image is 1.4:1, so cover crops the
sides; the dog is centred and survives.

**The name is overlaid** (`.buddy-img-name`). The creator's last step is naming,
and a bare picture would mean typing a name and watching nothing change — which
is precisely the feedback the stage exists to give.

**`buddyImgBroken` is a module-level latch, cleared by `bootV3`** via
`buddyResetArt()`. It is not in `state`, so a reset would otherwise leave a
previous session's missing file suppressing art that is now present, with
nothing in the state inspector to explain why.

The rest of this section describes the description layer, which still governs
every combination the art does not cover.

No AI-generated art and no hand-drawn SVG. The buddy stage renders a **labelled
placeholder frame that describes, in text, what the user would be seeing** given
their choices.

```
┌───────────────────────────────┐
│                               │
│   [ buddy placeholder ]       │
│                               │
│   Golden retriever · cream    │
│   Medium                      │
│   Pose: sitting, facing        │
│         forward, calm          │
│                               │
└───────────────────────────────┘
```

**Why this and not a square:** it proves the customization plumbing works
end-to-end. A tester picks a breed, and the stage visibly reflects it — the
choice registers and is legible, which is what onboarding step 7 is there to
test. A flat colour swatch would test nothing.

- **Character creation stays real, with all five attributes** (L18): breed,
  fur, eyes, nose, size — as 01-onboarding step 7 originally specified.
  Selections write to `state.buddy` and the description re-renders. Nothing is
  faked. The persona's default is `PERSONA.buddy` (golden retriever, cream,
  brown eyes, black nose, medium). The name is intentionally blank — naming the
  buddy is required in onboarding, and it falls back to "Buddy" until then.
- **The idle cycle is real too.** Pose text changes on the 4–6 second cadence
  the design system specifies, cycling poses 1, 3, 4, 5. Stops under
  `prefers-reduced-motion`.
- **Six pose names** come from `10-ai-assets.md`'s table (sitting calm · head
  tilted · drinking · sniffing · lying down · joyful). Poses 2 and 6 are
  event-driven — chat open, and reward/streak.
- **Same treatment for the other assets**: the two login backgrounds render as
  described scenes (day/night per local time), and the kibble bowl as a labelled
  frame.

<!-- D39/D40 are void in practice. Flat cream backgrounds, CSS
     background-position cropping, six fixed sheets, and the dropped eye/nose
     colours were all consequences of raster art being unable to recolour.
     With a text placeholder there is no sheet to crop and no recolour cost, so
     none of those constraints bind. Do not build the background-position
     machinery for art that will never exist. -->
<!-- This note called it: real art arrived (L22), and the separation held. The
     swap is inside renderBuddyInner — prefer an <img> when one resolves for the
     current state, fall through to the description when it does not. Nothing
     about renderBuddyStage, the idle tick, the pickers or state.buddy moves. -->

---

## 14. Theming — four themes, one contract (L21)

Four themes ship, switched from the Admin Tools panel. Two reproduce v2's
palette so the D36 repaint can be compared against what it replaced; two are the
repaint itself. **Natural Light is the default** (`state.settings.colorMode`,
and `THEME_DEFAULT` in `js/theme.js` — both carry it). L21 originally shipped
Dark so the cream had to be chosen; that was reversed once it became clear
most testers never chose it.

**Natural Light's class is the empty string** — it *is* `:root`. Now that it
is also the default, an unclassed `.screen` and a correct one look the same,
so a `themeApply()` that never ran is invisible. The sweep's theme checks are
what catch that.

| Theme | Class on `.screen` | What it is |
|---|---|---|
| Light | `.theme-light` | v2's crisp blue-on-white |
| Dark | `.theme-dark` | v2's cool dark |
| Natural Light | *(none — `:root`)* | D36 cream + sage — **default** |
| Natural Dark | `.theme-natural-dark` | D36 dimmed, warm |

`THEMES` in `js/theme.js` is the single source of truth. `render()` calls
`themeApply()`, which puts exactly one class on `.screen`. To add a theme, add
an entry there and a class in `variables.css` — nothing else reads the list.

### The 40-token contract

`:root` holds the complete Natural Light set, so every token always resolves.
Each of the three classes must then define **all 40 colour tokens, no more and
no fewer.**

This is enforced (`scripts/sweep.sh` §1b) rather than trusted, because the
failure mode is invisible: a theme that omits a token inherits `:root`'s
**cream**, which paints one warm patch into a cool theme and reads as a
deliberate accent rather than a bug. Adding a token to `:root` now fails the
sweep until all three themes define it.

### What a theme must never touch

**`--chrome-*`, `--bg`, `--phone`.** These style the admin panel, the page and
the bezel — all of which live *outside* `.screen`, where theme classes are
applied. An override is therefore inert as well as unwanted: the frame is meant
to hold still while the app repaints. The sweep asserts this. (Eight such dead
overrides existed in the old `.dark-mode` and were removed — see `plan.md` §17.3.)

### Colours that pair, and must be declared as pairs

`--accent` is **dark** in the light themes and **light** in the dark ones. Any
rule putting text on it therefore cannot hardcode a text colour — there are two
tokens for this, and new rules should use them rather than reaching for
`--on-dark`:

| Background | Text token |
|---|---|
| `--accent` | `--on-accent` |
| `--accent-fill` | `--accent-fill-text` |
| a genuinely always-dark surface (lesson stage, night login) | `--on-dark` |

The sweep checks 12 foreground/background pairs across all four themes at a
4.5:1 floor. That gate caught `--info` shipping at 3.92:1 in Natural Light.

---

## 15. Not covered here

Deliberately deferred to per-phase docs, written just before each phase:

- Journal question sequencing, estimate sliders, confirmation layout (Phase 1)
- Lifestyle wizard screens and budget slider UI (Phase 2)
- Buddy stage poses, idle cycle, hamburger overlay contents (Phase 3)
- Daily update visual cue implementations, share sheet, anonymization (Phase 4)
- Goal suggestion scoping, event-based update prompts (Phase 5)
- Lesson framing decision trees, script variant bodies (Phase 5)

Design detail has a shelf life. Writing Phase 5's screens before Phase 1 has
taught us what a journal entry actually looks like produces fiction.
