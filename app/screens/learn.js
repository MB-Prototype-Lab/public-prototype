// ─── Learn Tab ────────────────────────────────────────────────────────────────
// TAB: Education | NAV BAR: Visible
//
// The Education tab. Three bands, top to bottom:
//
//   1. SEARCH        — filters badges and lessons, and takes over the screen
//                      while it has a query
//   2. SUGGESTED     — at most two rows: a badge with a bonus lesson available,
//                      and the last badge the tester actually opened
//   3. BADGE BOARD   — every topic, always unlocked (L16/D31: nothing gates)
//
// ── WHERE THE CONTENT COMES FROM ─────────────────────────────────────────────
// This screen renders the V2 catalog — `state.badges` and `state.lessons` — not
// LESSONS_V3. The two coexist deliberately (L9/L14): v3's three authored
// lessons live in LESSONS_V3 and are reachable through the same rows, because
// selectLesson looks up state.lessons and lessonOpenPlayer swaps in the v3
// script. So a tester sees one catalog and never learns there are two.
//
// ── THIS TAB IS NOT THE GUIDED PATH ──────────────────────────────────────────
// Daily tasks are. A task is a contextual bookmark that opens the same lesson
// from Home (architecture §9), and it carries the Charity Points and the XP
// bonus. This tab is for browsing on purpose rather than being pointed.

// ── Search ───────────────────────────────────────────────────────────────────
// Search is the one place on this screen that does NOT go through render().
//
// The app's whole model is "mutate state, call render(), replace the screen's
// innerHTML". That is fatal for a text input: the element being typed into is
// destroyed mid-keystroke and focus and cursor position go with it. So search
// writes state and then patches ONE element (#searchResults) by hand.
//
// The debounce is a second, smaller concern — it stops a fast typist rebuilding
// the result list on every character.
let _searchDebounce = null;
function onSearchInput(val) {
  state.searchQuery = val;
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(renderSearch, 200);
}

/**
 * Repaint the results list in place.
 *
 * Two elements move: #searchResults gets the matches, and #learnMain is hidden
 * while a query is active so results own the screen rather than being pushed
 * below a full badge board. Both are found by id — nothing here re-renders.
 */
function renderSearch() {
  const q    = state.searchQuery.toLowerCase().trim();
  const el   = document.getElementById("searchResults");
  const main = document.getElementById("learnMain");
  if (!el) return;

  // Toggle main content visibility: hide when search is active
  if (main) main.style.display = q ? "none" : "";

  if (!q) { el.innerHTML = ""; return; }

  const matchBadges  = state.badges.filter(b =>
    b.name.toLowerCase().includes(q));
  const matchLessons = state.lessons.filter(l =>
    l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));

  if (!matchBadges.length && !matchLessons.length) {
    el.innerHTML = `<p class="helper" style="padding:8px 0;">No results for "${h(q)}"</p>`;
    return;
  }

  el.innerHTML = `
    ${matchBadges.length ? `
      <div style="font-size:11px;font-weight:850;color:var(--muted);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.05em;">
        Badges (${matchBadges.length})
      </div>
      ${matchBadges.map(b => `
        <div class="item-card" style="margin-bottom:8px;">
          <div class="row">
            <div style="display:flex;align-items:center;gap:12px;">
              ${renderBadgeRing(b, "sm")}
              <div>
                <div class="task-title">${h(b.name)}</div>
                <div class="task-desc">${h(b.tier)} ${b.level} &bull; ${b.progress}%</div>
              </div>
            </div>
            <button class="button secondary" type="button" onclick="selectBadge('${h(b.name)}')">Open</button>
          </div>
        </div>
      `).join("")}
    ` : ""}

    ${matchLessons.length ? `
      <div style="font-size:11px;font-weight:850;color:var(--muted);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.05em;">
        Lessons (${matchLessons.length})
      </div>
      ${matchLessons.map(l => `
        <div class="item-card" style="margin-bottom:8px;">
          <div class="row" style="align-items:flex-start;">
            <div style="flex:1;">
              <div class="task-title">
                <span class="lesson-icon">${l.type === "refresher" ? "↺" : "▶"}</span>${h(l.title)}
              </div>
              <div class="task-desc" style="margin-top:2px;">${h((l.badges || []).join(" · "))}</div>
            </div>
            <button class="button ${l.status === "completed" ? "secondary" : ""}"
                    type="button" onclick="selectLesson('${h(l.id)}')">
              ${l.status === "not-started" ? "Start"
                : l.status === "in-progress" ? "Continue"
                : "Revisit"}
            </button>
          </div>
        </div>
      `).join("")}
    ` : ""}
  `;
}

