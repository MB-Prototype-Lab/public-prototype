# MoneyBuddy agent instructions

Read [CLAUDE.md](CLAUDE.md) for the shared project constraints and reference map.
Project start-work, sync, ship and publish skills live in `.claude/skills/` and are
also discoverable through `.agents/skills`. Use their procedures for ordinary
workflow requests. Session authorization overrides the eventual remote workflow:
the organization rollout currently permits branch pushes, PR creation and CI
verification; merge, settings changes and publication require separate authorization.
Do not search `.worktrees/` or include it in artifacts.
