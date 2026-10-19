# Current app contracts

Read the sections relevant to the implementation being changed alongside the
[architecture](../app/docs/architecture.md). Start with Hard rules and the affected
behavior; use [code health](code-health.md) for maintenance and removal review.
[Workflow](workflow.md) governs operations; [publishing](publishing.md) owns frozen
release tracking. Decision IDs (L##, D##) are in [decisions](decisions.md).

## Combined prototype behavior

The single editable `app/` starts at full onboarding by default and finishes at
Home, with all tabs available. Supported HTTP(S) study links can enter at an
allowlisted `?screen=` destination after boot; they do not remove the full-product
journey. Emergency savings is reached from tasks and Goals.
Onboarding combines ZIP/income refinement, household ages/kids, housing type,
coverage and driving questions with the single Buddy picture and name/pronouns.

`BUDGET_PAYWALL = true`: the Budget tab shows $14.99 monthly / $124.99 annual.
Both checkout buttons are placeholders. This is a tab-only gate; task, builder,
category and supported deep-link routes can still reach budget features.
Every Buddy stage draws the one illustration whatever the appearance attributes
say; the description card shows only when the image fails to load.
Framing questions are asked on every lesson entry, even when the session
already answered them. A theme with no onboarding film render of its own plays
another look's render; a film rendered in no look falls back to the SVG engine.
The budget band compares spend to date with whole-month budget and peer
figures; it never scales them to the date. "Skip all setup" always opens the
picker of nine starting profiles (L26).

### ESF budget exception (user approved)

Ordinary builders use `submitBudgetBaseline()` and confirm replacement of an
existing budget; they never write `state.budget` directly.
**Creating or editing the ESF goal immediately replaces the
budget through `applyBudgetBaseline()` and returns to Goals, without a replacement
confirmation.** This also discards an older pending builder proposal. Repeated
saves leave exactly one emergency-fund goal; reopening keeps the session's figures.
No separate confirmation or preservation of the previous budget is intended.

ESF keeps the source expense calculations and prototype assumptions. Buddy's ESF
panel is a local question tree: shared-payment guidance counts the user's share;
disclosures prevent rent/utilities and mortgage/escrow double counting; lifestyle
answers scale the opening estimate and apply a selected band only on confirmation.
The existing Home chat remains a keyword matcher. No backend, API or persistence
is added. Development tracking remains off; releases control tracking.

### Big Purchase Calculator

See [Big Purchase](big-purchase-spec.md). The calculator
opens from the Goals tab's "Estimate a big purchase" card (`bpOpen()`) and the
full-app admin jump list. Full onboarding and all product tabs remain available.
Calculator-first setup and contained presentation belong to the standalone Big
Purchase Flow (see One product: no journey switches).

The calculator writes `state.bp` (in-flight run, reset by `bpStart()`),
`state.bigPurchase` (the saved plan) and `state.bpEvents` (session log). Commit
creates at most one `purchaseSaving` goal and replaces it on repeat; it never writes
the budget. "Start One Now" opens the ESF with `state.bp.esfReturn`, so Back from
the fund returns to the calculator rather than onboarding. The `bp`/`bpf` prefix
belongs to the calculator; the Budget paywall uses `paywall*` names. Figures marked
`_prototype` in data/big-purchase.json are estimates, not quotes.

## One product: no journey switches

`app/` is the full product as one cohesive journey: `app/` on main, with each
setting at its recorded value. A focused, shortened or reordered journey for a
study, demo or feature review is a Flow, made with the
[create-flow](../.claude/skills/create-flow/SKILL.md) skill
([Flows](flows.md#configure-the-journey)), never a switch in `app/`. Judge a switch by the journey it changes, whatever its name.

**A journey switch** is a value decided before or outside the tester's session (a
constant, config entry, build step, script inclusion, URL or storage value, or an
edited default) that makes the app present a different journey from the full
product. It changes where the app starts or hands off; which steps, screens, tabs
or controls exist or are reachable; or what Skip, Back, Continue or completion do.
Or it exists to be flipped for a particular study, demo or feature focus. Editing a
setting, a default or `ONB_STEPS` for a study is a switch even if reverted later or
used only for a snapshot.

Telltales:

- `typeof X !== "undefined" && X` on a setting (not a data-presence guard), or a
  guard on a name declared nowhere in `app/`, which something outside could inject.
- One setting read across unrelated files; parallel data such as alternate step
  lists; switches that only work in combination.
- Hooks left for Flows: a function that always returns the same value, or a branch
  on state that nothing in `app/` writes.
- Behavior that depends on whether a script is listed in `app/index.html`.
- Branches no tester can reach by using the app or Tools; comments such as “for this
  build” or “for this study”.

**Not journey switches:**

- Session state set by what the tester does (answers, Skip, picks, saved plans),
  and product rules applied the same way for everyone from data such as the profile.
- Reviewer Tools actions such as the theme picker, profile switcher, jump list and
  fixtures. Fixtures may fill answers but never change step lists, controls or where
  the journey ends.
- Release configuration (`MB_RELEASE` tracking and selector; see
  [publishing](publishing.md)) and the tab's reviewer settings listed in CLAUDE.md,
  such as Pin on refresh.
- Participant URL parameters in app/docs/useberry.md. New `?screen=` links follow the
  rule in `js/screen-url.js`: open a screen that stands on its own through the
  product's own start function, inside the full journey, without hand-off or return
  state. A study that needs a contained or shortened journey uses a Flow.
- The recorded product setting `BUDGET_PAYWALL = true` (L27), kept at its
  recorded value; changing it is a product decision, never a study. A new
  journey-affecting setting needs a recorded PM decision; see
  [decisions](decisions.md).

**Review questions** for any `app/` change, at intake and before a PR:

1. Is a new or changed value decided outside the tester's session?
2. Does it change the journey as described above?
3. If unsure: can a tester reach every branch by using the app or Tools?

A yes to the first two (or a no to the third) means a journey switch. Move the
behavior into a Flow, or record an approved product decision in
[decisions](decisions.md) first.

## Traps that fail silently

Each of these can produce a plausible-looking wrong result rather than an error.

- **`base[cat][band]` is a four-element array indexed by household size − 1.**
  Household 2 uses index 1; 4+ clamps to 3. An off-by-one still returns a number.
- **Price a place only through `benchColMultipliers(zip)`.** It resolves ZIP,
  county and BEA geography, then local category modifiers: county rents for Housing
  and state electricity for Utilities. `colTiers` is only a last-resort guard;
  reading it directly omits the local model. Never apply a local modifier twice.
  Utilities applies its multiplier to power and water, not nationally priced
  broadband or mobile plans.
- **Lifestyle is a product across six dimensions**, not one lookup. Travel is a
  named line inside Other: `travelFrequency` moves only Other and its middle
  option is ×1.0 (Help me out: “A normal holiday” → `moderate`).
- **`paysRent` keys are strings `"true"`, `"false"`, `"shared"`, not booleans.**
  `benchLifestyleKey` maps rent/mortgage → `"true"` (×1.0), family → `"false"`
  (×0.22) and other → `"shared"` (×0.6). Commute's “mostly walk” maps to `none`.
  A missed key silently contributes 1.0.
- **Always iterate `CATEGORIES`, never `Object.keys(data)`.** `_note` sits beside
  real entries in month-to-date data, peer base, ZIP prefixes and lifestyle modifiers.
- **Lesson framing options use `tag`, singular.** A `.tags` lookup collects nothing
  and silently selects the fallback script.
- **The self-reported layer is `monthToDateActuals`** ($429 dining), not the sum
  of `journalHistory` (~$168). Substituting journal detail changes every observation.
- **`state.monthlyIncome` is annual income / 12, without a tax factor.** The seed's
  `monthlyIncomeNet` key describes its seeded figure; `state.userProfile.monthlyIncome`
  belongs to a separate form.
- **Hold keyboard closing during a button press.** Removing 250px of padding
  mid-gesture moves the button before click dispatch. Both `focusin` and `focusout`
  must respect the latch; Chrome/Edge focus buttons on mousedown. `render()` calls
  `kbdSyncAfterRender()` to close after the field disappears. Test the whole sequence:
  `pointerdown → focusout(field) → focusin(button) → pointerup → click`.
- **Narrated clocks snap forwards only.** Use `Math.max(elapsed, cue)` at all three
  sites: lesson speech, onboarding speech and onboarding WAV `onplay`. Elapsed can
  already be ahead of the current cue; snapping back rewinds hyperframes.
- **A capped clock must hold the picture too.** While speech waits for `onEnd`,
  `lpHeld` and `onbVideoHeld` pass `playing: false` to hyperframes. Otherwise CSS
  animation advances independently and each sync tick yanks it backwards.
- **Skipped onboarding fields use a starting profile.** Guarded writes preserve
  answered fields; `profileDefault()` supplies unanswered ones (L26). The tester's
  fallback name is “Me”, distinct from Buddy.
- **Default a blank Buddy name at the source.** Leaving the Buddy step forward
  defaults to “Buddy”; finishing setup preserves a profile-supplied name or defaults
  to “Buddy”. Back keeps the draft, and all surfaces receive the same saved name.
- **A budget is a whole month; never pro-rate it.** Help me out must not depend on
  today's date. The spend estimator's month-to-date semantics do not apply to budgets;
  the sweep checks the budget trees under two dates.
- **Input styling that must win carries `.screen`.** `.screen input` has specificity
  (0,1,1), so a bare (0,1,0) component class loses its background/radius override.
  Custom slider rails can disappear under the inherited card background. The sweep
  asserts that every `.band-range` rule has the required scope.
- **`--progress-bg` is fill; meaningful rails use `--rail`.** The fill has too little
  contrast with `--card` to carry an outline. The sweep gates rail contrast at 2.0:1.
- **`overflow-y: auto` also makes horizontal `visible` compute to `auto`.** A focus
  ring outside a full-width field then clips, and scrollbars narrow the content.
  Use negative side margins with matching padding to keep space inside the scroller;
  see `.journal-shell.onb-pinned .journal-body`.
- **Small animation corrections glide; seeks snap.** `hyperframesSync` adjusts
  playback rate below `HF_SNAP_MS`, preserving fade boundaries. Paused frames pin
  exactly because the speech hold depends on it.
- **Only paused/idle animations get `play()`.** Playing a finished animation rewinds
  it; assigning `currentTime` is enough to un-finish it.
- **Paying a card in full costs no interest.** `lrSimBalance` returns one month and
  $0 interest when the payment covers the balance, matching the lesson's grace period.
- **There are two quiz screens.** `quiz` serves the standard catalog; `lessonQuiz`
  serves framed lessons, including APR. Check the owning path before changing a quiz.
- **HTML comments inside template literals enter the DOM.** Do not name deleted
  functions/classes in them: markup searches then report a false reference.

The benchmark self-test (`benchSelfTest`) lives in `scripts/sweep.js`. It asserts
base **275**, lifestyle **1.0** and BEA cost-of-living **1.071** separately for
Dining out, b3, household 2, ZIP 90066, foodie moderate + cooks sometimes. The result
is **295**; the worked example's tier-based 370 is not the BEA expectation. Separate
assertions catch wrong factor wiring even when a total happens to match.

## Hard rules

**Runtime**
- **No live LLM, no API keys, no network at runtime** (D02). Chat is a keyword
  matcher; benchmarks are static; the journal is structured.
- **No backend, no database, no localStorage** (D03). State is in-memory and
  resets on refresh. This is intentional.
- **Refresh pin** (`js/refresh-pin.js`, loaded right after `release-config.js`). A
  reload returns to the selector unless Admin Tools' **Pin on refresh** is checked;
  pinned, the same page restarts fresh without `?screen=` or the `#v=` trail.
  The pin is one sessionStorage flag per browser tab, shared with Flows and the
  comparison toolbar; it is a reviewer preference, never participant data. An
  embedded copy (a comparison pane) ignores it, never redirects to the selector,
  and disables the pin and **Exit Prototype** with a note. Exit leaves the pin set.
- **The app runs on `file://`** — `fetch()` and XHR are blocked and there is no
  dev server. Data loads via `<script>` tags (`data/*.js`), never a network call.

**Code**
- Vanilla JS, everything global, plain `<script>` tags. Keep names unique and
  feature-prefixed and modules separate. Load order in `index.html` matters.
- One global `state`; mutate it then call `render()`. No partial updates.
- **Always `h()`-escape** anything interpolated into an HTML template literal.
- **Inputs use `onchange`, not `oninput`** — a full re-render mid-keystroke
  destroys focus. Sliders are the exception, paired with `debouncedRender()`.
- **A `type="range"` slider on `oninput` must use `debouncedRender()`, never
  `render()`** — product sliders as much as admin ones. Keep slider maxima stable
  during dragging.
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
- **Remove genuinely dead code when it is in scope and verified.** `app/` is the
  source of truth and Git keeps history, so nothing is kept in case it comes back.
  Never keep dormant branches for alternate journeys (see One product: no journey
  switches). `sweep.sh` §7b **fails when any function in `app/` has no
  reference**: wire it back or delete it, along with what only it used.
- **Never judge "is this used?" by grepping for `name(`.** Functions here are
  reached four ways: ordinary calls, `onclick` in screen template literals,
  `onclick` in `index.html`, and bare identifiers in dispatch tables. Only the
  first looks like a call. Use `sweep.sh` §7b — grep gets this wrong.
- **Flow shell parity.** `app/css/components.css`, `app/js/refresh-pin.js` and the
  `app/index.html` head and Tools header are mirrored in every Flow (`flows/<id>/`),
  byte for byte (the head and header after `scripts/flows.py` adapts them for a Flow).
  Change every copy in the same commit, or `python3 -m unittest tests.test_flows`
  fails. A Flow cannot change them alone: its own styles go in `css/flow-tools.css`,
  and it cannot add stylesheet links.

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
3. `js/render.js` → `renderScreen()` · `adminSubtitle()` · `renderAdmin()`
4. `js/utils.js` → `activeTabFor` (the nav stack is the real source of truth —
   see architecture §7; keep this as the admin-jump fallback)
5. `js/state.js` → `destinations[]` (the Tools jump list and the page title)

Plus a **full-bleed mode class** if the screen hides the nav, zeroing *both* the
top-bar and nav offsets.

## Verifying

Follow [testing](testing.md): syntax, app sweep, path checks, publication tests, and
applicable PM checks. Node 22 availability must be checked, not assumed.
Keep useful regression tests. Data wrappers must match sibling JSON. Publication
tracking is independent of the untracked development sweep.

## Don't

Do not edit historical snapshots; ship fixes as new IDs. Approved product changes
belong in app/; contained proposals belong in flows/<id>/, with their own setup,
policy, code and assets. See [Flows](flows.md). A Flow merge does not approve product
changes. Selective app integration preserves full onboarding/tabs and existing BP/ESF
save semantics, and requires PM verification of the integrated app before the PR.

- Don't build sprite-sheet `background-position` cropping. **L22 allows
  owner-supplied buddy illustrations, but they are separate files chosen by
  buddy state — not sheets addressed by offset.** The cropping machinery stays
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
