# MoneyBuddy Prototype

In-browser, mobile-shaped prototype of a personal-finance coaching app. This is a
**clickable prototype**, not production software — favor clarity and fast iteration
over abstraction, but keep the file structure clean (see Architecture).

## Repo structure — multiple versions behind a gate

The repo root is a **passcode + version-selector gate** (`index.html`, `gate/`),
not the app itself. Each major iteration is a fully self-contained, independently
runnable copy of the app under `versions/<name>/` (currently `versions/v1/`,
`versions/v2/`, `versions/v3/`, `versions/v3.1/`, and `versions/v4/`). **New
work happens in `versions/v4/`** unless told otherwise.

### v4 is the current version; v3 and v3.1 are an A/B PAIR behind it

**`versions/v4/` started as a byte-for-byte copy of `versions/v3.1/`** and is
where work now happens. It is **not** a third arm of the A/B test — that
comparison is between v3 and v3.1 only, and v4 sits outside it.

v3.1 in turn started as a byte-for-byte copy of v3, and the differences between
*those two* are the thing being tested, so **v3 is the control and does not get
feature work** — changing it changes what v3.1 is being compared against. The
gate labels them `v3 (A)` and `v3.1 (B)`, with v4 labelled `v4 (current)`.

**Every bug fix gets a question first, and it now has three possible answers.**
Feature work goes to v4. A *fix* is the ambiguous case: backporting keeps the
comparison honest on a shared defect, not backporting keeps the control frozen.
That is the owner's call, per defect, and it is not inferable from the code. So
before applying any fix, **ask with a multiple-choice question**:

> Does this fix apply to **v4 only**, to **v4 and v3.1**, or to **all three**?

Never assume one and mention it afterwards. A control that quietly drifted is
worse than no control, and a defect fixed on one side only can look like the
variation being tested.

**The tooling is version-aware, and its default is v4.** `sweep.sh`,
`wrap-data.sh`, `gen-audio.sh` and `build-cost-of-living.py` all read
`MB_VERSION` and default to `v4`; `check-syntax.sh` covers every live version
at once. Without this a hardcoded path reports 109 checks green having examined
the folder you did not edit.

    bash scripts/sweep.sh                     # v4, the default
    MB_VERSION=v3.1 bash scripts/sweep.sh     # the B side of the pair
    MB_VERSION=v3   bash scripts/sweep.sh     # the control

**Versions are test variants, not a migration path.** Each is a separate thing a
tester can pick at the gate; none supersedes another. `versions/v1/` and
`versions/v2/` are **frozen — don't edit them**, and `versions/v3/` is the A/B
control (see above). Nothing in v4 needs to stay backward-compatible with any of
them.

### ⚠ v3, v3.1 and v4 differ from v1/v2 in ways that matter

Everything in this section applies to **all three** — v3.1 is a copy of v3 and
v4 is a copy of v3.1, so their contracts, traps and decisions are identical
until you deliberately change one. Paths below say `versions/v3/`; read them as
"whichever of the three you are in".

**Read these three before touching code:**

| File | What it is |
|---|---|
| `plan.md` (repo root) | **Locked decisions L1–L22** in §0 — do not re-litigate them. Plus the rationale, spec contradictions, and review logs |
| `versions/<ver>/docs/architecture.md` | Cross-cutting contracts: data loading, the 12-category taxonomy, nav/back-stack, top bar, audio pipeline, standing rules |
| `versions/<ver>/PROGRESS.md` | The build checklist. Start at `Current state:`, work the first unchecked item |
| `versions/v4/docs/useberry.md` | Running a usability study against v4 — the two tracking flags, start URLs, task-completion setup |
| `versions/<ver>/CLAUDE.md` | Auto-loads in that folder. Carries the silent-failure trap list |

The v3 spec is at `v3 Files/spec/` (unpacked, read-only). Its
`docs/DECISIONS.md` beats every other spec doc; `plan.md` §0 beats *that* where
they conflict — several spec decisions are deliberately overridden.

**How v3 diverges from the descriptions further down this file:**

