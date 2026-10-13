# Flows implementation contracts

Checkpoint: 2026-10-11. Approved plan: [flows-plan.md](flows-plan.md).
Source app revision: `8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`. Full committed app inventory is
[flows-baseline.json](flows-baseline.json). This source predates flag cleanup.

## Authoritative metadata and commands

Each package owns `flow.json` (schema 1) and deterministic `flow-config.js`, which
sets `window.MB_FLOW` before application scripts choose setup or seed navigation.
Required metadata: `schema`, `id`, `label`, `purpose`, `reference` (string or null),
`source_app_commit` (full SHA), `task_base` (full SHA), `entry` (screen ID),
`completion` (screen ID), `allowed_screens` (unique IDs), `setup_steps` (ordered
source onboarding step names), `profile_behavior` (documented string),
`proposed_differences` (array of strings). IDs use lowercase kebab-case.
`flows/catalog.json` schema 1 contains `flows` entries derived from package metadata:
`id`, `label`, `description` (purpose), `path` (`flows/<id>/index.html`). Its wrapper
`flows/catalog.js` sets `window.MB_FLOWS`; local selector loads it without fetch.
Generated wrappers are verified byte-for-byte by checker. Catalog is discovery,
never publication identity or product approval.

`scripts/flows.py create --id ID --source FULL_SHA --label LABEL --purpose TEXT`
exports committed static app files to a temporary sibling; refuses unsafe source,
existing paths, links and partial writes; validates before atomic install and
catalog regeneration. Initial generated metadata starts a contained onboarding
package; concrete Flow edits supply precise allowlists and setup afterward.
`catalog` regenerates metadata wrappers/catalog; `check [--id ID]` validates all
packages or the selected package plus shared catalog; `scope --base FULL_SHA
--scope flow|app-integration` rejects app changes for ordinary Flow work.
Creation records HEAD as task_base; scope may infer this only for an unambiguous
single ID. Tooling never writes app. Command errors must explain recovery.

## Runtime interfaces

Package-local `js/flow.js` supplies feature-prefixed containment and fresh boot
behavior. Load policy before app config/state and load runtime hooks before the
navigation boot. Adapt copied navigation/render/onboarding explicitly as needed;
no runtime imports from mutable app or another Flow. Exact screen prerequisites
belong beside runtime policy checks. Guard every navigation path, restored stacks,
and render dispatch. Policy is active before first seed; startup and refresh use
canonical entry even when a screen query is present. Participant parameters survive
HTTP URL writes and restart; parse profile parameters on file URLs too, once at
boot. Keep reviewed existing start functions, calculations and state ownership.
No arbitrary admin jump surface; reviewer controls and themes stay contained.
Reviewer Tools is outside the phone, collapsed at every boot (including snapshots),
and uses an explicit current-screen/prerequisite dispatcher. Reading or toggling
it cannot initialize features or change answers. The page shell uses the full
app’s layout unchanged: the phone, the fixed 28×48px **›** at the phone’s top edge
and the panel occupy exactly the full app’s positions, beside the phone on desktop
and below it at 769–900px. Like the full app, phone widths (768px and below) offer
no Tools. Its accessible name is **Tools**; opening hides it, and **‹** (Close Tools)
reveals it and restores focus. Both controls inherit the full app’s styling.
The phone preserves source contextual navigation without a universal toolbar.
A package-owned Restart clears all session state by a fresh document load; Exit
uses frozen MB_RELEASE selector or local ../../index.html. Full app is unchanged
until both package baselines exist and explicit flag cleanup starts.

## Publication interfaces and ownership

Publication format `flow-static-v1` uses existing catalog schema/immutable fields,
`source_dir=flows/<id>` and `public_path=versions/<publication-id>/index.html`.
Infer Flow kind/id from validated format/source_dir. Keep legacy-v1 and static-v1
bytes/semantics unchanged. Flow packaging excludes authoring flow.json but includes
flow-config.js/runtime, freezes release-config.js, validates package dependencies,
and retires every HTML entry. `prepare --flow ID` selects a committed Flow package.
No actual catalog rows, tags, deployment or publication are needed in this task.

Foundation worker owns scripts/flows.py, tests/test_flows.py, tests/flows-selector.cjs,
gate/flows.js, local selector section in index.html, flows/catalog.*, and flow CI
entries. Flow worker owns flows/<id>/ plus tests/flows-runtime.cjs and relevant
behavior tests. Publication worker exclusively owns scripts/publish.py and focused
publication tests until integrated. Cleanup/docs work is serialized after packages
exist. Lead owns this contract, baseline, handoff and integration review.
