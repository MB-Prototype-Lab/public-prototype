// Tools-only splash: boot and study links select their screen before render.
// The streak counter is static display content. render.js applies full-height
// .streak-mode layout without the nav.

function renderStreak() {
  // Proportional flex spacers position the counter and week row across heights.
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
       +   '<p class="helper" style="margin-bottom:10px;">Static, non-persistent screen, reached only from Tools — '
       +     'a session opens on onboarding, or on the screen a study link (?screen=) names. The 8-day streak and '
       +     'weekday states are hardcoded display values, not stored or computed.</p>'
       +   '<button class="button secondary small" type="button" onclick="go(\'home\')">Continue to Home →</button>'
       + '</div>';
}
