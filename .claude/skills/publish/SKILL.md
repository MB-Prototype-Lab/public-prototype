---
name: publish
description: Prepare an explicit MoneyBuddy snapshot publication or selector lifecycle change.
---

Read docs/publishing.md and execute its resumable release procedure. Confirm ongoing study status with PMs alongside tracking choice; ask only when ambiguous. Frozen source tags and publication tags are separate. Never infer publication authorization from shipping. Retirement requires the explicit acknowledgement described in the procedure.

Read [the shared workflow](../../../docs/workflow.md) before acting. All paths in
that document are relative to the repository root. Preserve the current session’s
authorization boundary in CLAUDE.md; branch/PR/CI authorization does not authorize
merge, settings changes or publication. Report observed results, not assumed remote success.

For a named Flow, read [Flows](../../../docs/flows.md) and prepare with
`python3 scripts/publish.py prepare --flow ID --id SNAPSHOT_ID --commit FULL_MAIN_SHA --label LABEL --tracking on|off`.
Select a tested committed package on verified current main. Keep working Flow ID
separate from immutable snapshot ID; preparation does not create tags or deploy.
Preserve legacy format behavior and every retained snapshot identity.
