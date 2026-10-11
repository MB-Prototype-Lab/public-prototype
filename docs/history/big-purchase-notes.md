# Historical Big Purchase notes

Reference only; workflow and release instructions are superseded by docs/workflow.md. Historical paths resolve in blue `superdyu/mbprototype_v1` at `b4abe14`; the code now lives in `app/` with `BP_ENTRY = false`.

# Big Purchase Calculator: state of the build

**Updated 2026-10-08.** This describes what exists in the prototype today. It
replaces the 2026-10-03 handoff, whose sections on steps 1 to 4 no longer
describe the flow a tester walks.

| | |
|---|---|
| Repository | `superdyu/mbprototype_v1` |
| Branch | **`HoffDemo-BigPurchase`** (commit `f84f142`). `HoffDemo-Purchase` holds the same work one commit behind. `main` is untouched |
| Version folder | `versions/v3.1c/`, gate label **v3.1 (C)**. v1, v2, v3 and v3.1 are untouched |
| Detailed rulings | `versions/v3.1c/CLAUDE.md`: every owner ruling, in the owner's words, with the reasoning and the traps |
| Status | Clickable prototype. All figures marked `_prototype` are estimates, not quotes |

---

## 1. What the tool is for

The Big Purchase Calculator helps someone feel comfortable with a car they are
about to buy. It starts from the **person** (what they use a car for, what
people like them spend) and ends with a **savings goal** for the money they
need up front. The question it answers is not "can I afford this" but "what
does this really cost to own, beside people like me, and what would it take to
get there".

**It never gives advice.** It shows figures and differences and lets the
tester decide. Peers are shown as information and never as a limit.

---

## 2. The flow

```
Onboarding (ZIP, income, miles)
  → Landing: "Thinking about a big purchase?"
  → Find your car
       ├ Help me choose a car  → 5 questions + price range → 3 specific cars
       └ I know what I want    → Make → Model → New or Used
  → What it costs to own      (the expense table, peers, alternative cars)
  → Your car                  (Paying for it + Planning for it, one screen)
  → Goal saved → Goals tab
```

| Screen id | File | What it does |
|---|---|---|
| `onboarding` | `screens/onboarding.js` | Three questions under `BP_ENTRY`: ZIP, income (docked, tap answers and advances), miles a day |
| `bpLanding` | `screens/bp-landing.js` | Purpose, the emergency-fund check, and the category list (only *A vehicle* is built) |
| `bpFinder` | `screens/bp-finder.js`, model `js/bp-finder.js` | Views: `start`, `quiz` (questions, price range and the cars on one screen), `car` (the cost screen) |
| `bpYourCar` | `screens/bp-yourcar.js` | Paying for it and Planning for it, then the goal |
| sheets | `screens/bp-sheet.js` | Make list, model list, alternatives, peers' range, lease options, months, finance settings |

**The old numbered steps 1 to 4** (`bpSetup`, `bpCost`, `bpFinance`,
`bpCommit`, plus `bpOptions` and `bpQuiz`) still exist in the code and still
work, but **the flow no longer walks them**. Continue on the cost screen goes
to `bpYourCar`. `bpCommit()` is still the function that saves the goal.

---

## 3. Screen by screen

### 3.1 Landing
- Header: **"Thinking about a big purchase?"** (one line), then *"We'll show you
  what it really costs to own, and help you find the one that fits your life."*
- **Emergency fund box, "Before you buy"**, two short paragraphs (3 lines in
  total):
  - *"A big purchase adds a new monthly bill, so it may help to have an
    Emergency Savings Fund first."*
  - *"It helps pay your bills in hard times."*
  - Then *"Do you have an Emergency Savings Fund?"* with Yes · Start One Now ·
    Ask me later. It never blocks the flow.
- **Category list** ("What are you thinking about buying?"), each option a
  2px-bordered box. The category artwork is the owner's and must not be
  redrawn.

### 3.2 Find your car (start)
Three sections with **equal space between them**:
1. **Help me choose a car**: a warm apricot pill with **Buddy's face** (the
   same art as the Ask button), an arrow, and the label.
2. **I know what I want**: Make → Model → New / Used → *"See the real cost to
   own"*.
   - Make and Model open **bottom sheets** (native selects open upward at the
     bottom of the phone). **The make list shows each maker's logo**, and so
     does the Make field once chosen.
   - **Choosing a make opens the Model list straight away.**
   - New and Used show their price on one line (*"Used, ~3 yrs"*). Every box
     in this section is the same 40px height.
   - Once chosen, the car's name and what it is known for show above.
3. The Back and Ask buttons.

Above them: the owner's banner (Buddy and a car with a bow), shown **whole and
never cropped**, the title *"Find the right car for you"*, and the lead line.

### 3.3 Help me choose (the quiz)
**Six question rows from the start** (the standing pattern, section 6.4):
Weekends, Riders, Driving, Fuel, Vibe, **Price**. The question being asked is
an open, outlined "Select one" row; the rest are locked; an answer fills its
row in place. The question being asked and its answers sit in the dock at the
bottom, **at the same height on every question**.

| Question | Answers |
|---|---|
| 🗓️ On a typical weekend, what do you use your car for? | 🏕️ Trips to the trail or campsite · ⚽ Driving to games and practice · 📦 Hauling something big · 🛍️ Errands and short trips (each with a one-line description) |
| 👥 Who's usually riding with you? | 🎧 Just me and my playlist · 👫 Me plus one · 👨‍👩‍👧 A full car, 3 to 5 · 🚌 The whole team, 6 or more |
| 🚗 What's your everyday drive? | 🏙️ Short hops around town · 🛣️ Long highway miles · 🌄 Dirt roads and back roads · 🚤 Pulling a trailer or boat |
| 🌱 How green are you feeling? | 🔌 Plug it in · 🍃 Hybrid's my speed · ⛽ Gas is fine · 🤷 Not sure yet |
| ✨ Pick a vibe | 🏎️ Fun to drive · 🛋️ Smooth and quiet · 💪 Tough and capable · 🔧 Simple and reliable |
| 💰 Price | Value · Standard · Premium, each with its dollar range and **the three cars in it by full name**; "Peers spend about here" tags the range peers fall in |

- **Answers look like buttons**: all in one soft-blue box, each a white raised
  button with a firm border and a round green arrow; the picked one turns
  green. Every question uses the same format and the same colour. Emojis
  live in the data (`emoji` on each question and answer), so they can change
  without code.
- Answered rows carry their emojis; once all six are in, they fold into one
  *"Your answers"* row.
- **Every picker has an X Close** at its foot (a question, the answers list,
  the price range), so a tester can back out without choosing.
- **The result**, on the same screen: the banner at 72% width; the folded
  answers; a box *"Sounds like **Commuter sedan** / Standard · $25K to $30K /
  Easy on gas for daily miles / Also fits: …"*; and **three car boxes**. Each
  car box has the maker's logo, the full name, one line on what the car is
  known for (centred, never wrapping), and **New** and **Used** buttons with the
  price and the 5-year cost. The box colour says where the car sits by price:
  **cheapest green**, then blue, then violet (no red or amber: a price is never
  flagged as high).

### 3.4 What it costs to own (the cost screen, finder view `car`)
- Eyebrow *"What it costs to own"*; the maker's logo and **"Jeep Gladiator
  (New)"**; the known-for line; then **$40,000 Sticker price | $8,000 Money
  down** in large type (*Due at signing* on a lease).
- **The expense table** (soft blue, 2px blue border, the thing to look at).
  This car in bold, **Peers\*** in plain smaller type behind one continuous
  vertical rule:

  | Row | This car | Peers* |
  |---|---|---|
  | Car payment (*Lease payment* on a lease) | ✓ | ✓ |
  | Cost of running it | ✓ | ✓ |
  | **Total monthly payment** (green highlight) | ✓ | ✓ |
  | Payment as % of income (the payment alone) | ✓ | ✓ |
  | Year 1 cost | ✓ | ✓ |
  | Cost over 5 years | ✓ | ✓ |

  Then **"See how we calculated this"** (once, under the table) and the
  footnote *"\* Based on peers in Nashville, estimated 15 miles a day."*
