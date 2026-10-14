// Big purchase containment. Policy is loaded from flow-config.js before app state.
// Guards restrict normal prototype routing; they are not a security boundary.
var mbFlowSession = Math.random().toString(36).slice(2);
function mbFlowAllowed(screen) {
  if (window.MB_FLOW.allowed_screens.indexOf(screen) === -1) return false;
  if (screen === 'onboarding') return !!state.onboarding;
  if (!state.mbFlowSetupComplete || !state.bp) return false;
  if (screen === 'esfBuild' || screen === 'esfPlan') return !!state.esf;
  if (screen === 'helpMeOut') return !!(state.esf && state.helpMeOut && state.helpMeOut.target === 'esf');
  if (screen === 'goals') return !!(state.bigPurchase || state.esfGoal || state.esfSelfReported);
  if (screen === 'bpLanding') return true;
  if (screen === 'bpFinder') return !!state.bp.finder;
  if (screen === 'bpQuiz') return !!state.bp.quiz;
  if (screen === 'bpSetup') return true;
  if (screen === 'bpYourCar') return !!(state.bp.finder && bpfSelected());
  return ['bpCost','bpOptions','bpFinance','bpCommit'].indexOf(screen) !== -1 && bpSetupComplete();
}
function mbFlowSeed() {
  onbStart();
  state.screen = window.MB_FLOW.entry;
  state.nav = {activeStack: 'home', stacks: {home: [state.screen]}};
}
function mbFlowEsfBack() {
  var s = state.bp;
  var caller = s && s.esfCaller;
  if (!caller || !mbFlowAllowed(caller.screen)) return;
  state.helpMeOut = null;
  if (state.esf && state.esf.buddy) state.esf.buddy.open = false;
  s.esfReturn = false;
  go(caller.screen);
}
function mbFlowRestart() {
  // Reload drops state, pending renders, media and trail. Participant URL parameters survive.
  refreshPinRestart();
}
function mbFlowExit() { location.assign(window.MB_RELEASE.selector || '../../index.html'); }
v3EntryScreen = function () { return window.MB_FLOW.entry; };
function mbFlowInstall() {
  var profile = screenLinkParam('profile');
  if (profile) profileApply(profile); // Once per fresh document, including file://.
  state.tacticalGoals = [];
  state.esfGoal = null;
  state.esf = null;
  state.bp = null;
  state.bigPurchase = null;
  state.mbFlowSetupComplete = false;
  state.adminCollapsed = true;
  ubTrailReset();
  mbFlowSeed();
  var baseEsfReopen = esfReopen;
  esfReopen = function () {
    if (state.screen === 'goals' && state.bp) {
      state.bp.esfCaller = {kind: 'review', screen: 'goals', resume: bpfSelected() ? 'bpYourCar' : 'bpFinder'};
      state.bp.esfReturn = true;
    }
    baseEsfReopen();
  };
  var baseSnapshot = getNavSnapshot;
  getNavSnapshot = function () {
    var snap = baseSnapshot();
    snap.mbFlowSession = mbFlowSession;
    return snap;
  };
  var baseScreen = renderScreen;
  renderScreen = function () {
    if (!mbFlowAllowed(state.screen)) mbFlowSeed();
    return baseScreen();
  };
  renderNav = function () { return ''; };
  renderAdmin = mbFlowRenderAdmin;
  appStateSnapshot = mbFlowStateSnapshot;
  copyAppState = mbFlowCopyState;
  var baseRender = render;
  render = function () {
    if (!mbFlowAllowed(state.screen)) mbFlowSeed();
    var active = document.activeElement;
    var inTools = active && active.closest && active.closest('.admin');
    var controlId = inTools ? active.id : '';
    var controlAction = inTools ? active.getAttribute('onclick') : '';
    var controlChange = inTools ? active.getAttribute('onchange') : '';
    baseRender();
    mbFlowToolsSync();
    if (inTools) {
      var controls = document.querySelectorAll('.admin button, .admin select');
      var target = Array.from(controls).find(function (el) {
        return controlId ? el.id === controlId : controlAction ? el.getAttribute('onclick') === controlAction : controlChange && el.getAttribute('onchange') === controlChange;
      });
      if (target) target.focus();
    }
  };
  navCommit = function (screen) {
    if (!mbFlowAllowed(screen)) return false;
    state.screen = screen;
    state.topbarMenuOpen = false;
    window.__navLog = [screen].concat(window.__navLog || []).slice(0, 10);
    try { history.pushState(getNavSnapshot(), ''); } catch (e) {}
    render();
    return true;
  };
  go = function (screen) {
    if (!mbFlowAllowed(screen)) return false;
    var stack = state.nav.stacks.home;
    var existing = stack.indexOf(screen);
    if (existing !== -1) stack.splice(existing + 1);
    else stack.push(screen);
    return navCommit(screen);
  };
  navBack = function () {
    if (state.screen === 'onboarding') { onbBack(); return; }
    if (state.screen === 'bpLanding' && state.bp && state.bp.fromOnboarding && state.bpOnbReturn) { bpLandingBack(); return; }
    if (state.screen === 'bpFinder' && ['car','cars','quiz'].indexOf(bpfSession().view) !== -1) { bpfBack(); return; }
    if (state.screen === 'esfBuild') { esfBack(); return; }
    if (state.screen === 'esfPlan') { esfPlanBack(); return; }
    if (state.screen === 'helpMeOut') { hmoBack(); return; }
    var stack = state.nav.stacks.home;
    if (stack.length > 1) {
      stack.pop();
      while (stack.length > 1 && !mbFlowAllowed(stack[stack.length - 1])) stack.pop();
      if (mbFlowAllowed(stack[stack.length - 1])) navCommit(stack[stack.length - 1]);
    }
  };
  navGoTabRoot = navGoTab = function (screen) {
    if (screen !== 'goals' || !mbFlowAllowed(screen)) return false;
    state.nav = {activeStack: 'home', stacks: {home: ['goals']}};
    return navCommit(screen);
  };
  navAdminJump = navGoHome = function () { return false; };
  taskGo = go;
  navRouteTask = function (route) {
    if (route === 'emergency_fund' && state.mbFlowSetupComplete && state.bp) {
      state.bp.esfCaller = {kind: 'review', screen: state.screen, resume: state.screen};
      state.bp.esfReturn = true;
      esfReopen();
    }
  };
  restoreNavSnapshot = function (snap) {
    if (!snap || snap.mbFlowSession !== mbFlowSession || !mbFlowAllowed(snap.screen)) {
      mbFlowSeed(); return;
    }
    var stack = snap.nav && snap.nav.stacks && snap.nav.stacks.home;
    if (!Array.isArray(stack) || !stack.length || stack.some(function (s) { return !mbFlowAllowed(s); })) {
      state.nav = {activeStack: 'home', stacks: {home: [snap.screen]}};
    } else state.nav = {activeStack: 'home', stacks: {home: stack.slice()}};
    state.screen = snap.screen;
  };
  // Cold/deep links always begin setup; never synthesize mid-session prerequisites.
  screenLinkApply = function () { return window.MB_FLOW.entry; };
  screenLinkOnboarding = function () { return window.MB_FLOW.entry; };
  resetUserData = mbFlowRestart;
  // Keep the launch profile available for Restart while URL writes retain all
  // participant parameters. The profile is not reapplied during navigation.
  screenUrlWrite = function (slug, trail) {
    if (!screenUrlEnabled()) return false;
    try {
      var url = new URL(location.href);
      url.searchParams.set('screen', slug);
      url.hash = trail ? 'v=' + trail : '';
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      return true;
    } catch (e) { return false; }
  };
}
