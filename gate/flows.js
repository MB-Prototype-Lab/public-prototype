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
      // Same row shape scripts/publish.py renders for published Flow snapshots.
      var row = document.createElement("a");
      row.className = "gate-row";
      row.href = flow.path;
      var name = document.createElement("span");
      name.className = "gate-row-name";
      name.textContent = flow.label;
      row.appendChild(name);
      if (flow.description.trim()) {
        var note = document.createElement("span");
        note.className = "gate-row-note";
        note.textContent = flow.description;
        row.appendChild(note);
      }
      list.appendChild(row);
      section.hidden = false;
    });
  });
})();
