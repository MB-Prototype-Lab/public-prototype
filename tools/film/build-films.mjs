// Generate and render the onboarding films.
//
//   node film/build-films.mjs            # generate HTML for every script x theme
//   node film/build-films.mjs --render   # ...and render them to MP4
//   node film/build-films.mjs --only dark:onboarding_intro --render
//
// Output: app/assets/video/onboarding/<themeId>/<scriptId>.mp4
//         app/assets/video/onboarding/manifest.json
//
// ── THE ONE THING THAT MUST NOT DRIFT ────────────────────────────────────────
// Segment durations here have to equal screens/onboarding.js's onbVideoSegMs.
// The app narrates live over a SILENT film, so its caption clock and this
// film's timeline are two independent computations of the same number. If they
// disagree the picture and the words come apart with no error anywhere — the
// film just feels wrong. The manifest records every duration and
// scripts/sweep.js asserts the app agrees with it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { look, LOOKS, LOOK_FOR_THEME } from "./themes.mjs";
import { beatsFor, SCRIPT_IDS } from "./beats.mjs";
import { composition, CANVAS } from "./composition.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, "..");
const REPO = path.resolve(TOOLS, "..");
if (Object.hasOwn(process.env, "MB_VERSION")) {
  throw new Error("MB_VERSION is retired; tooling uses app/");
}
const APP = path.join(REPO, "app");
const BUILD = path.join(TOOLS, "build");
const OUT = path.join(APP, "assets", "video", "onboarding");

// ── The formula. Mirrors onbVideoSegMs / DU_WPM exactly. ─────────────────────
const DU_WPM = 165;
const SEG_FLOOR_MS = 1600;
export function segMs(text) {
  const words = String(text == null ? "" : text).trim().split(/\s+/).length;
  return Math.max(SEG_FLOOR_MS, Math.round((words / DU_WPM) * 60000));
}

const args = process.argv.slice(2);
const doRender = args.includes("--render");
const onlyArg = (args.find(a => a.startsWith("--only")) || "").split("=")[1] ||
                (args.includes("--only") ? args[args.indexOf("--only") + 1] : null);

function log(...a) { process.stdout.write(a.join(" ") + "\n"); }

// ── Shared project assets ────────────────────────────────────────────────────
// GSAP and Inter are copied in rather than fetched, so a render is reproducible
// offline and byte-identical between runs. Inter is also the app's --font-body,
// so the film's type is the app's type rather than a lookalike.
const SKILLS = path.join(process.env.HOME, ".claude", "skills");
const ASSETS = [
  { from: path.join(TOOLS, "node_modules", "gsap", "dist", "gsap.min.js"), to: "gsap.min.js" },
  { from: path.join(SKILLS, "hyperframes-creative", "frame-presets", "code-editorial", "fonts", "Inter-400.woff2"), to: "Inter-400.woff2" },
  { from: path.join(SKILLS, "hyperframes-creative", "frame-presets", "code-editorial", "fonts", "Inter-700.woff2"), to: "Inter-700.woff2" }
];

// A hyperframes project is a DIRECTORY: hyperframes.json + index.html, with
// compositions under compositions/. The CLI refuses to look at anything else
// ("No index.html file found"), so the build dir is scaffolded to match rather
// than being a loose pile of HTML.
const HF_JSON = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
  media: { autoProxy: false }
};

function stageAssets() {
  fs.mkdirSync(path.join(BUILD, "assets"), { recursive: true });
  fs.mkdirSync(path.join(BUILD, "compositions"), { recursive: true });
  fs.writeFileSync(path.join(BUILD, "hyperframes.json"), JSON.stringify(HF_JSON, null, 2) + "\n");
  for (const a of ASSETS) {
    if (!fs.existsSync(a.from)) {
      throw new Error(`missing build asset: ${a.from}\n` +
        `  gsap → run \`npm install\` in tools/\n` +
        `  Inter → run \`npx hyperframes skills update\` (it ships with hyperframes-creative)`);
    }
    fs.copyFileSync(a.from, path.join(BUILD, "assets", a.to));
  }
}

// ── Generate ─────────────────────────────────────────────────────────────────
const scriptJson = JSON.parse(
  fs.readFileSync(path.join(APP, "data", "onboarding-script.json"), "utf8")
);

function buildOne(lookId, scriptId) {
  const script = scriptJson.scripts.find(s => s.id === scriptId);
  if (!script) throw new Error(`onboarding-script.json has no script "${scriptId}"`);

  const durationsSec = script.segments.map(s => segMs(s.text) / 1000);
  const totalSec = durationsSec.reduce((a, b) => a + b, 0);
  const beats = beatsFor(scriptId, script.segments, durationsSec);
  const theme = look(path.join(APP, "css", "variables.css"), lookId);
  const compositionId = `${lookId}__${scriptId}`;

  const file = path.join(BUILD, "compositions", `${compositionId}.html`);
  fs.writeFileSync(file, composition({ compositionId, beats, theme, totalSec }));

  // The CLI needs an index.html at the project root before it will look at the
  // directory at all. The first film doubles as it, with the asset paths its
  // shallower location needs.
  if (!fs.existsSync(path.join(BUILD, "index.html"))) {
    fs.writeFileSync(path.join(BUILD, "index.html"),
                     composition({ compositionId, beats, theme, totalSec }));
  }

  return {
    lookId, scriptId, compositionId, file,
    totalSec: Math.round(totalSec * 1000) / 1000,
    segmentMs: script.segments.map(s => segMs(s.text)),
    segmentIds: script.segments.map(s => s.id)
  };
}

