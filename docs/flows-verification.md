# Flow verification record

Implementation and PM review are separate gates. This record names checks to run;
an unchecked item is not evidence of success. Source baseline:
`8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`.

## Automated implementation checks

Baseline full app: syntax (123 files), path checks, release-runtime, local-variants
and sweep passed before implementation. Sweep: 253 checks, zero failures.

Combined checks on 2026-10-12: full-app syntax 124 files; sweep 254 checks, zero
failures; path checks; release-runtime; local-variants; Flow selector; and catalog
policy/historical digest checks passed. Python discovery passed all 63 tests,
including 27 legacy/Flow publication cases and nine Flow foundation cases. The
two existing sweep warnings concern unreferenced-function inventory and five dark
onboarding films using the established fallback; browser/PM checks are a separate
unautomated section. Review caught a staged-index scope-check bypass and added its
passing regression in `663a908`.

App baseline review: only config, onboarding, topbar and ESF first-step Back differ;
changes remove dormant BP_ENTRY/ESF_ONLY branches. No new app files or Flow changes
were adopted into the app. Combined scope is explicitly `app-integration` for this
approved cleanup; subsequent ordinary Flow tasks must use `flow` scope.

Both Flow actual-script runtime suites pass on package checkpoint
`17bc494e8b76853e05418b16d0338efbabd8b7de`: setup/Skip/Back, feature prerequisites,
help/Buddy, repeated saves and distinct budget effects, both purchase/fund callers,
no-goal purchase branch, quiz/comparison/finance/lease, reminder intent, excluded
navigation/admin/history/render/deep links, profiles/participant parameters and
fresh refresh/Restart. Flow syntax passed 247 files; metadata/catalog and package
boundary checks passed. Explicit app-integration scope passed against full base
`8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`.

Two offline publication builds passed from a disposable clone of `17bc494`, with
the second supplied the first publication manifest. The clone alone received a
committed fixture adding Emergency Fund (tracking on) and Big Purchase (tracking
off) to the unchanged legacy catalog; its origin remote was removed. Preparation
used `prepare --flow ID` against the cloned local main. Fixture commit:
`2229c2c0c9bec9dcd50271fda9b52eb6803a6c53`. All 960 output files were byte-identical
between builds. The real checkout's publication catalog and tags were untouched.

| Export | Bytes |
|---|---:|
| Emergency Fund snapshot | 21,119,575 |
| Big Purchase snapshot | 21,121,395 |
| Complete artifact, including retained legacy snapshots and manifest | 77,351,508 |
| Existing artifact ceiling | 800,000,000 |

Exports contain their own runtime policy and frozen release settings, exclude
authoring metadata/docs, local discovery/comparison files and worktrees, and do not
contain another package. Existing historical digest and previous-manifest checks
passed. Temporary review output is `/tmp/moneybuddy-flow-rehearsal-b14tzmyx/site-2`;
it is local rehearsal evidence, not a publication. PM acceptance remains separate.

## PM review checklist

Use the root selector, passcode 1337, then Local Prototype (Prototype tab) or a named
Flow (Flows tab). Direct Flow
links intentionally bypass the passcode. Both Flows restart themselves on refresh;
Full app refresh returns to the selector. Restart starts a fresh session; Exit
returns to the selector.

- Emergency fund: answer ZIP, income, household, home type, coverage and driving;
  check expense help/Buddy, buffer, coverage, balance and date; save, reopen and
  save again. Exactly one emergency goal should remain, with the edited figures.
  From the first expense step, Back returns to setup; test answers and Skip too.
- Big Purchase: answer ZIP, income and driving, including docked controls; Back
  from the landing returns to the previous setup question with answers intact.
  Try finder, known-model/new/used selection, quiz/help, cost comparison, finance,
  lease and plan save. Save twice and check there is at most one purchase goal.
