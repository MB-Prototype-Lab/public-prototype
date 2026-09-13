// --- Buddy (L15, revised by L22) ---------------------------------------------
// Nothing here is generated. L22 allows OWNER-SUPPLIED static illustrations,
// selected by buddy state; D10's prohibition is on Claude generating art and it
// still holds.
//
// -- THE IMAGE IS PREFERRED, THE DESCRIPTION IS THE FALLBACK ------------------
// The labelled description below is NOT dead code now that art exists. No image
// set covers every breed x coat x pattern x eyes x nose x size x pose, and D19
// forbids a screen rendering empty — so a state with no matching image must
// degrade to the description rather than to a gap. Deleting it would turn a
// missing file into a blank stage.
//
// Why the description was worth building in the first place: it proves the
// customization plumbing works end to end. A tester picks a breed and the stage
// visibly reflects it — the choice registers and is legible, which is what
// onboarding step 7 exists to test. A swatch would have tested nothing. That
// same plumbing is what makes the art swap cheap now.
//
// -- STILL NO SHEETS ----------------------------------------------------------
// D39/D40 are void in practice. Flat cream sheets, CSS background-position
// cropping, six fixed sheets and the dropped eye/nose colours were all
// consequences of raster art being unable to recolour. The owner's art is
// SEPARATE FILES chosen by state, not one sheet addressed by offset, so there
// is still nothing to crop — DO NOT build the cropping machinery. See the
// "Don't" list in versions/v3/CLAUDE.md.
//
// The pickers are also NOT reduced to match whatever the art covers (L18): the
// image varies along whichever stats the owner's plan names, and the
// description carries the attributes it does not.

// The six poses from 10-ai-assets.md, in its cell order. Poses 1/3/4/5 are the
// ambient idle cycle; 2 and 6 are event-driven (chat open, reward/streak).
const BUDDY_POSES = [
  { id: 1, name: "sitting, facing forward, calm",     idle: true  },
  { id: 2, name: "head tilted, looking up at you",    idle: false },
  { id: 3, name: "drinking from a bowl, head down",   idle: true  },
  { id: 4, name: "nose to the ground, sniffing",      idle: true  },
  { id: 5, name: "lying down, paws forward, relaxed", idle: true  },
  { id: 6, name: "sitting upright, paws raised, joyful", idle: false }
];

const BUDDY_IDLE_POSES = BUDDY_POSES.filter(p => p.idle).map(p => p.id);

// ─── Customization options (single source — creator + admin both read these) ──
// These drive the description and the picker controls, and they are the
// vocabulary any image filename has to agree with (L22).
// Values may carry underscores/spaces; the stage renders them with _ → space.
// -- "prototype": the one attribute value backed by a real illustration -------
// L22 allows owner-supplied art, and the first image to arrive is ONE fixed
// illustration with its background baked in. It cannot vary by breed, coat,
// eyes or size -- so it is not a breed, it is a MODE. Picking it on any
// attribute means "show me the picture"; every other value keeps the
// description exactly as it was.
//
// First in every list on purpose: it is the option a tester is meant to find.
const BUDDY_PROTOTYPE = "prototype";
const BUDDY_PROTOTYPE_IMG = "assets/img/buddy-prototype.png";

const BUDDY_BREEDS = [
  BUDDY_PROTOTYPE,
  "golden_retriever", "corgi", "beagle", "labrador",
  "poodle", "dachshund", "husky", "shiba_inu"
];
const BUDDY_FUR_PATTERNS = [BUDDY_PROTOTYPE, "solid", "patches", "spots", "brindle", "merle", "tuxedo"];
const BUDDY_FUR_COLORS = [BUDDY_PROTOTYPE, "cream", "golden", "chocolate", "grey", "tan and white", "tricolor"];
const BUDDY_EYE_COLORS = [BUDDY_PROTOTYPE, "brown", "amber", "blue", "green"];

// Nose and size have no onboarding step -- they are admin-only dropdowns. They
// carry the value anyway so the admin can reach every state the creator can.
const BUDDY_NOSE_COLORS = [BUDDY_PROTOTYPE, "black", "brown", "pink"];
const BUDDY_SIZES = [BUDDY_PROTOTYPE, "small", "medium", "large"];

