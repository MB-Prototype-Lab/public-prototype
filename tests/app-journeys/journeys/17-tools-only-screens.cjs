'use strict';
const { tap, type, slide, call } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

// Inherited screens with no route from the product's own navigation; Tools
// reaches them, and so do testers who are sent there. This is the reviewed
// Tools-only list: the coverage gate does not count the Tools tour, so a screen
// no other journey reaches is added here, with a real tap where it has one.
module.exports = {
  id: 'tools-only-screens',
  title: 'Inherited screens reached from Tools: reactions, next action, goal, finish, debts, analyzer, market, profile questions, spending, streak',
  steps: skipToProfile().concat([
    call('navAdminJump', 'postResult'),
    tap("That's how I feel →"),
    call('navAdminJump', 'nextAction'),
    tap(/^Make a goal/),
    call('navAdminJump', 'commitment'),
    type('e.g. Become debt free', 'Pay off my card'),
    tap('Save Goal'),
    call('navAdminJump', 'finish'),
    tap('See My Progress'),
    call('navAdminJump', 'accountBalances'),
    tap('Save Entry'),
    call('navAdminJump', 'debtBalances'),
    tap('Save Entry'),
    call('navAdminJump', 'myDebts'),
    tap(/^💳 Chase Sapphire/),
    tap('📊 Analyzer'),
    tap({ name: 'Included ✓', nth: 0 }),
    tap('+'),
    call('navAdminJump', 'marketplace'),
    tap({ name: 'View Details', nth: 0 }),
    tap({ name: 'Back', nth: 0 }),
    call('navAdminJump', 'lifestyleWizard'),
    tap('Moderate'),
    call('navAdminJump', 'spendingProfile'),
    slide('Dining out monthly amount', 300),
    tap('Fine-tune'),
    tap('Very into it'),
    tap('Continue'),
    tap({ name: 'Back', nth: 1 }),
    tap({ name: 'Back', nth: 1 }),
    call('navAdminJump', 'budgetCompare'),
    tap({ name: /^Between \$/, nth: 0 }),
    tap('Save budget'),
    call('navAdminJump', 'helpMeOut'),
    tap('Back to Budget'),
    call('navAdminJump', 'lessonReward'),
    tap('Browse lessons'),
    call('navAdminJump', 'streak'),
    tap("Let's go!"),
  ]),
};
