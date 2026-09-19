# Emergency Fund (ESF) Tool — Feature Spec

**Status:** Confirmed for build (HoffDemo rebuild)
**Scope:** Tool only. Education layer is owned separately.
**Supersedes:** all earlier versions of this file
**Date:** 2026-09-17

---

## 1. Outcome

Help a user arrive at a credible emergency fund target based on their real monthly survival expenses, and a monthly savings number to reach it — **without asking them for a single dollar figure they'd have to look up.**

**Design principles**

1. **Nothing is a question if it can be an assumption or an estimate.** Every value except housing and car payment is pre-filled from what onboarding knows. Users override; they don't enter.
2. **Sort by recall, not by topic.** Screens group by how hard a number is to remember, so each screen has one interaction mode and effort falls as the user advances.
3. **Every estimate shows its drivers.** One line of black text above each field: *"Based on…"*. An auditable estimate earns an override; an unexplained one gets a shrug.
4. **Ask habits, never dollars.** People know how far they drive, not what they spend on petrol.
5. Copy at a 5th-grade reading level.
6. **Errors are asymmetric.** Guessing high is safe for a safety net. Intervene only when a number looks too low — with one deliberate exception (property tax, §6.4).

**What this prototype tests**

Whether users find the two-number framing (current vs. crisis) valuable, and which number they choose. Accuracy of the factors is explicitly *not* the question yet. Instrument the choice (§7) as the primary learning objective.

---

## 2. Onboarding — required inputs

The ESF asks for no profile information of its own. Everything below must come from onboarding.

| # | Question | Format | Feeds |
|---|---|---|---|
| 1 | ZIP code | text | every category |
| 2 | Annual household income | text or band | income band, USDA plan tier |
| 3 | **Who lives with you** — number of adults, **each adult's age**, kids by age bucket (0–12, 13–17, 18+) | steppers | groceries, phone lines, medical, marketplace premium |
| 4 | **Your place** — rent or own, and type: Apartment studio/1BR · Apartment 2BR+ · Condo or townhome · House 2–3BR · House 4+BR | tiles | utilities, HOA, property tax |
| 5 | **Health coverage** — Through my job · I buy it myself · Medicaid or Medicare · No coverage | tiles | medical, crisis mode |
| 6 | **Cars** — how many; then type (sedan · SUV/crossover · truck · van · motorcycle) and fuel (gas · hybrid · electric) | tiles | all car costs |
| 7 | **Miles a day** — Under 5 · 5–15 · 15–30 · 30+ | tiles | fuel, maintenance |
| 8 | **Credit cards you owe money on** — 0 · 1 · 2 · 3+ | tiles | debt minimums |
| 9 | **Loans you're paying off, not counting your car** — 0 · 1 · 2 · 3+ | tiles | debt minimums |

**Dropped:** `cooksAtHome`. Income band selects the USDA plan tier instead — one less question, same result.

**Note on Q9's wording:** "not counting your car" is load-bearing. Car payment is its own field on Screen 2; without the qualifier the estimate double-counts several hundred dollars.

---

## 3. Entry branch

Before Screen 1:

> **Do you already have an emergency fund?**
> → **No** → full flow (Screen 1)
> → **Yes** → *"Want to check whether your goal is still the right size?"*
>   → **Check it** → full flow
>   → **I'm good** → *"What's your target?"* [ $____ ] → goal created, flow skipped

The "I'm good" path must still create a tracked goal object. A two-tap path to a real goal for confident users is a good outcome; an exit that leaves nothing behind is not.

---

## 4. Data model vs. input rows

The **categories** are the data model. **Input rows** on screen are finer-grained and sorted by recall, so some categories split across screens.

