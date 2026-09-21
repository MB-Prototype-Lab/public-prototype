// ─── Lesson Screen (Audiobook Player) ────────────────────────────────────────
// Full-height, no-scroll, three-section layout. Nav hidden by render.js.
//   Top:    staging area (accent bg, waveform, title, back button)
//   Middle: subtitle strip (prev / current / next sentence)
//   Bottom: audio controls (skip, play/pause/replay, speed, progress, Next)
//
// LP_SCRIPTS keyed by lesson ID — swap only the script to replace content.

const LP_SCRIPTS = {
  "interest-builds": [
    "Interest is the cost of borrowing money — or the reward for saving it.",
    "When you carry a balance on a credit card, interest is charged on what you owe.",
    "The tricky part: interest is calculated on your current balance, including interest already added.",
    "This is called compound interest, and it can work against you faster than you'd expect.",
    "A $1,000 balance at 24% APR grows by about $20 every month — even if you stop spending.",
    "After a year of minimum payments, you could owe more than you started with.",
    "The earlier you pay down a balance, the less interest gets a chance to compound.",
    "Understanding this is the first step to staying ahead of your debt, not behind it."
  ],
  "interest-refresher": [
    "Quick recap: interest compounds on your outstanding balance, not just the original amount.",
    "Higher APR means faster growth — 24% is roughly twice as costly as 12%.",
    "Paying more than the minimum each month cuts the compounding cycle short.",
    "Even small extra payments early make a significant difference over time."
  ],
  "budget-basics": [
    "A budget is a plan for your money before you spend it.",
    "The simplest approach: list your monthly income, then list your fixed expenses.",
    "What's left after essentials is your discretionary spending — the part you control.",
    "Even a rough budget is better than no budget — it makes invisible spending visible.",
    "Review it monthly. Your budget should reflect your life, not someone else's template."
  ],

  // ── Credit Cards ──
  "minimum-payments-trap": [
    "The minimum payment keeps your account in good standing — but barely.",
    "Most of your payment goes to interest, not the balance itself.",
    "At 24% APR, a $3,000 balance on minimums takes over 10 years to clear.",
    "The bank profits when you pay slowly — minimum payments are designed that way.",
    "Even $50 extra per month cuts years off your payoff timeline."
  ],

  // ── Emergency Fund ──
  "three-month-rule": [
    "An emergency fund is money set aside for the unexpected — job loss, medical bills, car repairs.",
    "The standard target: three to six months of essential expenses.",
    "Three months covers most short-term disruptions without requiring you to borrow.",
    "Without it, a single unexpected expense can push you into credit card debt.",
    "Start small — even $500 creates a buffer that breaks the debt cycle."
  ],
  "where-to-keep-it": [
    "Your emergency fund should be easy to access but not easy to spend.",
    "A high-yield savings account earns interest while keeping the money separate from daily spending.",
    "Avoid investing your emergency fund — markets drop exactly when emergencies happen.",
    "Separation from your checking account is the feature, not a bug."
  ],

  // ── Car Buying ──
  "total-cost-of-ownership": [
    "The sticker price is only one part of what a car actually costs.",
    "Insurance, fuel, maintenance, and registration add thousands per year.",
    "Depreciation is the hidden cost — most cars lose 15–20% of value in year one.",
    "A cheaper car with lower insurance and better fuel economy often wins over time.",
    "Total cost of ownership is the real number to compare, not monthly payment."
  ],
  "loan-vs-lease": [
    "Leasing means lower monthly payments, but you never own the car.",
    "Loans cost more monthly, but once paid off, you own an asset outright.",
    "Leasing makes sense if you want a new car every few years and drive low mileage.",
    "Buying makes sense if you plan to keep the car long-term and avoid mileage limits.",
    "Neither is universally better — it depends on how you use the car."
  ],

  // ── Home Buying ──
  "what-you-can-afford": [
    "A common rule: spend no more than 28% of your gross income on housing.",
    "Lenders look at your debt-to-income ratio — total monthly debt vs monthly income.",
    "Getting pre-approved tells you your actual budget, not just what you hope to spend.",
    "Stretching your budget for a home leaves no room for repairs, taxes, or life.",
    "Affordable means comfortable at your income today, not assuming a future raise."
  ],
  "hidden-costs-buying": [
    "Closing costs typically add 2–5% of the purchase price on top of your down payment.",
    "Property taxes vary by location and recalculate when you buy — budget carefully.",
    "HOA fees in condos or planned communities can run hundreds per month.",
    "A 1% annual maintenance reserve is a standard rule — $5,000 per year on a $500K home.",
    "First-time buyers often underestimate the gap between mortgage payment and total housing cost."
  ],

  // ── Retirement ──
  "why-start-now": [
    "Compound growth rewards people who start early more than people who save more later.",
    "Someone investing $200/month at 25 can end up with more than someone investing $400/month starting at 35.",
    "The math works because returns generate their own returns over time.",
    "Every year you wait costs more to make up for — the catch-up is not linear.",
    "Even a small amount invested now beats a larger amount invested later."
  ],
  "401k-and-the-match": [
    "A 401k is a retirement account your employer typically offers through your job.",
    "Many employers match a percentage of what you contribute — free money added to your account.",
    "Not contributing enough to get the full match is leaving part of your compensation on the table.",
    "Contributions reduce your taxable income now — you pay taxes when you withdraw in retirement.",
    "The match is the highest guaranteed return you'll find — always take it first."
  ],

  // ── Student Loans ──
  "federal-vs-private": [
    "Federal student loans come from the government; private loans come from banks and lenders.",
    "Federal loans offer income-driven repayment plans that private loans rarely provide.",
    "Federal loans can be paused during hardship — private loans usually can't.",
    "Interest rates on federal loans are fixed; private loan rates can be variable.",
    "Exhaust federal options before turning to private lenders — the protections are worth it."
  ],
  "income-driven-repayment": [
    "Income-driven repayment caps your federal loan payment as a percentage of your discretionary income.",
    "If your income is low, your payment can be as low as zero dollars per month.",
    "Balances remaining after 20–25 years may be forgiven, depending on the plan.",
    "IDR is not free — interest still accrues, and forgiven amounts may be taxed."
  ],

  // ── Health Insurance ──
  "deductible-vs-premium": [
    "Your premium is what you pay monthly to have insurance, whether you use it or not.",
    "Your deductible is what you pay out-of-pocket before insurance starts covering costs.",
    "High-deductible plans have lower premiums but leave you exposed to larger bills.",
    "Low-deductible plans cost more monthly but protect you if something major happens.",
    "The right choice depends on how often you use healthcare and how much risk you can absorb."
  ],
  "hsa-basics": [
    "A Health Savings Account lets you save pre-tax money for medical expenses.",
    "Contributions, growth, and withdrawals for medical costs are all tax-free — a triple benefit.",
    "HSAs are only available if you have a high-deductible health plan.",
    "Unused funds roll over every year — this is not a use-it-or-lose-it account."
  ],

  // ── Investments ──
  "index-funds-explained": [
    "An index fund tracks a market index — like the S&P 500 — instead of picking individual stocks.",
    "Because they don't require active management, fees are extremely low.",
    "Decades of data show most actively managed funds underperform low-cost index funds over time.",
    "You get instant diversification across hundreds of companies with a single fund.",
    "Index funds are not exciting — that's precisely why they work for most investors."
  ],
  "risk-and-time-horizon": [
    "Risk in investing means the chance your investment loses value — sometimes dramatically.",
    "Time horizon is how long before you need the money.",
    "If you have 30 years, short-term market drops don't matter much — time corrects them.",
    "If you need the money in 2 years, a market drop at the wrong moment is a real problem.",
    "Match your risk to your timeline: longer horizon, more stocks; shorter, more bonds."
  ]
};

