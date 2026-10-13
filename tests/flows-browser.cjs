// Optional real-browser verification; no dependency installation or CI requirement.
// MB_PLAYWRIGHT_MODULE=/path/to/playwright node tests/flows-browser.cjs
// Add MB_FLOW_BASE_URL=http://127.0.0.1:8765 for HTTP participant-link checks.
// MB_CHROMIUM_ARGS is an optional JSON array; MB_CHROMIUM_EXECUTABLE selects a binary.
const { chromium } = require(process.env.MB_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const repo = process.cwd();
async function expectScreen(page, screen) { await page.waitForFunction(s => typeof state !== 'undefined' && state.screen === s, screen); }
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
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const pkg=path.join(temp,'flows','big-purchase');
 fs.cpSync(path.join(repo,'flows','big-purchase'),pkg,{recursive:true});
 const base=mode==='file'?pathToFileURL(path.join(pkg,'index.html')).href:new URL('flows/big-purchase/index.html',process.env.MB_FLOW_BASE_URL.replace(/\/?$/, '/')).href;
 await page.goto(base+'?participant=car-123&screen=budget&tracking=true');
 await expectScreen(page,'onboarding');
 await setup(page,'bpLanding');
 const originalAnswers=await page.evaluate(()=>JSON.stringify(state.bpOnbReturn));
 await page.locator('.mb-flow-controls button').filter({hasText:/^Back$/}).click();
 await expectScreen(page,'onboarding');
 assert.equal(await page.evaluate(()=>ONB_STEPS[state.onboarding.step]),'miles');
 assert.equal(await page.evaluate(()=>state.onboarding.zip),'10001');
 await page.getByRole('button',{name:'Skip',exact:true}).click();
 await expectScreen(page,'bpLanding');
 assert(originalAnswers.includes('10001'));
 await page.getByRole('button',{name:'Start One Now',exact:true}).click();
 await expectScreen(page,'esfBuild');
 await page.locator('.mb-flow-controls button').filter({hasText:/^Back$/}).click();
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
  await page.getByLabel('Theme',{exact:true}).selectOption(theme);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
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
 await page.getByRole('button',{name:'Restart',exact:true}).click();
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
 await page.locator('.mb-flow-controls button').filter({hasText:/^Back$/}).click();
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
 await page.reload();
 await expectScreen(page,'onboarding');
 assert.equal(await page.evaluate(()=>state.bp),null);
 assert.equal(new URL(page.url()).searchParams.get('participant'),'car-123');
 assert.equal(errors.length,0,errors.join('\n'));
 await page.getByRole('button',{name:'Exit',exact:true}).click();
 await page.waitForURL(u=>u.pathname.endsWith('/index.html')&&!u.pathname.includes('/flows/'));
 console.log('PASS BP '+process.platform+' Chromium '+mode+': docked setup/back/skip, actual finder/model/cost/loan/cash/lease, before and after ESF save/back/resume, intact inputs, repeat saves, distinct budget effects, themes/narrow, refresh/restart/exit and participant parameters');
 await page.close();
}
(async()=>{
 const browser=await chromium.launch({headless:true, args:JSON.parse(process.env.MB_CHROMIUM_ARGS || '[]'), ...(process.env.MB_CHROMIUM_EXECUTABLE ? {executablePath:process.env.MB_CHROMIUM_EXECUTABLE} : {})});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'MoneyBuddy Flow path spaces '));
 try {
  const pkg=path.join(temp,'flows','emergency-fund');
  fs.mkdirSync(path.dirname(pkg),{recursive:true});
  fs.cpSync(path.join(repo,'flows','emergency-fund'),pkg,{recursive:true});
  fs.writeFileSync(path.join(temp,'index.html'),'<title>Selector destination</title>');
  for (const mode of (process.env.MB_FLOW_BASE_URL ? ['file','http'] : ['file'])) {
   const page=await browser.newPage({viewport:{width:390,height:844}});
   const errors=[];
   page.on('pageerror',e=>{errors.push(e.message); console.error(mode,e.stack.split('\n').slice(0,7).join('\n'));});
   const base=mode==='file'?pathToFileURL(path.join(pkg,'index.html')).href:new URL('flows/emergency-fund/index.html',process.env.MB_FLOW_BASE_URL.replace(/\/?$/, '/')).href;
   await page.goto(base+'?participant=review-123&screen=budget&useberry=true&tracking=true');
   await expectScreen(page,'onboarding');
   assert.equal(await page.locator('.admin:visible').count(),0);
   assert.equal(await page.locator('#navRoot button').count(),0);
   await page.getByPlaceholder('ZIP code').focus();
   assert.equal(await page.getByPlaceholder('ZIP code').evaluate(e=>document.activeElement===e),true);
   await setup(page);
   assert.equal(await page.evaluate(()=>state.profile.zip),'10001');
   await page.locator('.mb-flow-controls button').filter({hasText:/^Back$/}).click();
   await expectScreen(page,'onboarding');
   assert.equal(await page.getByPlaceholder('ZIP code').inputValue(),'10001');
   const saved=await page.evaluate(()=>JSON.stringify(state.onboarding));
   assert(saved.includes('10001'));
   await page.getByRole('button',{name:'Skip',exact:true}).click();
   await expectScreen(page,'esfBuild');
   assert.equal(await page.evaluate(()=>state.profile.zip),'10001');
   for(const theme of ['light','dark','naturalLight','naturalDark']){
    await page.getByLabel('Theme',{exact:true}).selectOption(theme);
    assert.equal(await page.evaluate(()=>themeCurrent().id),theme);
    assert.equal(await page.locator('.phone').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   await saveAndReopenFund(page);
   assert.equal(await page.evaluate(()=>Array.from(document.scripts).some(s=>/useberry.*(?:\.com|\.io)/i.test(s.src))),false);
   if(mode==='http')assert.equal(new URL(page.url()).searchParams.get('participant'),'review-123');
   await page.reload();
   await expectScreen(page,'onboarding');
   assert.equal(await page.evaluate(()=>state.esf),null);
   assert.equal(await page.getByPlaceholder('ZIP code').inputValue(),'');
   await page.getByRole('button',{name:'Skip',exact:true}).click();
   await expectScreen(page,'esfBuild');
   await page.getByRole('button',{name:'Restart',exact:true}).click();
   await expectScreen(page,'onboarding');
   assert.equal(new URL(page.url()).searchParams.get('participant'),'review-123');
   assert.equal(errors.length,0,errors.join('\n'));
   if(process.env.MB_FLOW_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.MB_FLOW_SCREENSHOT_DIR,'mb-esf-'+mode+'-review.png')});
   await page.getByRole('button',{name:'Exit',exact:true}).click();
   await page.waitForURL(u=>u.pathname.endsWith('/index.html')&&!u.pathname.includes('/flows/'));
   console.log('PASS ESF '+process.platform+' Chromium '+mode+': actual setup inputs/clicks, first-expense Back/Skip answers, themes/narrow layout, focus, fund media/save/reopen/repeat save, tracking off, refresh, restart, exit; '+(mode==='file'?'path with spaces':'participant parameters'));
   await page.close();
   await purchaseBrowser(browser,temp,mode);
  }
 }finally{await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
