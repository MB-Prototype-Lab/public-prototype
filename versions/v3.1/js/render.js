// ─── Render Engine ────────────────────────────────────────────────────────────
// Owns the full render cycle. render() is the sole writer to screenRoot and
// navRoot — no other file should mutate those DOM nodes directly.
//
// Three routing functions:
//   renderScreen()  — maps state.screen → render function
//   renderAdmin()   — maps state.screen → admin panel content
//   adminSubtitle() — maps state.screen → admin header subtitle
//
// render() rebuilds both the screen and the admin panel on every call.
// This is intentional -- the app is small enough that full re-renders are
// cheaper than fine-grained diffing and simpler to reason about.
//
// -- WHAT "FULL RE-RENDER" COSTS, AND THE THREE ESCAPES -----------------------
// Replacing screenRoot.innerHTML destroys every element inside it. Three kinds
// of element mind that, and each has an established way out:
//
//   TEXT INPUTS   -- lose focus and cursor position. Commit on `onchange`
//                    (blur), not `oninput`. Where a value has to be live, patch
//                    the one dependent element by id -- uiSetEnabled /
//                    uiPatchHTML in js/utils.js -- and skip render entirely.
//   SLIDERS       -- the browser's pointer capture dies with the old node, so
//                    the thumb stops following the finger mid-drag. Sliders use
//                    `oninput` + debouncedRender(), which defers the repaint
//                    until the gesture is over.
//   TIMED MEDIA   -- the lesson player and the onboarding narrator own timers
//                    and audio that outlive a repaint. They are stopped before
//                    the DOM goes and re-armed after (lpMountHook), or exempted
//                    entirely (the onboarding block at the end of render).
//
// Anything that seems to need "just a small update" almost always wants one of
// those three, not a new partial-render mechanism.
//
// -- ADDING A SCREEN NEEDS FIVE EDITS, THREE OF THEM HERE ---------------------
// renderScreen(), adminSubtitle(), renderAdmin(), plus the jump list below and
// activeTabFor in js/utils.js. Miss one and the admin panel quietly degrades to
// its generic fallback rather than erroring -- which is what a cold session
// misreads as a finished screen. See the checklist in architecture section 11.

