---
name: compare-local
description: Create and revise local MoneyBuddy alternatives, adopt a chosen option, clean up an explicitly selected comparison, or provide its browser URL. Use for requests such as make two alternatives, change option A, keep B, clean up this comparison, or show me the browser URL.
---

Read [local comparisons](../../../docs/local-variants.md) and the shared
[workflow](../../../docs/workflow.md). Use `scripts/local-variants.py` from the
primary checkout. This is local task work, not publication or integration into main.

For “Show me the browser URL,” run `python3 scripts/local-variants.py url` and relay
its exact URL in a code block. It detects WSL for Windows browsers and works without
an active comparison or `.env`. After creating alternatives, include the printed
selector URL and friendly option names in the PM handoff.

Inspect staged, unstaged, and untracked files before creation. Review each task file
and explicitly select checkpoint paths; preserve unrelated work and ask only if
ownership is ambiguous. Start all options from the current feature branch's shared
checkpoint. Do not run start-work inside a variant or create nested comparisons.

Implement requested alternatives in their recorded worktrees, run affected checks,
and refresh the manifest. Tell the PM the friendly labels and how to choose **Compare side by side** after unlocking the selector.
Explain that dropdowns and pane counts preserve progress until refresh or Back to
versions, Show tools widens a pane, and Restart preview resets only that variant.
Hidden previews keep running; pause audio before switching away. Standalone new-tab
links remain available when local-file embedding fails. A request to change A targets its registered checkout, not the primary app.
Never recursively search `.worktrees/` or include it in artifacts.

For “Keep B,” review and commit only B's task files, check the original branch is
clean, and adopt using a normal local merge. Resolve mechanical conflicts; ask about
competing product behavior while preserving the merge state. Run affected checks on
the merged primary checkout before `adopt --verified` closes the comparison.

Close retains all work. Cleanup requires concrete selected variant IDs and removes
only clean worktrees, retaining branches. Dirty work requires a separate preservation
or deletion decision; do not force removal. No pushes, main merges, or publication.
