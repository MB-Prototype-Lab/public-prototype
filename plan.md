# v3 Build Plan — working notes

Scratch notes for building `versions/v3/`. Not a formal plan — raw material for
one. Written by reading v2 source + the v3 spec, now unpacked at `v3 Files/spec/`.

Pass log:
- **Pass 1** — v2 core (state/render/nav/layout) + full v3 spec read.
- **Pass 2** — v3 `data/*.json` in depth; v2 budget/goals/lesson internals.
  Found spec-vs-data gaps (§9). Round-1 answers locked.
- **Pass 3** — v2 `navigation.js` + history model; `10-ai-assets.md`;
  buddy/task/tip seed data. Round-2 answers locked. Nav model designed (§4).
- **Pass 4** — rounds 3–4 locked (L7–L12). Spec unpacked to `v3 Files/spec/`.
  `versions/v3/docs/architecture.md` written. `file://` constraint found → L13.
- **Pass 5** — consistency review, top-down then bottom-up, of `plan.md` +
  `architecture.md` against the data files. Fixed a wrong benchmark formula and
  two stale contradictions here (§14 logs what changed).
- **Pass 6** — `PROGRESS.md` + `spec-coverage.md` written. Audit surfaced D36
  having no phase (§15).
- **Pass 7** — deep verification: every structural claim recomputed from the raw
  JSON, plus a v2 cross-reference map for the strip. Found the household-index
  bug, two answer-key traps, three framing-tree traps, and the same wrong formula
  surviving in §6 (§16 logs it all).
- **Post-build, round 4** — L22 reverses L15's "permanently": the owner has
  produced buddy illustrations, so static owner-supplied art is allowed. Not a
  planning pass either — logged because L15 is referenced in eleven places and
  every one of them had to move with it.
- **Post-build** — L21, four themes (§17). Shipped with Dark as the default;
  revised 2026-08-28 to Natural Light, so the D36 repaint is what a tester
  actually meets. Not a
  planning pass; the build was already complete and swept. Logged here because
  it changes the default a tester first sees, which L2/L19/D36 all speak to.

---

## 0. Locked decisions

Settled across question rounds 1–8. Don't re-litigate.

| # | Decision | Consequence |
|---|---|---|
| L1 | **Vanilla JS.** v3 = copy of v2 + spec deltas. A1 (React/Vite/Tailwind) overridden. | Phone frame, admin panel, render engine, gate integration survive intact. No npm, no build step. Root `CLAUDE.md` stays true. |
| L2 | **Defer the repaint.** Build on v2's blue tokens; cream/sage palette is a later dedicated pass. | Deviates from Phase 0 ("tokens first") — accepted, avoids restyling churn while screens move. Dark mode survives by default. |
| L3 | **Rebuild Goals to the v3 model.** v2's Goals V2 module does not come to v3. | See §7. |
| L4 | **Versions are test variants, not a migration path.** `versions/v2/` stays runnable and unchanged; the gate picks which to test. | Preserving v2 is automatic — v3 is a sibling folder. Zero back-compat burden on v3. |
| L5 | **Five tabs per D34** (Goals · Budget · My Progress · Education · Marketplace) + **Home as a top-left icon** in a shared top bar. Plus a **contextual back stack**. | D34 honored literally. Home stays reachable without crowding the bar. Needs a shared top bar component v2 doesn't have. See §4. |
| L6 | **One budget builder.** The v3 6-question lifestyle wizard replaces *both* v2 builders (2 Minute Budget iframe + Lifestyle Survey). Keep the `submitBudgetBaseline()` seam. | Largest single code reduction in the build: ~2,400 lines retired. See §6. |
| L7 | **Full 7 phases**, nothing deferred. | Won't fit one session — build is designed to resume (§13). |
| L8 | **Author all 15 lesson script variant bodies.** v2's existing `interest-builds` narration is reused as one of them (the APR lesson's audio variant). | Full answer-driven personalization is demonstrable. Largest content-writing task in the build. §9.1 resolved. |
| L9 | **`lessons.json` 5-tier badge model + v2's admin tuning knobs.** | v3 progression (bronze→diamond, 500 XP/tier) with v2's mid-test tunability. §9.5 resolved. |
| L10 | **Web Speech is a build-time generator, not a runtime player.** Use it to produce `.wav` files, store them, play the `.wav`. Also: lesson stage default flips to **`clean`** (text only); the waveform animation becomes the non-default admin option. | Overrides D04's "no build-time audio assets." Changes the daily-update timing model — see §8. `state.lpStageStyle: "waveform"` → `"clean"` in `js/state.js`. §9.4 resolved. |
| L11 | **Observation #1 reframed to the plan comparison** ("34% over your plan", 429 vs 320), with a **separate peer card** (429 vs 370, 16% over). | Both framings appear, labelled distinctly, per `04-budget-benchmarks.md`. §9.2 resolved. |
| L12 | **The Hulu task routes into the Money Journal**, not a dedicated screen. `journal-questions.json`'s `q_watched` already captures the engagement signal. | No `subscription_confirm` screen is built. §4 route-map note resolved. |
| L13 | **Spec data ships as script-wrapped JSON.** Each `data/*.json` gets a generated `data/*.js` assigning it to a global, loaded by `<script>` like everything else. Both files kept. | Forced by L1: the app runs on `file://`, where `fetch()`/XHR are blocked and there's no dev server. v2 has zero runtime data loading, so this is new. See `versions/v3/docs/architecture.md` §1. |
| L14 | **The ~18 unmentioned v2 screens stay, but off the main paths.** In the codebase, reachable from the admin jump list; nothing in the five tabs or the daily tasks routes to them unless v3 needs it. | D37 honored (nothing deleted, nothing invented) without widening the tester's surface. No deletion work. They still need porting *if* a v3 path reaches them. See §5. |
| L15 | ~~Buddy art ships as descriptive placeholders permanently.~~ **REVISED 2026-08-22 — see L22.** The original decision stands as the record of why the placeholder exists and why it is built the way it is; L22 supersedes only the "permanently" clause. | Original consequence: honest about being a placeholder while proving the customization plumbing works end to end. That plumbing is what makes L22 cheap — the frame and the description were kept separate on purpose. See `architecture.md` §13. |
| L22 | **Owner-supplied static buddy illustrations are allowed**, selected by buddy state. Still forbidden: **AI-generated art** (D10 — the prohibition is on generation, and it holds), and **sprite-sheet `background-position` cropping** (D39 — these are separate files, not sheets). The descriptive frame **survives as the fallback** and is not deleted. | Reverses L15's "permanently". The owner has produced illustrations, so the thing L15 said would never exist now does. The fallback is not politeness: no image set will cover every combination of breed × coat × pattern × eyes × nose × size × pose, and D19 forbids a screen rendering empty — so a missing image must degrade to the description rather than to a gap. Mapping, file naming and which stats select which image arrive with the owner's plan; nothing here presumes them. |
| L23 | **npm and a build step are allowed in `tools/`, never in `versions/`** (2026-08-30). The onboarding film is rendered ahead of time by **HeyGen HyperFrames** (Apache 2.0, `npm i hyperframes`) into committed `.mp4` assets. The app itself stays vanilla, dependency-free and `file://`-only: it gains a `<video src>` and nothing else. `tools/node_modules/` and `tools/build/` are gitignored; every rendered artifact is committed. | **Scopes L1 rather than reversing it.** L1's promise is that *the app* has no build step and no dependencies, and that is still exactly true — a tester opens `index.html` and everything runs. What changed is that we now generate an asset the way `scripts/gen-audio.sh` already generates the daily update's `.wav` files, and nobody considered that a violation. The film is the one surface where a hand-rolled CSS-keyframe engine was visibly losing to a real renderer. **Scope: the onboarding intro only, and v3.1 only.** The lesson and daily-update films plot the tester's own figures and a fixed file would freeze them, so they stay live DOM; v3 is the A/B control and gets no feature work. The SVG engine survives as the fallback for the same reason L22's descriptive frame does — D19 forbids an empty screen, and `file://` video playback is not something a headless check can settle. |
| L24 | **v3.1's budget builder is three steps with a per-line "Help me out", and peers render as a ±10% band** (2026-09-03). The six lifestyle questions and the "Which is closer?" reconciliation are retired *from the v3.1 flow*; questions are asked only about lines the tester says they cannot estimate. Every budget figure is drawn on one box-and-whiskers track instead of three stacked bars. `Health` displays as **"Medical & Dental"** through a label seam, not a data rename. **v3.1 only.** | **Scopes L6 rather than reversing it.** L6's promise was one builder behind `submitBudgetBaseline()`, and that still holds exactly — `budgetBuild` is the single adapter and nothing writes `state.plan` directly. What changed is *when* the app asks: L6 assumed everyone answers the same six questions, which asked people who knew their own rent to describe their relationship with food. The estimator already asked habit questions across all twelve categories for actuals, so it took a `target` rather than being duplicated. **Three things are load-bearing and easy to undo by accident:** (a) the band's right edge is `1.1 × max(budget, actual, peerHi)` — **every mark is in that max**, so the rail always fits what is on it. This was built the other way first, with peers excluded so a band above everything would overflow and be marked with a gray rule; against the seeded persona that fired on 5 of 12 categories and drew an empty track on nearly half the rows, and the owner corrected it. The overflow path survives only as a guard for a caller-supplied edge (build mode supplies one). (b) `BB_STEPS` must partition the taxonomy exactly, or a category is either never asked or asked twice, silently (swept) — and **every line is a slider**: Exact/Range groups categories by how well a tester knows them, never by how the figure is entered (misread once, built as a number field, corrected); (c) `catLabel()` is for display only — `"Health"` remains the join key across five data files and any missed lookup returns undefined rather than failing. **Cost:** with no lifestyle questions, nothing in the v3.1 flow updates `state.lifestyle`, so peer bands no longer personalise beyond income, household and ZIP until the trees write those dimensions back. |
| L25 | **"Help me out" is its own estimation engine, and a budget is never pro-rated** (2026-09-04). `js/help-me-out.js` + `data/help-me-out.json` + `screens/help-me-out.js` replace the actuals estimator for the budget path: twelve trees, 2–5 questions each on one progressively-revealed screen, ending on a confirm slider against a band conditioned on the tester's own answers. **v3.1 only.** | **Scopes L6 further, and fixes the worst defect the build has shipped.** Riding the actuals estimator meant inheriting `estimatorMonthFraction()`, so on the 4th of a 30-day month every budget figure came out at 13% of itself — "light local driving" was $10 of transport, and choosing the *most* expensive option still lowered the category. Two structural lessons are now traps in `versions/v3.1/CLAUDE.md`: **(a)** nothing in the model may read a clock (swept by stubbing the fraction and asserting no figure moves); **(b)** nothing may reach past `benchColMultipliers()` to price a place — Utilities looked up `state.utilitiesRatio` itself and squared a multiplier the chokepoint had already applied, overstating Los Angeles by 65%. Also: a flat sum of fixed options cannot express `miles × rate + insurance`, which is why Transport's largest line by far — insurance, ~$130/month before a wheel turns — was simply absent from the old bank. Figures live in JSON with a source each; arithmetic lives in `HMO_MODELS` where it can be tested. |
| L26 | **Skipping setup picks an explicit profile, and the nine profiles are the headless test matrix** (2026-09-04). Three cost-of-living tiers (95054 Santa Clara · 37203 Nashville · 72201 Little Rock, chosen by BEA RPP) x three income levels at -25%/at/+25% of each county's Census median. **Both v3 and v3.1, identical** — this is not what the A/B tests. Behind `PROFILE_PICKER` in `js/config.js`. | **Fixes a silence, not a crash.** Every write in `onbFinish()` is guarded, so a skipped field fell through to the persona: a tester who skipped spent the session as Sam from Los Angeles on $68,000, with every figure anchored on a profile nobody chose and nothing naming it. `o.name \|\| "Buddy"` was worse — it made the *tester* "Buddy", the same as the dog. **The larger win is the matrix:** everything the app computes is anchored on a ZIP and an income, and there was exactly one of each to test against, which is why "$10 of transport" was only ever found by hand. `sweep.js` §1c now drives every screen, the peer model, every tree and the whole builder through all nine — 423 renders on v3.1, 396 on v3. **Known and deliberate:** `peer-benchmarks.json` has five income bands and ±25% does not always cross one, so Santa Clara at/+25% and Little Rock at/+25% produce identical peer figures. That is the model's own granularity; the admin card shows the resolved band so a 25% raise that moves nothing is explained rather than mysterious. Household size is fixed at 2 across all nine so the two axes stay isolated. |
| L27 | **The Budget tab is a paywall, and D31 is overridden** (2026-09-24). `BUDGET_PAYWALL` in `js/config.js` replaces the Budget tab with a Platinum wall — seven days free, then $6.99 a month — that **never unlocks**. The CTA records the tap and says checkout is not built; it writes nothing. **v4 only, and the TAB only.** | **Overrides D31 ("no ads and no paywalls appear") outright** — the first decision here to contradict the spec on product substance rather than on build technique, so it is written down rather than left to be re-derived. Six places in v4 cited D31, one of them copy a tester reads ("Nothing is locked either way — this prototype has no paid features"), and that line had to go because the screen now does the opposite. **D31 still holds everywhere else**, which is why `learn.js` and `topic.js` keep their citations with a qualifier rather than losing them: lessons, topics and kibble gate nothing, and L16 is untouched. **A flag, not a deletion** — "do not delete unused code" is a hard rule, and a removed call site would also orphan all ten functions in `budget-v3.js` into §7b's warning, fixable only by padding `DEAD_BASELINE` with ten names that misstate why they are there. **Known and deliberate:** guarding the tab is not guarding the budget. The "Set up your budget" daily task, the Home task, budget-update-confirm's Rebuild, `?screen=budget-build` and `?screen=comparison` all reach budget screens without rendering the tab. Owner's call, with the alternative priced: the guard is a named predicate, so closing every door is moving one call into `renderScreen()` against a list of screen ids. |
| L16 | **Kibble and buddy level are display-only.** Balance accrues from tasks and shows in the top bar / My Progress; nothing spends it. Buddy level is a displayed number with no progression rule. | Matches the spec: every kibble sink is on the deferred list, and D31 forbids gating anything. Least invention. |
| L17 | **Journal entries feed month-to-date; observations recompute.** A submitted entry moves the figures the comparison, the daily update, and My Progress read from. | Closes the input→observation loop the prototype exists to test. Safe: journal entries only ever *add* spend, so a seeded gap can widen or hold but never vanish mid-session. Forces observation copy to be **templated, not static** — see `architecture.md` §5. |
| L18 | **Character creation offers all five attributes** — breed, fur, eyes, nose, size — per 01-onboarding step 7. | **D40 is overridden.** It dropped eyes/nose and capped fur at four only because raster sheets can't recolour; there are no sheets, so the constraint is void and the cost is one line of description each. **Re-read this under L22:** the attributes stay, but a static image cannot vary along all five, so the image is selected by whichever subset the owner's plan names and the description continues to carry the rest. The pickers are not reduced to match the art. |
| L20 | **The no-advice guardrail is code, not data.** `advice_deflect`'s 10 keywords are a floor; `ADVICE_PATTERNS` in `chat-router.js` catches the shapes they miss. Any question asking what to do gets the safeguard reply, checked **before** scoring. | D26 is absolute. The data alone missed 12 of 15 natural phrasings — "help me decide", "can I afford", "what would you do" — and each would have been answered by whichever topic shared a noun. Over-eager deflection is the safe failure: a retry costs a tester seconds, giving advice breaks the prototype's core rule. Verified both ways: 20/20 advice shapes deflect, 0 of 24 legitimate questions do. |
| L19 | **The Finch-like repaint is Phase 2.5** — after the budget screens settle, before the daily loop is authored. | Closes the only spec decision with no phase (D36). L2 deferred it; this schedules it. See §15. |
| L21 | **Four themes, picked in the admin panel. ~~Dark~~ NATURAL LIGHT is the default** (revised 2026-08-28). `Light` + `Dark` reproduce v2's palette; `Natural Light` + `Natural Dark` are the D36 repaint. `THEMES` (`js/theme.js`) is the single source of truth; the class lands on `.screen` only. | Owner call, post-Phase-6. The v2 pair exists so the repaint can be **judged against what it replaced** rather than from memory — that only works if switching is instant and side-by-side. Dark as default originally meant a tester's first screen was not the D36 cream — a knowing trade, on the grounds that L21 governs the default *view* while D36 governs the *design*. **That call has been reversed by the owner:** the cream IS the design, and defaulting to a v2 palette meant most testers never met it. Applies to v3 and v3.1 both, because a theme difference between the two sides would confound the A/B. The note that "one line in `state.js` reverses it" was correct — it took two, `state.js` and `THEME_DEFAULT` in `theme.js`. See §17. |