function renderLearn() {
  // ── The two suggested rows ──
  // "Suggested" is the first badge with a bonus lesson going — a reason to open
  // that topic now rather than any other.
  const suggestedBadge = state.badges.find(b => badgeHasBonus(b.name));

  // "Previous" is the most recent badge the tester opened, SKIPPING whatever is
  // already in the suggested slot. Without that filter the same badge appears
  // twice, which reads as a bug rather than as two different recommendations.
  const previousBadge = (state.recentlyActive || [])
    .map(name => state.badges.find(b => b.name === name))
    .filter(b => b && (!suggestedBadge || b.name !== suggestedBadge.name))
    .find(Boolean);

  // Both rows can be absent — a fresh tester has opened nothing and may have no
  // bonus available. The whole Suggested card is then omitted rather than
  // rendering an empty heading (D19: no screen renders empty, and an empty
  // section is the same failure in miniature).
  const hasSearch = !!state.searchQuery;

  return `
    <!-- Search bar — writes to state.searchQuery, updates #searchResults without
         full render so the input keeps focus -->
    <div class="card" style="margin-bottom:10px;">
      <input id="learnSearch"
             value="${h(state.searchQuery)}"
             placeholder="Search topics or lessons…"
             oninput="onSearchInput(this.value)"
             style="width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);font-size:13px;outline:none;box-sizing:border-box;">
      <div id="searchResults" style="margin-top:${hasSearch ? "10px" : "0"};">
        <!-- Populated by renderSearch() — no full render, no focus loss -->
      </div>
    </div>

    <!-- Main content: hidden when search is active so results take over -->
    <div id="learnMain" style="${hasSearch ? "display:none;" : ""}">

      ${(suggestedBadge || previousBadge) ? `
      <div class="card">
        <div class="section-title">Suggested Lessons</div>

        ${suggestedBadge ? `
          <div class="item-card" style="margin-bottom:8px;">
            <div class="row">
              <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                ${renderBadgeRing(suggestedBadge, "sm")}
                <div style="min-width:0;">
                  <div class="task-title">${h(suggestedBadge.name)}</div>
                  <span class="bonus-label" style="display:inline-block;margin-top:5px;">⚡ Bonus</span>
                </div>
              </div>
              <button class="button icon-btn" type="button"
                      onclick="selectBadge('${h(suggestedBadge.name)}')">›</button>
            </div>
          </div>
        ` : ""}

        ${previousBadge ? `
          <div style="font-size:11px;font-weight:850;color:var(--muted);margin:10px 0 6px;">
            Previous Lesson
          </div>
          <div class="item-card">
            <div class="row">
              <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                ${renderBadgeRing(previousBadge, "sm")}
                <div style="min-width:0;">
                  <div class="task-title">${h(previousBadge.name)}</div>
                </div>
              </div>
              <button class="button icon-btn" type="button"
                      onclick="selectBadge('${h(previousBadge.name)}')">›</button>
            </div>
          </div>
        ` : ""}
      </div>
      ` : ""}

      <!-- ── Badge board ──
           Every topic, always open. "All topics unlocked" is a statement of
           design rather than a status: nothing in the prototype gates content
           behind progress, and badges are vanity (L16). A locked-looking grid
           would imply a progression system that does not exist. -->
      <div class="row" style="margin-bottom:12px;">
        <div class="section-title" style="margin:0;">Badge Board</div>
        <div class="helper">All topics unlocked</div>
      </div>

      <div class="badge-grid">
        ${state.badges.map(b => `
          <div class="badge-card" style="position:relative;">
            ${badgeHasBonus(b.name) ? `<span class="bonus-corner-sm" style="top:8px;right:10px;">⚡</span>` : ""}
            <div class="badge-name" style="margin-bottom:10px;">${h(b.name)}</div>
            <div style="display:flex;justify-content:center;margin-bottom:10px;">
              ${renderBadgeRing(b, "md")}
            </div>
            <div style="margin-top:auto;">
              <button class="button full" type="button" onclick="selectBadge('${h(b.name)}')">Open</button>
            </div>
          </div>
        `).join("")}
      </div>

    </div>
  `;
}

