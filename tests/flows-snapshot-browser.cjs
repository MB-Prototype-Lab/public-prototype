// Optional immutable-package smoke after an offline build containing snapshot IDs
// rehearsal-emergency-fund (tracking on) and rehearsal-big-purchase (tracking off).
// MB_FLOW_SNAPSHOT_FILE_ROOT optionally adds file URLs (use an artifact path with spaces).
// Same Playwright/Chromium environment as flows-browser.cjs; MB_FLOW_SNAPSHOT_BASE_URL required.
const {chromium}=require(process.env.MB_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {checkExpandButton}=require('./flows-tools-browser.cjs');
(async()=>{
 const base=process.env.MB_FLOW_SNAPSHOT_BASE_URL;
 if(!base) throw new Error('Set MB_FLOW_SNAPSHOT_BASE_URL to the offline artifact HTTP root');
 const root=new URL(base.replace(/\/?$/,'/'));
 const browser=await chromium.launch({headless:true,args:JSON.parse(process.env.MB_CHROMIUM_ARGS || '[]'),...(process.env.MB_CHROMIUM_EXECUTABLE ? {executablePath:process.env.MB_CHROMIUM_EXECUTABLE} : {})});
 try {
  for(const mode of (process.env.MB_FLOW_SNAPSHOT_FILE_ROOT ? ['file','http'] : ['http'])) {
  for(const [id,tracking,entry] of [['emergency-fund',true,'esfBuild'],['big-purchase',false,'bpLanding']]) {
   const page=await browser.newPage({viewport:{width:900,height:844}}),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.dismiss());
   await page.route('**/*',route=>{
    if(new URL(route.request().url()).protocol!=='file:' && new URL(route.request().url()).origin!==root.origin){external.push(route.request().url());return route.abort();}
    return route.continue();
   });
   const entryRoot=mode==='file' ? pathToFileURL(path.resolve(process.env.MB_FLOW_SNAPSHOT_FILE_ROOT)+path.sep) : root;
   await page.goto(new URL('versions/rehearsal-'+id+'/index.html?participant=snapshot-123&screen=settings&tracking='+!tracking,entryRoot).href);
   await page.waitForFunction(()=>typeof state!=='undefined'&&state.screen==='onboarding');
   await checkExpandButton(page,browser);
   const toggle=page.locator('#adminExpandTab');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('.admin:visible').count(),0);
   assert.equal(await page.locator('.phone #adminRoot, .mb-flow-controls').count(),0);
   await toggle.focus();await page.keyboard.press('Space');
   assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   const phone=await page.locator('.phone').boundingBox(),admin=await page.locator('.admin').boundingBox();
   assert(admin.y>=phone.y+phone.height);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.getByRole('button',{name:'Close Tools',exact:true}).click();
   assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
   await page.getByRole('button',{name:'Skip',exact:true}).click();
   await page.waitForFunction(s=>state.screen===s,entry);
   await page.reload();
   await page.waitForFunction(()=>typeof state!=='undefined'&&state.screen==='onboarding');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   await toggle.click();
   await page.getByRole('button',{name:'Restart Flow',exact:true}).click();
   await page.waitForFunction(()=>typeof state!=='undefined'&&state.screen==='onboarding');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert.equal(new URL(page.url()).searchParams.get('participant'),'snapshot-123');
   assert.equal(await page.evaluate(()=>MB_RELEASE.tracking),tracking);
   assert.equal(external.some(u=>u.includes('api.useberry.com')),tracking && mode==='http');
   await toggle.click();await page.getByRole('button',{name:'Exit Flow',exact:true}).click();
   await page.waitForURL(new URL('index.html',entryRoot).href);
   assert.deepEqual(errors,[]);
   console.log('PASS snapshot '+id+' '+mode+': collapsed outside-phone tools, keyboard/focus, narrow placement, refresh/restart/exit, participant parameters, frozen tracking; external requests blocked');
   await page.close();
  }
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
