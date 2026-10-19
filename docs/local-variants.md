# Local comparisons

PMs ask “Make two variants” (or alternatives), “Change option A,” “Keep B,” or
“Clean up this comparison.” The agent handles Git and Python; the PM opens root
`index.html`, enters 1337, and opens a variant or chooses **Compare side by side**.
PM-facing text calls the choices **variants**. There is one active comparison per
primary checkout, and it targets either the full app or one Flow. Closing restores
the ordinary selector and retains all variant branches and worktrees. Published
builds never contain local choices.

## Find variants on the selector

Variants appear on the tab of what they change: **Prototype variants** below Local
Prototype, or **<Flow> variants** (for example **Emergency fund variants**) below
the Flows list. The tab shows how many there are, such as **Flows (2)**, and the
selector opens on that tab until the PM picks one in this browser session; a
remembered choice still wins. Each variant is a row with its name and description
that opens in the same tab, like the Flow rows. Use the browser's own link menu for
another tab. Exit Flow, Exit Prototype and an unpinned refresh from a variant return
to this selector.

## Compare in one tab

Choose **Compare side by side** below the variant rows. Two panes initially show the
first two valid variants. **Visible panes** offers one through the number of
choices, including **Local Prototype** (or **Local <Flow>** for a Flow comparison),
which is your current checkout and is not necessarily the original baseline. A Flow
comparison offers that baseline only while your checkout still lists the Flow; with
a single variant and no baseline there is nothing to compare and the button is hidden.

Each pane offers a variant dropdown, description, **Show tools**, **Restart preview**,
and **Open in new tab**. Choosing an already visible variant swaps the two panes.
Reducing the count hides the rightmost panes; increasing it restores their assignments.
Switching A+B to A+C and back preserves B's progress. Phone previews are about 460px
wide; Show tools widens one pane to 920px to expose the app's or Flow's Admin Tools.
If those tools are collapsed, use the expand arrow to open them. Scroll
horizontally to see panes that exceed the browser width; the preview region is also
keyboard focusable. Each preview is the full browser viewport height, just like
opening that app standalone. Controls stay above the previews in normal page flow;
scroll the page vertically to reach the preview bottoms. Long descriptions and
Show tools do not reduce preview height. Scrolling inside the app still works normally.

Progress lasts until refresh or exit through **Back to versions**, which returns to
the tab holding the variants. Restart resets only that variant; opening a new tab
starts a separate session. Hidden previews remain running, including audio: pause
playback before switching away. Refresh returns to the ordinary selector unless
**Pin on refresh**, beside **Visible panes**, is checked: then refresh reopens the
workspace with the same pane count, variant in each pane and tools widths, and every
pane starts fresh. Variants no longer in the comparison fall back to the defaults;
a layout kept for a different target (the app versus a Flow) is not reopened. The
pin is the same one as in Tools, shared by the whole browser tab; **Back to versions**
closes the workspace and keeps it set.
Inside a pane, Tools' own pin and Exit are disabled with a note, and reloading a
single pane restarts that app in place. Previews have independent documents and app state;
the workspace never reads their contents. If your browser cannot embed a local file,
use the standalone links. File embedding still needs Windows/WSL and macOS browser
verification, including checkout paths with spaces.

The workspace is local only, keeps its assignments in memory, and provides no
adoption, cleanup, merge, or publication controls. The agent still handles these
operations through the procedures below.

## Browser address

When a PM asks for their browser URL, run `bash scripts/checks.sh helper local-variants url`
from the primary checkout and paste the exact output URL into your response as a
code block. This works before any comparison exists and writes no local metadata.
Create, status, and refresh also print the selector, what is being compared, and each
available variant URL.

In WSL, the tool uses `wslpath -w` to translate the path for Windows, including
checkouts on mounted Windows drives. If translation is unavailable, it uses
`WSL_DISTRO_NAME` to construct a `file://wsl.localhost/<distro>/...` address.
Native Windows, macOS, and Linux use their local file URLs. All URLs encode spaces
and special characters. Nothing is stored in `.env` or tracked configuration.

