// ─── Phase 6 correctness sweep ────────────────────────────────────────────────
// Run:  bash scripts/sweep.sh
//
// PROGRESS.md's Phase 6 says "verified by actually clicking through, not by
// inspection". There is no browser here, so this automates everything that CAN
// be checked mechanically and prints an explicit list of what cannot — rather
// than letting the un-checkable items quietly pass.
//
// This is a committed script, not a throwaway harness, because Phase 6 is the
// check you want to re-run whenever scope shifts.

var FAIL = 0, WARN = 0, CHECKS = 0;
function ok(label, extra)  { CHECKS++; print("  ok    " + label + (extra ? "  " + extra : "")); }
function bad(label, detail){ CHECKS++; FAIL++; print("  FAIL  " + label + (detail ? "\n          " + detail : "")); }
function warn(label, detail){ CHECKS++; WARN++; print("  warn  " + label + (detail ? "\n          " + detail : "")); }
function chk(cond, label, detail) { cond ? ok(label) : bad(label, detail); }
function section(t) { print(""); print("── " + t + " " + Array(Math.max(2, 66 - t.length)).join("─")); }

// Every routable screen. Kept here rather than derived, so a screen that loses
// its route is a visible diff rather than silently dropping out of the sweep.
// Injected by sweep.sh from the swept version's own js/render.js — every id the
// router knows about. Hardcoding this list meant it was wrong for whichever
// version it was not written for; v3 and v3.1 do not have the same screens.
// The literal below is only a fallback for running sweep.js by hand.
var SCREENS = (typeof ROUTED_SCREENS !== "undefined" && ROUTED_SCREENS.length)
  ? ROUTED_SCREENS
  : ["streak","onboarding","login","dailyUpdate","dailySummary","dailyShare","home",
     "journalEntry","journalConfirm","journalDone","aboutMe","lifestyleWizard",
     "budgetDone","budgetUpdateConfirm","comparison","myProgress","accountBalances","debtBalances",
     "postResult","nextAction","commitment","finish","goals","learn","topic","reward-preview",
     "lessonFraming","lesson","lessonQuiz","lessonSimulation","lessonReward","quiz","simulation",
     "marketplace","marketplaceDetail","reward","settings","chat","myDebts","debtAnalyzer"];

/**
 * A canonical set of answers for one tree — first option everywhere, sliders at
 * their default. Not "typical", just REPRODUCIBLE: the gates below compare a
 * tree against itself under different conditions, so what matters is that the
 * same answers come back every time.
 */
function hmoBaselineAnswers(category) {
  var a = hmoSeedAnswers(category);
  var t = hmoTree(category);
  if (!t) return a;
  t.questions.forEach(function (q) {
    if (q.type === "choice" && q.options && q.options.length) a[q.id] = q.options[0].id;
  });
  return a;
}

/**
 * The answer set that makes a tree spend the most.
 *
 * Greedy, one question at a time. It exists because the inert-question gate
 * below has to test a question with its PRECONDITIONS OPEN: "what kind of
 * coffee" cannot move a figure when the answer above it is "I make it at
 * home", and every Debt question is behind "nothing right now". Testing
 * against a first-option baseline reported five perfectly good questions as
 * broken. Maximising opens every gate by construction, because an open gate is
 * what costs money.
 */
function hmoMaxAnswers(category) {
  var t = hmoTree(category);
  var a = hmoSeedAnswers(category);
  if (!t) return a;

  // SEED FROM THE LAST OPTION, not the first. Options are authored cheapest to
  // priciest, so this opens every gate before anything is measured — and a
  // gate has to be open for the greedy pass below to see what is behind it.
  // Seeding from the first option deadlocked: "how often do you get coffee"
  // looked inert because coffeeTier was unset, so every frequency multiplied
  // by an undefined price and came out at zero.
  t.questions.forEach(function (q) {
    if (q.type === "choice" && q.options && q.options.length) {
      a[q.id] = q.options[q.options.length - 1].id;
    }
  });

  // Then improve to a fixed point. Answering one question can reveal another
  // whose value changes what the first should be, so a single pass is not
  // enough — three settles every tree here and the loop exits early anyway.
  for (var pass = 0; pass < 3; pass++) {
    var moved = false;
    t.questions.forEach(function (q) {
      if (q.type !== "choice" || !q.options) return;
      if (!hmoQuestionShows(q, a)) return;
      var best = a[q.id], bestVal = hmoCompute(category, a);
      q.options.forEach(function (o) {
        var trial = {};
        Object.keys(a).forEach(function (k) { trial[k] = a[k]; });
        trial[q.id] = o.id;
        var v = hmoCompute(category, trial);
        if (v > bestVal) { bestVal = v; best = o.id; }
      });
      if (best !== a[q.id]) { a[q.id] = best; moved = true; }
    });
    if (!moved) break;
  }
  return a;
}

