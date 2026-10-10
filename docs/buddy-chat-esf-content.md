# Buddy Chat — Question Sets and Copy

**Status:** **Built.** This is the copy as shipped on `HoffDemo-Chat`, not a
draft to implement.
**Companion to:** `buddy-chat-esf-spec.md` (behaviour, panel, D26)
**Scope:** every row on ESF steps 2–5
**Lives in:** `data/buddy-esf.json` (copy) and `data/emergency-fund.json`
→ `lifestyleModifiers` (the multipliers)
**Revised:** 2026-09-20, as a record of what was built

All of it sits behind the **D26 advice deflect** — Buddy states facts and stops.

Reading level: 5th grade. One idea per sentence. No sentence over 20 words.

> **Known imperfect.** Owner: *"the chat experience is way too wordy, but I'm
> good with it for now."* A tightening pass is outstanding and is a job of its
> own.

---

## 0. Two voice rules that override everything below

### Buddy never calls a cost high

**Owner's ruling, 2026-09-19:** *"buddy should not say this looks high on
purpose. it should explain facts and not call attention to high costs."*

This **reverses** the original content doc, which built §2.4 around exactly that
opener. Calling attention to a cost is a short step from suggesting something be
done about it.

The test: **composition and consequence are facts; magnitude is commentary.**

| ❌ Cut | ✅ Kept |
|---|---|
| "This one looks high on purpose" | "Your health cover comes through your job." |
| "Insurance is the big one" | "Insurance is the largest part of it." |
| "That costs more" | "This row is what your own plan would cost." |
| — | "Counting them twice would make your fund bigger than it needs to be." |

### Shared costs are YOUR SHARE only

**The original doc had this backwards** and it was the most expensive error in
either document. See §1 Rent.

---

## Prototype data rule

**Owner's ruling:** *"it doesn't really matter. It can just say this is the price
in your area and can be completely fake. It's a prototype showing what could be
done."*

**Any figure Buddy needs that the model can't supply is invented, plausible, and
phrased as local.** The interaction is what's being tested, not the arithmetic.

Two limits, and they are not arbitrary:

1. **Invented figures go in `data/emergency-fund.json`**, marked
   `"_prototype": true`. A literal buried in a model is invisible; a flagged
   entry in the data file is a to-do somebody can find.
2. **It does not license a wrong number the user can already see.** A confident
   explanation under an obviously broken figure is a tester losing trust in the
   dog.

> The three model defects that blocked this content (D1 utilities 2.6× too high,
> D3 car insurance, D4 `carRunning` dead branch) were **all fixed in `8c7a252`**
> before this work started. Nothing here is blocked on the model any more.

---

## 1. Two shapes, not three

The original doc specified three mechanics. **Two were built.**

| Shape | What it does | Rows |
|---|---|---|
| **Explain** | Says what belongs in the row and what to take out elsewhere. No maths. | All of step 2, all of step 4, all of step 5 |
| **Lifestyle multiplier** | Questions whose answers scale the estimate already on screen. Mid option = 1.00 | All five rows of step 3 |
| ~~Calculator~~ | ~~Questions feeding the model's own inputs~~ | **Not built** — see below |

### Why the calculators became multipliers

The original doc had phone, car and debt as calculators exposing
`esfConnectivity()` and `esfCarCosts()` inputs. Phone and car shipped as
**multipliers** instead.

**Owner's correction during the build** settled it: *"all the questions on this
page should be lifestyle questions that the user is asked and they respond to.
these are not explaining how to calculate, they are explaining what is calculated
and can help the user get the right number."*

One mechanic for the whole screen is also simply better — a multiplier can never
disagree with the dropdown beside it (spec §4), and mixing two mechanics on one
screen was flagged in the original doc as "the main risk in the build."

**Debt is still genuinely calculator-shaped and is unbuilt.** It is the one row
with no estimate behind it, so there is nothing to multiply.

---

## 2. Step 2 — Housing and Car Payments

*(`state.esf.step === 1`, screen id `fixed`)*

Blank typed fields. No estimates, so nothing to adjust. This screen carries the
**three double-count traps** — the highest-value content in the feature.

### Question list