// ─── Playback state ───────────────────────────────────────────────────────────
// All playback variables live in state.lessonPlayback (state.js).
// Consolidated there so navigation resets them cleanly and render.js doesn't
// need to read globals from lesson.js.

// ─── Timing model ─────────────────────────────────────────────────────────────
// Playback runs on a virtual elapsed-time clock (seconds) against a per-line
// CUE map — cues[i] = the second at which subtitle line i starts — plus a
// TOTAL track length. Lessons with real narration timing get an LP_TIMINGS
// entry; every other lesson synthesizes an even LP_DEFAULT_LINE_SEC-per-line
// cadence, so ONE engine drives them all and every lesson gets the continuous
// bar. Lessons in LP_AUDIO additionally drive the clock off a real <audio>
// element (elapsed ← currentTime, total ← duration, play/pause/seek/rate → the
// element); the cue→line and elapsed→bar derivation below is unchanged.
// Floor and inter-sentence beat for the synthesized cue map. A flat
// seconds-per-line constant used to stand here (10s), which is roughly double
// what a sentence takes to say — so every line ended with a long silence while
// the visuals crawled through a fade sized as a fraction of that inflated
// runtime. Cues come from word count now, at the same pace the narration
// actually runs.
const LP_MIN_LINE_SEC   = 2.4;
const LP_LINE_GAP_SEC   = 0.35;

const LP_TIMINGS = {
  // APR lesson ("How Interest Builds") — TurboScribe cue times from the real
  // narration, one per LP_SCRIPTS line. `total` is a fallback for the first
  // render frame; the true length comes from audio.duration once metadata
  // loads (the WAV decodes to ~51.24s).
  "interest-builds": { cues: [0, 6, 11, 20, 26, 35, 41, 46], total: 51.2 }
};

// Lessons with a narration audio file. The src resolves relative to the app
// document (versions/<name>/index.html). When present, playback is driven by
// the real audio element instead of the virtual clock; absent → virtual clock.
const LP_AUDIO = {
  "interest-builds": "assets/audio/interest-builds.wav"
};

function lpHasAudio() {
  return !!LP_AUDIO[state.lessonPlayback.currentLessonId];
}

