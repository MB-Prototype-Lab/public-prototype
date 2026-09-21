# Running a study against a published snapshot

Read repository-root docs/publishing.md for release preparation. Development is
untracked. Choose tracking on when preparing a new snapshot; the packager records
and freezes that choice in release-config.js. The catalog drives the selector badge.
Never toggle tracking in a published build. To change tracking publish a new ID.
Legacy v4 keeps its original tracking on; this does not establish ongoing-study status.

## 2. Point Useberry at it

Use the **Snippet** import, not the proxy. Useberry's own docs say the proxy
blocks resources carrying an `integrity` attribute, disrupts CSP/CORS-dependent
apps, and that trigger elements should be set up with the snippet when the proxy
will not show them. This prototype is ~100 scripts deep; the proxy is the
fragile route.

Nothing to paste into their UI — `js/useberry.js` already injects their tag when
the flag is on.

**Start URL:** point tasks at `versions/<snapshot-id>/index.html` on the live site, not the repo root. The
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

Confirm current recruitment quotas and service capabilities in the study account.

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

Session recording availability depends on the current service account. Hosted-file
immutability does not guarantee external Useberry behavior.

**Not built, deliberately:** custom events. Their tracker exposes
`useberryLive = {}` — an empty object with no methods. The only channel is an
internal postMessage protocol between their script and their player; imitating
it would be unversioned and would fail silently mid-round. The value trail in
§7 is how values get out instead.

## 9. Before you launch

Run the release checks in docs/testing.md and confirm the snapshot badge and generated
configuration agree. Test the direct URL, deep links, participant-parameter retention,
and task completion on the hosted build. Confirm study status with the PM before
cutover; tracking on alone is not evidence that a study is running.
