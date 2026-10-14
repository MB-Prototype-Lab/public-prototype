// Real-browser Flow verification; runs in CI's Browser journeys job (tests/browser).
// MB_PLAYWRIGHT_MODULE=/path/to/playwright node tests/flows-browser.cjs
// Add MB_FLOW_BASE_URL=http://127.0.0.1:8765 for HTTP participant-link checks.
// MB_CHROMIUM_ARGS is an optional JSON array; MB_CHROMIUM_EXECUTABLE selects a binary.
const { chromium } = require(process.env.MB_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const { pathToFileURL } = require('node:url');
const http = require('node:http');
const repo = process.cwd();
const {checkExpandButton} = require('./flows-tools-browser.cjs');
async function expectScreen(page, screen) { await page.waitForFunction(s => typeof state !== 'undefined' && state.screen === s, screen); }
// Refresh without the pin returns to the selector; with Pin on refresh it
// restarts the same Flow fresh (js/refresh-pin.js).
async function reloadChecks(page) {
 const here=page.url();
 await openTools(page);
 const pinned=page.getByLabel('Pin on refresh',{exact:true});
 if(await pinned.isChecked()) await pinned.uncheck();
 await page.getByRole('button',{name:'Close Tools',exact:true}).click();
 await page.reload();
 await page.waitForURL(u=>u.pathname.endsWith('/index.html')&&!u.pathname.includes('/flows/'));
 await page.goto(here);
 await expectScreen(page,'onboarding');
 await openTools(page);
 const pin=page.getByLabel('Pin on refresh',{exact:true});
 if(!(await pin.isChecked())) await pin.check();
 await page.reload();
 await expectScreen(page,'onboarding');
}
async function openTools(page) {
 const toggle=page.locator('#adminExpandTab');
 if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
}
async function checkTools(page) {
 await checkExpandButton(page, page.context().browser());
 assert.equal(await page.locator('#adminExpandTab').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('.mb-flow-controls').count(),0);
 assert.equal(await page.locator('.phone #topbarRoot').innerHTML(),'');
 assert.equal(await page.locator('#screenRoot').evaluate(el=>el.classList.contains('no-topbar')),true);
 await page.getByPlaceholder('ZIP code').fill('90210');
 await page.getByPlaceholder('ZIP code').press('Tab');
 const answers=await page.evaluate(()=>JSON.stringify(state.onboarding));
 // Phone widths have no Tools, as in the full app (checked by checkExpandButton).
 for(const width of [1440,900]) {
  await page.setViewportSize({width,height:900});
  const phoneBefore=await page.locator('.phone').boundingBox();
  await page.locator('#adminExpandTab').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#adminExpandTab').getAttribute('aria-expanded'),'true');
  const phone=await page.locator('.phone').boundingBox(), admin=await page.locator('.admin').boundingBox();
  assert.equal(phone.width,phoneBefore.width);assert.equal(phone.height,phoneBefore.height);
  assert(width>900 ? admin.x>=phone.x+phone.width : admin.y>=phone.y+phone.height);
  assert.equal(await page.locator('.phone .admin, .phone #themePicker, .phone #adminExpandTab').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(state.onboarding)),answers);
  await page.getByRole('button',{name:'Close Tools',exact:true}).click();
  assert.equal(await page.locator('#adminExpandTab').evaluate(el=>el===document.activeElement),true);
 }
 await page.setViewportSize({width:900,height:844});
 await openTools(page);
 const steps=await page.evaluate(()=>MB_FLOW.setup_steps);
 assert.deepEqual(await page.locator('#flowSetupStep option').allTextContents(),steps);
 for(let i=0;i<steps.length;i++) {
  await page.getByLabel('Setup step',{exact:true}).focus();
  await page.getByLabel('Setup step',{exact:true}).selectOption(String(i));
  assert.equal(await page.evaluate(()=>state.onboarding.step),i);
  assert.equal(await page.getByLabel('Setup step',{exact:true}).evaluate(el=>el===document.activeElement),true);
 }
 await page.getByLabel('Active profile',{exact:true}).selectOption('above_at');
 assert.equal(await page.evaluate(()=>state.activeProfileId),'above_at');
 assert.equal(await page.evaluate(()=>state.onboarding.zip),'90210');
 await page.getByRole('button',{name:'Copy State',exact:true}).click();
 await page.getByRole('button',{name:'Close Tools',exact:true}).click();
 await reloadChecks(page);
 assert.equal(await page.locator('#adminExpandTab').getAttribute('aria-expanded'),'false');
}
async function next(page) { await page.locator('#onbContinue').click(); }
async function setup(page, destination='esfBuild') {
  await page.getByPlaceholder('ZIP code').fill('10001');
  await page.getByPlaceholder('ZIP code').press('Tab');
  await next(page);
  await page.locator('button[onclick^="onbSetIncomeBand"]').nth(1).click();
  if (await page.locator('#onbContinue').count()) await next(page);
  const household = await page.evaluate(() => ONB_STEPS[state.onboarding.step]);
  if (household === 'household') {
    await page.getByRole('button', {name:'Just me', exact:true}).click();
    const ages = page.getByLabel('Your age', {exact:true});
    const value = await ages.locator('option:not([disabled])').nth(1).getAttribute('value');
    await ages.selectOption(value);
    await next(page);
  }
  for (let i=0;i<6;i++) {
    if (await page.evaluate(() => state.screen !== 'onboarding')) break;
    const field=await page.evaluate(() => ONB_STEPS[state.onboarding.step]);
    if (!['place','coverage','miles'].includes(field)) throw new Error('Unexpected setup step '+field);
    await page.locator('button[onclick^="onbPick"]').first().click();
    if (await page.locator('#onbContinue').count()) await next(page);
  }
  await expectScreen(page,destination);
}
async function finishFund(page) {
 for(let i=0;i<8 && await page.evaluate(()=>state.screen==='esfBuild');i++) {
  await page.locator('button[onclick="esfNext()"]').first().click();
 }
 await expectScreen(page,'esfPlan');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#screenRoot img')).every(img=>img.complete&&img.naturalWidth>0));
}
async function saveAndReopenFund(page) {
 await finishFund(page);
 await page.getByLabel('Amount already saved',{exact:true}).fill('250');
 await page.getByLabel('Amount already saved',{exact:true}).press('Tab');
 await page.getByLabel('Target date',{exact:true}).fill('2027-12-01');
 await page.getByLabel('Target date',{exact:true}).press('Tab');
 await page.getByRole('button',{name:'Set my goal',exact:true}).click();
 await expectScreen(page,'goals');
 assert.equal(await page.evaluate(()=>state.esfGoal.current),250);
 assert.equal(await page.evaluate(()=>state.tacticalGoals.filter(esfLooksLikeEsfGoal).length),1);
 assert.equal(await page.locator('.goal-card').count(),1);
 assert.equal(await page.evaluate(()=>!!state.expenses && state.planStatus==='complete' && !state.pendingBaseline),true);
 const figures=await page.evaluate(()=>JSON.stringify(state.esf.rows));
 await page.getByRole('button',{name:'Review my fund',exact:true}).click();
 await expectScreen(page,'esfBuild');
 assert.equal(await page.evaluate(()=>JSON.stringify(state.esf.rows)),figures);
 await finishFund(page);
 await page.getByLabel('Amount already saved',{exact:true}).fill('300');
 await page.getByLabel('Amount already saved',{exact:true}).press('Tab');
 await page.getByRole('button',{name:'Set my goal',exact:true}).click();
 await expectScreen(page,'goals');
 assert.equal(await page.evaluate(()=>state.esfGoal.current),300);
 assert.equal(await page.evaluate(()=>state.tacticalGoals.filter(esfLooksLikeEsfGoal).length),1);
}
async function chooseCar(page) {
 await expectScreen(page,'bpFinder');
 await page.locator('button[onclick="bpfOpenList(\'make\')"]').click();
 await page.getByRole('option',{name:'Toyota',exact:true}).click();
 await page.locator('.bp-sheet-list button[role="option"]').first().click();
 await page.locator('button[onclick="bpfKnowPick(\'cond\',\'new\')"]').click();
 await page.locator('button[onclick="bpfKnowGo()"]').click();
 await page.waitForFunction(()=>bpfSession().view==='car');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#screenRoot img')).every(img=>img.complete&&img.naturalWidth>0));
 await page.locator('button[onclick="bpfContinue()"]').click();
 await expectScreen(page,'bpYourCar');
}
async function purchaseBrowser(browser,temp,mode) {
 const page=await browser.newPage({viewport:{width:900,height:844}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const pkg=path.join(temp,'flows','big-purchase');
 fs.cpSync(path.join(repo,'flows','big-purchase'),pkg,{recursive:true});
 const base=mode==='file'?pathToFileURL(path.join(pkg,'index.html')).href:new URL('flows/big-purchase/index.html',process.env.MB_FLOW_BASE_URL.replace(/\/?$/, '/')).href;
 await page.goto(base+'?participant=car-123&screen=budget&tracking=true');
 await expectScreen(page,'onboarding');
 page.on('dialog',dialog=>dialog.dismiss());
 await checkTools(page);
 await setup(page,'bpLanding');
 const originalAnswers=await page.evaluate(()=>JSON.stringify(state.bpOnbReturn));
 await page.getByRole('button',{name:'Back',exact:true}).first().click();
 await expectScreen(page,'onboarding');
 assert.equal(await page.evaluate(()=>ONB_STEPS[state.onboarding.step]),'miles');
 assert.equal(await page.evaluate(()=>state.onboarding.zip),'10001');
 await page.getByRole('button',{name:'Skip',exact:true}).click();
 await expectScreen(page,'bpLanding');
 assert(originalAnswers.includes('10001'));
 await page.getByRole('button',{name:'Start One Now',exact:true}).click();
 await expectScreen(page,'esfBuild');
 await page.getByRole('button',{name:'Back',exact:true}).first().click();
 await expectScreen(page,'bpLanding');
 // The collapsed answer remains changeable before re-entering the detour.
 await page.locator('button[onclick="bpEsfCheck(null)"]').click();
 await page.getByRole('button',{name:'Start One Now',exact:true}).click();
 await finishFund(page);
 await page.getByRole('button',{name:'Set my goal',exact:true}).click();
 await expectScreen(page,'goals');
 await page.getByRole('button',{name:'Back to your car',exact:true}).click();
 await chooseCar(page);
 for(const theme of ['light','dark','naturalLight','naturalDark']) {
  await openTools(page);
  await page.locator('#themePicker button[onclick="themeSet(\''+theme+'\')"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.getByRole('button',{name:'Close Tools',exact:true}).click();
 for(const payment of ['Cash','Lease','Loan']) {
  await page.getByRole('button',{name:payment,exact:true}).click();
  assert.equal(await page.getByRole('button',{name:payment,exact:true}).getAttribute('aria-pressed'),'true');
 }
 const budget=await page.evaluate(()=>JSON.stringify(state.plan));
 await page.getByLabel('Already saved, dollars',{exact:true}).fill('100');
 await page.getByLabel('Already saved, dollars',{exact:true}).press('Tab');
 await page.locator('.bp-yc-cta button[onclick="bpCommit()"]').click();
 await expectScreen(page,'goals');
 assert.equal(await page.evaluate(()=>JSON.stringify(state.plan)),budget);
 assert.equal(await page.evaluate(()=>state.tacticalGoals.filter(g=>g.type==='purchaseSaving').length),1);
 // Separate fresh document proves the after-save caller does not inherit before.
 await openTools(page);
 await page.getByRole('button',{name:'Restart Flow',exact:true}).click();
 await expectScreen(page,'onboarding');
 await page.getByRole('button',{name:'Skip',exact:true}).click();
 await expectScreen(page,'bpLanding');
 await page.getByRole('button',{name:'Ask me later',exact:true}).click();
 await page.locator('button[onclick="bpPickCategory(\'vehicle\')"]').click();
 await chooseCar(page);
 await page.getByLabel('Already saved, dollars',{exact:true}).fill('200');
 await page.getByLabel('Already saved, dollars',{exact:true}).press('Tab');
 const afterBudget=await page.evaluate(()=>JSON.stringify(state.plan));
 const selection=await page.evaluate(()=>JSON.stringify(bpfSelected()));
 await page.getByRole('button',{name:'Save and start emergency fund',exact:true}).click();
 await expectScreen(page,'esfBuild');
 assert.equal(await page.evaluate(()=>state.bp.esfCaller.kind),'after');
 assert.equal(await page.evaluate(()=>JSON.stringify(state.plan)),afterBudget);
 await page.getByRole('button',{name:'Back',exact:true}).first().click();
 await expectScreen(page,'bpYourCar');
 assert.equal(await page.evaluate(()=>JSON.stringify(bpfSelected())),selection);
 assert.equal(await page.getByLabel('Already saved, dollars',{exact:true}).inputValue(),'$200');
 await page.getByRole('button',{name:'Save and start emergency fund',exact:true}).click();
 await finishFund(page);
 await page.getByRole('button',{name:'Set my goal',exact:true}).click();
 await expectScreen(page,'goals');
 assert.notEqual(await page.evaluate(()=>JSON.stringify(state.plan)),afterBudget);
 await page.getByRole('button',{name:'Back to your car',exact:true}).click();
 await expectScreen(page,'bpYourCar');
 assert.equal(await page.evaluate(()=>JSON.stringify(bpfSelected())),selection);
 const esfBudget=await page.evaluate(()=>JSON.stringify(state.plan));
 await page.locator('.bp-yc-cta button[onclick="bpCommit()"]').click();
 await expectScreen(page,'goals');
 assert.equal(await page.evaluate(()=>JSON.stringify(state.plan)),esfBudget);
 assert.equal(await page.evaluate(()=>state.tacticalGoals.filter(g=>g.type==='purchaseSaving').length),1);
 assert.equal(await page.evaluate(()=>state.tacticalGoals.filter(esfLooksLikeEsfGoal).length),1);
 // Exercise every restored interactive purchase tool through its rendered UI.
 await openTools(page);
 const savedBudget=await page.evaluate(()=>JSON.stringify(state.plan));
 await page.getByRole('button',{name:'Mark the goal reached',exact:true}).click();
 await expectScreen(page,'goals');
 await page.getByRole('button',{name:'Make the purchase date today',exact:true}).click();
 await page.evaluate(()=>go('bpFinder'));
 await page.getByRole('button',{name:'Jump: Toyota 4Runner, new',exact:true}).click();
 await page.evaluate(()=>go('bpSetup'));
 await page.getByRole('button',{name:'Fill: Everyday SUV · Gas · New · $35,000',exact:true}).click();
 await page.evaluate(()=>go('bpCost'));
 for(const variant of ['A','B']) {
  await page.getByRole('button',{name:'Version '+variant,exact:true}).click();
  assert.equal(await page.evaluate(()=>state.bp.costVariant),variant);
 }
 for(const screen of ['bpOptions','bpFinance','bpCommit']) {
  await page.evaluate(s=>go(s),screen);
  assert(await page.locator('#adminRoot').innerText());
 }
 await page.evaluate(()=>bpQuizStart());
 assert((await page.locator('#adminRoot').innerText()).includes('Scores'));
 assert.equal(await page.evaluate(()=>JSON.stringify(state.plan)),savedBudget);
 assert.equal(await page.evaluate(()=>__navLog.every(s=>MB_FLOW.allowed_screens.includes(s))),true);
 await reloadChecks(page);
 assert.equal(await page.evaluate(()=>state.bp),null);
 assert.equal(new URL(page.url()).searchParams.get('participant'),'car-123');
 assert.equal(errors.length,0,errors.join('\n'));
 await openTools(page);
 await page.getByRole('button',{name:'Exit Flow',exact:true}).click();
 await page.waitForURL(u=>u.pathname.endsWith('/index.html')&&!u.pathname.includes('/flows/'));
 console.log('PASS BP '+process.platform+' Chromium '+mode+': docked setup/back/skip, actual finder/model/cost/loan/cash/lease, before and after ESF save/back/resume, intact inputs, repeat saves, distinct budget effects, themes/narrow, refresh/restart/exit and participant parameters');
 await page.close();
}
(async()=>{
 const browser=await chromium.launch({headless:true, args:JSON.parse(process.env.MB_CHROMIUM_ARGS || '[]'), ...(process.env.MB_CHROMIUM_EXECUTABLE ? {executablePath:process.env.MB_CHROMIUM_EXECUTABLE} : {})});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'MoneyBuddy Flow path spaces '));
 const server=http.createServer((req,res)=>{
  const file=path.resolve(temp,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(temp+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
   if(error){res.writeHead(404).end();return;}
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
   res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
   res.end(data);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const pkg=path.join(temp,'flows','emergency-fund');
  fs.mkdirSync(path.dirname(pkg),{recursive:true});
  fs.cpSync(path.join(repo,'flows','emergency-fund'),pkg,{recursive:true});
  fs.writeFileSync(path.join(temp,'index.html'),'<title>Selector destination</title>');
  // Exercise the actual creation adapter against a full source application.
  const starter=path.join(temp,'flows','starter');
  fs.cpSync(path.join(repo,'app'),starter,{recursive:true});
  execFileSync('python3',['-c', 'from pathlib import Path; from scripts.flows import adapt_starter; import sys; adapt_starter(Path(sys.argv[1]))',starter],{cwd:repo});
  fs.writeFileSync(path.join(starter,'flow-config.js'),'window.MB_FLOW={id:"starter",entry:"onboarding",allowed_screens:["onboarding"],setup_steps:[]};');
  for(const mode of ['file','http']) {
  const starterPage=await browser.newPage({viewport:{width:900,height:844}});
  const starterErrors=[];
  starterPage.on('pageerror',e=>starterErrors.push(e.message));
  await starterPage.goto(mode==='file' ? pathToFileURL(path.join(starter,'index.html')).href : 'http://127.0.0.1:'+server.address().port+'/flows/starter/index.html');
  await expectScreen(starterPage,'onboarding');
  assert.equal(await starterPage.locator('.admin:visible').count(),0);
  await checkExpandButton(starterPage,browser);
  await openTools(starterPage);
  assert.equal(await starterPage.locator('#flowSetupStep').count(),0);
  assert.equal(await starterPage.locator('.phone button[onclick*="mbFlowRestart"], .phone button[onclick*="mbFlowExit"]').count(),0);
  assert.equal(await starterPage.locator('#adminRoot select').count(),1);
  await starterPage.getByLabel('Active profile',{exact:true}).selectOption('above_at');
  await starterPage.evaluate(()=>{go('settings');navAdminJump('home');});
  await expectScreen(starterPage,'onboarding');
  assert.equal(starterErrors.length,0,starterErrors.join('\n'));
  await starterPage.close();
  console.log('PASS generated starter '+mode+': collapsed outside-phone tools, safe profile-only setup controls, excluded routes blocked');
  }

  for (const mode of (process.env.MB_FLOW_BASE_URL ? ['file','http'] : ['file'])) {
   const page=await browser.newPage({viewport:{width:900,height:844}});
   const errors=[];
   page.on('pageerror',e=>{errors.push(e.message); console.error(mode,e.stack.split('\n').slice(0,7).join('\n'));});
   const base=mode==='file'?pathToFileURL(path.join(pkg,'index.html')).href:new URL('flows/emergency-fund/index.html',process.env.MB_FLOW_BASE_URL.replace(/\/?$/, '/')).href;
   await page.goto(base+'?participant=review-123&screen=budget&useberry=true&tracking=true');
   await expectScreen(page,'onboarding');
   page.on('dialog',dialog=>dialog.dismiss());
   await checkTools(page);
   assert.equal(await page.locator('.admin:visible').count(),0);
   assert.equal(await page.locator('#navRoot button').count(),0);
   await page.getByPlaceholder('ZIP code').focus();
   assert.equal(await page.getByPlaceholder('ZIP code').evaluate(e=>document.activeElement===e),true);
   await setup(page);
   assert.equal(await page.evaluate(()=>state.profile.zip),'10001');
   await page.getByRole('button',{name:'Back',exact:true}).first().click();
   await expectScreen(page,'onboarding');
   assert.equal(await page.getByPlaceholder('ZIP code').inputValue(),'10001');
   const saved=await page.evaluate(()=>JSON.stringify(state.onboarding));
   assert(saved.includes('10001'));
   await page.getByRole('button',{name:'Skip',exact:true}).click();
   await expectScreen(page,'esfBuild');
   assert.equal(await page.evaluate(()=>state.profile.zip),'10001');
   for(const theme of ['light','dark','naturalLight','naturalDark']){
    await openTools(page);
  await page.locator('#themePicker button[onclick="themeSet(\''+theme+'\')"]').click();
    assert.equal(await page.evaluate(()=>themeCurrent().id),theme);
    assert.equal(await page.locator('.phone').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   await page.getByRole('button',{name:'Close Tools',exact:true}).click();
   await saveAndReopenFund(page);
   assert.equal(await page.evaluate(()=>Array.from(document.scripts).some(s=>/useberry.*(?:\.com|\.io)/i.test(s.src))),false);
   if(mode==='http')assert.equal(new URL(page.url()).searchParams.get('participant'),'review-123');
   await reloadChecks(page);
   assert.equal(await page.evaluate(()=>state.esf),null);
   assert.equal(await page.getByPlaceholder('ZIP code').inputValue(),'');
   await page.getByRole('button',{name:'Skip',exact:true}).click();
   await expectScreen(page,'esfBuild');
   await openTools(page);
 await page.getByRole('button',{name:'Restart Flow',exact:true}).click();
   await expectScreen(page,'onboarding');
   assert.equal(new URL(page.url()).searchParams.get('participant'),'review-123');
   assert.equal(errors.length,0,errors.join('\n'));
   if(process.env.MB_FLOW_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.MB_FLOW_SCREENSHOT_DIR,'mb-esf-'+mode+'-review.png')});
   await openTools(page);
 await page.getByRole('button',{name:'Exit Flow',exact:true}).click();
   await page.waitForURL(u=>u.pathname.endsWith('/index.html')&&!u.pathname.includes('/flows/'));
   console.log('PASS ESF '+process.platform+' Chromium '+mode+': actual setup inputs/clicks, first-expense Back/Skip answers, themes/narrow layout, focus, fund media/save/reopen/repeat save, tracking off, refresh, restart, exit; '+(mode==='file'?'path with spaces':'participant parameters'));
   await page.close();
   await purchaseBrowser(browser,temp,mode);
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
