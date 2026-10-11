// ─── Big Purchase — Screen 3: ways to spend less ─────────────────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// NEW on the owner's review (2026-09-22). The alternatives used to sit on the
// cost screen with no context: "the user came here to buy the car they wanted,
// now the options are shown with no context." So they get a screen of their
// own, opening with why they are here at all, and each one is a SUMMARY CARD —
// "Consider used to save $6,300" — that expands into the detail.
//
// ── APPLES TO APPLES ────────────────────────────────────────────────────────
// The expanded card prices BOTH cars on the same rows over five years: the
// price, the costs that come with it, what the loan adds, minus what each is
// worth when sold. The saving is the difference of those two totals, which is
// why it is smaller than the difference of the two stickers — and that gap is
// the whole point of the tool.

/**
 * The type as it reads mid-sentence. Lowercasing everything turned "SUV" into
 * "suv" — an acronym keeps its case, an ordinary noun does not.
 */
function bpTypeWord(typeId) {
  const label = bpVTypeLabel(typeId);
  return label === label.toUpperCase() ? label : label.toLowerCase();
}

// ── Handlers ─────────────────────────────────────────────────────────────────

function bpToggleOption(id) {
  const s = bpSession();
  s.ui.open = s.ui.open === id ? null : id;
  s.ui.third = false;                       // a fresh open starts on two columns
  if (s.ui.open) bpLog("bp_explore_opened", { card: id });
  render();
}

/** Pick a card and move on. The rest of the flow follows the selection. */
function bpChooseOption(id) {
  const s = bpSession();
  if (s.selected !== id) {
    s.selected = id;
    bpLog("bp_card_selected", { card: id });
  }
  go("bpFinance");
}

/** Tapping a column selects that car without leaving the screen. */
function bpSelectColumn(id) {
  const s = bpSession();
  if (s.selected === id) return;
  s.selected = id;
  bpLog("bp_card_selected", { card: id });
  render();
}

/** The third column: whichever alternative is not already on screen. */
function bpAddThirdColumn() {
  const s = bpSession();
  s.ui.third = true;
  bpLog("bp_third_column_added", { open: s.ui.open });
  render();
}

// ── The five-year comparison ─────────────────────────────────────────────────

// One row per key, in the order a person would list them. Keyed rather than
// positional because the table now carries up to three columns and every one
// has to line up on the same rows.
const BP_CMP_ROWS = ["price", "taxesReg", "insurance", "fuel", "upkeep", "extras", "interest"];

/**
 * What one card costs over five years, by row key.
 *
 * ── NO RESALE, ANYWHERE ─────────────────────────────────────────────────────
 * Owner's ruling (2026-09-26): resale is out of the tool, not just off the
 * table. So the rows ARE the total — price, the costs, the interest, summed —
 * and the column adds up exactly as a reader expects. Nothing is credited back
 * for what the car might sell for, and no line explains a gap, because there
 * is no longer a gap to explain.
 */
function bpFiveYearRows(card) {
  const st = bpStack(card, 5);
  const val = id => { const l = st.lines.find(x => x.id === id); return l ? l.value : 0; };
  const out = { price: st.price, total: st.trueCost };
  const taxes = val("salesTax") + val("fees") + val("renewal") * 4;
  if (taxes) out.taxesReg = taxes;
  ["insurance", "fuel", "upkeep"].forEach(id => {
    const v = val(id);
    if (v) out[id] = v * 60;
  });
  const extras = val("charger") + val("gear");
  if (extras) out.extras = extras;
  if (st.interest > 0) out.interest = st.interest;
  return out;
}

/** The label for a row key, worded for the car in hand (Fuel vs Charging). */
function bpCmpLabel(key, inputs) {
  if (key === "price") return "Price";
  if (key === "taxesReg") return "Taxes and registration";
  if (key === "extras") return "Charger or gear";
  if (key === "interest") return "Loan interest";
  const row = bpRowDef(key);
  if (!row) return key;
  return row.labelFor ? row.labelFor(inputs) : row.label;
}

/**
 * Money saved, on ONE ROW (owner, 2026-09-27: the stacked version "uses too
 * much space"). Buddy and the bag hold the left, then two labelled columns —
 * the saving itself, and what it comes to if it is saved rather than spent.
 */
/**
 * ONE LINE, LINED UP (owner, 2026-09-27: "this screen is so misaligned… line it
 * up exactly… line all this up in a single line").
 *
 * It was two right-aligned flex columns of different widths, so the captions
 * started at different x, the figures did not share a baseline and the pencil
 * hung off the end of one of them. It is a GRID now: two equal cells, caption
 * on one row and figure on the next, so both pairs line up whatever they say.
 * The rate the invested figure assumes was invisible — it goes on its own line
 * underneath, which is where the pencil that changes it lives too.
 */