- Big Purchase fund branches: Start One Now before the purchase, save the fund,
  use Back to your car and confirm the purchase inputs survive. Separately use
  Ask me later, complete/save the purchase and start the fund afterward; test
  Back at the first expense step and after saving. No extra setup questions.
- On both Flows, check constrained Goals and absence of general product tabs,
  settings, arbitrary jumps and unrelated goals. Unsupported purchase categories
  stay disabled. Test Back at the beginning, refresh, Restart and Exit.
- Check narrow layout, all four themes, keyboard focus, typed inputs, sliders,
  selected help/media and participant study parameters on HTTP links. Local
  tracking stays off regardless of URL parameters.
- Full app regression: full setup and Buddy creation end at Home; all five tabs
  remain; Goals still opens both tools; purchase save does not change budget,
  ESF save immediately replaces it, including repeat saves.
- Local selector: passcode, Prototype/Flows toggle (mouse and arrow keys), Local
  Prototype, Historical versions (new tab), Flow list, and existing alternatives under
  the Prototype tab; Exit Flow returns to the Flows tab; side-by-side comparisons
  retain their previous behavior. Check light and dark system themes at phone width.

## Platform status

Windows/WSL file URLs with spaces: not yet verified.
macOS file URLs with spaces: not yet verified.
PM visual/product acceptance: not yet verified.

Immutable rehearsal artifact HTTP smoke passed for both snapshots in Linux
Chromium through `localhost:8766`: cold forbidden links start canonical setup,
Skip reaches the right Flow, selected entry images load, participant parameters
survive refresh/Restart, and frozen Exit reaches the artifact selector. Release
tracking stayed on for the fund and off for purchase despite opposing query
parameters. The browser intercepted and aborted every external request: the
tracked snapshot attempted its expected Useberry loader; the untracked snapshot
did not. No telemetry was sent and no live Useberry service behavior is claimed.
Neither snapshot produced page errors.

Linux Chromium 153 passed both packages through actual clicks and typed inputs on
file URLs in a real copied path with spaces and local HTTP. Coverage includes full
setup, Back/Skip with answers, narrow layout/four themes, keyboard focus/Tab,
selected fund media, save/reopen/repeat save, both BP fund detours with their
distinct first-step Back callers, preserved car/amount after return, loan/cash/lease,
purchase saves without budget writes, refresh/Restart/Exit, participant parameters,
tracking off and no page errors. This does not verify Windows/WSL or macOS.
The optional reproducible harness is `tests/flows-browser.cjs`; see its header for
Playwright and HTTP settings. It requires an existing browser installation.

Source audit limitation: the approved plan mentioned an owned-car path, but source
`8f7b142` has no distinct already-owned-car journey. Its implemented known-model
and new/used selection paths are retained and checked. No new product journey was
invented. PM should review those actual paths; adding an owned-car journey is
separate product scope.


## Outside-phone reviewer correction — 2026-10-12

Correction implementation checkpoint: `b7663e829a94017024c4f08f3026d62addd2c567`.
Correction base: `d9faeb30a04f5e9ce81e3c1ca240a2a822437eba` on the existing
`work/flows-20261011` branch. Source presentation reference remains `8f7b142`.
No subagents were used for this correction. Previous browser evidence describing
the in-phone toolbar is superseded by the checks below.

Both packages restore source headers, footers and contextual Back while suppressing
Home/menu escapes. Tools lives outside `.phone`, starts collapsed, and dispatches
only the current allowed screen with existing prerequisites. Restart clears the
whole Flow. Setup steps, profiles, purchase fixtures, comparison variants and
reminder simulations are scoped. Goals and Copy State omit unrelated seeded
product activity. ESF help no longer reads/initializes the excluded budget queue;
admin cost/options/commit readers no longer synthesize fixture answers.

All required repository checks pass at the correction checkpoint: app syntax 124,
Flow syntax 249, sweep 254/zero failures/two existing warnings, paths, release
runtime, local alternatives, selector, actual-script Flow runtime, all 63 Python
tests, package checks and publication catalog/historical digest checks. Flow scope
passes against the correction base. `/app` and `publication/` have zero diff from
that base; historical snapshots and publication tags were not changed.

