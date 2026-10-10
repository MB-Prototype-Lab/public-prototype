# Buddy Chat in the Emergency Savings Fund — Feature Spec

**Status:** **Built** on branch `HoffDemo-Chat` (10 commits, branched off
`HoffDemo-ESF`). Verified in-browser, not just syntax-checked.
**Scope:** ESF only — the intro and capture steps plus the goal screen. Home
chat, onboarding and every other screen are explicitly out of scope and were not
touched.
**Depends on:** `emergency-fund-spec.md`, which this extends
**Supersedes:** the 2026-09-19 specification drafts of this file
**Revised:** 2026-09-20, as a record of what was built

> **Read this as a record, not a plan.** Where the build and the original
> specification disagreed, the build won and the reason is stated inline. Every
> such reversal was either an owner ruling or something that could only be found
> by running it. §11 lists what is still unbuilt.

---

## 0. What this is

A Buddy panel, opened from every ESF screen, that answers the question in front
of the user — by saying what a row covers and what to leave out of a later one,
or by asking a few questions about how they live and moving the estimate for
them.

**The user never *has to* type a dollar figure.** They answer questions and the
estimate moves.

> **Owner's clarification, and it matters:** the original spec said "the user
> never types a dollar figure in chat." The real rule is **never has to, not
> cannot**. The question tree must always be sufficient on its own; somebody who
> would rather type a number into the row is not blocked. Editable inputs are a
> legitimate escape hatch, never the only path.

### Where it lives

| Piece | File | Note |
|---|---|---|
| Panel model — state, navigation, disclosures, questions, logging | `js/buddy-esf.js` | 675 lines. No DOM. |
| Panel rendering — overlay, header, transcript, menu | `screens/buddy-panel.js` | 341 lines. No state. |
| Copy — per-screen question trees | `data/buddy-esf.json` → `BUDDY_ESF` | 460 lines |
| Lifestyle multipliers | `data/emergency-fund.json` → `lifestyleModifiers` | Figures live with figures |
| Styling | `css/components.css` | `.esf-buddy-*`, `.esf-ask` |
| Paint target | `#buddyRoot` in `index.html` | **Sibling** of `#screenRoot` |

The same model/render split `js/chat-router.js` and `screens/chat.js` already
use. **`chatRoute()` is untouched** and still owns the Home chat.

### Why the copy is NOT in `buddy-responses.json`

The original spec said that file "gains ESF entries." It does not, and should
not. `buddy-responses.json` is the **keyword matcher's** response library: one
message in, one response out. This is a **tapped tree** the user navigates.

Same dog, two different shapes. Folding one into the other would have meant one
shape pretending to be the other — so `data/buddy-esf.json` is its own file with
its own contract, wrapped by `scripts/wrap-data.sh` like everything else.

---

## 1. Buddy's role

Buddy is the financial coach. He gives the user what they need to decide, he does
not decide, and he supports whatever they choose.

**Owner's framing:** *"he isn't the decision-maker, he is the one you trust to
give you information to make your own decision, then is there for you whatever
that decision is."*

**D26** enforces this in code. `chatIsAdviceSeeking()` runs ahead of keyword
scoring with seventeen regex shapes. **Nothing here weakens that check.**

### He does not comment on the size of a number either

**Owner's ruling, 2026-09-19, and it overrides the original spec and content
docs:** *"buddy should not say this looks high on purpose. it should explain
facts and not call attention to high costs."*

Both original docs built a section around flagging the medical figure as high —
the opener was *"This one looks high on purpose."* **Cut.** Calling attention to
a cost is a short step from suggesting something be done about it, and the same
restraint that keeps him off advice keeps him off commentary.

| Cut | Kept |
|---|---|
| "This one looks high on purpose" | "Your health cover comes through your job. If the job stops, that cover stops with it." |
| "Insurance is the big one" | "Insurance is the largest part of it." |
| — | "Counting them twice would make your fund bigger than it needs to be." |

The last one stays because it describes **the consequence of an error**, not a
remark about a price. That is the line: composition and consequence are facts;
magnitude is commentary.

### Scope discipline

