# Verification

Run from the repository root:

```sh
bash scripts/check-syntax.sh
bash scripts/sweep.sh
python3 scripts/check-paths.py
node tests/release-runtime.cjs
node tests/local-variants.cjs
python3 -m unittest discover -s tests -v
python3 scripts/publish.py check
```

Node or macOS JavaScriptCore is needed for JS checks; Python 3.11+ for publication
checks. CI explicitly installs Node and Python. A missing engine is a blocked check,
never a pass. No local browser installation or server is required.

PM checklist: open root index.html on file://, enter 1337, open current app, exercise
the changed flow, check narrow layout and all four themes, input focus and sliders,
and audio when affected. Refresh must return to the selector. For publication test
HTTP(S) screen/deep links with participant parameters; tracking follows the snapshot
setting and never injects on file://. Check archive expansion, hidden direct links,
and retirement notices. Record results in PR text. Optional authorized browser
checks supplement PM testing. Re-run affected checks after material changes.

Publication tests use disposable Git repositories and do not push. Historical exports
are compared byte-for-byte before source consolidation. Initial cached migration is
provisional: owner verification is a separate cutover requirement.

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
