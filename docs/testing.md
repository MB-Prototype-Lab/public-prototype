# Verification

Run every automated check from the repository root with one command:

```sh
bash scripts/check-all.sh
```

Each check prints PASS, FAIL or BLOCKED. BLOCKED means this machine lacks what
the check needs (Node, or Playwright and Chromium for the browser checks) and
says how to fix it; it is never a pass. The script exits 0 only when every check
ran and passed. The Flow snapshot rehearsal works on a clone, so it checks the
last commit, not uncommitted edits. It runs, in CI order:

```sh
bash scripts/check-syntax.sh
bash scripts/sweep.sh
python3 scripts/check-paths.py
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
python3 scripts/publish.py check
python3 scripts/publish.py build --offline --output <temporary folder>
node tests/browser/app-journeys-browser.cjs
MB_FLOW_BASE_URL=http://127.0.0.1:<port>/ node tests/flows-browser.cjs   # with python3 -m http.server <port> on the repository root
bash tests/browser/snapshot-smoke.sh <temporary folder>
```

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

Node or macOS JavaScriptCore is needed for JS checks; Python 3.11+ for publication
checks; Playwright with Chromium for the browser checks. CI explicitly installs all
of them. A missing engine is a blocked check, never a pass.

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
pictured too, so a phone that moves on the page is a phone change. The passcode and selector pages have their
own count and are declared under Tools. Screens only Tools can reach (L14) are
pictured once, in Natural Light at desktop width, during the Tools tour. After a
merge, main is compared with the previous main in report mode (`--report`):
changed pictures, which the PR declared, are reported but do not fail; a journey
that breaks or a new page error still fails.

To see the pictures for a PR, open its **Checks** tab, choose the **Browser
journeys** job, open the run's summary and download the
`browser-journey-pictures` artifact. Unzip it and open `index.html`: each step
shows Before, After and the Difference, with a tab per theme and one for desktop
with Tools.

- **Changed**: the picture differs from main, and differed again when the robot
  repeated the journey. **Only before** or **Only after** means only one version
  has that picture (the journey stopped early, or Tools was closed, on the
  other); it counts as a change.
- **Flaky**: it differed once but not on the repeat, so it is not counted.
- **Broke**: the journey stopped before its last step (a button it needed was
  missing, disabled or covered), or the page raised an error.

The same job also runs both Flows in Chromium from file:// (a folder with spaces)
and over HTTP, and rehearses exporting Flow snapshots in a throwaway copy of the
repository.

To run it on your machine, set it up once:

```sh
(cd tests/browser && npm ci && npx playwright install --with-deps chromium)
```

then, from the repository root:

```sh
node tests/browser/app-journeys-browser.cjs                    # every journey must finish; no pictures
node tests/browser/app-journeys-browser.cjs --compare main --out DIR   # pictures and report against main
```

The comparison takes a few minutes and prints a link to the report. Without the
setup, check-all marks the three browser checks BLOCKED with the fix; BLOCKED is
not a pass. Still manual: audio and video playback, real phones, and file:// on
Windows and macOS (CI runs Chromium on Linux).

The pictures leave some looks out on purpose, so that two runs of the same
version give the same pictures: hover looks (the pointer is moved off the page
first), pressed looks (each picture waits until a tap is let go), the tap
highlight (turned off), the text cursor, and video frames (each video is hidden
under a plain mask). "0 pictures changed" therefore proves nothing about a
change to `:hover`, `:active` or `-webkit-tap-highlight-color` rules, the caret,
or how a video looks; check those by hand and say so in the PR.

PM checklist: open root index.html on file://, enter 1337, open Local Prototype, exercise
the changed flow, check narrow layout and all four themes, input focus and sliders,
and audio when affected. Unpinned refresh from Local Prototype or a Flow must return to
the selector. With **Pin on refresh** checked in Tools, refresh must restart the same app
or Flow fresh, and the pin must show as on in the other places in that tab (a new tab
starts unpinned). Restart Flow always restarts in place; Exit Prototype and Exit Flow
return to the selector and keep the pin. For publication test
HTTP(S) screen/deep links with participant parameters; tracking follows the snapshot
setting and never injects on file://. Check the Prototype/Flows toggle (hidden when
no Flow snapshot is listed), archive expansion, hidden direct links, and retirement
notices. Record results in PR text. The automated browser checks supplement
PM testing; they do not replace it. Re-run affected checks after material changes.

Publication tests use disposable Git repositories and do not push. Historical exports
are compared byte-for-byte against their immutable identities. Repository cutover
is complete; these checks preserve the established migration baseline.

