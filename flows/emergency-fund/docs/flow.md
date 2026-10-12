# Emergency fund experience

The package starts from committed app revision recorded in `flow.json`. Its policy
loads before app configuration and onboarding; its containment hooks install after
app seeding and before the first render. Copied unrelated static files remain to
avoid breaking implicit source dependencies. Their screens cannot render through
this package's navigation or rendering boundary. This is prototype containment,
not protection against someone modifying browser globals.

Reachable screens are onboarding, esfBuild, helpMeOut, esfPlan and constrained
goals. Ask Buddy is an overlay on expense capture and planning. Help-me-out is
permitted only with an active fund and an ESF-targeted help session. Planning
requires an active fund; Goals requires completed or skipped setup. There are no
product tabs, settings, arbitrary admin jumps, purchase cards or other goal
creation/removal controls. The toolbar provides Back, Restart, Exit and the four
themes. The existing calculations, help models, Buddy tree, normal esfStart,
esfReopen and esfCommit remain package-local copies of the source behavior.

Setup asks ZIP, income, household, home type, health coverage and driving. Skip
immediately finishes setup using the source default profile for unanswered fields;
answered fields win. A valid `profile` query is applied once at document boot on
both file and HTTP URLs. Navigation never reapplies it. Back from the first
expense screen restores completed setup answers at ZIP; completing setup again
starts a fresh expense session. This is the deliberate proposed difference from
the old flag's reset-and-discard behavior. The first setup Back keeps the source
behavior of clearing ZIP while remaining on that step.

Saving immediately applies the source budget baseline and replaces the emergency
goal; repeat saves retain exactly one emergency goal. Goals reopens the session
with its inputs intact. “I already have one” reaches constrained Goals without
saving a goal or replacing the budget and offers the fund planner there.

Cold links, reloads and Restart always begin fresh setup. Restart performs a fresh
document load, preserving participant query parameters and the launch profile,
while removing the screen parameter and a value-trail fragment. Exit uses the
release selector destination. Local tracking remains off; publication freezes
tracking and exit destination. Participant query parameters cannot enable tracking.
The copied keypad also fixes an inherited reentrant ZIP change-event commit
that could recurse on desktop input; a commit dispatches change once.
Browser history restores only same-document snapshots with valid prerequisites;
foreign or forbidden snapshots return safely to setup. Browser Back may leave the
document normally.

Run `python3 scripts/flows.py check --id emergency-fund` and
`node tests/flows-runtime.cjs` from the repository root. The runtime suite loads
actual scripts in index order and exercises setup/skip/back, help/Buddy, controls,
save/repeat/reopen, source budget effects, route/deep-link/history/render guards,
themes, file/HTTP profiles and restart. Its DOM is simulated; native layouts,
keyboard/pointer behavior, media and platform-specific file opening need browser
review. This package is an editable proposal, not product approval or publication.
