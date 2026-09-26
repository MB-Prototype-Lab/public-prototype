// ─── Hyperframes — seekable, data-bound scene animation ──────────────────────
// A reusable visual engine for "video" surfaces. Named for HeyGen's Hyperframes,
// whose authoring model this borrows: animation described as code on a timeline
// that can be advanced to any timestamp. Its MP4 exporter is not borrowed and is
// not wanted here — the app is no-build and file:// (L1), the spec asks for
// animated DOM rather than encoded video (A9), and the figures differ per user,
// which a pre-rendered file cannot do.
//
// ── THE CLOCK CONTRACT ───────────────────────────────────────────────────────
// Every animated element gets ONE animation whose duration is the whole piece,
// with the storyboard's fractions written as keyframe percentages. Because they
// all share that duration, seeking is uniform — the same currentTime on every
// animation — and the storyboard is duration-agnostic: change the runtime and
// the choreography re-fits itself.
//
//   play    → anim.play()          (native 60fps, off the main thread)
//   pause   → anim.pause()
//   seek    → anim.currentTime = t (identical t for every animation)
//   speed   → anim.playbackRate = r
//
// The host's ticker never paints a frame — it only nudges drift back into line.
//
// ── AUTHORING ────────────────────────────────────────────────────────────────
// A storyboard is `{ spine: [beat...], bucketSegments: { key: {elements} } }`.
// A beat is `{ id, from, to, elements[] }` with from/to as fractions of runtime,
// or `{ id, from, to, slot: "bucket" }` to splice in the segment for the current
// outcome. Coordinates live in a 100 x 72 viewBox, so everything is relative.
// Labels carry {tokens} that resolve against the caller's data.

const HF_VIEW_W = 100;
const HF_VIEW_H = 72;
const HF_EASE = "cubic-bezier(.2,.7,.3,1)";

/**
 * Enough data to draw a personalized frame? No figure → the caller falls back.
 *
 * The figure check is for storyboards built around a NUMBER — the APR lesson
 * plots the user's rate against the market, and without both there is nothing
 * to draw. Storyboards that only explain something (the onboarding intro) have
 * no figure by design and declare `requiresFigures: false`. The flag defaults
 * to on, so every existing caller keeps the stricter gate.
 */
function hyperframesCanRender(plan) {
  if (!plan || !plan.storyboard || !plan.storyboard.spine) return false;
  if (plan.storyboard.requiresFigures === false) return true;
  return plan.userFigure != null && plan.marketAvg != null;
}

// ── Formatting + tokens ──────────────────────────────────────────────────────

/** One decimal, trailing .0 trimmed: 23 → "23", 23.40 → "23.4". */
function hfNum(v) {
  if (v == null || !isFinite(v)) return "—";
  const r = Math.round(Number(v) * 10) / 10;
  return (r % 1 === 0) ? String(r) : r.toFixed(1);
}

/**
 * The one phrase that has to stay sensible at every distance from the average,
 * including "basically the same", where a points figure reads as false precision.
 */
function hfGapPhrase(user, avg) {
  if (user == null || avg == null) return "";
  const diff = user - avg;
  if (Math.abs(diff) < 0.5) return "about the same as typical";
  return hfNum(Math.abs(diff)) + " points " + (diff > 0 ? "above" : "below") + " typical";
}

/**
 * A rate difference in percentage points is not a felt quantity. The same gap
 * in dollars is.
 *
 * Per $1,000 carried for a year at simple annual interest — the honest way to
 * say it, since anything cleverer implies a repayment schedule nobody has
 * given us. The visual carries the condition ("only on what you carry"); the
 * script stays figure-free.
 */
const HF_PER_BALANCE = 1000;

function hfDollarsOn(rate) {
  if (rate == null || !isFinite(rate)) return null;
  return (Number(rate) / 100) * HF_PER_BALANCE;
}

function hfMoney(v) {
  if (v == null || !isFinite(v)) return "—";
  const r = Math.round(Number(v) * 100) / 100;
  return "$" + (r % 1 === 0 ? r.toLocaleString() : r.toFixed(2));
}

