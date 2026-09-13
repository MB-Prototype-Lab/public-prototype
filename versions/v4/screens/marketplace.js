// ─── Marketplace ──────────────────────────────────────────────────────────────
// TAB: Market | NAV BAR: Visible
//
// PURPOSE
// Browse financial products (credit cards, loans, bank accounts, insurance,
// AI tools) matched to the user's profile and stated preferences.
//
// NAVIGATION
//   Entry: Market tab tap from any screen in NAV_VISIBLE_SCREENS
//   Exit:  Market tab → any other tab; "View Details" on an offer → marketplace-detail
//
// STATES
//   Static offer list from state.offers. Search input, sort select, and category
//   pills are UI-only stubs — no filtering logic wired yet.
//
// PRODUCTION NOTES
//   Offer "match" text is currently hardcoded per-offer in seed data. Production:
//   scoring engine against user profile (income, ZIP, debt load, risk preference).
//   Category filter and search to be wired. Offer CTAs are affiliate/referral
//   links — "View Details" stays in-app; "Visit Site" on the detail screen exits.
//   Preferences chips drive display only — no backend preference storage yet.

function renderMarketplace() {
  return `
    <div class="card">
      <div class="section-title">My Preferences</div>
      <p class="helper">Preferences apply across financial instrument categories.</p>
      <div class="pill-row" style="margin-top:12px;">
        ${state.preferences.map(p => `<span class="pill">${h(p)}</span>`).join("")}
      </div>
    </div>

    <div class="card">
      <div class="grid-two">
        <input placeholder="Search" disabled
               style="padding:11px;border:1px solid var(--line);border-radius:13px;opacity:.5;cursor:not-allowed;">
        <select disabled style="padding:11px;border:1px solid var(--line);border-radius:13px;opacity:.5;cursor:not-allowed;">
          <option>Sort: Match</option>
          <option>Sort: Fees</option>
          <option>Sort: APR</option>
        </select>
      </div>
      <p class="caption" style="margin-top:8px;">Filter and search coming soon.</p>
    </div>

    <div class="card">
      <div class="section-title">Categories</div>
      <div class="pill-row">
        ${["Bank Accounts", "Credit Cards", "Loans", "Refi", "Insurance", "Software", "AI Systems"].map(c => `<span class="pill">${c}</span>`).join("")}
      </div>
    </div>

    ${state.offers.map(offer => `
      <div class="market-card item-card">
        <div class="market-category">${h(offer.category)}</div>
        <div class="task-title">${h(offer.name)}</div>
        <p class="task-desc">${h(offer.description)}</p>
        <div class="helper">${h(offer.match)}</div>
        <button class="button" type="button" onclick="selectOffer('${h(offer.name)}')">View Details</button>
      </div>
    `).join("")}
  `;
}

function renderMarketplaceAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">Marketplace Preferences</p>
      <p class="helper">Preferences are sample chips at the top of Marketplace.</p>
      <div class="input-group">
        <label>Preference list</label>
        <textarea oninput="state.preferences=this.value.split(',').map(x=>x.trim()).filter(Boolean);render()">${h(state.preferences.join(", "))}</textarea>
      </div>
    </div>

    <div class="admin-card">
      <p class="admin-card-title">Selected Offer</p>
      <select onchange="state.selectedOffer=this.value;go('marketplaceDetail')">
        ${state.offers.map(o => `<option value="${h(o.name)}" ${state.selectedOffer === o.name ? "selected" : ""}>${h(o.name)}</option>`).join("")}
      </select>
    </div>
  `;
}
