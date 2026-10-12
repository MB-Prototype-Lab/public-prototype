// Local discovery only; publications remove this script with local controls.
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var data = window.MB_FLOWS;
    var section = document.getElementById("localFlows");
    var list = document.getElementById("localFlowsList");
    if (!section || !list || !data || data.schema !== 1 || !Array.isArray(data.flows)) return;
    var seen = Object.create(null);
    data.flows.forEach(function (flow) {
      if (!flow || typeof flow.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(flow.id) ||
          flow.id.length > 64 || seen[flow.id] || typeof flow.label !== "string" || !flow.label.trim() ||
          typeof flow.description !== "string" || flow.path !== "flows/" + flow.id + "/index.html") return;
      seen[flow.id] = true;
      var card = document.createElement("div");
      var link = document.createElement("a");
      link.className = "gate-btn";
      link.href = flow.path;
      link.textContent = flow.label;
      card.appendChild(link);
      var description = document.createElement("p");
      description.textContent = flow.description;
      card.appendChild(description);
      list.appendChild(card);
      section.hidden = false;
    });
  });
})();
