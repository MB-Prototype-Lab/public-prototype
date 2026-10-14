# Product decisions

These are the product decisions in force for `app/`, one line each. Code and docs
cite them by ID, such as "(D19)" or "L27". IDs are stable: an ID keeps its meaning,
is never renumbered, and is never reused once a decision is retired. A new
journey-affecting setting or a new product rule needs a PM decision recorded here,
as the next free L number (L28 onward), before it reaches `app/`; until then the
behavior belongs in a Flow ([one product](app-contracts.md#one-product-no-journey-switches)).
When a decision changes, edit its line to state the rule as it now stands.

## Platform

- **L1** — The app is vanilla JavaScript with no npm, no build step and no runtime dependencies; charts and icons are hand-built.
- **L13** — The app opens from `file://`, where `fetch` is blocked, so each `data/*.json` ships with a generated `data/*.js` wrapper loaded by a script tag.
- **L23** — npm and build steps live only in `tools/`, never in `app/`; the onboarding film is pre-rendered there into committed video files, and the app falls back to its built-in animation when a film is missing.
- **D02** — No live LLM and no API keys. Nothing needs the network at runtime; release-controlled Useberry tracking on HTTP(S) is the one exception.
- **D03** — State lives in memory and a refresh starts over: no backend, no database, no localStorage. The only sessionStorage is the tab's reviewer settings, never participant data.

## Persona, seed data and onboarding

- **D06** — Full onboarding is part of the prototype, and finishing it lands on a one-day streak.
- **D08** — One fixed persona backs all seeded data.
- **D09** — Onboarding's name, ZIP, household size and income override the persona; the rest of the persona stays as seeded.
- **D16** — The seed holds six days of fabricated history.
- **D17** — The persona's finances are slightly behind: room to improve, neither dramatic nor comfortable.
- **D18** — All four seeded observations are visible (overspending in a category, an unused subscription, a savings goal behind pace, an unbudgeted bill due soon), and each is reachable from at least two screens.
- **D19** — No screen renders empty: where real data is thin, show a plausible fabricated value instead of a blank or zero state.
- **L26** — Skipping setup picks one of nine explicit profiles (three cost-of-living places × three income levels), and the same nine are the automated test matrix.

## Navigation

- **L5** — Navigation is the five tabs (D34) plus Home as an icon at the top left of a shared top bar, with a back stack per tab.
- **L14** — The v2 screens the spec never mentions stay in the app, off the main paths, reachable from the Tools jump list.
- **D33** — Marketplace is a visible, greyed-out tab that does nothing.
- **D34** — The bottom nav has five tabs in this order: Goals, Budget, My Progress, Education, Marketplace (labels may be shorter).

## Money Journal

- **D11** — Structured questions about yesterday (multiple choice, numbers, dropdowns) carry the journal's parsing load.
- **D12** — The free-text box accepts anything and is silently ignored: never parsed, never shown on the confirmation, never acknowledged.
- **D13** — One prompted journal entry a day, plus extra entries the tester starts themselves.
- **D14** — The confirmation comes entirely from the structured answers: the spend category, an estimate from the persona, and sliders to adjust before submitting.
- **D15** — The journal counts cash flow only: food eaten from what is already at home is $0, because the groceries were counted when bought.
- **L12** — The unused-subscription (Hulu) task opens a journal entry focused on `q_watched`, not a screen of its own.
- **L17** — A submitted entry adds to month-to-date, and everything that reads it (observations, the daily update, My Progress) recomputes.

## Budget and peers

- **L6** — One budget builder is on the participant path, and every builder saves through `submitBudgetBaseline()`; nothing writes the budget directly. The emergency fund is the approved exception: its save replaces the budget at once and returns to Goals.
- **L11** — The seeded dining observation compares spending with the tester's own plan; the peer comparison is a separate card with its own label, and neither stands in for the other.
- **L24** — The budget builder has three steps with a per-line "Help me out"; peers show as a ±10% band on one track per category; Health displays as "Medical & Dental" (a label only, not a data rename).
- **L25** — "Help me out" is its own estimation engine, a short question tree per category, and a budget is a whole month: it is never pro-rated by the date.
- **D20** — Peer benchmarks are a static model built ahead of time (base values plus adjustment rules), not a table of finished numbers.
- **D21** — The peer model adjusts for lifestyle, household size and income.
- **D22** — Cost of living covers every ZIP code in the 50 states and DC; a territory ZIP uses the national average and is reported as unsupported.
- **D23** — Peer figures never use real user data; they are a calculated aggregate of government data and cost-of-living adjustments.
- **D24** — Three spend layers are always labelled apart: plan (budget), self-reported (Money Journal) and automated (bank-linked, not in the prototype).

## Rewards and paywall

- **L16** — Charity Points and buddy level are display-only: points accrue and show but nothing spends them, and buddy level has no progression rule.
- **L27** — The Budget tab is a Platinum paywall that never unlocks: its button records the tap and says checkout is not built. It overrides D31 for that tab only, and it guards the tab, not the budget, so tasks and links still reach budget screens.
- **D31** — No ads and no paywalls, apart from the Budget tab (L27); lessons, topics and points gate nothing.

## Buddy, chat and advice

- **D10** — Buddy art is never generated by the app or by agents working on it; the images come from the owner.
- **L22** — Owner-supplied static buddy illustrations are allowed as separate image files (no sprite-sheet cropping); the text description stays as the fallback when an image is missing.
- **D25** — Buddy chat is keyword matching against a static response library, with tappable bubbles as the main input; no LLM.
- **D26** — No financial advice, ever, on any surface: state the number and the gap, never what to do.
- **L20** — The no-advice guardrail is code: any chat question asking what to do gets the safeguard reply, checked before keyword scoring.

## Lessons, audio and video

- **D38** — The lesson player is extended with framing questions and answer-driven scripts, never rewritten.
- **L9** — Lessons use a five-tier badge model (bronze to diamond, 500 XP per tier), with XP tuning knobs in Tools.
- **L10** — Narration plays pre-generated audio files where they exist, then runtime browser speech, then a silent word-count clock; the animated waveform stage appears only when chosen in Tools.
- **D04** — Speech uses only built-in system or browser voices: no third-party voice service and no API keys.
- **D27** — The video update is daily only; longer cadences are not built.
- **D29** — Narration timings are kept apart from script text and keyed by segment, so they can be regenerated without touching the words.
- **D30** — Update scripts stay general; the visuals carry the actual numbers.

## Look

- **D36** — The visual direction is Finch-like: soft pastels, cozy, rounded.
- **L21** — Four themes, chosen in Tools: Light, Dark, Natural Light and Natural Dark. Natural Light is the default.
