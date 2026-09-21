// ─── Daily update (08-video-updates, D27–D30) ────────────────────────────────
// TAB: None | NAV BAR: Hidden — full-bleed, the payoff moment
//
// "A personalized read on how the week is going — the tone of a financial
// podcast made for one person." An animated DOM sequence, not an encoded video
// (A9). Daily only (D27).
//
// ── THE SCRIPT / VISUAL SPLIT (D30) ──────────────────────────────────────────
// Scripts stay GENERALIZED. Visuals carry the numbers.
//
//   script: "You're spending more on eating out than most households like yours"
//   visual: 429 against 370, in an animating bar
//
// That is deliberate: one recorded script serves every user, and the figures
// stay accurate without re-recording audio. So no cue may read its number from
// the script — every one pulls live from state.
//
// ── TIMING (D29, L10) ────────────────────────────────────────────────────────
// One audio file per segment, so the <audio> element IS the clock and the
// segment index is exact rather than inferred from a playhead. Three tiers:
//
//   1. DAILY_TIMINGS   measured at generation (scripts/gen-audio.sh)
//   2. the static block in daily-scripts.json  — the spec's fallback
//   3. word count at 165 wpm                   — when a segment has neither
//
// Segment text and timings never share an object, and cues reference segment
// ids rather than timestamps, so a re-cut segment shifts everything after it
// and the visuals follow with no further edits.

const DU_WPM = 165;

function duScripts() { return DAILY_SCRIPTS.scripts || []; }

function duScript() {
  const id = state.du.scriptId;
  return duScripts().find(s => s.id === id) || duScripts().find(s => s.isDefault) || duScripts()[0];
}

function duSegments() {
  const s = duScript();
  return s ? s.segments : [];
}

/** Tier 1 → 2 → 3. Never reads a timestamp out of the script text. */
function duTiming(scriptId, segment) {
  const gen = (typeof DAILY_TIMINGS !== "undefined" && DAILY_TIMINGS[scriptId])
    ? DAILY_TIMINGS[scriptId][segment.id] : null;
  if (gen && gen.duration) return gen;

  const script = duScripts().find(s => s.id === scriptId);
  const stat = script && script.timings ? script.timings[segment.id] : null;
  if (stat && stat.duration) return stat;

  // A segment with no timing estimates from word count at 165 wpm.
  const words = String(segment.text || "").trim().split(/\s+/).length;
  return { start: null, duration: Math.round((words / DU_WPM) * 60000) };
}

function duTotalMs() {
  const id = duScript() ? duScript().id : "";
  return duSegments().reduce((t, seg) => t + duTiming(id, seg).duration, 0);
}

function duElapsedMs() {
  const id = duScript() ? duScript().id : "";
  return duSegments().slice(0, state.du.index)
    .reduce((t, seg) => t + duTiming(id, seg).duration, 0);
}

function duAudioSrc(segment) {
  const s = duScript();
  return s ? `assets/audio/daily/${s.id}/${segment.id}.wav` : "";
}

// ── Playback ─────────────────────────────────────────────────────────────────

function duStart(scriptId) {
  state.du = {
    scriptId: scriptId || (duScripts().find(s => s.isDefault) || duScripts()[0]).id,
    index: 0, playing: false, timer: null, finished: false
  };
  go("dailyUpdate");
}

function duPlay() {
  state.du.playing = true;
  state.du.finished = false;
  render();
  duCueSegment();
}

function duPause() {
  state.du.playing = false;
  duClearTimer();
  const a = document.getElementById("duAudio");
  if (a && a.pause) { try { a.pause(); } catch (e) {} }
  render();
}

function duClearTimer() {
  if (state.du.timer) { clearTimeout(state.du.timer); state.du.timer = null; }
}

/**
 * Play the current segment. The audio element drives advancement when it is
 * available; otherwise a timer using the same timing table does, so the
 * sequence is identical with the sound off (and under reduced motion).
 */
function duCueSegment() {
  duClearTimer();
  if (!state.du.playing) return;
  const segs = duSegments();
  const seg = segs[state.du.index];
  if (!seg) { duFinish(); return; }

  const a = document.getElementById("duAudio");
  const ms = duTiming(duScript().id, seg).duration;

  if (a) {
    try {
      a.src = duAudioSrc(seg);
      a.onended = duAdvance;
      const p = a.play();
      if (p && p.catch) p.catch(function () { duFallbackTimer(ms); });
    } catch (e) { duFallbackTimer(ms); }
  } else {
    duFallbackTimer(ms);
  }
}

// Autoplay blocked, file missing, or no audio element — the visuals still run.
function duFallbackTimer(ms) {
  state.du.timer = setTimeout(duAdvance, ms);
}

