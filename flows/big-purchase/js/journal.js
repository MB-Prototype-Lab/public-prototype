// ─── Money Journal engine (D11–D15) ──────────────────────────────────────────
// The deepest build (D05) and the thing user testing is actually about: do
// people engage with the input point? Everything downstream — the budget
// comparison, the daily update, My Progress — consumes what this produces.
//
// Structured questions carry the parsing load (D11). There is no NLP here and
// there must never be: the free-text box is decoration (D12).

// Six days of history are seeded, so the tester's entry is day 7. Journal
// questions are previous-day recall, so day 7's entry describes "yesterday".
function journalDayIndex() {
  return (SEED_STATE.journalHistory ? SEED_STATE.journalHistory.length : 0) + 1;
}

// ── Question selection ───────────────────────────────────────────────────────
// 4 per entry by priority, skipping anything on cooldown, then free text
// appended OUTSIDE that count.

function journalOnCooldown(q) {
  const asked = state.journalAsked[q.id];
  if (asked == null) return false;
  return (journalDayIndex() - asked) < (q.cooldownDays || 0);
}

// A triggered question is excluded until its pattern fires; once it does it
// competes on priority like everything else rather than jumping the queue.
function journalTriggerFires(q) {
  if (q.triggeredBy !== "pattern_detected") return false;
  if (q.id === "q_breakfast_habit") return journalCoffeeRunLength() >= 5;
  return false;
}

// ── Durable answers: setup questions that unlock follow-ups ──────────────────
// Cooldowns record WHEN a question was asked; this records WHAT was answered,
// for the handful of questions whose answer has to outlive the entry. Two use
// it today: which streaming services you pay for (which becomes the option list
// for "watch anything?"), and roughly when your statements arrive.

/** Signals stored against a profile key, always an array. */
function journalProfileSignals(key) {
  if (!key || !state.journalProfile) return [];
  const v = state.journalProfile[key];
  return Array.isArray(v) ? v : (v == null ? [] : [v]);
}

/** Record a question's answers under its profileKey. Latest answer wins. */
function journalRecordProfile(q, signals) {
  if (!q || !q.profileKey) return;
  if (!state.journalProfile) state.journalProfile = {};
  const key = q.profileKey;
  // The demand-test question accumulates instead of replacing — the shape of
  // repeated answers IS the signal ("not yet" three times means something).
  if (key === "statementInterest") {
    const log = journalProfileSignals(key).slice();
    signals.forEach(s => log.push(s));
    state.journalProfile[key] = log;
    return;
  }
  state.journalProfile[key] = signals.slice();
}

/** A dependent question stays out of the pool until its setup question lands. */
function journalDependencyMet(q) {
  if (!q.dependsOn || !q.dependsOn.profileKey) return true;
  return journalProfileSignals(q.dependsOn.profileKey).length > 0;
}

/**
 * The options to show for a question.
 *
 * `optionsFrom` rebuilds the list from a profile key, so "watch anything?" asks
 * about the services this person actually pays for rather than a fixed list —
 * that is what makes the Hulu option (and the observation behind it) reachable.
 * Falls back to the authored options when the profile is empty, so a task
 * deep-link still shows a usable question.
 */
function journalQuestionOptions(q) {
  if (!q.optionsFrom) return q.options || [];
  const picked = journalProfileSignals(q.optionsFrom).filter(s => s);
  if (!picked.length) return q.options || [];
  const opts = picked.map(name => ({ label: name, signal: name }));
  opts.push({ label: "None of them", signal: null });
  return opts;
}

// "Coffee out five days running" — counted from the seeded history plus any
// coffee the tester has logged this session. All six seeded days mention it.
function journalCoffeeRunLength() {
  let run = 0;
  (state.journal || []).forEach(day => {
    if ((day.entries || []).some(e => /coffee/i.test(e.description || ""))) run++;
  });
  (state.journalEntries || []).forEach(e => {
    if (/coffee/i.test(e.label || "")) run++;
  });
  return run;
}