**Owner's ruling:** this is *"a pre-filled decision-tree framework if questions
are needed, or an explanation of assumptions that users can modify to calculate
what they think the right expense is. That's all this feature is for the
prototype in the ESF."*

Not a help desk. Not a knowledge base.

### The spine: stop the double-count

The ESF asks for expenses across four screens, and the same dollar can be
entered twice without the user ever noticing. Buddy's highest-value job is
telling them what belongs in a row **and what to take out of a later one.**

| Where | The trap | Built |
|---|---|---|
| **Rent → step 3** | Rent including utilities, then utilities again | ✅ |
| **Mortgage → step 4** | An escrowed payment, then property tax and home insurance again | ✅ |
| **Car payment → step 3** | A lease with maintenance included, then car running costs again | ✅ |
| **No car at all** | Running costs on a car nobody owns | ✅ |

### A fourth trap the spec missed, found in the build

**The rent copy was wrong, and expensively so.** The original content doc said
*"Put in the whole payment, even if you split it with someone."*

An emergency fund covers what **this person** has to keep paying. A roommate's
half is not that. On a $2,400 flat split two ways, the old wording overstates the
monthly figure by $1,200 and a six-month target by **$7,200** — same direction as
the three traps above, and larger than any of them.

The rule now applies to all three shared-cost rows, **weighted by how often the
split actually happens**, because every line in this panel is read by everybody:

| Row | Treatment |
|---|---|
| Rent | Two sentences |
| Mortgage | Its own line, *after* the escrow lines |
| Car payment | One clause appended to an existing line |

On mortgage the escrow lines stay **ahead** of the share line: escrow is the
double-count trap and the reason that entry exists; the split is a qualifier on
the amount. Reversing them buries the trap under a caveat.

---

## 2. The panel

### Behaviour — as built

1. Opens as an **overlay on top of the current screen**. The screen underneath
   stays rendered and visible.
2. **Fixed position, every time.** Same rectangle on every ESF screen — 76% of
   the frame, anchored to the bottom edge.
3. Closed with an **X at the bottom left**, away from the thumb's natural travel.
4. **One-handed.** Every control lives in the lower half.
5. **5th-grade reading level.**
6. **Options, never required typing.**

The ESF step header and progress pips stay visible above it, so the user never
loses where they are.

### Layout, as built

```
┌──────────────────────────────────────┐
│        Ask Buddy    🐶               │  header, 70px, centred pair
├──────────────────────────────────────┤
│                                      │
│   ▸ question list, or                │  SCROLLS
│   ▸ the conversation so far          │
│                                      │
├──────────────────────────────────────┤
│  [ answer ]  [ answer ]              │  context: answers, question
│                                      │  options, or the figure
├──────────────────────────────────────┤
│ [Back to list][Start over][Calculate]│  THE MENU — fixed, always 3
├──────────────────────────────────────┤
│  [ X ]   [ Or type a question… ]     │  X bottom-left, input INERT
└──────────────────────────────────────┘
```

### The header — three revisions, and why the last one won

| Version | Problem |
|---|---|
| Title left, dog right | Read as a label and a logo; the eye crossed the panel |
| Dog centred, title beneath | Made him unmissable and cost **~75px** of a panel only 3/4 of a phone tall — two bubbles' worth of transcript |
| **Title + dog centred as one group** | ✅ 70px, reads as him introducing himself |

**No subtitle.** It carried the open row's label, which the transcript already
says — the row's name **is** the first question, echoed as the user's own bubble
the moment they tap it. A header repeating it was the same word twice on one
screen.

The subtitle's one guard survives as a lesson: a long row label ("Credit card and
loan minimums") would have pushed the dog off the right edge, so text yields with
`min-width: 0` and an ellipsis, never the picture.

### Scrolling

**The panel scrolls. The ESF screens still do not.**

**Owner's ruling:** *"I want users to see each question they answered, otherwise
it's a lot of clicking to go back."*

A real accumulating transcript: every question and answer stays on screen,
stacked. The panel pins to the newest message via `esfBuddyMountHook()`.

Measured: no ESF screen scrolls at full frame height, with or without a
disclosure, before or after the footer gained a third button.

### Making it read as a chat