<!-- L1 voids two PROGRESS.md Phase 0 items outright ("Vite + React + Tailwind
     initialized", "Design tokens in Tailwind config"). Phase 0 shrinks to:
     fork → strip → wire nav → SKIP_ONBOARDING. -->
<!-- L1 also voids 10-ai-assets.md's "build these in code" column, which names
     lucide-react and recharts. No npm ⇒ no React libs. Icons and charts must
     be inline SVG / CSS. v2 already hand-rolls its charts in components/
     (thermometer, badge-ring, sprint-timeline), so there's precedent to follow. -->

---

## 1. What the v3 spec actually is

`v3 Files/files/` holds 4 loose `.md` files + `money-buddy-spec.zip`. The loose
files are **byte-identical copies** of files inside the zip (verified by diff) —
the zip is the whole truth, and only 4 of its 13 docs are loose, so always read
the unpacked copy.

**Unpacked to `v3 Files/spec/`** (25 files, wrapper dir stripped). Read from
here; never edit it — it's the reference copy we diff against.

```
v3 Files/spec/
  CLAUDE.md  PROGRESS.md  .claude/commands/next-task.md  scripts/slice-sheet.py
  docs/  00-overview 01-onboarding 02-money-journal 03-home-daily-loop
         04-budget-benchmarks 05-goals 06-education 07-progress-bills
         08-video-updates 09-design-system 10-ai-assets  build-plan
         DECISIONS.md (D01–D40, authoritative)  ASSUMPTIONS.md (A1–A13)
  data/  persona.json seed-state.json journal-questions.json
         peer-benchmarks.json daily-scripts.json buddy-responses.json lessons.json
```

**`data/*.json` is the single biggest accelerator.** Real content, not stubs:
151 ZIP prefixes with cost-of-living tiers, a worked example to self-verify the
benchmark math, 6 days of journal history, all 4 observations with their surface
lists, tip banner copy, daily task list with kibble values, and a keyword
response library for the buddy.

<!-- These land in v3 essentially verbatim as data files. Do not paraphrase the
     numbers into JS literals — load them. They are the spec. -->

### Governance order (stated by the docs themselves)
1. `docs/DECISIONS.md` — beats every other doc, explicitly.
2. `docs/ASSUMPTIONS.md` — "treat as real until told otherwise" (A1 overridden by L1).
3. Feature docs `00`–`10`.
4. **v2** — governs anything the spec never mentions (D37).

---

## 2. Shell preservation — phone frame + admin panel

Stated priority: *don't break the mobile frame or the admin tooling.* With L1
this is largely free. What's load-bearing, so it stays that way:

**Phone frame** (`css/layout.css`)
- `.page` — grid `420px 390px`, collapses to 1 col <900px.
- `.phone` — 390×820, sticky, `--phone` bezel, 38px radius.
- `.screen-scroll` — `absolute; bottom:78px`, reserving nav height.
- Four full-bleed override classes toggled in `render()`: `baby-budget-mode`,
  `lesson-mode`, `streak-mode`, `chat-mode` — each sets `padding:0; bottom:0`
  because nav is hidden there.
- Plus an inline fallback in `render()`: `screenRoot.style.bottom = hasNav ? "" : "0"`.

<!-- GOTCHA: the 78px nav reservation is duplicated in THREE places — the CSS
     default, the per-mode override classes, and the inline JS fallback. v3 adds
     several full-bleed screens (login scene, journal flow, daily update,
     onboarding). Each needs a mode class or it renders with a dead 78px gap.
     `baby-budget-mode` can be retired with the 2MB iframe under L6. -->

**Admin panel** (`index.html` + `layout.css` + `render.js`)
- Static chrome in `index.html`: header, Reset User Data / Dark Mode / Copy
  State, `#adminRoot`, `#adminFooter` (nav log + error log).
- `render()` fills `#adminRoot` from `renderAdmin()`, `#adminSubtitle` from
  `adminSubtitle()` — both big screen→function switches in `render.js`.
- Collapse: `state.adminCollapsed` → `.admin-collapsed` on `.page` + `#adminExpandTab`.
- Dev error catcher is `<script>` #0, before everything.
- Hidden under 768px.

**The admin panel is 100% v2 invention — the v3 spec never mentions it.** D37
says carry it forward. Every new v3 screen needs its **5-point wiring** or the
panel silently degrades to the generic "Jump to screen" fallback:

1. `screens/<name>.js` → `render<Name>()`
2. `<script>` tag in `index.html`
3. `js/render.js` → `renderScreen()` + `adminSubtitle()` + `renderAdmin()` + jump list
4. `js/utils.js` → `activeTabFor` (§4 inverts this — the stack becomes the
   source of truth; keep it only as the admin-jump fallback)
5. `js/state.js` → `destinations[]`

<!-- v3 adds ~15 screens = 75 wiring points. Worth a per-screen checklist rather
     than trusting memory — most mechanical, most easily half-done part of the
     build. Candidate for a tiny node script that greps for missing entries. -->

---

## 3. The 12-category taxonomy is the load-bearing join key

A2 fixes a flat 12: `Housing · Groceries · Dining out · Transport · Utilities ·
Subscriptions · Health · Personal care · Entertainment · Shopping · Debt
payments · Other`.

These 12 are the join key across **four** data surfaces:
- `peer-benchmarks.json → base[category][incomeBand][householdSize]`
- `seed-state.json → budget.monthly` (plan layer)
- `seed-state.json → monthToDateActuals` (actual layer)
- `journal-questions.json → options[].category` (journal layer)

**v2's budget model is a different shape** — 5 nested buckets × 3 subcategories:

```
housing(rent, utilities, hoa) · food(groceries, dining, daily)
transport(car_fixed, gas, transit) · lifestyle(shopping, entertain, subs)
savings(emergency, retirement, debt_extra)
```

<!-- These do NOT map cleanly. v2 folds Utilities under Housing; v3 makes it
     top-level. v2 has no Health / Personal care / Other. v2 has a Savings
     bucket; the v3 twelve have NO savings line at all — saving is a goal, not
     a budget category. So this is a rewrite of the budget data model, not a
     remap, and it cascades into budget.js, budget-category.js, budget-utils.js,
     and the baseline seam. L6 removes both builders, which absorbs much of it. -->

**Do this before Phase 1** — the journal writes entries against this shape.
Getting it wrong means simultaneous rework in the journal, the comparison view,
and My Progress.

---

## 4. Navigation model (L5) — five tabs + top-left home + back stack

### Five tabs, D34 honored literally
`Goals · Budget · My Progress · Education · Marketplace`. Marketplace visibly
greyed out and inert (D33).

Stays at v2's current `repeat(5, 1fr)` — ~63px per tab, no fit regression, no
CSS grid change.

<!-- LABELS: v2 today is Home | Budget | My Progress | Learn | Market. Only two
     change. "My Progress" already ships at this width, so it's proven.
     But D34's "Education" (9 ch) and "Marketplace" (11 ch) are both longer
     than the "Learn"/"Market" they replace and will wrap at 63px.
     DEFAULT: keep the short labels "Learn" and "Market" — D34 names tab
     IDENTITY, not literal label text, and v2 proves these fit. Revisit only
     if the longer words matter to testers. -->

### Home as a top-left icon
Home leaves the bottom bar entirely and becomes a **modestly-sized home icon in
the top-left** of a shared top bar. Sizing: match the 44px tap-target floor,
don't exceed it — this is a utility affordance, not a feature.

**The top-left slot is contextual:**

| Screen condition | Top-left shows |
|---|---|
| Tab root, nav visible (e.g. Budget) | **Home icon** |
| Deeper in a stack, nav visible (e.g. budgetCategory) | **Back button** |
| Full-screen / nav hidden (journal, lesson, onboarding, daily update) | **Back button only** — home icon hidden |
| Home itself | Nothing |

Rationale for hiding home on full-screen screens: there, back *is* the exit, and
two competing escapes on one flow screen is the thing that confuses testers.

<!-- IMPLICATION: v2 has NO shared top bar. Each screen renders its own header
     (home.js has .home-header with a title + Settings button top-right; other
     screens vary). v3 needs a real shared top-bar component, because
     03-home-daily-loop also puts kibble balance, streak counter, buddy level,
     and a hamburger overlay up there.
     This is new work and it touches every screen's header markup. Build it in
     Phase 0e alongside the nav, not per-screen later. -->
<!-- The 78px bottom reservation has a top-bar twin now: whatever height the
     shared bar takes, .screen-scroll needs a matching `top:` offset, and every
     full-bleed mode class must zero it. Same three-places trap as §2. -->

### Contextual back stack — new work

Requirement: a screen reached **from a Home task** gets a back button to Home;
the *same* screen reached **from its own tab** backs to that tab. The path taken
is remembered.

**What v2 already has:**
- `go(screen)` → `history.pushState(getNavSnapshot())`; browser back works via
  `popstate` → `restoreNavSnapshot()`.
- `window.__navLog` — last 10 screens, **admin display only**, not navigation.
- `state.flowOrigin` — a *single* slot, set by `taskGo()` for the 6
  `FLOW_ENTRY_SCREENS`, consumed only by the finish screen.
- `taskGo(destination)` — the home-task entry point that sets `flowOrigin`.

**What's missing:** there is **no in-app back button anywhere** — only browser
back. And `flowOrigin` is one slot, not a stack, and only covers 6 screens.

**Proposed model — per-tab stacks** (standard mobile pattern, matches the ask):

```js
state.nav = {
  activeStack: "home",           // "home" is a stack, just not a tab (L5)
  stacks: { home: ["home"], goals: ["goals"], budget: ["aboutMe"],
            progress: ["myProgress"], learn: ["learn"], market: ["marketplace"] }
}
```

- **Tab tap** → switch `activeStack`. Does *not* push. Returning to a tab
  restores its stack where you left it.
- **Home icon tap** → switch `activeStack` to `home`. Same mechanism as a tab;
  only the affordance differs.
- **`go(screen)`** → push onto the active stack.
- **`taskGo(screen)`** from a Home task → set `activeStack = "home"`, push onto
  the *home* stack. This is what makes `lesson` reached from a Home task back to
  Home, while `lesson` reached from Education backs to Education — same screen,
  two stacks, no special-casing.
- **`back()`** → pop the active stack. At depth 1 the top-left shows the home
  icon instead (or nothing, on Home).
- Keep `history.pushState`/`popstate` in sync so browser back still works.

<!-- WHY per-tab stacks over one global stack: a global stack makes back walk
     backwards through every tab switch, so a tester who taps around four tabs
     needs four backs to escape. Per-tab is what iOS/Android do and it's exactly
     the behavior described. Cost: `activeTabFor()` inverts — the stack now owns
     which tab is active, so activeTabFor becomes a fallback for direct admin
     jumps rather than the source of truth. -->
<!-- flowOrigin can likely be retired once stacks exist — it's a one-slot
     version of the same idea. Check the finish-screen path before removing. -->
<!-- Admin "Jump to screen" bypasses the stack. Simplest: a jump resets the
     target tab's stack to [screen]. Otherwise back lands somewhere incoherent. -->

### Route naming mismatch
`seed-state.json` daily tasks use their own route vocabulary — `money_journal`,
`subscription_confirm`, `budget`, `lesson:apr` — matching no v2 screen id. Needs
a route→screen map, and `lesson:apr` shows routes can carry a parameter.

**`subscription_confirm` does not become a screen (L12).** It maps into the
Money Journal, whose `q_watched` question already captures the engagement signal
that drives the Hulu flag (`07-progress-bills`: "the engagement signal from
journal entries drives this"). The task deep-links into a journal entry rather
than a one-off confirm surface.

<!-- Side effect worth noting: two of the four daily tasks (t_journal, t_hulu)
     now route to the same place. Make the Hulu task's entry state visibly
     different — pre-focused on the watched question — or testers will read it
     as a broken duplicate. -->
<!-- Frame it as a question, never an instruction (07-progress-bills is explicit):
     "Haven't heard about Hulu in a while" — not "cancel Hulu." -->

### Naming trap carried from v2
**The Budget tab's screen id is `aboutMe`**, not `budget` (v2's rename was
label-only). Either carry the id deliberately or rename fully — a half-rename
breaks `activeTabFor` and `destinations[]`.

---

## 5. Feature-by-feature: inherit / extend / build new

| v3 area | v2 today | Verdict |
|---|---|---|
| **Money Journal** (P1, deepest) | nothing | **NEW** — biggest single build |
| Peer benchmarks | nothing | **NEW**, model JSON complete |
| Lifestyle wizard (6 q) | 2 builders, ~2,400L | **REPLACE** (L6) — §6 |
| Budget + 12-cat taxonomy | 5×3 nested buckets | **Rewrite data model** — §3 |
| Three-layer comparison | nothing | **NEW** |
| Daily update + share | nothing | **NEW** — riskiest (§8) |
| Login scene / daily prompt | `streak.js` splash is nearest | **NEW** |
| Home daily loop | `home.js` 197L — "Stage" placeholder + task cards | **Extend** — top bar, tip banner, real buddy, 4 tasks w/ kibble |
| Buddy character | none | **NEW** — descriptive frame (L15), plus owner-supplied static images on top of it (L22). D39/D40 still void — no sheets, no cropping |
| Buddy chat | `chat.js` + `chat-router.js` 263L | **INHERIT** — v2's matcher already *is* D25. Swap in `buddy-responses.json` |
| Onboarding (8 steps) | `about-me.js` 92L only | **NEW** |
| Goals | full Goals V2 module | **REBUILD** (L3) — §7 |
| Education | `learn/topic/lesson/quiz/simulation` + real audio | **INHERIT + extend** (D38) — §9.1 |
| My Progress (6 sections) | `my-progress.js` 396L | **Extend** — trend chart, bills calendar, sub flags |
| Bills calendar | nothing | **NEW** (data seeded in `persona.json`) |
| Marketplace | fully working + detail screen | **Regress to greyed-out** (D33) |
| Trial popup | nothing | **NEW**, small |
| Kibble currency | nothing | **NEW**, small |

Rough split: **~35% inherit, ~25% extend, ~40% net-new** — net-new concentrated
in exactly the two highest-priority phases.

### Resolved (L14): the ~18 v2 screens the spec never mentions

v2 has ~35 screens. The v3 spec names ~15. L3 and L6 already remove six
(`goalCreate`, `goalTracker`, `goalVault`, `babyBudget`, `lifestyleSurvey`,
`lifestyleChain`). That leaves roughly **eighteen** v2 screens the spec is
silent on:

```
myDebts · debtAnalyzer · debtBalances · accountBalances · budgetCategory
budgetSetup · budgetUpdateConfirm · lifestyle · postResult · nextAction
commitment · finish · marketplaceDetail · settings · topic · reward-preview
simulation · streak
```

D37 says carry forward what the spec doesn't mention. Read literally, all
eighteen survive.

<!-- The tension: D37 exists so unspecified DETAIL (copy, layout, patterns)
     falls back to v2 rather than being invented. Applying it to whole feature
     areas is a different thing. The debt analyzer and the post-result loop
     aren't unspecified details of a v3 feature — they're v2 features v3 never
     asked for, and each one is surface area a tester can wander into during a
     session meant to measure journal engagement.
     Against that: they're built, they work, and deleting working screens to
     satisfy a reading of D37 is its own kind of waste. -->

→ **RESOLVED (L14):** all eighteen stay in the codebase and in `destinations[]`,
reachable from the admin jump list — but nothing in the five tabs or the daily
tasks routes to them. Nothing deleted; tester surface stays narrow.

<!-- Pass 7 found this is not a pure no-op. Two SURVIVING screens hold live
     references into deleted code and need rewiring, not just leaving alone:
       screens/about-me.js  — goGoalsEntry() routes to goalCreate/goalTracker
       screens/budget-setup.js — renderBudgetChoice() is the two-card builder
                                  picker, which has one builder left under L6
     See §16.3. -->

---

## 6. Budget builders → one wizard (L6)

Retired: `bb_template.html` (962L iframe) + `build_bb.py`, `js/wizard-bridge.js`
(84L), `screens/lifestyle-survey.js` (532L), `js/lifestyle-survey-bridge.js`
(158L), `js/lifestyle-survey-content.js` (245L), likely
`screens/lifestyle-chain.js` (677L). **~2,400 lines retired** — the single
largest reduction available, and it removes the `babyBudget` iframe +
`baby-budget-mode` CSS + the `postMessage` listener in `navigation.js`.

**Kept:** `js/budget-baseline.js` (213L) — the `submitBudgetBaseline()` seam and
the old→new confirm gate. Good architecture, costs nothing, and the new wizard
becomes its single adapter.

The 6 questions map 1:1 onto `lifestyleModifiers` in `peer-benchmarks.json`:

| Wizard question | Modifier key | Values |
|---|---|---|
| How into food are you? | `foodie` | low / moderate / high |
| How often do you cook? | `cooksAtHome` | rarely / sometimes / usually |
| Hobbies and going out? | `hobbySpend` | low / moderate / high |
| Rent or mortgage? | `paysRent` | yes / no |
| How do you get around? | `commute` | car / transit / mostly walk |
| How often do you travel? | `travelFrequency` | rare / moderate / frequent |

Output feeds the benchmark formula. **Do not use the one-line shorthand** — all
three of its terms are misleading. The verified form, with the household array
index, the two-step tier lookup, and the six-way product, is in
`architecture.md` §5. Recomputed from raw JSON on 2026-08-07: **370**, matching
`worked_example` exactly.

<!-- Verify against worked_example on build: Dining out, band b3, household 2,
     ZIP 90066 (prefix 900 = very_high), foodie moderate, cooks sometimes
     → 275 × 1.34 × 1.0 = 368.5 → 370. If that doesn't reproduce, the model
     wiring is wrong. This is a free unit test the spec handed us. -->

---

## 7. Goals — rebuild to v3 (L3)

v2's module (frozen baseline + append-only events, derived sprints, seeded
cohort via FNV-1a/mulberry32, achievements/medals, `GOALS_TUNING`, simulated
clock) **does not come to v3.** It stays in `versions/v2/`, testable from the gate.

