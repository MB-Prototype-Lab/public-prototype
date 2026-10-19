---
name: run-checks
description: Build or diagnose the MoneyBuddy Docker check environment and run automated checks or comparisons. Use for setup checks, run all checks, or compare changes with main; use pre-pr-review for independent review and ship for PR preparation.
---

Read [container checks](../../../docs/container-checks.md). Use the PowerShell
launcher on native Windows and the Bash launcher in WSL/POSIX or Git Bash.
Host prerequisites are Git and Docker running Linux containers. Build missing or
stale images as part of the requested check; do not ask PMs to install Node,
Python, Playwright or Unix utilities.

For setup, run `doctor`, which builds the image and verifies it. Use `build` alone
when the request is to prepare the image without running checks. For all
checks, run `all`; for comparisons use `compare --base REF`. Inspect branch and
working-copy state first and record which source mode and full SHAs were tested.
Use committed mode for review attestations; working-copy checks include selected
uncommitted files and do not prove that a committed snapshot contains those edits.

For managed review workspaces, set `MB_CHECK_OUTPUT_ROOT` to the record's existing
absolute `host_artifact_dir` for every run; the default output inside a workspace
would prevent safe cleanup. Other runs use `.container-checks` by default. Tests
can run from linked worktrees; lifecycle/helper commands use the primary checkout.

Retain logs and reports, investigate failures, and report PASS, FAIL or BLOCKED
accurately. Give the PM a concise result and usable host report links. If Docker
is stopped or unavailable, describe the concrete prerequisite to fix; never
silently replace missing container evidence with host-tool success.

Independent review, adoption, remote writes and publication keep their existing
skills and authorization boundaries. Checks do not authorize those actions.

When skills changed, also run the
[targeted skill validator](../../../docs/container-checks.md#targeted-skill-validation)
inside the image for each edited skill directory.

Use the operator's normal host Git; Git 2.43 is supported. Never install or select a
parallel newer host Git to bypass a lifecycle guard. New managed workspaces are
independent repositories; preserve legacy linked-worktree records and follow the
helper's explicit recovery constraints.
