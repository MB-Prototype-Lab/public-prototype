# Emergency Savings Fund (ESF) Tool — Feature Spec

**Status:** Built and running in `versions/v3.1/`
**Scope:** Tool only. Education layer is owned separately.
**Supersedes:** all earlier versions of this file, including the 2026-09-17 rewrite
**Date:** 2026-09-19

---

## Open items — what's left

**Ask "what's remaining?" and this is the answer.** Updated whenever something
here is resolved or something new is found.

### Needs a fix before anyone tests on a phone

- **Tap targets are at 29px against the repo's 44px floor** (ESF number boxes;
  onboarding ZIP field at 40px). The explicit price of the no-scroll rule.
  Every one of these screens is number entry, which is the worst place to be
  under the floor.
- **The simulated keypad can't be verified at phone width.** `kbdIsSimulated()`
  suppresses it on a coarse pointer and the browser pane emulates touch below
  768px, so keyboard behaviour has to be checked at desktop width.

### Needs a decision

- **"I don't drive" is being read as "I have no car."** It zeroes fuel,
  maintenance *and* insurance. A parked car still carries a premium, but nothing
  asks about car ownership, so this is the only signal available. Either add an
  ownership question or accept the assumption — §6.4.

### Worth building next

- **Runway line** — *"about 1.2 months covered today"*. Cheap, and the stickiest
  number on the goal screen.
- **Income sanity check** — *"That's more than you told us you earn."* Stops a
  mistyped mortgage from producing a nonsense goal in front of a tester.

### Deferred, not blocked

- Confidence range while rows are untouched
- Permanent "Your monthly expenses" summary as the return path
- Edit-time delta note — *"Your goal went up $900."*
- Resume mid-screen / continuous save (impossible under D03 as written)
- Plaid offer on step 2
- Withdrawal and replenishment flows

### Known stubs

- **`valueDispersion: 1.35`** stands in for a real ZHVI source (§6.7), so
  property tax estimates are directionally right at best.
- Every rate figure in §6 is an anchor, not a researched constant. Refresh from
  source at build time.

### Known stubs, continued

- **`electricityCapMultiplier: 1.6`** caps the electricity rate ratio because
  `kwhByHome` is national usage and ignores climate (§6.1). The honest fix is a
  regionalised usage table.

### Resolved

- **Model defects D1–D4** (audit of 2026-09-19), all fixed and verified across
  five ZIPs:
  - **D1** Utilities was up to 2.6× too high — an electricity rate ratio was
    being applied to water and gas, and national usage compounded it. §6.1
  - **D2** HOA was multiplied by the Housing index, which §6.8 explicitly
    forbids. §6.8
  - **D3** Car insurance read a peer split scaled by a COL index instead of the
    specced state average. §6.4
  - **D4** `esfRowSource()` branched on `carRunning`, which is a *group* name,
    not a row id — the branch never fired and the car row fell through to a
    generic line. One-word fix.
  - **D5** property tax and **D6** typed rows were documentation items, not
    bugs; both already recorded.

  All three of D1–D3 were the same root cause: **a cost-of-living multiplier
  applied to something that does not vary that way.** `zip-cost-of-living.json`
  warns about exactly this in its own note. The table was built correctly;
  three call sites reached for the wrong column.
- **Over-funded state** — not a state that should exist. A user either has an
  emergency fund or doesn't. Someone who already has one has the goal marked
  complete in the goal list, and reaches the fund again through the Tools tab.
  Both are planned. The flat "$0 still to save" outcome is acceptable as-is.
- **Childcare exclusion** — a decision, not an oversight. Often the
  second-largest expense for households with young kids, but it largely
  disappears in a job loss.

---

## 0. How to read this document

This is a **record of what exists**, not a plan. Every section below describes
code you can open and run. Where an earlier spec said something different, this
file says so explicitly and gives the reason — those divergences were owner
decisions taken during the build, and they are the most useful part of the
document if you are picking the feature up cold.

The four files that matter:

| File | What it holds |
|---|---|
| `versions/v3.1/js/esf.js` | The whole expense model. ~1,400 lines, no UI. |
| `versions/v3.1/screens/esf-build.js` | Steps 1–4 (intro + three capture screens). |
| `versions/v3.1/screens/esf-plan.js` | Step 5, the goal screen. |
| `versions/v3.1/data/emergency-fund.json` | Every sourced figure. Wrapped to `.js` by `scripts/wrap-data.sh`. |