| Category | Input row(s) | Screen | Source |
|---|---|---|---|
| Housing | Rent · Mortgage (both enterable, summed) | 2 | user |
| Transportation — fixed | Car payment · Public transportation (both enterable, summed) | 2 | user |
| Utilities | Home utilities (water, gas, electricity) | 3 | estimated |
| Utilities | Phone and internet (combined) | 3 | estimated |
| Food | Groceries | 3 | estimated |
| Transportation — running | Car costs (fuel/charge + insurance + upkeep, **one box**) | 3 | estimated |
| Debt | Card and loan minimums | 4 | estimated |
| Medical | Medical | 4 | estimated |
| Housing — extras | Property tax · Home insurance · HOA/condo fee | 4 | conditional |
| — | Anything else | 4 | user, default $0 |

**Removed from the expense rows:** dining out (§6.3), the buffer category (now a percentage on the goal screen, §8), and "Unemployed Insurance" (now a crisis factor, §6.5).

**Debt rule:** minimum payments only, never what the user currently pays. A user paying $800/mo against a $180 minimum would overstate the target by thousands.

---

## 5. The adjustment control

Every estimated row uses one control:

```
Home utilities, including water, gas, and electricity
Based on a 3-bedroom house in 60614 with 4 people.     ← BLACK text, directly above the box
$210  a month                                           ← tap to type, number pad, no cents
[ − 10% ]  [ + 10% ]
```

- Description line is **black, not gray**, sentence case, one line, always in the form **"Based on [drivers]."**
- Percentage steppers rather than fixed dollars, so one control works on a $2,195 housing figure and a $60 phone bill alike.
- No dollar sliders anywhere.

**Description strings:**

| Row | Line |
|---|---|
| Home utilities | Based on a 3-bedroom house in 60614 with 4 people. |
| Phone and internet | Based on 3 phone lines plus home internet. |
| Groceries | Based on 2 adults and 2 kids. Groceries only — eating out isn't part of a safety net. |
| Car costs | Based on one gas SUV in 60614, including fuel, insurance, and upkeep. |
| Medical | Based on 4 people covered through work. |
| Card and loan minimums | Based on 2 credit cards and 1 loan. |
| HOA, condo, or housing fee | A regular fee your building or neighborhood charges just for living there — not money you spend fixing your own place. |

---

## 6. Estimation rules

All rate tables live in data files and are pulled at build time, following the existing `scripts/build-cost-of-living.py` pattern. **Figures below are anchors, not researched constants — refresh them from source at build.**

### 6.1 Utilities

```
power   = kWhByHomeType × nationalCentsPerKwh ÷ 100
water   = waterByHomeType
utilities = (power + water) × colMultiplier["Utilities"]
```

`colMultiplier` already carries EIA state electricity prices. **Do not reach for `state.utilitiesRatio` inside the model** — that squares the adjustment. This bug already existed once and produced a 65% overstatement in Los Angeles.

### 6.2 Phone and internet

Combined into one row. Both are priced nationally — **never apply a cost-of-living multiplier.**

```
lines = adults + kids aged 13+          (cap 5)
phone = phonePerLine × lines             (per-line price declines with line count)
internet = flat national (~$75)
```

The old `min(householdSize, 4)` billed toddlers a phone line. Ages from onboarding Q3 fix it.

### 6.3 Groceries

USDA Cost of Food at Home, summed per person by age and sex bracket, with the USDA household-size economy adjustment. Plan tier (Thrifty / Low-cost / Moderate) selected by income band.

**Dining out is excluded from the ESF entirely** — it isn't a survival expense, it inflates the target, and it's the category where current and crisis differ most. It stays in the budget tool.

### 6.4 Car costs — one combined box

```
fuel (gas) = milesPerDay × 30.4 × (stateDollarsPerGallon ÷ mpgByVehicleType)
fuel (EV)  = milesPerDay × 30.4 × 0.30 kWh/mi × stateCentsPerKwh ÷ 100
upkeep     = milesPerDay × 30.4 × $0.10/mi        (AAA; includes tires and repairs)
insurance  = stateAvgFullCoverage ÷ 12 × vehicleTypeMod × multiCarFactor
```

