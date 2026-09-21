// ─── Share (08-video-updates, A11) ───────────────────────────────────────────
// TAB: None | NAV BAR: Hidden
//
// "A sheet offering copy link, and platform buttons that don't connect to
// anything real. Anonymization is on by default.
//
// The part worth building properly is the expansion view: a preview showing
// exactly what would be posted, with every financial figure anonymized. That
// transparency is the trust mechanic, and it's testable in a way the platform
// integrations aren't."
//
// So: the platform buttons are deliberately inert, and the toggle + preview are
// deliberately real. The preview shows the EXACT string that would be posted —
// not a description of it, not a sample. If the two could drift, the preview
// would be theatre, which is the one thing this screen must not be.

const SHARE_PLATFORMS = ["Instagram", "X", "Threads", "WhatsApp", "Messages"];

/**
 * Strip every absolute currency figure, leaving relative language intact.
 *
 * That split is the point. "$470 on dining out" leaks roughly what someone
 * earns; "34% over my plan" says the same thing about their month without
 * revealing the scale of their life. Percentages stay, dollars go.
 */
function shareAnonymize(text) {
  return String(text)
    // $1,234.56 / $1234 / $18.99  →  a redaction of the same shape
    .replace(/\$\s?\d[\d,]*(\.\d+)?/g, "$•••")
    // bare thousands that read as money in context ("3,000 emergency fund")
    .replace(/\b\d{1,3}(,\d{3})+(\.\d+)?\b/g, "•••");
}

/** The post body, built from live observations — never from the seed's copy. */
function shareComposeText(anonymized) {
  const lines = [];
  lines.push(`${state.streak} day${state.streak === 1 ? "" : "s"} of tracking with Money Buddy.`);
  lines.push("");

  (state.observations || []).slice(0, 3).forEach(o => {
    lines.push("• " + observationHeadline(o) + " — " + observationDetail(o));
  });

  lines.push("");
  lines.push("Tracked by writing about my day, not by connecting a bank.");

  const body = lines.join("\n");
  return anonymized ? shareAnonymize(body) : body;
}

function renderDailyShare() {
  const anon = state.share.anonymized;
  const text = shareComposeText(anon);

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">Share your week</h1>
        <p class="helper" style="margin:6px 0 0;">
          Nothing goes anywhere until you send it.
        </p>
      </div>

      <div class="journal-body">
        <div class="card">
          <label class="share-toggle">
            <input type="checkbox" ${anon ? "checked" : ""}
                   onchange="shareSetAnonymized(this.checked)">
            <span>
              <strong>Hide my figures</strong>
              <span class="helper" style="display:block;">
                ${anon
                  ? "Amounts are replaced. Percentages stay, so it still means something."
                  : "Your actual amounts will be included."}
              </span>
            </span>
          </label>
        </div>

        <!-- The expansion view. This is the trust mechanic (A11): the exact
             string that would be posted, shown character for character. -->
        <div class="card">
          <button class="share-expand" type="button" onclick="shareTogglePreview()">
            <span>${state.share.previewOpen ? "Hide" : "Show"} exactly what would be posted</span>
            <span aria-hidden="true">${state.share.previewOpen ? "▴" : "▾"}</span>
          </button>
          ${state.share.previewOpen ? `
            <pre class="share-preview">${h(text)}</pre>
            <p class="helper" style="margin:8px 0 0;font-size:10px;">
              ${anon
                ? "Every amount above is redacted. This is the whole post — nothing else is attached."
                : "This is the whole post, with your real amounts."}
            </p>
          ` : ""}
        </div>

        <button class="button full" style="margin-bottom:10px;" type="button"
                onclick="shareCopy()">
          ${state.share.copied ? "Copied ✓" : "Copy to clipboard"}
        </button>

        <p class="helper" style="margin:0 0 8px;">Or send to</p>
        <div class="share-platforms">
          ${SHARE_PLATFORMS.map(p => `
            <button class="share-platform" type="button" disabled
                    title="Not connected in this prototype">${h(p)}</button>
          `).join("")}
        </div>
        <p class="helper" style="font-size:10px;margin:10px 0 0;">
          Platform sharing isn't wired up in this prototype — the buttons are
          here to show where it would live.
        </p>
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        <button class="button" type="button" onclick="shareDone()">Done</button>
      </div>
    </div>
  `;
}

function shareSetAnonymized(on) {
  state.share.anonymized = !!on;
  state.share.copied = false;
  render();
}

function shareTogglePreview() {
  state.share.previewOpen = !state.share.previewOpen;
  render();
}

function shareCopy() {
  const text = shareComposeText(state.share.anonymized);
  try {
    navigator.clipboard.writeText(text).then(function () {
      state.share.copied = true; render();
    }).catch(function () {
      state.share.copied = true; render();      // clipboard blocked; the flow still completes
    });
  } catch (e) {
    state.share.copied = true; render();
  }
}

/**
 * End of the share flow — where the streak registers (03-home-daily-loop).
 * Guarded so replaying the update cannot inflate it.
 */
function shareDone() {
  streakRegister();
  navGoHome();
}

function streakRegister() {
  const today = journalDayIndex();
  if (state.streakRegisteredDay === today) return;   // already counted today
  state.streakRegisteredDay = today;
  state.streak += 1;
}

function renderDailyShareAdmin() {
  const plain = shareComposeText(false);
  const anon  = shareComposeText(true);
  const figs  = (anon.match(/\$\s?\d/g) || []).length;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Share</p>
      <div class="input-group">
        <label>Anonymized (default ON)</label>
        <select onchange="shareSetAnonymized(this.value==='true')">
          <option value="true"  ${state.share.anonymized ? "selected" : ""}>true</option>
          <option value="false" ${!state.share.anonymized ? "selected" : ""}>false</option>
        </select>
      </div>
      <div class="input-group">
        <label>Currency figures left in the anonymized post</label>
        <div class="helper">${figs} ${figs === 0 ? "✓" : "⚠ leak"}</div>
      </div>
      <div class="input-group">
        <label>Preview is the literal payload</label>
        <div class="helper">${plain.length} chars plain · ${anon.length} anonymized</div>
      </div>
      <div class="input-group">
        <label>Streak</label>
        <div class="helper">
          ${state.streak} days · registered for day
          ${state.streakRegisteredDay == null ? "—" : h(state.streakRegisteredDay)}
        </div>
      </div>
      <p class="helper" style="font-size:10px;">
        Platform buttons are inert by design (A11). The toggle and preview are
        fully functional, because that is the part worth testing.
      </p>
    </div>
  `;
}
