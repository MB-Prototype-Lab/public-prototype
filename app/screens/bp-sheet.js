// ─── Big Purchase — in-frame sheets ──────────────────────────────────────────
// Spec §1 principle 9 and §9. Every chooser and info panel in this tool opens
// INSIDE the phone frame. Never alert(), confirm() or a native <select>: all
// three are drawn by the operating system, ignore the frame, and spill out of
// the bottom of the phone (the ESF's lesson — see screens/buddy-panel.js).
//
// Painted into #buddyRoot with the Buddy panel, for the same reason the panel
// lives there: the simulated keypad's 250px reflow cannot move it.

// ── Typed fields and the tap that blurs them ─────────────────────────────────
// A typed field commits on `change`, which fires on blur — and the blur happens
// on pointerdown of whatever is tapped next. If that is Continue and the change
// handler calls render(), the button is replaced before the finger lifts, and
// no click is ever dispatched on it. The keypad's press latch holds the LAYOUT
// still; it cannot hold the NODE. So when a press is in flight the field only
// queues its repaint, and the button's own handler renders (render() cancels
// the queued one). Tapping somewhere inert still repaints, 400ms later.
let bpPressInFlight = false;
document.addEventListener("pointerdown", function (e) {
  const t = e.target;
  bpPressInFlight = !!(t && t.closest && t.closest("button, [role='radio'], [role='button'], [role='checkbox']"));
}, true);
document.addEventListener("pointerup", function () {
  setTimeout(function () { bpPressInFlight = false; }, 0);
}, true);

function bpFieldCommitted() {
  if (bpPressInFlight) { debouncedRender(); return; }
  render();
}

function bpOpenSheet(name) {
  const s = bpSession();
  s.ui.sheet = name;
  render();
}

function bpCloseSheet() {
  const s = bpSession();
  s.ui.sheet = null;
  render();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderBpSheetFrame(title, body) {
  return `
    <div class="esf-buddy-scrim" onclick="bpCloseSheet()"></div>
    <div class="esf-buddy bp-sheet" role="dialog" aria-modal="true" aria-label="${h(title)}">
      <div class="bp-sheet-head"><p class="esf-buddy-title">${h(title)}</p></div>
      <div class="bp-sheet-body">${body}</div>
      <div class="bp-sheet-foot"><button class="button secondary full" type="button" onclick="bpCloseSheet()">Close</button></div>
    </div>`;
}

/** Down payment, loan length or credit score — the choices behind one row. */
function renderBpFinSheet() {
  const s = bpSession();
  const d = bpData();
  const fin = d.financing || {};
  const credit = d.credit || {};
  const field = s.ui.fin;
  let title = "", opts = [], cur = null;
  if (field === "down") {
    title = "Down payment";
    const price = Number(bpSelectedCard().inputs.price) || 0;
    opts = (fin.downOptions || [0.1, 0.2]).map(p => ({ v: p, label: Math.round(p * 100) + "% · " + bpMoney(price * p) }))
             .concat([{ v: "'other'", label: "A different amount" }]);
    cur = s.pay.down === "other" ? "'other'" : s.pay.down;
  } else if (field === "term") {
    title = "Loan length";
    opts = (fin.terms || [36, 48, 60, 72]).map(t => ({ v: t, label: t + " months (" + (t / 12) + " years)" }));
    cur = s.pay.term;
  } else {
    title = "Credit score";
    opts = (credit.order || []).slice().reverse().map(t => ({ v: "'" + t + "'", label: (credit.labels || {})[t] || t }))
             .concat([{ v: "'other'", label: "I know my rate" }]);
    cur = s.pay.typedRate != null ? "'other'" : "'" + s.pay.credit + "'";
  }
  const body = `
    <div class="bp-sheet-list">
      ${opts.map(o => `<button class="bp-opt ${String(o.v) === String(cur) ? "on" : ""}" type="button"
                         onclick="bpFinChoose('${field}', ${o.v})">${h(o.label)}</button>`).join("")}
    </div>
    ${field === "credit" ? `<p class="bp-based" style="margin-top:10px;">Not your real score — just the one we use to
       pick a typical rate.</p>` : ""}`;
  return renderBpSheetFrame(title, body);
}

/** The whole BP layer, painted into #buddyRoot by render(). */
function renderBpLayer() {
  if (!state.bp || ["bpLanding", "bpFinder", "bpYourCar"].indexOf(state.screen) === -1) return "";
  const s = state.bp;
  const sheet = s.ui && s.ui.sheet;
  if (sheet === "fin")          return renderBpFinSheet();
  if (sheet === "bpfMake")      return renderBpfListSheet("make");
  if (sheet === "bpfModel")     return renderBpfListSheet("model");
  if (sheet === "bpYcAlts")     return renderBpYcAltsSheet();
  if (sheet === "bpYcOpt")      return renderBpYcOptSheet();
  if (sheet === "bpfPeerRange") return renderBpfPeerRangeSheet();
  return renderBpBuddyPanel();
}
