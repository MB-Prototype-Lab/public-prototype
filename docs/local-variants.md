# Local comparisons

PMs ask “Make two alternatives,” “Change option A,” “Keep B,” or “Clean up this
comparison.” The agent handles Git and Python; the PM opens root `index.html`, enters
1337, and opens named alternatives in separate tabs or windows. There is one active
comparison per primary checkout. Closing restores the ordinary selector and retains
all alternative branches and worktrees. Published builds never contain local choices.

## Agent procedure

Read the compare-local skill. Run commands below from the primary checkout using
Python 3.11+ and Git. Inspect `git status --short`, staged and unstaged diffs, untracked
files, branch history, and registered worktrees (`git worktree list --porcelain`).
Select the current feature branch, never main, demo, or a HoffDemo branch. Preserve
unrelated files; ask only when ownership is ambiguous. Never stage everything.

```sh
python3 scripts/local-variants.py create --option 'A: Simple' 'One clear next step' --option 'B: Detailed' 'More context before choosing' --file app/screens/example.js
python3 scripts/local-variants.py status
python3 scripts/local-variants.py refresh
```

Omit `--file` when task work is already committed. Repeat it for each reviewed task
file (including deletions/new files); directories and pathspec patterns are not
accepted. Checkpoint commits include the selected working contents. Unrelated staged,
unstaged, and untracked files remain in the primary checkout and are not copied.
Every alternative starts at the same recorded checkpoint. Output supplies IDs,
branches, labels, and the primary root. Worktree URLs use `.worktrees/variant-A/`,
`.worktrees/variant-B/`, and so on (after Z comes AA). If names are already occupied
by retained branches or worktrees, the whole new comparison gets a matching suffix,
such as `variant-A-2` and `variant-B-2`. Existing comparisons keep their original IDs.
Use the exact recorded ID when adopting or cleaning up.
Implement each choice there and run affected checks from that exact checkout.
Do not recursively search `.worktrees/`; use the registered path for targeted work.
Run refresh after changes to the comparison; browser discovery is not automatic.

The ignored `.local-preview/` directory contains session records, the current session
ID, and atomically generated classic-script manifests. A variant's generated return
metadata uses a relative path to send its root selector to the primary root on
file://, including when a Windows browser opens the checkout through a WSL share. App and release
configuration are unchanged. Missing worktrees are reported and omitted from links.
Refresh the browser selector after an agent operation.

## Keep an alternative

Review the winner's diff and run its checks. Commit only identified task files (or
pass repeated `--file` arguments below). Preserve unrelated dirty files; adoption
requires both the chosen worktree and original checkout clean and the original branch
checked out in the primary. Then use the recorded ID, not the display label:

```sh
python3 scripts/local-variants.py adopt <variant-id> --file app/screens/example.js
# Run affected checks on the merged primary checkout, then:
python3 scripts/local-variants.py adopt <variant-id> --verified
```

The first step normally merges into the original feature branch, preserving its
intervening commits. Conflicts remain available for resolution. Resolve mechanical
conflicts and commit the merge; ask the PM about competing behavior. Run checks before
`--verified`, which confirms merge ancestry and closes the comparison. Failed checks
leave the comparison open; fix and verify the merged result before closing. No remote
operations or merges into main occur.

## Close, cleanup, and recovery

```sh
python3 scripts/local-variants.py close
python3 scripts/local-variants.py cleanup <variant-id> <another-variant-id>
python3 scripts/local-variants.py --session <old-session-id> cleanup <variant-id>
```

Cleanup requires a closed comparison and explicit managed IDs. It removes clean
worktrees without force, retaining branches. Dirty work or branch deletion needs a
separate concrete preservation/deletion decision. An archived session can be inspected
with `--session <id> status`; it cannot replace the current comparison's manifest.

Creation saves its intent before worktree operations. After an interruption, inspect
`status` and use `refresh --resume` to complete creation from the recorded checkpoint.
Unexpected branches, paths, or advanced partial branches are refused; inspect and
preserve them before repairing registration. Missing registered worktrees may need a
Git worktree repair before resuming. Close can end a partial comparison while retaining
its surviving alternatives. Do not delete session records to bypass an error.

An operation lock prevents concurrent tool mutations. If the process was killed,
verify no operation is running before removing the empty
`.local-preview/operation.lock` directory. Retry the recorded operation; merge conflicts
must be resolved or safely aborted first. Moving the primary checkout invalidates its
recorded paths: preserve the records and repair them deliberately before refreshing.
