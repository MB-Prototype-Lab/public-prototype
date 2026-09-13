// ─── Lesson script bodies (L8) ────────────────────────────────────────────────
// AUTHORED IN PHASE 5c — this is NOT spec data.
//
// lessons.json declares 15 scriptVariants across three lessons but carries no
// script body for any of them: only `id`, `matchTags`, `audioId`, `emphasis`
// and `isFallback`. 06-education says the scripts are "pre-generated for every
// combination of answers"; that generation never happened. These are the
// bodies, written to the emphasis each variant declares.
//
// It lives in data/ beside the spec JSON but is deliberately a .js authored by
// hand — the wrap-data.sh generator does not touch it, and there is no .json
// twin to diff against, because there is nothing upstream to diff with.
//
// ── HARD CONSTRAINTS ON THIS FILE ────────────────────────────────────────────
// D26/L20 — NO FINANCIAL ADVICE. Not "you should", not "we recommend", not
// "cancel your", not "the best option is". These scripts explain how a
// mechanism works and what it costs; the reader decides what to do about it.
// That rule is asserted over this file by the Phase 6 copy sweep.
//
// A13 — warm, plain, second person, sentence case. No exclamation marks on a
// financial figure. The buddy can be encouraging; the numbers stay
// matter-of-fact.
//
// Sentences are one array entry each, because the player renders them as
// subtitle lines (screens/lesson.js).