function adminSubtitle() {
  if (state.screen === "streak")         return "Streak splash — static launch screen shown first on every refresh.";
  if (state.screen === "journalEntry")   return "Money Journal — 4 structured questions by priority, then free text (discarded).";
  if (state.screen === "journalConfirm") return "Confirmation — entries derived from structured answers only.";
  if (state.screen === "journalDone")    return "Post-submit — month-to-date updated, observations recomputed.";
  if (state.screen === "home")           return "Home — tip banner, buddy stage, four daily tasks.";
  if (state.screen === "login")          return "Login scene — day/night by local time, then the daily-update prompt.";
  if (state.screen === "dailyUpdate")    return "Daily update — one audio file per segment; visuals carry the numbers (D30).";
  if (state.screen === "dailySummary")   return "Completion summary — observations stacked in plain language.";
  if (state.screen === "dailyShare")     return "Share — anonymization on by default; the preview is the literal payload (A11).";
  if (state.screen === "onboarding")     return "Onboarding — " + ONB_STEPS.length +
                                                " steps. Only ZIP, household and income override the persona (D09).";
  if (state.screen === "learn")          return "Adjust XP config, lesson states, badge progress.";
  if (state.screen === "topic")          return "Override lesson statuses for this badge.";
  if (state.screen === "reward-preview") return "Lesson preview — read-only. Edit content in Learn admin.";
  if (state.screen === "lessonFraming")  return "Framing tree — tags select which pre-written script variant plays.";
  if (state.screen === "lesson")         return "Toggle stage style, seek to sentence for testing.";
  if (state.screen === "lessonQuiz")     return "Quiz — lessons.json question first, topped up from v2's pool (L9).";
  if (state.screen === "lessonSimulation") return "Simulation — sandbox figures only, never the user's own.";
  if (state.screen === "lessonReward")   return "Reward — XP to every course the lesson belongs to.";
  if (state.screen === "aboutMe")        return "Budget — 12 flat categories, plan vs what the journal says.";
  if (state.screen === "profilePicker")   return "Starting profile — 3 cost-of-living tiers x 3 income levels. " +
                                                 "Shown on \"Skip all setup\"; PROFILE_PICKER turns it off.";
  if (state.screen === "helpMeOut")       return "Help me out — " +
                                                 (state.helpMeOut ? catLabel(state.helpMeOut.category) + ", " + state.helpMeOut.stage : "no session") +
                                                 ". Habits in, a monthly figure out; never pro-rated.";
  if (state.screen === "esfBuild")        return "Emergency fund — capture step " +
                                                 ((state.esf && state.esf.step || 0) + 1) +
                                                 " of " + ESF_STEPS.length + ". Six survival categories, typed figures only.";
  if (state.screen === "esfPlan")         return "Emergency fund — the number and the plan. One figure, not two: " +
                                                 "health cover is stated, never chosen.";
  if (state.screen === "budgetBuild")     return "v3.1 builder — " + bbStep().title.toLowerCase() +
                                                 " (step " + ((state.budgetBuild && state.budgetBuild.step || 0) + 1) +
                                                 " of " + BB_STEPS.length + "), Help me out per line.";
  if (state.screen === "spendingProfile") return "v3.1 step 1 — twelve sliders, opening on ZIP-adjusted national averages.";
  if (state.screen === "budgetCompare")   return "v3.1 step 3 — per category, their figure vs the model's vs the midpoint.";
  if (state.screen === "lifestyleWizard") return "Lifestyle wizard — 6 questions feeding the peer model.";
  if (state.screen === "budgetDone")     return "Budget saved through the seam.";
  if (state.screen === "goals")          return "Goals — one strategic, several tactical. Pace is computed; the two types invert.";
  if (state.screen === "myProgress")     return "My Progress tab — output hub for profile, results, comparisons, goals.";
  if (state.screen === "comparison")     return "Three layers — plan, what you told me, peers. Both gaps labelled distinctly.";
  if (state.screen === "budgetCategory") return "One category — comparison, editable plan, actuals via the estimator, scoped goals.";
  if (state.screen === "spendEstimator") return "Behavioral spend estimator — habits, not dollars → month-to-date into 'what you told me'.";
  if (state.screen === "accountBalances") return "Account balance snapshots — point-in-time entries.";
  if (state.screen === "debtBalances")   return "Debt balance snapshots — point-in-time entries.";
  if (state.screen === "postResult")     return "Post-result reaction prompt.";
  if (state.screen === "nextAction")     return "Next action selection.";
  if (state.screen === "commitment")     return "Commitment creation.";
  if (state.screen === "marketplace")    return "Adjust marketplace preferences and offers.";
  if (state.screen === "reward")         return "Last reward output (read-only).";
  if (state.screen === "finish")         return "Post-result loop — completion moment before returning to the origin.";
  if (state.screen === "quiz")           return "v2 quiz — kept for v2 lessons; v3 lessons use lessonQuiz.";
  if (state.screen === "simulation")     return "v2 simulation stub — v3 lessons use lessonSimulation.";
  if (state.screen === "marketplaceDetail") return "Marketplace detail — admin-reachable only; the tab is inert (D33).";
  if (state.screen === "settings")       return "Settings — carried forward from v2, off the main paths (L14).";
  if (state.screen === "myDebts")        return "Manage debt instruments, add or remove entries.";
  if (state.screen === "debtAnalyzer")   return "Adjust extra payment, toggle debts in/out of simulation.";
  if (state.screen === "chat")           return "Chat mock — keyword matching, not AI. Routes listed below.";
  if (state.screen === "budgetUpdateConfirm") return "Old → new budget comparison — gates every builder update.";
  return "Manual controls for this wireframe screen.";
}

