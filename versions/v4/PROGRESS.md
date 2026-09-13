# v4 Build Progress

**v4 is a copy of `versions/v3.1/`.** Everything below this line is the
inherited v3 → v3.1 build log, kept because it records why things are the way
they are. v4's own work goes under a new heading as it lands.

**v3.1 is a copy of v3 taken at `eece653`.** Everything below is inherited
history from v3 and describes work done there; it is kept so the contracts and
traps stay readable, not because it was done again here. Anything genuinely
v3.1-only goes under a new heading as it lands.

**Current state:** **v3 IS BUILT — phases 0 → 6 complete**, plus four themes
(L21), **five rounds of manual-test fixes**, and a **v3.1-only tutorial
revamp**. `bash scripts/sweep.sh` → **60 checks, 0 failed, 0 warnings**;
`check-syntax` 158/158 across every live version; all 43 screens render.

**The tutorial revamp (v3.1 only).** Onboarding is seven steps, with the goal
question moved from sixth to second and the housing/commute pair and trial pitch
taken out of `ONB_STEPS` (renderers left in place). See `CLAUDE.md` →
"What differs from v3", item 4.

**The intro film's flicker, properly this time.** Round 5 claimed it fixed —
that fix was real but it was one of three mechanisms, and the other two were the
ones a tester actually sees. A capped clock froze `elapsed` while the CSS
animations kept running on wall clock, so the drift check yanked them backwards
eight times a second; and `hyperframesSync` called `play()` on finished
animations, which rewinds them to zero, flashing the whole scene back to beat
one. Both are fixed **in v3 and v3.1**, and both are recorded as traps in
`CLAUDE.md`. The lesson player had the first defect identically and is fixed too.

**The film step also overflowed its screen**, hiding its own transport controls,
because `.onb-video` claimed `min-height: 100%` of a parent that also held the
header above it. Two earlier attempts at this rule failed for the same reason —
neither made the parent a flex container. Fixed in both versions.

**Still never opened in a browser.** Every round has been harness-verified and
eye-unverified. The two that most need a human:

- **Continue with the keyboard up** (round 5). Whether `click` lands with the
  press latch in place is a browser question; no harness here can settle it.
- **The buddy illustration's crop** (L22). The stage is square, the image is
  1.4:1, so `object-fit: cover` crops the sides.

Behind those: the ±10s controls, the hyperframes stages, the APR scale, the
speech-driven clock, the scenario boxes and the bounded sliders.

**Known and deliberate:** the six goals added in round 5 have no intro-film
variant, so they fall through to the default script (the designed fallback).
Authoring six more is a content job, not a defect.
— *updated 2026-08-23*

## ▶ RESUME HERE

**Next action is not a code change — it is opening v3 in a browser.**

Nothing in this repo has ever been rendered. Two rounds of fixes (`plan.md`
§18, §19) reworked **drag interaction** — pointer capture, slider ceilings,
live readout painting — and no one has watched a slider move. The reasoning
found a real bug and then a real regression in its own fix, which is some
evidence it is sound, but it is not observation. The sweep is structurally
blind here: it asserts a handler *queues a debounced render*; it cannot see a
thumb.

1. Open `index.html` at the repo root, passcode `1337`, pick **v3 (alpha)**.
2. **Drag the Dining slider on the Budget tab**, and **drag a journal entry's
   amount** on the journal confirm screen. Watch for: thumb tracking the
   pointer smoothly, the figure moving with it, and no snap-back on release.
   If it stutters or recoils, the mechanism was wrong twice — say so.
3. Then the rest of the loop: login → daily update → summary → share → home →
   journal → budget → comparison → a lesson.
4. Six more items the sweep prints and cannot settle — see §8 of its output.

### Open threads, in priority order

| | |
|---|---|
| **Browser click-through** | above. Highest value by a distance |
| **`6cb62ad` is unreviewed** | the largest of the three commits. Both prior rounds found that fixes introduce defects |
| **6 of 8 review angles never ran** | `/code-review max` died on a session limit; only "conventions" and "cross-file tracer" completed. Line-by-line, language pitfalls, efficiency and harness correctness never reported |
| **4 refactor targets** | logged in `plan.md` §18.3, deliberately not fixed — wide diffs the owner should eyeball |
| **Lesson narration audio** | deferred, not blocked. Every variant plays on the virtual clock; only recorded voice is missing. `scripts/gen-audio.sh` has the pipeline |

Re-running `/code-review max` is worth it, but **after** the browser — a
rendering finding would change what is worth reviewing.

> **Read before touching anything:**
> 1. `plan.md` §0 — locked decisions **L1–L22**. Do not re-litigate them.
> 2. `plan.md` §17–§19 — why the recent work looks the way it does.
> 3. `versions/v3/docs/architecture.md` — cross-cutting contracts.
> 4. `plan.md` §13 — the session-start protocol.
>
> Spec lives at `v3 Files/spec/` (already unpacked, read-only, **tracked in
> git** so it travels with a clone).
> `docs/DECISIONS.md` beats every other spec doc; `plan.md` §0 beats that where
> they conflict.

**Conventions**
- Check items off as they land. Update `Current state:` every session.
- Where the implementation diverged, add a one-line `↳ note:` under the item.
- A screen is not done until its **5-point admin wiring** is complete
  (architecture §11). Half-wired screens are what a cold session misreads as
  finished.
- `node --check` every touched file — no browser here, it's the only gate.
- Commit + push at every phase boundary, with the PROGRESS.md update in the
  same commit.

---

## Phase 0a — Fork

- [x] v2 confirmed present (D37) — `versions/v2/`, 61 JS files. Stop and report if absent
- [x] `cp -R versions/v2/. versions/v3/` — **trailing dot**; `versions/v3/` already exists (holds `docs/`)
      ↳ verified: `diff -rq versions/v2 versions/v3` reports only the v3-extras. All 69 files byte-identical
