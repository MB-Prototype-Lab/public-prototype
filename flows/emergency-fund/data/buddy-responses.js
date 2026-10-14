// GENERATED from buddy-responses.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const BUDDY_RESPONSES =
{
  "_note": "Keyword search against a static library (D25). No LLM. Users pick from bubble options rather than typing free-form. Never states financial advice (D26).",

  "config": {
    "inputMode": "bubbles_primary",
    "_note": "A text field is visible but bubbles are the intended path. Typed input runs the same keyword match and falls back to the catch-all.",
    "matchStrategy": "highest_keyword_overlap",
    "showBubblesAfterEveryResponse": true
  },

  "openingBubbles": ["what_is_peer", "where_journal", "how_kibble", "why_dining_flagged"],

  "responses": [
    {
      "id": "what_is_peer",
      "bubble": "What are peers?",
      "keywords": ["peer", "peers", "compare", "average", "others", "benchmark", "everyone else"],
      "text": "Peers are a calculated comparison, not real people. I take public spending data for households your size and income, adjust it for what things cost where you live, then tune it to the lifestyle answers you gave me. Nobody's actual data is involved.",
      "followUp": ["how_accurate_peer", "why_dining_flagged"]
    },
    {
      "id": "where_journal",
      "bubble": "Where's my journal?",
      "keywords": ["journal", "entry", "log", "add", "record", "input", "yesterday"],
      "text": "Right here — I'll take you there. You can add another entry any time, even if you've already done one today.",
      "action": "navigate:money_journal"
    },
    {
      "id": "how_kibble",
      "bubble": "How do Charity Points work?",
      "keywords": ["charity", "points", "diamond", "diamonds", "bone", "bones", "kibble", "currency", "reward", "earn"],
      "text": "You earn Charity Points by showing up — journaling, finishing lessons, checking in on your goals. There are two kinds: bones from everyday check-ins and diamonds that lean on your plan tier. They turn into real donations on your behalf.",
      "followUp": ["what_is_level"]
    },
    {
      "id": "why_dining_flagged",
      "bubble": "Why is dining out flagged?",
      "keywords": ["dining", "eating out", "restaurant", "food", "flagged", "over", "why"],
      "text": "Your dining out is running ahead of both your own plan and what similar households spend. It's the one category doing that — everything else is close to where you set it.",
      "action": "navigate:budget_comparison"
    },
    {
      "id": "how_accurate_peer",
      "bubble": "How accurate is that?",
      "keywords": ["accurate", "accuracy", "real", "trust", "reliable", "sure"],
      "text": "It's an estimate built from public data, so treat it as a rough marker rather than a precise number. The direction is more useful than the decimal.",
      "followUp": ["what_is_peer"]
    },
    {
      "id": "what_is_level",
      "bubble": "What's my level?",
      "keywords": ["level", "badge", "xp", "experience", "rank", "tier"],
      "text": "You're at level three. Levels come from everything you do across the app — lessons, journaling, keeping your streak alive.",
      "action": "navigate:progress"
    },
    {
      "id": "hulu_question",
      "bubble": "What about Hulu?",
      "keywords": ["hulu", "subscription", "cancel", "unused", "streaming"],
      "text": "You haven't mentioned watching anything on Hulu in about three weeks, and it's $18.99 a month. Worth a look — only you know whether you're still getting use out of it.",
      "action": "navigate:subscription_confirm"
    },
    {
      "id": "insurance_question",
      "bubble": "Tell me about the bill",
      "keywords": ["bill", "insurance", "due", "car", "payment", "owe"],
      "text": "Car insurance, $187, due in four days. It isn't in this month's budget yet, so it'll come out of somewhere. Want to sort out where?",
      "action": "navigate:budget"
    },
    {
      "id": "emergency_fund",
      "bubble": "How's my emergency fund?",
      "keywords": ["emergency", "fund", "savings", "goal", "saving", "behind"],
      "text": "You're at $620 of $3,000, which puts you at 41% of the pace you set. It's moving — just slower than planned.",
      "action": "navigate:goals"
    },
    {
      "id": "how_estimates",
      "bubble": "How do you estimate costs?",
      "keywords": ["estimate", "guess", "how do you know", "amount", "cost", "price"],
      "text": "I start from typical prices for your area and adjust based on what you've told me before. The sliders on the confirmation screen are there because you always know better than I do.",
      "followUp": ["where_journal"]
    },
    {
      "id": "privacy",
      "bubble": "Who sees my data?",
      "keywords": ["private", "privacy", "data", "share", "secure", "safe", "who sees"],
      "text": "Nothing leaves unless you send it. When you share an update, everything financial is anonymized by default, and you can see exactly what would be posted before anything goes out.",
      "action": "navigate:share_preview"
    },
    {
      "id": "advice_deflect",
      "bubble": null,
      "keywords": ["should i", "what do you think", "recommend", "advice", "invest", "stock", "buy", "sell", "best", "worth it"],
      "_note": "D26 — hard guardrail. Any advice-shaped input lands here regardless of keyword score.",
      "priority": "override",
      "text": "I can't tell you what to do with your money — that's genuinely not my call to make. What I can do is show you what's happening and let you decide. Want to see the numbers?",
      "followUp": ["why_dining_flagged", "emergency_fund"]
    },
    {
      "id": "catch_all",
      "bubble": null,
      "keywords": [],
      "isFallback": true,
      "text": "I'm not sure I follow that one. Here's what I can help with:",
      "followUp": ["what_is_peer", "where_journal", "how_kibble", "why_dining_flagged"]
    }
  ]
}
;