v3 model, from `05-goals.md` + `persona.json`:

```jsonc
strategic: { id, label, setDuringOnboarding }          // exactly one
tactical: [                                             // several
  { id, label, target, current, pacePercent, status, targetDate }, // savings type
  { id, label, target, current, pacePercent, status, period }      // spend-limit type
]
```

Seeded: strategic = "Stop living paycheck to paycheck". Tactical = "$3,000
emergency fund" (620/3000, **41% pace, behind** — this is seeded observation #3)
and "Keep dining out under $320/mo" (429/320, 134%, over).

Three genuinely new behaviors:

1. **Contextual suggestions** — after a meaningful action (finish budget,
   complete lesson, submit journal entry), offer 1–3 suggestions drawn from
   what's on screen, "create your own" always last. Scoped: on the overall
   budget they span categories; inside housing they're housing-specific. Once
   enough goals are in flight, the suggestion becomes "update your goals."
2. **Event-based progress updates** — *never* ask for a number directly.
   "Roughly what's in your checking account?" → updates savings goals. "How much
   did you spend on dining out this month?" → updates spend-limit goals. The
   number moves as a *consequence* of an answer.
3. **Pace over raw figures** — "41% of the pace you set" beats "$620 of $3,000".

<!-- Two goal TYPES with inverted math: a savings goal accumulates toward a
     target (pace = progress vs elapsed time; >100% is GOOD); a spend-limit goal
     is a monthly ceiling (pace = spend vs limit; >100% is BAD). Same card UI,
     opposite semantics, and the seed uses two different status words for it
     ("behind" vs "over"). Very easy to get backwards. -->
