// ─── Streak Splash (screen) ───────────────────────────────────────────────────
// TAB: none | NAV BAR: hidden (omitted from NAV_VISIBLE_SCREENS)
//
// The first screen on every fresh load/refresh — state.screen seeds to "streak"
// in js/state.js. A full-bleed branded sunburst that hosts the reusable streak
// counter component, an encouraging line, and the "Let's go!" CTA into Home.
// Static + non-persistent: nothing here is stored or computed. Independent of
// home.js by design, so either screen can be iterated without touching the other.
// Full-height is handled by render.js + the .streak-mode CSS class (no nav).

function renderStreak() {
  // Vertical layout via flex-grow spacers (proportional to height): the count sits
  // upper-center, the week row drops into the lower-middle, footer pins to the
  // bottom. Tune the spacer flex ratios (2.4 / 1.6) to nudge the week row up/down.
  return '<div style="height:100%;display:flex;flex-direction:column;align-items:center;'
       +   'padding:14% 26px 30px;text-align:center;color:var(--streak-text);'
       +   'background:repeating-conic-gradient(from 0deg at 50% 34%, var(--streak-burst) 0deg 7deg, var(--streak-bg) 7deg 14deg);">'
       +   renderStreakCounter()
       +   '<div style="flex:2.4;"></div>'
       +   renderStreakWeekRow()
       +   '<div style="flex:1.6;"></div>'
       +   '<div style="width:100%;">'
       +     '<p style="font-size:14px;font-weight:600;line-height:1.4;opacity:.92;margin:0 0 18px;padding:0 6px;">'
       +       'Phew… your streak is saved this time! Visit Money Buddy every day to keep it going.'
       +     '</p>'
       +     '<button class="button" type="button" onclick="go(\'home\')" '
       +       'style="width:100%;background:var(--streak-on);color:var(--streak-bg);border:0;border-radius:16px;'
       +       'padding:16px;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);">'
       +       'Let\'s go!'
       +     '</button>'
       +   '</div>'
       + '</div>';
}

function renderStreakAdmin() {
  return '<div class="admin-card">'
       +   '<p class="admin-card-title">Streak Splash</p>'
       +   '<p class="helper" style="margin-bottom:10px;">Static, non-persistent launch screen — shows first on every '
       +     'refresh. The 8-day streak and weekday states are hardcoded display values, not stored or computed.</p>'
       +   '<button class="button secondary small" type="button" onclick="go(\'home\')">Continue to Home →</button>'
       + '</div>';
}
