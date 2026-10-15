// Preserve flowOrigin through the inherited reaction/next-action/finish
// journey so its completion can return to the starting screen.

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
  state.postResultReaction = null;
  state.nextAction         = null;
}