The first build was a correct transcript that looked like a list of notices. What
fixed it:

**Buddy's messages group into runs, with ONE avatar on the last bubble of a run**
and the bubbles above it tucked in. Three stacked paragraphs each wearing the
same face read as three people talking; one face under a run reads as somebody
finishing a thought. This is most of the difference between a chat and a notice
board.

### The inert input box

**Owner's ruling:** the *"Or type a question…"* box **stays on screen but is
inert.**

It says *this is a chat* at a glance, and removing it would hide the thing
testers said they wanted. It is inert because free text in a decision-tree
prototype tests the tree's coverage instead of the idea.

Renders with `disabled` and `aria-disabled="true"`, visibly greyed, `tabindex="-1"`.
Verified: **unfocusable, and the simulated keypad never opens from it.**

The **wrapper** carries the click handler, because a disabled input dispatches no
events — and that tap is the measurement. `chat_input_tapped` is the demand for
the real LLM.

---

## 3. Entry — the Ask button

### It is a footer button, NOT a floating pill

The original spec recommended a floating pill above the footer, on the grounds
that it costs zero vertical layout. **Built that way first, and reverted on the
owner's call.**

Why it failed: floating means it sits **on top of** whatever row happens to be
under it. On step 3 that was the Medical label.

The ESF steps have no nav bar — `esf-build.js` declares *"NAV BAR: Hidden —
full-bleed"* — so the footer is the only bar there is, and the button belongs in
it:

```
[ Back ]      [ Ask 🐶 ]      [ Continue ]
```

**Three equal columns, 103 × 44px each, Ask dead centre**, on all five screens.

### The footer is a GRID, not flex

`.journal-foot` is `space-between`, which spreads children by their own widths —
so Ask drifted off-centre as "Continue" became "See my number". A grid ignores
content width. The intro step has only two children and Ask still lands in
column two, so it is centred there too.

### One thing only measurement caught

At 13px with the standard 13px side padding, **"See my number" wanted 112px in a
103px column**. A button's overflow is `visible`, so the text painted straight
**over the edge of its own pill** rather than being clipped — visible in a
screenshot, invisible to any check that only looks at the box.

Fixed by taking side padding to 5px and footer type to 12px. The 44px tap target
is unchanged.

> **Transferable:** `scrollWidth > clientWidth` is the check. A layout assertion
> on bounding boxes will pass while text spills.

### Colour — amber, not LEGO orange

| | Original spec | As built |
|---|---|---|
| Fill | `#FF6D00` | **`#E9A227`** |
| Border | none | `#C97B0E` |
| Text | `#2B1A0E` | `#2B1A0E` |
| Contrast | ≈5.2:1 | **≈7.9:1** |

**Owner's call:** the orange read as a warning light next to the sage-green
primary. Both pass AA; amber is calmer and measures better.

**White text on either fails at ≈2.9:1.** The dark text is not a style choice.

Both are **literals, not theme tokens** — deliberately. This is Buddy's own
accent and must not drift across the four themes, or it stops being his. (This is
the one sanctioned exception to the repo's no-hardcoded-hex rule; it is scoped to
two classes and documented at both.)

Green remains the *action* colour. Buddy is not a task.

### The label is "Ask" plus the dog

Not "Ask Buddy" — the art carries the rest. "Help" is what people scan for when
stuck but reads as app support, and testers wanted the dog.

### The keypad hazard — honoured, not reintroduced

`esf-build.js` warns that closing the simulated keypad removes 250px of layout,
pulling a button out from under a finger mid-press so no click is dispatched.

**The panel lives in `#buddyRoot`, a sibling of `#screenRoot`**, exactly as
`#keyboardRoot` does and for the same reason — one z-index below the keypad, so
when both are up the field being typed into wins. Do **not** solve this locally
with a second latch; `kbdInit` already owns that problem.

*(The button itself no longer needs this protection now that it is in the footer,
but the panel does.)*

---

## 4. The question model — a multiplier, not a calculation

**The most important technical decision in the feature, and it survived the
build unchanged.**

```
adjusted = the row's OPENING estimate × Π (multiplier of each answer chosen)
```

