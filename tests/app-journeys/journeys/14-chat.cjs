'use strict';
const { tap, type, expect } = require('../dsl.cjs');
const { skipToProfile } = require('../common.cjs');

module.exports = {
  id: 'chat',
  title: 'Chat with Buddy: every opening bubble, a follow-up action, typed questions including one asking for advice',
  browser: true,
  steps: skipToProfile().concat([
    tap('Chat with Buddy'),
    expect({ screen: 'chat' }),
    tap('What are peers?'),
    tap('How accurate is that?'),
    type('Or type a question...', 'should I cancel netflix'),
    tap('Send'),
    type('Or type a question...', 'why is dining out flagged'),
    tap('Send'),
    tap('Show me the comparison →'),
    tap({ name: 'Back', nth: 0 }),
    tap({ name: 'Back', nth: 0 }),
    expect({ screen: 'home' }),
  ]),
};
