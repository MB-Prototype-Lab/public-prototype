# Big Purchase Calculator — Feature Spec

**Status:** Spec, revision 5. Built in blue `versions/v3.1c/` (gate label
*v3.1 (C)*, branch `HoffDemo-BigPurchase` at `b4abe14`) and ported into `app/`.
In this app `BP_ENTRY = false`: onboarding is unchanged and the calculator opens
from the Goals tab; see docs/app-contracts.md. Revision 4 was written
against screenshots and restated some things the owner had already changed in
code; this revision reconciles the two. Where they disagreed, §0.1 records which
side won.
**Scope:** The shared engine (the "big rock") plus its first consumer, the
**Vehicle** calculator. Every other category is named, not built.
**Depends on:** `emergency-fund-spec.md` (onboarding steps, range dropdowns,
goal arithmetic, "I already have one" flag), `buddy-chat-esf-spec.md` (Buddy
panel, D26 voice rules)
**Plaid:** Not used. Not referenced. Every figure is typed or estimated.
**Date:** 2026-09-26
**Supersedes:** revision 4

---

## Open items — what's left

### Still open

- **The shared profile with provenance (§6.2) is NOT built.** The calculator
  reads the flat `state.profile` the ESF already writes (`zip`, `milesRange`,
  `milesPerDay`). Adding `{value, source, at}` and "editing it anywhere edits it
  everywhere" touches the ESF too, so it waits until this feature settles.
- **Buddy at the dealership (§6)** needs artwork. D10 stands: buddy art is
  supplied, never generated, so the illustration slot is empty until then.
- **Lifestyle considerations beyond the quiz.** The four questions (§6.5) cover
  who is in the car, what it is for, where they drive and what matters. Whether
  anything else belongs there is open.

### Settled in this revision

- **Five screens, not three** (§2). The merged screen 2 was rejected in testing
  by the owner — cost, financing and options each have their own step now.
- **ESF button labels:** *Yes · Not yet / start one · Not yet / later*, three
  side by side, collapsing to a one-line confirmation (§5).
- **The 3-year figure is removed entirely** (owner, 2026-09-26). Everything is
  5 years. It survived nowhere after the split, and a second horizon beside the
  first reads as a rival answer.