<!-- Goals is Phase 5, but the emergency-fund goal is seeded observation #3 and
     must surface on goals + daily_update + progress. The goal DATA must exist
     from Phase 0 even though the tab is built late. -->

---

## 8. Daily update — the risky one (D29)

`daily-scripts.json` already models D29 correctly. Don't "simplify" it:

- `segments[]` — `{ id, text, cue }`. Text here, **never timings**.
- `timings{}` — keyed by segment id, `{ start, duration }` ms. "Safe to
  regenerate wholesale."
- `visualCues.types` — 8 cue types: `buddy_greeting`, `number_reveal`,
  `bar_compare`, `category_grid`, `goal_ring`, `bill_card`, `streak_flame`,
  `summary_stack`.
- Rules: cues reference **segment ids, never timestamps**; a segment with no
  timing estimates from word count at **165 wpm**.
- 3 variants: `slightly_behind` (default, `isDefault: true`), on track, slightly
  ahead — all selectable.

### L10 inverts the timing model

The spec assumes live Web Speech playback, so `boundary` events populate timings
at runtime and the static block is the *fallback*. Under L10 we play a
pre-generated `.wav`, and **`speechSynthesis` boundary events don't fire for
recorded audio.** So:

- **Static timings in `daily-scripts.json` become primary, not fallback.**
- Timings are extracted **once, at generation time**, and written back into the
  JSON — which is exactly the pipeline D29 describes ("script → TTS → timing
  extraction → timings written back"). L10 doesn't violate D29; it implements
  the production version of it rather than the prototype shortcut.
- The `<audio>` element becomes the clock, same as v2's lesson player, and
  `lpIndexForElapsed`'s pattern applies directly.

<!-- This is arguably BETTER alignment with D29 than the spec's own prototype
     shortcut, and it makes playback deterministic — no cross-browser variance
     in whether boundary events fire at all (Safari is unreliable here). -->

### Generating the .wav files (L10)

Browsers can't capture `speechSynthesis` output to a file — there's no audio
stream to tap without loopback hacks. Practical path on macOS:

```bash
say -v Samantha -o segment.aiff "text of the segment"
afconvert segment.aiff segment.wav -d LEI16 -f WAVE
afinfo segment.wav        # duration → the timing value
```

`say` uses the same voice family Safari's Web Speech exposes, runs offline, and
needs no keys — so D04's *intent* (browser-native, no third-party keys, no
ElevenLabs) holds even though its letter ("no build-time audio assets") does not.

