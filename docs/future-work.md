# Future work (not implemented)

Agent-managed worktrees may live under the primary checkout's `.worktrees/`, which
is ignored and excluded from artifacts and searches. Editable worktrees get distinct
task branches; historical comparisons use detached snapshot revisions. Never create
worktrees recursively. Inspect dirty files and local-only commits before cleanup and
preserve unfinished work. Current workflow rules govern historical checkouts. A local
comparison selector is optional future work.

Leave HoffDemo, HoffDemo-Chat and HoffDemo-ESF branches untouched. Later compare chosen
features against app/ and port only approved behavior with tests and PM review. Never
bulk merge their legacy directories or resurrect editable versions/. GitHub Issues,
remote branch deletion and Git history cleanup are outside this effort.
