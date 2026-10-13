// ─── Money Journal — confirmation (D14) ──────────────────────────────────────
// TAB: None | NAV BAR: Hidden
//
// "Everything structured converts here. For each detected event: category, an
// estimated cost from the persona profile, and a slider to move the estimate
// toward the real number. Then confirm and submit."
//
// Derives ENTIRELY from structured answers. The free-text box contributes
// nothing and is never shown here (D12).
//
// -- WHY THIS SCREEN EXISTS AT ALL --------------------------------------------
// The journal never asks for a figure. It asks what you did -- "coffee out",
// "picked something up on the way home" -- and turns each answer into an
// estimate from the persona profile. Estimates are a guess, so nothing is
// written until the tester has seen the numbers and had a chance to move them.
// This is the confirm step that makes that guess honest.
//
// -- THREE KINDS OF ROW, AND THE MIDDLE ONE IS THE INTERESTING ONE ------------
//   SPEND   -- an amount and a slider. The number is editable, and the label
//              says whether it is still an estimate or has been adjusted.
//   NO COST -- things that happened but cost nothing THIS entry. Toast from a
//              loaf you already bought is not a new expense; the money left
//              when the groceries were paid for (D15, cash flow). Showing them
//              as $0 rather than hiding them is what makes that rule visible
//              instead of looking like a missed question.
//   NOTED   -- signal-only answers with no money attached. They shape later
//              questions (journalProfile) rather than the ledger.
//
// Submitting writes into month-to-date, which is what moves the comparison, the
// daily update and My Progress (L17) -- so Confirm is the moment the
// prototype's whole input-to-observation loop closes.