<!-- Per-segment files make timing extraction trivial (each file's duration IS
     the segment duration) and let a single segment be re-recorded without
     redoing the whole script. Costs a few more files; worth it.
     Alternative: one file per variant + extracted offsets. More fragile. -->
<!-- Same generator serves the 15 lesson script bodies (L8). Build it once as a
     script in the repo, not as ad-hoc commands. -->

<!-- REUSE the PATTERN from v2's lesson player (lpIndexForElapsed maps elapsed →
     current line). Do NOT reuse the data shape: v2 indexes by a timestamp array
     (cues[i] = seconds), which is exactly what D29 forbids. -->
<!-- Three of the 8 cue types map onto components v2 already has:
     goal_ring → components/badge-ring.js, streak_flame → streak-counter.js,
     bar_compare → thermometer.js. Check before building new. -->

---

## 9. Gaps and contradictions found in the spec

Each decided once, not re-litigated mid-build.

1. **Lesson script text does not exist.** `lessons.json` `scriptVariants[]`
   carry only `{ id, matchTags, audioId, emphasis, isFallback }` — **no script
   body anywhere**, for any of the 15 variants across 3 lessons. But
   `06-education.md` says "Script — pre-generated for every combination of
   answers." The pre-generation never happened; `audioId` also implies audio
   files that don't exist. Framing questions + tag matching are fully buildable
   today — the thing they *select* is missing.
   → **RESOLVED (L8):** author all 15 bodies; v2's `interest-builds` narration
   is reused as one of the APR variants. Generate audio per §8.

2. **Seeded observation #1 contradicts its own numbers.**
   `obs_dining_over_peers` is typed `peer_gap`, headlined "more on dining out
   **than your peers**", but carries `userValue 429, peerValue 320` — and 320 is
   the **budget**, not the peer benchmark. The true peer value is **370**
   (`worked_example`: 275 × 1.34 × 1.0 = 368.5 → 370).
   So peer gap = 16%, plan gap = 34%. Headline says peers; numbers and `detail`
   say plan. `peer-benchmarks.json` flags this itself in `_note_gap`, and
   `04-budget-benchmarks.md` says the seeded observation uses the *plan*
   comparison. → **The headline is wrong, not the numbers.** Reframe to "over
   your plan"; let the peer framing (429 vs 370, 16%) be its own distinct card.
   Both must appear, labeled distinctly — `04` calls this out as a trap.
   → **RESOLVED (L11):** reframe the headline; add the separate peer card.

3. **Buddy art: SVG vs raster.** `01-onboarding.md` says hand-authored
   parameterized SVG, fur/eye/nose as fill variables, "every combination
   renders." D10/D39/D40 say externally-generated **raster** sprite sheets, flat
   cream `#FBF7F0`, CSS `background-position` cropping, 3 breeds × 4 fur = 6
   sheets, **eye/nose selection explicitly dropped**. → DECISIONS wins by its own
   stated rule, so at the time this was logged `01-onboarding.md` was the stale one.
   → **RESOLVED (L15 + L18), and the resolution inverted.** No art was produced at
   the time, so D39/D40's constraints — which existed *only* because raster can't
   recolour — are void. There are no sheets to crop, and eyes/nose cost nothing,
   so 01-onboarding's five attributes are restored.
   → **Still true under L22.** Owner-supplied images are separate files chosen by
   buddy state, not sheets addressed by offset, so nothing about D39's cropping
   machinery comes back and the five attributes stay. **Do not build the
   `background-position` cropping machinery.** D10's "must not generate" is
   satisfied trivially.

4. **Web Speech vs v2's audio file.** D04: "Web Speech API for **all**
   text-to-speech." But v2's lesson player is driven by a real `.wav`
   (`LP_AUDIO: interest-builds → assets/audio/interest-builds.wav`) where the
   `<audio>` element *is* the clock (`lp.elapsed = audio.currentTime`), with an
   authored `cues[]` virtual-clock fallback — commit `7bf0fda` did that
   deliberately. D38 says don't rewrite the lesson player. → D38 is the more
   specific rule: lesson player keeps its `.wav`; D04 governs the **new**
   surfaces (daily update).
   → **RESOLVED (L10):** neither, exactly. Web Speech becomes a **build-time
   generator** producing `.wav` files; runtime plays `.wav` everywhere. D04's
   intent (browser-native, no keys) holds; its "no build-time audio assets"
   clause does not. Also flips the lesson stage default to `clean` — set
   `state.lpStageStyle` to `"clean"` in `js/state.js`; `"waveform"` stays as the
   non-default admin option. See §8 for the generation pipeline.

5. **Two incompatible badge/XP models.** v2: Copper/Silver/Gold, maxLevel 10,
   `xpConfig { bonusMultiplier: 5, discountedRate: 0.5, quizQuestionsRequired: 3 }`,
   48 seeded questions. `lessons.json`: bronze/silver/gold/platinum/diamond,
   500 XP/tier, 50/correct, 100/complete, +50 daily-task bonus, **1 question per
   lesson**. Can't run both.
   → **RESOLVED (L9):** `lessons.json`'s 5-tier progression and XP values, kept
   admin-tunable via v2's `xpConfig` panel controls. v2's 48 seeded quiz
   questions stay available as a content pool — `lessons.json` ships only 1
   question per lesson, which is thin for a real quiz.

6. **Journal question types don't match the prose.** `02-money-journal.md` and
   PROGRESS.md say "multiple choice, fill-in-number, **dropdown**." Data has
   `multi_select` (4), `fill_number` (2), `single_select` (1), `free_text` (1) —
   **no dropdown at all**. Also `multi_select` means picking *several* options
   per question (breakfast: "coffee out" *and* "ate at home"), richer than
   "multiple choice."
   → **RESOLVED:** data wins; drop dropdown.

7. **Two buddy responses have `bubble: null`** (11 of 13 have labels).
   → **RESOLVED (pass 7):** they are `advice_deflect` and `catch_all`. Keyword-only
   by design — neither should be offered as a bubble. `advice_deflect` is how D26
   ("no financial advice, ever") is enforced inside chat, so it is load-bearing,
   not filler.

---

## 10. Scope — full 7 phases (L7)

**L7 — build all 7 phases as specified**, including the full audio pipeline and
the three selectable engagement variants. Nothing deferred.

Accepted consequence: **this will not fit in one session.** ~15 new screens, a
rewritten budget model, a rebuilt goals module, a new nav stack. The build is
planned to be *resumed*, not completed in one pass — see §13.

<!-- Scope reduction is NOT taken, but keep the levers documented in case they're
     needed mid-build. Thin from the bottom, per build-plan.md:
       1st: Education (Phase 5) — D05 says "first to thin", and it's blocked
            anyway by the missing script bodies (§9.1).
       2nd: Phase 4 daily update → static, non-speech. Keep the observations
            summary + anonymization preview (the stated trust mechanic); drop
            Web Speech sequencing and animated cues.
     Do not thin Phases 1–2. They are the two things the prototype exists to
     validate. -->

---

## 11. Suggested build order (adjusted for L1–L19)

Deviates from PROGRESS.md Phase 0 only because the React/Tailwind items are void.

```
0a. Fork       cp -R versions/v2/. versions/v3/   ← trailing dot: v3/ ALREADY
               EXISTS (holds docs/). A bare `cp -r versions/v2 versions/v3`
               would nest it as versions/v3/v2/. Then: gate entry; v1 untouched
0b. Strip      retire both builders (L6), Goals V2 module (L3),
               marketplace → greyed-out
0c. Data       data/*.json + generated data/*.js wrappers (L13); boot into state
0d. Taxonomy   rewrite budget model to the flat 12       ← before Phase 1
0e. Shell      5-tab nav + top-left home + per-tab back stack (§4);
               shared top bar; SKIP_ONBOARDING seam
1.  Journal    questions → confirmation → entries          (deepest)
2.  Benchmarks wizard → peer model → 3-layer comparison
3.  Daily loop login → home (top bar, tip, buddy, tasks) → chat → streak
4.  Update     full — pre-generated .wav + static timings + 3 variants (L7, §8)
5.  Goals / Progress / Education
6.  Pass       D19 empty-screen sweep, mobile, reduced motion, focus
```

<!-- 0d is the one I'd most insist on — the taxonomy is the join key across four
     data surfaces (§3) and every later phase writes against it.
     0e is second: the back stack changes go()'s contract, and retrofitting it
     after 15 screens exist means touching all 15. -->

---

## 12. Open questions

Rounds 1–8 → L1–L19 (§0). **One open item: D36's repaint phase (§15)** — needed
before Phase 2 completes, not before Phase 0 starts. Nothing blocks the fork.

Small calls deliberately left to build time, with defaults recorded so they
aren't rediscovered as questions:

