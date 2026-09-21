// ─── Reward Screen ────────────────────────────────────────────────────────────
// Shown after a lesson's quiz is completed. Data comes entirely from
// state.rewardBadgeGains[] — nothing is hardcoded here.
//
// Animation intent: each ring animates through the full journey taken:
//   - Simple gain (no level-up): fill from oldProgress → newProgress
//   - N level-ups: fill to 100% → flash-reset → fill to 100% (×N-1) → fill to newProgress
//   Each reset is accompanied by a label change (C7→C8 etc.) with a CSS pulse.
//   Label changes are driven by inline <script> + setTimeout, one per level-up event.
//
// Duration is proportional to arc distance traveled (constant angular velocity):
//   Fill speed: 100 arc-pct per 1500ms
//   Reset pause: 500ms per level-up
// This means a 200 XP bonus lesson visibly takes longer than a 40 XP base lesson.
//
// Level-up indicator: shown ABOVE the ring, fixed-height slot so all rings align.
// No progress bars anywhere — the ring IS the progress meter.

// Reuses RING_ARC, RING_CIRC, RING_ROTATION from badge-ring.js (loaded first).

// Builds the animated ring and label-change script for one reward badge cell.
function renderRewardRing(gain, index) {
  const color       = tierColor(gain.newTier);
  const px          = 72; // md size
  const N           = gain.levelUpHistory ? gain.levelUpHistory.length : 0;

  // ── Dashoffset helpers ──────────────────────────────────────────────────────
  // Higher offset = less arc shown. 0 = fully filled. RING_ARC = fully empty.
  const pctToOffset = pct => (RING_ARC * (1 - pct / 100)).toFixed(2);
  const oldOffset   = pctToOffset(gain.oldProgress);
  const newOffset   = pctToOffset(gain.newProgress);
  const emptyOffset = RING_ARC.toFixed(2);
  const fullOffset  = "0.00"; // 100% filled

  // ── Duration model: constant angular velocity ───────────────────────────────
  // fills[i] = arc-pct traveled during fill phase i
  //   phase 0:   100 - oldProgress  (fill the remainder of the starting level)
  //   phases 1..N-1: 100             (full level fills)
  //   phase N:   newProgress         (fill to final position)
  // For N=0 (no level-up): just one fill from old to new.
  const animName = `reward-ring-${index}`;
  let keyframes;
  let totalMs;

  if (N === 0) {
    const arcPct = Math.max(1, gain.newProgress - gain.oldProgress);
    totalMs      = (arcPct / 100) * 1500;
    const dur    = (totalMs / 1000).toFixed(2) + "s";
    keyframes    = `
      @keyframes ${animName} {
        0%   { stroke-dashoffset: ${oldOffset}; }
        100% { stroke-dashoffset: ${newOffset}; }
      }`;
    // Simple case: no label changes needed
    const tierInitial = gain.newTier ? gain.newTier[0] : "?";
    return `
      <style>${keyframes}</style>
      <div class="ring-wrap md">
        <svg viewBox="0 0 80 80" width="${px}" height="${px}" style="display:block;">
          <circle cx="40" cy="40" r="32"
                  fill="none" style="stroke:var(--progress-bg)" stroke-width="8"
                  stroke-dasharray="${RING_ARC} ${RING_CIRC}"
                  transform="rotate(${RING_ROTATION}, 40, 40)" />
          <circle cx="40" cy="40" r="32"
                  fill="none" stroke="${color}" stroke-width="8"
                  stroke-linecap="round"
                  stroke-dasharray="${RING_ARC} ${RING_CIRC}"
                  stroke-dashoffset="${oldOffset}"
                  transform="rotate(${RING_ROTATION}, 40, 40)"
                  style="animation: ${animName} ${dur} linear 0.4s forwards;" />
        </svg>
        <div class="ring-label">
          <span id="reward-label-${index}">${h(tierInitial)}${gain.newLevel}</span>
          <span class="ring-pct" id="reward-pct-${index}">${gain.newProgress}%</span>
        </div>
      </div>
    `;
  }

  // ── Multi-phase animation: N level-ups ──────────────────────────────────────
  // Fill phases: [100-old, ...full×(N-1), new]
  // Between each fill phase: 500ms reset pause
  const firstFill = 100 - gain.oldProgress;
  const lastFill  = gain.newProgress;
  const midFills  = N - 1; // full 100% fills between first and last
  const totalArcPct = firstFill + (midFills * 100) + lastFill;
  const fillMs    = (totalArcPct / 100) * 1500;
  const resetMs   = N * 500;
  totalMs         = fillMs + resetMs;
  const duration  = (totalMs / 1000).toFixed(2) + "s";

  // Build keyframe % positions by walking through time phases
  // Each fill phase takes (arcPct/100)*1500 ms, each reset takes 500ms.
  // We'll track cumulative ms and convert to keyframe %.
  // We include a 0.4s start delay (added to 0% offset position — keyframes
  // are computed relative to animation start, not wall time).
  const phases = [];
  let cumMs = 0;

  // Phase 0: fill from oldProgress → 100%
  const phase0Ms = (firstFill / 100) * 1500;
  phases.push({ pct: 0,                      offset: oldOffset  });
  phases.push({ pct: cumMs + phase0Ms,        offset: fullOffset });
  cumMs += phase0Ms;

  // Phases 1..N-1: each is reset-pause then full fill
  for (let i = 0; i < N - 1; i++) {
    // 500ms reset budget: hold at full for 450ms, snap empty in 50ms
    phases.push({ pct: cumMs + 450,           offset: fullOffset  }); // hold
    phases.push({ pct: cumMs + 500,           offset: emptyOffset }); // snap reset
    cumMs += 500;
    // fill 0 → 100%
    const fillPhaseMs = 1500;
    phases.push({ pct: cumMs + fillPhaseMs,   offset: fullOffset  });
    cumMs += fillPhaseMs;
  }

  // Final reset then fill to newProgress
  phases.push({ pct: cumMs + 450,             offset: fullOffset  }); // hold
  phases.push({ pct: cumMs + 500,             offset: emptyOffset }); // snap reset
  cumMs += 500;
  const lastFillMs = (lastFill / 100) * 1500;
  phases.push({ pct: cumMs + lastFillMs,      offset: newOffset   });
  cumMs += lastFillMs;

  // Normalize phase times to keyframe percentages (0–100 of totalMs)
  const keyframeStops = phases.map(p => {
    const kfPct = p.pct === 0 ? 0 : ((p.pct / totalMs) * 100).toFixed(1);
    return `${kfPct}% { stroke-dashoffset: ${p.offset}; }`;
  }).join("\n        ");

  keyframes = `
    @keyframes ${animName} {
      ${keyframeStops}
    }`;

  const tierInitial = gain.oldTier ? gain.oldTier[0] : "?"; // label starts at old tier/level

  return `
    <style>${keyframes}</style>
    <div class="ring-wrap md">
      <svg viewBox="0 0 80 80" width="${px}" height="${px}" style="display:block;">
        <circle cx="40" cy="40" r="32"
                fill="none" style="stroke:var(--progress-bg)" stroke-width="8"
                stroke-dasharray="${RING_ARC} ${RING_CIRC}"
                transform="rotate(${RING_ROTATION}, 40, 40)" />
        <circle cx="40" cy="40" r="32"
                fill="none" stroke="${color}" stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${RING_ARC} ${RING_CIRC}"
                stroke-dashoffset="${oldOffset}"
                transform="rotate(${RING_ROTATION}, 40, 40)"
                style="animation: ${animName} ${duration} linear 0.4s forwards;" />
      </svg>
      <div class="ring-label">
        <span id="reward-label-${index}">${h(tierInitial)}${gain.oldLevel}</span>
        <span class="ring-pct" id="reward-pct-${index}">${gain.oldProgress}%</span>
      </div>
    </div>
  `;
}