/**
 * The question sequence for one entry.
 * opts.focusQuestionId — a task deep-link (the Hulu task → q_watched).
 * That question is pinned first AND bypasses cooldown, or the task can route to
 * an entry that does not contain the question it exists to ask.
 */
function journalSelectQuestions(opts) {
  const o = opts || {};
  const cfg = JOURNAL_QUESTIONS.config;
  const all = JOURNAL_QUESTIONS.questions;

  const freeText = all.filter(q => q.alwaysLast);
  const pool = all.filter(q => !q.alwaysLast);

  const eligible = pool.filter(q => {
    if (q.id === o.focusQuestionId) return true;          // deep-link bypasses cooldown
    if (!journalDependencyMet(q)) return false;           // setup question not answered yet
    if (q.triggeredBy) return journalTriggerFires(q) && !journalOnCooldown(q);
    return !journalOnCooldown(q);
  });

  eligible.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Pin the deep-linked question to the front so the task's intent is obvious.
  if (o.focusQuestionId) {
    const i = eligible.findIndex(q => q.id === o.focusQuestionId);
    if (i > 0) eligible.unshift(eligible.splice(i, 1)[0]);
  }

  const picked = eligible.slice(0, cfg.questionsPerEntry || 4);

  // Free text is appended, not counted — it is question 5 of 4 (D12).
  return picked.concat(freeText);
}

// ── Session ──────────────────────────────────────────────────────────────────

function journalStart(opts) {
  const questions = journalSelectQuestions(opts);
  state.journalSession = {
    questions: questions,
    qIndex: 0,
    answers: {},
    freeText: "",
    attachments: [],
    entries: null,
    focusQuestionId: (opts && opts.focusQuestionId) || null
  };
  // q_balance pre-fills from the persona's self-reported balance so the field
  // is never blank (D19) — otherwise that seed value has no consumer at all.
  const bal = questions.find(q => q.id === "q_balance");
  if (bal) {
    state.journalSession.answers.q_balance = {
      amount: PERSONA.connectedAccounts.selfReportedBalance,
      category: null
    };
  }
  return state.journalSession;
}

function journalCurrentQuestion() {
  const s = state.journalSession;
  return s ? s.questions[s.qIndex] : null;
}

function journalIsLastQuestion() {
  const s = state.journalSession;
  return !!s && s.qIndex >= s.questions.length - 1;
}

// ── Answers ──────────────────────────────────────────────────────────────────
// multi_select  → array of option indices (several may be picked)
// single_select → one option index
// fill_number   → { amount, category }
// free_text     → string (never read again)

function journalToggleOption(qid, optIndex) {
  const a = state.journalSession.answers;
  const cur = Array.isArray(a[qid]) ? a[qid].slice() : [];
  const at = cur.indexOf(optIndex);
  if (at === -1) cur.push(optIndex); else cur.splice(at, 1);
  a[qid] = cur;
  render();
}

function journalSetSingle(qid, optIndex) {
  state.journalSession.answers[qid] = optIndex;
  render();
}

function journalSetNumber(qid, field, value) {
  const a = state.journalSession.answers;
  if (!a[qid] || typeof a[qid] !== "object") a[qid] = { amount: null, category: null };
  a[qid][field] = field === "amount" ? (value === "" ? null : Number(value)) : value;
  // Repaint just the footer label. This is the ONE answer setter that must not
  // call render(): the input commits on blur (onchange), which fires on
  // pointerdown — a full re-render there destroys the button being pressed and
  // the click never lands. Painting the label directly is the same trick
  // journalAdjustEntry uses for its amount readout.
  const btn = document.getElementById("journalNextBtn");
  const s = state.journalSession;
  if (btn && s) {
    const q = s.questions[s.qIndex];
    if (q) btn.textContent = journalNextLabel(q, s);
  }
}

function journalSetFreeText(value) {
  // D12 — stored on the session so the textarea keeps its value between
  // renders, then dropped at submit. Never parsed, never surfaced, never
  // acknowledged.
  state.journalSession.freeText = value;
}

