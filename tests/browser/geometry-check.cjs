#!/usr/bin/env node
'use strict';
// A short real-browser regression for geometry hidden by full-length pictures.
const { ensurePinnedEnv } = require('../lib/determinism.cjs');
ensurePinnedEnv();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { REPO } = require('../lib/app-vm.cjs');
const { launch, newPage, settle, growPhone, restorePhone, VARIANTS } = require('./app-journeys-browser.cjs');
const { measurePhoneGeometry, compareGeometry } = require('./geometry.cjs');
const { openComparer } = require('./pixels.cjs');

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('usage: node tests/browser/geometry-check.cjs OUTPUT_DIRECTORY');
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  try {
    const captures = [];
    for (const name of ['before', 'identical', 'shorter', 'scrolled']) {
      const { ctx, page, errors } = await newPage(browser, REPO, VARIANTS[0], 'geometry-check');
      try {
        await page.goto(pathToFileURL(path.join(REPO, 'app/index.html')).href);
        await page.waitForFunction(() => typeof state !== 'undefined' && !!state.screen);
        await page.evaluate(() => { profileApply('at_at'); navAdminJump('learn'); });
        if (name === 'shorter') await page.addStyleTag({ content: '.phone { height:700px; max-height:calc(100vh - 168px); }' });
        await settle(page, 12345);
        await page.mouse.move(0, 0);
        if (name === 'scrolled') await page.evaluate(() => { document.getElementById('screenRoot').scrollTop = 1; });
        const geometry = await page.evaluate(measurePhoneGeometry);
        const before = await growPhone(page);
        const file = path.join(out, name + '.png');
        try { await page.locator('main.phone').screenshot({ path: file, animations: 'disabled', caret: 'hide' }); }
        finally { await restorePhone(page, before); }
        assert.deepEqual(await page.evaluate(measurePhoneGeometry), geometry, 'taking a tall picture preserves normal geometry and scrolling');
        assert.deepEqual(errors, []);
        captures.push({ name, geometry, file });
      } finally { await ctx.close(); }
    }
    const comparer = await openComparer(browser);
    const comparisons = [];
    try {
      for (const after of captures.slice(1)) {
        const pixels = await comparer.compare(fs.readFileSync(captures[0].file), fs.readFileSync(after.file));
        comparisons.push({ name: after.name, geometry: compareGeometry(captures[0].geometry, after.geometry),
          pixels: { ...pixels, diffPng: undefined } });
      }
    } finally { await comparer.close(); }
    const [same, shorter, scrolled] = comparisons;
    assert.equal(same.geometry.same, true);
    assert.equal(same.pixels.diffPixels, 0);
    assert.equal(shorter.pixels.sameSize, true);
    assert.equal(shorter.pixels.diffPixels, 0, 'shorter normal phone still has the identical tall picture');
    assert.deepEqual(shorter.pixels.sizeA, [390, 1324]);
    assert.deepEqual([captures[0].geometry.height, captures[2].geometry.height], [796, 676]);
    assert.equal(shorter.geometry.same, false);
    assert.equal(scrolled.geometry.same, false);
    assert.equal(captures[3].geometry.scrollTop, 1);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ captures, comparisons }, null, 2) + '\n');
    console.log('PASS geometry: identical control; 796 → 676px phone with identical 390×1324 tall pictures; 1px scroll change');
  } finally { await browser.close(); }
}

main().catch(err => { console.error(err.stack); process.exitCode = 1; });
