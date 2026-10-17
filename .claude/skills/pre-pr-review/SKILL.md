---
name: pre-pr-review
description: Review completed MoneyBuddy task work with independent agents, apply verified behavior-preserving fixes locally, resume a saved review, show its preview, or clean up completed review workspaces. Ordinary implementation and shipping keep their existing workflows.
---

Follow the [review procedure](../../../docs/pre-pr-review.md) for the requested
[start, resume, preview or cleanup](../../../docs/pre-pr-review.md#requests-and-results).
Discover saved reviews on disk and resolve their IDs for the PM. Preflight fresh
agent delegation, Git and test prerequisites before expensive work; use default
models and bounded worker packets. If delegation is unavailable, stop the delegated
review and report it BLOCKED.

The coordinator preserves the finished checkpoint, assigns a cold read-only
reviewer, an independent verifier and one fixer at a time. Workers never delegate.
PMs decide behavior; an accepted product change becomes task work and a new
finished checkpoint, with preservation gates unchanged. Adopt only after the
procedure's independent evidence and original-branch guards pass. Successful
completion automatically cleans eligible managed workspaces while retaining refs
and evidence. Report the outcome first, the exact version to test and the next
action. Review stays local; [ship](../ship/SKILL.md) is a separate request.