```
What can I help with?
  Rent                    ›
  Mortgage                ›
  Car payments            ›
  Public transportation   ›
  Should I fill in both?  ›
```

### Rent

> Rent is what you pay your landlord each month.
>
> **Put in your share only. If you split it with someone, count what comes out
> of your pocket.**
>
> Include parking or storage if they are on the same bill.
>
> If your rent covers utilities, say so — I'll help you skip them later.

`[ My rent covers utilities ]` `[ It doesn't ]`

> **⚠ THIS REVERSES THE ORIGINAL DOC**, which said *"Put in the whole payment,
> even if you split it with someone."*
>
> An emergency fund covers what **this person** has to keep paying, and a
> roommate's half is not that. On a $2,400 flat split two ways, the old wording
> overstates the monthly figure by $1,200 and a six-month target by **$7,200** —
> the same direction as the double-count traps this feature exists to catch, and
> larger than any of them.

**If it covers utilities:**

> Got it. On the next screen, set Home utilities to $0.
>
> You already paid for them here. Counting them twice would make your fund
> bigger than it needs to be.

**If it doesn't:**

> Good — then fill in Home utilities on the next screen. I'll have an estimate
> ready for you.

*Sets `rentIncludesUtilities`. Effect: zeroes `power` on step 3 with a tappable
note in place of its "Based on" line.*

### Mortgage

> Your mortgage is what you send the bank each month.
>
> Most people's payment also covers property tax and home insurance. That is
> called escrow.
>
> If yours does, include the tax and insurance in what you enter.
>
> **Splitting the payment with someone? Count your share only.**

`[ Mine includes tax and insurance ]` `[ Mine is just the loan ]` `[ I'm not sure ]`

> **Escrow comes BEFORE the share line, deliberately.** Escrow is the
> double-count trap and the reason this entry exists; the split is a qualifier on
> the amount. Reversing them buries the trap under a caveat that applies to
> fewer people.
>
> **"Include the tax and insurance in what you enter"** replaced *"put the whole
> payment in"*. Once rent says "your share only", *"whole payment"* reads as
> contradicting it — two different senses of "whole" two entries apart.

**Includes:**

> Then you are done with those. On the Living-related Expenses screen, leave
> Property Tax and Home Insurance alone. You have already counted them here.

**Just the loan:**

> Then add Property Tax and Home Insurance on the Living-related Expenses
> screen. I'll have estimates ready for you.

**Not sure:**

> Look at your mortgage statement. If it lists "escrow" or shows tax and
> insurance broken out, they are included.
>
> About 4 out of 5 mortgages include them. If you cannot check right now, assume
> yours does.

Then a second level: `[ Then mine probably does ]` `[ I'll check later ]` — so
"not sure" still reaches a disclosure rather than dead-ending.

### Car payments

> This is just your car loan or lease payment. Nothing else.
>
> Not gas. Not insurance. Not repairs. Those come on the next screen.
>
> Paying off two cars? Add them together. **Sharing one? Count your share only.**

`[ My lease includes maintenance ]` `[ It doesn't ]`

> **The share line is ONE CLAUSE here**, against rent's two sentences and
> mortgage's own line. Owner's read: a split car payment happens far less often,
> and every line in this panel is read by everybody — a caveat that applies to
> few people should not cost the same space as one that applies to most.

### Public transportation

> What you spend getting around without a car. Bus, train, subway.
>
> Use your monthly pass. No pass? Add up a normal month of fares.
>
> Rideshare counts too if you use it to get to work or the store.

### Should I fill in both?

> Usually no. Most people pay rent or a mortgage.
>
> Fill in both only if you really pay both. That happens when you own a home but
> rent somewhere else for work.
>
> Or you own a mobile home and rent the land it sits on.
>
> Or you own a place you rent out, and rent where you live.

---

## 3. Step 3 — Keeping things running

*(`state.esf.step === 2`, screen id `utilities`)*

**All five rows ask lifestyle questions.** These rows open on an estimate, so
saying what the row covers is the setup, not the answer.

Their opening copy is short by design — what the row covers, then the offer. The
questions do the work.

