# MoneyBuddy prototype

A static, mobile-shaped finance coaching prototype. One editable application lives
in `app/`. Open `index.html` directly, enter passcode `1337`, and choose the local
app. No server or dependency installation is needed for preview. Refresh returns
to the selector; data loads through script tags so `file://` works.

## Collaboration

Use the project skills in `.claude/skills/` for ordinary requests to start work,
sync, ship, publish, or compare local alternatives. Read [workflow](docs/workflow.md) for the operating procedure.
Start a unique task branch from current main; preserve dirty files and local-only
commits. Sync by merging main, never rebasing or force pushing. Ship through a
reviewed PR and passing CI with applicable PM testing. Publishing is a separate,
explicit request; merging main never deploys. Do not infer remote success.

Keep `demo` as the pre-cutover fallback. Leave all PM/HoffDemo branches untouched;
the approved blue/PM features are integrated in `app/`. Never restore editable
`versions/` copies. Historical builds are immutable hosted snapshots and Git history.
The organization repo is the green rehearsal destination; team cutover is pending.
Current rollout scope permits branch pushes, PR creation and CI verification. Merge,
repository settings and publication require separate authorization.
Keep `branching.md` untracked; stage specific files.

## App conventions

Vanilla JS with global names and ordered script tags. One global `state`, then
`render()` after changes. Keep modules separate and names unique and feature-prefixed.
Escape interpolated text with `h()`. Inputs use `onchange`; live sliders use
`debouncedRender()`. Keep slider maxima stable. `.item-card` is block; scope flex
fixes to the specific instance. Use theme variables and check all four themes.
No backend, localStorage, live LLM, or runtime API keys. Release-controlled Useberry
on HTTP(S) is the narrow telemetry exception; development tracking is off.
Do not regenerate media as part of packaging. `MB_VERSION` is retired and errors.

## Project map and references

| Read when | File |
|---|---|
| Starting, syncing, shipping, browser PR handoff | [docs/workflow.md](docs/workflow.md) |
| Preparing a snapshot, selector change, or deployment | [docs/publishing.md](docs/publishing.md) |
| Changing app behavior | [docs/app-contracts.md](docs/app-contracts.md), [architecture](app/docs/architecture.md) |
| Resolving product requirements | [plan.md](plan.md) §0 L1–L22, then `v3 Files/spec/docs/DECISIONS.md` |
| Testing | [docs/testing.md](docs/testing.md) |
| Tracking and participant URLs | [app/docs/useberry.md](app/docs/useberry.md) |
| Looking up historical decisions | `docs/history/`, `app/PROGRESS.md` (reference, not a task queue) |
| Local alternatives | [docs/local-variants.md](docs/local-variants.md) |
| Future PM feature ports | [docs/future-work.md](docs/future-work.md) |

App files: `js/state.js`, `js/render.js`, `js/navigation.js`; `screens/` renderers;
`components/` shared visuals; `data/` JSON plus generated JS wrappers; `css/` themes
and layout; `assets/` audio/video/images. Paths in this paragraph are under `app/`.
For new screens wire script order, render/admin switches, tab mapping and destinations.
The budget seam is `submitBudgetBaseline()`; builders never write state.budget directly.
ESF is the approved exception: `esfCommit()` calls `applyBudgetBaseline()` to
replace the budget immediately and return to Goals, including on repeat saves.

Explain decisions in product terms to the two PMs. Record scope and testing in PR
text, not historical progress logs. Material changes after signoff require repeating
affected checks. Do not claim unavailable runtime or browser checks passed.