- **"Alternative cars that can save you money"**, halfway between the table
  and the buttons, with two columns: **Saved** *per month* and *over 5 years\**.
  - *Your pick* (grey, $0 and $0, still tappable to go back)
  - *Same car, used* (new cars only)
  - *Cheapest in class* (only if another car in the class costs less)
  - *What peers spend*: the peers' price range (never a single assumed car);
    tapping opens the cars in that range
  - The lowest monthly is green. Footnote: *"\* If the money you save is
    invested at 7% a year."*
  - **Tapping an option changes the costs above and outlines the row; the list
    itself never changes**, and the original is always one tap away.
- **"See how we calculated this"** opens Buddy's panel: price, taxes and fees,
  **Loan / Cash / Lease**, the loan or lease settings, credit score, insurance,
  fuel, upkeep, each editable, with the totals. Edits carry through to the next
  screen.

### 3.5 Your car (pay and plan, one screen)
- The maker's logo and **"Hyundai Elantra Hybrid (New)"**, and the line
  *"Choose how to pay, then plan your savings."*
- **"Change your mind? / Choose a different car ›"**: one button that opens
  the alternatives from the cost screen, plus *Search all cars*.
- **Paying for it**: Price (right-aligned field), **Loan / Cash / Lease**, then
  the settings as dropdown pills:
  - Loan: Down payment, Loan length, Credit score → **Amount financed**
  - Lease: Due at signing, Lease length, Miles a year, Credit score →
    **Monthly lease payment** (Lease is dimmed on a used car)
  - Cash: a one-line note
- **Planning for it**:
  - *"Do you need to save for the down payment?"* (*the purchase* for cash,
    *signing costs* for a lease) **Yes / No**.
  - Yes opens: Down payment, − Already saved (typed), **= Need to save**
    (highlighted green), **Save it by** (a dropdown of the next 36 months), and
    *"That is $434 a month for 12 months."*
  - If savings already cover it, it says so.
- **"Set goal: save $5,200 for the down payment"**, full width, above Back and
  Ask. It becomes **Done** when nothing needs saving or the answer is No (no
  goal is created).
- The four blocks (strip, the two cards, the goal button) are spaced
  **equally**.
- **The saved goal names the car**: *"Save for the BMW X3 (new)"*, and records
  `payMode: "lease"` when leased.

---

## 4. The money model

### 4.1 One source
`bpBreakdown()` in `js/bp-engine.js` is the single source for loan and cash.
`bpfFigures()` in `js/bp-finder.js` turns it into the screen figures (sticker,
down, payment, running, monthly, year 1, 5 years). **If a figure appears on two
screens it is the same figure.**

Rules that hold (from earlier review, still true):
- `bpMoney()` everywhere; one rounding.
- `bpAmortize()` rounds the payment once, at the source.
- Year 1 = down payment + 12 payments + 12 months of running it.
- The 5-year total is not 60 × the payment (the last payment is a stub).
- **No resale anywhere.** Nothing is credited back.
- If two numbers' difference is the point, **show the difference**.

### 4.2 Peers (`bpfPeer()`, `data/big-purchase.json` → `vehicle.peerSpend`)
- Peer car payment and running cost by **income band × household size**
  (array index = size − 1). Running cost is scaled by the ZIP's transport
  cost of living; the payment is not.
- Household is no longer asked, so peers use the profile default (2).
- **Peers' year 1 and 5 years** are estimated: the price peers' monthly
  payment buys on this car's loan settings (`bpfPeerPrice`, found by bisection
  against the engine), with the peers' running cost swapped in.
- The peers column is **always loan-based**, even when the tester leases.

### 4.3 Savings over 5 years
`bpfSavings()`: the money an alternative saves is **kept and grown at 7% a
year** (the session's `savingsRate`), not the plain price difference.
- Loan and cash rows use the engine's `bpOpportunity()`, which counts the
  up-front money and each month's difference.
- Lease rows and the peers' range use `bpfGrowth()` from the figures on screen:
  the up-front difference grown for 5 years plus the monthly difference as a
  60-month annuity.

### 4.4 Leasing (`js/bp-lease.js`), an estimate
On while `pay.leasing` is set, for **new cars only**. The standard formula:

```
capitalised cost = price - due at signing
residual         = price x share (64% / 58% / 50% for 24 / 36 / 48 months at
                   12,000 miles a year, minus 1 point per 1,000 extra miles)
monthly          = ((cap cost - residual) / term + (cap cost + residual) x MF)
                   x (1 + sales tax rate)
money factor     = the credit tier's APR / 2400
```

On a lease, Year 1 = due at signing + 12 × (payment + running), and **5 years
repeats the lease**. Options: due at signing $0 / $1,000 / $2,500 / $5,000,
24 / 36 / 48 months, 10,000 / 12,000 / 15,000 miles. These are placeholder
figures for the prototype.

---

## 5. Data

| File / key | What it holds |
|---|---|
| `data/big-purchase.json` → `vehicle.finder.models` | **81 cars**: Sedan, SUV, Truck × 3 uses × 3 tiers × 3, base trim, approximate 2026 MSRP. Each has `known` (its reputation, one short line, nine were shortened to fit one line) and `why` |
| `vehicle.finder.quiz` | The five questions, their answers, scores per type and use, and the `emoji` for each |
| `vehicle.peerSpend` | Peer payment and running cost (section 4.2) |
| `alternatives.usedCut` | **0.28**: used = about 3 years old, the same everywhere |
| `assets/img/logos/` | **23 maker logos**: 17 SVGs from Simple Icons, 6 PNGs (Genesis, GMC, Land Rover, Lexus, Mercedes-Benz, Rivian) from the open *car-logos-dataset*. Mapped in `BPF_LOGO_FILES`. Logos are the makers' trademarks, used here only to identify the cars in a prototype |
| `assets/img/buddy-car.jpg` | The owner's banner |

After editing any `data/*.json`, run `MB_VERSION=v3.1c bash scripts/wrap-data.sh`
(the app loads data through generated `.js` wrappers because it runs from
`file://`).

---

## 6. Standing rules (owner rulings)

### 6.1 Content and legal
- **No financial advice, ever.** No "you should", "we recommend", "best for you".
  Suggested cars are *choices based on what you told us*.
- **Peers are information, never a limit.** No "% of income is too high", no
  threshold, anywhere (owner: legal risk, "full stop").
- **Never call a cost high.** No red or amber on prices.
- No em dashes in anything a tester reads. The owner's copy is verbatim.

### 6.2 Type and colour
- **Dark text by default.** Inside the purchase screens `--text` is the strong
  ink and the base weight is 500; nothing a tester reads is grey.
- **Descriptive copy is centred**; labels inside rows and tables are not.
- **One font in tables and option lists**: Inter, regular and bold only, size
  changes allowed. (Weights 500/600/800/900 render as different-looking cuts on
  Windows and read as a font mix.)
- **Every box has a 2px border**, so each reads as its own function. **Every
  button has a visible border** so it looks pressable.

### 6.3 Layout
- **One screen, no scrolling.** Measured, never eyeballed:
  `document.querySelector('.journal-body')` → `scrollHeight - clientHeight`
  must be 0. Verified for all 81 cars, new and used, loan and lease, at a
  900px-tall window (phone frame ~820px).
- One-handed: primary actions at the bottom; choices docked; bottom sheets
  instead of native selects.
- **Spare height goes into equal gaps** between sections, never into the boxes.
  Take space from inside boxes when tightening.

### 6.4 Patterns to reuse
- **Question rows** (`renderBpfAnsRow`): every question has its row from the
  start; the one being asked is open; the rest are locked; answers fill in
  place and nothing jumps. Used by the quiz, step 1 and the old Help me pick.
  **Any new multi-question screen uses it.**
- **Every picker in the dock ends in an X Close** (`bpfDockClose`).
- **Options list with an original**: the tester's own choice stays at the top
  so it is one tap away; trying an option never rebuilds the list
  (`bpfOrigin`, `bpfChooseAlt`).

---

## 7. How to run and verify
- No build step, no dependencies; pure static files.
- On the owner's Windows machine there is no `node` or `python`. Verification is
  in the browser: `scripts/serve.ps1` serves the repo on port 8787 (launch
  config `prototype`); open
  `http://localhost:8787/versions/v3.1c/index.html` directly (a reload bounces
  to the gate).
- Drive state with the page's own functions to reach a screen quickly, for
  example `go('bpFinder'); bpfChoose(id, 'new')`, then `bpfContinue()`.

---

## 8. Open items

1. **Onboarding ZIP field loop** (`screens/onboarding.js` ~510): at 5 digits
   `kbdCommit()` dispatches `change`, which calls the same handler again. A
   one-line re-entrancy guard is offered; not applied.
2. **Credit-score default** is 600-660 (9.71%), which drives large interest
   figures; 661-780 would be about two-thirds of it. Owner decision.
3. **Lease and peer figures are placeholders.** Real residuals, money factors
   and peer lease data would replace them.
4. **Old steps 1 to 4 are dormant** in the code. Decide whether to remove them
   or keep them for comparison.
5. **Two long model names truncate** in the alternatives rows (*Colorado Trail
   Boss*, *Tacoma TRD Off-Road*).
6. **Short phones**: layouts are tuned at a ~820px phone. In a very short
   window (~540px) the body scrolls.
7. **Emoji rendering varies by platform** (the owner earlier rejected emoji
   for category icons for this reason; the quiz now uses them by request).
8. `docs/big-purchase-spec.md` is stale; this document is the current
   description.
9. The emergency-fund screens inherited from v3.1 still need two taps after a
   typed field (`bpFieldCommitted()` fixes it on the purchase screens only).
10. Unused renderers kept by house rule: `renderBpfPeerFact`,
    `renderBpfModelList`, `renderBpfKnow`, `renderBpfLines`, `renderBpfPeerBox`.

---

## 9. Traps that fail silently
- **Three-class selectors win**: `.journal-shell.onb-pinned .journal-body` beats
  a two-class rule. Use `.journal-shell.onb-pinned.<shell> .journal-body`.
- **A two-column grid quietly wraps a third item**: `.bp-seg` is a 2-column
  grid; three segments need `.bp-seg3`.
- **A grid label with `nowrap` pushes its row off the grid**; use `min-width: 0`.
- **An inline SVG has no intrinsic size**; give it a width and height.
- **A typed field followed by a tap** loses the tap unless it commits through
  `bpFieldCommitted()`.
- **`perl -0pi -e` double-encodes this repo's UTF-8 files** (emoji and `·`
  included). Use the Edit tool or `sed` with plain patterns.
