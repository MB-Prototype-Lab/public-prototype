// ─── Simulated iOS keyboard ──────────────────────────────────────────────────
// A phone-shaped prototype opened on a desktop has no keyboard in the frame, so
// a tester typing on a physical keyboard never sees the thing that eats the
// bottom 40% of a real phone screen. This puts it back.
//
// ── WHY IT LIVES OUTSIDE #screenRoot ─────────────────────────────────────────
// render() reassigns screenRoot.innerHTML wholesale (js/render.js). Anything
// rendered by a screen file is destroyed and rebuilt on every state change, and
// a keyboard rebuilt mid-keystroke would take the caret with it. So the keyboard
// paints into its own root — #keyboardRoot, a sibling of #screenRoot inside
// .screen — which render() never touches.
//
// ── WHY IT IS DELEGATED, NOT WIRED PER FIELD ─────────────────────────────────
// One focusin/focusout listener on #screenRoot covers every input in the app,
// including screens that do not exist yet. Wiring markup per field would mean
// touching ~20 screen files and forgetting the twenty-first.
//
// ── WHY KEYS FIRE ON pointerdown, NOT click ──────────────────────────────────
// A click on the keyboard would blur the field first, which closes the keyboard
// and loses the caret. pointerdown + preventDefault() keeps focus exactly where
// it is, and the value is written straight into the element.
//
// ── WHY IT DISPATCHES REAL EVENTS ────────────────────────────────────────────
// Every field in the app commits through `oninput` / `onchange` handlers. A
// simulated key that only set `.value` would update the pixels and none of the
// state. Dispatching a genuine `input` event means the keyboard composes with
// the live-field pattern (js/utils.js uiSetEnabled) for free.

// Layout rows. Two families: the iOS letter/number/symbol stack for text, and a
// numeric pad for fields that only ever take digits.
const KBD_LAYERS = {
  abc: [
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l"],
    ["\u21E7","z","x","c","v","b","n","m","\u232B"],
    ["123","\u0020",".","return"]
  ],
  num: [
    ["1","2","3","4","5","6","7","8","9","0"],
    ["-","/",":",";","(",")","$","&","@","\""],
    ["#+=",".",",","?","!","'","\u232B"],
    ["ABC","\u0020","return"]
  ],
  sym: [
    ["[","]","{","}","#","%","^","*","+","="],
    ["_","\\","|","~","<",">","\u20AC","\u00A3","\u00A5","\u2022"],
    ["123",".",",","?","!","'","\u232B"],
    ["ABC","\u0020","return"]
  ],
  pad: [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    [".","0","\u232B"]
  ]
};

// Keys that do something other than insert themselves.
const KBD_SHIFT     = "\u21E7";
const KBD_BACKSPACE = "\u232B";
const KBD_SPACE     = "\u0020";
const KBD_FUNCTION  = [KBD_SHIFT, KBD_BACKSPACE, "123", "ABC", "#+=", "return"];

// The focused field. A DOM node, so module-level rather than on `state` — the
// admin state inspector serialises everything it finds there.
let kbdTarget = null;

/**
 * A real phone already has a keyboard. Showing a fake one on top of it would be
 * absurd, so this is desktop-only — coarse pointer means touch.
 */
function kbdIsSimulated() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  try { return !window.matchMedia("(pointer: coarse)").matches; } catch (e) { return true; }
}

/** Which layer a field opens on. Digits-only fields get the pad. */
function kbdLayerFor(el) {
  const type = (el.getAttribute("type") || "").toLowerCase();
  const mode = (el.getAttribute("inputmode") || "").toLowerCase();
  if (type === "number" || mode === "numeric" || mode === "decimal") return "pad";
  return "abc";
}

/** Fields the keyboard applies to. Selects and checkboxes have their own UI. */
function kbdAccepts(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  const type = (el.getAttribute("type") || "text").toLowerCase();
  return ["text", "number", "search", "tel", "email", "password", ""].indexOf(type) !== -1;
}

// ── Open / close ─────────────────────────────────────────────────────────────

function kbdOpen(el) {
  if (!kbdIsSimulated() || !kbdAccepts(el)) return;
  kbdTarget = el;
  state.kbd.open  = true;
  state.kbd.layer = kbdLayerFor(el);
  state.kbd.shift = false;
  kbdPaint();
  // The field is usually near the bottom of a 390px frame — without this the
  // keyboard covers the thing being typed into.
  try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
}

function kbdClose() {
  kbdTarget = null;
  if (!state.kbd.open) return;
  state.kbd.open = false;
  kbdPaint();
}

// ── Keys ─────────────────────────────────────────────────────────────────────

