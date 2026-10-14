# Contained Flows — implementation plan

Status: approved by the user on 2026-10-11, including the Astra/Sol 6.1 delegation
and Flow refresh defaults. Implementation and local verification are complete;
PM/platform acceptance remains pending. See [verification](flows-verification.md)
and [the handoff](flows-handoff.md). Prepared against fetched main
`8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`.

## Outcome and accepted decisions

The approved full product remains in `/app`. Independently editable, contained
experiences live in sibling `/flows/<id>/` directories. A Flow begins as a subset
of the app and may develop proposed product changes during PM iteration. Merging
a Flow into main makes that proposal available to the team; it does not approve
or integrate its changes into the product. Publication is another explicit action.

Flows primarily serve local PM work, design references attached to tickets, and
user studies. They must work by opening HTML directly and through GitHub Pages.
The root selector makes them discoverable without requiring PMs to edit flags,
run commands, or understand publication machinery. Agents handle those operations.

Containment is the default. Screens may be absent or inaccessible, and buttons
may be hidden or disabled. Branches and additional tools are explicitly included.
Big Purchase bundles its own required emergency-fund experience; it never enables
another Flow or depends on a combination of journey switches.

The repository cutover is complete. Update current operating instructions to
reflect that fact; do not build another blue/green migration mechanism. Preserve
existing historical publications, provenance, tags, fallback branches and PM work.
Changing those artifacts or deleting old branches is outside this task.

## Approved defaults

- First IDs: `emergency-fund` and `big-purchase`.
- Each Flow owns a standalone static package, including its code, data, styles
  and assets. No runtime imports from `/app`, another Flow, or mutable shared
  directories. Copying an asset is preferable to an implicit live dependency.
- Initially copy the static app package from a recorded committed revision and
  adapt it. Unused files may remain when removing them would risk hidden
  dependencies; participant reachability is constrained independently. Do not
  build an automatic JavaScript dependency slicer for this first release.
- Hide unrelated tabs in both initial Flows. Disabled controls are reserved for
  deliberately retained product context and clearly do nothing.
- Flow refresh and Restart begin the same Flow again with fresh state. Full-app
  refresh continues returning to the selector. Exiting a Flow is explicit.
- Participant mode exposes no arbitrary admin jumps. Local reviewer tools may
  be available, but their destinations stay within the Flow. No query parameter
  or UI toggle unlocks excluded product screens.
- Initial tooling supports create, inspect/check, local discovery and publication
  preparation. Adoption into `/app` is an agent-guided integration with a runbook,
  not an automatic overwrite or whole-folder merge.

Approval includes these defaults. Record any subsequently approved scope changes
in this plan so a fresh session has the same requirements.

## Source model and boundaries

Suggested layout:

```text
app/                         approved product
flows/
  catalog.json               committed local discovery metadata
  catalog.js                 generated script wrapper for file://
  emergency-fund/
    flow.json                provenance, purpose and containment contract
    index.html
    release-config.js        development tracking off
    js/ screens/ components/ css/ data/ assets/
  big-purchase/
    ...
docs/flows.md                PM and agent operating procedure
scripts/flows.py             create/check/catalog generation and scope checks
```

Finalize exact filenames at the contract checkpoint below. Keep one authoritative
metadata source per concern; generated JS wrappers must be verified against JSON.
Do not load metadata with fetch when opening local HTML. Any runtime policy
derived from flow.json must have a deterministic script wrapper too.

Metadata includes schema version, stable ID, label, purpose, optional ticket/spec
reference, source app commit, entry and completion destinations, allowed screens,
setup steps, sample/default-profile behavior, and documented proposed differences.
Publication identity is separate: it identifies an immutable revision of a Flow.
Avoid manual approval booleans that imply product signoff; record actual review
evidence and the commit reviewed in the workflow/PR.

Flow creation exports only the committed static `/app` package from an explicit
source revision, excluding docs, hidden files, untracked files and worktrees.
Refuse an existing destination, unsafe IDs, symlinks and partial overwrite. Produce
in a temporary location, validate, then install the completed directory and update
discovery metadata. Failed creation must leave the previous selector usable.
Uncommitted app changes are not silently copied; preserve them and explain how to
checkpoint an intended source. A newly created Flow starts untracked by telemetry.

The local catalog lists Flows present in the checkout, including new work not yet
committed. Agents regenerate it as part of create/edit operations. Merging the
catalog may require combining entries; validate unique IDs and paths afterward.
Do not conflate Flow discovery with the existing local-alternative workspace.
Existing side-by-side alternatives must continue working; adding Flow comparisons
to that workspace is outside the initial scope.

Enforce boundaries in tooling and CI:

