# Current app contracts

Read alongside app/docs/architecture.md. docs/workflow.md governs operations; progress logs are historical. Tracking is now frozen by release configuration; see docs/publishing.md.

## Traps that fail silently

Each of these produces a plausible-looking wrong result rather than an error.
All verified against the raw JSON on 2026-08-07.

- **`base[cat][band]` is a 4-element ARRAY indexed by `householdSize − 1`.**
  Household 2 → index **1**. `4+` clamps to index 3. Reading `[householdSize]`
  returns the next household's figure.
- **Cost of living is BEA Regional Price Parities, not the tier table.**
  `benchColMultipliers(zip)` is the only chokepoint: ZIP → county → BEA
  geography → four price buckets, then a **per-category** local modifier
  (housing from county rents, utilities from state electricity prices, nothing
  else — see architecture §5). `peer-benchmarks.json`'s `colTiers` survives only
  as a guard; **never read it directly.** Its four tiers gave Manhattan, Palo
  Alto, Santa Clara and LA all the same number and capped housing at 1.85.
- **`benchSelfTest` no longer asserts the spec's 370.** That figure carried the
  old `very_high` tier's 1.34; BEA prices LA restaurant meals at 1.071, so the
  peer value is 295. The test now checks base, lifestyle and cost-of-living
  separately — stronger than the single assertion it replaced.
- **Lifestyle is a product across six dimensions**, not one lookup.
- **`paysRent` data keys are the strings `"true"` / `"false"` / `"shared"`**,
  not booleans. The wizard's option values map onto them via `benchLifestyleKey`:
  rent/mortgage → `"true"` (×1.0), family → `"false"` (×0.22, rent-free),
  other → `"shared"` (×0.6, the middle housing tier).
  **`commute`'s key for "mostly walk" is `none`.** A missed key silently
  contributes 1.0.
- **`_note` keys sit alongside real data** in `monthToDateActuals`,
  `PEER_BENCHMARKS.base`, `zipPrefixes`, and `lifestyleModifiers`.
  **Always iterate `CATEGORIES`, never `Object.keys(data)`.**
- **Lesson framing options key on `tag`, singular.** A `.tags` lookup collects
  nothing and plays the fallback variant every time.
- **The self-reported layer is `monthToDateActuals`** ($429 dining), *not* the
  sum of `journalHistory` (~$168). Getting it backwards breaks every observation.
- **`state.monthlyIncome` is not a take-home figure**, despite the seed JSON key
  still reading `monthlyIncomeNet`. It is `profile.incomeAnnual / 12` — what the
  tester said, no tax factor. Separate from `state.userProfile.monthlyIncome`,
  an unrelated v2 form field.
- **`travelFrequency`'s middle option is a ×1.0 no-op**, and the dimension moves
  only `Other`. Picking "Now and then" was mathematically identical to never
  answering, which is why its figure looked broken. Travel is now an explicit
  trips × cost ÷ 12 line inside Other and is exempt from the wizard's slider
  bands, because its figure is composed rather than `base × multipliers`.
- **Closing the simulated keyboard moves the layout by 250px**
  (`.screen-scroll.kbd-open`), so anything that closes it mid-gesture pulls the
  button out from under the finger and no `click` is ever dispatched. That is
  why `kbdInit` holds the close while a button press is in flight, and why
  `render()` calls `kbdSyncAfterRender()`.
  **BOTH focus handlers have to respect that latch, not just `focusout`.**
  Chrome and Edge focus a `<button>` on mousedown, so pressing Continue fires
  `focusin` with the BUTTON as target — and that path closed the keyboard
  synchronously, defeating the latch entirely. Safari and Firefox on macOS do
  not focus buttons this way, so the bug is invisible on half the machines you
  might check it on. Any test for this must fire the **whole** sequence:
  `pointerdown → focusout(field) → focusin(button) → pointerup → click`.
- **Both narrated players snap the clock forwards only.** `elapsed` is normally
  ahead of the current cue (the speech cap lets the tick run to just short of
  the next one), so an unconditional snap rewinds it — and the hyperframes
  faithfully rewind with it, which reads as a flicker at every line boundary.
  There are THREE snap sites: live speech in the lesson player, live speech in
  the onboarding player, and the onboarding `.wav` `onplay`.
