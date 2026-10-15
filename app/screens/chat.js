// Matching and navigation live in js/chat-router.js (D25). Both chips and
// typed input use chatRespond; links navigate only when tapped.
// Keep the greeting outside state so Reset can clear the transcript without
// losing the opening message.
const CHAT_GREETING = {
  from: "buddy",
  text: "Hey — I'm Buddy. Ask me what you're trying to do and I'll take you to the " +
        "right spot. No question is too small here."
};

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

// chatResetConversation lives in js/chat-router.js, which owns transcript
// and bubble lifecycle. Do not shadow it in this shared global namespace.

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
