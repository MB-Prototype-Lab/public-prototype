'use strict';
// Compares two PNG screenshots inside Chromium's own canvas, so no image
// library is needed. A pixel differs when any channel moves by more than
// CHANNEL_TOLERANCE; the result includes a highlighted diff image.

const CHANNEL_TOLERANCE = 24;

async function openComparer(browser) {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>pixels</title>');
  return {
    async compare(pngA, pngB) {
      return page.evaluate(async ({ a, b, tol }) => {
        const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
        const data = img => {
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0);
          return x.getImageData(0, 0, w, h).data;
        };
        const da = data(ia), db = data(ib);
        const out = document.createElement('canvas'); out.width = w; out.height = h;
        const ox = out.getContext('2d'); ox.globalAlpha = 0.25; ox.drawImage(ib, 0, 0); ox.globalAlpha = 1;
        const od = ox.getImageData(0, 0, w, h);
        let diff = 0;
        for (let p = 0; p < da.length; p += 4) {
          if (Math.abs(da[p] - db[p]) > tol || Math.abs(da[p + 1] - db[p + 1]) > tol ||
              Math.abs(da[p + 2] - db[p + 2]) > tol || Math.abs(da[p + 3] - db[p + 3]) > tol) {
            diff++; od.data[p] = 230; od.data[p + 1] = 30; od.data[p + 2] = 60; od.data[p + 3] = 255;
          }
        }
        ox.putImageData(od, 0, 0);
        return {
          sameSize: ia.width === ib.width && ia.height === ib.height,
          sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height],
          diffPixels: diff, totalPixels: w * h,
          diffPng: diff || ia.width !== ib.width || ia.height !== ib.height ? out.toDataURL('image/png') : null,
        };
      }, { a: 'data:image/png;base64,' + pngA.toString('base64'), b: 'data:image/png;base64,' + pngB.toString('base64'), tol: CHANNEL_TOLERANCE });
    },
    close: () => page.close(),
  };
}

module.exports = { openComparer, CHANNEL_TOLERANCE };