**If you edit the JSON you must re-run `bash scripts/wrap-data.sh`.** The app
runs on `file://` and loads `data/*.js`, not the JSON. Wrapper drift is silent
and has bitten this feature once already.

---

## 1. Outcome

Help a user arrive at a credible emergency fund target based on their real
monthly survival expenses, and a monthly savings figure to reach it — **without
asking them for a single dollar amount they'd have to look up.**

### Design principles, as actually implemented

1. **Nothing is a question if it can be an estimate.** Only rent, mortgage, car
   payment, transit and "anything else" open blank. Everything else opens on a
   local estimate the tester confirms or changes.
2. **Sort by recall, not by topic.** Two categories deliberately split across
   screens: Transport becomes a car payment (typed, step 1) and running costs
   (estimated, step 2); Utilities splits into the locally-priced part and the
   nationally-priced part.
3. **Every estimate shows its drivers.** One dark line under each label, always
   of the form *"Based on…"*.
4. **Ask habits, never dollars.** Onboarding asks miles a day, not fuel spend.
5. **Copy at a 5th-grade reading level.**
6. **Errors are asymmetric.** Guessing high is safe for a safety net.
7. **Every screen fits without scrolling** at 430×940. This is a hard
   requirement and it has cost real estate elsewhere — see §11.

### What this prototype tests

**This changed.** The original spec's primary experiment was a two-card choice
between "what I spend now" and "if my pay stopped", with the tap instrumented
as the main output. **That experiment was cut.** The owner's ruling: *"one
number. the goal is to streamline."*

What the tool now tests is whether a tester will complete a five-step expense
capture built almost entirely from estimates, and whether the estimates are
close enough to be accepted rather than overridden. `state.esfEvents` (§10)
is the readout.

---

## 2. Onboarding — required inputs

The ESF asks for no profile information of its own. Everything comes from
onboarding, which runs in a reduced ESF-only form.

`ESF_ONLY` in `js/config.js` is the master switch. When true it hides every
non-ESF screen (hides, never deletes), suppresses the top-bar home icon, and
makes onboarding's Skip skip the *entire* setup rather than one screen.

**ESF onboarding is six steps**, in this order:

```js
const ONB_STEPS_ESF = ["zip", "income", "household", "place", "coverage", "miles"];
```

| # | Question | Format | Feeds |
|---|---|---|---|
| 1 | ZIP code | 5-digit field | every category, via `benchColMultipliers()` |
| 2 | Annual income | band, then slider or typed figure | income band, grocery plan tier |
| 3 | Who lives with you | adults by age range + kids in two buckets | groceries, phone lines, medical |
| 4 | Your place | 5 tiles | utilities, HOA, property tax |
| 5 | Health coverage | 4 tiles | medical |
| 6 | Miles a day | 5 tiles | fuel, maintenance |

### Divergences from the earlier spec

- **No "rent or own" question.** It is read off the two housing fields on step
  1 of the fund, which can say *both* where a tile could not. `esfOwnsHome()`
  reads the mortgage field directly and **must never route through
  `benchLifestyleKey()`**, which collapses rent and mortgage into one key and
  made every mortgage-holder read as a renter.
- **No car questions.** No count, no type, no fuel. Miles a day is the only
  driving input; vehicle type is assumed. Cutting this removed two tiles and a
  whole branch of the fuel model's inputs.
- **No credit-card or loan count.** The debt row is a labelled dropdown
  instead (§6.6).
- **Kids are two buckets, not three.** `under13` and `teen` only. An "18+" kid
  bucket double-counts an adult who is already in the adult list.
- **Adults are asked by age RANGE**, not typed age. Six bands, each carrying a
  representative age for the ACA curve (§6.5).
- **Income bands are six, not five**, and are UI-local. `$140,000–$300,000` and
  `$300,000+` were added. These ids only *look* like `PEER_BENCHMARKS`' b1–b5:
  `benchIncomeBand()` derives the lookup band from the **figure**, never from
  the id, so the peer model is untouched. The slider's grain is per band —
  $1k under 60k, $2.5k to 140k, $10k to 300k, $50k above — and each band opens
  on its own midpoint snapped to its own step. A tester can also type an exact
  figure, which is deliberately *not* snapped to the grid.