MPG anchors: sedan 32 · SUV/crossover 26 · van 22 · truck 20 · motorcycle 45 · hybrid 48.

**Insurance is not mileage-driven.** State is the dominant term — roughly a threefold spread from Maine to Louisiana — and that variation tracks state regulation and loss costs, not general cost of living. Source it from **NAIC state averages**, the same way housing follows Zillow and utilities follow EIA. Vehicle type moves it ~±15%.

**Multi-car factor, not multiplication:** 1 car = 1.0 · 2 cars = 1.8 · 3+ = 2.5. Multi-car discounts are real.

Use full-coverage averages. It errs high, which is correct for a safety net, and avoids needing a vehicle-age question.

**Do not apply crisis driving assumptions here.** Screen 3 captures *what you spend now* — that's the left card on §7. The reduction belongs in the crisis factors (§9).

### 6.5 Medical

**Current mode:**

| Coverage | Estimate |
|---|---|
| Through my job | payroll deduction ≈ $115/mo single, $525/mo family |
| I buy it myself | unsubsidized marketplace premium (below) |
| Medicaid or Medicare | low premium + out-of-pocket baseline |
| No coverage | out-of-pocket baseline only |

Plus a per-person baseline for visits, prescriptions, and dental.

**Crisis mode — employer coverage only:** replace the payroll deduction with an unsubsidized benchmark silver plan.

```
crisisPremium = benchmarkSilver(ratingArea) × Σ ageFactor(each household member)
```

ACA age curve (public, standard): 21 = 1.0 · 40 ≈ 1.28 · 50 ≈ 1.79 · 60 ≈ 2.71. Children under 21 = 0.765, and **only the three oldest children count**. CMS publishes benchmark premiums by rating area, reachable from ZIP.

Two adults around 40 with two kids lands near **$1,700/mo**, consistent with the employer-share figures (employers quietly pay ~$625/mo single, ~$1,610/mo family).

**Honesty requirement in the explanation text:** unsubsidized is deliberately conservative. Someone whose income drops to near zero usually qualifies for large subsidies. Conservative is right for a safety net, but don't imply it's the only outcome.

### 6.6 Debt minimums

```
minimums = creditCards × $60 + loans × $250
```

$60 per card, not $140 — that was a household-level figure. Per card it's about 2% of a typical per-card balance, floored at $35. Default $0 when both counts are zero.

### 6.7 Property tax

```
estimate = countyHomeValue (Zillow ZHVI) × countyEffectiveTaxRate ÷ 12
```

Effective rates run ~0.3% (Hawaii, Alabama) to ~2.2% (New Jersey, Illinois), published at county level.

**Default to $0 and require the user to opt in.** About four in five mortgages escrow taxes, so a pre-filled figure would double-count for most owners, and a pre-filled number is more likely to be accepted without thought than an empty one. This is the one deliberate exception to the err-high rule: the double-count error ($305/mo × coverage) exceeds the omission error, and the minority who pay separately know they write that check.

```
Property tax
Most mortgage payments already include this.
[ I've counted it ]  [ Add it — about $305 a month ]
```

Same treatment for **home insurance** (owners; also commonly escrowed).

### 6.8 HOA, condo, or housing fee

**Do not estimate from ZIP.** HOA fees are bimodal and driven by property *type*, not location — most houses have none or a token amount, condos and townhomes almost always carry $300–600, amenity-heavy buildings exceed $1,000. A ZIP-based estimate hands a house owner in a condo-heavy ZIP a fee they don't pay.

Branch on onboarding Q4:

| Q4 answer | HOA row |
|---|---|
| Renting | hidden |
| House 2–3BR / 4+BR | shown, default $0 |
| Condo or townhome | pre-filled ≈ $350 × housing cost multiplier (Zillow-based) |

---

## 7. Screens

### Screen 1 of 4 — The ones you already know

