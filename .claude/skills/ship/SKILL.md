---
name: ship
description: Prepare and ship tested MoneyBuddy task work through a reviewed squash PR when asked to ship.
---

Review scope, sync and test, prepare PR text and applicable PM checklist. Review the `app/` diff with the journey-switch review questions in docs/app-contracts.md ("One product: no journey switches") and record the result in the PR text. With authorized remote writes use CLI or the complete browser procedure. Confirm CI, current base and PM signoff before squash merge; confirm merge before safe cleanup. Merge and publication need explicit authorization.

Read [the shared workflow](../../../docs/workflow.md) before acting. All paths in
that document are relative to the repository root. Remote actions follow the
[authorization boundary](../../../CLAUDE.md#collaboration). Report observed results,
not assumed remote success.

Before handoff, complete the [maintenance review](../../../docs/code-health.md#before-handoff)
and include maintenance, verification evidence and unresolved limitations in PR text.

When the PM asks for a cold review of finished work before a PR, use
[pre-pr-review](../pre-pr-review/SKILL.md) and its
[procedure](../../../docs/pre-pr-review.md).

At ship intake, always discover persisted reviews with
`python3 scripts/pre-pr-review.py status --json`, resolving IDs for the current task
from disk rather than chat memory. Follow its
[ship handoff](../../../docs/pre-pr-review.md#ship-handoff) for eligible cleanup,
fixes, checkpoint, both comparisons, findings, decisions and limitations; report
incomplete/stale evidence. Local review does not replace ship's sync, current-main
comparisons, CI or applicable PM verification; do not force it on ordinary ship.
Changes to this workflow require
[native Windows desktop-agent acceptance](../../../docs/pre-pr-review-platform-acceptance.md)
before merge.

For a Flow task, read [Flows](../../../docs/flows.md), run
`python3 scripts/flows.py scope --scope flow` after syncing main, and run all Flow
plus existing app, publication and browser checks. A Flow PR shares a
proposal without product approval or publication. For app-integration, obtain PM
verification of the integrated full app before opening the PR; repeat affected
verification after material changes.
