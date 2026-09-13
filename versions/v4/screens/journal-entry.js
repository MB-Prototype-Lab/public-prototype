// ─── Money Journal — entry ───────────────────────────────────────────────────
// TAB: None | NAV BAR: Hidden — full-bleed, one question at a time
//
// PURPOSE
// The input point the whole prototype exists to test. Four structured questions
// (D11), then a free-text box that is silently discarded (D12).
//
// NAVIGATION
//   Entry: home task (money_journal / subscription_confirm) or "add another"
//   Exit:  last question → journalConfirm; top-bar back cancels the session

function renderJournalEntry() {
  if (!state.journalSession) journalStart({});
  const s = state.journalSession;
  const q = journalCurrentQuestion();
  if (!q) return `<div class="card"><p class="helper">No questions available.</p></div>`;

  const structural = s.questions.filter(x => !x.alwaysLast).length;
  const stepOf = Math.min(s.qIndex + 1, structural);
  const isFree = q.type === "free_text";

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">
          ${isFree ? "One last thing" : `Question ${stepOf} of ${structural}`}
        </p>
        <div class="journal-progress" aria-hidden="true">
          ${s.questions.filter(x => !x.alwaysLast).map((_, i) => `
            <span class="journal-pip ${i <= s.qIndex ? "on" : ""}"></span>
          `).join("")}
        </div>
        <h1 class="title" style="font-size:21px;margin:12px 0 0;">${h(q.prompt)}</h1>
        ${q.id === "q_watched" && s.focusQuestionId === "q_watched" ? `
          <p class="helper" style="margin:8px 0 0;">
            Haven't heard about Hulu in a while — anything on it lately?
          </p>` : ""}
      </div>

      <div class="journal-body">
        ${renderJournalInput(q, s)}
      </div>

      <div class="journal-foot">
        ${s.qIndex > 0
          ? `<button class="button secondary" type="button" onclick="journalPrev()">Back</button>`
          : `<span></span>`}
        <!-- id lets journalSetNumber repaint the label without a re-render:
             the amount input commits on blur, and a full render() there would
             destroy this button before its own click could land. -->
        <button class="button" type="button" id="journalNextBtn" onclick="journalNext()">
          ${journalNextLabel(q, s)}
        </button>
      </div>
    </div>
  `;
}

// "Skip" is a promise that nothing is being recorded, so it must stop saying
// that the moment the question has an answer.
function journalNextLabel(q, s) {
  if (journalIsLastQuestion()) return "Review";
  return journalAnswered(q, s) ? "Next" : "Skip";
}

function journalAnswered(q, s) {
  const a = s.answers[q.id];
  if (q.type === "multi_select")  return Array.isArray(a) && a.length > 0;
  if (q.type === "single_select") return a != null;
  if (q.type === "fill_number")   return !!(a && a.amount);
  return true;
}

function renderJournalInput(q, s) {
  // ── multi_select: several may be picked. Richer than "multiple choice" —
  // breakfast can be BOTH "ate at home" and "coffee out".
  if (q.type === "multi_select") {
    const picked = Array.isArray(s.answers[q.id]) ? s.answers[q.id] : [];
    // Options can be derived from an earlier answer (journalQuestionOptions),
    // so "watch anything?" lists the services this person actually pays for.
    return `
      <p class="helper" style="margin:0 0 10px;">Pick as many as apply.</p>
      <div class="journal-options">
        ${journalQuestionOptions(q).map((o, i) => {
          const on = picked.indexOf(i) !== -1;
          // The checkbox is the only thing that distinguishes this from a
          // single_select — the button markup is otherwise identical, so
          // "pick as many as apply" was a claim the UI never backed up.
          return `
          <button class="journal-opt opt-check ${on ? "picked" : ""}"
                  type="button" role="checkbox" aria-checked="${on ? "true" : "false"}"
                  onclick="journalToggleOption('${q.id}', ${i})">
            <span class="journal-opt-label">${h(o.label)}</span>
            ${journalOptionHint(q, o)}
            <span class="opt-check-box" aria-hidden="true">${on ? "✓" : ""}</span>
          </button>`;
        }).join("")}
      </div>
    `;
  }

  if (q.type === "single_select") {
    const picked = s.answers[q.id];
    return `
      <div class="journal-options">
        ${journalQuestionOptions(q).map((o, i) => `
          <button class="journal-opt ${picked === i ? "picked" : ""}"
                  type="button" onclick="journalSetSingle('${q.id}', ${i})">
            <span class="journal-opt-label">${h(o.label)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  // ── fill_number, optionally with a category picker. This IS the "dropdown"
  // the prose mentions — a modifier on the number question, not its own type.
  if (q.type === "fill_number") {
    const a = s.answers[q.id] || {};
    return `
      <div class="input-group">
        <label>Amount</label>
        <input type="number" min="0" step="0.01" inputmode="decimal"
               placeholder="${h(q.placeholder || "")}"
               value="${a.amount != null ? h(a.amount) : ""}"
               oninput="journalSetNumber('${q.id}','amount',this.value)"
               onchange="journalSetNumber('${q.id}','amount',this.value)">
      </div>
      ${q.categoryDropdown ? `
        <div class="input-group">
          <label>What was it for?</label>
          <select onchange="journalSetNumber('${q.id}','category',this.value)">
            <option value="">Choose a category</option>
            ${CATEGORIES.map(c => `
              <option value="${h(c)}" ${a.category === c ? "selected" : ""}>${h(catLabel(c))}</option>
            `).join("")}
          </select>
        </div>` : ""}
      ${q.skippable ? `<p class="helper">Approximate is fine — you can skip this.</p>` : ""}
    `;
  }

  // ── free_text (D12): accepts anything, including attachments. Not parsed,
  // not surfaced on the confirmation screen, not acknowledged. It exists so
  // testers experience the affordance.
  return `
    <textarea class="journal-freetext" rows="7"
              placeholder="${h(q.placeholder || "")}"
              onchange="journalSetFreeText(this.value)">${h(s.freeText)}</textarea>
    <div class="journal-attach">
      ${(q.attachments || []).map(kind => `
        <button class="journal-attach-btn" type="button" onclick="journalAddAttachment('${h(kind)}')">
          ${kind === "image" ? "🖼" : kind === "camera" ? "📷" : "🎙"}
          <span>${kind === "voice" ? "Voice" : kind === "camera" ? "Camera" : "Image"}</span>
        </button>
      `).join("")}
    </div>
    ${s.attachments.length
      ? `<p class="helper" style="margin-top:10px;">${s.attachments.length} attached.</p>`
      : ""}
  `;
}

// Estimates come from the persona profile (D14). "Already in your groceries"
// is the cash-flow rule made visible (D15) — that money was captured at the
// supermarket, so the entry is $0 rather than a guess at a slice of toast.
function journalOptionHint(q, o) {
  if (q.signalOnly) return "";
  if (o.zeroReason === "already_purchased")
    return `<span class="journal-opt-hint">$0 · already in your groceries</span>`;
  if (typeof o.estimate === "number")
    return `<span class="journal-opt-hint">about ${budgetFmt(o.estimate)}</span>`;
  return "";
}

// The statement-photo question is a DEMAND TEST — nothing uploads and nothing
// is analysed, so the only output is what people answered. That has to be
// visible somewhere or the test produces no result.
function renderJournalDemandAdmin() {
  const prof = state.journalProfile || {};
  const log = Array.isArray(prof.statementInterest) ? prof.statementInterest : [];
  const tally = log.reduce((m, s) => { m[s] = (m[s] || 0) + 1; return m; }, {});
  const streaming = Array.isArray(prof.streaming) ? prof.streaming : [];
  const week = Array.isArray(prof.statementWeek) ? prof.statementWeek[0] : null;

  return `
    <div class="admin-card">
      <p class="admin-card-title">Setup answers &amp; demand test</p>
      <div class="helper" style="line-height:1.8;">
        Pays for: <strong>${streaming.length ? h(streaming.join(", ")) : "—"}</strong>
        ${streaming.length ? "" : ` <em>(q_watched stays locked until answered)</em>`}<br>
        Statements arrive: <strong>${week ? h(week) : "—"}</strong>
        ${week ? "" : ` <em>(q_statement_photo stays locked)</em>`}
      </div>
      <div class="input-group" style="margin-top:10px;">
        <label>Statement-photo appetite (${log.length} answer${log.length === 1 ? "" : "s"})</label>
        <div class="helper" style="line-height:1.8;">
          ${log.length
            ? Object.keys(tally).map(k => `${h(k)} × <strong>${tally[k]}</strong>`).join(" · ")
            : "Not asked yet."}
          ${(tally.not_yet || 0) >= 2
            ? `<br><em>Repeated "not yet" — the stated week may be wrong.</em>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderJournalEntryAdmin() {
  const s = state.journalSession;
  return renderJournalDemandAdmin() + `
    <div class="admin-card">
      <p class="admin-card-title">Journal Session</p>
      ${!s ? `<p class="helper">No active session.</p>` : `
        <p class="helper">Day ${journalDayIndex()} · question ${s.qIndex + 1} of ${s.questions.length}</p>
        <div class="input-group">
          <label>Selected questions (priority order)</label>
          <div class="helper" style="line-height:1.7;">
            ${s.questions.map(q => `${h(q.id)} <em>(p${q.priority})</em>`).join("<br>")}
          </div>
        </div>
        <div class="input-group">
          <label>Coffee run length (fires q_breakfast_habit at 5)</label>
          <div class="helper">${journalCoffeeRunLength()}</div>
        </div>
      `}
      <div class="input-group">
        <label>Cooldowns (question → day last asked)</label>
        <div class="helper" style="line-height:1.7;">
          ${Object.keys(state.journalAsked).length
            ? Object.keys(state.journalAsked).map(k => `${h(k)} → day ${state.journalAsked[k]}`).join("<br>")
            : "none yet"}
        </div>
      </div>
      <button class="button secondary full" type="button"
              onclick="state.journalSession=null;journalStart({});render()">Restart Session</button>
    </div>
  `;
}
