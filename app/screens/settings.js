// ─── Settings ─────────────────────────────────────────────────────────────────
// TAB: None (no bottom nav tab) | NAV BAR: Visible
//
// PURPOSE
// App preferences and account configuration.
//
// NAVIGATION
//   Entry: Settings button on Home screen header
//   Exit:  ← Back → home
//
// STATES
//   Color mode — the four themes in THEMES (js/theme.js, L21), one active.
//   Writes state.settings.colorMode through themeSet(); the default stays
//   THEME_DEFAULT. Moved here from the admin panel so testers can reach it
//   while admin is hidden.
//
// PRODUCTION NOTES
//   Still to come: notification preferences, linked accounts, data export,
//   profile editing.
//   The v2 Light/Dark pair is offered alongside the Natural pair for now; a
//   production version may expose only Natural Light / Natural Dark.
//   Color mode survives Reset User Data on purpose — a viewing preference is
//   not user data, and having the screen repaint on reset would be a jarring
//   tell.

/** One button per theme, the active one pressed. */
function settingsColorModeButtons() {
  const active = themeCurrent().id;
  return THEMES.map(t => `
    <button type="button"
      class="settings-mode-btn${t.id === active ? " on" : ""}"
      onclick="themeSet('${t.id}')"
      aria-pressed="${t.id === active}">${h(t.label)}</button>`).join("");
}

function renderSettings() {
  return `
    <div class="home-header">
      <div>
        <h1 class="title">Settings</h1>
        <p class="subtitle">App preferences and account options.</p>
      </div>
      <button class="button secondary" type="button" onclick="navBack()">Back</button>
    </div>

    <div class="card">
      <div class="section-title">Color mode</div>
      <div class="settings-mode-grid" role="group" aria-label="Color mode">
        ${settingsColorModeButtons()}
      </div>
    </div>
  `;
}
