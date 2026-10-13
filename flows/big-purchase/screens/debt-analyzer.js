// --- Debt Analyzer Screen ----------------------------------------------------
// Full payoff planner comparing snowball, avalanche, equal distribution,
// and minimum-only (baseline) strategies across all included debt instruments.
//
// -- V2 SCREEN, PARKED OFF THE MAIN PATH (L14) --------------------------------
// Same standing as screens/my-debts.js: kept, reachable only from the admin jump
// list, and routed to by nothing in the five tabs or the daily tasks.
//
// -- IT COMPARES STRATEGIES, WHICH IS NOT THE SAME AS RECOMMENDING ONE ---------
// The simulation is arithmetic and the output is a table. If this screen is ever
// brought onto the main path, the copy has to be read against D26 first: naming
// which strategy clears a balance soonest is a fact, and telling someone to pick
// it is advice. The v3 surfaces that do something similar -- the lesson
// calculator's three scenarios -- label the arithmetic and stop there.
//
// Simulation: month-by-month, synchronous, capped at 360 months.
//   1. Accrue interest on all active debts.
//   2. Apply minimum payments.
//   3. Apply extra payment according to strategy order.
//   4. Record total remaining balance for the timeline graph.
//
// All four strategies run on every render. With ≤10 debts at 360 months cap
// this takes <2ms — no debounce needed.

// ─── Handlers ─────────────────────────────────────────────────────────────────

function toggleDebtInclusion(debtId) {
  state.debtAnalyzerIncluded[debtId] = !state.debtAnalyzerIncluded[debtId];
  render();
}

function adjustExtraPayment(delta) {
  state.debtAnalyzerExtraPayment = Math.max(0, (state.debtAnalyzerExtraPayment || 0) + delta);
  render();
}

function includeAllDebts() {
  state.budget.debts.forEach(function(d) { state.debtAnalyzerIncluded[d.id] = true; });
  render();
}

// ─── Simulation Engine ────────────────────────────────────────────────────────
function runPayoffSimulation(debts, extraPayment, strategy) {
  // Deep-clone so we don't mutate state
  var working = debts.map(function(d) {
    return {
      id:          d.id,
      name:        d.name,
      balance:     d.balance,
      apr:         d.apr,
      minPayment:  d.minPayment || 0,
      paidOffMonth: null
    };
  });

  var totalInterestPaid = 0;
  var timeline = [];   // [{month, totalBalance}]
  var month = 0;
  var MAX_MONTHS = 360;

  while (month < MAX_MONTHS) {
    // Check if all balances are zero
    var anyActive = working.some(function(w) { return w.balance > 0.005; });
    if (!anyActive) break;
    month++;

    var monthlyRate;
    // Step 1: Accrue interest
    working.forEach(function(w) {
      if (w.balance <= 0) return;
      monthlyRate = w.apr / 100 / 12;
      var interest = w.balance * monthlyRate;
      w.balance += interest;
      totalInterestPaid += interest;
    });

    // Step 2: Apply minimum payments
    working.forEach(function(w) {
      if (w.balance <= 0) return;
      var payment = Math.min(w.minPayment, w.balance);
      w.balance = Math.max(0, w.balance - payment);
      if (w.balance < 0.005 && w.paidOffMonth === null) {
        w.balance = 0;
        w.paidOffMonth = month;
      }
    });

    // Step 3: Apply extra payment according to strategy
    if (strategy !== "minimum" && extraPayment > 0) {
      var active = working.filter(function(w) { return w.balance > 0.005; });
      if (active.length > 0) {
        if (strategy === "snowball") {
          active.sort(function(a, b) { return a.balance - b.balance; });
        } else if (strategy === "avalanche") {
          active.sort(function(a, b) { return b.apr - a.apr; });
        }

        if (strategy === "equal") {
          var share = extraPayment / active.length;
          active.forEach(function(w) {
            w.balance = Math.max(0, w.balance - share);
            if (w.balance < 0.005 && w.paidOffMonth === null) {
              w.balance = 0;
              w.paidOffMonth = month;
            }
          });
        } else {
          // Sequential: pour extra payment down the sorted list
          var remaining = extraPayment;
          for (var i = 0; i < active.length && remaining > 0.005; i++) {
            var applied = Math.min(remaining, active[i].balance);
            active[i].balance = Math.max(0, active[i].balance - applied);
            remaining -= applied;
            if (active[i].balance < 0.005 && active[i].paidOffMonth === null) {
              active[i].balance = 0;
              active[i].paidOffMonth = month;
            }
          }
        }
      }
    }

    // Record timeline point
    var totalRemaining = working.reduce(function(s, w) { return s + w.balance; }, 0);
    timeline.push({ month: month, totalBalance: Math.max(0, totalRemaining) });
  }

  // Mark debts still carrying balance at end (hit 360-month cap)
  working.forEach(function(w) {
    if (w.balance > 0.005 && w.paidOffMonth === null) {
      w.neverPaidOff = true;
    }
  });

  var stillHasBalance = working.some(function(w) { return w.balance > 0.005; });

  return {
    strategy:        strategy,
    totalInterest:   Math.round(totalInterestPaid),
    monthsToPayoff:  stillHasBalance ? null : month,  // null = not paid off in 360 mo
    stillHasBalance: stillHasBalance,
    payoffOrder:     working.slice().sort(function(a, b) {
      if (a.paidOffMonth === null && b.paidOffMonth === null) return 0;
      if (a.paidOffMonth === null) return 1;
      if (b.paidOffMonth === null) return -1;
      return a.paidOffMonth - b.paidOffMonth;
    }),
    timeline:        timeline
  };
}

