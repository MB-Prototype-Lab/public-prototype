# Working with Flows

`app/` is the approved full product. `flows/<id>/` holds independently editable,
contained proposals for PM iteration, ticket references and studies. Merging a Flow
makes it available to the team; product approval and integration into `app/` are
separate work. Publication is also separate.

## Preview and review

Open root `index.html`, enter `1337`, and choose **Local Prototype** on the **Prototype**
tab or a Flow on the **Flows** tab. The selector remembers the tab for the browser
session, so **Exit Flow** returns to the Flows list.
A Flow also opens directly at `flows/<id>/index.html`, without the passcode. Each
launch is a separate document and session; no server or dependency installation is
needed. Ask the agent for a browser file URL with the checkout path properly encoded
(including Windows/WSL paths and spaces). The selector passcode is a convenience,
not a security boundary. To iterate on one Flow with several variants, ask for a
local comparison of that Flow: its variants appear below the Flows list and can be
compared side by side (see [local comparisons](local-variants.md)). Keeping one
updates that Flow only; integration into `app/` stays separate work.

Refresh returns to the selector, exactly as in Local Prototype. **Pin on refresh**,
the first control in Tools, keeps a refresh in place instead: the same Flow begins
again at its canonical entry with fresh in-memory state. There is one pin per browser
tab, shared with Local Prototype and the comparison workspace, and a new tab starts
unpinned. **Restart Flow** always restarts in place, pinned or not. **Exit Flow**
returns to the selector and leaves the pin as it is. Participant parameters survive
navigation and restart; a recorded screen or trail does not recreate a previous session. Local tracking stays off.
A participant URL cannot enable tracking or unlock excluded screens.

Reviewer controls live outside the phone in the initially collapsed **Tools**
panel, including in snapshots. Open the **›** button (accessible name **Tools**) for Pin on refresh, Restart Flow, Exit Flow, themes,
Copy State and controls for the current initialized screen. The page around the
phone matches Local Prototype exactly: the panel sits alongside the phone on desktop
and below it at 769–900px, and phone-width windows (768px and below) offer no Tools.
The button appears only while collapsed; **‹** (Close Tools) restores it and returns focus to it. Setup steps stay within each Flow's policy, and
no unrestricted product screen picker is available. The phone retains the source
participant headers, footers and contextual Back controls.

The initial experiences are `emergency-fund` and `big-purchase`. Emergency Fund
includes setup, expense help, planning, repeat saving and constrained Goals. Big
Purchase includes its vehicle journey and its own bundled emergency-fund detours;
it does not open or depend on the standalone Emergency Fund Flow.

## Create a committed baseline

Use [start-work](../.claude/skills/start-work/SKILL.md) and the shared
[workflow](workflow.md). Record the intended Flow before editing.
Choose a full committed app revision, preserving unrelated dirty work. If intended
app changes are uncommitted, selectively checkpoint them first; creation exports
committed bytes only and never silently copies dirty or untracked app files.

```sh
python3 scripts/flows.py create --id my-flow --source FULL_APP_SHA --label 'My Flow' --purpose 'The experience to review.'
```

IDs are lowercase kebab-case, at most 64 characters. The command refuses collisions,
links and unsafe paths, exports only static app files into a temporary sibling,
validates the completed package, installs it, and updates discovery. It never writes
`app/`. A failure must preserve existing discovery; fix the reported source or path
problem and retry with an unused ID. Do not overwrite a package to recover.

The generated package is a contained **onboarding-only authoring starter**, not a
finished participant journey. Configure its setup, feature initialization, precise
allowlist, transitions and prerequisites before participant use (below). Retaining
unused copied code/assets is allowed; participant reachability is constrained
independently. There is no automatic JavaScript dependency slicer.

## Configure the journey

