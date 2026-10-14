'use strict';
const { tap, check, call } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

// The calculator's earlier four-step screens are still routed and reachable
// from the Tools jump list; a tester can be sent to them for review.
module.exports = {
  id: 'bp-legacy-steps',
  title: 'Big purchase step screens from Tools: setup, quiz, costs, ways to spend less, finance, commit',
  steps: skipToProfile().concat([
    call('navAdminJump', 'bpSetup'),
    tap('Car'),
    call('navAdminJump', 'bpQuiz'),
    tap('Mostly just me'),
    call('navAdminJump', 'bpCost'),
    tap('Yes, car loan'),
    tap('No, paying cash'),
    tap('Not interested'),
    tap('Continue'),
    call('navAdminJump', 'bpOptions'),
    tap(/^Used Saves over 5 years/),
    tap('Keep my pick'),
    call('navAdminJump', 'bpFinance'),
    tap({ name: 'Cash', nth: 0 }),
    tap({ name: 'Loan', nth: 0 }),
    call('navAdminJump', 'bpCommit'),
    tap('A month later'),
    tap('A month earlier'),
    check('Remind me to budget for this when I reach my goal', true),
    tap('Set my goal'),
  ]),
};
