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

Use the operator's chosen environment: native Windows or WSL/POSIX. Preflight
Git and Docker there; run helpers with `checks.ps1 review` or
`bash scripts/checks.sh review` and checks through the
[container launcher](../../../docs/container-checks.md). Do not require host Python,
Node, a second environment or native Git/Git Bash for a WSL operator. Follow [platform acceptance](../../../docs/pre-pr-review-platform-acceptance.md)
for applicable evidence.

The coordinator preserves the finished checkpoint, assigns a cold read-only
reviewer, an independent verifier and one fixer at a time. Workers never delegate.
PMs decide behavior; an accepted product change becomes task work and a new
finished checkpoint, with preservation gates unchanged. Adopt only after the
procedure's independent evidence and original-branch guards pass. Successful
completion automatically cleans eligible managed workspaces while retaining refs
and evidence. Report the outcome first, the exact version to test and the next
action. Review stays local; [ship](../ship/SKILL.md) is a separate request.

Before any check in a managed finished/reviewed workspace, set
`MB_CHECK_OUTPUT_ROOT` to the record's existing absolute `host_artifact_dir`.
Include that setting in verifier/fixer packets so captures and reports stay outside
managed workspaces and eligible cleanup remains possible. See the procedure's
[worker output rules](../../../docs/pre-pr-review.md#preflight-and-workers).