/**
 * Speak the sentence currently on screen.
 *
 * Only `interest-builds` has a generated .wav, so every other lesson — the new
 * APR video included — plays silently. This gives them a voice on any machine
 * (see js/narration.js for why runtime speech rather than L10's .wav).
 *
 * Deliberately does NOT drive advancement: the virtual clock and its cues stay
 * authoritative, and speech rides along beside them. Letting `onend` advance
 * would put the captions and the hyperframes animation on two different clocks
 * that drift apart, and the animation is choreographed against the cue times.
 */
// ── THE SYNC CONTRACT (architecture §10) ─────────────────────────────────────
// With a generated .wav the element IS the clock and everything already lines
// up. Without one — which is every lesson but interest-builds — the clock was a
// 165 wpm word-count estimate while the voice read at the browser's own pace.
// The two separate within a few lines: the caption moves on mid-sentence and
// the scrub bar agrees with neither.
//
// So when live speech is driving, SPEECH is the clock. The line index is pinned
// on `onStart` and only advances on `onEnd`; lpTick still runs the bar smoothly
// but is capped inside the current line's window (lpSpeechCap), so it can never
// overtake the voice. The estimate survives as the total-length figure and as
// the fallback where there is no speech engine at all.
function lpSpeakCurrent() {
  const lp = state.lessonPlayback;
  if (lpHasAudio() || !lp.playing) return;
  if (typeof narrationSpeak !== "function") return;

  const idx = lp.index;
  const started = narrationSpeak(lp.sentences[idx], {
    rate: lp.speed || 1,
    onStart: function () {
      const l = state.lessonPlayback;
      if (!l || l.index !== idx) return;      // superseded by a seek
      l.speechDriven = true;
      // The caption on screen is provably the line being spoken right now, so
      // pin the clock to its cue -- but FORWARDS ONLY. lpSpeechCap lets the
      // tick run to just short of the next cue, so elapsed is normally ahead of
      // this line's start; snapping down would rewind the hyperframes and show
      // as a flicker at every line boundary.
      l.elapsed = Math.max(l.elapsed, l.cues[idx] || 0);
      l.lastTick = Date.now();
      lpUpdateProgress();
      lpSyncHyperframes();
    },
    onEnd: function () {
      const l = state.lessonPlayback;
      if (!l || !l.playing || l.index !== idx) return;
      if (idx >= l.sentences.length - 1) { lpEnd(); return; }
      l.index = idx + 1;
      l.elapsed = l.cues[l.index] || l.elapsed;
      l.lastTick = Date.now();
      lpHighlight(l.index);
      lpUpdateProgress();
      lpSyncHyperframes();
      lpSpeakCurrent();
    },
    onError: function () {
      // No voice after all — hand the clock back to the estimate.
      const l = state.lessonPlayback;
      if (l) l.speechDriven = false;
    }
  });
  if (!started) lp.speechDriven = false;
}

/**
 * Ceiling for the virtual clock while speech drives it: just inside the current
 * line's window, so the bar keeps moving but the caption cannot advance ahead
 * of the voice. Without a cap a fast estimate would run the whole film while
 * the narrator was still on line three.
 */
function lpSpeechCap(lp) {
  const next = lp.cues[lp.index + 1];
  if (next == null) return lp.total;
  return Math.max(lp.cues[lp.index] || 0, next - 0.05);
}

/**
 * Is the clock pinned at that cap, waiting for the voice?
 *
 * The hyperframes have to be held too. lpTick freezes `elapsed` at the cap, but
 * the animations are native CSS on wall clock and kept running -- so every tick
 * found them ahead of the frozen clock and hyperframesSync's drift check yanked
 * them backwards, over and over, for the length of the overrun. Same defect as
 * the onboarding film's (onbVideoHeld), same fix.
 */
function lpHeld(lp) {
  return !!(lp && lp.speechDriven && lp.elapsed >= lpSpeechCap(lp) - 0.001);
}

function lpStopSpeaking() {
  const lp = state.lessonPlayback;
  if (lp) lp.speechDriven = false;
  if (typeof narrationCancel === "function") narrationCancel();
}

function lpAudioEl() {
  return document.getElementById("lp-audio");
}

/**
 * How long a line takes to say: word count at DU_WPM, the pace the daily
 * update and the onboarding narrator both run at, so retuning that one knob
 * moves every narrated surface. Floored so a three-word line still reads.
 */
function lpLineSec(line) {
  const words = String(line || "").trim().split(/\s+/).filter(Boolean).length;
  const wpm = (typeof DU_WPM !== "undefined" && DU_WPM) || 165;
  return Math.max(LP_MIN_LINE_SEC, (words / wpm) * 60) + LP_LINE_GAP_SEC;
}

/** Cue map from the script itself — cues[i] is when line i starts. */
function lpCuesFromWords(sentences) {
  const cues = [];
  let t = 0;
  (sentences || []).forEach(line => { cues.push(t); t += lpLineSec(line); });
  return { cues, total: Math.max(1, t) };
}

