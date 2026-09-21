// ─── Thermometer Component ────────────────────────────────────────────────────
// Unified comparison visual used throughout the app (My Progress, peer benchmarks, etc.)
// Single source of truth: if the visual ever changes, edit only this file.
//
// Scales to max(userVal, peerVal):
//   - User > peer:  peer marker left, user at 100% (right edge), accent fill
//   - User < peer:  user left of peer, peer at 100% (right edge), warn fill
//   - Equal:        both at 100%, neutral color

function renderThermometer(userVal, peerVal, opts) {
  opts = opts || {};
  var higherIsBetter = opts.higherIsBetter !== false;
  var userLabel = opts.userLabel || 'You';
  var peerLabel = opts.peerLabel || 'Avg';

  var barMax = Math.max(userVal, peerVal, 1);
  var userPct = Math.round(userVal / barMax * 100);
  var peerPct = Math.round(peerVal / barMax * 100);

  var isGood = (userVal >= peerVal) === higherIsBetter;
  var fillColor = isGood ? 'var(--accent)' : 'var(--warn)';

  var fillMin = Math.min(userPct, peerPct);
  var fillMax = Math.max(userPct, peerPct);

  return `
    <div style="position:relative;height:36px;margin:10px 0 4px;">
      <div style="position:absolute;top:18px;left:0;right:0;height:4px;background:var(--bar);border-radius:2px;"></div>
      <div style="position:absolute;top:18px;left:0;height:4px;width:${fillMin}%;background:var(--muted);opacity:.5;border-radius:2px;"></div>
      <div style="position:absolute;top:18px;left:${fillMin}%;height:4px;width:${fillMax - fillMin}%;background:${fillColor};border-radius:2px;"></div>
      <div style="position:absolute;top:10px;left:${peerPct}%;width:2px;height:16px;background:var(--muted);border-radius:1px;transform:translateX(-50%);"></div>
      <div style="position:absolute;top:10px;left:${userPct}%;width:2px;height:16px;background:${fillColor};border-radius:1px;transform:translateX(-50%);"></div>
      <div style="position:absolute;top:0;left:${Math.max(2, Math.min(96, peerPct))}%;font-size:9px;font-weight:700;color:var(--muted);transform:translateX(-50%);white-space:nowrap;">${h(peerLabel)}</div>
      <div style="position:absolute;top:0;left:${Math.max(2, Math.min(96, userPct))}%;font-size:9px;font-weight:700;color:${fillColor};transform:translateX(-50%);white-space:nowrap;">${h(userLabel)}</div>
    </div>
  `;
}