`js/help-me-out.js` computes figures **from scratch** — `miles × rate +
insurance` — throwing the ESF's own estimate away. This does the opposite: the
ESF has already priced the row for this ZIP, income band and household, and the
questions adjust that for how the person lives.

Three reasons it matters:

1. **The estimate stays the spine.** Chat tunes it.
2. **Far less content.** A multiplier per option, not a model per category.
3. **It can never disagree with the screen.** A from-scratch tree can return a
   figure wildly apart from the dropdown beside it and leave the user with two
   numbers and no way to choose.

**A new lightweight mode, NOT an extension of HMO.** HMO is untouched.

### The base is the OPENING estimate, never the current value

`esfLifestyleBase()` reads `s.opening[rowId]`. Running the questions twice would
otherwise compound — a second pass would scale an already-scaled figure, and
answering the same way twice would move the number both times.

### The mid option is always exactly 1.00

**Owner's ruling:** *"We'll have to assume for all these questions that the peers
are always shopping at the middle lifestyle."*

**Asserted, not trusted.** Answering every question with the middle option
returns the base to the dollar on all five rows:

| Row | Base | All-mid result |
|---|---|---|
| Groceries | $540 | $540 |
| Home utilities | $265 | $265 |
| Phone + internet | $185 | $185 |
| Car costs | $345 | $345 |
| Medical | $165 | $165 |

This is a **documented assumption, not a sourced fact** — peer benchmarks are
population averages, not mid-tier averages. Filed beside `valueDispersion: 1.35`
in the known stubs.

### Where the multipliers live

`data/emergency-fund.json` → `lifestyleModifiers`, flagged `"_prototype": true`,
wrapped by `scripts/wrap-data.sh`. **A literal in a model is a figure with no
source attached**; a flagged entry in the data file is a to-do somebody can find.

Every value is invented — reasoned, not random. What has to survive a tester
saying "that seems about right" is the **direction and relative size** of each.

### Options carry a `short` sentence fragment

```json
{ "id": "premium", "label": "Higher-end stores (Whole Foods)",
  "short": "at higher-end stores", "x": 1.30 }
```

`label` is written to be recognised in a list; the brand in brackets is what
makes it land at a 5th-grade reading level. `short` is the same option worded for
mid-sentence, used in the recap.

> **Found in the build:** lowercasing the label instead turned *Whole Foods* into
> *whole foods*.

### The result lands on a dropdown band

**Owner's ruling:** *"if peer expense default is $200, but the user confirms $300
through chat, the dropdown will change to the number that includes $300."*

Built exactly so. The adjusted figure is snapped via `esfBandFor()` and applied
with `esfSetRange()` — the same call the dropdown itself uses — so `touched` is
set and the row stops counting as an untouched estimate.

**Worked example, verified live:**

```
base $540 × 1.00 (once or twice a week)
          × 1.30 (higher-end stores)
          × 1.15 (a lot of organic)   = $805
                                      → band $800–$900
row dropdown now reads "$800 – $900", touched = true
```

**At no point did the user enter a number.**

---

## 5. Flow

### Opening — always the list

```
What can I help with?

  Home utilities        ›
  Phone and internet    ›
  Groceries             ›
  Medical               ›
  Car costs             ›
```

