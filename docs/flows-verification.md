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

Use the root selector, passcode 1337, then Full app or a named Flow. Direct Flow
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
- Local selector: passcode, Full app, Flows and existing alternatives; side-by-side
  comparisons retain their previous behavior.

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
