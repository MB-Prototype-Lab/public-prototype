// L27: the Budget tab is a strict paywall; its CTA records intent without
// unlocking, navigating or changing state. Patch the checkout notice so the
// next repaint clears it. Do not claim that the prototype has no paid features.
// Compute the full-year comparison and round savings down so neither can
// overstate the discount when a price changes.
const BUDGET_PAYWALL_MONTHLY = 14.99;
const BUDGET_PAYWALL_ANNUAL  = 124.99;
const BUDGET_PAYWALL_TRIAL = "Seven days free";

/** $14.99 -- always cents, so a strikethrough reads as a real price. */
function paywallMoney(n) {
  return "$" + (Math.round(n * 100) / 100).toFixed(2);
}

// Compute the full-year comparison from the monthly price.
function paywallFullYear() {
  return Math.round(BUDGET_PAYWALL_MONTHLY * 12 * 100) / 100;
}

/** The saving, in whole percent, rounded DOWN (30.5 -> 30, never 31). */
function paywallSavePct() {
  const full = paywallFullYear();
  return full > 0 ? Math.floor((full - BUDGET_PAYWALL_ANNUAL) / full * 100) : 0;
}

// Lead with the budget because that is what the tester tried to open.
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
        ${h(BUDGET_PAYWALL_TRIAL)} on either plan. Cancel any time.
      </p>

      <ul class="onb-trial-list">
        ${BUDGET_PAYWALL_INCLUDES.map(x => `<li>${h(x)}</li>`).join("")}
      </ul>

      <!-- Two plans. Annual is the filled one, and it sits LOWEST -- nearest
           the thumb -- selling on one idea: 30% off. Monthly stays, outlined,
           with its price, so the choice is a real one. -->
      <div class="paywall-plans">
        <button class="button secondary full paywall-plan paywall-plan-monthly" type="button"
                onclick="budgetPaywallTap('monthly')">
          Start free trial
          <span class="paywall-plan-sub">${h(paywallMoney(BUDGET_PAYWALL_MONTHLY))} a month</span>
        </button>
        <button class="button full paywall-plan paywall-plan-annual" type="button"
                aria-label="Go yearly, ${h(paywallMoney(BUDGET_PAYWALL_ANNUAL))} a year, was ${h(paywallMoney(paywallFullYear()))}, save ${paywallSavePct()} percent"
                onclick="budgetPaywallTap('annual')">
          <span class="paywall-plan-tag" aria-hidden="true">Save ${paywallSavePct()}%</span>
          Go yearly
          <s class="paywall-was" aria-hidden="true">${h(paywallMoney(paywallFullYear()))}</s>
          <strong aria-hidden="true">${h(paywallMoney(BUDGET_PAYWALL_ANNUAL))}</strong>
        </button>
      </div>

      <!-- Patched, not re-rendered: nothing is stored, so nothing has to be
           cleared and the next repaint takes the note away by itself. -->
      <p class="helper" id="paywallNote" style="font-size:11px;margin:12px 0 0;min-height:16px;"></p>
    </div>
  `;
}

// Record subscription intent and state that checkout is unavailable;
// leave navigation and state untouched.
function budgetPaywallTap(plan) {
  // `plan` is 'monthly' or 'annual'. Nothing here reads it: it exists so the
  // two buttons carry different click names (budgetPaywallTap:monthly /
  // :annual, js/ub-names.js) and the study can see which plan testers reach for.
  uiPatchHTML("paywallNote",
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
        (js/config.js). It is L27 in docs/decisions.md, the one exception to
        D31 (&ldquo;no ads and no paywalls&rdquo;).
      </p>
      <div class="input-group">
        <label>Strict — there is no way through</label>
        <div class="helper">
          The CTA records the tap and says checkout is not built. It does not
          write <code>state.trialAccepted</code>, which still means what it
          always did: diamonds and the reward screen's subscriber section.
          Monthly ${h(paywallMoney(BUDGET_PAYWALL_MONTHLY))} · yearly
          ${h(paywallMoney(BUDGET_PAYWALL_ANNUAL))}, shown against
          ${h(paywallMoney(paywallFullYear()))} (monthly × 12) as "save ${paywallSavePct()}%",
          rounded down. The two taps are tracked separately.
        </div>
      </div>
      <div class="input-group">
        <label>It guards the TAB, not the budget</label>
        <div class="helper" style="line-height:1.7;">
          These still reach budget screens without rendering this one:<br>
          · chat&rsquo;s &ldquo;Show me the comparison&rdquo; and &ldquo;Show me&rdquo; → comparison<br>
          · the ☰ menu&rsquo;s &ldquo;Where my money goes&rdquo; → comparison<br>
          · comparison&rsquo;s category rows → one category<br>
          · budget-update-confirm → &ldquo;Rebuild it&rdquo; → <code>bbStart()</code><br>
          · <code>?screen=budget-build</code> and <code>?screen=comparison</code><br>
          · the Tools &ldquo;Jump to screen&rdquo; list<br>
          Deliberate: L27 guards the tab, not the budget.
        </div>
      </div>
    </div>
  `;
}
