'use strict';
// The same media rules as the VM (tests/lib/app-vm.cjs), for a real page: a
// missing file rejects play() and fires `error`; a .wav plays for its length
// on the page clock and fires `ended`; other files play without ending.
// Speech is removed so narration falls back to the same timers as the VM.

const fs = require('node:fs');
const path = require('node:path');

function wavDuration(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(4096);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    if (n < 44 || head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') return 'stream';
    let off = 12, byteRate = 0;
    while (off + 8 <= n) {
      const id = head.toString('ascii', off, off + 4); const size = head.readUInt32LE(off + 4);
      if (id === 'fmt ') byteRate = head.readUInt32LE(off + 16);
      if (id === 'data') return byteRate ? size / byteRate : 'stream';
      off += 8 + size + (size % 2);
    }
    return 'stream';
  } finally { fs.closeSync(fd); }
}

// {path relative to app/: seconds | 'stream'} for every media file present.
function mediaDurations(appDir) {
  const out = {};
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(wav|mp3|m4a|ogg|mp4|webm|mov)$/i.test(e.name)) {
        out[path.relative(appDir, p).split(path.sep).join('/')] = /\.wav$/i.test(e.name) ? wavDuration(p) : 'stream';
      }
    }
  };
  walk(appDir);
  return out;
}

function shimSource(durations) {
  return `(function (D) {
  try { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); } catch (e) {}
  try { window.SpeechSynthesisUtterance = undefined; } catch (e) {}
  var root = new URL('.', location.href).href;
  var st = new WeakMap();
  function S(el) { var s = st.get(el); if (!s) { s = { paused: true, ended: false, t: 0, startedAt: 0, timer: null, rate: 1 }; st.set(el, s); } return s; }
  function dur(el) {
    var a = el.getAttribute('src') || '', rel = '';
    try { rel = decodeURIComponent(new URL(a, location.href).href.slice(root.length).split(/[?#]/)[0]); } catch (e) {}
    return Object.prototype.hasOwnProperty.call(D, rel) ? D[rel] : null;
  }
  function cur(el) {
    var s = S(el); if (s.paused) return s.t;
    var d = dur(el), t = s.t + (Date.now() - s.startedAt) / 1000 * s.rate;
    return typeof d === 'number' ? Math.min(t, d) : t;
  }
  var P = HTMLMediaElement.prototype;
  P.play = function () {
    var el = this, s = S(el), d = dur(el);
    if (d === null) {
      setTimeout(function () { el.dispatchEvent(new Event('error')); }, 0);
      var p = Promise.reject(new DOMException('The element has no supported sources.', 'NotSupportedError'));
      p.catch(function () {});
      return p;
    }
    if (!s.paused) return Promise.resolve();
    if (s.ended) { s.ended = false; s.t = 0; }
    s.paused = false; s.startedAt = Date.now();
    if (typeof d === 'number') {
      s.timer = setTimeout(function () {
        s.t = d; s.paused = true; s.ended = true; s.timer = null;
        el.dispatchEvent(new Event('ended'));
      }, Math.max(0, (d - s.t) * 1000 / s.rate));
    }
    el.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  P.pause = function () {
    var s = S(this); if (s.paused) return;
    s.t = cur(this); s.paused = true;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    this.dispatchEvent(new Event('pause'));
  };
  P.load = function () {};
  Object.defineProperty(P, 'paused', { get: function () { return S(this).paused; }, configurable: true });
  Object.defineProperty(P, 'ended', { get: function () { return S(this).ended; }, configurable: true });
  Object.defineProperty(P, 'currentTime', { configurable: true,
    get: function () { return cur(this); },
    set: function (v) { var s = S(this), playing = !s.paused; if (playing) this.pause(); s.t = Math.max(0, Number(v) || 0); s.ended = false; if (playing) this.play(); } });
  Object.defineProperty(P, 'duration', { get: function () { var d = dur(this); return typeof d === 'number' ? d : NaN; }, configurable: true });
  Object.defineProperty(P, 'playbackRate', { get: function () { return S(this).rate; }, set: function (v) { S(this).rate = Number(v) || 1; }, configurable: true });
  Object.defineProperty(P, 'readyState', { get: function () { return 0; }, configurable: true });
})(${JSON.stringify(durations)});`;
}

module.exports = { mediaDurations, shimSource };