// Called by render.js after the reward screen HTML is in the DOM.
// Schedules one setTimeout per level-up event per badge to update the ring
// center label and trigger the CSS pulse. Cannot run inside innerHTML because
// browsers silently ignore <script> tags injected that way.
function initRewardAnimations() {
  const gains = state.rewardBadgeGains;
  if (!gains || !gains.length) return;

  gains.forEach(function(gain, index) {
    const N = gain.levelUpHistory ? gain.levelUpHistory.length : 0;
    if (N === 0) return;

    const firstFill = 100 - gain.oldProgress;
    const phase0Ms  = (firstFill / 100) * 1500;
    // accMs: wall-clock ms after page paint when each label change fires.
    // 400ms = animation start delay; phase0Ms = time to fill first level.
    let accMs = 400 + phase0Ms;

    gain.levelUpHistory.forEach(function(event, i) {
      const labelText = event.tier[0] + event.level;
      const delay     = Math.round(accMs);

      setTimeout(function() {
        var el = document.getElementById("reward-label-" + index);
        if (!el) return;
        el.textContent = labelText;
        var wrap = el.closest(".ring-label");
        if (wrap) {
          wrap.classList.remove("pulse");
          void wrap.offsetWidth; // force reflow so animation restarts cleanly
          wrap.classList.add("pulse");
          setTimeout(function() { wrap.classList.remove("pulse"); }, 400);
        }
      }, delay);

      // Each subsequent event: 500ms reset pause + 1500ms full level fill
      if (i < N - 1) accMs += 500 + 1500;
    });

    // After all level-up events, the animation does one final reset + fill to
    // newProgress. Update the pct label when that final fill completes so it
    // matches the ring's actual visual position rather than showing the end
    // value from the start.
    const finalPctDelay = Math.round(accMs + 500 + (gain.newProgress / 100) * 1500);
    setTimeout(function() {
      var pctEl = document.getElementById("reward-pct-" + index);
      if (pctEl) pctEl.textContent = gain.newProgress + "%";
    }, finalPctDelay);
  });
}

