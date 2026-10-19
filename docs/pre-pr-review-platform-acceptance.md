# Pre-PR review platform acceptance

This is the acceptance packet for changes to the
[review lifecycle](pre-pr-review.md). Operators choose their client and execution
environment: native Windows or WSL/POSIX. Neither is mandated, and no operator
must maintain both. Preflight Git and test tools in that chosen environment;
native Git/Git Bash are not prerequisites for a WSL operator.

Use the [container launcher](container-checks.md) in the chosen environment. Assess workflow changes using the retained
automated, independent-review and applicable host/browser evidence. Native Windows
desktop-agent acceptance is not a universal merge gate. Additional platform checks
may improve coverage; an unexercised second environment is a recorded limitation,
not a reason to require another toolchain. This does not waive failed checks or
the independent evidence required for automatic review adoption.

Remote repository writes, shipping and publication keep their existing
authorization boundaries. The agent runs commands and reports prerequisites;
the PM should not have to type commands, install a second environment, construct
IDs or handwrite verification JSON.

## Evidence layers

Keep these results separate with full tested SHA, platform/runtime versions,
actual commands/exits and artifact locations. Use PASS, FAIL or BLOCKED for
attempted checks. Mark unexercised additional environments as not run; do not
infer that every row requires a separate environment on the operator's machine.

| Layer | What it establishes |
| --- | --- |
| `python3 -m unittest discover -s tests -v` | Deterministic real-Git lifecycle safety using `tests/test_pre_pr_review.py` and reusable `tests/pre_pr_review_fixture.py`. Reports are explicitly synthetic; they prove no app/browser or host delegation behavior. |
| Actual app controls/regressions | Real journey/browser entrypoints detect neutral, Phone, geometry and weakened-harness cases on committed disposable trees. |
| Lifecycle in the chosen environment | Actual paths, process/locking/Git behavior and safe recovery in native Windows or WSL/POSIX. |
| Agent skill in the chosen client | Real skill routing, fresh delegated roles, stop/resume, independent evidence, adoption and cleanup. |
| Host file browser | The operator's browser opens exact encoded previews and exercises the selected experience. |
| Windows browser via WSL UNC, when used | Actual Windows browser opens the converter's encoded WSL URL; separate from native Windows lifecycle execution. |

