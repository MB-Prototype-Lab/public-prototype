# Flows implementation — laptop handoff

Prepared 2026-10-11. Read [the approved plan](flows-plan.md) in full.

## State at transfer

- Repository: `MB-Prototype-Lab/public-prototype`.
- Implementation branch: `work/flows-20261011`.
- Verified source main: `8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`.
- Only the plan and this handoff have been added. No implementation, app changes,
  new Flows, publication records, PR, deployment or runtime verification yet.
- The planning branch was `work/flows-plan-20261011`; the implementation branch
  carries the approved plan. Resume the implementation branch.
- Documentation received whitespace/link checks only. Run applicable implementation
  checks as work is completed; do not treat research as behavior verification.
- No desktop-only files, credentials, environment configuration or comparison
  artifacts are required for this task. Existing desktop alternatives are unrelated
  and are intentionally excluded. Use the laptop's own authenticated Git setup.

## User decisions and authorization

The user approved the plan and requested Astra to lead a fresh implementation
session, delegating bounded work to GPT-6.1 Sol to manage usage. Flow refresh
restarts the same Flow; full-app refresh continues returning to the selector.
Do not repeat plan approval. Begin implementation after inspecting the laptop
checkout and resuming this branch safely.

The repository cutover is complete and no more blue/green migrations are intended.
Some current instructions still say cutover is pending; the user's current decision
supersedes those statements. Updating operating docs is part of the plan, while
historical artifacts, PM branches and old publication identities remain preserved.

The user authorized creating/pushing this task branch for transfer. Existing project
permissions permit task-branch pushes, PR creation and CI verification. Preserve
the plan's PM verification before opening the implementation PR. Merge, repository
settings changes and publication still require separate authorization.

## First actions on the laptop

1. Read AGENTS.md, CLAUDE.md and the start-work skill. Inspect dirty files, current
   branch, local-only commits and remote configuration before switching branches.
   Preserve unrelated work; never silently stash, reset or overwrite it.
2. Fetch origin. Resume `work/flows-20261011`, tracking the corresponding remote
   branch. If already present locally, inspect divergence before updating. If main
   advanced, follow the sync procedure and merge deliberately; never rebase or
   force push. Do not create a second implementation branch without a reason.
3. Read docs/flows-plan.md and the reference files it names. Start at the Astra
   contract checkpoint: settle exact metadata/tool interfaces and ownership before
   delegating foundation work. No work package has already been implemented.
4. Use Astra as coordinator/reviewer and `gpt-6.1-sol` for implementation workers
   when available. Supply focused context and file ownership. One worker normally,
   at most two with disjoint writes. Workers do not switch branches or push.
   If the client requires a fresh-context spawn to select a different model, use
   that mode and pass the plan path, task scope, interfaces and acceptance checks.
5. Persist checkpoints, tests actually run, remaining risks and authorization in
   this handoff as implementation progresses. The Plus usage window is a reason to
   preserve progress, not to omit required checks or claim partial work is complete.

If the requested model is unavailable, report that limitation before substituting
the lead/delegation arrangement. The user can select Astra in the client; a prompt
alone does not switch the root session's model.

## Implementation ordering

Contracts → foundation and local discovery → ESF containment proof → BP with its
bundled ESF → publication integration → dormant app-flag removal and runbooks →
combined checks and PM verification. Publication work may overlap Flow work once
contracts settle and file ownership is exclusive. Details and acceptance criteria
are in the approved plan; avoid reconstructing them from historical flag comments.

## Implementation checkpoint — contracts and foundation in progress

- Laptop resumed `work/flows-20261011` clean at `6bdefcf`; fetched source main
  remains `8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`.
- Astra coordination is active with bounded GPT-6.1 Sol workers. Exact interfaces
  and ownership are in [flows-contract.md](flows-contract.md); committed app
  SHA-256 baseline inventory is [flows-baseline.json](flows-baseline.json).
- Foundation worker owns create/check/scope/catalog tooling, safe local selector
  discovery and focused tests/CI entries. Generic creation starts with an
  onboarding-only contained policy; concrete packages expand it deliberately.
- Publication worker concurrently owns only publication packaging and focused
  tests. No catalog rows/tags/publication are being created.
- Root ran baseline syntax (123 JS files), path, release-runtime and
  local-variants checks successfully using Node 22.23.3 arm64 from `/tmp`.
  Baseline sweep passed: 253 checks, zero failures and two existing warnings
  for owner/browser checks.
- App bytes remain unchanged; Flow packages have not yet been created. Next:
  foundation review, ESF containment proof, BP bundled ESF, then flag cleanup/docs
  and combined runtime/publication checks. PM/platform verification remains open.
- Authorization is unchanged: branch pushes/CI permitted; wait for PM verification
  before the implementation PR. No merge, settings change or publication.