Multipliers live in `data/emergency-fund.json` → `lifestyleModifiers`, flagged
`"_prototype": true`. **Every value is invented**, reasoned rather than random;
what has to survive a tester saying "that seems about right" is the *direction
and relative size* of each.

**The mid option is always exactly 1.00.** Asserted in-browser: answering every
question with the middle option returns the base to the dollar on all five rows.

### 3.1 Home utilities

> This is your water, gas and electricity, all in one figure.
>
> Not sure? I can ask three quick questions and calculate it.

**Q1 — When is someone usually home?**

| Option | `short` | × |
|---|---|---|
| Someone's home all day | with someone home all day | 1.18 |
| It's a mix | with people in and out | 1.08 |
| Mostly mornings and evenings | out most of the day | **1.00** |

**Q2 — Do you run heat or air conditioning?**

| Option | `short` | × |
|---|---|---|
| Most of the year | running heat or air most of the year | 1.25 |
| Just summer, or just winter | heating or cooling one season | **1.00** |
| Hardly ever | hardly using heat or air | 0.82 |

**Q3 — How often do you cook at home?**

| Option | `short` | × |
|---|---|---|
| Most nights | cooking most nights | 1.06 |
| A few times a week | cooking a few times a week | **1.00** |
| Hardly ever | hardly cooking | 0.95 |

> Q1 and Q2 move the figure because heating and cooling are the biggest slice of
> a power bill; Q3 barely moves it because an oven is a small share. **The
> relative size of the three is the part a tester will judge.**

### 3.2 Phone and internet

> This is your phone bill and your internet bill together.
>
> I counted a line for every adult and teenager in your household.
>
> If that is not right, let me ask you about it.

**Q1 — How many phone lines are on your bill?**

| Option | `short` | × |
|---|---|---|
| Just one | one phone line | 0.58 |
| Two | two lines | 0.79 |
| Three | three lines | **1.00** |
| Four | four lines | 1.17 |
| Five or more | five or more lines | 1.32 |

> **Not linear**, because carriers charge less per line as lines are added.
> Three is the mid option because the opening estimate counts a line per adult
> and teenager, which lands near three for a typical household.

**Q2 — What kind of plans are they?**

| Option | `short` | × |
|---|---|---|
| Unlimited data | on unlimited data | **1.00** |
| A mix | on a mix of plans | 0.90 |
| Smaller data plans | on smaller plans | 0.80 |
| Basic phones, no data | on basic phones | 0.62 |

**Q3 — What about home internet?**

| Option | `short` | × |
|---|---|---|
| A fast plan | with a fast internet plan | 1.12 |
| A basic plan | with a basic internet plan | **1.00** |
| I don't have one | with no home internet | 0.72 |

> **Named providers were dropped.** The original doc had a provider list
> (Xfinity, Sonic, T-Mobile…) keyed loosely by region. That is calculator
> shape — it supplies a price rather than scaling one — and it needed a
> `providersByRegion` table that does not exist. Plan tier carries the same
> signal with no invented price list to maintain. **Restoring it is a data
> addition, not a rebuild**, if the provider-recognition effect turns out to
> matter in testing.

### 3.3 Groceries — the owner's worked example

> Groceries means food you cook and eat at home.
>
> Not restaurants or takeout. Those are not part of an emergency fund.
>
> Not sure what you spend? I can ask how you shop and calculate it.

**Q1 — How often do you shop for food?**

| Option | `short` | × |
|---|---|---|
| Most days | shopping most days | 1.15 |
| Three or four times a week | shopping three or four times a week | 1.08 |
| Once or twice a week | shopping once or twice a week | **1.00** |
| Every two weeks | shopping every two weeks | 0.95 |
| About once a month | shopping about once a month | 0.90 |

**Q2 — Where do you shop most?**

