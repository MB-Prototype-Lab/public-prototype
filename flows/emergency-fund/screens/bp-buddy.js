// ─── Ask Buddy — the Big Purchase panel ──────────────────────────────────────
// Draws the model in js/buddy-bp.js with the ESF panel's markup and classes, so
// the two panels are visually one component. Reads the art constants from
// screens/buddy-panel.js, which loads first.
//
// Painted into #buddyRoot by render(), never into the screen — the keypad's
// 250px reflow must not be able to move it (see screens/buddy-panel.js).

function renderBpBuddyButton() {
  if (!bpBuddyAvailable()) return "";
  return `
    <button class="esf-ask" type="button" onclick="bpBuddyOpen()"
            aria-label="Ask Buddy for help with this screen">
      <span>Ask</span>
      <img class="esf-ask-face" src="${h(ESF_BUDDY_PILL_ART)}" alt="" aria-hidden="true"
           onerror="${ESF_BUDDY_ART_FALLBACK}">
    </button>`;
}

function renderBpBuddyPanel() {
  const b = bpBuddy();
  if (!b.open) return "";
  // The finder's "See how we calculated this" opens the breakdown instead.
  if (b.calc && typeof renderBpfCalcPanel === "function") return renderBpfCalcPanel();
  return `
    <div class="esf-buddy-scrim" onclick="bpBuddyClose()"></div>
    <div class="esf-buddy" role="dialog" aria-modal="true" aria-label="Ask Buddy">
      <div class="esf-buddy-head">
        <p class="esf-buddy-title">Ask Buddy</p>
        <img class="esf-buddy-hero" src="${h(ESF_BUDDY_CHAT_ART)}" alt="" aria-hidden="true"
             onerror="${ESF_BUDDY_ART_FALLBACK}">
      </div>

      <div class="esf-buddy-thread" id="bpBuddyThread">
        ${b.thread.length ? "" : `<p class="esf-buddy-prompt">${h(bpBuddyPrompt())}</p>`}
        ${renderBpBuddyThread()}
        ${b.node ? "" : renderBpBuddyList()}
      </div>

      <div class="esf-buddy-foot">
        ${renderBpBuddyNav()}
        <div class="esf-buddy-bar">
          <button class="esf-buddy-x" type="button" onclick="bpBuddyClose()"
                  aria-label="Close Buddy">&times;</button>
          <span class="esf-buddy-inputwrap" onclick="bpBuddyInputTapped()">
            <input class="esf-buddy-input" type="text" disabled aria-disabled="true"
                   tabindex="-1" placeholder="Or type a question...">
          </span>
        </div>
      </div>
    </div>`;
}

function renderBpBuddyThread() {
  const thread = bpBuddy().thread;
  return thread.map((m, i) => {
    const next = thread[i + 1];
    const endsRun = !next || next.from !== m.from;
    if (m.from === "user") {
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

function renderBpBuddyList() {
  const b = bpBuddy();
  const items = bpBuddyItems();
  if (!items.length) return "";
  return `
    <div class="esf-buddy-list">
      ${items.map(id => {
        const entry = bpBuddyEntry(id);
        const done = !!b.asked[id];
        return `
          <button class="esf-buddy-item ${done ? "esf-buddy-item-done" : ""}" type="button"
                  onclick="bpBuddyPick('${h(id)}')">
            <span>${h(entry.label)}</span>
            <span class="esf-buddy-item-mark" aria-hidden="true">${done ? "&#10003;" : "&rsaquo;"}</span>
          </button>`;
      }).join("")}
    </div>`;
}

/** The ESF's fixed three-button row. "Help me calculate this" is always off in v1. */
function renderBpBuddyNav() {
  const b = bpBuddy();
  if (!b.node && !b.thread.length) return "";
  return `
    <div class="esf-buddy-nav">
      <button class="esf-buddy-navbtn" type="button" ${b.node ? "" : "disabled"}
              onclick="bpBuddyToList()">Back to the list</button>
      <button class="esf-buddy-navbtn" type="button" ${b.thread.length ? "" : "disabled"}
              onclick="bpBuddyStartOver()">Start over</button>
      <button class="esf-buddy-navbtn esf-buddy-navbtn-go" type="button" disabled>Help me calculate this</button>
    </div>`;
}

function bpBuddyMountHook() {
  const t = document.getElementById("bpBuddyThread");
  if (!t) return;
  // The finder's breakdown is a form, not a conversation: an edit repaints the
  // panel, and pinning it to the newest message would throw the tester to the
  // bottom after every figure they change. It holds where they were instead.
  const b = bpBuddy();
  if (b.calc) { t.scrollTop = b.calcScroll || 0; return; }
  t.scrollTop = t.scrollHeight;
}