- [x] `gate/gate.js` — add `{ id: "v3", label: "v3 (alpha)", path: "versions/v3/index.html" }` to `VERSIONS`
- [x] Root `CLAUDE.md` — update the version prose (it names v1/v2 explicitly and says to)
      ↳ done in the planning commit d958826, ahead of this phase
- [x] `versions/v3/CLAUDE.md` — new, auto-loads in this folder; carries architecture §12 standing rules
- [x] **Checkpoint:** gate → v3 opens and renders identically to v2, before anything is stripped
      ↳ verified structurally: 62/62 JS files parse, all 60 `<script src>` tags resolve, `versions/v3/index.html` present, v3 still byte-identical to v2. **Visual confirmation is the owner's** — no browser here
- [x] **Unplanned:** `scripts/check-syntax.sh` added — see divergence log

## Phase 0b — Strip

- [x] Retire 2 Minute Budget (L6): `bb_template.html`, `build_bb.py`, `js/wizard-bridge.js`, `screens/baby-budget.js`, the `bb-complete`/`bb-back` listener in `navigation.js`, `.baby-budget-mode` CSS
- [x] Retire Lifestyle Survey (L6): `screens/lifestyle-survey.js`, `js/lifestyle-survey-bridge.js`, `js/lifestyle-survey-content.js`, `explorer/` + `survey-explorer.html`
      ↳ **`screens/lifestyle-chain.js` NOT deleted** — see divergence below
- [x] Remove Goals V2 (L3): `js/goals/` (10 files), `screens/goal-create.js`, `goal-tracker.js`, `goal-vault.js`, `components/sprint-timeline.js`, `state.goalsV2`, goals admin routing
- [x] **Keep** `js/budget-baseline.js` — the `submitBudgetBaseline()` seam survives; the new wizard becomes its only adapter
      ↳ `BUDGET_BUILDER_LABELS` emptied — both source ids were dead. Phase 2 adds the wizard's
- [x] Marketplace → visibly greyed out, inert (D33). `marketplaceDetail` stays admin-only (L14)
      ↳ the *tab* is disabled (`.tab-disabled`), not the screen — admin jump still reaches it
- [~] The ~18 unmentioned v2 screens (L14): left in place and in `destinations[]`, but removed from tab and daily-task routing
      ↳ **partially deferred.** Kept and reachable, but the Budget hub still links several of them. Removing those links now would break the app before Phase 2 builds the replacement — lands in 0e (nav) and 2 (budget)
- [x] **Rewire `screens/about-me.js`** — `goGoalsEntry()` now routes to the surviving simple `goals` editor until Phase 5 builds the v3 goals model
- [x] **Collapse `screens/budget-setup.js`** — two-card picker → one "Build my budget" CTA calling `startBudgetBuilder()`, which Phase 2 repoints at the wizard
      ↳ the plan named only `renderBudgetChoice()`; the sweep found **3 more live `launchBabyBudget()` handlers and a `startLifestyleSurvey()` link**
- [x] Prune `index.html` `<script>` tags and `render.js` switches for everything removed
- [x] Sweep the reference maps: Goals V2 is touched by 6 files outside `js/goals/`; the builders by 11 outside their own
- [x] **Checkpoint:** app opens, no console errors, admin jump list still reaches every surviving screen
      ↳ verified: 41/41 JS parse · 41/41 script tags resolve · every `renderScreen()` target defined · every `destinations[]` and jump-list screen routes · **DOM-stubbed boot harness loaded all 41 scripts and rendered all 29 screens with 0 throws** (harness deleted, not committed)

## Phase 0c — Data (L13)

- [x] Copy `v3 Files/spec/data/*.json` → `versions/v3/data/` (7 files, verbatim, never hand-edited)
      ↳ `diff -rq` against the spec: byte-identical
- [x] `scripts/wrap-data.sh` — regenerates `.js` wrappers from `.json`
      ↳ deterministic: re-running changes nothing. Each wrapper's embedded JSON verified byte-identical to its `.json`
- [x] Generate `data/*.js` → globals `PERSONA` · `SEED_STATE` · `JOURNAL_QUESTIONS` · `PEER_BENCHMARKS` · `DAILY_SCRIPTS` · `BUDDY_RESPONSES` · `LESSONS_V3`
- [x] `<script>` tags in `index.html`, data block loading **before** everything that reads it
      ↳ 41 → 50 tags, all resolve. Load sections renumbered 1–6
- [x] `js/config.js` — `SKIP_ONBOARDING`, loaded first
      ↳ flip verified: `false` → streak 1, `true` → streak 6, nothing else changes
- [x] `boot()` maps data → state per architecture §2
      ↳ `bootV3()` in `js/boot.js`, called from `navigation.js` before the first render. `resetUserData()` re-seeds through it so reset returns to the seeded state, not an empty one
      ↳ **3 slots deliberately deferred** — see divergence
- [x] **Verify: no `fetch`/XHR anywhere.** `file://` blocks them and there is no dev server (architecture §1)
      ↳ clean — the only `fetch` matches are comments explaining why it can't be used

## Phase 0d — Taxonomy (do before Phase 1)

- [x] `CATEGORIES` const — 12, ordered, keys used **verbatim** including `"Dining out"`. No slugifying
      ↳ `js/taxonomy.js`, with `catTotal` / `catValue` / `catRows` / `isCategory` so nobody has to remember the `_note` trap
- [x] Seed the flat-12 plan layer. **No Savings category** — saving is a goal
      ↳ **as `state.plan`, not `state.budget`** — see divergence. Total 4060 = spec `totalMonthly`
