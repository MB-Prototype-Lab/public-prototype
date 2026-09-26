// GENERATED from daily-scripts.json — do not hand-edit.
// Regenerate: bash scripts/wrap-data.sh
//
// The app runs on file://, where fetch() is blocked and there is no dev
// server, so spec data ships as a script-loadable assignment (L13).
// The .json beside this file is the byte-identical spec copy.
const DAILY_SCRIPTS =
{
  "_note": "Daily update scripts (D27). Three engagement variants recorded (A10). Timing values live in a separate block from script text so they can be rewritten after a TTS pass without touching content (D29).",

  "timingContract": {
    "_note": "READ THIS BEFORE IMPLEMENTING. The production pipeline is: script text → TTS → timing extraction → timings written back. Timings must be replaceable in isolation.",
    "rules": [
      "Script text and timing values never share an object. Segments carry an id; timings are keyed by that id.",
      "A segment with no timing entry falls back to estimated duration from word count at 165 wpm.",
      "Visual cues reference segment ids, never timestamps. If a timing shifts, visuals follow automatically.",
      "In the prototype, Web Speech API boundary events populate the timing map live at playback. The static timings below are the fallback when boundary events are unavailable."
    ],
    "estimatedWpm": 165
  },

  "visualCues": {
    "_note": "Visual layer carries the numbers; the script stays generalized (D30).",
    "types": {
      "buddy_greeting": "Buddy on stage, waving animation",
      "number_reveal": "Large figure counts up from zero",
      "bar_compare": "Two bars, user vs peer, user bar animates to length",
      "category_grid": "Twelve category tiles, one highlights",
      "goal_ring": "Circular progress ring fills to pace percentage",
      "bill_card": "Card slides in with due date and amount",
      "streak_flame": "Streak counter increments with a pulse",
      "summary_stack": "Observation cards stack into view"
    }
  },

  "scripts": [
    {
      "id": "daily_slightly_behind",
      "variant": "slightly_behind",
      "isDefault": true,
      "_note": "Matches the persona health state (D17).",
      "segments": [
        { "id": "s1", "text": "Morning. Six days running now — that's a real habit forming.", "cue": "streak_flame" },
        { "id": "s2", "text": "Here's how your week is shaping up.", "cue": "buddy_greeting" },
        { "id": "s3", "text": "You're spending more on eating out than most households like yours in your area.", "cue": "bar_compare", "cueData": { "userKey": "actuals.Dining out", "peerKey": "peers.Dining out" } },
        { "id": "s4", "text": "It's the one category pulling you off plan. Everything else is close to where you wanted it.", "cue": "category_grid", "cueData": { "highlight": "Dining out" } },
        { "id": "s5", "text": "Your emergency fund is moving, just slower than you set out for.", "cue": "goal_ring", "cueData": { "goalId": "g_tactical_1" } },
        { "id": "s6", "text": "One thing worth knowing — you've got a bill landing this week that isn't in the budget yet.", "cue": "bill_card", "cueData": { "billName": "Car insurance" } },
        { "id": "s7", "text": "Nothing here is broken. A couple of small changes and you're back on line.", "cue": "summary_stack" }
      ],
      "timings": {
        "_note": "Milliseconds. Overwritten by TTS boundary events at playback. Safe to regenerate wholesale.",
        "s1": { "start": 0, "duration": 3400 },
        "s2": { "start": 3400, "duration": 1900 },
        "s3": { "start": 5300, "duration": 4600 },
        "s4": { "start": 9900, "duration": 4800 },
        "s5": { "start": 14700, "duration": 3500 },
        "s6": { "start": 18200, "duration": 4400 },
        "s7": { "start": 22600, "duration": 3800 }
      }
    },
    {
      "id": "daily_on_track",
      "variant": "on_track",
      "segments": [
        { "id": "s1", "text": "Morning. Six days in a row — nicely done.", "cue": "streak_flame" },
        { "id": "s2", "text": "Quick read on your week.", "cue": "buddy_greeting" },
        { "id": "s3", "text": "You're sitting right about where households like yours land.", "cue": "bar_compare", "cueData": { "userKey": "actuals.Dining out", "peerKey": "peers.Dining out" } },
        { "id": "s4", "text": "Every category is inside the lines. That's harder than it sounds.", "cue": "category_grid" },
        { "id": "s5", "text": "Your emergency fund is tracking to plan.", "cue": "goal_ring", "cueData": { "goalId": "g_tactical_1" } },
        { "id": "s6", "text": "One bill this week to keep an eye on, but you've got room for it.", "cue": "bill_card", "cueData": { "billName": "Car insurance" } },
        { "id": "s7", "text": "Steady is the whole game. Keep going.", "cue": "summary_stack" }
      ],
      "timings": {
        "s1": { "start": 0, "duration": 2900 },
        "s2": { "start": 2900, "duration": 1600 },
        "s3": { "start": 4500, "duration": 3400 },
        "s4": { "start": 7900, "duration": 3900 },
        "s5": { "start": 11800, "duration": 2600 },
        "s6": { "start": 14400, "duration": 3900 },
        "s7": { "start": 18300, "duration": 2700 }
      }
    },
    {
      "id": "daily_slightly_ahead",
      "variant": "slightly_ahead",
      "segments": [
        { "id": "s1", "text": "Morning. Six days straight, and it's showing.", "cue": "streak_flame" },
        { "id": "s2", "text": "Let's look at your week.", "cue": "buddy_greeting" },
        { "id": "s3", "text": "You're coming in under what households like yours typically spend.", "cue": "bar_compare", "cueData": { "userKey": "actuals.Dining out", "peerKey": "peers.Dining out" } },
        { "id": "s4", "text": "That gap is real money, and it's going somewhere useful.", "cue": "category_grid" },
        { "id": "s5", "text": "Your emergency fund is ahead of the pace you set.", "cue": "goal_ring", "cueData": { "goalId": "g_tactical_1" } },
        { "id": "s6", "text": "There's a bill this week, and you're already covered for it.", "cue": "bill_card", "cueData": { "billName": "Car insurance" } },
        { "id": "s7", "text": "This is what it looks like when it's working.", "cue": "summary_stack" }
      ],
      "timings": {
        "s1": { "start": 0, "duration": 3000 },
        "s2": { "start": 3000, "duration": 1500 },
        "s3": { "start": 4500, "duration": 3700 },
        "s4": { "start": 8200, "duration": 3300 },
        "s5": { "start": 11500, "duration": 3000 },
        "s6": { "start": 14500, "duration": 3400 },
        "s7": { "start": 17900, "duration": 2800 }
      }
    }
  ],

  "unwrittenVariants": {
    "_note": "Structurally supported, not written (A10). Adding one means adding a scripts[] entry with the same segment ids — no code changes.",
    "pending": ["not_engaged", "deeply_behind", "heavily_ahead"]
  },

  "deferredCadence": {
    "_note": "Full production cadence, specified for reference only. Not built (D27). Pattern: 3 weekly, 1 monthly, 3 weekly, 1 monthly, 3 weekly, 1 quarterly = 12 unique. Monthlies repeat; the quarterly slot becomes semi-annual, then annual. 14 scripts total, each with 6 engagement variants.",
    "totalScriptsAtFullScope": 84
  }
}
;