function renderBpSavedBag(saved, worth) {
  const s = bpSession();
  const pct = Math.round((Number(s.savingsRate) || 0) * 100);
  return `
    <div class="bp-bag">
      <p class="bp-bag-title">Money saved over 5 years</p>
      <div class="bp-bag-row">
        <span class="bp-bag-art" aria-hidden="true">
          <img class="bp-bag-buddy" src="${h(ESF_BUDDY_PILL_ART)}" alt=""
               onerror="${ESF_BUDDY_ART_FALLBACK}">
          <svg class="bp-bag-svg" viewBox="0 0 120 110" focusable="false">
            <path d="M44 24 L52 10 H68 L76 24 Z" style="fill:var(--good);opacity:.85"/>
            <path d="M46 26 C22 42 18 74 34 92 C46 104 74 104 86 92 C102 74 98 42 74 26 Z" style="fill:var(--good)"/>
            <text x="60" y="76" text-anchor="middle" style="fill:var(--good-bg);font-size:34px;font-weight:900">$</text>
          </svg>
        </span>
        <span class="bp-bag-col">
          <span class="bp-bag-cap">Car savings</span>
          <strong>${h(bpMoney(saved))}</strong>
        </span>
        ${worth > 0 ? `
          <span class="bp-bag-col">
            <span class="bp-bag-cap">Savings if invested</span>
            <strong>${h(bpMoney(worth))}</strong>
          </span>` : ""}
      </div>
      ${worth > 0 ? `
        <button class="bp-bag-rate" type="button" onclick="bpOpenSheet('rate')">
          invested at ${pct}% a year
          <span class="bp-pencil" aria-hidden="true">&#9998;</span>
        </button>` : ""}
    </div>`;
}

/** The column heads. Tapping one selects that car; the selection is marked. */
function bpCmpHead(cols) {
  const s = bpSession();
  return `
    <div class="bp-cmp-head" style="grid-template-columns:1fr repeat(${cols.length}, ${cols.length > 2 ? 62 : 74}px);">
      <span>Over 5 years</span>
      ${cols.map(c => `
        <button class="bp-cmp-col ${s.selected === c.id ? "on" : ""}" type="button"
                aria-pressed="${s.selected === c.id}" onclick="bpSelectColumn('${c.id}')">
          ${h(c.short)}${s.selected === c.id ? `<span class="bp-cmp-tick" aria-hidden="true">&#10003;</span>` : ""}
        </button>`).join("")}
    </div>`;
}

function renderBpOptionDetail(card, pickSt) {
  const s = bpSession();
  const cards = bpCards();
  const pick = cards[0];
  const other = cards.find(c => c.id !== "pick" && c.id !== card.id) || null;
  const cols = [
    { id: "pick", short: "Your pick", card: pick },
    { id: card.id, short: card.id === "used" ? "Used" : "Other brand", card: card }
  ];
  if (other && s.ui.third) cols.push({ id: other.id, short: other.id === "used" ? "Used" : "Other brand", card: other });

  const data = cols.map(c => bpFiveYearRows(c.card));
  const lowest = Math.min.apply(null, data.map(d => d.total));
  const saving = pickSt.trueCost - bpStack(card, 5).trueCost;
  const worth = bpOpportunity(pickSt, bpStack(card, 5));
  const inputs = card.inputs;
  const cat = bpCategory();
  const gridCols = "1fr repeat(" + cols.length + ", " + (cols.length > 2 ? 62 : 74) + "px)";

  return `
    <div class="bp-opt-detail">
      <p class="bp-based">${h((inputs.condition === "used" ? "A " + bpVAgeLabel(inputs.age).replace(" yrs", " year") +
         " old " : "A new ") + cat.noun(inputs) + ", about " + bpMoney(inputs.price) + ".")}</p>

      ${renderBpSavedBag(saving, worth)}

      <div class="bp-compare">
        ${bpCmpHead(cols)}
        ${BP_CMP_ROWS.filter(key => data.some(d => d[key])).map(key => `
          <div class="bp-cmp-row" style="grid-template-columns:${gridCols};">
            <span class="bp-cmp-label">${h(bpCmpLabel(key, cols[0].card.inputs))}</span>
            ${data.map(d => `<span>${d[key] ? h(bpMoney(d[key])) : "—"}</span>`).join("")}
          </div>`).join("")}
        <div class="bp-cmp-row bp-cmp-total" style="grid-template-columns:${gridCols};">
          <span class="bp-cmp-label">Total</span>
          ${data.map(d => `<span class="${d.total === lowest ? "bp-cmp-low" : ""}">${h(bpMoney(d.total))}</span>`).join("")}
        </div>
      </div>

      ${other && !s.ui.third ? `
        <button class="bp-addcol" type="button" onclick="bpAddThirdColumn()">
          + Add ${h(other.id === "used" ? "used" : "a different brand")} to compare</button>` : ""}

      <p class="bp-based">Tap a column to choose that one. ${s.selected === "pick"
        ? "You're keeping your pick for now." : "You've chosen " + h(bpCardNoun(bpSelectedCard())) + "."}</p>
    </div>`;
}