- [~] Port `budget.js`, `budget-category.js`, `budget-utils.js` to the flat 12
      ↳ **deferred to Phase 2**, which owns the budget screens. See divergence
- [x] Benchmark model per architecture §5. **The spec's one-liner is wrong in all three terms** — do not implement from it:
      - [x] `base[cat][band]` is a **4-element array indexed by `householdSize − 1`** (hh2 → index 1; `4+` clamps to index 3)
      - [x] Cost of living is **two steps**: `zipPrefixes[zip3]` → tier *name* → `tiers[name][cat]`
      - [x] Lifestyle is a **product across 6 dimensions** (only Dining out and Groceries ever get more than one)
- [x] Answer-key traps: `paysRent` keys are the **strings** `"true"`/`"false"`, not booleans; `commute` key for "mostly walk" is **`none`**. A missed key silently contributes 1.0
      ↳ `benchLifestyleKey()` normalises both, plus `yes`/`no` and `walk`
- [x] `incomeBand` from annual income: b1 ≤35k · b2 35–60k · b3 60–90k · b4 90–140k · b5 140k+
- [x] Unlisted ZIP prefix → `moderate` fallback, never a failure
      ↳ also guards the `_note` key inside `zipPrefixes`, and null/empty ZIPs
- [x] **Self-test passes:** Dining out, b3, household 2, ZIP 900, foodie moderate + cooks sometimes → 275 × 1.34 × 1.0 = **370**
      ↳ `benchSelfTest()`. But see its own caveat: the persona is hh2 with all modifiers at 1.0, so several WRONG readings also yield 370. The harness asserts the *shape* separately
- [x] All category iteration driven from `CATEGORIES`, never `Object.keys(data)` — `_note` keys are present in 4 objects

## Phase 0e — Shell

- [x] Shared top bar component (**new** — v2 has none; every screen renders its own header today)
      ↳ `components/topbar.js` + `#topbarRoot`. Home icon is inline SVG — no icon library under L1
- [x] Top bar content: kibble · streak · buddy level · hamburger (right)
      ↳ hamburger opens a half-screen overlay; its *contents* are Phase 3's job
- [x] Top-left contextual slot: home icon at stack root · back when deeper · hidden on full-bleed · nothing on Home
      ↳ **10 per-screen back buttons removed.** They were hardcoded `go('X')` forward-jumps dressed as back, which is wrong once a screen can be reached from two places
- [x] Bottom nav → **5 tabs**, D34 order: Goals · Budget · My Progress · Education · Marketplace
      ↳ labels `Goals | Budget | Progress | Learn | Market`; Market inert (D33). `goals` gets its own stack — it lived under Budget in v2
- [x] `state.nav` with per-stack model; `go()` / `taskGo()` / `navBack()` per architecture §7
      ↳ `go()` pushes · `navGoTab()` switches without pushing · `navBack()` pops · `taskGo()` switches to the home stack first
- [x] `history.pushState` / `popstate` kept in sync so browser back still works
      ↳ `getNavSnapshot()` now carries a deep copy of `state.nav`
- [x] Admin "Jump to screen" **resets** the target stack to `[screen]`
- [x] Replace the triplicated 78px offset with `--nav-h` / `--topbar-h` custom properties
      ↳ zero hardcoded offsets remain outside `variables.css`; `render()` toggles `.no-nav` / `.no-topbar` instead of setting inline px
- [x] Audit every full-bleed mode class — must zero *both* top and bottom
- [x] `SKIP_ONBOARDING` seam: `false` → onboarding → 1-day streak · `true` → home → 6-day streak. Flipping it touches nothing else
      ↳ `v3EntryScreen()`. Both paths land on home until Phase 3 builds the onboarding screen; the branch is wired now so it is not retrofitted

---

## Phase 1 — Money Journal (deepest build, D05)

- [x] Journal entry screen, structured question sequence
      ↳ `screens/journal-entry.js`, full-bleed one-question-at-a-time with a progress rail
- [x] Question types: `multi_select`, `fill_number`, `single_select`. **No dropdown** — the prose says it, the data has none
      ↳ **correction to plan.md §9.6:** there is no dropdown *type*, but `q_anything_big` carries `categoryDropdown: true` — a category picker paired with the number input. That is what the prose meant. Implemented
- [x] Selection: 4 by priority from the 6 scoreable questions, skipping cooldown
      ↳ triggered questions join the pool when their pattern fires and then compete on priority; `q_breakfast_habit` (p70) outranks `q_getting_around` (p65)
- [x] `q_free_text` always last, **outside** the count of 4 — accepts input, silently discarded, never on the confirmation screen, never acknowledged (D12)
      ↳ asserted: the text appears nowhere in `state` after submit
- [x] Attachment affordances (image · camera · voice) present and tappable, nothing processed
- [x] `q_breakfast_habit` fires on `triggeredBy: pattern_detected`, not by score. `setsRecurring` is **tri-state** (`true` / `"weekdays"` / `false`)
      ↳ coffee appears on all 6 seeded days, so the pattern genuinely fires. Tri-state asserted not coerced
- [x] `q_watched` is `signalOnly` — engagement signal, no financial entry
      ↳ mentioning Hulu flips its `status` to `active_used` and clears the flag
- [x] Task deep-link **bypasses cooldown** (Hulu task → `q_watched`, which has a 2-day cooldown) (L12)
      ↳ `navRouteTask()` in navigation.js; the question is also pinned first so the task's intent reads
- [x] `q_balance` emits a goal-progress event — consumed in Phase 5, but emitted now
      ↳ a balance is not spending: asserted it does **not** move month-to-date
