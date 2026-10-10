// ─── Big Purchase — Screen 2: the hidden and forgotten costs ─────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// REWRITTEN on the owner's review (2026-09-22). This screen used to carry the
// cost stack, the alternatives AND the financing panel at once — "a fucking
// mess… way too much info." It now does ONE job: what the car the tester came
// for actually costs to run, as a plain table, plus the single question of
// whether it will be financed. Alternatives moved to screens/bp-options.js and
// financing to screens/bp-finance.js, at the end where adjustments belong.
//
// THE TABLE IS READ-ONLY (owner): every figure is a default estimate, one line
// each, numbers right-aligned, month and year only. Deliberately NOT here any
// more: registration renewal, loan interest, value lost and everything about
// paying — none of them are a forgotten running cost, which is what a tester
// opens this screen to learn.

// ── The lines ────────────────────────────────────────────────────────────────

/**
 * One line per expense, in the owner's order: what you pay at purchase, then
 * what it costs to run, then the things you may still need to buy.
 *
 * Sales tax and the title/registration/doc fees are ONE line — a tester writes
 * one cheque at the dealer and does not care which part is which.
 */
function bpCostLines(card) {
  const st = bpStack(card, 5);
  const val = id => {
    const line = st.lines.find(l => l.id === id);
    return line ? line.value : 0;
  };
  const out = [];
  const taxes = val("salesTax") + val("fees");
  if (taxes) out.push({ id: "taxesReg", label: "Taxes and registration", kind: "once", amount: taxes });

  [["insurance", "Insurance"], ["fuel", null], ["upkeep", "Upkeep and repairs"]]
    .forEach(([id, label]) => {
      const v = val(id);
      if (!v) return;
      const row = bpRowDef(id);
      out.push({ id: id, kind: "monthly", amount: v,
                 label: label || (row.labelFor ? row.labelFor(card.inputs) : row.label) });
    });

  // "May need" — real costs, but ones a tester can choose not to have on day one.
  [["charger", "Home charger"], ["gear", "Riding gear"]].forEach(([id, label]) => {
    const v = val(id);
    if (v) out.push({ id: id, kind: "once", amount: v, label: label, mayNeed: true });
  });
  return out;
}

/**
 * Everything in the first twelve months, and what it settles to after that.
 *
 * The CAR ITSELF is in the first-year figure (owner, 2026-09-22: "it also needs
 * to show the cost of the car and these expenses"). A list of extras with no
 * price above them invites the question "on top of what?".
 */
