'use strict';
// Prints the locale and time zone the journey harness runs under, with a hash
// of two journeys' records. The self-check runs it under two machine settings:
// both must print en-US, UTC and the same hash. A file, not `node -e`, because
// pinning re-runs the script it was started with.

const { ensurePinnedEnv } = require('../lib/determinism.cjs');
ensurePinnedEnv();

const crypto = require('node:crypto');
const path = require('node:path');
const { REPO } = require('../lib/app-vm.cjs');
const { loadJourneys, expand, runAll } = require('../app-journeys.cjs');

(async () => {
  const results = await runAll(expand(loadJourneys(['onboarding-full', 'esf-have-one'])), path.join(REPO, 'app'));
  const hash = crypto.createHash('sha256');
  let steps = 0;
  for (const r of results) {
    hash.update(r.id + '\0' + r.errors.join('\n') + '\0');
    for (const rec of r.records) { steps++; hash.update(rec.participant + '\0' + rec.tools + '\0' + rec.wiring + '\0'); }
  }
  const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();
  console.log(JSON.stringify({ locale, timeZone, steps, records: hash.digest('hex').slice(0, 16) }));
})().catch(err => { console.error(err && err.stack || err); process.exit(2); });
