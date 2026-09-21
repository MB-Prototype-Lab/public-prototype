// ─── Topic (Badge Detail) Page ────────────────────────────────────────────────
// TAB: Education (sub-screen) | NAV BAR: Visible
//
// One badge, and every lesson that moves it. Reached from the Learn tab's badge
// board or its search results; leaves into the lesson player via selectLesson.
//
// ── A LESSON BELONGS TO SEVERAL BADGES ───────────────────────────────────────
// This is the structural fact the whole screen is arranged around, and it is
// lessons.json's own stated design: "A lesson belongs to several courses.
// Progress is on the lesson, so cross-cutting lessons level faster." The APR
// lesson sits under three badges and finishing it moves all three.
//
// Two consequences visible here:
//   · the same lesson appears on more than one topic page — not duplication
//   · each row discloses the OTHER badges it moves, so a tester can see why
//     one lesson advanced three rings
//
// ── NOTHING IS HARDCODED ─────────────────────────────────────────────────────
// The list is filtered out of state.lessons at render time, so the admin panel's
// status overrides and a test reset both take effect immediately. A literal list
// here would drift from the catalog the moment either was used.

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

    <!-- ── Practice ──
         Deliberately NOT gated on finishing the lessons above. Nothing in the
         prototype locks content behind progress (L16/D31), and a quiz you have
         to earn would imply a progression system that does not exist.

         This button goes to the V2 quiz (screen "quiz"). The v3 lessons reach
         their own quiz — screen "lessonQuiz" — at the end of the player
         instead, so the two never collide. See the trap note in CLAUDE.md. -->
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
