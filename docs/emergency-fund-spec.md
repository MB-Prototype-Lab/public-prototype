# Emergency Fund (ESF) Tool — Feature Spec

**Status:** Confirmed for prototype build
**Scope:** Tool only. Education layer is owned separately.
**Date:** 2026-09-12

---

## 1. Outcome

Help a user arrive at a credible emergency fund target based on their real monthly survival expenses, and a monthly savings number to reach it — without requiring them to look up a single bank statement.

**Design principles for this feature**

1. **Nothing is a question if it can be an assumption.** State the assumption, give a one-tap correction. Every question in this flow is opt-in; none block progress.
2. **Sort by recall, not by topic.** Screens are grouped by how hard the number is to remember, so each screen has one consistent interaction mode and effort drops as the user moves through.
3. Never show a blank field for something a user can't recall.
4. Never ask a question before showing a number.
5. Everything that can come from onboarding does. The tool asks for nothing it could already know.
6. Let the user answer what they know now and sharpen it later.
7. All user-facing copy at a 5th-grade reading level.
8. Errors are asymmetric — for an emergency fund, guessing high is safe. Only intervene when a number looks too low.

**What this prototype is testing**

Whether users find the two-number framing valuable, and which number they choose as their goal. Accuracy of the underlying factors is explicitly *not* the question yet. Instrument the choice (§6) as the primary learning objective.

---

## 2. Inputs — all from onboarding

Assume these are present. The tool collects no profile information of its own.

- ZIP code
- Household size and number of dependents
- Rent or own
- Home size
- Income band
- Income type — captured but **not used** in this version

Two things onboarding won't have, both handled as assumptions rather than questions:

| Unknown | Assumption | Correction |
|---|---|---|
| Vehicle count | Not modeled. Row labels read *"Include all your cars."* | User adjusts the number |
| Health insurance source | Assume employer-provided (most common in target segment) | One-tap *"Not mine"* on the medical row |

---

## 3. Data model vs. input rows

The **seven categories** are the data model. The **input rows** on screen are smaller and sorted by recall, so two categories split across screens.

| # | Category | Input rows | Screen |
|---|---|---|---|
| 1 | Housing | Rent or mortgage | 1 |
| 2 | Utilities | Power, water, gas · Phone and internet | 2 |
| 3 | Food | Groceries | 3 |
| 4 | Debt | Card and loan minimums | 3 |
| 5 | Transportation | Car payment (screen 1) · Gas, insurance, upkeep (screen 3) | 1 + 3 |
| 6 | Medical | Premiums and care | 3 |
| 7 | Buffer | A little extra | 3 |

**Debt rule (important):** capture *minimum* payments, not what the user currently pays. An emergency fund covers survival, not payoff velocity. Using an $800/mo aggressive paydown instead of a $180 minimum overstates the target by thousands.

**Label rules — recall prompts cost zero taps:**
- Rent or mortgage: *"Your mortgage, property tax, home insurance, and HOA if you pay one."*
- Car payment and Gas/upkeep: *"Include all your cars."*

---

## 4. The adjustment control

Every pre-filled row uses the same control. One pattern, learned once.

```
Power, water, gas                      Where'd this come from?
$210  a month          ← tap to type, number pad, no cents
[ − 10% ]  [ + 10% ]
```

- **Typed value** for anyone who knows the number.
- **Percentage steppers** for anyone who just wants it higher or lower. Percentage rather than fixed dollars so one control works on a $2,195 housing figure and a $60 phone bill alike.
- **"Where'd this come from?"** expands in place to explain the estimate. A disclosure, never a question flow.

**Optional helpers — opt-in only.** Where a user genuinely can't guess, an unobtrusive link opens a recognition-style picker. Never a screen, never forced.

*Groceries — "Not sure? Help me pick":*
```
Which sounds most like you?
  Just me, I mostly cook          $350
  Just me, I eat out a lot        $550
  Two of us                       $700
  Family, four or more          $1,100
```

*Card and loan minimums — "Not sure? Help me pick":*
```
About how much do you owe on credit cards?  → $6,000
Most people pay about $180 a month on that.  [Use this]
```

No dollar sliders anywhere — they have no anchors and are hard to land on a value.

