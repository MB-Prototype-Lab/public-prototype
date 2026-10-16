# Big Purchase Calculator — Feature spec

The app helps a participant choose a specific car, see ownership costs, choose
how to pay and optionally set a savings goal. The journey is **landing → finder
→ Your car**, inside the full product. [App contracts](app-contracts.md) define
its state and ESF hand-off; calculator-first setup belongs to the
[Big purchase Flow](../flows/big-purchase/docs/flow.md).

## 0. Files and boundaries

Paths below are under `app/`. Figures live in JSON; arithmetic lives in the
model; screens render the session. After changing JSON, run
`bash scripts/wrap-data.sh` to regenerate the script-tag wrappers.

| File | Responsibility |
|---|---|
| `js/bp-engine.js` | Category registry, session, cost stack, loans, opportunity cost and savings target |
| `js/bp-vehicle.js` | Vehicle rows, local estimators and category registration |
| `js/bp-finder.js` | Catalog selection, quiz scoring, peers and engine-backed figures |
| `js/bp-lease.js` | New-car lease estimates, signing-cost savings and lease option handlers |
| `screens/bp-landing.js` | Category landing, ESF question, Goals entry and return cards |
| `screens/bp-finder.js` | Make/model and quiz views, cost table, cheaper cars and editable calculation panel |
| `screens/bp-yourcar.js` | Paying, planning and changing the selected car |
| `screens/bp-controls.js` | Shared financing controls and `bpCommit()` |
| `screens/bp-sheet.js` | In-frame chooser shell and overlay dispatch |
| `js/buddy-bp.js`, `screens/bp-buddy.js` | Explain-only Buddy panel |
| `data/big-purchase.json` | Credit, financing, catalog, quiz, peers, vehicle costs and prototype factors |
| `data/buddy-bp.json` | Contextual Buddy copy |

The finder contract is in the headers of `js/bp-finder.js` and
`screens/bp-finder.js`: both selection paths price a catalog car through the engine.
The peer contract is in `js/bp-finder.js`: comparison information, never a
recommended spending limit or affordability rule (D26).
The lease formula and assumptions are in the header of `js/bp-lease.js`;
lease estimates leave `bpStack()` loan/cash arithmetic separate.

## 1. Outcome and product rules

The sticker is only part of ownership cost. Compare cars on the full stack,
including financing and running costs, so a used car's higher loan rate and
upkeep remain visible alongside its lower price.

- State facts without recommending a purchase, payment mode or spending limit.
- Label payment, running cost, monthly outgoing, year-one cash and five-year
  cost separately. Financing is how the price is paid, not a second cost.
- Reuse profile ZIP and mileage. This feature asks no onboarding questions.
- Keep choosers and overlays inside the phone frame, with 44px targets and
  scrolling where needed. Native OS popups cannot be contained by frame CSS.
- Keep one session and one money model across finder, calculation panel and
  Your car. An edit carries forward to planning.

## 2. Journey and session

| Screen | Job | Next action |
|---|---|---|
| `bpLanding` | Emergency-fund question, then category | A vehicle opens the finder |
| `bpFinder` | Pick make/model and condition, or answer five questions; inspect costs and cheaper cars | Continue opens Your car |
| `bpYourCar` | Choose Loan/Cash/Lease, edit price and plan savings | Set goal or Done returns to Goals |

`bpOpen()` starts a fresh vehicle session with `bpStart()`. The Goals card and
Tools jump list use this entry. `state.bp` holds the in-flight run,
`state.bigPurchase` the saved plan and `state.bpEvents` the in-memory log.
Back uses the navigation stack; finder Back also walks its internal views.

The emergency-fund detour preserves the same purchase session. Choosing a
different catalog car clears per-car overrides and touched flags; choosing the
same car/condition preserves them. `bpfChoose()` records an original selection
so cheaper choices remain compared with one baseline and that car stays reachable.

## 3. Engine

### 3.1 Category interface

