'use strict';
// How the journey state check reads state across a cleanup. Entries are
// reviewed like code, and a PR that adds one names it in its text.
//   {key: 'currentName', as: 'nameInSnapshots'}  a state key renamed by a
//     cleanup, given one name on both sides so the rename does not read as a
//     change in what the app remembers.
//   {removed: 'a.b.c', why: '<one line>'}  a field the app never reads, deleted
//     by a cleanup: left out of the state digest and deltas on both sides. A dot
//     path from the state root; `*` matches any key or index at that level. The
//     commit that deletes the field adds its entry.
module.exports = [];
