# Buddy in the Emergency Savings Fund — Feature spec

Buddy answers contextual questions on the intro, capture and goal screens.
The panel explains what belongs in each row, prevents double counting through
disclosures and offers lifestyle questions that adjust opening estimates.
[Emergency-fund behavior](emergency-fund-spec.md) owns the expense model;
[the copy document](buddy-chat-esf-content.md) mirrors the content pack.

## 0. Files and boundaries

Paths below are under `app/`.

| File | Responsibility |
|---|---|
| `js/buddy-esf.js` | Panel state, entry/variant lookup, disclosures, questions and logging |
| `screens/buddy-panel.js` | Ask button, overlay, transcript, answers and navigation |
| `data/buddy-esf.json` | Per-screen entry lists, explanations and answer trees |
| `data/emergency-fund.json` → `lifestyleModifiers` | Questions, labels, recap fragments and multipliers |
| `css/components.css` | `.esf-buddy-*` and `.esf-ask` styling |
| `index.html` → `#buddyRoot` | Overlay paint target, sibling of `#screenRoot` |

This is a tapped tree, separate from Home's keyword matcher and its
`buddy-responses.json`. It uses no live LLM or working free-text input.
Keep figures in data and regenerate wrappers with `bash scripts/wrap-data.sh`.

## 1. Voice and content rules

Buddy supplies information and supports the participant's choice. Explain
composition and consequences without judging a cost's size or prescribing an
action. Coverage and buffer entries state what an option covers, then stop.
Use fifth-grade language and echo the tapped control's own words into the
transcript. Shared rent, mortgage and car payments mean the participant's share.
Escrow explanation precedes the mortgage share qualifier because double
counting is the main trap.

A question tree must be sufficient without typing a dollar figure. The row's
own input or range remains available. Medical questions cover plan level and
ongoing care; household size and ages already affect the opening estimate and
must not be asked again. Doctor-visit frequency does not determine a premium.

## 2. Panel and entry

Ask sits between Back and the primary action in the three-column ESF footer,
including the intro and plan. It uses supplied Buddy art with an emoji fallback.
The overlay renders in `#buddyRoot`, keeping it independent of keypad reflow;
`kbdInit()` owns the shared press latch. The current screen remains underneath.

The header groups Ask Buddy with the illustration and has no repeated row
subtitle. The transcript scrolls; `esfBuddyMountHook()` pins it to the newest
message. Adjacent Buddy paragraphs share one avatar at the end of their run.
Answers use scrolling buttons inside the frame rather than an OS-drawn picker.
Close is at the bottom left; tapping the scrim also closes the panel.

The visible question input is disabled, unfocusable and outside the tab order.
Its wrapper records `chat_input_tapped` because a disabled input dispatches no
events. It never opens the keypad or accepts text.

## 3. Conversation and navigation

Opening shows the screen's question list, even with only one entry. Answered
entries remain tappable and carry a tick. `esfBuddyItems()` uses the step's
ordered `items` list and filters entries whose ESF row is hidden.

Tapping an entry echoes its label, appends its explanation, and reports the
live figure only for a nonzero estimated row. Chips can set disclosures,
append replies and offer nested chips. `esfBuddyFindChip()` searches the tree.

After a conversation starts, the menu has three fixed slots:

| Action | Effect |
|---|---|
| Back to the list | Keeps transcript, abandons half-finished questions, shows the picker |
| Start over | Restarts the active question set; otherwise clears this step's conversation |
| Help me calculate this | Starts lifestyle questions for the open row when available |

Unavailable actions are disabled rather than removed. The initial untouched
list has no menu. Answer choices and navigation stay in separate racks.
`esfBuddyApplyFigure()` keeps the panel open and returns to the list after use,
with the transcript intact and the updated row visible underneath.

Opening on a different step clears the transcript, selected entry, ticks,
questions and applied flag. Disclosures survive step changes. A fresh
`esfStart()` clears both, since they belong to that expense session.

## 4. Lifestyle adjustment

Read the lifestyle headers in `js/buddy-esf.js` for the calculation and handback.
Each selected option multiplies the row's **opening** estimate. Repeating the
same answers must not compound a previously adjusted value. Each question has
an option with multiplier 1.00; all-neutral answers preserve the base.

The assumption that peers represent a middle lifestyle is a prototype
assumption. Multipliers are invented and flagged `_prototype` in
`emergency-fund.json`, rather than hidden as model literals. `label` is the
recognizable choice; `short` is its recap fragment. Keep brand casing intact.

