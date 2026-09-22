# Snapshot publication

Shipping integrates app work into main. Publishing is an explicit, separately
requested release of the selector and its retained snapshots. Ordinary main pushes
and catalog merges do not deploy. The sole deployment trigger is a new
`publish/<unique-id>` tag. The organization rollout currently permits branch pushes,
PR creation and CI verification only. Tag creation/push, merge, settings changes and
deployment require separate authorization. The old repo/site remains the blue fallback.

## Source and catalog

One editable app lives in app/. `publication/catalog.json` separates immutable fields
(id, source_tag, full commit, source_dir, public_path, format, tracking, digest) from
presentation (label, description, order, state, ongoing_study). IDs and paths are
permanent. Do not recycle IDs even after retirement. Labels and descriptions are
escaped in the selector. Tracking is shown independently of active/archive placement.

| State | Selector | Direct URL |
|---|---|---|
| active | Prominent, ascending order then ID | Original app |
| archived | Collapsed Older versions | Original app |
| hidden | Omitted | Original app |
| retired | Omitted | Retirement notice with selector link |

Prefer hidden for clutter removal. To retire, get an explicit PM request naming the
build and acknowledging that its direct URL will stop opening the app. Record that
request and any study-resolution decision in the catalog PR. Resolve ongoing_study
before retiring or demoting an active build. A null value means unknown, never false;
all unknown study statuses block deployment. Confirm any new study status with PMs.
Restoration changes state only; it serves the original bytes. Source tags stay forever.
The shared selector intentionally changes, so refresh returns to the current selector.
Guarantees cover hosted bytes and stable paths, not Useberry service behavior or
already-loaded browser copies.

## Green publication and migration baseline

