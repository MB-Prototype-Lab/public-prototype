// Refresh pin — a reviewer preference, not app state.
//
// A browser refresh returns to the selector with a fresh app. "Pin on refresh"
// in Admin Tools keeps the refresh here instead and restarts this page fresh.
// One pin per browser tab, shared with Flows and the side-by-side toolbar.
// sessionStorage holds reviewer preferences only (D03), never participant data.
// Loaded in <head> so an unpinned reload leaves before the app starts.
//
// An embedded copy (a side-by-side pane) ignores the pin and never sends itself
// to the selector: the page around it owns pinning and the way back.
var REFRESH_PIN_KEY = "mb_refresh_pin";
var REFRESH_PIN_RESTART_KEY = "mb_refresh_restart";

function refreshPinNavType() {
  try {
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    return nav ? nav.type : (performance.navigation && performance.navigation.type === 1 ? "reload" : "");
  } catch (e) { return ""; }
}

function refreshPinEmbedded() {
  try { return window.self !== window.top; } catch (e) { return true; }
}

function refreshPinAvailable() {
  try {
    sessionStorage.setItem(REFRESH_PIN_KEY + "_probe", "1");
    sessionStorage.removeItem(REFRESH_PIN_KEY + "_probe");
    return true;
  } catch (e) { return false; }
}

function refreshPinGet() {
  try { return sessionStorage.getItem(REFRESH_PIN_KEY) === "1"; } catch (e) { return false; }
}

function refreshPinSet(on) {
  if (!refreshPinEmbedded()) {
    try {
      if (on) sessionStorage.setItem(REFRESH_PIN_KEY, "1");
      else sessionStorage.removeItem(REFRESH_PIN_KEY);
    } catch (e) { /* blocked storage: sync below shows why the pin is off */ }
  }
  refreshPinSync();
}

// This address minus what would recreate a previous session: the ?screen= deep
// link and the #v= value trail. Null when there is nothing to drop. Checked by
// presence, because rebuilding a URL re-encodes its query and would never match.
function refreshPinFreshUrl() {
  try {
    var url = new URL(location.href);
    var trail = url.hash.indexOf("#v=") === 0;
    if (!url.searchParams.has("screen") && !trail) return null;
    url.searchParams.delete("screen");
    if (trail) url.hash = "";
    return url.href;
  } catch (e) { return null; }
}

// A fresh document at this page's start; participant parameters survive. The
// one-shot marker tells the next load it is a restart, in case a browser
// reports a same-address replace as a reload.
function refreshPinRestart() {
  try { sessionStorage.setItem(REFRESH_PIN_RESTART_KEY, "1"); } catch (e) {}
  location.replace(refreshPinFreshUrl() || location.href);
}

// The manual way back. Leaves the pin as it is.
function refreshPinExit() {
  location.assign(window.MB_RELEASE.selector);
}

function refreshPinSync() {
  var toggle = document.getElementById("refreshPinToggle");
  var note = document.getElementById("refreshPinNote");
  var exit = document.getElementById("refreshPinExitButton");
  var embedded = refreshPinEmbedded();
  var available = refreshPinAvailable();
  if (toggle) {
    toggle.checked = !embedded && available && refreshPinGet();
    toggle.disabled = embedded || !available;
  }
  if (exit) exit.disabled = embedded;
  if (note) {
    note.textContent = embedded
      ? "Off in an embedded preview. Side by side, use the toolbar's Pin on refresh and Back to versions."
      : !available
        ? "Unavailable: this browser blocks session storage, so refresh returns to the selector."
        : "Refresh restarts here instead of returning to the selector.";
  }
}

(function () {
  var restarting = false;
  try {
    restarting = sessionStorage.getItem(REFRESH_PIN_RESTART_KEY) === "1";
    if (restarting) sessionStorage.removeItem(REFRESH_PIN_RESTART_KEY);
  } catch (e) {}
  // Only a reload is redirected: arriving from the selector and back/forward
  // are left alone. State is in-memory, so every path here starts fresh.
  if (restarting || refreshPinNavType() !== "reload") return;
  if (refreshPinEmbedded()) {
    var fresh = refreshPinFreshUrl();
    if (fresh) location.replace(fresh);
    return;
  }
  if (!refreshPinGet()) {
    location.replace(window.MB_RELEASE.selector);
    return;
  }
  if (refreshPinFreshUrl()) refreshPinRestart();
})();

if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("DOMContentLoaded", refreshPinSync);
// A page restored from the back/forward cache skips DOMContentLoaded.
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("pageshow", refreshPinSync);