// ── Render ───────────────────────────────────────────────────────────────────
const NPX = path.join(process.env.HOME, ".nvm", "versions", "node", "v24.16.0", "bin", "npx");
const npx = fs.existsSync(NPX) ? NPX : "npx";

function render(job) {
  const dest = path.join(OUT, job.lookId, `${job.scriptId}.mp4`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync(npx, [
    "hyperframes", "render", BUILD,
    "-c", path.join("compositions", path.basename(job.file)),
    "-o", dest,
    "--fps", "30",
    "--quality", "high",
    "--crf", "30",              // abstract motion on flat colour compresses hard
    "--strict",                 // a lint error must fail the build, not ship
    "--quiet"
  ], { cwd: TOOLS, stdio: "inherit", env: { ...process.env, PATH: `${path.dirname(npx)}:${process.env.PATH}` } });
  return dest;
}

// ── Main ─────────────────────────────────────────────────────────────────────
stageAssets();

let pairs = [];
for (const t of LOOKS) for (const s of SCRIPT_IDS) pairs.push([t, s]);
if (onlyArg) {
  const [t, s] = onlyArg.split(":");
  pairs = pairs.filter(([a, b]) => a === t && (!s || b === s));
  if (!pairs.length) throw new Error(`--only "${onlyArg}" matched nothing`);
}

const jobs = pairs.map(([t, s]) => buildOne(t, s));
log(`generated ${jobs.length} composition(s) → ${path.relative(REPO, BUILD)}`);
log(`  canvas ${CANVAS.W}x${CANVAS.H}, crossfade ${CANVAS.CROSSFADE}s`);
for (const j of jobs) log(`  ${j.compositionId}  ${j.totalSec}s`);

if (doRender) {
  fs.mkdirSync(OUT, { recursive: true });
  let bytes = 0, biggest = 0;
  for (const j of jobs) {
    const dest = render(j);
    const size = fs.statSync(dest).size;
    bytes += size; biggest = Math.max(biggest, size);
    log(`  rendered ${path.relative(APP, dest)}  ${(size / 1024).toFixed(0)} KB`);
  }

  // MERGED, not replaced. A `--only` run renders one film, and rewriting the
  // manifest from just that job would delete every other film's entry — the
  // files would still be on disk but the app would stop asking for them, which
  // looks exactly like the render failing. Read what is there, add to it.
  let prior = {};
  try {
    prior = JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8")).films || {};
  } catch (e) { /* first render */ }

  const manifest = {
    _note: "GENERATED by tools/film/build-films.mjs. Do not hand-edit.",
    canvas: { width: CANVAS.W, height: CANVAS.H, fps: 30 },
    wpm: DU_WPM,
    segmentFloorMs: SEG_FLOOR_MS,
    looks: LOOKS,
    lookForTheme: LOOK_FOR_THEME,
    films: Object.assign({}, prior, Object.fromEntries(jobs.map(j => [j.compositionId, {
      look: j.lookId, script: j.scriptId, totalSec: j.totalSec,
      segmentIds: j.segmentIds, segmentMs: j.segmentMs
    }])))
  };
  // A film listed in the manifest but no longer on disk is worse than one that
  // was never rendered: the app asks for it and gets nothing.
  for (const id of Object.keys(manifest.films)) {
    const f = manifest.films[id];
    if (!fs.existsSync(path.join(OUT, f.look, f.script + ".mp4"))) delete manifest.films[id];
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFilmIndex(manifest);

  log(`\ntotal ${(bytes / 1048576).toFixed(2)} MB · largest ${(biggest / 1024).toFixed(0)} KB`);
  if (biggest > 800 * 1024) log(`  ⚠ over the 800 KB per-file budget — raise --crf`);
  if (bytes > 12 * 1048576) log(`  ⚠ over the 12 MB total budget`);
} else {
  log(`\n(dry run — pass --render to encode)`);
}

/**
 * The app cannot look at the filesystem — it runs on file://, where fetch() is
 * blocked (L13). So which films exist has to reach it as a script-loadable
 * assignment, exactly like every other data/*.js in this repo.
 *
 * Without it the <video> would be pointed at a path that may not exist and we
 * would be relying on an `error` event firing to fall back. That event is
 * precisely the thing no headless check here can confirm, and D19 forbids the
 * screen that would result if it did not. This turns "hope it errors" into
 * "only ask for what was rendered".
 */
function writeFilmIndex(manifest) {
  // Keyed by THEME, not by look: the app knows its theme id and should not have
  // to know which look serves it. The mapping lives here, in the build.
  const index = {};
  for (const [theme, lookId] of Object.entries(LOOK_FOR_THEME)) {
    const scripts = Object.values(manifest.films)
      .filter(f => f.look === lookId).map(f => f.script).sort();
    if (scripts.length) index[theme] = { look: lookId, scripts };
  }

  const body =
`// GENERATED by tools/film/build-films.mjs — do not hand-edit.
// Regenerate: cd tools && node film/build-films.mjs --render
//
// Which onboarding films exist, keyed by THEME. Each entry names the LOOK whose
// render serves that theme (the film has two looks, dark and light, and each
// serves two themes) and the scripts rendered in it.
//
// The app runs on file:// where it cannot stat a path (L13), so this is how
// onbFilmSrc() knows whether to ask for an .mp4 at all. A theme or script
// missing here simply falls back to the live SVG engine.
const ONBOARDING_FILMS = ${JSON.stringify(index, null, 2)};
`;
  fs.writeFileSync(path.join(APP, "data", "onboarding-films.js"), body);
  log(`  wrote data/onboarding-films.js (${Object.keys(index).length} theme(s) → ${LOOKS.length} look(s))`);
}
