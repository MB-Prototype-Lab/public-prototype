---
name: ship
description: Prepare and ship tested MoneyBuddy task work through a reviewed squash PR when asked to ship.
---

Review scope, sync and test, prepare PR text and applicable PM checklist. Review the `app/` diff with the journey-switch review questions in docs/app-contracts.md ("One product: no journey switches") and record the result in the PR text. With authorized remote writes use CLI or the complete browser procedure. Confirm CI, current base and PM signoff before squash merge; confirm merge before safe cleanup. Merge and publication need explicit authorization.

Read [the shared workflow](../../../docs/workflow.md) before acting. All paths in
that document are relative to the repository root. Remote actions follow the
[authorization boundary](../../../CLAUDE.md#collaboration). Report observed results,
not assumed remote success.

For a Flow task, read [Flows](../../../docs/flows.md), run
`python3 scripts/flows.py scope --scope flow` after syncing main, and run all Flow
plus existing app, publication and browser checks. A Flow PR shares a
proposal without product approval or publication. For app-integration, obtain PM
verification of the integrated full app before opening the PR; repeat affected
verification after material changes.