// Attachment affordances are present and tappable and accept a file; nothing is
// processed (02-money-journal). Recording the name only so the UI can show it.
function journalAddAttachment(kind) {
  state.journalSession.attachments.push({ kind: kind, at: Date.now() });
  render();
}

function journalNext() {
  const s = state.journalSession;
  if (journalIsLastQuestion()) { journalBuildEntries(); go("journalConfirm"); return; }
  s.qIndex++;
  render();
}

function journalPrev() {
  const s = state.journalSession;
  if (s.qIndex > 0) { s.qIndex--; render(); }
}

// ── Answers → financial entries (D14) ────────────────────────────────────────
// Everything structured converts here. The confirmation screen derives ENTIRELY
// from this — the free-text box contributes nothing.

function journalBuildEntries() {
  const s = state.journalSession;
  const entries = [];
  const signals = [];

  s.questions.forEach(q => {
    const ans = s.answers[q.id];
    if (ans == null) return;
    // Options may be derived (see journalQuestionOptions), so resolve the same
    // list the user was actually shown — indexing q.options would mis-map.
    const opts = journalQuestionOptions(q);
    const qSignals = [];

    if (q.type === "multi_select") {
      const recordAfter = () => journalRecordProfile(q, qSignals);
      (ans || []).forEach(i => {
        const opt = opts[i];
        if (!opt) return;
        // signalOnly questions produce engagement signals, never money.
        if (q.signalOnly) { if (opt.signal) { signals.push(opt.signal); qSignals.push(opt.signal); } return; }
        if (opt.category == null && !opt.estimate) return;   // "Skipped it" etc.
        entries.push({
          id: generateId("je"),
          questionId: q.id,
          label: opt.label,
          category: opt.category,
          // Cash flow only (D15): an "ate at home" option carries amount 0 with
          // a zeroReason. That money was captured at the supermarket — never ask
          // someone to price a slice of toast.
          amount: typeof opt.estimate === "number" ? opt.estimate : (opt.amount || 0),
          // Frozen at build time so the confirm slider's ceiling is stable.
          // Deriving max from `amount` — the thing the slider changes — makes
          // the ceiling move under the thumb, and it recoils on release.
          baseAmount: typeof opt.estimate === "number" ? opt.estimate : (opt.amount || 0),
          estimated: typeof opt.estimate === "number",
          zeroReason: opt.zeroReason || null
        });
      });
      recordAfter();
      return;
    }

    if (q.type === "single_select") {
      const opt = opts[ans];
      if (!opt) return;
      if (q.signalOnly && opt.signal) { signals.push(opt.signal); qSignals.push(opt.signal); }
      // Pattern follow-up: the answer sets a recurring assumption so future
      // entries pre-fill. TRI-STATE — true | "weekdays" | false. A truthiness
      // check gets "weekdays" wrong.
      if (Object.prototype.hasOwnProperty.call(opt, "setsRecurring")) {
        state.journalRecurring[q.id] = opt.setsRecurring;
      }
      journalRecordProfile(q, qSignals);
      return;
    }

    if (q.type === "fill_number") {
      const amt = ans.amount;
      if (amt == null || isNaN(amt) || amt <= 0) return;
      if (q.updatesGoalProgress) {
        // 05-goals' event-based update, implemented as a journal question.
        // Never ask someone to update a number directly — ask something they
        // actually know, and let the goal move as a consequence.
        journalEmitGoalEvent({ kind: "checking_balance", amount: amt });
        return;                                   // a balance is not spending
      }
      entries.push({
        id: generateId("je"),
        questionId: q.id,
        label: q.prompt,
        category: ans.category || "Other",
        amount: amt,
        // Frozen ceiling for the confirm slider, exactly as the multi_select
        // path does above. Without it, journal-confirm falls back to `amount` —
        // the value the slider itself changes — so every release recomputed
        // max = amount × 2.5 and snapped the thumb to 40% of a track that grew
        // each time. A typed 350 would not stay where it was put.
        baseAmount: amt,
        estimated: false,
        zeroReason: null
      });
    }
  });

  s.entries = entries;
  s.signals = signals;
  return entries;
}

