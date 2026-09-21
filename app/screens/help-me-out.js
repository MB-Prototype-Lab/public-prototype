// ─── Help me out — the screen ────────────────────────────────────────────────
// TAB: Budget (sub-screen) | NAV BAR: Hidden — full-bleed
//
// Two stages for one category:
//
//   ask      every question on ONE screen, revealing as the previous one is
//            answered, with a running figure at the top
//   confirm  the figure on a band slider, against what peers who answered the
//            same way spend, and a button. No checkbox — the slider and the
//            button ARE the affirmative, and a tick box on top of them is a
//            third thing to do to a decision already made twice.
//
// The queue lives on state.budgetBuild: hand three lines over and you answer
// all three back to back, then land on the next step. It used to bounce back to
// the builder after each one with the toggle still lit, so Continue had to be
// pressed again for a question it had already asked.

function hmoStart(category, opts) {
  if (!isCategory(category) || !hmoHasTree(category)) return;
  state.helpMeOut = {
    category: category,
    answers: hmoSeedAnswers(category),
    stage: "ask",
    value: null,
    // Frozen when the confirm step opens. Derived from the value it carries,
    // so recomputing it per render would move the track under the thumb.
    sliderMax: null,
    target: (opts && opts.target) || "budget"
  };
  go("helpMeOut");
}

function hmoSession() { return state.helpMeOut || null; }

function hmoSetAnswer(qid, value) {
  const s = hmoSession();
  if (!s) return;
  s.answers[qid] = value;
  // Answering an earlier question can hide a later one — picking "no car"
  // after choosing a vehicle leaves a vehicle answer describing a car that no
  // longer exists, and it would still be in the arithmetic.
  hmoDropHidden(s);
  render();
}

/** Discard answers to questions the current answers no longer reveal. */
function hmoDropHidden(s) {
  const t = hmoTree(s.category);
  if (!t) return;
  t.questions.forEach(q => {
    if (!hmoQuestionShows(q, s.answers) && s.answers[q.id] != null) delete s.answers[q.id];
  });
}

// Sliders: debouncedRender, never render — a full repaint replaces the element
// being dragged and the thumb stops tracking the pointer.
function hmoSetSlider(qid, value) {
  const s = hmoSession();
  if (!s) return;
  s.answers[qid] = Math.round(Number(value) || 0);
  const el = document.getElementById("hmoSlide_" + qid);
  if (el) el.textContent = hmoSliderReadout(s.category, qid, s.answers[qid]);
  const run = document.getElementById("hmoRunning");
  if (run) run.textContent = budgetFmt(hmoCompute(s.category, s.answers));
  debouncedRender();
}

function hmoSliderReadout(category, qid, value) {
  const t = hmoTree(category);
  const q = (t.questions || []).find(x => x.id === qid);
  return String(value) + (q && q.unit ? " " + q.unit : "");
}

/** Checklist: tick one on or off. */
function hmoToggleOption(qid, optId) {
  const s = hmoSession();
  if (!s) return;
  const list = Array.isArray(s.answers[qid]) ? s.answers[qid].slice() : [];
  const i = list.indexOf(optId);
  if (i === -1) list.push(optId); else list.splice(i, 1);
  s.answers[qid] = list;
  render();
}

function hmoToConfirm() {
  const s = hmoSession();
  if (!s || !hmoComplete(s.category, s.answers)) return;
  s.value = hmoCompute(s.category, s.answers);
  // Frozen for the whole confirm step. The computed figure can sit above the
  // budget tab's usual ceiling — a four-bedroom in Los Angeles does — so the
  // track has to be able to hold it, but it must not then move as the tester
  // drags within it.
  s.sliderMax = Math.max(budgetSliderMax(s.category), Math.ceil((s.value * 1.6) / 50) * 50);
  s.stage = "confirm";
  render();
}

function hmoAdjust(value) {
  const s = hmoSession();
  if (!s) return;
  s.value = Math.max(0, Math.min(s.sliderMax, Math.round(Number(value) || 0)));
  const el = document.getElementById("hmoFigure");
  if (el) el.textContent = budgetFmt(s.value);
  debouncedRender();
}

function hmoBack() {
  const s = hmoSession();
  if (!s) return;
  if (s.stage === "confirm") { s.stage = "ask"; render(); return; }
  hmoCancel();
}

/**
 * Take the figure and move on.
 *
 * Writes what the answers said about how they live as well as what they cost —
 * nothing in the v3.1 flow has updated state.lifestyle since the six lifestyle
 * questions retired, so every peer band elsewhere has been running on the
 * persona's seeded answers.
 */
function hmoAccept() {
  const s = hmoSession();
  if (!s) return;
  hmoApplyLifestyle(s.category, s.answers);
  if (typeof bbApplyHelp === "function") bbApplyHelp(s.category, s.value);
  state.helpMeOut = null;
  hmoAdvanceQueue();
}

