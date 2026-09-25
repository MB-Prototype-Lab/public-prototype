# Money Buddy v4

Auto-loads whenever you work in `versions/v4/`. Everything here binds even if
nobody opens another doc.

## v4 is a copy of v3.1, and it is where new work happens

It began as a **byte-for-byte copy of `versions/v3.1/`** — which was itself a
copy of `versions/v3/` — so every contract, trap and decision below was
inherited rather than written for it. Three consequences:

- **This is where new work happens.** The tooling agrees: `sweep.sh`,
  `wrap-data.sh` and the generators default to `MB_VERSION=v4`. Pass
  `MB_VERSION=v3.1` or `MB_VERSION=v3` to look at either older side.
- **v3 and v3.1 are still the A/B pair, and v4 is not a third arm of it.**
  That comparison is between those two only. Whether v3.1 keeps receiving
  feature work now that v4 exists is the owner's call and is deliberately not
  recorded here — don't infer it.
- **The bug-fix question now has three answers.** The rule was "v3 and v3.1, or
  v3.1 only". Ask it as: does this fix land in **v4 only**, or is it backported
  to v3.1 and/or v3? Never assume.

As v4 diverges from v3.1, record what differs **here**, under its own heading.
A reader who knows only that "it started as a copy" cannot tell an intentional
variation from a bug.

### v4's own divergences

1. **The onboarding film plays on all four themes — TEMPORARY.**
   *(All five LIGHT scripts are now rendered, so this fallback fires only for the
   two dark themes. Rendering the dark look retires it entirely.)*
   `ONB_FILM_ANY_LOOK` in `screens/onboarding.js`. The film has two looks and
   only `light` is rendered, so `dark` and `naturalDark` found no entry in
   `data/onboarding-films.js` and dropped to the live hyperframes engine — the
   same step showing two different pieces of work depending on a colour setting.
   `onbFilmEntry()` now falls through to any rendered look.
   - **A fallback, not a remapping.** A theme with its own render still gets it,
     so rendering the dark look needs no code change here; the dark themes stop
     falling through by themselves. Nothing has to be unwound.
   - **The limiter is the SCRIPT, not the look.** Five scripts exist, chosen by
     the goal picked at onboarding step 2, and only `onboarding_intro` (the
     no-goal default) is rendered at all. Pick any goal and you get the SVG
     engine on every theme. **Do not "fix" that the same way** — a look
     fallback is safe because both looks are cut to the same script's beats; a
     script fallback would play one script's picture under another's narration
     and drift, which is exactly what `sweep.js` §7c's beats check exists to
     catch. The fix is rendering the other four, not another fallback.
   - **The render tool was pointing at the wrong version.** Six tools read
     `MB_VERSION`; five were repointed when v4 was created and
     `tools/film/build-films.mjs` was not. A `--render` therefore encoded four
     films into `versions/v3.1/` — the A/B **control** — while v4's sweep went
     on reporting "1 of 10 rendered". Every log line said `rendered`; they were
     simply in another version, and nothing anywhere would have said so.
     §7c now asserts the tool's default matches the tooling default.
   - `sweep.js` §7c gates both halves: every theme resolves to a rendered film,
     **and** a theme with its own render still gets its own look. The second is
     the one that would rot quietly — without it, rendering the dark film could
     change nothing a dark tester sees and nothing would say so.

2. **One URL per screen, so a usability tracker can see the prototype.**
   `js/screen-url.js`, called from one branch of `render()`.
   - **The defect it fixes.** A Useberry round recorded the passcode gate, the
     first onboarding screen, and nothing else. Their tracker watches the page
     with a MutationObserver and compares `document.location.href` on every DOM
     change; it does **not** hook `history.pushState`. `navCommit()` calls
     `pushState(snapshot, '')` — empty URL argument, meaning *same URL* — so the
     only two things that registered were real page loads and all ~47 screens
     after them shared one address.
   - **`scrollKey()` is the identity, and it now has two consumers.** It already
     answered "is this a new page to a tester?" for the scroll hold, which is
     the same question a tracker asks. A second function answering it separately
     would drift invisibly — the flow report would quietly stop matching what
     testers saw. `js/utils.js` says so at the definition.
   - **The hook is in `render()`, not `navCommit()`.** Onboarding steps, builder
     steps and Help-me-out stages change the view without touching the nav
     stack. `render()` is the one choke point they share.
   - **`replaceState`, never `pushState`.** Back/forward behaves byte-identically
     to before: `navCommit()` still pushes its own entry and this only rewrites
     that entry's URL; stepped screens that never pushed still never push.
   - **http/https only.** Chrome throws `SecurityError` for `replaceState` with a
     URL argument on `file://` (opaque origin). Locally the module no-ops and
     the app behaves exactly as it did — without the guard the dev error-catcher
     collects one exception per screen change.
   - **Query parameters we do not own are preserved.** Useberry passes
     participant ids as URL parameters (`PROLIFIC_PID`). Rebuilding the query
     string would drop the identifier mid-study and neither side would report
     it. `sweep.js` §7d asserts it survives.
   - **Deep links are an ALLOWLIST, not a router** (`SCREEN_LINKS`), so a
     Useberry task can start where it is about instead of replaying onboarding.
     Screens needing a prior choice — `budgetCategory`, `lesson`, `helpMeOut`,
     `marketplaceDetail` — are deliberately absent: a cold link lands on the D19
     placeholder, which is right for an admin jump and reads as broken to a
     tester sent there on purpose. An unknown slug falls back to the entry
     screen. `?profile=` applies one of the nine through `profileApply()` first,
     so the screen has complete figures behind it.
   - `bbStart()` was split into `bbSessionInit()` + `bbStart()` because the
     original navigated, and a deep link needs the session without `go()`.

