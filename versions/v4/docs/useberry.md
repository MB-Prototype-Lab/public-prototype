# Running a Useberry study against v4

Operator's guide. The reasoning behind the design is in `versions/v4/CLAUDE.md`
under "v4's own divergences"; this is what to actually do.

## 1. Turn tracking on

Two flags, both set by hand, both committed. **They are currently ON.**

```js
// versions/v4/js/config.js
const USEBERRY_TRACKING = true;

// gate/gate.js — the same version's row in VERSIONS[]
{ id: "v4", label: "v4 (current)", path: "versions/v4/index.html", tracking: true }
```

v4 only: `js/useberry.js` does not exist in v3 or v3.1, so those two cannot be
tracked whatever their gate row says.

The gate cannot read the first one — it never loads a version's scripts, because
two versions' globals in one document would collide — so it keeps its own copy
and shows a **recording** badge next to any version that has it. `sweep.sh`
fails if the two disagree, so you cannot observe a build the gate says is clean.

Turn both back to `false` when the round is over. `sweep.sh` prints a **warning
on every run** while they are on — it used to fail, but a build that cannot go
green during a study is a check people learn to ignore, so it is loud rather
than blocking. A *mismatch* between the two flags still fails.

## 2. Point Useberry at it

Use the **Snippet** import, not the proxy. Useberry's own docs say the proxy
blocks resources carrying an `integrity` attribute, disrupts CSP/CORS-dependent
apps, and that trigger elements should be set up with the snippet when the proxy
will not show them. This prototype is ~100 scripts deep; the proxy is the
fragile route.

Nothing to paste into their UI — `js/useberry.js` already injects their tag when
the flag is on.

**Start URL:** point tasks at `versions/v4/index.html`, not the repo root. The
root is the passcode gate, and a tester who has to get past `1337` before the
study starts is a drop-off you created.

## 3. Task completion

Their Single Task block takes **Path**, **URL** or **Trigger**. Use **URL** —
every screen now has its own, and it is the only one of the three that does not
depend on an element surviving a re-render.

| task | success URL contains |
|---|---|
| Finish setup | `?screen=home` |
| Build a budget | `?screen=budget-done` |
| Log yesterday's spending | `?screen=journal-done` |
| Finish a lesson | `?screen=lesson-reward` |

Read the slug off the address bar while clicking through — what you see is what
Useberry records.

## 4. Start URLs, for per-task entry

Without these every task replays onboarding before reaching the thing it is
about.

```
?screen=home                Home
?screen=onboarding          Onboarding from the top
?screen=onboarding-3        Onboarding at a given step (0–6)
?screen=budget-build        The three-step budget builder
?screen=about-me            Budget tab
?screen=comparison          Where it's going
?screen=my-progress         My Progress
?screen=journal-entry       A fresh Money Journal session
?screen=learn  ?screen=goals  ?screen=chat  ?screen=settings
```

Add `?profile=` to start the tester as a specific household. Nine combinations —
`above` / `at` / `below` cost-of-living × `under` / `at` / `over` that area's
median income:

```
?profile=above_at&screen=budget-build     Santa Clara CA, $164k, at the builder
?profile=below_under&screen=budget-build  Little Rock AR, $45k, same screen
```

**Not linkable on purpose:** `budgetCategory`, `lesson`, `helpMeOut`,
`marketplaceDetail`. Each needs something chosen earlier, so a cold link lands
on the "nothing to show yet" placeholder — correct for an admin jump, reads as
broken to a tester sent there deliberately. An unrecognised slug quietly starts
at the beginning instead.

## 5. Recruiting

Responses through the participant pool (Prolific) **do not** count against the
plan's response limit — only "Share link" ones do, and the Free plan allows 10
of those a month. So the recruitment route decides your quota; how the site is
imported cannot affect it.

Useberry passes participant ids as URL parameters (`PROLIFIC_PID`). The app
preserves query parameters it does not own on every rewrite, and `sweep.sh §7d`
asserts it — if that ever regresses, ids vanish mid-study with nothing to
signal it.

## 6. Reading the click data

Every control carries a `data-ub` attribute, derived from the handler already on
it and stamped on each render. Nothing was hand-named, so nothing goes stale:
rename `bbToggleHelp` and the reports rename themselves.

```
budget-build-1/bbToggleHelp:Utilities     the Help-me-out toggle on step 2
budget-build-1/bbSet:Groceries            the Groceries slider on step 2
topbar/navBack                            Back, anywhere
nav/navGoTab:learn                        the Learn tab
onboarding-3/householdSize=2              "2 people" on onboarding step 4
```

The prefix is the screen, so the same Continue button on step 1 and step 2 are
two different names — which is what a flow report needs. The top bar and nav use
their own prefixes, because they are the same controls everywhere and prefixing
them per screen would scatter one button across forty names.

**For a Trigger task-completion criterion**, pick the element in Useberry's UI as
usual; `data-ub` is what makes the selector it stores survive a re-render, and
this app rebuilds the whole screen on every state change.

To override a name, put `data-ub="whatever"` on the element yourself — a
hand-placed name is never overwritten. Use it sparingly; it is the one that can
go stale.

## 7. Reading the value trail

At three points — **budget saved**, **setup finished**, **journal submitted** —
the figures a tester set are encoded into the URL **fragment** of the screen they
land on:

```
?screen=budget-done#v=budget.hou-2100.sub-85.tra-420.traH-385.uti-180.gro-615
```

- `hou-2100` — Housing, the figure **they** set
- `traH-385` — Transport, the figure **Help me out** computed. Separate keys on
  purpose: guessed-versus-computed is the most interesting comparison in the
  trail, and one overwriting the other would destroy it.
- `jgro-64` — from a journal checkpoint: Groceries logged, summed for the session

Keys are the first three letters of the category. A drag records where it came
to **rest**, not every tick.

**Why the fragment.** `?screen=` has to stay identical across testers or the flow
report cannot aggregate, and it is what a URL task-completion criterion matches
on. The fragment is carried in the href Useberry records and ignored by URL
matchers, so `?screen=budget-done` still matches with a trail attached.

**Only on a checkpoint view.** Cleared on the next screen, so exactly one URL per
session carries it.

**⚠ Free text can never reach it.** `ubTrailRecord()` takes numbers, and takes a
string only under a key declared in `UB_TRAIL_ENUMS`. The tester's name, journal
prose and the buddy's name are not recorded and must not be added — the trail
travels in a URL a third party logs, and Useberry's own policy is that testers
stay pseudonymous. `sweep.sh §7e` fails if that guard is removed.

During a moderated run, the admin panel's footer shows the trail filling live.

## 8. What you get, and what you do not

**Do get:** one screen per view in the flow report, including each wizard step;
drop-off per screen; click heatmaps segmented per screen; URL-based task
completion; a readable `<title>` on every screen; a `data-ub` name on every
control; and the figures a tester set, at three checkpoints.

**Do not get, on the Free plan:** session recordings. Recording storage starts
at Growth. Since the app re-renders every screen as fresh HTML with real
`value=` attributes, a recording would capture every figure a tester sets — the
values are in the DOM, not just in JS. That is the upgrade worth making if you
need to know what people typed.

**Not built, deliberately:** custom events. Their tracker exposes
`useberryLive = {}` — an empty object with no methods. The only channel is an
internal postMessage protocol between their script and their player; imitating
it would be unversioned and would fail silently mid-round. The value trail in
§7 is how values get out instead.

## 9. Before you launch

```bash
bash scripts/sweep.sh          # must be 0 failed, and it checks both flags
```

Then click the gate yourself and confirm the **recording** badge is on v4 and
nowhere else.