Buddy proposes a figure and waits for **Use $…**. Applying selects the band
containing that figure via `esfBandFor()` and writes its midpoint through
`esfSetRange()`, marking the row touched. The full-width Use action sits above
the fixed menu. No lifestyle result writes back to the profile.

## 5. Variants and cross-screen disclosures

Medical copy resolves `variantOn: "employerCoverage"` through
`ESF_BUDDY_VARIANTS`. Employer coverage explains replacement insurance;
the other variant explains ordinary out-of-pocket costs. Read paragraphs and
chips through `esfBuddySayFor()` and `esfBuddyChipsFor()`, never directly from
raw `say`/`chips` fields on a variant entry.

`esfDisclosures()` initializes four keys to `null`. Never asked differs from
an explicit false. `ESF_DISCLOSURE_EFFECTS` defines affected rows, effect,
replacement note and the source entry to reopen.

| Disclosure | Asked on | Applies to | Effect |
|---|---|---|---|
| `rentIncludesUtilities` | Step 2, Rent | Step 3, `power` | Zero |
| `mortgageIncludesEscrow` | Step 2, Mortgage; also tax/insurance entries | Step 4, `propertyTax`, `homeInsurance` | Suppress opt-in |
| `leaseIncludesMaintenance` | Step 2, Car payments | Step 3, `carCosts` | Note only |
| `noCarAtAll` | Step 3, Car costs | Step 3, `carCosts` | Zero |

When effects collide, zero outranks suppress, which outranks note.

1. **A disclosure sets a default. It never locks a row.** The user can always
   open the dropdown and pick anything.
2. **Touching the row retires the note.** Zero effects deliberately do not mark
   the row touched; otherwise the explanation for zero would disappear.
3. **The note replaces the "Based on" line, it does not join it.** It must not
   add height to the compact capture screen.
4. **Reversible from either end.** Changing the answer unwinds the effect — and
   unwinding restores the **opening estimate**, not a leftover zero. Tapping
   the note reopens Buddy on the claim.

`esfApplyDisclosure()` leaves touched rows alone. Suppressing an opt-in row
also un-adds it. Undo logs when an earlier true changes to something else.

## 6. Content by screen

Visible progress counts 1–5; capture state counts 0–3, with a separate plan.
The content pack's step keys must stay aligned with this mapping.

| Visible step | Pack key | Content |
|---|---|---|
| 1, intro | `0` | Fund definition, what is asked, duration |
| 2, Housing and Car Payments | `1` | Shared payments and double-count disclosures |
| 3, Keeping things running | `2` | Five estimates with lifestyle question sets |
| 4, Living-related Expenses | `3` | Minimum debt, owner costs, HOA and anything else |
| 5, goal | `plan` | Coverage, buffer, saved amount, date and headline |

Debt is explain-only: its situation-labelled dropdown supplies the figure.
No multiplier applies to a row with no opening estimate. Copy and the actual
question/option strings live in the linked data files, not in model literals.

## 7. Data contract

An entry has `label`, optional ESF `row`, and `say` paragraphs and/or `chips`.
A chip has `id`, `label`, optional disclosure `sets`, reply paragraphs and
nested chips. Variant entries use `variantOn`, `sayIf` and `chipsIf` instead.
Only fields the model reads define behavior; metadata notes are not entries.

- Iterate step `items`, never every key in `rows`; metadata sits alongside copy.
- Entry labels serve both the list and the user's first bubble.
- Resolve variants before rendering or looking up any chip.
- Keep `short` fragments with lifestyle options and numbers in JSON.
- Add no participant copy during structural cleanup; copy changes need their
  own product scope.

## 8. Instrumentation and verification

Events use capped, in-memory `state.esfEvents`: `chat_opened`, `chat_closed`,
`chat_row_picked`, `chat_help_started`, `chat_question`, `chat_applied`,
`chat_restart`, `chat_input_tapped`, `disclosure_set` and `disclosure_undo`.
`chat_applied` records the proposed figure and selected band; the row stores
that band's midpoint. The experiment relates panel use to touched-row counts
already logged by capture completion.

Run `bash scripts/check-all.sh`; [testing](testing.md) describes journey and
browser checks. For manual checks, inspect rendered chips and transcript,
variant copy, disclosure undo and row totals, text overflow, panel scrolling,
keypad interactions and all four themes. A refresh starts a fresh participant
session; Pin on refresh retains the app/Flow choice, not its answers.
Broader proposals belong in [future work](future-work.md).