function renderJournalConfirm() {
  const s = state.journalSession;
  if (!s) return `<div class="card"><p class="helper">Nothing to confirm.</p></div>`;
  // Entries are built once and cached on the session: rebuilding on every
  // render would throw away the tester's slider adjustments.
  const entries = s.entries || journalBuildEntries();
  const spend = entries.filter(e => e.amount > 0);
  const zero  = entries.filter(e => e.amount === 0);

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">Here's what I got</h1>
        <p class="helper" style="margin:6px 0 0;">
          Estimates from your profile. Drag any of them toward the real number.
        </p>
      </div>

      <div class="journal-body">
        ${spend.length === 0 && zero.length === 0 ? `
          <div class="card">
            <p class="task-title" style="margin:0 0 4px;">Nothing to record</p>
            <p class="helper" style="margin:0;">
              Nothing you told me costs anything — that's a good day.
            </p>
          </div>
        ` : ""}

        ${spend.map(e => `
          <div class="card journal-entry-card">
            <div class="row" style="align-items:baseline;margin-bottom:2px;">
              <p class="task-title" style="margin:0;">${h(e.label)}</p>
              <p class="journal-amount" id="jAmt${h(e.id)}">${budgetFmt(e.amount)}</p>
            </div>
            <p class="helper" style="margin:0 0 10px;">
              ${h(catLabel(e.category))}${e.estimated && !e.adjusted ? " · estimated" : ""}${e.adjusted ? " · adjusted" : ""}
            </p>
            <!-- The ceiling is derived from baseAmount, the ORIGINAL estimate,
                 not from e.amount, which is what the drag changes. A
                 value-derived max moves under the thumb as you drag it and
                 makes the handle recoil on release. Same trap as
                 budgetSliderMax; floored at 20 so a tiny estimate still has a
                 usable track. -->
            <input class="journal-slider" type="range" min="0"
                   max="${Math.max(Math.ceil((e.baseAmount != null ? e.baseAmount : e.amount) * 2.5), 20)}" step="0.5"
                   value="${e.amount}"
                   oninput="journalAdjustEntry('${e.id}', this.value)"
                   aria-label="Adjust ${h(e.label)}">
          </div>
        `).join("")}

        ${zero.length ? `
          <div class="card">
            <p class="task-title" style="margin:0 0 6px;">No cost</p>
            ${zero.map(e => `
              <div class="row" style="margin-bottom:4px;">
                <span class="helper">${h(e.label)}</span>
                <span class="helper">
                  ${e.zeroReason === "already_purchased" ? "already in your groceries" : "$0"}
                </span>
              </div>
            `).join("")}
            <p class="helper" style="margin:8px 0 0;font-size:10px;">
              Cash flow only — food you already bought was counted at the shop.
            </p>
          </div>
        ` : ""}

        ${s.signals && s.signals.length ? `
          <div class="card">
            <p class="task-title" style="margin:0 0 4px;">Noted</p>
            <p class="helper" style="margin:0;">
              ${h(s.signals.join(", "))} — I'll remember you mentioned that.
            </p>
          </div>
        ` : ""}
      </div>

      <div class="journal-foot journal-foot-total">
        <div>
          <p class="helper" style="margin:0;">Total</p>
          <p class="journal-total">${budgetFmt(journalSessionTotal())}</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="button secondary" type="button" onclick="navBack()">Back</button>
          <button class="button" type="button" onclick="journalSubmit()">Confirm</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Post-submit ─────────────────────────────────────────────────────────────
// D13 — one prompted entry per day PLUS a visible entry point for additional
// entries the same day. Like filling out several pages of a physical journal.
// The second entry asks DIFFERENT questions, because submitting set cooldowns.

// -- THE PAYOFF SCREEN --------------------------------------------------------
// It shows observations recomputed from what was just submitted, which is the
// point of the whole loop: you told it something, and the figures moved. The
// observations are DERIVED at render time, never stored, so they always reflect
// the entry that just landed rather than a snapshot from before it.
//
// Capped at two. Every observation the engine produces is true, but a wall of
// them reads as nagging rather than as a read on the day.

function renderJournalDone() {
  // Two families, deduped: how the plan is going, and how the month is going.
  // A single observation can belong to both, and showing it twice would look
  // like the engine repeating itself.
  const obs = observationsFor("budget_comparison").concat(observationsFor("progress"))
    .filter((o, i, a) => a.indexOf(o) === i)
    .slice(0, 2);

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <h1 class="title" style="font-size:21px;margin:0;">Got it</h1>
        <p class="helper" style="margin:6px 0 0;">
          ${state.journalEntries.length} entr${state.journalEntries.length === 1 ? "y" : "ies"} recorded so far.
        </p>
      </div>

      <div class="journal-body">
        ${obs.map(o => `
          <div class="card">
            <p class="task-title" style="margin:0 0 4px;">${h(observationHeadline(o))}</p>
            <p class="helper" style="margin:0;">${h(observationDetail(o))}</p>
          </div>
        `).join("")}

        <div class="card">
          <p class="task-title" style="margin:0 0 4px;">Add another page?</p>
          <p class="helper" style="margin:0 0 10px;">
            You can write as many times a day as you like — I'll ask about
            something different.
          </p>
          <button class="button secondary full" type="button"
                  onclick="journalStartAnother()">Write another entry</button>
        </div>
      </div>

      <div class="journal-foot">
        <span></span>
        <button class="button" type="button" onclick="navGoHome()">Done</button>
      </div>
    </div>
  `;
}

function journalStartAnother() {
  journalStart({});
  go("journalEntry");
}

function renderJournalConfirmAdmin() {
  const s = state.journalSession;
  return `
    <div class="admin-card">
      <p class="admin-card-title">Derived Entries</p>
      ${!s || !s.entries ? `<p class="helper">No session.</p>` : `
        <div class="helper" style="line-height:1.8;">
          ${s.entries.length ? s.entries.map(e =>
            `${h(e.category || "—")} · ${budgetFmt(e.amount)}${e.zeroReason ? " (" + h(e.zeroReason) + ")" : ""}`
          ).join("<br>") : "none"}
        </div>
        <div class="input-group" style="margin-top:10px;">
          <label>Signals (no money)</label>
          <div class="helper">${(s.signals || []).join(", ") || "none"}</div>
        </div>
        <div class="input-group">
          <label>Free text — discarded, never parsed (D12)</label>
          <div class="helper">${s.freeText ? s.freeText.length + " chars, dropped at submit" : "empty"}</div>
        </div>
      `}
      <div class="input-group">
        <label>Month-to-date, Dining out</label>
        <div class="helper">${budgetFmt(catValue(state.mtd, "Dining out"))}</div>
      </div>
    </div>
  `;
}

function renderJournalDoneAdmin() {
  return `
    <div class="admin-card">
      <p class="admin-card-title">After Submit</p>
      <div class="input-group">
        <label>Entries recorded</label>
        <div class="helper">${state.journalEntries.length}</div>
      </div>
      <div class="input-group">
        <label>Goal events emitted (Phase 5 consumes)</label>
        <div class="helper">${state.goalEvents.length}</div>
      </div>
      <div class="input-group">
        <label>Observations, recomputed</label>
        <div class="helper" style="line-height:1.7;">
          ${(state.observations || []).map(o =>
            `${h(o.id)}${o.gapPercent != null ? " → " + o.gapPercent + "%" : ""}`).join("<br>")}
        </div>
      </div>
    </div>
  `;
}