- **"I don't drive" is an explicit answer**, not a skip. Without it a tester
  with no car is charged fuel and upkeep.

### Every write is guarded, and the fallback is a PROFILE

`onbFinish()` writes nothing for a field the tester skipped. What sits behind
the guard is `profileDefault()` — one of the nine test profiles — **not** the
seeded persona. Before that fix, skipping quietly made the tester Sam from Los
Angeles on $68,000 with nothing on screen saying so.

One special case: the ZIP step's **"Maybe share later"** button sets
`o.zipDeclined`, and `onbFinish()` honours it by clearing the ZIP the default
profile brought with it. Without that flag, "use the national average" would
have silently priced the tester in Nashville.

---

## 3. Entry

### The task link

A daily task on Home routes to `esfBuild` (`js/state.js`, `destination:
"esfBuild"`). `activeTabFor` maps both `esfBuild` and `esfPlan` to the **goals**
tab.

### The intro screen (step 1 of 5)

Not a question. Three lines of plain copy and two buttons:

> An Emergency Savings Fund is a cushion for hard times
>
> It helps reduce financial anxiety when unfortunate events like job loss and
> major unexpected expenses happen
>
> Let's start with understanding your regular **Monthly Expenses** that you
> think must be paid every month
>
> **[ Build my fund ]**
> **[ I already have one ]**

### "I already have one" collects NO figure

This is a deliberate reversal of the earlier spec, which required the confident
path to still create a tracked goal with a target.

Owner's ruling: *"do we need to know what the number is if the user has
identified they have one and don't need to enter it? … for them it's a
checkmark complete so we don't surface the tool as a task to them again."*

So `esfSkipToGoal()` sets `state.esfSelfReported`, ticks the task off in **both**
task systems via `esfCompleteTasks()`, logs the event, and lands on Goals. It
creates **no goal** and asks for **no number**. The tool is reachable later
from a planned Tools tab.

### Exactly one emergency fund, ever

`esfCommit()` filters any existing ESF-shaped goal out of `state.tacticalGoals`
before pushing the new one. The seeded *"Build a $3,000 emergency fund"* counts
as one and is filtered at boot (`js/boot.js`) so a tester never sees a fund
they did not create sitting beside one they did.

---

## 4. Data model vs. input rows

Six categories, and they are **a view over the existing 12-category taxonomy**,
never a second one:

```js
const ESF_CATEGORIES = ["Housing", "Utilities", "Groceries",
                        "Debt payments", "Transport", "Health"];
```

The six excluded — Dining out, Subscriptions, Personal care, Entertainment,
Shopping, Other — are dispensable in an emergency by definition. They still
exist in the budget; `esfToBaseline()` fills them from peer values.

| Row id | Label | Category | Step | Opens as |
|---|---|---|---|---|
| `rent` | Rent | Housing | 1 | blank |
| `mortgage` | Mortgage | Housing | 1 | blank |
| `carPayment` | Car Payments | Transport | 1 | blank |
| `transit` | Public Transportation | Transport | 1 | blank |
| `power` | Home utilities (water, gas, electricity) | Utilities | 2 | estimate |
| `connect` | Phone and internet | Utilities | 2 | estimate |
| `groceries` | Groceries | Groceries | 2 | estimate |
| `medical` | Medical (Insurance, Dental, Vision) | Health | 2 | estimate |
| `carCosts` | Car: Fuel + Insurance + Maintenance | Transport | 2 | estimate |
| `debt` | Credit Card and Loan Minimums | Debt payments | 3 | **$0** |
| `propertyTax` | Annual Property Tax | Housing | 3 | estimate, owners only |
| `homeInsurance` | Home Insurance | Housing | 3 | estimate, owners only |
| `hoa` | HOA, Condo, or Housing Fees | Housing | 3 | estimate, conditional |
| `anythingElse` | Anything else to include | Other | 3 | blank |

`group` is what shares a card: two rows with the same group sit in one box.
That is how *Rent | Mortgage* and *Car Payments | Public Transportation* become
single questions with two answers rather than four cards.

### Divergences

- **Medical moved to step 2**, not 3. Almost everybody has a medical figure,
  unlike property tax or a HOA fee.
- **Car costs are ONE box**, not three fields. Fuel, insurance and upkeep are
  separable in the model and nobody holds them apart in their head.
