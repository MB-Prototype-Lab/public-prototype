// ─── Version Gate (passcode + selector) ───────────────────────────────────────
// Standalone script for the repo-root landing page. Deliberately NOT part of
// any version's app — the versions under versions/*/ each load their own set
// of <script> tags into one shared global namespace (state, render(), go(),
// etc. per the root CLAUDE.md's Architecture conventions), so this page must never load
// two versions' scripts together. Picking a version is a real page navigation
// (location.href), so each version boots fresh in its own document.
//
// The passcode is a speed bump against a shared link getting forwarded
// thoughtlessly — not real security. It's plaintext on purpose.

var GATE_PASSCODE = "1337";
var GATE_SESSION_KEY = "mb_gate_unlocked";

// Add a version here (and only here) to make it selectable — no markup changes.
// v3 and v3.1 are an A/B PAIR, not a progression. v3.1 started as a byte copy
// of v3 and the differences between them are the thing being tested, so the
// labels say which is which rather than implying one supersedes the other.
// v4 is a byte copy of v3.1 and is a separate, independent version — not a
// third arm of that test. It is where new work happens, so it sits last and
// says so; the pair stays labelled as a pair.
//
// `tracking` says whether that version loads a usability tracker. It is a COPY
// of USEBERRY_TRACKING in that version's js/config.js, and the duplication is
// forced rather than lazy: this page deliberately never loads a version's
// scripts (two versions' globals in one document would collide), so it cannot
// read the real value. scripts/sweep.js asserts the two agree, so a build can
// never be observed while the gate says it is not.
var VERSIONS = [
  { id: "v1", label: "v1", path: "versions/v1/index.html", tracking: false },
  { id: "v2", label: "v2 (beta)", path: "versions/v2/index.html", tracking: false },
  { id: "v3", label: "v3 (A)", path: "versions/v3/index.html", tracking: false },
  { id: "v3.1", label: "v3.1 (B)", path: "versions/v3.1/index.html", tracking: false },
  { id: "v4", label: "v4 (current)", path: "versions/v4/index.html", tracking: false }
];

function gateShowSelector() {
  document.getElementById("passcodeScreen").style.display = "none";
  var selector = document.getElementById("selectorScreen");
  selector.style.display = "flex";
  var buttons = VERSIONS.map(function (v) {
    // A tester cannot turn tracking off, so the least we do is say it is on.
    var badge = v.tracking
      ? '<span class="gate-badge">recording</span>'
      : "";
    return '<button type="button" class="gate-btn" onclick="location.href=\'' + v.path + '\'">' +
           v.label + badge + "</button>";
  }).join("");
  document.getElementById("versionList").innerHTML = buttons;

  // Two views, one document: the passcode and this list toggle `display`, so
  // they shared a URL and a tracker recorded them as one screen — the same
  // defect the versions had, one level up. Same fix, same reasoning: change the
  // address so the step is visible. replaceState because unlocking is not
  // somewhere Back should return to.
  gateMarkUrl("version-select");
}

/**
 * Name the gate's current view in the URL.
 *
 * http/https only — Chrome throws SecurityError for replaceState with a URL
 * argument on file://, where the document's origin is opaque. Locally this
 * no-ops and the gate behaves exactly as it always has.
 */
function gateMarkUrl(view) {
  try {
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    var url = new URL(location.href);
    url.searchParams.set("gate", view);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  } catch (e) { /* never block the gate on cosmetics */ }
}

function gateShowPasscode() {
  gateMarkUrl("passcode");
  document.getElementById("selectorScreen").style.display = "none";
  document.getElementById("passcodeScreen").style.display = "flex";
  var input = document.getElementById("gateInput");
  input.value = "";
  input.focus();
}

function gateSubmit() {
  var input = document.getElementById("gateInput");
  var error = document.getElementById("gateError");
  if (input.value === GATE_PASSCODE) {
    error.style.display = "none";
    try { sessionStorage.setItem(GATE_SESSION_KEY, "1"); } catch (e) { /* private-mode storage block — non-fatal, just re-asks next load */ }
    gateShowSelector();
  } else {
    error.style.display = "block";
    input.value = "";
    input.focus();
  }
}

function gateInit() {
  var unlocked = false;
  try { unlocked = sessionStorage.getItem(GATE_SESSION_KEY) === "1"; } catch (e) { /* private-mode storage block */ }

  if (unlocked) {
    gateShowSelector();
  } else {
    gateShowPasscode();
  }

  document.getElementById("gateInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") gateSubmit();
  });
}

document.addEventListener("DOMContentLoaded", gateInit);