function duAdvance() {
  if (!state.du.playing) return;
  if (state.du.index >= duSegments().length - 1) { duFinish(); return; }
  state.du.index++;
  render();
  duCueSegment();
}

function duFinish() {
  duClearTimer();
  state.du.playing = false;
  state.du.finished = true;
  go("dailySummary");
}

function duSkipTo(i) {
  duClearTimer();
  state.du.index = Math.max(0, Math.min(i, duSegments().length - 1));
  render();
  if (state.du.playing) duCueSegment();
}

function duSelectVariant(id) {
  const wasPlaying = state.du.playing;
  duClearTimer();
  state.du = { scriptId: id, index: 0, playing: false, timer: null, finished: false };
  render();
  if (wasPlaying) duPlay();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderDailyUpdate() {
  if (!state.du || !state.du.scriptId) duStart();
  const segs = duSegments();
  const seg = segs[state.du.index];
  const pct = duTotalMs() ? Math.round((duElapsedMs() / duTotalMs()) * 100) : 0;

  return `
    <div class="du-shell">
      <audio id="duAudio" preload="auto"></audio>

      <div class="du-stage">${renderDuCue(seg)}</div>

      <div class="du-caption">
        <p class="du-text">${h(seg ? seg.text : "")}</p>
      </div>

      <div class="du-controls">
        <div class="du-progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div class="du-segs">
          ${segs.map((s, i) => `
            <button class="du-seg ${i === state.du.index ? "on" : ""}" type="button"
                    onclick="duSkipTo(${i})" aria-label="Segment ${i + 1}"></button>
          `).join("")}
        </div>
        <div class="du-buttons">
          <button class="button secondary" type="button" onclick="duSkipTo(${Math.max(0, state.du.index - 1)})">Back</button>
          <button class="button" type="button" onclick="${state.du.playing ? "duPause()" : "duPlay()"}">
            ${state.du.playing ? "Pause" : (state.du.index === 0 ? "Play" : "Resume")}
          </button>
          <button class="button secondary" type="button" onclick="duFinish()">Skip</button>
        </div>
      </div>
    </div>
  `;
}

// ── The eight visual cues ────────────────────────────────────────────────────
// Every number here is read live from state. The script never carries one.

function renderDuCue(seg) {
  const cue = seg ? seg.cue : "buddy_greeting";
  const fn = {
    buddy_greeting: duCueBuddy,
    streak_flame:   duCueStreak,
    bar_compare:    duCueBarCompare,
    number_reveal:  duCueNumberReveal,
    category_grid:  duCueCategoryGrid,
    goal_ring:      duCueGoalRing,
    bill_card:      duCueBillCard,
    summary_stack:  duCueSummaryStack
  }[cue];
  return fn ? fn() : duCueBuddy();
}

function duCueBuddy() {
  buddySetPoseQuiet(6);                       // paws raised, joyful
  return `<div class="du-cue du-cue-buddy">${renderBuddyStage({ compact: true })}</div>`;
}

// Reuses components/streak-counter.js rather than redrawing it.
function duCueStreak() {
  return `
    <div class="du-cue du-pulse">
      ${renderStreakCounter({ count: state.streak })}
      <p class="du-cue-label">day streak</p>
    </div>`;
}

// Reuses components/thermometer.js — two bars, user vs peer, user animates.
function duCueBarCompare() {
  const cat = "Dining out";
  const user = catValue(state.mtd, cat);
  const peer = benchPeerValue(cat, benchOptsForUser());
  // renderThermometer draws POSITIONS, not figures — it labels the two markers
  // "You" and "Households like yours" but prints no numbers. D30 requires the
  // visual to carry them, since the script deliberately does not, so the
  // figures are stated alongside the bar rather than left implicit.
  return `
    <div class="du-cue">
      <p class="du-cue-label">${h(catLabel(cat))} this month</p>
      <div class="du-compare">
        <div class="du-compare-side">
          <p class="du-figure du-figure-sm">${budgetFmt(user)}</p>
          <p class="du-cue-label">you</p>
        </div>
        <div class="du-compare-side">
          <p class="du-figure du-figure-sm du-figure-muted">${budgetFmt(peer)}</p>
          <p class="du-cue-label">households like yours</p>
        </div>
      </div>
      ${renderThermometer(user, peer, { higherIsBetter: false, userLabel: "You", peerLabel: "Peers" })}
    </div>`;
}

// Declared in visualCues.types but unused by all three shipped scripts. Built
// anyway — the type is clearly intended, and a variant added later would
// otherwise fall back to the buddy.
function duCueNumberReveal() {
  const total = catTotal(state.mtd);
  return `
    <div class="du-cue du-countup">
      <p class="du-figure">${budgetFmt(total)}</p>
      <p class="du-cue-label">spent so far this month</p>
    </div>`;
}

function duCueCategoryGrid() {
  const worst = cmpAllRows()
    .filter(r => r.vsPlan != null)
    .sort((a, b) => (b.vsPlan || 0) - (a.vsPlan || 0))[0];
  return `
    <div class="du-cue">
      <div class="du-grid">
        ${CATEGORIES.map(c => `
          <div class="du-tile ${worst && c === worst.category ? "on" : ""}">
            <span>${h(catLabel(c))}</span>
          </div>`).join("")}
      </div>
      ${worst ? `<p class="du-cue-label">${h(catLabel(worst.category))} · ${worst.vsPlan > 0 ? "+" : ""}${worst.vsPlan}% vs plan</p>` : ""}
    </div>`;
}

// A pace ring. components/badge-ring.js was checked for reuse and rejected: it
// is badge-semantic (tier colours, bonus dots), not a goal-pace dial.
function duCueGoalRing() {
  const goal = (state.tacticalGoals || []).find(g => g.pacePercent != null) || {};
  const pct = Math.max(0, Math.min(100, goal.pacePercent || 0));
  const C = 2 * Math.PI * 42;
  return `
    <div class="du-cue">
      <svg class="du-ring" viewBox="0 0 100 100" width="132" height="132" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--progress-bg)" stroke-width="9"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" stroke-width="9"
                stroke-linecap="round" transform="rotate(-90 50 50)"
                stroke-dasharray="${C}" stroke-dashoffset="${C - (pct / 100) * C}"/>
      </svg>
      <p class="du-figure du-figure-sm">${pct}%</p>
      <p class="du-cue-label">of the pace you set${goal.label ? " · " + h(goal.label) : ""}</p>
    </div>`;
}

function duCueBillCard() {
  const bill = (state.bills || []).find(b => b.flagged) || (state.bills || [])[0];
  if (!bill) return duCueBuddy();
  return `
    <div class="du-cue du-slide-in">
      <div class="card du-bill">
        <p class="task-title" style="margin:0 0 2px;">${h(bill.name)}</p>
        <p class="du-figure du-figure-sm">${budgetFmt(bill.amount)}</p>
        <p class="du-cue-label">due in ${h(bill.dueInDays)} days${bill.inBudget ? "" : " · not in your budget"}</p>
      </div>
    </div>`;
}

function duCueSummaryStack() {
  const obs = (state.observations || []).slice(0, 3);
  return `
    <div class="du-cue du-stack">
      ${obs.map((o, i) => `
        <div class="card du-stack-card" style="--i:${i};">
          <p class="task-title" style="margin:0 0 2px;font-size:13px;">${h(observationHeadline(o))}</p>
          <p class="helper" style="margin:0;font-size:11px;">${h(observationDetail(o))}</p>
        </div>`).join("")}
    </div>`;
}

// Set a pose without triggering a render — we are already inside one.
function buddySetPoseQuiet(id) { state.buddyPose = id; }

function renderDailyUpdateAdmin() {
  const s = duScript();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Daily Update</p>
      <div class="input-group">
        <label>Engagement variant (all 3 selectable, A10)</label>
        <select onchange="duSelectVariant(this.value)">
          ${duScripts().map(x => `
            <option value="${h(x.id)}" ${s && s.id === x.id ? "selected" : ""}>
              ${h(x.variant)}${x.isDefault ? " (default)" : ""}
            </option>`).join("")}
        </select>
      </div>
      <div class="input-group">
        <label>Segment ${state.du.index + 1} of ${duSegments().length}</label>
        <div class="helper" style="line-height:1.8;">
          ${duSegments().map((seg, i) => {
            const t = duTiming(s.id, seg);
            const src = (typeof DAILY_TIMINGS !== "undefined" && DAILY_TIMINGS[s.id] && DAILY_TIMINGS[s.id][seg.id])
              ? "measured" : (s.timings && s.timings[seg.id] ? "spec" : "165wpm");
            return `${i === state.du.index ? "<strong>" : ""}${h(seg.id)} · ${h(seg.cue)} · ${t.duration}ms <em>(${src})</em>${i === state.du.index ? "</strong>" : ""}`;
          }).join("<br>")}
        </div>
      </div>
      <p class="helper" style="font-size:10px;">
        Total ${Math.round(duTotalMs() / 100) / 10}s. Timings are measured at
        generation (L10) — boundary events don't fire for recorded audio.
      </p>
    </div>
  `;
}