Linux Chromium passes `tests/flows-browser.cjs` on real copied file URLs containing
spaces and HTTP for both packages. Checks include Tools collapsed defaults,
Enter/Space-compatible toggle semantics, focus retained across setup selection and
returned on close, all four themes, desktop/below-phone placement at 1440, 900, 390
and 320px, identical phone dimensions when toggling, no overlap/horizontal overflow,
and no toolbar or reserved topbar space on setup. Actual participant Back/Skip,
inputs, refresh/Restart/Exit and participant parameters pass. Repeated fund saves,
reopening, both BP fund branches, retained purchase inputs, one goal per type and
distinct budget effects pass. Every restored interactive reviewer control is
exercised: setup step/profile, Copy State, themes, purchase fixture/car selection,
comparison A/B and both goal/reminder simulations. Retained screen diagnostics are
read under normal feature initialization. Runtime checks audit every tools reader
for state/history mutation and reject malformed control values, excluded screens,
wrong-screen actions and missing feature prerequisites. The actual creation adapter
also passes a browser smoke with safe profile-only starter controls and blocked
excluded routes.

Two local in-memory catalog builds of the committed correction were identical,
including a second build validated against the first manifest. Their synthetic
snapshot IDs are `rehearsal-emergency-fund` (tracking on) and
`rehearsal-big-purchase` (tracking off); no real catalog or tags were written.
Output: `/tmp/moneybuddy-tools-snapshot-_n7zz7hn`, 964 files, 77,368,245 bytes.
Fund package: 21,127,560 bytes; purchase package: 21,129,473 bytes. Output remains
below the 800 MB ceiling, retains historical bytes, and excludes authoring docs,
metadata and worktrees. `tests/flows-snapshot-browser.cjs` verifies both exported
packages on HTTP: collapsed tools on cold boot/refresh/Restart, outside-phone
placement, keyboard/focus, narrow overflow, participant parameters, frozen tracking
and selector Exit. Every external request is aborted; no telemetry is sent.

Reproduction uses the existing optional Playwright environment described in the
browser harness header. Serve the checkout for `MB_FLOW_BASE_URL` and the local
artifact for `MB_FLOW_SNAPSHOT_BASE_URL`; neither command publishes anything.

PM must repeat the affected visual/product checks on the correction before the
implementation PR opens: source contextual Back/Skip, Tools placement/collapse,
keyboard/focus, four themes/narrow screens, setup/profile/fixtures/comparisons,
goal/reminder simulations, repeated saves and both BP fund return paths. PM
acceptance, Windows/WSL and macOS file-with-spaces checks remain unverified. Linux
automation does not substitute for those checks. Merge and publication remain
separately authorized.


## Full-app expand-button match — 2026-10-13

Implementation checkpoint: `1cca55cfdd25484225881dce3b3264008ffd3cf5` on
`work/flows-20261011`. Change base: `021d4061c01b0a935c05ea2772e69d045ebff72d`.
No subagents. Both Flows and the creation adapter now use the full app’s 28×48px
**›** button, with accessible name **Tools**, the existing panel relationship and
accurate expanded state. The button opens only, hides while open at every width,
and returns with focus on Close. Flow position, collapsed defaults, outside-phone
panel placement and reviewer/participant behavior remain intact. No metadata or
public API changed.

All required repository checks pass: app syntax 124, Flow syntax 249, sweep 254
with zero failures and two existing warnings, paths, release runtime, local
alternatives, selector, Flow runtime, all 63 Python tests, Flow package checks,
publication catalog/historical digests and Flow scope against the change base.
`app/` and `publication/` have zero diff from that base.