function hfTokens(data) {
  const band = data.band || {};
  const gap = data.gapPercent;
  const dUser = hfDollarsOn(data.userFigure);
  const dAvg  = hfDollarsOn(data.marketAvg);
  return {
    userApr:   hfNum(data.userFigure),
    marketAvg: hfNum(data.marketAvg),
    bandLow:   hfNum(band.low),
    bandHigh:  hfNum(band.high),
    gapPct:    gap == null ? "—" : (gap > 0 ? "+" : "") + gap,
    gapPhrase: hfGapPhrase(data.userFigure, data.marketAvg),
    cardName:  data.cardName || "your card",
    perBalance:  hfMoney(HF_PER_BALANCE),
    dollarsUser: hfMoney(dUser),
    dollarsAvg:  hfMoney(dAvg),
    dollarsGap:  (dUser == null || dAvg == null) ? "—" : hfMoney(Math.abs(dUser - dAvg)),
    dollarsWord: (dUser == null || dAvg == null) ? "apart"
                 : (dUser > dAvg ? "more" : dUser < dAvg ? "less" : "the same")
  };
}

function hfResolve(text, tokens) {
  return String(text == null ? "" : text)
    .replace(/\{(\w+)\}/g, (m, k) => (tokens[k] != null ? String(tokens[k]) : m));
}

// ── Storyboard → flat beat list ──────────────────────────────────────────────
// The `bucket` slot resolves here, so the rest of the engine never knows about
// buckets: one shared spine, one spliced segment, everything else identical.

function hfBeats(storyboard, bucket) {
  const segs = storyboard.bucketSegments || {};
  const out = [];
  (storyboard.spine || []).forEach(beat => {
    if (beat.slot === "bucket") {
      const seg = segs[bucket];
      if (!seg || !(seg.elements || []).length) return;   // unknown bucket → beat is skipped
      out.push({ id: beat.id, from: beat.from, to: beat.to, hold: beat.hold, elements: seg.elements });
      return;
    }
    if (!(beat.elements || []).length) return;
    out.push(beat);
  });
  return out;
}

// ── Keyframes ────────────────────────────────────────────────────────────────

// Every `anim` a storyboard names must exist here. An unknown name falls back to
// `fade` silently (hfKeyframes), so a typo costs the authored motion and nothing
// reports it — keep this table in step with data/lessons.json.
//
// `draw` and `accumulate` are the scale's and the coin stack's entrances. A true
// stroke-draw needs stroke-dashoffset, which this transform-only model cannot
// express; a uniform scale-up is the closest reading that doesn't squash the
// scale's own text labels.
const HF_ANIMS = {
  fade:       { from: "",                        out: "" },
  rise:       { from: "translateY(5px)",         out: "translateY(-3px)" },
  slide:      { from: "translateX(-7px)",        out: "translateX(4px)" },
  pop:        { from: "scale(.72)",              out: "scale(1.06)" },
  draw:       { from: "scale(.94)",              out: "scale(1.02)" },
  accumulate: { from: "translateY(7px) scale(.7)", out: "translateY(-2px)" }
};

// Entrances and exits are wall-clock SECONDS, not fractions of the runtime.
//
// The caps used to be fractions — min(0.09, span * 0.45) — and everything in
// this engine is a fraction of the whole piece, so a 70-second lesson gave each
// element a 6.3-second fade-in. The motion was correct and imperceptibly slow:
// text drifted into view over six seconds while the narrator finished a
// sentence and moved on. Expressed in seconds, a beat snaps in, holds for its
// line, and snaps out, at any runtime.
const HF_IN_SEC  = 0.42;
const HF_OUT_SEC = 0.30;
// The marker's slide from typical to their own rate carries the whole point of
// the piece, so it gets slightly longer than a plain entrance.
const HF_MARK_SEC = 0.60;

/** A duration in seconds as a fraction of the runtime, never past `cap`. */
function hfFrac(sec, totalSec, cap) {
  const t = Math.max(0.001, Number(totalSec) || 1);
  return Math.min(cap, sec / t);
}

/**
 * One element's keyframes, spanning the entire runtime. `from`/`to` are the
 * beat's fractions; the element eases in just inside the beat, holds, then
 * leaves — unless the beat holds to the end, which is how the closing frame
 * stays on screen.
 *
 * `totalSec` is what converts the fixed second-durations above into the
 * percentages a @keyframes block needs. Without it the entrance is a share of
 * the runtime, which is how it ended up at six seconds.
 */