| Option | `short` | × |
|---|---|---|
| Warehouse clubs (Sam's, Costco) | at warehouse clubs | 0.85 |
| Value stores (Walmart, Aldi) | at value stores | 0.90 |
| Regular grocery stores (Kroger, HEB) | at regular grocery stores | **1.00** |
| Higher-end stores (Whole Foods) | at higher-end stores | 1.30 |

**Q3 — Is anyone eating differently?**

| Option | `short` | × |
|---|---|---|
| No, we all eat the same | everyone eating the same | **1.00** |
| Someone has a special diet | with a special diet in the house | 1.12 |
| We buy a lot of organic | buying a lot of organic | 1.15 |

> **Store names are in the labels on purpose.** "Mid-tier grocery" doesn't land
> at a 5th-grade reading level; "Kroger" does.
>
> **`short` is why every option carries two strings.** The label is written to be
> recognised in a list, brackets and all; `short` is the same option worded for
> mid-sentence. Lowercasing the label instead turned *Whole Foods* into *whole
> foods*.

**Worked result, verified live:**

> shopping once or twice a week, at higher-end stores, buying a lot of organic —
> I'd put you around **$805** a month.
>
> `[ Use $805 ]` → row dropdown becomes **$800 – $900**

### 3.4 Medical

**Two answers, because the row is built two ways.** Resolved by the
`employerCoverage` variant (spec §5).

**If cover comes through work** — the row is a replacement premium:

> Your health cover comes through your job.
>
> If the job stops, that cover stops with it.
>
> So this row is what your own plan would cost, not what comes out of your
> paycheck today.

`[ That makes sense ]` `[ I already buy my own insurance ]`

**If they already buy their own** — the row is ordinary out-of-pocket costs:

> This is insurance, copays, prescriptions, dental and vision.
>
> You already buy your own plan, so this number does not change if a job goes
> away.
>
> Put in what you actually pay.

`[ What counts here? ]`

> **⚠ THIS REVERSES THE ORIGINAL DOC TWICE.**
>
> **1. The "looks high on purpose" opener is cut** (§0).
>
> **2. Medical now has questions.** The original said "no lifestyle questions —
> how often you see a doctor does not move a premium." That reasoning is right
> and is preserved: **Buddy does not ask about doctor visits.** But two things
> genuinely do move the figure and neither is already in the model.
>
> **3. One variant is not optional.** For somebody without employer cover,
> `esfReplacementPremium()` is 0 and the row is ~$165. The original copy — "your
> job pays most of your health insurance" — sat above that number and
> contradicted it. **An explanation that does not match the figure beside it is
> worse than none.**

**Q1 — What kind of plan would you buy?**

| Option | `short` | × |
|---|---|---|
| Better coverage, less to pay at the doctor | on better coverage | 1.25 |
| Something in the middle | on a mid-level plan | **1.00** |
| The cheapest one, more to pay at the doctor | on the cheapest plan | 0.80 |

**Q2 — Does anyone need care all year round?**

| Option | `short` | × |
|---|---|---|
| Someone sees a specialist | with someone seeing a specialist | 1.15 |
| Someone takes regular medication | with someone on regular medication | 1.08 |
| No, nothing regular | with nobody needing regular care | **1.00** |

> **Household size and age are deliberately absent.** The estimate already prices
> the ages in the household — asking again would count them twice. Any question
> added here must be checked against what the model already knows.

### 3.5 Car costs

> This is fuel, insurance and upkeep.
>
> Not your car payment — that was the last screen.
>
> **Insurance is the largest part of it. It does not change with how far you
> drive.**

`[ I don't own a car at all ]` → sets `noCarAtAll`, zeroes the row

**Q1 — How far do you drive on a normal day?**

| Option | `short` | × |
|---|---|---|
| More than 60 miles | driving more than 60 miles a day | 1.70 |
| 40 to 60 miles | driving 40 to 60 miles a day | 1.45 |
| 20 to 40 miles | driving 20 to 40 miles a day | 1.22 |
| 10 to 20 miles | driving 10 to 20 miles a day | **1.00** |
| Under 10 miles | driving under 10 miles a day | 0.85 |
| I don't drive much at all | hardly driving | 0.62 |

> **It never reaches zero, and that is the point.** Insurance is most of this row
> before a wheel turns, so driving nothing still costs most of the middle answer.
> A tester who drives five miles a day and sees the figure barely move will
> assume the model is broken unless the copy says why — which is what the
> insurance line above is for.

**Q2 — What do you drive?**

| Option | `short` | × |
|---|---|---|
| A truck or van | in a truck or van | 1.28 |
| An SUV or crossover | in an SUV | 1.14 |
| A sedan | in a sedan | **1.00** |
| A small car | in a small car | 0.88 |

**Q3 — Gas or electric?**

| Option | `short` | × |
|---|---|---|
| Gas | running on gas | **1.00** |
| Hybrid | a hybrid | 0.88 |
| Electric | electric | 0.78 |

> **No mpg table and no kWh-per-mile figure.** The original doc's calculator
> needed both; a multiplier needs neither. The open item "EV running cost has no
> table" is resolved by not needing one.

---

## 4. Step 4 — Living-related Expenses

*(`state.esf.step === 3`, screen id `rest` — the original doc's "step 4 Debt" and
"step 4 Property tax" are the same screen)*

### 4.1 Credit card and loan minimums

**Explain only. The calculator is UNBUILT.**

> This is the smallest payment you must make each month. Not what you normally
> pay.
>
> If you lost your job, this is what keeps you out of trouble.
>
> Pick the row that sounds most like you.

The existing six-option dropdown (labelled combinations — "A loan, maybe a card
($250 – $350)") carries this row. It asks the user to **recognise their
situation** rather than convert it to a number, which is most of what the
calculator was for.

> **The four-question calculator from the original doc is still unbuilt** and is
> the largest outstanding piece of this content. It is the only row with no
> estimate behind it, so there is nothing for a multiplier to scale — it needs a
> genuinely new model. Its anchors (2% with a $35 floor, $250 per loan) are
> already in `emergency-fund.json`, flagged as "anchors to re-source at build".
>
> Owner's ruling if it is built: **the 2% rate is shown and editable.**

### 4.2 Property tax

> This is the tax on your home. It comes once or twice a year, so I ask for the
> yearly amount.
>
> First: is it already in your mortgage payment? Most are.

`[ It's in my mortgage ]` `[ I pay it separately ]` `[ I'm not sure ]`

**In the mortgage:** *(sets `mortgageIncludesEscrow`)*

> Then skip this row. You counted it on the housing screen.

**Separately:**

> Then add it here. I've worked out an estimate from typical home values where
> you live and your state's tax rate.
>
> Your tax bill has the real number if you want to check.

**Not sure:**

> Look at your mortgage statement. If it lists "escrow", your tax is in there.
> About 4 out of 5 mortgages include it.

> Note this row can **set the escrow disclosure too**, not just read it. A user
> who skipped Buddy on step 2 still gets the trap caught here.

### 4.3 Home insurance

> This protects your home.
>
> Like property tax, it is often inside your mortgage payment.
>
> Is yours?

`[ It's in my mortgage ]` `[ I pay it separately ]`

### 4.4 HOA and housing fees

> Some neighborhoods and buildings charge a monthly fee.
>
> It covers things like landscaping, trash or a pool.
>
> Houses usually do not have one. Condos and townhomes usually do.
>
> Not sure? You would know — it is a separate bill every month.

### 4.5 Anything else

> Anything you must pay every month that I have not asked about.
>
> Good examples: child support, alimony, a storage unit, care for a family
> member.
>
> Leave out anything you could stop. Streaming, gym, eating out. Those are not
> part of a safety net.

`[ What about childcare? ]`

> I leave childcare out on purpose.
>
> It is often the second biggest cost for a young family. But it mostly goes away
> if you lose a job.
>
> If you would still pay it, put it here.

---

## 5. Step 5 — the goal screen

*(screen id `esfPlan`)*

**Highest D26 risk in the feature.** Every response says what an option covers
and stops. No "most people", no "we suggest", no "safer".

### Months of expenses covered

> This is how long your fund would last if your money stopped.
>
> 3 months covers a short gap between jobs.
>
> 6 months covers a longer search, or a job in a smaller field.
>
> 9 months covers a long search, or work that comes and goes.
>
> You can change it whenever you want.

*Forbidden: "We recommend 6 months." That exact sentence was in the original ESF
spec header and was cut for D26.*

### Breathing room

> Emergencies bring costs nobody plans for. A car repair. A flight home.
>
> This adds a little on top of your monthly number.
>
> 10% on $2,800 a month adds about $280 to each month you are covered.

### Already saved

> Money you could reach tomorrow if you had to.
>
> Checking, savings, cash.
>
> Not retirement accounts. Taking money out of a 401(k) early costs you taxes and
> a penalty.

### Target date

> When you would like the fund finished.
>
> A later date means saving less each month. An earlier one means more.

### The headline number

> The big number is what is left to save. The smaller one underneath is the whole
> fund.
>
> They are different because you have already saved some.

---

## 6. Step 1 — the intro

Three entries, added in the build. The original doc had no intro content.

**What is an emergency fund?**

> It is money set aside for a bad month.
>
> A job loss. A big repair. Something you did not plan for.
>
> It sits in savings and you do not touch it otherwise.

**What will you ask me?**

> Four screens of questions about what you pay each month.
>
> First your home and car. Then the bills that keep things running. Then a few
> that only some people have.
>
> At the end I show you the number and how long it takes to save.

**How long does this take?**

> A few minutes.
>
> Most rows already have a number in them. I worked those out from where you live
> and who lives with you.
>
> You only change the ones that look wrong.

---

## 7. The data contract

```json
"<entryId>": {
  "label": "Rent",                    // list row AND the user's first bubble
  "row": "rent",                      // ESF row id; omit for a pure explainer
  "say": ["…", "…"],                  // one string per bubble
  "chips": [                          // answer choices, nestable one level
    { "id": "rentUtilsYes",
      "label": "My rent covers utilities",
      "sets": { "rentIncludesUtilities": true },
      "say": ["…"],
      "chips": [ … ] }
  ],

  // person-dependent copy — replaces say/chips when a variant resolves
  "variantOn": "employerCoverage",
  "sayIf":   { "employer": [...], "own": [...] },
  "chipsIf": { "employer": [...], "own": [...] }
}
```

Rules learned the hard way:

- **`label` is used twice** — as the list row and as the user's echoed bubble. It
  has to read as something a person would say.
- **A variant entry has NO `say` or `chips` key.** Every reader must go through
  `esfBuddySayFor()` / `esfBuddyChipsFor()`. Reading the raw key silently dropped
  every chip on the medical row.
- **`_note` and `_voiceNote` keys sit alongside real entries.** Iterate the
  `items` list, never `Object.keys(rows)`. (The repo-wide trap.)
- **Entries whose row is not visible are filtered out** — property tax never
  appears for a renter.
- **Echo the control's own words.** When the "Help me calculate this" button was
  renamed, the transcript still said "Help me work it out" and two rows offered
  to "work it out" in prose. A tapped control and the bubble it produces saying
  different things stops the transcript being a record of what the user did.

---

## 8. Still open

### Unbuilt

- **Debt calculator** — §4.1. The largest outstanding piece.
- **"Why that number?"** — `esfRowSource()` remains written and never called. It
  needs a voice pass: written as on-screen disclosure, not as something a dog
  says out loud.
- **Medical per-person table** — owner wants the age-factored breakdown shown
  with editable boxes. Needs a read-only `esfPremiumBreakdown()` in `js/esf.js`.

### Known imperfect

- **The copy is wordy.** Owner-acknowledged, deferred.
- **All multipliers are invented.** Directionally reasoned, not sourced.
- **"Peers shop mid-tier" is an assumption**, not a fact — peer benchmarks are
  population averages. Filed beside `valueDispersion: 1.35`.
- **Two verbatim "you must" strings** — *"the smallest payment you must make"*
  and *"anything you must pay"*. `CLAUDE.md` lists "you must" as a forbidden D26
  shape; these are definitional rather than prescriptive and are the owner's own
  words. **Unruled.**

### Resolved since the original doc

- ~~D1 utilities 2.6× too high — blocks §2.1~~ — fixed in `8c7a252`.
- ~~D3 car insurance copy wrong against code~~ — fixed in `8c7a252`.
- ~~D4 `carRunning` dead branch~~ — fixed in `8c7a252`.
- ~~Cross-screen disclosures are new plumbing~~ — built, four rules verified.
- ~~EV running cost has no table~~ — not needed; multipliers replaced the
  calculator.
- ~~Provider price list needs inventing~~ — dropped in favour of plan tier.
