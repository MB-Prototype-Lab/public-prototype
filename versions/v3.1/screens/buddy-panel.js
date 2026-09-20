// ─── The Ask Buddy panel ─────────────────────────────────────────────────────
// Renders the overlay and the pill that opens it. All state and navigation live
// in js/buddy-esf.js — this file only draws, the same split screens/chat.js has
// with js/chat-router.js.
//
// ── IT PAINTS INTO ITS OWN ROOT ──────────────────────────────────────────────
// #buddyRoot is a SIBLING of #screenRoot in index.html, not a child — exactly
// like #keyboardRoot, and for the same reason turned up a different way.
//
// esf-build.js warns that closing the simulated keypad removes 250px of layout,
// which pulls a button out from under a finger mid-press so no click is ever
// dispatched. A pill inside the scrolling screen inherits that. In its own
// fixed layer the keypad's reflow cannot move it, so the press always lands.
// Do NOT solve this locally with a second press latch — kbdInit already owns
// that problem and two latches racing is worse than one.
//
// ── THE PANEL SCROLLS. THE ESF SCREENS STILL DO NOT. ─────────────────────────
// Owner's ruling: "I want users to see each question they answered, otherwise
// it's a lot of clicking to go back." So this is a real accumulating
// transcript — every question and answer stays on screen, stacked, and the user
// scrolls back through them. The no-scrolling rule is about the ESF capture
// screens, and this panel is the one place it is deliberately relaxed.

// ── The Ask button ───────────────────────────────────────────────────────────
// IN THE FOOTER, between Back and Continue. It floated above the footer at
// first, which cost no layout but sat on top of whatever row happened to be
// under it — on step 3 that was the Medical label. The ESF steps have no nav
// bar to hang it off (esf-build.js: "NAV BAR: Hidden — full-bleed"), so the
// footer is the only bar there is, and the owner's call is that it belongs in
// it: Back on the left, Ask in the middle, the green primary on the right.
//
// LEGO orange with DARK text. That pairing is not a style choice:
//   #2B1A0E on #FF6D00 is about 5.2:1 and passes AA.
//   White on #FF6D00 is about 2.9:1 and FAILS.
// Green is already the action colour — Open on Home, Continue on every ESF
// step. Buddy is not a task, so he gets a warm accent of his own that says
// optional, available, on your side, and does not compete with the primary CTA.
// Orange reads as WARNING in finance UI; the dog's face and using this colour
// for nothing else is what mitigates that.
//
// The word is "Ask" and the dog carries the rest. "Help" is what people scan
// for when stuck but it reads as app support, and testers did not want
// support — they wanted the dog.
//
// The art is an <img> when it exists and the emoji otherwise. A missing
// illustration must degrade to something, never to a gap where a face was
// promised (D10's rule, applied to a button).
const ESF_BUDDY_PILL_ART = "assets/img/buddy-ask.png";
const ESF_BUDDY_CHAT_ART = "assets/img/buddy-chat.png";

// Swaps in the emoji if the file is missing, so the button is never wordless.
const ESF_BUDDY_ART_FALLBACK =
  "this.replaceWith(Object.assign(document.createElement('span')," +
  "{className:'esf-ask-emoji',textContent:'\\u{1F436}'}))";

/**
 * The footer button. Rendered INTO the screen's own footer by esf-build.js and
 * esf-plan.js, not into #buddyRoot — it is part of the bar now, so it moves
 * with it rather than hovering over the content.
 */
function renderEsfBuddyButton() {
  if (!esfBuddyAvailable()) return "";
  return `
    <button class="esf-ask" type="button" onclick="esfBuddyOpen()"
            aria-label="Ask Buddy for help with this screen">
      <span>Ask</span>
      <img class="esf-ask-face" src="${h(ESF_BUDDY_PILL_ART)}" alt="" aria-hidden="true"
           onerror="${ESF_BUDDY_ART_FALLBACK}">
    </button>`;
}

// ── The panel ────────────────────────────────────────────────────────────────
// Two notes about the bar at the bottom, kept OUT of the markup below. HTML
// comments inside a template literal are rendered into the DOM, and a backtick
// inside one ends the literal early — which is a JS syntax error several
// hundred lines from anything that looks like the cause.
//
// THE X IS BOTTOM-LEFT. Away from the thumb's natural travel so it is not hit
// by accident, still inside one-handed reach.
//
// THE INPUT IS PRESENT, VISIBLE AND INERT. It stays because it says "this is a
// chat" at a glance, and removing it would hide the thing testers said they
// wanted. It is inert because free text in a decision-tree prototype tests the
// tree's coverage instead of the idea — nobody has to type a figure anywhere in
// this feature. The `disabled` attribute is what guarantees the simulated
// keypad can never open from it. The wrapper carries the click handler because
// a disabled field dispatches no events, and that tap is the MEASUREMENT: how
// many testers reach for it anyway is the demand for the real thing.

