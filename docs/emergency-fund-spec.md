# Emergency Savings Fund (ESF) — Feature spec

The fund builds a target from monthly survival expenses and a savings figure to
reach it. It reads the shared profile, opens most rows on local estimates, and
lets the participant confirm or change them. [App contracts](app-contracts.md)
define the immediate budget replacement on every save. Contained setup belongs
to the [Emergency fund Flow](../flows/emergency-fund/docs/flow.md).

## 0. Files and boundaries

Paths below are under `app/`.

| File | Responsibility |
|---|---|
| `js/esf.js` | Rows, estimates, session, totals, budget conversion and commit |
| `screens/esf-build.js` | Intro, three capture steps, inputs and description lines |
| `screens/esf-plan.js` | Coverage, buffer, saved amount and target date |
| `js/buddy-esf.js`, `screens/buddy-panel.js` | Contextual question tree and disclosures |
| `data/emergency-fund.json` | Rates, sources, prototype assumptions and lifestyle multipliers |

Data loads from generated `.js` wrappers for `file://`. After changing JSON,
run `bash scripts/wrap-data.sh`. Arithmetic and its rationale live in the
headers beside the functions in `js/esf.js`; keep figures in data.

## 1. Product rules

- Estimate what the participant cannot readily recall. Rent, mortgage, car
  payment, transit and anything else open blank; debt opens at $0.
- Group by recall rather than category. Car payments and running costs belong
  to different capture steps; local utilities and phone/internet have separate rows.
- Show each estimate's drivers in one dark description line (`esfBasedOn()`).
- State facts without recommending coverage or judging costs.
- Keep capture screens within the 430×940 frame without scrolling. Buddy's
  transcript scrolls separately. Preserve owner-supplied art without cropping.

## 2. Profile inputs

The fund reads ZIP, income, adults and ages, kids (`under13` and `teen`), place
type, health coverage and daily mileage from the shared profile. The full app
collects these in onboarding; the Flow defines its own reduced setup.

`esfHousehold()` falls back to adults at a representative age when age answers
are absent. `esfPhoneLines()` counts adults and teens, capped at five.
`esfMilesPerDay()` distinguishes an explicit zero from an unanswered question.
Only employer health coverage is repriced for loss of a job.

**No "rent or own" question.** It is read off the two housing fields on step
1 of the fund, which can say *both* where a tile could not. `esfOwnsHome()`
reads the mortgage field directly and **must never route through
`benchLifestyleKey()`**, which collapses rent and mortgage into one key.

## 3. Entry and exit

A Home task opens `esfBuild`; the Goals card reopens a saved fund with
`esfReopen()`. Both `esfBuild` and `esfPlan` belong to the Goals tab. Back from
the intro returns to the screen that opened it, including a Big purchase detour.

The intro offers **Build my fund** and **I already have one**. The second calls
`esfSkipToGoal()`: sets `state.esfSelfReported`, completes the fund task in both
task systems, logs the answer and returns to Goals. It collects no amount and
creates no goal.

`esfStart()` clears the session before computing opening estimates so car
insurance cannot inherit a previous run's car payment. `esfReopen()` keeps the
session's figures and returns to the intro. Boot removes the seeded emergency
fund; committing replaces any existing emergency-fund goal.

## 4. Rows and taxonomy

Rows reuse the budget's twelve category names. The seven asked categories are
Housing, Utilities, Groceries, Debt payments, Transport, Health and Other.
Dining out, Subscriptions, Personal care, Entertainment and Shopping remain in
the budget and receive peer values when the fund saves.

| Row | Category | Visible step | Opening/control |
|---|---|---|---|
| `rent`, `mortgage` | Housing | 2 | Blank typed amounts; both count |
| `carPayment`, `transit` | Transport | 2 | Blank typed amounts; both count |
| `power` | Utilities | 3 | Estimated range |
| `connect` | Utilities | 3 | Estimated range |
| `groceries` | Groceries | 3 | Estimated range |
| `medical` | Health | 3 | Estimated range |
| `carCosts` | Transport | 3 | Combined fuel, insurance and upkeep range |
| `debt` | Debt payments | 4 | Opt-in, $0, situation-labelled options |
| `propertyTax` | Housing | 4 | Owners only; annual estimate, opt-in |
| `homeInsurance` | Housing | 4 | Owners only; monthly estimate, opt-in |
| `hoa` | Housing | 4 | Conditional by place type; opt-in |
| `anythingElse` | Other | 4 | Blank typed amount |

`group` joins rows into one card. Hidden rows contribute nothing to totals.
Opt-in estimates contribute nothing until added. Property tax stores an annual
amount and converts to monthly exactly once in `esfRowMonthly()`; its range
label shows the monthly equivalent. Tax and insurance labels warn that the
mortgage may already include them.

Debt means minimum payments, never what the participant normally pays.
Childcare has no separate row; a continuing cost can go in anything else.
Buffer is a percentage on the plan, never an expense category.

## 5. Adjustment controls

Estimated rows use range dropdowns; recalled amounts use typed fields.

- `esfBandOptions()` builds the list: four bands below the estimate, five above,
  plus a **$0 option first** — "none of this applies to me" is a real answer for
  a HOA fee or a car.
- Band width follows magnitude, with a $100 override for home utilities.
- Selecting a range stores its midpoint and marks the row touched.
- Debt offers six situation-labelled choices from `debt.options`, starting with
  Nothing owed, rather than asking participants to estimate a minimum.
