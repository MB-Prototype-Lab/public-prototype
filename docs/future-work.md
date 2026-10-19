# Future work (not implemented)

Historical detached snapshot comparisons remain future work.

Keep `HoffDemo`, `HoffDemo-ESF`, `HoffDemo-Chat` and `HoffDemo-BigPurchase`
source branches intact. Later source commits require a separate scope decision;
do not restore editable `versions/` directories. Publication remains separate
work. GitHub Issues, remote branch deletion and Git history cleanup are outside
this scope.

## Immediate follow-up: Docker test environment

After the current review-workflow PR lands, containerize the automated checks and
review comparisons so operators can use their preferred native Windows or WSL
client without maintaining two environments. Keep test runtimes and browser
dependencies in a pinned image, preserve exact-source selection and review safety,
and return reports and usable previews to the host. The
[Docker acceptance scope](pre-pr-review-platform-acceptance.md#immediate-follow-up-docker-prerequisites)
owns the implementation and validation requirements. Docker is not implemented
by the current PR.

## Half-wired features (deleted; Git history keeps the code)

- **Help me out from an emergency fund row.** `esfRunHelp` handed one row to a Help me out tree and took the figure back, but no screen offered it.
- **Showing where a figure came from.** `esfRowSource` wrote a source line for each estimated row, but nothing showed it; it needs a voice pass as on-screen disclosure.
- **The rent-or-own correction.** `esfToggleOwns` let the tester correct whether they own their home after its card was cut; a correction would sit on the last step beside the owner-only rows.
- **Big purchase info sheets.** The credit-score table, the car-loan interest tax break and its in-app page, the savings-rate picker and the loan-or-cash comparison were built as sheets, but nothing opened them.

## Outstanding publication PM checks

The deployment result and HTTP responses do not establish visual or participant
study behavior. Repository cutover is complete. Record outstanding PM checks for
passcode/selector refresh, historical entry paths/media, narrow layouts/themes,
participant deep links and active studies separately; do not infer those results
from cutover. Retain `demo`, historical publication identities and PM branches.
Windows/WSL and macOS browser evidence must be recorded separately; automated
rehearsals do not establish either platform.
