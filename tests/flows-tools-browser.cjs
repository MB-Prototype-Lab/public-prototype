// Shared real-browser assertions for live Flows, creation adapters and exports.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const themes = ['light', 'dark', 'naturalLight', 'naturalDark'];
// Desktop, side-by-side; single column with Tools below the phone; phone widths,
// where the full app offers no Tools at all.
const widths = [1440, 1000, 900, 390, 320];
const properties = ['width', 'height', 'backgroundColor', 'borderTopWidth',
 'borderTopStyle', 'borderTopColor', 'borderRadius', 'boxShadow', 'fontFamily',
 'fontSize', 'fontWeight', 'lineHeight', 'color', 'padding', 'alignItems', 'justifyContent'];
async function style(button) {
 return button.evaluate((el, props) => {
  const css = getComputedStyle(el);
  return Object.fromEntries(props.map(p => [p, css[p]]));
 }, properties);
}
// Phone, › and panel geometry. A Flow must place all three exactly where the
// full app does, so switching between them never moves the page.
async function layout(page) {
 await page.evaluate(() => scrollTo(0, 0));
 return page.evaluate(() => Object.fromEntries(['.phone', '.admin', '#adminExpandTab'].map(s => {
  const el = document.querySelector(s), box = el.getBoundingClientRect(), css = getComputedStyle(el);
  return [s, {x:box.x, y:box.y, width:box.width, height:box.height, display:css.display, position:css.position}];
 })));
}
const references = new WeakMap();
async function referenceStyles(browser) {
 if (references.has(browser)) return references.get(browser);
 const page = await browser.newPage({viewport: {width:1440, height:900}});
 const result = {layout:{}};
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
  for (const width of widths) {
   await page.setViewportSize({width,height:900});
   await page.evaluate(() => {state.adminCollapsed=true; render();});
   const collapsed = await layout(page);
   await page.evaluate(() => {state.adminCollapsed=false; render();});
   result.layout[width] = {collapsed, open:await layout(page)};
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
 for (const width of widths) {
  await page.setViewportSize({width,height:900});
  const collapsed = await layout(page);
  assert.deepEqual(collapsed,reference.layout[width].collapsed,width+' collapsed layout');
  if (width <= 768) {
   // Like the full app, phone widths offer no Tools.
   assert.equal(await button.isVisible(),false);
   assert.equal(await page.locator('.admin').isVisible(),false);
   continue;
  }
  assert.equal(collapsed['#adminExpandTab'].y,collapsed['.phone'].y,'› aligns with the phone top');
  for (const theme of themes) {
   await page.evaluate(t => themeSet(t),theme);
   assert.equal(await button.isVisible(),true);
   assert.equal(await button.getAttribute('aria-expanded'),'false');
   await page.mouse.move(0,0);
   assert.deepEqual(await style(button),reference[theme].normal,theme+' normal');
   await button.hover();
   assert.deepEqual(await style(button),reference[theme].hover,theme+' hover');
   await button.focus();
   await page.keyboard.press(themes.indexOf(theme)%2 ? 'Space' : 'Enter');
   assert.equal(await button.getAttribute('aria-expanded'),'true');
   assert.equal(await button.evaluate(el=>el.hidden),true);
   assert.equal(await button.isVisible(),false);
   assert.equal(await page.getByRole('button',{name:'Tools',exact:true}).count(),0);
   assert.deepEqual(await layout(page),reference.layout[width].open,width+' '+theme+' open layout');
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
