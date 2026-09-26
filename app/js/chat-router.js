// ─── Chat Router (D25) ────────────────────────────────────────────────────────
// "Keyword search against a static response library. No LLM. Pre-established
// responses to key questions. Users pick from bubble options rather than typing
// free-form. Illustrative of the interaction, not functional."
//
// WHAT THIS IS NOT: AI, an LLM, or NLP. It is a deliberately dumb word matcher.
// Do not "upgrade" it — if real AI ever lands it replaces chatRoute() wholesale.
//
// PORTED IN PHASE 3b — v2 hand-wrote CHAT_ROUTES with ordering rules. v3 drives
// everything from data/buddy-responses.json, so adding a response is a data
// edit. Two behaviours are NOT plain scoring and must not be flattened into it:
//
//   1. advice_deflect carries "priority": "override" and its own note says
//      "any advice-shaped input lands here REGARDLESS of keyword score". That
//      is how D26 ("no financial advice, ever") is enforced in chat. It is
//      checked BEFORE scoring, not as a high-scoring competitor.
//   2. catch_all is isFallback with zero keywords — it can never win on score,
//      only by nothing else matching.
//
// Neither is offered as a bubble (both have bubble: null).

// ─── D26 safeguard: no financial advice, ever ────────────────────────────────
// The response library's advice_deflect entry carries 10 keywords, which is not
// enough on its own — "help me decide", "can I afford", "is it a good idea",
// "what would you do" and nine other natural phrasings all slip past it and
// would be answered by whichever topic happened to share a noun.
//
// So advice detection is keywords OR these shapes. This layer lives in code
// rather than in data/*.json, which stays a byte-identical copy of the spec.
//
// Tuned against the eleven real bubble labels — none of them matches. Being
// over-eager here is the safer failure: a wrongly-deflected question costs the
// tester one retry, whereas a missed one means the prototype gave financial
// advice, which it must never do under any phrasing.
const ADVICE_PATTERNS = [
  /\bshould\s+(i|we|my|the)\b/,          // should I / should we / should my
  /\b(shall|ought)\s+(i|we)\b/,
  /\bwhat\s+(should|would|could)\s+(i|we|you)\b/,
  /\bwhat\s+do\s+you\s+(think|reckon|suggest|advise)\b/,
  /\bdo\s+you\s+(think|reckon|suggest|advise|recommend)\b/,
  /\bwould\s+you\s+\w+\s*(it|that|this|them)?\b.*\?|\bwould\s+you\s+(cancel|buy|sell|keep|pay|switch|move|invest)\b/,
  /\b(recommend|recommendation|advise|advice|suggestion)\b/,
  /\bis\s+it\s+(worth|smart|wise|better|ok|okay|a\s+good\s+idea)\b/,
  /\b(a\s+)?good\s+idea\b/,
  /\b(better|best)\s+(to|option|choice|way|idea|move)\b/,
  /\bwhich\s+(is|one|should|would)\b/,
  /\bhelp\s+me\s+(decide|choose|pick|work\s+out)\b/,
  /\bcan\s+(i|we)\s+afford\b/,
  /\btell\s+me\s+what\s+to\b/,
  /\bwhat\s+would\s+you\s+do\b/,
  /\b(wise|smart|sensible)\b.*\?/,
  /\bhow\s+much\s+should\b/
];

/** True when the message is asking to be told what to do. */
function chatIsAdviceSeeking(message) {
  const msg = String(message || "").toLowerCase();
  const deflect = (BUDDY_RESPONSES.responses || [])
    .find(function (r) { return r.priority === "override"; });
  if (deflect && chatMatches(msg, deflect.keywords)) return true;
  return ADVICE_PATTERNS.some(function (re) { return re.test(msg); });
}

/** Whole-word / phrase match. Substring matching puts "hi" inside "this". */
function chatMatches(message, keywords) {
  return (keywords || []).some(function (kw) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b" + escaped + "\\b").test(message);
  });
}