- [x] `q_balance` pre-fills from `PERSONA.connectedAccounts.selfReportedBalance` (1840)
- [x] Confirmation screen: category · estimate from persona · adjustment slider
- [x] Cash-flow only: ate-at-home entries are **$0** with an "already in your groceries" note (D15)
- [x] Submit → entries written to session state
- [x] **Submitted entries add to month-to-date; observations recompute** (L17)
      ↳ end-to-end: 429 → 470, gap 34% → 47%, and the sentence followed the number
- [x] Observation copy is **templated, not static** — seeded strings have baked figures that go stale on first entry
      ↳ `js/observations.js` — the registry (`observationsFor`) plus computed copy
- [x] Visible entry point for an additional same-day entry (D13)
      ↳ and it asks a genuinely different set, because submitting set cooldowns

## Phase 2a — Budget builder

- [x] Lifestyle wizard, 6 questions → `foodie` · `cooksAtHome` · `hobbySpend` · `paysRent` · `commute` · `travelFrequency`
      ↳ options store the DATA key, not the label — `paysRent` is `"true"`/`"false"`, "Mostly walk" is `none`
- [x] Wizard writes through `submitBudgetBaseline()` (the kept seam), gated by the old→new confirm screen
      ↳ seam **ported to the flat 12**: v2's HOUSING_SPLIT/BILLS_SPLIT conversion is gone, a baseline now carries one figure per category
- [x] Wizard output produces a starting budget across all 12 categories
      ↳ the starting budget **is** the peer model run on their own answers — which is why no question asks for a figure
- [x] Budget screen with category sliders
      ↳ `screens/budget-v3.js` is the Budget tab. v2's `about-me` / `budget-setup` / `budget-category` / `budget.js` retired
- [x] Retire the v2 budget screens (deferred here from 0d)
      ↳ `budget-utils.js` survives — `budgetFmt` is used in 15 files. `state.budget` stays vestigial for `my-progress` until 2b

## Phase 2b — Three-layer comparison

- [x] Three-layer comparison: plan (`state.plan`) · journal (`state.mtd`) · peer (`benchAllPeerValues`)
      ↳ `screens/comparison.js`; three distinct hues so the layers never read as one series
- [x] **Two gaps labelled distinctly** — over plan and over peers. Neither substitutes for the other
      ↳ every row carries both pills, and the label is half the point — an unlabelled percentage IS the trap
- [x] Observation #1 reframed to the plan comparison, with a separate peer card (L11)
- [x] Inline observation cards on categories with a gap worth noticing
      ↳ requires BOTH ≥15% and ≥$25: percentage alone flags Subscriptions over by $0.46, dollars alone flags Housing for being Housing
- [x] All four seeded observations visible
- [x] Port `my-progress` off v2's `state.budget`, then delete the vestigial model
      ↳ also retired `screens/lifestyle.js` + `lifestyle-chain.js` (superseded by the v3 wizard), `state.lifestyleAnswers`, `state.lifestyleSubSliders`, and 8 dead helpers from `budget-utils.js`. `state.budget` keeps only debts (L14)

## Phase 2.5 — Repaint (D36, L19)

Scheduled here deliberately: the taxonomy and budget screens have settled, so
L2's churn concern is spent — and Phases 3–4 author the most visual surfaces
(buddy stage, login scene, daily update), which should be built in the final
palette rather than converted.

- [x] `css/variables.css` — app-surface tokens to the design-system palette
      ↳ raw palette + semantic layer on top, so a screen never references `--sage` directly
- [x] **No pure black, no pure white, no red.** A flagged bill uses clay, not danger colouring
      ↳ `--danger` now *resolves to* clay, so any inherited v2 styling lands on the right side of D36 instead of shouting. Cards are `#FFFDF9`, not white
- [x] Dark-mode scope: invent equivalents
      ↳ warm dark (`#26231F` base) — the palette dimmed, not a colder second theme
- [x] Phone bezel and admin panel keep their own neutral tokens
      ↳ `--chrome-*` scope. Admin buttons needed their own rule: the base `.button` resolves `--accent` to sage, which cannot carry white text
- [x] Admin error log keeps a real red; "no red" governs app surfaces, not tooling
- [x] Radius: 16px cards · 24px primary buttons · full round on pills and the buddy stage
- [x] Shadows `0 4px 24px rgba(61,58,54,0.06)`. No hard edges
- [x] Type: rounded geometric display + legible body. Numbers heavier and larger than their label
      ↳ **webfonts are impossible here** — `file://`, no network at runtime (D02). Closest system stacks (`ui-rounded`/`SF Pro Rounded` → Nunito/Quicksand fallbacks). Swap in real files if they are ever bundled locally
- [x] Motion: ease-out 240ms throughout, plus a global `prefers-reduced-motion` block
- [x] Verify both light and dark still work on every screen built so far
      ↳ 32 screens × 2 modes, 0 failures. **Contrast measured, not eyeballed:** 3 light tokens cleared only AA-large, so `--accent`/`--warn`/`--good` were deepened and the dark fill darkened. Worst pair is now 4.60:1

## Phase 3 — Daily loop

### Onboarding (8 steps, D06)
- [ ] Name · ZIP · household size · income band (5 ranges, never a precise figure) · lifestyle wizard · strategic goal (4 + custom) · buddy creation · trial popup
- [ ] Only ZIP, household size, income override the persona (D09). A skipped field keeps the persona value — never block progress
- [ ] Buddy creation: **all five attributes** — breed, fur, eyes, nose, size (L18). Selections write to `state.buddy` and visibly change the placeholder description
- [ ] Trial popup fires immediately after buddy creation. Accept or decline → identical experience afterward (D32)
- [ ] Lands on home with a 1-day streak and the tester's own ZIP reflected in peer numbers

