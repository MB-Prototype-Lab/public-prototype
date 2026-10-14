'use strict';
// Writes the before/after picture report: one self-contained index.html beside
// the screenshots, readable on file:// and as a CI artifact.

const fs = require('node:fs');
const path = require('node:path');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const VARIANT_LABELS = {
  naturalLight: 'Natural Light', light: 'Light', dark: 'Dark', naturalDark: 'Natural Dark', 'tools-desktop': 'Tools (desktop)',
};
const STATUS_TEXT = { same: 'Same', changed: 'Changed', flaky: 'Flaky', missing: 'Missing' };

function writeReport(outDir, rows, summary, variants) {
  const byVariant = variants.map(v => ({ v, rows: rows.filter(r => r.variant === v.id) })).filter(x => x.rows.length);
  const changedTotal = summary.phoneChanged + summary.toolsChanged;
  const headline = summary.failures ? 'Some journeys broke'
    : changedTotal ? changedTotal + ' picture' + (changedTotal === 1 ? '' : 's') + ' changed'
    : 'No visible change';
  const tabs = byVariant.map((x, i) => {
    const n = x.rows.reduce((k, r) => k + r.items.filter(it => it.status === 'changed' || it.status === 'missing').length, 0);
    return `<button class="tab" role="tab" aria-selected="${i === 0}" data-tab="${esc(x.v.id)}">${esc(VARIANT_LABELS[x.v.id] || x.v.id)}${n ? ` <span class="count">${n}</span>` : ''}</button>`;
  }).join('');
  const panels = byVariant.map((x, i) => `
    <section class="panel" data-panel="${esc(x.v.id)}"${i ? ' hidden' : ''}>
      ${x.rows.map(r => journeyBlock(r)).join('')}
    </section>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Journey Pictures</title>
<style>
:root { --bg: #f6f5f2; --card: #ffffff; --ink: #1d1d1f; --muted: #6b6b70; --line: #e3e1dc; --accent: #2f5d50;
  --ok: #2e7d4f; --ok-bg: #e5f2ea; --bad: #b3261e; --bad-bg: #fbe7e5; --warn: #8a5a00; --warn-bg: #fdf1d8; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161618; --card: #202023; --ink: #ececef;
  --muted: #a1a1a8; --line: #34343a; --accent: #8cc7b4; --ok: #7fd3a1; --ok-bg: #1d3327; --bad: #ff8a80; --bad-bg: #3a1f1d;
  --warn: #f0c46a; --warn-bg: #3a2e14; } }
:root[data-theme="dark"] { --bg: #161618; --card: #202023; --ink: #ececef; --muted: #a1a1a8; --line: #34343a; --accent: #8cc7b4;
  --ok: #7fd3a1; --ok-bg: #1d3327; --bad: #ff8a80; --bad-bg: #3a1f1d; --warn: #f0c46a; --warn-bg: #3a2e14; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
.sub { color: var(--muted); margin: 0 0 20px; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 20px; }
.fact { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
.fact b { display: block; font-size: 22px; }
.fact span { color: var(--muted); font-size: 13px; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
.tab { border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 999px; padding: 6px 14px; font: inherit; cursor: pointer; }
.tab[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.count { display: inline-block; min-width: 20px; padding: 0 6px; border-radius: 999px; background: var(--bad); color: #fff; font-size: 12px; text-align: center; }
label.only { display: inline-flex; gap: 8px; align-items: center; color: var(--muted); margin-bottom: 12px; }
.journey { background: var(--card); border: 1px solid var(--line); border-radius: 14px; margin: 0 0 14px; }
.journey > summary { list-style: none; cursor: pointer; padding: 12px 16px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.journey > summary::-webkit-details-marker { display: none; }
.journey h2 { font-size: 16px; margin: 0; }
.note { color: var(--muted); font-size: 13px; }
.badge { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; }
.badge.same { background: var(--ok-bg); color: var(--ok); }
.badge.changed, .badge.missing, .badge.broke { background: var(--bad-bg); color: var(--bad); }
.badge.flaky { background: var(--warn-bg); color: var(--warn); }
.step { border-top: 1px solid var(--line); padding: 12px 16px; }
.step h3 { font-size: 14px; font-weight: 600; margin: 0 0 8px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.pics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.pics figure { margin: 0; }
.pics figcaption { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
.pics img { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; background: #fff; display: block; }
body.only-changes .step.same, body.only-changes .journey.all-same { display: none; }
@media (max-width: 640px) { .pics { grid-template-columns: 1fr; } }
</style>
</head>
<body class="${changedTotal ? 'only-changes' : ''}">
<main>
  <h1>${esc(headline)}</h1>
  <p class="sub">Before: ${esc(summary.base)}<br>After: ${esc(summary.head)}</p>
  <div class="facts">
    <div class="fact"><b>${summary.phoneChanged}</b><span>phone pictures changed</span></div>
    <div class="fact"><b>${summary.toolsChanged}</b><span>Tools pictures changed</span></div>
    <div class="fact"><b>${summary.flaky}</b><span>flaky (did not repeat)</span></div>
    <div class="fact"><b>${summary.failures}</b><span>journeys that broke</span></div>
  </div>
  <p class="note">Each journey ran in Chromium on both versions, tapping the same buttons in the same order, with the clock fixed. A picture is taken whenever a new view appears. "Changed" means more than 0.05% of its pixels differ and the difference repeated on a second run.</p>
  <div class="tabs" role="tablist">${tabs}</div>
  <label class="only"><input type="checkbox" id="only"${changedTotal ? ' checked' : ''}> Show only changes</label>
  ${panels}
</main>
<script>
(function () {
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) { t.addEventListener('click', function () {
    tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
    document.querySelectorAll('.panel').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== t.getAttribute('data-tab'); });
  }); });
  document.getElementById('only').addEventListener('change', function (e) { document.body.classList.toggle('only-changes', e.target.checked); });
})();
</script>
</body>
</html>
`;
  const file = path.join(outDir, 'index.html');
  fs.writeFileSync(file, html);
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');
  return file;
}

function journeyBlock(r) {
  const broke = r.baseFailure !== r.headFailure || r.pageErrors.length;
  const counts = {};
  for (const it of r.items) counts[it.status] = (counts[it.status] || 0) + 1;
  const allSame = !broke && r.items.every(it => it.status === 'same');
  const badges = (broke ? '<span class="badge broke">Broke</span>' : '') +
    Object.entries(counts).map(([k, n]) => `<span class="badge ${k}">${n} ${esc(STATUS_TEXT[k] || k)}</span>`).join(' ');
  const failure = r.baseFailure || r.headFailure
    ? `<p class="note step">Before: ${esc(r.baseFailure || 'finished')} · After: ${esc(r.headFailure || 'finished')}</p>` : '';
  const errors = r.pageErrors.length ? `<p class="note step">New page errors: ${esc(r.pageErrors.join(' | '))}</p>` : '';
  return `
  <details class="journey${allSame ? ' all-same' : ''}"${allSame ? '' : ' open'}>
    <summary><h2>${esc(r.id)}</h2>${badges}</summary>
    ${failure}${errors}
    ${r.items.map(it => `
    <div class="step ${it.status}">
      <h3>${esc(it.label)} <span class="badge ${it.status}">${esc(STATUS_TEXT[it.status] || it.status)}</span></h3>
      <div class="pics">
        <figure><figcaption>Before</figcaption>${it.base ? `<img loading="lazy" src="${esc(it.base)}" alt="Before: ${esc(it.label)}">` : '<p class="note">None</p>'}</figure>
        <figure><figcaption>After</figcaption>${it.head ? `<img loading="lazy" src="${esc(it.head)}" alt="After: ${esc(it.label)}">` : '<p class="note">None</p>'}</figure>
        <figure><figcaption>Difference</figcaption>${it.diff ? `<img loading="lazy" src="${esc(it.diff)}" alt="Difference: ${esc(it.label)}">` : '<p class="note">' + (it.status === 'same' ? 'No difference' : '—') + '</p>'}</figure>
      </div>
    </div>`).join('')}
  </details>`;
}

module.exports = { writeReport };
