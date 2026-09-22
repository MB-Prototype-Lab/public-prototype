# Working together

Operators coordinate in Discord; GitHub Issues are optional. Start/sync manage work,
ship integrates tested work into main, publish explicitly updates the live selector
and optionally adds a snapshot. An operator can request publication after
coordination.
Shipping does not authorize publication. A task's remote permissions must be explicit;
the organization rollout permits remote reads, task-branch pushes, PR creation and CI
verification. Merge, repository settings and publication require separate authorization.
The old repo/site remains the blue fallback; team cutover is pending.

## Start work

Inspect `git status --short`, current branch, `git branch -avv`, and local-only commits
(`git log origin/main..main`). Cached remote refs are not current remote evidence.
When remote reads are authorized, fetch and inspect main against origin/main. Never
reset local-ahead main: identify its commits, preserve them, and explain whether they
belong to this task. Fast-forward a clean behind main only when safe. If histories
diverged, preserve both and reconcile deliberately; do not create work from an
unexplained base. Resume a matching task branch after checking its history, or create
`work/<short-task>-<unique-suffix>` from the agreed current main. Check branch name
collisions before creating. Dirty or unrelated work stays intact: finish on its branch,
or ask the operator how to separate it. Never silently stash, discard, or
combine it.
No worktrees yet. Concurrent operators use distinct task branches.

## Sync

Check dirty files first. After an authorized fetch, merge current main into the task
branch (`git merge origin/main` when that is the verified integration tip). Include
any intentionally preserved local-main work only after understanding its scope.
Never rebase or force push. Resolve mechanical conflicts and run affected checks.
For competing product behavior, explain both choices and ask the operator;
leave conflict work preserved until answered. Abort only when it safely
restores the pre-merge state.

## Ship

Review the entire diff to main for scope and unintended files. Sync, run the checks in
docs/testing.md, and record manual operator results for changed flows.
Applicable signoff means the operator checked the behavior affected by this PR;
repeat after material changes.
With authorized remote writes, push only the task branch. Never push main directly.
Prepare PR text: problem, resulting behavior, validation actually run, limitations,
and a short operator checklist. Do not add historical progress-log chores.

With GitHub CLI available: `gh pr create --base main --head <branch> --body-file <file>`;
inspect `gh pr checks <number>` and PR mergeability/current base. Only after passing CI,
operator signoff and authorized shipping, `gh pr merge <number> --squash`.
Confirm the actual merged commit before cleanup; update local main safely.
Never delete dirty branches, local-only commits or another operator's work.
Remote branch deletion needs separate scope.

Without CLI, prepare https://github.com/MB-Prototype-Lab/public-prototype/compare/main...BRANCH
(URL-encode the branch), plus exact PR title/body in a file. After the authorized push:
1. Open comparison; choose base `main`, compare the task branch; inspect Files changed.
2. Click Create pull request, paste prepared title/body, and submit.
3. On Checks, wait for App checks and Publication checks. Resolve failures; verify
   the branch is current with main and record operator testing in the PR description.
4. When shipping is authorized, select Squash and merge, review message, Confirm.
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

## Adoption

After authorized rollout, each operator reads this workflow and inspects their
checkout with their agent. Preserve unfinished work. For HoffDemo branches, do
not merge main's source consolidation into the branch as an automatic onboarding
step; keep the branch intact and plan explicit feature ports. New tasks target
app/ from current main.
The operator setup in README.md offers Claude Desktop on Windows with browser
sign-in, or a terminal with a repository-scoped token. An agent can install and
configure GitHub CLI for either path.
No broad permission allowlists, custom hooks, mandatory subagents, or browser
automation are required. Administrator setup is in publishing.md.