function bpCostTotals(card) {
  const lines = bpCostLines(card);
  const monthly = lines.filter(l => l.kind === "monthly").reduce((s, l) => s + l.amount, 0);
  const once = lines.filter(l => l.kind === "once").reduce((s, l) => s + l.amount, 0);
  const price = Number(card.inputs.price) || 0;
  return { monthly: monthly, once: once, price: price,
           extrasFirstYear: once + monthly * 12,
           firstYear: price + once + monthly * 12 };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Which order the two lower boxes sit in: "A" (running costs, then the cheaper
 * options) or "B" (the cheaper options in the middle). Session state, so it
 * survives moving around the flow and resets with a new run.
 */
// B IS THE DEFAULT (owner, 2026-09-27: "stick with version B on step 2") —
// the cheaper-options callout in the middle, the running-cost table last. A is
// kept behind the admin toggle rather than deleted: the pair is what the owner
// compared, and a variant that no longer exists cannot be looked at again.
function bpCostVariant() {
  const s = bpSession();
  return s.costVariant === "A" ? "A" : "B";
}

function bpSetCostVariant(v) {
  const s = bpSession();
  s.costVariant = v === "B" ? "B" : "A";
  bpLog("bp_cost_variant", { variant: s.costVariant });
  render();
}

function bpSetPayMode(mode) {
  const s = bpSession();
  if (s.pay.mode === mode) return;
  s.pay.mode = mode;
  bpLog("bp_pay_mode", { mode: mode });
  render();
}

function bpGoOptions() {
  bpLog("bp_costs_done", { financed: bpSession().pay.mode });
  go("bpOptions");
}

/**
 * Continue from the costs screen. It follows the callout's answer: somebody who
 * said "not interested" does not get walked through the screen they declined.
 */
function bpCostContinue() {
  const s = bpSession();
  // Continue ALWAYS goes to paying for it. The options screen is opened by
  // Explore and by the cost list on screen 4, never by walking forward
  // (owner, 2026-09-27: "this screen should only appear if the user clicks
  // Explore"). Nobody is marched through a comparison they did not ask for.
  bpLog("bp_costs_done", { financed: s.pay.mode, explored: s.exploreChoice || "none" });
  go("bpFinance");
}

/**
 * Explore, or not interested.
 *
 * "Not interested" does not just dismiss a card: it takes the options screen
 * out of the flow, so Continue goes straight to paying for it. The choice is
 * reversible from the one line the card collapses to — a tester who says no and
 * then wonders must not have to walk backwards to find it.
 */
function bpExploreChoose(choice) {
  const s = bpSession();
  s.exploreChoice = choice;
  bpLog("bp_explore_choice", { choice: choice, saving: (bpSaveBest() || {}).saving || 0 });
  if (choice === "explore") { bpGoOptions(); return; }
  render();
}

// ── Render ───────────────────────────────────────────────────────────────────

/**
 * "new SUV" / "used SUV" — the subject in the step title, mid-sentence.
 * Deliberately NOT the full four-part description: a title that has to hold one
 * line cannot carry the brand tier and the fuel as well, and both of those are
 * spelled out in the box below it.
 */
function bpCostTitleSubject(inputs) {
  return (inputs.condition === "used" ? "used " : "new ") + bpTypeWord(inputs.type);
}

/**
 * "Your pick: new Premium SUV, electric" — the car named in full, once, at the
 * top of the box that prices it. It was "New Standard Car (Electric)" in title
 * case with a parenthetical, which read like a listing on a dealer's website
 * rather than a sentence about the tester's own car (owner, 2026-09-27).
 */
function bpCostSubject(inputs) {
  const cat = bpCategory();
  const cond = inputs.condition === "used" ? bpVAgeLabel(inputs.age).replace(" yrs", " year old") : "new";
  return "Your pick: " + cond + " " + cat.noun(inputs).toLowerCase()
    .replace(/\bsuv\b/i, "SUV") + ", " + bpVFuelLabel(inputs.fuel).toLowerCase();
}

/**
 * The pinned summary (owner, 2026-09-27).
 *
 * The first-year total, with its two halves spelled out underneath, and the
 * running cost beside it behind a rule. The monthly figure is NOT the car's
 * payment and was being read as one, so it says what it is in words: on top of
 * the payment. The payment itself is worked out on screen 4.
 */
/**
 * THIS SCREEN IS ABOUT RUNNING COSTS ONLY (owner, 2026-09-27). The price used
 * to be folded into the headline, which made an $87,820 figure that mixed the
 * car with the cost of keeping it — the single biggest source of confusion in
 * the tool. The price, the loan and the totals are screen 4's job; here a
 * tester learns what the thing costs to keep, per month and over year one.
 */
/**
 * THE LADDER (owner, 2026-09-27): upfront, then every month, then year one,
 * then five years. In that order, because each figure is built from the one
 * above it — and because the cheaper-option saving underneath is a five-year
 * number, which lands as a non-sequitur if the tester has never been shown what
 * five years costs.
 *
 * Every figure here comes from bpBreakdown(), so the ladder cannot drift from
 * the table beneath it or from screen 4. The old summary added the registration
 * renewal into year one and disagreed with its own table by exactly that.
 */
/**
 * SIX ROWS, THE OWNER'S WORDING, NO SUBTEXT (2026-09-27): "I want to split this
 * out and give step by step so users understand the math with pure clarity…
 * I don't want subtext. I want the info displayed in parenthesis after the
 * line." The label is bold, the qualifier in brackets is italic and not bold,
 * and the figure is on the right. Nothing else.
 *
 * Car Price is the car PLUS the accessories bought with it (a home charger, a
 * motorcycle's gear), which is what the bracket says it is. The down payment
 * percentage is therefore worked out from that same figure rather than printed
 * as a flat "20%": on a car with no accessories the two are identical, and on
 * an electric one they are not, and a row that explains itself must not be the
 * row that is wrong.
 *
 * Paying cash, rows 2 and 3 are not facts about anything — there is no deposit
 * and no payment — so one "Paid at purchase" row takes their place.
 */
/**
 * EVERY FIGURE ON THIS SCREEN IS ROUNDED THE SAME WAY (owner, 2026-09-27:
 * *"why don't Monthly use and Maintenance $800/mo equal Total $760 in the table
 * below?"*). It did not, because this block rounded to the nearest hundred and
 * the table under it rounded to the nearest five, so the same $760 printed as
 * two different numbers a centimetre apart. Nothing here rounds to hundreds any
 * more: a summary that disagrees with its own detail is worse than an untidy
 * number, and $144,900 is no harder to read than $144,900.
 */
function bpLadderRows(b, card) {
  const loan = b.mode === "loan";
  const carPrice = b.costs.price + b.upfront.extras;
  const downPct = carPrice > 0 ? Math.round((b.pay.down / carPrice) * 100) : 0;
  const rows = [
    { label: "Car Price", note: "(car + accessories):", value: carPrice, group: "buy" }
  ];
  if (loan) {
    // "at purchase" came out of the label (owner, 2026-09-27): the bracket
    // already says what it is a percentage of, and the row sits under the car
    // price, so the extra words only made it the one row that wrapped.
    rows.push({ label: "Down Payment", note: "(" + downPct + "% of Car Price)",
                value: b.pay.down, group: "buy" });
    rows.push({ label: "Monthly Car Payment", note: "(car loan)",
                value: bpMonthlyPayment(b), per: true, group: "month" });
  } else {
    rows.push({ label: "Paid at purchase", note: "(car + tax and fees)",
                value: b.yearOne.atPurchase, group: "buy" });
  }
  rows.push({ label: "Monthly use and Maintenance", note: "", value: b.running.monthly,
              per: true, group: "month" });
  // BOTH TOTALS ARE HIGHLIGHTED, AND YEAR 1 LEADS (owner, 2026-09-27: "I want
  // year 1 cost and cost over 5 years highlighted in the first box. year 1
  // should be more prominent."). They share a tinted band at the foot of the
  // card; year one is the larger of the two because it is the figure a person
  // can picture, and the five-year total is what it grows into.
  rows.push({ label: "Year 1 Cost", note: "(all-in)", value: b.yearOne.total,
              group: "total", hero: true, lead: true });
  rows.push({ label: "Cost over 5 Years", note: "(all-in)", value: b.total,
              group: "total", hero: true });
  return rows;
}

/**
 * THE SIX ROWS, LAID OUT PROPERLY (owner, 2026-09-27: *"this legit looks
 * ugly"*).
 *
 * The wording is untouched — it is the owner's, verbatim. What changed is
 * everything around it:
 *
 *  - **Grouped by whitespace, not by rules.** A dashed line under every row
 *    gave six equal-weight bands and no shape. The rows fall into three things
 *    a person actually asks — what it takes to drive it away, what it takes
 *    every month, what it comes to — so a little air separates those, and the
 *    dashes are gone.
 *  - **One figure column.** Labels flex, figures sit in a fixed column with
 *    tabular numerals, so every digit stacks and the eye can run down them.
 *    The bracket no longer pushes the money around.
 *  - **The last line is the answer**, so it is the only one that is large and
 *    green, on its own tinted band. Year 1 above it is a step towards it.
 *  - `/mo` is a unit, not part of the number: smaller, lighter, and it never
 *    takes width from the figure it follows.
 */
function renderBpCostLadder(card) {
  const b = bpBreakdown(card);
  const rows = bpLadderRows(b, card);
  return `
    <div class="bp-ladder">
      ${rows.map((r, i) => {
        const prev = rows[i - 1];
        const starts = prev && prev.group !== r.group ? " bp-ladder-gap" : "";
        return `
        <div class="bp-ladder-row${starts}${r.hero ? " bp-ladder-hero" : ""}${
            r.lead ? " bp-ladder-lead" : ""}">
          ${/* The labels are NOT bold any more (owner, 2026-09-27: "unbold the
                text and expenses"). Six bold rows meant nothing on the card was
                emphasised, because everything was. The two totals carry the
                weight now, and they are the only ones that do. */ ""}
          <span class="bp-ladder-label">${h(r.label)}${
            r.note ? ` <em>${h(r.note)}</em>` : ""}</span>
          ${/* NO "/mo" SUFFIX (owner, 2026-09-27: "isn't this repetitive to
                show monthly costs then per/month?"). It is: the label already
                starts with "Monthly", so the unit was being said twice on the
                same line. The label is the owner's wording and it stays; the
                suffix goes. The rows still carry `per`, which is now the only
                record of which figures are monthly — keep it set. */ ""}
          <span class="bp-ladder-fig">${h(bpMoney(r.value))}</span>
        </div>`;
      }).join("")}
    </div>`;
}

