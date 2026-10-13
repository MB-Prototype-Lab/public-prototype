// Reviewer instrumentation. Dispatch only the current, initialized Flow screen.
// Toggling tools never runs the participant renderer or feature initializers.
function mbFlowToolsSync() {
  var open = !state.adminCollapsed;
  document.querySelector('.page').classList.toggle('admin-collapsed', !open);
  var toggle = document.getElementById('adminExpandTab');
  toggle.style.display = open ? 'none' : 'flex';
  toggle.hidden = open;
  toggle.setAttribute('aria-expanded', String(open));
  document.getElementById('flowAdmin').hidden = !open;
  document.getElementById('adminSessionLog').textContent = 'Session: ' + mbFlowSession;
  document.getElementById('adminNavLog').textContent = 'Nav: ' + ((window.__navLog || []).join(' ← ') || 'none');
  document.getElementById('adminTrailLog').textContent = 'Trail: ' + (typeof ubTrailPreview === 'function' ? ubTrailPreview() : 'none');
  document.getElementById('adminErrorLog').textContent = 'Last error: ' + (window.__lastError ? JSON.stringify(window.__lastError) : 'none');
}
function mbFlowToolsToggle(open) {
  state.adminCollapsed = !open;
  document.getElementById('adminRoot').innerHTML = mbFlowRenderAdmin();
  mbFlowToolsSync();
  if (!open) document.getElementById('adminExpandTab').focus();
}
function mbFlowSetupStep(value) {
  if (state.screen !== 'onboarding' || !mbFlowAllowed('onboarding') || !state.onboarding) return false;
  if (!/^\d+$/.test(String(value))) return false;
  var i = Number(value);
  if (!Number.isInteger(i) || i < 0 || i >= window.MB_FLOW.setup_steps.length || ONB_STEPS[i] !== window.MB_FLOW.setup_steps[i]) return false;
  onbSetStep(state.onboarding, i);
  render();
  return true;
}
function mbFlowProfile(value) {
  if (state.screen !== 'onboarding' || !mbFlowAllowed('onboarding') || !profileResolve(value)) return false;
  profileApply(value);
  render();
  return true;
}
function mbFlowRenderSetupAdmin() {
  var steps = window.MB_FLOW.setup_steps;
  return '<div class="admin-card"><p class="admin-card-title">Flow setup</p>' +
    renderProfileAdminSwitcher().replace('<label>Active profile</label>', '<label for="flowProfile">Active profile</label>').replace('<select onchange=', '<select id="flowProfile" onchange=').replace('profileApply(this.value);render()', 'mbFlowProfile(this.value)') +
    (steps.length ? '<div class="input-group"><label for="flowSetupStep">Setup step</label>' +
      '<select id="flowSetupStep" onchange="mbFlowSetupStep(this.value)">' + steps.map(function (step, i) {
        return '<option value="' + i + '"' + (state.onboarding.step === i ? ' selected' : '') + '>' + h(step) + '</option>';
      }).join('') + '</select></div>' : '') +
    '<p class="helper">Answers: ' + h(JSON.stringify(state.onboarding)) + '</p></div>';
}
function mbFlowGoals() {
  return (state.tacticalGoals || []).filter(function (g) {
    return (state.esfGoal && g.id === state.esfGoal.id) ||
      (window.MB_FLOW.id === 'big-purchase' && state.bigPurchase && g.id === state.bigPurchase.goalId);
  });
}
function mbFlowStateSnapshot() {
  return {flow: window.MB_FLOW.id, session: mbFlowSession, screen: state.screen, nav: state.nav,
    profile: state.profile, onboarding: state.onboarding, setupComplete: state.mbFlowSetupComplete,
    esf: state.esf, helpMeOut: state.helpMeOut, esfGoal: state.esfGoal,
    bp: window.MB_FLOW.id === "big-purchase" ? state.bp : null,
    bigPurchase: window.MB_FLOW.id === "big-purchase" ? state.bigPurchase : null,
    goals: mbFlowGoals(), plan: state.plan, planStatus: state.planStatus,
    theme: themeCurrent().id};
}
function mbFlowCopyState() {
  var text = JSON.stringify(mbFlowStateSnapshot(), null, 2);
  var fallback = function () { prompt('Copy this state (Ctrl+A, Ctrl+C):', text); };
  if (!navigator.clipboard || !navigator.clipboard.writeText) { fallback(); return; }
  navigator.clipboard.writeText(text).then(function () { alert('State copied to clipboard'); }).catch(fallback);
}
function mbFlowRenderGoalsAdmin() {
  var goals = mbFlowGoals();
  return '<div class="admin-card"><p class="admin-card-title">Flow goals</p>' + goals.map(function (g) {
    return '<p class="helper">' + h(g.label) + ' · ' + h(goalType(g)) + ' · ' + h(budgetFmt(goalCurrent(g))) + ' / ' + h(budgetFmt(g.target)) + ' · ' + h(goalStatus(g)) + '</p>';
  }).join('') + '</div>' + (window.MB_FLOW.id === 'big-purchase' && state.bp ? renderBpAdminCommon() : '');
}
function mbFlowAdminAction(action, value) {
  if (!mbFlowAllowed(state.screen)) return false;
  if (action === 'fixture' && state.screen === 'bpSetup' && state.bp) bpAdminFillSetup();
  else if (action === 'car' && state.screen === 'bpFinder' && state.bp && state.bp.finder) bpfChoose('4runner', 'new');
  else if (action === 'variant' && state.screen === 'bpCost' && bpSetupComplete() && ['A','B'].indexOf(value) !== -1) bpSetCostVariant(value);
  else if (['reach','due'].indexOf(action) !== -1 && state.bp && state.bigPurchase &&
      ['goals','bpLanding','bpFinder','bpYourCar','bpSetup','bpQuiz','bpCost','bpOptions','bpFinance','bpCommit'].indexOf(state.screen) !== -1) {
    if (action === 'reach') bpAdminReachGoal(); else bpAdminDueToday();
  } else return false;
  return true;
}
function mbFlowRenderAdmin() {
  if (state.adminCollapsed || !mbFlowAllowed(state.screen)) return '';
  var html = '';
  // No generic fallback or full-app jump list. Prerequisites precede readers
  // whose source session getters can otherwise initialize a feature.
  switch (state.screen) {
    case 'onboarding': if (state.onboarding) html = mbFlowRenderSetupAdmin(); break;
    case 'esfBuild': if (state.esf) html = renderEsfBuildAdmin(); break;
    case 'esfPlan': if (state.esf) html = renderEsfPlanAdmin(); break;
    case 'helpMeOut': if (state.esf && state.helpMeOut && state.helpMeOut.target === 'esf') html = renderHelpMeOutAdmin(); break;
    case 'goals': html = mbFlowRenderGoalsAdmin(); break;
    case 'bpLanding': if (state.bp) html = renderBpLandingAdmin(); break;
    case 'bpSetup': if (state.bp) html = renderBpSetupAdmin(); break;
    case 'bpFinder': if (state.bp && state.bp.finder) html = renderBpFinderAdmin(); break;
    case 'bpYourCar': if (state.bp && state.bp.finder && bpfSelected()) html = renderBpYourCarAdmin(); break;
    case 'bpQuiz': if (state.bp && state.bp.quiz) html = renderBpQuizAdmin(); break;
    case 'bpCost': if (state.bp && bpSetupComplete()) html = renderBpCostAdmin(); break;
    case 'bpOptions': if (state.bp && bpSetupComplete()) html = renderBpOptionsAdmin(); break;
    case 'bpFinance': if (state.bp && bpSetupComplete()) html = renderBpFinanceAdmin(); break;
    case 'bpCommit': if (state.bp && bpSetupComplete()) html = renderBpCommitAdmin(); break;
  }
  return html.replace(/bpAdminFillSetup\(\)/g, "mbFlowAdminAction('fixture')")
    .replace(/bpfChoose\('4runner','new'\)/g, "mbFlowAdminAction('car')")
    .replace(/bpSetCostVariant\('([AB])'\)/g, "mbFlowAdminAction('variant','$1')")
    .replace(/bpAdminReachGoal\(\)/g, "mbFlowAdminAction('reach')")
    .replace(/bpAdminDueToday\(\)/g, "mbFlowAdminAction('due')");
}
