# App architecture — cross-cutting contracts

`app/` is the editable full product. This guide covers contracts shared by many
screens; [app contracts](../../docs/app-contracts.md) records the rules and
[product decisions](../../docs/decisions.md) keeps their stable IDs. Operations
follow [workflow](../../docs/workflow.md) and [publishing](../../docs/publishing.md).

---

## 1. The runtime constraint — read this first

The app is vanilla JS with no build step (L1). It opens directly at
`app/index.html` on `file://`, where `fetch()` and XMLHttpRequest cannot read
local data reliably. Load data through ordered script tags (L13).

### The contract: data ships as script-wrapped JSON

Each `data/*.json` source has a generated `.js` wrapper assigning a global.
Edit JSON, then run `bash scripts/wrap-data.sh`; never hand-edit wrappers.
`wrap-data.sh` rejects JSON without a mapped global. Authored
`data/lesson-scripts.js` and `data/onboarding-storyboard.js` have no JSON sibling.

Data loads before consumers: `PERSONA`, `SEED_STATE`, `JOURNAL_QUESTIONS`,
`PEER_BENCHMARKS`, `DAILY_SCRIPTS`, `BUDDY_RESPONSES`, `FRAMED_LESSONS` and
`ZIP_COST_OF_LIVING`. The cost-of-living data is derived by
`scripts/build-cost-of-living.py`; inspect the generator for its derivation,
not the large generated data files.

### Repo integration

The root selector opens app/ locally. Published selectors are generated from
publication/catalog.json; never add copied version folders or manual gate rows.
Release configuration loads before app config and supplies immutable tracking plus
the selector return path. See repository-root docs/publishing.md.

---

## 2. Data → state

`state` is the single source of truth; `render()` rebuilds the UI after mutations.
`bootApp()` deep-clones source data so session edits never mutate the globals.
It seeds profile, lifestyle and Buddy from `PERSONA`; category plan, journal,
month-to-date figures, observations and tasks from `SEED_STATE`; and bills,
subscriptions and goals from `PERSONA`. The ESF tool owns the fund goal, so boot
omits the persona's emergency-fund goal to avoid duplication. Source seeds remain
read-only.

Onboarding applies answered identity, household, income and lifestyle fields over
a starting profile; skipped financial fields use `profileDefault()` (L26).
`onbFinish()` applies annual income to monthly income (rounded annual / 12),
with no tax factor. The seed key `monthlyIncomeNet` describes the persona's starting figure.

State is in memory only (D03). Refresh returns to the selector unless Tools'
**Pin on refresh** is on; pinned, the same app restarts fresh. Embedded previews
restart in place. Session storage holds only reviewer preferences, never participant
data. **Exit Prototype** returns to the selector.

---

## 3. Time model

