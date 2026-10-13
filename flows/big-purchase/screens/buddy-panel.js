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

// NO SUBTITLE. It carried the open row's label, which the transcript already
// says — the row's name IS the first question, echoed as the user's own bubble
// the moment they tap it. A header repeating it was the same word twice on one
// screen, and it cost the only line of chrome that varied.
function renderEsfBuddyPanel() {
  const b = esfBuddy();
  if (!b.open) return "";

  return `
    <div class="esf-buddy-scrim" onclick="esfBuddyClose()"></div>
    <div class="esf-buddy" role="dialog" aria-modal="true" aria-label="Ask Buddy">

      <div class="esf-buddy-head">
        <p class="esf-buddy-title">Ask Buddy</p>
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
        ${renderEsfBuddyNav()}
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

/**
 * The control under the transcript while a lifestyle question set is running.
 *
 * A LIST INSIDE THE PANEL, not a native <select>.
 *
 * It was a <select> first, which is what the owner asked for and is right on a
 * real phone, where the options open as a picker sheet. But this prototype is a
 * phone FRAME inside a desktop browser, and a select's option list is drawn by
 * the operating system — it is not laid out by the page, so it ignores the
 * frame entirely and spills out of the bottom of the phone. Nothing in CSS can
 * contain it.
 *
 * So the options are ordinary buttons in the panel's own footer, capped in
 * height and scrolling inside it. Same one-tap choice, same full option text
 * with the brand names that make it readable, and it can never leave the frame.
 */
function renderEsfBuddyQuestion() {
  const b = esfBuddy();
  if (!b.q || b.q.done) return "";
  const q = esfLifestyleQuestion(b.q.rowId, b.q.index);
  if (!q) return "";
  const total = (esfLifestyleSet(b.q.rowId).questions || []).length;

  return `
    <div class="esf-buddy-q">
      <span class="esf-buddy-q-step">Question ${b.q.index + 1} of ${total}</span>
      <div class="esf-buddy-opts" role="group" aria-label="${h(q.ask)}">
        ${(q.options || []).map(o => `
          <button class="esf-buddy-opt" type="button"
                  onclick="esfBuddyAnswerLifestyle('${h(o.id)}')">${h(o.label)}</button>`).join("")}
      </div>
    </div>`;
}

/**
 * The handback. Buddy proposes, the user confirms.
 *
 * He never writes a figure into the row without this tap — and the panel stays
 * open afterwards, so the row visibly changes behind it.
 */
function renderEsfBuddyApply() {
  const amount = esfBuddyPendingFigure();
  if (amount == null) return "";
  // A row of its own, above the menu. This is THE action at this moment, and
  // sitting it in a rack beside two ways out would make it one option of three.
  return `
    <div class="esf-buddy-applyrow">
      <button class="esf-buddy-apply" type="button"
              onclick="esfBuddyApplyFigure()">Use ${h(esfMoney(amount))}</button>
    </div>`;
}

/** The answer choices, plus the two ways back. */
function renderEsfBuddyChips() {
  const b = esfBuddy();
  // A running question set owns the footer — its dropdown, or the figure it
  // arrived at. The row's own chips would be a second thing to answer.
  if (b.q) return b.q.done ? renderEsfBuddyApply() : renderEsfBuddyQuestion();
  const entry = b.node ? esfBuddyEntry(b.node) : null;
  // esfBuddyChipsFor, not entry.chips — a variant entry keeps its choices in
  // chipsIf and has no `chips` at all, so reading the raw key silently dropped
  // every answer on the medical row and left only the two nav chips.
  const chips = (b.chips || [])
    .map(id => esfBuddyFindChip(esfBuddyChipsFor(entry), id))
    .filter(Boolean);
  // Navigation is NOT in here any more — it lives in renderEsfBuddyNav below,
  // in a fixed row. This rack only ever carries answers to what Buddy just
  // asked, so nothing in it moves position for reasons the user cannot see.
  if (!chips.length) return "";

  return `
    <div class="chat-chips esf-buddy-chips">
      ${chips.map(c => `
        <button class="chat-chip" type="button"
                onclick="esfBuddyChip('${h(c.id)}')">${h(c.label)}</button>`).join("")}
    </div>`;
}

/**
 * THE MENU. Three buttons, one row, always the same three in the same order:
 *
 *     [ Back to the list ]   [ Start over ]   [ Help me calculate this ]
 *
 * FIXED POSITION IS THE WHOLE POINT — a pattern to learn once, not a rack that
 * reshuffles as the conversation moves. It used to be exactly that: these
 * appeared and disappeared among the answer chips and wrapped onto a second
 * line, so the same action sat somewhere different on nearly every screen.
 *
 * A button that does not apply right now is DISABLED, never removed. Removing
 * one would shift the other two, which is the one thing this row exists to
 * prevent.
 *
 * "Help me calculate this" rather than "Help me work it out" — owner's call.
 * "Work it out" describes a mood; "calculate this" names the action and says it
 * applies to the row in front of you.
 */
function renderEsfBuddyNav() {
  const b = esfBuddy();
  // Nothing has happened yet: the question list IS the screen and needs no menu.
  if (!b.node && !b.thread.length) return "";

  const entry = b.node ? esfBuddyEntry(b.node) : null;
  const rowId = (entry && entry.row) || "";
  const canAsk = !!(rowId && typeof esfHasLifestyle === "function" &&
                    esfHasLifestyle(rowId) && !b.q);

  return `
    <div class="esf-buddy-nav">
      <button class="esf-buddy-navbtn" type="button" ${b.node ? "" : "disabled"}
              onclick="esfBuddyToList()">Back to the list</button>
      <button class="esf-buddy-navbtn" type="button" ${b.thread.length ? "" : "disabled"}
              onclick="esfBuddyStartOverHere()">Start over</button>
      <button class="esf-buddy-navbtn esf-buddy-navbtn-go" type="button" ${canAsk ? "" : "disabled"}
              onclick="esfBuddyAskLifestyle('${h(rowId)}')">Help me calculate this</button>
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
