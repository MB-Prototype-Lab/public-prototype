# Code health in ordinary work

Agents own technical health in the areas they touch. PMs decide product behavior;
explain consequences in product terms and recommend a course of action when a
decision is needed. Read only the sections below that apply to the task.

## Changing implementation

At intake, identify the intended behavior and package. For app code, read the
relevant [app contracts](app-contracts.md),
[architecture sections](../app/docs/architecture.md) and feature specification
from the [reference map](../CLAUDE.md#project-map-and-references).
For a Flow, read [its operating guide](flows.md#edit-and-check) and package's
`docs/flow.md` instead of assuming it matches the current app. For tooling, read
its specialist contract, such as [testing](testing.md#changing-verification) for
check changes or [publishing](publishing.md) for packaging changes.

Inspect actual callers, state ownership, generated dependencies and Flow copies
before editing. Fix verified technical issues related to the task when participant
behavior is preserved. Report unrelated findings without expanding the task.
Check affected code for stale names, unused state, duplicated rules, misleading
Tools controls and incomplete reset behavior. Use names that describe the current
purpose; comments should explain reasons and constraints rather than narrate code.

Keep intended feature changes distinct from cleanup. Unexpected participant,
tracking or journey differences need an explanation and a PM decision before
adoption. Use the [journey-switch review](app-contracts.md#one-product-no-journey-switches)
and preserve the [ESF budget exception](app-contracts.md#esf-budget-exception-user-approved).
Follow the existing [runtime and code rules](app-contracts.md#hard-rules), including
Flow shell parity and generated wrappers.

## Removing or renaming code

Read this section in addition to Changing implementation. Prove reachability from
ordinary calls, inline handlers (including `index.html`), dispatch tables and Tools;
inspect Flow usage separately. A search for `name(` alone cannot establish that
code is unused. The [dead-code rules](app-contracts.md#hard-rules) describe the sweep's
role and limits. Remove verified dead code together with dependencies used only by
it; preserve shared dependencies and deliberately retained Flow copies.

Trace state reads, writes, defaults and reset paths before deleting a field. Update
callers, controls and documentation when renaming. Preserve verification coverage;
follow [verification changes](testing.md#changing-verification) for journey wiring,
tracking names, aliases or normalization changes.

## Editing documentation

Read this section when changing guidance, contracts or skills. Keep each rule in
one authoritative home and link to it from task entrypoints. Make required reading
conditional on the work, so an ordinary request does not load every document.
Keep touched documentation accurate: remove obsolete explanations within scope
instead of accumulating historical annotations. Preserve current decisions and
their stable L##/D## IDs in [decisions](decisions.md).

Use **variants** in PM-facing descriptions of local alternatives, following
[local variants](local-variants.md); retain exact command and internal identifiers
where needed. Follow the [commit convention](workflow.md#ship). Validate local
Markdown links with `python3 scripts/check-markdown-links.py`; validate edited
skills with the skill-authoring validator.

## Changing verification

Read [Changing verification](testing.md#changing-verification) when modifying
checks, fixtures, journeys or comparison rules. It owns the evidence requirements.
Use the rest of [testing](testing.md) for the checks relevant to the package and
behavior affected.

## Before handoff

Revisit the relevant sections above against the final diff. Verify related cleanup
preserves participant behavior, documentation routes correctly and affected checks
were repeated after material changes. Record maintenance performed, verification
evidence and unresolved limitations briefly in the PR using the
[shared workflow](workflow.md#ship) and [template](../.github/pull_request_template.md).
Keep the machine-read Phone/Tools/Wiring declarations intact.