// value → CSS background for the circular swatches. Multi-tone coats use a
// gradient so the swatch still reads as that coat.
const BUDDY_FUR_COLOR_CSS = {
  // Without an entry here the swatch renders as a blank circle -- these two
  // pickers draw a colour, not a label. Deliberately NOT a coat colour: a
  // checker reads as "a picture goes here" rather than implying a cream dog.
  "prototype":     "repeating-conic-gradient(#CFC6B8 0 25%, #F2ECDF 0 50%) 50% / 10px 10px",
  "cream":         "#EFE3C6",
  "golden":        "#D9A441",
  "chocolate":     "#5A3A22",
  "grey":          "#9BA1A6",
  "tan and white": "linear-gradient(90deg,#D9A441 50%,#F2ECDD 50%)",
  "tricolor":      "linear-gradient(90deg,#3A2A20 33%,#D9A441 33% 66%,#F2ECDD 66%)"
};
const BUDDY_EYE_COLOR_CSS = {
  "prototype": "repeating-conic-gradient(#CFC6B8 0 25%, #F2ECDF 0 50%) 50% / 10px 10px",
  "brown": "#6B4423", "amber": "#D99B2B", "blue": "#4A90D9", "green": "#4A9D5B"
};

// 09-design-system: "a small movement every four to six seconds, never
// constant." Randomised inside that window so the cadence never feels metronomic.
const BUDDY_IDLE_MIN_MS = 4000;
const BUDDY_IDLE_MAX_MS = 6000;

function buddyCurrentPose() {
  const id = state.buddyPose || 1;
  return BUDDY_POSES.find(p => p.id === id) || BUDDY_POSES[0];
}

function buddySetPose(id) {
  state.buddyPose = id;
  render();
}

/**
 * Start the ambient idle cycle. Stops under prefers-reduced-motion — the design
 * system's floor requires it, and a placeholder that flickers text is worse
 * than a still one.
 */
function buddyStartIdle() {
  buddyStopIdle();
  if (v3PrefersReducedMotion()) return;
  const step = () => {
    const others = BUDDY_IDLE_POSES.filter(id => id !== state.buddyPose);
    state.buddyPose = others[Math.floor(Math.random() * others.length)];
    const el = document.getElementById("buddyStage");
    if (el) el.innerHTML = renderBuddyInner();      // repaint in place, no full render()
    state.buddyIdleTimer = setTimeout(step,
      BUDDY_IDLE_MIN_MS + Math.random() * (BUDDY_IDLE_MAX_MS - BUDDY_IDLE_MIN_MS));
  };
  state.buddyIdleTimer = setTimeout(step,
    BUDDY_IDLE_MIN_MS + Math.random() * (BUDDY_IDLE_MAX_MS - BUDDY_IDLE_MIN_MS));
}

function buddyStopIdle() {
  if (state.buddyIdleTimer) { clearTimeout(state.buddyIdleTimer); state.buddyIdleTimer = null; }
}

function v3PrefersReducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) { return false; }
}

/**
 * The stage. `opts.compact` shrinks it; `opts.square` makes it a 1:1 tile (used
 * by the character creator).
 */
function renderBuddyStage(opts) {
  const compact = !!(opts && opts.compact);
  const square  = !!(opts && opts.square);
  // `cls` lets one caller size the stage without touching the shared rules --
  // the character creator needs a shorter one to fit its list and its footer on
  // a single screen.
  const extra   = (opts && opts.cls) || "";
  return `
    <div class="buddy-stage ${compact ? "buddy-stage-compact" : ""} ${square ? "buddy-stage-square" : ""} ${h(extra)}">
      <div id="buddyStage" class="buddy-inner">${renderBuddyInner()}</div>
    </div>
  `;
}

/**
 * The illustration, filling the stage.
 *
 * -- THE FALLBACK IS NOT POLITENESS (L22, D19) -------------------------------
 * If the file is missing the <img> must degrade to the DESCRIPTION, never to a
 * blank card. Same shape onbVideoSpeak uses when a .wav has not been generated:
 * try the asset, and hand back to the text path on error. Without it, a
 * mistyped filename is a silently empty stage rather than a visible fallback.
 *
 * -- WHY THE NAME IS OVERLAID -------------------------------------------------
 * The stage exists to prove the customization plumbing works: you pick a thing
 * and the stage visibly reflects it. A fixed illustration cannot do that for
 * breed or coat -- but the final creator step is NAMING, and a bare picture
 * would mean typing a name and watching nothing happen. The name rides on top
 * so that step still lands.
 */
function renderBuddyImage(b) {
  const name = String((b && b.name) || "").trim();
  return `
    <img class="buddy-img" src="${BUDDY_PROTOTYPE_IMG}"
         alt="${h(name || "Your buddy")}, sitting in a garden"
         onerror="buddyImageFailed(this)">
    ${name ? `<p class="buddy-img-name">${h(name)}</p>` : ""}
  `;
}

/**
 * The asset did not load. Fall back to the description in place, and remember
 * it for the rest of the session so every later stage skips the broken path
 * instead of re-requesting a file that is not there.
 */
let buddyImgBroken = false;
function buddyImageFailed(el) {
  buddyImgBroken = true;
  const host = el && el.closest ? el.closest(".buddy-inner") : null;
  if (host) host.innerHTML = renderBuddyDescription(state.buddy || {});
}