### 3a — Login and home
- [x] Login scene, day or night by local time, described placeholder. Animated greeting
      ↳ the day/night **switch is real** (local hour); only the artwork is a described placeholder
- [x] Daily update prompt: yes / no + "remember my choice". If checked on first use, say once it's changeable; never mention again
- [x] Home top bar (kibble · streak · buddy level · hamburger) — from 0e's shared bar
- [x] Tip banner — **hard 90-character limit**, puppy icon alongside
      ↳ enforced in `renderHomeTip()`, not trusted: a 200-char tip truncates with an ellipsis
- [x] Buddy stage: labelled frame describing breed · fur · eyes · nose · size · current pose
      ↳ **L22** — owner-supplied illustrations now render on top of this; the frame stays as the fallback
- [x] Idle pose cycle across poses 1, 3, 4, 5 on a 4–6s cadence. Poses 2 and 6 event-driven. **Stops under `prefers-reduced-motion`**
      ↳ the tick repaints `#buddyStage` in place rather than calling `render()`, so it cannot steal focus every 5 seconds
- [x] Four daily tasks, each routing somewhere real and paying kibble
- [x] Route map: `money_journal` · `subscription_confirm` → journal @ `q_watched` · `budget` → `aboutMe` · `lesson:<id>`
- [x] Hulu task enters the journal **visibly differently** (pre-focused)
      ↳ `q_watched` is pinned first AND bypasses its 2-day cooldown
- [x] Hamburger → half-screen overlay
- [ ] Streak registers after a completed entry, at the end of the share flow — **Phase 4** (that IS the share flow)

### 3b — Onboarding and chat
- [x] Onboarding, 8 steps: name · ZIP · household size · income band · lifestyle wizard · strategic goal · buddy creation · trial popup
      ↳ step 5 reuses `LW_QUESTIONS` — one wizard, two entry points, so answers mean the same thing either way
- [x] Only ZIP, household size, income override the persona (D09)
      ↳ asserted both ways: those three change, `age`/`city` do not. Income is picked as a BAND and stored as a representative annual, so `benchIncomeBand()` maps it back with no second code path
- [x] Buddy creation: **all five attributes** (L18) — the stage already reflects them
- [x] Trial popup fires immediately after buddy creation; accept or decline is identical afterward (D32)
- [x] Chat with Buddy — swap in `BUDDY_RESPONSES`
      ↳ **`advice_deflect` carries `priority: "override"` and must be checked BEFORE scoring.** Its own note says advice-shaped input lands there *regardless of keyword score* — that is how D26 is enforced. Scoring alone would answer "is it worth it to cancel hulu?" with `hulu_question`
- [x] Opening bubbles + `followUp` chains; bubbles are the primary input path
- [x] Two responses have `bubble: null` (`advice_deflect`, `catch_all`) — keyword-only, never listed
      ↳ replies carry a `navigate:` action offered as a BUTTON; the chat never auto-navigates, so the answer gets read first

### Assets — nothing generated here (D10 holds; L15 → L22)
- [x] Login backgrounds (day/night) and the kibble bowl ship as described placeholders
- [x] **Buddy illustration — owner-supplied (L22).** `prototype` is the first
      value in every attribute list and renders `assets/img/buddy-prototype.png`
      ↳ cropped from a 762x635 phone screenshot to 762x545 — the source carried a
        status bar, dynamic island and rounded corners
- [ ] **Pose images** — the owner has more for the home stage's changing
      positions. `BUDDY_POSES` already carries the six ids and the idle tick
      already repaints `#buddyStage` in place, so this is a filename function
      inside `renderBuddyImage`
- [ ] The descriptive frame is the **fallback** and is not removed — no image set
      covers every attribute combination, and D19 forbids an empty render
- [ ] **Do not** build `background-position` sprite cropping — these are separate
      files, not sheets. D39/D40 stay void

## Phase 4 — Daily update and share

### 4a — Narration and sequence
- [x] `scripts/gen-audio.sh` — `say` → `afconvert` → `afinfo`, **one file per segment**
- [x] Generate audio for all 3 variants — 21 `.wav` files, 2.7 MB
- [x] Extract durations, write timings back
      ↳ **to a separate generated `data/daily-timings.js`, not into `daily-scripts.json`** — that stays the byte-identical spec copy (L13). Three-tier lookup: measured → spec → 165 wpm
      ↳ the measurements differ from the spec's static block (s1 is 3650ms, not 3400ms), which is exactly why extraction is not optional
- [x] Playback: `<audio>` element is the clock. One file per segment, so the index is exact rather than inferred from a playhead
- [x] Segment text and timings never share an object; timings keyed by segment id
- [x] Visual cues reference **segment ids, never timestamps**
- [x] Missing timing → estimate from word count at **165 wpm**
- [x] 8 cue types. Reuse checked: `streak_flame` → `streak-counter.js` ✓, `bar_compare` → `thermometer.js` ✓, `goal_ring` → **not** `badge-ring.js` (it is badge-semantic — tiers, bonus dots — not a pace dial)
- [x] Scripts stay generalized; **visuals carry the numbers** (D30)
      ↳ asserted: no script contains a `$` figure or a `%`. **`renderThermometer` draws positions but prints no numbers**, so the bar_compare cue states 429 and 370 alongside it — without that, D30 was not actually satisfied
- [x] All 3 engagement variants selectable
- [x] Completion summary — observations stacked, plain language

### 4b — Share
- [ ] Share sheet: copy link + inert platform buttons. **Anonymization on by default**
- [ ] Anonymization preview — expandable, shows exactly what would post, every figure anonymized. This is the trust mechanic; build it properly (A11)
- [ ] Done → streak registers → home

## Phase 5 — Goals, Progress, Education

