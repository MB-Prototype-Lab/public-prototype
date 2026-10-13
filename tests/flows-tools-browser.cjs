// Shared real-browser assertions for live Flows, creation adapters and exports.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const themes = ['light', 'dark', 'naturalLight', 'naturalDark'];
const properties = ['width', 'height', 'backgroundColor', 'borderTopWidth',
 'borderTopStyle', 'borderTopColor', 'borderRadius', 'boxShadow', 'fontFamily',
 'fontSize', 'fontWeight', 'lineHeight', 'color', 'padding', 'alignItems', 'justifyContent'];
async function style(button) {
 return button.evaluate((el, props) => {
  const css = getComputedStyle(el);
  return Object.fromEntries(props.map(p => [p, css[p]]));
 }, properties);
}
const references = new WeakMap();
async function referenceStyles(browser) {
 if (references.has(browser)) return references.get(browser);
 const page = await browser.newPage({viewport: {width:1440, height:900}});
 const result = {};
 try {
  await page.goto(pathToFileURL(path.join(process.cwd(), 'app/index.html')).href);
  for (const theme of themes) {
   await page.evaluate(t => {themeSet(t); state.adminCollapsed=true; render();}, theme);
   const button = page.locator('#adminExpandTab');
   await page.mouse.move(0,0);
   const normal = await style(button);
   await button.hover();
   result[theme] = {normal, hover:await style(button)};
   await page.evaluate(() => {state.adminCollapsed=false; render();});
   const close = page.locator('.admin-collapse-btn');
   await page.mouse.move(0,0);
   result[theme].close = await style(close);
   await close.hover();
   result[theme].closeHover = await style(close);
  }
 } finally {await page.close();}
 references.set(browser,result);
 return result;
}
async function checkExpandButton(page, browser) {
 const reference = await referenceStyles(browser);
 const viewport = page.viewportSize();
 const originalTheme = await page.evaluate(() => themeCurrent().id);
 const participant = await page.evaluate(() => JSON.stringify(mbFlowStateSnapshot()));
 const button = page.locator('#adminExpandTab');
 assert.equal(await button.textContent(),'›');
 assert.equal(await button.getAttribute('aria-label'),'Tools');
 assert.equal(await button.getAttribute('aria-controls'),'flowAdmin');
 for (const width of [1440,900,390,320]) {
  await page.setViewportSize({width,height:900});
  for (const theme of themes) {
   await page.evaluate(t => themeSet(t),theme);
   assert.equal(await button.isVisible(),true);
   assert.equal(await button.getAttribute('aria-expanded'),'false');
   await page.mouse.move(0,0);
   assert.deepEqual(await style(button),reference[theme].normal,theme+' normal');
   await page.evaluate(()=>scrollTo(0,0));
   const box = await button.boundingBox();
   assert.equal(box.width,28);assert.equal(box.height,48);
   assert.equal(box.y,16);assert.equal(box.x,width-16-28);
   await button.hover();
   assert.deepEqual(await style(button),reference[theme].hover,theme+' hover');
   const phoneBefore = await page.locator('.phone').boundingBox();
   await button.focus();
   await page.keyboard.press(themes.indexOf(theme)%2 ? 'Space' : 'Enter');
   assert.equal(await button.getAttribute('aria-expanded'),'true');
   assert.equal(await button.evaluate(el=>el.hidden),true);
   assert.equal(await button.isVisible(),false);
   assert.equal(await page.getByRole('button',{name:'Tools',exact:true}).count(),0);
   const phone = await page.locator('.phone').boundingBox();
   const admin = await page.locator('#flowAdmin').boundingBox();
   assert.equal(phone.width,phoneBefore.width);assert.equal(phone.height,phoneBefore.height);
   assert(width>900 ? admin.x>=phone.x+phone.width : admin.y>=phone.y+phone.height);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const close = page.getByRole('button',{name:'Close Tools',exact:true});
   assert.equal(await close.textContent(),'‹');
   await page.mouse.move(0,0);
   assert.deepEqual(await style(close),reference[theme].close,theme+' close normal');
   await close.hover();
   assert.deepEqual(await style(close),reference[theme].closeHover,theme+' close hover');
   await close.click();
   assert.equal(await button.isVisible(),true);
   assert.equal(await button.evaluate(el=>el===document.activeElement),true);
  }
 }
 await page.evaluate(t=>themeSet(t),originalTheme);
 await page.setViewportSize(viewport);
 assert.equal(await page.evaluate(()=>JSON.stringify(mbFlowStateSnapshot())),participant);
}
module.exports = {checkExpandButton};
