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

### Publication checkpoint

Contract/baseline checkpoint committed as `b5478e5`. Publication code/test checkpoint
`5725c10` adds `flow-static-v1` without changing real publication records. All 27
publication tests (16 existing and 11 new), real historical catalog digest checks,
Python compilation and whitespace checks passed. ARM Node executed tracking URL
resistance checks. This checkpoint depends on the foundation validator currently
being finalized in the working tree.

Foundation created `flows/emergency-fund` from recorded app source, with task base
`b5478e5`; seven negative foundation tests and real-source create/check passed.
The starter is authoring scaffolding, not a completed participant Flow. A Sol
worker now owns its actual ESF implementation and runtime tests; final foundation
hardening and syntax checks continue separately. No app cleanup has begun.

### Resume after usage-window limit — 2026-10-12

User requested resume after reset. Fetch confirmed origin/main still `8f7b142`;
branch HEAD remains `5725c10` with both checkpoint commits local, and all unfinished
work preserved. Foundation and ESF workers resumed their bounded assignments.
Contrary to the earlier coarse checkpoint, partial ESF policy/runtime/onboarding
edits had reached disk before the interruption; they are being completed, not
recreated. Runtime acceptance tests were not yet present and remain required.
Foundation's final staged-entry rejection test is still pending. No app changes,
remote writes, PR, merge or publication have occurred.

### ESF containment proof and full-app cleanup checkpoints

- Foundation committed `52cb489`: eight negative tooling tests and eleven focused
  publication tests pass; staged malformed entry is rejected before installation.
- Current operating docs/runbooks committed `09fdbba`; active cutover instructions
  now reflect completed cutover, retaining historical identities and fallback refs.
- Emergency Fund package committed `19864f7`. Actual-script VM coverage includes
  file/HTTP setup, defaults/Skip/Back, help, Buddy estimate application, planning,
  repeated saves, budget replacement, reopen, forbidden navigation/history/render,
  state prerequisites, themes, restart and participant parameters.
- Root's Linux Chromium browser checks passed file URLs in a copied path with
  spaces and local HTTP: real setup inputs/clicks, keyboard focus/Tab, first-expense
  Back/Skip answers, all four themes/narrow width, loaded fund image, planner typed
  balance/date, save/reopen/repeat save, refresh/restart/Exit, tracking off and
  participant parameters. Windows/WSL and macOS and PM acceptance remain pending.
- Actual browser testing exposed inherited ZIP keypad change-event recursion. It
  is fixed only in Flow copies with an event-sequence regression, documented as a
  proposed difference. Full-app cleanup does not adopt this unrelated behavior.
- Big Purchase baseline was created from the same original `8f7b142` source before
  app cleanup; its full implementation is now in progress.
- Full-app flag cleanup committed `5c6f329`: only four app files differ from the
  captured baseline (config, onboarding, topbar, esf-build), with no new app files.
  Syntax 124, sweep 254 checks/zero failures/two existing warnings, app structure
  and path checks passed. Path checker now includes present Flow packages.
- Current work remains BP runtime/branches and tests, combined checks, actual
  publication rehearsals/size evidence, and PM handoff. No PR or remote action.

### Final implementation and local verification — 2026-10-12

- Resumed the existing dirty implementation without recreating packages. Fresh
  fetch confirmed main remained `8f7b142`; unrelated branches and local alternatives
  remain untouched. One GPT-6.1 Sol worker completed the preserved BP work.
- Scope hardening checkpoint `663a908` rejects staged app edits even if the
  worktree matches the baseline; its negative regression passes.
- Package/test checkpoint `17bc494` completes Big Purchase, discovery catalog and
  both actual-script/runtime and optional browser harnesses. BP owns its bundled
  ESF. Before-purchase and after-save detours retain distinct callers; the actual
  Your car screen now offers deferred Save and start emergency fund, preserving
  no-goal/repeat-save semantics. Package docs enumerate source routes and changes.
- All required docs/testing.md checks pass: app syntax 124, Flow syntax 247, app
  sweep 254/zero failures, Python 63, paths, release/runtime, local alternatives,
  selector, both Flow journeys/negative routes, package boundaries, explicit
  app-integration scope and historical publication catalog/digests. Final sweep's
  two preexisting warnings are unreferenced functions and five dark-film fallbacks,
  correcting the earlier coarse owner/browser-warning description.
