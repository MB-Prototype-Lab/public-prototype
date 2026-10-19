# Working together

Operators coordinate in Discord; GitHub Issues are optional. Start/sync manage work,
pre-pr-review delegates a cold review of finished work, ship prepares reviewed
task work for main, publish explicitly updates the live selector
and optionally adds a snapshot. An operator can request publication after
coordination.
Remote actions follow the [authorization boundary](../CLAUDE.md#collaboration).

## Start work

Inspect `git status --short`, current branch, `git branch -avv`, and local-only commits
(`git log origin/main..main`). Cached remote refs are not current remote evidence.
When remote reads are authorized, fetch and inspect main against origin/main. Never
reset local-ahead main: identify its commits, preserve them, and explain whether they
belong to this task. Fast-forward a clean behind main only when safe. If histories
diverged, preserve both and reconcile deliberately; do not create work from an
unexplained base. Resume a matching task branch after checking its history, or create
`work/<short-task-name>` from the agreed current main. Use plain words a PM can say
and paste (`work/full-code-review`), with no date or random suffix. Check local and
remote names first; on a collision, choose a more specific name. Dirty or unrelated work stays intact: finish on its branch,
or ask the operator how to separate it. Never silently stash, discard, or
combine it.
Concurrent operators use distinct task branches. For variants within one task,
use [compare-local](../.claude/skills/compare-local/SKILL.md) and the
[local comparison procedure](local-variants.md). Comparisons start from the current
feature branch checkpoint, not a new main-based task.

## Task scope

At intake, identify product intent and affected packages, then read the relevant
sections of [code health](code-health.md). Inspect dependencies and contracts
before editing; agents own related technical maintenance and PMs decide product
behavior. Keep cleanup behavior-preserving and explain unexpected differences
before adopting them.

`app/` is the approved product; `flows/<id>/` holds contained proposals. For a Flow
task, record its ID, follow [Flows](flows.md), and run
`python3 scripts/flows.py scope --scope flow`; it compares app/ with the branch's
merge base with main, so no base is recorded. Creation and editing must leave app
bytes unchanged. A chosen proposal enters the product through an explicit
app-integration task and selective changes, using `--scope app-integration`. PM
verifies the integrated full app before the PR opens.
Merging a Flow makes it available without approving or integrating the proposal.

## Sync

Check dirty files first. After an authorized fetch, merge current main into the task
branch (`git merge origin/main` when that is the verified integration tip). Include
any intentionally preserved local-main work only after understanding its scope.
Never rebase or force push. Resolve mechanical conflicts and run affected checks.
For competing product behavior, explain both choices and ask the operator;
leave conflict work preserved until answered. Abort only when it safely
restores the pre-merge state.

## Pre-PR review

For “Review my finished changes before a PR.”, “Continue my pre-PR review.”,
“Show me the reviewed version.” or “Clean up old review worktrees.”, use
[pre-pr-review](../.claude/skills/pre-pr-review/SKILL.md). Its
[authoritative procedure](pre-pr-review.md) owns checkpointing, disk discovery,
independent workers/evidence, accurate previews, recovery, adoption and automatic
eligible cleanup. The coordinator resolves review IDs; PMs receive an outcome,
product decisions/blockers, the exact version to test and the next action. Accepted
product changes become task work and a new finished checkpoint, preserving the same
review gates. This optional local workflow does not sync main or perform remote
actions; ordinary implementation keeps the task-scope workflow above.

## Ship

Complete the [maintenance handoff](code-health.md#before-handoff).
Discover persisted [pre-PR review](pre-pr-review.md#ship-handoff) records with
`bash scripts/checks.sh review status --json` (or `scripts/checks.ps1 review status --json`), even in a new conversation. Resolve
the current task, retry eligible completed cleanup and carry checkpoint, fixes,
both comparisons, findings, decisions and limitations into the handoff. Report
incomplete/stale evidence. Do not force this optional review on ordinary ship; it
does not replace sync, current-main checks, CI or applicable PM verification.
Changes to this review workflow follow
[platform acceptance](pre-pr-review-platform-acceptance.md) in the operator's
chosen environment. Operators need not maintain both native Windows and WSL;
unexercised additional environments remain recorded limitations.
Review the entire diff to main for scope and unintended files. Review the `app/` diff
for journey switches with the review questions in
[one product](app-contracts.md#one-product-no-journey-switches); the PR text records
"Journey switches in app/: none", or names each one and its approved decision.
Sync, run the checks in docs/testing.md, and record manual operator results for
changed flows.
Applicable signoff means the operator checked the behavior affected by this PR;
repeat after material changes.
With authorized remote writes, push only the task branch. Never push main directly.
Prepare PR text: problem, resulting behavior, maintenance performed, validation
actually run, unresolved limitations,
and applicable [PM checks](testing.md#pm-checklist) ([template](../.github/pull_request_template.md)).
Its "Phone and Tools changes" lines must declare what `node tests/app-journeys.cjs
--against main` reports, and any picture change the browser check finds
(`node tests/browser/app-journeys-browser.cjs --compare main --out DIR`); CI checks them.
Use short commit subjects without bodies, trailers or AI attribution, including
the squash message. Do not add historical progress-log chores.

With GitHub CLI available: `gh pr create --base main --head <branch> --body-file <file>`;
inspect `gh pr checks <number>` and PR mergeability/current base. Only after passing CI,
operator signoff and authorized merge, `gh pr merge <number> --squash`.
Confirm the actual merged commit before cleanup; update local main safely.
Never delete dirty branches, local-only commits or another operator's work.
Remote branch deletion needs separate scope.

Without CLI, prepare https://github.com/MB-Prototype-Lab/public-prototype/compare/main...BRANCH
(URL-encode the branch), plus exact PR title/body in a file. After the authorized push:
1. Open comparison; choose base `main`, compare the task branch; inspect Files changed.
2. Click Create pull request, paste prepared title/body, and submit.
3. On Checks, wait for App checks, Publication checks and Browser journeys. Resolve
   failures; verify the branch is current with main and record operator testing in
   the PR description.
4. When merge is authorized, select Squash and merge, review message, Confirm.
5. Reload the PR and confirm Merged and the commit SHA. Supply that evidence before
   the agent updates local main or cleans up. A link alone proves nothing happened.
If no push credentials exist, create a local Git bundle for an authorized collaborator.
Do not infer CI or merge success from an operator's intent to click.

Definition of Done: merged into main, automated checks passing, applicable manual
checks recorded. Report local implementation, local verification, pushed, merged,
admin setup, deployed, and live verification as separate milestones.

## Publish

Read [publishing](publishing.md). An ambiguous publish request needs a tracking choice
(study or untracked comparison) and label. Explicit choices do not need re-confirming.
Selector changes also use a PR and publication tag. Catalog merges never deploy.
Retirement needs an explicit request naming the build and acknowledging its direct
URL will stop opening the app. Resolve an ongoing study before retirement or demotion.
Hide builds to reduce clutter while retaining direct access.

Use the [container launcher](container-checks.md) for checks and Python helpers.
Host Git operations and GitHub/browser handoff keep the procedures above.