- **Everything is global**: one namespace across plain `<script>` tags; keep
  names feature-prefixed and mind the load order in `index.html`
  (`js/bp-lease.js` loads after `js/bp-finder.js`).


---

# Owner rulings recorded in blue `versions/v3.1c/CLAUDE.md`

# Money Buddy v3.1 (C) — `versions/v3.1c/`

**This folder is v3.1 (B) plus the Big Purchase Calculator.** It was copied
from `versions/v3.1/` on branch `HoffDemo-Purchase` (2026-09-21) so the gate can
show the purchase build and the ESF/Buddy-chat build side by side. Everything
below this section was inherited from v3.1 and still applies here; read "v3.1"
as "this folder" where it describes contracts and traps.

- **Tooling:** pass `MB_VERSION=v3.1c` — the scripts default to `v3.1`.
  `wrap-data.sh` maps `big-purchase` → `BIG_PURCHASE` and `buddy-bp` → `BUDDY_BP`.
- **Spec:** `docs/big-purchase-spec.md` (repo root), revision 2.
- **Entry:** `BP_ENTRY` in `js/config.js` — onboarding hands to the calculator
  instead of the emergency fund. The Goals tab also carries an "Estimate a big
  purchase" card. `false` makes onboarding behave exactly like v3.1 (B).

### The calculator — files

| File | Holds |
|---|---|
| `js/bp-engine.js` | All arithmetic, category-blind, no DOM: cost stack, loans, true cost, opportunity cost, cash vs loan, save-to-afford, bands, log |
| `js/bp-vehicle.js` | The Vehicle category — registers itself with the engine (spec §3.1 interface) |
| `js/buddy-bp.js` / `screens/bp-buddy.js` | Buddy's explain-only model and panel, drawn with the ESF panel's classes |
| `screens/bp-landing.js` | Landing + emergency fund check (`bpLanding`), and the Goals-tab cards: entry, "Back to your car", both budget reminders |
| `js/bp-finder.js` / `screens/bp-finder.js` | Find your car (`bpFinder`): catalog, quiz, peers, the car view, Buddy's editable breakdown. Sits between the landing and step 1 |
| `screens/bp-setup.js` · `bp-cost.js` · `bp-options.js` · `bp-finance.js` · `bp-commit.js` | Steps 1–5 (`bpSetup`, `bpCost`, `bpOptions`, `bpFinance`, `bpCommit`) |
| `screens/bp-sheet.js` | Every in-frame sheet (range picker, credit, tax break, simulated IRS page, savings rate) — never a native `<select>` |
| `data/big-purchase.json` / `data/buddy-bp.json` | Every figure (sourced or `_prototype`) and Buddy's copy |

### Calls made where the spec was silent or contradicted itself

- **Trade-in in save-to-afford.** §3.5 subtracts it in both modes, but with a
  loan §3.4 already took it off the principal — counted twice. It comes off the
  cash needed **for cash buyers only**.
- **Charger / riding gear** are cash on the day in both modes, so they are in a
  loan buyer's amount to save too (§3.5 lists them for cash only).
- **Opportunity cost is summed month by month**, so a 36-month loan stops
  paying at 36. Identical to §3.6's closed form for 60 and 72 months.
- **Credit tiers are Experian Q2 2026, all four from that one release** (§3.4's
  requirement). Under 600 = subprime (501–600).
- **The financing block shows the monthly payment** where the spec repeated
  "Interest over 5 years" a line above the cash-vs-loan block's identical figure.
- **Changing new/used or the price on screen 2 clears per-car edits** — they
  describe a car no longer on screen. About-you rows survive.
- **The purchase-date task and goal-complete prompt surface on the Goals tab**,
  not the Home daily loop, because ESF_ONLY hides Home. Admin buttons fast-forward both.

### The flow is FIVE screens, not the spec's three (owner, 2026-09-22)

`bpLanding` → `bpSetup` (1) → `bpCost` (2) → `bpOptions` (3) → `bpFinance` (4)
→ `bpCommit` (5). The spec's merged screen 2 — cost stack, alternatives and
financing at once — was rejected outright ("way too much info"). Each of those
is now its own step, in the order a person actually decides:

1. **What you're buying** — one question at a time, choices docked at the bottom.
2. **The costs that are easy to miss** — ONLY the car they came for. A read-only
   table: ONE LINE per expense, no rules between rows, two aligned figure
   columns ("a month", "first year"), and the car's own price as the first row
   with a Total beneath. The headline equals that total exactly — it is printed
   from the same figure rather than rounded separately.
   Taxes and registration are ONE line. Renewal, loan interest and value lost
   are deliberately NOT here — none is a forgotten running cost. Ends with the
   single question "Will this be financed?"
3. **Ways to spend less** — the alternatives, with the context they never had.
   Summary cards ("Consider used to save $5,600") that expand into an
   apples-to-apples table: both cars on the same rows over five years, minus
   what each is worth when sold. Buddy with a bag of money carries the saving.
4. **Paying for it** — final price and financing adjustments, at the end.
5. **Plan for it** — the goal, the date, the reminder (unchanged).