/**
 * Clear the broken-asset latch. Called by bootV3, because the flag is
 * module-level and a reset would otherwise leave a previous session's missing
 * file suppressing art that is now present -- the stage would show the
 * description forever with nothing in `state` to explain why.
 */
function buddyResetArt() {
  buddyImgBroken = false;
}

/**
 * Is the buddy in prototype mode -- i.e. should the stage show the illustration?
 *
 * ANY attribute set to `prototype` counts. A single baked illustration cannot be
 * half-applied: "prototype breed with chocolate fur" describes nothing the image
 * can show, so there is no useful state between "picture" and "description".
 * Onboarding reinforces this by filling the rest in when breed is picked
 * (onbSetBuddy), but the check stays permissive so an admin poking one dropdown
 * still gets a coherent stage rather than a contradiction.
 */
function buddyIsPrototype() {
  const b = state.buddy || {};
  return [b.breed, b.furColor, b.furPattern, b.eyeColor, b.noseColor, b.size]
    .indexOf(BUDDY_PROTOTYPE) !== -1;
}

// Kept separate so the idle tick can repaint just this, rather than calling
// render() every 4–6 seconds and blowing away focus across the whole screen.
//
// This is the swap architecture section 13 predicted: the image branch lives
// HERE, inside the content, so the frame, the idle tick, the pickers and
// state.buddy are all untouched by art arriving.
function renderBuddyInner() {
  const b = state.buddy || {};
  if (buddyIsPrototype() && !buddyImgBroken) return renderBuddyImage(b);
  return renderBuddyDescription(b);
}

/** The labelled frame. Still governs every state the art does not cover. */
function renderBuddyDescription(b) {
  const pose = buddyCurrentPose();
  const breed = String(b.breed || "").replace(/_/g, " ");
  const coat = [b.furColor && h(b.furColor), b.furPattern && h(b.furPattern)].filter(Boolean).join(" ");
  return `
    <p class="buddy-name">${h(b.name || "Your buddy")}</p>
    <p class="buddy-desc">${h(breed)}${coat ? " · " + coat + " fur" : ""}</p>
    <p class="buddy-desc">${b.eyeColor ? h(b.eyeColor) + " eyes · " : ""}${b.noseColor ? h(b.noseColor) + " nose" : ""}</p>
    <p class="buddy-desc">${h(b.size || "medium")}</p>
    <p class="buddy-pose">${h(pose.name)}</p>
    <p class="buddy-note">illustration placeholder</p>
  `;
}

/** One-line description — for surfaces too small for the stage. */
function buddyDescription() {
  const b = state.buddy || {};
  return [String(b.breed || "").replace(/_/g, " "), b.furColor && b.furColor + " fur", b.size]
    .filter(Boolean).join(" · ");
}

function renderBuddyAdmin() {
  const b = state.buddy || {};
  const fields = [
    ["breed", BUDDY_BREEDS],
    ["furColor", BUDDY_FUR_COLORS],
    ["furPattern", BUDDY_FUR_PATTERNS],
    ["eyeColor", BUDDY_EYE_COLORS],
    ["noseColor", BUDDY_NOSE_COLORS],
    ["size", BUDDY_SIZES]
  ];
  return `
    <div class="admin-card">
      <p class="admin-card-title">Buddy (L15 → L22)</p>
      <p class="helper" style="margin-bottom:10px;">
        All attributes are live — D40 dropped eyes/nose only because raster
        sheets cannot recolour, and there are no sheets. The creator sets breed,
        fur colour, pattern, eyes and name; nose and size live here.
      </p>
      <div class="input-group">
        <label>Name</label>
        <input value="${h(b.name || "")}" onchange="state.buddy.name=this.value;render()">
      </div>
      ${fields.map(([key, opts]) => `
        <div class="input-group">
          <label>${h(key)}</label>
          <select onchange="state.buddy.${key}=this.value;render()">
            ${opts.map(o => `<option value="${h(o)}" ${b[key] === o ? "selected" : ""}>${h(o)}</option>`).join("")}
          </select>
        </div>
      `).join("")}
      <div class="input-group">
        <label>Pose</label>
        <select onchange="buddySetPose(parseInt(this.value,10))">
          ${BUDDY_POSES.map(p => `
            <option value="${p.id}" ${state.buddyPose === p.id ? "selected" : ""}>
              ${p.id}. ${h(p.name)}${p.idle ? " (idle)" : ""}
            </option>`).join("")}
        </select>
      </div>
      <p class="helper" style="font-size:10px;">
        Idle cycles poses ${BUDDY_IDLE_POSES.join(", ")} every 4–6s.
        Reduced motion: ${v3PrefersReducedMotion() ? "ON — idle stopped" : "off"}.
      </p>
    </div>
  `;
}