The persona is **six days in**. Journal history runs `day: 1` (labelled "6 days
ago") through `day: 6` (yesterday). The entry a tester makes is about
*yesterday* — journal questions are previous-day recall (D11).

```
day 1 ... day 6   = seeded history (SEED_STATE.journalHistory)
today             = the tester's session; their entry covers yesterday
```

Normal entry starts at full onboarding and finishing it shows a **1-day** streak
(`streakDaysIfOnboarded`). Supported HTTP(S) study links can enter at an allowlisted
`?screen=` destination after boot; this does not remove setup or tabs from the full
product. A contained, shortened or reordered journey is a Flow
([one product](../../docs/app-contracts.md#one-product-no-journey-switches)).

Bills are **relative**: `dueInDays: 4` for the car insurance. Resolve against
real today at render time so "due in four days" stays true whenever it's opened.

---

## 4. The 12-category taxonomy

`CATEGORIES` is frozen and ordered:

```js
["Housing", "Groceries", "Dining out", "Transport", "Utilities", "Subscriptions",
 "Health", "Personal care", "Entertainment", "Shopping", "Debt payments", "Other"]
```

These exact strings join peer base values, budget, month-to-date figures and journal
options. Never slugify them. There is no Savings category: savings is a goal.
Always iterate `CATEGORIES`, not object keys: data objects also carry `_note` keys.

---

## 5. Three layers, never blurred

| Layer | Source | UI label |
|---|---|---|
| Plan | `SEED_STATE.budget.monthly` | "Your plan" |
| Self-reported | `SEED_STATE.monthToDateActuals` | "What you told me" |
| Automated | bank connection | **not in prototype** |

**The self-reported layer is `monthToDateActuals`, not the sum of
`journalHistory`.** This is easy to get backwards and the numbers don't survive
it: six days of journal entries total roughly $168 of dining out, but the
observation is built on **$429**. The six days of journal detail sit inside
fabricated month-to-date totals (D19).

```
monthToDateActuals[cat]   → the comparison figure ("what you told me")
journalHistory[day]       → the drill-down detail behind it
```

Comparisons, observations, and the daily update all read the month-to-date
figure. The six days are what you show when someone taps into a category.

`journalSubmit()` adds to `state.mtd`; `estimatorSubmit()` replaces a category's
month-to-date estimate. Both require confirmation before committing. A future
writer needs the same guard. Recompute observation figures after a submission
(L17); authored strings with baked figures cannot stay authoritative.

Keep plan and peer gaps distinct (L11): $429 against a $320 plan is 34% over plan;
the seeded peer comparison is $295 and has its own label.

### Peer benchmark formula

```text
peerValue = base[category][incomeBand][householdSize - 1]
          × benchColMultipliers(zip)[category]
          × product of six lifestyle modifiers
          → round to nearest 5
```

The base is a four-element array: household 2 uses index 1, and 4+ clamps to 3.
Lifestyle is a product across six dimensions, with missing category entries
contributing 1.0. Only Dining out and Groceries can have multiple lifestyle factors.
`paysRent` keys are strings; `benchLifestyleKey` maps answers onto them.
The commute answer “mostly walk” maps to `none`.

Travel is a named line inside Other: `travelFrequency` moves only Other, and
its middle option is ×1.0 (Help me out: “A normal holiday” → `moderate`).

### Cost of living: BEA Regional Price Parities, per category

`benchColMultipliers(zip)` is the only pricing chokepoint. It resolves ZIP county
to a BEA metro or state nonmetropolitan geography, then falls back to the dominant
county for the three-digit prefix (and nearby prefixes without crossing territory
boundaries), then `colTiers` as a last-resort guard. Coverage is the 50 states and DC;
territories use national figures and are reported unsupported.

| Category | Regional base | Local modifier |
|---|---|---|
| Housing | BEA Housing | County rent relative to its own BEA region |
| Utilities | BEA Utilities | State residential electricity relative to national |
| Groceries, Shopping, Transport | BEA Goods | None |
| Dining out, Health, Personal care, Entertainment, Other | BEA Other services | None |
| Subscriptions, Debt payments | 1.0 | None: priced nationally |

Do not apply a local modifier twice or invent county variation where the model
has no source. Housing compares with its own region because BEA already prices
that region.

### The headline index is anchored, not recomputed

```
index = all/100 + Σ weight[c] × (final[c] − base[c])
```

The headline is BEA's published All-items figure plus the weighted deviations
introduced by local modifiers. It is not an unweighted average of categories.

Income bands b1–b5 use annual income: ≤35k, 35–60k, 60–90k, 90–140k and 140k+.
`ONB_INCOME_BANDS` mirrors the peer data. Onboarding refines annual income within
the selected band on a $500 grid; b5's slider ends at $400,000 while its data max
remains open-ended. `state.monthlyIncome` is annual income / 12, without tax;
the Budget label is “Coming in each month”.

The sweep's `benchSelfTest` checks each peer factor separately; see
[app contracts](../../docs/app-contracts.md#traps-that-fail-silently).

---

### The lesson calculator: one engine, both catalogs

`js/lesson-rewards.js` supplies balance, savings and subscription engines;
`screens/lesson-outcome.js` renders `lessonSimulation`. `screens/simulation.js`
is a separate Tools-accessible stub.

`lessonSimSpec(lessonId)` uses framed-lesson data or `LESSON_SIM_V2` for the
standard catalog. Five standard lessons deliberately have no calculator:
loan vs lease, deductible vs premium, HSA basics, what you can afford and total
cost of ownership. `state.lessonSim.origin` selects `completeLesson()` for a
standard lesson or `lessonRewardStart()` for a framed one; never infer origin.

Healthy, Common and Bad scenario buttons use the same engine as the sliders.
APR stays at the tester's card rate or chosen value across scenarios, so the
outcomes remain comparable; the balance remains a sandbox figure.
`LESSON_SIM_RANGES` defines bounds and steps for defaults, scenarios and controls.
`lessonSimClamp` rounds the step count, rebuilds and rounds to 2dp to avoid float
dust. Current savings uses step 10, monthly payment step 5 and APR step 0.5.

### The estimator asks only what it does not already know

`estimatorKnown(category)` identifies existing figures. For Subscriptions it
merges persona prices with the services the tester reported in journal setup;
the tester's list governs, and unknown prices use a labelled average estimate.
The known step offers that figure or questions. Accepting it answers no questions,
so it is exempt from the “nothing answered” discard guard. Editing the figure
removes the provenance claim; restoring the value restores the claim.

## 6. Observation registry

Four seeded observations (D18). D18 requires each to be reachable from **at
least two screens**. Sweep §3 checks that on rendered screens: it looks for each
headline in journalDone, dailySummary, myProgress, dailyShare (preview open) and
dailyUpdate (paused on its `summary_stack` cue), and fails below two.

| id | type | surfaces |
|---|---|---|
| `obs_dining_over_peers` | `plan_gap` after boot | home_tip, budget_comparison, daily_update, progress |
| `obs_hulu_unused` | `subscription_flag` | home_task, progress, daily_update |
| `obs_emergency_behind` | `goal_pace` | goals, daily_update, progress |
| `obs_insurance_unbudgeted` | `bill_flag` | home_task, progress_bills, budget_comparison |

Boot copies the observations, `surfaces` tags included, into
`state.observations`. Code reads only two tags: journalDone shows up to two
observations tagged `budget_comparison` or `progress`
(`observationsFor`). dailySummary renders every observation, and dailyUpdate and
dailyShare the first three, in seed order. The other tags are labels nothing
reads, so editing them moves no card.

Copy is templated (`observationDetail`, `observationHeadline`,
`observationFigure`), and `observationsRecompute` re-derives the figures after
boot and after each journal submit (L17).

---

## 7. Navigation contract

Five tabs (D34) plus Home as a top-left icon (L5).

```js
state.nav = {
  activeStack: "home",
  stacks: {
    home:     ["home"],
    goals:    ["goals"],
    aboutMe:  ["aboutMe"],
    myProgress: ["myProgress"],
    learn:    ["learn"],
    marketplace: ["marketplace"]
  }
}
```

| Action | Effect |
|---|---|
| Tab tap | switch `activeStack`. **Does not push.** Stack resumes where you left it |
| Home icon tap | reset the Home stack through `navGoHome()` |
| `go(screen)` | push onto the active stack |
| `taskGo(screen)` | set `activeStack = "home"`, then push — this is what makes a task-launched screen back to Home |
| `navBack()` | pop the active stack |
| `navGoTabRoot(key)` | switch `activeStack` **and reset it to `[key]`** — "this flow is over" |
| Admin "Jump to screen" | **reset** that stack to `[screen]` — a jump has no history |

**A daily task is one of two things, and they navigate differently** — see
`navRouteTask`. A **bookmark** into another tab (`lesson:apr`, `budget`) uses
`navGoTabRoot`, so tapping the task is indistinguishable from tapping the same
thing in that tab. A **flow launched from Home** (`money_journal`,
`subscription_confirm`) uses `taskGo`, because a journal entry is not a tab and
has nowhere else to belong.

**No screen may `go()` a tab root.** Use `navGoTabRoot` for a tab destination,
`navGoHome` when a flow ends at Home, or `navBack` for Back. `navGoTab` resumes
that stack's top, so it cannot finish a flow. Reward is a no-resume screen:
a later tab tap resets that stack to its root.

Every Done control must reset its destination stack, rather than recommit the
screen just finished.

Per-tab stacks are what let the *same* screen back to two different places: a
lesson opened from a Home task backs to Home, the same lesson opened from
Education backs to Education. No special-casing.

`history.pushState` / `popstate` stay in sync so browser back keeps working
through `getNavSnapshot` / `restoreNavSnapshot`.

**Use navigation seams** (`go`, `taskGo`, `navGoTab`, `navBack`, `navAdminJump`)
for screen changes. Direct `state.screen` assignment bypasses the stack and nav log.

---

## 8. Shared top bar

The shared top bar contains Charity Points, streak, buddy level, the menu and
the contextual Home/Back control (L5).

```
┌──────────────────────────────────────────┐
│ [◄ or ⌂]   points · streak · level   [☰] │
└──────────────────────────────────────────┘
```

Left slot is contextual:

| Condition | Left slot |
|---|---|
| Stack depth > 1 | **Back** |
| Stack depth = 1 (tab root) | **Home icon** |
| Full-screen / nav hidden | **Back only** — home icon hidden |
| On Home | nothing |

Home icon: inline SVG with a 44px tap target. No icon library under L1.

### The offset trap

`.screen-scroll` reserves `--topbar-h` and `--nav-h` for shared chrome.
Full-bleed modes must clear the required top and bottom offsets; use the mode
classes in `css/layout.css` and `render()` so no dead band remains.

---

## 9. Routes and the journal question contract

### Route map

`SEED_STATE.dailyTasks.today` uses its own route vocabulary, matching no screen
id. Routes can carry a parameter (`lesson:apr`).

| Route | Resolves to |
|---|---|
| `money_journal` | journal entry flow |
| `subscription_confirm` | **journal entry, focused on `q_watched`** (L12 — no dedicated screen) |
| `budget` | `aboutMe` |
| `lesson:<id>` | lesson player for that lesson id |

**`q_watched` is `signalOnly: true`** — its options carry a `signal` name, not a
category or estimate, so it produces **no financial entry**. That's correct for
the Hulu task: the payoff is the flag clearing, not a dollar amount.

It also carries `cooldownDays: 2`, so normal priority selection may skip it.
**A task-initiated deep link must bypass cooldown**, or the Hulu task can route
to an entry that doesn't contain the question it exists to ask.

### Question selection

`config`: `questionsPerEntry: 4`, `freeTextAlwaysLast: true`, `freeTextParsed: false`.

Nine questions ship, but they are **not one flat pool** — three carry flags that
take them out of ordinary priority scoring:

| Question | Flag | Behavior |
|---|---|---|
| `q_free_text` | `alwaysLast: true`, `parsed: false` | Always appended, outside the count of 4. Silently discarded (D12) — never on the confirmation screen, never acknowledged. Carries `attachments: [image, camera, voice]`, all inert |
| `q_breakfast_habit` | `triggeredBy: "pattern_detected"` | Fires on a detected repeat, not by score. `cooldownDays: 30` |
| `q_watched` | `signalOnly: true` | Produces a signal, not a financial entry |

So ordinary selection draws **4 by priority from the 6 scoreable questions**,
skipping anything on cooldown, then appends free text.

### The journal is where goal progress comes from

`q_balance` — *"Roughly what's in your checking account right now?"* — carries
**`updatesGoalProgress: true`**. This is not a goals-tab feature that happens to
live in the journal; it is the whole event-based goal update mechanism,
implemented as a journal question.

`journalSubmit()` consumes `updatesGoalProgress` answers to update goal progress.
Keep that write in the journal submit path.

Also note `setsRecurring` on `q_breakfast_habit` is **tri-state**, not boolean:
`true` · `"weekdays"` · `false`. A truthiness check gets `"weekdays"` wrong.

---

## 10. Audio pipeline

L10's narration order is **pre-generated WAV → runtime browser speech → silent
word-count clock**. Built-in system/browser voices require no API key (D04).
The daily update plays its segment WAVs and uses its timing clock when playback
is unavailable; lesson and onboarding players also support runtime speech.

`scripts/gen-audio.sh` generates daily-update and onboarding segment WAVs using
macOS `say` and `afconvert`, and measures daily durations into
`data/daily-timings.js`. It does not generate the lesson catalog. Only the
`interest-builds` lesson has a lesson WAV (`LP_AUDIO`). Do not regenerate media
as part of packaging.

### Timing precedence

`duTiming()` prefers **generated `DAILY_TIMINGS` in `data/daily-timings.js`**, then
static `daily-scripts.json` timings, then word count at `DU_WPM` (165 wpm).
Recorded playback uses the audio element as its clock.

D29 keeps script text and timings separate, keyed by segment ID. Visual cues
reference segment IDs, never timestamps, so recutting audio preserves cue wiring.

### The sync contract: whatever is speaking is the clock

**Audio and subtitle stay together, and the scrub bar moves both.** This binds
on every narrated surface.

| Surface | The clock |
|---|---|
| Daily update | its `<audio>` element — audio-driven |
| Lesson player, lesson **with** a `.wav` | `audio.currentTime` — audio-driven |
| Lesson player, lesson **without** one | the utterance's `onstart`/`onend` |
| Onboarding intro | the `.wav`'s `onplay`/`onended`, else the utterance's |

165 wpm estimates initial length; a browser voice can read at another pace.

So when a voice is driving, `speechDriven` goes true and:

- **the line index is pinned on start** — the caption on screen is provably the
  line being spoken, so the clock snaps to that line's cue rather than wherever
  the estimate had drifted to;
- **the tick keeps the bar moving but is capped** inside the current line
  (`lpSpeechCap` / `onbSpeechCap`, one twentieth of a second short of the next
  cue), so a fast estimate cannot run the film past the narrator;
- **only the voice's own end event advances**, which is also what ends the piece.

165 wpm survives as the total-length figure for the first paint, and as the
whole clock on a browser with no speech engine at all (`onError` hands it back).

**Seeking cancels and re-speaks.** `lpApplyElapsed` / `onbVideoApplyElapsed`
drop the current utterance when the line changes; without that the voice
finishes the line it was on and advances from *there*, narrating a passage the
viewer has already scrubbed past.

`narrationSpeak` carries `onStart`/`onEnd`/`onError` and keeps the generation
guard, so a superseded line's callbacks are still dropped — see the cancel trap
at the top of `js/narration.js`.

### The snap is forwards only

Live lesson speech, live onboarding speech and onboarding WAV `onplay` pin with
`Math.max(elapsed, cue)`. Elapsed can already be ahead of that cue; snapping back
would rewind every animation. While held at the speech cap, `lpHeld` and
`onbVideoHeld` pause hyperframes too, so CSS animations cannot run ahead.
`hyperframesSync` glides small corrections with playback rate, snaps large seeks,
and pins paused frames exactly. Only paused/idle animations get `play()`:
playing a finished animation would rewind it.

### Keyboard press latch

Closing the simulated keyboard removes 250px of padding and can move a pressed
button before click dispatch. `kbdInit` holds closing during a button press;
`kbdSyncAfterRender()` closes once the field is gone. Both `focusin` and
`focusout` respect the latch because Chrome/Edge focus a button on mousedown.
Tests must exercise `pointerdown → focusout → focusin → pointerup → click`.
When a press does not re-render, focus returns to the field.

### 165 wpm is the one pacing knob

`DU_WPM` is the shared word-count pace for daily update, onboarding and lessons.
Hyperframe entrances/exits use wall-clock seconds through `hfFrac`, capped for
short beats. APR storyboard fractions must follow script line boundaries; its
figure-free narration leaves monetary comparisons to the conditional `cost` beat.
Changing a script requires recutting those fractions. Onboarding instead builds
beat boundaries from the player's segment cues, so they follow text edits.

### The intro film branches on the primary goal

The intro uses a shared spine with goal-specific middle segments `s3`/`s4`, keyed
on `improveAreas[0]`; secondary picks do not change it. Edit
`data/onboarding-script.json` and `data/onboarding-storyboard.js` together.
Full scripts give each generated WAV a stable script/segment path.
`hyperframesCanRender()` requires figures by default; explanatory storyboards
set `requiresFigures: false`.

The three daily scripts each have seven timed segments. `number_reveal` is a
declared cue type without a current segment; its renderer remains supported.

---

## 11. Screen wiring checklist

Every new screen needs all five, or Tools silently degrades to a generic fallback.

1. `screens/<name>.js` → `render<Name>()` (+ optional `render<Name>Admin()`)
2. `<script>` tag in `index.html`, in the screens block
3. `js/render.js` → `renderScreen()` · `adminSubtitle()` · `renderAdmin()`
4. `js/utils.js` → `activeTabFor` (or the stack map, per §7)
5. `js/state.js` → `destinations[]` (the Tools jump list and the page title)

Also add a **full-bleed mode class** if the screen hides the nav (§8).

---

## 12. Standing rules

Follow [the hard rules](../../docs/app-contracts.md#hard-rules) for global names,
escaping, input and slider rendering, theme tokens, Flow shell parity and copy.
No financial advice (D26), empty screens (D19), or observation reachable from fewer
than two screens (D18). Respect reduced motion, visible focus, 44px tap targets
and the 390px phone design width. Charity Points have two non-converting tiers:
bones (internal `state.kibble`) and diamonds. Points and Buddy level gate nothing.

---

## 12b. Lesson framing trees — three structural traps

**1. The key is `tag`, singular — not `tags`.** One tag per option, not an array.
A `.tags` lookup silently collects nothing, the tag set comes back empty, and
every lesson plays its fallback variant. The failure is invisible: you get a
script, just always the wrong one.

**2. `next` lives at two different levels.**

| Question | `next` location |
|---|---|
| `apr/f1`, `apr/f2_unknown`, `apr/f2_nocard`, `emergency-fund/f1`, `subscription-audit/f1` | **per option** |
| `apr/f2_known`, `emergency-fund/f2_amount`, `subscription-audit/f2` | **on the question** |
| `apr/f3`, `emergency-fund/f3`, `subscription-audit/f3` | **neither — terminal** |

Resolution order: option-level `next` → question-level `next` → terminal. All
three lessons end on an `f3` that has no `next` anywhere, so "no next" means
*done*, not *malformed*.

**3. `nocard` is declared but never emitted.** `apr_v5.matchTags` is
`["no_debt", "nocard"]`, but no framing option produces `nocard` — `apr/f1`'s
"I don't have a credit card" carries only `next: f2_nocard`, no `tag`.
`apr_v5` stays reachable via `no_debt`, so nothing breaks. **Do not invent a question to cover it.**

### Unmatched tags are the design, not a bug

Many answer tags match no variant: `unsure_apr`, `unknown_balance`,
`unknown_debt`, `other_debt`, and all of `f3`'s confidence tags (`confident` ·
`partial` · `new`). They fall through to the fallback — and `apr_default`'s own
note says *"Also serves every 'I don't know' path."*

That is *"'I don't know' is a first-class answer, not a failure"*
implemented in data. Don't add variants to "cover" them.

---

## 13. Buddy representation (L22)

L22 permits owner-supplied static illustrations, with the text description as the
missing-image fallback. Agents do not generate Buddy art (D10), and there is no
sprite-sheet cropping.

`renderBuddyStage` owns the frame; `renderBuddyInner` selects the fixed
`assets/img/buddy-prototype.png` illustration or the description. Every stage draws
that illustration regardless of appearance attributes. Its `prototype` ID is an
attribute option, not a breed. Tools can edit appearance; onboarding asks only
for name and pronouns. No onboarding creator or breed search is present.

`.buddy-img` fills the stage's padding box with `object-fit: cover`, escaping
the text content width. The overlaid name reflects onboarding edits.
`buddyImgBroken` is a module latch reset by `buddyResetArt()` at boot, so a new
session can retry an asset that failed earlier.

Appearance attributes stay in `state.buddy` and Tools; no attribute changes the
fixed picture. The text fallback describes breed, coat, eyes, nose, size and pose.
The name field starts blank; a blank name is allowed and defaults to **Buddy**
when leaving that step forward or finishing setup. Back preserves the draft.
Idle pose text cycles 1, 3, 4 and 5 every 4–6 seconds; reduced motion stops it.
Poses 2 and 6 are event-driven for chat and rewards/streak. Keep the fallback frame
so a missing illustration never produces an empty card (D19).

---

## 14. Theming — four themes, one contract (L21)

Four themes ship, switched from Tools. **Natural Light is the default**
(`state.settings.colorMode` and `THEME_DEFAULT` in `js/theme.js`).

**Natural Light's class is the empty string** — it *is* `:root`. Because it
is the default, an unclassed `.screen` and a correct one look the same,
so a `themeApply()` that never ran is invisible. The sweep's theme checks are
what catch that.

| Theme | Class on `.screen` | What it is |
|---|---|---|
| Light | `.theme-light` | crisp blue-on-white |
| Dark | `.theme-dark` | cool dark |
| Natural Light | *(none — `:root`)* | D36 cream + sage — **default** |
| Natural Dark | `.theme-natural-dark` | D36 dimmed, warm |

`THEMES` in `js/theme.js` is the single source of truth. `render()` calls
`themeApply()`, which puts exactly one class on `.screen`. To add a theme, add
an entry there and a class in `variables.css` — the theme picker and sweep also read the list.

### The colour-token contract

`:root` holds the complete Natural Light set, so every token always resolves.
Each of the three classes must then define **every colour token `:root`
defines (`EXPECTED_TOKENS` in the sweep), no more and no fewer.**

This is enforced (`scripts/sweep.sh` §1b) rather than trusted, because the
failure mode is invisible: a theme that omits a token inherits `:root`'s
**cream**, which paints one warm patch into a cool theme and reads as a
deliberate accent rather than a bug. Adding a token to `:root` fails the
sweep until all three themes define it.

### What a theme must never touch

**`--chrome-*`, `--bg`, `--phone`.** These style the admin panel, the page and
the bezel — all of which live *outside* `.screen`, where theme classes are
applied. An override is therefore inert as well as unwanted: the frame is meant
to hold still while the app repaints. The sweep asserts this.

### Colours that pair, and must be declared as pairs

`--accent` is **dark** in the light themes and **light** in the dark ones. Any
rule putting text on it therefore cannot hardcode a text colour — there are two
tokens for this, and new rules should use them rather than reaching for
`--on-dark`:

| Background | Text token |
|---|---|
| `--accent` | `--on-accent` |
| `--accent-fill` | `--accent-fill-text` |
| a genuinely always-dark surface (lesson stage, night login) | `--on-dark` |

The sweep checks 16 foreground/background pairs across all four themes at a
4.5:1 floor. Pairs in its `KNOWN_LOW` list (Natural Light's tab labels and text on `--soft`)
warn at their measured ratio instead of failing, until the palette is decided.

---

## Combined app integration

ESF task routing, Buddy question-tree behavior, the tab-only paywall,
and the user-approved immediate ESF budget replacement exception are specified in
[the current app contracts](../../docs/app-contracts.md#combined-prototype-behavior).
ESF model/data load after the baseline seam, Buddy ESF logic follows the model,
and ESF/Buddy renderers load with the screens. JSON wrappers support `file://`.
Big Purchase data loads with the other data wrappers. `js/bp-engine.js` is
category-blind; `js/bp-vehicle.js` registers the vehicle category with it and reads
ESF insurance and fuel figures at call time, so it loads after `js/esf.js`. Finder,
lease and Buddy models follow, and `screens/bp-*.js` load after the ESF Buddy panel.
`render()` fills `#buddyRoot` from both `renderEsfBuddyLayer()` and `renderBpLayer()`.