The first green publication succeeded on 2026-09-21. The owner confirmed in
[PR #2](https://github.com/MB-Prototype-Lab/public-prototype/pull/2) that the blue
site's main and demo refs and last successful Pages build used
`6666b1a7cd27a1c63a2ee51bd5728a6fe9356791`. That is the catalog's migration
baseline, and green `demo` remains there as a fallback. Before consolidation,
every original file from v1, v2, v3, v3.1 and v4 was exported and compared with
that commit. The digests and source identities remain in `publication/migration.json`.
The immutable `snapshot/v1`, `snapshot/v2`, `snapshot/v3`, `snapshot/v3.1`, and
`snapshot/v4` tags all point to the baseline commit.

The owner also confirmed that v4 is the only ongoing legacy study. The catalog
records v4 as active, tracking on, and `ongoing_study: true`; v1–v3.1 are
archived, tracking off, and `ongoing_study: false`. These are explicit study
decisions, not inferences from tracking settings.

The `publish/2026-09-21-green-01` tag points to main commit
`572a47770ee41ff2f435c7aca6d42486064c4a62`. Its
[publication run](https://github.com/MB-Prototype-Lab/public-prototype/actions/runs/35669399656)
and GitHub Pages deployment succeeded. The live
[green manifest](https://mb-prototype-lab.github.io/public-prototype/publication-manifest.json)
reports that revision and all five legacy snapshots. The green selector and
legacy entry URLs respond, but PM browser, media, deep-link and participant
study-flow checks have not been recorded. The blue site remains the serving
fallback; team adoption and participant-link changes are separate decisions.

The initial deployment used a one-time bootstrap because green had no previous
manifest. GitHub now has `VERIFIED_MIGRATION_BASELINE` set to the baseline SHA;
`BOOTSTRAP_PUBLICATION_REF` has been removed. Do not restore the bootstrap
variable for later publications. Every later run must retrieve and validate
green's live manifest; a failed retrieval or invalid manifest stops deployment.
Deployment never validates against blue's publication history. If a custom
domain is chosen later, review both URLs before publication.

## Prepare a new snapshot

1. Select a tested commit on verified current main. Obtain the label and tracking
   choice (study/on or comparison/off). Ask only if ambiguous; an explicit choice
   needs no repeated question. Development stays untracked regardless of this choice.
2. Prepare a record locally, with a fresh permanent ID:

   ```sh
   python3 scripts/publish.py prepare --id comparison-2026-09 --commit FULL_SHA --label 'September comparison' --tracking off
   ```

   The command prints JSON; review and add it to snapshots in the catalog on a task
   branch. Set description, order, state and actual ongoing_study. It exports committed
   files, inserts release configuration and calculates the expected digest. It does
   not create tags or change main. Duplicate IDs/paths fail catalog validation.
3. Run local checks and prepare the catalog PR through docs/workflow.md. Explain
   immutable source SHA, tracking, label and any lifecycle transitions. Re-review
   material changes, including a changed tracking choice, before shipping the PR.
4. After confirmed merge and authorized publication, create each absent source tag
   at its catalog SHA: `git tag snapshot/<id> FULL_SOURCE_SHA`. Verify both existing
   local and remote tag targets (peel annotated tags to commits). If any existing tag
   differs, stop; never move it. Authorized push: `git push origin refs/tags/snapshot/<id>`.
   A source tag by itself does not deploy.
5. Select a unique publication tag name, e.g. `publish/2026-09-20-01`. The reviewed
   catalog revision must be the current main tip when deployed. Check the full SHA,
   then `git tag publish/<unique-id> FULL_CATALOG_SHA`; verify before the authorized
   `git push origin refs/tags/publish/<unique-id>`.
6. Read the Actions run result, then verify the live publication manifest revision,
   selector, legacy paths, assets, deep links and study flow. A tag push is not proof
   of deployment. Record deployed and live-verified separately.

Without GitHub CLI, all Git tag commands still work with ordinary Git credentials.
Use https://github.com/MB-Prototype-Lab/public-prototype/actions/workflows/publish.yml to inspect
run status and logs, and the Pages link to verify output. PR browser instructions are
complete in docs/workflow.md. CLI users can inspect runs with `gh run list`/`gh run view`;
CLI availability never changes the required evidence or authorization.

## Selector-only changes and resuming

For label/order/archive/hide/retire/restore changes, retain every immutable field and
all records. Ship a catalog PR, then publish its main revision with a new publication
tag. No new app snapshot is needed. Never delete source tags or snapshot records.

After partial failure, inspect the remote tags, PR merge SHA, Actions logs and live
manifest. Resume only missing steps. Tags already at the expected SHA are reused,
never overwritten. If upload/deploy failed and main is unchanged, an authorized rerun
of the same publication is deterministic. If main advanced, prepare/review against
current main and use a new publication tag; stale tags are rejected. If live manifest
retrieval or validation fails, stop and investigate—do not substitute offline mode or
bootstrap flags. A failed build never uploads a partially validated artifact.

## Packaging and validation

`legacy-v1` exports every committed file beneath the original source directory,
without injection or regeneration. `static-v1` exports static app extensions, excludes
docs and hidden directories, and replaces release-config.js with frozen tracking plus
`../../index.html` selector destination. Never change an existing format's behavior;
add a new versioned format when packaging must change. Historical code is never run.
The digest is SHA-256 of canonical sorted JSON mapping relative filenames to SHA-256
content hashes. Every snapshot's identity describes its complete original package,
even when its current entry URL hosts a retirement notice.

The artifact contains all retained hidden/archived/active snapshots, retired entry
notices, the generated selector, and publication-manifest.json. The manifest records
catalog identity, source package file hashes and hosted file hashes (excluding itself
to avoid a circular hash). Rebuilds verify source tags, digest equality and previous
file hashes. The complete output must stay below 800,000,000 bytes. Symlinks and
submodules are rejected. Only committed source is exported; branching.md, future
worktrees and untracked files cannot enter the app packages.

For a committed local rehearsal, use a new output path:

```sh
python3 scripts/publish.py build --offline --output /tmp/moneybuddy-rehearsal-1
python3 scripts/publish.py build --offline --previous /tmp/moneybuddy-rehearsal-1/publication-manifest.json --output /tmp/moneybuddy-rehearsal-2
```

Offline mode permits missing tags; existing moved tags still fail. It is for local
rehearsal only, never deployment. Production requires a publication tag on current
main, source commits on main, all source tags, known study flags, and a valid previous
manifest or the exact approved bootstrap. A single concurrency group covers build
through deployment. Main is fetched again immediately before deploy; old queued tags
cannot overwrite newer catalog revisions. Freeze publication coordination briefly if
main changes during that final check. A later source-only merge does not invalidate
the bytes of an in-progress approved publication, but no newer publication can run
concurrently. The previous manifest is also bound to its catalog revision in Git.

## Verified setup and remaining rollout checks

GitHub settings inspected on 2026-09-22 show:

- Pages uses a GitHub Actions workflow with HTTPS at
  https://mb-prototype-lab.github.io/public-prototype/. The `github-pages`
  environment allows `publish/*` tags, and the first publication deployment
  succeeded with the workflow's `pages: write` and `id-token: write` permissions.
- The active `Protect main` ruleset requires PRs with squash merges, zero
  approving reviews, current-base `App checks` and `Publication checks`, and
  blocks deletion and non-fast-forward updates. The active `Immutable publication
  tags` ruleset blocks updates and deletion under `snapshot/*` and `publish/*`.
- The owner-verified `VERIFIED_MIGRATION_BASELINE` variable matches the catalog.
  The one-time `BOOTSTRAP_PUBLICATION_REF` variable is absent. Source and
  publication tags are present at the identities listed above.

The deployment result and HTTP responses do not establish visual or participant
study behavior. Before team cutover, PMs should record passcode and selector
refresh, the v1/v2/v3/v3.1/v4 entry paths and media, narrow layouts and themes,
deep links and participant parameters, and the active v4 study flow. Coordinate
participant-link changes separately. Keep the blue site and `demo` as fallback
until those checks and the cutover decision are complete; do not delete `demo`.
For future settings changes, inspect the saved state again and obtain separate
authorization. Future merges and publications also require their own authorization.

Workflow syntax and Pages action wiring were checked against the official
[custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
Local tests do not verify administrator permissions or prove a future Actions run succeeds.
