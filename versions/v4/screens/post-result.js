// ─── Post-Result Reaction Prompt ──────────────────────────────────────────────
// TAB: None | NAV BAR: Hidden — full focus on reaction
//
// PURPOSE
// First screen of the post-input loop. After completing any major Budget input
// (2 Minute Budget, lifestyle chain, monthly update), shows a context summary, then asks
// "How does this feel?" with a 4-notch slider before the user decides next steps.
//
// NAVIGATION
//   Entry: Triggered after completing the 2 Minute Budget, lifestyle chain, or monthly update
//   Exit:  Reaction selected → nextAction screen
//
// PRODUCTION NOTES
//   state.postResultContext: "budget" | "lifestyle" | "monthlyUpdate" | "goal"
//   state.postResultReaction: "worried" | "ok" | "good" | "excited" (or null)
//   state.flowOrigin: set before entering this screen; preserved through finish

function renderPostResult() {
  const context = state.postResultContext;
  const theme   = state.postResultTheme;

  const headlines = {
    budget:       { title: "Budget updated",           sub: "Your spending plan has been saved." },
    lifestyle:    { title: "Lifestyle answers saved",  sub: lifestyleThemeLabel(theme) + " has been recorded." },
    monthlyUpdate:{ title: "Monthly check-in done",    sub: "Your account and debt balances are logged." },
    goal:         { title: "Goal saved",               sub: "Your new goal has been added to My Progress." }
  };
  const headline = headlines[context] || { title: "Changes saved", sub: "Your updates have been recorded." };

  const descByValue = {
    1: { label: "Worried", desc: "This budget feels tight and stressful. Let's look for ways to loosen it up before you commit." },
    2: { label: "OK", desc: "It's workable but leaves little breathing room. Some small adjustments could help." },
    3: { label: "Good", desc: "You're in a solid place with this plan. Let's keep the momentum going." },
    4: { label: "Excited", desc: "You're fired up about this plan. Let's make it work even harder for you." }
  };

  return `
    <div style="padding:24px 0 16px;">
      <div class="card" style="margin-bottom:20px;text-align:center;padding:18px 16px;">
        <div style="font-size:28px;margin-bottom:8px;">✓</div>
        <div style="font-weight:850;font-size:16px;margin-bottom:4px;">${h(headline.title)}</div>
        <p class="helper" style="margin:0;">${h(headline.sub)}</p>
      </div>

      ${context === "budget" ? `
      <div class="card" style="margin-bottom:12px;">
        <div class="section-title" style="margin-bottom:8px;">Your budget at a glance</div>
        ${CATEGORIES.slice(0,5).map(cat => `
          <div class="row" style="margin-bottom:4px;">
            <span class="helper">${h(catLabel(cat))}</span>
            <span class="stat-val">${budgetFmt(catValue(state.plan, cat))}</span>
          </div>
        `).join("")}
      </div>
      ` : ""}

      <h1 class="title" style="font-size:18px;margin-bottom:8px;">How does this feel?</h1>

      <style>
        #feelingSlider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 22px;
          width: 100%;
        }
        #feelingSlider::-webkit-slider-runnable-track {
          background: var(--bar);
          height: 5px;
          border-radius: 3px;
        }
        #feelingSlider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--accent);
          margin-top: -8px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }
        #feelingSlider::-moz-range-track {
          background: var(--bar);
          height: 5px;
          border-radius: 3px;
        }
        #feelingSlider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
        }
      </style>

      <div style="margin-bottom:16px;">
        <input type="range" min="1" max="4" step="1" value="2" id="feelingSlider"
               style="width:100%;cursor:pointer;margin:12px 0 8px"
               oninput="updateFeelingDescription()">
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:var(--muted);margin-bottom:12px;">
          <span>Worried</span>
          <span>Okay</span>
          <span>Good</span>
          <span>Excited</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;background:var(--soft);border:none;padding:12px;">
        <p class="helper" id="feelingDesc" style="margin:0;font-size:13px;color:var(--text);">It's workable but leaves little breathing room. Some small adjustments could help.</p>
      </div>

      <div style="position:sticky;bottom:0;background:var(--screen);padding:12px 0 4px;margin-top:8px;">
        <button class="button primary full" type="button" style="margin-bottom:8px;"
                onclick="selectReaction(+$('feelingSlider').value)">
          That's how I feel →
        </button>
        <div style="text-align:center;margin-top:8px;">
          <button class="button secondary full" style="font-size:12px;" type="button"
                  onclick="skipPostResult()">Skip for now</button>
        </div>
      </div>
    </div>
  `;
}

function updateFeelingDescription() {
  const val = parseInt($("feelingSlider").value) || 2;
  const descs = {
    1: "This budget feels tight and stressful. Let's look for ways to loosen it up before you commit.",
    2: "It's workable but leaves little breathing room. Some small adjustments could help.",
    3: "You're in a solid place with this plan. Let's keep the momentum going.",
    4: "You're fired up about this plan. Let's make it work even harder for you."
  };
  const el = $("feelingDesc");
  if (el) el.textContent = descs[val] || descs[2];
}

// 2b: v2's lifestyle themes were retired with their screens. The post-result
// loop still labels its context, so fall back to the generic word.
function lifestyleThemeLabel(themeKey) {
  const q = (typeof LW_QUESTIONS !== "undefined" ? LW_QUESTIONS : [])
    .find(function(x) { return x.dim === themeKey; });
  return q ? q.prompt : "Lifestyle";
}

function selectReaction(sliderValue) {
  const mapping = { 1: "worried", 2: "ok", 3: "good", 4: "excited" };
  state.postResultReaction = mapping[sliderValue] || "ok";
  go("nextAction");
}

function skipPostResult() {
  clearFlowState();
  go("myProgress");
}
