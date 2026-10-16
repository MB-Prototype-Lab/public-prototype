# Future work (not implemented)

Agent-managed local variants are implemented in [local comparisons](local-variants.md).
Historical detached snapshot comparisons remain future work.

The pinned blue main (`b9e0332`) and HoffDemo-Chat (`ddee54e`, including HoffDemo
and HoffDemo-ESF at `8c7a252`) features are integrated into `app/`, as is the Big
Purchase Calculator from HoffDemo-BigPurchase (`b4abe14`; its calculator-first entry
is the Big purchase Flow). Keep those source branches intact. Later source commits
require a separate scope decision; do not restore editable `versions/` directories.
Publication and team cutover remain separate work. GitHub Issues, remote branch
deletion and Git history cleanup are outside this integration.

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