- **A capped clock has to hold the PICTURE too.** When speech drives playback,
  the tick freezes `elapsed` at the speech cap and waits for `onEnd` — but the
  hyperframes are native CSS animations running on wall clock, so they carried
  on. Every 100ms tick then found them ahead of the frozen clock and
  `hyperframesSync`'s 120ms drift check yanked `currentTime` backwards, roughly
  eight times a second for the length of the overrun. That is a visible,
  erratic stutter and it fires on any line the narrator takes longer over than
  165 wpm predicts — two- and three-sentence lines, because sentence-final
  pauses are not in the word-count estimate. Both players now pass
  `playing: false` while held (`onbVideoHeld`, `lpHeld`), which pins the
  animation instead of fighting it.
- **A skipped onboarding field falls back to a PROFILE, never to the persona.**
  Every write in `onbFinish()` is guarded (`if (o.zip) …`), which is correct — an
  unanswered field must not clobber an answered one. What was wrong was what sat
  behind the guard: `bootV3`'s persona seed, so skipping quietly made the tester
  Sam from Los Angeles on $68,000 and nothing on screen said so. Every figure
  downstream was anchored on a profile nobody chose. `profileDefault()` is the
  fallback now. Related: `o.name || "Buddy"` made the **tester** "Buddy", the
  same as the dog — the person is "Me".
- **An unnamed buddy had three different fallbacks.** `"Buddy"` on Home and in
  Chat, `"Your buddy"` in the character frame. `onbFinish()` now names it once at
  the source so every surface agrees; the display-time fallbacks stay as
  belt-and-braces.
- **A BUDGET IS A MONTH. Never pro-rate one.** The Help-me-out questions first
  shipped on `estimatorCompute()`, which multiplies every option by
  `estimatorMonthFraction()` — right for "what have you spent so far this
  month", catastrophic for a budget. On the 4th of a 30-day month every answer
  came out at 13% of itself: "light local driving" became **$10** of transport,
  "a regular ongoing cost" became **$20** of healthcare, and picking the most
  expensive option still *lowered* the category, because the peer default it
  replaced was eight times larger than anything the sum could return. Nothing
  in `js/help-me-out.js` reads a clock, and `sweep.js` §7 stubs
  `estimatorMonthFraction` and asserts no tree's figure moves.
- **Never reach past `benchColMultipliers()` to price a place.** The Utilities
  model looked up `state.utilitiesRatio` itself to price local electricity —
  but `benchColLocalModifier` already returns exactly that ratio for Utilities,
  so the category multiplier carried it and the model squared it: Los Angeles
  at 1.353 x 1.648 x 1.648, a 65% overstatement, every figure still looking
  like a plausible power bill. Same shape as the retired `colTiers` trap.
  Utilities now applies the multiplier itself, to **power and water only** —
  broadband and a mobile plan are priced nationally, and a blanket multiplier
  overstated them by more than the double-count did.
- **`.screen input` outranks a bare component class, and it sets a background.**
  `.screen input, .screen select, .screen textarea` is (0,1,1) and applies
  `background: var(--card)` plus a card radius. A component class like
  `.band-range` is (0,1,0) and **loses**. This is invisible for every slider
  that keeps its native track — the element's own background is never painted —
  and lethal for the one with `-webkit-appearance: none`, which strips the
  track and lets that card background through as a full-width, 44px, rounded
  box drawn straight over the rail with the thumb floating in the middle of it.
  Any input styling that must win has to carry `.screen` itself. `sweep.js` §1b
  asserts every `.band-range` rule does, and `components.css` is injected into
  the sweep for exactly this class of check.
- **`--progress-bg` is a FILL, not an EDGE.** Against `--card` it is
  1.02–1.20:1 in all four themes — invisible. Anything whose *outline* carries
  meaning (a slider rail, where the thumb's position along it is the whole
  reading) needs `--rail` instead, which is gated at 2.0:1 by `sweep.js` §1b.
  The failure looks like a rendering bug — a thumb with no track — and no text
  contrast check will ever catch it.
- **`overflow-y: auto` is not a one-axis declaration.** When one axis is not
  `visible`, the other's `visible` **computes to `auto`** — so a rule meant to
  let a column scroll silently makes the element a scroll container
  *horizontally* too. Two things then break with no error and no scrollbar to
  hint at it: the `:focus-visible` ring (2px outline + 2px offset = 4px outside
  an input that is `width: 100%` of the content box) is clipped at both ends,
  and when a vertical scrollbar does appear it narrows the content so it stops
  lining up with anything outside the scroller. An outline is *ink* overflow,
  not scrollable overflow, which is why it clips without ever producing a
  horizontal scrollbar to explain itself. Fix: negative side margin plus equal
  padding, so the ring has room inside the scroller and the content box stays
  put. See `.journal-shell.onb-pinned .journal-body`.