- **Upkeep is base-plus-rate** (§7.7) — the flat per-mile model ran ~3× low.
- **Fuel follows the assumed mileage**, on REAL-WORLD mpg: a gas SUV is 15, not
  the 25 the prototype had or the 28 an EPA sticker claims (owner: "a gas SUV
  does not get 28 — it is like half"). At 15 miles a day that is $95/month.
- **This feature never asks how far you drive** (§6.1): profile, or 15 a day.
- **Tier ladder is Luxury · Premium · Standard · Value** (§6.4), a display
  label only — the data key stays `everyday`.
- **Cost rows are read-only** (§7.4). The owner's ruling beats the editable
  range dropdowns the earlier revision described.
- **Credit table refilled from one release** — Experian Q2 2026 (§3.4).

### 0.1 Where revision 4 and the build disagreed

| Revision 4 said | The build does | Why |
|---|---|---|
| 3 steps, screen 2 merged | 5 steps, split | Owner, 22 Sep: the merged screen was "way too much info"; options need context; financing belongs at the end |
| Cost rows editable dropdowns | Read-only defaults | Owner, 22 Sep: "users shouldn't modify any of it" |
| Cheaper options as two buttons on screen 2 | Their own screen, as expandable cards | Same ruling — the options needed explaining, not squeezing in |
| Landing copy "See what it really costs to own…" | "The real cost of something isn't just what you pay at the register…" | Owner dictated it verbatim, 22 Sep |
| Price editable inline on screen 2 | Editable on the financing step | Owner: financing screen is where final adjustments happen |

### Known stubs (all flagged `"_prototype": true` in the data file)

### Known stubs (all flagged `"_prototype": true` in the data file)

- Credit tier rates must come from **one** Experian release. The figures found
  so far mix quarters (§3.4).
- Depreciation curves and every tier/type/fuel factor
- State insurance, fee and registration tables
- Alternative pricing (fixed −20% used, −35% one tier down) — no real price data

---

## 0. How to read this document

Two layers, and the split is the point of the big rock:

| Layer | What it is | Reused by |
|---|---|---|
| **Engine** | Category-blind tools: cost stack, financing, depreciation, opportunity cost, save-to-afford, alternatives, cash-vs-loan, the screen shell | Every future category |
| **Category config** | Vehicle-specific inputs, estimators, curves, tier examples | Vehicle only |

A future Home or Boat calculator is **a new category config**, not a new
feature. If building Home requires changing the engine, the engine was wrong.

### Files (built)

| File | Holds |
|---|---|
| `js/bp-engine.js` | All engine arithmetic. No DOM. Category-blind. |
| `js/bp-vehicle.js` | Vehicle config + estimators. No DOM. Implements §3.1. |
| `screens/bp-landing.js` | Landing (fund question included) + the Goals-tab cards |
| `screens/bp-setup.js` | Screen 1 |
| `screens/bp-cost.js` | Screen 2 — the cost table |
| `screens/bp-options.js` | Screen 3 — ways to spend less |
| `screens/bp-finance.js` | Screen 4 — paying for it |
| `screens/bp-commit.js` | Screen 5 — plan for it |
| `screens/bp-sheet.js` | Every in-frame sheet: credit, tax break, the simulated IRS page, savings rate, financing choices, loan-vs-cash |
| `js/buddy-bp.js` + `screens/bp-buddy.js` | Buddy's model and panel, drawn with the ESF panel's classes |
| `data/big-purchase.json` | Every figure, sourced or flagged. Wrap with `scripts/wrap-data.sh`. |
| `data/buddy-bp.json` | Buddy copy. Same contract as `buddy-esf.json`. |

Same model/render split as ESF and `chat-router`/`chat`.

---

## 1. Outcome

**Problem statement (owner's):** when making a big purchase that is new or
infrequent to a user, they may not have complete information about the true
costs of the big purchase, which increases the total cost and may overspend
relative to their budget.

**What the tool does:** shows the true cost of owning the thing — including
financing and the costs nobody lists on the sticker — compares it against up to
two cheaper alternatives priced on the same full stack, and turns the chosen
option into a savings goal and a budget reminder.

### The thesis on one screen

A used car is 20% cheaper on the sticker. On the full stack — a loan rate close
to double and earlier repairs — the
true-cost saving is a **different number**, usually smaller. **The gap between
the sticker saving and the true-cost saving is the product.**

**Rule: alternatives are always priced on the full stack, including financing,
never on sticker.** This is why financing sits on the same screen as cost.

### Design principles

1. **One decision, one screen.** All inputs for a decision live on one screen.
   Scrolling is allowed; going back to change an answer is not required.
2. **Headline pinned at the top**, always visible while inputs scroll beneath.
3. **Nothing is a question if it can be an estimate.** Only price and trade-in
   open blank.
4. **Every estimate shows its drivers** — one dark *"Based on…"* line.
5. **One-handed.** Tiles and controls in the lower two thirds.
6. **5th-grade copy.** One idea per sentence.
7. **Facts, never advice (D26).** Composition and consequence are facts;
   magnitude is commentary. No "great choice", no "you should", no "safer".
8. **44px tap targets.** Scrolling is allowed here, so the ESF's 29px
   compromise does **not** carry over.
9. **Info sheets open inside the phone frame.** Never `alert()`, `confirm()` or
   a native `<select>` — all OS-drawn, all escape the frame (ESF lesson).

---

## 2. The flow

| # | Screen | Headline | Job |
|---|---|---|---|
| — | Landing | — | Pick a category; the fund question sits at the bottom of it |
| — | Help me pick | — | Optional: four lifestyle questions that suggest a vehicle type (§6.5) |
| 1 | What you're buying | Sticker price, once typed | Define the vehicle, one question at a time |
| 2 | The costs that are usually overlooked | First year with the car · every month after | The read-only cost table, then "Will this be financed?" |
| 3 | Ways to spend less | What your pick costs over 5 years | The alternatives, explained, with the comparison |
| 4 | Paying for it | Payment · interest, or cash on the day | Final price and financing adjustments |
| 5 | Plan for it | Still to save | Goal, purchase date, budget reminder |

Progress: *Step 1 of 5* through *Step 5 of 5*. The landing is not a step, and the
fund question lives on it rather than taking one.

**Why five.** Revision 4 had three, with cost, financing and the alternatives
merged onto screen 2. Built that way it was rejected on sight: too much at once,
the options arrived with no explanation of why they were there, and financing
competed with the job the screen existed to do. Each now gets a screen, in the
order a person decides — what it is, what it costs, what else is out there, how
to pay, what to do about it.

---

## 3. Engine

### 3.1 Category interface

A category config supplies exactly this. The engine calls nothing else.

```js
{
  id: "vehicle",
  setupInputs: [...],              // screen 1 rows
  costRows: [...],                 // screen 2 rows: bucket, estimator, scope
  horizons: { primary: 5 },
  resaleValue(inputs, years),      // depreciation curve
  loanRate(inputs, creditTier),    // by condition + credit tier
  taxBreak(inputs),                // null, or the info sheet id to offer
  alternatives(inputs),            // returns 0–2 modified input sets
  describe(inputs)                 // "Standard SUV · Gas · New"
}
```

### 3.2 The cost stack — four buckets

| Bucket | Timing | Vehicle examples |
|---|---|---|
| `upfront` | Once, at purchase | Sales tax, title and fees, home charger, riding gear |
| `monthly` | Every month owned | Insurance, fuel, upkeep reserve, subscriptions, other |
| `yearly` | Each year after the first | Registration renewal |
| ~~`valueLost`~~ | **Retired** (2026-09-26) | Depreciation — computed by the category, read by nothing |

Interest is computed by §3.4 and added as its own line.

### 3.3 True cost — what you pay, with nothing credited back

```
trueCost(N)    = price
               + Σ upfront
               + Σ monthly × 12 × N
               + Σ yearly × (N − 1)
               + interestPaid(N)
monthlyCost    = trueCost(5) ÷ 60
```

Computed at **N = 5**, and only at 5. The 3-year secondary figure was removed on
2026-09-26 (owner): after the flow was split it appeared on no screen, and a
second horizon printed beside the first reads as a rival answer to the same
question. `horizons.secondary` is gone from the data file with it.

**RESALE IS NOT IN THIS TOOL** (owner, 2026-09-26): *"I don't want resale value
at all… it should never be included."* The price is counted once and in full,
and nothing is credited back for what the thing might sell for later.

Earlier revisions did the CPA-correct thing instead — counted `valueLost` in
place of the price, where `valueLost(N) = price − resaleValue(N)` — so that the
car was never counted twice. **Both models avoid the double count**; they answer
different questions. The old one asked *what did owning it cost you*; this one
asks *what did you pay out*. The owner chose the second, and it buys two things
worth having: the comparison table's columns now add up exactly as a reader
expects, and no screen has to explain why a total is smaller than the rows above
it.

`resaleValue(inputs, years)` stays in the category interface and the retention
curve stays in the data file — the category owns its own depreciation model and
a later feature may want it — but **nothing downstream reads either.** If you
find a figure on screen that moves when the retention curve changes, that is a
bug.

**Trade-in does not reduce true cost**, except through sales tax. It is a way of
paying, not a discount.

**Monthly = what it costs to own**, over the whole five years, price included.
The cash-out-of-pocket figure is shown separately and labelled as the payment.

**Cash buyers:** interest is 0. The opportunity cost of the cash is shown in the
cash-vs-loan block (§3.7), **not** added to true cost — adding it would make
paying cash look like it costs interest.

### 3.4 Financing

```
principal     = price + salesTax + fees − downPayment − tradeIn    (floor 0)
payment       = principal × r ÷ (1 − (1 + r)^−n)    r = APR ÷ 12, n = term
interestPaid  = Σ interest in months 1 … min(n, 12 × N)
```

If the term runs past N, only interest paid **while owned** counts; the rest of
the balance is not counted. The tool prices five years of ownership, and
interest you have not paid yet in that window is not a cost you have borne.

#### Credit tiers

Default tier is **600–660** (the 650 assumption).

| Tier | New APR | Used APR |
|---|---|---|
| 781+ | 4.41% | 6.29% |
| 661–780 | 6.15% | 8.81% |
| **600–660** | **9.71%** | **13.93%** |
| Under 600 | 13.52% | 19.10% |
| Motorcycle | +2 pts on the above, `_prototype` | |

Source: Experian, *State of the Automotive Finance Market*, **Q2 2026 — all four
tiers from that one release**, as this section required. Tier map: 781+ = super
prime, 661–780 = prime, 600–660 = near prime (601–660), Under 600 = subprime
(501–600); deep subprime is not offered as a choice. Refilled 2026-09-21.

#### Typed rate

**Other rate** takes a typed APR — for a dealer promotion or a pre-approval, and
allowed to be lower than the chosen tier.

**Owner's ruling: a typed rate applies to the user's pick only.** Alternatives
keep the tier rates, so the used card still carries its higher rate and the
lesson survives.

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

### 3.7 Cash vs. loan

Shown in the financing block whichever way the user pays, for the selected card:

```
With a loan: interest over 5 years           $7,400
The same cash, if saved at 7% a year,
could grow by                                $3,900
Loan interest is certain. Savings growth is not.
```

- The cash side uses the amount the loan replaces (principal), compounded at the
  §3.6 rate over the loan term, capped at 5 years.
- **The last line is required and is never removed.** The two figures look
  comparable and are not the same kind of number. That sentence is both the
  honest CPA position and the legal protection.
- **No verdict.** The block never says which is better.
- If the user has **no emergency fund** and picks Cash, one line is added:
  *"Paying cash uses your savings. You told us you don't have an emergency fund
  yet."*

### 3.8 Alternatives

Generated by the category, priced by the engine on the **full stack** — every
estimator and the loan rate re-run.

| User's pick | Used alternative | Lower-tier alternative |
|---|---|---|
| New, above Value | ✅ price −20%, used 1–3 yrs | ✅ price −35%, tier −1, new |
| New, Value | ✅ | ❌ |
| Used, above Value | ❌ | ✅ price −35%, tier −1, same age |
| **Used, Value** | ❌ | ❌ |

Maximum two alternatives. Both can be shown **at once** alongside the user's
pick as a three-column comparison (§7.6).

### 3.9 Row scope — what an edit applies to

With several cards on one screen, every edit needs a rule:

| Scope | Rows | An edit applies to |
|---|---|---|
| **About you** | Trade-in · Parking, tolls, anything else · Loan or cash · Down payment % · Loan length · Credit tier · Savings rate | **Every card** |
| **About the car** | Sales tax · Fees · Insurance · Fuel · Upkeep · Subscriptions · Registration · Typed rate · Charger · Gear | **The selected card only** |

Consistent with the typed-rate ruling: an insurance quote for a new Lexus says
nothing about a used Toyota. Alternatives keep their estimates unless the user
selects one and edits it.

---

## 4. Landing

```
Estimate a big purchase

See what it really costs to own — not just the price tag.
We add up the costs that are easy to miss, show you
cheaper options, and help you plan how to pay for it.

What are you thinking about buying?

  [ 🚗  A vehicle                    › ]
  [ ⛵  A boat or RV     Coming soon   ]
  [ 🏡  A home           Coming soon   ]
  [ ✈️  A vacation       Coming soon   ]
  [ 🛒  Something else   Coming soon   ]
```

- **Each row carries a line ICON**, left of the label, inheriting the row's own
  colour so a coming-soon row greys out with its label. Inline SVG in
  `screens/bp-landing.js`, not emoji: emoji render at a different weight on
  every platform, cannot be coloured, and the plane drew as nothing at all.
- Coming-soon rows are **disabled, not hidden**.
- **Work and business vehicles are not listed.** Pricing them depends on the
  buyer's business tax situation — one step from tax advice.
- **Boat or RV is its own entry** (owner's ruling). It needs its own cost stack.

---

## 5. Emergency fund check

**Sits at the bottom of the landing screen**, in a tinted card under the
category list. Not a screen of its own. **Hidden entirely** when an ESF goal
exists or `state.esfSelfReported` is set.

```
┌──────────────────────────────────────────────┐
│ Before making a big purchase, do you have    │
│ an Emergency Savings Fund yet?               │
│                                              │
│ [   Yes   ] [ Start One ] [  Ask me  ]       │
│ [I have one] [   Now    ] [  later   ]       │
└──────────────────────────────────────────────┘
```

**THE QUESTION AND NOTHING ELSE** (owner, 2026-09-26). The definition was cut
first, then the one-line reason that replaced it. The question is the content;
Buddy carries the explanation for anyone who wants it.

**Three side-by-side buttons** (owner's ruling), equal grid columns, 44px tall.
Labels: **Yes** (subtext "I have one") · **Start One Now** · **Ask me later**.

| Choice | Effect |
|---|---|
| Yes | Sets `state.esfSelfReported` (same flag as the ESF's own path). |
| Start One Now | Opens `esfBuild`. On ESF commit, the Goals tab offers **Back to your car** → straight back into the flow, session intact. |
| Ask me later | Sets `state.bp.esfDeferred`. The LAST screen ends with **Start your emergency fund**. |

- Answering does **not** navigate. The card collapses to a one-line
  confirmation and the user still picks a category themselves.
- Copy is a fact about what the fund does, never a recommendation to have one.

---

## 6. Screen 1 — What you're buying

Headline: blank until price is typed, then **Sticker price $35,000**.

```
What you're buying

A few quick questions about what you have in mind.

        [ Buddy at the dealership illustration ]
```

- **Subtitle is one line.** *"You can change any answer."* is deleted — it was
  reassurance nobody asked for.
- **Buddy illustration sits under the subtitle**, above the first question, and
  fills the space the removed mileage question left. **Never cropped** —
  `object-fit: contain`, letterboxed, per the ESF rule.

| # | Row | Control | Notes |
|---|---|---|---|
| a | ZIP code | 5-digit field | **Only if not in state.** Reuses ESF onboarding step, incl. "Maybe share later" → national averages |
| b | Type | `[Car] [SUV] [Minivan] [Pickup truck] [Motorcycle]` | |
| c | Tier | 4 tiles with brand examples | Examples change with type |
| d | Fuel | `[Gas] [Diesel] [Hybrid] [Electric]` | Diesel hidden for motorcycle and minivan |
| e | Condition | `[New] [Used]` | |
| e2 | Age | `[1–3 yrs] [4–6 yrs] [7+ yrs]` | **Used only** |
| f | Price | typed currency | |

**Continue** enables when every visible row is answered. When onboarding is
connected later, the ZIP row disappears with no other change.

### 6.1 Mileage comes from the profile, or falls back

**Owner's ruling: this feature never asks how far you drive.** It reads the
answer if the profile already has one (§6.2) and otherwise assumes a default.

| Profile state | Miles a day used | Line under the cost table |
|---|---|---|
| Answered in onboarding | the BP midpoint for that band | *"Based on the 15–30 miles a day you told us."* |
| Not answered | **15** (`MILES_PER_DAY_DEFAULT`) | *"Estimated at 15 miles a day."* |

Band midpoints, for the onboarding question's five options:

| Answer | Miles a day |
|---|---|
| I don't drive | 2 |
| Under 5 miles | 3.5 |
| 5–15 miles | 10 |
| 15–30 miles | **25** |
| More than 30 miles | 40 |

These are THIS TOOL'S figures (owner, 2026-09-26), in
`vehicle.milesBandMidpoints`, and deliberately not the emergency fund's — 15–30
is 25 here against 22 there. Car costs scale straight off the number, so it is
set for the car.

Fuel and upkeep both read this one number (§7.6). The line under the table
always says which of the two cases applies, so an estimate is never mistaken
for something the user told us.

### 6.2 The shared profile — engine, not vehicle  **(NOT BUILT YET)**

> **Status:** the calculator reads the flat `state.profile` the ESF already
> writes (`zip`, `milesRange`, `milesPerDay`). The provenance wrapper below is
> agreed but unbuilt — it touches the ESF too, so it waits until this feature
> settles.

**Owner's ruling: an answer given once is saved and reused everywhere.** This is
an engine concern, not a vehicle one — every future category needs the same
thing — so it belongs in the big rock.

`state.profile` holds facts about the person that any feature may ask for. Each
entry carries its value, where it came from and when:

```js
state.profile = {
  milesPerDay: { value: 22, band: "15-30", source: "onboarding", at: "2026-09-20" },
  zip:         { value: "37201", source: "onboarding", at: "2026-09-20" },
  adults: {...}, kids: {...}, homeType: {...}, healthCoverage: {...}
}
```

Three rules:

1. **Ask once.** A feature that needs a profile field reads it. It asks only
   when the field is missing, and writing the answer back is part of asking.
2. **Say where a number came from.** A figure built on a profile answer says so
   (*"Based on the 15–30 miles a day you told us"*); a figure built on a default
   says that instead. The user can tell which is which without digging.
3. **Editing it anywhere edits it everywhere.** Changing miles a day inside this
   calculator updates the profile, so the ESF's car costs move too. A field the
   user has edited is `source: "user"` and is never silently overwritten by a
   later onboarding pass.

**Fields this calculator reads:** `milesPerDay`, `zip`.
**Fields it writes:** the same two, if it ever has to ask for them.

### 6.3 Onboarding screens are not part of this feature

**Owner's ruling: remove them.** The household, home type, health coverage and
miles-a-day steps belong to ESF onboarding. They must not appear inside the big
purchase flow, and the big purchase flow must not present a *"Step 3 of 6"*
progress bar borrowed from that sequence.

This feature's own steps are the three in §2. If a needed profile field is
missing, it appears as **one row on screen 1**, not as a borrowed onboarding
screen.

### 6.5 "Help me pick" — the four-question quiz

**Owner, 2026-09-26:** *"the experience assumes the user has a car in mind, but
they may not."* Everything else in this tool prices a vehicle the tester names.
This is the one screen for somebody who cannot name one yet.

Offered from screen 1, as a row above the questions, and **only while the type
is unanswered** — it never sits under a decision already made.

| # | Question | Options |
|---|---|---|
| 1 | Who's usually in the car? | Mostly just me · Me and one other · Three or more · Six or more |
| 2 | What do you use it for most? | Getting to work · Errands and school runs · Hauling or towing · Long road trips |
| 3 | Where do you do most of your driving? | City streets · A bit of everything · Country roads and highways · Snow, ice or steep hills |
| 4 | What matters most to you? | The lowest price · The lowest running costs · Room and capability · Comfort and features |

**Every option carries scores per vehicle type**, in `vehicle.quiz`. Six or more
people scores the minivan at 3; hauling scores the truck at 3; city streets and
commuting score the car. The highest total wins, ties falling to the earlier
type in the data file's order, which runs smallest to largest. Two options also
carry a nudge: *the lowest price* → Value brands, *comfort and features* →
Premium, *the lowest running costs* → hybrid, *hauling or towing* → diesel
(dropped when the winning type has no diesel).

**A new question is a data entry, not a branch.** Nothing in the screen knows
what a truck is.

**It suggests, it does not choose.** The result reads *"Sounds like — SUV"* with
the answers that produced it listed underneath, and two ways out: **Use this**,
which writes type (and any nudge) into screen 1, or **I'll pick myself**, which
writes nothing. No figure in the calculator moves until that tap.

This is product fit, not money advice, so D26 is not strictly in play — but the
same restraint applies: it names what fits how they drive, never what they ought
to buy or spend.

### 6.4 Tier examples

| Tier | Car, SUV, Minivan | Pickup truck | Motorcycle |
|---|---|---|---|
| **Luxury** | Porsche, Range Rover, Mercedes S-Class | Ram Limited, GMC Denali | Ducati, BMW |
| **Premium** | BMW, Lexus, Audi, Acura | Ford F-150 Platinum | Harley-Davidson, Triumph |
| **Standard** | Toyota, Honda, Ford, Chevy, Subaru | Toyota Tacoma, Chevy Silverado | Honda, Yamaha, Kawasaki |
| **Value** | Kia, Hyundai, Nissan, Mitsubishi | Nissan Frontier | Royal Enfield, Kymco |

**Ladder: Luxury · Premium · Standard · Value** (owner's ruling).

- **"Everyday" is renamed "Standard"**.
- **"Value" stays "Value"** as the fourth tier. The proposed
  "Budget-friendly" was overruled. Note the tension this leaves: the word is
  fine on a tier tile the user picks for themselves, and was rejected on the
  cheaper-option button, where it would be suggested *to* them (§7.8).

Stored per type in `big-purchase.json`.

---

## 7. Screen 2 — The frequently overlooked costs

**This screen does ONE job**: what the car the tester came for costs to run.
The alternatives are screen 3 (§7.8–7.9) and financing is screen 4 (§7.10).

Three parts, in this order: **headline → the cost table → "Will this be
financed?"**

### 7.1 Headline (pinned)

```
        $47,965                    $385 / mo
  first year, with the car        after that
```

Both figures come straight off the table below — the first-year total is the
same number, printed from the same expression, so the two can never drift apart.
There is no 3-year figure anywhere (§3.3).

### 7.2 Screen title

**"The frequently overlooked costs"** (owner, 2026-09-26; was "…that are
usually overlooked", before that "…easy to miss"). It must hold **one line** on
a 390px frame, which the shared 20px title size does not allow — `bp-title-fit`
shrinks it rather than letting it wrap.

### 7.3 Layout

```
The frequently overlooked costs
        $47,965                $385 / mo
  first year, with the car      after that

New Standard SUV · Gas · $40,000              ← read-only here

The costs of using the SUV throughout the year.

                        a month ┊ first year        ← bold, black
  The car                       ┊    $40,000        ← plain, black
  Taxes and registration        ┊     $3,345
  Insurance                $140 ┊     $1,680
  Fuel                     $160 ┊     $1,920
  Upkeep and repairs        $85 ┊     $1,020
  ────────────────────────────────────────────
  Total                    $385 ┊    $47,965        ← bold

  Costs are estimated for Nashville, 25 miles a day.
  Costs will vary.

  ┌──────────────────────────────────────────┐
  │     A different brand could save you     │     ← §7.8 callout
  │                $18,500                   │
  │  over 5 years, counting everything above │
  │     [  Explore  ]  [ Not interested ]    │
  └──────────────────────────────────────────┘

── Will this be financed? ───────────────────
[  Yes, a loan  ]  [ No, paying cash ]
We'll work out the payment and the interest at the end.

[ Back ]          [ Ask 🐶 ]          [ Continue ]
```

- **The car's own price is the first row** (owner): a list of extras with no
  price above it invites the question "on top of what?".
- **Expense rows are plain black, not bold.** Only the column headings and the
  Total carry weight, so the eye lands on the two figures that summarise.
- **No rules between rows.** The alignment does the separating; the only rules
  on the table are the one above the Total and the dotted vertical between the
  two figure columns.
- **ONE Total line** (owner, 2026-09-26), carrying both columns. What keeps the
  month from being read as part of the year is the styling, not a second label:
  bold black column headings, a dotted rule between the two figure columns, and
  the Total row bold against rows that are not.
- **The financed question is one tap and nothing more.** Payment, term, rate and
  the cash-vs-loan block are screen 4 — which is why *"We'll work out the payment
  and the interest at the end"* is true here, where revision 4 had to delete it.
- **Nothing on this screen is editable** (§7.4).

#### What a user does here

Two things, and only two:

1. **See what they forgot.** Taxes, insurance, fuel and upkeep are the rows
   people don't think of. Understanding alone is a legitimate outcome.
2. **Say whether it will be financed**, which decides what screen 4 asks for.

Fixing an estimate and exploring cheaper options have both left this screen —
the first was dropped, the second became screen 3.

### 7.4 The cost table — boxed

The individual expense rows sit **in a single bordered card** (owner's ruling),
not loose on the background.

- Two columns: **A MONTH** and **FIRST YEAR**.
- Rows with no monthly form (the car, taxes and registration) leave the monthly
  cell empty rather than printing $0.
- The monthly total is labelled **"Every month after you buy"**, not "Total" —
  the column excludes the car and the taxes, and a $256 month beside a $46,414
  year invites the wrong reading.
- **Footer line, replacing "Nothing here is a bill you've had yet":**
  *"Estimated for Tennessee, 15 miles a day. Your own costs will depend on your
  car, your driving and where you live."* — where the mileage clause follows
  §6.1 and names whether it was told to us or assumed.
- **NOTHING HERE IS EDITABLE** (owner's ruling, overriding the range dropdowns
  this section used to specify): "I don't think users should modify any of it.
  It should just be defaulted answers on tax, title, registration, etc." The
  band machinery (`bpBandOptions()`) survives in the engine and is unused by
  this screen — so row scope (§3.9) has nothing to arbitrate here either.
- **Value lost is nowhere in the tool** (§3.3). Not on this table, not in the
  comparison, not on the plan screen.

### 7.5 The car is stated, not edited, on this screen

The line above the table reads **New Standard SUV · Gas · $40,000** and is
read-only. Price changes on screen 4 (§7.10), where the owner asked for the
final adjustments to live; type, tier and fuel change with **Back**.

### 7.6 Vehicle estimators

```
milesPerDay  = profile.milesPerDay ?? MILES_PER_DAY_DEFAULT (15)
milesPerYear = milesPerDay × 365

salesTax   = stateRate × max(0, price − (stateCreditsTradeIn ? tradeIn : 0))
fees       = titleFee[state] + firstRegistration[state] + docFee
insurance  = stateAvgPremium ÷ 12 × typeFactor × tierFactor × conditionFactor
fuel/yr    = milesPerYear × costPerMile(fuel, type)
upkeep/yr  = (upkeepBase + milesPerYear × upkeepPerMile)
             × conditionFactor × tierFactor               ← §7.7
charger    = flat install estimate            electric only
gear       = flat estimate                    motorcycle only
resale(N)  = price × Π retention(year, tier, fuel)   for years age+1 … age+N
```

- **Trade-in tax credit is per state.** Most states tax only the difference; a
  few, including California, do not.
- **Fuel must reflect the assumed mileage AND a real-world mpg.** At 15 miles a
  day, a gas SUV at **15 mpg** and ~$3.15/gal lands near **$95/month**. Two
  errors were stacked here: the mileage was taken from a different answer, and
  the mpg table held window-sticker figures. Owner's ruling on the second — a
  gas SUV gets about half of 28. Window figures come off a test cycle; short
  trips, cold starts and a loaded car all land well under them, and this tool
  prices a fuel bill rather than quoting a brochure.
- **Retention curve** (new, `_prototype`): year 1 × 0.80, years 2–5 × 0.85,
  years 6+ × 0.88. Luxury and electric lose faster; Value slower. Used
  cars start the curve at their age band.

### 7.7 Upkeep — base plus rate

**The prototype's upkeep figure was roughly 3× too low** ($20/month). AAA's 2026
*Your Driving Costs* puts maintenance, repair and tires at **11.7¢/mile** at
15,000 miles a year (11.04¢ in 2025, 10.13¢ in 2024).

**Pure cents-per-mile is wrong at low mileage.** Oil degrades by date, tires age
out, batteries and fluids run on a calendar. A per-mile-only model says a
3-mile-a-day driver spends almost nothing on upkeep, which is false. So:

```
upkeepBase     = $400 / year        time-based: fluids, tires aging, battery
upkeepPerMile  = $0.06 / mile       wear-based: brakes, tires, repairs
```

At 5,475 miles a year: **$400 + $329 = $729/yr ≈ $61/month** for a new Standard
car. That is close to AAA's $641 pure per-mile figure at the same mileage, and
holds a sensible floor for a low-mileage driver.

**$729/yr is the baseline: a new Standard car, averaged across 5 years of
ownership.** That is what AAA's 11.7¢/mile measures — a new car over 5 years and
75,000 miles — not a car in any one year. Both multiplier sets are therefore
centred on **1.00 at that baseline**, and an earlier draft that put New at 0.60
and Standard at 0.85 was wrong: it multiplied out to $372/yr and quietly undid
the fix.

| Condition at purchase | × | | Tier | × |
|---|---|---|---|---|
| **New** | **1.00** | | Luxury | 2.00 |
| Used, 1–3 years | 1.35 | | Premium | 1.40 |
| Used, 4–6 years | 1.75 | | **Standard** | **1.00** |
| Used, 7+ years | 2.20 | | Value | 0.95 |

The condition factor is an **average over the whole 5 years**, not a rate for
year one — a car bought at 4 years old is 9 by the end, so its average is well
above a new car's. Tier factors are anchored on reported brand averages of
roughly $583/yr for a Honda owner against roughly $1,623 for a Porsche owner.
All values `_prototype: true` — directionally reasoned, not sourced per-brand.

Worked examples at 15 miles a day:

| Car | Upkeep |
|---|---|
| New Standard SUV | $729/yr · **$61/mo** |
| Used 1–3 yr Standard SUV | $984/yr · **$82/mo** |
| New Luxury SUV | $1,457/yr · **$121/mo** |

**This matters beyond one row.** Upkeep and the loan rate are the two costs that
eat a used car's sticker advantage. If upkeep is understated, the used card wins
by too much and the comparison teaches the wrong lesson.

### 7.8 Screen 3 — Ways to spend less (and the callout that points at it)

**The saving is named on screen 2, the detail lives here** (owner, 2026-09-26).
Under the cost table sits a callout carrying the biggest saving in large type,
and it asks for a decision rather than a tap:

```
      A different brand could save you
              $18,500
   over 5 years, counting everything above

      [  Explore  ]  [ Not interested ]
```

- **Explore** opens this screen.
- **Not interested** takes it out of the flow: Continue goes straight to paying
  for it (§7.10), and the callout collapses to one line with a *Show them* link,
  so the decision is reversible without walking backwards.
- It began as a quiet one-line link and was missed entirely — "it was almost
  hidden" — which is why the figure is now the loudest thing on the card.
- Either answer is logged (`bp_explore_choice`). A declined saving is a real
  answer; a scroll-past was not.

**Its own screen, not a section of screen 2.** The owner's objection to the
merged version was not the layout, it was the silence: *"the user came here to
buy the car they wanted, now the options are shown with no context."* So the
screen opens by saying why it exists —

> You came for the new Standard SUV. Before you plan for it, here are the
> cheaper ways people buy the same kind of SUV.
>
> Each one is priced on everything, not the sticker — so the saving is what
> you'd really keep. Tap one to see where it comes from.

— and closes with *"Staying with your pick is a fine answer — nothing here is a
recommendation."*

**Each alternative is a summary card that expands.** The heading carries the
saving, because that is the fact the tester is deciding on:

```
Consider used to save $5,000                          [+]
The same SUV, a few years old. Someone else already
paid for its first few years.

Consider a different brand to save $14,900            [+]
A similar SUV at a lower price, from a brand that costs
less to buy, insure and repair.
```

- **"A different brand"** for the lower tier. "Value brand" was rejected by the
  owner for implying lower quality; this names what changes without grading
  either car, and it is accurate — the −35% step is a brand change, not a worse
  version of the same car. Rejected alternatives: *More for your money* (implies
  the pick is a bad deal), *A lower price range* (still ranks them).
- A card whose alternative doesn't exist (§3.8) is **absent, not disabled**.
- Expanding one opens the comparison (§7.9) inside the card.

#### When neither exists (Used + Value)

Show the screen with no cards and one line:

> *This is already the lowest-cost option we compare, so there's nothing
> cheaper to show.*

### 7.9 The comparison table

Inside the expanded card. Two columns by default; a control adds the third.

```
┌─────────────────────────────────────────────┐
│  🐶   💰        $6,500    saved over 5 years │
│                 $8,900    if saved at 7% ✎   │
├─────────────────────────────────────────────┤
│  Over 5 years        YOUR PICK    THIS ONE   │
│  Price                 $40,000     $32,000   │
│  Taxes and registration $3,500      $2,900   │
│  Insurance              $8,400      $7,500   │
│  Fuel                   $5,700      $5,700   │
│  Upkeep and repairs     $3,900      $5,100   │
│  Loan interest          $9,400     $11,200   │
│  ─────────────────────────────────────────   │
│  Total                 $70,900     $64,400   │
├─────────────────────────────────────────────┤
│  [ + Add a different brand to compare ]      │
└─────────────────────────────────────────────┘
```

**All five points below are built.**

1. **Two numbers in the Buddy header**, not one (owner's ruling): the amount
   **saved over 5 years**, and what it could be **worth if saved at 7%** over the
   same period (§3.6). The ✎ edits the rate.
2. **No resale row, and no resale in the totals** (§3.3). The rows ARE the
   total: price, the costs, the interest, summed. The column adds up exactly as
   a reader expects, and nothing on screen has to explain a gap — an earlier
   draft deleted the row while the total still netted off resale, which needed a
   paragraph of apology underneath it.
3. **"· 5 years" is removed from every row label.** It moves to the column
   header — *"Over 5 years"* — once, at the top.
4. **A third column can be added.** The button adds whichever alternative is not
   already shown, so the user can see their pick, the used one and the different
   brand side by side. It reads *"+ Add used to compare"* or *"+ Add a different
   brand to compare"* depending on which is missing, and is hidden when no third
   option exists.
5. **The lowest total is green.** Only the **Total** row is coloured, never the
   individual rows — colouring every row turns the table into a scorecard and
   the cheapest car is not automatically the right one. Green is the repo's
   existing action colour.

**Selecting a column** makes it the working purchase; screens 4 and 5 recompute
on it. Tapping a column selects it, the current selection is ticked, and a line
under the table says which car is chosen. The footer's primary reads **Keep my
pick** until something else is chosen, then **Continue**.

**D26 check:** the header states an amount saved, never that saving it is
better. No row is labelled good or bad. A column that costs more prints a
negative saving plainly rather than a warning.

### 7.10 Screen 4 — Paying for it

**At the end, on the owner's ruling:** *"the financing screen should come at the
end for the user to make final adjustments to price and financing options."* On
the merged screen it competed with the costs; here it is the only thing on
screen, after the car has been chosen.

```
Paying for it
   $640 / mo              $14,400
  your payment        interest, 5 years

Used 1–3 yrs Standard SUV · Gas · $35,200

Price            [ $44,000 ]        ← the final adjustment

[ Loan ] [ Cash ]
Down payment                  20% · $8,800  ▾
Loan length                     72 months   ▾
Credit score                      600–660   ▾
  💡 Why does my score matter?
  💡 Tax break on loan interest      (new + loan only)
  Loan or cash? See both

Everything, over 5 years              $51,800
                            $864 a month to own

[ Back ]          [ Ask 🐶 ]          [ Plan for this ]
```

- Defaults: **Loan**, down payment **20%**, **60 months**, credit **600–660**.
- **Each setting is one row that opens its choices in a sheet**, not a grid of
  tiles. Three settings most people leave alone do not deserve three rows of
  buttons; "Other" closes the sheet and puts a typed field under the row, inside
  `#screenRoot` where the simulated keypad can reach it.
- **Cash** hides down payment, loan length and credit.
- **Cash vs loan (§3.7) is behind "Loan or cash? See both"** — its own sheet,
  with the required closing line unchanged. It was moved off the screen for
  space, not softened.
- **The price edited here is the pick's price.** If an alternative is selected,
  it is re-derived from that price (−20% used, −35% one tier down), and a line
  on screen says so.

---

## 8. Screen 5 — Plan for it

### Headline (pinned)

```
        $4,000
   still to save for the down payment
```

*"for the down payment"* reads *"to buy it"* for cash buyers.

### Layout

```
You picked the used Standard SUV.

Your choice
  Used Standard SUV · $28,000 · Gas
  $41,700 over 5 yrs · $695/mo to own
  $540/mo payment · 60 months · 13.5%

Things to keep in mind
  • Loan interest: $11,200 over 5 years
  • Insurance: $150 a month
  • Upkeep and repairs: $85 a month

Down payment       $5,600
  − Already saved  [ $1,600 ]
  − Trade-in       $0
  = Still to save  $4,000

When do you plan to buy?   [ 09/2027 ]     $334 a month

☐ Remind me to budget for this when I reach my goal

[ Back ]          [ Ask 🐶 ]          [ Set my goal ]
```

- **One date does two jobs**: it sets the goal's target date (and so the monthly
  savings figure) and it is the planned purchase date. Defaults to 12 months out.
- *"You picked…"* confirms the choice and never grades it. No *"Great choice"*.
- *"Things to keep in mind"* — the three largest non-price rows of the chosen
  stack, stated as facts.
- If `state.bp.esfDeferred`, a secondary button **Start your emergency fund**
  sits under *Set my goal*.

### Nothing left to save

When `toSave = 0`:

```
        $0
   still to save — your savings cover it

When do you plan to buy?   [ 11/2026 ]

☐ Remind me to budget for this when I buy it

[ Back ]          [ Ask 🐶 ]          [ Done ]
```

No goal is created. The budget prompt stays (owner's ruling), triggered by the
purchase date instead of goal completion.

### The reminder

| Case | Trigger | What appears |
|---|---|---|
| Goal set, box ticked | Goal marked complete | Prompt on the goal completion |
| No goal, box ticked | Purchase date reached | A task in the daily task system |

**The purchase-date task** (owner's ruling — it goes in the task system):

```
Did you buy the used Standard SUV?

[ Yes — add $540 a month to my budget ]
[ Not yet — ask me in 2 weeks ]
[ I decided not to ]
```

**The goal-complete prompt:**

> *You reached your down payment goal. Want to add $540 a month to your budget
> for this car?*
> `[ Add it ]` `[ Not now ]`

- The figure is the **payment**, not the ownership cost — the budget tracks cash
  leaving the account, and depreciation never leaves it. For cash buyers it is
  the monthly running costs.
- Nothing enters the budget without the tap. For the prototype, *Add it* records
  intent and confirms; budget write-through is out of scope.
- *Not yet* re-queues the task 14 days out. *I decided not to* closes it.

---

## 9. Info sheets

Two sheets, both in-frame (`screens/bp-sheet.js`), opened from amber 💡 chips
using the Buddy accent (`#E9A227`, dark text) so they are noticeable. Both are
facts; neither assesses the user.

### 9.1 Why does my score matter?

Opened from beside the credit tiles. Uses **the user's own loan**, not a generic
example — every figure recomputed for the selected card at each tier.

```
Your credit score changes your rate

   Score       Rate     Your payment    Interest, 5 yrs
   781+        4.7%        $525             $3,500
   661–780     6.3%        $545             $4,700
   600–660     9.6%        $590   ← you     $7,400
   Under 600   16%+        $680+           $12,800+

A higher score usually means a lower rate.
Same car, same price. Only the score changes.

[ Close ]
```

`← you` marks the tier currently selected, not a real score. No *"improve your
score"* line — that belongs to the education layer.

### 9.2 A tax break for car loan interest

Shown **only when paying with a loan on a new vehicle** — used cars and leases
don't qualify, so offering it on a used card would mislead.

**The calculator never subtracts the deduction from true cost.** Whether it
applies depends on the user's income, the car's assembly location and their tax
return — deciding that is tax advice (out of scope, owner-agreed). The sheet
tells them it exists and where to check.

The chip opens a sheet. Its link opens a second sheet that **simulates the
in-app web page** until a real in-app browser exists.

**Sheet (from the chip):**

```
A tax break for car loan interest

From 2025 through 2028, some people can deduct the interest
on a new car loan from their federal taxes.

We don't count it in your numbers. Whether it applies
depends on your income and the car.

[ See who qualifies › ]        [ Close ]
```

**Simulated web page (from *See who qualifies*):**

```
No tax on car loan interest
IRS · One Big Beautiful Bill provisions

What it is
A federal deduction for interest paid on a loan used to buy
a vehicle, for tax years 2025 through 2028.

Who may qualify
• The vehicle is new, not used
• Its final assembly happened in the United States
• It is for personal use, not business
• It weighs under 14,000 pounds
• The loan was taken out after December 31, 2024
• It is a loan, not a lease

How much
Up to $10,000 of interest a year. The deduction shrinks for
incomes above $100,000, or $200,000 for married couples
filing jointly.

How to claim
You can claim it whether or not you itemize. You'll need the
vehicle's VIN. Lenders send a form showing the interest paid.

Rules can change. Check with the IRS or a tax professional.

irs.gov/newsroom/one-big-beautiful-bill-provisions

[ Close ]
```

- The simulated page is **MoneyBuddy's own summary, not IRS text.** When a real
  in-app browser exists, the link goes to the IRS page itself.
- **Link target:** the IRS OBBB provisions page. Confirm the exact URL at build.
- Treat this sheet as time-sensitive content: it expires with the 2028 tax year,
  and the data file carries an `expires` date.

---

## 10. On commit

`bpCommit()`:

1. Saves the session to `state.bigPurchase` — setup inputs, every cost row
   (value, touched, scope), financing choices, credit tier and any typed rate,
   savings rate, the selected card and its computed stack at 3 and 5 years.
2. **If `toSave > 0`, creates one goal** in `state.tacticalGoals`:
   `{ type: "purchaseSaving", category: "vehicle", target: toSave, date,
   label: "Save for a used Standard SUV" }`. A new commit replaces the old one.
3. Stores `remindBudget`, the reminder figure, and the purchase date.
4. **If no goal and `remindBudget`**, queues the purchase-date task.
5. Logs `bp_goal_set` or `bp_plan_saved`.

---

## 11. Buddy

Reuses the ESF panel unchanged: overlay in `#buddyRoot`, fixed menu row, inert
input, D26 deflect, footer Ask button. New copy file `data/buddy-bp.json`.

**v1 is explain-only.** No lifestyle multipliers — miles a day is already an
input, so the ESF car questions would double-count it.

| Screen | Entries |
|---|---|
| Landing | What does this do? · Why ask about an emergency fund? · What do the three answers do? · What counts as a big purchase? |
| Help me pick | Why these questions? · How does it decide? · What if none of these fit? |
| 1 | What do the tiers mean? · New or used? · Why do you need my ZIP? · I don't know what I want yet |
| 2 | **One entry per line of the cost table** — taxes and registration · insurance · fuel or charging · upkeep · subscriptions · what "may need" means · what's in the first year · why we ask if it's financed. Each says what it is, how it was worked out, and what it means |
| 3 | Why are you showing me these? · The used option · The cheaper brand option · How is the saving worked out? · The money in the bag |
| 4 | Loan or cash? · Down payment · Loan length · Credit score · Interest over 5 years |
| 5 | The goal · The reminder · When do you plan to buy? |

### Draft copy — the hard ones

**Value lost** — *entry deleted, 2026-09-26.* Depreciation and resale left the
tool (§3.3), and an explanation of a figure that appears on no screen is a
question nobody is holding.

**How is the saving worked out?** (screen 3, replaces "What's in the true cost?")

> Both cars are priced on the same rows over five years: the price, taxes and
> registration, insurance, fuel, upkeep, and loan interest if there is a loan.
>
> The saving is the difference between those two totals. It's apples to apples —
> that's why the table shows both columns.
>
> We don't count anything for what a car might sell for later. These are the
> dollars that leave your pocket.

**Why is the used loan rate higher?**

> Lenders charge more to lend on used cars. It is usually close to double.
>
> That is why the used card counts more interest, even with a lower price.

**What does "worth by then" mean?**

> It shows what the difference could grow to if it were saved at 7% a year.
>
> It is not a promise and not a suggestion. It helps show that money saved today
> can be worth more later.

**Loan or cash?**

> A loan costs interest. That cost is fixed once you sign.
>
> Cash you don't spend could grow if it's saved. That growth is not promised.
>
> The numbers show both side by side. Which way to pay is your call.

**Trade-in**

> What someone would pay you for your current car, minus any loan you still owe
> on it.
>
> In most states, it also lowers your sales tax. You only pay tax on the
> difference.

**Voice checks:** no entry calls a cost high, recommends an option, or uses
"should". The credit tier is described as *"the score we used"*, never as the
user's own.

---

## 12. Instrumentation

`state.bpEvents`, in-memory under D03.

| Event | Detail |
|---|---|
| `bp_landing_pick` | category |
| `bp_esf_check` | have / startFirst / after |
| `bp_setup_done` | type, tier, fuel, condition, age, price |
| `bp_row_changed` | rowId, card, from, to |
| `bp_summary_edit` | field, from, to |
| `bp_card_selected` | card (pick / used / tier) — from a column tap or the footer |
| `bp_costs_done` | financed: loan / cash (leaving screen 2) |
| `bp_explore_opened` | card (which summary card was expanded) |
| `bp_quiz_started` / `bp_quiz_answered` / `bp_quiz_used` / `bp_quiz_skipped` | the lifestyle quiz (§6.5) |
| `bp_costs_teaser` | tapped the cheaper-options line on screen 2 |
| `bp_third_column_added` | which |
| `bp_pay_mode` | loan / cash |
| `bp_finance_changed` | field, from, to |
| `bp_credit_changed` | from, to, typed |
| `bp_rate_changed` | from, to (savings rate) |
| `bp_sheet_opened` | credit / taxBreak / taxBreakPage |
| `bp_goal_set` / `bp_plan_saved` | target, date, remindBudget, card, payMode |
| `bp_budget_prompt` | source (goal / task), added / notYet / declined |
| Buddy events | Reuse `chat_*` tagged `tool: "bp"` |

**The experiment:** does seeing the full-stack comparison change which card gets
picked? `bp_card_selected` against `bp_setup_done.condition` is the readout. A
user who arrived for a new car and left with a used one is the tool working — so
is one who saw the numbers and kept the new car.

`bp_sheet_opened: credit` is the second readout — the credit sheet is the
feature's main education moment.

---

## 13. Data file — `data/big-purchase.json`

```json
{
  "credit": {
    "defaultTier": "600-660",
    "tiers": {
      "781+":     { "new": 4.41,  "used": 6.29 },
      "661-780":  { "new": 6.15,  "used": 8.81 },
      "600-660":  { "new": 9.71,  "used": 13.93 },
      "under600": { "new": 13.52, "used": 19.10 }
    },
    "motorcycleAdd": 2.0,
    "_source": "Experian State of the Automotive Finance Market, Q2 2026 — all four tiers from this one release"
  },
  "opportunity": { "defaultRate": 0.07, "options": [0.04,0.05,0.06,0.07,0.08,0.10] },
  "horizons": { "primary": 5 },
  "categoryEmoji": { "vehicle": "🚗", "boatRv": "⛵", "home": "🏡",
                     "vacation": "✈️", "other": "🛒" },
  "taxBreak": { "id": "carLoanInterest2025", "newOnly": true, "loanOnly": true,
                "expires": "2028-12-31",
                "link": "irs.gov — One Big Beautiful Bill provisions (confirm URL)" },
  "vehicle": {
    "milesPerDayDefault": 15,
    "milesFloor": 2,
    "_milesNote": "milesFloor is what 'I don't drive' becomes HERE — somebody buying a car drives a little — without touching the onboarding band, where 0 still means 'no car' to the emergency fund",
    "alternatives": { "usedCut": 0.20, "tierCut": 0.35, "_prototype": true },
    "tierLabels": { "luxury": "Luxury", "premium": "Premium", "everyday": "Standard", "value": "Value" },
    "tierExamples": { "...": "per type; the third KEY stays `everyday`, only its label is Standard" },
    "retention": { "_prototype": true },
    "upkeep": {
      "base": 400, "perMile": 0.06,
      "_note": "the condition and tier multipliers live in vehicle.factors as upkeepAge and upkeepTier, beside the insurance ones, so every factor table sits in one place",
      "_source": "AAA Your Driving Costs 2026: 11.7c/mile at 15k mi/yr; split into a time base and a mileage rate. Factors _prototype.",
      "_prototype": true
    },
    "factors": {
      "insuranceType": {}, "insuranceTier": {}, "insuranceCondition": {},
      "upkeepAge":  { "new": 1.00, "1-3": 1.35, "4-6": 1.75, "7+": 2.20 },
      "upkeepTier": { "luxury": 2.00, "premium": 1.40, "everyday": 1.00, "value": 0.95 },
      "upkeepFuel": {}, "upkeepType": {}, "_prototype": true
    },
    "mpg": { "car": 24, "suv": 15, "minivan": 19, "truck": 14, "motorcycle": 45 },
    "kWhPerMile": {}, "charger": {}, "gear": {}, "subscriptions": {},
    "states": { "TN": { "salesTax": 0.07, "creditsTradeIn": true,
                        "titleFee": 0, "registration": 0, "insuranceAvg": 0 } }
  }
}
```

**If you edit the JSON you must re-run `bash scripts/wrap-data.sh`.**

---

## 14. Out of scope

- Plaid, in any form
- Real vehicle prices, trims or models
- Boat, RV, home, vacation, "something else" (named, not built)
- Work and business vehicles (permanently — tax exposure)
- Leasing
- Applying the car loan interest deduction to any figure (shown as info only)
- Writing to the budget (intent is recorded, not applied)
- Buddy lifestyle multipliers for this tool
- A real in-app browser (simulated for the tax sheet)
- Any onboarding step (household, home type, health coverage, mileage) — those
  belong to ESF onboarding and write to the shared profile
