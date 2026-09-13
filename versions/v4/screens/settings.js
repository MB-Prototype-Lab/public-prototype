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
//   Coming Soon placeholder — no functional settings implemented yet.
//
// PRODUCTION NOTES
//   Intended for: notification preferences, theme picker (currently dev-only in
//   the admin panel), linked accounts, data export, profile editing.
//   The theme lives in state.settings.colorMode and the four options in THEMES
//   (js/theme.js, L21) — the mechanism exists; it just needs a surface here
//   instead of the admin panel. A user-facing version would likely expose only
//   Natural Light / Natural Dark: the v2 pair is a comparison tool for testing,
//   not a product choice.
//   Note it survives Reset User Data on purpose — a viewing preference is not
//   user data, and having the screen repaint on reset would be a jarring tell.

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
      <div class="section-title">Coming Soon</div>
      <p class="helper">Settings screen is a placeholder. Features will be added here as the app grows.</p>
    </div>
  `;
}
