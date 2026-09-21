---
name: sync
description: Bring main into the current MoneyBuddy task branch when asked to sync or update work.
---

Inspect dirty work and remote-read authorization. Merge verified current main into the task branch; never rebase or force push. Resolve mechanical conflicts, ask the PM about product intent conflicts, and run affected checks.

Read [the shared workflow](../../../docs/workflow.md) before acting. All paths in
that document are relative to the repository root. Preserve the current session’s
authorization boundary; this implementation is local only until explicit remote
authorization. Report observed results, not assumed remote success.