// Adjust one entry's amount from the confirmation slider.
// debouncedRender, not render: this fires on every pointer move, and a full
// render replaces the slider being dragged (see budgetSetPlan for the detail).
function journalAdjustEntry(entryId, amount) {
  const e = (state.journalSession.entries || []).find(x => x.id === entryId);
  if (!e) return;
  e.amount = Math.max(0, Number(amount) || 0);
  e.adjusted = true;
  // Paint the figure directly so it tracks the thumb; the debounce owns the
  // rest of the repaint.
  const el = document.getElementById("jAmt" + e.id);
  if (el) el.textContent = budgetFmt(e.amount);
  debouncedRender();
}

// Phase 5 consumes this. Emitted now so the journal's submit path does not have
// to be reopened months later.
function journalEmitGoalEvent(evt) {
  state.goalEvents.push(Object.assign({ at: Date.now(), day: journalDayIndex() }, evt));
}

// ── Submit ───────────────────────────────────────────────────────────────────

function journalSubmit() {
  const s = state.journalSession;
  if (!s) return;
  const entries = s.entries || journalBuildEntries();

  // Amounts and categories only. A journal entry's free-text note is exactly
  // the kind of thing that must never reach a URL (js/value-trail.js).
  //
  // SUMMED per category before recording, because several entries can land on
  // one category in a session and the trail is last-value-wins — recording
  // them one by one would report the last coffee rather than the day's dining.
  if (typeof ubTrailRecord === "function") {
    const byCat = {};
    entries.forEach(e => {
      if (!e || !e.category || !(Number(e.amount) > 0)) return;
      byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
    });
    Object.keys(byCat).forEach(c => {
      ubTrailRecord("j" + ubTrailCatKey(c), byCat[c]);
    });
    ubTrailCheckpoint("journal");
  }

  entries.forEach(e => {
    state.journalEntries.push(e);
    // L17 — entries feed month-to-date, and observations recompute from it.
    // The journal ADDS (each entry is one more thing that happened); the spend
    // estimator REPLACES (it re-estimates the whole month). Both are legitimate
    // writers of this layer — see architecture §5 — and a figure going down is a
    // correction, not a bug. What stops an accidental one is that both commit
    // only from a confirmation step: this path via journal-confirm, the
    // estimator via its result step. Keep that true for any new writer.
    if (e.category && isCategory(e.category) && e.amount > 0) {
      state.mtd[e.category] = (state.mtd[e.category] || 0) + e.amount;
    }
  });

  // Engagement signals clear subscription flags (07-progress-bills).
  (s.signals || []).forEach(name => {
    const sub = (state.subs || []).find(x => x.name === name);
    if (sub) { sub.lastMentionedDay = journalDayIndex(); sub.status = "active_used"; sub.weeksSinceMention = 0; }
  });

  // Mark cooldowns. This is what makes a second same-day entry ask DIFFERENT
  // questions (D13) rather than repeating the first.
  s.questions.forEach(q => { if (!q.alwaysLast) state.journalAsked[q.id] = journalDayIndex(); });

  state.journalEntriesCount = (state.journalEntriesCount || 0) + 1;

  // The daily task that sent us here is now done. Without this the Money
  // Journal task never greyed out on Home and the "n of 3 done" counter never
  // moved, because homeCompleteTask had exactly one caller in the whole app
  // (the lesson tail). Keyed off activeTaskId rather than a hardcoded id, since
  // both the money_journal task and the subscription_confirm deep link land here.
  if (state.activeTaskId && typeof homeCompleteTask === "function") {
    homeCompleteTask(state.activeTaskId);
    state.activeTaskId = null;   // or the next screen still thinks it is in a task
  }

  // D12 — the free text is dropped here, unread. Nothing acknowledges it.
  state.journalSession = null;

  observationsRecompute();
  go("journalDone");
}

function journalDiscard() {
  state.journalSession = null;
  navBack();
}

// Totals for the confirmation screen.
function journalSessionTotal() {
  const s = state.journalSession;
  if (!s || !s.entries) return 0;
  return s.entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}
