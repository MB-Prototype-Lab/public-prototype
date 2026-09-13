// ─── Commitment Creation ───────────────────────────────────────────────────────
// TAB: None | NAV BAR: Hidden — full focus on commitment
//
// PURPOSE
// Third (optional) screen in the post-result loop. Triggered when user chooses
// "Make a goal" in nextAction. Lets the user create a goal + optional milestone
// + optional commitment text. V1: lightweight form, no complex priority flow.
//
// NAVIGATION
//   Entry: nextAction → "Make a goal"
//   Exit:  Save → finish screen; Skip → finish screen
//
// PRODUCTION NOTES
//   Goal is appended to state.goals[]. Optional commitment text appended to
//   state.commitments[] with a link to the new goal's ID.
//   V1: milestone is optional. Commitment text is a single sentence.
//   Goal prioritization (ordering against existing goals) is a simple confirm
//   step before saving — V1 just prepends the new goal to the list.

function renderCommitment() {
  const goals = state.goals || [];

  return `
    <div style="padding:24px 0 16px;">
      <h1 class="title" style="font-size:22px;margin-bottom:8px;">Make a goal</h1>
      <p class="helper" style="margin-bottom:24px;">What do you want Money Buddy to help you work toward?</p>

      <!-- Goal -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-title" style="margin-bottom:8px;">Goal <span class="helper" style="font-weight:400;">(required)</span></div>
        <div class="input-group" style="margin-bottom:0;">
          <label>What's the goal?</label>
          <input id="newGoalTitle" type="text" placeholder="e.g. Become debt free"
                 oninput="document.getElementById('newGoalTitleError').style.display='none';this.style.borderColor='';">
          <div id="newGoalTitleError" class="caption" style="color:var(--danger);display:none;margin-top:4px;">
            Please enter a goal name.
          </div>
        </div>
        <div class="input-group" style="margin-top:8px;margin-bottom:0;">
          <label>Describe it (optional)</label>
          <textarea id="newGoalDesc" placeholder="e.g. Pay off all my credit cards and student loans." style="height:60px;"></textarea>
        </div>
      </div>

      <!-- Milestone (optional) -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-title" style="margin-bottom:4px;">Milestone <span class="helper" style="font-weight:400;">(optional)</span></div>
        <p class="helper" style="margin-bottom:10px;">A measurable target that shows you're making progress.</p>
        <div class="input-group" style="margin-bottom:8px;">
          <label>Milestone (e.g. "Reduce card balance to $2,000")</label>
          <input id="newMilestone" type="text" placeholder="Skip if monitoring only">
        </div>
        <div class="input-group" style="margin-bottom:0;">
          <label>Target amount (optional)</label>
          <input id="newMilestoneTarget" type="number" placeholder="e.g. 2000" min="0">
        </div>
      </div>

      <!-- Commitment (optional) -->
      <div class="card" style="margin-bottom:20px;">
        <div class="section-title" style="margin-bottom:4px;">Commitment <span class="helper" style="font-weight:400;">(optional)</span></div>
        <p class="helper" style="margin-bottom:10px;">A short personal promise — something you'll do differently.</p>
        <div class="input-group" style="margin-bottom:0;">
          <label>What will you do? (one sentence)</label>
          <input id="newCommitment" type="text" placeholder="e.g. Cook at home 4 nights a week">
        </div>
      </div>

      <button class="button primary full" type="button" onclick="saveCommitment()">Save Goal</button>
      <button class="button secondary full" style="margin-top:8px;" type="button"
              onclick="skipCommitment()">Skip for now</button>
    </div>
  `;
}

function saveCommitment() {
  const titleEl      = document.getElementById("newGoalTitle");
  const descEl       = document.getElementById("newGoalDesc");
  const milestoneEl  = document.getElementById("newMilestone");
  const milTargetEl  = document.getElementById("newMilestoneTarget");
  const commitEl     = document.getElementById("newCommitment");

  const title = titleEl && titleEl.value.trim();
  if (!title) {
    if (titleEl) titleEl.style.borderColor = "var(--danger)";
    const errEl = document.getElementById("newGoalTitleError");
    if (errEl) errEl.style.display = "block";
    return;
  }

  const goalId = generateId("g");

  const newGoal = {
    id: goalId,
    title,
    description: descEl ? descEl.value.trim() : "",
    progress: 0,
    priority: 1
  };

  const milestoneText   = milestoneEl  ? milestoneEl.value.trim()       : "";
  const milestoneTarget = milTargetEl  ? parseFloat(milTargetEl.value) || 0 : 0;
  if (milestoneText) {
    newGoal.milestoneTitle  = milestoneText;
    newGoal.milestoneTarget = milestoneTarget;
  }

  // Prepend goal (highest priority = shown first)
  state.goals = [newGoal, ...(state.goals || [])];

  const commitmentText = commitEl ? commitEl.value.trim() : "";
  if (commitmentText) {
    state.commitments = state.commitments || [];
    state.commitments.push({
      id:        generateId("c"),
      text:      commitmentText,
      createdAt: todayISO(),
      goalId
    });
  }

  state.postResultContext = "goal";
  go("finish");
}

function skipCommitment() {
  state.nextAction = null;
  go("finish");
}
