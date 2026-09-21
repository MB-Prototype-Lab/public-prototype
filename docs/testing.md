# Verification

Run from the repository root:

```sh
bash scripts/check-syntax.sh
bash scripts/sweep.sh
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
