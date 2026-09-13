// ─── Onboarding intro storyboard ─────────────────────────────────────────────
// AUTHORED, not spec data, and deliberately a hand-written .js with no .json
// sibling — exactly like data/lesson-scripts.js. Storyboards never go through
// TTS, and scripts/wrap-data.sh hard-errors on any .json it has no global
// mapped for, so a JSON here would mean editing the generator for no gain.
//
// Rendered by components/hyperframes.js into onboarding step 8's stage. The
// stage used to be renderBuddyStage() — a text placeholder describing the
// buddy — so the film narrated for forty seconds over a card that never moved.
//
// ── NO FIGURES, AND THAT IS DECLARED ─────────────────────────────────────────
// The APR lesson's storyboard plots a number, so hyperframesCanRender() demands
// userFigure + marketAvg before it will draw. This one only explains something,
// so it sets `requiresFigures: false` and opts out of that gate. Nothing here
// resolves a {token}; there is no `scale` element, because there is nothing to
// plot against.
//
// ── BEAT TIMING IS NOT DECLARED HERE ─────────────────────────────────────────
// lessons.json hardcodes each beat's from/to as a fraction of runtime, which is
// why rewriting an APR script means recutting its spine by hand. This one takes
// them from the player's own cue map at render time (onbStoryboard, in
// screens/onboarding.js): beat N spans segment N. Rewriting a line here re-cuts
// the beats automatically, because the cues and the beats read the same source.
//
// ── SHARED SPINE, GOAL-SPECIFIC MIDDLE ───────────────────────────────────────
// s1, s2, s5 and s6 are the same for everyone. s3 and s4 swap on the primary
// goal, matching the narration split in data/onboarding-script.json — the two
// files are keyed the same way and must be edited together.
//
// Coordinates are a 100 x 72 viewBox. Element types: icon (card/coin/shield/
// spark), label, stack.

const ONBOARDING_STORYBOARD = {
  kind: "hyperframes",
  requiresFigures: false,

  shared: {
    s1: [
      { type: "icon",  name: "spark", x: 50, y: 22, size: 16, anim: "pop" },
      { type: "label", text: "Money Buddy", x: 50, y: 48, size: 9, anim: "rise" },
      { type: "label", text: "a minute on how this works", x: 50, y: 60, size: 3.6, tone: "muted", anim: "fade" }
    ],
    s2: [
      { type: "label", text: "most days, a few questions", x: 50, y: 12, size: 4.6, anim: "fade" },
      { type: "icon",  name: "card", x: 50, y: 34, size: 16, anim: "rise" },
      { type: "label", text: "your Money Journal", x: 50, y: 60, size: 6.4, anim: "rise" }
    ],
    s5: [
      { type: "label", text: "and how you compare", x: 50, y: 11, size: 4.6, anim: "fade" },
      { type: "stack", count: 5, x: 50, y: 30, anim: "accumulate" },
      { type: "label", text: "peers near you in size, income and area", x: 50, y: 56, size: 3.4, tone: "muted", anim: "fade" },
      { type: "label", text: "national figures, not other people's accounts", x: 50, y: 64, size: 3.0, tone: "muted", anim: "fade" }
    ],
    s6: [
      { type: "icon",  name: "shield", x: 50, y: 20, size: 15, anim: "pop" },
      { type: "label", text: "that's the whole thing", x: 50, y: 46, size: 6.4, anim: "rise" },
      { type: "label", text: "a little most days", x: 50, y: 58, size: 3.6, tone: "muted", anim: "fade" }
    ]
  },

  // Keyed by the ONB_GOALS label the tester picked first. `_default` covers a
  // run where the goal step was skipped — it says nothing about what they want,
  // because nothing was said.
  goals: {
    "Stop living paycheck to paycheck": {
      s3: [
        { type: "label", text: "before the month starts", x: 50, y: 11, size: 4.2, tone: "muted", anim: "fade" },
        { type: "icon",  name: "coin", x: 50, y: 32, size: 15, anim: "pop" },
        { type: "label", text: "what's already spoken for", x: 50, y: 60, size: 5.8, anim: "rise" }
      ],
      s4: [
        { type: "stack", count: 4, x: 50, y: 28, anim: "accumulate" },
        { type: "label", text: "fixed, and what's actually yours", x: 50, y: 56, size: 5.2, anim: "rise" },
        { type: "label", text: "committed on day one", x: 50, y: 66, size: 3.4, tone: "muted", anim: "fade" }
      ]
    },
    "Build up some savings": {
      s3: [
        { type: "label", text: "what survives the month", x: 50, y: 11, size: 4.2, tone: "muted", anim: "fade" },
        { type: "icon",  name: "coin", x: 50, y: 32, size: 15, anim: "pop" },
        { type: "label", text: "not what you meant to keep", x: 50, y: 60, size: 5.4, anim: "rise" }
      ],
      s4: [
        { type: "stack", count: 5, x: 50, y: 28, anim: "accumulate" },
        { type: "label", text: "the plan against the month", x: 50, y: 56, size: 5.6, anim: "rise" },
        { type: "label", text: "and how the gap moves", x: 50, y: 66, size: 3.4, tone: "muted", anim: "fade" }
      ]
    },
    "Get on top of what I owe": {
      s3: [
        { type: "label", text: "two numbers set the timeline", x: 50, y: 11, size: 4.2, tone: "muted", anim: "fade" },
        { type: "icon",  name: "card", x: 50, y: 32, size: 15, anim: "rise" },
        { type: "label", text: "the rate, and the extra", x: 50, y: 60, size: 6.0, anim: "rise" }
      ],
      s4: [
        { type: "stack", count: 6, x: 50, y: 28, anim: "accumulate" },
        { type: "label", text: "move either one", x: 50, y: 56, size: 6.0, anim: "rise" },
        { type: "label", text: "and watch the finish line move", x: 50, y: 66, size: 3.4, tone: "muted", anim: "fade" }
      ]
    },
    "Just understand where it goes": {
      s3: [
        { type: "label", text: "a few days of answers", x: 50, y: 11, size: 4.2, tone: "muted", anim: "fade" },
        { type: "icon",  name: "spark", x: 50, y: 32, size: 15, anim: "pop" },
        { type: "label", text: "where it actually goes", x: 50, y: 60, size: 6.0, anim: "rise" }
      ],
      s4: [
        { type: "stack", count: 4, x: 50, y: 28, anim: "accumulate" },
        { type: "label", text: "the shape of an ordinary month", x: 50, y: 56, size: 5.0, anim: "rise" },
        { type: "label", text: "in your own numbers", x: 50, y: 66, size: 3.4, tone: "muted", anim: "fade" }
      ]
    },
    _default: {
      s3: [
        { type: "label", text: "answer by answer", x: 50, y: 11, size: 4.2, tone: "muted", anim: "fade" },
        { type: "icon",  name: "coin", x: 50, y: 32, size: 15, anim: "pop" },
        { type: "label", text: "where it actually goes", x: 50, y: 60, size: 6.0, anim: "rise" }
      ],
      s4: [
        { type: "stack", count: 4, x: 50, y: 28, anim: "accumulate" },
        { type: "label", text: "steady, drifting, unnoticed", x: 50, y: 56, size: 5.4, anim: "rise" },
        { type: "label", text: "once there's enough to read", x: 50, y: 66, size: 3.4, tone: "muted", anim: "fade" }
      ]
    }
  }
};