| Call | Default | Where |
|---|---|---|
| "Education"/"Marketplace" wrap at 63px | Keep v2's short "Learn"/"Market" — D34 names tab identity, not label text | §4 |
| Two `buddy-responses.json` entries have `bubble: null` | Treat as keyword-only fallbacks, no bubble affordance | §9.7 |
| `lessons.json` ships 1 quiz question per lesson | Draw from v2's 48-question pool to reach `quizQuestionsRequired` | §9.5 |
| Per-segment vs per-variant audio files | Per-segment — duration *is* the timing, and one segment can be re-cut alone | §8 |
| Home icon glyph | Inline SVG, ≤44px — no icon library under L1 | §4 |

---

## 13. Resumability — designed for running out of context (L7)

The build will span multiple sessions. A fresh session starts cold: no memory of
this analysis, no memory of what was half-finished. The cost of that is
re-derivation — rereading v2, rereading the spec, re-making decisions already
made. **Everything below exists to make that cost near zero.**

The v3 spec already ships the right pattern (`PROGRESS.md` + a `/next-task`
command that reads it). Adopt it, adapted for L1–L19.

### The durable file set

| File | Job | Changes | Exists? |
|---|---|---|---|
| `plan.md` (this file) | **Why.** Locked decisions, gotchas, spec contradictions. The reasoning that would otherwise be re-derived. | Rarely — when a decision changes | ✅ |
| `versions/v3/docs/architecture.md` | **How.** Cross-cutting contracts: data loading, taxonomy, nav, top bar, audio, standing rules. | Per phase, as contracts firm up | ✅ |
| `versions/v3/PROGRESS.md` | **Where.** Checklist of every build item, with divergence notes and a `Current state:` line. | Constantly, as work lands | ✅ |
| `versions/v3/docs/spec-coverage.md` | **Audit.** All 40 D-decisions + 13 A-assumptions → where each lands, or "deferred". | Once, then when scope shifts | ✅ |
| `versions/v3/CLAUDE.md` | **Guardrails.** Auto-loads in the v3 folder; carries the hard rules so they bind without anyone reading a doc. | Rarely | ❌ **not yet** |
| `v3 Files/spec/**` | **Reference.** The unmodified spec. | Never — read-only | ✅ |

<!-- Keep them separate. Merging means the "why" gets buried under churn, and
     the churn file is the one that gets skimmed. -->
<!-- Per-phase design docs (versions/v3/docs/phase-N-*.md) are written
     just-in-time, not up front — design detail has a shelf life. See
     architecture.md §13 for what's deliberately deferred. -->

### Session-start protocol

Written to be followed literally by a cold session:

```
1. Read plan.md §0 (locked decisions) and §13. Do not re-litigate §0.
2. Read versions/v3/PROGRESS.md. Find the first unchecked item.
3. Read the spec section for that phase:
   v3 Files/spec/docs/<the relevant doc>.md  (already unpacked)
   (DECISIONS.md overrides it; ASSUMPTIONS.md fills gaps)
4. Read only the v2 files that item touches. Do NOT re-survey v2 wholesale —
   plan.md §2–§8 already records what's there.
5. Implement to the next natural boundary. Check items off as they land.
6. Note any divergence inline under the item, one line, with the why.
```

### PROGRESS.md must be adapted, not copied

The spec's `PROGRESS.md` is written against React/Vite. Under L1–L19 it needs:

- **Delete** "Vite + React + Tailwind project initialized" and "Design tokens in
  Tailwind config" (void — L1, L2).
- **Add** Phase 0 items: fork v2 → v3; add gate entry; retire both builders
  (L6); remove Goals V2 module (L3); marketplace → greyed-out; rewrite budget
  model to the flat 12 (§3); 5-tab nav + top-left home + back stack (§4);
  script-wrapped data loading (L13).
- **Add** a "Decisions" pointer at the top: *read `plan.md` §0 first.*
- **Rewrite** the Goals items in Phase 5 against the v3 model (§7), not v2's.
- **Keep** a one-line `**Current state:**` at the very top, updated every
  session — what's done, what's mid-flight, what's next.

<!-- The "mid-flight" note matters more than the checkboxes. A checked box says
     something finished; nothing says "this screen renders but its admin panel
     isn't wired yet." That half-done state is exactly what a cold session
     misreads as complete. -->

### Checkpoint discipline

- **Commit + push at every phase boundary**, and at any point a coherent unit
  works. (Repo convention: commit and push are one action.)
- Update `PROGRESS.md` *in the same commit* as the work it describes — so
  `git log` and the checklist can never disagree.
- Never leave a session with an unwired screen. The 5-point admin checklist
  (§2) is the definition of "wired." Finishing the wiring is cheaper than
  rediscovering which of the 5 points is missing.
- Syntax-check every touched file: `node --check path/to/file.js`. No browser
  in this environment means that's the only automated gate available.

### What NOT to redo on resume

Recorded here because each cost real effort and would otherwise be repeated:

- The spec zip is already unpacked to `v3 Files/spec/` and read; §1 lists it.
- The loose `.md` files in `v3 Files/files/` are **byte-identical** to the zip
  copies — verified by diff. Don't diff them again.
- v2's structure is mapped in §2–§8: shell, nav, budget model, goals, lesson
  player, navigation/history.
- The seven spec gaps in §9 are found and resolved. Don't rediscover them.
- The benchmark model has a free self-test: `worked_example` (§6).

---

## 14. Review log — pass 5

Consistency review of `plan.md` + `architecture.md`, top-down then bottom-up
against the actual data files. What it caught, so the same ground isn't re-walked:

### Correctness (found bottom-up, by checking prose against data)

1. **The peer benchmark formula was wrong.** `architecture.md` §5 copied the
   spec's one-line shorthand, which misrepresents two of three terms:
   - Cost of living is a **two-step** lookup — `zipPrefixes[zip3]` returns a
     tier *name*, then `tiers[name][category]` is the multiplier. There is no
     `colTier[zipPrefix][category]`.
   - Lifestyle is a **product across all six dimensions**, not one lookup.
     Dining out is modified by both `foodie` and `cooksAtHome`.
   The `worked_example` coincidentally passes under the wrong reading because
   every one of the persona's modifiers happens to be 1.0 — it would diverge for
   any other persona. Fixed.

2. **`_note` keys contaminate `Object.keys()`.** Present in
   `monthToDateActuals` (13 keys), `PEER_BENCHMARKS.base` (13),
   `colTiers.zipPrefixes` (151), and `lifestyleModifiers` (7). Iterating any of
   them yields a `_note` "category". Rule added: always drive from `CATEGORIES`.

3. **The self-reported layer was unspecified.** Both `monthToDateActuals` and
   `journalHistory` were mapped into state without saying which is the
   comparison figure. It's month-to-date ($429); the six days are drill-down
   detail totalling roughly $150. Getting it backwards breaks every observation.

4. **`q_watched` is `signalOnly` with a 2-day cooldown** — produces no financial
   entry, and ordinary selection can skip it, so the Hulu task's deep link must
   bypass cooldown or route to an entry missing the question it exists to ask.

5. **`q_balance` carries `updatesGoalProgress`** — 05-goals' event-based update
   mechanism is implemented as a journal question. Phase 1 must emit the event
   even though Phase 5 consumes it. Also `setsRecurring` is tri-state
   (`true`/`"weekdays"`/`false`), not boolean.

### Contradictions inside this file

6. **`§11` and `§13` still said "6-tab nav"** after L5 moved to five tabs plus a
   top-left home icon. Fixed in both.
7. **`§11` still said "Web Speech + boundary timings"** after L10 established
   that boundary events don't fire for recorded audio and static timings are
   primary. Fixed.

### Staleness

8. Spec paths pointed at `v3 Files/files/…zip` after the unpack to
   `v3 Files/spec/`; decision-range references said L1–L6 / L1–L7 / L1–L12; the
   durable-files table listed two files when there are six.

### Gaps closed by rounds 6–8

9. The **~18 unmentioned v2 screens** had been dropped from this file in an
   earlier rewrite. Restored as §5 and resolved by L14.
10. **Copy and quality rules were nowhere** — no financial advice (D26), no
    exclamation marks (A13), 90-char tip limit, fixed vocabulary, D19's
    no-empty-screens, reduced motion, 44px targets. Added to `architecture.md`
    §12 as standing rules, since they bind every screen.
11. **Three repo-integration edits outside `versions/v3/`** were untracked:
    `gate/gate.js` VERSIONS array, root `CLAUDE.md` version prose, and a new
    `versions/v3/CLAUDE.md`. Added to `architecture.md` §1.

### Still missing

`versions/v3/CLAUDE.md` only — and that is written as **Phase 0a**, not before,
because it belongs inside the forked folder. `PROGRESS.md` and
`spec-coverage.md` were written after this review (pass 6). See §13's table.

### Pass 6 — coverage audit

`spec-coverage.md` maps all 53 spec items. Two open items came out of it:

- **D36 (Finch-like repaint) has no phase.** L2 deferred it to "a later
  dedicated pass" that was never scheduled — it is in none of Phases 0–6. It is
  the only D-decision with no home, and it's the visual thesis of the product.
  → **§15 below.**
- **`persona.connectedAccounts` has no consumer.** Its `selfReportedBalance:
  1840` is exactly what `q_balance` asks for, so it should pre-fill the
  event-based goal update in Phase 1 rather than sit orphaned.

<!-- versions/v3/CLAUDE.md is written as Phase 0a, not before — it belongs in
     the forked folder, and 0a is where the folder becomes real. -->

---

## 15. ⚠ Open: D36 has no phase

Surfaced by the coverage audit (pass 6). Every other spec decision lands in a
named phase. This one doesn't.