### 5a — Goals — v3 model (L3, rebuilt not ported)
- [x] `state.goals`: one strategic + several tactical
- [x] **Two goal types with inverted math**: savings accumulates toward a target (>100% good); spend-limit is a monthly ceiling (>100% bad). Seed uses `behind` vs `over`
      ↳ type is structural (a `period` means a ceiling), not a stored flag. Asserted both directions: the seeded savings goal at 40% and the spend goal at 134% are **both** the poor status — a single ">100 is good" check would have congratulated someone for blowing their dining budget
- [x] Pace display — ahead / on track / behind. Pace over raw figures
      ↳ **computed, never the seed's stored `pacePercent`**, which goes stale the moment anything moves. Comes out at 40% against the seed's 41% — the seed was a snapshot, this tracks
- [x] Contextual suggestions after a meaningful action: 1–3, scoped to what's on screen, "create your own" always last
      ↳ overall suggestions are drawn from the categories most over plan, so they are earned rather than generic. Never re-suggests a goal already tracked
- [x] Becomes "update your goals" once enough goals are in flight
- [x] Event-based updates consuming the `q_balance` event — never ask for a number directly
      ↳ a checking balance updates savings goals and leaves spend limits alone. Events are marked consumed, so re-entering the tab cannot re-apply them
- [x] Seeded emergency fund reads as behind but recoverable (D17)
      ↳ spend limits also track month-to-date **live**, so a journal entry moves the goal (L17)

### 5b — My Progress — 6 sections in A3 order
- [x] Spend trend chart, hand-rolled SVG (no recharts under L1) + month-to-date summary above
      ↳ **v2's section order was its own** (Profile → Budget Results → Assumptions → Comparisons → Goals → Commitments); A3 fixes a different one, so the file was rewritten rather than patched
      ↳ D19 asserted: 6 seeded days, none empty, and the month-to-date above it is genuinely larger than their sum — the fabricated depth the spec asks for. A tester's own entry adds a 7th bar labelled "Today"
- [x] Three-layer comparison, framed for review not editing
- [x] Bills calendar — car insurance $187, due in 4 days, flagged as unbudgeted
      ↳ soonest first; the flag uses **clay, never alarm colouring** — nothing here is an emergency
- [x] Subscription usage flags — Hulu, 3 weeks unmentioned, $18.99. Framed as a question, never "cancel Hulu"
      ↳ asserted the word "cancel" appears **nowhere** on the screen, and that the flag clears when the journal hears about it
- [x] Badge and buddy level — badges say plainly that they unlock nothing
- [x] Kibble balance (display-only, L16)

### Education
- [ ] v2 lesson player inherited unchanged — **do not rebuild** (D38)
- [ ] `state.lpStageStyle` default → `"clean"`; waveform stays as the non-default admin option (L10)
- [ ] Pre-lesson framing decision tree, 3–5 questions. "I don't know" is a first-class answer with its own branch
- [ ] Answer-tag collection + script variant matching (highest tag overlap, tie → first listed, zero → fallback)
- [ ] **The key is `tag`, singular — not `tags`.** Reading `.tags` yields an empty set and plays the fallback every time, silently
- [ ] **`next` resolves at two levels**: option-level → question-level → terminal. Every lesson's `f3` is terminal with no `next` anywhere
- [ ] Unmatched tags (`unsure_apr`, `unknown_*`, `f3` confidence tags) route to the fallback **by design** — do not add variants to cover them
- [ ] `nocard` is in `apr_v5.matchTags` but never emitted; `apr_v5` is reachable via `no_debt`. Leave it
- [ ] **Author all 15 script variant bodies** (L8) — none ship in `lessons.json`
- [ ] Reuse v2's `interest-builds` narration as one APR variant
- [ ] Generate audio for the remaining variants
- [ ] Badge model: `lessons.json` 5 tiers + 500 XP/tier, kept admin-tunable via v2's `xpConfig` panel (L9)
- [ ] Quiz — `lessons.json` ships 1 question per lesson; draw from v2's 48-question pool to reach `quizQuestionsRequired`
- [ ] One simulation per lesson: `balance_calculator` · `savings_pace_calculator` · `subscription_tally`. Sandbox only, never the user's real figures
- [ ] Reward screen: XP, badge progression, kibble
- [ ] Return routing: came from home → home; came from Education → Education

## Phase 6 — Pass

`bash scripts/sweep.sh` — committed, repeatable, run it whenever scope shifts.

- [x] Every seeded observation reachable from ≥2 screens — via the registry (architecture §6), not by hunting
      ↳ and the sweep checks the headline **actually renders**, not just that it is registered. Registry membership is not the same as appearing on screen
- [x] **No screen renders empty in any state** (D19)
      ↳ 41 screens × **8 reachable states** (no budget, no journal, no goals, no bills, zero counters, all tasks done, no observations). **Found 5 genuinely broken** — `lessonQuiz` and `lessonSimulation` rendered literally 0 characters when entered from the admin jump. All five now show something useful with a way onward
- [x] **Copy sweep: no financial advice anywhere** (D26) — buddy replies, observations, lesson scripts, empty states
      ↳ 4 corpora swept (screens, response library, 15 lesson scripts, 3 daily-update scripts) plus the guardrail both ways: 14 advice phrasings deflect, 11 real questions do not
      ↳ automatable, and was automated in Phase 3b: assert every screen's rendered text and every library reply is free of `you should` / `we recommend` / `cancel your` / `switch to` / `you must` / `best option is`, and that ~20 advice-shaped questions all deflect while legitimate ones do not (L20)
