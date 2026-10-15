// End the inherited post-result journey. Clear its context before moving to
// My Progress or the saved flowOrigin so the next journey cannot reuse it.

function renderFinish() {
  const action    = state.nextAction || null;
  const context   = state.postResultContext || null;
  const origin    = state.flowOrigin || "aboutMe";
  const goals     = state.goals || [];
  const lastGoal  = goals.length > 0 ? goals[0] : null;

  let detail = "Your changes have been saved.";
  if ((action === "make-goal" || context === "goal") && lastGoal) {
    detail = `Goal added: "${lastGoal.title}"`;
  } else if (context === "goal") {
    detail = "Your goal has been saved to My Progress.";
  } else if (context === "monthlyUpdate") {
    detail = "Monthly check-in complete. Results are in My Progress.";
  } else if (action === "review-later") {
    detail = "Noted. Come back whenever you're ready.";
  }

  const originLabel = origin === "home"       ? "Home"
                    : origin === "myProgress" ? "My Progress"
                    : "Budget";

  return `
    <div style="padding:40px 0 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">✓</div>
      <h1 class="title" style="font-size:26px;margin-bottom:8px;">Done</h1>
      <p class="subtitle" style="margin-bottom:8px;">Your plan was updated.</p>
      <p class="helper" style="margin-bottom:32px;">${h(detail)}</p>

      <button class="button primary full" type="button" onclick="goToImpactLanding()">
        See My Progress
      </button>
      ${origin !== "myProgress" ? `
        <button class="button secondary full" style="margin-top:10px;" type="button"
                onclick="finishAndReturn()">
          Back to ${h(originLabel)}
        </button>
      ` : ""}
    </div>
  `;
}

function goToImpactLanding() {
  clearFlowState();
  go("myProgress");
}

function finishAndReturn() {
  const origin = state.flowOrigin || "aboutMe";
  clearFlowState();
  go(origin);
}