L2 deferred the Finch-like repaint — cream/sage/apricot, rounded, soft — to "a
later dedicated pass," on the reasoning that repainting while screens are still
moving is churn. That reasoning still holds. But the pass was never scheduled
into Phases 0–6, and unscheduled work does not happen.

The stake is not cosmetic. D36 and `09-design-system.md` are explicit that this
is *"an app about money that is deliberately not trying to look like a bank."*
v2's palette is `--accent: #315efb` on `#f8fafc` — blue fintech, which is
approximately the opposite. Testers would be reacting to the wrong product.

Two ways to close it:

- **Phase 2.5** — after Phase 2, so the budget and comparison screens exist and
  most surfaces are real, but before Phases 3–4, which are the most visually
  authored pieces (buddy stage, login scene, daily update) and the most
  expensive to repaint twice.
- **Fold into Phase 6** as a real work item rather than a polish pass.

<!-- Leaning Phase 2.5. Phase 6 is described as "not polish — a correctness
     sweep", and a full repaint at that point competes with the empty-screen and
     reachability checks it is actually for. Repainting before the buddy stage
     and daily update are authored also means authoring them once, in the right
     palette, rather than building blue and converting.
     Against: it delays the daily loop, and L2's original reasoning (don't
     repaint while screens move) argues for later, not earlier. -->

→ **DECIDED (L19): Phase 2.5.** Scheduled in `PROGRESS.md` between Phases 2 and 3.

Reasoning: Phase 6 is explicitly *"not polish — a correctness sweep"*, and a full
repaint there would compete with the empty-screen and reachability checks it
exists for. Putting it at 2.5 also means the most visually authored surfaces —
buddy stage, login scene, daily update — get **authored once in the right
palette** rather than built blue and converted.

L2's original reasoning (don't repaint while screens are still moving) is
respected: by the end of Phase 2 the taxonomy, budget, and comparison screens are
settled, so the churn L2 was avoiding has already happened.

<!-- I made this call rather than leave a hole in a plan described as final. It
     is the cheapest decision here to reverse — moving a repaint later costs
     nothing but a second pass over whatever Phases 3–4 authored in the interim.
     Say so if you'd rather it sat at Phase 6. -->

---

## 16. Review log — pass 7 (deep verification)

Max-effort pass. Method: **recompute every structural claim from the raw JSON**
rather than re-reading the prose, then map the strip's real blast radius in v2.
Prose review finds contradictions; only recomputation finds wrong numbers.

### 16.1 The benchmark formula was wrong in a *second* place

Pass 5 fixed `architecture.md` §5 and logged it as done. **`plan.md` §6 still
carried the original one-liner.** A cold session reading §6 would have
implemented the broken version and the review log would have said it was fixed.

Worse, the corrected version was *still* incomplete. Recomputing from raw JSON:

- **`base[cat][band]` is a 4-element ARRAY, indexed by `householdSize − 1`.**
  `"b3": [180, 275, 330, 385]`. Household 2 → index **1**. `4+` clamps to index 3.
  Written as `[householdSize]` it returns the next household's figure — a
  plausible-looking wrong number that nothing catches.
- Cost of living is a two-step lookup (prefix → tier *name* → multiplier).
- Lifestyle is a product across six dimensions.

**Full recompute: 275 × 1.34 × 1.0 = 368.5 → 370.** Matches `worked_example`.
The model is now verified end-to-end, not assumed.

<!-- Why the self-test didn't catch it: the persona is household 2 and every one
     of its lifestyle modifiers is 1.0, so THREE separate wrong readings all
     return 370 for this one case. A green worked_example proves almost nothing
     unless the shape is verified independently. -->

### 16.2 Two answer-key traps and a coverage limit

- **`paysRent` keys are the strings `"true"` / `"false"`**, not booleans. A
  boolean misses the table.
- **`commute` keys are `car` / `transit` / `none`**, but the wizard question says
  "car / transit / **mostly walk**". That label appears nowhere in the data.
- A missed key contributes **1.0**, so both failures are silent.
- Lifestyle reaches only **7 of 12 categories**; only Dining out and Groceries
  ever get more than one multiplier.

### 16.3 The strip is not a pure delete

Two **surviving** screens hold live references into code being removed:

| File | Reference | Action |
|---|---|---|
| `screens/about-me.js` | `goGoalsEntry()` → `goalCreate` / `goalTracker`, reads `state.goalsV2` | **Rewire** to the v3 goals model — the Budget tab is the entry point to goals |
| `screens/budget-setup.js` | `renderBudgetChoice()` — the two-card builder picker | **Collapse.** One builder left under L6, so a "choose your builder" screen has nothing to choose |

Full reference maps: Goals V2 is touched by 6 files outside `js/goals/`; the two
builders are touched by 11 files outside their own. All 15 files named in the
0b strip list were confirmed to exist.

<!-- budget-setup.js also fronts the Budget-tab empty state (commit 36cee1c
     added a builder-choice popup there). Under L6 that popup goes too. -->

### 16.4 Three traps in the lesson framing trees

- **The key is `tag`, singular — not `tags`.** *My first check used `tags`, found
  nothing, and I nearly logged "the framing tree emits no tags" as a fourth major
  spec gap.* It was a false alarm from my own typo. The trees are well-formed.
  A real implementation making the same slip gets an empty tag set and plays the
  fallback variant every time — a silent wrong-script failure.
- **`next` lives at two levels** (per-option on 5 questions, per-question on 3)
  and every lesson's `f3` is terminal with no `next` anywhere. Resolution order:
  option → question → terminal.
- **`nocard` is declared in `apr_v5.matchTags` but never emitted.** Harmless —
  `apr_v5` is reachable via `no_debt`. Don't invent a question to "fix" it.