Local comparison tests use disposable repositories to check selective checkpointing,
common starting commits, original-branch advancement, merge conflicts, interrupted
creation, path/branch collisions, and preservation during cleanup. They also cover
Flow targets: Flow links, refusal of unusable Flows before any commit, sessions
without a target, and refusal to keep a Flow variant that changed files outside its
Flow (including renames). The Node selector test covers missing/invalid manifests and
targets, safe row rendering, placement on the target's tab with its count and
suggested tab, the Flow baseline, pane assignments and swaps, count changes, retained
iframe identity, tools toggles, restart isolation, layout records per target, and
exit to the right tab. The tab test covers suggested versus remembered tabs.
Publication tests assert local controls and metadata never appear in output.

For comparison changes, manually check file:// in separate tabs/windows, independent
app state, and refresh from each app through its root selector to the primary
selector. For a Flow comparison, also check from a variant Flow, standalone and in a
pane: Exit Flow and an unpinned refresh return to the primary selector on the Flows
tab, a pinned refresh restarts the variant, and in a pane Exit and the pin are
disabled. Check the selector's variant rows at phone width and in dark mode. Check
checkout paths with spaces on Windows and macOS. Automated DOM and Git tests do not
substitute for these browser/platform checks; record unavailable checks explicitly.

For the side-by-side workspace, browser-check file embedding early on Windows/WSL
and macOS, including paths with spaces. Verify laptop and ultrawide layouts, all
four app themes, keyboard scrolling and controls, input focus, independent progress,
A+B → A+C → A+B, swaps, pane counts, tools widths, isolated restart, new tabs, refresh,
and Back to versions. With the toolbar's Pin on refresh checked, refresh must reopen
the same pane count, assignments and tools widths with fresh panes; Back to versions
keeps the pin. Inside a pane, Tools' pin and Exit are disabled with a note, and
reloading one pane restarts it in place. Hidden previews retain state and keep running audio; pause
playback before hiding them. A frame load event alone does not prove the app loaded.

For preview sizing, check 1366×768, 1440×900, and 3440×1440 with two and four panes.
Each iframe should match the browser viewport height within rounding tolerance;
compare the phone against the standalone app at the same viewport height (720px at
768px, capped at 820px). Verify page scrolling reaches every preview bottom and
the stage has no vertical scroll range. Check horizontal scrolling by trackpad,
scrollbar, and keyboard, long descriptions, all four themes, and Show tools.
Resizing, swaps, pane-count changes, and tools toggles must preserve input progress.
Record Windows/WSL and macOS results separately; Linux browser checks do not verify
compatibility with either platform.

The combined-app sweep also exercises full onboarding through Home, Buddy setup,
ESF task entry/reopening/repeat saves, immediate budget replacement without
confirmation, shared-payment guidance, disclosure undo and double-count prevention,
and Buddy estimates applied to bands. Incoming blue checks cover paywall prices
and placeholders, repeated lesson framing, no-card visuals, narration recovery,
finished rewards and film replay. Python app-structure checks require matching
JSON wrappers, dependency ordering and no editable legacy directories.

For this integration, PM acceptance must also cover ESF and Buddy on narrow
layouts, all four themes, and affected onboarding/lesson audio and video. The
source ESF spec records small tap targets, car/coverage assumptions and prototype
estimates; record acceptance or remaining concerns in the integration PR.

## Flow verification

Run the commands above for the complete integrated change; for ordinary Flow edits
also run `python3 scripts/flows.py check --id ID` and
`python3 scripts/flows.py scope --base FULL_TASK_BASE_SHA --scope flow`. Explicit
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


Flow browser checks (check-all and CI): `tests/flows-browser.cjs` exercises package
journeys, outside-phone Tools and the actual creation adapter on file URLs with
spaces and HTTP. `tests/browser/snapshot-smoke.sh` exports two Flow snapshots in a
throwaway clone and runs `tests/flows-snapshot-browser.cjs` on the offline build,
over HTTP and from a file path with spaces; the snapshot test blocks all external
requests. The shared `tests/flows-tools-browser.cjs` helper compares normal/hover
button styles against the full app in all four themes, compares phone, **›** and
panel positions with the full app at 1440, 1000, 900, 390 and 320px (collapsed and
open; no Tools at phone widths), and checks Enter/Space, hidden-while-open behavior
and Close focus. They need the Playwright setup above. Record these results
separately from PM and platform acceptance.