- **A correction to a playing animation must GLIDE, not cut.** There is one at
  every segment boundary — the cue map is a word-count estimate and the narrator
  is not — and writing `currentTime` skips the outgoing beat's fade-out and
  starts the incoming one part-way through its fade-in. `hyperframesSync` nudges
  `playbackRate` for anything under `HF_SNAP_MS` and only snaps past it, so a
  scrub or a ±10s skip still lands instantly. Paused animations are always
  pinned exactly, because the hold depends on it.
- **`play()` on a FINISHED animation rewinds it to zero.** `hyperframesSync`
  knew this and still guarded on `playState !== "running"` — and a finished
  animation is not running either. Every element is one animation spanning the
  whole runtime, so they all finish while the narrator is still on the last
  line, and the tick flashed the entire scene back to its first beat ten times
  a second. Only `paused` and `idle` get `play()`; setting `currentTime` is
  enough to un-finish one.
- **The wizard composes answers from the BASELINE, never from the preview.**
  `preview = implied x drift`, where implied is the neutral peer figure times
  every applied modifier and drift is the tester's drag as a *ratio*. Scaling
  the live preview instead — which is what it used to do — compounds through
  rounding when someone toggles between options, and produced $10 groceries for
  "Very into it". Re-answering the same question clears that dimension's drift;
  answering a different one keeps it.
- **Paying a card in full costs nothing.** `lrSimBalance` returns 1 month and $0
  interest when the payment covers the balance, because that is the grace period
  the APR lesson teaches in its own script. It used to charge a month first.
- **There are TWO quiz screens.** `quiz` (`screens/quiz.js`) serves the v2
  catalog; `lessonQuiz` (`screens/lesson-outcome.js`) serves v3, and every v3
  lesson including APR goes through that one. Fixing the wrong one changes
  nothing a tester sees. `render.js` says which is which on its own subtitle
  lines.
- **HTML comments inside a template literal are rendered into the DOM.** Naming
  a function or a class in one puts that identifier in the markup and in any
  grep over it — which is how a deleted button appeared to still exist. Describe
  the thing, don't name it.
- **Onboarding's option lists must test `lifestyleAnswered`, not the value.**
  `state.onboarding.lifestyle` is seeded from the persona so the four dimensions
  onboarding never asks still reach `state.lifestyle`. Comparing that seeded
  value against an option renders it pre-picked — which is what put "Car" under
  the tester's thumb before they touched anything. `paysRent` only looked fine
  because its persona value is the boolean `true` and the option values are
  strings, so it never matched. Use `onbLifestylePicked()`.

Self-test for the benchmark model (`benchSelfTest`): Dining out, b3, household
2, ZIP 90066, foodie moderate + cooks sometimes. Base **275** and lifestyle
**1.0** are still exactly the spec's; the cost-of-living factor is now BEA's
1.071 rather than the retired tier's 1.34, so the result is **295**, not 370.
The three factors are asserted separately — see architecture §5.

## Hard rules

**Runtime**
- **No live LLM, no API keys, no network at runtime** (D02). Chat is a keyword
  matcher; benchmarks are static; the journal is structured.
- **No backend, no database, no localStorage** (D03). State is in-memory and
  resets on refresh. This is intentional.
- **The app runs on `file://`** — `fetch()` and XHR are blocked and there is no
  dev server. Data loads via `<script>` tags (`data/*.js`), never a network call.

**Code**
- Vanilla JS, everything global, plain `<script>` tags. Keep names unique and
  feature-prefixed. Load order in `index.html` matters.
- One global `state`; mutate it then call `render()`. No partial updates.
- **Always `h()`-escape** anything interpolated into an HTML template literal.
- **Inputs use `onchange`, not `oninput`** — a full re-render mid-keystroke
  destroys focus. Sliders are the exception, paired with `debouncedRender()`.
- **A `type="range"` slider on `oninput` must use `debouncedRender()`, never
  `render()`** — product sliders as much as admin ones.
  `render()` reassigns `.screen`'s innerHTML, destroying the element being
  dragged — the browser's pointer capture dies with the old node and the thumb
  stops tracking. State still updates immediately; only the repaint waits.
  If a handler serves both a slider and a button, pass a `live` flag rather
  than debouncing the button too (see `budgetSetPlan`).
- **Never declare a name in two files.** Everything is one global namespace, so
  the later `<script>` silently wins and the earlier becomes unreachable — not
  an error, just dead. `sweep.sh` §7b checks this; §7b's *reference* count
  cannot, because a shadowed function is still referenced.
- **`.item-card` is `display:block`, not flex.** Fix trailing children with
  scoped inline flex; never change the global rule.
