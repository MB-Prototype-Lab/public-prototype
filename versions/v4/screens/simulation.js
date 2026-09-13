// ─── Simulation ───────────────────────────────────────────────────────────────
// TAB: Learn (sub-screen) | NAV BAR: Visible — Learn tab highlighted
//
// PURPOSE
// Interactive scenario practice — applies a lesson concept to a concrete
// financial decision (e.g. compare two loan structures) before returning to topic.
//
// NAVIGATION
//   Entry: Topic screen for simulation-type lessons
//   Exit:  "Done" button → topic screen
//
// STATES
//   Currently a single hardcoded example (loan tradeoff comparison).
//   No state dependencies — fully static.
//
// PRODUCTION NOTES
//   Content should be keyed by lessonId, matching the LP_SCRIPTS pattern in
//   lesson.js. Each simulation-type lesson provides its own scenario config.
//   The current hardcoded example is a placeholder to show the screen shape.

function renderSimulation() {
  return `
    <div class="home-header">
      <div>
        <h1 class="title">Simulation</h1>
        <p class="subtitle">Applied scenario practice.</p>
      </div>
</div>

    <div class="card" style="text-align:center;padding:32px 20px;">
      <div style="font-size:32px;margin-bottom:12px;">🧪</div>
      <div class="section-title" style="margin-bottom:8px;">Coming Soon</div>
      <p class="helper">
        Interactive scenario practice — apply lesson concepts to real financial decisions
        before returning to your topic. Coming in a future update.
      </p>
    </div>
  `;
}