- **Dining out is excluded** from the ESF entirely. Still in the budget.
- **Buffer is not a row.** It is a percentage on the goal screen (§8).
- **"Unemployed insurance" is not a row.** It is how `medical` is priced (§6.5).
- **Property tax is annual**, because that is the figure printed on the bill.
  The monthly equivalent is shown back.

**Debt rule:** minimum payments only, never what the tester currently pays. A
tester paying $800 against a $180 minimum would overstate the target by
thousands.

---

## 5. The adjustment control

**This is the largest single divergence from the earlier spec.** There are no
±10% steppers and no free-typed dollar amounts on estimated rows.

Owner's ruling: *"use ranges only"* — estimated rows are **dropdowns of dollar
ranges**, centred on the local estimate.

```
Home utilities, including water, gas, and electricity
Based on house · 2–3 bedrooms in 37203 with 4 people.   ← dark, one line
[ $100 – $200                                        ▾ ]
```

- `esfBandOptions()` builds the list: four bands below the estimate, five above,
  plus a **$0 option first** — "none of this applies to me" is a real answer for
  a HOA fee or a car.
- Band width is per row (`bandWidth`, e.g. $100 for utilities).
- Choosing a band stores its **midpoint**.
- Rows that open blank (rent, mortgage, car payment, transit, anything else)
  are ordinary typed fields, not dropdowns.

### The description lines

One dark sentence per row, **one line maximum**. Every one is built from real
inputs, so they change with the profile.

| Row | Line |
|---|---|
| Home utilities | Based on house · 2–3 bedrooms in 37203 with 4 people. |
| Staying Connected | 3 phone lines ($135) plus internet ($75). |
| Food Expenses (Groceries) | Based on 2 adults and 2 kids. Groceries only. |
| Medical | Insurance, copays, prescriptions, dental and vision. |
| Car | Based on 22 miles a day in 37203. |
| Debt | The smallest payment you must make each month on credit cards and loans. |

**Text colour:** these use `--text-strong`, a token added for this work because
`--text` and `--muted` are both too light for body copy. `.helper` and
`.task-desc` were converted app-wide for the same reason. Standing rule: body
copy is dark unless stated otherwise.

---

## 6. Estimation rules

All figures live in `data/emergency-fund.json` with a source noted on each.
Arithmetic lives in `js/esf.js`. **A literal in a model is a figure with no
source attached.**

### 6.1 Utilities — `esfPowerEstimate()`

```
power  = kWhByHomeType × nationalCentsPerKwh ÷ 100
water  = waterByHomeType
gas    = gasByHome[homeType]
figure = power × min(electricityRateRatio, 1.6)
       + (water + gas) × generalPriceLevel
```

**Gas was missing and the label promised it.** The row says "water, gas, and
electricity" and only power and water were priced — about $55/month short on a
house. `utilities.gasByHome` (EIA, studio $22 → 4-bed house $80) was added.

**THREE UTILITIES, TWO GEOGRAPHIES — fixed 2026-09-19 (defect D1).** The
Utilities cost-of-living multiplier is an *electricity rate ratio*, built from
EIA state cents-per-kWh and nothing else. It was being applied to water and gas
as well, which claimed a San Carlos water bill is 2.6× the national one. Water
is a municipal charge and gas has its own pipeline economics; neither tracks an
electricity tariff.

Water and gas now take the **composite regional price level** (BEA RPP, all
items) via `esfGeneralPriceLevel()` — 1.18 in San Carlos rather than 2.60.

**The electricity ratio is capped at 1.6 — a documented stub** (defect D1b).
`kwhByHome` is national-average usage, and usage runs *inverse* to rate: the
high-rate states are mild-climate coastal ones where households use far less
power. Coastal California averages roughly 500–700 kWh/month against a national
900–1,300 while its rate ratio is ~2.6, so national usage × the full rate ratio
overstates twice. Net of the usage difference the real multiple is nearer
1.4–1.7. The honest fix is a regionalised `kwhByHome`, which needs a
climate-zone table this prototype does not carry.

| ZIP | Before | After |
|---|---|---|
| 94070 San Carlos | $1,035 | **$560** |
| 90210 Beverly Hills | $890 | **$555** |
| 10001 New York | $770 | **$550** |
| 37203 Nashville | $265 | **$320** |
| 72756 Rogers AR | $275 | **$315** |

Spread falls from 3.9× to 1.8×. The two cheap ZIPs rise because water and gas
were previously being *discounted* by an electricity ratio below 1.

