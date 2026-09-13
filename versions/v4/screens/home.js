// ─── Home (03-home-daily-loop) ───────────────────────────────────────────────
// TAB: none — reached by the top-left icon, not a tab (L5/D34)
// NAV BAR: Visible
//
// Top to bottom, per the spec:
//   top bar      kibble · streak · buddy level · hamburger  → components/topbar.js
//   tip banner   one line, 90 character HARD limit, puppy icon alongside
//   buddy stage  the puppy with an idle cycle → components/buddy.js
//   chat button  below the stage
//   daily tasks  four at a time, each routing somewhere real and paying kibble
//   bottom nav   -> components/nav.js
//
// -- THE TASK CARDS ARE THE GUIDED PATH -----------------------------------------
// Everything else in the app can be browsed. These four cards are what the
// prototype is actually testing: whether a person opens the thing they were
// pointed at, and whether doing it visibly pays.
//
// A task is a CONTEXTUAL BOOKMARK, not a screen of its own. Its `route` names
// somewhere that already exists -- "lesson:apr", "budget", "money_journal" --
// and navRouteTask (js/navigation.js) decides whether that means switching to a
// tab or launching a flow from Home. Tapping a card must be indistinguishable
// from reaching the same place any other way.
//
// Each card advertises its Charity Points up front, and completing it credits
// exactly that. The reward screen itemises it beside whatever the activity
// itself earned, so the promise and the payout can be checked against each
// other -- see lrPointsRecord in js/lesson-rewards.js.

const TIP_MAX_CHARS = 90;

function renderHome() {
  return `
    <div class="home-stage-wrap">
      ${renderBuddyStage({ square: true })}
      <button class="home-chat-btn" type="button"
              onclick="homeOpenChat()">Chat with ${h(state.buddy.name || "Buddy")}</button>
    </div>

    <!-- The tip sits BETWEEN the buddy and the task list, not above everything.
         At the top it pushed the buddy down the screen for a line of copy that
         is context for the day rather than the point of it. Here it reads as a
         lead-in to Today, and the stage gets the top of the screen. -->
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

// Each task routes somewhere real and pays kibble. Tasks carrying an
// observationId show it inline, so the observation is reachable from home as
// well as from its other surfaces (D18 wants ≥2).
function renderHomeTask(task) {
  const obs = task.observationId ? observationById(task.observationId) : null;
  return `
    <div class="card home-task ${task.completed ? "home-task-done" : ""}">
      <div class="row" style="align-items:flex-start;gap:10px;">
        <div style="flex:1;">
          <p class="task-title" style="margin:0 0 2px;">${h(task.label)}</p>
          ${obs ? `<p class="helper" style="margin:0;">${h(observationDetail(obs))}</p>` : ""}
        </div>
        ${task.completed
          ? `<span class="pill pill-good" style="font-size:9px;padding:3px 8px;">Done</span>`
          : `<button class="button" style="font-size:12px;padding:8px 14px;" type="button"
                     onclick="homeDoTask('${h(task.id)}')">Open</button>`}
      </div>
      <p class="home-task-kibble">🦴 ${task.kibble} bones</p>
    </div>
  `;
}

function homeDoTask(taskId) {
  const task = state.dailyTasks.find(t => t.id === taskId);
  if (!task) return;
  state.activeTaskId = taskId;
  navRouteTask(task.route);
}

// Called when a routed task's flow completes. Kibble accrues and shows;
// nothing spends it (L16) — every sink is on the spec's deferred list.
function homeCompleteTask(taskId) {
  const task = state.dailyTasks.find(t => t.id === taskId);
  if (!task || task.completed) return;
  task.completed = true;
  state.kibble += task.kibble;
  // Itemise it if a lesson reward is being tallied right now. This is the
  // figure the home card promised, so the reward screen has to name it as such
  // — the lesson's own bones land on top and the total would otherwise read as
  // twice what was advertised. No-op for the journal and budget tasks, which
  // have no reward screen and no open ledger.
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
        Precomputed order (A7). The scoring engine is specified in
        03-home-daily-loop but not run in the prototype.
      </p>
      ${state.dailyTasks.map((t, i) => `
        <div class="input-group">
          <label>${i + 1}. ${h(t.label)}</label>
          <div class="helper">
            route <code>${h(t.route)}</code> · ${t.kibble} bones${t.observationId ? " · " + h(t.observationId) : ""}
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
