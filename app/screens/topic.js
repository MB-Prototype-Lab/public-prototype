// Filter current catalog lessons by badge so Tools overrides and Reset are
// reflected immediately. Lessons can advance several badges; show the other
// badges on each row to explain cross-badge progress.

function renderTopic() {
  const badge   = currentBadge();
  // Every lesson naming this badge as one of its contributors — see the header.
  const lessons = state.lessons.filter(l => l.badges.includes(badge.name));

  return `
    <!-- Badge mastery header -->
    <div class="card" style="position:relative;">
      ${badgeHasBonus(badge.name) ? `<span class="bonus-corner">⚡ Bonus</span>` : ""}
      <div style="display:flex;align-items:center;gap:16px;">
        ${renderBadgeRing(badge, "lg")}
        <div>
          <h1 class="title">${h(badge.name)}</h1>
        </div>
      </div>
    </div>

    <!-- Lesson list — data-driven from state.lessons -->
    <div class="card">
      <div class="section-title">Lessons</div>
      ${lessons.length ? lessons.map(lesson => `
        <div class="item-card" style="margin-bottom:10px;position:relative;">
          ${lesson.dailyTask ? `<span class="bonus-corner-sm">⚡</span>` : ""}
          <!-- Type tag: only shown for refreshers — "lesson" is implied by the section heading -->
          ${lesson.type === "refresher" ? `<span class="content-type-tag refresher">Refresher</span>` : ""}

          <div class="row" style="margin-top:6px;align-items:flex-start;">
            <div style="flex:1;">
              <!-- ▶ = lesson (content to consume), ↺ = refresher (revisit/recap) -->
              <div class="task-title" style="font-size:13px;">
                <span class="lesson-icon">${lesson.type === "refresher" ? "↺" : "▶"}</span>${h(lesson.title)}
              </div>
              <div class="task-desc">${h(lesson.description)}</div>
              <!-- Cross-badge disclosure: show if this lesson progresses more than just this badge -->
              ${lesson.badges.length > 1 ? `
                <div class="helper" style="margin-top:4px;">
                  Also progresses: ${lesson.badges.filter(n => n !== badge.name).map(n => `<strong>${h(n)}</strong>`).join(", ")}
                </div>
              ` : ""}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-left:12px;">
              <!-- Status badge: only show "completed" — not-started and in-progress are too noisy -->
              ${lesson.status === "completed" ? `
                <span class="state-badge completed">completed</span>
              ` : ""}
              <!-- Button label changes with status — Start / Continue / Revisit -->
              <button class="button ${lesson.status === "completed" ? "secondary" : ""}"
                      type="button"
                      onclick="selectLesson('${h(lesson.id)}')">
                ${lesson.status === "not-started" ? "Start"
                  : lesson.status === "in-progress" ? "Continue"
                  : "Revisit"}
              </button>
            </div>
          </div>
        </div>
      `).join("") : `
        <p class="helper">No lessons configured for this topic yet.</p>
      `}
    </div>

    <!-- Practice stays ungated (D31). Quiz uses the current lesson context;
         framed lessons enter lessonQuiz from their player. -->
    <div class="card">
      <div class="section-title">Practice</div>
      <div class="flow-footer" style="margin-top:8px;">
        <button class="button" type="button" onclick="go('quiz')">Quiz</button>
        <button class="button secondary" type="button" onclick="go('simulation')">Simulation</button>
      </div>
    </div>
  `;
}

// ─── Topic Admin Panel ────────────────────────────────────────────────────────
// Allows overriding lesson statuses for the current badge's lessons.
// Useful for testing specific content state scenarios during user research.

function renderTopicAdmin() {
  const badge   = currentBadge();
  const lessons = state.lessons.filter(l => l.badges.includes(badge.name));

  return `
    <div class="admin-card">
      <p class="admin-card-title">Topic: ${h(badge.name)}</p>
      <p class="helper">Override lesson statuses for testing content state scenarios.</p>
      <button class="button secondary full" style="margin-top:8px;"
              onclick="${lessons.map((l, _) => {
                const idx = state.lessons.indexOf(l);
                return `state.lessons[${idx}].status='not-started';`;
              }).join("")}render();">
        Reset all to Not Started
      </button>
    </div>

    ${lessons.map(lesson => {
      const idx = state.lessons.indexOf(lesson);
      return `
        <div class="admin-card">
          <p class="admin-card-title">${h(lesson.title)}</p>
          <div class="input-group">
            <label>Status</label>
            <select onchange="state.lessons[${idx}].status=this.value;render()">
              ${["not-started","in-progress","completed"].map(s =>
                `<option value="${s}" ${lesson.status === s ? "selected" : ""}>${s}</option>`
              ).join("")}
            </select>
          </div>
        </div>
      `;
    }).join("")}
  `;
}