// Returns { cues, total } for a lesson. Uses the authored timing when it exists
// and matches the line count; otherwise derives cues from the script's own word
// counts, so a short line is short and a long one has room.
function lpTimingFor(lessonId, lineCount, sentences) {
  const t = LP_TIMINGS[lessonId];
  if (t && t.cues && t.cues.length === lineCount) return t;
  return lpCuesFromWords(sentences || []);
}

// Index of the line currently being spoken: the last cue whose start ≤ elapsed.
function lpIndexForElapsed(elapsed, cues) {
  let idx = 0;
  for (let i = 0; i < cues.length; i++) {
    if (elapsed >= cues[i]) idx = i; else break;
  }
  return idx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lpFmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function lpHighlight(index) {
  const prev = document.getElementById("lp-prev");
  const curr = document.getElementById("lp-curr");
  const next = document.getElementById("lp-next");
  if (prev) prev.textContent = state.lessonPlayback.sentences[index - 1] || "";
  if (curr) curr.textContent = state.lessonPlayback.sentences[index]     || "";
  if (next) next.textContent = state.lessonPlayback.sentences[index + 1] || "";
}

function lpUpdateProgress() {
  // Bar + time come from the real elapsed clock, so both move continuously
  // rather than jumping once per line.
  const lp  = state.lessonPlayback;
  const pct = lp.total > 0 ? (lp.elapsed / lp.total) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  const bar = document.getElementById("lp-bar");
  if (bar) bar.style.width = clamped.toFixed(2) + "%";

  const knob = document.getElementById("lp-knob");
  if (knob) knob.style.left = clamped.toFixed(2) + "%";
  const track = document.getElementById("lp-progress");
  if (track) track.setAttribute("aria-valuenow", String(Math.round(clamped)));

  const timeEl = document.getElementById("lp-time");
  if (timeEl) timeEl.textContent = lpFmtTime(Math.round(lp.elapsed));
}

// ─── Hyperframes stage ────────────────────────────────────────────────────────
// The visual is a function of the clock, so nothing here paints frames — it
// hands the animations the current time and lets the compositor run them.

function lpHyperframesMarkup() {
  const plan = state.lessonVisualPlan;
  if (typeof hyperframesCanRender !== "function" || !hyperframesCanRender(plan)) return "";
  return hyperframesMarkup(plan.storyboard, plan, state.lessonPlayback.total,
                           { staticFrame: v3PrefersReducedMotion() });
}

function lpSyncHyperframes() {
  const el = document.getElementById("lp-hyperframes");
  if (!el || typeof hyperframesSync !== "function") return;
  const lp = state.lessonPlayback;
  hyperframesSync(el, {
    elapsedSec: lp.elapsed,
    playing: lp.playing && !lp.ended && !lpHeld(lp),
    rate: lp.speed
  });
}

// ─── Scrubbing ────────────────────────────────────────────────────────────────
// Track geometry for the drag in progress, measured once at pointerdown and
// cleared on release. Null when no drag is active.
let lpScrubRect = null;
// The progress bar is a real control. Every update here is a direct DOM write:
// calling render() mid-drag would replace the element the pointer is captured
// on and the gesture would die on the first move — the same rule the budget and
// journal sliders are built on.

function lpScrubStart(e) {
  const track = document.getElementById("lp-progress");
  const lp = state.lessonPlayback;
  if (!track) return;
  lp.scrubWasPlaying = lp.playing;
  if (lp.playing) lpPause();
  track.classList.add("scrubbing");   // drop the smoothing so the bar tracks the finger
  // The track cannot move or resize mid-drag, so measure once. Reading it per
  // pointermove forced a synchronous layout on every frame — and read it right
  // after lpUpdateProgress had written bar.style.width, which is the classic
  // read-after-write thrash.
  lpScrubRect = track.getBoundingClientRect();
  try { track.setPointerCapture(e.pointerId); } catch (err) {}
  track.onpointermove   = lpScrubTo;
  track.onpointerup     = lpScrubEnd;
  track.onpointercancel = lpScrubEnd;
  lpScrubTo(e);
}

function lpScrubTo(e) {
  const lp = state.lessonPlayback;
  if (!lp.total) return;
  // Measured once in lpScrubStart; re-measure only if a move somehow arrives
  // without one (defensive — the pointer handlers are wired there).
  let r = lpScrubRect;
  if (!r) {
    const track = document.getElementById("lp-progress");
    if (!track) return;
    r = lpScrubRect = track.getBoundingClientRect();
  }
  if (!r.width) return;
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  lpApplyElapsed(frac * lp.total);
}

function lpScrubEnd(e) {
  const track = document.getElementById("lp-progress");
  const lp = state.lessonPlayback;
  if (track) {
    try { track.releasePointerCapture(e.pointerId); } catch (err) {}
    track.classList.remove("scrubbing");
    track.onpointermove = null; track.onpointerup = null; track.onpointercancel = null;
  }
  lpScrubRect = null;
  if (lp.scrubWasPlaying && !lp.ended) lpPlay();
  lp.scrubWasPlaying = false;
}

/** Arrow keys nudge the scrubber, so the control is reachable without a pointer. */
function lpScrubKey(e) {
  const step = 5;
  if (e.key === "ArrowRight" || e.key === "ArrowUp")   { e.preventDefault(); lpApplyElapsed(state.lessonPlayback.elapsed + step); }
  if (e.key === "ArrowLeft"  || e.key === "ArrowDown") { e.preventDefault(); lpApplyElapsed(state.lessonPlayback.elapsed - step); }
}

/** Seek to an absolute time and repaint everything that follows the clock. */
function lpApplyElapsed(sec) {
  const lp = state.lessonPlayback;
  lp.elapsed = Math.max(0, Math.min(lp.total, sec));
  if (lp.ended && lp.elapsed < lp.total) { lp.ended = false; lpLockNext(); }
  // Only rewrite the captions when the sentence actually changes — lpTick has
  // guarded this since it was written; a drag calls this on every pointermove
  // and a 300px track over a ~51s lesson makes most moves land in the same
  // sentence, so the rewrite was almost always redundant.
  const idx = lpIndexForElapsed(lp.elapsed, lp.cues);
  const idxChanged = idx !== lp.index;
  lp.index = idx;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) { try { audio.currentTime = lp.elapsed; } catch (err) {} }
  // The voice has to follow the handle. Without this it finishes the line it
  // was already on and then advances from THERE, so dragging the bar leaves the
  // narration reading a paragraph the viewer has already scrubbed past.
  if (idxChanged) {
    lpHighlight(lp.index);
    if (!audio) lpStopSpeaking();
    lpSpeakCurrent();
  }
  lpUpdateProgress();
  lpUpdatePlayBtn();
  lpSyncHyperframes();
  if (lp.playing) lp.lastTick = Date.now();
}

