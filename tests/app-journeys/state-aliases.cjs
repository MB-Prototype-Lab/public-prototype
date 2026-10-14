'use strict';
// How the journey state check reads state across a cleanup. Entries are
// reviewed like code, and a PR that adds one names it in its text.
//   {key: 'currentName', as: 'nameInSnapshots'}  a state key renamed by a
//     cleanup, given one name on both sides so the rename does not read as a
//     change in what the app remembers.
//   {removed: 'a.b.c', why: '<one line>'}  a field the app never reads, deleted
//     by a cleanup: left out of the state digest and deltas on both sides. A dot
//     path from the state root; `*` matches any key or index at that level, but
//     not at every level. The commit that deletes the field adds its entry: one
//     that still matches a field in the app's state warns in the gate and fails
//     --against and at the head of --series.
module.exports = [
  { removed: 'xpConfig.discountedRate', why: 'the Learn Tools knob wrote it and nothing read it' },
  { removed: 'helpMeOut.target', why: 'always "budget" once the emergency fund hook was deleted' },
  { removed: 'esf.billAmounts', why: 'emergency fund bill overrides: nothing wrote them, and their one reader was deleted' },
  { removed: 'esf.extras', why: 'the emergency fund extra-expense box no screen offers' },
  { removed: 'esf.insuranceOverride', why: 'an emergency fund field nothing wrote or read' },
  { removed: 'esf.declined', why: 'the emergency fund "I don\'t have one" flag nothing sets' },
  { removed: 'esf.owns', why: 'its readers, the irregular-bill gate and the rent-or-own toggle, were deleted' },
  { removed: 'esf.hasCar', why: 'its reader, the irregular-bill gate, was deleted' },
  { removed: 'expenses.declined', why: 'copied from esf.declined, which nothing sets' },
  { removed: 'expenses.extras', why: 'copied from esf.extras, which nothing fills' },
  { removed: 'estimator.target', why: 'always "mtd": no caller asked for the budget mode' },
  { removed: 'lessonProfile.*.variantId', why: 'written when framing finished and never read' },
  { removed: 'onboarding.lwIndex', why: 'the position inside the removed lifestyle step' },
  { removed: 'onboarding.lifestyleAnswered', why: 'only the removed lifestyle step wrote it; onbFinish now resets state.lifestyleAnswered directly' },
  { removed: 'onboarding.lifestyleDetail', why: 'only the removed commute sliders wrote it; onbFinish now resets state.lifestyleDetail directly' },
  { removed: 'lifestyleWizard', why: 'the removed lifestyle wizard\'s session; always null without its screens' },
  { removed: 'onboarding.buddyIndex', why: 'the position inside the removed buddy creator sub-steps; the buddy step is one screen' },
  { removed: 'bp.ui.pick', why: 'the row the removed Big purchase range-picker sheet was open on' },
  { removed: 'bigPurchase.stack5.resale', why: 'Big purchase resale value: excluded from every total and never read' },
  { removed: 'bigPurchase.stack5.valueLost', why: 'Big purchase depreciation: excluded from every total and never read' },
  { removed: 'bigPurchase.stack5.balanceAtSale', why: 'the loan balance left at five years, read only by the removed resale arithmetic' },
];