If WSL is detected but its distro cannot be discovered, the tool explains the
problem instead of offering a Linux-only URL to a Windows PM. The agent can obtain
the name from the user's WSL terminal or `wsl --list --quiet` in Windows and run
`bash scripts/checks.sh helper local-variants url --wsl-distro <name>` as a one-time fallback.
The PM pastes the address into Brave or another browser, then enters `1337`.

Remote actions follow the [authorization boundary](../CLAUDE.md#collaboration).

## Agent procedure

Read the compare-local skill. Run commands below from the primary checkout using
the [container launcher](container-checks.md). The Bash examples below use
`bash scripts/checks.sh`; on Windows use `scripts/checks.ps1` with the same arguments. Host prerequisites are
Git and Docker; Python runs in the image. Inspect `git status --short`, staged and unstaged diffs, untracked
files, branch history, and registered worktrees (`git worktree list --porcelain`).
Select the current feature branch, never main, demo, or a HoffDemo branch. Preserve
unrelated files; ask only when ownership is ambiguous. Never stage everything.

```sh
bash scripts/checks.sh helper local-variants create --option 'A: Simple' 'One clear next step' --option 'B: Detailed' 'More context before choosing' --file app/screens/example.js
bash scripts/checks.sh helper local-variants create --flow emergency-fund --option 'A: Simple' 'One clear next step' --option 'B: Detailed' 'More context before choosing'
bash scripts/checks.sh helper local-variants status
bash scripts/checks.sh helper local-variants refresh
```

Without `--flow` the comparison is of the full app. `--flow ID` compares that one
Flow: its `flows/ID/flow.json` and `index.html` must be committed regular files (or
selected with `--file`), and `flow.json` must name the same ID and a label. These
are checked before any checkpoint commit, then again at the checkpoint. In a Flow
comparison, implement each variant only inside `flows/ID/`, never `app/`, another
Flow, the root `index.html` or `gate/`; the selector, exits and return paths depend
on those staying as checkpointed. A new Flow needs its package committed first.
Omit `--file` when task work is already committed. Repeat it for each reviewed task
file (including deletions/new files); directories and pathspec patterns are not
accepted. Checkpoint commits include the selected working contents. Unrelated staged,
unstaged, and untracked files remain in the primary checkout and are not copied.
Every variant starts at the same recorded checkpoint. Output supplies IDs,
branches, labels, and the primary root. Branches use `variant/<task>-A`,
`variant/<task>-B`, and so on, where `<task>` is the current task branch without
its leading `work/`. Worktree URLs use `.worktrees/variant-A/`,
`.worktrees/variant-B/`, and so on (after Z comes AA). If names are already occupied
by retained branches or worktrees, the whole new comparison gets a matching suffix,
such as `variant-A-2` and `variant-B-2`, with branches
`variant/<task>-A-2` and `variant/<task>-B-2`. Existing comparisons keep their
recorded IDs and branches, including legacy names accepted for cleanup.
Use the exact recorded ID when adopting or cleaning up.
Implement each choice there and run affected checks from that exact checkout.
Do not recursively search `.worktrees/`; use the registered path for targeted work.
Run refresh after changes to the comparison; browser discovery is not automatic.

The ignored `.local-preview/` directory contains session records, the current session
ID, and atomically generated classic-script manifests. Session records store the
target's kind, Flow ID and label (older records without one mean the app); the
manifest adds the derived entry path, and each variant link is that path inside its
worktree. A variant's generated return metadata uses a relative path to send its
root selector to the primary root on file://, including when a Windows browser opens
the checkout through a WSL share. A variant Flow's exits reach that worktree root
first, so they return the same way. App, Flow and release configuration are
unchanged. Missing worktrees, and variants missing the target's entry file, are
reported and omitted from links. Refresh the browser selector after an agent operation.

## Keep a variant

Review the winner's diff and run its checks. Commit only identified task files (or
pass repeated `--file` arguments below). Preserve unrelated dirty files; adoption
requires both the chosen worktree and original checkout clean and the original branch
checked out in the primary. Then use the recorded ID, not the display label:

```sh
bash scripts/checks.sh helper local-variants adopt <variant-id> --file app/screens/example.js
# Run affected checks on the merged primary checkout, then:
bash scripts/checks.sh helper local-variants adopt <variant-id> --verified
```