function renderScreen() {
  if (state.screen === "streak")            return renderStreak();
  if (state.screen === "login")             return renderLogin();
  if (state.screen === "dailyUpdate")       return renderDailyUpdate();
  if (state.screen === "dailySummary")      return renderDailySummary();
  if (state.screen === "dailyShare")        return renderDailyShare();
  if (state.screen === "onboarding")        return renderOnboarding();
  if (state.screen === "journalEntry")      return renderJournalEntry();
  if (state.screen === "journalConfirm")    return renderJournalConfirm();
  if (state.screen === "journalDone")       return renderJournalDone();
  if (state.screen === "home")              return renderHome();
  if (state.screen === "aboutMe")           return renderBudgetV3();
  if (state.screen === "profilePicker")     return renderProfilePicker();
  if (state.screen === "helpMeOut")         return renderHelpMeOut();
  if (state.screen === "budgetBuild")       return renderBudgetBuild();
  if (state.screen === "esfBuild")          return renderEsfBuild();
  if (state.screen === "esfPlan")           return renderEsfPlan();
  if (state.screen === "spendingProfile")   return renderSpendingProfile();
  if (state.screen === "budgetCompare")     return renderBudgetCompare();
  if (state.screen === "lifestyleWizard")   return renderLifestyleWizard();
  if (state.screen === "budgetDone")        return renderBudgetDone();
  if (state.screen === "budgetUpdateConfirm") return renderBudgetUpdateConfirm();
  if (state.screen === "myProgress")        return renderMyProgress();
  if (state.screen === "comparison")        return renderComparison();
  if (state.screen === "budgetCategory")    return renderBudgetCategory();
  if (state.screen === "spendEstimator")    return renderSpendEstimator();
  if (state.screen === "accountBalances")   return renderAccountBalances();
  if (state.screen === "debtBalances")      return renderDebtBalances();
  if (state.screen === "postResult")        return renderPostResult();
  if (state.screen === "nextAction")        return renderNextAction();
  if (state.screen === "commitment")        return renderCommitment();
  if (state.screen === "finish")            return renderFinish();
  if (state.screen === "goals")             return renderGoalsV3();
  if (state.screen === "learn")             return renderLearn();
  if (state.screen === "topic")             return renderTopic();
  if (state.screen === "reward-preview")    return renderRewardPreview();
  if (state.screen === "lessonFraming")     return renderLessonFraming();
  if (state.screen === "lesson")            return renderLesson();
  if (state.screen === "lessonQuiz")        return renderLessonQuiz();
  if (state.screen === "lessonSimulation")  return renderLessonSimulation();
  if (state.screen === "lessonReward")      return renderLessonReward();
  if (state.screen === "quiz")              return renderQuiz();
  if (state.screen === "simulation")        return renderSimulation();
  if (state.screen === "marketplace")       return renderMarketplace();
  if (state.screen === "marketplaceDetail") return renderMarketplaceDetail();
  if (state.screen === "reward")            return renderReward();
  if (state.screen === "settings")          return renderSettings();
  if (state.screen === "chat")              return renderChat();
  if (state.screen === "myDebts")           return renderMyDebts();
  if (state.screen === "debtAnalyzer")      return renderDebtAnalyzer();
  console.warn("[MoneyBuddy] renderScreen: unknown screen →", state.screen);
  return renderHome();
}