Linux Chromium passes `tests/flows-browser.cjs` for both packages on copied file
URLs with spaces and HTTP, plus the actual creation adapter on both protocols.
The shared browser helper compares normal and hover computed styles with the
full-app button in Light, Dark, Natural Light and Natural Dark, at widths 1440,
900, 390 and 320px. It checks exact size/position, accessible naming, Enter and
Space activation, hidden state and absence from the accessibility tree while
open, Close focus restoration, unchanged phone dimensions, desktop/below-phone
panel placement, no horizontal overflow and unchanged participant state.
Existing journey checks still pass: setup/Back/Skip, reviewer controls, themes,
media, repeat saves, both purchase fund detours, preserved inputs, distinct budget
effects, refresh/Restart/Exit and participant parameters.

Two local in-memory catalog builds exported committed checkpoint `1cca55c` and
were byte-identical, including validation against the first manifest. No real
catalog or tags were written. Artifact: `/tmp/MoneyBuddy chevron snapshot kc8e62t8`,
964 files, 77,368,263 bytes; fund package 21,127,569 bytes; purchase package
21,129,482 bytes. Historical exports retain their digests and output stays below
the publication size ceiling. `tests/flows-snapshot-browser.cjs` passes both
exported snapshots on file URLs with spaces and HTTP, including the same four-theme
button comparisons, keyboard/focus, placement/overflow, refresh/Restart/Exit,
participant parameters and frozen tracking. All external requests were aborted;
file URLs never inject telemetry.

Reproduction uses the browser harness environment in `docs/testing.md`. Serve the
checkout for `MB_FLOW_BASE_URL`. Serve the artifact for
`MB_FLOW_SNAPSHOT_BASE_URL` and set `MB_FLOW_SNAPSHOT_FILE_ROOT` to its directory
with spaces. Local builds and servers do not publish.

PM must repeat affected visual acceptance on `1cca55c` before opening the
implementation PR: compare the chevron with the full app in all four themes;
check desktop/narrow position, expand-only disappearance, Enter/Space and Close
focus, plus the existing outside-phone reviewer and participant checks above.
PM acceptance and Windows/WSL/macOS file-with-spaces acceptance remain pending.
Linux automation does not establish those results. Merge and publication remain
separately authorized.


## Collapse-button visual parity — 2026-10-13

Follow-up to `a0ff5a6`: both Flows and the creation adapter replace visible Close
with the full app’s **‹**, retaining the accessible name **Close Tools** and
focus restoration. Removing the Flow-specific collapse-button CSS restores the
full app’s typography, padding, size, colors and hover styling.

Linux Chromium passes `tests/flows-browser.cjs` for both packages and generated
starters on file URLs with spaces and HTTP. The shared helper now compares the
collapse control’s normal and hover styles against the full app across all four
themes and widths 1440, 900, 390 and 320px, and retains focus/placement/overflow
checks. Flow syntax (249), runtime, all nine Flow Python tests, package and scope
checks pass. App and publication records remain unchanged from `021d406`.
These targeted follow-up checks do not update earlier snapshot/platform or PM
acceptance evidence. The PR remains unopened pending affected PM review.


## Page-shell parity with the full app — 2026-10-13

Change base `a7f408729013da0b2edc9083704e5ee420330c58`. Both Flows and the creation
adapter now use the full app’s page layout unchanged. Removing the Flow-only overrides
moves the phone 52px up to the app’s 24px top and back onto the app’s grid column. The
**›** returns to the app’s fixed position at the phone’s top edge. The open panel uses
the app’s spacing and fixed height, and phone widths (768px and below) offer no Tools,
as in the full app. Three small styling fixes accompany it:
- Exit Flow matches its neighboring header buttons.
- The **›** regains the app’s hover tooltip.
- The footer formats the trail line as the app does.

Phone contents and Flow-specific Tools content are unchanged.

Linux headless Chrome compared app, both Flows and an adapter-generated starter.
Phone, **›** and panel boxes, display and position were identical at 1440, 1000, 900,
820, 769, 768, 400, 390 and 320px. Heights 900 and 760 were checked, with Tools both
collapsed and open, and screenshots matched in all four themes. Flow check, Flow
scope, path checks, publication check and Python discovery passed (63 tests, one
skipped: Node unavailable).