function renderEsfBuddyPanel() {
  const b = esfBuddy();
  if (!b.open) return "";
  const entry = b.node ? esfBuddyEntry(b.node) : null;

  return `
    <div class="esf-buddy-scrim" onclick="esfBuddyClose()"></div>
    <div class="esf-buddy" role="dialog" aria-modal="true" aria-label="Ask Buddy">

      <div class="esf-buddy-head">
        <div class="esf-buddy-headtext">
          <p class="esf-buddy-title">Ask Buddy</p>
          <p class="esf-buddy-sub">${h(entry ? entry.label : "Pick what you'd like help with")}</p>
        </div>
        <img class="esf-buddy-hero" src="${h(ESF_BUDDY_CHAT_ART)}" alt="" aria-hidden="true"
             onerror="${ESF_BUDDY_ART_FALLBACK}">
      </div>

      <div class="esf-buddy-thread" id="esfBuddyThread">
        ${b.thread.length ? "" : `<p class="esf-buddy-prompt">${h(esfBuddyPrompt())}</p>`}
        ${renderEsfBuddyThread()}
        ${b.node ? "" : renderEsfBuddyList()}
      </div>

      <div class="esf-buddy-foot">
        ${renderEsfBuddyChips()}
        <div class="esf-buddy-bar">
          <button class="esf-buddy-x" type="button" onclick="esfBuddyClose()"
                  aria-label="Close Buddy">&times;</button>
          <span class="esf-buddy-inputwrap" onclick="esfBuddyInputTapped()">
            <input class="esf-buddy-input" type="text" disabled aria-disabled="true"
                   tabindex="-1" placeholder="Or type a question...">
          </span>
        </div>
      </div>

    </div>`;
}

/**
 * The transcript.
 *
 * Buddy's runs carry ONE avatar, on the last bubble of the run, with the bubbles
 * above it tucked in. Three stacked paragraphs each wearing the same face reads
 * as three people talking; one face under a run reads as somebody finishing a
 * thought. That is the difference between this and a list of notices, and it is
 * most of what makes the panel look like a chat.
 */
function renderEsfBuddyThread() {
  const thread = esfBuddy().thread;
  return thread.map((m, i) => {
    const mine = m.from === "user";
    const next = thread[i + 1];
    const endsRun = !next || next.from !== m.from;
    if (mine) {
      return `
        <div class="chat-row chat-row-user esf-buddy-row">
          <div class="chat-bubble chat-bubble-user ${endsRun ? "" : "esf-bubble-mid"}">${h(m.text)}</div>
        </div>`;
    }
    return `
      <div class="chat-row esf-buddy-row ${endsRun ? "esf-buddy-row-end" : ""}">
        <span class="esf-buddy-avatar" aria-hidden="true">${endsRun
          ? `<img src="${h(ESF_BUDDY_PILL_ART)}" alt="" onerror="${ESF_BUDDY_ART_FALLBACK}">`
          : ""}</span>
        <div class="chat-bubble chat-bubble-buddy ${endsRun ? "" : "esf-bubble-mid"}">${h(m.text)}</div>
      </div>`;
  }).join("");
}

/**
 * The question list.
 *
 * Shown ALWAYS, even where there is only one entry (owner's ruling) — a
 * consistent shape, and the list is how the user learns what Buddy can talk
 * about. Rows already asked about are ticked and STILL TAPPABLE, because an
 * answer can be changed.
 */
function renderEsfBuddyList() {
  const b = esfBuddy();
  const items = esfBuddyItems();
  if (!items.length) return "";

  return `
    <div class="esf-buddy-list">
      ${items.map(id => {
        const entry = esfBuddyEntry(id);
        const done = !!b.asked[id];
        return `
          <button class="esf-buddy-item ${done ? "esf-buddy-item-done" : ""}" type="button"
                  onclick="esfBuddyPick('${h(id)}')">
            <span>${h(entry.label)}</span>
            <span class="esf-buddy-item-mark" aria-hidden="true">${done ? "&#10003;" : "&rsaquo;"}</span>
          </button>`;
      }).join("")}
    </div>`;
}

/** The answer choices, plus the two ways back. */
function renderEsfBuddyChips() {
  const b = esfBuddy();
  const entry = b.node ? esfBuddyEntry(b.node) : null;
  const chips = (b.chips || []).map(id => esfBuddyFindChip(entry && entry.chips, id)).filter(Boolean);
  const showBack = !!b.node;
  const showOver = b.thread.length > 0;
  if (!chips.length && !showBack && !showOver) return "";

  return `
    <div class="chat-chips esf-buddy-chips">
      ${chips.map(c => `
        <button class="chat-chip" type="button"
                onclick="esfBuddyChip('${h(c.id)}')">${h(c.label)}</button>`).join("")}
      ${showBack ? `<button class="chat-chip esf-buddy-chip-nav" type="button"
                            onclick="esfBuddyToList()">Back to the list</button>` : ""}
      ${showOver ? `<button class="chat-chip esf-buddy-chip-nav" type="button"
                            onclick="esfBuddyStartOver()">Start over</button>` : ""}
    </div>`;
}

/**
 * The fixed layer, painted by render() into #buddyRoot.
 *
 * Only the PANEL lives here now — the Ask button moved into each screen's own
 * footer. The panel still belongs in its own root: it has to sit over the
 * screen, and the keypad must not be able to shift it.
 */
function renderEsfBuddyLayer() {
  if (!esfBuddyAvailable()) return "";
  return renderEsfBuddyPanel();
}

/**
 * Pin the transcript to the newest message, the way a real chat behaves.
 * Called from render() after the panel DOM exists — chatMountHook()'s twin.
 */
function esfBuddyMountHook() {
  const t = document.getElementById("esfBuddyThread");
  if (t) t.scrollTop = t.scrollHeight;
}

/**
 * The line that replaces "Based on …" on a disclosed row.
 *
 * REPLACES, never joins — rule 3 in js/buddy-esf.js. It is a button because of
 * rule 4: a user who mis-taps "my rent covers utilities" must be able to undo
 * it without hunting for where they said it.
 */
function esfDisclosureNote(rowId) {
  const found = esfDisclosureFor(rowId);
  if (!found) return "";
  return `
    <button type="button" class="esf-based esf-disclosed"
            onclick="esfBuddyReopenDisclosure('${h(rowId)}')"
            title="Tap to change this answer">${h(found.note)}</button>`;
}
