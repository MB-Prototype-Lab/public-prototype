// Settings is a placeholder. Theme controls live in Tools (L21); the viewing
// preference survives Reset User Data because it is not participant data.

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
