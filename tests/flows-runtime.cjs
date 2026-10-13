// Actual package scripts, load order and boot in a fresh VM per journey.
// DOM stubs exercise logic/rendering; browser/layout checks remain separate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function bootFlow(id, href = `file:///prototype/flows/${id}/index.html`, reload = false) {
  const folder = path.join(root, 'flows', id);
  const elements = new Map(), events = {}, pushes = [];
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const el = {id, style:{}, dataset:{}, innerHTML:'', textContent:'', value:'', scrollTop:0,
      classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k);},add(k){classes.add(k);},remove(k){classes.delete(k);},contains:k=>classes.has(k)},
      setAttribute(){},removeAttribute(){},getAttribute(){return null;},focus(){},setSelectionRange(){},addEventListener(){},appendChild(){},
      querySelector(){return element('query');},querySelectorAll(){return [];},getBoundingClientRect(){return {top:0,left:0,width:0,height:0};},
      play(){return Promise.resolve();},pause(){}};
    elements.set(id,el); return el;
  }
  const loc={href, protocol:new URL(href).protocol, replace(x){loc.replaced=x;},assign(x){loc.assigned=x;}};
  const c = vm.createContext({URL,Event,console,location:loc,
    document:{getElementById(id){
      // The source mount hook only initializes BP Buddy when its DOM exists.
      if(id==='bpBuddyThread' && !element('buddyRoot').innerHTML.includes('id="bpBuddyThread"')) return null;
      return element(id);
    },querySelector:element,querySelectorAll:()=>[],createElement:element,addEventListener(){},body:element('body'),documentElement:element('html')},
    navigator:{userAgent:'vm',clipboard:{writeText:()=>Promise.resolve()}},
    performance:{getEntriesByType:()=>[{type:reload?'reload':'navigate'}],now:()=>0},
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    Audio:function(){return element('audio');},alert(){},prompt(){},confirm:()=>true});
  c.window=c;
  c.__navLog=[];c.__lastError=null;
  c.matchMedia=()=>({matches:false,addEventListener(){}});
  c.scrollTo=()=>{};c.getComputedStyle=()=>({});
  c.addEventListener=(name,fn)=>{events[name]=fn;};
  c.history={state:null,pushState(st){this.state=st;pushes.push(st);},replaceState(st,title,url){this.state=st;if(url)loc.href=new URL(url,loc.href).href;}};
  const html=fs.readFileSync(path.join(folder,'index.html'),'utf8');
  for(const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)) {
    vm.runInContext(fs.readFileSync(path.join(folder,match[1]),'utf8'),c,{filename:match[1]});
  }
  return {c,run:code=>vm.runInContext(code,c),elements,events,pushes,loc,html};
}
function esfTests() {
  for(const protocol of ['file:','https:']) {
    const t=bootFlow('emergency-fund',`${protocol}//example.test/flows/emergency-fund/index.html?screen=esf-plan&PROLIFIC_PID=p123&study=sample&profile=above_at#v=old`);
    const {run,c}=t;
    assert.equal(run('state.screen'),'onboarding');
    assert.equal(run('state.onboarding.step'),0);
    assert.equal(run('state.esf'),null);
    assert.equal(run('state.activeProfileId'),'above_at');
    assert.equal(run('ONB_STEPS.join(",")'),'zip,income,household,place,coverage,miles');
    assert.equal(c.useberryActive(),false);
    const start=JSON.stringify(run('getNavSnapshot()'));
    for(const route of ['home','settings','bpLanding','budgetBuild','profilePicker','esfPlan','helpMeOut','goals','nonsense']) {
      for(const fn of ['go','taskGo','navCommit','navAdminJump','navGoTab','navGoTabRoot']) run(`${fn}(${JSON.stringify(route)})`);
      assert.equal(run('state.screen'),'onboarding',route);
    }
    assert.equal(JSON.stringify(run('getNavSnapshot()')),start);
    for(const route of ['budget','lesson:apr','money_journal','subscription_confirm','settings']) c.navRouteTask(route);
    assert.equal(run('state.screen'),'onboarding');
    run('state.screen="settings";renderScreen()');
    assert.equal(run('state.screen'),'onboarding');
    run('state.screen="bpLanding";render()');
    assert.equal(run('state.screen'),'onboarding');
    c.restoreNavSnapshot({screen:'aboutMe',nav:{activeStack:'aboutMe',stacks:{aboutMe:['aboutMe']}}});
    assert.equal(run('state.screen'),'onboarding');
    // Complete all six setup steps using actual callbacks and supplied answers.
    run('state.onboarding.zip="10001";onbNext();onbSetIncomeTyped("84000");onbNext();onbSetAdults(1);onbSetAdultAge(0,ONB_ADULT_AGES[1].id);onbNext();onbPick("placeType",ONB_PLACE_TYPES[0].id);onbNext();onbPick("coverage",ONB_COVERAGE[0].id);onbNext();onbPick("miles",ONB_MILES[1].id);onbNext();');
    assert.equal(run('state.screen'),'esfBuild');
    assert.equal(run('state.profile.zip'),'10001');
    assert.equal(run('state.profile.incomeAnnual'),84000);
    assert.equal(run('state.esf.step'),0);
    assert.equal(run('state.tacticalGoals.length'),0);
    // Reentry restores setup answers and reseeds fund only after completion.
    c.esfBack();
    assert.equal(run('state.screen'),'onboarding');
    assert.equal(run('state.onboarding.zip'),'10001');
    assert.equal(run('state.onboarding.incomeExact'),84000);
    c.onbSkip();
    assert.equal(run('state.screen'),'esfBuild');
    assert.equal(run('state.profile.incomeAnnual'),84000);
    assert.equal(run('state.profile.zip'),'10001');
    // Excluded targets stay blocked after prerequisites exist as well.
    const reachable=run('state.screen');
    for(const route of ['home','aboutMe','settings','bpLanding','budgetBuild','profilePicker','chat','learn']) {
      const count=t.pushes.length;
      for(const fn of ['go','taskGo','navCommit','navAdminJump','navGoTab','navGoTabRoot']) run(`${fn}(${JSON.stringify(route)})`);
      c.navRouteTask(route);
      assert.equal(run('state.screen'),reachable);
      assert.equal(t.pushes.length,count);
    }
    const good=run('getNavSnapshot()');
    const poisoned=JSON.parse(JSON.stringify(good));poisoned.nav.stacks.home=['home','settings','esfBuild'];
    c.restoreNavSnapshot(poisoned);
    assert.equal(run('state.nav.stacks.home.join(",")'),'esfBuild');
    assert.equal(run('state.screen'),'esfBuild');
    // A prior document's allowed-looking entry cannot restore its session.
    c.restoreNavSnapshot({...good,mbFlowSession:'prior-document'});
    assert.equal(run('state.screen'),'onboarding');
    c.onbSkip();
    // Expense help computes then applies a figure through the real caller.
    c.esfRunHelp('Groceries');
    assert.equal(run('state.screen'),'helpMeOut');
    run('hmoTree("Groceries").questions.forEach(q=>{if(q.type==="choice" && hmoQuestionShows(q,state.helpMeOut.answers))hmoSetAnswer(q.id,q.options[0].id);})');
    c.hmoToConfirm(); assert.equal(run('state.helpMeOut.stage'),'confirm'); c.hmoAdjust(432); c.hmoAccept();
    assert.equal(run('state.screen'),'esfBuild');
    assert.equal(run('state.esf.rows.groceries'),432);
    assert.equal(run('state.esf.touched.groceries'),true);
    c.esfBuddyOpen();
    assert.equal(run('esfBuddy().open'),true);
    run('esfBuddyPick(esfBuddyItems()[0])');
    assert.ok(run('esfBuddy().thread.length')>0);
    c.esfBuddyClose();
    assert.equal(run('esfBuddy().open'),false);
    run('state.esf.step=2;esfBuddyOpen();esfBuddyAskLifestyle("power");esfLifestyleSet("power").questions.forEach(q=>esfBuddyAnswerLifestyle(q.options[q.options.length-1].id));');
    const proposed=run('esfBuddyPendingFigure()');assert.ok(proposed>0);
    const expectedBand=run('Math.round(esfBandFor(esfBuddyPendingFigure(),esfRow("power")).mid)');
    c.esfBuddyApplyFigure();assert.equal(run('esfRowValue("power")'),expectedBand);assert.equal(run('state.esf.touched.power'),true);c.esfBuddyClose();

    // Preserve source calculations and exercise actual control handlers.
    while(run('state.screen')==='esfBuild') c.esfNext();
    assert.equal(run('state.screen'),'esfPlan');
    c.esfSetCoverage(6);c.esfSetBufferRaw('15%');c.esfSetStartingBalance('1234');c.esfSetTargetDate('2027-12-01');
    assert.equal(run('esfCoverageMonths()'),6);
    assert.equal(run('state.esf.buffer'),0.15);
    const target=run('esfTarget()');
    assert.ok(target>0);
    const baseline=JSON.stringify(run('esfToBaseline()'));
    c.esfCommit();
    assert.equal(run('state.screen'),'goals');
    assert.equal(run('state.esfGoal.target'),target);
    assert.equal(run('state.esfGoal.current'),1234);
    assert.equal(run('state.esfGoal.targetDate'),'2027-12-01');
    assert.equal(run('state.tacticalGoals.length'),1);
    assert.equal(run('state.pendingBaseline'),null);
    assert.equal(run('state.planStatus'),'complete');
    const savedPushCount=t.pushes.length;
    for(const route of ['home','settings','aboutMe','bpLanding','profilePicker','learn']) {
      for(const fn of ['go','taskGo','navCommit','navAdminJump','navGoTab','navGoTabRoot']) run(`${fn}(${JSON.stringify(route)})`);
    }
    assert.equal(run('state.screen'),'goals');assert.equal(t.pushes.length,savedPushCount);
    const card=c.renderGoalsV3();
    for(const unwanted of ['goalsRemove','bpOpen','Create your own','Settings','Estimate a big purchase']) assert.ok(!card.includes(unwanted),unwanted);
    assert.ok(card.includes('esfReopen()'));
    c.esfReopen();
    assert.equal(run('state.esf.rows.groceries'),432);
    assert.equal(run('state.esf.startingBalance'),1234);
    assert.equal(JSON.stringify(run('esfToBaseline()')),baseline);
    c.esfSetRow('groceries','555');
    c.esfCommit();
    assert.equal(run('state.tacticalGoals.length'),1);
    assert.equal(run('state.expenses.rows.groceries'),555);
    assert.equal(run('state.plan.Groceries'),555);
    for(const theme of run('THEMES.map(t=>t.id)')) {c.themeSet(theme);c.render();assert.ok(c.renderTopBar().includes(`value="${theme}" selected`));}
    assert.equal(c.renderNav(),'');assert.equal(c.renderAdmin(),'');
    assert.ok(c.renderTopBar().includes('aria-label="Theme"'));
    assert.ok(t.pushes.every(s=>!['home','aboutMe','settings','bpLanding'].includes(s.screen)));
    if(protocol==='https:') {
      const u=new URL(t.loc.href);assert.equal(u.searchParams.get('PROLIFIC_PID'),'p123');assert.equal(u.searchParams.get('study'),'sample');assert.equal(u.searchParams.get('profile'),'above_at');
    }
    // Explicit restart clears only Flow URL state; a new document clears data.
    c.mbFlowRestart();
    const restarted=new URL(t.loc.replaced);assert.equal(restarted.searchParams.get('PROLIFIC_PID'),'p123');assert.equal(restarted.searchParams.get('screen'),null);assert.equal(restarted.hash,'');
    const fresh=bootFlow('emergency-fund',t.loc.replaced,true);
    assert.equal(fresh.run('state.screen'),'onboarding');assert.equal(fresh.run('state.esf'),null);assert.equal(fresh.run('state.esfGoal'),null);assert.equal(fresh.run('ubTrailOrder.length'),0);
    c.mbFlowExit();assert.equal(t.loc.assigned,'../../index.html');
  }
  // Skipped setup uses explicit defaults and entered answers beat the fallback.
  const skip=bootFlow('emergency-fund');skip.run('state.onboarding.zip="60601";onbSkipAll()');
  assert.equal(skip.run('state.screen'),'esfBuild');assert.equal(skip.run('state.profile.zip'),'60601');assert.equal(skip.run('state.activeProfileId'),skip.run('profileDefault().id'));
  // Real keypad event chain: ZIP auto-completion dispatches change, whose
  // handler reenters kbdCommit. One commit must finish and dismiss the keypad.
  const keyboard=bootFlow('emergency-fund');let changes=0;
  const input={tagName:'INPUT',value:'',getAttribute:()=>null,scrollIntoView(){},blur(){},
    dispatchEvent(event){
      if(event.type==='change')changes++;
      keyboard.c.onbLiveInput('zip',this.value);
    }};
  keyboard.c.kbdOpen(input);
  for(const digit of '10001')keyboard.c.kbdInsert(digit);
  assert.equal(changes,1);assert.equal(keyboard.run('state.onboarding.zip'),'10001');assert.equal(keyboard.run('state.kbd.open'),false);
  // Help Back/cancel returns to its expense caller without applying a figure.
  const help=bootFlow('emergency-fund');help.c.onbSkip();
  const groceries=help.run('state.esf.rows.groceries');help.c.esfRunHelp('Groceries');help.c.hmoBack();
  assert.equal(help.run('state.screen'),'esfBuild');assert.equal(help.run('state.helpMeOut'),null);assert.equal(help.run('state.esf.rows.groceries'),groceries);
  help.run('state.esf=null;state.screen="esfPlan";render()');assert.equal(help.run('state.screen'),'onboarding');
  const already=bootFlow('emergency-fund');already.c.onbSkip();
  const planBefore=JSON.stringify(already.run('state.plan'));
  already.c.esfSkipToGoal();assert.equal(already.run('state.screen'),'goals');assert.equal(JSON.stringify(already.run('state.plan')),planBefore);assert.equal(already.run('state.esfGoal'),null);
  assert.ok(already.c.renderGoalsV3().includes('esfStart()'));
  already.c.esfStart();assert.equal(already.run('state.screen'),'esfBuild');
  const prerequisite=bootFlow('emergency-fund');prerequisite.run('state.screen="esfPlan";renderScreen()');assert.equal(prerequisite.run('state.screen'),'onboarding');
  for(const slug of ['home','esf-plan','goals','onboarding-5','settings','bad%']) {
    const fresh=bootFlow('emergency-fund',`https://example.test/flows/emergency-fund/index.html?screen=${slug}`,true);
    assert.equal(fresh.run('state.screen'),'onboarding');assert.equal(fresh.run('state.onboarding.step'),0);
  }
  const cold=bootFlow('emergency-fund','https://example.test/flows/emergency-fund/index.html?screen=goals&tracking=true',true);
  assert.equal(cold.run('state.screen'),'onboarding');assert.equal(cold.c.useberryActive(),false);
}
function bpTests() {
  const excluded=['home','aboutMe','settings','budgetBuild','budget','profilePicker','chat','learn','dailyUpdate','nonsense'];
  function blocked(t,routes) {
    const screen=t.run('state.screen'),snap=JSON.stringify(t.run('getNavSnapshot()')),count=t.pushes.length;
    for(const route of routes) {
      for(const fn of ['go','taskGo','navCommit','navAdminJump','navGoTab','navGoTabRoot']) t.c[fn](route);
      t.c.navRouteTask(route);
      assert.equal(t.run('state.screen'),screen,route);
    }
    assert.equal(JSON.stringify(t.run('getNavSnapshot()')),snap);
    assert.equal(t.pushes.length,count);
  }
  function car(t,cond='new') {
    t.c.bpPickCategory('vehicle');
    t.run(`bpfKnowPick('make','Toyota');bpfKnowPick('model','4runner');bpfKnowPick('cond',${JSON.stringify(cond)});bpfKnowGo()`);
    assert.equal(t.run('state.screen'),'bpFinder');assert.equal(t.run('state.bp.finder.view'),'car');
    t.c.bpfContinue();assert.equal(t.run('state.screen'),'bpYourCar');
  }
  function fund(t) {
    while(t.run('state.screen')==='esfBuild') t.c.esfNext();
    assert.equal(t.run('state.screen'),'esfPlan');t.c.esfCommit();assert.equal(t.run('state.screen'),'goals');
  }
  function purchase(t,opts) {
    const budget=JSON.stringify(t.run('[state.budget,state.plan,state.planTotal,state.pendingBaseline,state.expenses]'));
    t.c.bpCommit(opts);
    assert.equal(JSON.stringify(t.run('[state.budget,state.plan,state.planTotal,state.pendingBaseline,state.expenses]')),budget);
    assert.ok(t.run('state.tacticalGoals.filter(g=>g.type==="purchaseSaving").length')<=1);
  }
  for(const protocol of ['file:','https:']) {
    const t=bootFlow('big-purchase',`${protocol}//example.test/flows/big-purchase/index.html?screen=bp-your-car&PROLIFIC_PID=p123&study=sample&profile=above_at#v=old`);
    const {c,run}=t;
    assert.equal(run('state.screen'),'onboarding');assert.equal(run('state.onboarding.step'),0);
    assert.equal(run('state.activeProfileId'),'above_at');assert.equal(run('ONB_STEPS.join(",")'),'zip,income,miles');assert.equal(c.useberryActive(),false);
    blocked(t,excluded.concat(['bpLanding','bpFinder','bpYourCar','bpQuiz','bpCost','bpFinance','bpCommit','esfBuild','esfPlan','helpMeOut','goals']));
    c.navBack();assert.equal(run('state.onboarding.step'),0);
    run('state.onboarding.zip="10001";onbNext();onbSetIncomeBand(ONB_INCOME_BANDS[2].id);onbNext()');
    assert.equal(run('state.onboarding.step'),2); // docked income advances on selection
    c.onbBack();assert.equal(run('state.onboarding.step'),1);
    run('onbSetIncomeTyped("84000");onbNext();onbPick("miles","15to30")');
    assert.equal(run('state.screen'),'bpLanding');assert.equal(run('state.profile.zip'),'10001');assert.equal(run('state.profile.incomeAnnual'),84000);assert.equal(run('state.profile.milesPerDay'),22);
    c.navBack();assert.equal(run('state.screen'),'onboarding');assert.equal(run('state.onboarding.step'),2);assert.equal(run('state.onboarding.incomeExact'),84000);
    c.onbNext();assert.equal(run('state.screen'),'bpLanding');
    assert.equal(run('state.tacticalGoals.length'),0);
    blocked(t,excluded.concat(['bpFinder','bpYourCar','bpQuiz','bpCost','bpOptions','bpFinance','bpCommit','esfBuild','esfPlan','helpMeOut','goals']));
    const cat=run('state.bp.category');c.bpPickCategory('home');assert.equal(run('state.bp.category'),cat);assert.equal(run('state.screen'),'bpLanding');
    c.bpEsfCheck('after');car(t);
    assert.ok(c.renderBpYourCar().includes('bpCommit({thenEsf:true})'));
    // Real cost help/overrides and financing controls carry into the saved car.
    c.bpfOpenCalc();assert.equal(run('bpBuddy().calc'),true);c.bpfCalcSet('insurance','219');c.bpBuddyClose();
    assert.equal(run('bpRowValue(bpCard("pick"),"insurance")'),219);
    c.bpSetPrice('43000');c.bpFinChoose('down','other');c.bpSetDownAmount('6000');c.bpFinChoose('term',48);c.bpSetTypedRate('5.25');c.bpSetSaved('1234');c.bpYcPickOpt('monthsOut',18);
    const session=run('state.bp'),figures=JSON.stringify(run('[state.bp.setup,state.bp.pay,state.bp.plan,state.bp.cardRows,state.bp.finder]'));
    // First-step Back returns to the actual after-save caller, preserving plan.
    purchase(t,{thenEsf:true});assert.equal(run('state.screen'),'esfBuild');assert.equal(run('state.bp.esfCaller.kind'),'after');assert.equal(run('state.bp.esfCaller.screen'),'bpYourCar');
    c.navBack();assert.equal(run('state.screen'),'bpYourCar');assert.equal(run('state.bp'),session);assert.equal(JSON.stringify(run('[state.bp.setup,state.bp.pay,state.bp.plan,state.bp.cardRows,state.bp.finder]')),figures);
    purchase(t,{thenEsf:true});assert.equal(run('ONB_STEPS.length'),3);assert.equal(run('state.onboarding'),null);
    // Included expense help and Buddy use this package's session and callbacks.
    c.esfRunHelp('Groceries');assert.equal(run('state.screen'),'helpMeOut');c.hmoBack();assert.equal(run('state.screen'),'esfBuild');
    c.esfSetRow('groceries','543');c.esfBuddyOpen();run('esfBuddyPick(esfBuddyItems()[0])');assert.ok(run('esfBuddy().thread.length')>0);c.esfBuddyClose();
    fund(t);assert.equal(run('state.plan.Groceries'),545);assert.equal(run('state.tacticalGoals.filter(g=>esfIsEsfGoal(g)).length'),1);assert.equal(run('state.tacticalGoals.filter(g=>g.type==="purchaseSaving").length'),1);
    assert.ok(c.renderGoalsV3().includes('Back to your car'));c.bpResumeAfterEsf();assert.equal(run('state.screen'),'bpYourCar');assert.equal(run('state.bp'),session);assert.equal(JSON.stringify(run('[state.bp.setup,state.bp.pay,state.bp.plan,state.bp.cardRows,state.bp.finder]')),figures);
    purchase(t);assert.equal(run('state.screen'),'goals');purchase(t);assert.equal(run('state.tacticalGoals.length'),2);
    c.esfReopen();c.esfSetRow('groceries','654');fund(t);assert.equal(run('state.plan.Groceries'),655);assert.equal(run('state.tacticalGoals.length'),2);assert.equal(run('state.pendingBaseline'),null);
    c.bpResumeAfterEsf();assert.equal(run('state.screen'),'bpYourCar');
    c.bpYcSetNeed(false);assert.ok(!c.renderBpYourCar().includes('thenEsf'));purchase(t,{noGoal:true});assert.equal(run('state.bigPurchase.goalId'),null);assert.equal(run('state.tacticalGoals.filter(g=>g.type==="purchaseSaving").length'),0);
    blocked(t,excluded);
    for(const unwanted of ['goalsRemove','Create your own','Settings',"go('budget')"]) assert.ok(!c.renderGoalsV3().includes(unwanted));
    for(const theme of run('THEMES.map(t=>t.id)')) {c.themeSet(theme);c.render();assert.ok(c.renderTopBar().includes(`value="${theme}" selected`));}
    assert.equal(c.renderNav(),'');assert.equal(c.renderAdmin(),'');
    const good=run('getNavSnapshot()'),poisoned=JSON.parse(JSON.stringify(good));poisoned.nav.stacks.home=['home','settings','goals'];c.restoreNavSnapshot(poisoned);assert.equal(run('state.nav.stacks.home.join(",")'),'goals');
    c.restoreNavSnapshot({...good,mbFlowSession:'prior-document'});assert.equal(run('state.screen'),'onboarding');
    run('state.screen="settings";renderScreen()');assert.equal(run('state.screen'),'onboarding');run('state.screen="budgetBuild";render()');assert.equal(run('state.screen'),'onboarding');
    c.mbFlowRestart();const url=new URL(t.loc.replaced);assert.equal(url.searchParams.get('screen'),null);assert.equal(url.hash,'');assert.equal(url.searchParams.get('PROLIFIC_PID'),'p123');assert.equal(url.searchParams.get('study'),'sample');assert.equal(url.searchParams.get('profile'),'above_at');
    const fresh=bootFlow('big-purchase',t.loc.replaced,true);assert.equal(fresh.run('state.screen'),'onboarding');assert.equal(fresh.run('state.bp'),null);assert.equal(fresh.run('state.esf'),null);assert.equal(fresh.run('state.bigPurchase'),null);assert.equal(fresh.run('ubTrailOrder.length'),0);
    c.mbFlowExit();assert.equal(t.loc.assigned,'../../index.html');
  }
  // Before-purchase caller is separately exercised; Back and completion differ.
  const before=bootFlow('big-purchase');before.run('state.onboarding.zip="60601";onbSkipAll()');assert.equal(before.run('state.profile.zip'),'60601');
  const original=before.run('state.bp');before.c.bpEsfCheck('startFirst');assert.equal(before.run('state.screen'),'esfBuild');before.c.esfBack();assert.equal(before.run('state.screen'),'bpLanding');assert.equal(before.run('state.bp'),original);
  before.c.bpEsfCheck('startFirst');fund(before);before.c.bpResumeAfterEsf();assert.equal(before.run('state.screen'),'bpFinder');assert.equal(before.run('state.bp'),original);
  // Reporting an existing fund also resumes the car without creating a fund/budget.
  const existing=bootFlow('big-purchase');existing.c.onbSkipAll();existing.c.bpEsfCheck('startFirst');const existingBudget=JSON.stringify(existing.run('state.plan'));existing.c.esfSkipToGoal();assert.equal(existing.run('state.esfGoal'),null);assert.equal(JSON.stringify(existing.run('state.plan')),existingBudget);existing.c.bpResumeAfterEsf();assert.equal(existing.run('state.screen'),'bpFinder');
  // After-save no-goal semantics survive starting the fund from the real CTA.
  const noGoal=bootFlow('big-purchase');noGoal.c.onbSkipAll();noGoal.c.bpEsfCheck('after');car(noGoal);noGoal.c.bpYcSetNeed(false);assert.ok(noGoal.c.renderBpYourCar().includes('bpCommit({thenEsf:true,noGoal:true})'));purchase(noGoal,{thenEsf:true,noGoal:true});assert.equal(noGoal.run('state.bigPurchase.goalId'),null);fund(noGoal);noGoal.c.bpResumeAfterEsf();assert.equal(noGoal.run('state.bp.plan.needSave'),false);assert.equal(noGoal.run('state.screen'),'bpYourCar');
  // Finder quiz, comparison choices, and used-car lease guard.
  const quiz=bootFlow('big-purchase');quiz.c.onbSkipAll();quiz.c.bpPickCategory('vehicle');quiz.c.bpfStartPath('quiz');quiz.run('bpfQuizQuestions().forEach(q=>bpfQuizAnswer(q.id,q.options[0].id))');assert.equal(quiz.run('bpfQuizDone()'),true);quiz.c.bpfSetTier('everyday');quiz.run('var bucket=bpfBucket();var matches=bpfCarsFor(bucket.type,bucket.use,bpfSession().tier,bpfQuizResult().green);bpfChoose(matches[0].id,"new")');quiz.c.bpfContinue();assert.equal(quiz.run('state.screen'),'bpYourCar');quiz.c.bpYcOpenAlts();assert.equal(quiz.run('state.bp.ui.sheet'),'bpYcAlts');quiz.run('bpfChooseAlt(bpfModels()[0].id,"used")');assert.equal(quiz.run('state.bp.ui.sheet'),null);quiz.c.bpYcSetMode('lease');assert.equal(quiz.run('bpLeasing(bpSelectedCard())'),false);quiz.c.bpYcSearchAll();assert.equal(quiz.run('state.screen'),'bpFinder');assert.equal(quiz.run('state.bp.finder.view'),'start');
  // Loan/cash/lease save calculations retain the selected model and settings.
  const lease=bootFlow('big-purchase');lease.c.onbSkipAll();car(lease);lease.c.bpYcSetMode('lease');lease.c.bpYcPickOpt('leaseDue',2500);lease.c.bpYcPickOpt('leaseTerm',36);lease.c.bpYcPickOpt('leaseMiles',12000);const amount=lease.run('bpLeaseAfford(bpSelectedCard()).toSave');purchase(lease);assert.equal(lease.run('state.bigPurchase.payMode'),'lease');assert.equal(lease.run('state.bigPurchase.toSave'),amount);lease.c.go('bpYourCar');lease.c.bpYcSetMode('cash');purchase(lease);assert.equal(lease.run('state.bigPurchase.payMode'),'cash');assert.equal(lease.run('state.tacticalGoals.length'),1);
  // Reminders keep their source intent-only effect and never open Budget.
  lease.run('state.bigPurchase.remindBudget=true;state.tacticalGoals.find(g=>g.type==="purchaseSaving").current=state.tacticalGoals.find(g=>g.type==="purchaseSaving").target');
  assert.equal(lease.run('bpReminderDue().source'),'goal');const reminderPlan=JSON.stringify(lease.run('[state.budget,state.plan,state.pendingBaseline]'));
  assert.ok(!lease.c.renderBpGoalsCards().includes("go('budget')"));lease.c.bpBudgetAnswer('goal','added');assert.equal(lease.run('state.screen'),'goals');assert.ok(lease.run('state.bigPurchase.budgetIntent.monthly')>0);assert.equal(JSON.stringify(lease.run('[state.budget,state.plan,state.pendingBaseline]')),reminderPlan);
  lease.run('state.bigPurchase.goalId=null;state.bigPurchase.reminderClosed=false;state.bigPurchase.taskDue="2000-01-01"');assert.equal(lease.run('bpReminderDue().source'),'task');lease.c.bpBudgetAnswer('task','notYet');assert.equal(lease.run('bpReminderDue()'),null);lease.c.bpBudgetAnswer('task','declined');assert.equal(lease.run('state.bigPurchase.reminderClosed'),true);
  for(const step of [0,1,2]) {const skip=bootFlow('big-purchase');skip.run(`state.onboarding.step=${step}`);skip.c.onbSkip();assert.equal(skip.run('state.screen'),'bpLanding');skip.c.bpLandingBack();assert.equal(skip.run('state.onboarding.step'),step);}
  // Retained source setup/quiz/cost/options/finance paths stay usable and guarded.
  const legacy=bootFlow('big-purchase');legacy.c.onbSkipAll();legacy.c.go('bpSetup');legacy.c.bpQuizStart();legacy.run('bpQuizQuestions().forEach(q=>bpQuizAnswer(q.id,q.options[0].id));bpQuizUse();bpSetupPrice("35000");bpSetupNext()');assert.equal(legacy.run('state.screen'),'bpCost');legacy.c.bpExploreChoose('explore');assert.equal(legacy.run('state.screen'),'bpOptions');legacy.c.bpChooseOption('pick');assert.equal(legacy.run('state.screen'),'bpFinance');legacy.c.bpGoPlan();assert.equal(legacy.run('state.screen'),'bpCommit');purchase(legacy);assert.equal(legacy.run('state.screen'),'goals');
  // Cold allowed destinations do not invent feature/session prerequisites.
  for(const screen of ['bpYourCar','bpFinder','bpQuiz','bpCost','bpOptions','bpFinance','bpCommit','esfBuild','esfPlan','helpMeOut','goals']) {
    const t=bootFlow('big-purchase');t.run(`state.screen=${JSON.stringify(screen)};renderScreen()`);assert.equal(t.run('state.screen'),'onboarding',screen);
  }
  for(const slug of ['home','bp-your-car','bp-finder','goals','esf-plan','onboarding-2','bad%']) {
    const t=bootFlow('big-purchase',`https://example.test/flows/big-purchase/index.html?screen=${slug}&tracking=true`,true);assert.equal(t.run('state.screen'),'onboarding');assert.equal(t.run('state.onboarding.step'),0);assert.equal(t.c.useberryActive(),false);
  }
  const keyboard=bootFlow('big-purchase');let changes=0;
  const input={tagName:'INPUT',value:'',getAttribute:()=>null,scrollIntoView(){},blur(){},dispatchEvent(event){if(event.type==='change')changes++;keyboard.c.onbLiveInput('zip',this.value);}};
  keyboard.c.kbdOpen(input);for(const digit of '10001')keyboard.c.kbdInsert(digit);assert.equal(changes,1);assert.equal(keyboard.run('state.onboarding.zip'),'10001');assert.equal(keyboard.run('state.kbd.open'),false);
}
if(require.main===module) {esfTests();bpTests();console.log('Emergency fund and big purchase actual-script runtime journeys and containment checks passed.');}
module.exports={bootFlow,esfTests,bpTests};