> ### Money for a bad surprise
> Lose your job. Car breaks. Trip to the hospital. This money pays your bills so you don't have to borrow.
>
> **What you'll do:** Add up what you spend in a month. We'll do the rest.

Shown on step 1 only; a "What's this for?" link in the header reopens it later.

| Row | Starts as |
|---|---|
| Rent | blank |
| Mortgage | blank |
| Car payment | blank |
| Public transportation | blank |

Both housing fields and both transport fields are enterable and summed — people can have a mortgage and pay rent, or a car payment and a transit pass. Not a segmented either/or.

Housing label: *"Your mortgage, property tax, home insurance, and HOA if you pay one."*

Plaid offer sits at the top, secondary styling:

> **Want us to fill this in for you?**
> Connect your bank and we'll find these numbers. It takes about a minute.

Running total pinned. Label it **"What you spend so far"** — not "left over each month," which is budget framing and tells people the goal is to fill a bar.

### Screen 2 of 4 — Keeping things running

All estimated. Pure confirming.

Home utilities · Phone and internet · Groceries · Car costs

A user who accepts every estimate taps Continue once.

### Screen 3 of 4 — Living-related expenses

Card and loan minimums · Medical · Property tax · Home insurance · HOA · Anything else

### Screen 4 of 4 — Pick your number ⟵ *the experiment*

```
Which number do you want to save toward?

┌─────────────────────────────┐   ┌─────────────────────────────┐
│ What I spend now            │   │ If my pay stopped           │
│ $2,745 a month              │   │ $3,180 a month              │
│ Everything you pay today.   │   │ Some costs drop, some rise. │
└─────────────────────────────┘   └─────────────────────────────┘

[Why are these different?]
```

- **Neither card is pre-selected.** The only forced tap in the flow, justified because the choice *is* the experiment — a default would bias the result.
- **Instrument this tap:** which card, whether the explanation was opened, whether they switched before committing. This is the prototype's primary output.
- *"Why are these different?"* expands in place: *"We lowered driving — you wouldn't be commuting. We raised medical — your work insurance would end."*

---

## 8. Set my goal

```
$19,140

Months of expenses covered        [3 months] [6 months] [9 months]
Typical amount of coverage. May be appropriate for homeowners and families.

Breathing room for surprise costs
Extra [+10% ▾]     That adds  $1,740

Already saved                     [ $0 ]
That leaves $17,400 to go. You've got about 1.2 months covered today.

Target date: September 2028
That works out to $800 a month. Move the date and this moves with it.

[ Set my goal ]
```

**Coverage recommendation** is stated, not asked — the appropriate tile is pre-selected with a reason (household of 1 with no dependents → 3 months; otherwise → 6). The user may override to 9. Income type is not a factor in this version.

**Buffer is a percentage here, not an expense row.** Applied after coverage months.

**Already saved** defaults to $0 and is optional. Surface **runway** — *"about 1.2 months covered today"* — which is a stickier number than a dollar gap and costs nothing extra.

**Target date defaults to 24 months out.** Six months on a target this size implies $3,190/mo, which nobody can do. Monthly contribution updates live as the date moves.

**Language discipline:** "6 months" means two different things in this feature. Never show the bare number twice unlabeled. Always **"Coverage: 6 months of expenses"** and **"Target date: September 2028."**

**Round the target to the nearest $500.** $19,140 reads as falsely precise when every input was an estimate; $19,000 signals "estimate" without a disclaimer.

---

## 9. Calculations

```
monthlyBasis   = Σ (input rows, current or crisis)
target         = monthlyBasis × coverageMonths × (1 + bufferPercent)
remaining      = target − alreadySaved
monthlyPayment = remaining ÷ months to target date
runwayMonths   = alreadySaved ÷ monthlyBasis
```

**Crisis factors — prototype placeholders, not validated.** Keep them in a single config object so they change without touching the flow.