function hfKeyframes(name, from, to, anim, hold, totalSec) {
  const a = HF_ANIMS[anim] || HF_ANIMS.fade;
  const span = Math.max(0.001, to - from);
  // Never longer than a sensible share of the beat itself — a very short beat
  // should not spend 0.42s of its life easing in.
  const inDur  = Math.min(hfFrac(HF_IN_SEC, totalSec, 0.09), span * 0.45);
  const outDur = hold ? 0 : Math.min(hfFrac(HF_OUT_SEC, totalSec, 0.05), span * 0.30);

  const p0 = from * 100;
  const p1 = (from + inDur) * 100;
  const p2 = (to - outDur) * 100;
  const p3 = to * 100;
  const t = (n) => Math.max(0, Math.min(100, n)).toFixed(3);
  const tf = (v) => v ? `transform:${v};` : "transform:none;";

  const rows = [];
  rows.push(`0%{opacity:0;${tf(a.from)}}`);
  if (p0 > 0.001) rows.push(`${t(p0)}%{opacity:0;${tf(a.from)};animation-timing-function:${HF_EASE};}`);
  rows.push(`${t(p1)}%{opacity:1;transform:none;}`);
  if (hold) {
    rows.push(`100%{opacity:1;transform:none;}`);
  } else {
    rows.push(`${t(p2)}%{opacity:1;transform:none;animation-timing-function:${HF_EASE};}`);
    rows.push(`${t(p3)}%{opacity:0;${tf(a.out)}}`);
    if (p3 < 99.999) rows.push(`100%{opacity:0;${tf(a.out)}}`);
  }
  return `@keyframes ${name}{${rows.join("")}}`;
}

// ── Shapes ───────────────────────────────────────────────────────────────────
// Everything is drawn in var(--on-dark) at varying opacity. That token is the
// ink that sits on --accent, which is the stage background, so the piece stays
// legible in all four themes without any per-theme colour of its own.

