'use strict';
// A virtual clock for the journey harness. Timers never fire on their own:
// advance(ms) moves time forward and runs every timer that falls due, in due
// order, so a run is the same on every machine and every time.

function createClock(startMs) {
  let now = startMs;
  let nextId = 1;
  const timers = new Map();          // id -> {due, fn, args, interval, seq}
  let seq = 0;
  let onError = err => { throw err; };

  function add(fn, ms, args, interval) {
    const id = nextId++;
    const delay = Math.max(0, Number(ms) || 0);
    timers.set(id, { due: now + delay, fn, args, interval: interval ? Math.max(1, delay) : 0, seq: seq++ });
    return id;
  }

  const api = {
    now: () => now,
    setTimeout: (fn, ms, ...args) => (typeof fn === 'function' ? add(fn, ms, args, false) : 0),
    clearTimeout: id => { timers.delete(id); },
    setInterval: (fn, ms, ...args) => (typeof fn === 'function' ? add(fn, ms, args, true) : 0),
    clearInterval: id => { timers.delete(id); },
    requestAnimationFrame: fn => add(() => fn(now), 16, [], false),
    cancelAnimationFrame: id => { timers.delete(id); },
    onError(fn) { onError = fn; },
    // Run every timer due within `ms` from now; time ends exactly at now + ms.
    advance(ms) {
      const target = now + Math.max(0, ms);
      let guard = 0;
      for (;;) {
        let pick = null, pickId = null;
        for (const [id, t] of timers) {
          if (t.due > target) continue;
          if (!pick || t.due < pick.due || (t.due === pick.due && t.seq < pick.seq)) { pick = t; pickId = id; }
        }
        if (!pick) break;
        if (++guard > 100000) throw new Error('virtual clock: more than 100000 timers fired in one advance (runaway interval?)');
        now = Math.max(now, pick.due);
        if (pick.interval) { pick.due = now + pick.interval; pick.seq = seq++; }
        else timers.delete(pickId);
        try { pick.fn.apply(null, pick.args); } catch (err) { onError(err); }
      }
      now = target;
    },
    // Pending timers, bucketed by how soon they fire, for the snapshot.
    pending() {
      const out = { soon: 0, short: 0, long: 0, intervals: 0 };
      for (const t of timers.values()) {
        if (t.interval) { out.intervals++; continue; }
        const d = t.due - now;
        if (d <= 500) out.soon++; else if (d <= 5000) out.short++; else out.long++;
      }
      return out;
    },
    // Sweep-compatible: run everything that is queued, however far out.
    flushTimers(limitMs = 60000) { api.advance(limitMs); },
    count: () => timers.size,
  };
  return api;
}

module.exports = { createClock };
