// ─── Streak Counter (component) ───────────────────────────────────────────────
// Reusable, self-contained streak visuals, split into two pure pieces so a screen
// can place them independently:
//   renderStreakCounter(opts)  — the big day count + "DAY STREAK" label
//   renderStreakWeekRow(opts)  — the M–S weekday pill
// Both read NO app state and take optional opts, so they can be dropped anywhere
// (the splash today, a Home header later). Styled entirely with --streak-* theme
// tokens so no hex is hardcoded.

// opts.count — the streak number (default 8, static).
function renderStreakCounter(opts) {
  opts = opts || {};
  var count = opts.count != null ? opts.count : 8;
  return '<div class="streak-counter" style="text-align:center;">'
       +   '<div style="font-size:64px;font-weight:900;line-height:1;text-shadow:0 3px 10px rgba(0,0,0,.2);">' + h(count) + '</div>'
       +   '<div style="font-size:16px;font-weight:900;letter-spacing:2px;margin-top:6px;">DAY STREAK</div>'
       + '</div>';
}

// opts.days — 7 entries, each "done" | "today" | "upcoming" (Mon→Sun). The
//             default paints the reference look: 2 done, today saved, rest ahead.
function renderStreakWeekRow(opts) {
  opts = opts || {};
  var labels = ["M", "T", "W", "T", "F", "S", "S"];
  var days   = opts.days || ["done", "done", "today", "upcoming", "upcoming", "upcoming", "upcoming"];

  var dayCells = labels.map(function (lab, i) {
    var st = days[i] || "upcoming";
    var marker;
    if (st === "today") {
      // Saved today — solid white medallion with a check.
      marker = '<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;'
             + 'border-radius:50%;background:var(--streak-on);color:var(--streak-bg);font-size:14px;font-weight:900;">✓</span>';
    } else if (st === "done") {
      // Already completed — amber medallion with a check.
      marker = '<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;'
             + 'border-radius:50%;background:var(--streak-accent);color:var(--streak-bg);font-size:13px;font-weight:900;">✓</span>';
    } else {
      // Upcoming — muted dot.
      marker = '<span style="display:block;width:12px;height:12px;border-radius:50%;background:var(--streak-off);"></span>';
    }
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:9px;">'
         +   '<span style="font-size:11px;font-weight:800;letter-spacing:.5px;opacity:.85;">' + h(lab) + '</span>'
         +   '<span style="display:flex;align-items:center;justify-content:center;height:26px;">' + marker + '</span>'
         + '</div>';
  }).join("");

  return '<div class="streak-week-row" style="display:flex;gap:10px;justify-content:center;align-items:flex-start;'
       +   'background:var(--streak-pill);border-radius:18px;padding:14px 16px;">'
       +   dayCells
       + '</div>';
}