A PM request to narrow, shorten, reorder or start the prototype elsewhere becomes
this configuration inside the package, never a switch in `app/` (see
[one product](app-contracts.md#one-product-no-journey-switches)). The
[create-flow](../.claude/skills/create-flow/SKILL.md) skill routes such requests here.
`flows/emergency-fund` (setup, then one feature) and `flows/big-purchase` (shortened
setup, then a feature with detours) are the references;
[Edit and check](#edit-and-check) lists the runtime invariants.

1. **Policy (`flow.json`).** Set `entry` and `completion`, the exact
   `allowed_screens` (screen IDs declared in `js/state.js`), and `setup_steps` as an
   ordered subset of the source `ONB_STEPS` (`[]` for no setup). Describe
   `profile_behavior` and PM-readable `proposed_differences`, then run
   `python3 scripts/flows.py catalog`. Never hand-edit generated files.
2. **Containment (`js/flow.js`).** Replace the generic starter runtime.
   `mbFlowAllowed(screen)` checks the allowlist, then each screen's prerequisites
   (setup complete, feature state present). `mbFlowSeed()` sets the canonical entry
   on a single stack. `mbFlowInstall()` resets unrelated state, applies a URL profile
   once, and guards `renderScreen`, `render`, `go`, `navCommit` and `navBack`, tab and
   admin jumps (`navGoTab`, `navAdminJump`), restored snapshots and cold or deep links
   (`screenLinkApply` returns the entry) before any stack write; `renderNav` returns
   nothing when product tabs are out of scope. Give Back at the entry and at the
   completion screen a defined result inside the Flow. Keep the starter's Restart
   (`refreshPinRestart()`) and Exit.
3. **Setup hand-off (the package's `screens/onboarding.js`).** Read `ONB_STEPS` from
   `window.MB_FLOW.setup_steps`. Have `onbFinish()` set `state.mbFlowSetupComplete`
   and call the feature's existing start function (Emergency fund: `esfStart()`; Big
   purchase: `bpStart("vehicle")`, then its landing). Have Skip apply the default
   profile and finish setup. Docked tap-to-advance setup now exists only in
   `flows/big-purchase` (`onbDocked()` in its `screens/onboarding.js`); `app/` keeps
   Continue on every step.
4. **Unreachable surfaces.** In the package's copies, remove or replace product
   controls the Flow does not offer (topbar Home and Menu, unrelated Goals entries,
   queues) instead of leaving buttons that lead nowhere.
5. **Reviewer Tools (`js/flow-tools.js`).** Add a case per allowed screen to
   `mbFlowRenderAdmin()` behind the same prerequisites, and route fixture buttons
   through `mbFlowAdminAction()`. Reading or toggling Tools never initializes a
   feature or changes answers.
6. **Notes and tests.** Write the package's `docs/flow.md`: reachable screens and
   prerequisites, setup, Back/Restart/Exit, proposed differences and checks. Add
   journey tests to `tests/flows-runtime.cjs` with its `bootFlow('<id>')` helper:
   entry, setup completion, prerequisites, forbidden screens and cold links.

Common requests: “only show X” is a narrow allowlist with product tabs hidden;
“start at X” seeds through X's start function with the default profile and empty
`setup_steps`; “shorter setup” is a smaller `setup_steps`. None of them changes
`app/js/config.js` or adds any other switch to `app/`.

## Edit and check

Work only in the selected package and explicitly scoped tooling/docs. Each package
owns all runtime code, data, styles and assets; copy required assets rather than
importing from `app/`, another Flow or mutable shared directories.

`flow.json` is authoritative for provenance and policy: stable ID, label/purpose,
optional reference, original `source_app_commit`, `task_base`, entry/completion,
allowed screens, ordered setup steps, profile behavior and proposed differences.
Keep original source provenance when iterating; document later proposals separately.
`task_base` is the HEAD the package was created on: provenance only, never a scope base.
`flow-config.js` is generated policy and `flows/catalog.*` is local discovery,
including newly created uncommitted packages. Neither is publication identity or
product signoff. In a merge conflict, resolve `flow.json`, then run
`python3 scripts/flows.py catalog`.

```sh
python3 scripts/flows.py catalog
python3 scripts/flows.py check --id my-flow
python3 scripts/flows.py check
python3 scripts/flows.py scope --scope flow
bash scripts/check-syntax.sh flows
node tests/flows-selector.cjs
node tests/flows-runtime.cjs
```

Regenerate after metadata changes; do not hand-edit wrappers. The scope check
compares committed, staged, unstaged and untracked app changes with the merge base of
`origin/main` (`main` without a remote) and HEAD, and prints that base, so app changes
merged in from main pass; no base is recorded by hand. If the branch merged a
different main, such as a local main ahead of `origin/main`, name it with
`--against REF`; never revert main's work to pass. Ordinary Flow tasks must leave app
bytes unchanged. All packages receive metadata, entry, syntax and boundary checks;
run affected behavior tests plus the complete commands in [testing](testing.md)
before shipping.

Runtime policy must exist before setup/navigation seed. In `index.html`,
`release-config.js` and `flow-config.js` load before `js/config.js`, with
`js/refresh-pin.js` between `release-config.js` and `js/config.js`, and `js/flow.js`
loads before `js/navigation.js`; `flows.py check` enforces this. `js/refresh-pin.js`
decides whether a refresh returns to the selector or restarts the Flow in place. A
URL `profile` parameter is applied once at boot, on file URLs too, and never again
during navigation. Guard navigation, tab/admin jumps, restored history and final
rendering; reject forbidden destinations before stack writes. Allowed screens also
need valid feature state: start through the existing feature initializer, or restart
an unsupported cold link safely. Back at the entry stays within the Flow. Retained
disabled controls must have no effects. Keep screen slugs and control identifiers
useful for studies.

The static dependency checker covers literal HTML/CSS paths and app conventions for
JavaScript/data asset strings, including dynamic directory prefixes. It rejects
symlinks, traversal and cross-package dependencies; the explicit selector exit is
a navigation exception. It does not evaluate arbitrary JavaScript or prove every
dynamic suffix exists. Source onboarding narration under `assets/audio/onboarding/`
is an explicit optional generated-asset exception: its existing speech/silence
fallback remains. Verify selected images, audio, films and generated URLs at runtime.

## Integrate a chosen proposal into the product

1. Record PM's chosen behavior and reviewed Flow revision. Start an app-integration
   task from current main; preserve the Flow as the reference and retain provenance.
2. Review the Flow/app diff and selectively implement the chosen changes in `app/`.
   Port the chosen behavior, never a Flow's containment as a switch in `app/`.
   Do not bulk-copy or merge the whole Flow directory into the product. Keep full
   onboarding, product tabs and established BP/ESF budget/save behavior unless the
   PM explicitly approves changing them.
3. Run affected full-app and Flow regression checks. Declare the scope explicitly:

   ```sh
   python3 scripts/flows.py scope --scope app-integration
   ```

   This scope permits app changes; it is not product signoff or a substitute for
   reviewing every changed file.
4. PM verifies the **integrated full-app experience before the PR is opened**.
   Record the checked commit, results and limitations; repeat affected checks after
   material changes. Then follow [ship](../.claude/skills/ship/SKILL.md).

Routine PM Flow work does not require subagents. Remote actions follow the
authorization boundary in [CLAUDE.md](../CLAUDE.md); report each outcome separately.

## Publish a specific revision

Select a tested committed package on verified current main, a new permanent snapshot
ID, label and tracking choice. Preparation can be rehearsed locally:

```sh
python3 scripts/publish.py prepare --flow my-flow --id my-flow-study-01 --commit FULL_MAIN_SHA --label 'My Flow study' --tracking on
```

This prints a proposed catalog row; it does not publish or create tags. The
`flow-static-v1` format uses `source_dir=flows/my-flow` and the stable hosted path
`versions/my-flow-study-01/index.html`. The working Flow ID identifies the experience;
the snapshot ID identifies one immutable revision. Full-app preparation omits
`--flow` and excludes Flows. Follow [publishing](publishing.md) for catalog review,
source tags, previous-manifest checks, artifact size and explicit deployment.
Published tracking and selector destination are frozen. Archive/hidden/retired rules
and study protections apply equally; retiring a Flow covers every packaged HTML entry.