function runAllStrategies() {
  var included = state.budget.debts.filter(function(d) {
    return state.debtAnalyzerIncluded[d.id] !== false;
  });
  if (!included.length) return null;
  var extra = state.debtAnalyzerExtraPayment || 0;
  return {
    snowball:  runPayoffSimulation(included, extra, "snowball"),
    avalanche: runPayoffSimulation(included, extra, "avalanche"),
    equal:     runPayoffSimulation(included, extra, "equal"),
    minimum:   runPayoffSimulation(included, 0,     "minimum")
  };
}

// ─── Strategy metadata ────────────────────────────────────────────────────────
var STRATEGY_META = {
  snowball:  { name: "Snowball",       tagline: "Pay smallest balance first — quick wins build momentum.",         color: "var(--accent)" },
  avalanche: { name: "Avalanche",      tagline: "Attack the highest APR first — saves the most money overall.",   color: "var(--good)"   },
  equal:     { name: "Equal Split",    tagline: "Divide extra payment evenly across all active debts.",            color: "var(--warn)"   },
  minimum:   { name: "Minimum Only",   tagline: "Pay only the minimums — this is your baseline to beat.",          color: "var(--muted)"  }
};

// ─── SVG Charts ───────────────────────────────────────────────────────────────
function _renderInterestBarChart(analyses) {
  var keys    = ["snowball","avalanche","equal","minimum"];
  var values  = keys.map(function(k) { return analyses[k].totalInterest; });
  var maxVal  = Math.max.apply(null, values) || 1;
  var W       = 300;
  var barH    = 18;
  var gap     = 10;
  var labelW  = 90;
  var chartW  = W - labelW - 10;
  var H       = keys.length * (barH + gap) - gap + 4;

  var bars = keys.map(function(k, i) {
    var val    = analyses[k].totalInterest;
    var barW   = Math.max(2, Math.round(val / maxVal * chartW));
    var y      = i * (barH + gap);
    var meta   = STRATEGY_META[k];
    var label  = val > 0 ? budgetFmt(val) : "$0";
    return `
      <text x="0" y="${y + barH - 3}" font-size="11" style="fill:var(--muted)" font-family="Arial,sans-serif"
            font-weight="bold">${h(meta.name)}</text>
      <rect x="${labelW}" y="${y}" width="${barW}" height="${barH}"
            rx="4" style="fill:${meta.color}" opacity="0.85"/>
      <text x="${labelW + barW + 6}" y="${y + barH - 3}" font-size="11"
            style="fill:var(--text)" font-family="Arial,sans-serif" font-weight="bold">${h(label)}</text>
    `;
  }).join("");

  return `
    <div class="debt-graph-wrap">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;max-width:100%;">
        ${bars}
      </svg>
    </div>
  `;
}

