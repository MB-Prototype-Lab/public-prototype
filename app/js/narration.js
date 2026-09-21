// ─── Narration seam — one place that decides how a line gets spoken ──────────
//
// L10 says Web Speech is a BUILD-TIME generator and runtime plays .wav. That
// holds for the full build and is still the preferred path: when a generated
// .wav exists, callers play it and never come here.
//
// But scripts/gen-audio.sh needs macOS `say`, and the prototype is being built
// and demoed on a PC where no TTS exists at all — so on that machine every
// narrated surface is silent, and "is there a voice in the video" cannot be
// prototyped at all. Owner's call: fall back to runtime speech so the voice is
// there on any machine. The .wav still wins wherever it has been generated, so
// nothing regresses on the Mac and the production pipeline is unchanged.
//
// Order of preference, per surface:
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

let narrationGen = 0;

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
  // (D02/D03), so a cloud voice is the one thing guaranteed not to speak —
  // this previously preferred exactly that.
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
    u.onstart = function () { if (gen === narrationGen && opts.onStart) opts.onStart(); };
    u.onend   = function () { if (gen === narrationGen && opts.onEnd)   opts.onEnd(); };
    u.onerror = function () { if (gen === narrationGen && opts.onError) opts.onError(); };
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}
