# Snapshot publication

Shipping integrates app work into main. Publishing is an explicit, separately
requested release of the selector and its retained snapshots. Ordinary main pushes
and catalog merges do not deploy. The sole deployment trigger is a new
`publish/<unique-id>` tag. Do not run remote commands below during the local-only
implementation. The future workflow requires remote-read and remote-write authority.

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
all unknown study statuses block deployment. Confirm with PMs before first cutover.
Restoration changes state only; it serves the original bytes. Source tags stay forever.
The shared selector intentionally changes, so refresh returns to the current selector.
Guarantees cover hosted bytes and stable paths, not Useberry service behavior or
already-loaded browser copies.

## Provisional migration and first cutover

The local migration baseline is cached origin/demo:
`6666b1a7cd27a1c63a2ee51bd5728a6fe9356791`. This is not verified current remote state.
Every original file from v1, v2, v3, v3.1 and v4 was exported and compared before
removing editable copies. Digests and intended tags are in publication/migration.json.
All intended `snapshot/v1`, `snapshot/v2`, `snapshot/v3`, `snapshot/v3.1`, `snapshot/v4`
tags point to that SHA. No source tags have been created in this repository yet.
Legacy v4 tracks; v1–v3.1 do not. Study status is intentionally unknown for every build.

Before cutover, the owner verifies the actual Pages source and authorizes refreshing
origin/demo. Compare its full SHA to the baseline. If different, stop and regenerate
the migration exports/catalog from the exact serving revision, compare all original
bytes again, and review a new PR; no legacy baseline changes after first publication.
Do not edit demo. Preserve it as fallback until live verification succeeds.

Set `VERIFIED_MIGRATION_BASELINE` to the owner-verified SHA and
`BOOTSTRAP_PUBLICATION_REF` to the exact initial `refs/tags/publish/<unique-id>` in
repository Actions variables. These are administrator attestations, not automatically
inferred values. First deployment accepts a missing manifest only on HTTP 404 and
only for that exact approved tag and baseline. Other errors, malformed manifests or
unknown study flags stop deployment. Clear the bootstrap variable immediately after
successful deployment. Every later run must retrieve and validate the live manifest.
The current source assumes project Pages at
https://superdyu.github.io/mbprototype_v1/; if owner verification finds a custom URL,
update and review the fixed manifest URL and local historical link before cutover.

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
Use https://github.com/superdyu/mbprototype_v1/actions/workflows/publish.yml to inspect
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

## Administrator setup and authorized rollout

No setting below is considered done until its saved state has been inspected.

1. After explicit remote authorization, refresh refs; reconcile the implementation
   branch and migration baseline. Push only the implementation branch and supply the
   comparison link and PR text. If credentials prevent pushing, create a local bundle
   (`git bundle create /tmp/collaboration-publishing.bundle main..work/collaboration-publishing`)
   for a collaborator who has the base. Get passing CI and applicable PM review before
   an explicitly authorized squash merge. Keep demo and PM branches untouched.
2. In Settings → Pages, record and verify the existing source. Enable Actions under
   Settings → Actions → General and switch Pages source to GitHub Actions for cutover.
3. Configure the github-pages environment to allow publication tags `publish/*`.
   Do not restrict deployment solely to branch main: this workflow runs on tags.
   Configure pages:write and id-token:write as in the workflow and check environment
   access. Additional required deployment approval is an administrator choice.
4. Protect main with PRs, zero required reviewer approvals, required `App checks` and
   `Publication checks`, current-base validation, no force pushes or deletion, and
   administrator enforcement/no routine bypass. Add required checks once their first
   successful run establishes their names. Until then no merge is considered ready.
5. Protect snapshot/* and publish/* tags against updates and deletion where the
   repository's rulesets support it; allow authorized creation. Enable squash merging.
6. Confirm studies and migration baseline, configure exact bootstrap variables, and
   request explicit merge/cutover authority. No deployment is authorized by plan approval.
7. Following an explicitly requested deployment, verify the manifest SHA, passcode,
   v1/v2/v3/v3.1/v4 URLs, media and participant study flow. Clear bootstrap access and
   document demo as retired from publishing only after verification; do not delete it.

Workflow syntax and Pages action wiring were checked against the official
[custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
Local tests do not verify administrator permissions or prove an Actions run succeeds.
