// ─── The Budget tab, walled ──────────────────────────────────────────────────
// TAB: Budget | NAV BAR: Visible
//
// v4 only, behind BUDGET_PAYWALL (js/config.js). The Budget tab stops being a
// budget and becomes the thing standing in front of one.
//
// ── WHERE THE COPY CAME FROM ────────────────────────────────────────────────
// Not invented. v3 asked this as onboarding's last step; v3.1 took "trial" out
// of ONB_STEPS and left the renderer in place, so the terms, the five bullets
// and the pill are the ones already designed — reworded from an optional trial
// into a gate.
//
// ONE LINE OF THAT COPY COULD NOT COME WITH IT. The original closed on
// "Nothing is locked either way — this prototype has no paid features." It is
// the sentence a tester actually reads, and on this screen it would state the
// opposite of what the screen is doing.
//
// ── THE BUTTON DOES NOT UNLOCK ANYTHING ─────────────────────────────────────
// Owner's call: strict, no route through. So the CTA is not a lie about to be
// discovered — tapping it says plainly that checkout is not built here.
//
// It is still worth having, and worth being a real button. Tracking is on and
// js/ub-names.js stamps every control with a derived name, so the tap lands in
// the click report as intent-to-subscribe. That is the measurement this round
// exists for, and it costs nothing more than a fake checkout would have.
//
// It writes NOTHING — not state.trialAccepted, not a flag, not a render. The
// note is patched in (uiPatchHTML), so there is no leftover to reset and the
// next repaint clears it on its own.

const BUDGET_PAYWALL_PRICE = "$6.99 a month";
const BUDGET_PAYWALL_TRIAL = "Seven days free";

// What Platinum is said to carry. The budget leads, because the budget is what
// the tester just tried to open — the original list opened on daily updates,
// which is the right order in onboarding and the wrong one here.
const BUDGET_PAYWALL_INCLUDES = [
  "Your full budget, all twelve categories",
  "Daily updates on how you're doing",
  "Peer comparisons for every category",
  "Unlimited journal entries and history",
  "All lessons and simulations"
];

function renderBudgetPaywall() {
  return `
    <h1 class="title" style="margin:0 0 14px;font-size:20px;">Budget</h1>

    <div class="card">
      <p class="pill" style="display:inline-block;font-size:9px;padding:3px 9px;margin-bottom:10px;">Platinum</p>
      <h2 class="title onb-title" style="margin:0 0 6px;">Your budget lives in Platinum</h2>
      <p class="task-desc" style="margin:0 0 12px;">
        ${h(BUDGET_PAYWALL_TRIAL)}, then ${h(BUDGET_PAYWALL_PRICE)}. Cancel any time.
      </p>

      <ul class="onb-trial-list">
        ${BUDGET_PAYWALL_INCLUDES.map(x => `<li>${h(x)}</li>`).join("")}
      </ul>

      <button class="button full" type="button" onclick="budgetPaywallTap()">
        Start free trial
      </button>

      <!-- Patched, not re-rendered: nothing is stored, so nothing has to be
           cleared and the next repaint takes the note away by itself. -->
      <p class="helper" id="bpNote" style="font-size:11px;margin:12px 0 0;min-height:16px;"></p>
    </div>
  `;
}

/**
 * The CTA. Says where it stops, and stops there.
 *
 * No navigation, no state write, no render() — a tester who taps this is
 * telling us something, and the app's job is to record the tap and be honest
 * about the rest.
 */
function budgetPaywallTap() {
  uiPatchHTML("bpNote",
    "Checkout isn't built into this prototype — nothing was charged, " +
    "and the budget stays where it is.");
}

function renderBudgetPaywallAdmin() {
  const on = typeof BUDGET_PAYWALL !== "undefined" && BUDGET_PAYWALL;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Budget — paywalled</p>
      <p class="helper" style="margin-bottom:10px;">
        <code>BUDGET_PAYWALL</code> is <strong>${on ? "on" : "off"}</strong>
        (js/config.js). It overrides spec decision D31 (&ldquo;no ads and no
        paywalls&rdquo;); the override is recorded as L27 in plan.md §0.
      </p>
      <div class="input-group">
        <label>Strict — there is no way through</label>
        <div class="helper">
          The CTA records the tap and says checkout is not built. It does not
          write <code>state.trialAccepted</code>, which still means what it
          always did: diamonds and the reward screen's subscriber section.
        </div>
      </div>
      <div class="input-group">
        <label>It guards the TAB, not the budget</label>
        <div class="helper" style="line-height:1.7;">
          These still reach budget screens without rendering this one:<br>
          · the &ldquo;Set up your budget&rdquo; daily task → <code>bbStart()</code><br>
          · the Home task, destination <code>budgetBuild</code><br>
          · budget-update-confirm → Rebuild<br>
          · <code>?screen=budget-build</code> and <code>?screen=comparison</code><br>
          · this jump list<br>
          Deliberate, and listed in CLAUDE.md.
        </div>
      </div>
    </div>
  `;
}
