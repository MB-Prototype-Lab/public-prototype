# Container checks

PMs can ask “Set up checks”, “Run all checks”, or “Compare my changes with main”.
The [run-checks skill](../.claude/skills/run-checks/SKILL.md) builds the image and
runs checks on their behalf. For independent review, use
[pre-pr-review](pre-pr-review.md); for PR preparation, use [ship](workflow.md#ship).

## Host setup

Install Git and Docker with Linux-container support in the agent's chosen
Windows or WSL/POSIX environment. Docker Desktop must be running and permit
access to the checkout drive. Native Windows uses PowerShell; WSL/POSIX uses Bash.
Git Bash is also supported. Host Node, Python, npm, Make, and GNU utilities are
not prerequisites. GitHub CLI remains optional for the browser PR handoff.

The first build needs network access and downloads the pinned Linux toolchain,
npm dependencies and Chromium. Later checks reuse the image. Source edits do not
require rebuilding dependencies; launchers automatically build from the current
Dockerfile and dependency inputs. Docker's layer cache avoids unchanged installs.
Do not silently fall back to host runtimes if Docker is unavailable.

## Commands

Run from the selected checkout root. PowerShell examples:

```powershell
.\scripts\checks.ps1 doctor
.\scripts\checks.ps1 build
.\scripts\checks.ps1 all
.\scripts\checks.ps1 compare --base main
.\scripts\checks.ps1 review status --json
.\scripts\checks.ps1 helper flows scope --scope flow
```

Bash equivalents:

```sh
bash scripts/checks.sh doctor
bash scripts/checks.sh build
bash scripts/checks.sh all
bash scripts/checks.sh compare --base main
bash scripts/checks.sh review status --json
bash scripts/checks.sh helper flows scope --scope flow
```

`all` runs the existing complete suite. `compare` runs VM and Chromium comparisons.
`exec` runs a targeted check inside an isolated repository, for example:

```sh
bash scripts/checks.sh exec -- node tests/app-journeys.cjs --selftest
```

Direct Python/Node/Bash commands elsewhere in the verification documentation
identify in-container commands. Prefix targeted checks with the launcher `exec`.
Use `review` for the review lifecycle and `helper flows`, `helper local-variants`,
or `helper publish` for intentional working-checkout operations. `exec` edits are
disposable; it must not be used to create a Flow or adopt a variant on the host.
Existing helper authorization and preservation rules still apply.

## Targeted skill validation

When a project skill changes, run the vendored skill-creator validator in the
image, replacing `NAME` with the edited skill directory:

```sh
bash scripts/checks.sh exec -- python3 /opt/moneybuddy/validate-skill.py .claude/skills/NAME
```

On Windows use `scripts/checks.ps1` with the same arguments. The image includes a
hash-pinned PyYAML wheel and the validator; neither host Python nor an external
skill installation is required. The vendored file records its source and original
content digest. This targeted check supplements the normal suite when skills
change; it does not add a new always-on check.

## Inputs, mounts and reports

Checks mount the source checkout read-only and build an independent Git repository
in a disposable Docker volume. Explicit Git exports supply history, refs and tags.
The working-copy input includes tracked edits/deletions and eligible nonignored
untracked source; it excludes `.worktrees/`, local dependencies and generated
reports. Capture records identify source content and commits. Publication snapshot
rehearsals still test committed content; uncommitted edits are not in that snapshot.

Add `--committed` to `all`, `compare`, or `exec` for exact committed review evidence.
For `exec`, put launcher options before `--` and the child command afterward;
arguments after that separator pass through unchanged. Resolve and
record full SHAs for both sides of comparisons; never infer the tested version
from a container's previous HEAD. All automated Chromium tests run inside the
image, alongside their HTTP server. Normal checks have no external network access.

Ordinary runs store captures/reports under `.container-checks/inputs/<run>` and
`.container-checks/reports/<run>`. Set `MB_CHECK_OUTPUT_ROOT` to an existing absolute
host directory to place `inputs/<run>` and `reports/<run>` there instead. For every
check in a managed finished/reviewed worktree, this setting is required: use the
record's `host_artifact_dir`, outside that worktree. Ignored output inside managed
workspaces prevents safe cleanup. Set the environment variable for the check and
restore its prior value afterward; include it in worker instructions.

Tests run directly from the selected linked worktree and build using its current
container files; lifecycle/helper commands remain in the primary checkout.
Keep logs, image/tool identities,
source manifests, screenshots and comparison reports, including failures. A partial
or interrupted run is not a pass. Inspect warnings as well as PASS/FAIL/BLOCKED.
Only run-owned disposable containers/volumes may be removed automatically.

Lifecycle and helper operations currently require the primary checkout with its own
`.git` directory; isolated tests also support linked checkouts. These operations
use explicit writable host mounts because they
intentionally change the checkout or its managed workspaces. Review records use
portable path identities; new managed worktrees require Git supporting relative
worktree links on the host and in the image. Legacy schema-1 reviews remain intact;
container execution must not silently reinterpret their absolute paths. The agent
can run `review migrate ID` for a completed, cleaned legacy review. Migration
validates ownership, retained refs, adoption and independent evidence, preserves a
`record.native-v1.json` backup, and writes portable identities. Active legacy
reviews or retained managed workspaces must finish and clean up in the original
environment first. An unfinished legacy review on the current branch prevents a
duplicate review; unrelated historical records do not block new tasks.

Review JSON exposes `host_artifact_dir`, `host_original_checkout`, and each
workspace's `host_path` for the coordinating agent to edit files or author evidence
on the host. Existing raw path fields identify in-container execution paths.
The lifecycle launcher accepts absolute host `--verification` and `--file` paths
and maps them into the validated mounts. Variant worktrees also use relative Git
links so host agents can work in them.

Return host preview/report links to PMs, never container `/workspace` paths. For
WSL previews, preserve the real distro identity. The agent coordinates independent
workers on the host; Docker supplies their check environment.

## CI and acceptance

App checks, Publication checks and Browser journeys use the same image and runner.
They preserve PR declarations, base/head selection and commit-series comparisons.
Publication deployment is the explicit network-enabled exception: it validates
against the live manifest before GitHub's existing Pages deployment steps. The CI
host performs the authenticated Git fetch before capture and passes its exact
main SHA. The image verifies that bundled origin/main and the publication commit
match that SHA; no GitHub credentials enter the image. The host checks current
main again immediately before deployment.

Validate native PowerShell and Bash entrypoints with only Git and Docker available,
including spaces, Unicode, `#`, CRLF, linked worktrees, interrupted captures, changed
source, failed builds and retained reports. Exercise actual Chromium regression
controls and review adoption/cleanup guards. Record actual tested image identity,
full SHA and platform; do not claim a platform from another platform's results.
See [review acceptance](pre-pr-review-platform-acceptance.md).

For native launcher argument acceptance, the agent runs
`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tests/checks-powershell.ps1`
on Windows. This extracts the actual launcher functions and exercises a temporary
native executable, checking Unicode/JSON/quoted arguments, trailing backslashes,
exit codes and byte-exact UTF-8/NUL Git inventories. It requires no additional
installation and removes its temporary executable. Passing this contract check
establishes argument transport, not native Git/Docker lifecycle acceptance. The
**PowerShell launcher** CI job runs this contract on a Windows runner without
Docker. Local execution passed on Windows PowerShell 5.1.26100.9711; record separate
results for native Git/Docker workflows.

The geometry regression uses the app's intentional system font stacks. Its tall
screenshot height can therefore differ from an older host's 1324px measurement;
the container measured 1357px. The control asserts 390px width, content taller than
the normal phone, and identical sizes and pixels across all captures, while
retaining exact 796→676px normal-phone heights and detection of a 1px scroll.
`results.json` and the command log retain actual dimensions, including on assertion
failure. Comparison thresholds and app styling are unchanged.

Container Chromium coverage does not establish manual media playback, real-phone
behavior or native Windows/macOS browser acceptance. Those checks remain separately
reported. Initial implementation requires real Docker and platform acceptance;
static checks alone cannot establish that the image builds or runs.
