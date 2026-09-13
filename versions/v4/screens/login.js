// ─── Login (03-home-daily-loop) ──────────────────────────────────────────────
// TAB: None | NAV BAR: Hidden — full-bleed scene
//
// "A scene — happy, warm, day or night depending on local time. Animated
// greeting. Then a prompt: watch your daily update?"
//
// Yes / No, plus a "remember my choice" checkbox. If checked on first use, tell
// them once that it's changeable in their profile. Never mention it again.
//
// Backgrounds are described placeholders — assets B1 (day) and B2 (night) are
// not generated. The day/night SWITCH is real, driven by local time.
//
// L22 allows owner-supplied buddy illustrations; it says nothing about these two
// backgrounds, which stay described until the owner supplies them too. If they
// arrive, they follow the same rule: the image is preferred and the description
// is the fallback, never removed.

function loginIsNight() {
  const hr = new Date().getHours();
  return hr < 6 || hr >= 19;
}

function renderLogin() {
  const night = loginIsNight();
  const name = (state.profile && state.profile.name) || "there";

  return `
    <div class="login-scene ${night ? "login-night" : "login-day"}">
      <div class="login-bg-note">
        ${night
          ? "moonlit meadow · rolling hills · fireflies · crescent moon"
          : "sunlit meadow · rolling hills · wildflowers · soft clouds"}
        <span class="buddy-note" style="display:block;">background placeholder</span>
      </div>

      <div class="login-greeting">
        <h1 class="login-hello">${night ? "Evening" : "Morning"}, ${h(name)}</h1>
        <p class="helper" style="margin:6px 0 0;">
          ${state.streak} day${state.streak === 1 ? "" : "s"} in a row.
        </p>
      </div>

      ${renderBuddyStage({ compact: true })}

      ${state.dailyPromptAnswered ? "" : `
        <div class="card login-prompt">
          <p class="task-title" style="margin:0 0 4px;">Watch your daily update?</p>
          <p class="helper" style="margin:0 0 12px;">
            A quick read on how the week is going.
          </p>
          <div style="display:flex;gap:8px;">
            <button class="button" style="flex:1;" type="button" onclick="loginAnswer(true)">Yes</button>
            <button class="button secondary" style="flex:1;" type="button" onclick="loginAnswer(false)">Not now</button>
          </div>
          <label class="login-remember">
            <input type="checkbox" ${state.rememberDailyChoice ? "checked" : ""}
                   onchange="state.rememberDailyChoice=this.checked;render()">
            Remember my choice
          </label>
        </div>
      `}

      ${state.dailyPromptNoticeShown ? `
        <p class="helper login-notice">
          You can change that any time in your profile.
        </p>` : ""}
    </div>
  `;
}

function loginAnswer(watch) {
  // "If checked on first use, tell them once that it's changeable in their
  // profile. Never mention it again."
  if (state.rememberDailyChoice && !state.dailyPromptNoticeSeen) {
    state.dailyPromptNoticeSeen = true;
    state.dailyPromptNoticeShown = true;
  }
  state.dailyPromptAnswered = true;
  state.dailyPromptWatch = watch;

  // Login sits ON TOP of the home root, so popping it means it cannot be
  // returned to. "Yes" then pushes the daily update on top of home, so its
  // Skip/Done still land on home.
  navBack();
  if (watch) duStart();
}

function renderLoginAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">Login</p>
      <div class="input-group">
        <label>Scene (real, from local time)</label>
        <div class="helper">${loginIsNight() ? "night" : "day"} — hour ${new Date().getHours()}</div>
      </div>
      <div class="input-group">
        <label>Prompt answered</label>
        <select onchange="state.dailyPromptAnswered=(this.value==='true');render()">
          <option value="false" ${!state.dailyPromptAnswered ? "selected" : ""}>false</option>
          <option value="true"  ${state.dailyPromptAnswered ? "selected" : ""}>true</option>
        </select>
      </div>
      <p class="helper" style="font-size:10px;">
        Remember-my-choice notice fires once and never again
        (seen: ${state.dailyPromptNoticeSeen ? "yes" : "no"}).
      </p>
      <button class="button secondary full" type="button"
              onclick="state.dailyPromptAnswered=false;state.dailyPromptNoticeSeen=false;state.dailyPromptNoticeShown=false;render()">
        Reset prompt
      </button>
    </div>
  `;
}
