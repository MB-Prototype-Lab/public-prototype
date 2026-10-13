# Verification

Run from the repository root:

```sh
bash scripts/check-syntax.sh
bash scripts/sweep.sh
python3 scripts/check-paths.py
node tests/release-runtime.cjs
node tests/local-variants.cjs
node tests/flows-selector.cjs
node tests/gate-tabs.cjs
node tests/flows-runtime.cjs
bash scripts/check-syntax.sh flows
python3 scripts/flows.py check
python3 -m unittest discover -s tests -v
python3 scripts/publish.py check
```

Node or macOS JavaScriptCore is needed for JS checks; Python 3.11+ for publication
checks. CI explicitly installs Node and Python. A missing engine is a blocked check,
never a pass. No local browser installation or server is required.

PM checklist: open root index.html on file://, enter 1337, open Local Prototype, exercise
the changed flow, check narrow layout and all four themes, input focus and sliders,
and audio when affected. Full-app refresh must return to the selector; Flow refresh
and Restart must start the same Flow fresh, and Exit must return to the selector. For publication test
HTTP(S) screen/deep links with participant parameters; tracking follows the snapshot
setting and never injects on file://. Check the Prototype/Flows toggle (hidden when
no Flow snapshot is listed), archive expansion, hidden direct links, and retirement
notices. Record results in PR text. Optional authorized browser
checks supplement PM testing. Re-run affected checks after material changes.

Publication tests use disposable Git repositories and do not push. Historical exports
are compared byte-for-byte against their immutable identities. Repository cutover
is complete; these checks preserve the established migration baseline.

Local comparison tests use disposable repositories to check selective checkpointing,
common starting commits, original-branch advancement, merge conflicts, interrupted
creation, path/branch collisions, and preservation during cleanup. The Node selector
test covers missing/invalid manifests, safe rendering, pane assignments and swaps,
count changes, retained iframe identity, tools toggles, restart isolation, and exit. Publication tests assert
local controls and metadata never appear in output.

For comparison changes, manually check file:// in separate tabs/windows, independent
app state, and refresh from each app through its root selector to the primary
selector. Check checkout paths with spaces on Windows and macOS. Automated DOM and
Git tests do not substitute for these browser/platform checks; record unavailable
checks explicitly.

For the side-by-side workspace, browser-check file embedding early on Windows/WSL
and macOS, including paths with spaces. Verify laptop and ultrawide layouts, all
four app themes, keyboard scrolling and controls, input focus, independent progress,
A+B → A+C → A+B, swaps, pane counts, tools widths, isolated restart, new tabs, refresh,
and Back to versions. Hidden previews retain state and keep running audio; pause
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


Optional Flow browser checks: `tests/flows-browser.cjs` exercises package journeys,
outside-phone Tools and the actual creation adapter on file URLs with spaces and
HTTP. `tests/flows-snapshot-browser.cjs` exercises offline exported packages; its
header describes the required snapshot IDs and environment. Set
`MB_FLOW_SNAPSHOT_FILE_ROOT` to an artifact directory with spaces to also check
file URLs. The shared `tests/flows-tools-browser.cjs` helper compares normal/hover
button styles against the full app in all four themes and checks Enter/Space,
hidden-while-open behavior, Close focus, placement and phone sizing. Both require an
existing Playwright/browser installation. Snapshot smoke blocks all external
requests. Record these results separately from PM and platform acceptance.