`bpRegisterCategory()` registers a category with `id`, `setupInputs`, `costRows`,
`horizons`, `loanRate`, `alternatives`, `describe` and `noun`. The engine stays
category-blind; the vehicle config owns estimators and labels. `bpContext()`
exposes shared about-you rows to estimators.

### 3.2 Cost buckets

| Bucket | Timing | Vehicle rows |
|---|---|---|
| `upfront` | At purchase | Sales tax, title/fees, charger or riding gear |
| `monthly` | Each month | Insurance, fuel/charging, upkeep, parking/tolls/other |
| `yearly` | After the first year | Registration renewal |

Trade-in is `costless`, with bucket `none`: a way of paying, reducing true cost
only through sales tax where the state allows it. Interest is computed separately.

### 3.3 True cost and cash flow

The definition in the `js/bp-engine.js` header counts the full price once,
upfront costs, running costs, renewals after year one and interest paid within
the horizon. The visible horizon is five years. Cash has no loan interest.

`bpBreakdown()` keeps **what it costs** separate from **how you pay**. Never add
down payment, principal or loan payments to the price-and-interest cost stack.
For loans, tax/fees enter principal; cash on the day consists of down payment
and other upfront extras. For cash, price, tax/fees and extras are due at once.
Registration renewal is absent from year one.

`bpMonthlyPayment()` rounds the displayed payment once. `bpMonthlyAllIn()` adds
that payment to the displayed running cost so the monthly parts add up.

### 3.4 Financing

Read the loan and stack headers in `js/bp-engine.js` for payment and amortization
arithmetic. Principal includes price, sales tax and fees, less down payment and
trade-in, floored at zero. Other upfront costs are paid on the day. Interest
counts only through the shorter of the loan term and ownership horizon.

Defaults are Loan, 20% down, 60 months and credit tier 600–660. All tier APRs
come from the single source noted in `credit`; used and new cars have separate
rates. **A typed APR applies to the participant's pick only**; comparison cards
keep their tier rates. Credit labels describe the score used for the estimate,
never a verified score. `everyday` remains the Standard tier's data key.

### 3.5 Save-to-afford

```
loan:  cashNeeded = downPayment
cash:  cashNeeded = price + salesTax + fees + Σ other upfront
toSave            = max(0, cashNeeded − alreadySaved − tradeIn)    round to $100
monthly           = toSave ÷ monthsUntilPurchaseDate
```

`toSave = 0` → no goal (§8).

### 3.6 Opportunity cost

