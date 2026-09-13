// ─── Goals (05-goals) ────────────────────────────────────────────────────────
// TAB: Goals (first tab, D34) | NAV BAR: Visible
//
// "The Goals tab tracks progress. It is not where most goals are born" — they
// come from contextual suggestions after a meaningful action. So this screen is
// mostly a review surface, with creation as the secondary path.
//
// Pace is the headline, not the raw figure: "$620 of $3,000 means little; 41%
// of the pace you set means something."

function renderGoalsV3() {
  const strat = state.strategicGoal;
  const tactical = state.tacticalGoals || [];
  const applied = goalsConsumeEvents();      // fold in anything the journal emitted

  return `
    <h1 class="title" style="margin:0 0 14px;font-size:20px;">Goals</h1>

    ${strat ? `
      <div class="card goal-strategic">
        <p class="helper" style="margin:0 0 3px;">What you're here for</p>
        <p class="goal-strategic-label">${h(strat.label)}</p>
      </div>` : ""}

    ${applied ? `
      <div class="card obs-card">
        <p class="helper" style="margin:0;">
          Updated from what you told me about your checking account.
        </p>
      </div>` : ""}

    <div class="row" style="margin:18px 0 8px;">
      <div class="section-title" style="margin:0;">Tracking</div>
      <div class="helper">${tactical.length} goal${tactical.length === 1 ? "" : "s"}</div>
    </div>

    ${tactical.length === 0 ? `
      <div class="card">
        <p class="task-title" style="margin:0 0 4px;">Nothing tracked yet</p>
        <p class="helper" style="margin:0;">
          Goals usually turn up after you finish something — a budget, a lesson,
          a journal entry. You can also start one here.
        </p>
      </div>
    ` : tactical.map(g => renderGoalCardV3(g)).join("")}

    ${renderGoalSuggestions({ source: "goals" })}
  `;
}

function renderGoalCardV3(goal) {
  const type = goalType(goal);
  const cur = goalCurrent(goal);
  const pace = goalPace(goal);
  const status = goalStatus(goal);
  const poor = goalStatusIsPoor(goal);

  // The bar means different things per type, so it is filled differently: a
  // savings goal fills toward its target, a spend limit fills toward its ceiling.
  const fill = goal.target ? Math.min(100, Math.round((cur / goal.target) * 100)) : 0;

  return `
    <div class="card goal-card">
      <div class="row" style="align-items:baseline;margin-bottom:2px;">
        <p class="task-title" style="margin:0;">${h(goal.label)}</p>
        <span class="pill ${poor ? "pill-warn" : "pill-good"}" style="font-size:9px;padding:2px 8px;">
          ${h(status)}
        </span>
      </div>

      <p class="helper" style="margin:0 0 8px;">
        ${type === "spend_limit"
          ? budgetFmt(cur) + " of " + budgetFmt(goal.target) + " this month"
          : budgetFmt(cur) + " of " + budgetFmt(goal.target)}
      </p>

      <div class="goal-bar" aria-hidden="true">
        <span class="${poor ? "goal-bar-warn" : ""}" style="width:${fill}%"></span>
      </div>

      <p class="goal-pace">${h(goalPaceLine(goal))}</p>

      ${goal.lastUpdatedFrom === "checking_balance" ? `
        <p class="helper" style="margin:6px 0 0;font-size:10px;">
          From your last checking balance — I never ask you to update this directly.
        </p>` : ""}

      <button class="goal-remove" type="button" onclick="goalsRemove('${h(goal.id)}')">Remove</button>
    </div>
  `;
}

/**
 * The contextual suggestion block. Rendered by whichever screen just finished a
 * meaningful action — pass a context so the suggestions are scoped to it.
 * "Create your own" is ALWAYS last (05-goals).
 */
