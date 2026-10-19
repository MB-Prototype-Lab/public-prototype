// Resolve the seeded offer by selected name, with currentOffer's fallback.
// Terms are placeholder text and Visit Site has no handler.

function renderMarketplaceDetail() {
  const offer = currentOffer();
  return `
    <div class="card">
      <div class="market-category">${h(offer.category)}</div>
      <h1 class="title">${h(offer.name)}</h1>
      <p class="subtitle">${h(offer.match)}</p>
    </div>

    <div class="card">
      <div class="section-title">Why this appears here</div>
      <p class="helper">This detail screen is preference-aware browsing, not an application flow. The final CTA leaves the app.</p>
    </div>

    <div class="card">
      <div class="section-title">Offer Details</div>
      <p class="helper">${h(offer.description)}</p>
      <div class="note" style="margin-top:12px;">Terms, fees, APRs, rewards, and qualification rules would be shown here in a real implementation.</div>
    </div>

    <div class="flow-footer">
      <button class="button secondary" type="button" onclick="navBack()">Back</button>
      <button class="button" type="button">Visit Site</button>
    </div>
  `;
}