**Never reach past `benchColMultipliers()`.** Reading `state.utilitiesRatio`
inside the model squares the adjustment; this bug existed once and produced a
65% overstatement in Los Angeles.

### 6.2 Phone and internet — `esfConnectivity()`

One row. Both priced nationally — **never apply a cost-of-living multiplier.**

```
lines = adults + teens        (cap 5)
phone = phonePerLine × lines  (per-line price declines with line count)
internet = flat national
```

Counting `min(householdSize, 4)` billed toddlers a phone line; `esfPhoneLines()`
counts adults and teenagers only.

### 6.3 Groceries — `esfGroceries()`

Peer figure × weighted household ÷ people. Kids under 13 and teens carry
different weights (`groceries.weight`). Plan tier follows income band.

### 6.4 Car costs — `esfCarCosts()`

```
fuel        = milesPerDay × 30.4 × (dollarsPerGallon ÷ mpg)
maintenance = milesPerDay × 30.4 × centsPerMile
insurance   = insuranceAnnualByState[state] ÷ 12 × paymentFactor
carCosts    = fuel + insurance + maintenance
```

Insurance is **not** mileage-driven — state is the dominant term.

**This was specced and not implemented — fixed 2026-09-19 (defect D3).** The
code read a peer split scaled by the *Transport* cost-of-living index, which
moves only 0.92–1.17 across the whole country while real premiums run close to
threefold from Maine to Louisiana. Maine came out dearer than Texas. Premiums
are set by state regulation, minimum-coverage law, litigation climate and
weather losses; none of that tracks the price of a restaurant meal, so the
state figure has to be the **base**, not a modifier on a national one.
`driving.insuranceAnnualByState` (NAIC anchors, 50 states + national fallback)
now carries it, via `esfInsuranceStateMonthly()`.

`paymentFactor` survives: the car payment on step 2 is weak evidence about what
the car is worth, clamped to 0.8–1.4 so a large truck note cannot triple the
estimate.

| ZIP | Before | After |
|---|---|---|
| 10001 New York | $145 | **$220** |
| 90210 / 94070 California | $140 / $155 | **$165** |
| 72756 Rogers AR | $120 | **$145** |
| 37203 Nashville | $125 | **$135** |

**Miles of `none` still zeroes the whole row, insurance included.** A parked car
does carry insurance, so this is wrong in principle — but nothing in the flow
asks whether the tester owns a car, and *"I don't drive"* is the only signal
there is. Charging a premium to someone who just said they don't drive is the
more visible error. The real fix is a car-ownership question; it is in **Open
items**, not decided here.

### 6.5 Medical — `esfMedical()` / `esfReplacementPremium()`

**Only employer coverage is repriced.** Owner's ruling: *"unemployed insurance
only shown if user has employer insurance."*

| Coverage | Estimate |
|---|---|
| Through my job | **unsubsidized benchmark silver premium** — the payroll deduction stops when the job does |
| I buy it myself | peer figure |
| Medicaid or Medicare | peer figure |
| No coverage | peer figure |

```
premium = benchmarkSilver(state) × Σ ageFactor(each adult)
                                 + childFactor × min(kids, 3)
```

ACA age curve, public and standard. Children 0.765, only the three oldest
counted. Two adults around 40 with two kids lands near **$1,895/month**.

> **This function was declared twice in one file.** The old flat-rate version
> loaded later and silently won, so the age curve never ran and every household
> got $960. Exactly the shadowing trap `CLAUDE.md` warns about — nothing errors,
> the number is just wrong.

### 6.6 Debt minimums — `esfDebtOptions()`

**Opens at $0.** There is no estimate to make: minimums depend on balances and
card counts, and nothing asks for either.

The dropdown is labelled by situation rather than by dollar band, so the tester
picks a description and the model supplies the figure:

> $0 · 1 card · 2 cards · 1 card and a loan · 2 cards and a loan · …

