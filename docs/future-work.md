# Future work (not implemented)

Agent-managed local alternatives are implemented in [local comparisons](local-variants.md).
Historical detached snapshot comparisons remain future work.

The pinned blue main (`b9e0332`) and HoffDemo-Chat (`ddee54e`, including HoffDemo
and HoffDemo-ESF at `8c7a252`) features are integrated into `app/`, as is the Big
Purchase Calculator from HoffDemo-BigPurchase (`b4abe14`; its calculator-first entry
is the Big purchase Flow). Keep those source branches intact. Later source commits
require a separate scope decision; do not restore editable `versions/` directories.
Publication and team cutover remain separate work. GitHub Issues, remote branch
deletion and Git history cleanup are outside this integration.

## Open cleanup

- **Purge `DEAD_BASELINE`.** The 26 functions on `scripts/sweep.js` §7b's baseline
  are unreferenced in `app/`. Several entries give reasons that no longer hold, such
  as "v3 still renders", from the retired v3/v3.1 copies. Remove them as a separate
  task, checking each with §7b rather than by grep.
