// State and navigation live in js/buddy-esf.js; this file renders them.
// The overlay uses a sibling root so keypad reflow cannot shift it; kbdInit
// owns the shared press latch. The Ask button belongs in each screen's footer.
// Allow transcript scrolling so all answers remain reviewable while capture
// screens stay compact. Use the themed Ask accent with contrasting text.
// Missing owner-supplied art falls back to emoji rather than an empty face.
const ESF_BUDDY_PILL_ART = "assets/img/buddy-ask.png";
const ESF_BUDDY_CHAT_ART = "assets/img/buddy-chat.png";

// Swaps in the emoji if the file is missing, so the button is never wordless.
const ESF_BUDDY_ART_FALLBACK =
  "this.replaceWith(Object.assign(document.createElement('span')," +
  "{className:'esf-ask-emoji',textContent:'\\u{1F436}'}))";

// Place Ask in the screen footer so it cannot cover expense rows.
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

// Keep comments with backticks outside template markup: a backtick in an
// HTML comment still terminates the JavaScript literal.
// Keep Close at bottom-left to reduce accidental taps. The disabled input
// signals chat without opening the keypad; its wrapper records demand taps
// because disabled fields dispatch no events.
// The transcript already names the row, so the header needs no subtitle.
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

// Use one avatar on the final bubble of each Buddy run so adjacent
// paragraphs read as one speaker's thought.
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

// Show the list even for one question to make Buddy's coverage visible.
// Keep answered rows tappable so answers can be changed.
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

// Use scrolling buttons within the phone frame. Native select options are
// OS-drawn and can escape the frame regardless of page CSS.
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

// Render answer choices separately from navigation.
function renderEsfBuddyChips() {
  const b = esfBuddy();
  // A question set owns the footer until it supplies a figure; row chips
  // would introduce a second question to answer.
  if (b.q) return b.q.done ? renderEsfBuddyApply() : renderEsfBuddyQuestion();
  const entry = b.node ? esfBuddyEntry(b.node) : null;
  // Use esfBuddyChipsFor because variant entries can store choices in chipsIf
  // instead of chips; reading the raw field would hide valid answers.
  const chips = (b.chips || [])
    .map(id => esfBuddyFindChip(esfBuddyChipsFor(entry), id))
    .filter(Boolean);
  // Keep navigation in its fixed row; this rack carries only current answers.
  if (!chips.length) return "";

  return `
    <div class="chat-chips esf-buddy-chips">
      ${chips.map(c => `
        <button class="chat-chip" type="button"
                onclick="esfBuddyChip('${h(c.id)}')">${h(c.label)}</button>`).join("")}
    </div>`;
}

// Keep three navigation buttons in a stable order and position. Disable
// unavailable actions rather than removing them and shifting the others.
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

// Paint only the overlay into #buddyRoot so it stays above the screen
// and cannot be displaced by the keypad; Ask lives in the screen footer.
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