const LESSON_SCRIPTS = {

  // ── APR ────────────────────────────────────────────────────────────────────
  // Bucketed by the inferred rate vs the market average (lessons-v3.js). The
  // AUDIO stays GENERAL — "well below", "a little above", never their exact
  // rate; the specific figure and the gap are shown in the staging visuals
  // (lessonVisualPlan), not spoken. No advice (D26/L20).
  //
  // ── EDUCATION FIRST, THEN THEIR NUMBER ─────────────────────────────────────
  // The first FIVE lines are shared across every bucket and explain the
  // mechanism: what APR is, that it is applied monthly rather than annually,
  // that clearing the balance usually costs nothing, and that interest landing
  // on interest is compounding. Only then does line six introduce their card
  // and line seven place it against peers.
  //
  // This used to open on the card and its rate, with two sentences of
  // explanation wedged in behind — "here's your card, here's your APR" before
  // the listener knew what an APR was. The visual spine in lessons.json was
  // ordered the same way and now follows this one beat for beat, because the
  // beat boundaries ARE these line boundaries.
  //
  // Lines eight and nine are the bucket's own, landing on the bucket beat and
  // the settle frame.

  // apr_deeply_below · bucket: deeply_below
  apr_deeply_below: [
    "APR is the one number that decides what carrying a balance costs you.",
    "It's the yearly price of borrowing, written as a percentage of what you owe.",
    "It isn't billed once a year, though. It's divided down and applied every month to whatever is still sitting on the card.",
    "If the balance is cleared before the due date, on most cards none of it costs you anything.",
    "If some of it stays, interest starts on the part that stayed. The month after, it's charged on that interest too. That's compounding.",
    "That's the mechanic. Here's your card, and the rate it charges.",
    "And here's where that rate sits, against the range for cards like yours and against what's typical.",
    "A gap of a couple of percentage points is easy to shrug off. It's worth turning into money, because money is the form it arrives in.",
    "Yours sits well below the middle.",
    "At a rate this low a balance that lingers costs you noticeably less than it would most people, though it still costs something."
  ],

  // apr_slightly_below · bucket: slightly_below
  apr_slightly_below: [
    "APR is the one number that decides what carrying a balance costs you.",
    "It's the yearly price of borrowing, written as a percentage of what you owe.",
    "It isn't billed once a year, though. It's divided down and applied every month to whatever is still sitting on the card.",
    "If the balance is cleared before the due date, on most cards none of it costs you anything.",
    "If some of it stays, interest starts on the part that stayed. The month after, it's charged on that interest too. That's compounding.",
    "That's the mechanic. Here's your card, and the rate it charges.",
    "And here's where that rate sits, against the range for cards like yours and against what's typical.",
    "A gap of a couple of percentage points is easy to shrug off. It's worth turning into money, because money is the form it arrives in.",
    "Yours comes in a little under the middle.",
    "A slightly lower rate means anything you carry grows a little slower than it would elsewhere."
  ],

  // apr_about_average · bucket: about_average
  apr_about_average: [
    "APR is the one number that decides what carrying a balance costs you.",
    "It's the yearly price of borrowing, written as a percentage of what you owe.",
    "It isn't billed once a year, though. It's divided down and applied every month to whatever is still sitting on the card.",
    "If the balance is cleared before the due date, on most cards none of it costs you anything.",
    "If some of it stays, interest starts on the part that stayed. The month after, it's charged on that interest too. That's compounding.",
    "That's the mechanic. Here's your card, and the rate it charges.",
    "And here's where that rate sits, against the range for cards like yours and against what's typical.",
    "A gap of a couple of percentage points is easy to shrug off. It's worth turning into money, because money is the form it arrives in.",
    "Yours lands right around the middle, where most cards sit.",
    "So the rate sets the price, and what's left at the end of the month decides whether you pay it."
  ],

  // apr_slightly_above · bucket: slightly_above
  apr_slightly_above: [
    "APR is the one number that decides what carrying a balance costs you.",
    "It's the yearly price of borrowing, written as a percentage of what you owe.",
    "It isn't billed once a year, though. It's divided down and applied every month to whatever is still sitting on the card.",
    "If the balance is cleared before the due date, on most cards none of it costs you anything.",
    "If some of it stays, interest starts on the part that stayed. The month after, it's charged on that interest too. That's compounding.",
    "That's the mechanic. Here's your card, and the rate it charges.",
    "And here's where that rate sits, against the range for cards like yours and against what's typical.",
    "A gap of a couple of percentage points is easy to shrug off. It's worth turning into money, because money is the form it arrives in.",
    "Yours runs a little above the middle.",
    "Small over a month, larger over a year, and every month's interest is worked out on the bigger figure."
  ],

  // apr_deeply_above · bucket: deeply_above
  apr_deeply_above: [
    "APR is the one number that decides what carrying a balance costs you.",
    "It's the yearly price of borrowing, written as a percentage of what you owe.",
    "It isn't billed once a year, though. It's divided down and applied every month to whatever is still sitting on the card.",
    "If the balance is cleared before the due date, on most cards none of it costs you anything.",
    "If some of it stays, interest starts on the part that stayed. The month after, it's charged on that interest too. That's compounding.",
    "That's the mechanic. Here's your card, and the rate it charges.",
    "And here's where that rate sits, against the range for cards like yours and against what's typical.",
    "A gap of a couple of percentage points is easy to shrug off. It's worth turning into money, because money is the form it arrives in.",
    "Yours sits well above the middle.",
    "Up here what stays on the card grows faster, and each month's interest is worked out on a number that keeps getting bigger."
  ],

  // apr_default · fallback — no card, or nothing to point at. Plays with the
  // waveform rather than the video, since there is no figure to draw. Same
  // education, minus the two lines that need a card to exist.
  apr_default: [
    "APR is the one number that decides what carrying a balance costs you. We'll keep this general, since there's no particular card in front of us.",
    "It's the yearly price of borrowing, written as a percentage of what you owe.",
    "It isn't billed once a year, though. It's divided down and applied every month to whatever is still sitting on the card.",
    "If the balance is cleared before the due date, on most cards none of it costs you anything.",
    "If some of it stays, interest starts on the part that stayed. The month after, it's charged on that interest too. That's compounding.",
    "That last part is the one people find surprising, and it's the whole reason a couple of percentage points matter more than they look.",
    "Nothing to act on this second. It's a number that turns up eventually, and now you know what it's saying."
  ],

  // ── EMERGENCY FUND ─────────────────────────────────────────────────────────
  // ef_v1 · no_fund, stretched · emphasis: first_hundred
  ef_v1: [
    "Nothing set aside yet, and a surprise bill would be a real problem. That is a very common place to be standing.",
    "An emergency fund is money kept separate for the things you cannot plan.",
    "The usual advice starts at three months of expenses, which from zero sounds absurd.",
    "So it is worth knowing what the first hundred actually does.",
    "Most unexpected costs are not catastrophic — a repair, an excess, a replacement.",
    "A small buffer is the difference between an annoyance and a thing that goes on a card and stays there.",
    "The first hundred does more than any hundred after it. That is the part worth knowing."
  ],

  // ef_v2 · under_1m, card_reliant · emphasis: building_from_partial
  ef_v2: [
    "You have got something set aside, and less than a month of cover. That is a real start.",
    "The gap between a small buffer and no buffer is bigger than the number suggests.",
    "You mentioned a card would take the strain for anything larger, which is what a fund is there to prevent.",
    "The thing that grows a fund is not the amount — it is that it goes in before anything else can claim it.",
    "Money left at the end of a month tends not to be left.",
    "People who build one usually do it by making it automatic and boring, not by finding a big lump sum.",
    "You are past the hardest part, which is starting from nothing."
  ],

  // ef_v3 · 1_3m · emphasis: where_to_keep_it
  ef_v3: [
    "One to three months of cover puts you in a genuinely solid position.",
    "At this point the question shifts from how much to where it sits.",
    "A fund has two jobs that pull against each other: be there instantly, and not quietly lose value.",
    "Money in a current account is instant but usually earns nothing.",
    "Money that is invested may grow, but it can be worth less on exactly the day you need it — which is the whole problem.",
    "A separate savings account sits between those. Reachable in a day or two, and paying something.",
    "The separation also does something quieter: money you have to move on purpose is money you do not spend by accident."
  ],

  // ef_v4 · over_3m, resilient · emphasis: what_next
  ef_v4: [
    "More than three months of cover, and a broken-down car would come out of savings. That is what a working fund looks like.",
    "So this lesson is mostly telling you something you have already done.",
    "The thing worth checking occasionally is whether the number still matches your life.",
    "Three months of expenses from two years ago may not be three months now.",
    "Rent moves, circumstances change, and a fund quietly becomes a different size than you think.",
    "It is a five minute check, not a project.",
    "Beyond that, the question of what money does next is a different lesson and a genuinely open one."
  ],

  // ef_default · fallback, also the "I don't know" paths · emphasis: building_from_partial
  ef_default: [
    "Not being sure what you have set aside is more common than the confident version.",
    "An emergency fund is money kept separate for the things you cannot plan for.",
    "The point is not the size. It is that a surprise cost does not become debt.",
    "The number usually quoted is three months of expenses, which is a target, not a starting line.",
    "What matters more is that it is separate from the account you spend from.",
    "Money you can see is money you tend to use.",
    "If you are not sure where you stand, that is worth ten minutes and a bank app at some point."
  ],

  // ── SUBSCRIPTION AUDIT ─────────────────────────────────────────────────────
  // sa_v1 · many_subs, no_check · emphasis: the_pile_up
  sa_v1: [
    "More than six subscriptions, and no audit yet. This is the situation the whole lesson is about.",
    "Individually, none of them is a decision worth agonising over. Together they are a bill.",
    "Six at around ten a month is roughly seven hundred a year, leaving quietly.",
    "The reason it goes unnoticed is that subscriptions are designed to be invisible after the first payment.",
    "No renewal to approve, no reminder, no moment where you decide again.",
    "The audit is not about being frugal. It is about the list existing at all, so the spending is a choice rather than a default.",
    "What stays and what goes is entirely yours to judge — only you know what you actually use."
  ],

  // sa_v2 · some_subs, stale_check, suspects · emphasis: how_to_audit
  sa_v2: [
    "A handful of subscriptions, last checked a while ago, and a suspicion something is hiding. That suspicion is usually right.",
    "Here is what an audit actually involves. It takes about fifteen minutes.",
    "Open your bank or card statement and look at a full month, not a week.",
    "Anything charging the same amount on roughly the same date is a subscription, whether or not you think of it as one.",
    "Write them down in one place. The list is the whole exercise — most people are surprised by the length before they are surprised by the total.",
    "Then check the annual ones separately, because they will not show up in a single month.",
    "Once the list exists, you can see what you are actually paying for. What you do about it is your call."
  ],

  // sa_v3 · few_subs, recent_check · emphasis: staying_on_top
  sa_v3: [
    "Under three subscriptions and checked this month. You are already doing the thing this lesson teaches.",
    "So this is about keeping it that way, which is a different problem to fixing it.",
    "Subscriptions accumulate at the edges — a free trial, a one-off that renews, something added for a single thing you needed.",
    "The pattern is that each one is individually reasonable.",
    "People who stay on top of it usually have one habit: they look at the same statement on the same day each month.",
    "Not a system, just a repeated glance.",
    "Yours is a short list. It is much easier to keep a short list short than to shorten a long one."
  ],

  // sa_default · fallback, also the "I don't know" paths · emphasis: how_to_audit
  sa_default: [
    "Not knowing how many subscriptions you have is the normal answer, and it is the reason audits exist.",
    "A subscription is any charge that repeats without you approving it each time.",
    "Streaming and music are the obvious ones. Storage, apps, memberships and software are the ones people forget.",
    "To find them, open a full month of statements and look for the same amount on the same date.",
    "Annual ones need a separate look, since they will not appear in a single month.",
    "The output is a list. That is all an audit is.",
    "Once you can see them together, the question of which ones earn their place is one only you can answer."
  ]
};