function renderBpOptionCard(card, pickSt) {
  const s = bpSession();
  const open = s.ui.open === card.id;
  const saving = pickSt.trueCost - bpStack(card, 5).trueCost;
  const type = bpTypeWord(card.inputs.type);
  const title = card.id === "used" ? "Used" : "Other brand";
  // SAY WHAT THE OPTION IS, then what it saves. The old line was a "don't be car
  // poor" quip — "Five years on, both are old suvs. One of you also has $47,800"
  // — which never said what the alternative actually was, and quoted the
  // INVESTED figure while the headline above quoted the plain saving, so the two
  // numbers on one screen disagreed (owner, 2026-09-27: "the copy under used and
  // other brand is terrible, it doesn't make sense").
  const quip = card.id === "used"
    ? "A " + bpVAgeLabel(card.inputs.age).replace(" yrs", " year old") + " one, about " +
      bpMoney(card.inputs.price) + ". The same " + type + ", after someone else has owned it."
    : "A " + bpVTierLabel(card.inputs.tier).toLowerCase() + "-brand one, about " +
      bpMoney(card.inputs.price) + ". Same school run, different badge.";

  return `
    <button class="bp-optcard ${open ? "on" : ""} ${s.selected === card.id ? "chosen" : ""}"
            type="button" aria-expanded="${open}" onclick="bpToggleOption('${card.id}')">
      <span class="bp-optcard-title">${h(title)}</span>
      <span class="bp-optcard-lead">Saves over 5 years</span>
      <span class="bp-optcard-big">${h(bpMoney(saving))}</span>
      <span class="bp-optcard-quip">${h(quip)}</span>
      <span class="bp-optcard-more">${open ? "Hide the detail" : "See the detail"}</span>
    </button>`;
}

function renderBpOptions() {
  const s = bpSession();
  bpEnsureSetup();
  const cards = bpCards();
  const pick = cards[0];
  const pickSt = bpStack(pick, 5);
  const alts = cards.slice(1);
  const chosen = s.selected !== "pick" ? bpSelectedCard() : null;

  // THE HEADLINE IS THE SAVING OF WHAT IS CURRENTLY CHOSEN (owner, 2026-09-27),
  // so it reads $0 while the pick is selected and moves the moment a column or
  // a card is chosen. It answers "what does this choice change?" rather than
  // restating a total the previous screen already gave.
  const chosenSaving = s.selected === "pick" ? 0 : pickSt.trueCost - bpStack(bpSelectedCard(), 5).trueCost;
  const headline = `
    <div class="bp-headline">
      <strong class="bp-hl-big bp-hl-center">${h(bpMoney(chosenSaving))}</strong>
      <span class="bp-hl-cap">${chosenSaving > 0
        ? "saved over 5 years with " + (s.selected === "used" ? "the used one" : "a different brand")
        : "saved so far — you're keeping your pick"}</span>
    </div>`;
  const open = alts.find(c => s.ui.open === c.id);

  return `
    <div class="journal-shell onb-pinned bp-shell">
      <div class="journal-head bp-head">
        <p class="helper" style="margin:0 0 4px;">Optional</p>
        <h1 class="title esf-title">Ways to spend less</h1>
        ${headline}
      </div>
      <div class="journal-body">
        <p class="bp-lead">Before deciding on your ${h(bpVTierLabel(pick.inputs.tier).toLowerCase())}
           ${h(bpTypeWord(pick.inputs.type))}, below are options to consider before moving forward,
           based only on costs.</p>

        ${alts.length ? `
          <p class="bp-q-label">Consider these options to save more money</p>
          <div class="bp-optcards">${alts.map(c => renderBpOptionCard(c, pickSt)).join("")}</div>
          ${open ? renderBpOptionDetail(open, pickSt) : ""}
        ` : `<div class="card"><p class="bp-lead" style="margin:0;">This is already the lowest-cost option we
               compare, so there's nothing cheaper to show.</p></div>`}

        <p class="bp-based bp-foot-note">Staying with your pick is a fine answer. Nothing here is a
           recommendation.</p>
      </div>
      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        ${renderBpBuddyButton()}
        <button class="button" type="button" onclick="bpChooseOption('${chosen ? chosen.id : "pick"}')">
          ${chosen ? "Continue" : "Keep my pick"}</button>
      </div>
    </div>`;
}

function renderBpOptionsAdmin() {
  bpEnsureSetup();
  const cards = bpCards();
  const pickSt = bpStack(cards[0], 5);
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — options (5-year totals)</p>
      ${cards.map(c => {
        const st = bpStack(c, 5);
        return `<p class="helper"><strong>${h(c.label)}</strong> sticker ${h(bpMoney(c.inputs.price))} ·
          5-yr ${h(bpMoney(st.trueCost))}${c.id === "pick" ? ""
            : " · saves " + h(bpMoney(pickSt.trueCost - st.trueCost)) +
              " (sticker gap " + h(bpMoney(pickSt.price - st.price)) + ")"}</p>`;
      }).join("")}
      <p class="helper" style="font-size:10px;">Every row of the expanded card sums to that card's 5-year total:
        price + costs + interest, with no resale credit anywhere. The saving is the difference of the two totals.</p>
    </div>
    ${renderBpAdminCommon()}`;
}
