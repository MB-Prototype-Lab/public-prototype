---
name: ship
description: Prepare and ship tested MoneyBuddy task work through a reviewed squash PR when asked to ship.
---

Review scope, sync and test, prepare PR text and applicable PM checklist. With authorized remote writes use CLI or the complete browser procedure. Confirm CI, current base and PM signoff before squash merge; confirm merge before safe cleanup. Shipping never publishes.

Read [the shared workflow](../../../docs/workflow.md) before acting. All paths in
that document are relative to the repository root. Preserve the current session’s
authorization boundary in CLAUDE.md; branch/PR/CI authorization does not authorize
merge, settings changes or publication. Report observed results, not assumed remote success.

For a Flow task, read [Flows](../../../docs/flows.md), check its recorded task-base
scope and run all Flow plus existing app/publication checks. A Flow PR shares a
proposal without product approval or publication. For app-integration, obtain PM
verification of the integrated full app before opening the PR; repeat affected
verification after material changes. Merge still requires separate authorization.
