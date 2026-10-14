---
name: start-work
description: Start a task or resume unfinished MoneyBuddy work safely when asked to begin work.
---

Inspect dirty files, branch history and local-only commits before selecting a base. Preserve unrelated work. Resume only a matching task; otherwise create a task branch with a short readable name (no date). Never silently stash or discard. Follow the Start work procedure.

Read [the shared workflow](../../../docs/workflow.md) before acting. All paths in
that document are relative to the repository root. Preserve the current session’s
authorization boundary in CLAUDE.md; branch/PR/CI authorization does not authorize
merge, settings changes or publication. Report observed results, not assumed remote success.

A request to narrow, shorten, reorder or start the prototype elsewhere (“only show the
emergency fund”, “skip onboarding”) is a Flow: use [create-flow](../create-flow/SKILL.md)
before writing code, never a switch in `app/`.
For creating/editing a named Flow or integrating a proposal, read [Flows](../../../docs/flows.md).
Record the full task base and intended package. Flow scope leaves app bytes unchanged;
app-integration scope selectively ports approved behavior and needs PM verification
of the integrated full app before the PR opens. Routine Flow work needs no subagents.