`bpCostLines()` (screen 2) and `bpFiveYearRows()` (screen 3) are the two shapes
the engine's stack is displayed in; both read `bpStack()` and neither adds
arithmetic of its own.

**Buddy explains every expense** — `data/buddy-bp.json` has an entry per line on
screen 2 saying what it is, how it was worked out, and what it means.

### Owner's rulings after the first review (2026-09-22) — these beat the spec

- **Landing copy** is the owner's, verbatim: "The real cost of something isn't
  just what you pay at the register. We'll help you estimate the hidden and
  forgotten costs."
- **The fund question is a highlighted box at the bottom of the landing**, not
  its own screen. Answering never blocks picking a category.
- **Back on the landing returns to the onboarding question** the tester left
  from (`state.bpOnbReturn`), not to the Goals tab.
- **Step 1 asks one question at a time.** Choices dock at the bottom in thumb
  reach; each answer collapses into a dropdown-style row that reopens it.
- **Docked choices NEVER wrap.** `bpDockLayout()` picks a full-width grid with
  equal cells from the option count and label length: 2 short → two across,
  3 short → three across, 4 short → two by two, anything longer or carrying
  example text → one per line, left-aligned, with a tick on the selected row.
  *This reverses the centred, right-nudged cluster tried on 2026-09-22* — it
  wrapped to "2 + 2 + 1" with three different left edges, which is a wrapped
  grid rather than a layout. One-handed reach comes from the dock's position at
  the bottom of the screen, not from shoving controls sideways.
- **Costs are read-only.** No per-row editing, no range dropdowns, no trade-in
  or "anything else" rows (the engine still supports all three).
- **The saving is a picture:** Buddy with a bag of money, not a "worth about
  $X" sentence. An earlier growing-bills chart was replaced by it.
- **Financing is rows that open sheets**, not tile grids. Loan-vs-cash lives in
  its own sheet (§3.7's closing line is kept there, unchanged).

### Spec revision 4 reconciled (2026-09-26)

The owner revised `docs/big-purchase-spec.md` outside the code, from screenshots
of an earlier build, so parts of it restated things that had already been
changed here. The conflicts were put to them item by item. **Taken from the
spec:**

- **Upkeep is base-plus-rate:** `($400/yr + $0.06/mile) × condition × tier`,
  every factor centred on 1.00 at a NEW STANDARD car, plus this build's own fuel
  and type multipliers. The old flat per-mile model ran about a third of the
  right figure and collapsed at low mileage. It matters beyond one row: upkeep
  and the loan rate are the two costs that eat a used car's sticker advantage.
- **This feature never asks how far you drive.** `bpVMilesPerDay()` reads the
  profile or assumes `milesPerDayDefault` (15), and `bpVMilesLine()` says which
  of the two it was, on every screen that prints a figure built on it.
  `milesFloor` (2) is what "I don't drive" becomes HERE only — the onboarding
  band still means "no car" to the ESF.
- Gas SUV mpg 25 → 28. Tier ladder's third rung displays as **Standard**
  (the data key stays `everyday`). Screen 2 is **"The costs that are usually
  overlooked"**. Landing rows carry a per-category emoji from the data file.
- **The fund box is three side-by-side buttons** (Yes · Not yet/start one ·
  Not yet/later) that collapse to a one-line confirmation with a Change link.
- **The comparison table:** two figures in Buddy's bag (saved, and worth at the
  savings rate), no resale row, "Over 5 years" in the header once, a third
  column on request, the lowest Total in green, and tap-a-column to choose.

**Rejected, because the owner's later instructions in code win:** the three-step
merged screen, editable cost rows, the options as buttons on screen 2, the old
landing copy, and inline price editing on screen 2.

**Not built:** the shared profile with provenance (spec §6.2). It touches the
ESF too and waits until this feature settles.

### THE NEW FRONT: start from the person, not the car (owner, 2026-09-28/29)

Owner: *"the current experience is all about the user having a car in mind
then finding a cheaper option. the goal should actually make the user feel
comfortable with what they're buying."* The flow is now:

    onboarding (5) → bpLanding → bpFinder → bpSetup (1) → bpCost (2) → bpFinance (3) → bpCommit (4)