**Six options maximum** (owner's ruling). The labels are the point — a tester
converting "two cards and a car loan" into a dollar figure in their head is the
work the tool exists to remove.

### 6.7 Property tax — `esfPropertyTaxEstimate()`

```
estimate = nationalHomeValue × colMultiplier^valueDispersion × stateRate
```

`valueDispersion: 1.35` is a **documented stub**. The county multiplier is
rent-derived, which understates owned-home values in expensive metros — San
Francisco came out at $6,060 against a realistic $9,540. The exponent corrects
the spread and is flagged in the JSON as needing a real ZHVI source.

**Shown to owners only**, and opt-in. About four in five mortgages escrow taxes,
so a pre-filled figure would double-count for most owners. The label carries
*"(may be included in mortgage)"* — beside the label, not under the box, because
under the box is after they have already typed.

Same treatment for **home insurance**.

### 6.8 HOA — `esfHoaEstimate()`

**Never estimated from ZIP.** HOA fees are bimodal and driven by property
*type*. Branches on the place-type tile: apartments hidden, houses default low,
condos and townhomes pre-filled.

**The code broke this rule until 2026-09-19 (defect D2).** It multiplied the
type-based figure by the **Housing** cost-of-living index — which is estimating
from ZIP, the one thing this section forbids. In 94070 that index is 2.02 and
turned a $350 condo fee into $705. The multiplier is gone; the figure is now
whatever `hoa.byPlaceType` says, unmodified.

| ZIP | Condo, before | After |
|---|---|---|
| 10001 New York | $885 | **$350** |
| 94070 San Carlos | $705 | **$350** |
| 90210 Beverly Hills | $565 | **$350** |
| 37203 Nashville | $405 | **$350** |
| 72756 Rogers AR | $265 | **$350** |

Fees are not perfectly flat nationally, so this now errs low in expensive
metros. That is the safer of the two errors: an understated fee is a slightly
small target, while an invented $885 one is a figure a condo owner can see is
wrong — and a tester who catches one number being wrong stops trusting the
other eleven.

---

## 7. Screens

**Five steps.** `ESF_STEPS` holds four; the plan screen is the fifth and counts
in the progress indicator (`ESF_TOTAL_STEPS = ESF_STEPS.length + 1`).

| Step | Heading | Contents |
|---|---|---|
| 1 of 5 | *(intro)* | Copy + two buttons |
| 2 of 5 | Housing and Car Payments | rent · mortgage · car payment · transit |
| 3 of 5 | Keeping things running | utilities · phone+internet · groceries · medical · car |
| 4 of 5 | Living-related Expenses | debt · property tax · home insurance · HOA · anything else |
| 5 of 5 | Emergency Savings Fund Goal | §8 |

Each capture step carries an owner-supplied Buddy illustration matched to what
it asks about. **Buddy images are never cropped** — `object-fit: contain`,
letterboxed. Owner's ruling: *"do not cut crop buddy images.. those are key to
including."*

### What is NOT on these screens

- **No running total.** It was built, then removed. It also reproduced a bug the
  budget builder had already solved: it counted rows the tester had not yet seen.
- **No two-card current/crisis choice.** Cut (§1).
- **No Plaid offer.** The earlier copy is retained in principle but not built.
- **No confidence range.** The target is always a single number.
- **No runway line**, no income sanity check, no permanent expenses summary.
  All specified, none built — see §12.

---

## 8. The goal screen

```
Step 5 of 5
Emergency Savings Fund Goal

            $22,500
  still to save · full fund $34,500

Months of expenses covered
Choose coverage based on your own situation.
[ 3 months ] [ 6 months ] [ 9 months ]
Longer term savings to feel best coverage

Breathing room for surprise costs
[ +10% ▾ ]        adds $3,150

Already saved
[ $12,000 ]       of $34,500

Target date: September 2028
[ 09/19/2028 ]    $940 a month

[ Back ]                  [ Set my goal ]
```

### The headline is what is LEFT to save

`esfGoalRemaining() = max(0, esfTarget() − alreadySaved)`.

`esfTarget()` is unchanged and still anchors everything derived from expenses —
coverage months and the buffer both size the **fund**, not the gap. That is why
the headline carries a caption: a bare figure above a "Months of expenses
covered" control reads as the thing that control moves, and it is not.

### Behaviour

- **Coverage** defaults to 3 for a household of one, 6 otherwise. Each choice
  carries a descriptive note — never prescriptive (D26).
- **Buffer** is a percentage applied to the monthly basis before coverage
  months. Choices run −20% to +30%, default +10%.
- **Target date** defaults to **24 months** out. The earlier spec said 6, which
  is arithmetically impossible: with coverage also at 6 months it means banking
  100% of your expenses every month.
- **The goal rounds to the nearest $500.**
- **Three inline rows** — buffer, already saved, target date — each "control
  left, consequence right".

### Language discipline

"6 months" means two different things in this feature. Never show the bare
number twice unlabelled: always **"Months of expenses covered"** and
**"Target date: September 2028."**

---

## 9. Calculations

```
monthlyBasis = Σ every row, monthly           esfSurvivalMonthly()
buffered     = monthlyBasis × (1 + buffer)    esfBufferedMonthly()
target       = round(buffered × months, 500)  esfTarget()
remaining    = max(0, target − alreadySaved)  esfGoalRemaining()
monthly      = remaining ÷ monthsToTarget     esfMonthlyContribution()
```

### There are no crisis factors

The entire crisis-factor table is gone, along with the current/crisis split it
served. Owner's ruling: *"for the crisis mode, I'm suggesting there is no choice
for insurance"* — the one cost that genuinely changes in a job loss is health
cover, and that is now simply **how `medical` is priced for everyone with
employer coverage** (§6.5). One number, one basis.

---

## 10. On commit

`esfCommit()` does four things:

1. **Saves the expense set** to `state.expenses` — keyed on the taxonomy, not
   on ESF's own row ids, so other modules can read it without re-running the
   wizard.
2. **Creates exactly one goal** in `state.tacticalGoals`, replacing any existing
   emergency fund.
3. **Seeds the budget** via `applyBudgetBaseline(esfToBaseline())`. Asked
   categories carry the tester's figure; the rest open on peer values.
   > This uses `applyBudgetBaseline`, not `submitBudgetBaseline`, so it skips the
   > old→new confirm gate. Defensible only because the fund runs **before** the
   > budget by design. **If that order ever changes, the gate has to come back.**
4. **Logs `goal_set`** with target, coverage, buffer, the medical figure and how
   many rows were left untouched.

`state.esfEvents` is capped and lives and dies with the page — D03 forbids a
backend and localStorage. The admin panel is the readout.

---

## 11. Known trade-offs

1. **Tap targets are under the floor.** The repo requires ≥44px. ESF number
   boxes are at **29px** after three owner-requested height reductions, and the
   onboarding ZIP field is at 40px. This is the explicit price of the no-scroll
   rule. Fine for a click-through demo; worth a pass before anyone tests on a
   real phone.
2. **`valueDispersion: 1.35`** is a stub standing in for a real ZHVI source
   (§6.7).
3. **The over-funded state is flat — resolved, accepted.** Enter more than the
   fund needs and the goal screen reads "$0 / still to save" and "$0 a month".
   Over-funded is not a state that should exist: a user either has an emergency
   fund or doesn't. Someone who already has one gets the goal marked complete in
   the goal list and finds the fund again through the Tools tab. Both are
   planned. Accepted as-is.
4. **Childcare is deliberately excluded.** Often the second-largest expense for
   households with young kids, but it largely disappears in a job loss.
   A decision, not an oversight.
5. **The simulated keypad cannot be tested at phone width.** `kbdIsSimulated()`
   correctly suppresses it on a coarse pointer, and the browser pane emulates
   touch below 768px. Keyboard behaviour must be checked at desktop width.

---

## 12. Specified but not built

Carried forward so nothing is lost. None of these are blocked; none were asked
for.

- Runway line — *"about 1.2 months covered today"*
- Income sanity check — *"That's more than you told us you earn."*
- Confidence range while rows are untouched
- Permanent "Your monthly expenses" summary as the return path
- Edit-time delta note — *"Your goal went up $900."*
- Resume mid-screen / continuous save (impossible under D03 as written)
- Plaid offer on step 2
- Withdrawal and replenishment flows

---

## 13. Out of scope

- Where the money is held
- The education layer
- Income type as a coverage driver
- A Tools tab to make the fund findable after "I already have one" — **needed**,
  since that path deliberately leaves no goal behind

---

## 14. Data sources

Static tables in `data/emergency-fund.json`, never a live API call.

| Figure | Source |
|---|---|
| Regional price levels | BEA Regional Price Parities |
| Housing costs | Zillow ZORI by county |
| Electricity and gas | EIA state averages |
| Groceries | USDA Cost of Food at Home |
| Car operating cost | AAA cents-per-mile |
| Car insurance | State average premiums |
| Health insurance — marketplace | CMS benchmark silver by state + ACA age curve |
| Property tax | State effective tax rates |
| HOA | By property type, not location |
