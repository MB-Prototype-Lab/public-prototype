---
name: start-work
description: Start a task or resume unfinished MoneyBuddy work safely when asked to begin work.
---

Inspect dirty files, branch history and local-only commits before selecting a base. Preserve unrelated work. Resume only a matching task; otherwise create a task branch with a short readable name (no date). Never silently stash or discard. Follow the Start work procedure.

Read [the shared workflow](../../../docs/workflow.md) before acting. All paths in
that document are relative to the repository root. Remote actions follow the
[authorization boundary](../../../CLAUDE.md#collaboration). Report observed results,
not assumed remote success.

A request to narrow, shorten, reorder or start the prototype elsewhere (“only show the
emergency fund”, “skip onboarding”) is a Flow: use [create-flow](../create-flow/SKILL.md)
before writing code, never a switch in `app/`.
For creating/editing a named Flow or integrating a proposal, read [Flows](../../../docs/flows.md).
Record the intended package; no base needs recording, since `flows.py scope` diffs
app/ from the merge base with main. Flow scope leaves app bytes unchanged;
app-integration scope selectively ports approved behavior and needs PM verification
of the integrated full app before the PR opens. Routine Flow work needs no subagents.
