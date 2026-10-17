# Pre-PR review platform acceptance

This is the durable acceptance packet for changes to the
[review lifecycle](pre-pr-review.md). Native Windows desktop-agent smoke is
**required before merge** for this workflow feature. Linux/WSL checks, path-unit
tests and synthetic worker identities cannot satisfy that requirement. Reuse installed prerequisites and the documented setup path; this PR does not
build a new native prerequisite installer. Remote repository writes, shipping and
publication keep their existing authorization boundaries. The agent runs commands
and reports prerequisites; the PM should not have to type commands,
install WSL, construct IDs or handwrite verification JSON.

## Evidence layers

Keep these results separate, each with PASS, FAIL or BLOCKED, full tested SHA,
platform/runtime versions, actual commands/exits and artifact locations:

| Layer | What it establishes |
| --- | --- |
| `python3 -m unittest discover -s tests -v` | Deterministic real-Git lifecycle safety using `tests/test_pre_pr_review.py` and reusable `tests/pre_pr_review_fixture.py`. Reports are explicitly synthetic; they prove no app/browser or host delegation behavior. |
| Actual app controls/regressions | Real journey/browser entrypoints detect neutral, Phone, geometry and weakened-harness cases on committed disposable trees. |
| Native Windows Python/Git lifecycle | Actual Windows paths, process/locking/Git behavior and safe recovery. |
| Native desktop-agent skill | Real skill routing, fresh delegated roles, stop/resume, independent evidence, adoption and cleanup. |
| Native Windows file browser | Windows browser opens exact encoded native file previews and exercises the selected experience. |
| Windows browser via WSL UNC | Actual Windows browser opens the converter's encoded WSL URL; separate from native lifecycle execution. |