/**
 * The running-cost table: one line per expense, two figure columns, no rules
 * between rows. Compact — this screen has to hold without scrolling, and the
 * rows are the part that gives most easily.
 */
function renderBpCostTable(card) {
  const lines = bpCostLines(card);
  const t = bpCostTotals(card);
  const row = (label, monthly, year, cls) => `
    <div class="bp-tbl-row ${cls || ""}">
      <span class="bp-tbl-label">${h(label)}</span>
      <span>${monthly == null ? "" : h(bpMoney(monthly))}</span>
      <span>${year == null ? "" : h(bpMoney(year))}</span>
    </div>`;
  // RUNNING COSTS ONLY. Taxes, registration and anything bought on the day are
  // purchase costs — they sit in the ladder's "At purchase" line (or inside the
  // loan). Listing them here under "first year" is what made this table
  // disagree with the summary above it.
  const running = lines.filter(l => l.kind === "monthly");
  return `
    <div class="card bp-costbox">
      <p class="bp-box-head">What it costs to run the ${h(bpTypeWord(card.inputs.type))}</p>
      ${/* The "estimated for…" line sits DIRECTLY UNDER THE HEADING (owner,
            2026-09-27), where it qualifies the table before it is read. At the
            foot it was a disclaimer nobody reached. */ ""}
      <p class="bp-tbl-note">Estimated for ${h(bpVCity())},
         ${h(String(bpVMilesPerDay()))} miles a day. Costs will vary.</p>
      <div class="bp-tbl bp-tbl-ruled">
        <div class="bp-tbl-head"><span></span><span>A MONTH</span><span>A YEAR</span></div>
        ${running.map(l => row(l.label, l.amount, bpRound(l.amount * 12, 10))).join("")}
        ${row("Total", t.monthly, bpRound(t.monthly * 12, 10), "bp-tbl-total")}
      </div>
    </div>`;
}

