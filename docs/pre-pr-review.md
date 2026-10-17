# Review finished work before a PR

Use [pre-pr-review](../.claude/skills/pre-pr-review/SKILL.md) for a cold review of
completed task work. It preserves the finished version, delegates investigation
and independent verification, and applies verified behavior-preserving fixes
locally. Ordinary changes follow [Task scope](workflow.md#task-scope); shipping
follows [ship](../.claude/skills/ship/SKILL.md). Review never fetches, syncs, pushes,
opens a PR, publishes or changes repository settings. It does not approve product
behavior or replace ship's current-main, CI and PM checks.

## Requests and results

PMs can use these requests without knowing review IDs, Git commands or paths:

| Request | Coordinator action |
| --- | --- |
| “Review my finished changes before a PR.” | Discover saved work, checkpoint selected finished files and start or resume the matching review. |
| “Continue my pre-PR review.” | Discover records on disk and resume the unique matching task; describe choices when ambiguous. |
| “Show me the reviewed version.” | Resolve the record and return its [accurately labeled preview](#preview). |
| “Clean up old review worktrees.” | Sweep eligible completed tasks and their superseded workspaces in this checkout; report retained work and reasons. |
| “Use ship to prepare the PR.” | Follow [ship handoff](#ship-handoff), discovering review evidence from disk even in a new conversation. |

Lead the PM handoff with exactly one of these outcomes:

- **Review complete; fixes applied** — independent evidence passed and local adoption completed.
- **Review complete; no fixes needed** — independent evidence passed for the unchanged finished version.
- **Review complete; fixes waiting to be applied** — review and verification completed, but an adoption guard prevents applying the fixes.
- **Review incomplete** — review, required verification or a product decision remains unresolved.

Then give a short account of fixes, grouped decisions or blockers, the exact
version and URL to test, and the next action. Keep Git details and evidence links
secondary. Requests such as “continue my review” or “show me the version I should test” route
to the same operations. Cleanup can cover completed tasks across this checkout;
pending or unrelated work is retained. A complete review with fixes waiting does not mean they are on the PM's
branch. Name missing previews unavailable; do not substitute an unverified version.

## Preflight and workers

Before checkpointing or starting expensive workers, inspect Git state and available
fresh-context delegation, Git, Python 3.11+, Node 22, Bash and Playwright/Chromium.
Use the [testing prerequisites](testing.md) and distinguish PASS, FAIL and BLOCKED.
Discover saved records first. If delegation cannot run, record the limitation and
stop the delegated review; independent safe work can continue, but never replace
it with a broad coordinator-only review or claim adoption-ready verification.
Unavailable checks stay BLOCKED; investigation can continue without automatic
adoption. Platform acceptance for this workflow feature is a separate
[before-merge requirement](pre-pr-review-platform-acceptance.md).

The main conversation coordinates. Use the host's default models and fresh
contexts (for example `fork_turns: "none"`). Assign a cold read-only reviewer, a
verifier independent of the fixer, and one fixer at a time. The reviewer and
baseline verifier may run concurrently; baseline evidence precedes fixes. Run
roles sequentially if capacity is limited. A verifier may resume its own baseline
context for final verification. Workers never delegate, modify the original
checkout or perform lifecycle operations; the coordinator owns those operations
and stops workers before adoption or cleanup.

Give each worker only its role, allowed writes, paths, evidence filenames, raw PM
requirements, affected packages, frozen SHAs/refs, relevant guidance and a bounded
task. Missing requirements are a named limitation, never inferred product intent
from implementation chat. Do not send implementation chat, suspected solutions or
prior conclusions to the cold reviewer. Workers load [CLAUDE.md](../CLAUDE.md), applicable
[code health](code-health.md), contracts/specifications and [testing](testing.md)
sections, preserving protected data and package boundaries. The fixer receives
verified actionable findings; the final verifier independently inspects the final
diff and reports, never relying on the fixer's pass claims. Set `PYTHONDONTWRITEBYTECODE=1` for managed-tree Python/check-all runs, reuse
installed Playwright through absolute `MB_PLAYWRIGHT_MODULE`, and direct every
report/output into `artifact_dir`. Generated ignored/untracked caches otherwise
block safe cleanup; retain them with a concrete reason unless the worker can
identify and remove its own exact disposable output. Never remove arbitrary ignored
data. Keep detailed logs in
artifacts; return concise status, finding IDs/severity, changed paths, commits,
blockers and evidence locations. Keep investigation follow-ups in worker contexts.

## Persistent lifecycle

Run `python3 scripts/pre-pr-review.py --help` and operation help from the original
checkout. On native Windows use the verified Python executable. The helper owns
local state under `<git-common-dir>/pre-pr-review/<id>/record.json`; resolve the
common directory with `git rev-parse --path-format=absolute --git-common-dir`.
Records and evidence are untracked and survive new conversations and successful
workspace cleanup. The coordinator selects IDs; PMs choose between descriptions
only when more than one review matches.

Schema version 1 records bind repository/common-directory identity, original
checkout and named branch, description/scopes, selected files and initial status,
`main_tip`, `comparison_base`, `finished`, checkpoint/review refs, artifact and
managed workspace paths, required checks, phase, workers, verification, adoption,
cleanup and predecessor/successor links. Managed workspaces are siblings at
`<checkout-name>-reviews/<id>/finished` and `.../reviewed`; paths and creation
intent are saved before creation. Retained refs are
`refs/heads/checkpoint/pre-pr-<id>` and `refs/heads/review/pre-pr-<id>`. Lifecycle
phases distinguish creation, ready review, successful completion and supersession;
operation intents retain interrupted checkpoint, adoption and cleanup state.
Never infer completion from an existing directory or a previous chat message.

| Operation | Coordinator use |
| --- | --- |
| `status --json` or `status ID --json` | Read-only discovery and observed workspace/evidence state, filtered to the original checkout/repository. Report corrupt, missing or legacy records without silently overwriting them. |
| `start --description TEXT --scope app --file PATH --json` | Generate an ID, selectively checkpoint exact complete files, freeze scope and create isolated workspaces. Repeat `--file` and `--scope`; scopes are `app`, `docs`, `tooling`, or `flow:ID`. Omit files when HEAD already is the finished checkpoint. |
| `resume ID [--import-legacy] --json` | Revalidate record ownership, refs, branch, workspace registrations/HEADs/cleanliness and evidence. Inspect interrupted operations before continuing. |
| `worker ID --role reviewer\|verifier\|fixer --worker-id HOST_ID --state active\|stopped --json` | Record real host worker ownership and lifecycle; immutable roles keep verifier and fixer identities independent. |
| `url ID --version original\|finished\|reviewed [--wsl-distro NAME] --json` | Resolve an exact available selector preview and its observed identity; see [Preview](#preview). |
| `adopt ID --verification PATH --json` | Validate independent SHA-bound evidence and original/review workspace guards, then ff-only adopt or complete an independently verified no-fix review. |
| `cleanup ID --json` or `cleanup --completed --json` | Retry only eligible completed-task cleanup; preserve refs and evidence. |

Every mutation takes the helper's exclusive common-directory operation lock and
saves records atomically. Never delete an uncertain lock based on age or process
assumptions. A recognized advisory lock may be acquired after its owner exits;
unknown/legacy lock contents require inspection. Never use network operations,
global worktree prune, forced removal, branch deletion or arbitrary directory
adoption. Do not search `.worktrees/` or include it in artifacts.

### Checkpoint and selection

Require a named task branch, local main and a unique merge base; main, detached
HEAD, conflicting index entries or unexplained Git operations block start. Preserve
local-only commits and unrelated work. Identify the finished task's complete files
before checkpointing. Commit exact selected tracked/new/deleted files, preserving
other index entries and unstaged/untracked bytes. Paths are literal, including
spaces and punctuation. Never use blanket staging, stash, reset or discard. Mixed
ownership inside a selected file requires a PM inclusion decision before dependent
checkpointing. Confirm the committed diff and remaining status.

Freeze full SHAs: `finished` is the checkpoint, `main_tip` is local main at start,
and `comparison_base` is their unique merge base. The cold review scope is the
complete `comparison_base..finished` task diff, never just the latest commit or
main-tip diff. If main moved beyond the merge base, distinguish its main-only
changes from task changes in the normal comparison.

Start resumes a unique unchanged matching record. Changed finished content or an
advanced task creates a successor with a new checkpoint and frozen scope, retaining
the old refs/evidence and linking both records. Multiple live matches require an
explicit coordinator selection after describing them to the PM. Never guess by
newest timestamp, silently overwrite a record or treat unrelated work as this task.
Unrelated dirty files may remain while isolated review runs; they block adoption
until the original checkout is clean without being silently committed.

### Recovery and legacy records

Resume rechecks actual state; prior PASS claims do not make missing or changed
evidence fresh. Recreate a missing committed workspace only at the retained exact
SHA, with an absent path and no conflicting registration. Existing dirty,
ignored-content, wrong-branch or wrong-HEAD paths are retained for inspection.
Never recover uncommitted content from a ref or delete a colliding directory.
Interrupted adoption must inspect whether the original still equals `finished` or
already equals the intended `reviewed`; the latter completes the saved operation
without merging twice. Any other original state remains untouched. Reconcile an
already removed workspace with cleanup intent idempotently.

Legacy records are discovery findings, never current ownership proof. Inspect the
original record, repository, refs, exact registered paths and retained SHAs before
explicit `resume ID --import-legacy`. Import requires canonical original/ref/sibling
workspace ownership, retains `record.legacy.json`, drops old verification and
requires a new independent review. Preserve the original artifacts. Do not assign
managed ownership to an arbitrary legacy path or carry forward a bare verified
flag. Without proved ownership and current independent evidence, retain legacy
workspaces and start a separate current-schema review; no automatic cleanup or
adoption is authorized by legacy metadata.

## Cold review, baseline and fixes

The read-only reviewer examines all task commits and follows callers, dependencies,
contracts and generated/package boundaries beyond changed lines. Apply
[code health](code-health.md) to touched areas without expanding into unrelated
cleanup. A passing check alone does not establish correctness. Write `findings.md`
with stable IDs, severity, file/line and commit, reproducible evidence, product
consequence and proposed action. Separate verified defects, questions and coverage
limitations.

The independent verifier runs `bash scripts/check-all.sh` and establishes actual
journey/browser coverage in the detached finished workspace, retaining full baseline
logs, statuses, warnings and named Flow coverage. Existing failures stay visible;
a later pass cannot erase them. Investigation and safe fixes may continue on an
unhealthy baseline, but automatic adoption waits for the gap to be resolved with
baseline checks/comparisons capable of proving preservation.

After baseline evidence exists, the sole fixer confirms verified findings and
makes scoped behavior-preserving fixes in the review workspace. Commit exact paths
with [short commit subjects](workflow.md#ship). Final verification binds a clean
committed reviewed SHA.

Preservation is relative to the PM's finished experience. A correction that changes
what participants see or do is a product decision. Group related choices and tell
the PM the current behavior, proposed behavior, consequence and recommendation.
Continue independent safe work while waiting. An accepted product change becomes
ordinary task work, then a new finished checkpoint and successor review. It never
relaxes checkpoint preservation or lets an approved difference pass as automatic
behavior preservation. Keep unresolved decisions out of automatic adoption.

## Independent verification and evidence

The independent verifier inspects `finished..reviewed`, including changed tests and
tools, verifies clean committed ancestry and repeats affected checks after material
changes. Retain two comparisons in separate directories:

| Comparison | Purpose |
| --- | --- |
| Finished checkpoint to reviewed SHA | Prove review fixes preserve the completed experience. |
| Frozen local main tip to reviewed SHA | Explain intended task differences and main-only differences for the eventual PR. |

Use full recorded SHAs and absolute evidence paths from the clean reviewed tree:

```sh
node tests/app-journeys.cjs --against "$finished" --out "$evidence/checkpoint/journeys"
node tests/browser/app-journeys-browser.cjs --compare "$finished" --out "$evidence/checkpoint/browser"
node tests/app-journeys.cjs --against "$main_tip" --out "$evidence/main/journeys"
node tests/browser/app-journeys-browser.cjs --compare "$main_tip" --out "$evidence/main/browser"
bash scripts/check-all.sh
python3 scripts/check-markdown-links.py
```

Inspect Phone, Tools, wiring/recognized renames, tracking/Useberry and browser
geometry/pictures separately. Journey exit zero alone does not prove unchanged
Tools, wiring or tracking. Checkpoint preservation never uses `--report`,
`--allow-declared`, declarations or relaxed thresholds to excuse differences.
Independently justified technical renames are not a waiver for changed controls,
tracking names or behavior. The main comparison may report explained intended
changes, but broken journeys, missing evidence and complete-check failures remain
blockers. Ship repeats the normal comparison with current main after syncing.

Both comparison sides use the reviewed harness. Independently inspect harness,
alias, normalization, coverage and threshold changes in both complete task and fix
diffs. If changed, retain an unchanged-checkpoint-harness control, run selftests and
relevant mutation/negative tests, and demonstrate a deliberate affected regression
is detected for the expected reason after a healthy control. Use isolated trees;
never alter the checkpoint. Follow [Changing verification](testing.md#changing-verification).
A weakened harness cannot validate itself with a green summary.

For each affected Flow, follow [Flow verification](testing.md#flow-verification):
name the Flow check, correct scope check (with frozen main `--against` when needed),
actual runtime/browser commands and before/after evidence on both committed trees.
Retain each Flow's Phone, Tools, wiring and tracking channels. App comparisons do
not prove Flow preservation. Missing coverage blocks automatic adoption. Docs-only
work explains why participant/Flow comparisons are unaffected; complete checks,
Markdown links and applicable skill validation still apply.

### Evidence contract

An independent verifier writes `verification.json` inside the record's artifact
directory; report paths remain inside that directory and name nonempty actual
logs/reports. The helper's `required_checks` and `verification()` in
[scripts/pre-pr-review.py](../scripts/pre-pr-review.py) enforce the machine schema.
This abbreviated shape illustrates binding, not a ready-to-submit passing report:

```json
{
  "schema_version": 1,
  "review_id": "ID_FROM_RECORD",
  "baseline": "FULL_FINISHED_SHA",
  "reviewed": "FULL_REVIEWED_SHA",
  "main_tip": "FULL_FROZEN_MAIN_SHA",
  "verifier_id": "REAL_INDEPENDENT_HOST_WORKER_ID",
  "cold_review": {
    "worker_id": "REAL_COLD_REVIEWER_ID",
    "baseline": "FULL_FINISHED_SHA",
    "status": "complete",
    "report": "findings.md"
  },
  "checks": [{
    "id": "check-all", "stage": "baseline", "sha": "FULL_FINISHED_SHA",
    "command": "bash scripts/check-all.sh", "status": "PASS",
    "exit_code": 0, "report": "baseline/check-all.log"
  }],
  "comparisons": {
    "checkpoint": {
      "base": "FULL_FINISHED_SHA", "head": "FULL_REVIEWED_SHA",
      "differences": [], "report": "checkpoint/verification.md",
      "channels": {
        "phone": {"status": "PASS", "report": "checkpoint/journeys/against.txt"},
        "tools": {"status": "PASS", "report": "checkpoint/journeys/against.txt"},
        "wiring": {"status": "PASS", "report": "checkpoint/journeys/against.txt"},
        "tracking": {"status": "PASS", "report": "checkpoint/tracking.md"},
        "browser": {"status": "PASS", "report": "checkpoint/browser/results.json"}
      }
    }
  },
  "browser": {"channel": "Chromium", "version": "ACTUAL_VERSION", "report": "browser-environment.md"},
  "harness": {"changed": false, "report": "harness-assessment.md"},
  "decisions": [],
  "limitations": []
}
```

Populate every required baseline/final check from the record, including final
check-all, Markdown links, journey/browser baseline and both final comparisons,
Flow checks and edited-skill validation. Every check names the actual command,
full tested SHA, status, numeric exit and actual report. The main comparison has
the same channel structure with `base = main_tip`; explained intended differences
use `DIFFERENT` with healthy journeys and an explanation. Docs-only scope instead
requires `participant_unaffected` with a reason and report. Named Flows need their
own checkpoint/main comparison objects in `flows[ID]`.

The machine `harness.changed` flag reflects any `tests/` or `scripts/` change in
the complete task or fix diffs. If changed, `harness` includes successful
`unchanged_checkpoint_control`, `selftests` and `negative_tests`, each bound to
baseline/reviewed with command, exit and report. Negative evidence also names
`regression_detected`, nonzero `regression_exit_code` and equal nonempty
`expected_reason`/`actual_reason`. Decision and limitation inventories are explicit;
resolved technical items include status, explanation and reports. Unresolved items
or product differences block automatic adoption. Keep unavailable platform checks
visible instead of inventing a resolved limitation.

Register actual reviewer/verifier/fixer IDs and stop their ownership after their
work. The verifier is distinct from reviewer and fixer and stops at the reviewed
SHA. The helper binds retained report hashes; changed/missing reports or SHAs make
evidence stale. Bare verified flags, empty lists/reports, failed/skipped/BLOCKED
required checks, unexplained channels, absent Flow coverage and self-excusing
harness changes cannot authorize adoption. Synthetic lifecycle fixtures establish
helper safety only; use the separate [actual-app and platform recipe](pre-pr-review-platform-acceptance.md)
for browser/host evidence.

## Adoption and cleanup

Before adoption, stop workers and independently establish every required check,
coverage and preservation gate above, including no-fix reviews. Immediately recheck
checkpoint/review refs, exact clean registered reviewed workspace and SHA,
`finished` ancestry, original checkout's recorded branch and its branch ref/HEAD
exactly equal to `finished`, and a clean original index/worktree including untracked
files. Never substitute another checkout or branch checked out elsewhere. The
helper persists adoption intent, revalidates evidence/guards, and runs
`git merge --ff-only --no-overwrite-ignore` only when those gates hold. Ignored
original files may remain when they do not collide with incoming tracked paths;
Git refuses collisions on both initial adoption and recovery, retaining the
adoption intent. After the owner resolves the collision, ordinary `resume ID`
rechecks the guards and completes adoption. Confirm original HEAD equals
reviewed, clean status and retained checkpoint. No-fix completion still requires
independent evidence; it needs no adoption commit.

If a guard fails, retain original, review, checkpoint and evidence, report why fixes
wait and show the precise available version. Never force, reset, cherry-pick around
the guard or merge divergent work.

Successful adoption/no-fix completion automatically removes eligible managed
finished/reviewed workspaces, including eligible superseded predecessors of the
completed task. Start/resume and ship retry eligible cleanup; an explicit
completed-task sweep is also available. Every removal requires recorded path and
ownership, matching registration/branch/HEAD, no active workers, successful task
completion and cleanliness including ignored content. Use `git worktree remove`
without force. Dirty, untracked, ignored, advanced, mismatched, active, legacy or
unrelated paths are retained with a reason. Pending reviews remain intact. Cleanup
is idempotent, preserves refs/evidence and unknown parent contents, and never deletes
branches or prunes registrations globally. All cleanliness gates conservatively
reject indexes containing assume-unchanged or skip-worktree entries, even when
status reports no changes. These flags and local bytes remain untouched; previews
label such trees as current task work rather than verified results.

## Preview

Use `url` and the shared `browser_url` converter in
[scripts/local-variants.py](../scripts/local-variants.py), preserving Windows,
WSL-distro/UNC and percent encoding. Return the selector URL, observed full SHA and
cleanliness. Label versions accurately:

- **Verified review result** only when exact clean reviewed SHA has current independent evidence.
- **Finished checkpoint** for the exact retained pre-review version.
- **Current task work** for a dirty or advanced original, with its observed SHA/status; never call it verified.
- **Unavailable** when a workspace/selector is absent, mismatched or unusable.

After successful workspace cleanup, use the original checkout URL only when it
still is the exact clean reviewed task result. Do not call that result the earlier
finished checkpoint when fixes changed it. If finished/reviewed previews were
removed, explain the missing historical preview; inspect the retained ref in a
separate safely managed checkout when needed, never reset the PM's branch.

## Ship handoff

A new conversation discovers records with
`python3 scripts/pre-pr-review.py status --json`; it never depends on remembered
IDs or chat logs. Resolve the current task's descriptions, findings and verification
artifacts, report incomplete/stale evidence, and retry eligible completed cleanup.
Carry fixes, checkpoint/ref, both comparisons, decisions and unresolved findings or
limitations into PR text. Do not automatically force this optional review on every
ship. [Ship](../.claude/skills/ship/SKILL.md) still performs normal sync, comparisons
with current main, complete checks, CI and applicable PM verification. For changes
to this workflow, [native Windows desktop-agent acceptance](pre-pr-review-platform-acceptance.md)
is required before merge; Docker-only prerequisites are the immediate follow-up,
not part of this implementation.