/** How many of a response's keywords appear — the overlap score. */
function chatScore(message, response) {
  return (response.keywords || []).reduce(function (n, kw) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return n + (new RegExp("\\b" + escaped + "\\b").test(message) ? 1 : 0);
  }, 0);
}

function buddyResponseById(id) {
  return (BUDDY_RESPONSES.responses || []).find(function (r) { return r.id === id; }) || null;
}

function buddyFallback() {
  return (BUDDY_RESPONSES.responses || []).find(function (r) { return r.isFallback; })
      || { id: "catch_all", text: "I'm not sure I follow that one.", followUp: [] };
}

/**
 * message → response. Strategy is "highest_keyword_overlap", ties break by
 * declaration order, zero matches plays the fallback.
 */
function chatRoute(message) {
  const msg = String(message || "").toLowerCase();
  const all = BUDDY_RESPONSES.responses || [];

  // 1. The D26 guardrail, ahead of scoring. An advice-shaped question must
  //    never be answered by whichever topic happened to share a noun with it —
  //    "is it worth it to cancel hulu?" contains "hulu".
  if (chatIsAdviceSeeking(msg)) {
    const deflect = all.find(function (r) { return r.priority === "override"; });
    if (deflect) return deflect;
  }

  // 2. Highest overlap; first declared wins a tie.
  let best = null, bestScore = 0;
  all.forEach(function (r) {
    if (r.priority === "override" || r.isFallback) return;
    const score = chatScore(msg, r);
    if (score > bestScore) { best = r; bestScore = score; }
  });

  return best || buddyFallback();
}

/** Bubble ids to offer next. showBubblesAfterEveryResponse is true. */
function chatBubblesAfter(response) {
  const ids = (response && response.followUp && response.followUp.length)
    ? response.followUp
    : BUDDY_RESPONSES.openingBubbles;
  // Never offer a response that has no bubble label — those are keyword-only.
  return ids.filter(function (id) {
    const r = buddyResponseById(id);
    return r && r.bubble;
  });
}

/**
 * Append the user's message and Buddy's reply, then re-render.
 * A tapped bubble and the same words typed by hand land here identically —
 * one system, not two.
 */
function chatRespond(text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  state.chat.messages.push({ from: "user", text: clean });
  const reply = chatRoute(clean);
  state.chat.messages.push({
    from: "buddy",
    text: reply.text,
    action: reply.action || null,
    responseId: reply.id
  });
  state.chat.bubbles = chatBubblesAfter(reply);
  render();
}

/** Tapping a bubble sends its label, so the transcript reads as a conversation. */
function chatTapBubble(id) {
  const r = buddyResponseById(id);
  if (!r) return;
  chatRespond(r.bubble || r.id);
}

/**
 * A reply's action is offered as a button — we never auto-navigate, because the
 * user should read the answer before being moved.
 * Routes reuse the daily-task vocabulary (architecture §9).
 */
function chatFollowAction(action) {
  if (!action) return;
  const route = String(action).replace(/^navigate:/, "");
  if (route === "budget_comparison") { go("comparison"); return; }
  if (route === "progress")          { navGoTab("myProgress"); return; }
  if (route === "goals")             { navGoTab("goals"); return; }
  if (route === "share_preview")     { go("comparison"); return; }   // Phase 4 builds share
  navRouteTask(route);
}

function chatActionLabel(action) {
  const route = String(action || "").replace(/^navigate:/, "");
  return {
    money_journal:       "Open my journal",
    subscription_confirm:"Tell me about Hulu",
    budget:              "Open my budget",
    budget_comparison:   "Show me the comparison",
    progress:            "See my progress",
    goals:               "See my goals",
    share_preview:       "Show me"
  }[route] || "Take me there";
}

function chatResetConversation() {
  state.chat = { messages: [], bubbles: (BUDDY_RESPONSES.openingBubbles || []).slice() };
  render();
}