- **`data/*.json` + generated `data/*.js`** — v3 loads real seed data. v1/v2 have
  none (all data inline in `state.js`). The app runs on `file://`, so `fetch()`
  is blocked; JSON ships wrapped in a `<script>`-loadable assignment (L13).
- **Flat 12-category budget taxonomy** replaces v2's 5 nested buckets. It's the
  join key across four data files — see `architecture.md` §4.
- **Both v2 budget builders are gone** (2 Minute Budget iframe + Lifestyle
  Survey), replaced by one 6-question wizard. The `budget-baseline.js` seam
  survives as its only adapter (L6).
- **Goals V2 is not in v3** — rebuilt to a much simpler model (L3). The
  `js/goals/` module and `docs/goals-module-plan.md` describe **v2 only**.
- **Nav is 5 tabs + a shared top bar** with a contextual home/back slot and
  per-stack history (L5). v2's `activeTabFor` inverts.
- **`docs/goals-module-plan.md` and the "Goals V2 module" section below apply to
  `versions/v2/` only.**

- **`versions/v1/` is enforced-locked, not just documented.** Every file and
  directory under it is chmod'd read-only (`a-w`), and a local
  `.git/hooks/pre-commit` rejects any commit touching `versions/v1/` unless
  `ALLOW_V1_EDIT=1` is set. To make a deliberate, explicitly-requested change:
  `chmod -R u+w versions/v1/`, edit, then `chmod -R a-w versions/v1/` again
  before committing with `ALLOW_V1_EDIT=1 git commit ...`. The hook lives only
  in this local `.git/hooks/` (not tracked by git, doesn't travel with clones)
  — the chmod lock is the durable part.

- **The gate** (`index.html`, `gate/style.css`, `gate/gate.js`) is deliberately
  standalone and outside the app's module system — it never loads a version's
  `<script>` tags (see "Everything is global" below; two versions' scripts
  sharing one page would collide). Picking a version does a real page
  navigation to `versions/<name>/index.html`. Passcode is a hardcoded,
  intentionally-not-secure speed bump — don't add real auth here.
- **Adding a new major version:** copy the newest `versions/<name>/` folder to
  `versions/<next>/`, then add one entry to the `VERSIONS` array in
  `gate/gate.js`. Also update the folder-naming prose above and in "How to run /
  preview" below — it names specific folders and goes stale otherwise. (If the
  target folder already exists, use `cp -R versions/<name>/. versions/<next>/`
  — the trailing dot copies *contents*; without it you get a nested folder.)
  Four more things the copy does not do for you, all found doing v3.1 → v4:
  the **tooling defaults** (`MB_VERSION` in `sweep.sh`, `wrap-data.sh`,
  `gen-audio.sh`, `build-cost-of-living.py`) and the **find list** in
  `check-syntax.sh`; the new folder's own **`CLAUDE.md`, `PROGRESS.md` and
  `docs/architecture.md` headers**, which still name the folder they were
  written in; and any **admin-panel string that names a version** — those read
  `APP_VERSION` from `js/config.js`, so set it and they follow. Historical
  comments in the source keep naming the older version on purpose: that is
  where the design came from, and rewriting them destroys the record.
- Everything below this section (Architecture, hard conventions, Goals V2,
  Testing) describes the structure **inside a single version folder** — paths
  like `css/variables.css` or `js/state.js` are relative to whichever
  `versions/<name>/` you're working in.

## How to run / preview

- **No build step, no dependencies, no package.json.** Pure static files.
- Preview the gate: open the repo-root `index.html` (passcode `1337`), then pick
  a version.
- Preview a specific version directly (skip the gate): open
  `versions/v1/index.html`, `versions/v2/index.html`, `versions/v3/index.html`,
  `versions/v3.1/index.html`, or `versions/v4/index.html`. The app renders into
  a phone frame on the left and an **Admin Tools** panel on the right (manual
  controls + time travel + state inspector for the active screen).
- **The app is opened as a `file://` page — there is no dev server.** `fetch()`
  and `XMLHttpRequest` are blocked against local files. Any data a version needs
  at runtime must load via a `<script>` tag, not a network call.