The first step normally merges into the original feature branch, preserving its
intervening commits. Conflicts remain available for resolution. Resolve mechanical
conflicts and commit the merge; ask the PM about competing behavior. Run checks before
`--verified`, which confirms merge ancestry and closes the comparison. Failed checks
leave the comparison open; fix and verify the merged result before closing. No remote
operations or merges into main occur.

For a Flow comparison, both steps refuse a variant whose changes since the
checkpoint reach outside `flows/ID/`; only the generated `flows/catalog.json` and
`flows/catalog.js` are also allowed. Renames are not followed, so a move out of
`app/` still counts. The refusal lists the files: explain them to the PM in plain
terms, then revert them in the variant or obtain a separate decision. Never work
around it. After the merge run `python3 scripts/flows.py check`,
`python3 -m unittest tests.test_flows`, `bash scripts/check-syntax.sh flows` and
`node tests/flows-runtime.cjs` (plus the Flow's affected behavior checks) before
`--verified`. Keeping a Flow variant updates that Flow only; it is not app
integration (see [Flows](flows.md)).

## Close, cleanup, and recovery

```sh
bash scripts/checks.sh helper local-variants close
bash scripts/checks.sh helper local-variants cleanup <variant-id> <another-variant-id>
bash scripts/checks.sh helper local-variants --session <old-session-id> cleanup <variant-id>
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
its surviving variants. Do not delete session records to bypass an error.

An operation lock prevents concurrent tool mutations. If the process was killed,
verify no operation is running before removing the empty
`.local-preview/operation.lock` directory. Retry the recorded operation; merge conflicts
must be resolved or safely aborted first. Moving the primary checkout invalidates its
recorded paths: preserve the records and repair them deliberately before refreshing.

## Verification

Local comparison tests use disposable repositories to check selective checkpointing,
common starting commits, original-branch advancement, merge conflicts, interrupted
creation, path/branch collisions, and preservation during cleanup. They also cover
Flow targets: Flow links, refusal of unusable Flows before any commit, sessions
without a target, and refusal to keep a Flow variant that changed files outside its
Flow (including renames). The Node selector test covers missing/invalid manifests and
targets, safe row rendering, placement on the target's tab with its count and
suggested tab, the Flow baseline, pane assignments and swaps, count changes, retained
iframe identity, tools toggles, restart isolation, layout records per target, and
exit to the right tab. The tab test covers suggested versus remembered tabs.
Publication tests assert local controls and metadata never appear in output.

For comparison changes, manually check file:// in separate tabs/windows, independent
app state, and refresh from each app through its root selector to the primary
selector. For a Flow comparison, also check from a variant Flow, standalone and in a
pane: Exit Flow and an unpinned refresh return to the primary selector on the Flows
tab, a pinned refresh restarts the variant, and in a pane Exit and the pin are
disabled. Check the selector's variant rows at phone width and in dark mode. Check
checkout paths with spaces on Windows and macOS. Automated DOM and Git tests do not
substitute for these browser/platform checks; record unavailable checks explicitly.

For the side-by-side workspace, browser-check file embedding early on Windows/WSL
and macOS, including paths with spaces. Verify laptop and ultrawide layouts, all
four app themes, keyboard scrolling and controls, input focus, independent progress,
A+B → A+C → A+B, swaps, pane counts, tools widths, isolated restart, new tabs, refresh,
and Back to versions. With the toolbar's Pin on refresh checked, refresh must reopen
the same pane count, assignments and tools widths with fresh panes; Back to versions
keeps the pin. Inside a pane, Tools' pin and Exit are disabled with a note, and
reloading one pane restarts it in place. Hidden previews retain state and keep running audio; pause
playback before hiding them. A frame load event alone does not prove the app loaded.

For preview sizing, check 1366×768, 1440×900, and 3440×1440 with two and four panes.
Each iframe should match the browser viewport height within rounding tolerance;
compare the phone against the standalone app at the same viewport height (720px at
768px, capped at 820px). Verify page scrolling reaches every preview bottom and
the stage has no vertical scroll range. Check horizontal scrolling by trackpad,
scrollbar, and keyboard, long descriptions, all four themes, and Show tools.
Resizing, swaps, pane-count changes, and tools toggles must preserve input progress.
Record Windows/WSL and macOS results separately; Linux browser checks do not verify
compatibility with either platform.
