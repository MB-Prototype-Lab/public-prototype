---
name: create-flow
description: Create or revise a contained MoneyBuddy Flow, a focused, shortened or reordered journey for a study, demo or feature review. Use for requests such as make a Flow for the savings goal, make a version that only shows the emergency fund, skip or shorten onboarding, start at the calculator, hide the other tabs, or change the Emergency fund Flow. Never build these as flags or modes in app/.
---

A request to narrow, shorten, reorder or start the prototype somewhere else is a
Flow. `app/` stays the one full product: never add a flag, mode, config value or URL
switch there for it (see [one product](../../../docs/app-contracts.md#one-product-no-journey-switches)).
Explain this in product terms: the full app is unchanged, and the Flow appears on
the selector's Flows tab beside it.

Read [Flows](../../../docs/flows.md) and [the shared workflow](../../../docs/workflow.md)
before acting. All paths in those documents are relative to the repository root.
Preserve the current session’s authorization boundary in CLAUDE.md; branch/PR/CI
authorization does not authorize merge, settings changes or publication. Report
observed results, not assumed remote success.

Settle the journey before creating anything. Ask the PM only about what is unclear,
offering defaults from the existing Flows: its name and one-line purpose, where it
starts, which features and screens it includes, where it ends, and which setup
questions it asks (or none, with the default profile).

Use start-work for a Flow-scoped task; `python3 scripts/flows.py scope --scope flow`
finds its base from main, and `task_base` in flow.json is provenance only. Create from a
committed full-app commit with `python3 scripts/flows.py create`, then follow
“Configure the journey” in Flows, using `flows/emergency-fund` and
`flows/big-purchase` as references. Work only in `flows/<id>/`, the generated
catalog and Flow tests; app bytes stay unchanged. Run the Flow checks; a check whose
engine is missing is blocked, never passed.

Hand off with the exact output of `python3 scripts/local-variants.py url` in a code
block: the PM enters 1337, opens the Flows tab and chooses the new Flow. Say what to
try and how it differs from the full app. Offer variants of it through compare-local
(`create --flow <id>`). Shipping uses ship; publishing a snapshot and integrating
chosen behavior into `app/` are separate requests.

To revise an existing Flow, edit only its package, keep `source_app_commit`, and
update `proposed_differences` and its `docs/flow.md`. Routine Flow work needs no
subagents.