| Row | Factor |
|---|---|
| Housing (rent/mortgage) | 100% |
| Car payment / transit | 100% |
| Home utilities | 100% |
| Phone and internet | 100% |
| Groceries | 100% |
| Car costs — fuel and upkeep | **50%** |
| Car costs — insurance | **100%** |
| Card and loan minimums | 100% |
| Medical | replace employer deduction with unsubsidized marketplace premium (§6.5); otherwise 100% |
| Property tax / home insurance / HOA | 100% |

Splitting fuel/upkeep from insurance is more accurate than a single 70% on the category, now that the components are separable.

**Sanity check:** if `monthlyBasis` exceeds stated monthly income, don't silently produce a goal. One soft line: *"That's more than you told us you earn. Want to check these?"*

---

## 10. Data sources

Static tables in the repo, regenerated at build time. Never a live API call.

| Category | Source |
|---|---|
| Regional price levels | BEA Regional Price Parities |
| Housing costs | Zillow ZORI / ZHVI by county |
| Electricity and gas prices | EIA state averages |
| Groceries | USDA Cost of Food at Home |
| Car operating cost | AAA cents-per-mile |
| Car insurance | **NAIC state average premiums** |
| Health insurance — employer | KFF Employer Health Benefits Survey |
| Health insurance — marketplace | CMS benchmark silver premiums by rating area |
| Property tax | County effective tax rates (Census ACS / Tax Foundation) |

---

## 11. Confidence and the range

Every input row carries a state: **entered / estimated / adjusted**.

While any row is still an untouched estimate, show the target as a range:

> **Your goal: about $18,500 – $20,000**
> You've filled in 3 of 9. The more you check, the sharper this gets.

Snaps to a single number when all rows are entered or adjusted. Estimated values are visually distinguished from user-set ones. Each untouched row can become a quest: *"Check your power bill this week and update it."*

---

## 12. Persistence and editing

- **The expense set is a saved object, not wizard output.** It lives on after the fund is created and is reused by other modules. Build it as shared state, not ESF-local data.
- A permanent **"Your monthly expenses"** summary — all rows on one scrolling list, each tappable — is the return path. The four-screen split is first-run only; editing later must not replay the wizard.
- Editing any row recalculates with a small note: *"Your goal went up $900."*
- The user can switch between the current and crisis basis after committing — **log that switch too.**
- **Save continuously and resume mid-screen.** Never tell users nothing is saved; say the opposite: *"We'll keep what you've entered."*

---

## 13. Open risks

1. **The two cards may not differ enough.** For a renter with no car and no employer coverage, current and crisis are nearly identical — the choice you're measuring becomes meaningless. Run all nine test profiles through the factors and check the gap before testing. If some come out flat, you need more categories that move in crisis, or a different framing for those users.
2. **Childcare is deliberately excluded.** For households with kids under 12 it's often the second-largest expense after housing, but it largely disappears in a job loss. Excluded from the ESF basis for the same reason as dining out; flagged for the budget tool. This is a decision, not an oversight.
3. Crisis factors and the marketplace premium model are unvalidated placeholders.
4. Rate tables are anchors quoted from memory in spec drafting — verify each against source at build.

---

## 14. Out of scope

- Where the money is held — the user's decision, not the tool's
- The education layer
- Validating the crisis factors
- Income type as a coverage driver
- Withdrawal and replenishment flows — needs a follow-up spec. A fund that gets used is the fund working, and users need a path that doesn't read as failure.

---

## 15. Suggested build order

1. Onboarding questions 3–9 and the profile object they write to.
2. The estimation modules (§6) with stubbed rate tables — no UI.
3. Screens 1–3 with the shared adjustment control.
4. Screen 4, the goal screen, and the event logging.

**Before writing code:** reconcile this spec against the repo's existing `help-me-out.js` models, `peer-benchmarks.json`, and `zip-cost-of-living.json` — most of §6 already exists there in some form and should be extended, not rebuilt.