function lpUpdatePlayBtn() {
  const btn  = document.getElementById("lp-playbtn");
  if (btn) btn.textContent = state.lessonPlayback.ended ? "↻" : (state.lessonPlayback.playing ? "⏸" : "▶");
  const wave = document.getElementById("lp-wave");
  if (wave) wave.classList.toggle("playing", state.lessonPlayback.playing && !state.lessonPlayback.ended);
}

function lpUnlockNext() {
  state.lessonPlayback.completed = true;
  const btn = document.getElementById("lp-next-btn");
  if (btn) btn.disabled = false;
}

function lpLockNext() {
  if (state.lessonPlayback.completed) return; // user already finished — keep Next available
  const btn = document.getElementById("lp-next-btn");
  if (btn) btn.disabled = true;
}

// ─── Playback controls ────────────────────────────────────────────────────────
// The ticker fires ~10×/sec, advancing the virtual clock by real elapsed time ×
// speed. Subtitle line and bar are both derived from `elapsed` each tick, so the
// bar creeps continuously and the line flips exactly at its cue.
const LP_TICK_MS = 100;

function lpTick() {
  const lp = state.lessonPlayback;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) {
    // Audio mode: the element IS the clock. Read its playhead each tick so the
    // bar stays smooth (timeupdate alone fires too coarsely).
    lp.elapsed = audio.currentTime;
  } else {
    const now = Date.now();
    const dt  = (now - lp.lastTick) / 1000;
    lp.lastTick = now;
    lp.elapsed += dt * lp.speed;
    // Speech is the clock (see lpSpeakCurrent). The bar still moves smoothly,
    // but it stops at the end of the line being spoken and waits for `onEnd`
    // to release it — otherwise a fast estimate runs the film while the
    // narrator is still three lines back.
    if (lp.speechDriven) lp.elapsed = Math.min(lp.elapsed, lpSpeechCap(lp));
  }

  if (lp.elapsed >= lp.total && !lp.speechDriven) {
    lpEnd();
    return;
  }
  const idx = lpIndexForElapsed(lp.elapsed, lp.cues);
  if (idx !== lp.index && !lp.speechDriven) {
    lp.index = idx;
    lpHighlight(idx);
    lpSpeakCurrent();
  }
  lpUpdateProgress();
  lpSyncHyperframes();   // drift check only — the animation runs itself
}

// Reached the end: snap to 100%, unlock Next, switch to replay icon.
function lpEnd() {
  const lp = state.lessonPlayback;
  lp.elapsed = lp.total;
  lp.index   = lp.sentences.length - 1;
  lp.ended   = true;
  lpHighlight(lp.index);
  lpPause();
  const bar = document.getElementById("lp-bar");
  if (bar) bar.style.width = "100%";
  const timeEl = document.getElementById("lp-time");
  if (timeEl) timeEl.textContent = lpFmtTime(Math.round(lp.total));
  lpUnlockNext();
  lpUpdatePlayBtn();
  lpSyncHyperframes();
}

function lpPlay() {
  const lp = state.lessonPlayback;
  if (lp.playing || lp.ended) return;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) {
    const p = audio.play();
    // Browsers block autoplay without a user gesture; if play() rejects, fall
    // back to a paused/▶ state so the user's next tap starts it cleanly.
    if (p && typeof p.catch === "function") {
      p.catch(function() { lpPause(); });
    }
  }
  lp.playing  = true;
  lp.lastTick = Date.now();
  lp.timer    = setInterval(lpTick, LP_TICK_MS);
  lpUpdatePlayBtn();
  lpSyncHyperframes();
  lpSpeakCurrent();   // no .wav for this lesson → speak it live
}

