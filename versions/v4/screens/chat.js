// ─── Chat with Buddy ──────────────────────────────────────────────────────────
// TAB: None (no bottom nav tab) | NAV BAR: Hidden
//
// PURPOSE
// A mock conversational surface that routes the user to the right place in the
// app. Demonstrates, for user testing, whether people reach for chat to find
// things — it is NOT a real assistant. All matching lives in js/chat-router.js;
// this file only renders. See that file's header before changing behavior.
//
// NAVIGATION
//   Entry: "Chat with Buddy" button on the Home stage
//   Exit:  ← Back → home
//          Reply links → Budget / Learn / Goals / Debt / Market / My Progress
//          (links are always tapped by the user — chat never auto-navigates)
//
// STATES
//   The greeting (CHAT_GREETING) always renders first and is not stored.
//   state.chat.messages holds the transcript for the session: it survives
//   navigating away and back, and clears on refresh or admin Reset User Data.
//   Chips and typed input both call chatRespond(), so they behave identically.
//
// PRODUCTION NOTES
//   Replacing this with a real assistant means replacing chatRoute() — the
//   rendering here (bubbles, chips, link buttons) stays usable as-is.
//   MONEY JOURNAL DEPENDENCY: the "tracking actuals" reply is a placeholder;
//   when Money Journal ships, its route in chat-router.js gets rewired and the
//   chips below should gain a journal entry. Details in chat-router.js.

// Always the first message in the thread. Deliberately not stored in state:
// it can never be lost, and Reset only has to clear the real transcript.
const CHAT_GREETING = {
  from: "buddy",
  text: "Hey — I'm Buddy. Ask me what you're trying to do and I'll take you to the " +
        "right spot. No question is too small here."
};

// Quick-tap suggestions. Each is worded to land on a DIFFERENT route in
// BUDDY_RESPONSES, so the bubbles double as a demo of what the matcher knows.
// Tapping one is identical to typing it — both go through chatRespond().
// Note the phrasing avoids learning verbs ("how do", "explain") where an action
// is wanted, since the learn route is checked first and would win. See the
// ordering notes in chat-router.js.

function renderChat() {
  const thread = [CHAT_GREETING].concat(state.chat.messages);
  const bubbles = (state.chat.bubbles && state.chat.bubbles.length)
    ? state.chat.bubbles
    : BUDDY_RESPONSES.openingBubbles;

  return `
    <div class="chat-shell">

      <div class="chat-header">
        <div>
          <h1 class="title">Chat with ${h(state.buddy.name || "Buddy")}</h1>
          <p class="subtitle">Ask a question — I'll point you the right way.</p>
        </div>
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
      </div>

      <div class="chat-thread" id="chatThread">
        ${thread.map(function (m) {
          return `
            <div class="chat-row ${m.from === "user" ? "chat-row-user" : ""}">
              <div class="chat-bubble ${m.from === "user" ? "chat-bubble-user" : "chat-bubble-buddy"}">
                ${h(m.text)}
                ${m.action ? `
                  <button class="chat-link" type="button"
                          onclick="chatFollowAction('${h(m.action)}')">
                    ${h(chatActionLabel(m.action))} →
                  </button>
                ` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="chat-foot">
        <!-- Bubbles are the PRIMARY input path (inputMode: bubbles_primary).
             The set changes with each reply — followUp when the response has
             one, otherwise back to the openers. Responses with bubble: null
             (advice_deflect, catch_all) are keyword-only and never listed. -->
        <div class="chat-chips">
          ${bubbles.map(function (id) {
            const r = buddyResponseById(id);
            if (!r || !r.bubble) return "";
            return `<button class="chat-chip" type="button"
                            onclick="chatTapBubble('${h(id)}')">${h(r.bubble)}</button>`;
          }).join("")}
        </div>

        <div class="chat-inputbar">
          <input id="chatInput" class="chat-input" type="text" autocomplete="off"
                 placeholder="Or type a question..." onkeydown="chatInputKey(event)">
          <button class="button" type="button" onclick="chatSend()">Send</button>
        </div>
      </div>

    </div>
  `;
}

// Reads the input directly and clears it, rather than binding value to state:
// oninput + a full re-render would destroy the focused element mid-keystroke
// (see the input convention in CLAUDE.md). Refocuses after the re-render so
// the user can keep typing.
function chatSend() {
  const el = document.getElementById("chatInput");
  if (!el) return;
  const text = el.value;
  el.value = "";
  chatRespond(text);          // appends messages, then calls render()
  const fresh = document.getElementById("chatInput");
  if (fresh) fresh.focus();
}

function chatInputKey(e) {
  if (e.key === "Enter") { e.preventDefault(); chatSend(); }
}

// Called from render() after the chat DOM exists — pins the thread to the
// newest message, the way a real chat behaves.
function chatMountHook() {
  const thread = document.getElementById("chatThread");
  if (thread) thread.scrollTop = thread.scrollHeight;
}

// chatResetConversation() lives in js/chat-router.js — it owns the bubble
// lifecycle, so it also restores the opening bubbles. A second copy here used
// to shadow it (this file loads later, and everything shares one global
// namespace), which cleared the transcript but left the previous reply's
// follow-up chips pointing at a conversation that no longer existed.

function renderChatAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">Conversation</p>
      <p class="helper">${state.chat.messages.length} message${state.chat.messages.length === 1 ? "" : "s"} in the transcript (greeting excluded).</p>
      <button class="button secondary full" type="button" onclick="chatResetConversation()">Reset Conversation</button>
    </div>

    <div class="admin-card">
      <p class="admin-card-title">Response Library</p>
      <p class="helper" style="margin-bottom:10px;">
        Word matching only — no AI (D25). Highest keyword overlap wins; ties
        break by declaration order; nothing matching plays the fallback.
      </p>
      ${BUDDY_RESPONSES.responses.map(function (r) {
        const tag = r.priority === "override" ? "OVERRIDE" : (r.isFallback ? "FALLBACK" : "");
        return `
          <div style="margin-bottom:9px;">
            <div style="font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.05em;color:var(--chrome-muted);">
              ${h(r.id)}${tag ? ` · ${tag}` : ""}${r.bubble ? "" : " · keyword-only"}
            </div>
            <div style="font-size:12px;color:var(--chrome-text);">
              ${h((r.keywords && r.keywords.length) ? r.keywords.join(", ") : "—")}
            </div>
          </div>
        `;
      }).join("")}
      <p class="helper" style="font-size:10px;margin-top:8px;">
        advice_deflect is checked BEFORE scoring — D26 means an advice-shaped
        question can never be answered by whichever topic shares a noun with it.
      </p>
    </div>
  `;
}
