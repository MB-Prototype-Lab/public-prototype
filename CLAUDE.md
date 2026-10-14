# MoneyBuddy prototype

A static, mobile-shaped finance coaching prototype. One editable application lives
in `app/`; contained proposals live in `flows/<id>/`. Open `index.html` directly,
enter passcode `1337`, and choose Local Prototype or a Flow from the toggle. No server or dependency
installation is needed. Refresh returns to the selector unless **Pin on refresh** is on
in Tools (one pin per browser tab); pinned, refresh restarts the same app or Flow
fresh. Restart Flow always restarts in place; Exit returns to the selector. Data
loads through script tags so `file://` works.

## Collaboration

Use the project skills in `.claude/skills/` for ordinary requests to start work,
sync, ship, publish, compare local variants, or create a Flow. Read [workflow](docs/workflow.md) for the operating procedure.
Start a task branch with a short readable name (no date) from current main;
preserve dirty files and local-only commits. Sync by merging main, never rebasing
or force pushing. Ship through a reviewed PR and passing CI with applicable PM
testing. Publishing is a separate, explicit request; merging main never deploys. Do not infer remote success.

Repository cutover is complete. Keep `demo` as a historical fallback. Leave all PM/HoffDemo branches untouched;
the approved blue/PM features are integrated in `app/`. Never restore editable
`versions/` copies. Historical builds are immutable hosted snapshots and Git history.
The organization repository is the shared working destination.
Current session scope permits branch pushes, PR creation and CI verification. Merge,
repository settings and publication require separate authorization.
Keep `branching.md` untracked; stage specific files.

## App conventions

Vanilla JS with global names and ordered script tags. One global `state`, then
`render()` after changes. Keep modules separate and names unique and feature-prefixed.
Escape interpolated text with `h()`. Inputs use `onchange`; live sliders use
`debouncedRender()`. Keep slider maxima stable. `.item-card` is block; scope flex
fixes to the specific instance. Use theme variables and check all four themes.
No backend, localStorage, live LLM, or runtime API keys. Release-controlled Useberry
on HTTP(S) is the narrow telemetry exception; development tracking is off. The only
sessionStorage is the tab's reviewer settings (passcode unlock, selector tab, refresh
pin, pinned comparison layout), never participant data.
Do not regenerate media as part of packaging. `MB_VERSION` is retired and errors.
`app/` is one product: never add a journey switch (the retired `ESF_ONLY`/`BP_ENTRY`
pattern, under any name). A focused, shortened or reordered journey is a Flow, made
with create-flow; see [one product](docs/app-contracts.md#one-product-no-journey-switches).

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
| Creating/editing/checking Flows or selectively integrating proposals | [docs/flows.md](docs/flows.md) |
| A request to narrow, shorten or start the journey elsewhere | [create-flow](.claude/skills/create-flow/SKILL.md), [one product](docs/app-contracts.md#one-product-no-journey-switches) |
| Local variants of the app or one Flow | [docs/local-variants.md](docs/local-variants.md) |
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
affected checks. Run every automated check with `bash scripts/check-all.sh`;
BLOCKED is not a pass. Do not claim unavailable runtime or browser checks passed.

Flow tasks declare `--scope flow` against the recorded full task base and leave app
bytes unchanged. Product integration uses `--scope app-integration`; selectively port
approved behavior and obtain PM full-app verification before opening the PR. Merging
a Flow does not approve its proposal or publish it. See [Flows](docs/flows.md).