/**
 * The cheaper-options callout. The saving is the loudest thing on the card
 * (owner: the quiet version "was almost hidden"), and it asks for a decision:
 * Explore opens the options screen, Not interested takes it out of the flow.
 */
function bpSaveBest() {
  const cards = bpCards();
  if (cards.length < 2) return null;
  const pickCost = bpStack(cards[0], 5).trueCost;
  let best = null, saving = 0;
  cards.slice(1).forEach(c => {
    const gap = pickCost - bpStack(c, 5).trueCost;
    if (gap > saving) { saving = gap; best = c; }
  });
  return best ? { card: best, saving: saving } : null;
}

function renderBpSaveTeaser(card) {
  const s = bpSession();
  const hit = bpSaveBest();
  if (!hit) return "";
  const what = hit.card.id === "used" ? "Buying used" : "A different brand";

  if (s.exploreChoice === "skip") {
    return `
      <div class="bp-skipped">
        <span>Cheaper options skipped.</span>
        <button class="bp-link" type="button" onclick="bpExploreChoose('explore')">Show them</button>
      </div>`;
  }

  return `
    <div class="bp-save">
      ${/* Three stacked lines became two (2026-09-27). The saving and what it
            is over belong on one line; splitting them cost a whole line of
            height on a screen that then had none left for the spacing the
            owner asked for. */ ""}
      <p class="bp-save-lead">${h(what)} could save you</p>
      <p class="bp-save-big">${h(bpMoney(hit.saving))} <i>over 5 years</i></p>
      <div class="bp-row2">
        <button class="button full" type="button" onclick="bpExploreChoose('explore')">Explore</button>
        <button class="button secondary full" type="button" onclick="bpExploreChoose('skip')">Not interested</button>
      </div>
    </div>`;
}