// ─── Learn Admin Panel ────────────────────────────────────────────────────────
// XP tuning levers, lesson status overrides and badge progress, so a test
// session can be steered without a code edit or a reload.
//
// This is the surface state.xpConfig exists for (L9): lessons.json fixes the
// five-tier progression and the XP values, and xpConfig keeps the multipliers
// hot-editable. Change bonusMultiplier here and the next lesson completion uses
// it — see completeLesson in js/navigation.js.

function renderLearnAdmin() {
  return `
    <!-- XP Configuration — the PRD's three core tuning levers -->
    <div class="admin-card">
      <p class="admin-card-title">XP Configuration</p>
      <p class="helper" style="margin-bottom:10px;">
        Bonus multiplier applies to daily-task lessons.
        Discounted rate applies to manual learning after daily bonus is consumed.
        Questions required controls how many correct answers end a quiz session.
      </p>
      <div class="input-group">
        <label>Daily task bonus multiplier (×)</label>
        <input type="number" min="1" value="${state.xpConfig.bonusMultiplier}"
               oninput="state.xpConfig.bonusMultiplier=parseFloat(this.value)||1;debouncedRender()">
      </div>
      <div class="input-group">
        <label>Manual learning rate (× after bonus consumed)</label>
        <input type="number" min="0.1" max="1" step="0.1" value="${state.xpConfig.discountedRate}"
               oninput="state.xpConfig.discountedRate=parseFloat(this.value)||0.5;debouncedRender()">
      </div>
      <div class="input-group">
        <label>Quiz questions required to complete</label>
        <input type="number" min="1" max="10" value="${state.xpConfig.quizQuestionsRequired}"
               oninput="state.xpConfig.quizQuestionsRequired=parseInt(this.value)||3;debouncedRender()">
      </div>
    </div>

    <!-- Lesson status overrides — set lesson states for testing specific scenarios -->
    <div class="admin-card">
      <p class="admin-card-title">Lesson States</p>
      ${state.lessons.map((lesson, i) => `
        <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line);">
          <div style="font-size:12px;font-weight:850;margin-bottom:6px;">
            ${h(lesson.title)}
            <span class="content-type-tag ${lesson.type}" style="margin-left:6px;">${lesson.type}</span>
          </div>
          <div class="input-group">
            <label>Status</label>
            <select onchange="state.lessons[${i}].status=this.value;render()">
              ${["not-started","in-progress","completed"].map(s =>
                `<option value="${s}" ${lesson.status === s ? "selected" : ""}>${s}</option>`
              ).join("")}
            </select>
          </div>
          <div class="input-group">
            <label>Daily task bonus</label>
            <select onchange="state.lessons[${i}].dailyTask=this.value==='true';render()">
              <option value="false" ${!lesson.dailyTask ? "selected" : ""}>No</option>
              <option value="true"  ${lesson.dailyTask  ? "selected" : ""}>Yes</option>
            </select>
          </div>
        </div>
      `).join("")}
    </div>

    <!-- Recently active — simulates which badges surface at top of Learn tab -->
    <div class="admin-card">
      <p class="admin-card-title">Recently Active Badges</p>
      <p class="helper">Comma-separated badge names. First in list = most recent.</p>
      <div class="input-group">
        <textarea oninput="state.recentlyActive=this.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,3);debouncedRender()"
        >${h(state.recentlyActive.join(", "))}</textarea>
      </div>
    </div>

    <!-- Badge progress — all 8 badges editable (not just first 4) -->
    <div class="admin-card">
      <p class="admin-card-title">Badge Progress</p>
      ${state.badges.map((b, i) => `
        <div style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:850;margin-bottom:6px;">${h(b.name)}</div>
          <div class="grid-two">
            <div class="input-group" style="margin:0;">
              <label>Level</label>
              <input type="number" min="1" value="${b.level}"
                     oninput="state.badges[${i}].level=parseInt(this.value)||1;debouncedRender()">
            </div>
            <div class="input-group" style="margin:0;">
              <label>Progress %</label>
              <input type="number" min="0" max="99" value="${b.progress}"
                     oninput="state.badges[${i}].progress=parseInt(this.value)||0;debouncedRender()">
            </div>
          </div>
          <div class="input-group" style="margin-top:6px;">
            <label>Tier</label>
            <select onchange="state.badges[${i}].tier=this.value;render()">
              ${state.tiers.map(t =>
                `<option value="${h(t.name)}" ${b.tier === t.name ? "selected" : ""}>${h(t.name)}</option>`
              ).join("")}
            </select>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