- [x] No exclamation marks in financial observations (A13)
- [x] Vocabulary consistent: Buddy · Money Journal · Kibble · Streak · Peers · Observation. Never "expense tracker", never "average users"
- [x] 5-point admin wiring complete for every screen (architecture §11)
      ↳ **found 8 screens whose `activeTabFor` returned a stack that does not exist**, and 14 that were not in `destinations[]` — breaking L14's promise that the kept v2 screens stay admin-reachable. Both fixed
- [x] Syntax clean across all JS (`bash scripts/check-syntax.sh`)

### Not machine-checkable — needs the owner's click-through
The sweep prints these rather than passing them silently:
- [ ] Mobile viewport at 390px — layout, wrapping, no horizontal scroll
- [ ] Keyboard focus visibly moving through every interactive element
- [ ] Tap targets genuinely ≥44px **as rendered** — CSS declares it; only a browser measures it
- [ ] `prefers-reduced-motion` actually stilling the buddy idle and the daily update
- [ ] Narration audio lining up with the visuals it is cued to
- [ ] Whether the repaint reads as "not a bank"
- [ ] The four themes side by side (L21) — the contract and contrast are checked; whether Light/Dark actually *look* like v2, and whether the frame and admin panel hold still while switching, are not

---

## Post-Phase-6 — four themes (L21)

Added after the build was complete and swept. Full rationale in `plan.md` §17;
the contract is `docs/architecture.md` §14.