Shown **always, even when there is only one entry** (owner's ruling): a
consistent shape, and the list is how the user learns what Buddy can talk about.

Entries already asked about are **ticked and still tappable** — answers can be
changed. An entry whose row is not visible on this screen (property tax for a
renter) is filtered out: a question about a field that is not there.

### Inside a row

Buddy says what the row covers, reports the figure if there is one, and offers
the questions. The row's name is echoed as the **user's own bubble**, so the
transcript reads as a conversation rather than a help file that changed its mind.

### THE MENU — the pattern to copy

```
[ Back to the list ]   [ Start over ]   [ Help me calculate this ]
```

**Three buttons, one row, always the same three in the same order.** Equal grid
columns. Verified identical across five states: list view, row open,
mid-questions, at the result, and a row with no questions behind it.

**This replaced a chip rack, and the failure is worth recording.** Chips size to
their text and wrap, so these three appeared and disappeared among the *answer*
chips, changed order, and spilled onto a second line. The same action sat
somewhere different on nearly every screen and had to be re-read each time.

Two rules make it a learnable pattern:

1. **Navigation is not in the answer rack.** That rack only ever carries answers
   to what Buddy just asked, so nothing in it moves for invisible reasons.
2. **A button that does not apply is DISABLED, never removed.** Removing one
   shifts the other two, which is the single thing this row exists to prevent.

**"Help me calculate this", not "Help me work it out"** — owner's call. "Work it
out" describes a mood; "calculate this" names the action and says it applies to
the row in front of you.

**"Start over" starts over whatever you are in the middle of** — the question set
if one is running, the conversation otherwise. One label, one idea, and it keeps
the row at three slots instead of needing a fourth that only exists sometimes.
Mid-questions this is also correct: somebody changing an answer should not lose
the explanation they read first.

### The options list — why it is not a `<select>`

Built as a native `<select>` first, which is what the owner asked for and is
right on a real phone, where options open as a picker sheet.

**It escaped the phone frame.** A select's option list is drawn by the
**operating system**, not laid out by the page, so it ignores the frame entirely
and spills out of the bottom. **No CSS can contain an OS popup** — the control
itself has to change.

Now: ordinary buttons in the panel's footer, `max-height: 150px`, scrolling
inside it. Same one tap, same full option text with the brand names that make it
readable.

**The cap does real work.** Six options at 40px is 240px, which put the footer at
278px of a 602px panel — nearly half, with the transcript squeezed to a couple of
bubbles. At 150px about three and a half rows show and the worst case in the pack
(six driving bands) holds the footer to 244px.

> **Transferable to any phone-framed prototype:** native `<select>`, `alert()`,
> `confirm()` and date pickers are all OS-drawn and all escape the frame. The
> frame is a CSS illusion; the OS does not know about it.

### Handback — Buddy proposes, you confirm

```
shopping once or twice a week, at higher-end stores, buying a lot
of organic — I'd put you around $805 a month.

          [        Use $805        ]
[ Back to the list ][ Start over ][ Help me calculate this ]
```

The recap is built from the labels they actually picked, so the figure is visibly
a consequence of their own answers rather than something that arrived.

**"Use $805" gets a full-width row of its own above the menu.** It is *the*
action at that moment; sitting it beside two ways out made it one option of
three.

**The panel stays open and returns to the question list.** The row updates behind
it, visible because the screen underneath never went away. That visible change is
the most convincing moment in the feature, and closing the panel throws it away.

He never writes a figure without the tap.

### Person-dependent copy — `variantOn`

Some rows cannot say one thing, because the figure they explain is **built
differently for different people**.

Medical forced this. It is priced on a replacement premium — what your own plan
would cost once the job stopped — **but only for somebody whose cover comes
through work**. For everybody else `esfReplacementPremium()` is 0 and the row is
ordinary out-of-pocket costs.

The original copy said *"your job pays most of your health insurance"* over
**$165**. An explanation that does not match the number beside it is worse than
none.

```json
"medical": {
  "variantOn": "employerCoverage",
  "sayIf":   { "employer": [...], "own": [...] },
  "chipsIf": { "employer": [...], "own": [...] }
}
```

A named resolver in `ESF_BUDDY_VARIANTS` returns the key. **A conditional entry
is a resolver plus a data key, not a branch in the render.**

Verified both branches: $1,150 gets the replacement-premium explanation, $165
gets the plain one and a different chip.

> **A bug this introduced, worth recording:** `renderEsfBuddyChips()` still read
> `entry.chips`, but a variant entry keeps its choices in `chipsIf` and has no
> `chips` key at all. Medical rendered with **both answers silently missing**.
> When you add an alternate shape to a data contract, grep every reader of the
> original key.

### Cross-screen disclosures — the mechanism

#### The store

```js
// on esfSession()
s.disclosures = {
  rentIncludesUtilities:    null,   // true | false | null (never asked)
  mortgageIncludesEscrow:   null,
  leaseIncludesMaintenance: null,
  noCarAtAll:               null
};
```

`null` is **load-bearing**. *Never asked* and *asked, answered no* are different
states: the first shows nothing, the second suppresses the question later.

#### The effects table

One table, data not logic, so a new disclosure is an entry rather than a branch:

```js
const ESF_DISCLOSURE_EFFECTS = {
  rentIncludesUtilities:    { rows: ["power"], effect: "zero",
                              note: "Your rent covers this. Leave it at $0.",
                              source: "rent" },
  mortgageIncludesEscrow:   { rows: ["propertyTax", "homeInsurance"],
                              effect: "suppress",
                              note: "Already in your mortgage payment.",
                              source: "mortgage" },
  leaseIncludesMaintenance: { rows: ["carCosts"], effect: "note",
                              note: "Your lease covers upkeep. Fuel and insurance are still here.",
                              source: "carPayment" },
  noCarAtAll:               { rows: ["carCosts"], effect: "zero",
                              note: "No car, no running costs.",
                              source: "carCosts" }
};
```

`source` was added in the build — it is what rule 4 needs to reopen the panel on
the entry where the claim was made.

| Effect | What it does | Force |
|---|---|---|
| `zero` | Sets the row to $0 and shows the note | 3 |
| `suppress` | Hides the opt-in **Add it** button, shows the note in its place | 2 |
| `note` | Changes nothing, says something | 1 |

**Force resolves collisions.** Somebody with no car *and* a maintenance-inclusive
lease sees $0, not a note about upkeep.

#### Four rules — all verified in-browser

**1. A disclosure sets a default. It never locks a row.**
The user can always open the dropdown and pick anything.

**2. Touching the row retires the note.**
Once `s.touched[rowId]` is true the user has made their own call, and a line
telling them what they should have done is nagging.

> `zero` writes the row **without** setting `touched` — deliberately. Marking it
> touched would retire the note under rule 2 and hide the explanation for the $0
> the user is looking at.

**3. The note replaces the "Based on" line, it does not join it.**
**Measured at 0px height delta.** That matters: tap targets are already at 29px
against a 44px floor because these screens must not scroll at 430×940.

**4. Reversible from either end.**
Changing the answer unwinds the effect — and unwinding restores the **opening
estimate**, not a leftover zero. Tapping the note reopens Buddy on the claim.

#### Where each is asked

| Disclosure | Asked on | Lands on |
|---|---|---|
| `rentIncludesUtilities` | Step 2, Rent | Step 3, Home utilities |
| `mortgageIncludesEscrow` | Step 2, Mortgage *(also offered on the tax/insurance rows)* | Step 4, Property tax + Home insurance |
| `leaseIncludesMaintenance` | Step 2, Car payments | Step 3, Car costs |
| `noCarAtAll` | Step 3, Car costs | Step 3, Car costs (same screen) |

The cross-screen ones are asked on **step 2** — before the user reaches the row
that would double-count. Catching it afterwards means telling someone they have
made a mistake instead of stopping them making it.

#### Unasked is not unanswered

A user who never opens Buddy has all four at `null` and sees the tool exactly as
before. **The feature is additive.** Verified: three unasked disclosures stayed
`null` through a full session.

### Resetting

- **Back to the list** — keeps the transcript, returns to the picker, abandons
  any half-answered question set.
- **Start over** — clears the conversation for this step (or restarts the
  question set, if one is running).

**The transcript resets when the step changes; the disclosures do not.** That
split is the whole feature: the panel always opens with nothing to scroll and a
list matching the rows on screen, while "my rent covers utilities" said on step 2
still has to be true on step 3. Verified: thread 3 → 0 across a step change with
the disclosure surviving.

---

## 6. Content by screen — as built

Step numbering is a trap. **The docs count 1–5; the code counts 0–3 plus the plan
screen.** Both numbering schemes appear in the codebase, mapped in
`buddy-esf.json`:

| Doc | `state.esf.step` | `ESF_STEPS` id | Screen |
|---|---|---|---|
| 1 | `0` | `intro` | Intro |
| 2 | `1` | `fixed` | Housing and Car Payments |
| 3 | `2` | `utilities` | Keeping things running |
| 4 | `3` | `rest` | Living-related Expenses |
| 5 | *(n/a)* | — | `esfPlan` |

> Note the docs' "step 4 — Debt" and "step 4 — Property tax" are **the same
> screen** in code.

| Screen | Buddy's job | Shape | Status |
|---|---|---|---|
| **Intro** | What an ESF is, what will be asked, how long it takes | Explain | ✅ |
| **Housing and Car Payments** | What counts, what to remove later. All three traps | Explain + disclosures | ✅ |
| **Keeping things running** | What the row covers → **lifestyle questions** | Multiplier | ✅ all five rows |
| **Living-related Expenses** | What counts + the escrow warning | Explain + disclosures | ✅ |
| **Goal screen** | What each option covers, never which to pick | Explain | ✅ |

### Step 3's rows all ask questions now

**Owner's correction during the build:** *"all the questions on this page should
be lifestyle questions that the user is asked and they respond to. these are not
explaining how to calculate, they are explaining what is calculated and can help
the user get the right number."*

The first build shipped step 3 as explanations. That was wrong: those five rows
open on an **estimate**, so saying what the row covers is the setup, not the
answer. All five now have question sets.

Their copy is correspondingly short — what the row covers, then an offer.

### Medical deliberately does NOT ask about doctor visits

How often you see a doctor does not move a premium, and asking implies it does.
Its two levers are **the plan you would buy** and **whether anyone needs care all
year**.

**Household size and age are deliberately absent** — the estimate already prices
those, so asking again would count them twice.

### Step 5 is the D26 risk

Coverage months and buffer are choices, not estimates. *"What 3 months covers"* is
one sentence from *"6 is better."* Every step-5 response states what an option
covers and stops.

---

## 7. What is NOT built — and what changed

- **No LLM.** D25 holds.
- **No working text input** in the panel. Present, visible, inert.
- **No HMO changes.** Different mechanic, left alone.
- **No Home or onboarding scope.**
- **No advice**, and no commentary on magnitude either (§1).
- **No scrolling on the ESF screens.** Only the panel scrolls.

### Two things the original spec forbade that the build needed

**"No change to `js/esf.js`"** — still true *so far*, but the medical per-person
table (unbuilt) requires a read-only `esfPremiumBreakdown()`. The owner has
approved that as a pure addition changing no existing arithmetic.

**"No new layout on the ESF screens beyond a floating button"** — reversed. The
footer became a three-column grid on both ESF screens. Smaller in effect than the
floating button it replaced, which overlapped content.

---

## 8. Instrumentation — as built

`state.esfEvents`, in-memory under D03.

| Event | Detail | Built |
|---|---|---|
| `chat_opened` | step | ✅ |
| `chat_row_picked` | rowId | ✅ |
| `chat_help_started` | rowId — they asked for the questions | ✅ *(new)* |
| `chat_question` | rowId, questionId, optionId | ✅ |
| `chat_applied` | rowId, from, to, band landed on | ✅ |
| `chat_restart` | rowId | ✅ |
| `chat_closed` | whether any figure was applied | ✅ |
| `chat_input_tapped` | **the inert box — demand for free text** | ✅ |
| `disclosure_set` | key, value, from, step | ✅ |
| `disclosure_undo` | key, value, from, step | ✅ |
| `chat_explain` | — | ❌ *"Why that number?" is unbuilt* |

**`disclosure_undo` is keyed on the OLD value**, not the new one:
`before === true && value !== true`. An undo is losing a claim that was in force.
"I changed my mind about the escrow" and "I never said that" are the same event
to the readout, and both are the opposite of the one worth counting.

`disclosure_set` with `mortgageIncludesEscrow: true` is the single most valuable
event in the feature — **it is a double-count that did not happen.**

The experiment: **does opening the panel change whether a row gets touched?** The
ESF already logs untouched row counts at `capture_done`.

---

## 9. Verification — how this was checked

**There is no JS engine on this machine** — `scripts/check-syntax.sh` finds
neither `node` nor `jsc`. Everything was verified by **running the real app** in a
browser against `scripts/serve.ps1`, driving it through the DOM and asserting on
live state.

What that caught that a syntax check could not:

| Found | How |
|---|---|
| Backtick inside an HTML comment inside a template literal — killed the whole file | Console error on load |
| Disclosure note height cost | Measured `scrollHeight` with and without |
| "See my number" painting over its own pill | `scrollWidth > clientWidth` |
| Medical chips silently missing after the variant change | Counted rendered chips |
| Medical copy contradicting its own figure | Read the thread back as text |
| Native `<select>` escaping the phone frame | Screenshot |
| Footer eating half the panel | Measured footer vs panel height |

> **Transferable:** assert on **rendered** state, not on the code that produces
> it. Half of the above are invisible to anything that only reads source.

**A trap specific to this repo:** `index.html` bounces a browser refresh back to
the version gate, so `location.reload()` loses the session. Navigate to the URL
with a cache-buster instead.

---

## 10. Reusable patterns

For other features, independent of the ESF:

1. **Model/render split.** Logic in `js/<feature>.js` with no DOM; rendering in
   `screens/<feature>.js` with no state. Already the house style
   (`chat-router` / `chat`); this follows it.
2. **A fixed layer as a sibling of `#screenRoot`.** Anything that must survive
   the keypad's 250px reflow goes in its own root, like `#keyboardRoot`.
3. **Effects as a table, not branches.** `ESF_DISCLOSURE_EFFECTS` — a new
   disclosure is an entry. Add a numeric `force` if collisions are possible.
4. **`null` ≠ `false`** for anything the user might not have been asked.
5. **Variant copy via a named resolver**, not a conditional in the render.
6. **A fixed menu row with disabled states**, never a rack that reshuffles.
7. **Figures in JSON, arithmetic in JS**, with invented values flagged
   `"_prototype": true`.
8. **Never trust an OS-drawn control inside a phone frame.**
9. **Multiply an existing estimate rather than rebuilding it**, whenever one
   already exists — it cannot disagree with what is on screen.
10. **Echo a tapped control's own words** into any transcript it produces.

---

## 11. Still open

### Unbuilt

- **"Why that number?"** — `esfRowSource()` is still **written and never
  called**, the same state the original spec found it in. It needs a voice pass:
  written as on-screen disclosure, not as something a dog says out loud.
- **Medical per-person table with editable boxes.** Owner-approved, needs a
  read-only `esfPremiumBreakdown()` added to `js/esf.js`.
- **Debt has no question set.** It is the one row with no estimate behind it, so
  it needs a genuinely new model rather than a multiplier.
- **Save-to-profile consent.** Owner's ruling: where a chat answer disagrees with
  the stored demographics, **ask before overwriting** — yes overwrites, no
  applies to that row only. Never a silent write-back. Nothing needed it yet
  because multipliers do not touch profile data.

### Decided against

- **Calculators as a third mechanic.** The original content doc specified phone,
  car and debt as calculators exposing `esfConnectivity()` / `esfCarCosts()`
  inputs. Phone and car were built as **multipliers** instead, for the §4
  reasons. Debt remains genuinely calculator-shaped and unbuilt.

### Known imperfect

- **The copy is wordy.** Owner: *"way too wordy, but I'm good with it for now."*
  A pass of its own.
- **Multiplier values are invented.** Directionally reasoned, not sourced.
- **"Peers shop mid-tier" is an assumption**, not a fact.
- **Two verbatim "you must" strings** survive in the copy — *"the smallest
  payment you must make"* and *"anything you must pay"*. `CLAUDE.md` lists "you
  must" as a forbidden D26 shape; these are definitional rather than
  prescriptive, and are the owner's own words. Unruled.
- **`esfToggleExplain()` and `esfRunHelp()` remain orphaned** in
  `screens/esf-build.js` — defined, never called. Per the repo's
  do-not-delete-unused-code rule they stay; they belong in `DEAD_BASELINE` if
  they are now permanently redundant.
- **Amber against the four Buddy illustrations is unverified on device.**

### Resolved since the original spec

- ~~D1 utilities 2.6× too high~~ — fixed in `8c7a252` before this work.
- ~~D3 car insurance disagreement~~ — fixed in `8c7a252`.
- ~~D4 `carRunning` dead branch~~ — fixed in `8c7a252`.
- ~~Button placement open question~~ — footer, decided.
- ~~Step 5 copy unwritten~~ — written.