- Numeric fields use the shared keypad and `onchange`; `kbdInit()` owns the
  press latch when closing the keypad changes layout.

Buddy can replace a description with a tappable disclosure note. The note
occupies the same space and retires when the participant touches the row. See
[Buddy behavior](buddy-chat-esf-spec.md).

## 6. Estimation rules

Read the corresponding function headers in `app/js/esf.js` for arithmetic.
Local pricing goes through `benchColMultipliers()`, never directly through a
second state ratio. All tables are static; no live API supplies a price.

| Cost | Function and contract |
|---|---|
| Home utilities | `esfPowerEstimate()`: electricity uses its capped rate ratio; water and gas use the composite regional price level |
| Phone/internet | `esfConnectivity()`: national prices, declining per-line rate, no cost-of-living multiplier |
| Groceries | `esfGroceries()`: peer figure adjusted for household composition without counting household size twice |
| Car costs | `esfCarCosts()`: distance-based fuel/upkeep plus state-based insurance; car payment is separate |
| Medical | `esfMedical()`: replacement premium only for employer coverage; peer Health figure otherwise |
| Replacement premium | `esfReplacementPremium()`: unsubsidized benchmark silver, adult age factors and at most three children |
| Property tax | `esfPropertyTaxEstimate()`: typical home value, housing multiplier and state rate; opt-in |
| Home insurance | `esfBillEstimate()`: home-insurance bill anchor with its Housing multiplier; opt-in |

Insurance is not mileage-driven. An explicit "I don't drive" nevertheless
zeroes the whole car row, including insurance: the profile has no car-ownership
answer. A parked car can still carry insurance; ownership is a product question.

**HOA — never estimated from ZIP.** HOA fees are bimodal and driven by property
*type*. Branches on the place-type tile: apartments hidden, houses default low,
condos and townhomes pre-filled. `esfHoaEstimate()` reads `hoa.byPlaceType`
without a Housing multiplier.

Prototype assumptions include `valueDispersion: 1.35` for home values and
`electricityCapMultiplier: 1.6` for national usage without climate tables.
Insurance/rate anchors need refreshed source data; lifestyle multipliers are
invented and flagged `_prototype`. Source notes stay beside figures in JSON.

## 7. Screens

`ESF_STEPS` contains the intro and three capture steps. `ESF_TOTAL_STEPS` also
counts `esfPlan`, so visible progress is five steps; capture state is zero-based.

| Visible step | Heading | Content |
|---|---|---|
| 1 | Emergency Savings Fund | Intro and two choices |
| 2 | Housing and Car Payments | Four recalled amounts |
| 3 | Keeping things running | Five estimated running-cost rows |
| 4 | Living-related Expenses | Debt, housing extras, anything else |
| 5 | Emergency Savings Fund Goal | Coverage and savings plan |

The first capture step shows an inert financial-account connection offer.
The footer contains Back, Ask and Continue (See my number on the last capture
step); the intro's build choice sits in the body. No running total appears.

## 8. Goal screen and calculations

The headline is **still to save**, with the full fund labelled underneath.
Coverage and buffer size the whole fund, not the remaining gap.

- Coverage choices: 3, 6 or 9 months; default 3 for one person, 6 otherwise.
- Buffer: −20% through +30%, default +10%, applied to the monthly basis.
- Full target: nearest $500, minimum $500 (`esfTarget()`).
- Already saved: deducted from the target with a $0 floor; an over-funded
  session shows $0 still to save and $0 a month.
- Target date: default 24 months out; savings horizon floors at one month.
- Monthly contribution: remaining amount divided by that horizon, rounded to $5.

`esfSurvivalMonthly()` includes medical replacement cover already. Never add a
second premium. `esfBufferedMonthly()` applies the buffer to that entire basis.
The buffer's dollar consequence is computed before target rounding.

Keep **Months of expenses covered** distinct from **Target date: month/year**.
Buffer, already saved and target date each pair a control with its consequence.

## 9. Session and instrumentation

`state.esf` keeps frozen `opening` values, live `rows`, `touched`, opt-in `added`
rows and plan settings. Buddy state and disclosures belong to the same session.
`state.esfEvents` is capped at 200 and lasts only until refresh; Tools shows it.
Capture completion logs stated monthly expenses and untouched rows. Goal save
logs target, coverage, buffer, medical and untouched rows. No participant data
persists to storage or a backend.

## 10. Saving

`esfCommit()`:

1. Saves `state.expenses`, including taxonomy totals, raw rows, touched rows and
   opt-in bills. Buffer does not enter the budget baseline.
2. Creates exactly one emergency fund in `state.tacticalGoals`, replacing any
   fund-shaped goal and retaining the already-saved amount as current progress.
3. Seeds the budget via `applyBudgetBaseline(esfToBaseline())`. Asked
   categories carry the tester's figure; the rest open on peer values.
4. Clears any pending builder proposal, logs `goal_set` and returns to Goals.

Creating or editing the ESF immediately replaces even an existing budget,
without confirmation. This exception applies to repeated saves; ordinary
builders still use `submitBudgetBaseline()` and its replacement gate.

## 11. Limits

The compact layout includes number controls below the project's 44px target.
The simulated keypad requires desktop-width verification; touch devices use
their own keypad. Real-device layout, audio and accessibility need manual checks.
Money storage, withdrawals, replenishment, continuous save and an education
layer are outside this tool. Broader proposals belong in [future work](future-work.md).
