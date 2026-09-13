// --- Reward Preview Screen ---------------------------------------------------
// TAB: Education (sub-screen) | NAV BAR: Visible
//
// What finishing this lesson pays, shown BEFORE it starts: XP, the daily-task
// bonus if one applies, and which other badges it moves.
//
// -- WHY SHOW THE REWARD FIRST --------------------------------------------------
// A lesson costs a few minutes and the badges unlock nothing (L16), so the
// honest pitch is the progress itself. Naming it up front is also what makes
// the reward screen checkable: the tester saw a figure going in and can hold
// the payout against it.
//
// The cross-badge line is the part people do not expect -- a lesson belongs to
// several courses and finishing it moves all of them (lessons.json). Disclosing
// that here is why three rings moving at the end reads as designed rather than
// as a bug.
//
// NOT on the main path. Lessons opened from the Learn tab or a daily task go
// straight into framing and then the player; this screen is reachable from the
// admin jump list and kept for the v2 flow that used it (L14).

function renderRewardPreview() {
  const lesson = state.currentLesson;

  if (!lesson) {
    return `
      <div class="card">
        <h1 class="title">Lesson</h1>
        <p class="subtitle">No lesson selected. Open a lesson from a topic page.</p>
      </div>
      <div class="flow-footer">
        <button class="button secondary" type="button" onclick="navGoTabRoot('learn')">Back to Learn</button>
      </div>
    `;
  }

  const allBadges = lesson.badges;

  return `
    <div class="card">
      ${lesson.type === "refresher"
        ? `<span class="content-type-tag refresher" style="margin-bottom:8px;display:inline-block;">Refresher</span>`
        : ""}
      <h1 class="title">${h(lesson.title)}</h1>
      <p class="subtitle">${h(lesson.description)}</p>
    </div>

    <!-- Daily bonus callout — shown only for daily-task lessons -->
    ${lesson.dailyTask ? `
      <div class="card card--warn">
        <div style="font-size:13px;font-weight:850;color:var(--warn);">⚡ Daily Task Bonus</div>
        <p class="helper" style="margin-top:4px;">
          Completing this lesson earns
          <strong>${lesson.xp * state.xpConfig.bonusMultiplier} XP per badge</strong>
          (${state.xpConfig.bonusMultiplier}× daily multiplier applied to base ${lesson.xp} XP).
        </p>
      </div>
    ` : ""}

    <!-- Cross-badge disclosure -->
    ${allBadges.length > 1 ? `
      <div class="card">
        <div class="section-title" style="font-size:13px;">Progresses ${allBadges.length} badges</div>
        <div class="pill-row" style="margin-top:6px;">
          ${allBadges.map(name => `<span class="pill">${h(name)}</span>`).join("")}
        </div>
      </div>
    ` : ""}

    <div class="flow-footer">
      <button class="button secondary" type="button" onclick="go('topic')">Back</button>
      <button class="button" type="button" onclick="startCurrentLesson()">Begin Lesson</button>
    </div>
  `;
}
