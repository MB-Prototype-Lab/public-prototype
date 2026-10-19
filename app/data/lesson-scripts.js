// ─── Lesson script bodies (L8) ────────────────────────────────────────────────
// AUTHORED IN PHASE 5c — this is NOT spec data.
//
// lessons.json declares 16 scriptVariants across three lessons but carries no
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
  // Rewritten through a seven-teacher critic panel (ages 22–29 to 55–65, three
  // education levels), every line and every version scored ≥ 9.7 by all seven.
  // The panel's rules live with the PR, not here; the ones that bite on edits:
  //   · one new idea per line, ~20 words max, meaning before the term
  //   · one word per concept: "carried" is a BALANCE word only -- the rate is
  //     "the usual rate on", never "carries"
  //   · hedge exactly where the fact is hedged ("about", "most cards",
  //     "essentially") and nowhere else
  //   · mirrored buckets use mirrored size words; the two "a little" cost lines
  //     carry none, because the 18-28 band makes "a little" span up to ~$74
  //   · line 1 is the only greeting ("Glad you're here."): no "you told us",
  //     no thanks for answering, no exclamation marks, no idioms. The no-card
  //     line also plays on Skip, so it never refers to an answer.
  // No advice (D26/L20). The narration never speaks the learner's own figures;
  // the video shows them.
  //
  // TOKENS, resolved per run by lessonResolveScript (js/lessons-v3.js):
  //   {cardName}  spoken card name -- issuer + card ("Chase Sapphire
  //               Preferred"), "a store card", "a credit union card", or
  //               "your card". Never preceded by "the", "a" or "your".
  //   {rateLine}  a whole line, chosen by where the rate came from:
  //               LESSON_SCRIPT_PARTS.apr_rate_usual (looked up) or
  //               apr_rate_entered (typed).
  //
  // Line POSITIONS are load-bearing: the video cuts in lessons.json map beats to
  // 0-based line indexes, and the narration pauses after lines 5 and 9 in every
  // version (lessons.json narration.pauseAfter). Recut both if lines move.
  // apr_deeply_below · bucket: deeply_below
  apr_deeply_below: [
    "Glad you're here. This lesson is built around {cardName}. Let's begin.",
    "One number sets the price of carrying a balance on that card.",
    "That number is the yearly price of borrowing, written as a percentage of what you owe.",
    "It's called APR, short for Annual Percentage Rate.",
    "On a mortgage or car loan, APR includes some fees too. That can put it above the interest rate.",
    "On a credit card, APR is essentially the interest rate. Any annual fee or late fee is charged separately.",
    "When the balance is cleared by the due date, most cards charge no interest on purchases.",
    "When part of it is carried past the due date, {cardName} charges interest on what's left.",
    "Interest on a carried balance is charged monthly. So 24 percent a year is about 2 percent a month.",
    "Next month, that interest joins the balance. Then interest is charged on interest. That's compounding.",
    "{rateLine}",
    "Compared with the typical card rate, this one sits well below, outside the typical range.",
    "For each thousand dollars carried a full year, that gap means much less interest. Here's about how much.",
    "Next, try it with numbers in the calculator."
  ],
  // apr_slightly_below · bucket: slightly_below
  apr_slightly_below: [
    "Glad you're here. This lesson is built around {cardName}. Let's begin.",
    "One number sets the price of carrying a balance on that card.",
    "That number is the yearly price of borrowing, written as a percentage of what you owe.",
    "It's called APR, short for Annual Percentage Rate.",
    "On a mortgage or car loan, APR includes some fees too. That can put it above the interest rate.",
    "On a credit card, APR is essentially the interest rate. Any annual fee or late fee is charged separately.",
    "When the balance is cleared by the due date, most cards charge no interest on purchases.",
    "When part of it is carried past the due date, {cardName} charges interest on what's left.",
    "Interest on a carried balance is charged monthly. So 24 percent a year is about 2 percent a month.",
    "Next month, that interest joins the balance. Then interest is charged on interest. That's compounding.",
    "{rateLine}",
    "Compared with the typical card rate, this one sits a little below, inside the typical range.",
    "For each thousand dollars carried a full year, that gap means less interest. Here's about how much.",
    "Next, try it with numbers in the calculator."
  ],
  // apr_about_average · bucket: about_average
  apr_about_average: [
    "Glad you're here. This lesson is built around {cardName}. Let's begin.",
    "One number sets the price of carrying a balance on that card.",
    "That number is the yearly price of borrowing, written as a percentage of what you owe.",
    "It's called APR, short for Annual Percentage Rate.",
    "On a mortgage or car loan, APR includes some fees too. That can put it above the interest rate.",
    "On a credit card, APR is essentially the interest rate. Any annual fee or late fee is charged separately.",
    "When the balance is cleared by the due date, most cards charge no interest on purchases.",
    "When part of it is carried past the due date, {cardName} charges interest on what's left.",
    "Interest on a carried balance is charged monthly. So 24 percent a year is about 2 percent a month.",
    "Next month, that interest joins the balance. Then interest is charged on interest. That's compounding.",
    "{rateLine}",
    "Compared with the typical card rate, this one sits about level, inside the typical range.",
    "Here's the interest on each thousand dollars carried a full year. It comes out about the same either way.",
    "Next, try it with numbers in the calculator."
  ],
  // apr_slightly_above · bucket: slightly_above
  apr_slightly_above: [
    "Glad you're here. This lesson is built around {cardName}. Let's begin.",
    "One number sets the price of carrying a balance on that card.",
    "That number is the yearly price of borrowing, written as a percentage of what you owe.",
    "It's called APR, short for Annual Percentage Rate.",
    "On a mortgage or car loan, APR includes some fees too. That can put it above the interest rate.",
    "On a credit card, APR is essentially the interest rate. Any annual fee or late fee is charged separately.",
    "When the balance is cleared by the due date, most cards charge no interest on purchases.",
    "When part of it is carried past the due date, {cardName} charges interest on what's left.",
    "Interest on a carried balance is charged monthly. So 24 percent a year is about 2 percent a month.",
    "Next month, that interest joins the balance. Then interest is charged on interest. That's compounding.",
    "{rateLine}",
    "Compared with the typical card rate, this one sits a little above, inside the typical range.",
    "For each thousand dollars carried a full year, that gap means more interest. Here's about how much.",
    "Next, try it with numbers in the calculator."
  ],
  // apr_deeply_above · bucket: deeply_above
  apr_deeply_above: [
    "Glad you're here. This lesson is built around {cardName}. Let's begin.",
    "One number sets the price of carrying a balance on that card.",
    "That number is the yearly price of borrowing, written as a percentage of what you owe.",
    "It's called APR, short for Annual Percentage Rate.",
    "On a mortgage or car loan, APR includes some fees too. That can put it above the interest rate.",
    "On a credit card, APR is essentially the interest rate. Any annual fee or late fee is charged separately.",
    "When the balance is cleared by the due date, most cards charge no interest on purchases.",
    "When part of it is carried past the due date, {cardName} charges interest on what's left.",
    "Interest on a carried balance is charged monthly. So 24 percent a year is about 2 percent a month.",
    "Next month, that interest joins the balance. Then interest is charged on interest. That's compounding.",
    "{rateLine}",
    "Compared with the typical card rate, this one sits well above, outside the typical range.",
    "For each thousand dollars carried a full year, that gap means much more interest. Here's about how much.",
    "Next, try it with numbers in the calculator."
  ],
  // apr_default · no card, rather not say, or Skip. Plays the figure-free cut
  // (lessons.json visualTemplate.figureFree): nothing on screen claims a figure.
  apr_default: [
    "Glad you're here. This lesson applies to any credit card, now or later. Let's begin.",
    "One number sets the price of carrying a balance.",
    "That number is the yearly price of borrowing, written as a percentage of what you owe.",
    "It's called APR, short for Annual Percentage Rate.",
    "On a mortgage or car loan, APR includes some fees too. That can put it above the interest rate.",
    "On a credit card, APR is essentially the interest rate. Any annual fee or late fee is charged separately.",
    "When the balance is cleared by the due date, most cards charge no interest on purchases.",
    "When part of it is carried past the due date, interest is charged on what's left.",
    "Interest on a carried balance is charged monthly. So 24 percent a year is about 2 percent a month.",
    "Next month, that interest joins the balance. Then interest is charged on interest. That's compounding.",
    "Most cards charge an APR of roughly 18 to 28 percent.",
    "With an APR a few points higher, a carried balance costs more each month. Interest on interest widens that difference.",
    "Next, try it with numbers in the calculator."
  ],
  // apr_unknown · "Another card" → doesn't know its APR. Used to borrow the
  // market average and present it as theirs; now it says what is known and plays
  // its own figure-free cut (visualTemplate.unknownCut).
  apr_unknown: [
    "Glad you're here. This lesson fits your card, even without its rate. Let's begin.",
    "One number sets the price of carrying a balance on that card.",
    "That number is the yearly price of borrowing, written as a percentage of what you owe.",
    "It's called APR, short for Annual Percentage Rate.",
    "On a mortgage or car loan, APR includes some fees too. That can put it above the interest rate.",
    "On a credit card, APR is essentially the interest rate. Any annual fee or late fee is charged separately.",
    "When the balance is cleared by the due date, most cards charge no interest on purchases.",
    "When part of it is carried past the due date, your card charges interest on what's left.",
    "Interest on a carried balance is charged monthly. So 24 percent a year is about 2 percent a month.",
    "Next month, that interest joins the balance. Then interest is charged on interest. That's compounding.",
    "Most cards charge an APR of roughly 18 to 28 percent.",
    "With an APR a few points higher, a carried balance costs more each month. Interest on interest widens that difference.",
    "Your card's exact rate is printed on its statement.",
    "Next, try it with numbers in the calculator."
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

// Whole-line parts a script can splice in with a {rateLine} token. Separate from
// LESSON_SCRIPTS because every entry there is a variant body the player plays.
// The sweep's no-advice check covers these too.
const LESSON_SCRIPT_PARTS = {
  // A card the tester picked from the list (or a store / credit union card):
  // the figure is that card's usual rate, not their own, and the line says so.
  apr_rate_usual:   "Here's the usual rate on {cardName}. Yours depends on your credit and is on your statement.",
  // A rate the tester typed in.
  apr_rate_entered: "Here's the rate you entered for your card."
};