function renderAdmin() {
  if (state.screen === "streak")        return renderStreakAdmin();
  if (state.screen === "login")         return renderLoginAdmin();
  if (state.screen === "dailyUpdate")   return renderDailyUpdateAdmin();
  if (state.screen === "dailySummary")  return renderDailySummaryAdmin();
  if (state.screen === "dailyShare")    return renderDailyShareAdmin();
  if (state.screen === "onboarding")    return renderOnboardingAdmin();
  if (state.screen === "journalEntry")  return renderJournalEntryAdmin();
  if (state.screen === "journalConfirm") return renderJournalConfirmAdmin();
  if (state.screen === "journalDone")   return renderJournalDoneAdmin();
  if (state.screen === "home")          return renderHomeAdmin();
  if (state.screen === "goals")         return renderGoalsV3Admin();
  if (state.screen === "learn")         return renderLearnAdmin();
  if (state.screen === "topic")         return renderTopicAdmin();
  if (state.screen === "myProgress")    return renderMyProgressAdmin();
  if (state.screen === "comparison")    return renderComparisonAdmin();
  if (state.screen === "budgetCategory") return renderBudgetCategoryAdmin();
  if (state.screen === "spendEstimator") return renderSpendEstimatorAdmin();
  if (state.screen === "marketplace")   return renderMarketplaceAdmin();
  if (state.screen === "lessonFraming") return renderLessonFramingAdmin();
  if (state.screen === "lesson")        return renderLessonAdmin();
  if (["lessonQuiz","lessonSimulation","lessonReward"].includes(state.screen)) return renderLessonOutcomeAdmin();
  if (state.screen === "reward")        return renderRewardAdmin();
  if (state.screen === "aboutMe")       return renderBudgetV3Admin();
  if (state.screen === "profilePicker")   return renderProfilePickerAdmin();
  if (state.screen === "helpMeOut")       return renderHelpMeOutAdmin();
  if (state.screen === "budgetBuild")     return renderBudgetBuildAdmin();
  if (state.screen === "esfBuild")        return renderEsfBuildAdmin();
  if (state.screen === "esfPlan")         return renderEsfPlanAdmin();
  if (state.screen === "spendingProfile") return renderLifestyleWizardAdmin();
  if (state.screen === "budgetCompare")   return renderBudgetCompareAdmin();
  if (state.screen === "lifestyleWizard") return renderLifestyleWizardAdmin();
  if (state.screen === "myDebts")       return renderMyDebtsAdmin();
  if (state.screen === "debtAnalyzer")  return renderDebtAnalyzerAdmin();
  if (state.screen === "chat")          return renderChatAdmin();

  return `
    <div class="admin-card">
      <p class="admin-card-title">Screen Controls</p>
      <p class="helper">No detailed admin controls for this screen yet.</p>
      <div class="input-group">
        <label>Jump to screen</label>
        <select onchange="navAdminJump(this.value)">
          ${["streak","onboarding","login","dailyUpdate","dailySummary","dailyShare","home","journalEntry","journalConfirm","journalDone","aboutMe","budgetCategory","spendEstimator","budgetBuild","helpMeOut","esfBuild","esfPlan","profilePicker","spendingProfile","budgetCompare","lifestyleWizard","budgetDone","myProgress","comparison",
             "accountBalances","debtBalances","postResult","nextAction","commitment","finish",
             "goals","learn","topic","lessonFraming","lesson","lessonQuiz","lessonSimulation","lessonReward","quiz","simulation","marketplace",
             "marketplaceDetail","reward","settings","myDebts","debtAnalyzer",
             "chat","budgetUpdateConfirm"].map(s => `
            <option value="${s}" ${state.screen === s ? "selected" : ""}>${s}</option>
          `).join("")}
        </select>
      </div>
    </div>
  `;
}

// Module-level, not on `state`: the admin state inspector would serialise a
// scroll offset it can do nothing with, and this is view bookkeeping rather
// than app state.
let lastPaintedScreen = null;   // the last scrollKey(), not the last screen id
let scrollHeld = null;

