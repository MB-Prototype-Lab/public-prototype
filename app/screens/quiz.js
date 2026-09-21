// ─── Quiz Screen ──────────────────────────────────────────────────────────────
// Presents questions for the current lesson (state.currentLesson).
// Question pool is filtered by lessonId — not a free-floating bank.
//
// Answer behavior (deliberate UX, per spec):
//   - Wrong answer: goes red + permanently disabled for the rest of that question.
//     state.activeQuizWrongChoices tracks ALL wrong attempts — not just the last one.
//     This means picking wrong twice leaves BOTH options red. Users can never
//     accidentally reselect an answer they already know is wrong.
//   - Correct answer: goes green + reveals Next/Submit button.
//   - User cannot proceed until the correct answer is chosen or they exit.
//
// This is a learning reinforcement tool, not a pass/fail gate.

function renderQuiz() {
  const lesson = state.currentLesson;

  // Fallback if quiz is accessed without an active lesson
  if (!lesson) {
    return `
      <div class="card">
        <h1 class="title">Quiz</h1>
        <p class="subtitle">No lesson active. Start a lesson from a topic page first.</p>
      </div>
      <div class="flow-footer">
        <button class="button secondary" type="button" onclick="navGoTabRoot('learn')">Back to Learn</button>
      </div>
    `;
  }

  // Pull questions for this lesson, capped at quizQuestionsRequired
  const allQuestions = state.quizQuestions.filter(q => q.lessonId === lesson.id);
  const required     = state.xpConfig.quizQuestionsRequired;
  const questions    = allQuestions.slice(0, required);
  const current      = questions[state.activeQuizIndex];
  const isLast       = state.activeQuizIndex >= questions.length - 1;

  if (!current) {
    // Edge case: no questions seeded for this lesson — auto-complete
    return `
      <div class="card">
        <h1 class="title">Quiz</h1>
        <p class="helper">No questions available for this lesson yet.</p>
      </div>
      <button class="button full" type="button" onclick="quizFinish()">Complete Lesson</button>
    `;
  }

  const selected    = state.activeQuizChoice;        // null | index of correct answer chosen
  const wrongSoFar  = state.activeQuizWrongChoices;  // array of wrong indices tried this question

  // isCorrect: user has chosen the right answer for this question
  const isCorrect = selected !== null && selected === current.correct;
  // isWrong: at least one wrong answer was tried (for the feedback note)
  const isWrong   = wrongSoFar.length > 0 && !isCorrect;

  return `
    <div class="card">
      <div class="row" style="margin-bottom:8px;">
        <h1 class="title" style="font-size:18px;">Quiz</h1>
        <div style="display:flex;align-items:center;gap:10px;">
          <!-- Progress indicator: question N of total required -->
          <span class="helper">Question ${state.activeQuizIndex + 1} of ${questions.length}</span>
          <!-- The one exit, now that the footer's duplicate is gone. Routed
               through the reset path rather than a bare navigation, so the quiz
               position and both answer sets clear — the footer button did that
               and this one silently did not. -->
          <button class="button secondary small" type="button"
                  onclick="exitQuiz()" title="Exit quiz">✕ Exit</button>
        </div>
      </div>
      <p class="subtitle">${h(lesson.title)}</p>
      <!-- Thin progress bar shows position in quiz session -->
      <div class="progress" style="margin-top:10px;">
        <div class="progress-fill"
             style="width:${Math.round((state.activeQuizIndex / questions.length) * 100)}%;">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">${h(current.question)}</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
        ${current.choices.map((choice, i) => {
          const isThisCorrect  = i === current.correct;
          const isThisSelected = i === selected;
          // A choice is "wrong" if it appears in wrongSoFar — ALL past wrong
          // attempts stay red, not just the most recent one.
          const isThisWrong    = wrongSoFar.includes(i);

          let cls = "choice";
          if (isThisWrong)                cls += " wrong";
          if (isThisCorrect && isCorrect) cls += " correct";

          // After correct answer is chosen, ALL buttons become non-interactive:
          //   - wrong attempts: disabled attribute (red, browser-native blocked)
          //   - correct answer: pointer-events:none (stays green, can't re-click)
          //   - unchosen neutral: pointer-events:none + dimmed (can't explore)
          // This prevents the user from changing their selection or clicking
          // around after the right answer has been found.
          const disabled    = isThisWrong ? "disabled" : "";
          const lockStyle   = isCorrect && !isThisWrong
            ? `style="pointer-events:none;${!isThisCorrect ? "opacity:0.45;" : ""}"`
            : "";

          return `
            <button class="${cls}" type="button" ${disabled} ${lockStyle}
                    onclick="selectQuizAnswer(${i})">
              ${h(choice)}
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <!-- Feedback note: shown once any wrong answer has been tried -->
    ${isWrong ? `
      <div class="note" style="border-color:var(--danger);color:var(--danger);">
        Not quite — try another answer.
      </div>
    ` : ""}
    ${isCorrect ? `
      <div class="note" style="border-color:var(--good);color:var(--good);">
        Correct! ${isLast ? "Great work — you've finished the quiz." : "On to the next question."}
      </div>
    ` : ""}

    <div class="flow-footer">
      <!-- No exit control down here. The footer has no justify-content, so
           its children pack together on the left — which put it immediately
           beside Next, one mis-tap apart. The one in the header above is now
           the single way out, matching the v3 quiz. -->

      <!-- Next / Submit only appears after the correct answer is chosen -->
      ${isCorrect ? `
        <button class="button" type="button"
                onclick="${isLast ? "quizFinish()" : "nextQuizQuestion()"}">
          ${isLast ? "Submit" : "Next"}
        </button>
      ` : ""}
    </div>
  `;
}

/**
 * End of the quiz. Detours through the calculator when the lesson has one.
 *
 * The v2 catalog went question, question, question, reward — eighteen lessons
 * that never let you put a number in, while v3's three did. LESSON_SIM_V2
 * (screens/lesson-outcome.js) gives the ones a calculator genuinely helps a
 * spec of their own, and this is where they pick it up. Lessons without one are
 * unchanged.
 *
 * The calculator's own "Finish lesson" calls completeLesson for a v2 origin, so
 * the XP and badge path is identical either way — this only inserts a step.
 */
function quizFinish() {
  const lesson = state.currentLesson;
  if (lesson && typeof lessonSimOpen === "function" && lessonSimAvailable(lesson.id)) {
    if (lessonSimOpen(lesson.id, "v2")) return;
  }
  completeLesson();
}

// Handles a choice selection.
// Wrong choices: added to the permanent wrong-attempts list for this question.
// Correct choice: stored in activeQuizChoice, reveals Next/Submit.
function selectQuizAnswer(choiceIndex) {
  // Get current question to check correctness
  const lesson    = state.currentLesson;
  const questions = state.quizQuestions
    .filter(q => q.lessonId === lesson.id)
    .slice(0, state.xpConfig.quizQuestionsRequired);
  const current = questions[state.activeQuizIndex];
  if (!current) return;

  if (choiceIndex === current.correct) {
    // Correct: mark as the confirmed answer
    state.activeQuizChoice = choiceIndex;
  } else {
    // Wrong: add to permanent wrong set (deduplicated — clicking disabled button
    // shouldn't be possible but guard anyway)
    if (!state.activeQuizWrongChoices.includes(choiceIndex)) {
      state.activeQuizWrongChoices.push(choiceIndex);
    }
    // Do NOT set activeQuizChoice — user must keep trying
  }
  render();
}

// Advances to the next question. Clears both the correct selection and all
// wrong attempts so the next question starts with a clean slate.
function nextQuizQuestion() {
  state.activeQuizIndex++;
  state.activeQuizChoice      = null;
  state.activeQuizWrongChoices = [];
  render();
}

// Exits the quiz without completing. Lesson stays in-progress.
// Full quiz state resets so next entry starts from question 1 with clean answers.
function exitQuiz() {
  state.activeQuizIndex       = 0;
  state.activeQuizChoice      = null;
  state.activeQuizWrongChoices = [];
  go("lesson");
}