/**
 * Write into the focused field at the caret and tell the app about it.
 *
 * `setRangeText` handles selections and caret position in one call; the
 * fallback covers inputs that do not expose a selection (number fields in some
 * browsers report selectionStart as null).
 */
function kbdInsert(text) {
  const el = kbdTarget;
  if (!el) return;
  const start = el.selectionStart, end = el.selectionEnd;
  if (typeof el.setRangeText === "function" && start != null && end != null) {
    el.setRangeText(text, start, end, "end");
  } else {
    el.value = String(el.value || "") + text;
  }
  kbdNotify();
}

function kbdBackspace() {
  const el = kbdTarget;
  if (!el) return;
  const start = el.selectionStart, end = el.selectionEnd;
  if (typeof el.setRangeText === "function" && start != null && end != null) {
    if (start === end) {
      if (start === 0) return;
      el.setRangeText("", start - 1, end, "end");
    } else {
      el.setRangeText("", start, end, "end");
    }
  } else {
    el.value = String(el.value || "").slice(0, -1);
  }
  kbdNotify();
}

/**
 * Fire the same event a physical keystroke would.
 *
 * Without this the pixels change and nothing else does: every field in the app
 * commits through an oninput/onchange attribute handler, and those only run on
 * a real event. This is what makes a simulated key enable a Continue button.
 */
function kbdNotify() {
  const el = kbdTarget;
  if (!el) return;
  try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
}

/** Return / Done: commit the field the way a blur would, and put it away. */
function kbdCommit() {
  const el = kbdTarget;
  if (el) {
    try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    try { el.blur(); } catch (e) {}
  }
  kbdClose();
}

/**
 * One key press. Called from pointerdown so the field never blurs.
 *
 * Layer switches and shift repaint the keyboard only — never render(), which
 * would rebuild the screen and drop the caret mid-word.
 */
function kbdKey(key) {
  const k = state.kbd;
  if (key === "return")      { kbdCommit(); return; }
  if (key === KBD_BACKSPACE) { kbdBackspace(); return; }
  if (key === KBD_SHIFT)     { k.shift = !k.shift; kbdPaint(); return; }
  if (key === "123")         { k.layer = "num"; kbdPaint(); return; }
  if (key === "ABC")         { k.layer = "abc"; k.shift = false; kbdPaint(); return; }
  if (key === "#+=")         { k.layer = "sym"; kbdPaint(); return; }

  kbdInsert(k.shift && k.layer === "abc" ? key.toUpperCase() : key);
  // iOS shift is one-shot unless double-tapped into caps lock; one-shot is the
  // behaviour people expect and the one that matters for a name field.
  if (k.shift) { k.shift = false; kbdPaint(); }
}

// ── Paint ────────────────────────────────────────────────────────────────────
// Writes #keyboardRoot only. render() never touches this subtree, and this
// never calls render() — the two repaint paths stay disjoint on purpose.

function kbdPaint() {
  const root = document.getElementById("keyboardRoot");
  if (!root) return;
  root.innerHTML = kbdMarkup();
  const screenRoot = document.getElementById("screenRoot");
  if (screenRoot) screenRoot.classList.toggle("kbd-open", !!state.kbd.open);
}

function kbdKeyLabel(key) {
  if (key === KBD_SPACE)  return "space";
  if (key === "return")   return "return";
  const k = state.kbd;
  return (k.shift && k.layer === "abc") ? key.toUpperCase() : key;
}

function kbdKeyClass(key) {
  if (key === KBD_SPACE)                 return "kbd-key kbd-key-space";
  if (key === "return")                  return "kbd-key kbd-key-return";
  if (key === KBD_SHIFT)                 return "kbd-key kbd-key-fn" + (state.kbd.shift ? " on" : "");
  if (KBD_FUNCTION.indexOf(key) !== -1)  return "kbd-key kbd-key-fn";
  return "kbd-key";
}

