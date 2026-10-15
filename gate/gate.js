// Selector gate: passcode and app/Flow navigation.
// Keep app scripts out of this document: their shared globals would collide.
// Navigation opens each choice in its own document so it boots fresh.
// The plaintext passcode discourages casual forwarding; it is not security.

var GATE_PASSCODE = "1337";
var GATE_SESSION_KEY = "mb_gate_unlocked";
var GATE_TAB_KEY = "mb_gate_tab";
var GATE_TABS = ["prototype", "flows"];

function gateShowSelector() {
  document.getElementById("passcodeScreen").style.display = "none";
  var selector = document.getElementById("selectorScreen");
  selector.style.display = "flex";
  // Give the selector its own tracking URL. Replace it because Back should
  // not return to the passcode after unlocking.
  gateMarkUrl("version-select");
  // Without tabs the markup still shows the Prototype panel, so a failure here
  // costs the toggle, never access.
  try { gateTabsSync(); } catch (e) { /* never block the gate on cosmetics */ }
}

// ─── Prototype / Flows toggle ────────────────────────────────────────────────
// Panels are filled before this runs: locally by gate/flows.js and
// gate/local-variants.js, whose DOMContentLoaded listeners are registered by
// earlier synchronous scripts; when published, by scripts/publish.py. Panels are
// switched only through `hidden`, because the compare workspace restores
// #selectorScreen with style.display. The tab is kept out of the URL: Flow exits
// return to a frozen "../../index.html", so the session remembers it instead.

function gateTabParts(name) {
  var suffix = name === "flows" ? "Flows" : "Prototype";
  return { tab: document.getElementById("gateTab" + suffix), panel: document.getElementById("gatePanel" + suffix) };
}

function gateTabsSync() {
  var available = GATE_TABS.filter(function (name) {
    return !!gateTabParts(name).panel.querySelector("a[href]");
  });
  // A toggle with an empty side (published before any Flow snapshot) would lead
  // testers to nothing, so it only appears when both sides have something.
  var both = available.length === GATE_TABS.length;
  var tabs = document.getElementById("gateTabs");
  tabs.hidden = !both;
  if (both) tabs.setAttribute("role", "tablist"); else tabs.removeAttribute("role");
  GATE_TABS.forEach(function (name) {
    var parts = gateTabParts(name);
    if (both) {
      parts.tab.setAttribute("role", "tab");
      parts.panel.setAttribute("role", "tabpanel");
    } else {
      parts.tab.removeAttribute("role");
      parts.panel.removeAttribute("role");
    }
  });
  var stored = null;
  try { stored = sessionStorage.getItem(GATE_TAB_KEY); } catch (e) { /* private-mode storage block */ }
  // A local comparison suggests the tab holding its variants; the person's own
  // choice still wins. Published pages never set the suggestion.
  var suggested = tabs.getAttribute("data-default-tab");
  // Fall back without overwriting what the person last chose.
  var chosen = available.indexOf(stored) !== -1 ? stored
    : available.indexOf(suggested) !== -1 ? suggested
    : available.indexOf("prototype") !== -1 ? "prototype" : available[0] || "prototype";
  gateSelectTab(chosen, false);
}

/** Show one panel. `remember` is true only for a person's own choice. */
function gateSelectTab(name, remember) {
  GATE_TABS.forEach(function (other) {
    var parts = gateTabParts(other);
    var selected = other === name;
    parts.tab.setAttribute("aria-selected", selected ? "true" : "false");
    parts.tab.tabIndex = selected ? 0 : -1;
    parts.panel.hidden = !selected;
  });
  if (remember) {
    try { sessionStorage.setItem(GATE_TAB_KEY, name); } catch (e) { /* private-mode storage block */ }
  }
}

function gateTabsBind() {
  var keys = { ArrowLeft: -1, ArrowRight: 1, Home: "first", End: "last" };
  GATE_TABS.forEach(function (name, index) {
    var tab = gateTabParts(name).tab;
    tab.addEventListener("click", function () { gateSelectTab(name, true); });
    tab.addEventListener("keydown", function (e) {
      var move = keys[e.key];
      if (move === undefined) return;
      e.preventDefault();
      var next = move === "first" ? 0 : move === "last" ? GATE_TABS.length - 1 : (index + move + GATE_TABS.length) % GATE_TABS.length;
      gateSelectTab(GATE_TABS[next], true);
      gateTabParts(GATE_TABS[next]).tab.focus();
    });
  });
}

/**
 * Name the gate's current view in the URL.
 *
 * http/https only — Chrome throws SecurityError for replaceState with a URL
 * argument on file://, where the document's origin is opaque. Locally this
 * leaves the URL unchanged.
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
  try { gateTabsBind(); } catch (e) { /* never block the gate on cosmetics */ }

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
