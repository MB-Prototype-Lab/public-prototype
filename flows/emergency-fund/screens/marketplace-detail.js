// ─── Marketplace Detail ───────────────────────────────────────────────────────
// TAB: Market (sub-screen) | NAV BAR: Visible — Market tab highlighted
//
// PURPOSE
// Detail view for a single financial offer — category, match rationale, product
// description, terms placeholder, and a "Visit Site" CTA that exits the app.
//
// NAVIGATION
//   Entry: "View Details" button on a Marketplace offer card
//   Exit:  ← Back → marketplace; "Visit Site" exits app to provider URL (external)
//
// STATES
//   Driven by state.selectedOffer (a name string). currentOffer() resolves the
//   full offer object from state.offers. If selectedOffer doesn't match any
//   offer, currentOffer() returns a fallback.
//
// PRODUCTION NOTES
//   Currently static seed objects from state.js. Production: live rates API,
//   per-user match scoring, affiliate tracking on CTA click.
//   Terms/fees section is a stub — needs a structured data model per offer type
//   (credit card terms differ from loan terms differ from insurance terms).
//   "Visit Site" is a leave-the-app flow — final CTA should carry affiliate params.

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
