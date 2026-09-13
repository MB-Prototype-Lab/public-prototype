// ─── Who are you, then? ──────────────────────────────────────────────────────
// TAB: none | NAV BAR: Hidden — full-bleed
//
// Shown when a tester chooses "Skip all setup". Two questions, the second
// revealing once the first is answered, in the same grammar as Help me out.
//
// It exists because skipping used to be silent: every write in onbFinish() is
// guarded, so a skipped field fell through to the persona and the tester spent
// the rest of the session as Sam from Los Angeles without being told. Two taps
// is a small price for knowing which figures you are looking at.
//
// TEMPORARY SCAFFOLDING. PROFILE_PICKER (js/config.js) is one line and takes
// this out of the flow entirely — skip then applies profileDefault() silently
// and nothing else changes. That is the flag's whole promise; keep it true.

function ppStart() {
  const d = profileDefaults();
  state.profilePick = { tier: null, level: null, from: state.screen };
  go("profilePicker");
}

function ppSession() { return state.profilePick || null; }

function ppSetTier(id) {
  const s = ppSession();
  if (!s) return;
  s.tier = id;
  render();
}

function ppSetLevel(id) {
  const s = ppSession();
  if (!s) return;
  s.level = id;
  render();
}

/** Apply and land on Home, exactly where finishing setup lands. */
function ppConfirm() {
  const s = ppSession();
  if (!s || !s.tier || !s.level) return;
  profileApply(profileId(s.tier, s.level));
  state.profilePick = null;
  ppFinishOnboarding();
}

/**
 * Complete the skip.
 *
 * onbFinish() does much more than set a profile — the strategic goal, the
 * streak, the buddy, clearing state.onboarding, committing the nav stack — and
 * duplicating any of that here would be a second definition of "setup is done"
 * that drifts. So the profile is applied first and onbFinish runs on top;
 * its writes are all guarded, so they leave the profile alone.
 */
function ppFinishOnboarding() {
  if (state.onboarding && typeof onbFinish === "function") { onbFinish(); return; }
  state.nav.stacks.home = ["home"];
  state.nav.activeStack = "home";
  navCommit("home");
}