function hfIcon(name, cx, cy, s) {
  const ink = 'var(--on-dark)';
  if (name === "card") {
    return `<g>
      <rect x="${cx - s / 2}" y="${cy - s * 0.33}" width="${s}" height="${s * 0.66}" rx="${s * 0.09}"
            fill="none" stroke="${ink}" stroke-width="${s * 0.055}" opacity=".9"/>
      <rect x="${cx - s / 2}" y="${cy - s * 0.13}" width="${s}" height="${s * 0.11}" fill="${ink}" opacity=".55"/>
      <rect x="${cx - s * 0.36}" y="${cy + s * 0.09}" width="${s * 0.26}" height="${s * 0.09}" rx="${s * 0.03}"
            fill="${ink}" opacity=".5"/>
    </g>`;
  }
  if (name === "coin") {
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="${ink}" opacity=".22"/>
      <circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="none" stroke="${ink}" stroke-width="${s * 0.09}" opacity=".85"/>
      <circle cx="${cx}" cy="${cy}" r="${s * 0.19}" fill="none" stroke="${ink}" stroke-width="${s * 0.07}" opacity=".7"/>
    </g>`;
  }
  if (name === "shield") {
    return `<path d="M ${cx} ${cy - s * 0.55} L ${cx + s * 0.42} ${cy - s * 0.3}
                     L ${cx + s * 0.42} ${cy + s * 0.08}
                     Q ${cx + s * 0.42} ${cy + s * 0.48} ${cx} ${cy + s * 0.58}
                     Q ${cx - s * 0.42} ${cy + s * 0.48} ${cx - s * 0.42} ${cy + s * 0.08}
                     L ${cx - s * 0.42} ${cy - s * 0.3} Z"
                  fill="${ink}" fill-opacity=".18" stroke="${ink}" stroke-width="${s * 0.06}" opacity=".9"/>`;
  }
  // spark
  return `<path d="M ${cx} ${cy - s * 0.5}
                   Q ${cx + s * 0.09} ${cy - s * 0.09} ${cx + s * 0.5} ${cy}
                   Q ${cx + s * 0.09} ${cy + s * 0.09} ${cx} ${cy + s * 0.5}
                   Q ${cx - s * 0.09} ${cy + s * 0.09} ${cx - s * 0.5} ${cy}
                   Q ${cx - s * 0.09} ${cy - s * 0.09} ${cx} ${cy - s * 0.5} Z"
                fill="${ink}" fill-opacity=".85"/>`;
}

/**
 * The comparison scale: the band for cards like theirs, the typical tick, and
 * their own rate marked on it. The marker's slide from typical to their rate is
 * the beat that carries the whole point, so it is its own animation.
 */
function hfScale(el, data, uid, n, beat, totalSec) {
  const ink = 'var(--on-dark)';
  const band = data.band || {};
  const user = Number(data.userFigure);
  const avg  = Number(data.marketAvg);
  const lo   = band.low  != null ? Number(band.low)  : Math.min(user, avg) - 3;
  const hi   = band.high != null ? Number(band.high) : Math.max(user, avg) + 3;

  const dMin = Math.max(0, Math.min(lo, user, avg) - 2.5);
  const dMax = Math.max(hi, user, avg) + 2.5;
  const span = Math.max(0.001, dMax - dMin);
  const x = el.x != null ? el.x : 12;
  const w = el.w != null ? el.w : 76;
  const y = el.y != null ? el.y : 40;
  const at = (v) => x + ((Math.max(dMin, Math.min(dMax, v)) - dMin) / span) * w;

  const xLo = at(lo), xHi = at(hi), xAvg = at(avg), xUser = at(user);
  const markCls = `hf-${uid}-${n}m`;
  const shift = (xAvg - xUser).toFixed(3);   // marker starts on typical, slides to theirs

  // ── Label placement ───────────────────────────────────────────────────────
  // These used to collide. "cards like yours" sat centred over the band at
  // y-6.4, and the user's own rate sat at xUser, y-6.2 — for an Amex Platinum
  // (25.5 in a 21.24-29.99 band) that is x 50.0 vs 49.36 and y 33.6 vs 33.8:
  // 0.64 apart horizontally, 0.2 vertically, i.e. printed on top of each other.
  // Neither offset was a function of the other, so they collided whenever the
  // user's rate landed near the band's midpoint — the common case, not an edge.
  //
  // Now the two live in different registers entirely:
  //   · band caption   — top-left, anchored to the axis start, out of the way
  //   · user's rate    — ABOVE the line, bold, the one thing to read first
  //   · typical's rate — directly UNDER its own tick, inside the graph
  //   · band ends      — dropped to the bottom, where an axis scale belongs
  // "typical" was at y+14.5 while its tick ended at y+4.4, stranded ten units
  // below the thing it labelled and under the end labels, which is why it read
  // as sitting outside the chart.
  const yUserLabel = y - 6.2;
  const yBandCap   = y - 13.5;
  const yAvgLabel  = y + 8.4;
  const yEnds      = y + 14.5;

  // Keep a wide bold label inside the viewBox when the marker is near an edge.
  const userAnchor = xUser < x + 8 ? "start" : xUser > x + w - 8 ? "end" : "middle";

  return {
    svg: `<g>
      <rect x="${xLo}" y="${y - 3.1}" width="${Math.max(0.6, xHi - xLo)}" height="6.2" rx="3.1"
            fill="${ink}" opacity=".2"/>
      <line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${ink}" stroke-width=".45" opacity=".45"/>
      <text x="${x}" y="${yBandCap}" font-size="3.1" text-anchor="start" fill="${ink}" opacity=".62">cards like yours</text>
      <text x="${xLo}" y="${yEnds}" font-size="3.1" text-anchor="middle" fill="${ink}" opacity=".62">${hfNum(lo)}%</text>
      <text x="${xHi}" y="${yEnds}" font-size="3.1" text-anchor="middle" fill="${ink}" opacity=".62">${hfNum(hi)}%</text>
      <line x1="${xAvg}" y1="${y - 4.4}" x2="${xAvg}" y2="${y + 4.4}" stroke="${ink}" stroke-width=".7" opacity=".8"/>
      <text x="${xAvg}" y="${yAvgLabel}" font-size="3.3" text-anchor="middle" fill="${ink}" opacity=".8">typical ${hfNum(avg)}%</text>
      <g class="${markCls}">
        <circle cx="${xUser}" cy="${y}" r="2.5" fill="${ink}"/>
        <text x="${xUser}" y="${yUserLabel}" font-size="4.4" text-anchor="${userAnchor}" fill="${ink}"
              font-weight="850">${hfNum(user)}%</text>
      </g>
    </g>`,
    extraCss: `.${markCls}{animation:hfk-${markCls} var(--hf-dur) linear both;transform-box:fill-box;transform-origin:center;}`,
    extraKeys: `@keyframes hfk-${markCls}{` +
      `0%{transform:translateX(${shift}px);}` +
      `${(beat.from * 100).toFixed(3)}%{transform:translateX(${shift}px);animation-timing-function:${HF_EASE};}` +
      `${((beat.from + Math.min(hfFrac(HF_MARK_SEC, totalSec, 0.12), (beat.to - beat.from) * 0.6)) * 100).toFixed(3)}%{transform:translateX(0);}` +
      `100%{transform:translateX(0);}}`
  };
}

// ── Markup ───────────────────────────────────────────────────────────────────

/**
 * The whole piece as one string: a <style> block plus an <svg>.
 * Pure — the same storyboard, data and duration always produce the same output,
 * which is what makes it testable without a browser.
 *
 * opts.staticFrame renders the closing beat only, with no animation at all —
 * what a viewer who has asked for reduced motion gets.
 */
function hyperframesMarkup(storyboard, data, totalSec, opts) {
  opts = opts || {};
  const tokens = hfTokens(data || {});
  const beats = hfBeats(storyboard, data.bucket);
  const uid = "hf" + String(data.lessonId || "x").replace(/[^a-z0-9]/gi, "") +
              String(data.bucket || "none").replace(/[^a-z0-9]/gi, "");
  const isStatic = !!opts.staticFrame;
  const shown = isStatic ? beats.slice(-1) : beats;

  const svg = [];
  const css = [];
  const keys = [];
  let n = 0;

  shown.forEach(beat => {
    const hold = isStatic ? true : !!beat.hold;
    (beat.elements || []).forEach(el => {
      // A stack is a run of coins that arrive one after another inside the beat.
      const copies = el.type === "stack" ? Math.max(1, el.count || 5) : 1;
      for (let i = 0; i < copies; i++) {
        n++;
        const cls = `hf-${uid}-${n}`;
        let body = "";
        let from = beat.from, to = beat.to;

        if (el.type === "icon") {
          body = hfIcon(el.name, el.x, el.y, el.size || 16);
        } else if (el.type === "label") {
          const tone = el.tone === "muted" ? ".68" : "1";
          body = `<text x="${el.x}" y="${el.y}" font-size="${el.size || 5}" text-anchor="middle"
                        fill="var(--on-dark)" opacity="${tone}"
                        font-weight="${(el.size || 5) >= 5 ? 850 : 700}">${h(hfResolve(el.text, tokens))}</text>`;
        } else if (el.type === "stack") {
          // Fan the coins out in a shallow arc so a growing pile reads as a pile.
          const per = (beat.to - beat.from) / (copies + 2);
          from = beat.from + per * i;
          const cols = Math.min(4, copies);
          const col = i % cols, row = Math.floor(i / cols);
          const cx = (el.x || 50) + (col - (cols - 1) / 2) * 7.5;
          const cy = (el.y || 30) + row * 6.5;
          body = hfIcon("coin", cx, cy, 6.4);
        } else if (el.type === "scale") {
          const s = hfScale(el, data, uid, n, beat, totalSec);
          body = s.svg;
          if (!isStatic) { css.push(s.extraCss); keys.push(s.extraKeys); }
        }

        svg.push(`<g class="hf-el ${cls}">${body}</g>`);
        if (!isStatic) {
          css.push(`.${cls}{animation:hfk-${cls} var(--hf-dur) linear both;}`);
          keys.push(hfKeyframes(`hfk-${cls}`, from, to, el.anim || "fade", hold, totalSec));
        }
      }
    });
  });

  const staticCss = isStatic ? `.hf-el{opacity:1;}` : "";
  return `
    <style>
      .hf-root{--hf-dur:${Math.max(1, totalSec || 1)}s;width:100%;height:100%;display:block;
               font-family:var(--font-display);}
      .hf-root .hf-el{transform-box:fill-box;transform-origin:center;}
      ${staticCss}
      ${css.join("")}
      ${keys.join("")}
    </style>
    <svg class="hf-root" viewBox="0 0 ${HF_VIEW_W} ${HF_VIEW_H}"
         preserveAspectRatio="xMidYMid meet" aria-hidden="true">${svg.join("")}</svg>
  `;
}

// ── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Point every animation in the subtree at the host's clock.
 *
 * Two details that matter. `play()` on a finished animation rewinds it to zero,
 * so only a genuinely paused or idle one is ever played, and the time is
 * written straight after. And currentTime is only rewritten when it has
 * actually drifted, because assigning it every tick would fight the compositor
 * and undo the smoothness this design exists for.
 *
 * ── SMALL CORRECTIONS GLIDE, LARGE ONES SNAP ─────────────────────────────────
 * Writing currentTime is a jump cut, and there is one correction at every
 * segment boundary: the cue map is a 165 wpm word-count estimate, the narrator
 * is not, and the player snaps `elapsed` to the next cue when a voice ends. Land
 * that as a jump and the outgoing beat's fade-out is skipped while the incoming
 * one starts part-way through its fade-in — the hiccup at each new sentence.
 *
 * So drift is eased in by nudging the RATE, the way a video player pulls audio
 * back into sync, and the picture converges over about a second without a
 * visible seam. A scrub or a +/-10s skip is far past HF_SNAP_MS and still lands
 * instantly, which is what those controls are for.
 */
// Under this, it is drift and gets eased. Over it, someone seeked.
const HF_SNAP_MS  = 1200;
// Roughly how long a correction takes to disappear. Smaller = more aggressive.
const HF_GLIDE_MS = 700;
// Ceiling on the nudge, so the film never visibly speeds up or crawls.
const HF_GLIDE_MAX = 0.4;
function hyperframesSync(root, opts) {
  if (!root || typeof root.getAnimations !== "function") return;
  opts = opts || {};
  const ms = Math.max(0, (opts.elapsedSec || 0) * 1000);
  const rate = opts.rate || 1;
  const tol = opts.tolerance != null ? opts.tolerance : 120;

  let anims = [];
  try { anims = root.getAnimations({ subtree: true }); } catch (e) { return; }

  anims.forEach(a => {
    try {
      if (opts.playing) {
        // NOT `playState !== "running"`. A FINISHED animation is not running
        // either, so that test played it -- and play() on a finished animation
        // rewinds it to zero. Every element here is one animation spanning the
        // whole runtime, so they all finish while the narrator is still on the
        // last line, and the 100ms tick then flashed the entire scene back to
        // its first beat ten times a second. Setting currentTime below is
        // enough to un-finish one; it never needs play().
        if (a.playState === "paused" || a.playState === "idle") { a.play(); a.currentTime = ms; }
      } else if (a.playState !== "paused") {
        a.pause();
      }
      const cur = Number(a.currentTime) || 0;
      const drift = ms - cur;               // positive → the picture is behind
      if (!opts.playing || Math.abs(drift) > HF_SNAP_MS) {
        // Paused means pinned: onbVideoHeld/lpHeld rely on the held frame being
        // exactly where the clock says, not converging towards it.
        if (Math.abs(drift) > tol) a.currentTime = ms;
        if (a.playbackRate !== rate) a.playbackRate = rate;
      } else if (Math.abs(drift) > tol) {
        const want = rate * (1 + Math.max(-HF_GLIDE_MAX,
                                 Math.min(HF_GLIDE_MAX, drift / HF_GLIDE_MS)));
        if (Math.abs(a.playbackRate - want) > 0.01) a.playbackRate = want;
      } else if (a.playbackRate !== rate) {
        a.playbackRate = rate;
      }
    } catch (e) { /* an animation can be cancelled mid-walk; skip it */ }
  });
}