- Resolve local dependencies inside each package; reject cross-app, cross-Flow,
  absolute filesystem, symlink and traversal dependencies. Explicit selector exit
  navigation is an exception, not a license for cross-package asset loading.
- Check literal HTML/CSS paths and dynamic asset conventions used by the app;
  runtime smoke checks cover selected media and JS-created URLs as well.
- A scope checker/runbook command compares a Flow task with its recorded task
  base and fails on unexpected `/app` changes. Flow tooling itself never writes
  `/app`. Legitimate app integration explicitly uses an app-integration scope.
- CI always validates all committed Flow metadata, script syntax, package
  boundaries and entry points. Changed Flows receive behavioral tests. Existing
  app/publication checks remain required; do not quietly narrow their coverage.

These checks catch accidental boundary violations. They do not claim that a static
prototype can prevent someone from deliberately modifying it through browser tools.

## Containment and navigation contract

Each Flow specifies its reachable screens and necessary transitions. Initialize
the Flow identity/policy before choosing onboarding steps or seeding navigation.
Use normal feature start functions so dependent state exists before rendering.

Guard navigation, tab selection, deep links, admin jumps, browser-history restores
and the final rendering boundary. A forbidden destination cannot render or enter
history; a malformed/unsupported cold link starts the Flow safely. An allowed
screen still needs valid state: reject/restart a cold link that lacks required
prerequisites rather than showing a blank or invented mid-session result.

Back never exposes the full app beneath the Flow's stack. At the Flow's starting
screen it stays there; a separate Exit returns to the selector. Browser Back can
leave the document normally, but restoring a history entry cannot restore an
excluded in-app screen. Validate custom screen buttons as well as shared top bars.

Restart clears feature state, inputs, transient media and session-specific trail
data. Refresh restarts at the canonical Flow entry rather than treating the last
recorded `screen` URL as sufficient state. Preserve participant query parameters;
do not reapply a recorded profile over participant answers during navigation.
Parse entry parameters on file:// independently of HTTP-only URL rewriting.

Keep screen URLs and control identifiers useful for studies. The Flow's package
path identifies the experience; screen slugs identify progress within it. Direct
study links bypass selector/passcode, as current app snapshot links do. Local
tracking stays off; published tracking is fixed by the release configuration and
cannot be enabled by participant parameters. The selector is not a security gate.

## Initial Flow: Emergency Savings Fund

Entry: ZIP → income → household → home type → coverage → daily driving.
Then expense building → fund planning → save → constrained Goals.

Include expense help and the ESF Buddy question tree, relevant explanations,
coverage/buffer/starting-balance/date controls, and reopening/editing the saved
fund. Preserve existing calculations, fallback profiles and the approved immediate
budget replacement when saving, including repeat-save behavior. Budget data may be
updated internally while Budget screens remain inaccessible.

Constrained Goals displays the emergency fund and its relevant entry/edit actions.
Hide unrelated seeded goals, purchase cards, general navigation and unrelated
settings/actions. Permit only needed overlays and help screens. Skip setup goes
directly to the fund with explicit existing default-profile semantics; answered
fields continue to win. Back from the first expense step returns to setup, with
return/answer behavior documented and tested against the existing flow.

Acceptance: complete and skipped setup work; expense help applies correctly;
saving and repeat saving produce exactly one emergency goal and correct budget;
reopen preserves the session figures; no route exposes excluded product screens.

## Initial Flow: Big Purchase

Entry: ZIP → income → daily driving → purchase landing. Preserve the current
docked/tap-to-advance behavior for applicable setup questions and return to the
previous setup question from the purchase landing with answers intact.

Include the implemented vehicle journey: finder/selection, relevant quiz/help,
owned-car path, cost comparison, financing/lease choices, and purchase planning.
The implementer enumerates the actual required screen IDs and controls from the
source, including overlays, before fixing the allowlist. Unsupported categories
remain disabled or hidden; this work adds no new purchase categories.

Bundle the required ESF expense builder, Buddy help, fund planning, and relevant
Goals surfaces inside this package. Include both existing branches: start a fund
before the purchase and start a fund after saving the purchase plan. Do not link
to the standalone emergency-fund Flow or insert its six-question onboarding.
Use existing profile answers/fallback assumptions; adding questions is a product
change requiring review, not an inferred prerequisite.

After the ESF detour, constrained Goals offers the existing Back to your car
action and resumes the same purchase session. Back from the start of that detour
returns to its caller. Audit the after-save branch separately so it does not
accidentally inherit the before-purchase return path.