function renderGoalSuggestions(context, title) {
  if (goalsAtCapacity()) {
    return `
      <div class="card" style="margin-top:14px;">
        <p class="task-title" style="margin:0 0 4px;">You've got a few on the go</p>
        <p class="helper" style="margin:0 0 10px;">
          Worth keeping this list short enough to actually track.
        </p>
        <button class="button secondary full" type="button" onclick="navGoTab('goals')">Update your goals</button>
      </div>`;
  }

  // Stashed on state and referenced by index — embedding a JSON object in an
  // onclick attribute is a quoting bug waiting to happen.
  const sugs = goalsSuggestFor(context || {});
  state.goalSuggestions = sugs;
  // No journal data for this category yet → a goal has nothing to measure
  // against, so offer the behavioral estimator first (a set of quick questions
  // that triangulates where the month is at).
  const cat = context && context.category;
  const noData = cat && catValue(state.mtd, cat) === 0 &&
                 typeof estimatorHasQuestions === "function" && estimatorHasQuestions(cat);
  return `
    <div class="card" style="margin-top:14px;">
      <p class="task-title" style="margin:0 0 8px;">${h(title || "Want to track something?")}</p>
      <div class="journal-options">
        ${noData ? `
          <button class="journal-opt" type="button" onclick="estimatorStart('${h(cat).replace(/'/g, "\\'")}')">
            <span class="journal-opt-label">First, estimate your ${h(catLabel(cat).toLowerCase())} spend</span>
          </button>` : ""}
        ${sugs.map((s, i) => `
          <button class="journal-opt" type="button" onclick="goalsAddSuggestedAt(${i})">
            <span class="journal-opt-label">${h(s.label)}</span>
          </button>`).join("")}
        <button class="journal-opt" type="button" onclick="state.goalDraft={label:'',target:''};render()">
          <span class="journal-opt-label">Create your own</span>
        </button>
      </div>
      ${state.goalDraft ? `
        <div class="input-group" style="margin-top:10px;">
          <label>What do you want to track?</label>
          <input placeholder="In your own words" value="${h(state.goalDraft.label)}"
                 oninput="state.goalDraft.label=this.value"
                 onchange="state.goalDraft.label=this.value">
        </div>
        <div class="input-group">
          <label>Target amount</label>
          <input type="number" min="0" placeholder="Amount" value="${h(state.goalDraft.target)}"
                 oninput="state.goalDraft.target=this.value"
                 onchange="state.goalDraft.target=this.value">
        </div>
        <button class="button full" type="button"
                onclick="goalsAddCustom(state.goalDraft.label, state.goalDraft.target)">Add it</button>
      ` : ""}
    </div>
  `;
}

function goalsAddSuggestedAt(i) {
  const s = (state.goalSuggestions || [])[i];
  if (s) goalsAddSuggested(s);
}

function renderGoalsV3Admin() {
  const t = state.tacticalGoals || [];
  return `
    <div class="admin-card">
      <p class="admin-card-title">Goals (v3 model)</p>
      <div class="input-group">
        <label>Strategic (exactly one)</label>
        <div class="helper">${h(state.strategicGoal ? state.strategicGoal.label : "—")}</div>
      </div>
      ${t.map(g => `
        <div class="input-group">
          <label>${h(g.label)}</label>
          <div class="helper" style="line-height:1.7;">
            type <strong>${h(goalType(g))}</strong> · current ${budgetFmt(goalCurrent(g))}
            / ${budgetFmt(g.target)}<br>
            pace <strong>${goalPace(g)}%</strong> → ${h(goalStatus(g))}
            ${goalStatusIsPoor(g) ? "⚠" : "✓"}
          </div>
        </div>`).join("")}
      <p class="helper" style="font-size:10px;">
        Pace is computed, never the seed's stored pacePercent. The two types
        invert: >100% is good for savings, bad for a spend limit.
      </p>
      <div class="input-group">
        <label>Unconsumed journal events</label>
        <div class="helper">${(state.goalEvents || []).filter(e => !e.consumed).length}</div>
      </div>
    </div>
  `;
}