A missing prerequisite is BLOCKED, never evidence of a product regression or a
pass. Native Windows/macOS file browser, media, real devices and other exclusions
still follow [testing](testing.md#pm-checklist). Name unexercised platforms.

## Actual app control and regression recipe

Use the reusable opt-in generator, separate from unittest discovery:

```sh
python3 tests/pre_pr_review_real_app.py --source /absolute/source/checkout --commit FULL_COMMITTED_SHA --out /absolute/evidence/real-app --node /absolute/path/to/node
```

Use its `--help` for the current interface. On Windows use the verified native
Python executable and argument arrays with native absolute paths. The source must
be the exact committed implementation under test. The generator creates disposable
committed clones/worktrees without editing the source; no remote calls, installs,
shipping or publication are needed. Reuse installed Playwright through an absolute
`MB_PLAYWRIGHT_MODULE`; confirm an actual Chromium launch before controls. Keep
all generated outputs under the specified evidence directory. Record Python, Git,
Node, Playwright and Chromium versions. A missing browser library is a setup
failure, not regression evidence.

Inspect commands, full source/subject SHAs, reports and pictures for each case:

1. A neutral comment-only app commit passes actual VM and Chromium comparison;
   inspect Phone, Tools, wiring, tracking, picture inventory and normal geometry.
2. A committed normal-phone-height regression leaves VM snapshots unchanged but
   fails the actual browser comparison for repeated geometry/picture changes.
   Confirm complete retry inventory and no setup/page errors.
3. A committed visible-label regression fails the actual VM journey because the
   expected visible label is absent; retain actual visible controls in the report.
4. A deliberately weakened reviewed harness can report a pass for that regression;
   the unchanged finished harness must still detect the same missing label.
   This proves why reviewed-harness green cannot validate itself.

These selected controls demonstrate real detection and independent harness
assessment. They do not replace all journeys/themes/Flows, full check-all, lifecycle
adoption evidence or PM/native acceptance. Do not submit partial selected-journey
reports as complete preservation coverage.

## Delegated forward exercises

Run model-driven skill exercises separately from deterministic tests and actual-app
harness probes. Use a fresh bounded coordinator with raw requirements, the skill's
absolute source path, exact disposable checkout/evidence paths and permitted side
effects. It may delegate fresh reviewer/verifier/fixer roles; those workers never
delegate. Supply no expected findings or solution. Record actual host worker IDs,
commands, full SHAs, outcome/guards and evidence; never fabricate an attestation.

Successful end-to-end review uses a disposable committed **real app** clone with
the tested snapshot SHA as its local main, then a neutral finished task commit.
Use real checks/browser coverage, independent evidence, adoption and cleanup under
the normal procedure. Ask “Review my finished changes before a PR.”, then
“Continue my pre-PR review.”, “Show me the reviewed version.” and
“Clean up old review worktrees.” as applicable. Preserve source checkout/refs.

For protocol/negative cases only, generate a persistent minimal fixture with the
reusable `ReviewFixture`. Execute this Python in the agent, replacing both absolute
paths with explicit locations; destination must not exist:

```python
from pathlib import Path
import subprocess
import sys
source = Path("/absolute/source/checkout").resolve()
destination = Path("/absolute/disposable/case").resolve()
sys.path.insert(0, str(source / "tests"))
from pre_pr_review_fixture import ReviewFixture
fx = ReviewFixture()
try:
    subprocess.run(["git", "clone", "--no-hardlinks", str(fx.root), str(destination)], check=True, env=fx.env)
    subprocess.run(["git", "-C", str(destination), "branch", "main", fx.base], check=True, env=fx.env)
    for key, value in {"user.name": "Skill Exercise", "user.email": "exercise@example.invalid", "commit.gpgsign": "false"}.items():
        subprocess.run(["git", "-C", str(destination), "config", key, value], check=True, env=fx.env)
    print({"checkout": str(destination), "main": fx.base, "finished": fx.finished})
finally:
    fx.close()
```

Give the coordinator source guidance/helper paths explicitly when using this
minimal repository. Do not use `fx.evidence()` or synthetic reports as actual
agent/app/browser acceptance. A case that lacks real prerequisites should produce
BLOCKED/refusal, never a manufactured successful review.

| Exercise | Required observed outcome and evidence |
| --- | --- |
| Neutral real-app cleanup | Full independent checks and preservation pass; ff/no-fix completion; only eligible clean managed trees removed; refs/reports retained and original exact preview usable. |
| Detected regression | Independently demonstrate the affected Phone/browser/wiring/tracking failure from a healthy control; withhold adoption and retain original SHA/bytes plus review/checkpoint evidence. |
| Baseline failure | Retain actual failed/BLOCKED baseline log/SHA; investigation may continue but later green checks cannot erase the adoption blocker. |
| Unrelated dirty work | Select only finished task files; preserve unrelated staged blob/unstaged bytes/untracked files; isolated review may run, adoption waits for clean original. |
| Advanced original | Advance original after checkpoint; valid review cannot overwrite it; successor preserves old refs/evidence and freezes the new task checkpoint. |
| Missing Flow coverage | Omit required named Flow runtime/browser evidence; app-only green cannot authorize adoption; report the specific gap. |
| Unavailable delegation | Disable/unavailable host delegation in the bounded run; stop delegated review with visible limitation before coordinator-only broad review/fixes/adoption. |

Record each case as PASS/FAIL/BLOCKED with the actual skill outcome and artifacts.
Protocol refusal on a minimal fixture proves that guard only; it does not establish
successful real-app review or native platform acceptance.

## Native Windows desktop-agent packet

Run from the native desktop agent's **Local** checkout, not WSL. Give the agent this
request and let it handle commands, record selection and reports:

> Use the pre-pr-review platform acceptance packet at
> docs/pre-pr-review-platform-acceptance.md for the exact committed workflow change.
> Run on native Windows in a disposable local clone with spaces, Unicode and # in
> its path. Preserve my active checkout. Record versions, full SHAs, actual commands,
> delegation and browser evidence. Exercise review, interrupt/resume, previews,
> independent verification, adoption and safe automatic cleanup. Reuse installed
> prerequisites and the documented setup; do not build a new native installer here.
> Keep repository actions local; do not push or publish. If a prerequisite or fresh
> agent delegation remains unavailable, report BLOCKED and retain evidence.

The agent performs the following machine-side steps:

1. Record Windows edition/build, desktop-agent host/version, shell, source/helper
   full commit and Git/Python/Node/Playwright/Chromium versions. Inspect PowerShell
   `Get-Command py,python,python3,git,node,bash` and execute the available real
   interpreters. Require Python 3.11+, Node 22 and usable Git/Bash for check-all.
   A Microsoft Store Python alias is BLOCKED. Verify installed native Chromium
   launch. Diagnose missing setup without asking the PM to run installer commands.
2. Create an independent disposable local clone of the tested committed source
   (no hardlinks and no remote calls), for example under a temporary
   `MoneyBuddy review café #` path. Configure Git identity/hooks only in the clone.
   Establish the exact tested source SHA as this disposable clone's local main
   baseline so the lifecycle implementation is present; never move source refs.
   Create a named task branch from that frozen main and commit a neutral app
   comment. Record main, merge base and finished SHAs. Leave the active checkout
   untouched. Put evidence outside managed workspaces.
3. Run native unittest discovery, `bash scripts/check-all.sh`, Markdown links and
   edited-skill validation. Set `PYTHONDONTWRITEBYTECODE=1`, reuse absolute installed
   `MB_PLAYWRIGHT_MODULE`, and direct reports outside managed workspaces. Retain
   complete actual logs/exits; resolve failures or mark the row BLOCKED. Run the
   actual-app recipe above against the same tested snapshot in native Chromium.
4. Ask the desktop agent: “Review my finished changes before a PR.” Supply the raw
   neutral-task requirement. Confirm fresh-context default-model cold reviewer,
   independent verifier and sole fixer as needed; real worker IDs; no worker
   delegation; baseline before fixes; one writer; coordinator alone performs
   lifecycle operations. If delegation is unavailable, stop the review with a
   visible limitation. A fabricated worker record is not host acceptance.
5. Check actual helper help, then exercise `status --json`, `start`, explicit
   coordinator-selected `resume ID`, `worker`, `url`, `adopt --verification` and
   `cleanup` through the [lifecycle procedure](pre-pr-review.md#persistent-lifecycle).
   Retain schema/record/ref/SHA snapshots and the independent verifier's actual
   evidence. Never handwrite a passing attestation or substitute synthetic fixture
   reports. Return product decisions in the documented PM format if any appear.
6. Ask: “Show me the reviewed version.” Open reported original/finished/reviewed
   native file URLs in a native Windows browser. Check selector/passcode `1337`,
   Local Prototype and an intended Flow when applicable, narrow layout/four themes,
   input/keyboard, refresh/restart/exit and independent sessions. Record URL,
   browser/version, full SHA and cleanliness. Encoded spaces, Unicode and # must
   open. Dirty/advanced work must say **Current task work**; absent previews must
   say **Unavailable**. Only current exact independent evidence permits
   **Verified review result**.
7. In a disposable controlled case, interrupt between saved creation intent and
   workspace creation or after adoption merge before phase save. Use a controlled
   reproducible interruption, not guessed deletion of source files. Restart the
   desktop session and ask: “Continue my pre-PR review.” Confirm disk discovery, explicit
   selection internally, retained refs/evidence, safe missing committed workspace
   recreation and no second merge. Unknown stranded lock contents remain intact
   and reported. Retain before/after commands and actual Git state.
8. With complete independent evidence and a clean original at exact finished,
   confirm ff-only adoption, exact clean reviewed original and automatic removal
   of only eligible managed workspaces. Re-run explicit completed cleanup and
   resume to prove idempotence and original preview fallback. In a separate
   disposable case leave ignored/untracked content in a managed tree and prove
   cleanup retains it with a concrete reason. Original/unrelated worktrees, parent
   files, refs and evidence survive. Never force-remove caches or arbitrary data.
9. Separately use the existing converter on a WSL checkout to produce its actual
   distro-specific UNC preview. Open the encoded `file://wsl.localhost/...` URL
   in the Windows browser and exercise passcode/selector/app, refresh and exit.
   Record distro, Windows browser, SHA and result. This row does not imply native
   Windows helper acceptance, or vice versa.

Report all six evidence-layer rows above, with exact tested commits and links.
Native Windows lifecycle, desktop-agent and file-browser rows must pass before
merge of this workflow feature. Any blocked row remains a named merge blocker;
WSL automated Chromium success cannot waive it.

## Immediate follow-up: Docker prerequisites

The next PR should make installed desktop agent plus Git the only host
prerequisites beyond Docker. This PR does not implement an installer or Docker.
Scope the follow-up to Windows/PowerShell and POSIX launchers, a pinned image with
Python/Node/Playwright/Chromium and system libraries, full checks and both review
comparisons, and selection of the exact committed version. Run Git operations in
isolated managed workspaces, preserve original/index/ref/cleanup guards, and retain
reports on the host with usable preview/evidence paths. Do not silently select a
container's stale HEAD or assume container paths are host browser URLs.

Acceptance must include native Windows and POSIX launcher runs from paths with
spaces/Unicode, exact command/version/image digest/full SHA evidence, real browser
controls/regressions, interrupt/resume, independent-agent evidence and safe cleanup.
Container success does not replace native desktop-agent routing or host file-preview
acceptance. Preserve existing prerequisite diagnostics until the new path is proved.
