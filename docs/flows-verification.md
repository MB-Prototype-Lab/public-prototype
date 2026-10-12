# Flow verification record

Implementation and PM review are separate gates. This record names checks to run;
an unchecked item is not evidence of success. Source baseline:
`8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`.

## Automated implementation checks

Baseline full app: syntax (123 files), path checks, release-runtime, local-variants
and sweep passed before implementation. Sweep: 253 checks, zero failures, two
existing owner/browser warnings. Final combined results remain pending.

Required final evidence: foundation negative tests; both Flow runtime journeys and
route bypass attempts; legacy/new publication tests; complete docs/testing.md
commands; two offline committed publication rehearsals with a previous manifest;
package size measurement; baseline app inventory comparison restricted to explicit
flag cleanup. Record actual command results and commit here after integration.

## PM review checklist

Use the root selector, passcode 1337, then Full app or a named Flow. Direct Flow
links intentionally bypass the passcode. Both Flows restart themselves on refresh;
Full app refresh returns to the selector. Restart starts a fresh session; Exit
returns to the selector.

- Emergency fund: answer ZIP, income, household, home type, coverage and driving;
  check expense help/Buddy, buffer, coverage, balance and date; save, reopen and
  save again. Exactly one emergency goal should remain, with the edited figures.
  From the first expense step, Back returns to setup; test answers and Skip too.
- Big Purchase: answer ZIP, income and driving, including docked controls; Back
  from the landing returns to the previous setup question with answers intact.
  Try finder, vehicle selection, quiz/help, owned car, cost comparison, finance,
  lease and plan save. Save twice and check there is at most one purchase goal.
- Big Purchase fund branches: Start One Now before the purchase, save the fund,
  use Back to your car and confirm the purchase inputs survive. Separately use
  Ask me later, complete/save the purchase and start the fund afterward; test
  Back at the first expense step and after saving. No extra setup questions.
- On both Flows, check constrained Goals and absence of general product tabs,
  settings, arbitrary jumps and unrelated goals. Unsupported purchase categories
  stay disabled. Test Back at the beginning, refresh, Restart and Exit.
- Check narrow layout, all four themes, keyboard focus, typed inputs, sliders,
  selected help/media and participant study parameters on HTTP links. Local
  tracking stays off regardless of URL parameters.
- Full app regression: full setup and Buddy creation end at Home; all five tabs
  remain; Goals still opens both tools; purchase save does not change budget,
  ESF save immediately replaces it, including repeat saves.
- Local selector: passcode, Full app, Flows and existing alternatives; side-by-side
  comparisons retain their previous behavior.

## Platform status

Windows/WSL file URLs with spaces: not yet verified.
macOS file URLs with spaces: not yet verified.
Local HTTP publication rehearsal browser behavior: not yet verified.
PM visual/product acceptance: not yet verified.
Linux automated browser results, when available, will be recorded separately and
will not stand in for Windows/WSL or macOS checks.
