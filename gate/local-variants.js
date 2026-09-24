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
    var choices = [];
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
      choices.push(variant);
    });
    if (choices.length) {
      section.hidden = false;
      choices.push({ label: "Current local app", description: "Your current checkout; not necessarily the original baseline.", href: "app/index.html" });
      localCompareInit(choices);
    }
  }

  function localCompareInit(choices) {
    var launch = document.getElementById("localCompare");
    var selector = document.getElementById("selectorScreen");
    if (!launch || !selector) return;
    var workspace, stage, countControl;
    var assignments = choices.map(function (_, index) { return index; });
    var previews = [];
    var visibleCount = Math.min(2, choices.length);

    function node(tag, text, parent) {
      var el = document.createElement(tag);
      if (text) el.textContent = text;
      if (parent) parent.appendChild(el);
      return el;
    }

    function frameFor(index) {
      var frame = node("iframe");
      frame.title = choices[index].label + " — interactive preview";
      frame.src = choices[index].href;
      return frame;
    }

    function previewFor(index) {
      if (previews[index]) return previews[index];
      var choice = choices[index];
      var card = node("section", "", stage);
      card.className = "local-compare-pane";
      var header = node("div", "", card);
      header.className = "local-compare-pane-header";
      var label = node("label", "", header);
      var caption = node("span", "", label);
      var select = node("select", "", label);
      choices.forEach(function (item, i) {
        var option = node("option", item.label, select);
        option.value = String(i);
      });
      select.value = String(index);
      select.addEventListener("change", function () {
        var next = Number(select.value);
        if (!Number.isInteger(next) || next < 0 || next >= choices.length) return;
        var slot = assignments.indexOf(index);
        var other = assignments.indexOf(next);
        assignments[slot] = next;
        assignments[other] = index;
        layout();
        previews[next].select.focus();
      });
      node("p", choice.description, header);
      var actions = node("div", "", header);
      actions.className = "local-compare-actions";
      var toolsButton = node("button", "Show tools", actions);
      toolsButton.type = "button";
      toolsButton.setAttribute("aria-pressed", "false");
      toolsButton.addEventListener("click", function () {
        preview.tools = !preview.tools;
        toolsButton.textContent = preview.tools ? "Hide tools" : "Show tools";
        toolsButton.setAttribute("aria-pressed", String(preview.tools));
        layout();
      });
      var restart = node("button", "Restart preview", actions);
      restart.type = "button";
      restart.addEventListener("click", function () {
        var fresh = frameFor(index);
        card.replaceChild(fresh, preview.frame);
        preview.frame = fresh;
      });
      var link = node("a", "Open in new tab", actions);
      link.href = choice.href;
      link.target = "_blank";
      link.rel = "noopener";
      var frame = frameFor(index);
      card.appendChild(frame);
      var preview = { card: card, select: select, caption: caption, frame: frame, tools: false };
      previews[index] = preview;
      return preview;
    }

    // Frames stay in their original parent. Only grid placement and visibility
    // change: reparenting an iframe can discard its browsing context and progress.
    function layout() {
      var widths = [];
      assignments.forEach(function (index, slot) {
        var visible = slot < visibleCount;
        var preview = visible ? previewFor(index) : previews[index];
        if (!preview) return;
        preview.card.hidden = !visible;
        if (!visible) return;
        preview.card.style.gridColumn = String(slot + 1);
        preview.caption.textContent = "Pane " + (slot + 1) + " variant";
        preview.select.value = String(index);
        widths.push(preview.tools ? "920px" : "460px");
      });
      stage.style.gridTemplateColumns = widths.join(" ");
    }

    launch.addEventListener("click", function () {
      workspace = node("section", "", document.body);
      workspace.className = "local-compare-workspace";
      workspace.setAttribute("aria-label", "Compare local alternatives");
      var toolbar = node("div", "", workspace);
      toolbar.className = "local-compare-toolbar";
      var back = node("button", "Back to versions", toolbar);
      back.type = "button";
      back.addEventListener("click", function () {
        workspace.remove();
        previews = [];
        assignments = choices.map(function (_, index) { return index; });
        visibleCount = Math.min(2, choices.length);
        document.body.classList.remove("local-comparing");
        selector.style.display = "flex";
        launch.focus();
      });
      node("h1", "Compare side by side", toolbar);
      var countLabel = node("label", "Visible panes ", toolbar);
      countControl = node("select", "", countLabel);
      for (var i = 1; i <= choices.length; i += 1) {
        var option = node("option", String(i), countControl);
        option.value = String(i);
      }
      countControl.value = String(visibleCount);
      countControl.addEventListener("change", function () {
        var next = Number(countControl.value);
        if (!Number.isInteger(next) || next < 1 || next > choices.length) return;
        visibleCount = next;
        layout();
      });
      node("p", "Progress lasts until refresh or exit. Restart resets only that variant; a new tab starts a separate session. Hidden previews keep running: pause audio before switching away. If a preview cannot display, use Open in new tab.", workspace);
      stage = node("div", "", workspace);
      stage.className = "local-compare-stage";
      stage.tabIndex = 0;
      stage.setAttribute("role", "region");
      stage.setAttribute("aria-label", "Preview panes; scroll horizontally to see more");
      selector.style.display = "none";
      document.body.classList.add("local-comparing");
      layout();
      back.focus();
    });
  }

  if (!returnToPrimary()) document.addEventListener("DOMContentLoaded", localVariantsInit);
})();