function textOf(html) {
  return String(html)
    .replace(/<[^>]*>/g, " ")
    // h() escapes before this sees it, so entities must be decoded or a
    // headline containing an apostrophe will never match its own text.
    .replace(/&#039;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
function renderSafe(sc) {
  state.screen = sc;
  try { return renderScreen(); } catch (e) { return { __error: String(e) }; }
}

// ─────────────────────────────────────────────────────────────────────────────
section("1. Every screen renders, in all four themes");
var renderFails = [];
THEMES.forEach(function (t) {
  state.settings.colorMode = t.id;
  SCREENS.forEach(function (sc) {
    var html = renderSafe(sc);
    if (html && html.__error) renderFails.push(t.id + " " + sc + ": " + html.__error);
    try { renderAdmin(); adminSubtitle(); renderTopBar(); renderNav(); themeApply(); }
    catch (e) { renderFails.push(t.id + " " + sc + " chrome: " + e); }
  });
});
state.settings.colorMode = THEME_DEFAULT;
chk(renderFails.length === 0, SCREENS.length + " screens x " + THEMES.length + " themes",
    renderFails.slice(0, 6).join("\n          "));

// An unknown id must resolve to the default rather than leaving .screen
// unclassed. Both render Natural Light now that it is the default, so this
// check is load-bearing in a way it was not before: it is what distinguishes a
// resolved theme from no theme at all.
chk(themeById("nonsense").id === THEME_DEFAULT, "unknown theme id falls back to " + THEME_DEFAULT);
chk(state.settings.colorMode === "naturalLight", "Natural Light is the default theme (L21, revised)");

// render() is the real entry point and does things renderScreen() does not —
// applying the theme class and filling the admin theme picker. Exercise it.
var fullRenderFails = [];
THEMES.forEach(function (t) {
  state.settings.colorMode = t.id;
  state.screen = "home";
  try { render(); } catch (e) { fullRenderFails.push(t.id + ": " + e); }
});
state.settings.colorMode = THEME_DEFAULT;
chk(fullRenderFails.length === 0, "full render() in all four themes",
    fullRenderFails.join("\n          "));

// The picker is the whole user-facing deliverable — assert it is populated with
// one working button per theme and exactly one marked active, not just that
// render() did not throw.
render();
var picker = String(document.getElementById("themePicker").innerHTML || "");
var wired = THEMES.filter(function (t) { return picker.indexOf("themeSet('" + t.id + "')") !== -1; });
chk(wired.length === THEMES.length, "admin picker offers all " + THEMES.length + " themes",
    "wired: " + wired.map(function (t) { return t.id; }).join(", "));
chk((picker.match(/aria-pressed="true"/g) || []).length === 1,
    "exactly one theme shown as active");

// ─────────────────────────────────────────────────────────────────────────────
section("1b. Theme token contract (L21)");

// Parse variables.css into { selector: { token: value } }.
function cssBlocks(css) {
  var out = {}, re = /([.:][\w-]+)\s*\{([\s\S]*?)\n\}/g, m;
  while ((m = re.exec(css))) {
    var sel = m[1], body = m[2].replace(/\/\*[\s\S]*?\*\//g, ""), t, tre = /(--[\w-]+)\s*:\s*([^;]+);/g;
    out[sel] = out[sel] || {};
    while ((t = tre.exec(body))) out[sel][t[1]] = t[2].trim();
  }
  return out;
}
var CSS = cssBlocks(__VARS_CSS);

// Tokens that are deliberately theme-INDEPENDENT, plus the chrome a theme must
// never touch. Everything else in :root is the per-theme colour contract.
var THEME_FREE = ["--on-dark","--tier-copper","--radius-card","--radius-button","--radius-pill",
  "--shadow-soft","--ease","--dur","--font-display","--font-body","--phone","--bg",
  "--chrome-card","--chrome-text","--chrome-muted","--chrome-line","--chrome-accent","--chrome-danger",
  "--streak-bg","--streak-burst","--streak-pill","--streak-text","--streak-accent","--streak-on","--streak-off",
  "--space-xs","--space-sm","--space-md","--space-lg","--space-xl","--topbar-h","--nav-h"];

var CONTRACT = Object.keys(CSS[":root"]).filter(function (k) { return THEME_FREE.indexOf(k) === -1; });
// --rail is v3.1 only (the band chart needs a rail edge; v3 has no band), so
// the expected count differs by side. Stated rather than loosened to ">= 40" —
// the point of this check is that a token cannot be added or dropped without
// somebody noticing.
var EXPECTED_TOKENS = CSS[":root"]["--rail"] ? 41 : 40;
chk(CONTRACT.length === EXPECTED_TOKENS,
    "contract is " + EXPECTED_TOKENS + " colour tokens", "got " + CONTRACT.length);

// Each theme class must define exactly the contract — no more, no fewer. A
// missing token falls through to :root's cream and paints one warm patch into
// a cool theme, which reads as intentional rather than broken.
THEMES.filter(function (t) { return t.cls; }).forEach(function (t) {
  var have = Object.keys(CSS["." + t.cls] || {});
  var missing = CONTRACT.filter(function (k) { return have.indexOf(k) === -1; });
  var extra   = have.filter(function (k) { return CONTRACT.indexOf(k) === -1; });
  chk(missing.length === 0 && extra.length === 0, t.label + " defines the full contract",
      (missing.length ? "missing: " + missing.join(" ") : "") +
      (extra.length ? "  extra: " + extra.join(" ") : ""));
});

// The frame must hold still. --chrome-*/--bg/--phone style the admin panel, the
// page and the bezel, all of which live OUTSIDE .screen where these classes
// are applied — so an override here is not just unwanted, it is inert.
var chromeLeak = [];
THEMES.filter(function (t) { return t.cls; }).forEach(function (t) {
  Object.keys(CSS["." + t.cls] || {}).forEach(function (k) {
    if (k.indexOf("--chrome-") === 0 || k === "--bg" || k === "--phone") chromeLeak.push(t.cls + " " + k);
  });
});
chk(chromeLeak.length === 0, "no theme touches chrome / --bg / --phone", chromeLeak.join(", "));

// ── Contrast ────────────────────────────────────────────────────────────────
// The reason --accent-fill-text and --on-accent exist: --accent is dark in the
// light themes and light in the dark ones, so a single fixed text colour on it
// cannot clear 4.5:1 in both. Checked rather than eyeballed.
function resolve(theme, tok, depth) {
  if ((depth || 0) > 8) return null;
  var v = (CSS["." + theme] || {})[tok];
  if (v === undefined) v = CSS[":root"][tok];
  if (v === undefined) return null;
  var m = /^var\((--[\w-]+)\)$/.exec(v.trim());
  return m ? resolve(theme, m[1], (depth || 0) + 1) : v.trim();
}
function lum(hex) {
  var m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return null;
  var c = [0, 2, 4].map(function (i) {
    var s = parseInt(m[1].substr(i, 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  var la = lum(a), lb = lum(b); if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
var PAIRS = [["--text","--card"],["--text","--screen"],["--muted","--card"],["--accent","--card"],
  ["--accent-fill-text","--accent-fill"],["--on-accent","--accent"],
  ["--good","--good-bg"],["--warn","--warn-bg"],["--info","--info-bg"],
  ["--good-pill-text","--good-pill-bg"],["--warn-pill-text","--warn-pill-bg"],
  ["--warn-pill-strong-text","--warn-pill-strong-bg"]];
var lowContrast = [];
THEMES.forEach(function (t) {
  PAIRS.forEach(function (p) {
    var fg = resolve(t.cls, p[0]), bg = resolve(t.cls, p[1]), r = ratio(fg, bg);
    if (r !== null && r < 4.5) lowContrast.push(t.id + " " + p[0] + " on " + p[1] +
      " = " + r.toFixed(2) + ":1 (" + fg + " / " + bg + ")");
  });
});
chk(lowContrast.length === 0, THEMES.length + " themes x " + PAIRS.length + " pairs clear 4.5:1",
    lowContrast.join("\n          "));

// ── The one NON-TEXT boundary that carries meaning ──────────────────────────
// A budget slider's rail IS the scale — where the thumb sits along it is the
// whole reading — so it has to be perceptible, and 4.5:1 is the wrong bar for a
// hairline. It was drawn in --progress-bg, which is a FILL: 1.02-1.20:1 against
// --card in every theme. Nothing rendered but a peer band and a thumb floating
// in white space, and no check here would have caught it, because every text
// pair was fine.
if (CSS[":root"]["--rail"]) {
var railLow = [];
THEMES.forEach(function (t) {
  var rail = resolve(t.cls, "--rail"), card = resolve(t.cls, "--card"), r = ratio(rail, card);
  if (r === null || r < 2.0) railLow.push(t.id + " --rail on --card = " +
    (r === null ? "unresolved" : r.toFixed(2) + ":1") + " (" + rail + " / " + card + ")");
});
chk(railLow.length === 0, "the slider rail clears 2.0:1 against the card in all four themes",
    railLow.join("\n          "));
}

// ── The one place CSS specificity is load-bearing ───────────────────────────
// `.screen input` (0,1,1) sets background: var(--card) and a card radius, and
// it beats a bare `.band-range` (0,1,0). Harmless for every other slider,
// because they keep their native track and the element's own background is
// never painted. .band-range is the only one with -webkit-appearance: none,
// which strips that track — so the card background came through as a 44px
// rounded box drawn straight over the rail, with the thumb floating in it.
// Nothing else here could catch that: it renders, it validates, it just hides
// the thing it is supposed to sit behind.
if (typeof __COMPONENTS_CSS === "string") {
  var unscoped = [];
  __COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .forEach(function (block) {
      var sel = block.split("{")[0];
      if (!sel || sel.indexOf(".band-range") === -1) return;
      // Every .band-range rule must outrank `.screen input`, which means it has
      // to carry the .screen class itself.
      sel.split(",").forEach(function (one) {
        if (one.indexOf(".band-range") === -1) return;
        if (one.indexOf(".screen") === -1) unscoped.push(one.trim());
      });
    });
  chk(unscoped.length === 0,
      "every .band-range rule outranks `.screen input`",
      unscoped.join(" · "));
}

// ─────────────────────────────────────────────────────────────────────────────
if (typeof TEST_PROFILES !== "undefined") {
section("1c. The nine starting profiles — every feature, every profile");
// Everything the app computes is anchored on a ZIP and an income, and until now
// there was exactly ONE of each to test against: the persona's Los Angeles and
// $68,000. That is why "$10 of transport" had to be found by hand. Peer spend
// across these nine runs from about $2,500 a month to about $12,000.

var __profileBefore = state.activeProfileId;
var profiles = profileList();
chk(profiles.length === 9, "nine profiles resolve", profiles.length + " did");

// Cost of living must order strictly, whatever the income level does.
var totalsByTier = {};
profiles.forEach(function (p) {
  profileApply(p.id);
  (totalsByTier[p.tier.id] = totalsByTier[p.tier.id] || []).push(profilePeerTotal());
});
chk(Math.min.apply(null, totalsByTier.below) < Math.min.apply(null, totalsByTier.at) &&
    Math.min.apply(null, totalsByTier.at) < Math.min.apply(null, totalsByTier.above),
    "peer spending orders below < average < above",
    ["below", "at", "above"].map(function (t) {
      return t + " " + Math.min.apply(null, totalsByTier[t]);
    }).join(" · "));

// Every screen, every profile. The §1 loop covers four themes on one profile;
// this covers nine profiles on one theme, which is the axis that was untested.
var profileFails = [], peerBad = [], treeBad = [], nanSeen = [], planBad = [];
profiles.forEach(function (p) {
  profileApply(p.id);

  SCREENS.forEach(function (sc) {
    var html = renderSafe(sc);
    if (html && html.__error) { profileFails.push(p.id + " " + sc + ": " + html.__error); return; }
    // A figure that came out NaN still renders — as the word NaN, or as an
    // inline style the browser silently drops. Neither throws.
    if (/(NaN|undefined)/.test(String(html).replace(/undefined\s*<\/option>/g, ""))) {
      if (/style="[^"]*(NaN|undefined)/.test(String(html)) || /\$NaN/.test(String(html))) {
        nanSeen.push(p.id + " " + sc);
      }
    }
  });

  CATEGORIES.forEach(function (c) {
    var v = benchPeerValue(c, benchOptsForUser());
    if (!isFinite(v) || v <= 0) peerBad.push(p.id + " " + c + "=" + v);
    if (typeof hmoHasTree === "function" && hmoHasTree(c)) {
      var t = hmoCompute(c, hmoMaxAnswers(c));
      if (!isFinite(t) || t < 0) treeBad.push(p.id + " " + c + "=" + t);
    }
  });

  // The builder has to complete from any starting point, not just LA.
  // v3.1 only — v3 is the control and has the six-question wizard instead.
  if (typeof bbStart === "function" && typeof bbAdvanceStep === "function") {
    state.planStatus = "empty";
    state.budgetBuild = null;
    bbStart();
    BB_STEPS.forEach(function () { bbAdvanceStep(); });
    var bad = CATEGORIES.filter(function (c) {
      var v = catValue(state.plan, c);
      return !isFinite(v) || v < 0;
    });
    if (bad.length) planBad.push(p.id + ": " + bad.join(", "));
    state.budgetBuild = null;
  }
});

chk(profileFails.length === 0, SCREENS.length + " screens x 9 profiles render",
    profileFails.slice(0, 4).join("\n          "));
chk(peerBad.length === 0, "the peer model is finite and positive everywhere",
    peerBad.slice(0, 6).join(" · "));
chk(treeBad.length === 0, "every Help-me-out tree returns a real figure in every ZIP",
    treeBad.slice(0, 6).join(" · "));
chk(nanSeen.length === 0, "no NaN reaches a rendered figure or inline style",
    nanSeen.slice(0, 6).join(" · "));
chk(planBad.length === 0, "the budget builder completes from any profile",
    planBad.slice(0, 4).join(" · "));

// The flat spots are a real property of a five-band model, not a fault — but
// they must be VISIBLE, or a 25% raise that moves nothing reads as broken.
var flat = [];
["above", "at", "below"].forEach(function (t) {
  var bands = profileLevels().map(function (l) {
    return (profileResolve(profileId(t, l.id)) || {}).band;
  });
  if (bands[0] === bands[1] || bands[1] === bands[2]) flat.push(t + " " + bands.join("/"));
});
chk(flat.length > 0 && profiles.every(function (p) { return !!p.band; }),
    "every profile resolves an income band, and the flat spots are known",
    "shared bands: " + flat.join(" · "));

// The skip fallback has to be one of the nine, or it is another silent default.
var d = profileDefault();
chk(!!d && profiles.some(function (p) { return p.id === d.id; }),
    "the skip fallback is one of the nine", d ? d.id : "none");
chk(d && d.name === "Me" && d.buddyName === "Buddy",
    "the tester is 'Me' and only the dog is 'Buddy'",
    d ? d.name + " / " + d.buddyName : "no default");

state.activeProfileId = __profileBefore;
state.planStatus = "complete";
bootV3();
}

// ─────────────────────────────────────────────────────────────────────────────
section("2. D19 — no screen renders empty, in any state");
// The states a tester can actually reach, not just the seeded one.
var STATES = {
  "seeded":            function () {},
  "no budget":         function () { state.planStatus = "empty"; },
  "no journal yet":    function () { state.journalEntries = []; state.journal = []; },
  "no goals":          function () { state.tacticalGoals = []; state.strategicGoal = null; },
  "no bills or subs":  function () { state.bills = []; state.subs = []; },
  "zero kibble/streak":function () { state.kibble = 0; state.streak = 0; state.buddyLevel = 0; },
  "all tasks done":    function () { (state.dailyTasks || []).forEach(function (t) { t.completed = true; }); },
  "no observations":   function () { state.observations = []; }
};
var MIN_CHARS = 40;

// KNOWN, ACCEPTED thin renders — screen id to its EXACT text.
//
// Not a way to silence D19. The text has to match character for character, so
// any other thin render still fails and this one starts failing again the
// moment it changes. It downgrades to a warning so the exception stays visible
// rather than disappearing.
//
// spendEstimator with no session: a real D19 violation, found when the sweep
// started deriving its screen list from the router instead of a hardcoded array
// that had omitted this screen entirely. FIXED IN v3.1. Left in v3 by owner
// decision — v3 is the A/B control and stays frozen — so this only fires there.
var D19_ACCEPTED = { spendEstimator: "Nothing to estimate." };

var acceptedThin = [];
Object.keys(STATES).forEach(function (name) {
  bootV3();                       // fresh seed
  STATES[name]();
  var thin = [];
  SCREENS.forEach(function (sc) {
    var html = renderSafe(sc);
    if (html && html.__error) { thin.push(sc + " THREW: " + html.__error); return; }
    var text = textOf(html).trim().replace(/\s+/g, " ");
    if (text.length >= MIN_CHARS) return;
    if (D19_ACCEPTED[sc] === text) {
      if (acceptedThin.indexOf(sc) === -1) acceptedThin.push(sc);
      return;
    }
    thin.push(sc + " (" + text.length + " chars)");
  });
  chk(thin.length === 0, "state: " + name, thin.slice(0, 5).join("\n          "));
});
if (acceptedThin.length) {
  warn(acceptedThin.length + " known thin render(s), accepted",
       acceptedThin.join(", ") + " — see D19_ACCEPTED in scripts/sweep.js");
}
bootV3();

// ─────────────────────────────────────────────────────────────────────────────
section("3. D18 — every observation reachable from >= 2 surfaces, and rendered");
var SURFACES = ["home_tip","home_task","budget_comparison","progress","progress_bills","goals","daily_update"];
var reach = {};
SURFACES.forEach(function (su) {
  observationsFor(su).forEach(function (o) { reach[o.id] = (reach[o.id] || 0) + 1; });
});
var ids = (state.observations || []).map(function (o) { return o.id; });
chk(ids.length === 4, "four seeded observations", ids.join(", "));
ids.forEach(function (id) {
  chk((reach[id] || 0) >= 2, "  " + id + " on " + (reach[id] || 0) + " surfaces");
});
// Registry membership is not the same as appearing on screen — check the text.
var appears = {};
["home", "aboutMe", "comparison", "myProgress", "dailySummary", "goals"].forEach(function (sc) {
  var t = textOf(renderSafe(sc));
  ids.forEach(function (id) {
    var o = observationById(id);
    var head = observationHeadline(o);
    if (head && t.indexOf(head.slice(0, 24)) !== -1) appears[id] = (appears[id] || 0) + 1;
  });
});
ids.forEach(function (id) {
  var n = appears[id] || 0;
  n >= 1 ? ok("  " + id + " actually renders on " + n + " screen(s)")
         : warn("  " + id + " is registered but its headline renders nowhere",
                "registry says " + (reach[id] || 0) + " surfaces");
});

// ─────────────────────────────────────────────────────────────────────────────
section("4. D26 / L20 — no financial advice anywhere");
var ADVICE = [/\byou should\b/i, /\bwe recommend\b/i, /\byou ought to\b/i, /\bcancel your\b/i,
              /\bswitch to\b/i, /\byou must\b/i, /\bbest option\b/i, /\bwe suggest\b/i,
              /\bI recommend\b/i, /\byou need to\b/i];
var adviceHits = [];
SCREENS.forEach(function (sc) {
  var t = textOf(renderSafe(sc));
  ADVICE.forEach(function (re) { var m = t.match(re); if (m) adviceHits.push(sc + ': "' + m[0] + '"'); });
});
chk(adviceHits.length === 0, "no advice-shaped copy on any screen", adviceHits.slice(0, 6).join("\n          "));

var libHits = [];
(BUDDY_RESPONSES.responses || []).forEach(function (r) {
  ADVICE.forEach(function (re) { if (re.test(r.text)) libHits.push(r.id); });
});
chk(libHits.length === 0, "no advice in the buddy response library", libHits.join(", "));

var scriptHits = [];
Object.keys(LESSON_SCRIPTS).forEach(function (k) {
  LESSON_SCRIPTS[k].forEach(function (line) {
    ADVICE.forEach(function (re) { if (re.test(line)) scriptHits.push(k); });
  });
});
chk(scriptHits.length === 0, "no advice in the 15 lesson scripts", scriptHits.join(", "));

var duHits = [];
(DAILY_SCRIPTS.scripts || []).forEach(function (s) {
  s.segments.forEach(function (seg) {
    ADVICE.forEach(function (re) { if (re.test(seg.text)) duHits.push(s.id + "/" + seg.id); });
  });
});
chk(duHits.length === 0, "no advice in the daily-update scripts", duHits.join(", "));

// The guardrail itself, both directions.
var ADVICE_Q = ["should i invest","what should i do","is it a good idea to cancel hulu",
  "would you cancel it","which is better","help me decide","can i afford this",
  "is it smart to pay it off","shall i cancel","what would you do","recommend something",
  "tell me what to do","is it worth it","how much should i save"];
var leaked = ADVICE_Q.filter(function (q) { return chatRoute(q).id !== "advice_deflect"; });
chk(leaked.length === 0, ADVICE_Q.length + " advice phrasings all deflect", leaked.join(" | "));

var LEGIT_Q = (BUDDY_RESPONSES.responses || []).filter(function (r) { return r.bubble; })
  .map(function (r) { return r.bubble.toLowerCase(); });
var overzealous = LEGIT_Q.filter(function (q) { return chatRoute(q).id === "advice_deflect"; });
chk(overzealous.length === 0, LEGIT_Q.length + " real questions NOT wrongly deflected", overzealous.join(" | "));

// Reset must restore the OPENING bubbles, not leave the last reply's follow-ups
// behind. Two copies of chatResetConversation() once existed and the shadowing
// one skipped the bubbles, so a reset left chips pointing at a deleted thread.
// renderChat only falls back to openingBubbles when bubbles is EMPTY, so a
// stale non-empty array is invisible without checking it directly.
// Driven through chatRespond(), not chatSend(): chatSend reads a DOM input the
// stub returns empty, which would make this pass without ever moving bubbles.
var opening = (BUDDY_RESPONSES.openingBubbles || []).join(",");
var moved = false;
(BUDDY_RESPONSES.responses || []).forEach(function (r) {
  if (moved || !r.followUp || !r.followUp.length) return;
  chatResetConversation();
  chatRespond(r.bubble || r.id);
  if ((state.chat.bubbles || []).join(",") !== opening) moved = true;
});
var midChat = (state.chat.bubbles || []).join(",");
chatResetConversation();
chk(moved, "precondition: a reply moves the bubbles off the opening set",
    "no response in the library changed them — the check below would be vacuous");
chk(state.chat.messages.length === 0 && (state.chat.bubbles || []).join(",") === opening,
    "chat reset restores the opening bubbles",
    "mid-chat: " + midChat + "\n          after reset: " + (state.chat.bubbles || []).join(","));

// ─────────────────────────────────────────────────────────────────────────────
section("5. A13 — tone");
var exclam = [];
SCREENS.forEach(function (sc) {
  var t = textOf(renderSafe(sc));
  // An exclamation mark in the same sentence as a figure.
  var m = t.match(/[^.!?]*[$%]\s?\d[^.!?]*!/);
  if (m) exclam.push(sc + ': "' + m[0].slice(0, 44).trim() + '"');
});
chk(exclam.length === 0, "no exclamation marks on a financial figure", exclam.slice(0, 4).join("\n          "));

var VOCAB_BAD = [[/\bexpense tracker\b/i, 'use "Money Journal"'],
                 [/\baverage users\b/i,   'use "peers"'],
                 [/\bother users\b/i,     'peer data is not real people (D23)']];
var vocabHits = [];
SCREENS.forEach(function (sc) {
  var t = textOf(renderSafe(sc));
  VOCAB_BAD.forEach(function (p) { if (p[0].test(t)) vocabHits.push(sc + " — " + p[1]); });
});
chk(vocabHits.length === 0, "vocabulary consistent", vocabHits.join("\n          "));

var tip = String(state.tipBanner || "");
chk(tip.length <= 90, "tip banner within 90 chars", tip.length + " chars");

// ─────────────────────────────────────────────────────────────────────────────
section("6. Admin wiring — 5 points per screen");
var noSubtitle = [], noJump = [];
SCREENS.forEach(function (sc) {
  state.screen = sc;
  var sub = adminSubtitle();
  if (!sub || sub === "Manual controls for this wireframe screen.") noSubtitle.push(sc);
});
var jumpList = (typeof destinations !== "undefined" ? destinations : []).map(function (d) { return d[0]; });
SCREENS.forEach(function (sc) { if (jumpList.indexOf(sc) === -1) noJump.push(sc); });

noSubtitle.length === 0
  ? ok("every screen has an admin subtitle")
  : warn(noSubtitle.length + " screens fall back to the generic subtitle", noSubtitle.join(", "));
noJump.length === 0
  ? ok("every screen is in the admin jump list")
  : warn(noJump.length + " screens are not in destinations[]", noJump.join(", "));

var noTab = SCREENS.filter(function (sc) {
  var t = activeTabFor(sc);
  return !state.nav.stacks[t];
});
chk(noTab.length === 0, "every screen maps to a real nav stack", noTab.join(", "));

// The admin buttons are reachable only from onclick in index.html, so nothing
// else here exercises them. copyAppState() in particular reads a dozen state
// keys and used to name two that no longer exist.
var adminActionErr = null;
try { copyAppState(); } catch (e) { adminActionErr = String(e); }
chk(adminActionErr === null, "copyAppState() runs without throwing", adminActionErr);

// Assert on what appStateSnapshot() ACTUALLY emits. The first version of this
// check built its own object from `state` and tested that — a tautology over
// bootV3() that stayed green no matter what the snapshot contained.
var snap = {};
try { snap = JSON.parse(JSON.stringify(appStateSnapshot())); } catch (e) { adminActionErr = String(e); }
var WANT = ["plan","mtd","nav","theme","journal","journalEntries","observations",
            "strategicGoal","tacticalGoals","dailyTasks"];
var missing = WANT.filter(function (k) {
  return snap[k] === undefined || snap[k] === null;
});
chk(missing.length === 0, "snapshot carries the three layers, goals, tasks and nav",
    "missing/null: " + missing.join(", "));

// The v2 names are parked and vestigial (boot.js). Reporting them as if they
// were v3's is the defect this snapshot was rewritten to fix, and it shipped
// once doing exactly that — so pin the spelling.
chk(snap.goals === undefined && snap.tasks === undefined,
    "snapshot does not report v2's parked goals/tasks as v3's",
    "found top-level: " + ["goals","tasks"].filter(function (k) { return snap[k] !== undefined; }).join(", "));
chk(!!(snap.legacy && "goals" in snap.legacy && "tasks" in snap.legacy),
    "v2's parked arrays are still captured, under legacy");

// ── Slider handlers ─────────────────────────────────────────────────────────
// These had zero coverage: the DOM stub's setTimeout used to discard its
// callback, so debouncedRender() was a no-op and no test ever called them.
// A misspelled debouncedRender would have passed the sweep and thrown in a
// browser on the first pointer move.
// Checked PER HANDLER, not in aggregate: an "any of them queued" assertion
// stays green while three handlers debounce and the fourth calls render()
// directly, which is precisely the regression worth catching.
state.screen = "aboutMe";
var SLIDERS = [
  ["budgetSetPlan",      function () { budgetSetPlan("Dining out", 250, true); }],
  ["lwAdjust",           function () {
      state.lifestyleWizard = { preview: { "Dining out": 200 } };
      lwAdjust("Dining out", 240); }],
  ["journalAdjustEntry", function () {
      state.journalSession = { entries: [{ id: "e1", label: "x", category: "Dining out",
                                           amount: 20, baseAmount: 20 }] };
      journalAdjustEntry("e1", 35); }],
  ["lessonSimSet",       function () {
      state.lessonSim = { values: {} }; lessonSimSet("balance", 4200); }]
];
var sliderErr = [], notDebounced = [];
SLIDERS.forEach(function (pair) {
  flushTimers();                               // empty the queue first
  try { pair[1](); } catch (e) { sliderErr.push(pair[0] + ": " + e); return; }
  if (flushTimers() === 0) notDebounced.push(pair[0]);
});
chk(sliderErr.length === 0, SLIDERS.length + " slider handlers run", sliderErr.join("\n          "));
chk(notDebounced.length === 0, "every slider handler debounces its render",
    "called render() directly (destroys the dragged element): " + notDebounced.join(", "));

// The non-live path must still repaint immediately — the admin number field
// shares budgetSetPlan and would otherwise wait 400ms for no reason.
flushTimers();
budgetSetPlan("Dining out", 260);
chk(flushTimers() === 0, "budgetSetPlan without `live` renders immediately");

// The ceiling must not move when the value does, or the thumb recoils on release.
var maxBefore = budgetSliderMax("Dining out");
budgetSetPlan("Dining out", 999, true);
var maxAfter = budgetSliderMax("Dining out");
budgetSetPlan("Dining out", 250);
chk(maxBefore === maxAfter, "slider ceiling is stable as the value changes",
    "max moved " + maxBefore + " -> " + maxAfter + " (thumb would snap back)");

// ─────────────────────────────────────────────────────────────────────────────
section("7. Data integrity");
chk(CATEGORIES.length === 12, "12-category taxonomy");

// The builder's three steps must PARTITION the taxonomy. A category in no step
// is never put to the tester and saves at whatever the peer model opened it on;
// a category in two steps is asked twice and the second answer silently wins.
// Neither raises anything at runtime.
if (typeof BB_STEPS !== "undefined") {
  var bbCovered = bbAllStepCategories();
  var bbMissing = CATEGORIES.filter(function (c) { return bbCovered.indexOf(c) === -1; });
  var bbTwice   = bbCovered.filter(function (c, i) { return bbCovered.indexOf(c) !== i; });
  chk(bbMissing.length === 0 && bbTwice.length === 0 && bbCovered.length === CATEGORIES.length,
      "the builder's " + BB_STEPS.length + " steps cover all 12 exactly once",
      (bbMissing.length ? "never asked: " + bbMissing.join(", ") + ". " : "") +
      (bbTwice.length ? "asked twice: " + bbTwice.join(", ") : ""));
  // Every line is a slider — the steps group categories by how well a tester
  // knows them, not by how the figure is entered. That was misread once and
  // built as a number field on step 1.
  state.budgetBuild = null;
  bbStart();
  var bbSliders = 0, bbFields = 0;
  BB_STEPS.forEach(function (st, i) {
    state.budgetBuild.step = i;
    var html = renderBudgetBuild();
    bbSliders += (html.match(/band-range/g) || []).length;
    bbFields  += (html.match(/bb-exact/g) || []).length;
  });
  chk(bbSliders === CATEGORIES.length && bbFields === 0,
      "all 12 lines render a slider, none a number field",
      bbSliders + " sliders, " + bbFields + " number fields");

  // The thumb opens on the peer figure, so it starts dead centre of the band
  // drawn behind it. Opening on the no-lifestyle national figure instead left
  // it visibly off its own band.
  state.budgetBuild = null;
  bbStart();
  var bbOffBand = CATEGORIES.filter(function (c) {
    return bbValue(c) !== benchPeerValue(c, benchOptsForUser());
  });
  chk(bbOffBand.length === 0,
      "every slider opens on its own peer figure", bbOffBand.join(", "));

  // "Budgeted so far" counts reviewed categories only, and grows step by step.
  state.budgetBuild = null;
  bbStart();
  var bbCounts = BB_STEPS.map(function (_, i) {
    state.budgetBuild.step = i;
    return bbCategoriesSoFar().length;
  });
  chk(bbCounts[0] === 2 && bbCounts[1] === 7 && bbCounts[2] === 12 &&
      bbCounts[2] === CATEGORIES.length,
      "the header total is cumulative (2 -> 7 -> 12)", bbCounts.join(" -> "));
  state.budgetBuild = null;

// ── "Worth a look" surfaces OVER peers, never under ─────────────────────────
// cmpWorthNoticing and cmpImpact both used Math.abs, so being far BELOW peers
// scored identically to being far above — and the seeded persona is under peers
// almost everywhere, so the section listed the biggest under-spends. Nothing
// errored; the list was simply the wrong list. v3 still carries the Math.abs
// version — it is the A/B control and does not get the fix — so this stays
// inside the v3.1 guard with everything else.
  var flagged = cmpAllRows().filter(cmpWorthNoticing)
                            .sort(function (a, b) { return cmpImpact(b) - cmpImpact(a); });
  var under = flagged.filter(function (r) { return r.user <= r.peer; });
  chk(under.length === 0, "nothing under peers is ever flagged",
      under.map(function (r) { return r.category; }).join(", "));

  var descending = flagged.every(function (r, i) {
    return i === 0 || cmpImpact(flagged[i - 1]) >= cmpImpact(r);
  });
  chk(descending && flagged.length > 0,
      "flagged rows are ordered by dollars over peers, most first",
      flagged.map(function (r) {
        return r.category + " +" + Math.round(r.user - r.peer);
      }).join(" · ") || "nothing flagged at all");

  // ── Scroll identity ──────────────────────────────────────────────────────
  // render() holds the scroll offset while scrollKey() is unchanged. Screens
  // that are one id with several steps have to say so, or Continue lands the
  // tester at the bottom of the next step — which is what happened when the
  // key was just state.screen.
  state.budgetBuild = null; bbStart();
  var keys = BB_STEPS.map(function (_, i) { state.budgetBuild.step = i; return scrollKey(); });
  chk(keys[0] !== keys[1] && keys[1] !== keys[2],
      "each builder step is its own scroll view", keys.join(" / "));

  // ...and the inverse: answering, dragging and toggling within a step must
  // NOT count as a new view, or the page yanks to the top mid-gesture.
  state.budgetBuild.step = 1;
  var before = scrollKey();
  bbSet("Groceries", 615);
  bbToggleHelp("Utilities");
  chk(scrollKey() === before,
      "changing values within a step holds the tester's place", before + " -> " + scrollKey());
  bbToggleHelp("Utilities");
  state.budgetBuild = null;

  // ── The Help-me-out trees ────────────────────────────────────────────────
  if (typeof HELP_ME_OUT !== "undefined") {
    var noTree = CATEGORIES.filter(function (c) { return !hmoHasTree(c); });
    chk(noTree.length === 0, "every category has an estimation tree", noTree.join(", "));

    var noSource = [];
    CATEGORIES.forEach(function (c) {
      var t = hmoTree(c);
      if (!t || !t.rates || !t.rates._source) noSource.push(c);
    });
    chk(noSource.length === 0, "every tree cites where its figures came from", noSource.join(", "));

    // A BUDGET IS A MONTH. The engine this replaced multiplied every figure by
    // how far into the month we were, so on the 4th of a 30-day month "light
    // local driving" came out at $10 of transport and picking the priciest
    // option still LOWERED the category. Nothing in the model may read a clock.
    var realFrac = estimatorMonthFraction;
    var baseline = {}, drifted = {};
    CATEGORIES.forEach(function (c) { baseline[c] = hmoCompute(c, hmoBaselineAnswers(c)); });
    estimatorMonthFraction = function () { return 0.05; };
    CATEGORIES.forEach(function (c) { drifted[c] = hmoCompute(c, hmoBaselineAnswers(c)); });
    estimatorMonthFraction = realFrac;
    var dated = CATEGORIES.filter(function (c) { return baseline[c] !== drifted[c]; });
    chk(dated.length === 0, "no tree's figure depends on the date", dated.join(", "));

    // A mistyped rate key returns undefined, becomes 0, and every option then
    // produces the same number — a question that looks like it works and does
    // nothing. If a question's options cannot move the figure, something is
    // wired to a key that is not there.
    var inert = [];
    CATEGORIES.forEach(function (c) {
      var t = hmoTree(c);
      t.questions.forEach(function (q) {
        if (q.type !== "choice" || !q.options || q.options.length < 2) return;
        var base = hmoMaxAnswers(c);
        // A question its own preconditions hide cannot be exercised at all.
        if (!hmoQuestionShows(q, base)) return;
        var seen = {};
        q.options.forEach(function (o) {
          var a = {};
          Object.keys(base).forEach(function (k) { a[k] = base[k]; });
          a[q.id] = o.id;
          seen[hmoCompute(c, a)] = true;
        });
        // A question whose only job is to steer the peer band is allowed to be
        // inert on the figure; one that carries rates is not.
        if (Object.keys(seen).length < 2 && !q.lifestyle) inert.push(c + "." + q.id);
      });
    });
    chk(inert.length === 0, "every rate-bearing question actually moves its figure",
        inert.join(", "));

    // Flat categories are priced nationally — a streaming plan and a loan
    // repayment cost the same everywhere.
    var flatWrong = ["Subscriptions", "Debt payments"].filter(function (c) {
      return hmoColMultiplier(c) !== 1;
    });
    chk(flatWrong.length === 0, "flat categories carry no cost-of-living multiplier",
        flatWrong.join(", "));

    // Decimal slips survive lint and look like money. Every tree's baseline
    // answers must land in the same order of magnitude as the peer figure.
    var wild = [];
    CATEGORIES.forEach(function (c) {
      var peer = benchPeerValue(c, benchOptsForUser()) || 0;
      if (!peer) return;
      var v = baseline[c];
      if (v > peer * 6 || (v > 0 && v < peer / 8)) {
        wild.push(c + " " + Math.round(v) + " vs peer " + peer);
      }
    });
    chk(wild.length === 0, "no tree lands an order of magnitude away from its peer figure",
        wild.join(" · "));
  }

  // ASSERT THE VALUE, NOT JUST THE ORDER. Once the filter keeps only over-peers
  // rows, Math.abs(user - peer) equals user - peer for every row that survives,
  // so an ordering check passes under the buggy implementation too and proves
  // nothing. The two only diverge when a plan gap exceeds a peer gap — which
  // the seeded persona happens not to produce. This catches it on any data.
  var impactWrong = cmpAllRows().filter(function (r) {
    if (r.peer == null) return cmpImpact(r) !== 0;
    return cmpImpact(r) !== (r.user - r.peer);
  });
  chk(impactWrong.length === 0,
      "cmpImpact is the signed peer gap, with no plan term and no Math.abs",
      impactWrong.map(function (r) {
        return r.category + ": got " + Math.round(cmpImpact(r)) +
               ", want " + Math.round(r.user - (r.peer || 0));
      }).join(" · "));

  // Every flag must clear BOTH gates — dollars stop a trivial category
  // qualifying on percentage, percentage stops Housing qualifying on size.
  var weak = flagged.filter(function (r) {
    return (r.user - r.peer) < CMP_ABS_THRESHOLD || r.vsPeer < CMP_PCT_THRESHOLD;
  });
  chk(weak.length === 0, "every flag clears both the dollar and the percent gate",
      weak.map(function (r) { return r.category; }).join(", "));
  chk(CATEGORIES.every(function (c) { return typeof catLabel(c) === "string" && catLabel(c).length; }),
      "every category has a display label");
  chk(Object.keys(CATEGORY_LABELS).every(isCategory),
      "every renamed label points at a real taxonomy member",
      Object.keys(CATEGORY_LABELS).filter(function (k) { return !isCategory(k); }).join(", "));
}
// benchSelfTest checks three factors separately now — base lookup, lifestyle
// product, cost of living — because the col factor moved when the tier table
// was replaced by BEA. Report which one failed, not just that something did.
var selfTest = benchSelfTest();
chk(selfTest.pass, "benchmark self-test -> " + selfTest.actual +
    " (spec's retired figure was " + selfTest.specResult + ")",
    selfTest.failed.map(function (f) {
      return f.name + ": expected " + f.expected + ", got " + f.actual;
    }).join("\n          "));
chk(catTotal(SEED_STATE.monthToDateActuals) > 0, "month-to-date sums without _note contamination");
var noteLeak = CATEGORIES.indexOf("_note") === -1;
chk(noteLeak, "_note is not a category");
var d = cmpRow("Dining out");
chk(d.vsPlan !== d.vsPeer, "the two dining gaps stay distinct",
    "plan " + d.vsPlan + "% vs peers " + d.vsPeer + "%");
var missingScripts = [];
(LESSONS_V3.lessons || []).forEach(function (l) {
  (l.scriptVariants || []).forEach(function (v) { if (!lessonScriptFor(v.id)) missingScripts.push(v.id); });
});
chk(missingScripts.length === 0, "all 15 lesson variants have a script body", missingScripts.join(", "));

// ─────────────────────────────────────────────────────────────────────────────
section("7b. Unreferenced functions — inventory, not a verdict");

// POLICY: unused code is KEPT, not deleted. This is a prototype under active
// iteration, and something dropped today is something rewritten next week. Git
// history technically preserves a deletion, but retrieving it means knowing
// which commit to dig into — friction that is not worth the tidiness.
//
// So this does not fail on dead code. What it watches for is MOVEMENT: a
// function that used to be referenced and now is not was probably orphaned by
// accident — a handler left behind when its button moved, a cue dropped from a
// dispatch table. That is a refactor bug, and it looks identical to deliberate
// dead code unless you know which ones were already here.
//
// Hence the baseline. Everything below was unreferenced as of the L21 change
// and is kept on purpose. Anything NOT on this list is new, and warns.
var DEAD_BASELINE = [
  "benchSelfTest",              // documents the benchmark formula by example
  // The ZIP-only entry point to the cost-of-living predicate. benchColIndex
  // already holds a resolved lookup and uses benchColSupported, so calling this
  // instead would repeat the lookup. Kept as the module's public
  // "is this area modeled?".
  "benchZipSupported",
  "buddyDescription",           // buddy plumbing, used once art lands (L22)
  // v3.1 inverted the budget flow, so these two lost their callers THERE.
  // Both are still live in v3, which is why they are not deleted: the two
  // versions are an A/B pair and the files stay readable side by side.
  "lwBuildPreview",             // v3: lazily rebuilt the review preview
  "lwSubmit",                   // v3: the single save path, now split in v3.1
  "budgetDelta",
  "catRows",                    // taxonomy helper, pairs with catTotal/catValue
  "completeAndReward",
  "dailySummaryDone",
  "journalDiscard",             // journal seam
  "observationPeerCounterpart",
  "planToBaseline",             // budget-baseline seam (L6)
  // Both orphaned deliberately when the Budget tab became the review surface:
  // the twelve slider rows moved to the per-category screen, and "Worth a look"
  // replaced the observation cards. Kept because a future edit mode wants them.
  "renderBudgetCategoryRow",
  "renderBudgetObservationCards",
  // Orphaned when the three stacked Budget/Peers/You bars became one band
  // track (components/budget-band.js). Kept, not deleted: it is the only
  // implementation of the old per-flag bar scaling, and v3 still renders that
  // layout — the two versions stay diffable.
  "cmpFlagBar",
  "themeIsDark"                 // L21, for a screen that wants to branch on theme
];

// Everything shares one global namespace, so a name declared in two files is
// not an error — the later <script> wins and the earlier becomes unreachable.
// This is invisible to the count above: a shadowed function is still
// referenced, it just never runs. It is how chatResetConversation() sat dead in
// chat-router.js while a second copy in screens/chat.js quietly did less.
chk(__DUPLICATE_DECLS.length === 0, "no name declared twice",
    __DUPLICATE_DECLS.map(function (d) {
      return d.name + "  →  " + d.files.join(" , ") + "   (" + d.scope +
             "; last one wins for function/var, SyntaxError for const/let)";
    }).join("\n          "));

var deadNames = __UNREFERENCED.map(function (d) { return d.name; });
var appeared = __UNREFERENCED.filter(function (d) { return DEAD_BASELINE.indexOf(d.name) === -1; });
var resolved = DEAD_BASELINE.filter(function (n) { return deadNames.indexOf(n) === -1; });

ok(deadNames.length + " unreferenced, " + DEAD_BASELINE.length + " expected (kept on purpose)");
if (appeared.length) {
  warn("newly unreferenced since the baseline — orphaned by a refactor?",
       appeared.map(function (d) { return d.name + "  " + d.file; }).join("\n          "));
} else {
  ok("nothing newly orphaned");
}
if (resolved.length) {
  ok(resolved.length + " baseline entr" + (resolved.length === 1 ? "y is" : "ies are") +
     " now referenced", "prune from DEAD_BASELINE: " + resolved.join(", "));
}

// ─────────────────────────────────────────────────────────────────────────────
section("7c. The rendered films agree with the app's clock");
// The onboarding film is rendered SILENT and narrated live, so the film's
// timeline and the app's caption clock are two independent computations of the
// same per-segment durations. When they disagree the picture and the words come
// apart and NOTHING else reports it — no error, no failed load, just a film that
// feels wrong. This is the only guard.
if (!__FILM_MANIFEST) {
  ok("no rendered films in this version — nothing to compare");
} else {
  var mf = __FILM_MANIFEST;
  chk(mf.wpm === (typeof DU_WPM !== "undefined" ? DU_WPM : 165),
      "the film build and the app narrate at the same wpm",
      "manifest " + mf.wpm + " vs app " + (typeof DU_WPM !== "undefined" ? DU_WPM : "?"));

  var drift = [], missingScript = [];
  Object.keys(mf.films).forEach(function (id) {
    var film = mf.films[id];
    var script = null;
    try {
      script = ONBOARDING_SCRIPT.scripts.filter(function (x) { return x.id === film.script; })[0];
    } catch (e) {}
    if (!script) { missingScript.push(film.script); return; }
    script.segments.forEach(function (seg, i) {
      var appMs = onbVideoSegMs(seg.text);
      if (appMs !== film.segmentMs[i]) {
        drift.push(id + "/" + seg.id + ": film " + film.segmentMs[i] + "ms vs app " + appMs + "ms");
      }
    });
  });
  chk(missingScript.length === 0, "every rendered film still has its script",
      "gone from onboarding-script.json: " + missingScript.join(", "));
  chk(drift.length === 0, "every film's beats match onbVideoSegMs",
      drift.slice(0, 4).join("\n          ") +
      (drift.length ? "\n          → re-run tools/film/build-films.mjs --render" : ""));

  // Every look x script the app can ASK for must have been rendered, or that
  // combination silently drops to the SVG fallback and reads as "broken video".
  // The FULL set the app can ask for, from the script data — not from what has
  // already been rendered. Deriving it from the manifest made the coverage check
  // vacuous: it could only ever compare the renders against themselves.
  var scripts = [];
  try {
    scripts = ONBOARDING_SCRIPT.scripts.map(function (x) { return x.id; });
  } catch (e) {}
  // A look with NO films is simply not rendered yet, and its themes fall back to
  // the live SVG engine — that is a normal state while a look is being iterated
  // on. A look with SOME films is the actual defect: the app lists those themes
  // and then finds nothing for the scripts that are missing.
  var started = (mf.looks || []).filter(function (l) {
    return Object.keys(mf.films).some(function (id) { return mf.films[id].look === l; });
  });
  // Coverage is a WARNING, not a failure. A film that has not been rendered
  // cannot break anything: data/onboarding-films.js is generated from what
  // actually exists, so the app only ever asks for a file that is there and
  // everything else falls back to the live SVG engine by design. What this is
  // for is telling you what is still outstanding.
  var want = (mf.looks || []).length * scripts.length;
  var absent = [];
  (mf.looks || []).forEach(function (l) {
    scripts.forEach(function (s) { if (!mf.films[l + "__" + s]) absent.push(l + "__" + s); });
  });
  if (absent.length) {
    warn((want - absent.length) + " of " + want + " films rendered — the rest use the SVG fallback",
         absent.slice(0, 6).join(", ") +
         (absent.length > 6 ? " …+" + (absent.length - 6) : "") +
         "\n          cd tools && node film/build-films.mjs --render");
  } else {
    ok("all " + want + " films rendered");
  }

  // THIS one is a real failure: a theme listed in the app's index whose film is
  // not in the manifest would have the app ask for a file that is not there.
  var listed = [];
  try {
    Object.keys(ONBOARDING_FILMS).forEach(function (th) {
      var e = ONBOARDING_FILMS[th];
      (e.scripts || []).forEach(function (sc) {
        if (!mf.films[e.look + "__" + sc]) listed.push(th + "/" + sc);
      });
    });
  } catch (e) {}
  chk(listed.length === 0, "the app's film index matches what was rendered",
      "listed but absent: " + listed.slice(0, 6).join(", "));

  // ── the stage is the picture's shape, and the picture's colour ────────────
  // Both tiers draw at 100:72 and the stage used to be free to be taller, so up
  // to 85px of it could only ever be accent green around a cream film.
  // v4 only -- onbFilmGroundStyle is the marker. v3 and v3.1 still have the
  // fixed-height stage this replaced, and it is correct for them: they never
  // paint it, so a box taller than the picture is just accent green by design.
  if (typeof onbFilmGroundStyle === "function" &&
      typeof __COMPONENTS_CSS === "string" && typeof __HF_VIEW === "object") {
    var stageRule = /\.onb-video-stage\s*\{([\s\S]*?)\n\}/.exec(__COMPONENTS_CSS);
    var stageBody = stageRule ? stageRule[1] : "";
    var ar = /aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/.exec(stageBody);
    var cv = mf.canvas || {};
    var cssR  = ar ? Number(ar[1]) / Number(ar[2]) : 0;
    var hfR   = __HF_VIEW.h ? __HF_VIEW.w / __HF_VIEW.h : 0;
    var filmR = cv.height ? cv.width / cv.height : 0;
    var near = function (a, b) { return Math.abs(a - b) < 0.005; };
    chk(!!ar && near(cssR, hfR) && near(cssR, filmR),
        "the stage, the SVG viewBox and the film canvas are all 100:72",
        "css " + (ar ? ar[1] + "/" + ar[2] : "none") + " · viewBox " +
        __HF_VIEW.w + "/" + __HF_VIEW.h + " · canvas " + cv.width + "/" + cv.height +
        "\n          they disagree, so the stage frames the picture in accent colour");
    chk(!/max-height:/.test(stageBody) && !/(^|\s)height:\s*\d/.test(stageBody),
        "nothing lets the stage outgrow the picture again",
        "a fixed height or max-height on .onb-video-stage is what put the green " +
        "bars there");
  }

  // Grounds: one per look, each a real colour, published by the build rather
  // than guessed -- they are pushed past the app's tokens and derive from the
  // NATURAL themes, so no app-side color-mix() can reproduce them.
  if (typeof ONBOARDING_FILM_GROUNDS !== "undefined") {
    var missingGround = (mf.looks || []).filter(function (l) {
      return !/^#[0-9a-f]{6}$/i.test(ONBOARDING_FILM_GROUNDS[l] || "");
    });
    chk(missingGround.length === 0, "every look publishes the ground it renders on",
        "no ground for: " + missingGround.join(", "));
  }

  // ── ⚠ ONLY A FILM GETS A PAINTED STAGE ────────────────────────────────────
  // The SVG fallback draws entirely in --on-dark and paints no ground of its
  // own, so it relies on .lp-stage's accent. Painting cream under it is light
  // ink on near-white -- invisible, and only where no film plays, so it reads
  // as the animation being broken rather than as a colour choice.
  if (typeof onbFilmGroundStyle === "function" && typeof onbStart === "function") {
    var _ob2 = state.onboarding, _sc2 = state.settings ? state.settings.colorMode : null;
    onbStart();
    state.onboarding.improveAreas = [];
    onbFilmResetArt();
    var withFilm = onbFilmGroundStyle();
    var look = (onbFilmEntry() || {}).look;
    onbFilmFailed({});                       // what the <video> onerror does
    var withoutFilm = onbFilmGroundStyle();
    onbFilmResetArt();
    state.onboarding = _ob2;
    if (_sc2 != null && state.settings) state.settings.colorMode = _sc2;

    chk(withFilm.indexOf(ONBOARDING_FILM_GROUNDS[look] || "\u0000") !== -1,
        "a playing film paints the stage its own ground", "got: " + withFilm);
    chk(withoutFilm === "",
        "the SVG fallback keeps the accent ground",
        "it draws in --on-dark and would be invisible on a light one\n          got: " +
        withoutFilm);

    // AND THE MARKUP HAS TO CALL IT. Checking the helper alone missed a
    // mutation that simply dropped it from the template -- a correct colour
    // nobody interpolates is the same green stage with extra steps.
    var _ob3 = state.onboarding;
    onbStart();
    state.onboarding.improveAreas = [];
    state.onboarding.video = null;
    onbFilmResetArt();
    var stageHtml = "";
    try { stageHtml = onbVideoStage(onbVideo()); } catch (e) { stageHtml = "threw: " + e.message; }
    var lookNow = (onbFilmEntry() || {}).look;
    state.onboarding = _ob3;
    chk(stageHtml.indexOf("onb-video-stage") !== -1 &&
        stageHtml.indexOf("background:" + (ONBOARDING_FILM_GROUNDS[lookNow] || "\u0000")) !== -1,
        "the rendered stage actually carries that ground",
        stageHtml.slice(0, 160));
  }

  // ── the render tool writes into the version being swept ───────────────────
  // Six tools read MB_VERSION and this one was missed when v4 was created, so
  // `--render` encoded four films into v3.1 -- the A/B CONTROL -- while v4's
  // sweep kept reporting "1 of 10 rendered". Every log line said "rendered";
  // they were simply in another version. Nothing else would ever have said so.
  // Against the DEFAULT version, not the one being swept -- sweeping the control
  // must not fail because the tool points at where work happens.
  if (typeof __FILM_TOOL_VERSION === "string" && typeof __DEFAULT_VERSION === "string") {
    chk(__FILM_TOOL_VERSION === __DEFAULT_VERSION,
        "tools/film/build-films.mjs renders into the version work happens in",
        "the tool defaults to " + __FILM_TOOL_VERSION + ", the tooling default is " +
        __DEFAULT_VERSION + "\n          a render would land in the wrong version " +
        "and every log line would still say \"rendered\"");
  }

  // ── ONB_FILM_ANY_LOOK: one render serves every theme ──────────────────────
  // v4 only. While a look is unrendered its themes used to drop to the SVG
  // engine, so the same onboarding step showed two different pieces of work
  // depending on a colour setting. The fallback plays whatever WAS rendered.
  //
  // Two things to hold, and the second is the one that rots quietly: a theme
  // with its own render must still get its OWN look. If the fallback ever wins
  // over an exact match, rendering the dark film would change nothing a dark
  // tester sees and nothing here would say so.
  if (typeof ONB_FILM_ANY_LOOK !== "undefined" && ONB_FILM_ANY_LOOK &&
      typeof THEMES !== "undefined" && Object.keys(mf.films).length) {
    // Restore unconditionally. Reading it into a local and putting it back only
    // "if it was set" leaves colorMode pinned to the last theme walked when the
    // app had none, which quietly re-themes every check that runs after this.
    var hadSettings = !!state.settings;
    var saved = hadSettings ? state.settings.colorMode : undefined;
    var noFilm = [], wrongLook = [];
    // The look each theme WOULD be served by if it had been rendered.
    var wants = mf.lookForTheme || {};
    THEMES.forEach(function (t) {
      state.settings = state.settings || {};
      state.settings.colorMode = t.id;
      onbFilmResetArt();
      var e = onbFilmEntry();
      if (!e) { noFilm.push(t.id); return; }
      // Own-look-wins: only assert it where that look actually has a render.
      var mine = wants[t.id];
      var rendered = Object.keys(mf.films).some(function (id) {
        return mf.films[id].look === mine;
      });
      if (rendered && e.look !== mine) wrongLook.push(t.id + ": got " + e.look + ", own is " + mine);
    });
    if (hadSettings) state.settings.colorMode = saved; else delete state.settings;
    onbFilmResetArt();

    chk(noFilm.length === 0, "every theme resolves to a rendered film",
        "still falling through to the SVG engine: " + noFilm.join(", "));
    chk(wrongLook.length === 0, "a theme with its own render still gets its own look",
        wrongLook.join("\n          "));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// v4 only — guarded so v3 and v3.1 skip the whole block.
if (typeof screenSlug !== "undefined") {
section("7d. One URL per screen — what a usability tracker can see");

// A Useberry round recorded the gate, the first onboarding screen, and nothing
// else: their tracker compares document.location.href on each DOM change, and
// pushState(snapshot, '') never moves it. These gates exist so that cannot come
// back silently — the failure mode is a study that runs, completes, and reports
// one screen.

// ── the slug is well-formed for every routed screen ────────────────────────
var badSlug = [];
SCREENS.forEach(function (id) {
  var sl = screenSlug(id);
  if (!sl || !/^[a-z0-9-]+$/.test(sl)) badSlug.push(id + " -> " + JSON.stringify(sl));
});
chk(badSlug.length === 0, "every routed screen yields a URL-safe slug",
    badSlug.slice(0, 6).join(", "));

// ── a stepped screen is several views, and they must not collide ───────────
// This is the whole point: onboarding is ONE screen id and seven pages to a
// tester. If these collapse, the flow report shows "onboarding" once and the
// six steps after it vanish — which is exactly the reported defect, one level in.
var views = [], savedScreen = state.screen;
state.screen = "onboarding";
state.onboarding = state.onboarding || {};
var savedOnbStep = state.onboarding.step;
for (var i = 0; i < ONB_STEPS.length; i++) { state.onboarding.step = i; views.push(screenSlug(scrollKey())); }
state.onboarding.step = savedOnbStep;

state.screen = "budgetBuild";
if (typeof bbSessionInit === "function") bbSessionInit();
for (var j = 0; j < BB_STEPS.length; j++) { state.budgetBuild.step = j; views.push(screenSlug(scrollKey())); }
state.budgetBuild = null;

state.screen = "helpMeOut";
["Transport", "Debt payments"].forEach(function (c) {
  ["ask", "confirm"].forEach(function (st) {
    state.helpMeOut = { category: c, stage: st };
    views.push(screenSlug(scrollKey()));
  });
});
state.helpMeOut = null;
state.screen = savedScreen;

var uniq = {}, dupes = [];
views.forEach(function (v) { if (uniq[v]) dupes.push(v); uniq[v] = true; });
chk(dupes.length === 0,
    "every step of a stepped screen is its own URL (" + views.length + " views)",
    "collapsed: " + dupes.join(", "));

// ── render() actually writes it ────────────────────────────────────────────
// The gates above test the module. THIS tests the wiring, and the wiring is
// what broke: a module that computes a perfect slug nobody calls is the same
// defect with extra steps.
if (typeof URL !== "undefined") {
  var _loc = location, _hist = history, _painted = lastPaintedScreen, _scr = state.screen;
  var _href = "https://example.github.io/versions/v4/index.html?PROLIFIC_PID=abc123";
  location = { get href() { return _href; }, set href(v) { _href = v; },
               protocol: "https:", pathname: "/versions/v4/index.html", replace: function () {} };
  history = { state: null,
              pushState: function (st) { this.state = st; },
              replaceState: function (st, t, u) {
                this.state = st;
                if (u) _href = new URL(u, "https://example.github.io").href;
              },
              back: function () {} };
  var painted = [];
  try {
    lastPaintedScreen = null;
    ["home", "aboutMe", "myProgress"].forEach(function (id) {
      state.screen = id; render(); painted.push(_href);
    });
  } catch (e) {
    painted = ["threw: " + e.message];
  }
  var got = _href;
  location = _loc; history = _hist; lastPaintedScreen = _painted; state.screen = _scr;

  var distinct = {}; painted.forEach(function (u) { distinct[u] = true; });
  chk(Object.keys(distinct).length === painted.length && painted.length === 3,
      "render() moves the URL when the view changes",
      painted.join("\n          "));
  chk(/PROLIFIC_PID=abc123/.test(got),
      "a query param we do not own survives the rewrite",
      "Useberry passes participant ids this way — losing it breaks a paid " +
      "Prolific round with nothing to signal it\n          got: " + got);
} else {
  warn("render()'s URL write not checked — no URL implementation in this engine");
}

// ── deep links ─────────────────────────────────────────────────────────────
var linkKeys = Object.keys(SCREEN_LINKS);
var notSlug = linkKeys.filter(function (k) { return screenSlug(k) !== k; });
chk(notSlug.length === 0, "every deep-link key is already a valid slug", notSlug.join(", "));

// Screens that need something chosen earlier must NOT be linkable: a cold link
// lands on the D19 placeholder, which is right for an admin jump and reads as
// broken to a tester who was sent there deliberately.
var mustNotLink = ["budget-category", "lesson", "help-me-out", "marketplace-detail", "lesson-quiz"];
var leaked = mustNotLink.filter(function (k) { return !!SCREEN_LINKS[k]; });
chk(leaked.length === 0, "context-dependent screens stay out of the allowlist", leaked.join(", "));

var linkTargets = linkKeys.map(function (k) { return SCREEN_LINKS[k]; });
chk(linkTargets.every(function (f) { return typeof f === "function"; }),
    "every deep-link entry is an opener function");

// ── the title carries a human name ─────────────────────────────────────────
var _t = state.screen;
var titles = {};
["home", "aboutMe", "learn", "myProgress"].forEach(function (id) {
  state.screen = id; titles[id] = screenTitle();
});
state.screen = _t;
var emptyTitle = Object.keys(titles).filter(function (k) {
  return !titles[k] || titles[k] === "MoneyBuddy — " + k;
});
chk(emptyTitle.length === 0,
    "every screen's <title> names it in words, not an id",
    emptyTitle.join(", ") + "\n          Useberry sends the title beside the URL — it is what a " +
    "researcher reads in the report");

// ── tracking is off unless somebody turned it on ───────────────────────────
// A WARNING, NOT A FAILURE. It started as a failure -- the point was that
// tracking must never land on by ACCIDENT -- but turning it on deliberately is
// a thing the owner does, and a build that cannot go green while a study is
// running is a check people learn to ignore. Loud every run, blocking never.
if (typeof USEBERRY_TRACKING !== "undefined" && USEBERRY_TRACKING) {
  warn("USEBERRY_TRACKING is ON \u2014 this build is being observed",
       "a third-party script loads on http/https; the one sanctioned exception\n" +
       "          to D02. Set it false in js/config.js AND gate/gate.js when the\n" +
       "          round is over. No app logic may depend on it.");
} else {
  ok("USEBERRY_TRACKING is off");
}
// Whatever the flag says, the tracker must stay inert on file:// -- there is no
// session behind it there and the fetch buys a console error and nothing else.
chk(typeof useberryActive === "function" && useberryActive() === false,
    "the tracker stays inert off http/https");

// ── the gate's copy agrees with the real flag ──────────────────────────────
// The gate cannot read USEBERRY_TRACKING (it never loads a version's scripts),
// so it keeps a duplicate. A build observed while the gate says it is not is
// the one outcome nobody could see from either file alone.
if (typeof __GATE_JS === "string" && typeof APP_VERSION !== "undefined") {
  var esc = APP_VERSION.replace(/\./g, "\\.");
  var row = new RegExp('id:\\s*"' + esc + '"[^}]*tracking:\\s*(true|false)');
  var m = __GATE_JS.match(row);
  chk(!!m, "the gate lists " + APP_VERSION + " with a tracking flag",
      "add tracking: true|false to its VERSIONS entry in gate/gate.js");
  if (m) {
    chk((m[1] === "true") === (USEBERRY_TRACKING === true),
        "the gate's tracking flag matches this build's",
        "gate says " + m[1] + ", js/config.js says " + USEBERRY_TRACKING);
  }
}
}

// ─────────────────────────────────────────────────────────────────────────────
// v4 only — Phase 2 of the tracking work.
if (typeof ubActionName !== "undefined") {
section("7e. What a tester clicked, and what they set");

// ── control names are derived, so they must survive the real handler shapes ──
// Sampled from the actual screen files. If the parser regresses, a click report
// full of "unnamed" is the symptom, and nothing else would report it.
var nameCases = [
  ["navBack()", "navBack"],
  ["goToCategory('Groceries')", "goToCategory:Groceries"],
  ["bbToggleHelp('Debt payments')", "bbToggleHelp:Debt-payments"],
  ["topbarToggleMenu();navAdminJump('settings')", "topbarToggleMenu+navAdminJump:settings"],
  ["state.onboarding.householdSize=2;render()", "householdSize=2"],
  ["render()", ""]
];
var nameBad = [];
nameCases.forEach(function (c) {
  var got = ubActionName(c[0]);
  if (got !== c[1]) nameBad.push(c[0] + " -> " + JSON.stringify(got) + " want " + JSON.stringify(c[1]));
});
chk(nameBad.length === 0, "handlers resolve to stable control names",
    nameBad.join("\n          "));

// A NAME THAT MOVES WITH THE VALUE IS A NEW CONTROL ON EVERY KEYSTROKE, which
// makes a heatmap a list of one-click entries. `this.value` must never land in
// one, in any of the shapes it is written in across the screens.
var valueShapes = [
  "bbSet('Groceries', this.value, true)",
  "hmoAdjust(this.value)",
  "state.preferences=this.value.split(',').map(x=>x.trim()).filter(Boolean);render()",
  "state.rememberDailyChoice=this.checked;render()"
];
var leaked = valueShapes.filter(function (h) { return /this[-.]?value|this[-.]?checked/i.test(ubActionName(h)); });
chk(leaked.length === 0, "a tester's input never enters a control's name",
    leaked.map(function (h) { return h + " -> " + ubActionName(h); }).join("\n          "));

// ── the stamping pass is actually wired into render() ───────────────────────
// The parser above can be perfect and the reports still empty if nothing calls
// it. That is the failure Phase 1 was, repeated one layer in.
var stamped = 0, _origStamp = ubStampControls;
try {
  ubStampControls = function () { stamped++; return 0; };
  render();
} catch (e) {
} finally { ubStampControls = _origStamp; }
chk(stamped > 0, "render() names the controls it just painted",
    "js/ub-names.js computes names nothing asks for");

// ── the value trail ─────────────────────────────────────────────────────────
if (typeof ubTrailRecord === "function") {
  // Category keys are derived from the category name, so a thirteenth category
  // could silently share a key with an existing one and merge two lines in a
  // report. Cheap to assert, invisible otherwise.
  var tkeys = CATEGORIES.map(ubTrailCatKey), tseen = {}, tdupe = [];
  tkeys.forEach(function (k) { if (tseen[k]) tdupe.push(k); tseen[k] = true; });
  chk(tdupe.length === 0, "every category has its own trail key",
      "collides: " + tdupe.join(", ") + "\n          keys: " + tkeys.join(","));

  // ⚠ THE ONE THAT MATTERS. The trail travels in a URL a third party records
  // and a researcher reads. Testers type their name in onboarding and prose in
  // the Money Journal; Useberry's own policy is that testers stay pseudonymous.
  ubTrailReset();
  var pii = [];
  if (ubTrailRecord("name", "A Real Person") !== false) pii.push("name");
  if (ubTrailRecord("note", "spent too much on coffee") !== false) pii.push("note");
  if (ubTrailRecord("text", "free typing") !== false) pii.push("text");
  chk(pii.length === 0, "free text cannot reach the trail",
      "accepted: " + pii.join(", ") +
      "\n          only numbers, plus strings under a key declared in UB_TRAIL_ENUMS");
  chk(ubTrailRecord("zip", 95054) === true && ubTrailRecord("goal", "Build savings") === true,
      "...while numbers and declared enums still record");

  // A slider on oninput fires per pixel. Keeping every tick would fill the URL
  // ceiling with one category; what a researcher wants is where it came to rest.
  ubTrailReset();
  ubTrailBudget("Groceries", 500);
  ubTrailBudget("Groceries", 640);
  ubTrailHelped("Groceries", 585);
  var prev = ubTrailPreview();
  chk(/gro-640/.test(prev) && !/gro-500/.test(prev),
      "a drag records where it came to rest, not every tick", prev);
  chk(/groH-585/.test(prev),
      "a Help-me-out figure keeps its own key beside the tester's guess",
      "guessed-vs-computed is the comparison the trail exists for\n          " + prev);

  // The whole budget has to fit, with room to spare under the ~2000 ceiling.
  ubTrailReset();
  CATEGORIES.forEach(function (c) { ubTrailBudget(c, 9999); });
  CATEGORIES.forEach(function (c) { ubTrailHelped(c, 9999); });
  var full = ubTrailEncode("budget");
  chk(full.length < 1000, "a full budget encodes well inside the URL ceiling",
      full.length + " chars");
  chk(/^[A-Za-z0-9._-]+$/.test(full),
      "every character survives form encoding unescaped", full.slice(0, 80));

  // A reset has to clear it. The trail is user-entered data that LEAVES the
  // browser in a URL, so one tester's figures surviving into the next session
  // on a shared machine is a leak, not untidiness.
  ubTrailBudget("Housing", 4321);
  if (typeof resetUserData === "function") resetUserData();
  chk(ubTrailPreview().indexOf("hou-4321") === -1,
      "resetUserData() clears the value trail",
      "left behind: " + ubTrailPreview());
  ubTrailReset();
}
}

// ─────────────────────────────────────────────────────────────────────────────
// v4 only — the buddy creator's body-type step and its breed search.
if (typeof BUDDY_BODY_TYPES !== "undefined" && typeof breedMatch === "function") {
section("7f. Body type and breed search");

var bodyIds = BUDDY_BODY_TYPES.map(function (t) { return t.id; });
chk(BUDDY_BODY_TYPES.length === 9 &&
    Object.keys(bodyIds.reduce(function (a, i) { a[i] = 1; return a; }, {})).length === 9,
    "nine body types with distinct ids", bodyIds.join(", "));

// The eight unbuilt types are told apart by circle size ALONE. Two the same is
// two tiles a tester cannot choose between for any reason they can see.
var dots = BUDDY_BODY_TYPES.map(function (t) { return t.dot; });
chk(Object.keys(dots.reduce(function (a, d) { a[d] = 1; return a; }, {})).length === dots.length,
    "every placeholder circle is a different size", dots.join(", "));

// The creator is one screen now (meet). The grid below is DORMANT, not
// gone -- its branch still renders, and these gates keep it working for the day
// "bodyType" goes back into the list.
chk(ONB_BUDDY_STEPS.join(",") === "meet",
    "the buddy step is one screen",
    ONB_BUDDY_STEPS.join(", "));

// ── ⚠ `breed` MUST NEVER HOLD A BODY-TYPE ID ─────────────────────────────
// Not because the portrait would blank -- buddyIsPrototype() is an indexOf, so
// it stays true while any other attribute is prototype, and an earlier version
// of this gate asserted that consequence and caught nothing. The real damage is
// quieter: renderBuddyDescription() prints `breed` as the breed name, the admin
// dropdown offers BUDDY_BREEDS which contains no body-type id, and onbSetBuddy's
// cascade fires on `breed` and would fill in five attributes nobody picked.
var _ob = state.onboarding, _b = state.buddy;
if (typeof onbStart === "function") onbStart();
var protoBefore = buddyIsPrototype();
onbSetBuddy("bodyType", "mastiff");
var stillProto = buddyIsPrototype();
var breedKept = state.buddy.bodyType === "mastiff" && state.buddy.breed === BUDDY_PROTOTYPE;
// PAINT IT TOO. Checking only the setter missed a write added at render time --
// the step drew itself and the portrait went with it, with every assertion
// above still green.
var _scr = state.screen, _step = state.onboarding.step;
var stageAfterPaint = "", breedAfterPaint = "";
try {
  state.screen = "onboarding";
  state.onboarding.step = ONB_STEPS.indexOf("buddy");
  state.onboarding.buddyIndex = 0;
  renderScreen();
  stageAfterPaint = renderBuddyInner();
  breedAfterPaint = state.buddy.breed;
} catch (e) { stageAfterPaint = "threw: " + e.message; breedAfterPaint = "threw"; }
state.screen = _scr; state.onboarding.step = _step;
state.onboarding = _ob; state.buddy = _b;
// `prototype` is legitimately BOTH a body type and a breed value, so the
// forbidden set is the other eight.
var bodyOnlyIds = bodyIds.filter(function (i) { return i !== BUDDY_PROTOTYPE; });
chk(protoBefore && stillProto && breedKept &&
    bodyOnlyIds.indexOf(breedAfterPaint) === -1 &&
    stageAfterPaint.indexOf("buddy-img") !== -1,
    "a body-type pick never reaches `breed`, through a repaint",
    "breed after painting the step: " + breedAfterPaint);

// ── the data ──────────────────────────────────────────────────────────────
var rows = breedRows();
var noBody = rows.filter(function (r) { return breedBodies(r).length === 0; });
chk(noBody.length === 0, rows.length + " breeds all resolve to a body type",
    noBody.slice(0, 5).map(function (r) { return r.name; }).join(", "));

var badBody = rows.filter(function (r) {
  return breedBodies(r).some(function (b) { return bodyIds.indexOf(b) === -1; });
});
chk(badBody.length === 0, "every breed maps onto a real body type",
    badBody.slice(0, 5).map(function (r) { return r.name + " -> " + breedBodies(r); }).join(", "));

// Two breeds claiming one alias is a silent wrong answer: the tester types it,
// gets a filter, and never learns it was the other dog's.
var termSeen = {}, termDupe = [];
rows.forEach(function (r) {
  [r.name].concat(r.aliases || []).forEach(function (t) {
    var k = breedNormalize(t);
    if (termSeen[k] && termSeen[k] !== r.name) termDupe.push(k + ": " + termSeen[k] + " / " + r.name);
    termSeen[k] = r.name;
  });
});
chk(termDupe.length === 0,
    Object.keys(termSeen).length + " search terms across " + rows.length + " breeds, none shared",
    termDupe.slice(0, 4).join("\n          "));

// The crosses table is written by hand in the JSON and is the one place a GROUP
// name can be typed where a body-type id belongs. It happened once already.
var crossBad = [];
var crosses = (DOG_BREEDS && DOG_BREEDS.crosses) || {};
Object.keys(crosses).forEach(function (k) {
  k.split("+").concat(crosses[k]).forEach(function (x) {
    if (bodyIds.indexOf(x) === -1) crossBad.push(k + " -> " + x);
  });
});
chk(crossBad.length === 0, "the crosses table names only real body types",
    crossBad.join(", "));

// ── matching ──────────────────────────────────────────────────────────────
var searchCases = [
  ["yorkshire terrier",            ["toy"]],
  ["half husky half corgi",        ["spitz", "low_set"]],
  ["husky x corgi",                ["spitz", "low_set"]],
  ["pitbull golden retriever mix", ["mastiff", "sporting"]],
  ["labradoodle",                  ["sporting"]],
  ["blue heeler",                  ["herding"]],
  ["bernese mountain dog puppy",   ["mastiff"]]
];
var searchBad = [];
searchCases.forEach(function (c) {
  var got = breedMatch(c[0]).bodies.slice().sort().join(",");
  var want = c[1].slice().sort().join(",");
  if (got !== want) searchBad.push(c[0] + " -> [" + got + "] want [" + want + "]");
});
chk(searchBad.length === 0, "the worked breed queries resolve",
    searchBad.join("\n          "));

// COMPARING BODY TYPES ALONE CANNOT SEE OVER-MATCHING. "blue heeler" naming both
// the Cattle Dog and the Blue Lacy looks identical in the filter -- they are
// both herding -- while the match line under the search box lists a breed the
// tester did not type. These assert the BREEDS, which is the half that shows.
var exact = [
  ["blue heeler", 1],                 // not also the Blue Lacy, on the word "blue"
  ["german shepard", 1],              // not also the Boxer, on the word "german"
  ["bernese mountain dog puppy", 1],  // not also the Mountain Cur, on "mountain"
  ["half husky half corgi", 2],
  ["pitbull golden retriever mix", 2]
];
var exactBad = [];
exact.forEach(function (c) {
  var names = breedMatch(c[0]).breeds;
  if (names.length !== c[1]) exactBad.push(c[0] + " -> " + names.length + " (" + names.join(", ") + "), want " + c[1]);
});
chk(exactBad.length === 0, "a query names the breeds it says and no others",
    exactBad.join("\n          "));

// Nonsense must not match. A bare substring test let "asdfgh" hit the
// Australian Shepherd, because the alias "asd" sits inside it -- with ~1,100
// terms, three-letter aliases turn any typo into a confident wrong answer.
var junkBad = ["asdfgh", "zzzzz", "qqqq", "12345"].filter(function (q) {
  return breedMatch(q).breeds.length > 0;
});
chk(junkBad.length === 0, "nonsense matches nothing",
    junkBad.map(function (q) { return q + " -> " + breedMatch(q).breeds.join(", "); }).join(", "));

// D19 -- and the failure is worse than a blank screen here: a tester whose
// breed is not listed would conclude the app has no shape for their dog.
var emptyGrid = ["", "asdfgh", "mutt", "no idea"].filter(function (q) {
  return breedVisibleBodies(q).length !== 9;
});
chk(emptyGrid.length === 0, "an empty, generic or unmatched search shows all nine",
    emptyGrid.join(", "));

// The prototype is the only tile with art behind it, so a filter must never
// take it away -- a tester has to be able to pick the buddy that exists.
var lostProto = ["yorkshire terrier", "great dane", "labradoodle"].filter(function (q) {
  return breedVisibleBodies(q).indexOf(BUDDY_PROTOTYPE) === -1;
});
chk(lostProto.length === 0, "the prototype survives every filter", lostProto.join(", "));

// ── the top bar, and the 52px it was sitting on ───────────────────────────
// Onboarding has Back in its own footer and Skip in its own header, so the bare
// bar's chevron was a third escape. Hiding it is half the fix; the other half is
// that `.screen-scroll.journal-mode` re-reserved the bar's height, and both it
// and `.no-topbar` are (0,2,0) so the later declaration won -- leaving a 52px
// empty strip where the bar had been.
if (typeof TOPBAR_HIDDEN_SCREENS !== "undefined") {
  var _s0 = state.screen;
  state.screen = "onboarding";
  var bar = renderTopBar();
  state.screen = _s0;
  chk(TOPBAR_HIDDEN_SCREENS.indexOf("onboarding") !== -1 && bar === "",
      "onboarding renders no top bar", "got: " + JSON.stringify(bar).slice(0, 60));

  // THE CSS RULE THAT RECLAIMS THE SPACE IS SCOPED TO BOTH CLASSES, so it is
  // only correct while onboarding is the only screen that is journal-mode AND
  // bar-less. A screen joining both lists would silently take the strip back.
  if (typeof __RENDER_JS === "string" && typeof __COMPONENTS_CSS === "string") {
    var jm = [];
    var re = /classList\.toggle\("journal-mode",\s*([\s\S]*?)\);/g, m;
    while ((m = re.exec(__RENDER_JS)) !== null) {
      var lit = /\[([^\]]*)\]/.exec(m[1]);
      if (lit) {
        lit[1].split(",").forEach(function (x) {
          var v = x.trim().replace(/^["']|["']$/g, "");
          if (v) jm.push(v);
        });
      } else {
        var one = /state\.screen === "([^"]+)"/.exec(m[1]);
        if (one) jm.push(one[1]);
      }
    }
    var both = jm.filter(function (id) { return TOPBAR_HIDDEN_SCREENS.indexOf(id) !== -1; });
    chk(jm.length > 0 && both.length === 1 && both[0] === "onboarding",
        "onboarding is the only journal-mode screen without a top bar",
        "also both: " + both.join(", ") +
        "\n          .screen-scroll.journal-mode.no-topbar would zero their offset too");
  }
}

// ── search mode ───────────────────────────────────────────────────────────
if (typeof onbBodySearchOpen === "function") {
  var _o3 = state.onboarding;
  if (typeof onbStart === "function") onbStart();
  var ctl2 = onbBodyTypeControl(state.onboarding);
  chk(ctl2.indexOf('onfocus="onbBodySearchOpen()"') !== -1 &&
      ctl2.indexOf('onkeydown="onbBodySearchKey(') !== -1,
      "focusing the search opens search mode, and Enter closes it");

  // ⚠ NEITHER TRANSITION MAY RE-RENDER. render() reassigns the screen's
  // innerHTML: it would destroy the focused input, drop the caret and close the
  // keyboard -- a focus handler that re-rendered would shut the mode it opened.
  var renders = 0, _origRender = render;
  try {
    render = function () { renders++; };
    onbBodySearchOpen();
    onbBodySearchKey({ key: "Enter", preventDefault: function () {} });
  } catch (e) {
  } finally { render = _origRender; }
  chk(renders === 0, "entering and leaving search mode never calls render()",
      "called it " + renders + " time(s)");

  // The filter is state and must survive the repaint a tile pick causes -- a
  // grid that silently refilled would undo the tester's work behind their back.
  state.onboarding.bodySearch = "husky corgi";
  onbSetBuddy("bodyType", "spitz");
  chk(state.onboarding && state.onboarding.bodySearch === "husky corgi",
      "the filter survives picking a tile",
      "bodySearch after: " + (state.onboarding && state.onboarding.bodySearch));
  state.onboarding = _o3;
}

// ── the grid's row maths ──────────────────────────────────────────────────
// "2.5 rows" was measured off the tile's WIDTH and forgot the label under it,
// so it was really 2.3 and the third row's labels were sliced mid-word.
if (typeof __COMPONENTS_CSS === "string") {
  var gridRule = /\.buddy-body-grid\s*\{([\s\S]*?)\}/.exec(__COMPONENTS_CSS);
  var body = gridRule ? gridRule[1] : "";
  var rowDecl = /--tile-row:([^;]*);/.exec(body);
  var rowVal = rowDecl ? rowDecl[1] : "";
  chk(rowVal.indexOf("--tile-w") !== -1 && rowVal.indexOf("--tile-label") !== -1 &&
      /max-height:\s*calc\(var\(--tile-row\)/.test(body),
      "a grid row is measured as square + gap + label, not the square alone",
      "so 2.5 rows means 2.5 rows");
}

// ── the search box must not re-render ─────────────────────────────────────
// render() reassigns the screen's innerHTML and takes the caret with it. The
// filter patches its two fragments instead (uiPatchHTML). An onchange here
// would mean the grid only moved on blur.
if (typeof onbBodyTypeControl === "function") {
  var _o2 = state.onboarding;
  if (typeof onbStart === "function") onbStart();
  var ctl = onbBodyTypeControl(state.onboarding);
  state.onboarding = _o2;
  chk(ctl.indexOf('oninput="onbBodySearch') !== -1 && ctl.indexOf("onchange=") === -1,
      "the search filters on input, never on a full re-render");
  chk(ctl.indexOf('id="onbBodyGrid"') !== -1 && ctl.indexOf('id="onbBodyMatch"') !== -1,
      "both patch targets carry their ids",
      "uiPatchHTML looks them up by id -- rename one and typing silently stops filtering");
}
}

// ─────────────────────────────────────────────────────────────────────────────
// v4 only — the buddy step is one screen: art, greeting, name, pronouns.
if (typeof BUDDY_PRONOUNS !== "undefined" && typeof onbSetStep === "function") {
section("7h. Meet your buddy — one screen");

var _o7 = state.onboarding, _b7 = state.buddy, _s7 = state.screen;
var buddyStep = ONB_STEPS.indexOf("buddy");

/** Paint the onboarding screen for real and hand back its markup. */
function paintOnb() {
  state.screen = "onboarding";
  return renderOnboarding();
}

onbStart();
onbSetStep(state.onboarding, buddyStep);
var meetHtml = paintOnb();
var stageAt = meetHtml.indexOf("onb-buddy-stage"), titleAt = meetHtml.indexOf("Meet your buddy!");
var nameAt = meetHtml.indexOf("onbLiveInput('buddyName'"), proAt = meetHtml.indexOf("onbSetBuddy('pronouns'");
chk(stageAt !== -1 && stageAt < titleAt && titleAt < nameAt && nameAt < proAt,
    "one screen: the buddy, then the greeting, then name and pronouns",
    "stage " + stageAt + ", title " + titleAt + ", name " + nameAt + ", pronouns " + proAt);

// Every step says Continue -- the buddy step included (owner's call).
var notContinue = [];
ONB_STEPS.forEach(function (k, i) {
  var o = state.onboarding; o.step = i; o.buddyIndex = 0;
  if (onbContinueLabel(k, o) !== "Continue") notContinue.push(k);
});
onbSetStep(state.onboarding, buddyStep);
chk(notContinue.length === 0 && /id="onbContinue"[^>]*>\s*Continue\s*</.test(meetHtml),
    "every step's button says Continue", notContinue.join(", "));

// ── pronouns are required ─────────────────────────────────────────────────
var o7 = state.onboarding;
o7.buddy.name = "Buddy"; o7.buddy.pronouns = "";
var blankPro = onbAnswered("buddy", o7);
o7.buddy.name = "  "; o7.buddy.pronouns = "they";
var blankName = onbAnswered("buddy", o7);
o7.buddy.name = "Buddy";
var both = onbAnswered("buddy", o7);
chk(!blankPro && !blankName && both,
    "Continue needs a name AND pronouns",
    "blank pronouns " + blankPro + ", blank name " + blankName + ", both " + both);

o7.buddy.pronouns = ""; state.buddy.pronouns = "";
var html7 = paintOnb();
var sel = /<select[^>]*onbSetBuddy\('pronouns'[\s\S]*?<\/select>/.exec(html7);
var opts = sel ? sel[0].match(/<option /g) || [] : [];
chk(!!sel && opts.length === 1 + BUDDY_PRONOUNS.length &&
    /<option value=""\s+selected>/.test(sel[0]) &&
    /He\/Him[\s\S]*She\/Her[\s\S]*They\/Them/.test(sel[0]),
    "the pronouns dropdown opens on a blank value, over He/Him, She/Her and They/Them",
    sel ? opts.length + " options" : "no pronouns select on the buddy screen");
chk(/id="onbContinue"[^>]*disabled/.test(html7),
    "Continue is disabled until pronouns are picked");

// ── "Buddy" on arrival, by every way in ───────────────────────────────────
// Written on ENTERING the step, never in onbStart() (js/profiles.js names the
// buddy from a profile only while the name is empty). Five ways in; a default
// that only some of them write is a box that is blank for no visible reason.
function arrive(how) {
  onbStart();
  var o = state.onboarding;
  try {
    if (how === "continue") { o.step = buddyStep - 1; onbNext(); }
    else if (how === "skip") { o.step = buddyStep - 1; onbSkip(); }
    else if (how === "back") { o.step = buddyStep + 1; onbBack(); }
    else if (how === "admin") {
      o.step = 0;
      var adm = renderOnboardingAdmin();
      var m = /<select onchange="([^"]*onbSetStep[^"]*)"/.exec(adm);
      if (!m) return "no admin step select";
      // Direct eval, so the handler sees top-level `state` the way a browser's
      // inline handler does (new Function would not -- const is not a global).
      eval(m[1].replace(/this\.value/g, JSON.stringify(String(buddyStep))));
    }
  } catch (e) { return "threw: " + e.message; }
  o = state.onboarding;
  return o.step === buddyStep ? o.buddy.name : "landed on step " + o.step;
}
var nameAtStart = (onbStart(), state.onboarding.buddy.name);
var arrivals = ["continue", "skip", "back", "admin"].map(function (w) { return w + "=" + arrive(w); });
chk(nameAtStart === "" && arrivals.every(function (a) { return /=Buddy$/.test(a); }),
    "onbStart leaves the name empty; every way into the step fills in \"Buddy\"",
    "at start " + JSON.stringify(nameAtStart) + "; " + arrivals.join(", "));

onbStart(); onbSetStep(state.onboarding, buddyStep);
state.onboarding.buddy.name = "Rex"; state.buddy.name = "Rex";
onbNext(); onbBack();
chk(state.onboarding.step === buddyStep && state.onboarding.buddy.name === "Rex",
    "a typed name survives going on and coming back",
    "got " + JSON.stringify(state.onboarding.buddy.name));

// ── one URL, and the deep link arrives too ────────────────────────────────
if (typeof URL !== "undefined") {
  var _loc7 = location, _hist7 = history, _painted7 = lastPaintedScreen;
  var _href7 = "https://example.github.io/versions/v4/index.html";
  location = { get href() { return _href7; }, set href(v) { _href7 = v; },
               protocol: "https:", pathname: "/versions/v4/index.html", replace: function () {} };
  history = { state: null, pushState: function (st) { this.state = st; },
              replaceState: function (st, t, u) {
                this.state = st;
                if (u) _href7 = new URL(u, "https://example.github.io").href;
              },
              back: function () {} };
  var stepUrl = "", links = [];
  try {
    lastPaintedScreen = null;
    onbStart(); state.screen = "onboarding";
    onbSetStep(state.onboarding, buddyStep);
    render(); stepUrl = _href7;

    // Cold, from a link -- and the retired "-name" link lands on the step too.
    ["", "-name"].forEach(function (suffix) {
      onbStart();
      _href7 = "https://example.github.io/versions/v4/index.html?screen=onboarding-" +
               buddyStep + suffix;
      var _nav7 = JSON.stringify(state.nav);
      screenLinkApply();
      links.push(suffix + ":" + state.onboarding.step + ":" + state.onboarding.buddy.name);
      state.nav = JSON.parse(_nav7);
    });
  } catch (e) { stepUrl = "threw: " + e.message; }
  location = _loc7; history = _hist7; lastPaintedScreen = _painted7;

  chk(new RegExp("[?&]screen=onboarding-" + buddyStep + "(?:&|#|$)").test(stepUrl),
      "the buddy step is one URL, ?screen=onboarding-" + buddyStep, stepUrl);
  chk(links.join(",") === ":" + buddyStep + ":Buddy,-name:" + buddyStep + ":Buddy",
      "the deep link opens the step with \"Buddy\" filled in, and the old -name link still lands",
      links.join(", "));
} else {
  warn("the buddy step's URL not checked — no URL implementation in this engine");
}

// ── the value trail, through onbFinish ────────────────────────────────────
var snap7 = null;
try { snap7 = JSON.stringify(state); } catch (e) {}
if (snap7 && typeof onbFinish === "function") {
  function finishWith(pro) {
    ubTrailReset();
    onbStart();
    state.onboarding.buddy.pronouns = pro; state.buddy.pronouns = pro;
    var trail = "";
    try { onbFinish(); trail = ubTrailEncode("setup") || ""; }
    catch (e) { trail = "threw: " + e.message; }
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.assign(state, JSON.parse(snap7));
    ubTrailReset();
    return trail;
  }
  var withPro = finishWith("they"), withoutPro = finishWith("");
  chk(/(^|[.=])pro-they(\.|$)/.test(withPro) && !/(^|[.=])pro-/.test(withoutPro),
      "the setup trail records the pronouns, and nothing when they were skipped",
      "picked: " + withPro + "\n          skipped: " + withoutPro);
} else {
  warn("the pronoun trail not checked — state would not snapshot");
}

// ── the boxes: the app's tokens, no native chrome ─────────────────────────
// The owner saw these two boxes as harsher than the Name/ZIP boxes. Computed
// colours were identical, so the difference is what the browser draws on its
// own -- the native <select>. appearance:none removes it; the colours must stay
// the shared tokens, never a hardcoded hex.
if (typeof __COMPONENTS_CSS === "string") {
  var fieldRules = __COMPONENTS_CSS.match(/[^{}]*\.onb-buddy-fields[^{}]*\{[^}]*\}/g) || [];
  var selRule = fieldRules.filter(function (r) { return /select\s*\{/.test(r); })
                          .map(function (r) { return r; }).join("\n");
  var hex = fieldRules.filter(function (r) { return /#[0-9a-fA-F]{3,6}\b/.test(r.split("{")[1]); });
  chk(/appearance:\s*none/.test(selRule) && hex.length === 0 &&
      /text-align:\s*center/.test(fieldRules.join("")),
      "the buddy boxes are centred, drop the native select chrome, and use theme tokens",
      hex.length ? "hardcoded colour in: " + hex[0].trim().split("{")[0] : "");
}

// ── one buddy, one picture ────────────────────────────────────────────────
// Home drew a text card ("golden retriever · cream fur") for any buddy that was
// not in prototype mode -- the persona, a profile, SKIP_ONBOARDING.
if (typeof BUDDY_SINGLE_ART !== "undefined") {
  state.buddy = Object.assign({}, PERSONA.buddy, { breed: "golden_retriever",
    furColor: "cream", furPattern: "solid", eyeColor: "brown", noseColor: "black", size: "medium" });
  var nonProto = !buddyIsPrototype();
  var homeStage = "";
  try { state.screen = "home"; homeStage = renderScreen() || ""; } catch (e) { homeStage = "threw: " + e.message; }
  var inner = renderBuddyInner();
  chk(nonProto && (BUDDY_SINGLE_ART
        ? /buddy-img/.test(inner) && /buddy-img/.test(homeStage) && !/buddy-desc/.test(homeStage)
        : /buddy-desc/.test(inner)),
      BUDDY_SINGLE_ART
        ? "a non-prototype buddy still gets the one illustration, on Home too"
        : "BUDDY_SINGLE_ART is off and the attribute-driven stage is back",
      "stage: " + inner.replace(/\s+/g, " ").slice(0, 90));

  // The missing-file fallback must survive the flag: words, never a blank stage.
  var broken = "";
  try { buddyImgBroken = true; broken = renderBuddyInner(); }
  finally { buddyResetArt(); }
  chk(/buddy-desc/.test(broken) && !/buddy-img/.test(broken),
      "a missing image still falls back to the description card");
}

state.onboarding = _o7; state.buddy = _b7; state.screen = _s7;
}

// ─────────────────────────────────────────────────────────────────────────────
// v4 only — the Budget tab is a paywall (plan.md §0 L27, overriding D31).
if (typeof BUDGET_PAYWALL !== "undefined") {
section("7g. The Budget tab is walled");

var _sc = state.screen, _ps = state.planStatus, _ta = state.trialAccepted;
state.planStatus = "complete";          // the hardest case: a budget EXISTS
var walled = renderBudgetV3();

// BOTH WAYS, because the flag's whole promise is that flipping it unwinds
// nothing. Asserting it is on would make the escape hatch fail the build, which
// is how a flag quietly stops being flippable.
if (BUDGET_PAYWALL) {
  chk(/Platinum/.test(walled), "the Budget tab renders the wall");
} else {
  chk(!/Platinum/.test(walled) && /Rebuild/.test(walled),
      "BUDGET_PAYWALL is off and the real Budget tab is back");
}

// ── ⚠ NOTHING BEHIND THE WALL MAY LEAK THROUGH IT ─────────────────────────
// A wall that still prints the tester's own figures is worse than no wall: it
// shows them exactly what they are being denied, and it would pass every check
// that only asked "does the wall render".
var leakedCats = BUDGET_PAYWALL
  ? CATEGORIES.filter(function (c) { return walled.indexOf(c) !== -1; }) : [];
chk(leakedCats.length === 0, "no category name reaches the walled tab",
    leakedCats.slice(0, 5).join(", "));

var figures = CATEGORIES.map(function (c) { return String(catValue(state.plan, c)); })
                        .filter(function (v) { return v && v.length >= 3; });
var leakedFigs = BUDGET_PAYWALL
  ? figures.filter(function (v) { return walled.indexOf(v) !== -1; }) : [];
chk(leakedFigs.length === 0, "no planned figure reaches it either",
    leakedFigs.slice(0, 5).join(", "));

chk(!BUDGET_PAYWALL || !/Planned|Left over|Built with/.test(walled),
    "and none of the plan-vs-actual readout");

// ── the CTA records a tap and changes nothing ─────────────────────────────
// Strict, by owner's call: there is no route through. So it must not quietly
// become one -- state.trialAccepted still means diamonds and the reward
// screen's subscriber tier, and this screen has no business touching it.
if (typeof budgetPaywallTap === "function") {
  var beforeTap = JSON.stringify([state.trialAccepted, state.screen, state.planStatus]);
  try { budgetPaywallTap(); } catch (e) {}
  chk(JSON.stringify([state.trialAccepted, state.screen, state.planStatus]) === beforeTap,
      "the CTA writes nothing and goes nowhere",
      "it must not set trialAccepted, navigate, or unlock");
}

// ── no rendered copy still promises the opposite ──────────────────────────
// D31's old line -- "Nothing is locked either way, this prototype has no paid
// features" -- was copy a TESTER READS. Checked against rendered markup rather
// than source, so a comment explaining why the line was removed does not trip
// it.
var promises = [];
destinations.forEach(function (d) {
  state.screen = d[0];
  var html = "";
  try { html = renderScreen(); } catch (e) { return; }
  if (/no paid features|[Nn]othing is locked|no paywalls/.test(html)) promises.push(d[0]);
});
// THE TRIAL STEP IS DORMANT, NOT GONE. "trial" came out of ONB_STEPS in v3.1
// and putting it back is a one-word edit, so renderScreen() never reaches it
// and walking the screens cannot see its copy. Render the step directly, or the
// sentence that contradicts the whole paywall sits there waiting to return.
if (typeof onbStepBody === "function") {
  var _ob4 = state.onboarding;
  try {
    if (typeof onbStart === "function") onbStart();
    var trialHtml = onbStepBody("trial", state.onboarding);
    if (/no paid features|[Nn]othing is locked/.test(trialHtml)) promises.push("onboarding/trial");
  } catch (e) {}
  state.onboarding = _ob4;
}

state.screen = _sc; state.planStatus = _ps; state.trialAccepted = _ta;
chk(promises.length === 0,
    "no screen still tells a tester nothing is locked",
    "contradicted on: " + promises.join(", ") +
    "\n          the trial step is dormant, not deleted -- putting \"trial\" back " +
    "into ONB_STEPS is a one-word edit");

// The flag is the only switch, and the admin says which way it is set --
// a walled build that looks identical to an open one in the panel is a tester
// session nobody can interpret afterwards.
chk(!BUDGET_PAYWALL || /PAYWALL/i.test((function () {
      var k = state.screen; state.screen = "aboutMe";
      var sub = adminSubtitle(); state.screen = k; return sub;
    })()),
    "the admin subtitle says the tab is walled");
}

// ─────────────────────────────────────────────────────────────────────────────
section("8. Cannot be checked here — needs the owner");
print("  These are real Phase 6 items that no headless check can settle:");
print("");
print("    · Mobile viewport at 390px — layout, wrapping, no horizontal scroll");
print("    · Keyboard focus visibly moving through every interactive element");
print("    · Tap targets genuinely >= 44px as rendered (CSS declares it; only a");
print("      browser measures it)");
print("    · prefers-reduced-motion actually stilling the buddy idle and the");
print("      daily-update sequence");
print("    · Narration audio lining up with the visuals it is cued to");
print("    · Whether the repaint reads as 'not a bank'");
print("    · The four themes side by side (L21). The contract and contrast are");
print("      checked above, but not whether Light/Dark actually LOOK like v2,");
print("      nor whether the frame and admin panel hold still while switching");

// ─────────────────────────────────────────────────────────────────────────────
print("");
print("═══════════════════════════════════════════════════════════════");
print("  " + CHECKS + " checks · " + FAIL + " failed · " + WARN + " warnings");
print("═══════════════════════════════════════════════════════════════");
if (FAIL) throw new Error(FAIL + " sweep checks failed");
