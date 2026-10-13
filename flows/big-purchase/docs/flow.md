# Big Purchase Flow

This standalone package starts with ZIP, annual income and daily driving. Income
and driving choices remain docked and advance on a tap. Skip uses the existing
default profile for unanswered values; supplied answers win. Back from the landing
returns to the last setup question with its answers intact. Bundled Emergency
Savings Fund screens use these answers and fallback assumptions, without asking
the standalone fund's six setup questions.

The package was exported from app revision
`8f7b142cd3c065d1dc1b324d741ab9c9a5f8b440`, before the app's flag cleanup.
Its calculations, data and media are owned by this package. Editing it proposes
behavior; it does not change the full app or approve the proposal.

## Actual routes and controls

| Screen ID | Participant entry and behavior |
|---|---|
| `onboarding` | ZIP → income → driving; Back/Skip; three questions only. |
| `bpLanding` | Vehicle category; other categories disabled; emergency-fund question. |
| `bpFinder` | Make/model/new-or-used form; Help me choose quiz; suggested cars, price ranges, alternatives, cost breakdown and Buddy overlays. These are views of the same screen. |
| `bpYourCar` | Continue from the chosen car; loan/cash/lease, financing controls, savings/date controls, change-car sheet, purchase save and deferred fund action. Lease is unavailable for used cars. |
| `bpSetup`, `bpQuiz` | Retained source vehicle-input and earlier quiz screens. Their handlers require an initialized purchase session. |
| `bpCost`, `bpOptions`, `bpFinance`, `bpCommit` | Retained source cost/compare/finance/planning screens. Access requires complete vehicle setup. The current finder continues directly to `bpYourCar`. |
| `esfBuild` | Bundled expenses, estimates, disclosures and fund Buddy; first-step Back returns to the recorded caller. |
| `helpMeOut` | Expense help only when an ESF help session exists; accept or cancel returns to its expense caller. |
| `esfPlan` | Coverage, buffer, existing balance and target date; save immediately replaces the budget and opens constrained Goals. |
| `goals` | Purchase/fund goals, relevant fund review, Back to your car after a fund detour, purchase entry and coherent reminder actions. |

The recorded source has a known-car make/model path and new/used selection. It has
no distinct already-owned-car calculator journey. The Flow preserves the existing
paths without adding a new ownership feature.

## Emergency-fund callers

**Before purchase:** Start mine first on `bpLanding` records caller `bpLanding`
and resume destination `bpFinder`. Back from the first expense step returns to the
landing. Save, or I already have one, opens Goals; Back to your car opens the finder
using the same purchase session.

**After purchase save:** Ask me later on the landing enables Save and start
emergency fund on the actual `bpYourCar` planning screen. This first saves the car,
then records `bpYourCar` as both caller and resume destination. First expense Back
returns to that car; after fund completion, Goals' Back to your car also returns
there. Car, price, financing, saved amount, date, custom costs and finder choices
survive. The retained `bpCommit` screen records its own caller in the same way.

Choosing No for purchase savings still saves the plan with no purchase goal when
starting the fund. Repeat purchase saves replace the previous purchase goal and
never write the budget. Fund saves retain their approved immediate budget
replacement and one-fund-goal behavior, including repeat saves. Reminder Add it
records intent and confirms within Goals; it does not open general Budget or write
its figures. Not yet and decline remain coherent within Goals.

## Containment and lifecycle

`flow.json` is authoritative; `flow-config.js` is generated from it. Runtime guards
check destination and required state before navigation/history writes and again
at render dispatch. Admin jumps and unrelated tabs are absent. Cold/deep links,
including allowed-looking mid-session links, start fresh setup. Unsupported routes
cannot render. An old document's history cannot restore feature state into a fresh
document.

Refresh and Restart start this Flow fresh, dropping entered values, saved plans,
Buddy/help state, transient media and visit trail. Profile/participant parameters
survive URL changes and Restart; a launch profile applies once per document.
Exit returns to the selector. Local telemetry remains off, regardless of query
parameters. The four theme controls are available within the Flow.

Proposed package differences are containment, fresh Flow lifecycle, constrained
Goals and explicit before/after fund caller tracking. The deferred fund action is
also surfaced on the current car screen, where ordinary participants plan their
purchase. The inherited ZIP keypad recursion is fixed with one reentrant-safe
commit. No new category, onboarding question or financial calculation is added.

Runtime checks live in `tests/flows-runtime.cjs`; browser evidence and platform
limitations are recorded separately in the project handoff/PR. Linux browser
automation does not imply Windows/WSL or macOS acceptance.