function renderProfilePicker() {
  const s = ppSession();
  // D19 — an admin jump with no session behind it.
  if (!s) {
    return `
      <div class="card">
        <h1 class="title" style="font-size:20px;margin:0 0 6px;">Nothing to set up</h1>
        <p class="helper" style="margin:0;">
          This turns up when you skip setup — it picks a starting point so the
          figures you see afterwards belong to somebody.
        </p>
      </div>
      <div class="flow-footer">
        <button class="button secondary" type="button" onclick="navGoTabRoot('home')">Go to Home</button>
      </div>`;
  }

  const tier = profileTiers().find(t => t.id === s.tier) || null;
  const resolved = (s.tier && s.level) ? profileResolve(profileId(s.tier, s.level)) : null;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">Let's start you somewhere</h1>
        <p class="helper" style="margin:6px 0 0;">
          Skipping is fine — I just need enough to make the numbers mean
          something. You can change all of it later.
        </p>
      </div>

      <div class="journal-body">
        <div class="hmo-q ${!s.tier ? "is-open" : ""}">
          <p class="hmo-q-prompt">Where do you live?</p>
          <div class="journal-options">
            ${profileTiers().map(t => `
              <button class="journal-opt ${s.tier === t.id ? "picked" : ""}" type="button"
                      onclick="ppSetTier('${h(t.id)}')">
                <span class="journal-opt-label">${h(t.label)}</span>
              </button>`).join("")}
          </div>
        </div>

        ${tier ? `
          <div class="hmo-q ${!s.level ? "is-open" : ""}">
            <p class="hmo-q-prompt">And roughly what do you earn?</p>
            <p class="helper" style="margin:0 0 10px;font-size:11px;">
              Compared with what households around ${h(tier.place)} typically make.
            </p>
            <div class="journal-options">
              ${profileLevels().map(l => {
                const income = Math.round(tier.medianIncome * l.factor);
                return `
                  <button class="journal-opt ${s.level === l.id ? "picked" : ""}" type="button"
                          onclick="ppSetLevel('${h(l.id)}')">
                    <span class="journal-opt-label">${h(l.label)}</span>
                    <span class="pp-figure">${budgetFmt(income)} a year</span>
                  </button>`;
              }).join("")}
            </div>
          </div>` : ""}

        ${resolved ? `
          <div class="card" style="margin-top:14px;">
            <p class="task-title" style="margin:0 0 6px;">Starting you here</p>
            <p class="task-desc" style="margin:0;">
              ${h(resolved.place)} · ${budgetFmt(resolved.incomeAnnual)} a year ·
              ${h(resolved.householdSize)} people.
              Around ${budgetFmt(resolved.monthlyIncome)} a month coming in.
            </p>
          </div>` : ""}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="ppSkipToDefault()">Just pick for me</button>
        <button class="button" type="button" onclick="ppConfirm()" ${resolved ? "" : "disabled"}>
          Start
        </button>
      </div>
    </div>`;
}

/** The escape hatch — nobody should be trapped on a screen they wanted to skip. */
function ppSkipToDefault() {
  const d = profileDefault();
  if (d) profileApply(d.id);
  state.profilePick = null;
  ppFinishOnboarding();
}

function renderProfilePickerAdmin() {
  const s = ppSession();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Starting profile</p>
      <p class="helper" style="margin-bottom:10px;">
        Nine of them: 3 cost-of-living tiers x 3 income levels. Also the matrix
        scripts/sweep.js drives every feature through.
      </p>
      ${s ? `<div class="input-group">
        <label>Picking</label>
        <div class="helper">tier <strong>${h(s.tier || "—")}</strong> ·
          level <strong>${h(s.level || "—")}</strong></div>
      </div>` : `<p class="helper">Not picking. Reached from "Skip all setup".</p>`}
      ${renderProfileAdminSwitcher()}
    </div>`;
}

/**
 * The active profile, and a way to change it without restarting.
 *
 * Shared, because it belongs on more than one admin card — the onboarding one
 * and this screen's — and two copies would drift.
 *
 * The BAND is on screen next to the income for a reason. peer-benchmarks.json
 * has five income bands and the +/-25% steps do not always cross one: Santa
 * Clara "at" and "+25%" are both b5, Little Rock "at" and "+25%" are both b3.
 * Those pairs produce identical peer figures. That is the model's own
 * granularity working correctly, but with only the dollar figure visible it
 * reads as the app ignoring a 25% raise.
 */
function renderProfileAdminSwitcher() {
  const active = profileActive();
  return `
    <div class="input-group">
      <label>Active profile</label>
      <select onchange="profileApply(this.value);render()">
        <option value="" ${active ? "" : "selected"}>— none applied (persona seed) —</option>
        ${profileList().map(p => `
          <option value="${h(p.id)}" ${active && active.id === p.id ? "selected" : ""}>
            ${h(p.tier.place)} · ${h(p.level.label)} · ${budgetFmt(p.incomeAnnual)}
          </option>`).join("")}
      </select>
    </div>
    ${active ? `
      <div class="helper" style="line-height:1.8;">
        ${h(active.place)} · ZIP ${h(active.zip)} · RPP ${h(active.rpp)}<br>
        ${budgetFmt(active.incomeAnnual)} a year → band <strong>${h(active.band || "?")}</strong>
        · household ${h(active.householdSize)}<br>
        peers spend <strong>${budgetFmt(profilePeerTotal())}</strong> a month
      </div>
      <p class="helper" style="font-size:10px;margin-top:8px;">
        Bands are coarse — two of the nine share a band with their neighbour, so
        a 25% income step moves nothing. That is the peer model, not a fault.
      </p>` : `
      <p class="helper" style="font-size:10px;">
        Nothing applied, so the persona's seed is standing in — Los Angeles,
        $68,000. That is exactly the silence the picker exists to end.
      </p>`}
  `;
}