function _renderBalanceTimeline(analyses) {
  var keys      = ["snowball","avalanche","equal","minimum"];
  var W         = 300;
  var H         = 160;
  var padL      = 52;
  var padB      = 24;
  var padR      = 10;
  var padT      = 10;
  var chartW    = W - padL - padR;
  var chartH    = H - padT - padB;

  // Find x/y range
  var maxMonths = 0;
  var startBal  = 0;
  keys.forEach(function(k) {
    var r = analyses[k];
    if (r.timeline.length > maxMonths) maxMonths = r.timeline.length;
    if (r.timeline.length && r.timeline[0].totalBalance > startBal)
      startBal = r.timeline[0].totalBalance;
  });
  if (!maxMonths || !startBal) return "";

  var xScale = function(m) { return padL + (m / maxMonths) * chartW; };
  var yScale = function(b) { return padT + (1 - b / startBal) * chartH; };

  // Axis labels
  var yLabels = [startBal, 0].map(function(v) {
    var y = yScale(v);
    var label = v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v);
    return `<text x="${padL - 4}" y="${y + 4}" font-size="9" style="fill:var(--muted)"
              text-anchor="end" font-family="Arial,sans-serif">${h(label)}</text>`;
  }).join("");

  // Month tick labels at start and end
  var xLabels = [0, maxMonths].map(function(m, i) {
    var x = xScale(m);
    var label = m === 0 ? "Now" : m + "mo";
    return `<text x="${x}" y="${H - 4}" font-size="9" style="fill:var(--muted)"
              text-anchor="${i === 0 ? "start" : "end"}" font-family="Arial,sans-serif">${h(label)}</text>`;
  }).join("");

  // Axes
  var axes = `
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}"
          style="stroke:var(--line)" stroke-width="1"/>
    <line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}"
          style="stroke:var(--line)" stroke-width="1"/>
  `;

  // Lines
  var lines = keys.map(function(k) {
    var r    = analyses[k];
    var meta = STRATEGY_META[k];
    // Sample at most 120 points for performance (thin out long timelines)
    var step = Math.max(1, Math.floor(r.timeline.length / 120));
    var pts  = [];
    for (var i = 0; i < r.timeline.length; i += step) {
      var pt = r.timeline[i];
      pts.push(xScale(pt.month).toFixed(1) + "," + yScale(pt.totalBalance).toFixed(1));
    }
    // Always include final point
    if (r.timeline.length > 0) {
      var last = r.timeline[r.timeline.length - 1];
      pts.push(xScale(last.month).toFixed(1) + "," + yScale(last.totalBalance).toFixed(1));
    }
    return `<polyline points="${pts.join(" ")}" fill="none" style="stroke:${meta.color}"
                stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
  }).join("");

  // Legend
  var legendY = padT;
  var legend = keys.map(function(k, i) {
    var meta = STRATEGY_META[k];
    var lx   = padL + 6 + i * 68;
    return `
      <rect x="${lx}" y="${legendY}" width="14" height="4" rx="2" style="fill:${meta.color}" opacity="0.85"/>
      <text x="${lx + 18}" y="${legendY + 5}" font-size="9" style="fill:var(--muted)"
            font-family="Arial,sans-serif">${h(meta.name)}</text>
    `;
  }).join("");

  return `
    <div class="debt-graph-wrap">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;max-width:100%;">
        ${axes}${yLabels}${xLabels}
        <g transform="translate(0,0)">${legend}</g>
        ${lines}
      </svg>
    </div>
  `;
}

// ─── Strategy card ────────────────────────────────────────────────────────────
function _renderStrategyCard(key, result, isBest) {
  var meta     = STRATEGY_META[key];
  var payoff   = result.monthsToPayoff;
  var duration = payoff ? (payoff >= 12
    ? Math.floor(payoff / 12) + "y " + (payoff % 12) + "mo"
    : payoff + " mo")
    : "360+ mo";

  var payoffList = "";
  if (key !== "minimum" && key !== "equal") {
    var ordered = result.payoffOrder.filter(function(w) { return !w.neverPaidOff; }).slice(0, 4);
    if (ordered.length) {
      payoffList = `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line);">
          <div class="helper" style="margin-bottom:4px;">Payoff order</div>
          ${ordered.map(function(w, i) {
            var mo = w.paidOffMonth;
            var label = mo ? (mo >= 12 ? Math.floor(mo/12)+"y "+(mo%12)+"mo" : mo+"mo") : "—";
            return `<div style="font-size:11px;padding:2px 0;">${i+1}. ${h(w.name)} — month ${label}</div>`;
          }).join("")}
        </div>
      `;
    }
  }

  return `
    <div class="card${isBest ? " debt-strategy-best" : ""}"
         style="margin-bottom:12px;${isBest ? "border-width:2px;" : ""}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div>
          <div class="strategy-pill--${key}" style="font-size:14px;font-weight:850;">${h(meta.name)}</div>
          <div class="helper" style="margin-top:2px;line-height:1.4;">${h(meta.tagline)}</div>
        </div>
        ${isBest ? `<span class="debt-best-badge">Best choice</span>` : ""}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div>
          <div class="helper">Total interest</div>
          <div style="font-size:16px;font-weight:850;">$${result.totalInterest.toLocaleString()}</div>
        </div>
        <div>
          <div class="helper">Time to debt-free</div>
          <div style="font-size:16px;font-weight:850;">${h(duration)}</div>
        </div>
      </div>
      ${payoffList}
    </div>
  `;
}

// ─── Prose section ────────────────────────────────────────────────────────────
function _renderDebtAnalyzerProse(analyses) {
  var av   = analyses.avalanche;
  var sn   = analyses.snowball;
  var mn   = analyses.minimum;
  var avSave   = mn.totalInterest - av.totalInterest;
  var snSave   = mn.totalInterest - sn.totalInterest;
  var avVsSn   = av.totalInterest - sn.totalInterest;

  var text;
  if (mn.stillHasBalance) {
    text = "At minimum payments only, your debt balance will still be growing in 30 years — "
      + "the interest charges outpace the payments. Any extra payment, even $50/month, "
      + "makes a dramatic difference. The Avalanche strategy would save you $"
      + avSave.toLocaleString() + " in interest.";
  } else if (Math.abs(avVsSn) <= 200) {
    text = "Avalanche and Snowball are almost identical for your debt mix (within $"
      + Math.abs(Math.round(avVsSn)).toLocaleString() + "). "
      + "Go with whichever keeps you motivated. Snowball gives you faster individual "
      + "wins; Avalanche is technically optimal but the difference is small here.";
  } else if (avVsSn < -500) {
    // Avalanche saves ≥$500 more
    text = "Avalanche is the clear winner here. By attacking your highest-rate debt first, "
      + "you'd save $" + Math.abs(Math.round(avVsSn)).toLocaleString()
      + " more in interest than the Snowball method, and pay off your debt "
      + (av.monthsToPayoff && sn.monthsToPayoff ? Math.abs(sn.monthsToPayoff - av.monthsToPayoff) + " months sooner. " : ". ")
      + "That's real money — the high-APR debt is costing you the most.";
  } else {
    var avMo = av.monthsToPayoff;
    var mnMo = mn.monthsToPayoff;
    var moSooner = avMo && mnMo ? mnMo - avMo : null;
    text = "Adding $" + (state.debtAnalyzerExtraPayment || 0).toLocaleString() + "/month "
      + "above minimums saves you $" + avSave.toLocaleString() + " in interest "
      + (moSooner ? "and gets you debt-free " + moSooner + " months sooner " : "")
      + "compared to paying minimums only. "
      + "The Avalanche strategy maximizes those savings.";
  }

  return `
    <div class="card" style="margin-bottom:14px;">
      <div class="section-title" style="margin-bottom:8px;">What this means for you</div>
      <p style="font-size:13px;line-height:1.6;margin:0;">${h(text)}</p>
    </div>
  `;
}

// ─── Screen renderer ──────────────────────────────────────────────────────────
function renderDebtAnalyzer() {
  var debts   = state.budget.debts || [];
  var extra   = state.debtAnalyzerExtraPayment || 0;

  // Ensure inclusion map is initialized
  if (!state.debtAnalyzerIncluded) state.debtAnalyzerIncluded = {};
  debts.forEach(function(d) {
    if (state.debtAnalyzerIncluded[d.id] === undefined) {
      state.debtAnalyzerIncluded[d.id] = true;
    }
  });

  var analyses = debts.length ? runAllStrategies() : null;
  var included = debts.filter(function(d) { return state.debtAnalyzerIncluded[d.id] !== false; });

  // Determine best strategy (lowest interest, excluding minimum-only)
  var bestKey = null;
  if (analyses) {
    var candidates = ["snowball","avalanche","equal"];
    bestKey = candidates.reduce(function(best, k) {
      if (!best) return k;
      return analyses[k].totalInterest < analyses[best].totalInterest ? k : best;
    }, null);
  }

  return `
    <!-- Header -->
    <div class="card" style="margin-bottom:14px;">
<h1 class="title" style="margin:0;font-size:20px;">Debt Analyzer</h1>
      <p class="subtitle" style="margin:4px 0 0;">Compare payoff strategies side by side.</p>
    </div>

    <!-- Debt toggles -->
    <div class="card" style="margin-bottom:14px;">
      <div class="section-title" style="margin-bottom:10px;">Include in Analysis</div>
      ${debts.length ? debts.map(function(d) {
        var meta    = DEBT_TYPE_META[d.type] || { icon: "💰" };
        var on      = state.debtAnalyzerIncluded[d.id] !== false;
        var toggleId = "toggle_" + d.id;
        return `
          <div class="row" style="padding:6px 0;border-bottom:1px solid var(--line);">
            <div style="flex:1;min-width:0;">
              <span style="font-size:16px;margin-right:6px;">${meta.icon}</span>
              <span style="font-size:13px;font-weight:850;">${h(d.name)}</span>
              <span class="helper" style="margin-left:6px;">${budgetFmt(d.balance)} · ${d.apr}% APR</span>
            </div>
            <button id="${h(toggleId)}"
                    class="button secondary" style="font-size:11px;padding:6px 12px;${on ? "background:var(--accent-soft);border-color:var(--accent);color:var(--accent);" : ""}"
                    type="button"
                    onclick="toggleDebtInclusion('${h(d.id)}')">
              ${on ? "Included ✓" : "Excluded"}
            </button>
          </div>
        `;
      }).join("") : `<p class="helper">No debts added yet. <button class="button secondary" style="font-size:12px;padding:6px 12px;" type="button" onclick="go('myDebts')">Add debts →</button></p>`}
    </div>

    ${!included.length ? `
      <div class="card" style="text-align:center;padding:24px;margin-bottom:14px;">
        <p style="font-size:13px;font-weight:850;margin:0 0 4px;">Include at least one debt</p>
        <p class="helper" style="margin:0;">Toggle debts above to include them in the simulation.</p>
      </div>
    ` : ""}

    ${included.length ? `
      <!-- Extra payment control -->
      <div class="card" style="margin-bottom:14px;">
        <div class="section-title" style="margin-bottom:4px;">Extra Monthly Payment</div>
        <p class="helper" style="margin:0 0 12px;">Amount above minimums — distributed by each strategy.</p>
        <div class="budget-stepper">
          <button class="budget-stepper-btn" type="button"
                  onclick="adjustExtraPayment(-50)">−</button>
          <input class="budget-stepper-input" type="number" min="0"
                 value="${extra}"
                 oninput="state.debtAnalyzerExtraPayment=parseInt(this.value)||0;debouncedRender()">
          <button class="budget-stepper-btn" type="button"
                  onclick="adjustExtraPayment(50)">+</button>
        </div>
        <p class="helper" style="margin-top:8px;">
          Total monthly payment: ${budgetFmt(included.reduce(function(s,d){return s+(d.minPayment||0);},0) + extra)}
          <span style="color:var(--muted);">(minimums + extra)</span>
        </p>
      </div>

      <!-- Strategy cards -->
      <div class="section-title" style="margin:0 0 10px;">Strategy Comparison</div>
      ${analyses ? ["snowball","avalanche","equal","minimum"].map(function(k) {
        return _renderStrategyCard(k, analyses[k], k === bestKey);
      }).join("") : ""}

      ${analyses ? `
        <!-- Graphs -->
        <div class="card" style="margin-bottom:14px;">
          <div class="section-title" style="margin-bottom:12px;">Total Interest Paid by Strategy</div>
          ${_renderInterestBarChart(analyses)}

          <div class="section-title" style="margin:16px 0 12px;">Balance Over Time</div>
          <p class="helper" style="margin:0 0 10px;">How your total debt balance decreases under each strategy.</p>
          ${_renderBalanceTimeline(analyses)}
        </div>

        <!-- Prose -->
        ${_renderDebtAnalyzerProse(analyses)}
      ` : ""}
    ` : ""}
  `;
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function renderDebtAnalyzerAdmin() {
  var extra = state.debtAnalyzerExtraPayment || 0;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Analyzer Controls</p>
      <div class="input-group">
        <label>Extra monthly payment ($)</label>
        <input type="number" min="0" value="${extra}"
               oninput="state.debtAnalyzerExtraPayment=parseInt(this.value)||0;debouncedRender()">
      </div>
      <div class="input-group">
        <label>Include all debts</label>
        <button class="button secondary" style="font-size:11px;" type="button"
                onclick="includeAllDebts()">
          Reset to All Included
        </button>
      </div>
    </div>
  `;
}