3. **`USEBERRY_TRACKING` — the one sanctioned exception to D02.**
   `js/config.js`, default **false**, loaded by `js/useberry.js`.
   - D02 is "no live LLM, no API keys, **no network at runtime**". This is a
     third-party script, and the exception is deliberately narrow: telemetry
     only, off unless the owner turns it on, http/https only, and **no app logic
     may ever depend on it** — the prototype must behave identically with it off,
     which is how it ships. `sweep.js` §7d fails if it is committed as `true`.
   - **A tester cannot switch it off, so the gate says it is on.** `VERSIONS[]`
     in `gate/gate.js` carries a `tracking` flag per version and renders a
     "recording" badge. The gate deliberately never loads a version's scripts
     (two versions' globals in one document would collide), so it **cannot** read
     the real flag and keeps a copy — §7d asserts the two agree, because a build
     observed while the gate says otherwise is the one outcome neither file
     shows on its own.
   - **Snippet, not their proxy.** Useberry's own docs say the proxy blocks
     resources with an `integrity` attribute, disrupts CSP/CORS-dependent apps,
     and that trigger elements should be set up with the snippet when the proxy
     will not show them.
   - **No custom events.** Their tracker exposes `useberryLive = {}` — an empty
     object, no methods. The only channel is an internal postMessage protocol
     between their script and their player. Imitating it would be unversioned
     and would fail silently mid-study. Do not.

4. **Every control is named, and what a tester set leaves with them.**
   `js/ub-names.js` and `js/value-trail.js` — phase 2 of the tracking work.
   Operator's guide: `docs/useberry.md`.
   - **Names are DERIVED, not written.** ~270 interactive controls across 47
     screen files; typing a name onto each is a diff nobody can review and 270
     things that go stale. `ubActionName()` computes one from the handler
     already on the element — `bbToggleHelp('Utilities')` becomes
     `budget-build-1/bbToggleHelp:Utilities` — stamped against the live DOM
     after `render()`, so the template literals are already substituted. Rename
     the function and the reports rename themselves.
   - **A tester's input must never enter a control's name.** `this.value` is
     dropped in every shape it appears in, because a name that moves with the
     value is a different control on every keystroke and a heatmap becomes a
     list of one-click entries. A hand-placed `data-ub` always wins, and is the
     only kind that can go stale.
   - **The value trail rides in the URL FRAGMENT, at checkpoints only.**
     Everything else is closed off: D02/D03 leave no backend, no storage and no
     network; Useberry exposes no API to push data to (`useberryLive = {}`, no
     methods); session recordings would capture it free but start at their paid
     tier. The URL is what gets recorded on the free tier, automatically.
     - *Fragment, not query,* because `?screen=` has to stay identical across
       testers for the flow report to aggregate and for a URL task-completion
       criterion to match. A fragment rides in the href they record and is
       ignored by matchers.
     - *Checkpoints only* — budget saved, setup finished, journal submitted —
       and cleared on the next view, so one URL a session carries it.
     - *Last-value-wins*: a slider on `oninput` fires per pixel, and what a
       researcher wants is where it came to rest.
     - *Help me out gets its own key* (`traH-385` beside `tra-420`). Guessed
       versus computed is the comparison the trail exists for; overwriting one
       with the other would destroy it.
   - **⚠ FREE TEXT MUST NEVER REACH IT.** The trail travels in a URL a third
     party records and a researcher reads, and testers type their name in
     onboarding and prose in the Money Journal. `ubTrailRecord()` takes numbers,
     and a string only under a key declared in `UB_TRAIL_ENUMS` — so adding one
     is a reviewable act, not an accident. `sweep.js` §7e fails if the guard
     goes. `resetUserData()` clears the trail for the same reason: it is
     user-entered data that *leaves*, and one tester's figures surviving into
     the next session on a shared browser is a leak.

5. **The buddy creator opened on a body-type grid, with a breed search.**
   **⚠ DORMANT since #10** — nothing in `ONB_BUDDY_STEPS` reaches it. Kept, and
   §7f keeps testing it, so it comes back by putting `"bodyType"` in the list.
   `ONB_BUDDY_STEPS[0]` is `bodyType`; `BUDDY_BODY_TYPES` in
   `components/buddy.js`, `data/dog-breeds.json`, `js/breed-search.js`.
   - **Nine tiles, 3×3, two-and-a-half rows.** It replaced a vertical list of
     nine breed NAMES — words, for choosing a shape. The label sits outside the
     rounded square; inside is a placeholder circle whose **size is the only
     thing telling the eight unbuilt types apart**, so the sizes are gated as
     distinct. The prototype tile carries the real PNG, because it is the one
     that exists.
   - **`breed` must never hold a body-type id**, and the reason is not the
     obvious one. `buddyIsPrototype()` is an `indexOf`, so it stays true while
     *any* attribute is still prototype — the portrait would survive. An earlier
     version of the sweep gate asserted that consequence and **caught nothing**.
     The real damage is quieter: `renderBuddyDescription()` prints `breed` as the
     breed name, the admin dropdown offers `BUDDY_BREEDS` which has no body-type
     id in it, and `onbSetBuddy`'s cascade keys on `breed` and would fill five
     attributes nobody picked. §7f asserts it through a repaint.
   - **380 breeds, ~1,130 search terms**, mapped by GROUP with per-breed
     overrides rather than 380 separate judgement calls — twelve authoring groups
     collapse onto eight body types, and a breed carries an explicit `body` only
     where it breaks its group (a Pit Bull is a terrier by registry and a mastiff
     by build). Every override carries a `why`, so the file is reviewable.
   - **A mix is additive.** "half husky half corgi", "husky x corgi",
     "husky/corgi mix" all resolve to both parents, plus whatever the cross
     itself throws that neither parent shows — short legs are dominant, so
     low-set crossed with anything tends to produce low-set pups.
   - **Two matching traps, both found by running it.** A bare substring test let
     `asdfgh` match the Australian Shepherd, because the alias `asd` sits inside
     it — with ~1,130 terms, three-letter aliases turn any typo into a confident
     wrong answer; matching is word-bounded now. And hunting each token
     separately pulled the Mountain Cur into "bernese mountain dog" and the Blue
     Lacy into "blue heeler"; a token already inside a matched breed's own name
     is not a second breed.
   - **An unmatched or generic search shows all nine**, never an empty grid
     (D19), and the prototype survives every filter — a tester must always be
     able to pick the buddy that has art.
   - **The search filters on `oninput` without re-rendering.** The house rule is
     `onchange`, because `render()` reassigns the screen's innerHTML and takes
     the caret with it. This uses the same escape hatch `onbLiveInput` does:
     `uiPatchHTML()` on the grid and the match line, leaving the `<input>`
     alone. §7f fails if it ever becomes an `onchange`, or if either patch
     target is renamed — a renamed id stops the filtering silently.
   - **Room came from the portrait**, 330px → 200px on this sub-step only, plus
     a one-line title. The keyboard covers the grid rather than reflowing it;
     below 700px of viewport the shared scroll padding comes back, because
     otherwise the field would sit under the keyboard.

6. **Onboarding has no top bar, and gets its 52px back.**
   `TOPBAR_HIDDEN_SCREENS` in `components/topbar.js`, plus one rule in
   `css/layout.css`.
   - The bare bar's `‹` was a **third** escape on a screen that already has Back
     in its footer and Skip in its header — `renderTopBar()` falls through to a
     back button on any full-bleed screen.
   - **Hiding it was only half the fix.** `.screen-scroll.no-topbar { top: 0 }`
     and `.screen-scroll.journal-mode { top: var(--topbar-h) }` are both (0,2,0),
     and the journal rule is declared 285 lines later — so it won on source
     order and onboarding kept a **52px empty strip** where the bar had been.
     `.screen-scroll.journal-mode.no-topbar { top: 0 }` carries both classes and
     outranks it.
   - **That rule is only correct while onboarding is the only screen that is
     both.** `sweep.js` §7f parses the `journal-mode` toggle lists out of
     `render.js` and fails if a second screen joins both — otherwise it would
     silently take its own strip back.

7. **The body-type step has a search mode.** *(Dormant with #5.)*
   `onbBodySearchOpen` / `onbBodySearchKey` / `onbBodySearchClose` in
   `screens/onboarding.js`, `.onb-buddy-step-body.searching` in
   `css/components.css`.
   - Focusing the search hands it the screen: portrait, title and subtitle hide,
     the field rises to the top, the grid takes the rest. Enter or picking a tile
     hands it back. **The filter persists across both**, and the search text
     stays in the box so it is obvious why only three tiles show.
   - **It is a DOM class, never state**, for two reasons. It cannot re-render —
     `render()` reassigns the screen's innerHTML, so a focus handler that
     re-rendered would destroy the focused input and close the keyboard it had
     just opened. And picking a tile already goes through `render()`, so the
     rebuilt markup simply has no class and the mode ends by construction rather
     than by anyone remembering to clear a flag. §7f spies on `render` and fails
     if either transition calls it.
   - **Hiding is what moves the field, not `order`.** The search already sits
     after the portrait in the DOM. `order: -1` was the first idea and would have
     lifted it above the step header.
   - **The shared keyboard rule is the mechanism, not the obstacle.**
     `.screen-scroll.kbd-open { padding-bottom: 250px }` shrinks the scroller's
     content box, the step compresses into what is left above the keyboard, and
     with the portrait hidden that compression lands on the grid — the grid
     rises, not the dog. Two rules written earlier to *suppress* that reflow are
     gone; one was inert anyway, setting padding on the step when the padding
     lives on the scroller.
   - Tiles are **78px** (−25%) in a centred 3-up grid, the portrait is
     **240px**, and a grid row is measured as **square + gap + label**. Measuring
     it off the square alone made "two and a half rows" 2.3 and sliced the third
     row's labels; §7f asserts the row is built from its parts.

8. **The film step stops framing itself in green.**
   `.onb-video-stage` in `css/components.css`, `onbFilmGroundStyle()` in
   `screens/onboarding.js`, `grounds` published by `tools/film/build-films.mjs`.
   - **The box was free to be taller than the picture.** Both tiers draw at
     **100:72** — the SVG engine is `xMidYMid meet` on a `0 0 100 72` viewBox and
     the film canvas is 1000×720 — but the stage had `height: 210px;
     max-height: 340px`. At 354px wide the picture is 255px tall, so up to 85px
     of that box could only ever be `--accent`. The stage now carries
     `aspect-ratio: 100 / 72`; §7c asserts all three declarations agree and that
     no fixed height comes back.
   - **⚠ THE COLOUR FOLLOWS THE TIER, NOT THE THEME.** The SVG fallback draws
     entirely in `--on-dark` — the only colour token in
     `components/hyperframes.js` — and paints no ground of its own, so it relies
     on `.lp-stage`'s accent. Painting the stage cream underneath it is light ink
     on near-white: invisible, and only on the themes with no render, where it
     reads as the animation being broken rather than as a colour choice. A film
     paints the stage; the fallback never does.
   - **And it follows the LOOK, not the theme.** A dark theme with no dark render
     borrows the light film (`ONB_FILM_ANY_LOOK`), so the stage takes the light
     ground with it. Keying on the theme would reintroduce the mismatch it was
     added to remove.
   - **The grounds come from the build.** `#fdfbf7` / `#11100e`, computed in
     `tools/film/themes.mjs` from `variables.css`. They cannot be derived
     app-side: they are pushed past the app's tokens on purpose, and they derive
     from the **Natural** themes specifically — a `color-mix()` on the live
     `--cream` would be right on Natural Light/Dark and wrong on the other two.
   - **The manifest is written on every run now, not only on `--render`.**
     It used to live inside the render branch, so adding a field meant
     re-encoding every film to publish two colour values. The merge with `prior`
     and the prune of films missing from disk already made a dry run safe, so
     `node film/build-films.mjs` refreshes metadata and encodes nothing.
   - **Squeezing is safe now, which it was not before.** `flex-shrink` still
     lets a short viewport take height from the stage — the point of the
     original rule — and `object-fit: contain` letterboxes when it does, but
     those bars are the film's own ground, so they are invisible. The colour fix
     is what makes the sizing fix forgiving.

9. **The Budget tab is a paywall, and D31 is overridden.**
   `BUDGET_PAYWALL` in `js/config.js`, `screens/budget-paywall.js`, one guard at
   the top of `renderBudgetV3()`. Recorded as **L27** in `plan.md` §0.
   - **⚠ D31 says "No ads and no paywalls appear."** This is the first decision
     here to contradict the spec on product substance rather than build
     technique, so it is written down — unrecorded, the next reader finds D31,
     calls the paywall a bug and removes it. **D31 still holds everywhere else:**
     `learn.js` and `topic.js` keep their citations *with a qualifier* rather
     than losing them, because lessons, topics and kibble still gate nothing and
     L16 is untouched.
   - **One line of copy had to die.** The trial pitch closed on *"Nothing is
     locked either way — this prototype has no paid features."* That is a
     sentence a tester reads, and it now states the opposite. `sweep.js` §7g
     renders every screen and fails if it comes back — **including the dormant
     trial step**, which `renderScreen()` never reaches because `"trial"` is out
     of `ONB_STEPS` and putting it back is a one-word edit. Checking rendered
     markup rather than source is deliberate: a comment quoting the removed line
     must not trip it.
   - **The copy is reused, not invented.** v3 asked this as onboarding's last
     step and v3.1 left the renderer in place, so the terms, the pill and the
     five bullets are already designed. The budget leads the list here; in
     onboarding daily updates led, which was right there and wrong on this
     screen.
   - **Strict: the CTA never unlocks.** It says checkout is not built, writes
     nothing — not `state.trialAccepted`, which still means diamonds and the
     reward screen's subscriber tier — and the note is patched in, so there is
     no leftover to reset. It is still a real button because tracking is on and
     `js/ub-names.js` names every control: the tap records as intent-to-subscribe.
   - **⚠ NOTHING BEHIND THE WALL MAY LEAK THROUGH IT.** A wall that still prints
     the tester's own figures shows them exactly what they are denied, and would
     pass any check that only asked "does the wall render". §7g asserts no
     category name, no planned figure and no plan-vs-actual readout reaches the
     walled tab — with `planStatus` forced to `complete`, the hardest case.
   - **A flag, not a deletion**, and the sweep checks it **both ways** —
     asserting it is on would make the escape hatch fail the build, which is how
     a flag quietly stops being flippable. Deleting the call site would also
     orphan all ten functions in `budget-v3.js` into §7b's warning.
   - **⚠ IT GUARDS THE TAB, NOT THE BUDGET — owner's call, and these still get
     through:** the "Set up your budget" daily task and the Home task (both
     `bbStart()` → `budgetBuild`), budget-update-confirm's Rebuild,
     `?screen=budget-build`, `?screen=comparison`, and the admin jump list.
     Known and deliberate. Closing them is moving the guard into
     `renderScreen()` against a list of screen ids.
10. **The buddy step is two screens: meet, then name + pronouns.**
   `ONB_BUDDY_STEPS = ["meet", "name"]` in `screens/onboarding.js`;
   `BUDDY_PRONOUNS` in `components/buddy.js`. Sweep §7h.
   - **Meet** paints the prototype art first, then *"Meet your buddy!"*; its
     footer button reads **"Hi Buddy!"** (`onbContinueLabel`), every other
     step's reads Continue.
   - **Name** defaults to "Buddy" and needs **Pronouns** (blank by default,
     He/Him · She/Her · They/Them) before Continue unlocks. Top-right Skip
     still skips the whole step (D09), leaving pronouns blank.
   - **⚠ The "Buddy" default is written on ENTERING the name screen
     (`onbBuddyNameDefault`), never in `onbStart()`.** `js/profiles.js` names
     the buddy from a profile only when the name is empty; seeding it at start
     would silently break Skip all → profile picker.
   - **Two URLs:** the meet screen keeps `?screen=onboarding-5`, the name
     screen is `?screen=onboarding-5-name` (`onbBuddySubKey`, read by
     `scrollKey()` and `screenTitle()`), and the deep-link parser accepts it.
   - **Nothing reads `state.buddy.pronouns` yet** — the buddy speaks in the
     first person everywhere. It is stored, editable in the admin buddy card,
     and recorded as `pro-he|she|they` in the setup value trail. Not lost; just
     not used.
   - The fur/eye/pattern/body-type sub-steps are **dormant branches** in
     `onbBuddyStep()`, like `"trial"` in `ONB_STEPS` — not deleted.

### Inherited from v3.1 — how these differ from v3

Everything in this list arrived with the copy. It is v4's behaviour now; it is
kept phrased against v3 because that is the contrast the design was built on.

1. **The budget builder is three steps with a per-line "Help me out" toggle.**
   `screens/budget-build.js`, screen id `budgetBuild`. v3 asks six lifestyle
   questions and derives a budget from the answers; v3.1 opens on figures the
   tester adjusts, grouped into three steps, and asks questions **only about
   the lines they say they cannot estimate**.
   - **Every line is a slider**, on all three steps. The steps group categories
     by how well a tester knows them — not by how the figure is entered. That
     was misread once and built as a number field on step 1; "Housing — Exact"
     means rent is a figure you can state, so it needs less dragging, not that
     it needs a keyboard.
   - **The thumb opens on `benchPeerValue()` for that profile**, the same
     options the band behind it is drawn with, so it starts dead centre of its
     own band. It used to open on the no-lifestyle national figure, which put
     it visibly off the band for no reason a tester could see.
   - **The header bar is cumulative** — `bbCategoriesSoFar()`, reviewed steps
     only (2 → 7 → 12). Counting all twelve makes the bar open near-full
     because ten unseen categories are already in it, and it then has nothing
     left to show as the tester works.
   - `BB_STEPS` must **partition the taxonomy exactly**. A category in no step
     saves at whatever the peer model opened it on and is never put to the
     tester; one in two steps is asked twice and the second answer silently
     wins. Neither raises anything. `scripts/sweep.js` §7 asserts it and the
     builder's admin card shows the coverage.
   - **This supersedes the earlier inverted flow.** `spendingProfile`,
     `lifestyleWizard` and `budgetCompare` are no longer reachable from the
     product — every door (Budget tab Start and Rebuild, the update-confirm
     Rebuild, the daily task) now opens `budgetBuild`. The screens, their
     renderers and `lwStart()` are **not deleted**: they stay routed and
     admin-reachable, and v3 still runs them.
2. **There are no lifestyle questions.** The six-dimension wizard is gone as a
   concept in v3.1, and with it the "Which is closer?" reconciliation.
   - **Consequence for the peer model:** `state.lifestyle` is still seeded from
     the persona at boot, so peer figures are not generic — but nothing in the
     v3.1 flow *changes* it any more. Until the Help-me-out trees write those
     dimensions back (planned), two testers with the same income, household and
     ZIP get the same band however differently they live. Do not write copy
     that implies otherwise.
3. **Budget figures render as a band, not three bars.**
   `components/budget-band.js` — one track carrying the peer band (the peer
   figure ±10%), a budget mark, and a dot. It replaced `renderComparisonRow`'s
   three stacked bars, so the Budget tab, "Where it's going", the category
   detail and My Progress all changed together from one file.
   - **The track's right edge is `1.1 × max(budget, actual, peerHi)` — every
     mark on the track is in that max**, so nothing ever falls off and there is
     always a tenth of the track as headroom past the highest one.
     *This was briefly the other way round*, with peers excluded so a band
     above everything else would run off the edge and be marked. Against the
     seeded persona that fired on **five of twelve** categories (LA prices, a
     modest budget) and drew an empty track on nearly half the rows. Owner's
     correction: the rail fits whatever is on it. "Peers spend far more than
     you planned" is better said by a band sitting hard right of the budget
     mark than by an empty track and a rule.
   - **`clipped` / `bandOffChart` survive as a GUARD, not a designed state.**
     Nothing can overflow the computed edge, but a caller supplying its own
     `hi` could hand over one tighter than the band — and a band silently drawn
     to the edge would read as "peers top out exactly here".
   - **Build mode supplies its own edge** (`budgetSliderMax()`), because there
     the budget IS the dragged value and an edge computed from the marks would
     move under the thumb. That ceiling is at least 2.2× the peer figure
     against a band top of 1.1×, so peers stay on screen there too — and a
     slider needs somewhere to drag *to*, which an edge pinned to the current
     marks would not leave.
   - The track doubles as the slider — a real `<input type="range">` over the
     marks with a transparent track. **The 9px inset on `.band-build
     .band-track` is load-bearing:** a native thumb's centre travels from
     `thumbWidth/2` to `width - thumbWidth/2` while `left: %` marks travel the
     full width, so without it the thumb and the band disagree by ~3% at the
     ends.
   - Colour could not reuse the old legend. `--accent` and `--good` are near
     identical in the Natural themes (#557B58 / #4B7650) — fine as separated
     bars, unreadable as marks on one track. Peers are the pale `--good-bg`
     wash, the budget a neutral `--muted` rule, `--accent` is the dot.
   - **The rail is `--rail`, a token added for it, used as a 1px border.**
     `--progress-bg` is a FILL and measures **1.02–1.20:1 against `--card`** in
     every theme — no perceptible edge, so the sliders rendered as a thumb
     floating in white space with no track under it. Nothing caught it: the
     contrast block checks text pairs at 4.5:1, and every one of those passed.
     `sweep.js` §1b now gates `--rail` at 2.0:1.
   - **"Worth a look" is signed and peers-only.** `cmpWorthNoticing` and
     `cmpImpact` both used `Math.abs`, so far *below* peers scored like far
     above — and the seeded persona is under peers nearly everywhere, so the
     section listed the biggest under-spends. A category over its own plan but
     under peers no longer qualifies; both gaps still appear on the card, so
     L11 holds.
4. **`Health` displays as "Medical & Dental" — via a label, not a rename.**
   `CATEGORY_LABELS` + `catLabel()` in `js/taxonomy.js`. The data key is
   untouched everywhere, because `"Health"` is a join key across
   peer-benchmarks, seed-state, monthToDateActuals, estimator-questions and
   zip-cost-of-living, and any file missed is a lookup that silently returns
   undefined. **`catLabel()` on every display site; the bare string for every
   lookup, object key, comparison and `onclick` argument.**
5. **"Help me out" has its own engine** — `js/help-me-out.js` (model),
   `data/help-me-out.json` (twelve trees, a source on every figure),
   `screens/help-me-out.js` (one screen per category: progressive reveal, then
   a confirm slider). It briefly rode on the actuals estimator and must not go
   back — see the trap below.
   - **FIGURES are data, ARITHMETIC is code.** A rate table belongs in JSON
     where it can be re-sourced; multiplying it by a slider belongs where it
     can be tested. `HMO_MODELS` reads every number out of `rates`; a literal
     in a model is a figure with no source attached.
   - **`col: "apply"` vs `col: "included"`.** Absolute trees get the category's
     cost-of-living multiplier on the way out. Trees anchored on a peer figure
     (Housing) or applying it per component (Utilities) declare `"included"`
     and do it themselves — applying it twice squares it.
   - **The confirm band is conditioned on the answers**, via
     `hmoLifestyleFrom()` → `PEER_BENCHMARKS.lifestyleModifiers`. Somebody who
     truthfully says "most nights" must not be shown a band built from people
     who cook. Where lifestyle reaches nothing (Utilities, Subscriptions,
     Medical, Personal care, Debt payments) it falls back to the profile band
     and only the copy changes.
   - **The trees are the only thing writing `state.lifestyle`** now that the
     six lifestyle questions are gone. `hmoApplyLifestyle()` runs on accept.
   - **Toggling several lines chains them.** `bbNext()` queues every pending
     category on the step and `hmoAdvanceQueue()` walks it, then advances the
     step. On accept the row's toggle switches **off** — a line you just
     answered four questions about must not look like one you never started.
   - **`screens/spend-estimator.js` still serves the actuals path** ("Update
     what you've spent"), where month-to-date scaling is correct. Its
     `target: "budget"` branch is no longer reached.
6. **`renderSpendEstimator` has a real no-session fallback.** A D19 fix, owner
   decision to leave v3's dead end alone — it is recorded in `D19_ACCEPTED` in
   `scripts/sweep.js` so the control's sweep stays green and the exception stays
   visible.
7. **Onboarding is seven steps, reordered.** v3 asks nine:
   name · ZIP · household · income · lifestyle · goal · buddy · film · trial.
   v3.1 asks **name · goal · ZIP · household · income · buddy · film**. The goal
   question moves from sixth to second so the tester has a stake before being
   asked for a ZIP and an income band; the housing/commute pair and the trial
   pitch are gone.
   - **The removed steps were not deleted.** Their keys came out of
     `ONB_STEPS`; every renderer, handler and helper is still there and still
     referenced, which is why nothing landed in `DEAD_BASELINE`. Putting a step
     back is a one-word edit.
   - **`state.trialAccepted` defaults to `true` in `onbFinish`.** Nobody answers
     the trial pitch any more, and that flag gates 💎 diamonds and the reward
     screen's subscriber section — left null they would be unreachable.
   - **Every step pins Back/Continue** (`pinned` is unconditional). v3 keeps
     `o.step >= 5`, which is still correct for *its* order.
   - The budget wizard now collects housing and commute from a blank slate:
     `state.lifestyleAnswered` is empty at the end of onboarding, so all six
     questions open unanswered. `lwStart()` already handled that case.

Everything else is still the copy.

### Shared with v3, deliberately

**The nine starting profiles** (`js/profiles.js`, `data/test-profiles.json`,
`screens/profile-picker.js`) are **identical in both versions** and are not part
of what the A/B tests — they are the floor both sides stand on. Three
cost-of-living tiers x three income levels, chosen empirically from
`zip-cost-of-living.json` by BEA RPP with Census ACS county median incomes:

| tier | ZIP | county | RPP | median | peers/mo |
|---|---|---|---|---|---|
| above | 95054 | Santa Clara, CA | 112.9 | $164,281 | $9.2k–12.0k |
| at | 37203 | Davidson (Nashville), TN | 97.4 | $75,664 | $3.3k–5.5k |
| below | 72201 | Pulaski (Little Rock), AR | 89.1 | $60,385 | $2.4k–3.1k |

- **They are also the headless test matrix.** `sweep.js` §1c drives every screen,
  the peer model, every Help-me-out tree and the whole builder through all nine.
  Everything the app computes is anchored on a ZIP and an income, and until this
  existed there was exactly one of each to test against — which is why "$10 of
  transport" had to be found by hand.
- **Household size is FIXED at 2 across all nine.** It drives groceries harder
  than anything else, so varying it would confound the two axes the matrix
  exists to isolate.
- **`PROFILE_PICKER` in `js/config.js` is one line** and takes the screen out of
  the flow; skip then applies `profileDefault()` silently and the matrix still
  works. This is scaffolding and is meant to be removable.
- **`SKIP_ONBOARDING` deliberately does NOT show the picker.** That flag exists
  to reach Home fast; stopping it for two questions defeats it.

## Read first

| File | Why |
|---|---|
| `plan.md` §0 (repo root) | **22 locked decisions, L1–L22. Do not re-litigate them.** L1–L19 were settled across eight question rounds with the repo owner; L20 and L21 landed mid- and post-build; **L22 reverses L15** and is the only decision so far to overturn an earlier one |
| `versions/v4/PROGRESS.md` | Start at `Current state:`, work the first unchecked item, tick as you go |
| `versions/v4/docs/architecture.md` | Cross-cutting contracts — data loading, taxonomy, nav, top bar, audio |
| `versions/v4/docs/spec-coverage.md` | Where each of the 53 spec items lands |
| `versions/v4/docs/useberry.md` | Running a usability study — tracking flags, start URLs, task completion |

The spec is at `v3 Files/spec/` — **read-only reference, never edit it.**
Its `docs/DECISIONS.md` beats every other spec doc; `plan.md` §0 beats *that*
where they conflict. Several spec decisions are deliberately overridden
(A1, D04, D39, D40 — see §0).

**v3 is a delta over v2 (D37).** Where the spec is silent, v2 governs — carry
forward what v2 did rather than inventing.

## Traps that fail silently

Each of these produces a plausible-looking wrong result rather than an error.
All verified against the raw JSON on 2026-08-07.

- **`base[cat][band]` is a 4-element ARRAY indexed by `householdSize − 1`.**
  Household 2 → index **1**. `4+` clamps to index 3. Reading `[householdSize]`
  returns the next household's figure.
- **Cost of living is BEA Regional Price Parities, not the tier table.**
  `benchColMultipliers(zip)` is the only chokepoint: ZIP → county → BEA
  geography → four price buckets, then a **per-category** local modifier
  (housing from county rents, utilities from state electricity prices, nothing
  else — see architecture §5). `peer-benchmarks.json`'s `colTiers` survives only
  as a guard; **never read it directly.** Its four tiers gave Manhattan, Palo
  Alto, Santa Clara and LA all the same number and capped housing at 1.85.
- **`benchSelfTest` no longer asserts the spec's 370.** That figure carried the
  old `very_high` tier's 1.34; BEA prices LA restaurant meals at 1.071, so the
  peer value is 295. The test now checks base, lifestyle and cost-of-living
  separately — stronger than the single assertion it replaced.
- **Lifestyle is a product across six dimensions**, not one lookup.
- **`paysRent` data keys are the strings `"true"` / `"false"` / `"shared"`**,
  not booleans. The wizard's option values map onto them via `benchLifestyleKey`:
  rent/mortgage → `"true"` (×1.0), family → `"false"` (×0.22, rent-free),
  other → `"shared"` (×0.6, the middle housing tier).
  **`commute`'s key for "mostly walk" is `none`.** A missed key silently
  contributes 1.0.
- **`_note` keys sit alongside real data** in `monthToDateActuals`,
  `PEER_BENCHMARKS.base`, `zipPrefixes`, and `lifestyleModifiers`.
  **Always iterate `CATEGORIES`, never `Object.keys(data)`.**
- **Lesson framing options key on `tag`, singular.** A `.tags` lookup collects
  nothing and plays the fallback variant every time.
- **The self-reported layer is `monthToDateActuals`** ($429 dining), *not* the
  sum of `journalHistory` (~$168). Getting it backwards breaks every observation.
- **`state.monthlyIncome` is not a take-home figure**, despite the seed JSON key
  still reading `monthlyIncomeNet`. It is `profile.incomeAnnual / 12` — what the
  tester said, no tax factor. Separate from `state.userProfile.monthlyIncome`,
  an unrelated v2 form field.
- **`travelFrequency`'s middle option is a ×1.0 no-op**, and the dimension moves
  only `Other`. Picking "Now and then" was mathematically identical to never
  answering, which is why its figure looked broken. Travel is now an explicit
  trips × cost ÷ 12 line inside Other and is exempt from the wizard's slider
  bands, because its figure is composed rather than `base × multipliers`.
- **Closing the simulated keyboard moves the layout by 250px**
  (`.screen-scroll.kbd-open`), so anything that closes it mid-gesture pulls the
  button out from under the finger and no `click` is ever dispatched. That is
  why `kbdInit` holds the close while a button press is in flight, and why
  `render()` calls `kbdSyncAfterRender()`.
  **BOTH focus handlers have to respect that latch, not just `focusout`.**
  Chrome and Edge focus a `<button>` on mousedown, so pressing Continue fires
  `focusin` with the BUTTON as target — and that path closed the keyboard
  synchronously, defeating the latch entirely. Safari and Firefox on macOS do
  not focus buttons this way, so the bug is invisible on half the machines you
  might check it on. Any test for this must fire the **whole** sequence:
  `pointerdown → focusout(field) → focusin(button) → pointerup → click`.
- **Both narrated players snap the clock forwards only.** `elapsed` is normally
  ahead of the current cue (the speech cap lets the tick run to just short of
  the next one), so an unconditional snap rewinds it — and the hyperframes
  faithfully rewind with it, which reads as a flicker at every line boundary.
  There are THREE snap sites: live speech in the lesson player, live speech in
  the onboarding player, and the onboarding `.wav` `onplay`.
- **A capped clock has to hold the PICTURE too.** When speech drives playback,
  the tick freezes `elapsed` at the speech cap and waits for `onEnd` — but the
  hyperframes are native CSS animations running on wall clock, so they carried
  on. Every 100ms tick then found them ahead of the frozen clock and
  `hyperframesSync`'s 120ms drift check yanked `currentTime` backwards, roughly
  eight times a second for the length of the overrun. That is a visible,
  erratic stutter and it fires on any line the narrator takes longer over than
  165 wpm predicts — two- and three-sentence lines, because sentence-final
  pauses are not in the word-count estimate. Both players now pass
  `playing: false` while held (`onbVideoHeld`, `lpHeld`), which pins the
  animation instead of fighting it.
- **A skipped onboarding field falls back to a PROFILE, never to the persona.**
  Every write in `onbFinish()` is guarded (`if (o.zip) …`), which is correct — an
  unanswered field must not clobber an answered one. What was wrong was what sat
  behind the guard: `bootV3`'s persona seed, so skipping quietly made the tester
  Sam from Los Angeles on $68,000 and nothing on screen said so. Every figure
  downstream was anchored on a profile nobody chose. `profileDefault()` is the
  fallback now. Related: `o.name || "Buddy"` made the **tester** "Buddy", the
  same as the dog — the person is "Me".
- **An unnamed buddy had three different fallbacks.** `"Buddy"` on Home and in
  Chat, `"Your buddy"` in the character frame. `onbFinish()` now names it once at
  the source so every surface agrees; the display-time fallbacks stay as
  belt-and-braces.
- **A BUDGET IS A MONTH. Never pro-rate one.** The Help-me-out questions first
  shipped on `estimatorCompute()`, which multiplies every option by
  `estimatorMonthFraction()` — right for "what have you spent so far this
  month", catastrophic for a budget. On the 4th of a 30-day month every answer
  came out at 13% of itself: "light local driving" became **$10** of transport,
  "a regular ongoing cost" became **$20** of healthcare, and picking the most
  expensive option still *lowered* the category, because the peer default it
  replaced was eight times larger than anything the sum could return. Nothing
  in `js/help-me-out.js` reads a clock, and `sweep.js` §7 stubs
  `estimatorMonthFraction` and asserts no tree's figure moves.
- **Never reach past `benchColMultipliers()` to price a place.** The Utilities
  model looked up `state.utilitiesRatio` itself to price local electricity —
  but `benchColLocalModifier` already returns exactly that ratio for Utilities,
  so the category multiplier carried it and the model squared it: Los Angeles
  at 1.353 x 1.648 x 1.648, a 65% overstatement, every figure still looking
  like a plausible power bill. Same shape as the retired `colTiers` trap.
  Utilities now applies the multiplier itself, to **power and water only** —
  broadband and a mobile plan are priced nationally, and a blanket multiplier
  overstated them by more than the double-count did.
- **`.screen input` outranks a bare component class, and it sets a background.**
  `.screen input, .screen select, .screen textarea` is (0,1,1) and applies
  `background: var(--card)` plus a card radius. A component class like
  `.band-range` is (0,1,0) and **loses**. This is invisible for every slider
  that keeps its native track — the element's own background is never painted —
  and lethal for the one with `-webkit-appearance: none`, which strips the
  track and lets that card background through as a full-width, 44px, rounded
  box drawn straight over the rail with the thumb floating in the middle of it.
  Any input styling that must win has to carry `.screen` itself. `sweep.js` §1b
  asserts every `.band-range` rule does, and `components.css` is injected into
  the sweep for exactly this class of check.
- **`--progress-bg` is a FILL, not an EDGE.** Against `--card` it is
  1.02–1.20:1 in all four themes — invisible. Anything whose *outline* carries
  meaning (a slider rail, where the thumb's position along it is the whole
  reading) needs `--rail` instead, which is gated at 2.0:1 by `sweep.js` §1b.
  The failure looks like a rendering bug — a thumb with no track — and no text
  contrast check will ever catch it.
- **`overflow-y: auto` is not a one-axis declaration.** When one axis is not
  `visible`, the other's `visible` **computes to `auto`** — so a rule meant to
  let a column scroll silently makes the element a scroll container
  *horizontally* too. Two things then break with no error and no scrollbar to
  hint at it: the `:focus-visible` ring (2px outline + 2px offset = 4px outside
  an input that is `width: 100%` of the content box) is clipped at both ends,
  and when a vertical scrollbar does appear it narrows the content so it stops
  lining up with anything outside the scroller. An outline is *ink* overflow,
  not scrollable overflow, which is why it clips without ever producing a
  horizontal scrollbar to explain itself. Fix: negative side margin plus equal
  padding, so the ring has room inside the scroller and the content box stays
  put. See `.journal-shell.onb-pinned .journal-body`.
- **A correction to a playing animation must GLIDE, not cut.** There is one at
  every segment boundary — the cue map is a word-count estimate and the narrator
  is not — and writing `currentTime` skips the outgoing beat's fade-out and
  starts the incoming one part-way through its fade-in. `hyperframesSync` nudges
  `playbackRate` for anything under `HF_SNAP_MS` and only snaps past it, so a
  scrub or a ±10s skip still lands instantly. Paused animations are always
  pinned exactly, because the hold depends on it.
- **`play()` on a FINISHED animation rewinds it to zero.** `hyperframesSync`
  knew this and still guarded on `playState !== "running"` — and a finished
  animation is not running either. Every element is one animation spanning the
  whole runtime, so they all finish while the narrator is still on the last
  line, and the tick flashed the entire scene back to its first beat ten times
  a second. Only `paused` and `idle` get `play()`; setting `currentTime` is
  enough to un-finish one.
- **The wizard composes answers from the BASELINE, never from the preview.**
  `preview = implied x drift`, where implied is the neutral peer figure times
  every applied modifier and drift is the tester's drag as a *ratio*. Scaling
  the live preview instead — which is what it used to do — compounds through
  rounding when someone toggles between options, and produced $10 groceries for
  "Very into it". Re-answering the same question clears that dimension's drift;
  answering a different one keeps it.
- **Paying a card in full costs nothing.** `lrSimBalance` returns 1 month and $0
  interest when the payment covers the balance, because that is the grace period
  the APR lesson teaches in its own script. It used to charge a month first.
- **There are TWO quiz screens.** `quiz` (`screens/quiz.js`) serves the v2
  catalog; `lessonQuiz` (`screens/lesson-outcome.js`) serves v3, and every v3
  lesson including APR goes through that one. Fixing the wrong one changes
  nothing a tester sees. `render.js` says which is which on its own subtitle
  lines.
- **HTML comments inside a template literal are rendered into the DOM.** Naming
  a function or a class in one puts that identifier in the markup and in any
  grep over it — which is how a deleted button appeared to still exist. Describe
  the thing, don't name it.
- **Onboarding's option lists must test `lifestyleAnswered`, not the value.**
  `state.onboarding.lifestyle` is seeded from the persona so the four dimensions
  onboarding never asks still reach `state.lifestyle`. Comparing that seeded
  value against an option renders it pre-picked — which is what put "Car" under
  the tester's thumb before they touched anything. `paysRent` only looked fine
  because its persona value is the boolean `true` and the option values are
  strings, so it never matched. Use `onbLifestylePicked()`.

Self-test for the benchmark model (`benchSelfTest`): Dining out, b3, household
2, ZIP 90066, foodie moderate + cooks sometimes. Base **275** and lifestyle
**1.0** are still exactly the spec's; the cost-of-living factor is now BEA's
1.071 rather than the retired tier's 1.34, so the result is **295**, not 370.
The three factors are asserted separately — see architecture §5.

## Hard rules

**Runtime**
- **No live LLM, no API keys, no network at runtime** (D02). Chat is a keyword
  matcher; benchmarks are static; the journal is structured.
- **No backend, no database, no localStorage** (D03). State is in-memory and
  resets on refresh. This is intentional.
- **The app runs on `file://`** — `fetch()` and XHR are blocked and there is no
  dev server. Data loads via `<script>` tags (`data/*.js`), never a network call.

**Code**
- Vanilla JS, everything global, plain `<script>` tags. Keep names unique and
  feature-prefixed. Load order in `index.html` matters.
- One global `state`; mutate it then call `render()`. No partial updates.
- **Always `h()`-escape** anything interpolated into an HTML template literal.
- **Inputs use `onchange`, not `oninput`** — a full re-render mid-keystroke
  destroys focus. Sliders are the exception, paired with `debouncedRender()`.
- **A `type="range"` slider on `oninput` must use `debouncedRender()`, never
  `render()`** — product sliders as much as admin ones.
  `render()` reassigns `.screen`'s innerHTML, destroying the element being
  dragged — the browser's pointer capture dies with the old node and the thumb
  stops tracking. State still updates immediately; only the repaint waits.
  If a handler serves both a slider and a button, pass a `live` flag rather
  than debouncing the button too (see `budgetSetPlan`).
- **Never declare a name in two files.** Everything is one global namespace, so
  the later `<script>` silently wins and the earlier becomes unreachable — not
  an error, just dead. `sweep.sh` §7b checks this; §7b's *reference* count
  cannot, because a shadowed function is still referenced.
- **`.item-card` is `display:block`, not flex.** Fix trailing children with
  scoped inline flex; never change the global rule.
- Style with CSS variables only, never hardcoded hex. **All four themes** must
  work (L21) — Light, Dark, Natural Light, Natural Dark. Adding a colour token
  means adding it to `:root` **and** all three theme classes, or the sweep fails.
- **Never hardcode a text colour over `--accent` or `--accent-fill`.** `--accent`
  is dark in the light themes and light in the dark ones. Use `--on-accent` and
  `--accent-fill-text`; `--on-dark` is only for genuinely always-dark surfaces.
- **A theme must never set `--chrome-*`, `--bg` or `--phone`.** They style the
  admin panel, page and bezel, which live outside `.screen` where theme classes
  are applied — the override is inert, and the frame is meant to hold still.
- **Surgical edits.** Change only what you're fixing. Never collapse files.
- **Do not delete unused code.** This is a prototype under iteration; something
  dropped today is something rewritten next week. `sweep.sh` §7b inventories
  unreferenced functions against a baseline and **warns only on new ones** —
  a function that was referenced and now isn't was likely orphaned by accident.
  Deliberately-unused code goes in `DEAD_BASELINE`, it does not get removed.
- **Never judge "is this used?" by grepping for `name(`.** Functions here are
  reached four ways: ordinary calls, `onclick` in screen template literals,
  `onclick` in `index.html`, and bare identifiers in dispatch tables. Only the
  first looks like a call. Use `sweep.sh` §7b — grep gets this wrong.

**Copy** — applies to every surface
- **No financial advice. Ever. Anywhere** (D26). Surface the number and the gap;
  never prescribe the action. **Any question asking what to do gets the
  safeguard reply** — `chatIsAdviceSeeking()` runs before keyword scoring (L20),
  because the library's own keywords miss most natural phrasings. Forbidden
  shapes in any copy you write: "you should", "we recommend", "cancel your",
  "switch to", "you must", "the best option is".
- **Frame flags as questions, not instructions.** "Haven't heard about Hulu in a
  while" — not "cancel Hulu."
- No exclamation marks in financial observations. Warm, plain, second person,
  sentence case.
- Tip banner is a hard **90-character** limit.
- **"Peers", never "average users"** — the data is an external mathematical
  aggregate, never real user data (D23).
- Fixed vocabulary: Buddy · Money Journal (never "expense tracker") · Charity
  Points (two non-converting tiers: 💎 diamonds = subscriber, 🦴 bones = free/ad;
  the old "Kibble" term is retired, though `state.kibble` stays as the internal
  bone counter) · Streak · Peers · Observation.

**Quality floor**
- **No screen renders empty** (D19). Fabricate a plausible value rather than
  showing a blank. Design for it; it can't be retrofitted cheaply.
- `prefers-reduced-motion` respected. Tap targets ≥44px. Keyboard focus visible.
- Mobile first — the phone frame is 390px.

## Adding a screen — 5-point wiring

A screen is **not done** until all five are complete, or the admin panel
silently degrades to its generic fallback:

1. `screens/<name>.js` → `render<Name>()` (+ optional `render<Name>Admin()`)
2. `<script>` tag in `index.html`, screens block
3. `js/render.js` → `renderScreen()` · `adminSubtitle()` · `renderAdmin()` · jump list
4. `js/utils.js` → `activeTabFor` (the nav stack is the real source of truth —
   see architecture §7; keep this as the admin-jump fallback)
5. `js/state.js` → `destinations[]`

Plus a **full-bleed mode class** if the screen hides the nav, zeroing *both* the
top-bar and nav offsets.

## Verifying

No browser here — you cannot visually QA. **Which JS engine exists depends on the
machine**: the Mac has `jsc` and no `node`; the Linux/WSL box has `node` (often
only under `~/.nvm`, off PATH) and no `jsc`. Don't assume either.
- `bash scripts/check-syntax.sh <path>` on everything you touch (no args = all
  v3 + gate JS). It's the only automated gate, and it detects both engines.
- For logic, write a temporary DOM-stubbed harness that concatenates the needed
  files into **one** script, then run it (`node harness.js` / `jsc harness.js`).
  Concatenating matters: separately-evaluated scripts don't share top-level
  `const` bindings, but a browser's `<script>` tags do. Under node, use
  `vm.runInContext` with a stub context and append `this.__api = { ... }` —
  top-level `const` does not attach to a vm context's globals.
  **Delete it before committing.**
- The data wrappers are checkable: eval each `data/*.js` and deep-compare the
  global it declares against the `.json` beside it. That catches wrapper drift,
  which is silent and otherwise invisible until a figure looks wrong.
- Ask the repo owner to eyeball anything visual — say so plainly rather than
  claiming it renders.

## Don't

- Don't edit `versions/v1/` or `versions/v2/` — both frozen. Versions are test
  variants a tester picks at the gate, not a migration path.
- Don't edit `versions/v3/` or `versions/v3.1/` from here. They are a live A/B
  pair; a fix crosses into them only when the owner says it should.
- Don't build sprite-sheet `background-position` cropping. **L22 allows
  owner-supplied buddy illustrations, but they are separate files chosen by
  buddy state — not sheets addressed by offset.** D39's cropping machinery stays
  unbuilt.
- Don't delete the descriptive buddy frame now that art exists. It is the
  **fallback** (L22): no image set covers every breed x coat x pattern x eyes x
  nose x size x pose, and D19 forbids a screen rendering empty. A missing image
  must degrade to the description, never to a gap.
- Don't generate buddy art. D10's prohibition is on *generation* and it holds —
  the images are supplied by the owner.
- Don't add variants to "cover" unmatched lesson tags — falling through to the
  fallback is the design.
- Don't paraphrase `data/*.json` numbers into JS literals. Load them.