Every screen carries a pinned running total and a *Step N of 4* progress bar.

---

## 5. Expense capture — four screens

### Screen 1 of 4 — The ones you already know

> **The ones you already know**
> Your home and your car payment. These barely move month to month, so a real figure beats a guess.

| Row | Starts as |
|---|---|
| Rent or mortgage | **Blank** |
| Car payment | **Blank**, with [I don't have one] |

Pure typing. No estimates, no steppers, no helpers — these are the two numbers everyone knows, and leading with them buys an early win.

### Screen 2 of 4 — You probably know these

> **You probably know these**
> Close is fine. Nudge them until they feel about right.

| Row | Starts as |
|---|---|
| Power, water, gas | Pre-filled from ZIP + home size |
| Phone and internet | Pre-filled from household size |

Pure confirming. Steppers and typed override.

### Screen 3 of 4 — We'll take a guess

> **We'll take a guess**
> Most people don't know these off the top of their head, so we filled them in. Change anything that looks off.

| Row | Starts as | Notes |
|---|---|---|
| Groceries | Pre-filled | Opt-in "Help me pick" |
| Card and loan minimums | Pre-filled | Opt-in "Help me pick". Smallest payment, not what you usually pay |
| Gas, insurance, upkeep | Pre-filled | *Include all your cars* |
| Medical | Pre-filled | *We figured your job covers health insurance.* [Not mine] |
| A little extra | Pre-filled | Clothes, haircuts, small repairs, pets |

Pure confirming. A user who accepts every guess taps Continue once.

### Screen 4 of 4 — Bills that don't come every month

The catch-all. People reliably forget anything that doesn't arrive monthly, and this fixes both errors at once — the person who left property tax out, and the person who'd otherwise count it twice.

> **Almost done — bills that don't come every month**
> These are easy to miss. Tell us if you already counted them.

```
Property tax          about $450 a month    [I counted it] [Add it]
Home insurance        about $110 a month    [I counted it] [Add it]
HOA or condo fee      about $0              [I counted it] [Add it]
Car insurance         about $145 a month    [I counted it] [Add it]
Plates and tags       about $15 a month     [I counted it] [Add it]
Yearly subscriptions  about $25 a month     [I counted it] [Add it]
School costs          about $60 a month     [I counted it] [Add it]

[Nothing else to add]
```

- **Conditional rows only.** Renters never see property tax, home insurance, or HOA. No dependents means no school row. Most users see two or three rows.
- **Pre-selected by the low-number check.** Estimate expected full housing cost from ZIP + home size. If the figure typed on Screen 1 looks like a full escrowed payment, default to *I counted it*; if it looks low, default to *Add it*. A user whose entries were already right taps Continue and touches nothing.
- **Yearly figures accepted**, since that's the number people remember: *"How much is your bill for the year?"* → $5,400 → *"That's about $450 a month."* Show both.
- **Only flag low, never high.** Never challenge a number that comes in above expectation.

---

## 6. Pick your number ⟵ *the experiment*

Coverage is stated, not asked:

> **We recommend 6 months of expenses** — one income, two kids.  [Change]

Two cards. The user taps one to make it their goal.

```
Which number do you want to save toward?

┌─────────────────────────────┐   ┌─────────────────────────────┐
│ What I spend now            │   │ If my pay stopped           │
│ $16,470                     │   │ $17,220                     │
│ $2,745 a month × 6 months   │   │ $2,870 a month × 6 months   │
│ Everything you pay today.   │   │ Some costs drop, some rise. │
└─────────────────────────────┘   └─────────────────────────────┘

[Why are these different?]
```

- **Neither card is pre-selected.** The only forced tap in the flow, justified because the choice *is* the experiment — a default would bias the result.
- **Instrument this tap.** Log which card, whether the user opened the explanation, and whether they switched before committing. This is the prototype's primary output.
- *"Why are these different?"* expands in place:
  > We lowered getting around by 30% — you wouldn't be commuting.
  > We raised medical — your work insurance would end.

---

## 7. Your plan

- **Target date** defaults to **6 months from today**, adjustable. Monthly contribution updates live as the date moves, so the tradeoff is visible in one gesture.
- One optional, skippable question: *"Anything already set aside?"* → [Nothing yet] [$ amount] [Not sure]. "Nothing yet" and "Not sure" both assume zero.
- [ **Set my goal** ]

**Language discipline:** "6 months" means two different things in this feature and must never appear twice unlabeled on one screen. Always write **"Coverage: 6 months of expenses"** and **"Target date: March 2027."**

---

## 8. Calculations

**Coverage months**
- Household of 1, no dependents → **3 months**
- Otherwise → **6 months**
- User may override. Income type is *not* a factor in this version.

**Crisis adjustment — prototype placeholders, not validated**

These exist to make the two cards differ in a believable way. Not researched figures.

| Category | Factor |
|---|---|
| Housing | 100% |
| Utilities | 100% |
| Food | 100% |
| Debt (minimums) | 100% |
| Transportation | 70% |
| Medical | 100%, **plus** replacement premium if insurance is employer-provided |
| Buffer | 100% |

Replacement premium placeholder: +$450/mo individual, +$650/mo household.

Keep all factors in a **single config object** so they can change without touching the flow.

**Target** = (chosen basis: current *or* crisis) × coverage months

**Monthly contribution** = (target − starting balance) ÷ months to target date

---

## 9. Estimation data source

ZIP-level cost of living and peer spend come from a **static table built from national government data**, shipped with the prototype — no live API call. Structure it as a lookup keyed by ZIP (or ZIP→metro) returning per-category cost-of-living adjustment factors, applied to national category baselines indexed by household size and income band.

Because it's static, a JSON file in the repo is fine. Keep the lookup behind a single module so a live source can replace it later without touching the flow.

**For the prototype:** stub this with a handful of real ZIPs and obviously-placeholder baseline values. Do not build a data pipeline — the thing being tested is the two-number framing, not the accuracy of the estimates.

---

## 10. Plaid

Offered at the top of Screen 1 and again on the summary. Secondary styling — an offer, not a gate.

> **Want us to fill this in for you?**
> Connect your bank and we'll find these numbers. It takes about a minute.
> [Connect my accounts] · [I'll type them in]

When connected, every row arrives pre-filled from transaction history and the four screens become a confirmation pass rather than an entry task.

---

## 11. Confidence and the range

Every input row carries a state: **entered / estimated / adjusted**.

While any row is still an untouched estimate, the target displays as a range:

> **Your goal: about $13,000 – $15,500**
> You've filled in 3 of 7. The more you add, the sharper this gets.

When all rows are entered or adjusted it snaps to a single number. Estimated values are visually distinguished from user-set ones.

Each untouched row becomes a quest in the daily queue:
> "Check your power bill this week and update it."

---

## 12. Persistence and editing

- **The expense set is a saved object, not wizard output.** It lives on after the fund is created and is reused by other modules. Build it as shared state, not ESF-local data.
- A permanent **"Your monthly expenses"** summary — all rows on one scrolling list, each tappable — is the return path. The four-screen split is for first-run only; editing later shouldn't re-run the wizard.
- Editing any row recalculates the target with a small note: *"Your goal went up $900."*
- The user can switch between the current and crisis basis after committing — log that switch too.
- **Save continuously and resume mid-screen.** Someone will bail on Screen 3 to find a bill and must return to Screen 3. Never tell users nothing is saved — say the opposite: *"We'll keep what you've entered."*
- Re-prompt to review expenses when a new goal is created, or on a cadence.

---

## 13. Out of scope

- Where the money is held (user's decision, not the tool's)
- The education layer
- Validating the crisis factors or the replacement premium
- Income type as a coverage driver
- Withdrawal and replenishment flows — worth a follow-up spec; a fund that gets used is the fund working, and users need a path that doesn't read as failure

---

## 14. Suggested build order

Three passes, with a check-in after each:

1. The expense data model plus the estimation module with stubbed ZIP data — no UI.
2. Screens 1–4 with the shared adjustment control (§4).
3. The two-card choice, the plan screen, and the event logging (§6).

**Before writing code:** reconcile this spec against the repo's existing routing, state handling, and styling conventions, and raise anything this spec doesn't cover.
