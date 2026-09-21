# Collaboration and publishing review

PR title: **Consolidate the app and separate shipping from snapshot publication**

Organization comparison:
https://github.com/MB-Prototype-Lab/public-prototype/compare/main...work%2Fcollaboration-publishing

## Change summary

MoneyBuddy currently keeps five editable application copies and publishes through a
separate branch. This change puts current development in app/, adds start/sync/ship/
publish project skills, and separates integration into main from explicit snapshot
publication. Detailed app requirements remain in focused references.

A version-controlled catalog generates the passcode selector, keeps v4 active and older
builds archived, and supports hiding, retirement and byte-identical restoration. Legacy
paths and original bytes come from cached demo commit
6666b1a7cd27a1c63a2ee51bd5728a6fe9356791. New releases freeze source, tracking and content
digests under permanent IDs. Development tracking is off. Main merges run checks;
only a publication tag can deploy. Publication validates retained files against the
previous live manifest and rejects stale revisions, moved tags and size overruns.

The organization repo is the green rehearsal destination; team cutover is pending.
The manifest lookup and local historical link target
https://mb-prototype-lab.github.io/public-prototype/. The link may be unavailable
until first deployment. The old repo/site remains the blue fallback.

Validation performed locally:

- 20 Python tests pass, including mocked deployment-preparation checks for the green
  manifest endpoint, exact 404 bootstrap, network failures and invalid manifests.
  Existing coverage includes disposable Git workflows, packaging, malformed
  metadata, lifecycle/study transitions, restoration, missing/moved tags, stale runs,
  missing assets, bootstrap safeguards and output preservation.
- All five legacy exports matched committed files byte-for-byte before consolidation.
  Two complete builds of b6ca568 matched: 540 files, 35,015,483 bytes. The repeat
  build validated against the first manifest. Actual app packaging validates with tracking on and off.
- Local HTML/CSS references, Python compilation, shell syntax, four skill validators
  and catalog/migration policy pass. Supplied MB_VERSION fails before tool work.
- JavaScript syntax, app sweep and release runtime tests **not run successfully**:
  this machine has no Node or JavaScriptCore. CI explicitly provisions Node/Python.
  No visual or hosted participant-flow check has been performed.

Before merging/cutover:

- [ ] Establish passing App checks and Publication checks on the actual PR.
- [ ] PM: open root index.html via file://, passcode 1337, local app, then refresh.
- [ ] PM: smoke-test onboarding/budget/journal, input focus, sliders, four themes and
  relevant audio. Confirm existing deep links and participant parameters over HTTP(S).
- [ ] Owner: verify actual demo-serving baseline and all ongoing-study statuses.
- [ ] Administrator: verify Pages/Actions/environment/branch/tag setup in publishing.md.
- [ ] Obtain separate merge, settings-change and publication authorization.

Branch pushes, PR creation and CI verification are authorized for this task.
Settings changes, merge and publication remain separate steps. demo and PM branches
are unchanged. The migration baseline is provisional and unknown study flags intentionally
block deployment. Do not change them to false without owner confirmation. Shipping
this PR alone does not publish the app. Future HoffDemo feature ports and worktree
management remain separate work.

## Milestones

| Milestone | Status |
|---|---|
| Locally implemented | Complete |
| Locally verified | Python/static/export checks complete; JS/browser checks pending |
| Pushed | Organization rollout code/tests pushed at b6ca568 |
| PR / CI | PR creation rejected: token lacks createPullRequest access; no CI run yet |
| Merged | Not performed |
| Administrator setup complete | Not verified |
| Deployed | Not performed |
| Live verification complete | Not performed |

For browser submission and squash-merge actions use [workflow](workflow.md).
For baseline verification, tags, failure recovery and administrator setup use
[publishing](publishing.md). The untracked branching.md records local commit progress.

## Current handoff

The organization branch push succeeded on 2026-09-21. GitHub rejected PR creation
with `Resource not accessible by personal access token (createPullRequest)`.
Update the gh credential to allow pull-request writes on this repository, or open
the organization comparison link above and create the PR with base `main` and head
`work/collaboration-publishing`. Use the title above and summarize the change and
validation from this document, retaining the pending PM and rollout checklist.

Once the PR exists, inspect App checks and Publication checks for its latest commit,
resolve failures and update the PR verification record. Branch pushes alone do not
trigger these checks. Do not push main or publication tags to work around this gate.
Passing CI, PM signoff, merge, administrator setup and live verification must be
reported separately; none is established by the successful branch push.