Purchase save preserves the existing at-most-one purchase-saving goal behavior
and does not write the budget. An included ESF save retains its own budget effect.
Include purchase reminders only with coherent actions inside the Flow: a control
that would open general Budget must be disabled/hidden, with no dangling route.

Acceptance: ordinary purchase completion, compare/finance paths, both ESF branches,
return with inputs intact, repeat saves, setup Back/Skip, and excluded-route tests.

## Retire the two ghost flags in the full app

First capture behavior and create both Flow baselines from the recorded source.
Then remove the two retired entry constants and their dormant branching from `/app`.
The full app retains its full onboarding, all product tabs, Goals entries for BP
and ESF, and existing budget/save behavior. Flow-specific setup and presentation
live in the respective Flow. Do not remove shared product behavior such as the
BP-to-ESF connection simply because a Flow also uses it.

New Flows likewise use explicit per-package entry and containment rules instead
of reinstating those flags under new names. Other unrelated config flags are
outside scope. Historical snapshot bytes and historical notes remain unchanged.

## Local selector and publication

Local selector: preserve passcode and existing alternatives; show Full app and a
Flows section with labels/descriptions. Each opens a fresh standalone document.
Missing optional local discovery data must not break access to the app. Invalid
entries must not render unsafe markup or navigate to arbitrary paths; report
actionable errors through the agent checker.

Publication: extend the existing catalog machinery with a versioned Flow package
format (proposed `flow-static-v1`). Retain the current immutable fields and use
`source_dir = flows/<flow-id>`. Keep the established hosted shape
`versions/<publication-id>/index.html`; the snapshot ID identifies the published
revision, while the source Flow ID identifies the working experience. The hosted
selector groups Flow snapshots separately from full-app snapshots, deriving the
kind/Flow ID from validated format/source metadata rather than duplicating it.

Do not change export semantics for legacy-v1 or static-v1. If implementation
requires a catalog schema extension, add backward-compatible validation and
transition tests; never rewrite old immutable rows to fit the new format.

Each selected Flow snapshot exports only its own committed package, freezes
tracking and selector destination, computes hashes, and follows existing source
tag, publication tag, main-source, digest and previous-manifest checks. Preparing
a full-app snapshot does not include Flows. A Flow committed on main is not
published until explicitly selected through publication preparation.

Retain existing active/archive/hidden/retired behavior, study protections, artifact
size ceiling and direct-link guarantees. Retiring a Flow snapshot cannot leave a
nested alternate entry runnable; standalone entries and any additional HTML pages
must be covered by the same lifecycle rules. Never execute historical source to
package it. Exclude authoring metadata/docs when unnecessary for runtime.

Copies increase repository and artifact size (the current app is about 21 MB).
Measure actual package sizes in rehearsals and fail clearly before the existing
800 MB artifact ceiling. Do not introduce shared mutable asset hosting to evade
the limit. Deduplication can be considered later with explicit immutable identity.

## Delivery and delegation after approval

A fresh Astra session owns interpretation of the approved plan, contracts,
integration and final review. Delegate bounded implementation to GPT-6.1 Sol.
The user has requested that delegation for implementation; do not spawn agents
just to restate this plan. Inspect model availability in that fresh session.

1. **Astra: contract checkpoint.** Re-read AGENTS/CLAUDE and this plan; follow
   start-work, inspect current main and preserve local work. Reconcile any changes
   since the recorded base. Write exact metadata, command, navigation and packaging
   interfaces plus owned file lists before assigning workers. Routine technical
   choices are covered by plan approval; escalate changes to product scope or
   authorization. Record a baseline app/file digest inventory for regression review.
2. **Sol: foundation.** Creation/check tooling, metadata and local discovery,
   dependency/scope validation, containment conventions and their tests. Finish
   this contract before creating two different implementations of it.
3. **Sol: ESF, then BP.** Implement ESF as the first end-to-end package and review
   its containment. Reuse the agreed mechanism for BP, bundling its ESF code.
   These may be separate workers but must not edit each other's directories.
4. **Sol: publication.** Implement the new package format, selector grouping and
   lifecycle tests after metadata contracts settle. Can overlap Flow work with
   exclusive ownership of publication files and tests.
5. **Sol: app cleanup and runbooks.** Remove the two dormant app flags after Flow
   baselines exist. Update README, CLAUDE, workflow, testing, publishing, app
   contracts, and applicable start-work/ship/publish/compare instructions to name
   scopes and reflect completed cutover. Add docs/flows.md and discoverable agent
   workflow instructions for create/edit/check/publish/integrate operations. If
   creating a skill, use the skill-creator procedure. Do not make historical logs
   into current instructions or mandate multi-agent work for routine PM edits.
