# MoneyBuddy prototype

A static, mobile-shaped finance coaching prototype. `app/` is the editable full
product; `flows/<id>/` contains focused proposals and study journeys. Open root
`index.html`, enter `1337`, and choose Local Prototype or a Flow. No server or
package installation is needed to preview. Script-wrapped data supports `file://`.
Refresh returns to the selector unless Tools' **Pin on refresh** is on for that
browser tab; pinned, the same app or Flow restarts fresh. Restart Flow stays in
place; Exit returns to the selector.

## Collaboration

Use `.claude/skills/` for ordinary start-work, sync, ship, publish, compare-local,
create-flow and pre-pr-review requests; follow [workflow](docs/workflow.md). Preserve dirty files
and local-only commits. Start readable task branches from verified current main;
sync by merging, never rebase or force push. Stage specific paths and keep
`branching.md` untracked. Ship through a reviewed PR, passing checks and applicable
PM verification. Publication is a separate explicit request; a main merge never
deploys. Report observed outcomes, not assumed remote success.

Session instructions take precedence over workflow defaults. The organization rollout permits task-branch pushes, PR creation and CI verification; merge, repository settings and publication require separate authorization.
Repository cutover is complete. Keep `demo` as a historical fallback and PM/HoffDemo branches untouched; never restore editable `versions/` copies.

Search `app/` unless the task is about a Flow; then target `flows/<id>/` and its
scoped tooling. Never open or print `*/data/zip-cost-of-living.*`, in `app/` or
any `flows/<id>/`. Use filename-only searches (`rg -l`) or exclude those files
(`rg --glob '!zip-cost-of-living.*'`). Do not search `.worktrees/` or include it
in artifacts. Do not add a root `.ignore` that hides legitimate source files.

## Required guidance

Agents maintain technical health in the areas they touch; PMs decide product
behavior. At intake and before handoff, follow the relevant sections of
[code health](docs/code-health.md). Keep documentation inexpensive to read: link
to authoritative rules and load only the sections needed for the task.

Before changing app or Flow implementation, read
[app contracts](docs/app-contracts.md#hard-rules) and the relevant
[architecture sections](app/docs/architecture.md) or Flow contracts.
They own JS/state/render conventions, generated wrappers and mirrored Flow shells.
No backend, localStorage, live LLM or runtime API keys. Release-controlled Useberry
on HTTP(S) is the narrow telemetry exception; development tracking stays off.
Session storage holds only tab reviewer settings (unlock, selector tab, refresh
pin, comparison layout), never participant data.

`app/` is one product: never add journey switches. A focused, shortened or reordered
journey is a Flow, made with create-flow; see [one product](docs/app-contracts.md#one-product-no-journey-switches).
Preserve the [budget seam and approved ESF exception](docs/app-contracts.md#esf-budget-exception-user-approved).
Flow tasks follow [Flows](docs/flows.md), run
`python3 scripts/flows.py scope --scope flow` and leave `app/` bytes unchanged.
Product integration uses `--scope app-integration`, selectively ports approved
behavior and requires PM full-app verification before the PR. A Flow merge neither
approves its proposal nor publishes it.

Explain decisions in product terms. Record scope and validation in PR text.
Repeat affected checks after material changes. Run every automated check with
`bash scripts/check-all.sh`; BLOCKED is not a pass. Never claim an unavailable
runtime, browser or platform check passed. Follow [testing](docs/testing.md).

## Project map and references

| Read when | File |
|---|---|
| Maintaining touched code, documentation or checks | [code health](docs/code-health.md) |
| Starting, syncing, shipping, browser PR handoff | [workflow](docs/workflow.md) |
| Cold review of finished task work before a PR | [pre-PR review](docs/pre-pr-review.md), [pre-pr-review](.claude/skills/pre-pr-review/SKILL.md) |
| Preparing a snapshot, selector change or deployment | [publishing](docs/publishing.md) |
| Changing app behavior | [app contracts](docs/app-contracts.md), [architecture](app/docs/architecture.md) |
| Resolving product requirements or L##/D## IDs | [decisions](docs/decisions.md) |
| Testing | [testing](docs/testing.md) |
| Tracking and participant URLs | [Useberry](app/docs/useberry.md) |
| Creating/editing/checking Flows or integrating proposals | [Flows](docs/flows.md), [create-flow](.claude/skills/create-flow/SKILL.md) |
| Comparing local variants of the app or one Flow | [local variants](docs/local-variants.md) |
| Future product work | [future work](docs/future-work.md) |
