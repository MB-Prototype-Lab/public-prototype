// ─── Next Action Prompt ────────────────────────────────────────────────────────
// TAB: None | NAV BAR: Hidden — full focus on decision
//
// PURPOSE
// Second screen of the post-result loop. After reacting ("How does this feel?"),
// asks "What do you want to do?" to capture the user's intended next step.
//
// NAVIGATION
//   Entry: Post-result screen after reaction is selected
//   Exit:  Accept / Review later → finish screen
//          Adjust it → Budget tab
//          Compare more → myProgress (Comparisons section)
//          Make a goal → commitment screen
//
// PRODUCTION NOTES
//   state.postResultReaction is set by the previous screen.
//   state.flowOrigin is preserved throughout the loop and used on the finish
//   screen to return the user to their starting point.

function renderNextAction() {
  const actions = [
    { value: "accept",        label: "Accept it",     desc: "Looks good, I'm done reviewing." },
    { value: "adjust",        label: "Adjust it",     desc: "I want to tweak the budget." },
    { value: "compare",       label: "Compare more",  desc: "Show me how I compare to others." },
    { value: "make-goal",     label: "Make a goal",   desc: "I want to commit to something." },
    { value: "review-later",  label: "Review later",  desc: "I need to think about it." }
  ];

  return `
    <div style="padding:24px 0 16px;">
      <button class="button secondary" style="font-size:12px;padding:8px 14px;margin-bottom:20px;"
              type="button" onclick="go('postResult')">← Back</button>
      <h1 class="title" style="font-size:22px;margin-bottom:8px;">What do you want to do?</h1>
      <p class="helper" style="margin-bottom:24px;">Choose what makes sense for you right now.</p>

      <div style="display:flex;flex-direction:column;gap:10px;">
        ${actions.map(a => `
          <button class="button secondary full" type="button"
                  style="text-align:left;padding:14px 16px;"
                  onclick="selectNextAction('${h(a.value)}')">
            <div style="font-size:14px;font-weight:700;margin-bottom:2px;">${h(a.label)}</div>
            <div style="font-size:12px;color:var(--muted);">${h(a.desc)}</div>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function selectNextAction(value) {
  state.nextAction = value;
  if (value === "accept" || value === "review-later") {
    go("finish");
  } else if (value === "adjust") {
    // Mid-loop exit: preserve flowOrigin so the user can still return; clear context
    state.postResultContext  = null;
    state.postResultTheme    = null;
    state.postResultReaction = null;
    navGoTab("aboutMe");
  } else if (value === "compare") {
    // Mid-loop exit: clear all flow state — user is done with this flow
    clearFlowState();
    go("myProgress");
  } else if (value === "make-goal") {
    go("commitment");
  } else {
    go("finish");
  }
}

function clearFlowState() {
  state.flowOrigin         = null;
  state.postResultContext  = null;
  state.postResultTheme    = null;
  state.postResultReaction = null;
  state.nextAction         = null;
}