6. **Astra: integration review.** Review the combined diff, especially publication
   identity, failure recovery, route bypasses and unintended app edits. Run the
   complete required checks once after integration; repeat affected checks for
   subsequent fixes. Prepare concrete PM verification and handoff evidence.

Use one Sol worker at a time by default, at most two when ownership is disjoint.
Do not have Astra independently redo every worker's investigation. Each assignment
receives the approved plan, exact scope, relevant files, interfaces, acceptance
checks and current checkpoint. Return changed paths, checks/results, unresolved
risks and commit/checkpoint identity; avoid long transcripts. Shared-file edits
are serialized. Workers do not switch branches or perform remote mutations.

Persist milestone state in a concise handoff: completed work, current commit and
dirty files, tests run, remaining work, decisions and authorization. This allows a
fresh session after a usage limit without repeating research or claiming unfinished
work passed. Keep Astra reviews at contract, ESF proof, and final integration
checkpoints; increase scrutiny when evidence reveals a concrete issue.

## Verification and completion gates

Automated checks must include negative cases, not just screenshots or happy paths:

- Creating/editing a Flow leaves app bytes unchanged; explicitly scoped flag
  cleanup is separately reviewed. Invalid IDs, collisions, symlinks, traversal,
  cross-package dependencies and interrupted creation fail without data loss.
- Both Flows boot using file-compatible script loading; profile/state prerequisites
  are correct. Forbid excluded destinations through every navigation entry,
  deep links, admin jumps, history restore and render dispatch. Verify disabled
  controls have no effects. Prove runtime behavior, not only an allowlist constant.
- Exercise each acceptance journey above, including BP/ESF round trips, back,
  restart, repeated commits, and the distinct budget side effects.
- Selector works with absent/invalid metadata, safely renders text, and preserves
  current app and comparison access. Flow edits cannot silently alter another Flow.
- Publication exports only selected committed Flow content; app-only packages
  exclude Flows. Old snapshots rebuild with identical hashes. Test moved tags,
  changed digests, old manifests, selector-only edits, hidden direct links,
  retirement, missing dependencies, tracking settings, and artifact ceiling.
- Participant parameters survive launch/navigation/restart on HTTP(S); tracking
  stays off locally and cannot be changed by URL. Flow refresh restarts its entry;
  app refresh behavior remains as before.
- Run all current commands in docs/testing.md, extend CI to run the new checks,
  and rehearse publication twice offline with a previous manifest. No deployment
  is needed to validate the implementation locally.

PM/browser verification covers file:// on Windows/WSL and macOS (including paths
with spaces), a local HTTP publication rehearsal, narrow layouts, all four themes,
keyboard/input behavior, selected help/media, constrained Goals, every ESF branch,
refresh/restart/exit, and participant links. Automation can supplement these
checks. Record unavailable browser/platform checks explicitly, never as passed.

For ongoing Flow work: PM reviews the Flow; agent integrates chosen behavior into
`/app` on a task branch; PM verifies that integrated full-app experience before the
PR is opened. Preserve the Flow reference and source provenance; integration is
selective and never a bulk overwrite. Re-run affected full-app checks.

Initial infrastructure completion means both Flows work, boundaries and historical
publication invariants pass, documentation supports a fresh PM agent, and the PM
can review the result locally. Shipping follows the existing PR/CI procedure with
applicable PM signoff. Session permissions allow branch pushes, PR creation and CI
verification; merge, settings and publication need separate authorization. A plan
approval does not implicitly authorize those actions. Report implementation,
verification, push/PR, merge, deployment and live verification separately.

## Model and usage guidance

Astra coordinating Sol 6.1 is suitable for this work: most implementation can be
bounded once contracts are settled, while publication compatibility and app/Flow
boundaries benefit from a careful integration review. Prefer a small number of
substantial assignments over many tiny workers. Delegation is not itself a token
saving: subagents add their own context, reasoning and tool work.

Official documentation checked 2026-10-11:

- [Model selection](https://developers.openai.com/api/docs/guides/model-selection)
  describes GPT-6.1 Sol as appropriate for complex technical work with time/cost
  constraints.
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) notes
  that subagent workflows consume more tokens than comparable single-agent runs.
- [Pricing](https://learn.chatgpt.com/docs/pricing) separates API token prices
  from subscription usage; the Plus listing names Sol 6.1 and Luna. It does not
  establish Astra access for this specific account or an exact five-hour allowance
  for this workload. Confirm the models and remaining allowance shown in the client.

Do not estimate Plus session savings from API price ratios or promise completion
within a five-hour usage window. If Astra is available, use the requested division
of work. If unavailable, explain that fact; Sol 6.1 can lead implementation and
review in separate focused passes. Persist checkpoints either way.