Applied to **both** the upfront and the monthly difference (owner's ruling),
over 5 years, default **7%**, editable.

For an alternative against the user's pick:

```
upfrontDiff  = cash at purchase (down payment + upfront bucket)   pick − alt
monthlyDiff  = (payment + monthly bucket)                          pick − alt
FV           = upfrontDiff × (1 + i)^5
             + monthlyDiff × ((1 + i/12)^60 − 1) ÷ (i/12)
```

**The 7% is the stock market's long-run average after inflation** — not a
recent 3-year return, which has run well above it. Copy never says *"invest"*;
it says what the difference is **worth**:

> *Costs $3,200 less over 5 years.*
> *Worth about $4,100 by then if saved at 7% a year ✎*

✎ opens rate tiles `[4%] [5%] [6%] [7%] [8%] [10%]`. One change updates every
card and the cash-vs-loan block.

### 3.8 Alternatives

The engine can price the pick plus up to two category-generated cards. New
above Value has used and lower-tier alternatives; new Value has used only;
used above Value has a lower-tier alternative; used Value has neither.
`bpVAlternatives()` reads fixed prototype cuts from `vehicle.alternatives` and
re-runs every estimator and the applicable loan rate.

The finder's visible cheaper choices use its catalog: the same car used, the
cheapest model in the same type/use/tier when cheaper, and the peer range.
`renderBpfSave()` keeps the original selection reachable and shows only
monthly-saving car choices; the peer range remains informational.

### 3.9 Row scope

| Scope | Values | Applies to |
|---|---|---|
| About you | Trade-in, parking/tolls/other; shared payment, term, credit and savings settings | Every card |
| About the car | Tax, fees, insurance, fuel, upkeep, renewal, charger, gear; typed APR | Selected card only |

`bpRowValue()` reads overrides before estimates. Alternative cards retain their
estimates until edited. Switching car clears overrides that describe the prior
car. `bpSetPrice()` also clears per-car overrides when price changes.

## 4. Landing

The title is **Thinking about a big purchase?** The fund question precedes the
category list. **A vehicle** is enabled; boat/RV, home, vacation and something
else are disabled Coming soon rows. Supplied image tiles retain their colors
and dim with disabled rows. Work/business vehicles are outside this tool.

## 5. Emergency-fund check

`bpEsfBoxShown()` decides whether to offer the question once per run. A created
or self-reported fund suppresses the offer at entry. If shown, the answer stays
visible and changeable for the rest of that run.

| Choice | Effect |
|---|---|
| Yes | Sets the self-reported flag and collapses the card in place |
| Start One Now | Sets `state.bp.esfReturn` and opens `esfStart()` |
| Ask me later | Sets `state.bp.esfDeferred`. The LAST screen ends with **Start your emergency fund**. |

**Change** reopens the question and clears a self-reported flag supplied by this
card. Yes and Ask me later leave category selection to the participant.
After the fund is set or reported, Goals offers **Back to your car**;
`bpResumeAfterEsf()` clears the return flag and resumes the finder session.

## 6. Finder

**I know what I want** offers Make, Model and New/Used. Choosing a make opens
its model list; the model determines vehicle type. Choosing condition enables
**See the real cost to own**. Prices are fixed catalog estimates, not live quotes.

**Help me choose a car** asks five questions from `vehicle.finder.quiz`.
Scores rank type/use buckets, ties follow the data's bucket order, and a fuel
preference orders matching cars first. Answers remain editable. The result
shows a fit, runner-up buckets and a price range with three catalog models.
Choosing a New/Used price selects both model and condition.

The catalog covers sedan, SUV and truck, each with three uses, three price
tiers and three models per tier. Range bounds come from those model prices.
Peer markers do not preselect a range.

## 7. Cost view and calculation panel

### 7.1 Selected car

The car view names make/model/condition, its reputation and sticker price.
Its table separates payment, running cost, total monthly outgoing, payment as a
percentage of income, year-one cost and five-year cost. Cash omits the payment
row. New-car lease mode uses `bpLeaseFigures()`; its five-year view repeats the
lease. Peer estimates use loan settings even when the participant chooses cash
or lease, and their running-cost table replaces engine running costs.

### 7.2 Cheaper choices

Cheaper choices show monthly savings and the modeled five-year value at the
session savings rate. `bpfSavings()` uses `bpOpportunity()` for loan/cash and
`bpfGrowth()` when a lease participates. Keep the rate footnote with the figure.
The peer-range row opens catalog cars in that range; selecting a car updates
costs and closes the chooser. Continue carries the selection to Your car.

### 7.3 See how we calculated this

`bpfOpenCalc()` opens an editable Buddy-styled breakdown in `#buddyRoot`.
Participants can change sticker price, taxes/fees, financing, insurance,
fuel/charging and upkeep. Loan and lease controls share Your car's session.
Totals recompute from the engine; edits carry into Your car. **Put my estimates
back** clears per-car overrides and restores catalog price, keeping financing.
The panel preserves scroll position across edits.

### 7.4 Profile and local estimates

`bpVMilesPerDay()` maps the onboarding mileage band through this tool's
`vehicle.milesBandMidpoints`, otherwise reads the profile figure or defaults
to 15 miles a day. Its floor is two miles for an explicit non-driver, without
changing the profile or ESF. Description lines distinguish told and assumed mileage.
ZIP determines state tax/fees, insurance and electricity; unmatched states use
the national record. `benchColMultipliers()` is the location chokepoint.

### 7.5 Vehicle estimators

Function headers in `js/bp-vehicle.js` define the arithmetic and rationale:

| Function | Contract |
|---|---|
| `bpVSalesTax()` | State rate; trade-in credit only where allowed |
| `bpVFees()`, `bpVRenewal()` | Purchase fees and later renewals remain separate |
| `bpVInsurance()` | ESF state insurance base, full-coverage/type/tier/condition factors |
| `bpVFuel()` | Shared mileage, real-world mpg or local electricity; tool-specific pump floor |
| `bpVUpkeep()` | Time base plus mileage rate, then age/tier/fuel/type factors |

A mileage-only upkeep model would erase calendar maintenance for low-mileage
drivers. Factors center on a new Standard car averaged across five years;
prototype factors and source notes belong beside their data. Electric cars add
a charger; motorcycles add riding gear when the category prices one.

## 8. Your car and savings goal

The selected make/model/condition heads the screen. **Change your mind?** opens
the same cheaper choices plus **Search all cars**, which returns to finder start.
Price edits and financing choices update the same pick and costs.

**Paying for it** offers Loan, Cash and Lease. Lease is available only for new
cars. Loan controls choose down payment, length and credit, with typed down
payment or APR when requested. Lease controls choose signing amount, term,
annual miles and credit. Cash hides borrowing controls.

**Planning for it** asks whether savings are needed for the down payment,
purchase or signing costs. Yes shows the parts, already-saved input and Need
to save. A positive amount offers a target month (1–36 months out, default 12)
and monthly savings. No saves a plan without a goal; nothing left to save also
uses **Done**. `bpLeaseAfford()` prices signing costs and extras; loan/cash use
`bpSaveToAfford()`. The date is stored as the first day of the selected month.

If `state.bp.esfDeferred`, a secondary button **Start your emergency fund**
sits under *Set my goal*.

## 9. In-frame choosers

`renderBpLayer()` dispatches make/model lists, financing options, lease/date
options, peer range and changing-car choices. They share `renderBpSheetFrame()`
and Close. Typed fields stay in the main screen. `bpFieldCommitted()` defers
repainting during a button press so a blur cannot remove the click target;
the shared keypad latch separately owns layout stability.

## 10. Saving

`bpCommit()` replaces any prior `purchaseSaving` goal. A positive savings target
creates one goal with zero current progress and the selected target month;
`{noGoal:true}` suppresses it. Labels use the finder's exact make/model and
condition when available.

The saved plan records setup, selected inputs, cost-row values/touched/scope,
payment mode, financing, savings rate, target, purchase date and goal id.
It never writes the budget. Save logs `bp_goal_set` or `bp_plan_saved` and
returns to Goals.

## 11. Buddy

The contextual panel is explain-only, with separate purchase state and copy.
It shares ESF styling/art and `#buddyRoot`, echoes entry labels into the thread,
and keeps an inert question input. After a conversation starts, the fixed menu
keeps calculation help disabled; the finder's calculation link opens its own
editable breakdown. See [Buddy panel behavior](buddy-chat-esf-spec.md).

## 12. Instrumentation

`state.bpEvents` is capped at 300 and resets with the page. Tools shows the
latest events. Current events cover start, landing category, fund answer,
finder path/quiz/range/pick/completion, cost-row and price edits, financing,
credit, save and Buddy actions. The model/handler calls to `bpLog()` define
payloads; do not invent events from screen descriptions.

## 13. Data and limits

`app/data/big-purchase.json` is authoritative for catalog prices, quiz scores,
peer arrays, credit rates, defaults and estimator factors. Peer household
arrays index `householdSize − 1`; income bands come from the annual figure.
Rates, catalog and factors are static prototype inputs rather than quotes.
The tool does not connect accounts, apply a tax deduction, write a budget or
collect a second household profile. Other purchase categories remain unbuilt.
