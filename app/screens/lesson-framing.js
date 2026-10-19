// Answers select prewritten lesson content (D38); they are not scored.
// Infer a figure from card/rate inputs or the market fallback, then use its
// bucket to select script and storyboard. General narration leaves personal
// figures to storyboard tokens.
// Options use singular `tag`; reading `tags` would silently select fallback.
// Unmatched tags intentionally use fallback rather than requiring a variant.
// Keep the result for the session but ask again on reopening so a previous
// answer cannot prevent a tester from changing it.

function renderLessonFraming() {
  const f = state.lessonFraming;
  const lesson = f ? framedLesson(f.lessonId) : null;
  const q = lesson ? lessonQuestion(lesson, f.questionId) : null;
  // D19 — entered directly with no lesson chosen.
  if (!f || !lesson || !q) return lessonOutcomeNoSession("lesson",
    "These questions decide which version of a lesson you get.");

  // The tree branches, so the path length varies (1–5). Show a soft, growing
  // indicator rather than a fixed total that would over-promise questions.
  const asked = f.path.length + 1;
  const maxQ = FRAMED_LESSONS.config.maxFramingQuestions || 5;
  const total = Math.min(maxQ, Math.max(2, asked));
  const isNumber = q.type === "fill_number";

  return `
    <div class="journal-shell">
      <div class="journal-head">
        <p class="helper" style="margin:0 0 4px;">${h(lesson.title)}</p>
        <div class="journal-progress" aria-hidden="true">
          ${Array.from({ length: total }).map((_, i) =>
            `<span class="journal-pip ${i < asked ? "on" : ""}"></span>`).join("")}
        </div>
        <h1 class="title" style="font-size:21px;margin:12px 0 0;">${h(q.prompt)}</h1>
        <p class="helper" style="margin:6px 0 0;">
          No wrong answers — this just decides which version you get.
        </p>
      </div>

      <div class="journal-body">
        ${isNumber ? `
          <div class="input-group">
            <input id="lfNum" type="number" inputmode="decimal" min="0" step="0.1"
                   placeholder="${h(q.placeholder || "")}">
            ${q.suffix === "%" ? `<p class="helper" style="margin:6px 0 0;">A rough number is fine — as a percent.</p>` : ""}
          </div>
        ` : `
          <div class="journal-options">
            ${lessonEffectiveOptions(f, q).map((o, i) => `
              <button class="journal-opt" type="button" onclick="lessonFramingAnswer(${i})">
                <span class="journal-opt-label">${h(o.label)}</span>
              </button>`).join("")}
          </div>
        `}
      </div>

      <div class="journal-foot">
        <button class="button secondary" type="button" onclick="navBack()">Back</button>
        ${isNumber
          ? `<button class="button" type="button"
                     onclick="lessonFramingEnterNumber(document.getElementById('lfNum').value)">Continue</button>`
          : `<button class="button secondary" type="button" onclick="lessonSkipFraming()">Skip</button>`}
      </div>
    </div>
  `;
}

function renderLessonFramingAdmin() {
  const f = state.lessonFraming;
  if (!f) return `<div class="admin-card"><p class="admin-card-title">Framing</p>
    <p class="helper">Not running.</p></div>`;
  const lesson = framedLesson(f.lessonId);
  const would = lessonSelectVariant(lesson, f.tags, f.inputs);
  const figure = lessonInferFigure(lesson, f.inputs);
  const avg = (typeof CARD_APR !== "undefined" && CARD_APR.marketAverage) || null;

  return `
    <div class="admin-card">
      <p class="admin-card-title">Framing → variant</p>
      <div class="input-group">
        <label>Answers so far</label>
        <div class="helper" style="line-height:1.7;">
          ${f.path.length ? f.path.map(p =>
            `${h(p.questionId)}: ${h(p.label)}${p.tag ? " → <strong>" + h(p.tag) + "</strong>" : ""}`
          ).join("<br>") : "none yet"}
        </div>
      </div>
      ${lesson.bucketDimension ? `
        <div class="input-group">
          <label>Inferred (${h(lesson.bucketDimension.kind)})</label>
          <div class="helper">
            figure ${figure == null ? "— (no info → fallback)" : figure + "%"} ·
            avg ${avg == null ? "—" : avg + "%"} ·
            bucket <strong>${h(lessonBucketFor(lesson, figure) || "—")}</strong>
          </div>
        </div>` : `
        <div class="input-group">
          <label>Tags collected</label>
          <div class="helper">${f.tags.join(", ") || "none"}</div>
        </div>`}
      <div class="input-group">
        <label>Variant that would play</label>
        <div class="helper">
          <strong>${h(would.id)}</strong> · ${h(would.emphasis)}
          ${would.isFallback ? " <em>(fallback)</em>" : ""}<br>
          script: ${lessonScriptFor(would.id) ? lessonScriptFor(would.id).length + " lines" : "MISSING"}
        </div>
      </div>
      <p class="helper" style="font-size:10px;">
        Highest tag overlap wins; ties break by declaration order; zero matches
        plays the fallback, which also serves every "I don't know" path.
      </p>
      ${(lesson.scriptVariants || []).map(v => `
        <div class="helper" style="font-size:10px;line-height:1.6;">
          ${f.tags.length ? (v.matchTags || []).filter(t => f.tags.indexOf(t) !== -1).length : 0}
          · ${h(v.id)} [${(v.matchTags || []).join(", ") || "—"}]
        </div>`).join("")}
    </div>
  `;
}
