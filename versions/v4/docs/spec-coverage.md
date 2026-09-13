# Spec coverage audit

Every decision (D01–D40) and assumption (A1–A13) mapped to where it lands.
**A row with no home is a gap.** That's the point of the file — omissions are
caught by an empty cell, not by reading carefully.

Run this again whenever scope shifts. Last run: **2026-08-07, pre-build**
(re-verified in plan.md pass 7 — every structural claim recomputed from raw JSON).

| Key | Meaning |
|---|---|
| ✅ | Covered — lands in a named phase |
| 🔄 | **Overridden** by a locked decision in `plan.md` §0 |
| ⬜ | Nothing to build — a "don't do this" decision, satisfied by omission |
| ⏸ | Deferred by the spec itself — specified, not built |
| ⚠️ | **Gap or partial** — needs attention |

---

## Scope and fidelity

| ID | Decision | Status | Where |
|---|---|---|---|
| D01 | Throwaway user-testing prototype, not an MVP | ✅ | Posture. L1 (vanilla, fast iteration) |
| D02 | No live LLM anywhere | ✅ | Journal structured (P1) · benchmarks static (P2) · chat keyword (P3). No key, no network |
| D03 | In-memory only, full reset on refresh | ✅ | P0c boot · arch §2. v2's refresh→gate carries forward |
| D04 | Web Speech API for **all** text-to-speech | 🔄 | **L10** — Web Speech is a build-time generator; runtime plays `.wav`. Intent (browser-native, keyless) holds; "no build-time audio assets" does not |
| D05 | Build depth priority order | ✅ | Phase order 1–5 matches: Journal → Budget → Daily loop → Update → Education |

## Onboarding and entry state

| ID | Decision | Status | Where |
|---|---|---|---|
| D06 | Full onboarding, lands on 1-day streak | ✅ | P3 onboarding |
| D07 | Skip flag → 6-day streak | ✅ | P0e `SKIP_ONBOARDING` seam |
| D08 | One fixed hardcoded persona | ✅ | P0c — `PERSONA` global |
| D09 | Tester inputs override persona (ZIP, household, income) | ✅ | P3 onboarding · arch §2 |
| D10 | Buddy art is externally generated raster sheets; **Claude must not generate** | 🔄 | **L15 → L22.** Art is now **externally supplied by the owner**, which is what D10 asked for; the prohibition on Claude generating it holds and is unchanged. Not sheets — separate files chosen by buddy state |
| D39 | Sheets flat cream `#FBF7F0`, CSS `background-position` cropping | 🔄 | **Still void under L22** — the owner's art is separate files, not sheets addressed by offset, so there is nothing to crop. The cropping machinery stays unbuilt |
| D40 | 3 breeds, 4 fur colours, eye/nose **dropped** | 🔄 | **L18** — all five attributes restored. Under L22 the pickers are **not** reduced to match the art: the image varies along whichever stats the owner's plan names, and the description carries the rest |

## Money Journal

| ID | Decision | Status | Where |
|---|---|---|---|
| D11 | Structured inputs carry the parsing load | ✅ | P1 |
| D12 | Free-text paragraph exists, silently ignored | ✅ | P1 — `q_free_text`, `parsed: false`, never on confirmation, never acknowledged |
| D13 | One prompted entry/day + user-triggered extras | ✅ | P1 |
| D14 | Confirmation derives entirely from structured answers | ✅ | P1 |
| D15 | Cash-flow only, no pantry deduction | ✅ | P1 — `$0` + "already in your groceries" |

## Seeded data

| ID | Decision | Status | Where |
|---|---|---|---|
| D16 | Six days of fabricated history | ✅ | P0c — `SEED_STATE.journalHistory` |
| D17 | Persona health state: slightly behind | ✅ | P0c · P4 (default script variant) · P5 (emergency fund behind but recoverable) |
| D18 | All four observations seeded and visible | ✅ | P0c + registry (arch §6) + P6 reachability check |
| D19 | No screen may render empty | ✅ | Standing rule (arch §12) + P6. Designed for, not retrofitted |

## Budget and benchmarks

| ID | Decision | Status | Where |
|---|---|---|---|
| D20 | Peer benchmarks AI-generated at build time, stored static | ✅ | Already generated — `peer-benchmarks.json`. Loaded P0c |
| D21 | Model adjusts for lifestyle, household size, income | ✅ | P0d formula (arch §5) · P2 wizard |
| D22 | ZIP coverage: all US if feasible, else CA/AR/NY/VA | ✅ | A12 narrows to 4 states, 151 prefixes. Unlisted → `moderate` |
| D23 | Peer data never uses real user data | ✅ | Copy rule (arch §12) · buddy response `what_is_peer` says exactly this |
| D24 | Three spend layers always distinguished | ✅ | arch §5 · P2 comparison. Automated layer labelled "not in prototype" |

## Buddy chat

| ID | Decision | Status | Where |
|---|---|---|---|
| D25 | Keyword search against a static response library | ✅ | P3 — inherit v2's `chat-router.js`, swap in `BUDDY_RESPONSES` |
| D26 | No financial advice ever stated, any surface | ✅ | Standing rule (arch §12) + P6 copy sweep across replies, observations, scripts, empty states |

## Video updates

| ID | Decision | Status | Where |
|---|---|---|---|
| D27 | Daily update only; several engagement variants | ✅ | P4 — 3 variants (A10). Other cadences ⏸ |
| D28 | Pre-rendered Hyperframes-style example, no asset library | ✅ | P4 — realized as A9's animated DOM sequence |
| D29 | Scripts carry timing stamps, revisable in reverse | ✅ | P4 · arch §10. L10 changes which source is *primary*; the structural rules (ids, separate timing block, cues→ids) all still bind |
| D30 | Scripts generalized; visuals carry the numbers | ✅ | P4 |

