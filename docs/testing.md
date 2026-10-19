# Verification

Run every automated check from the repository root with one command:

```sh
bash scripts/checks.sh all
```

On native Windows use `scripts/checks.ps1 all`. The
[container guide](container-checks.md) owns setup, mounts and targeted commands.
The commands below identify checks inside the image.

Each check prints PASS, FAIL or BLOCKED. A check that passed with warnings says
how many and lists them under its PASS line; they do not fail the run, so read
them. The image supplies pinned Node, Python, Playwright and Chromium.
BLOCKED means this machine lacks a usable prerequisite (including a missing, old
or broken `python3`, or Playwright and Chromium for browser checks) and says how to fix it; it is never a pass.
The script exits 0 only when every check ran and passed. The Flow snapshot
rehearsal works on a clone, so it checks the last commit, not uncommitted edits.
It runs, in CI order:

```sh
bash scripts/check-syntax.sh
bash scripts/sweep.sh
python3 scripts/check-paths.py
python3 scripts/check-markdown-links.py
node tests/release-runtime.cjs
node tests/local-variants.cjs
node tests/flows-selector.cjs
node tests/gate-tabs.cjs
node tests/flows-runtime.cjs
python3 scripts/flows.py check
bash scripts/check-syntax.sh flows
node tests/app-journeys.cjs --selftest
node tests/app-journeys.cjs
python3 -m unittest discover -s tests -v
python3 scripts/publish.py check --base <merge base of HEAD with origin/main, or main>
python3 scripts/publish.py build --offline --output <temporary folder>
node tests/browser/app-journeys-browser.cjs
MB_FLOW_BASE_URL=http://127.0.0.1:<port>/ node tests/flows-browser.cjs   # with python3 -m http.server <port> on the repository root
bash tests/browser/snapshot-smoke.sh <temporary folder>
```

## Changing verification

Read this section when changing checks, fixtures, journeys or comparison rules;
use the package-specific sections below for ordinary verification. See
[code health](code-health.md) for intake and handoff review.

Exercise the real entrypoint and dependency, not a substitute that bypasses the
behavior under test. Establish a passing baseline before demonstrating detection
of a deliberate regression. A negative test must fail for the intended reason;
assert evidence that distinguishes that failure from a broken setup.