A missing prerequisite for a check being attempted is BLOCKED, never evidence of
a product regression or a pass. Missing native Windows tools do not block WSL
lifecycle acceptance, and the reverse also holds. Browser, media, real devices and
other exclusions still follow [testing](testing.md#pm-checklist). Name unexercised
platforms without claiming coverage.

Record unexercised, unused secondary environments in informational platform
coverage notes and the PR, outside the blocking `verification.json` limitation
inventory. That inventory covers gaps affecting required review evidence; do not
invent a resolved entry for an untested platform. Missing required checks in the
chosen environment still block automatic adoption.

## Actual app control and regression recipe

Use the reusable opt-in generator, separate from unittest discovery:

```sh
python3 tests/pre_pr_review_real_app.py --source /absolute/source/checkout --commit FULL_COMMITTED_SHA --out /absolute/evidence/real-app --node /absolute/path/to/node
```

These are in-container arguments: invoke through `checks.ps1 exec --` or
`bash scripts/checks.sh exec --`, using `/work/repo` for captured source and a
run-specific path under `/reports` for retained evidence. Use its `--help` for the
current interface. The source must
be the exact committed implementation under test. The generator creates disposable
committed clones/worktrees without editing the source; no remote calls, installs,
shipping or publication are needed. The image supplies `MB_PLAYWRIGHT_MODULE`;
confirm an actual Chromium launch with the container doctor before controls. Keep
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
adoption evidence or applicable PM/host acceptance. Do not submit partial selected-journey
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

## Chosen-environment agent packet

Run in the operator's existing client and environment. A WSL session can exercise
the WSL lifecycle and open previews in a Windows browser; that needs no native
Windows Git, Python or Bash. Native Windows uses PowerShell, Git and Docker;
Python, Node, Bash and Chromium run inside the shared Linux image.
Give the agent this request and let it handle commands, record selection and reports:

> Use the pre-pr-review platform acceptance packet at
> docs/pre-pr-review-platform-acceptance.md for the exact committed workflow change.
> Use my current client and environment in a disposable local clone with spaces,
> Unicode and # in its path. Preserve my active checkout. Record the environment,
> versions, full SHAs, actual commands,
> delegation and browser evidence. Exercise review, interrupt/resume, previews,
> independent verification, adoption and safe automatic cleanup. Reuse installed
> prerequisites and the documented setup; do not require a second environment or
> build an installer here.
> Keep repository actions local; do not push or publish. If a prerequisite or fresh
> agent delegation remains unavailable, report BLOCKED and retain evidence.

The agent performs the following machine-side steps:

1. Record OS/build, agent client/version, execution environment, shell, full
   source/helper commit, host Git/Docker versions and the container image identity.
   Inspect host Git and Docker (`command -v git docker` in WSL/POSIX, or
   `Get-Command git,docker` in PowerShell), then run the container launcher `doctor`.
   Record its Git/Python/Node/Playwright/Chromium versions and launch result. No host
   Python, Node, Playwright or extra Bash installation is required. Missing Docker
   or a failed Chromium launch is BLOCKED; do not install a parallel host toolchain.
2. Create an independent disposable local clone of the tested committed source
   (no hardlinks and no remote calls), for example under a temporary
   `MoneyBuddy review café #` path. Configure Git identity/hooks only in the clone.
   Establish the exact tested source SHA as this disposable clone's local main
   baseline so the lifecycle implementation is present; never move source refs.
   Create a named task branch from that frozen main and commit a neutral app
   comment. Record main, merge base and finished SHAs. Leave the active checkout
   untouched. Put evidence outside managed workspaces.
3. Use the launcher for unittest discovery, `all --committed`, Markdown links and
   [edited-skill validation](container-checks.md#targeted-skill-validation). Set
   `MB_CHECK_OUTPUT_ROOT` to the existing absolute `host_artifact_dir` for managed
   workspace checks. The image sets `PYTHONDONTWRITEBYTECODE` and
   `MB_PLAYWRIGHT_MODULE`. Retain complete actual logs/exits; resolve failures or
   mark the row BLOCKED. Run the actual-app recipe above against the same tested
   snapshot inside the image.
4. Ask the agent: “Review my finished changes before a PR.” Supply the raw
   neutral-task requirement. Confirm fresh-context default-model cold reviewer,
   independent verifier and sole fixer as needed; real worker IDs; no worker
   delegation; baseline before fixes; one writer; coordinator alone performs
   lifecycle operations. If delegation is unavailable, stop the review with a
   visible limitation. A fabricated worker record is not host acceptance; WSL
   delegation is valid evidence for the WSL client and need not be repeated natively.
5. Check actual helper help, then exercise `status --json`, `start`, explicit
   coordinator-selected `resume ID`, `worker`, `url`, `adopt --verification` and
   `cleanup` through the [lifecycle procedure](pre-pr-review.md#persistent-lifecycle).
   Retain schema/record/ref/SHA snapshots and the independent verifier's actual
   evidence. Never handwrite a passing attestation or substitute synthetic fixture
   reports. Return product decisions in the documented PM format if any appear.
6. Ask: “Show me the reviewed version.” Open reported original/finished/reviewed
   host file URLs in the operator's browser. Use native file URLs or the converter's
   WSL UNC URLs as appropriate. Check selector/passcode `1337`,
   Local Prototype and an intended Flow when applicable, narrow layout/four themes,
   input/keyboard, refresh/restart/exit and independent sessions. Record URL,
   browser/version, full SHA and cleanliness. Encoded spaces, Unicode and # must
   open. Dirty/advanced work must say **Current task work**; absent previews must
   say **Unavailable**. Only current exact independent evidence permits
   **Verified review result**.
7. In a disposable controlled case, interrupt between saved creation intent and
   workspace creation or after adoption merge before phase save. Use a controlled
   reproducible interruption, not guessed deletion of source files. Restart the
   agent session and ask: “Continue my pre-PR review.” Confirm disk discovery, explicit
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
9. When the operator uses WSL with a Windows browser, use the existing converter
   on that checkout to produce its actual
   distro-specific UNC preview. Open the encoded `file://wsl.localhost/...` URL
   in the Windows browser and exercise passcode/selector/app, refresh and exit.
   Record distro, Windows browser, SHA and result. This proves that host preview
   route; it does not require or imply native Windows helper execution.

Report the evidence-layer rows above with exact tested commits and links, including
unexercised additional platforms. A successful WSL review does not claim native
Windows lifecycle coverage, and needs no native repeat. Keep actual failed/BLOCKED
checks and missing automatic-adoption evidence visible; additional-environment
gaps do not create a universal merge blocker.

## Container acceptance

The [container guide](container-checks.md) owns image and mount behavior. Validate
PowerShell and Bash entrypoints at project level without requiring each PM to
maintain both environments. Retain image identity, commands, full SHA and host
report links. Exercise paths with spaces/Unicode, exact committed selection,
Chromium controls, interruption/resume, independent-agent evidence and safe cleanup.
Keep untested platforms and failed/BLOCKED checks visible. Host preview acceptance
remains separate from Chromium tests inside Linux.

## Host Git 2.43 compatibility

Use the operator's normal Git 2.43 for host acceptance; do not substitute a temporary
newer Git or upgrade the host to make a test pass. Record its executable and version
separately from Git in the image. In disposable cases, exercise both review and
variant creation, host editing/committing, container checks, commit import, adoption,
cleanup and interrupted creation/resume.

During each lifecycle, run host `git status` and `git diff` in the original and
managed repositories. Commit a controlled change with host Git in a managed
repository and confirm container Git observes that exact commit. Verify host
operations still work after cleanup and after interruption. Compare original Git
configuration before and after: repository format and extensions must remain
unchanged, and `extensions.relativeWorktrees` must not be introduced. Each new
managed checkout must have its own complete `.git`, no object alternates or shared
hardlinks, and no linked-worktree registration in the original repository.

Exercise retained refs and evidence, stale original/managed refs, dirty and ignored
content, changed ownership metadata, unexpected directories and legacy records.
They must be preserved or refused rather than overwritten or deleted. Record
separate native Windows and WSL results; container Git success alone does not prove
host Git compatibility.
