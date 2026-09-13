// ─── Shared Top Bar ───────────────────────────────────────────────────────────
// NEW IN v3 — v2 had no shared top bar; every screen rendered its own header.
// 03-home-daily-loop puts kibble, streak and buddy level up here, and L5 puts
// the home/back control in the top-left, so one component owns the strip.
//
//   ┌────────────────────────────────────────────┐
//   │ [◄ or ⌂]   🦴 240 · 🔥 6 · Lv 3        [☰] │
//   └────────────────────────────────────────────┘
//
// LEFT SLOT is contextual (L5). Back and home are mutually exclusive — two
// competing escapes on one screen is what confuses testers:
//
//   stack depth > 1          → Back   (pops the active stack)
//   stack depth = 1, not home→ Home   (switches to the home stack)
//   full-bleed / nav hidden  → Back only, home suppressed
//   on Home itself           → nothing
//
// The back button is the SINGLE source of back navigation. v2's per-screen
// "← Budget" buttons were hardcoded forward-jumps to a fixed destination, which
// is wrong once the same screen can be reached from two places — that is the
// whole point of the per-stack model in architecture §7.

// streak: full-bleed splash owns the viewport.
// chat: it has its own header + Back (top-right); a top-bar back too would be a
// second, competing escape in the top-left — hide the bar so there's one Back.
// lesson: the accent stage has its own boxed back (.lp-back-btn); the top-bar
// back would stack a second chevron over it (and reads low-contrast on the sage
// stage in the dark themes). Hide the bar so the boxed icon is the only back.
const TOPBAR_HIDDEN_SCREENS = ["streak", "chat", "lesson"];

function renderTopBar() {
  if (TOPBAR_HIDDEN_SCREENS.includes(state.screen)) return "";

  const fullBleed = !NAV_VISIBLE_SCREENS.includes(state.screen);
  const depth     = navDepth();
  const onHome    = state.screen === "home" && depth === 1;

  // Left slot — back wins over home whenever there is somewhere to go back to.
  let left = `<span class="topbar-slot"></span>`;
  if (depth > 1) {
    left = `<button class="topbar-btn" type="button" onclick="navBack()" aria-label="Back">‹</button>`;
  } else if (!onHome && !fullBleed) {
    left = `<button class="topbar-btn" type="button" onclick="navGoHome()" aria-label="Home">${TOPBAR_HOME_ICON}</button>`;
  } else if (fullBleed) {
    // Nav is hidden here, so back is the only exit. Depth 1 on a full-bleed
    // screen means it was entered as a stack root — fall back to home.
    left = `<button class="topbar-btn" type="button" onclick="navBack()" aria-label="Back">‹</button>`;
  }

  // Full-bleed screens get the back control only — no status strip competing
  // with a focused flow (journal entry, lesson, daily update).
  if (fullBleed) {
    return `<div class="topbar topbar-bare">${left}<span class="topbar-slot"></span></div>`;
  }

  return `
    <div class="topbar">
      ${left}
      <div class="topbar-status" aria-label="Charity Points, streak and level">
        <span class="topbar-stat" title="Charity Points — diamonds">${TOPBAR_DIAMOND_ICON}${h(state.charityDiamonds)}</span>
        <span class="topbar-dot">·</span>
        <span class="topbar-stat" title="Charity Points — bones">${TOPBAR_KIBBLE_ICON}${h(state.kibble)}</span>
        <span class="topbar-dot">·</span>
        <span class="topbar-stat" title="Day streak">${TOPBAR_STREAK_ICON}${h(state.streak)}</span>
        <span class="topbar-dot">·</span>
        <span class="topbar-stat" title="Buddy level">Lv&nbsp;${h(state.buddyLevel)}</span>
      </div>
      <button class="topbar-btn" type="button" onclick="topbarToggleMenu()" aria-label="Menu">☰</button>
    </div>
    ${state.topbarMenuOpen ? renderTopBarMenu() : ""}
  `;
}

// Half-screen overlay for system information (03-home-daily-loop). Contents are
// Phase 3's job; the shell and the dismiss behaviour live here.
function renderTopBarMenu() {
  return `
    <div class="topbar-menu-scrim" onclick="topbarToggleMenu()"></div>
    <div class="topbar-menu" role="dialog" aria-label="Menu">
      <p class="section-title" style="margin:0 0 2px;">Money Buddy</p>
      <p class="helper" style="margin:0 0 16px;">
        ${h(state.profile ? state.profile.name : "")}${state.profile && state.profile.zip ? " · " + h(state.profile.zip) : ""}
      </p>

      <div class="row" style="margin-bottom:6px;">
        <span class="helper">Charity Points</span><span style="font-weight:850;">💎 ${h(state.charityDiamonds)} · 🦴 ${h(state.kibble)}</span>
      </div>
      <div class="row" style="margin-bottom:6px;">
        <span class="helper">Streak</span><span style="font-weight:850;">🔥 ${h(state.streak)} day${state.streak === 1 ? "" : "s"}</span>
      </div>
      <div class="row" style="margin-bottom:6px;">
        <span class="helper">Buddy level</span><span style="font-weight:850;">${h(state.buddyLevel)}</span>
      </div>
      <div class="row" style="margin-bottom:16px;">
        <span class="helper">Journal entries</span><span style="font-weight:850;">${h(state.journalEntries.length)}</span>
      </div>

      <button class="button secondary full" style="margin-bottom:8px;" type="button"
              onclick="topbarToggleMenu();navAdminJump('settings')">Settings</button>
      <button class="button secondary full" type="button"
              onclick="topbarToggleMenu();navAdminJump('comparison')">Where my money goes</button>

      <p class="helper" style="margin:16px 0 0;font-size:10px;">
        Prototype build. Nothing here is financial advice.
      </p>
    </div>
  `;
}

function topbarToggleMenu() {
  state.topbarMenuOpen = !state.topbarMenuOpen;
  render();
}

// Inline SVG — no icon library under L1 (no npm, so no lucide-react).
// Sized to sit inside the 44px tap target rather than fill it.
const TOPBAR_HOME_ICON =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>';

// Charity Points, two tiers: 💎 diamond (subscriber) and 🦴 bone (free/ad).
const TOPBAR_DIAMOND_ICON = '<span class="topbar-ico" aria-hidden="true">💎</span>';
const TOPBAR_KIBBLE_ICON = '<span class="topbar-ico" aria-hidden="true">🦴</span>';
const TOPBAR_STREAK_ICON = '<span class="topbar-ico" aria-hidden="true">🔥</span>';