- Style with CSS variables only, never hardcoded hex. **All four themes** must
  work (L21) — Light, Dark, Natural Light, Natural Dark. Adding a colour token
  means adding it to `:root` **and** all three theme classes, or the sweep fails.
- **Never hardcode a text colour over `--accent` or `--accent-fill`.** `--accent`
  is dark in the light themes and light in the dark ones. Use `--on-accent` and
  `--accent-fill-text`; `--on-dark` is only for genuinely always-dark surfaces.
- **A theme must never set `--chrome-*`, `--bg` or `--phone`.** They style the
  admin panel, page and bezel, which live outside `.screen` where theme classes
  are applied — the override is inert, and the frame is meant to hold still.
- **Surgical edits.** Change only what you're fixing. Never collapse files.
- **Do not delete unused code.** This is a prototype under iteration; something
  dropped today is something rewritten next week. `sweep.sh` §7b inventories
  unreferenced functions against a baseline and **warns only on new ones** —
  a function that was referenced and now isn't was likely orphaned by accident.
  Deliberately-unused code goes in `DEAD_BASELINE`, it does not get removed.
- **Never judge "is this used?" by grepping for `name(`.** Functions here are
  reached four ways: ordinary calls, `onclick` in screen template literals,
  `onclick` in `index.html`, and bare identifiers in dispatch tables. Only the
  first looks like a call. Use `sweep.sh` §7b — grep gets this wrong.

**Copy** — applies to every surface
- **No financial advice. Ever. Anywhere** (D26). Surface the number and the gap;
  never prescribe the action. **Any question asking what to do gets the
  safeguard reply** — `chatIsAdviceSeeking()` runs before keyword scoring (L20),
  because the library's own keywords miss most natural phrasings. Forbidden
  shapes in any copy you write: "you should", "we recommend", "cancel your",
  "switch to", "you must", "the best option is".
- **Frame flags as questions, not instructions.** "Haven't heard about Hulu in a
  while" — not "cancel Hulu."
- No exclamation marks in financial observations. Warm, plain, second person,
  sentence case.
- Tip banner is a hard **90-character** limit.
- **"Peers", never "average users"** — the data is an external mathematical
  aggregate, never real user data (D23).
- Fixed vocabulary: Buddy · Money Journal (never "expense tracker") · Charity
  Points (two non-converting tiers: 💎 diamonds = subscriber, 🦴 bones = free/ad;
  the old "Kibble" term is retired, though `state.kibble` stays as the internal
  bone counter) · Streak · Peers · Observation.

**Quality floor**
- **No screen renders empty** (D19). Fabricate a plausible value rather than
  showing a blank. Design for it; it can't be retrofitted cheaply.
- `prefers-reduced-motion` respected. Tap targets ≥44px. Keyboard focus visible.
- Mobile first — the phone frame is 390px.

## Adding a screen — 5-point wiring

A screen is **not done** until all five are complete, or the admin panel
silently degrades to its generic fallback:

1. `screens/<name>.js` → `render<Name>()` (+ optional `render<Name>Admin()`)
2. `<script>` tag in `index.html`, screens block
3. `js/render.js` → `renderScreen()` · `adminSubtitle()` · `renderAdmin()` · jump list
4. `js/utils.js` → `activeTabFor` (the nav stack is the real source of truth —
   see architecture §7; keep this as the admin-jump fallback)
5. `js/state.js` → `destinations[]`

Plus a **full-bleed mode class** if the screen hides the nav, zeroing *both* the
top-bar and nav offsets.

## Verifying

Follow [testing](testing.md): syntax, app sweep, path checks, publication tests, and
applicable PM checks. Node/JavaScriptCore availability must be checked, not assumed.
Keep useful regression tests. Data wrappers must match sibling JSON. Publication
tracking is independent of the untracked development sweep.

## Don't

Do not edit historical snapshots; ship fixes as new IDs. Current work belongs in app/.

- Don't build sprite-sheet `background-position` cropping. **L22 allows
  owner-supplied buddy illustrations, but they are separate files chosen by
  buddy state — not sheets addressed by offset.** D39's cropping machinery stays
  unbuilt.
- Don't delete the descriptive buddy frame now that art exists. It is the
  **fallback** (L22): no image set covers every breed x coat x pattern x eyes x
  nose x size x pose, and D19 forbids a screen rendering empty. A missing image
  must degrade to the description, never to a gap.
- Don't generate buddy art. D10's prohibition is on *generation* and it holds —
  the images are supplied by the owner.
- Don't add variants to "cover" unmatched lesson tags — falling through to the
  fallback is the design.
- Don't paraphrase `data/*.json` numbers into JS literals. Load them.
