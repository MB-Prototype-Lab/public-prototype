// Home uses the top-left icon, separate from the five tabs (L5, D34).
// Tasks are bookmarks into existing journeys, routed by navRouteTask.
// Advertised task points must match the reward ledger's itemized payout.

const TIP_MAX_CHARS = 90;

function renderHome() {
  return `
    <div class="home-stage-wrap">
      ${renderBuddyStage({ square: true })}
      <button class="home-chat-btn" type="button"
              onclick="homeOpenChat()">Chat with ${h(state.buddy.name || "Buddy")}</button>
    </div>

    <!-- Keep the tip between the buddy and tasks as context for Today. -->
    ${renderHomeTip()}

    <div class="row" style="margin-bottom:10px;">
      <div class="section-title" style="margin:0;">Today</div>
      <div class="helper">${homeTasksDone()} of ${state.dailyTasks.length} done</div>
    </div>
    ${state.dailyTasks.map(t => renderHomeTask(t)).join("")}
  `;
}

// Pre-generated and matched to user configuration; copy lives in seed-state.
// The limit is a hard requirement, so it is enforced here rather than trusted.
function renderHomeTip() {
  const tip = String(state.tipBanner || "");
  const shown = tip.length > TIP_MAX_CHARS ? tip.slice(0, TIP_MAX_CHARS - 1).trimEnd() + "…" : tip;
  if (!shown) return "";
  return `
    <div class="card home-tip">
      <span class="home-tip-icon" aria-hidden="true">🐾</span>
      <p class="home-tip-text">${h(shown)}</p>
    </div>
  `;
}

function homeTasksDone() {
  return state.dailyTasks.filter(t => t.completed).length;
}

// Each task routes somewhere real and pays kibble.
function renderHomeTask(task) {
  return `
    <div class="card home-task ${task.completed ? "home-task-done" : ""}">
      <!-- Keep bones beside the button to fit all three tasks more compactly. -->
      <div class="row" style="align-items:center;gap:10px;">
        <div style="flex:1;">
          <p class="task-title" style="margin:0 0 2px;">${h(task.label)}</p>
          <p class="home-task-kibble">🦴 ${task.kibble} bones</p>
        </div>
        ${task.completed
          ? `<span class="pill pill-good" style="font-size:9px;padding:3px 8px;">Done</span>`
          : `<button class="button" style="font-size:12px;padding:8px 14px;" type="button"
                     onclick="homeDoTask('${h(task.id)}')">Open</button>`}
      </div>
    </div>
  `;
}

function homeDoTask(taskId) {
  const task = state.dailyTasks.find(t => t.id === taskId);
  if (!task) return;
  state.activeTaskId = taskId;
  navRouteTask(task.route);
}

// Task completion awards display-only kibble (L16).
function homeCompleteTask(taskId) {
  const task = state.dailyTasks.find(t => t.id === taskId);
  if (!task || task.completed) return;
  task.completed = true;
  state.kibble += task.kibble;
  // Itemize task bones separately from lesson bones so the advertised task
  // payout remains visible. Journal and budget tasks have no open reward ledger.
  if (typeof lrPointsRecord === "function") {
    lrPointsRecord("bones", task.kibble, "Today's task");
  }
}

function homeOpenChat() {
  buddySetPose(2);          // head tilted, looking up — attentive, chat open
  go("chat");
}

function renderHomeAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">Daily Tasks</p>
      <p class="helper" style="margin-bottom:10px;">
        Precomputed order. The scoring engine is not run in the prototype.
      </p>
      ${state.dailyTasks.map((t, i) => `
        <div class="input-group">
          <label>${i + 1}. ${h(t.label)}</label>
          <div class="helper">
            route <code>${h(t.route)}</code> · ${t.kibble} bones
          </div>
          <select onchange="state.dailyTasks[${i}].completed=(this.value==='true');render()">
            <option value="false" ${!t.completed ? "selected" : ""}>not done</option>
            <option value="true"  ${t.completed ? "selected" : ""}>done</option>
          </select>
        </div>
      `).join("")}
      <div class="input-group">
        <label>Charity Points — 🦴 bones (display-only, L16)</label>
        <input type="number" value="${state.kibble}"
               onchange="state.kibble=parseInt(this.value,10)||0;render()">
      </div>
      <div class="input-group">
        <label>Charity Points — 💎 diamonds (subscriber tier; 1 per lesson on trial)</label>
        <input type="number" value="${state.charityDiamonds}"
               onchange="state.charityDiamonds=parseInt(this.value,10)||0;render()">
      </div>
      <div class="input-group">
        <label>Tip banner — ${String(state.tipBanner || "").length}/${TIP_MAX_CHARS} chars</label>
        <textarea onchange="state.tipBanner=this.value;render()">${h(state.tipBanner || "")}</textarea>
      </div>
    </div>
    ${renderBuddyAdmin()}
  `;
}
