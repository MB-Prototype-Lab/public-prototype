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
];