Not run on this machine, by agreement, with no tools installed:
- `check-syntax.sh` and the Node test suite (CI runs these).
- The Playwright browser tests, which now compare geometry with the full app.

Edited JS parsed cleanly in Chromium. That parse is not a substitute for the Node
checks.

PM visual re-acceptance: switch between Local Prototype and each Flow at desktop width
and confirm nothing outside the phone moves, then open Tools and narrow the window
below 769px. Windows/WSL and macOS acceptance remain pending.

## Local variants for Flows — 2026-10-13

Change base `a833438dd1d5fcc1d8cdb32ebce7f6fb46ecd2d6`. A local comparison can now
target one Flow (`local-variants.py create --flow <id>`) as well as the full app,
with one comparison at a time. Agreed with the PM owner:
- Variants appear on the tab of what they change, under **Prototype variants** or
  **<Flow> variants**, as compact rows that open in the same tab.
- The selector's separate new-tab links are gone, but each comparison pane keeps its
  Open in new tab link as the embedding fallback.
- The tab shows a count, such as **Flows (2)**, and opens first until the PM picks
  a tab.
- Side by side offers **Local <Flow>** as the baseline.
- Keeping a Flow variant is refused if it changed files outside its Flow, apart from
  the generated catalog.

No app or Flow runtime files changed. Variant Flows already exit and refresh through
their worktree root to the primary selector.

Python discovery passed: 73 tests, one skipped because Node is unavailable. The new
cases cover Flow targets, refusals before any commit, older sessions, the keep guard
with renames, and missing entries. Flow check, path checks and publication check
also passed.

In headless Chrome:
- The edited selector, tab and Flow-selector Node tests passed under a scratch
  `require`/`vm` shim.
- The same tests fail against the previous selector code, so the shim does detect
  regressions.
- Screenshots matched the agreed layout in light and dark mode, at 460 and 340px,
  with a remembered Prototype tab, and for the side-by-side heading.

Not run on this machine, by agreement: the real Node suite and `check-syntax.sh`
(CI runs these). Windows/WSL and macOS acceptance remain pending.

PM acceptance uses a throwaway Emergency fund comparison:
- The Flows tab opens first, showing **Flows (2)**.
- Rows open in place, and Exit Flow and an unpinned refresh return to the Flows tab.
- Side by side shows A, B and **Local Emergency fund**, with a pinned layout restore.
- **Back to versions** returns to the Flows tab.

## create-flow skill and the one-product rule — 2026-10-13

Change base `e58daaf3e7cb908bf777e3896cb3130c9f125ddf`. Docs and skills only; `app/`
and `flows/` bytes are unchanged.

- **The create-flow skill** sends requests such as "only show the emergency fund",
  "skip onboarding" or "start at the calculator" to a contained Flow.
- **`docs/flows.md` "Configure the journey"** turns the two shipped Flows into a
  step-by-step recipe:
  1. policy (`flow.json`);
  2. containment (`js/flow.js`);
  3. setup hand-off;
  4. unreachable surfaces;
  5. Tools;
  6. notes and tests.
- **`docs/app-contracts.md` "One product: no journey switches"** defines a banned
  switch by structure, not name, and lists what is allowed.
  - `SKIP_ONBOARDING` is marked deprecated. It is a build-time entry switch from spec
    D07, not the Skip button.
  - CLAUDE.md, start-work, README and AGENTS.md route narrowing requests to the skill.

Python discovery passed (73 tests, one skipped because Node is unavailable), along
with the Flow check, path checks, publication check and a relative-link check.
Whether the skill triggers is checked in a fresh Claude Code session.

Deferred until this PR merges, as a separate task from the updated main:
- remove the inert docked-onboarding and onboarding-return branches from `app/`;
- replace the "do not delete unused code" rule;
- add the PR review gate;
- remove the remaining flag names from docs.
