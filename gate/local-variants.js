// Local comparison data is written by scripts/local-variants.py. This file is
// loaded only by the editable selector; publication omits its script tag.
(function () {
  "use strict";

  var safeId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

  function returnToPrimary() {
    var info = window.MB_LOCAL_RETURN;
    if (!info || typeof info.href !== "string" || location.protocol !== "file:") return false;
    if (!/\/\.worktrees\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/index\.html$/.test(location.pathname)) return false;
    try {
      var primary = new URL("../../index.html", location.href);
      if (new URL(info.href, location.href).href !== primary.href) return false;
      location.replace(primary.href);
      return true;
    } catch (e) {
      return false;
    }
  }

  function localVariantsInit() {
    var manifest = window.MB_LOCAL_VARIANTS;
    if (!manifest || manifest.active !== true || !Array.isArray(manifest.variants)) return;
    var section = document.getElementById("localAlternatives");
    var list = document.getElementById("localAlternativesList");
    if (!section || !list) return;

    var seen = Object.create(null);
    var count = 0;
    manifest.variants.forEach(function (variant) {
      if (!variant || typeof variant !== "object" || typeof variant.id !== "string" ||
          !safeId.test(variant.id) || seen[variant.id] ||
          typeof variant.label !== "string" || !variant.label.trim() ||
          typeof variant.description !== "string" ||
          variant.href !== ".worktrees/" + variant.id + "/app/index.html") return;
      seen[variant.id] = true;

      var card = document.createElement("div");
      card.className = "local-alternative";
      var mainLink = document.createElement("a");
      mainLink.className = "gate-btn";
      mainLink.href = variant.href;
      mainLink.textContent = variant.label;
      card.appendChild(mainLink);
      if (variant.description.trim()) {
        var description = document.createElement("p");
        description.textContent = variant.description;
        card.appendChild(description);
      }
      var tabLink = document.createElement("a");
      tabLink.className = "local-open-new-tab";
      tabLink.href = variant.href;
      tabLink.target = "_blank";
      tabLink.rel = "noopener";
      tabLink.textContent = "Open " + variant.label + " in new tab";
      card.appendChild(tabLink);
      list.appendChild(card);
      count += 1;
    });
    if (count) section.hidden = false;
  }

  if (!returnToPrimary()) document.addEventListener("DOMContentLoaded", localVariantsInit);
})();
