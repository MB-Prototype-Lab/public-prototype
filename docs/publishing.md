# Snapshot publication

Shipping integrates reviewed task work into main. Publishing is an explicit, separately
requested release of the selector and its retained snapshots. Ordinary main pushes
and catalog merges do not deploy. The sole deployment trigger is a new
`publish/<unique-id>` tag. Remote actions follow the
[authorization boundary](../CLAUDE.md#collaboration).

## Source and catalog

The approved editable product lives in app/; contained proposals live in flows/<id>/. `publication/catalog.json` separates immutable fields
(id, source_tag, full commit, source_dir, public_path, format, tracking, digest) from
presentation (label, description, order, state, ongoing_study). IDs and paths are
permanent. Do not recycle IDs even after retirement. Labels and descriptions are
escaped in the selector. A "Tracking on" badge marks every listed tracked build,
active or archived; untracked builds carry no badge. Full-app builds appear on the
selector's **Prototype** tab and Flow snapshots on its **Flows** tab. The toggle
appears only when both tabs list something, so it stays hidden until a Flow
snapshot is active or archived. A Flow row shows its catalog `description` beside
the label, so set a short one when preparing it.

| State | Selector | Direct URL |
|---|---|---|
| active | Prominent (full app: blue button; Flow: list row), ascending order then ID | Original app |
| archived | Collapsed Older versions on its tab | Original app |
| hidden | Omitted | Original app |
| retired | Omitted | Retirement notice with selector link |

Prefer hidden for clutter removal. To retire, get an explicit PM request naming the
build and acknowledging that its direct URL will stop opening the app. Record that
request and any study-resolution decision in the catalog PR. Resolve ongoing_study
before retiring or demoting an active build. A null value means unknown, never false;
all unknown study statuses block deployment. Confirm any new study status with PMs.
Restoration changes state only; it serves the original bytes. Source tags stay forever.
The shared selector intentionally changes. Refresh from a full app or Flow returns
there unless the tab is pinned in Tools; pinned, it restarts the same frozen build.
Restart Flow stays in the Flow, and Exit returns to the selector.
Guarantees cover hosted bytes and stable paths, not Useberry service behavior or
already-loaded browser copies.

## Current setup

This is the recorded setup; re-inspect current saved settings and refs before a
release or settings change.

- The catalog migration baseline and immutable `snapshot/v1`, `snapshot/v2`,
  `snapshot/v3`, `snapshot/v3.1` and `snapshot/v4` source identity is
  `6666b1a7cd27a1c63a2ee51bd5728a6fe9356791`. Retain `demo` as the historical
  fallback and leave PM/HoffDemo branches intact.
- The catalog records v4 as active, tracking on, and `ongoing_study: true`;
  v1–v3.1 are archived, tracking off, and `ongoing_study: false`. Study status
  is an explicit PM decision, never an inference from tracking.
- Every deployment retrieves and validates the [live manifest](https://mb-prototype-lab.github.io/public-prototype/publication-manifest.json),
  binding it to its committed catalog. Failed retrieval (including 404) or invalid
  contents stop deployment. Do not restore `BOOTSTRAP_PUBLICATION_REF` or substitute
  blue's publication history. The recorded `VERIFIED_MIGRATION_BASELINE` variable
  matches the catalog; deployment no longer uses it.
- Recorded Pages hosting uses [the site](https://mb-prototype-lab.github.io/public-prototype/)
  over HTTPS and [the publication workflow](https://github.com/MB-Prototype-Lab/public-prototype/actions/workflows/publish.yml).
  The `github-pages` environment permits `publish/*` tags; the workflow requires
  `pages: write` and `id-token: write`. Review both URLs if choosing a custom domain.
- Re-inspect `Protect main`: the recorded rules require PRs, squash merges, zero
  approving reviews, current-base `App checks` and `Publication checks`, and block
  deletion and non-fast-forward updates. `Browser journeys` is advisory until
  separately made required. Re-inspect `Immutable publication tags`: updates and
  deletion are blocked for `snapshot/*` and `publish/*`.

Local checks cannot exercise `publish.yml`, verify administrator permissions or
prove an Actions deployment succeeds. [Outstanding PM checks](future-work.md#outstanding-publication-pm-checks)
remain separate from automated and HTTP evidence.

## Prepare a new snapshot

1. Select a tested commit on verified current main. Obtain the label and tracking
   choice (study/on or comparison/off). Ask only if ambiguous; an explicit choice
   needs no repeated question. Development stays untracked regardless of this choice.
2. Prepare a record locally, with a fresh permanent ID:

   ```sh
   python3 scripts/publish.py prepare --id comparison-2026-09 --commit FULL_SHA --label 'September comparison' --tracking off
   ```

   Preparation checks the already-fetched `refs/remotes/origin/main`; it never
   fetches implicitly. Use `--main-ref REF` only to name the verified main ref
   explicitly (local rehearsals may use `--main-ref main`). `check --base REF`
   rejects new catalog rows unless their source commit is already an ancestor of
   that base, so the source must reach main before the catalog PR merges.

   The command prints JSON; review and add it to snapshots in the catalog on a task
   branch. Study status starts unknown (`null`); confirm it with PMs and set actual
   ongoing_study alongside description, order and state. It exports committed
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

## Prepare a Flow snapshot

Use the same procedure above, selecting a tested committed Flow on verified current
main and adding `--flow`:

```sh
python3 scripts/publish.py prepare --flow emergency-fund --id emergency-fund-study-01 --commit FULL_MAIN_SHA --label 'Emergency Fund study' --tracking on
```

The proposed row uses `flow-static-v1`, `source_dir=flows/emergency-fund`, and
`public_path=versions/emergency-fund-study-01/index.html`. The Flow ID identifies the
working experience; the permanent snapshot ID identifies one immutable revision.
Kind and Flow grouping are derived from validated format/source metadata. Local
`flows/catalog.*` is discovery only and does not publish anything. Merging a Flow
into main neither publishes it nor approves integrating its proposal into `app/`.
Full-app preparation without `--flow` excludes all Flow packages.

The package exports only its own committed static files, excludes authoring
`flow.json`/docs, retains deterministic runtime policy, validates dependencies and
freezes tracking/selector settings. No mutable app/shared imports are allowed.
Source tags, main-source checks, digest/previous-manifest guarantees, the artifact
ceiling and study/lifecycle protections are identical to other snapshots. Retirement
replaces every packaged HTML entry, preventing nested entries from bypassing it.
Direct study links bypass the selector/passcode; participant parameters cannot turn
tracking on. Follow [Flow review and integration](flows.md) for source iteration.

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
a replacement manifest. A failed build never uploads a partially validated artifact.

## Packaging and validation

`bash scripts/check-all.sh` checks catalog policy against the merge base of HEAD
with `origin/main`, falling back to `main`; no merge base is BLOCKED. It rejects
removed rows, changed immutable identities and unresolved studies before demotion
or retirement, and verifies every committed snapshot digest. To name a base
explicitly, run `python3 scripts/publish.py check --base REF`.

`legacy-v1` exports every committed file beneath the original source directory,
without injection or regeneration. `static-v1` exports static app extensions, excludes
docs and hidden directories, and replaces release-config.js with frozen tracking plus
`../../index.html` selector destination. Never change an existing format's behavior;
`flow-static-v1` is the separate standalone Flow format described above. Historical
code is never run; legacy-v1 and static-v1 semantics remain unchanged.
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
manifest. A single concurrency group covers build
through deployment. Main is fetched again immediately before deploy; old queued tags
cannot overwrite newer catalog revisions. Freeze publication coordination briefly if
main changes during that final check. A later source-only merge does not invalidate
the bytes of an in-progress approved publication, but no newer publication can run
concurrently. The previous manifest is also bound to its catalog revision in Git.
