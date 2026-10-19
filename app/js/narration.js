// ─── Narration seam — one place that decides how a line gets spoken ──────────
//
// L10 order of preference, per surface:
//   1. generated .wav   (L10, best quality, measured timings)
//   2. runtime speech   (this file — any machine, no build step)
//   3. word-count clock (silent, captions still advance)
//
// ── THE CANCEL TRAP ──────────────────────────────────────────────────────────
// speechSynthesis.cancel() does NOT drop the cancelled utterance's callback —
// it QUEUES onend (or onerror). A caller that cancels and immediately starts
// the next line will get the OLD line's onend afterwards, and if that advances
// a playlist it starts a second loop that eats the script. Every utterance here
// therefore captures a generation, and a callback whose generation is stale is
// dropped. Callers never have to know.
//
// ── THE LOST onend ───────────────────────────────────────────────────────────
// The opposite failure: the line finishes and onend NEVER arrives. Chrome and
// Safari drop the events of an utterance that has been garbage-collected (it
// is only held locally), and Chrome stops some voices after ~15s without
// firing anything. Voice-clocked players wait for onEnd before the next line,
// so a lost callback would freeze playback. Two guards: the utterance is held in a
// module variable until it is done, and a watchdog polls the synth -- once the
// line has started and the synth has been silent for two polls, it delivers
// onEnd itself. A line that never starts at all is reported as onError, which
// every caller already treats as "hand the clock back to the estimate". Either
// way the callback fires once: whichever of the real event and the watchdog
// comes first wins, and a superseded line (generation) gets neither.

let narrationGen = 0;
let narrationUtterance = null;           // held so the browser cannot collect it
const NARRATION_POLL_MS = 250;
const NARRATION_START_GRACE_MS = 3000;

function narrationAvailable() {
  return !!(typeof window !== "undefined" &&
            window.speechSynthesis &&
            typeof SpeechSynthesisUtterance !== "undefined");
}

/** Stop anything in flight and invalidate its callbacks. */
function narrationCancel() {
  narrationGen++;
  if (!narrationAvailable()) return;
  try { window.speechSynthesis.cancel(); } catch (e) {}
}

/**
 * Prefer a real, natural en-US voice. getVoices() is populated asynchronously,
 * so this is resolved per call rather than cached — an empty list early on
 * simply means the browser default, which is fine.
 */
function narrationVoice() {
  if (!narrationAvailable()) return null;
  let voices = [];
  try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { return null; }
  if (!voices.length) return null;
  const en = voices.filter(v => /^en(-|_|$)/i.test(v.lang || ""));
  const pool = en.length ? en : voices;
  // Named voices that sound least like a 1998 screen reader, in preference
  // order. The Microsoft ones are what a Windows/WSL machine actually ships.
  const preferred = ["Samantha", "Microsoft Aria", "Microsoft Jenny",
                     "Microsoft Zira", "Google US English", "Alex"];
  for (const name of preferred) {
    const hit = pool.find(v => (v.name || "").indexOf(name) !== -1);
    if (hit) return hit;
  }
  // Prefer a LOCAL voice. The app runs on file:// with no network at runtime
  // (D02/D03), so prefer a voice that needs no cloud service.
  return pool.find(v => v.localService) || pool[0];
}

/**
 * Speak one line. Returns true if speech actually started, so the caller can
 * fall back to its own clock when it did not.
 *
 * opts.onStart — this line's voice actually began
 * opts.onEnd   — line finished (never fires for a superseded line)
 * opts.onError — speech failed; the caller should fall back
 * opts.rate    — defaults to 1, which lands near the 165 wpm the written
 *                timings assume, so captions and voice stay roughly together
 *
 * ── WHY onStart AND onEnd MATTER ─────────────────────────────────────────────
 * "Roughly together" is not together. The written timings are a word-count
 * estimate at DU_WPM; a browser voice reads at whatever pace it likes, and the
 * two separate within a few lines — the caption moves on while the voice is
 * still mid-sentence, and the scrub bar agrees with neither.
 *
 * So on any surface with no generated .wav, these two callbacks become the
 * clock: the player pins its line index on `onStart` and only advances on
 * `onEnd`. The estimate survives as the total-length figure and as the fallback
 * for browsers with no speech at all. See "the sync contract" in
 * docs/architecture.md §10.
 */
function narrationSpeak(text, opts) {
  opts = opts || {};
  const line = String(text == null ? "" : text).trim();
  if (!line || !narrationAvailable()) return false;

  narrationCancel();                 // bumps the generation
  const gen = narrationGen;          // ...which this line now owns

  try {
    const u = new SpeechSynthesisUtterance(line);
    u.rate  = opts.rate || 1;
    u.pitch = 1;
    const v = narrationVoice();
    if (v) u.voice = v;
    let started = false, done = false, silent = 0, waited = 0;
    // One exit for the real events and the watchdog alike: first caller wins.
    const finish = function (cb) {
      if (done) return;
      done = true;
      if (narrationUtterance === u) narrationUtterance = null;
      if (gen === narrationGen && cb) cb();
    };
    u.onstart = function () { started = true; if (gen === narrationGen && opts.onStart) opts.onStart(); };
    u.onend   = function () { finish(opts.onEnd); };
    u.onerror = function () { finish(opts.onError); };
    narrationUtterance = u;
    window.speechSynthesis.speak(u);

    const watch = function () {
      if (done) return;
      if (gen !== narrationGen) { done = true; if (narrationUtterance === u) narrationUtterance = null; return; }
      let busy = true;
      try { busy = !!(window.speechSynthesis.speaking || window.speechSynthesis.pending); } catch (e) {}
      if (busy) { started = true; silent = 0; }
      else if (started) { silent++; }
      waited += NARRATION_POLL_MS;
      if (started && silent >= 2) { finish(opts.onEnd); return; }        // ended, event lost
      if (!started && waited >= NARRATION_START_GRACE_MS) { finish(opts.onError); return; }  // never spoke
      setTimeout(watch, NARRATION_POLL_MS);
    };
    setTimeout(watch, NARRATION_POLL_MS);
    return true;
  } catch (e) {
    return false;
  }
}
