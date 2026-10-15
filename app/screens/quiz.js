// Filter questions by current lesson. Wrong choices stay red and disabled
// for that question, including multiple wrong attempts. Correct answers reveal
// Next/Submit; the tester must answer correctly or exit.

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
    // If no questions exist, offer explicit lesson completion.
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
          <!-- Use exitQuiz so leaving clears the question position and answers. -->
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
      <!-- Keep Exit in the header, away from Next. -->

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

/* Open the lesson's calculator when available, carrying the catalog origin
 * so Finish awards the usual badge XP. Other lessons complete directly. */
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