Unmatched tags (`unsure_apr`, `unknown_*`, and all of `f3`'s confidence tags)
routing to the fallback is **the design**, not a gap — `apr_default` says so
itself. That's 06-education's "'I don't know' is a first-class answer."

### 16.5 Clean bills of health

Verified sound, so nobody re-checks them:

- All 3 daily scripts: 7 segments each, **every segment timed**, every `cue`
  resolves. Only `number_reveal` is declared-but-unused.
- `base` and all 4 `colTiers.tiers` cover all 12 categories with no gaps.
- Every `buddy-responses` `followUp` id and every `openingBubbles` id resolves.
- Every `journalHistory` category is a valid taxonomy member.
- Tip banner is 67 chars against the 90 limit.
- 6-day journal totals **$167.65** dining vs month-to-date **$429** — confirms
  the layering in `architecture.md` §5 with real numbers.
- Observation surfaces: dining 4, hulu 3, emergency 3, insurance 3. Every one
  clears D18's ≥2 bar, so Phase 6 passes by construction.

### 16.6 Doc-consistency fixes applied

`§5` still said the ~18 screens were "Not decided" after L14 decided them, and
its table still promised "external raster art" after L15 deferred it (L22 has
since allowed owner-supplied stills, but never sheets). `§9.3` still
said step 7 "must drop eyes/nose" — the exact opposite of L18. `§10` still said
"Web Speech timing sync" after L10. `§12` claimed "all closed" while `§15` had an
open item.

<!-- Pattern worth noting for future passes: every one of these is a section that
     was CORRECT when written and went stale when a later decision landed. The
     locked-decision table is cheap to update; the prose that references it is
     where the rot accumulates. Grep for the L-number when a decision changes. -->

---

## 17. Four themes (L21) — post-Phase-6 change

Requested after the build was complete and swept. The ask: offer Light, Dark,
Natural Light and Natural Dark in the admin panel, with Dark as the default.

**The default was later reversed to Natural Light** (2026-08-28). Everything
below about *why the v2 pair is worth carrying* still holds — the comparison
is the point, and it works in either direction. Only which one a tester lands
on first has changed.

### 17.1 Why the v2 pair is worth carrying

D36 replaced v2's blue-on-white with the cream/sage Finch palette, and once a
repaint lands the thing it replaced stops being available to compare against —
you are left arguing from memory about whether it improved. Keeping v2's palette
as two switchable themes makes the comparison a two-click A/B on the *same*
screen with the *same* data. That is worth more than the ~120 lines it costs.

The corollary: **Light and Dark reproduce v2 faithfully, including its real
alarm reds.** D36's "no red" governs the product design, which is the Natural
pair. The v2 pair is the control in the experiment and is not held to the rule
it exists to be measured against. Softening its reds would defeat the point.

### 17.2 The contract, and why it is enforced

`:root` keeps the full Natural Light token set, so every token always resolves
and nothing can render unset. The other three themes are classes on `.screen`.

The failure mode this invites is specific: a theme that omits a token silently
inherits `:root`'s **cream**, painting one warm patch into a cool theme. It does
not look broken — it looks like a deliberate accent. So the contract is machine-
checked: all 40 colour tokens in every theme, no more, no fewer (`sweep.sh` §1b).
Adding a token to `:root` now fails the sweep until all three themes define it.

### 17.3 Three defects found, all pre-existing

**Eight dead overrides.** `.dark-mode` set `--bg`, `--phone` and six `--chrome-*`
values, but the class sits on `.screen` while all eight are consumed by `body`,
`.phone` and `aside.admin` — an **ancestor and a sibling**. Dark mode never
retinted the page, bezel or admin panel despite six lines that read as if it
did. Deleted rather than wired up: chrome staying neutral is the stated design
(§2, and the owner's "don't break the frame" constraint), so the code was wrong,
not the behaviour. The sweep now asserts no theme touches those tokens.

**An implicit colour pairing that only held by luck.** Four rules hardcoded
`color: var(--on-dark)` over `background: var(--accent)`, and the primary button
hardcoded `color: var(--ink)` over `--accent-fill`. That works only while
`--accent` stays dark — but it *inverts* between light and dark themes, so
Natural Dark was already painting cream text on pale sage at roughly 1.6:1. Two
new tokens, `--on-accent` and `--accent-fill-text`, make the pairing explicit
and let each theme resolve it. In both light themes the value is unchanged, so
nothing shifts visually; the dark themes get a readable pill.

**`--info` at 3.92:1.** The D36 palette deepened `--accent` and `--good` by eye
to clear 4.5:1 and missed `--info`. The contrast gate added with the themes
caught it on its first run. Now `#456F86` (4.88:1) — the lightest value that
clears, to stay closest to the original sky.

<!-- The lesson repeated from §16: the first two were invisible to inspection
     and to a rendering sweep, because both produce plausible output. What found
     them was asking "which element is this class actually ON?" and "what does
     this token resolve to in EVERY theme?" — questions worth asking whenever a
     value is used relationally rather than absolutely. -->

### 17.4 Not fixed — logged instead

Admin-panel buttons use the app's `.button` class, so they read `--accent` and
`--chrome-*` at once. They currently render with `:root`'s natural-light accent
regardless of theme, because theme classes never reach outside `.screen`. It is
stable and legible, so it is not breaking anything — but it is product styling
leaking into instrumentation, contrary to §2. Out of scope for L21; worth a pass
if the admin panel is ever restyled.

---

## 18. Code review — v3 + shared surfaces

Full read of v3's 62 files, the gate, and the committed scripts, requested
before the owner's refactor. Four defects, all fixed; four refactor targets
logged and left alone.

### 18.1 The four defects

**A name declared in two files.** `chatResetConversation()` existed in both
`js/chat-router.js` and `screens/chat.js`. Everything shares one global
namespace, so the later `<script>` won and the router's copy had never run. The
two differed: the router's restores the opening bubbles, the shadowing one only
cleared messages. Since `chatBubblesAfter()` swaps in contextual follow-ups
after every reply, and `renderChat` falls back to the opening set only when
bubbles is *empty*, "Reset Conversation" left chips pointing at a thread that
no longer existed. The duplicate is gone; the router's version is the survivor.

**Four product sliders destroyed themselves mid-drag.** `budgetSetPlan`,
`lwAdjust`, `lessonSimSet` and `journalAdjustEntry` called undebounced
`render()` from `oninput` on a `type="range"`. `render()` reassigns `.screen`'s
innerHTML, so the element under the pointer is replaced on every input event and
the drag stops tracking. Now `debouncedRender()`. `budgetSetPlan` also serves an
admin number field on `onchange`, so it took a `live` flag rather than making
that field wait 400ms.

**"Copy State" dumped v2's shape.** `copyAppState()` named `budget.status` and
`budget.wizardInputs`, neither of which exists in v3 — nothing writes them, and
`JSON.stringify` drops undefined keys, so it failed silently. Worse, it captured
none of v3: no `plan`, `mtd`, `journal`, `goals`, `observations`, `nav`. A
snapshot that cannot see the plan-vs-reported gap is useless for diagnosing the
prototype built around it. Rewritten to the three-layer model.

**Reduced motion reset duration but not delay.** `.du-stack-card` staggers via
`animation-delay: calc(var(--i) * 90ms)` with `backwards` fill, which holds each
card at the keyframe's `opacity: 0` for the length of its delay. Zeroing only
the duration left the daily-update cards invisible and then popping in one by
one — the exact motion the setting asks to remove. The block now resets delay.

### 18.2 Two checks added, both negative-controlled

§7b gained a **duplicate-declaration** check, because its reference count is
structurally blind to shadowing: the dead copy is still referenced, so it looks
alive. And section 4 gained a **behavioural** guard that a chat reset restores
the opening bubbles — written to fail if a reply never moves the bubbles in the
first place, so it cannot pass vacuously. Re-introducing the original defect
fails both, from independent angles.

`copyAppState()` is now exercised too. It is reachable only from an `onclick` in
`index.html`, so nothing else ran it — which is why it drifted three phases
behind the state it reports on.

### 18.3 Logged, not fixed — wide diffs the owner should eyeball

- **74 of 337 CSS classes are unreferenced (~22%)**, concentrated in
  `budget-tile-*`, `bb-iframe` and `lifestyle-img-*` — residue from Phase 0b,
  where the markup went and the CSS stayed. Biggest cleanup available, in the
  biggest file (`components.css`, ~1,870 lines).
- **`state.budget` is misnamed.** It holds `fixedOverhead` and `debts`; the
  budget is `state.plan`. `state.budget.monthly` has no readers at all. Anyone
  reaching for the obvious name gets debts.
- **`--tier-copper` is duplicated** as the literal `#b87333` in `state.js:730`.
- **All four scripts hardcode `versions/v3`**, so a v4 fork silently keeps
  sweeping v3.

### 18.4 Verified clean

Escaping is disciplined — 20 of 20 user-input interpolations use `h()`, and
`h()` escapes `&` first. `finish.js` looked raw but escapes at the output
boundary, which is the better pattern. No `_note` trap violations: all six
`Object.keys` calls are on plain state, never category-keyed data. Six
hardcoded hex values in 13,000 lines. The gate is sound.

<!-- Three of my own findings were false positives, each caught by checking the
     claim instead of trusting the scan: a `render()` match inside a comment, a
     `${...}` that is escaped one line later at the output site, and a caller
     analysis that missed onclick handlers and dispatch tables entirely. In a
     codebase where behaviour hides in strings, grep is a lead, not a verdict. -->

---

## 19. Review of §18 — the fixes had their own bugs

`/code-review max` run against `8ea4f79`. Six of eight angles died on a session
limit; two completed and returned 14 findings. All 14 verified before acting —
they hold. Scope note: the run reviewed **the last commit only**, not v3.

### 19.1 I repeated the exact defect I was fixing

§18 rewrote `copyAppState()` because it named `budget.status` and
`budget.wizardInputs`, keys that do not exist. The rewrite then read
**`state.goals` and `state.tasks`** — which `boot.js` documents as v2's parked
arrays. v3 uses `state.strategicGoal` / `state.tacticalGoals` /
`state.dailyTasks`. So the new snapshot reported keys that look authoritative
and describe nothing on screen: the same defect, one level up.

It also captured `journalSession`, which is null everywhere except mid-journal,
while the journal data that persists (`state.journal`, `state.journalEntries`)
went uncaptured — and reduced observations to bare ids, dropping the computed
figures that are the only quantification of the plan-vs-reported gap.

The parked-name table now sits in a comment directly above `appStateSnapshot()`,
because the obvious spelling is the dead one and that will catch someone again.

### 19.2 The check written to prove the fix proved nothing

§18's "state snapshot carries the three layers" check built **its own object**
from `state` and asserted on that. `copyAppState`'s output was never inspected.
It was a tautology over `bootV3()` — deleting `plan` from the snapshot left it
green. Now `appStateSnapshot()` is a separate function returning the object, and
the sweep asserts on what it actually emits, including that the v2 names do
*not* appear at top level.

### 19.3 The slider fix traded one visible bug for two

Debouncing stopped the dragged element being destroyed, but three of the four
sliders derive `max` from the value they control (`plan * 2.2`). Undebounced
that merely churned; debounced it **recoils** — drag 200 → 400 and 400ms later
the ceiling doubles and the thumb springs back to the same 45% while the number
reads 400. And because only `render()` painted the figure, the readout was dead
for the whole gesture.

Fixed properly: `budgetSliderMax()` derives the ceiling from the seeded plan and
the peer figure, neither of which a drag can move; journal entries freeze a
`baseAmount` at build time. Each handler paints its own readout directly, so the
number tracks the thumb while the debounce owns the rest of the repaint.

### 19.4 A 400ms window that could eat a keystroke

`debouncedRender`'s timer was never cleared, so a drag left a repaint pending
for up to 400ms. Focus a text field inside that window and the queued render
wipes it — silently, since removing a focused input fires no `change` and every
non-slider input here commits on `onchange`. The window did not exist before
§18: with a synchronous render there was never anything pending. `render()` now
calls `debouncedRenderCancel()` first, so a queued repaint can never land after
a newer one.

### 19.5 The slider fix shipped with zero coverage

The DOM stub's `setTimeout` discarded its callback, so `debouncedRender()` was a
no-op under the sweep — and no check called any of the four handlers. A
misspelled `debouncedRender` would have passed 54/54 and thrown in a browser on
the first pointer move. The stub now queues timers with a `flushTimers()`, and
each handler is asserted **individually** to debounce. Checked per handler on
purpose: an aggregate "something queued" assertion stays green while three
debounce and the fourth does not.

### 19.6 Two checks that lied about themselves

The duplicate-declaration check appended per occurrence, so a name declared
twice in **one** file printed as `x.js , x.js — last one wins`, reading as a
cross-file shadow. It now reports distinct files and labels the scope. And
`sweep.sh` asserted "§7b cannot catch this" one line from the check where §7b
does catch it — the missing word was *reference count*.

### 19.7 Stale prose the fix created

"Admin sliders are the exception" survived in three binding docs — root
`CLAUDE.md`, `versions/v3/CLAUDE.md` (one line above its own correction) and
`architecture.md` §12 — after product sliders became exceptions too. All three
now say sliders, and carry the frozen-`max` rule.

<!-- The pattern across §18 and §19 is the same one §16 named: the fix was
     correct and its surroundings were not revisited. Worth noting that the
     review agent found this by grepping for the rule it had just seen changed,
     which is the mechanical version of "grep for the decision's id". -->