- Linux Chromium 153 verified both Flows using real file URLs in copied paths with
  spaces and local HTTP: setup/back/skip, four themes/narrow layouts, inputs/focus,
  selected media, ordinary/repeated saves, both BP fund branches with preserved
  car inputs, loan/cash/lease, fresh lifecycle, parameters and tracking off.
- Two committed offline publication rehearsals passed in a disposable clone,
  using both real selected Flow packages and the first build's previous manifest.
  Both outputs are byte-identical: 960 files, 77,351,508 bytes (below 800 MB ceiling).
  Source checkpoint `17bc494`; fixture commit `2229c2c` exists only in that clone.
  Full sizes/evidence are in docs/flows-verification.md. Real catalog/tags unchanged.
- Immutable-artifact HTTP smoke passed both snapshots: canonical cold boot, Skip,
  loaded media, frozen tracking despite opposing parameters, participant-preserving
  refresh/Restart, and Exit to artifact selector. All external requests were
  intercepted/aborted; no telemetry was sent. No page errors occurred.
- Baseline digest comparison confirms only the four approved app flag-cleanup
  files changed, with no added/deleted app files. Source lacks a distinct
  already-owned-car journey; actual known-model/new/used paths are retained and
  tested, with that limitation explicitly recorded for PM review.
- Remaining: PM product/visual acceptance, Windows/WSL and macOS file-with-spaces
  browser checks. PR must wait for PM verification. Authorized task-branch push is
  a separate observed milestone; no merge, repository settings, tags or publication
  are authorized. Nothing has been deployed or live-verified by this work.


### Reviewer-tools correction — 2026-10-12

- Resumed this branch at `d9faeb3`; current main remained `8f7b142` after fetch.
  No subagents. Correction checkpoint `b7663e8` restores the source participant
  presentation and replaces the in-phone toolbar with a collapsed outside-phone
  Tools panel. Its explicit dispatcher retains only audited current-screen
  controls with valid state; setup, Goals, simulations and copied state are scoped.
- Tools opening/closing/reading leaves participant answers and sessions alone;
  Close restores focus. Desktop expands alongside the unchanged-size phone,
  narrow screens below it. Creation templates follow the same arrangement and
  expose only safe onboarding controls for generic starters.
- Required repository checks pass, including 63 Python tests, app syntax 124,
  Flow syntax 249 and sweep 254/zero failures/two existing warnings. Both packages
  pass file-with-spaces and HTTP browser checks, every restored interactive tool,
  320px through desktop layouts, four themes, actual participant Back, repeat
  saves and both BP fund branches. Local deterministic snapshot builds and both
  exported-package HTTP smoke checks pass. Full evidence and byte counts are in
  docs/flows-verification.md. `/app`, historical snapshots and publication records
  are unchanged by the correction.
- PM must repeat affected acceptance on `b7663e8` before opening the implementation
  PR. Windows/WSL and macOS remain unverified. Keep the PR unopened; merging,
  settings changes and publication remain outside authorization. No deployment.


### Expand-button match — 2026-10-13

- Implementation checkpoint `1cca55c`, change base `021d4061c01b0a935c05ea2772e69d045ebff72d`.
  Both packages and the creation adapter use the full app’s 28×48px **›** button
  with accessible name Tools. Opening hides it; Close reveals it and restores focus.
  Outside-phone placement and narrow availability remain intact.
- Required checks pass, including all 63 Python tests and Flow scope. Linux
  Chromium verifies normal/hover style parity in four themes, Enter/Space,
  hidden-while-open, focus, phone sizing and overflow across desktop/narrow widths.
  Both Flows, generated starters and exported snapshots pass file-with-spaces and
  HTTP checks. Deterministic exports and frozen tracking pass. Full evidence is in
  `docs/flows-verification.md`; app and publication records are unchanged from base.
- Repeat affected PM visual acceptance on `1cca55c` before opening the PR.
  Windows/WSL and macOS acceptance remain pending. Merge and publication require
  separate authorization.
