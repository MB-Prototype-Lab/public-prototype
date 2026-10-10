// ─── Big Purchase — leasing (owner, 2026-10-03) ───────────────────────────────
// Lease is a third way to pay, on the LAST screen only ("Your car"): Loan, Cash
// or Lease. It does not touch the loan/cash engine (bpStack) or any earlier
// figure; the finder's cost table stays loan-based, and the flag `pay.leasing`
// is the only thing that switches this screen to lease figures.
//
// The monthly is the standard lease formula, an ESTIMATE (`_prototype`):
//   capitalised cost = price - what is paid at signing
//   residual         = price x a residual share that falls with a longer term
//                      and with more miles a year
//   depreciation     = (capitalised cost - residual) / term
//   finance charge   = (capitalised cost + residual) x money factor
//   money factor     = the credit tier's APR / 2400 (the usual rule of thumb)
//   payment          = (depreciation + finance charge) x (1 + sales tax rate)
// A lease is a new-car product here: for a used car the option is off.

const BP_LEASE_TERMS = [24, 36, 48];
const BP_LEASE_MILES = [10000, 12000, 15000];
const BP_LEASE_DUE   = [0, 1000, 2500, 5000];
const BP_LEASE_RESIDUAL = { 24: 0.64, 36: 0.58, 48: 0.50 };   // at 12,000 miles a year

function bpLeaseSet() {
  const p = bpSession().pay;
  if (p.leaseTerm == null) p.leaseTerm = 36;
  if (p.leaseMiles == null) p.leaseMiles = 12000;
  if (p.leaseDue == null) p.leaseDue = 2500;
  return p;
}

/** A lease is only offered on a new car. */
function bpLeaseAvailable(card) {
  return !!card && card.inputs.condition !== "used";
}

/** True when this screen should be showing lease figures. */
function bpLeasing(card) {
  const c = card || bpSelectedCard();
  return !!bpSession().pay.leasing && bpLeaseAvailable(c);
}

function bpLeaseFigures(card) {
  const p = bpLeaseSet();
  const st = bpStack(card);
  const price = st.price;
  const term = p.leaseTerm;
  const mf = (Number(st.apr) || 0) / 2400;
  const resid = Math.max(0.3, (BP_LEASE_RESIDUAL[term] || 0.58) - (p.leaseMiles - 12000) / 1000 * 0.01);
  const due = Math.min(p.leaseDue, price);
  const cap = Math.max(0, price - due);
  const residual = price * resid;
  const base = (cap - residual) / term + (cap + residual) * mf;
  const taxRow = st.lines.find(l => l.id === "salesTax");
  const taxRate = price > 0 && taxRow ? taxRow.value / price : 0;
  const payment = bpRound(Math.max(0, base) * (1 + taxRate), 5);
  const running = bpBreakdown(card).running.monthly;
  return {
    payment: payment, due: due, term: term, miles: p.leaseMiles, resid: resid, residual: residual,
    mf: mf, running: running, allIn: payment + running, total: due + payment * term
  };
}

/** Save-to-afford for a lease: what is paid at signing (plus any up-front extras), less what is saved. */
function bpLeaseAfford(card) {
  const base = bpSaveToAfford(card);
  const f = bpLeaseFigures(card);
  const s = bpSession();
  const step = ((bpData().plan || {}).roundTo) || 100;
  const cashNeeded = f.due + base.extras;
  const raw = Math.max(0, cashNeeded - base.saved);
  const toSave = raw > 0 ? Math.max(step, Math.round(raw / step) * step) : 0;
  return {
    stack: base.stack, cashNeeded: cashNeeded, extras: base.extras, saved: base.saved, tradeIn: 0,
    toSave: toSave, months: base.months, monthly: toSave ? Math.ceil(toSave / base.months) : 0,
    lease: f
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

function bpYcSetMode(mode) {
  const s = bpSession();
  if (mode === "lease") {
    if (!bpLeaseAvailable(bpSelectedCard())) return;
    s.pay.leasing = true;
    bpLog("bp_pay_mode", { mode: "lease" });
    render();
    return;
  }
  s.pay.leasing = false;
  bpSetPayMode(mode);
}

function bpYcOpenOpt(field) {
  bpSession().ui.ycOpt = field;
  bpOpenSheet("bpYcOpt");
}

function bpYcPickOpt(field, value) {
  const s = bpSession();
  if (field === "monthsOut") s.plan.monthsOut = value; else bpLeaseSet()[field] = value;
  s.ui.sheet = null;
  bpLog("bp_finance_changed", { field: field, to: value });
  render();
}

function renderBpYcOptSheet() {
  const s = bpSession();
  const p = bpLeaseSet();
  const field = s.ui.ycOpt;
  const defs = {
    leaseDue:   { title: "Due at signing", opts: BP_LEASE_DUE,   label: v => v ? bpMoney(v) : "$0" },
    leaseTerm:  { title: "Lease length",   opts: BP_LEASE_TERMS, label: v => v + " months" },
    leaseMiles: { title: "Miles a year",   opts: BP_LEASE_MILES, label: v => v.toLocaleString("en-US") + " miles" },
    monthsOut:  { title: "Save it by",     opts: Array.from({ length: 36 }, (_, i) => i + 1), label: v => bpPlanDateLabel(v) }
  };
  const d = defs[field];
  const cur = field === "monthsOut" ? s.plan.monthsOut : p[field];
  if (!d) return "";
  const body = `
    <div class="bp-sheet-list bpf-list" role="listbox">
      ${d.opts.map(v => `
        <button class="bp-opt ${cur === v ? "on" : ""}" type="button" role="option" aria-selected="${cur === v}"
                onclick="bpYcPickOpt('${field}', ${v})">${h(d.label(v))}</button>`).join("")}
    </div>`;
  return renderBpSheetFrame(d.title, body);
}