The original four steps stay, unchanged, at the end (owner: *"keep the
original screens in at the end"*). `bpFinder` writes the chosen car into
`state.bp.setup`, so step 1 opens fully answered and every figure on steps 2–4
is the finder's figure. Checked: F-150 new, $1,250 a month / $22,900 year 1 /
$83,155 five years on both.

- **Onboarding is THREE questions: ZIP, income, miles** (owner, 2026-09-29:
  household and place *"not needed"*, reversing the five of the day before).
  **Income is docked** at the bottom, tap = answer = advance, for one-handed
  use; the band's midpoint stands (no slider in this flow). Peers read the
  profile's default household (2), so the peer line names the city and
  income only, never a household size nobody gave.
- **Landing (screen 1), as of 2026-10-01:** a one-line header *"Thinking
  about a big purchase?"* (20px, nowrap; 23px wrapped) and two lines of value
  *"We'll show you what it really costs to own, and help you find the one
  that fits your life."*
  (owner: one-line header, max two lines, explain the value). Fund box line is
  the owner's, verbatim: *"An Emergency Savings Fund helps you save money to
  pay your monthly bills during hard times."* Fits 812px, 0 overflow.
- **Landing layout, 2026-10-01** (owner: *"too crowded… more space between the
  three sections… one hand friendly… primary action buttons towards the
  bottom… center the text"*): the body is `space-between` with a 16px minimum
  gap, so lead / fund box / category list spread (about 60px apart at 812)
  and the list sits 14px above the menu. Reading copy is centred. The fund box
  now says why it is there before it asks: eyebrow *"Before you buy"*
  (replacing "Tap one to continue"), *"A big purchase usually adds a new
  monthly bill."* then the owner's verbatim line, then the question, then the
  three answers last.
- **Finder start, 2026-10-01:** NO peer figures (owner: *"delete this
  section, it isn't needed here or yet"*); peers first appear beside a car.
  Spaced out (owner: *"space out screen 2"*): banner 190px, centred title and
  lead, the two path buttons pinned to the bottom in thumb reach, spare height
  between (about 157px at 812).
- **The owner's banner** (`assets/img/buddy-car.jpg`, Buddy and a car with a
  bow) sits on the FINDER's first view above *"Find the right car for you"*,
  140px tall, cover-cropped (owner, 2026-10-01: it belongs on that screen).
- **Find your car (screen 2), `screens/bp-finder.js`, model in
  `js/bp-finder.js`.** Five views: start (two paths plus what peers spend) ·
  know (type → make/model → new/used, dropdown choices only) · quiz (five
  short questions → a type-and-use → a price range) · cars (three specific
  cars, each with a NEW and a USED price to tap) · car (the five lines, peers,
  two ways to spend less). The tester taps a PRICE, not a car (owner).
- **"I know what I want" is the car-site pattern** (owner, 2026-10-01: *"the
  car list experience is pretty bad… drop-downs by make, then model… replicate
  that for familiarity"*). Make (A–Z, 23 makes) → Model (locked until a make
  is chosen, A–Z) → New / Used tiles with their prices → one "See what it
  costs" button, all in the thumb dock; the chosen car shows by name above.
  No type question. Picks survive Back from the car view.
  `renderBpfModelList()` (the old tier-grouped list) is unused, kept.
  **Not native `<select>`s** (owner, 2026-10-01: native ones at the bottom of
  the screen *"dropped up which was a weird experience"*). Each field looks
  like a car-site dropdown and opens a bottom sheet (`bpfOpenList`,
  `renderBpfListSheet`, routed through `renderBpLayer`), Close at the foot.
  New / Used prices are 20px 900, the same as the car's name (owner: *"at
  least as big and bold as the make and model"*). The button names the next
  screen and what is missing: "Pick a make and model" → "Pick new or used" →
  **"See the real cost to own"**.
- **Every car says what it is KNOWN for** (`known` in the catalog,
  `bpfKnown()`), its reputation, the line its marketing leads with (owner:
  *"what is the car known for? im sure it isn't known for 5 seats and roomy
  back seats"*). Shown on the pick card, the three-car cards and the car view.
  `why` (the spec line) stays as the fallback. `_prototype` copy: keep to
  reputation, avoid sales figures that date ("best-selling since…" only where
  long-standing: F-150, Camry, RAV4).
- **The five lines, in the owner's order:** sticker price · down payment ·
  **total monthly cost** (highlighted: car payment + running it) · year 1 ·
  five years. All from `bpBreakdown()`; nothing in the finder does its own
  arithmetic.
- **"See how we calculated this"** opens the Buddy panel in a `calc` mode
  (`renderBpfCalcPanel`): price, taxes, loan settings, insurance, fuel,
  upkeep, every one editable. Edits land on the pick card through
  `bpSetRow`, so they carry into steps 1–4. The panel keeps its scroll on
  repaint (`calcScroll`); the chat mode still pins to the newest message.
- **Two ways to spend less, each a SPECIFIC car** (owner: *"which car is it"*),
  one number each: the monthly, and the difference. (1) the same car used,
  about 3 years old. (2) what peers' payment buys: peers' monthly payment worked
  back to a price on the same loan terms (`bpfPeerPrice`, bisection against
  the engine), then the dearest car of the same use, new or used, at or under
  it. A row that would not cost less is left out.
- **Peers are information, never a limit.** Owner: *"cannot say that and that
  rule cannot be broken. full stop. we cannot incur legal risk."* No "% of
  income is too high", no threshold anywhere. The car view shows this car and
  peers side by side (payment, total monthly, share of income) and the
  difference in dollars. The range tag reads *"Peers spend about here"*.
- **Three tiers, displayed as a tier plus its dollar range** (owner: *"a duo
  display of the tier and price range"*): Value · Standard · Premium, keys
  `value` / `everyday` / `premium` so the insurance and upkeep factors apply
  unchanged. Each range is derived from its three cars, never typed.
- **Catalog: Sedan, SUV, Truck only** (owner accepted the scope cut), three
  uses each, 81 cars at base trim (owner: *"display the basic make/model"*),
  `vehicle.finder.models`. Sedan is type `car`. Prices are approximate 2026
  base MSRP, `_prototype`.
- **Used = about 3 years old, priced with `alternatives.usedCut`** (28%) — the
  same cut the options screen uses, so a used car costs the same wherever it
  appears. Its factors are the `1-3` age band (higher upkeep, lower insurance).
  Step 1 therefore shows its age as "1-3 yrs".
- **Peer car spend is new data:** `vehicle.peerSpend`, payment and running
  cost by income band and household size (array index = size − 1, the usual
  trap). Running is scaled by the ZIP's Transport cost-of-living multiplier;
  the payment is not. `_prototype`.
- **Why-lines are facts from the tester's answers**, never "best for you"
  (owner: *"it's always here are choices based on info the user submitted"*).
- **STANDING PATTERN, any screen that asks several questions (owner,
  2026-10-03):** *"the first question appears at the bottom then when it's
  answered, it moves to the top… show the first question as a drop-down with the
  question already opened… this pattern will need to be used everywhere."* Every
  question has its row from the start, in place: answered = its answer, the one
  being asked = an open outlined "Select one" row with its choices docked below,
  the rest locked. `renderBpfAnsRow(label, val, onclick, on, locked)` is the one
  helper; used by the finder quiz, step 1 and the old Help me pick. Any new
  multi-question screen uses it. Every picker that opens in the dock ends in an
  X "Close" (`bpfDockClose`).

### Onboarding here was TWO questions (2026-09-26) — superseded 2026-09-28

Now five; see the section above. Kept for the history.

`ONB_STEPS_BP = ["zip", "miles"]` in `screens/onboarding.js`, chosen by
`BP_ENTRY`. Owner: *"remove these onboarding screens from this build."* The
household, home-type, coverage and income steps belong to the emergency fund and
were being walked through on the way to a calculator that reads none of them.

**Consequence worth knowing:** somebody who starts an ESF from the landing
arrives without those answers. Every ESF model falls back (household → adults at
a middling age, place and coverage → null), so nothing breaks, but its figures
are coarser than they would be after its own onboarding.

**Mileage bands are priced for a car here.** `vehicle.milesBandMidpoints` maps
the onboarding band ids to what this tool uses — under 5 → 3.5, 5–15 → 10,
15–30 → **25**, 30+ → 40 — deliberately NOT the ESF's own midpoints (15–30 is 22
there). Car costs scale straight off this number, so the owner set it for the
car. `milesFloor` (2) still catches "I don't drive".

### "Help me pick" — the four-question quiz (2026-09-26)

`screens/bp-quiz.js`, screen id `bpQuiz`, offered from screen 1 while the type
is unanswered. Owner: *"the experience assumes the user has a car in mind, but
they may not."* Four questions — who's in the car, what it's for, where they
drive, what matters — each option carrying **scores per vehicle type** in
`vehicle.quiz`. Highest score wins; `tier` and `fuel` are nudges applied only
when an answer points somewhere clearly.

**A new question is a data entry, not a branch.** Nothing in the screen knows
what a truck is. It suggests and never chooses: the result screen offers *Use
this* or *I'll pick myself*, and no figure moves until the tap.

### Category icons are inline SVG, never emoji

`BP_CATEGORY_ICONS` in `screens/bp-landing.js`. Emoji were tried and rejected
(owner: *"these icons look janky and old"*) — they render at a different age and
weight on every platform, they cannot take the row's colour, and ✈️ drew nothing
at all here, which is what a font you do not ship can always do to you. The
icons inherit `currentColor`, so a coming-soon row greys out with its label.

**An inline SVG has no intrinsic size.** Without `.bp-cat-icon { width: 24px }`
it takes every pixel the flex row offers — which on first run was most of the
phone. Any new inline icon needs its box set.

### The quiz fills everything, not just the type

Five questions now, and the result writes **type, brand, fuel and condition**,
so screen 1 opens on the price alone (owner: *"we have the answers needed to
pre-fill these questions and jump to price screen"*).

**Fuel is never asked as a drivetrain question.** The options are "Plug it in",
"A bit of both", "Stick with gas" and "No preference", each carrying what it
means day to day — where you fill up, what breaks, what it costs to buy. "No
preference" is resolved from the answers already given: city or commuting →
hybrid, hauling in a truck → diesel, otherwise gas. A drivetrain the chosen type
does not offer falls back to gas.

### Where the cheaper options live

Both places, deliberately (owner's call, 2026-09-26). The **detail** keeps its
own screen — the original objection was that options arrived with no context —
and the **costs screen carries a callout** naming the biggest saving.

That callout started as a quiet one-line link and was missed ("it was almost
hidden"), so it is now the saving in 34px with two buttons: **Explore** opens
the options screen, **Not interested** takes it out of the flow — `Continue`
then goes straight to paying for it. The choice is reversible from the one line
it collapses to. A declined saving is logged (`bp_explore_choice`), which is
better instrumentation than a scroll-past ever was.

### WHAT IT COSTS vs HOW YOU PAY — the one money model (2026-09-27)

Owner: *"I need to be clear about the cost of the car… right now it's all of
them at once and really confusing."* The arithmetic was never wrong; the screens
answered two different questions in one column. `bpBreakdown()` in
`js/bp-engine.js` is now the single source, and it returns them **separately**:

| Group | Figures | Where it shows |
|---|---|---|
| **What it costs** | price · taxes, fees and setup · running and maintaining · loan interest → **5-year total**, with **year 1** beside it | Screen 4's "What the car costs you" box; the comparison's columns |
| **How you pay** | down payment · loan amount · monthly payment | Screen 4's headline and financing box |

**The two groups must never share a list.** A down payment and a loan are the
same money as the price, arriving in instalments — printing them beside it
counts the car twice, which is exactly what made the screen unreadable.

The four cost rows **sum to the total**, always. If a row is added, it goes in
`bpBreakdown().costs` or it does not appear.

**Consequences, applied:** screen 2 is running costs ONLY (its headline lost the
price, which was making an $87,820 figure that mixed the car with keeping it);
screen 4 carries the full picture in two boxes; the options list on screen 4
dropped the car you already chose, whose total sits immediately above it.

### Resale is not in this tool (2026-09-26)

Owner: *"I don't want resale value at all… it should never be included."* So
`bpStack().trueCost` counts the **price in full** and credits nothing back:

    trueCost = price + upfront + monthly×12N + yearly×(N−1) + interest

That is not the double count the old comment warned about — the price is counted
once and depreciation is not counted at all. `bpVResale()` and the retention
curve stay (the category owns its depreciation model) but **nothing reads
them**. A figure on screen that moves when the retention curve changes is a bug.

Two things fell out of it: the comparison columns now add up exactly, and
`bpOpportunity()` lost its `endDiff` term — there is no "the pricier car sells
for more" credit to subtract any more.

### Steps 2 and 3 FILL the frame (owner, 2026-09-27)

*"its all crowded towards the top with a lot of space at the bottom."* The
boxes were packed to the top on a fixed gap, so anything that made the content
shorter — a cheaper car, fewer rows, paying cash — left a dead band above the
footer while the blocks above it stayed jammed together. Every screenshot the
owner sent of a modest car looked worse than the worst case I had been tuning
against.

Both bodies are `justify-content: space-between` now, so the **leftover height
goes into the gaps**. The `gap` is a MINIMUM: 11px on step 2 and 9px on step 3,
which is what the tallest configuration needs to stay inside the frame, and
anything shorter spreads to fill.

Safe inside a scroll container because `space-between` packs from the top once
there is no free space. `center` and `end` do not — they would push the first
block above the scroll origin, out of reach.

**Tune the minimum gap against the TALLEST configuration** (premium SUV, 40
miles a day, electric, on a loan) and let the layout handle the rest. Tuning
against an average one is what produced the dead band.

**The last box stops short of the footer.** A 12px bottom inset on the body
(owner: *"the bottom box is too close to the menu buttons"*). Because the body
is `space-between`, that inset is paid for out of the gaps above rather than
out of the screen — the blocks stay spread, they just stop clear of the menu.

**Specificity trap:** `.journal-shell.onb-pinned .journal-body` is three
classes and beat the two-class `.bp-fin-shell .journal-body`, so the inset
silently did nothing on the screen that needed it most. Caught by measuring
`footer.top − lastBox.bottom`, not by looking at the stylesheet, where the rule
appeared to be there.

**Version B is the default** (owner: *"stick with version B"*): the saving in
the middle, the running-cost table last. A stays behind the admin toggle.

### Screen 2 ships as A and B (owner, 2026-09-27)

Two layouts, switched from the admin panel (`bpCostVariant()`, session state,
A by default):

- **A** — the six rows, the running-cost table, then the cheaper-options
  callout.
- **B** — the six rows, the **callout in the middle**, the table last.

`renderBpCost()` differs between them by exactly two lines. Anything else that
diverges makes the comparison worthless, so keep the difference to the order.

Everything else on the screen changed for both: labels **unbolded** (six bold
rows meant nothing was emphasised), "Down Payment at purchase" shortened to
**"Down Payment"**, the "estimated for…" line moved **under the table heading**
where it qualifies the table before it is read, the saving and "over 5 years"
onto one line, and the boxes given real gaps.

**Year 1 and the five-year total share a tinted band, and year one is the
bigger of the two** (owner: *"year 1 should be more prominent"*). It is the
figure a person can picture; the five-year total is what it grows into.

**Where the space came from:** inside the boxes, never from the gaps between
them. The gaps are what the owner asked for, and they are what every previous
trim had quietly eaten.

### ONE TYPE SYSTEM (owner, 2026-09-27)

*"all kinds of mixed fonts here. standardize every screen to use the same
font."* There were **three families on one screen**: the display face on titles
and footer buttons, Inter on content, and **Arial** on the Ask button and every
chat and input control, left over from the earliest screens. Seven `font-family:
Arial` declarations, none of them deliberate; all now `var(--font-body)`, and
`.esf-ask` takes the display face so the footer's three buttons match.

What is left is a system: **display face for titles and buttons that act, Inter
for everything a person reads.** Sizes are one scale — 11 caption, 12.5 row,
15 figure, and one hero per screen — replacing the 10 / 10.5 / 11 / 11.5 / 12 /
12.5 / 13 drift that accumulated one trim at a time.

**Check it the same way:** walk `.journal-shell *`, collect computed
`fontFamily`, and look at the set. Three families means something inherited a
default nobody chose.

### "You could have" is a projection, not a promise

Owner asked whether *"over 5 years you could have"* breaks any promise
language. It does not, and the reason is worth keeping: it is conditional
(*could*), the rate it assumes is **printed beside every figure it produces**
("worth $26,567 at 7%"), and 7% is documented as a long-run average rather than
a recent return. D26 forbids telling somebody what to do; it does not forbid
showing what a saving is worth. The line to never cross is a figure with no
rate attached, or any wording that implies the money is certain.

### Icons: the owner's own artwork (2026-09-27)

Four rounds were rejected — emoji (*"janky and old"*), flat line icons,
two-tone SVG silhouettes, then a redraw of those (*"the icons continue to look
like shit"*). The owner ended it by supplying the set they wanted: **"use the
ones here"**, with an image of five sticker-style tiles.

`assets/cat-*.png` are that image, sliced into its five tiles and nothing else.
`BP_CATEGORY_ICONS` is now a map of ids to file paths, `bpCategoryIcon()`
renders an `<img>`, and the CSS plate that used to sit behind the SVGs is gone
because each file carries its own coloured plate. **Do not redraw them.** If a
sixth category is added, ask for its tile.

The slice, for the record: the source is 809x170, tiles 136x136 at x = 13, 176,
340, 504, 668, y = 6. Order in the image is car, house, boat/RV, jet, bag —
**not** the order of the rows, so the mapping is explicit in the object.

### No em dashes in product copy (2026-09-27)

Owner: *"it sounds and looks like AI slop. the tone is right, but the use of
the em dash is an AI give away."* The landing lead was *"The real cost of a big
purchase isn't just what you pay for it — it includes using and maintaining
it."* Two tells in one line: the dash, and the "it's not just X, it's Y"
construction. It is two plain sentences now.

Swept the whole feature at the same time: thirteen in `data/buddy-bp.json`,
three in the screens. **Zero em dashes render in tester-facing text**, and the
check is one line in the console:

    (document.body.innerText.match(/\u2014/g) || []).length

Comments and these docs keep theirs; they are for us. The one exception on
screen is the `—` used as an empty-cell mark in the comparison table, which is
a symbol rather than punctuation.

### The fund box must look UNANSWERED (2026-09-27)

Owner: *"this doesn't indicate a user should make a selection. it looks like
it's preselected and something will happen, but nothing does… having the start
one now selected in green isn't working so need to try something else."*

The green "Start One Now" was the owner's own earlier call and it backfired for
a reason worth keeping: **one tinted button among three plain ones is the
universal look of a chosen option.** The box read as already answered, so the
tester went straight to the car. A different highlight would have had the same
problem; the answer is no highlight at all.

Three changes, and the `strong` flag is out of `BP_ESF_CHOICES` rather than
just unstyled:

1. **All three options identical** — nothing can be mistaken for a selection
   already made. Each carries a plain sub-line (*I have one · I need one*), so
   they read as three answers rather than one button and two footnotes.
2. **An instruction, not a hint.** A small accent eyebrow, `TAP ONE TO
   CONTINUE`, above a question shortened to *"Do you have an Emergency Savings
   Fund?"*.
3. **The box looks outstanding.** Dashed border with a solid accent spine down
   the left, which is visibly a task. Answering swaps it for the solid,
   ticked, one-line confirmation it already had — so the tester sees the state
   change they caused, which is the thing that was missing.

**Nothing here blocks the flow** (that has been the rule since 2026-09-22), and
"Tap one to continue" is a nudge, not a gate — the category rows stay live.

### We do the maths (2026-09-27)

Owner, on step 3's option chips: *"this screen is making users do math and it
shouldn't. it should show how much money is saved and then how much that could
be worth over the 5 years. it's this kind of insights we give to our users to
help make finance easy and approachable. we do the math… we offer the
data-driven insights. they make the decisions."*

The chips printed each option's five-year TOTAL — $124,500 next to a pick
costing $145,211 — so the one thing the tester wanted was a six-figure
subtraction they had to do in their head. Each chip now says the **saving**,
and under it what that saving is **worth kept at 7%**. Nothing on the chip
needs anything done to it.

**Treat this as the standing test for every figure in this tool: if a screen
shows two numbers whose difference is the point, show the difference.** The
invested figure comes from `bpOpportunity()`, the same function behind the
options screen's money-saved row, so the two screens cannot disagree.

### The monthly payment is NOT a second copy of the car (checked 2026-09-27)

Owner: *"the monthly car payment should only be the car loan payment (it looks
like the monthly is included and counted twice). I doubt a $55K car really
costs $98K in 5 years."* Worth checking properly rather than reassuring, and
the model holds. A $55,000 premium car, Nashville, 10 miles a day, 20% down at
the default 600-660 band:

| Row | |
|---|---|
| The car itself | $55,000 |
| Tax, fees and paperwork | $4,395 |
| Keeping it on the road (60 mo x $392) | $23,520 |
| Interest to the lender | $12,909 |
| **Five-year total** | **$95,824** |

The same money counted the other way — down payment $11,000 + 60 payments of
$1,020 + 60 months of running $390 — is $95,600. The two agree to a rounding
stub, which is the proof there is no double count: **60 payments equal the loan
plus its interest** ($48,395 + $12,909 = $61,304 against $61,200 shown), so the
payment row IS the car, arriving monthly, not a charge on top of it.

**What actually makes the number big is the credit band.** The data's default
is `600-660` at 9.71%, which puts $12,909 of interest on this car. At 661-780
(6.15%) it is about $8,000. A buyer of a $55,000 premium car is more likely in
the higher band, so the default flatters nobody — raise it with the owner
rather than changing it quietly, since it moves every figure in the tool.

### ONE ROUNDING, EVERYWHERE — the numbers have to add up (2026-09-27)

The owner reads down a screen and adds it up. Twice in one pass they caught
figures that did not tie, and both were display rounding rather than maths:

- *"why don't Monthly use and Maintenance $800/mo equal Total $760 in the table
  below?"* — the summary rounded to the nearest hundred, the table to the
  nearest five. `bpMoney100()` is now used **nowhere**; it is kept, with its
  argument written on it, but every screen prints `bpMoney()`.
- *"step 2 shows 2150 monthly, which doesn't match $1,400 + $760"* — step 3
  rounded the SUM of the raw payment and the running cost; step 2 rounded the
  payment alone. **Rounding the parts and rounding the total are different
  sums.** `bpAmortize()` now rounds the payment **once, at the source**, so the
  schedule, the interest and every total are built from the $1,390 the screens
  actually print. `bpMonthlyPayment()` / `bpMonthlyAllIn()` are the only ways a
  screen should get at it.

Year 1 ties exactly: down payment + 12 payments + 12 months of running. The
five-year total does not equal 60 × the payment, and should not — the last
payment of a rounded schedule is a stub, so it is about $100 under.

**If a figure appears on two screens, it must be the same figure.** Anything
that looks like false precision is fixed by changing what is computed, never by
rounding one of the two places it is shown.

### The six rows are a designed block, not six dashed bands (2026-09-27)

Owner: *"this legit looks ugly. use your best head of design."* The wording is
untouched — it is theirs, verbatim. What changed:

- **A figure column.** Labels flex, figures sit right in a fixed column with
  `tabular-nums`, so the digits stack and the eye runs down them. The bracket
  used to push every number to a different x.
- **Groups made of air, not rules.** A dashed line under all six rows gave six
  equal bands and no shape. They are really three questions — what it takes to
  drive it away, what it takes each month, what it comes to — so a 6px gap
  separates those and the dashes are gone.
- **One hero.** The five-year figure is the answer, so it is the only large
  green number, on its own tinted band at the foot of a white card. The card
  used to be tinted throughout, which made the band invisible.
- **`/mo` is a unit**, set smaller and lighter, never part of the figure.

### Step 2 is six rows, in the owner's words (2026-09-27)

Owner, verbatim: *"I want to split this out and give step by step so users
understand the math with pure clarity… I don't want subtext. I want the info
displayed in parenthesis after the line."* Bold label, italic non-bold bracket
**on the same line**, figure right. `renderBpCostLadder()`:

1. **Car Price** *(car + accessories):*
2. **Down Payment at purchase** *(20% of Car Price)*
3. **Monthly Car Payment** *(car loan)*
4. **Monthly use and Maintenance**
5. **Year 1 Cost** *(all-in)*
6. **Cost over 5 Years** *(all-in)*

Two things the wording forced:

- **Car Price includes the accessories**, because the bracket says it does — a
  home charger or a motorcycle's gear. The down-payment percentage is therefore
  computed from *that* figure, not printed as a flat "20%": on a car with no
  accessories they are the same number, and on an electric one they are not.
  A row whose job is to explain itself must not be the row that is wrong.
- **Paying cash, rows 2 and 3 do not exist** — there is no deposit and no
  payment — so a single "Paid at purchase" row stands in their place.

Row 2 is the only one whose bracket wraps. `white-space: nowrap` was tried and
pushed its figure 54px off the right edge; a wrapped bracket is still the same
line of copy, the separate sub-line underneath is what the owner cut.

### The loan question is the FIRST thing on step 2 (2026-09-27)

Owner: *"we need to know if its financed because the estimated costs are
assuming its financed."* Every figure on the screen moves with the answer, so
asking underneath them showed a table built on an unstated assumption and put
the switch below it. Worded **"Will you need a loan?"** with *"Yes, car loan"*
and *"No, paying cash"* — the owner's doubt that everyone reads "financed" the
same way is a fair one, and these answers name the thing either way.

### Fuel: the owner's mpg, and the owner's pump price (2026-09-27)

`mpg` is car 24 · SUV 15 · minivan 19 · truck 14, and
`pumpPricePerGallon` is **4.25**.

The mpg figures were raised earlier the same day, on a read of *"fuel costs
seem way off"* as meaning too high. It meant too **low**. The owner showed the
arithmetic they expect — *15 miles a day × 30 days ÷ 15 mpg × $4 a gallon* —
so a gas SUV is 15 mpg here and the pump price is the owner's, not the
emergency fund's. **When a complaint about a number is ambiguous in direction,
ask; do not pick one and rebuild the table around it.**

The pump price is this tool's own on purpose. The ESF prices a bill being paid
this month, where the EIA's $3.15 national average is right; this prices five
years of fuel from whenever the car is bought. `bpVPerGallon()` takes the
HIGHER of the two, so California keeps its $4.65 rather than being dragged down
to a floor meant for everywhere else. Diesel still adds its premium on top.

### Insurance is a full-coverage premium (2026-09-27)

The ESF's state figure is the **average premium written** in that state, and
most of those policies are liability-only on a paid-off car. Everything here is
being bought, usually on a loan that requires comprehensive and collision, so
`factors.insuranceFullCoverage` (1.6) scales the base **before** the type, tier
and age factors run. Owner: *"insurance seems way too low"*.

### There is no subscriptions row (2026-09-27)

Owner: *"remove subscriptions from the costs. that is an add-on that I wouldn't
consider for a car alone."* Satellite radio and the connected-car app are
things a person opts into; a screen that claims to price the car should not
price them. The row is out of `BP_VEHICLE_ROWS`, out of `bpCostLines()` and out
of `BP_CMP_ROWS`. The figures and `bpVSubscriptions()` are left in place, so
putting it back is one array entry — but do not put it back unasked.

### Money saved is a grid, not two flex columns (2026-09-27)

Owner: *"this screen is so misaligned… line it up exactly… line all this up in
a single line."* Two right-aligned flex columns of different widths gave
captions at different x, figures off each other's baseline, and a pencil
hanging off one number. `.bp-bag-row` is a three-cell grid (art, saving,
invested); each cell is caption over figure, so both pairs line up whatever the
captions say. The 7% the invested figure assumes was never stated anywhere —
it is its own line underneath now, and that line is the control that opens the
rate sheet.

### Diesel is hidden for minivans and motorcycles, on purpose

`fuels[].hideFor`. Neither is sold as a diesel in the US — diesel minivans are
a European body style, and diesel motorcycles are essentially military-only.
The list offers what a tester could actually go and buy.


### A used car is 28% off, not 20% (2026-09-27)

`alternatives.usedCut`. Owner: *"used price feels too low, especially compared
to other brand"* — the used card was saving a fraction of what one tier down
saved, which made it look like the weak option rather than the near one. Most
of what a car loses goes in its first two or three years.

### The option cards quote the PLAIN saving (2026-09-27)

They used to print the **invested** figure under "Save up to" while the
headline above printed the plain five-year saving, so one screen carried two
different numbers for the same choice. The cards now say "Saves over 5 years"
and the invested figure stays where it is explained — the money-saved row
inside the detail. Their copy also names the alternative (*"A 1-3 year old one,
about $43,200"*) before characterising it; the old "don't be car poor" quip
never said what was being offered (owner: *"the copy under used and other brand
is terrible, it doesn't make sense"*).

### Onboarding docks its choices too (2026-09-27)

The two questions in front of this flow (ZIP, miles) now match the calculator's
own manners: choices at the **bottom** in thumb reach, and **no Continue** on a
tile question — the tap is the answer and the answer is the advance (owner:
*"user is seeing a choice and just clicking. they can change if needed or go
back"*). Scoped to `BP_ENTRY` in `onbDocked()`, because the same renderer still
serves the emergency fund's longer onboarding run.

### The 3-year figure is gone

Removed on the owner's call (2026-09-26). It appeared on no screen after the
five-way split, and a second horizon printed beside the first reads as a rival
answer to the same question. `horizons.secondary` is out of the data file and
`stack3` is out of the saved plan. **Everything is 5 years.**

### Trap: perl one-liners double-encode this repo's files

Three separate rounds of mojibake — `600â660` in the credit labels, `$200 â
$225` in Buddy's ranges, a whole comment block in `bp-engine.js` — all from the
same mistake: `perl -0pi -e` reading a UTF-8 file as BYTES and writing back a
string containing a wide character. Perl then encodes the whole buffer again,
so every existing `–` becomes `â€"`. The damage is invisible in a diff viewer
and shows up on screen days later.

**Use the Edit tool for these files.** If a shell edit is genuinely needed,
either keep the replacement pure ASCII, or open with explicit layers:
`open my $in, "<:encoding(UTF-8)"` … `open my $out, ">:encoding(UTF-8)"`.
Check afterwards: `grep -c "Ã¢" <file>` should be 0.

### Trap: a grid label with `nowrap` pushes its own row off the grid

A `1fr` track has `min-width: auto`, so a `white-space: nowrap` label does not
shrink — the track grows past the container and drags the figure columns right
with it. One row's numbers then sit further right than every other row's, which
is exactly what "May need: Home charger" did. `min-width: 0` on the label is the
fix; an ellipsis is the fallback, and a smaller label is better than either.

### Trap: a typed field followed by a tap

A field commits on `change`, which fires on the blur caused by the NEXT tap's
pointerdown. If that handler calls `render()`, the tapped button is replaced
before the finger lifts and the click is lost. The keypad latch holds the
layout, not the node. Every BP typed field commits through `bpFieldCommitted()`
(`screens/bp-sheet.js`), which queues the repaint when a press is in flight.
**The ESF screens inherited from v3.1 still have this bug** — typing rent and
tapping Continue needs two taps. Not fixed here; it lives in B as well.

---


### Cost screen rulings (owner, 2026-10-03)

- Header reads "What it costs to own" with the make's logo beside the car name; the
  deal line is "New/Used · $ sticker price · $ down", 15px bold.
- One expense table, this car bold, peers plain at 13px behind a vertical rule, with the
  peer footnote and the assumed miles INSIDE the card. Regular and bold only, one font.
- **Ways to spend less (per month)**: measured against `bpfOrigin()`, the car the tester
  CHOSE. The original stays in the list as the first row so it is one tap away; trying
  an option (`bpfChooseAlt`) changes the costs and outlines the row, never the list.
  Rows: same car used (new only), cheapest in the class (only if it costs less), and
  "<tier> range, what peers spend", which opens the cars in that range (we do not
  assume peers own a used or any particular car). Model name only, one line (the
  logo carries the make). Lowest monthly is green; the saving is the bold figure.
- Logos: 17 Simple Icons SVGs + 6 PNGs from filippofilip95/car-logos-dataset, in
  `assets/img/logos/`, mapped in `BPF_LOGO_FILES`.

### The post-finder screen: `bpYourCar` (owner, 2026-10-03)

The finder's Continue now goes to ONE screen, `screens/bp-yourcar.js`, instead of steps 1 to 4
(those screens still exist but the new flow no longer walks them): the car's name and logo at
the top; one sentence on what the screen does; a single "Change your mind? / Choose a different
car" button that opens the cost screen's options in a sheet (`renderBpfSave`, `bpYcAltsSheet`);
**Paying for it** (price, Loan/Cash, down payment, loan length, credit score, amount
financed, the old step 3's own controls); **Planning for it** (down payment, already saved,
still to save, by when, then Set my goal = `bpCommit`). No arithmetic of its own: `bpStack`,
`bpBreakdown`, `bpSaveToAfford`. Fits one screen for loan, cash and "savings cover it".
**Leasing is NOT built yet**; owner asked for it as a payment option throughout (scope open).
- **Leasing (owner, 2026-10-03: "only include lease in this last screen")**: `js/bp-lease.js`.
  A third segment, Loan / Cash / Lease, on `bpYourCar` only (flag `pay.leasing`; the loan/cash
  engine and every earlier figure are untouched, the finder's cost table stays loan-based).
  New cars only (Lease is dimmed on a used one). Rows: due at signing, lease length, miles a
  year, credit score (the same sheet); the monthly is the standard formula in the file's
  header, an ESTIMATE (`_prototype`: residual 64/58/50% for 24/36/48 months at 12k miles,
  1 point per 1,000 miles, money factor = APR / 2400, sales tax on the payment). Planning
  reads "Due at signing". The saved goal carries `payMode: "lease"`.
- **The goal names the car** ("Save for the BMW X3 (new)") when it came from the finder.
- **Cost screen round 5 (owner, 2026-10-03):** the expense table is tinted (accent-soft,
  2px accent border) so it is the thing to look at; every box on these screens has a 2px
  border. The options box is **"Alternative cars that can save you money"**: two columns,
  *Saved per month* and *Saved over 5 years\** (the footnote says the money is invested at the
  saved rate, 7%), `bpfSavings`; loan and cash rows use `bpOpportunity`, a lease and the peers'
  range use `bpfGrowth` from the figures on screen. **Lease is now also in "How we worked it
  out"** (Loan / Cash / Lease), and while `pay.leasing` is on, `bpfFigures` returns lease
  figures for new cars (peers always stay loan-based, `{noLease:true}`). This reverses
  "lease on the last screen only". The calc panel's controls are condensed (26px segments).