Preserve coverage when renaming or removing code. Explain changes to journeys,
normalization, state aliases and comparison thresholds in the PR, including why
they preserve the evidence rather than hide a difference. Review the actual
comparison output and retain failures, incomplete evidence and blocked checks.
Declaring an expected visual change never excuses a broken journey or missing
retry evidence; see the [browser evidence rules](#browser-check-does-the-phone-look-the-same).

Manually verify media, motion and platform behavior outside automated coverage.
Investigate new warnings and explain unresolved ones in the handoff.

## Pre-PR review lifecycle acceptance

For lifecycle changes, keep deterministic real-Git tests, actual-app browser and
harness controls, fresh-agent skill exercises and host/browser evidence separate.
The [platform acceptance packet](pre-pr-review-platform-acceptance.md) owns
commands, reusable fixture/generator entrypoints, agent prompts and applicable
evidence. Run in the operator's chosen environment; native Windows and WSL/POSIX
are alternatives. Missing tools in an unused second environment do not block
acceptance. Actual failed or blocked checks in the chosen environment remain
visible. Use the [container entrypoints](container-checks.md) for test prerequisites.

## Documentation links

`python3 scripts/check-markdown-links.py` checks local file links and Markdown
heading fragments in maintained root guidance, `docs/`, `app/docs/`, Flow docs,
project skills and the PR template. It runs in check-all and CI without network
access or extra dependencies. Inline and reference links and GitHub-style heading
anchors (including duplicates) are supported; fenced examples and external URLs
are ignored. It excludes `.worktrees/` and never reads protected datasets.
Temporary-fixture tests in `tests/test_check_markdown_links.py` exercise its real
command as well as link and anchor behavior. It does not enforce prose style or
length.

## Journey checks: is the app's flow unchanged?

A robot taps through the app the way a tester would: onboarding (in full and
skipped into each of the nine profiles), the emergency fund, the big purchase,
the budget builder, lessons, the journal, the daily update, chat, goals, every
tab, every Tools screen, start links and refresh, and a touch phone (no simulated
keyboard) and reduced motion. After every tap it records exactly what the phone
shows. Every pull request replays those journeys on its
base branch and on the PR, and compares them step by step:

- **Phone** (what a tester sees and does) must be identical, unless the PR says
  what changed and why under "Phone and Tools changes".
- **Tools** (the panel beside the phone) and **wiring** (the code behind each
  control, so a renamed function) are reported separately and must also be
  declared when they change.

```sh
node tests/app-journeys.cjs                  # every journey, twice; every screen reached without the Tools tour
node tests/app-journeys.cjs --against main   # compare this checkout with main
node tests/app-journeys.cjs --series main..HEAD   # the same, commit by commit
node tests/app-journeys.cjs --trace esf-full@at_at   # watch one journey step by step
node tests/app-journeys.cjs --mutations      # prove it catches breakage (run after harness changes)
```

`--series` compares each commit's phone with the newest main commit it contains
(its merge base), so a later sync with main is not blamed on the commits made
before it; Tools and wiring are compared with the commit before it on the branch.

Both sides of a comparison run the PR's own journeys and normalization, so the
PR check lists any harness files the PR changed under "Harness changed". A PR
that edits journeys, state aliases or normalization says why in its text, and
reviewers check that no step that showed a change was dropped. A commit that
deletes a state field the app never reads lists its path, with a reason, in
`tests/app-journeys/state-aliases.cjs`, so the deletion does not read as a phone
change; what the phone shows is still compared in full.

Journeys live in `tests/app-journeys/journeys/`, written as taps on visible
labels. A journey that can no longer find a label fails loudly with the controls
it can see. They open the app at a hosted (https) address, as participants do, so
they also record each screen's address and the value trail Useberry reads; a word
the robot typed (a name, a note) showing up in the address or the page title fails
the check. This robot does not judge layout or colour; the browser check below
does.

The clock is fixed at Wednesday 15 April 2026, 15:00 UTC (one journey visits at
22:00). The journeys whose screens depend on the date (the emergency fund's
target date, Big purchase's "Save it by" month, the month-to-date spend estimate)
also run on 31 May 2026, 15 February 2026 and 29 February 2028, at the same time
of day, to catch month-end and leap-day dates; those runs are named like
`bp-car@may31` and are part of this check only, not the browser check.

Node 22 is required for JavaScript checks; Python 3.11+ for Python checks;
Playwright with Chromium for browser checks. The shared image supplies these prerequisites.
A missing prerequisite is a blocked check, never a pass.

## Browser check: does the phone look the same?

A second robot taps through the main journeys in a real browser (Chromium): in
all four themes at phone width, with Tools open at desktop width, and through the
passcode, selector and Pin on refresh. It takes a picture at the start and after
every tap or other step, so it also sees changes within one view: a picked
option, the open keyboard, a sheet. On every pull request it does this on main
and on the PR and compares each step's pictures, matched by step number. Phone
pictures must match main exactly, apart from a tiny allowance
for the rendering noise measured between two identical copies (the exact rule is
in `tests/browser/pixels.cjs` and `tests/browser/app-journeys-browser.cjs`, and
may still change). A changed phone or Tools picture fails the check unless the PR
declares it under "Phone and Tools changes", as for the journey checks. A change
only the pictures show (a colour, a one-pixel shift) is declared the same way; the
journey checks then print a note instead of failing. At desktop width the phone
and the Tools panel beside it are pictured apart: a changed phone there is a
phone change, declared under Phone. With Tools closed the whole desktop page is
pictured too, so a phone that moves on the page is a phone change. The passcode
and selector pages have their own count and are declared under Tools. Screens
only Tools can reach (L14) are pictured once, in Natural Light at desktop width,
during the Tools tour. After a merge, main is compared with the previous main in
report mode (`--report`): changed pictures, which the PR declared, are reported
but do not fail; a journey that breaks or a new page error still fails.

Phone pictures grow to show all scrolling content. Before growing the phone,
the check also records its normal rectangle, the screen's viewport and content
sizes, and its scrolling position. A repeated change to any of those counts as
a phone change, even with identical tall pictures or declared Tools changes.
The report shows those measurements beside the pictures. Measurements retain
Chromium's 1/64 CSS-pixel layout precision; they do not hide a one-pixel move.
This geometry check does not replace reviewing normal viewport appearance.

To see the pictures for a PR, open its **Checks** tab, choose the **Browser
journeys** job, open the run's summary and download the
`browser-journey-pictures` artifact. Unzip it and open `index.html`: each step
shows Before, After and the Difference, with a tab per theme and one for desktop
with Tools.

- **Changed**: the picture or normal phone geometry differs from main, and
  differed again when the robot repeated the journey. **Only before** or **Only
  after** means only one version has that picture (the journey stopped early, or Tools was closed, on the
  other); it counts as a change.
- **Flaky**: it differed once but matched on a healthy repeat, so it is not
  counted. Both journeys must finish with their entire first-run picture
  inventory and valid phone geometry, including checkpoints that initially
  matched, and
  without page errors, before a repeat can establish this.
- **Broke**: the journey stopped before its last step (a button it needed was
  missing, disabled or covered), or the page raised an error. The report keeps
  failures and errors from both the first run and the repeat. An after-version
  retry failure, new page error or missing retry evidence fails even in
  `--report` mode or when the PR declares picture changes. Before-only failures
  stay separate and count as a phone change.

The same job also runs both Flows in Chromium from file:// (a folder with spaces)
and over HTTP, and rehearses exporting Flow snapshots in a throwaway copy of the
repository.

Run Chromium checks through the shared image:

```sh
bash scripts/checks.sh compare --base main
bash scripts/checks.sh exec node tests/browser/app-journeys-browser.cjs
```

The comparison takes a few minutes and retains its report on the host. No host
browser installation is required. Still manual: audio and video playback, real
phones, and native file:// browser behavior on Windows and macOS.

The pictures leave some looks out on purpose, so that two runs of the same
version give the same pictures:

- hover looks: before each picture the pointer is moved to the window's top-left
  corner, where every page is empty;
- pressed looks: each picture waits until a tap is let go;
- the tap highlight, which is turned off, and the text cursor;
- video frames: each video is hidden under a plain mask;
- animations and transitions, shown only where they end: the browser asks for
  reduced motion, which the app's CSS answers by cutting their durations to
  almost nothing, and each picture finishes any still running;
- scrollbars: headless Chromium hides them, so `::-webkit-scrollbar` rules never
  show.

The desktop › tab that opens Tools is visible to participants. In the
whole-page picture it is masked, so a change to how it looks counts as Tools
(the tab has its own picture), while a moved or resized tab moves the mask and
counts as Phone. "0 pictures changed" therefore proves nothing about a change to
`:hover`, `:active`, `-webkit-tap-highlight-color` or `::-webkit-scrollbar`
rules, to animations and transitions, to the caret, or to how a video looks;
check those by hand and say so in the PR.

The local Catalog policy check uses the merge base of HEAD with `origin/main`,
falling back to `main`. Without a merge base it is BLOCKED. It verifies retained
rows, immutable identities, study resolution before demotion or retirement, and
committed snapshot digests.

Publication tests use disposable Git repositories and do not push. Historical exports
are compared byte-for-byte against their immutable identities.

The app sweep covers onboarding, ESF/Buddy behavior, the paywall, lessons,
narration recovery and film replay; app-structure checks cover wrappers and load order.

## Flow verification

Run the commands above for the complete integrated change; for ordinary Flow edits
also run `python3 scripts/flows.py check --id ID` and
`python3 scripts/flows.py scope --scope flow`. Explicit
product integration uses `--scope app-integration` and needs full-app PM verification
before opening its PR. See [the operating guide](flows.md).

Python negative tests cover unsafe IDs, collisions, links, traversal/cross-package
paths, malformed staged entries, rollback, stale wrappers and app scope. Selector
tests cover missing/invalid discovery and safe text rendering while keeping app,
passcode and comparison access. Runtime tests must exercise actual reachability,
prerequisites, setup Back/Skip, repeated saves, refresh/restart, forbidden deep links,
admin/history/render dispatch, and participant parameter preservation. Dynamic path
checks validate directory prefixes rather than every computed suffix; exercise
selected generated media URLs. Generated onboarding narration is optional in the
source and retains its documented speech/silence fallback.

Flow browser checks (check-all and CI): `tests/flows-browser.cjs` exercises package
journeys, outside-phone Tools and the actual creation adapter on file URLs with
spaces and HTTP. `tests/browser/snapshot-smoke.sh` exports two Flow snapshots in a
throwaway clone and runs `tests/flows-snapshot-browser.cjs` on the offline build,
over HTTP and from a file path with spaces; the snapshot test blocks all external
requests. The shared `tests/flows-tools-browser.cjs` helper compares normal/hover
button styles against the full app in all four themes, compares phone, **›** and
panel positions with the full app at 1440, 1000, 900, 390 and 320px (collapsed and
open; no Tools at phone widths), and checks Enter/Space, hidden-while-open behavior
and Close focus. They use the Playwright installation in the image. Record these results
separately from PM and platform acceptance.

## PM checklist

Use the items relevant to the change. Record who checked them, the commit, browser,
platform and result in PR text; name unavailable checks. Repeat affected checks after
material changes. Automated checks supplement PM testing.

Open root index.html on file://, enter 1337, open Local Prototype, exercise
the changed flow, check narrow layout and all four themes, input focus and sliders,
and audio when affected. Unpinned refresh from Local Prototype or a Flow must return to
the selector. With **Pin on refresh** checked in Tools, refresh must restart the same app
or Flow fresh, and the pin must show as on in the other places in that tab (a new tab
starts unpinned). Restart Flow always restarts in place; Exit Prototype and Exit Flow
return to the selector and keep the pin. For publication test
HTTP(S) screen/deep links with participant parameters; tracking follows the snapshot
setting and never injects on file://. Check the Prototype/Flows toggle (hidden when
no Flow snapshot is listed), archive expansion, hidden direct links, and retirement
notices.

PM acceptance for Emergency Fund: full and skipped setup; expense help/Buddy;
planning, save/reopen/repeat save; exactly one fund goal and immediate correct budget
replacement. Big Purchase: setup Back/Skip; known-model/new/used selection and quiz,
compare/finance/lease/planning; repeat purchase saves without budget writes; both
before-purchase and after-save ESF branches, their distinct Back callers, and return
to the same car session with inputs intact. Included ESF saves retain their budget
effect. Check constrained Goals, disabled controls, excluded routes and selected media.

Browser evidence is separate from automated DOM/VM tests. Record file:// results on
Windows/WSL and macOS separately, including paths with spaces, narrow layouts, four
themes, input/keyboard behavior, media, refresh/restart/exit and independent sessions.
Rehearse HTTP publication twice with a previous manifest and verify participant
links and frozen tracking. No Windows/WSL or macOS browser acceptance is implied by
this guide; absent platform evidence remains pending and must be named in the PR.

For local comparison changes, also use [comparison verification](local-variants.md#verification).