/** Backing out hands the line back rather than leaving it flagged. */
function hmoCancel() {
  const s = hmoSession();
  if (!s) return;
  const b = state.budgetBuild;
  if (b && b.help && b.help[s.category]) delete b.help[s.category];
  state.helpMeOut = null;
  hmoAdvanceQueue();
}

/**
 * The next handed-over line, or out of the queue entirely.
 *
 * Advancing the STEP here rather than returning to it is the owner's call:
 * every category in the queue has already had its own confirm slider, so
 * landing back on the step to press Continue again asks for a decision that has
 * been made once per line already.
 */
function hmoAdvanceQueue() {
  const b = state.budgetBuild;
  if (!b) { navGoTabRoot("aboutMe"); return; }
  const next = bbPendingHelp();
  if (next.length) { hmoStart(next[0]); return; }
  go("budgetBuild");
  bbAdvanceStep();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderHelpMeOut() {
  const s = hmoSession();
  // D19 — an admin jump with no session behind it.
  if (!s) {
    return `
      <div class="card">
        <h1 class="title" style="font-size:20px;margin:0 0 6px;">Nothing to work out yet</h1>
        <p class="helper" style="margin:0;">
          This turns up when you hand a budget line over — it asks how you live
          rather than what you spend, and works the figure out from there.
        </p>
      </div>
      <div class="flow-footer">
        <button class="button secondary" type="button" onclick="navGoTabRoot('aboutMe')">Back to Budget</button>
      </div>`;
  }
  return s.stage === "confirm" ? renderHmoConfirm(s) : renderHmoAsk(s);
}

function renderHmoAsk(s) {
  const t = hmoTree(s.category);
  const visible = hmoVisibleQuestions(s.category, s.answers);
  const done = hmoComplete(s.category, s.answers);
  const running = hmoCompute(s.category, s.answers);
  const answeredAny = t.questions.some(q => q.type !== "slider" && s.answers[q.id] != null);
  const queued = bbPendingHelp().length;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">
          ${h(catLabel(s.category))}${queued > 1 ? " · " + queued + " lines to go" : ""}
        </p>
        <h1 class="title" style="font-size:21px;margin:0;">Let me work this out</h1>
        ${t.intro ? `<p class="helper" style="margin:6px 0 0;">${h(t.intro)}</p>` : ""}
      </div>

      <div class="journal-body">
        ${answeredAny ? `
          <div class="hmo-running">
            <span class="helper">Adding up to</span>
            <span class="hmo-running-figure" id="hmoRunning">${budgetFmt(running)}</span>
          </div>` : ""}

        ${visible.map((q, i) => renderHmoQuestion(q, s, i === visible.length - 1 && !done)).join("")}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="hmoBack()">Cancel</button>
        <button class="button" type="button" onclick="hmoToConfirm()" ${done ? "" : "disabled"}>
          ${done ? "See the figure" : "Keep going"}
        </button>
      </div>
    </div>`;
}

function renderHmoQuestion(q, s, isOpen) {
  const given = s.answers[q.id];

  if (q.type === "slider") {
    const v = hmoSliderValue(q, s.answers);
    return `
      <div class="hmo-q ${isOpen ? "is-open" : ""}">
        <p class="hmo-q-prompt">${h(q.prompt)}</p>
        ${q.help ? `<p class="helper" style="margin:0 0 10px;font-size:11px;">${h(q.help)}</p>` : ""}
        <div class="row" style="align-items:baseline;margin-bottom:6px;">
          <span class="helper"></span>
          <span class="hmo-slider-readout" id="hmoSlide_${h(q.id)}">${h(hmoSliderReadout(s.category, q.id, v))}</span>
        </div>
        <input class="journal-slider" type="range"
               min="${q.min}" max="${q.max}" step="${q.step}" value="${v}"
               oninput="hmoSetSlider('${h(q.id)}', this.value)"
               aria-label="${h(q.prompt)}">
      </div>`;
  }

  if (q.type === "checklist") {
    const picked = Array.isArray(given) ? given : [];
    const prices = (hmoTree(s.category).rates || {}).services || {};
    return `
      <div class="hmo-q ${isOpen ? "is-open" : ""}">
        <p class="hmo-q-prompt">${h(q.prompt)}</p>
        ${q.help ? `<p class="helper" style="margin:0 0 10px;font-size:11px;">${h(q.help)}</p>` : ""}
        <div class="hmo-checklist">
          ${q.options.map(o => {
            const on = picked.indexOf(o.id) !== -1;
            const price = Number(prices[o.id]);
            return `
              <button class="hmo-check ${on ? "on" : ""}" type="button"
                      role="checkbox" aria-checked="${on ? "true" : "false"}"
                      onclick="hmoToggleOption('${h(q.id)}','${h(o.id)}')">
                <span class="hmo-check-box" aria-hidden="true">${on ? "✓" : ""}</span>
                <span class="hmo-check-label">${h(o.label)}</span>
                <span class="hmo-check-price">${isFinite(price) ? budgetFmt(price) : ""}</span>
              </button>`;
          }).join("")}
        </div>
      </div>`;
  }

  return `
    <div class="hmo-q ${isOpen ? "is-open" : ""}">
      <p class="hmo-q-prompt">${h(q.prompt)}</p>
      ${q.help ? `<p class="helper" style="margin:0 0 10px;font-size:11px;">${h(q.help)}</p>` : ""}
      <div class="journal-options">
        ${q.options.map(o => `
          <button class="journal-opt ${given === o.id ? "picked" : ""}" type="button"
                  onclick="hmoSetAnswer('${h(q.id)}','${h(o.id)}')">
            <span class="journal-opt-label">${h(o.label)}</span>
          </button>`).join("")}
      </div>
    </div>`;
}

/**
 * The figure, on a track, against people who answered the same way.
 *
 * The band is conditioned on their own answers, not on their profile alone: a
 * tester who honestly says "most nights" must not be shown a band built from
 * people who cook and told they are overspending. Where lifestyle reaches
 * nothing — Utilities, Subscriptions, Medical, Personal care, Debt payments —
 * it falls back to the profile band and the copy says so instead.
 */
function renderHmoConfirm(s) {
  const conditioned = hmoBandIsConditioned(s.category, s.answers);
  const peer = hmoPeerValue(s.category, s.answers);
  const g = budgetBandGeometry({ budget: s.value, actual: 0, peer: peer, hi: s.sliderMax });
  const queued = bbPendingHelp().length;

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">${h(catLabel(s.category))}</p>
        <h1 class="title" style="font-size:21px;margin:0;">Here's what I'd put down</h1>
        <p class="helper" style="margin:6px 0 0;">
          Move it if you know better — this is a starting figure, not a verdict.
        </p>
      </div>

      <div class="journal-body">
        <div class="card">
          <p class="hmo-figure" id="hmoFigure">${budgetFmt(s.value)}</p>
          <p class="helper" style="margin:0 0 14px;">a month</p>

          <p class="band-caption" style="margin-bottom:9px;">
            <span>${conditioned
              ? "Peers who answered like you"
              : "Peers like you"} <strong>${budgetFmt(g.peerLo)}–${budgetFmt(g.peerHi)}</strong></span>
          </p>

          ${renderBudgetBandSlider({
            category: s.category,
            value: s.value,
            peer: peer,
            max: s.sliderMax,
            oninput: "hmoAdjust(this.value)"
          })}

          <p class="helper" style="margin:10px 0 0;font-size:10px;">
            ${conditioned
              ? "That range is what people who answered these questions the same way spend — not people in general."
              : "Nothing you told me here changes who counts as a peer for this one, so that range is households your size, income and area."}
          </p>
        </div>
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="hmoBack()">Back</button>
        <button class="button" type="button" onclick="hmoAccept()">
          ${queued > 1 ? "Use this — next line" : "Use this"}
        </button>
      </div>
    </div>`;
}

function renderHelpMeOutAdmin() {
  const s = hmoSession();
  if (!s) {
    return `<div class="admin-card"><p class="admin-card-title">Help me out</p>
      <p class="helper">Not running. Opened from a handed-over budget line.</p></div>`;
  }
  const t = hmoTree(s.category);
  return `
    <div class="admin-card">
      <p class="admin-card-title">Help me out — ${h(catLabel(s.category))}</p>
      <p class="helper" style="margin-bottom:10px;">
        model <strong>${h(t.model)}</strong> · col <strong>${h(t.col)}</strong> ·
        x${hmoColMultiplier(s.category).toFixed(3)} · stage <strong>${h(s.stage)}</strong>
      </p>
      <div class="input-group">
        <label>Answers</label>
        <div class="helper" style="line-height:1.7;">
          ${t.questions.map(q => {
            const a = s.answers[q.id];
            const shown = hmoQuestionShows(q, s.answers);
            return `${h(q.id)}: <strong>${h(Array.isArray(a) ? (a.join(", ") || "none") : (a == null ? "—" : a))}</strong>${shown ? "" : " <em>(hidden)</em>"}`;
          }).join("<br>")}
        </div>
      </div>
      <div class="input-group">
        <label>Computed</label>
        <div class="helper">
          ${budgetFmt(hmoCompute(s.category, s.answers))} · peer for these answers
          ${budgetFmt(hmoPeerValue(s.category, s.answers))} · plain profile peer
          ${budgetFmt(benchPeerValue(s.category, benchOptsForUser()))}
        </div>
      </div>
      <div class="input-group">
        <label>Queue</label>
        <div class="helper">${bbPendingHelp().map(h).join(", ") || "last one"}</div>
      </div>
    </div>`;
}