## Monetization

| ID | Decision | Status | Where |
|---|---|---|---|
| D31 | No ads, no paywalls | ⬜ | Nothing to build. Reinforced by L16 — kibble gates nothing |
| D32 | Seven-day trial popup appears in first session | ✅ | P3 onboarding, after buddy creation |
| D33 | Marketplace is a greyed-out, non-interactive tab | ✅ | P0b — regression from v2's working screens |

## Navigation

| ID | Decision | Status | Where |
|---|---|---|---|
| D34 | Bottom nav, five tabs, in order | ✅ | P0e — five tabs, D34's order, honoured literally. Home is a **top-left icon**, not a sixth tab (L5). Label text stays short ("Learn"/"Market") for 63px fit |
| D35 | No push notifications or alerts | ⬜ | Nothing to build |

## Visual direction

| ID | Decision | Status | Where |
|---|---|---|---|
| D36 | Finch-like: soft pastels, cozy, rounded | ✅ | **Phase 2.5** (L19). L2 deferred it; this audit found it unscheduled and L19 placed it — after the budget screens settle, before the daily loop is authored |

## Inheritance from v2

| ID | Decision | Status | Where |
|---|---|---|---|
| D37 | Where the spec is silent, v2 governs | ✅ | Applied throughout; L14 resolves the ~18 unmentioned screens |
| D38 | v2's lesson pipeline inherited and extended, not rebuilt | ✅ | P5 — player untouched; framing questions + variant matching added on top |

---

## Assumptions

| ID | Assumption | Status | Where |
|---|---|---|---|
| A1 | Stack: React + Vite + Tailwind | 🔄 | **L1** — vanilla JS, no build step |
| A2 | Fixed taxonomy of 12 categories | ✅ | P0d · arch §4. The load-bearing join key |
| A3 | My Progress contents, in order | ✅ | P5 — all six sections |
| A4 | Persona: 34, household 2, $68k, ZIP 90066 | ✅ | P0c — `PERSONA` |
| A5 | Seeded observations attach to these specifics | ✅ | P0c. Note L11 reframes #1 to the plan comparison |
| A6 | Three lessons, first-time tier only | ✅ | P5 |
| A7 | Home shows four daily tasks, precomputed order | ✅ | P3. Scoring engine specified, not run |
| A8 | Onboarding collects, in order | ✅ | P3. Step 7 expanded to five attributes (L18) |
| A9 | Daily update is an animated sequence, not a video file | ✅ | P4 |
| A10 | Three engagement variants recorded | ✅ | P4 — all selectable |
| A11 | Share flow copies to clipboard, shows preview | ✅ | P4 — anonymization preview built properly; it's the trust mechanic |
| A12 | Peer benchmarks cover CA, AR, NY, VA only | ✅ | P0d — 151 prefixes, `moderate` fallback |
| A13 | Copy tone: warm, plain, second person, sentence case | ✅ | Standing rule (arch §12) + P6 sweep |

---

## Deferred by the spec — specified, not built

Listed so nobody "discovers" them as gaps later. All ⏸.

- Plaid-like account connection
- Weekly / monthly / quarterly / annual video scripts
- Push notification cadence for holidays and budgets
- Special event and holiday budgets
- Community charity donation loop and weekly kibble reset
- Profile deletion and prorated refund flows
- Ad placement for the free tier
- Affiliate marketplace

Plus, from the feature docs: gift-giving budgets with per-recipient peer norms ·
lesson practice and refresh tiers (A6 keeps first-time only) · the three
unwritten daily-script variants (A10).

---

## Open items this audit surfaced

**1. D36 had no phase.** → **CLOSED (L19): Phase 2.5.**

This is the find that justified the audit. Every other decision landed
somewhere; the Finch-like repaint was deferred by L2 to "a later dedicated pass"
that was never scheduled into Phases 0–6 — and unscheduled work doesn't happen.
D36 is the whole visual thesis (*an app about money deliberately not trying to
look like a bank*), so testers would have reacted to v2's blue fintech palette.

Now scheduled between Phases 2 and 3: late enough that the taxonomy and budget
screens have settled (respecting L2's churn concern), early enough that the
buddy stage, login scene, and daily update get authored **once** in the final
palette instead of built blue and converted.

**2. `persona.connectedAccounts` had no consumer.** → **CLOSED.** It carries
`selfReportedBalance: 1840` with a `_note` saying it exists "so account screens
have something to show" — but the only screens that would read it are v2's
`accountBalances` / `debtBalances`, which L14 moves off the main paths.

`q_balance` ("roughly what's in your checking account?") asks for exactly this
figure, so 1840 is now wired as its **pre-fill** in Phase 1. The orphan becomes
the starting value for the event-based goal update.

**3. No decision covers what happens after the tester finishes.** Not a spec
gap — genuinely unspecified. The loop ends at `done → streak → home`, which is
correct. Noting it only so it isn't mistaken for an omission on a later pass.

---

## Audit verdict

**53 of 53 items have a home.** No empty cells.

- 44 covered in a named phase
- 6 overridden by a locked decision (D04, D10, D39, D40, A1, and D34 with Home
  relocated off the tab bar)
- 2 nothing-to-build (D31, D35)
- 1 scheduled by this audit (D36 → Phase 2.5, L19)

Both open items this audit raised are closed. Re-run when scope shifts.
