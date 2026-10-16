# MoneyBuddy prototype

A static, mobile-shaped finance coaching prototype. `app/` is the editable full
product; `flows/<id>/` contains focused proposals and study journeys. Open root
`index.html`, enter `1337`, and choose Local Prototype or a Flow. No server or
package installation is needed to preview. Script-wrapped data supports `file://`.
Refresh returns to the selector unless Tools' **Pin on refresh** is on for that
browser tab; pinned, the same app or Flow restarts fresh. Restart Flow stays in
place; Exit returns to the selector.

## Collaboration

Use `.claude/skills/` for ordinary start-work, sync, ship, publish, compare-local
and create-flow requests; follow [workflow](docs/workflow.md). Preserve dirty files
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

## App conventions

Vanilla JS, unique feature-prefixed globals and ordered script tags. Mutate the
single `state`, then `render()`. Keep modules separate. Escape interpolated text
with `h()`. Inputs use `onchange`; live sliders use `debouncedRender()` and stable
maxima. `.item-card` is block; scope flex fixes to the specific instance. Use theme
variables and check all four themes. See [hard rules](docs/app-contracts.md#hard-rules).

Every Flow mirrors `app/css/components.css`, `app/js/refresh-pin.js` and the
`app/index.html` head/Tools header (after the Flow adapter). Change all copies in
one commit. Data JSON edits require `bash scripts/wrap-data.sh`; do not hand-edit
wrappers or regenerate media as part of packaging.

No backend, localStorage, live LLM or runtime API keys. Release-controlled Useberry
on HTTP(S) is the narrow telemetry exception; development tracking stays off.
Session storage holds only tab reviewer settings (unlock, selector tab, refresh
pin, comparison layout), never participant data.

`app/` is one product: never add journey switches. A focused, shortened or reordered
journey is a Flow, made with create-flow; see [one product](docs/app-contracts.md#one-product-no-journey-switches).
The budget seam is `submitBudgetBaseline()`; builders never write `state.budget`
directly. ESF is the approved exception: `esfCommit()` calls `applyBudgetBaseline()`
to replace the budget immediately and return to Goals, including repeat saves.

Flow tasks run `python3 scripts/flows.py scope --scope flow` and leave `app/` bytes
unchanged. Product integration uses `--scope app-integration`, selectively ports
approved behavior and requires PM full-app verification before the PR. A Flow
merge neither approves its proposal nor publishes it.

Explain decisions in product terms. Record scope and validation in PR text.
Repeat affected checks after material changes. Run every automated check with
`bash scripts/check-all.sh`; BLOCKED is not a pass. Never claim an unavailable
runtime, browser or platform check passed.

## Project map and references

| Read when | File |
|---|---|
| Starting, syncing, shipping, browser PR handoff | [workflow](docs/workflow.md) |
| Preparing a snapshot, selector change or deployment | [publishing](docs/publishing.md) |
| Changing app behavior | [app contracts](docs/app-contracts.md), [architecture](app/docs/architecture.md) |
| Resolving product requirements or L##/D## IDs | [decisions](docs/decisions.md) |
| Testing | [testing](docs/testing.md) |
| Tracking and participant URLs | [Useberry](app/docs/useberry.md) |
| Creating/editing/checking Flows or integrating proposals | [Flows](docs/flows.md), [create-flow](.claude/skills/create-flow/SKILL.md) |
| Comparing local variants of the app or one Flow | [local variants](docs/local-variants.md) |
| Future product work | [future work](docs/future-work.md) |

Under `app/`: `js/state.js` holds state, `js/render.js` dispatches renderers and
`js/navigation.js` owns stacks; `screens/`, `components/`, `data/`, `css/` and
`assets/` hold views, shared visuals, data, styles and media. New screens need
script order, render/Tools dispatch, tab mapping and `destinations` wiring.