function kbdMarkup() {
  const k = state.kbd;
  if (!k.open) return "";
  const rows = KBD_LAYERS[k.layer] || KBD_LAYERS.abc;
  const pad  = k.layer === "pad";

  return `
    <div class="kbd ${pad ? "kbd-pad" : ""}" role="group" aria-label="On-screen keyboard">
      <div class="kbd-bar">
        <span class="kbd-hint">Simulated keyboard — your real one works too</span>
        <button class="kbd-done" type="button"
                onpointerdown="event.preventDefault();kbdCommit()">Done</button>
      </div>
      ${rows.map(row => `
        <div class="kbd-row">
          ${row.map(key => `
            <button class="${kbdKeyClass(key)}" type="button"
                    aria-label="${h(key === KBD_SPACE ? "space" : key)}"
                    onpointerdown="event.preventDefault();kbdKey('${h(key).replace(/'/g, "\\'")}')">${h(kbdKeyLabel(key))}</button>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

// ── Wiring ───────────────────────────────────────────────────────────────────

// ── THE BUTTON-PRESS LATCH ───────────────────────────────────────────────────
// Tapping Continue while the keyboard was up did nothing: the keyboard went
// away and the screen stayed. Three facts, all in this file and its stylesheet:
//
//   1. `.screen-scroll.kbd-open` adds 250px of padding-bottom (css/keyboard.css)
//   2. kbdClose() drops that class, so closing REMOVES 250px of layout (kbdPaint)
//   3. the focusout handler below closes on a setTimeout(…, 0)
//
// So: pointerdown blurs the field, focusout fires, the timeout lands BEFORE the
// finger lifts, the footer jumps 250px down, and pointerup happens over
// whatever is now under the finger. No `click` is ever dispatched on the button.
//
// The fix is to not close while a press is in flight. The blur still happens —
// nothing exotic — but the LAYOUT holds still, so the button stays put and the
// click lands normally. The keyboard then closes from kbdSyncAfterRender once
// the handler has re-rendered and the field it belonged to no longer exists.
//
// Deliberately NOT preventDefault() on the pointerdown. That would also work,
// by keeping focus on the field, and it is what the keyboard's own keys do —
// but they act ON pointerdown and never need a click, so they prove nothing
// about whether click survives a prevented pointerdown. That varies by browser
// and cannot be tested here.
let kbdPressPending = false;

/** Close if the field the keyboard belongs to has gone away. */
function kbdSyncAfterRender() {
  if (!state.kbd || !state.kbd.open) return;
  if (kbdTarget && document.body && document.body.contains(kbdTarget)) return;
  kbdPressPending = false;
  kbdClose();
}

function kbdClosest(el, sel) {
  return el && el.closest ? el.closest(sel) : null;
}

/**
 * One delegated set of listeners on #screenRoot, attached once at boot.
 *
 * focusin/focusout rather than focus/blur because those do not bubble — a
 * delegated listener would never see them. focusout is deferred a tick so that
 * moving between two fields does not flash the keyboard closed and open again.
 */
function kbdInit() {
  const root = document.getElementById("screenRoot");
  if (!root || !kbdIsSimulated()) return;

  root.addEventListener("focusin", function (e) {
    if (kbdAccepts(e.target)) { kbdOpen(e.target); return; }
    // A BUTTON TAKING FOCUS IS NOT A REASON TO CLOSE.
    //
    // This is the half the first fix missed. Chrome and Edge focus a <button>
    // on mousedown, so pressing Continue fires focusin with the BUTTON as the
    // target — and this branch closed the keyboard immediately, synchronously,
    // before the latch on focusout ever mattered. The layout dropped 250px and
    // the click was lost exactly as before. (Safari and Firefox on macOS do not
    // focus buttons this way, which is how it can look fixed on one machine.)
    if (kbdPressPending) return;
    kbdClose();
  });

  // Capture, so the latch is set before the blur this same gesture causes.
  root.addEventListener("pointerdown", function (e) {
    if (!state.kbd.open) return;
    if (kbdClosest(e.target, "#keyboardRoot")) return;   // its own keys self-handle
    if (kbdClosest(e.target, "button")) kbdPressPending = true;
  }, true);

  // The press resolved. If the handler re-rendered, the field is gone and
  // kbdSyncAfterRender has already closed; if it did not, close now.
  root.addEventListener("click", function () {
    if (!kbdPressPending) return;
    kbdPressPending = false;
    kbdSyncAfterRender();
    // The press did NOT change the screen — the field is still there and the
    // keyboard is still up, but focus is now sitting on the button that was
    // pressed. Hand it back, or the caret is gone from a field the tester is
    // still looking at a keyboard for.
    if (state.kbd.open && kbdTarget && document.body.contains(kbdTarget)) {
      try { kbdTarget.focus(); } catch (e) {}
    }
  }, true);

  // A press that never became a click — finger dragged off the button. Without
  // this the latch sticks and the keyboard can never close again.
  root.addEventListener("pointerup", function () {
    if (!kbdPressPending) return;
    setTimeout(function () {
      if (!kbdPressPending) return;             // the click handler got there first
      kbdPressPending = false;
      const active = document.activeElement;
      if (active && kbdAccepts(active)) return;
      kbdClose();
    }, 0);
  }, true);

  root.addEventListener("focusout", function (e) {
    const from = e.target;
    setTimeout(function () {
      if (kbdPressPending) return;                // a button press is mid-flight
      const active = document.activeElement;
      if (active && kbdAccepts(active)) return;   // moved to another field
      if (kbdTarget === from) kbdClose();
    }, 0);
  });
}