function render() {
  // Read the offset BEFORE anything replaces the markup that carries it.
  const scrollEl = document.getElementById("screenRoot");
  scrollHeld = scrollEl ? scrollEl.scrollTop : null;

  // Drop any repaint queued by a slider. Without this, a drag leaves a render
  // pending for up to 400ms, and if the user focuses a text input inside that
  // window the queued render wipes it mid-keystroke — silently, because
  // removing a focused input from the DOM fires no `change`.
  debouncedRenderCancel();
  const screenRoot = document.getElementById("screenRoot");
  const navRoot    = document.getElementById("navRoot");
  const topbarRoot = document.getElementById("topbarRoot");

  // Clear lesson player timer before destroying the DOM it references.
  // Capture play state first so lpMountHook can resume if a re-render interrupted mid-play.
  const lpWasPlaying = state.lessonPlayback.playing;
  lpStopPlayback();

  // -- FULL-BLEED MODE CLASSES --
  // A handful of screens hide the nav bar and run edge to edge. The class does
  // two things at once: it zeroes BOTH the top-bar and nav offsets in the CSS,
  // and it opts the screen out of the standard padding.
  //
  // journal-mode is toggled several times below rather than once, because the
  // screens that want it were added in different phases and each block reads as
  // its own feature. The `|| contains("journal-mode")` on the later calls is
  // load-bearing: toggle() with an explicit false REMOVES the class, so without
  // it each block would undo the one before and only the last list would win.
  // Any new full-bleed screen should join an existing list, not add a call.
  screenRoot.classList.toggle("lesson-mode",      state.screen === "lesson");
  screenRoot.classList.toggle("journal-mode",     ["lessonFraming","lessonQuiz","lessonSimulation","lessonReward"].includes(state.screen) || screenRoot.classList.contains("journal-mode"));
  screenRoot.classList.toggle("journal-mode",     ["journalEntry","journalConfirm","journalDone","budgetBuild","helpMeOut","esfBuild","esfPlan","profilePicker","spendingProfile","budgetCompare","lifestyleWizard","budgetDone","spendEstimator"].includes(state.screen));
  screenRoot.classList.toggle("streak-mode",      state.screen === "streak");
  screenRoot.classList.toggle("login-mode",       state.screen === "login");
  screenRoot.classList.toggle("du-mode",          state.screen === "dailyUpdate");
  screenRoot.classList.toggle("journal-mode",     ["dailySummary","dailyShare"].includes(state.screen) || screenRoot.classList.contains("journal-mode"));
  screenRoot.classList.toggle("journal-mode",     state.screen === "onboarding" || screenRoot.classList.contains("journal-mode"));
  screenRoot.classList.toggle("chat-mode",        state.screen === "chat");
  themeApply();   // one of four theme classes on .screen (js/theme.js, L21)
  screenRoot.innerHTML  = renderScreen();
  if (state.screen === "lesson") lpMountHook(lpWasPlaying);
  // The keyboard survives a re-render — it lives in its own root outside
  // screenRoot — but the FIELD it was opened for does not. Close it when that
  // field is gone, which is also what lets a Continue press resolve: the press
  // latch defers the close, and this is where the close actually happens.
  if (typeof kbdSyncAfterRender === "function") kbdSyncAfterRender();

  // The intro film's storyboard is CSS animations, and a CSS animation starts
  // the moment it is inserted. So the stage played itself the instant step 8
  // rendered — silently, because the narration is on the clock and the clock
  // was still paused. Sync them to the (paused, zeroed) player state on mount,
  // the same way lpMountHook re-arms the lesson player above.
  if (typeof onbVideoSyncFrames === "function") {
    const onb = state.onboarding;
    if (state.screen === "onboarding" && onb &&
        typeof ONB_STEPS !== "undefined" && ONB_STEPS[onb.step] === "video") {
      onbVideoSyncFrames();
    }
  }
  if (state.screen === "chat")   chatMountHook();   // pin the thread to the newest message

  // The Ask Buddy layer. Painted every render like the screen itself, but into
  // its OWN root outside screenRoot, so the keypad opening and closing cannot
  // move the pill out from under a finger mid-press (screens/buddy-panel.js).
  const buddyRoot = document.getElementById("buddyRoot");
  if (buddyRoot) {
    buddyRoot.innerHTML = (typeof renderEsfBuddyLayer === "function") ? renderEsfBuddyLayer() : "";
    if (typeof esfBuddyMountHook === "function") esfBuddyMountHook();
  }

  // The onboarding narrator is a timed surface like the lesson player, but it
  // drives its OWN re-render (onbVideoAdvance → render → onbVideoSpeak), so it
  // cannot use the stop-then-re-arm shape above: an unconditional stop here
  // would clear `playing` and onbVideoSpeak's first guard would silence it on
  // every segment. Tear down only when we have actually left its step —
  // otherwise leaving onboarding by admin jump or a nav tab strands the
  // narration, which keeps calling render() over whatever screen is now up.
  if (typeof onbVideoStop === "function") {
    const onb = state.onboarding;
    const onVideoStep = state.screen === "onboarding" && onb &&
                        typeof ONB_STEPS !== "undefined" && ONB_STEPS[onb.step] === "video";
    if (!onVideoStep) onbVideoStop();
  }

  // Buddy idle cycle runs only where the stage is actually on screen.
  buddyStopIdle();
  if (["home", "login"].includes(state.screen)) buddyStartIdle();
  topbarRoot.innerHTML  = renderTopBar();
  navRoot.innerHTML     = renderNav();
  const hasNav = !!navRoot.innerHTML;
  const hasTopbar = !!topbarRoot.innerHTML;
  // Offsets are driven by classes only — no inline px. The heights live in
  // --topbar-h / --nav-h (css/variables.css) so the reservation is stated once
  // instead of the three places v2 kept it in.
  navRoot.style.display = hasNav ? "" : "none";
  screenRoot.classList.toggle("no-nav", !hasNav);
  screenRoot.classList.toggle("no-topbar", !hasTopbar);

  document.getElementById("adminRoot").innerHTML         = renderAdmin();
  document.getElementById("adminSubtitle").textContent   = adminSubtitle();

  // Theme picker — four options, active one highlighted (L21). Styled with
  // --chrome-* because it is admin instrumentation, not the product.
  const tp = document.getElementById("themePicker");
  if (tp) {
    const active = themeCurrent().id;
    tp.innerHTML = THEMES.map(t => `
      <button type="button"
        onclick="themeSet('${t.id}')"
        aria-pressed="${t.id === active}"
        style="padding:5px 4px;font-size:10px;font-weight:700;cursor:pointer;
               border-radius:6px;white-space:nowrap;
               border:1px solid ${t.id === active ? "var(--chrome-accent)" : "var(--chrome-line)"};
               background:${t.id === active ? "var(--chrome-accent)" : "var(--chrome-card)"};
               color:${t.id === active ? "#FFFFFF" : "var(--chrome-muted)"};">
        ${h(t.label)}
      </button>`).join("");
  }

  // Admin collapse — toggle class on page root, show/hide expand tab
  document.querySelector(".page").classList.toggle("admin-collapsed", !!state.adminCollapsed);
  const expandTab = document.getElementById("adminExpandTab");
  if (expandTab) expandTab.style.display = state.adminCollapsed ? "flex" : "none";

  if (state.screen === "reward")     initRewardAnimations();

  // Restore search input focus after render so typing mid-search doesn't lose cursor.
  // Only triggers when the learn tab is active and there's an active query.
  if (state.screen === "learn" && state.searchQuery) {
    const inp = document.getElementById("learnSearch");
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
    // Repopulate results that renderLearn() couldn't inject (renderSearch is DOM-dependent)
    renderSearch();
  }

  // ── Hold the scroll position across a re-render of the SAME screen ─────────
  // render() replaces .screen's innerHTML, which zeroes scrollTop, and every
  // state change routes through here. Two things broke on that:
  //
  //   · flipping a "Help me out" toggle on a row below the fold threw the
  //     tester back to the top of the step
  //   · debouncedRender() also lands here, so DRAGGING any slider below the
  //     fold snapped the page to the top every 400ms, mid-gesture
  //
  // Scrolling to the top is right when the VIEW actually changes — a new one
  // should start at its beginning. It is never right when the same view simply
  // repaints. The identity is scrollKey(), not state.screen: several flows are
  // one screen with an internal position, and stepping through them is a new
  // page to a tester even though the screen id never moves.
  if (scrollKey() === lastPaintedScreen) {
    const sr = document.getElementById("screenRoot");
    if (sr && scrollHeld != null) sr.scrollTop = scrollHeld;
  } else {
    scrollTop();
  }
  lastPaintedScreen = scrollKey();

  // Update admin footer — nav log and last error (skip when admin is collapsed)
  if (!state.adminCollapsed) {
    const navLogEl = document.getElementById('adminNavLog');
    if (navLogEl) navLogEl.textContent = 'Nav: ' + (window.__navLog.length ? window.__navLog.join(' ← ') : 'none');
    const errEl = document.getElementById('adminErrorLog');
    if (errEl && !window.__lastError) errEl.textContent = 'Last error: none';
  }
}