function lpPause() {
  const lp = state.lessonPlayback;
  lp.playing = false;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) audio.pause();
  lpStopSpeaking();
  if (lp.timer) { clearInterval(lp.timer); lp.timer = null; }
  lpUpdatePlayBtn();
  lpSyncHyperframes();
}

// Stops playback and clears the ticker. Called by render.js before destroying
// the lesson DOM so the ticker doesn't fire against stale element references.
function lpStopPlayback() {
  const lp = state.lessonPlayback;
  lp.playing = false;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) audio.pause();
  lpStopSpeaking();
  if (lp.timer) { clearInterval(lp.timer); lp.timer = null; }
}

function lpTogglePlay() {
  if (state.lessonPlayback.playing) lpPause(); else lpPlay();
}

// Unified play button action — toggles play/pause or restarts if ended
function lpPlayAction() {
  if (state.lessonPlayback.ended) lpRestart(); else lpTogglePlay();
}

function lpRestart() {
  const lp = state.lessonPlayback;
  lp.index   = 0;
  lp.elapsed = 0;
  lp.ended   = false;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) audio.currentTime = 0;
  lpLockNext();
  lpHighlight(0);
  lpUpdateProgress();
  lpSyncHyperframes();
  lpPlay();
}

// ±1 line per skip: seek the clock to the prev/next line's cue time.
// ±10 seconds, the transport control people already know from every other
// player. It used to be ±1 script line labelled "◀ Back" / "Next ▶", which read
// as leaving the lesson rather than seeking inside it — and a line is an
// arbitrary unit the viewer can't see the length of.
//
// lpApplyElapsed already does the whole job: clamps, clears `ended`, moves the
// audio playhead, repaints the caption only when the line actually changes, and
// resyncs the hyperframes.
const LP_SEEK_SEC = 10;

function lpSeekBy(seconds) {
  const lp = state.lessonPlayback;
  lpApplyElapsed(lp.elapsed + seconds);
  // Ticker keeps running; reset lastTick so the jump isn't counted as elapsed.
  if (lp.playing) lp.lastTick = Date.now();
}

function lpSetSpeed(s) {
  const lp = state.lessonPlayback;
  lp.speed = s;
  const btn = document.getElementById("lp-speed");
  if (btn) btn.textContent = s + "×";
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) audio.playbackRate = s;
  lpSyncHyperframes();   // the animation carries its own playbackRate
  // Virtual mode: the ticker reads lp.speed live each tick — nothing more to do.
}

function lpCycleSpeed() {
  const speeds = [1, 1.5, 2];
  lpSetSpeed(speeds[(speeds.indexOf(state.lessonPlayback.speed) + 1) % speeds.length]);
}

// Called by render.js after lesson screen HTML is written to DOM.
// Auto-starts fresh loads; resumes playback interrupted by a mid-play re-render.
// For audio lessons, wires the freshly-created <audio> element (it's recreated
// on every render) to the elapsed clock before (re)starting playback.
function lpMountHook(wasPlaying) {
  const lp = state.lessonPlayback;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) {
    audio.playbackRate = lp.speed;
    const applyPosition = function() { try { audio.currentTime = lp.elapsed || 0; } catch (e) {} };
    // audio.duration is authoritative; refresh total + bar/label once it's in.
    audio.addEventListener("loadedmetadata", function() {
      if (isFinite(audio.duration) && audio.duration > 0) {
        lp.total = audio.duration;
        const t = document.getElementById("lp-total");
        if (t) t.textContent = lpFmtTime(Math.round(lp.total));
        lpUpdateProgress();
      }
      applyPosition();
    });
    audio.addEventListener("ended", function() { if (!lp.ended) lpEnd(); });
    // Metadata may already be cached (re-render): apply the saved position now.
    if (audio.readyState >= 1) applyPosition();
  }
  lpSyncHyperframes();   // re-attach after any re-render, at the saved position
  if (lp.pendingAutoPlay) { lp.pendingAutoPlay = false; lpPlay(); }
  else if (wasPlaying)    { lpPlay(); }
}

