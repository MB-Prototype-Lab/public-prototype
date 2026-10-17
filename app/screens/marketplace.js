// Tools can open the seeded Marketplace; its bottom tab is inert (D33).
// Preferences and offer match text are display-only. Search, sort and category
// chips do not filter results.

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