function renderReward() {
  const gains   = state.rewardBadgeGains;
  const title   = state.rewardLessonTitle;
  const totalXp = state.rewardXp;

  // Fallback if navigated here directly or after state wipe
  if (!gains || gains.length === 0) {
    return `
      <div class="card">
        <h1 class="title">Nice work!</h1>
        <p class="subtitle">Lesson complete.</p>
      </div>
      <div class="flow-footer">
        <!-- navGoTabRoot / navGoHome, never go(): both of these END a flow, and
             go() PUSHES. "Return Home" used to push "home" on top of the home
             stack, so Back replayed the reward you had just finished. -->
        <button class="button secondary" type="button" onclick="navGoTabRoot('learn')">Back to Learn</button>
        <button class="button full" type="button" onclick="navGoHome()">Return Home</button>
      </div>
    `;
  }

  const { xpBase, xpBonus } = gains[0];
  const hasBonus = xpBonus > 0;

  return `
    <!-- Compact header -->
    <div class="card" style="padding:12px 14px;text-align:center;">
      <h1 class="title" style="font-size:20px;margin-bottom:2px;">Great work!</h1>
      ${title ? `<p class="subtitle" style="margin:0;">${h(title)}</p>` : ""}
    </div>

    <!-- XP breakdown: base first, bonus as a second line (the reveal moment) -->
    <div class="card" style="padding:12px 14px;">
      <div class="row" style="padding:4px 0;">
        <span class="helper">Base XP</span>
        <span style="font-weight:850;">+${xpBase} XP</span>
      </div>
      ${hasBonus ? `
        <div class="row" style="padding:4px 0;border-top:1px solid var(--line);">
          <span class="helper" style="color:var(--warn);">⚡ Daily Bonus (${state.xpConfig.bonusMultiplier}×)</span>
          <span style="font-weight:850;color:var(--warn);">+${xpBonus} XP</span>
        </div>
      ` : ""}
      <div class="row" style="padding:8px 0 2px;border-top:2px solid var(--line);margin-top:2px;">
        <span style="font-weight:850;">Total per badge</span>
        <span style="font-size:18px;font-weight:850;color:var(--accent);">${xpBase + xpBonus} XP</span>
      </div>
      ${gains.length > 1 ? `
        <p class="helper" style="margin-top:4px;text-align:right;">${totalXp} XP across ${gains.length} badges</p>
      ` : ""}
    </div>

    <!-- Badge ring row: horizontal, one cell per badge.
         Each cell has a fixed-height indicator slot ABOVE the ring so all
         rings sit at the same vertical position regardless of level-up status.
         The ring animates through the full journey (see renderRewardRing). -->
    <div class="card" style="padding:14px;">
      <div style="display:flex;justify-content:space-around;gap:8px;">
        ${gains.map((gain, i) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;text-align:center;">

            <!-- Level-up indicator slot: fixed height so rings always align -->
            <div style="min-height:22px;display:flex;align-items:center;justify-content:center;">
              ${gain.tieredUp
                ? `<span class="reward-event-badge--warn">✦ Tier Up!</span>`
                : gain.leveledUp
                  ? `<span class="reward-event-badge">↑ Level Up</span>`
                  : ""}
            </div>

            <!-- Animated ring — fills through full journey -->
            ${renderRewardRing(gain, i)}

            <div style="font-size:11px;font-weight:850;line-height:1.3;margin-top:2px;">${h(gain.name)}</div>
            <div class="helper" style="font-size:10px;">${h(gain.newTier)} ${gain.newLevel}</div>
            <div style="font-size:10px;color:var(--good);font-weight:850;">+${xpBase + xpBonus} XP</div>
          </div>
        `).join("")}
      </div>
    </div>

    ${renderRewardPoints()}

    <div class="flow-footer" style="margin-top:8px;">
      <button class="button secondary" type="button" onclick="navGoTabRoot('learn')">Back to Learn</button>
      <button class="button full" type="button" onclick="navGoHome()">Return Home</button>
    </div>
  `;
}

// ── Charity Points, under the experience reward ──────────────────────────────
// This screen showed XP and badge rings and nothing else, while state.kibble
// quietly went up by two separate awards — the lesson's own, and the bones the
// home task card had promised. The tester saw neither, and the total was
// roughly double the figure on the card that sent them here.
//
// Both are real, so both are listed, each named for what earned it. A single
// merged number would read as the home card being wrong.
//
// Diamonds are the subscriber tier (L16). Off the trial nothing is credited,
// but the line still shows — a tier whose value is invisible is not a tier.
function renderRewardPoints() {
  const p = state.rewardPoints;
  if (!p || !p.entries.length) return "";

  const bones = p.entries.filter(e => e.kind === "bones");
  const diamonds = p.entries.filter(e => e.kind === "diamonds");
  const onTrial = state.trialAccepted === true;

  return `
    <div class="card" style="padding:12px 14px;">
      <p class="section-title" style="margin:0 0 8px;">Charity Points</p>

      ${bones.map(e => `
        <div class="row" style="padding:3px 0;">
          <span class="helper">${h(e.label)}</span>
          <span style="font-weight:850;">🦴 ${e.amount}</span>
        </div>`).join("")}

      ${bones.length > 1 ? `
        <div class="row" style="padding:6px 0 2px;border-top:1px solid var(--line);margin-top:4px;">
          <span style="font-weight:850;">Bones earned</span>
          <span style="font-weight:850;">🦴 ${p.bones}</span>
        </div>` : ""}

      ${diamonds.length ? diamonds.map(e => `
        <div class="row" style="padding:3px 0;border-top:1px solid var(--line);margin-top:4px;">
          <span class="helper">${h(e.label)} · subscriber</span>
          <span style="font-weight:850;">💎 ${e.amount}</span>
        </div>`).join("") : `
        <div class="row" style="padding:6px 0 2px;border-top:1px solid var(--line);margin-top:4px;">
          <span class="helper" style="opacity:.7;">Diamonds come with the subscription</span>
          <span class="helper" style="opacity:.7;">💎 ${LR_DIAMONDS_PER_LESSON} a lesson</span>
        </div>`}

      <p class="helper" style="margin:8px 0 0;font-size:10px;">
        ${onTrial
          ? "Points turn into donations. They don't unlock anything in the app."
          : "Points turn into donations. Bones come from showing up; diamonds come with the plan."}
      </p>
    </div>
  `;
}

// Read-only admin summary. Adjust lesson XP or badge progress in the Learn
// admin panel, then retake the lesson to change what appears here.
function renderRewardAdmin() {
  const gains = state.rewardBadgeGains;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Reward Output (read-only)</p>
      <p class="helper" style="margin-bottom:8px;">
        Set by completeLesson(). Adjust lesson XP or badge progress in the Learn
        admin panel, then retake the lesson to change what appears here.
      </p>
      ${gains && gains.length ? `
        <div style="font-size:12px;font-weight:850;margin-bottom:4px;">
          Lesson: ${h(state.rewardLessonTitle)}
        </div>
        <div style="font-size:12px;margin-bottom:8px;">Total XP: ${state.rewardXp}</div>
        ${gains.map(g => `
          <div style="font-size:11px;padding:6px 0;border-top:1px solid var(--line);">
            <strong>${h(g.name)}</strong>
            ${g.oldTier} ${g.oldLevel} (${g.oldProgress}%)
            → ${g.newTier} ${g.newLevel} (${g.newProgress}%)
            ${g.leveledUp ? ` ↑ leveled up (${g.levelUpHistory ? g.levelUpHistory.length : 1}×)` : ""}
          </div>
        `).join("")}
      ` : `<p class="helper">No reward data yet. Complete a lesson first.</p>`}
    </div>
  `;
}