- In a headless environment with no browser, you cannot visually QA. Instead:
  - Syntax-check any file you touch: `bash scripts/check-syntax.sh <path>`
    (no args = all live versions + gate JS). **Which JS engine exists depends on the
    machine** — the Mac has no `node` but ships JavaScriptCore (`jsc`), the
    Linux/WSL box has `node` (often only under `~/.nvm`, off PATH for
    non-interactive shells) and no `jsc`. The script detects whichever is
    present, so just run it; it was validated on both against a positive and a
    negative control. Don't hardcode either engine — that broke the gate once.
  - For logic, write a temporary DOM-stubbed Node smoke harness that loads the
    relevant files, exercises the functions, asserts, prints results — **then
    delete it** (don't commit harnesses). See "Testing" below.

## Architecture (read before editing)

- **Vanilla JS. No framework.** One global `state` object (`js/state.js`) is the
  single source of truth. The entire UI is re-rendered from `state` by calling
  `render()` (`js/render.js`) after any state change. There is no virtual DOM and
  no partial updates — every handler mutates `state` then calls `render()`.
- **Everything is global.** Files are plain `<script>` tags concatenated by the
  browser (no modules/imports). Function and `const` names share one global
  namespace, so keep names unique and prefixed by feature (e.g. `goals*`, `gc*`,
  `gt*`).
- **Load order matters** and is fixed in `index.html`. v1/v2: dev error-catcher →
  data (`state`, `utils`) → shared components → Goals V2 module → screen
  renderers → shared UI (`badge-ring`, `nav`) → core engine (`wizard-bridge`,
  `render`, `navigation`). v3 drops the Goals V2 and `wizard-bridge` blocks and
  adds a **seed-data block first** (`config.js` → `data/*.js`), since everything
  else reads from it. A file may only call things defined in earlier `<script>`
  tags at load time (calls inside functions are fine — they run after full load).

### File map
- `css/variables.css` — theme tokens with **light AND dark** scopes:
  `--card --text --line --accent --accent-soft --soft --muted --danger`. Always
  style with these vars so both modes work; never hardcode hex.
- `css/layout.css` — page/phone/admin frame. `css/components.css` — shared UI
  classes (buttons, cards, inputs, `.item-card`, etc.).
- `js/state.js` — the `state` object, `resetUserData()`, and the admin
  `destinations[]` jump list. `js/utils.js` — helpers incl. `activeTabFor`,
  `h()` (HTML-escape — **always escape interpolated user/data strings**),
  `budgetFmt`.
- `js/render.js` — `render()`, `renderScreen()`, `renderAdmin()`,
  `adminSubtitle()`, and the admin jump list. `js/navigation.js` — `go(screen)`,
  history.
- `js/budget-baseline.js` — **the budget-builder seam**: a builder converts its
  flow into one normalized baseline and saves through `submitBudgetBaseline()` —
  latest save wins, updates gated by the shared old→new confirm screen. Builders
  never write `state.budget` directly; each has its own adapter. Keep new
  builders behind this seam.
  *(v2 has two builders — 2 Minute Budget via `js/wizard-bridge.js` and Lifestyle
  Survey via `js/lifestyle-survey-bridge.js`. v3 has one: the 6-question
  lifestyle wizard. The seam is identical in both.)*
- `components/` — reusable visualizations (`thermometer`, `badge-ring`,
  `sprint-timeline`, `streak-counter`, `nav`). Reuse these; don't re-implement
  charts inline.
- `screens/` — one file per screen, each exporting a `render<Screen>()` and an
  optional `render<Screen>Admin()`.
- `js/goals/` — the **Goals V2** module (see below), **v2 only**.
  `docs/goals-module-plan.md` is its authoritative spec. v3 has no such folder.
- **v3 only:** `data/` (spec JSON + generated `.js` wrappers), `js/config.js`
  (`SKIP_ONBOARDING`), `docs/` (architecture + spec-coverage), `PROGRESS.md`.

### Adding a new screen (wiring checklist)
1. `screens/<name>.js` with `render<Name>()`.
2. Add a `<script>` tag in `index.html` in the screens block.
3. `js/render.js`: add to `renderScreen()` switch, `adminSubtitle()`,
   `renderAdmin()`, and the jump list.
4. `js/utils.js`: map the screen → its tab in `activeTabFor`.
5. `js/state.js`: add to `destinations[]` if it should appear in the admin jump.

## Hard conventions / gotchas (these have bitten us)

- **Surgical edits only.** When fixing one thing, change only that thing. Do not
  rewrite working code to fix broken code. Never collapse multiple files into one
  — modular structure is a hard requirement, not a preference.
- **`.item-card` is a `display:block`, not flex** (`css/components.css`). Any
  trailing child (chevron, checkbox) drops to its own line. Fix per-instance with
  **scoped inline flex** on that element; never change the global `.item-card`
  rule (it would shift every screen).
- **Inputs use `onchange`, not `oninput`.** `oninput` + full re-render destroys
  the focused element mid-keystroke and loses focus/cursor. Commit on blur with
  `onchange`. (**Sliders** are the deliberate exception, paired with
  `debouncedRender()` — product sliders as much as admin ones. A `type="range"`
  on `oninput` + `render()` destroys the element being dragged, so the thumb
  stops tracking the pointer. Also freeze the slider's `max`: deriving it from
  the value it controls makes the thumb recoil on release.)
- **Always `h()`-escape** any string interpolated into an HTML template literal.

## Goals V2 module — **`versions/v2/` only**

`js/goals/` + `screens/goal-*.js`. A gamified goal-setting system. Spec:
`docs/goals-module-plan.md` (authoritative for v2). **Not present in v3** — see
`plan.md` L3 for the simpler v3 goals model that replaces it. Core model:

- A goal = a **frozen `baseline`** + an **append-only `events[]`** array. Sprints,
  pace, cohort standings, achievements are all **derived by pure functions at
  render time**, never stored. (One deliberate stored exception: the debt-paydown
  `payoffCurve`.)
- **Simulated clock:** inside `js/goals/` and the goal screens, use
  `goalsTodayISO()` / `goalsNow()` (real now + `state.goalsV2.clockOffsetDays`).
  **Never call `todayISO()` there** — the admin panel time-travels via the offset,
  and `todayISO()` would ignore it. (Treat this as a grep gate.)
- **Deterministic cohort:** peer "bots" are pure functions of
  `(cohortSeed, dayIndex)` via FNV-1a hash + mulberry32 PRNG. Guardrails clamp
  only the *user's* rank, never bot scores. The board is explicitly labeled
  SIMULATED.
- **Thin documented seams:** all reads of host app state go through
  `goals-bridge.js`; all mocked automation (credit, rates, tax) goes through
  `goals-autofill.js`. Keep new host-state access behind the bridge.
- **`GOALS_TUNING`** (`goals-tuning.js`) is the single source of behavioral knobs,
  hot-editable from the admin tuning panel. Add new balance values there, not as
  inline literals.

## Testing (headless)

No browser/test runner is wired up. Use whichever JS engine the machine has —
`node` on Linux/WSL, macOS's built-in `jsc` otherwise; `scripts/check-syntax.sh`
detects both and is the model for finding them. To verify logic, build a one-off
harness that stubs `document`/`window`, concatenates the needed files into a
**single** script, exercises the functions, and asserts, then run it (`node
harness.js` or `jsc harness.js`). Concatenating matters: separately-evaluated
scripts do not share top-level `const` bindings, but a browser's `<script>` tags
do. Under node, run the concatenated source through `vm.runInContext` with a
stub context — top-level `const` does not attach to a vm context's globals, so
append an explicit `this.__api = { ... }` to get at what you want to assert on.
Delete the harness before committing.

## Working with the repo owner

PM/product background, not a career engineer — explain with product/systems
analogies when teaching, but default to task-first execution. Direct feedback, no
filler. **Commit and push are one action** (always `git push` right after a
commit). Flag L/XL-scope changes before starting and include one suggested scope
reduction. Linux/WSL only — never touch `/mnt/c/Windows` or Program Files paths.

When a decision changes, update **both** the decision record and the prose that
references it. Two review passes on the v3 planning docs found that every stale
statement was a paragraph that had been correct when written and was never
revisited after a later decision landed. Grep for the decision's id.