- [x] Four themes — Light + Dark (v2's palette), Natural Light + Natural Dark (D36). **Natural Light is the default** (revised from Dark, 2026-08-28)
- [x] `THEMES` in `js/theme.js` is the single source; `render()` calls `themeApply()`; the class lands on `.screen` only
- [x] Admin panel gets a 2×2 theme picker, replacing the old two-way button
- [x] Sweep extended: 41 screens × **4 themes**, the 40-token contract per theme, chrome isolation, and **12 contrast pairs × 4 themes at 4.5:1**
      ↳ **three pre-existing defects found.** Eight dead overrides in `.dark-mode` (`--bg`, `--phone`, six `--chrome-*`) that could never apply because the class is on `.screen` and those tokens are consumed by an ancestor and a sibling. An implicit text-on-`--accent` pairing that inverted with the theme, leaving Natural Dark at ~1.6:1 — now explicit via `--on-accent` / `--accent-fill-text`. And `--info` shipping at 3.92:1 in Natural Light
- [x] Syntax clean; `bash scripts/sweep.sh` → 47 checks, 0 failed, 0 warnings

## Pre-refactor — unreferenced-function inventory (sweep §7b)

Added ahead of the owner's in-depth review + refactor.

- [x] **Policy: unused code is kept, not deleted.** A prototype in iteration
      loses more to a premature deletion than to clutter. The check is an
      inventory, not a gate — it never fails on dead code
- [x] What it actually watches is **movement**: 10 unreferenced functions are
      baselined in `DEAD_BASELINE`; anything *newly* unreferenced warns, because
      that usually means a refactor orphaned a handler rather than a deliberate choice
- [x] Detection is a **bare-identifier** match, not `name(` — functions here are
      reached four ways (ordinary calls, `onclick` in screen template literals,
      `onclick` in `index.html`, bare identifiers in dispatch tables) and only
      the first looks like a call. A `name(` scan misreported `activeTabFor`,
      `copyAppState` and `duCueBarCompare` as dead when all three are live
- [x] **Validated with a negative control**: removing `copyAppState`'s only
      reference (an `onclick` in `index.html` — no JS caller to lose) is caught
- [x] `bash scripts/sweep.sh` → 49 checks, 0 failed, 0 warnings

## Code review — v3 + gate + scripts (plan.md §18)

Full read of 62 v3 files plus the shared surfaces, ahead of the refactor.
**Four defects found and fixed; four refactor targets logged, not touched.**

- [x] **`chatResetConversation()` declared in two files** — one global namespace,
      so `screens/chat.js` (loads later) shadowed `js/chat-router.js` and the
      router's copy never ran. The survivor skipped the bubbles, so a reset left
      the previous reply's follow-up chips on an empty thread. Duplicate removed
- [x] **Four product sliders called undebounced `render()` on `oninput`** —
      `budgetSetPlan`, `lwAdjust`, `lessonSimSet`, `journalAdjustEntry`. A full
      render reassigns `.screen`'s innerHTML, destroying the element being
      dragged. Now `debouncedRender()`; `budgetSetPlan` took a `live` flag
      because it also serves an admin field on `onchange`
- [x] **`copyAppState()` dumped v2's shape** — named two keys that no longer
      exist and captured none of v3's state. Rewritten to the three layers
- [x] **Reduced motion reset duration but not `animation-delay`** — daily-update
      cards stayed invisible through their stagger, then popped in one by one
- [x] Two checks added, each **validated with a negative control**: duplicate
      declarations (§7b's reference count is blind to shadowing — a dead copy is
      still referenced), and a behavioural guard that chat reset restores the
      opening bubbles, written so it fails rather than passes vacuously
- [x] `bash scripts/sweep.sh` → 54 checks, 0 failed, 0 warnings

## Review of the review (plan.md §19)

`/code-review max` on `8ea4f79`. 14 findings, all verified, all fixed. **The §18
fixes had bugs of their own** — worth reading before trusting a green sweep.

- [x] `copyAppState` **repeated the defect it fixed** — read `state.goals` /
      `state.tasks`, which `boot.js` documents as v2's parked arrays. v3 uses
      `strategicGoal` / `tacticalGoals` / `dailyTasks`. Also captured the
      almost-always-null `journalSession` instead of `journal` / `journalEntries`
- [x] The check written to prove that fix was a **tautology** — it built its own
      object from `state` and never inspected the snapshot. Split out
      `appStateSnapshot()`; the sweep now asserts on what is actually emitted
- [x] Debouncing traded one visible bug for two: sliders derived `max` from the
      value they control, so the thumb **recoiled** on release, and the readout
      was dead for the whole drag. `budgetSliderMax()` now derives from the
      seeded plan + peer figure; handlers paint their own readout
- [x] `debouncedRender`'s timer was never cleared — a queued repaint could wipe a
      focused text field up to 400ms later, silently. `render()` cancels first
- [x] **The slider fix had zero coverage**: the DOM stub's `setTimeout` discarded
      its callback, so `debouncedRender()` was a no-op. Stub now queues +
      `flushTimers()`; each handler asserted individually
- [x] Duplicate-check reported same-file dupes as cross-file shadows; `sweep.sh`
      claimed "§7b cannot catch this" beside the check that does
- [x] "Admin sliders are the exception" was stale in **three** binding docs
- [x] `bash scripts/sweep.sh` → **60 checks, 0 failed, 0 warnings**

### Refactor targets — logged, deliberately not fixed (wide diffs)
- [ ] 74 of 337 CSS classes unreferenced (~22%) — Phase 0b residue in `components.css`
- [ ] `state.budget` is misnamed: holds `fixedOverhead` + `debts`; the budget is `state.plan`
- [ ] `--tier-copper` duplicated as literal `#b87333` in `state.js:730`
- [ ] All four scripts hardcode `versions/v3` — a v4 fork would keep sweeping v3

---

## Divergence log

One line per item that landed differently than specified, with the why.

**0d — the flat 12 landed as `state.plan`, not by rewriting `state.budget`.**
The item said "rewrite `state.budget` to the flat 12; v2's 5×3 nested buckets
removed". Surveying first showed that is a Phase 2 job, not an 0d job: v2's
nested model has consumers in **11 v3 files**, with `lifestyle-chain.js` and
`budget-category.js` referencing it 17 times each. Replacing the shape under
them would break screens Phase 2 is going to delete anyway.

Nothing downstream needs v2's budget gone. Phase 1's journal writes against
`CATEGORIES` + `state.plan` + `state.mtd`, none of which touch it. So the two
models coexist deliberately and briefly:

| model | backs | retired |
|---|---|---|
| `state.plan` (12 flat) | v3 — journal, comparison, benchmarks | — it is the survivor |
| `state.budget` (5×3 nested) | v2's budget screens, `lifestyle-chain` | **Phase 2**, with those screens |

Porting `budget.js` / `budget-category.js` / `budget-utils.js` moves to Phase 2
for the same reason. **0d's real deliverable was the benchmark engine**, which is
complete and asserted.

**4b — `navGoTab("home")` was the wrong primitive for "Done".** A tab tap
*resumes* that stack's top, which is correct for tabs — leave Budget three
screens deep, come back, pick up where you were. It is wrong for ending a flow,
because the thing you just finished is still on top: `navGoTab("home")` after
the share flow returned to the share screen, and with onboarding as the entry
screen it returned to onboarding. Added `navGoHome()`, which resets the home
stack to its root, and repointed every end-of-flow "Done" plus the top-bar home
icon at it. Same root cause as the 3a boot bug, one level up.

**0c — three state slots were deliberately not seeded.** architecture §2 maps
`state.budget`, `state.tasks` and `state.goals` from the data, but all three
names are already owned by live v2 code: v2's 5-bucket budget model, v2's task
cards (`title`/`description`/`cta`), and v2's simple goals array. Overwriting
them in 0c would break `home.js` and the budget screens before their
replacements exist — and "never leave a session with a broken app" is the rule.

The v3-shaped data is loaded now under non-colliding names so it is available
and inspectable; the phase that rewires the consumer also swaps the slot:

| v3 data | parked as | consumer rewired in |
|---|---|---|
| `SEED_STATE.budget.monthly` | *(not loaded)* | **0d** — taxonomy rewrite owns it |
| `SEED_STATE.dailyTasks.today` | `state.dailyTasks` | **3** — home screen |
| `PERSONA.goals` | `state.strategicGoal` + `state.tacticalGoals` | **5** — v3 goals model |

All 14 other slots were verified free of collisions before writing.

**0b — `lifestyle-chain.js` is not a budget builder; it was kept.** The 0b item
listed it under "Retire Lifestyle Survey (L6)". Reading it first showed that is
wrong: its entry point is `lifestyle.js → startLifestyleChain(themeKey)`, it
writes to `state.lifestyleSubSliders`, and it never touches
`submitBudgetBaseline()`. It is the lifestyle *theme-refinement* flow — a
separate v2 feature, so **L14 keeps it**, not L6 deletes it. `plan.md` §6 hedged
with "likely `screens/lifestyle-chain.js`"; the hedge was right to be there and
the answer is no. Retired total is therefore 4,733 lines, not the ~2,400 the plan
estimated — the Goals V2 module was bigger than the builders.

**0b — the strip had more live call sites than the plan found.** `budget-setup.js`
held three further `launchBabyBudget()` onclick handlers and a
`startLifestyleSurvey()` rebuild link beyond the `renderBudgetChoice()` picker
the plan named. All four would have thrown at runtime. Found by sweeping for
dangling references *after* deleting, not by reading the plan.

**0a — `node` does not exist on this machine.** Both `CLAUDE.md` files instructed
`node --check` as "the only automated gate," but there is no node on PATH, no
`~/.nvm`, and no homebrew install. Added `scripts/check-syntax.sh` using macOS's
built-in JavaScriptCore (`jsc checkSyntax`), validated against a positive *and* a
negative control before being trusted. Both `CLAUDE.md` files updated, including
the Testing section's `vm.runInContext` note, which is also node-specific.
*Why it matters:* a broken verification instruction in an auto-loading file would
have cost every future session the same rediscovery.