function lpSeekTo(index) {
  const lp = state.lessonPlayback;
  lp.index   = Math.max(0, Math.min(lp.sentences.length - 1, parseInt(index) || 0));
  lp.elapsed = lp.cues[lp.index] || 0;
  lp.ended   = false;
  const audio = lpHasAudio() ? lpAudioEl() : null;
  if (audio) audio.currentTime = lp.elapsed;
  lpLockNext();
  lpHighlight(lp.index);
  lpUpdateProgress();
  lpUpdatePlayBtn();
  lpSyncHyperframes();
  if (lp.playing) lp.lastTick = Date.now();
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
function renderLesson() {
  const lesson = state.currentLesson;

  if (!lesson) {
    return `
      <div class="card">
        <h1 class="title">Lesson</h1>
        <p class="subtitle">No lesson selected. Open a lesson from a topic page.</p>
      </div>
      <div class="flow-footer">
        <button class="button secondary" type="button" onclick="navGoTabRoot('learn')">Back to Learn</button>
      </div>
    `;
  }

  // Reset state only when a different lesson is opened. Same-lesson re-renders
  // (e.g. admin stage-style toggle, debouncedRender) preserve playback position.
  if (state.lessonPlayback.currentLessonId !== lesson.id) {
    const lp = state.lessonPlayback;
    lp.currentLessonId = lesson.id;
    // v3 (D38): the player is NOT rewritten — the only hook is which sentence
    // array it plays. state.lessonVariantScript is set by the framing tree
    // (js/lessons-v3.js) from the variant the answers selected. v2's lessons
    // still fall back to LP_SCRIPTS by lesson id.
    lp.sentences       = state.lessonVariantScript
                      || LP_SCRIPTS[lesson.id]
                      || [
      "This lesson's content will be added soon.",
      "Tap Next to proceed to the quiz."
    ];
    const timing       = lpTimingFor(lesson.id, lp.sentences.length, lp.sentences);
    lp.cues            = timing.cues;
    lp.total           = timing.total;
    lp.index           = 0;
    lp.elapsed         = 0;
    lp.playing         = false;
    lp.ended           = false;
    lp.completed       = false;
    lp.speed           = 1;
    lp.pendingAutoPlay = true;
    if (lp.timer) { clearInterval(lp.timer); lp.timer = null; }
  }

  // Video is the default stage. It needs a storyboard AND a personalized figure,
  // so a lesson without either (or an "I don't know" path with nothing to plot)
  // shows a clean stage rather than drawing a frame full of dashes.
  //
  // Waveform renders ONLY when an admin explicitly picks it (L10) — falling
  // through to it meant every lesson but `apr` played the animation L10 rejected.
  const videoOn     = (state.lpStageStyle === "auto" || state.lpStageStyle === "video")
                      && hyperframesCanRender(state.lessonVisualPlan);
  const isWaveform  = !videoOn && state.lpStageStyle === "waveform";
  const totalTime   = lpFmtTime(Math.round(state.lessonPlayback.total));
  const barPct      = (state.lessonPlayback.total > 0 ? state.lessonPlayback.elapsed / state.lessonPlayback.total * 100 : 0).toFixed(2);
  const elapsed     = lpFmtTime(Math.round(state.lessonPlayback.elapsed));
  const playLabel   = state.lessonPlayback.ended ? "↻" : (state.lessonPlayback.playing ? "⏸" : "▶");
  const waveClass   = `lp-wave${isWaveform ? "" : " lp-wave-hidden"}${state.lessonPlayback.playing && !state.lessonPlayback.ended ? " playing" : ""}`;

  const audioSrc = LP_AUDIO[lesson.id] || "";

  return `
    <div class="lp-layout">
      ${audioSrc ? `<audio id="lp-audio" src="${h(audioSrc)}" preload="auto"></audio>` : ""}

      <!-- BANNER: back button + centered lesson title, above the stage -->
      <div class="lp-banner">
        <!-- navBack POPS the stack. go('reward-preview') PUSHED a screen the
             user may never have seen, and topbar.js's header calls out that
             exact anti-pattern: a hardcoded forward-jump is wrong as soon as a
             screen can be reached from more than one place — which this one can. -->
        <button class="lp-back-btn" type="button" onclick="navBack()">‹</button>
        <h1 class="lp-banner-title">${h(lesson.title)}</h1>
      </div>

      <!-- TOP: staging area — the video, or the waveform when it is turned off -->
      <div class="lp-stage ${videoOn ? "lp-stage-video" : ""}">
        ${videoOn ? `<div class="lp-hyperframes" id="lp-hyperframes">${lpHyperframesMarkup()}</div>` : ""}
        <div class="${waveClass}" id="lp-wave">
          <div class="lp-bar"></div>
          <div class="lp-bar"></div>
          <div class="lp-bar"></div>
          <div class="lp-bar"></div>
          <div class="lp-bar"></div>
          <div class="lp-bar"></div>
          <div class="lp-bar"></div>
        </div>
      </div>

      <!-- MIDDLE: subtitle strip — shows prev / current / next sentence -->
      <div class="lp-subtitle">
        <p class="lp-sub-prev" id="lp-prev">${h(state.lessonPlayback.sentences[state.lessonPlayback.index - 1] || "")}</p>
        <p class="lp-sub-curr" id="lp-curr">${h(state.lessonPlayback.sentences[state.lessonPlayback.index]     || "")}</p>
        <p class="lp-sub-next" id="lp-next">${h(state.lessonPlayback.sentences[state.lessonPlayback.index + 1] || "")}</p>
      </div>

      <!-- BOTTOM: audio controls -->
      <div class="lp-controls">
        <div class="lp-ctrl-row">
          <button class="button secondary lp-ctrl-btn" type="button"
                  onclick="lpSeekBy(-LP_SEEK_SEC)" aria-label="Back ten seconds"
                  title="Back 10 seconds">↺ ${LP_SEEK_SEC}</button>
          <button class="button lp-ctrl-btn" id="lp-playbtn" type="button" onclick="lpPlayAction()">${playLabel}</button>
          <button class="button secondary lp-ctrl-btn" type="button"
                  onclick="lpSeekBy(LP_SEEK_SEC)" aria-label="Forward ten seconds"
                  title="Forward 10 seconds">↻ ${LP_SEEK_SEC}</button>
          <button class="button secondary lp-speed-btn" id="lp-speed" type="button" onclick="lpCycleSpeed()">${state.lessonPlayback.speed}×</button>
        </div>
        <div class="lp-progress-row">
          <span id="lp-time" class="lp-time-label">${elapsed}</span>
          <div class="lp-progress" id="lp-progress" role="slider" tabindex="0"
               aria-label="Lesson position" aria-valuemin="0" aria-valuemax="100"
               aria-valuenow="${Math.round(barPct)}"
               onpointerdown="lpScrubStart(event)" onkeydown="lpScrubKey(event)">
            <div class="lp-progress-fill" id="lp-bar" style="width:${barPct}%;"></div>
            <div class="lp-progress-knob" id="lp-knob" style="left:${barPct}%;"></div>
          </div>
          <span id="lp-total" class="lp-time-label">${totalTime}</span>
        </div>
        <button class="button full" id="lp-next-btn" type="button" onclick="lessonLeaveForQuiz()" ${(state.lessonPlayback.ended || state.lessonPlayback.completed) ? "" : "disabled"}>Next</button>
      </div>

    </div>
  `;
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
// What the video is bound to, and which beat the clock is inside — the two
// things you need to tell "the animation is wrong" from "the data is wrong".
function lpAdminVisualReadout() {
  const plan = state.lessonVisualPlan;
  if (!plan) return `<p class="helper" style="font-size:10px;margin-top:6px;">No visual plan — this lesson has no storyboard, so the stage falls back to the waveform.</p>`;
  const canRender = typeof hyperframesCanRender === "function" && hyperframesCanRender(plan);
  const band = plan.band || {};
  const lp = state.lessonPlayback;
  const frac = lp.total > 0 ? lp.elapsed / lp.total : 0;
  const beats = (plan.storyboard && plan.storyboard.spine) || [];
  const beat = beats.find(b => frac >= b.from && frac < b.to) || beats[beats.length - 1];
  return `
    <p class="helper" style="font-size:10px;line-height:1.7;margin-top:6px;">
      ${canRender ? "" : "<strong>not renderable</strong> (no figure) — waveform shown<br>"}
      card ${h(plan.cardName || "—")} ·
      you ${plan.userFigure == null ? "—" : plan.userFigure + "%"} ·
      typical ${plan.marketAvg == null ? "—" : plan.marketAvg + "%"}<br>
      band ${band.low == null ? "—" : band.low + "–" + band.high + "%"} ·
      gap ${plan.gapPercent == null ? "—" : plan.gapPercent + "%"} ·
      bucket <strong>${h(plan.bucket || "—")}</strong><br>
      beat <strong>${h(beat ? beat.id : "—")}</strong> at ${(frac * 100).toFixed(0)}%
    </p>`;
}

function renderLessonAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">Lesson Player</p>
      <div class="input-group">
        <label>Stage style</label>
        <select onchange="state.lpStageStyle=this.value;render()">
          <option value="auto"     ${state.lpStageStyle === "auto"     ? "selected" : ""}>Auto — video if the lesson has one (default)</option>
          <option value="video"    ${state.lpStageStyle === "video"    ? "selected" : ""}>Video — hyperframes (force)</option>
          <option value="waveform" ${state.lpStageStyle === "waveform" ? "selected" : ""}>Waveform (audio only)</option>
          <option value="clean"    ${state.lpStageStyle === "clean"    ? "selected" : ""}>Clean (nothing)</option>
        </select>
        ${lpAdminVisualReadout()}
      </div>
      <div class="input-group">
        <label>Jump to sentence (0–${state.lessonPlayback.sentences.length - 1})</label>
        <input type="number" min="0" max="${state.lessonPlayback.sentences.length - 1}" value="${state.lessonPlayback.index}"
               oninput="lpSeekTo(this.value)">
      </div>
      <p class="helper" style="margin-top:6px;">
        ${state.lessonPlayback.sentences.length} sentences · ${lpFmtTime(Math.round(state.lessonPlayback.total))} total
      </p>
    </div>
  `;
}


// v3 (D38): the player's Next leads into the v3 quiz when a v3 lesson is
// playing, and into v2's quiz otherwise. Keeps both paths alive rather than
// repointing the button and stranding v2's lessons.
function lessonLeaveForQuiz() {
  if (state.lessonVariantId && typeof lessonQuizStart === "function") {
    lessonQuizStart();
    return;
  }
  go("quiz");
}