/**
 * IT HAS TO FIT ONE SCREEN (owner, 2026-09-27: "all of this needs to fit on a
 * single screen… no scrolling"). Four blocks and nothing else: the summary, the
 * running costs, the saving, the financed question. The step header carries no
 * headline of its own any more — the summary box IS the headline — and the car
 * line, the lead sentence and the loose footnote are gone into it.
 */
function renderBpCost() {
  const s = bpSession();
  bpEnsureSetup();
  const card = bpCard("pick");
  const loan = s.pay.mode === "loan";

  return `
    <div class="journal-shell onb-pinned bp-cost-shell">
      <div class="journal-head bp-head bp-head-tight">${
        /* The title names the car rather than the job of the screen (owner,
           2026-09-27): "Estimated costs for a new SUV". It is the one place the
           tester sees their two headline answers repeated back. */
        renderBpStepHead(2, "Estimated costs for a " + bpCostTitleSubject(card.inputs), "", "bp-title-fit")}</div>
      <div class="journal-body">
        ${/* THE LOAN QUESTION COMES FIRST (owner, 2026-09-27): "we need to know
              if its financed because the estimated costs are assuming its
              financed." Every figure below it changes with the answer, so
              asking underneath them had the tester read a set of numbers built
              on an assumption they had not been told about, then find the
              switch afterwards. Worded as "will you need a loan" rather than
              "will this be financed" — the owner's doubt that everybody reads
              "financed" the same way is a fair one, and the answers name the
              thing either way. */ ""}
        <div class="bp-financed">
          <p class="bp-q-label">Will you need a loan?</p>
          ${bpTiles([{ id: "loan", label: "Yes, car loan" }, { id: "cash", label: "No, paying cash" }],
                    s.pay.mode, id => `bpSetPayMode('${id}')`, "bp-tiles-2")}
        </div>

        ${renderBpCostLadder(card)}
        ${/* TWO VERSIONS OF THIS SCREEN (owner, 2026-09-27). A: the running
              costs, then the cheaper-options callout. B: the callout in the
              middle, the running costs last. The only difference between them
              is these two lines, which is the point — anything else that
              differs makes the comparison meaningless. Switch with the admin
              panel's A/B buttons; A is the default. */ ""}
        ${bpCostVariant() === "B"
          ? renderBpSaveTeaser(card) + renderBpCostTable(card)
          : renderBpCostTable(card) + renderBpSaveTeaser(card)}
      </div>
      <div class="journal-foot esf-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        ${renderBpBuddyButton()}
        <button class="button" type="button" onclick="bpCostContinue()">Continue</button>
      </div>
    </div>`;
}

function renderBpCostAdmin() {
  bpEnsureSetup();
  const card = bpCard("pick");
  const t = bpCostTotals(card);
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — running costs</p>
      <p class="helper">Screen 2 layout: <strong>Version ${h(bpCostVariant())}</strong>
        ${bpCostVariant() === "A" ? "(costs, then cheaper options)" : "(cheaper options in the middle)"}</p>
      <div class="bp-row2" style="margin-bottom:8px;">
        <button class="button ${bpCostVariant() === "A" ? "" : "secondary"} full" style="font-size:11px;"
                type="button" onclick="bpSetCostVariant('A')">Version A</button>
        <button class="button ${bpCostVariant() === "B" ? "" : "secondary"} full" style="font-size:11px;"
                type="button" onclick="bpSetCostVariant('B')">Version B</button>
      </div>
      ${bpCostLines(card).map(l => `<p class="helper">${h(l.label)} · ${h(bpMoney(l.amount))} ${h(l.kind)}</p>`).join("")}
      <p class="helper">First year <strong>${h(bpMoney(t.firstYear))}</strong> · then ${h(bpMoney(t.monthly))}/mo ·
        financed: ${h(bpSession().pay.mode)}</p>
      <p class="helper" style="font-size:10px;">Loan interest and the alternatives are not on this screen — they
        belong to the options and financing steps. Resale is nowhere in the tool at all.</p>
    </div>
    ${renderBpAdminCommon()}`;
}
