// ─── Starting profiles ───────────────────────────────────────────────────────
// Three cost-of-living tiers x three income levels, from data/test-profiles.json.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Skipping setup never left the app broken, but it left it SILENT. onbFinish()
// guards every write — `if (o.zip) state.profile.zip = o.zip` — so a skipped
// field falls through to whatever bootV3 seeded, which is the persona: Sam,
// 90066 Los Angeles, $68,000. A tester who skips is testing a profile nobody
// chose and nothing on screen names, and every figure downstream is anchored on
// it. The nine are an explicit answer to "who am I, then".
//
// They are also the headless test matrix. Peer spending across them runs from
// about $2,500 a month to about $12,000, which is a real stress range for
// anything that reads the peer model — and the reason "$10 of transport" was
// only ever found by hand is that there was one profile to find it in.
//
// TEMPORARY. PROFILE_PICKER (js/config.js) takes the screen out of the flow;
// everything here still works because the sweep and the skip fallback use it.

function profileData() {
  return (typeof TEST_PROFILES !== "undefined" && TEST_PROFILES) || null;
}

function profileTiers()  { const d = profileData(); return (d && d.zipTiers) || []; }
function profileLevels() { const d = profileData(); return (d && d.incomeLevels) || []; }
function profileDefaults() {
  const d = profileData();
  return (d && d.defaults) || { name: "Me", buddyName: "Buddy", householdSize: 2,
                                zipTier: "at", incomeLevel: "at" };
}

function profileId(tierId, levelId) { return tierId + "_" + levelId; }

/**
 * One profile, fully worked out.
 *
 * Returns the resolved BAND as well as the income, because the two do not move
 * together: peer-benchmarks.json has five bands and +/-25% does not always
 * cross one. Santa Clara at and +25% are both b5. Without the band on screen,
 * raising your income and watching every figure hold still looks like a bug
 * rather than like the model's own granularity.
 */
function profileResolve(id) {
  const parts = String(id || "").split("_");
  const tier = profileTiers().find(t => t.id === parts[0]);
  const level = profileLevels().find(l => l.id === parts[1]);
  if (!tier || !level) return null;
  const d = profileDefaults();
  const income = Math.round(tier.medianIncome * level.factor);
  let band = null;
  try { band = benchIncomeBand(income); } catch (e) { band = null; }
  return {
    id: profileId(tier.id, level.id),
    tier: tier, level: level,
    zip: tier.zip, place: tier.place, rpp: tier.rpp,
    incomeAnnual: income,
    monthlyIncome: Math.round(income / 12),
    band: band,
    householdSize: d.householdSize,
    name: d.name,
    buddyName: d.buddyName,
    label: tier.label + " · " + level.label
  };
}

/** All nine, tier-major. */
function profileList() {
  const out = [];
  profileTiers().forEach(t => {
    profileLevels().forEach(l => {
      const p = profileResolve(profileId(t.id, l.id));
      if (p) out.push(p);
    });
  });
  return out;
}

/** The fallback for anything a tester skipped — about average, on both axes. */
function profileDefault() {
  const d = profileDefaults();
  return profileResolve(profileId(d.zipTier, d.incomeLevel)) || profileList()[0] || null;
}

/**
 * Commit a profile to state.
 *
 * THE ONLY WAY a profile is applied. The picker, the admin switcher and the
 * sweep all come through here, so they cannot drift into three slightly
 * different ideas of what "Santa Clara, at typical" means.
 *
 * Lifestyle is left alone deliberately: it is seeded from the persona at boot
 * and the Help-me-out trees overwrite the dimensions they ask about. A profile
 * says where you live and what you earn, not how you live.
 */
function profileApply(id) {
  const p = profileResolve(id);
  if (!p) return null;

  state.profile.zip = p.zip;
  state.profile.householdSize = p.householdSize;
  state.profile.incomeAnnual = p.incomeAnnual;
  state.profile.name = p.name;
  state.monthlyIncome = p.monthlyIncome;

  if (!state.buddy) state.buddy = {};
  if (!state.buddy.name) state.buddy.name = p.buddyName;

  state.activeProfileId = p.id;

  // Every observation is a statement about figures that just moved.
  if (typeof observationsRecompute === "function") observationsRecompute();
  return p;
}

/** What is applied right now, for the admin readout. */
function profileActive() {
  return state.activeProfileId ? profileResolve(state.activeProfileId) : null;
}

/** Peer spend a month under a profile — the one number that summarises it. */
function profilePeerTotal() {
  try {
    const vals = benchAllPeerValues(benchOptsForUser());
    return catTotal(vals);
  } catch (e) { return 0; }
}
