// --- Buddy (L22) -------------------------------------------------------------
// Nothing here is generated. L22 allows OWNER-SUPPLIED static illustrations,
// selected by buddy state; D10 prohibits app or agent-generated art.
//
// -- THE IMAGE IS PREFERRED, THE DESCRIPTION IS THE FALLBACK ------------------
// The labelled description below is a required fallback. Every
// stage draws the one illustration whatever the appearance attributes say, and
// D19 forbids a screen rendering empty — so an image that fails to load
// degrades to the description rather than to a gap. Deleting it would turn a
// missing file into a blank stage.
//
// L22 allows separate image files, not sprite-sheet cropping. Appearance
// dropdowns affect the description fallback, not the fixed illustration.

// The six poses. Poses 1/3/4/5 are the ambient idle cycle; 2 and 6 are
// event-driven (chat open, reward/streak).
const BUDDY_POSES = [
  { id: 1, name: "sitting, facing forward, calm",     idle: true  },
  { id: 2, name: "head tilted, looking up at you",    idle: false },
  { id: 3, name: "drinking from a bowl, head down",   idle: true  },
  { id: 4, name: "nose to the ground, sniffing",      idle: true  },
  { id: 5, name: "lying down, paws forward, relaxed", idle: true  },
  { id: 6, name: "sitting upright, paws raised, joyful", idle: false }
];

const BUDDY_IDLE_POSES = BUDDY_POSES.filter(p => p.idle).map(p => p.id);

// ─── Customization options (single source — Tools reads these) ──────────────
// These drive the description and the Tools dropdowns, and they are the
// vocabulary of the missing-image fallback.
// Values may carry underscores/spaces; the stage renders them with _ → space.
// -- "prototype": the one attribute value backed by a real illustration -------
// The owner-supplied art is one fixed illustration with its background baked
// in. It cannot vary by breed, coat,
// eyes or size -- so it is not a breed: it names the picture, and every stage
// draws that picture whatever value an attribute holds.
//
// First in every list on purpose: it is the option a tester is meant to find.
const BUDDY_PROTOTYPE = "prototype";
const BUDDY_PROTOTYPE_IMG = "assets/img/buddy-prototype.png";

const BUDDY_BREEDS = [
  BUDDY_PROTOTYPE,
  "golden_retriever", "corgi", "beagle", "labrador",
  "poodle", "dachshund", "husky", "shiba_inu"
];
// ─── Body type ───────────────────────────────────────────────────────────────
// Nine puppy builds: the prototype, plus eight groups with no art. Only Tools
// sets one, and it never changes the picture.
//
// ⚠ A body type must NEVER be written into `breed`: renderBuddyDescription()
// prints `b.breed` as the breed, and the Tools dropdown for `breed` offers
// BUDDY_BREEDS, which contains no body-type id. It lives in its own field.
const BUDDY_BODY_TYPES = [
  { id: BUDDY_PROTOTYPE, label: "Prototype" },
  { id: "toy",           label: "Toy" },
  { id: "low_set",       label: "Low-set" },
  { id: "terrier",       label: "Terrier" },
  { id: "sighthound",    label: "Sighthound" },
  { id: "spitz",         label: "Spitz" },
  { id: "herding",       label: "Herding" },
  { id: "sporting",      label: "Sporting" },
  { id: "mastiff",       label: "Mastiff" }
];

/** The label for a body-type id, for copy and the admin readout. */
function buddyBodyLabel(id) {
  const t = BUDDY_BODY_TYPES.filter(function (x) { return x.id === id; })[0];
  return t ? t.label : String(id || "");
}

const BUDDY_FUR_PATTERNS = [BUDDY_PROTOTYPE, "solid", "patches", "spots", "brindle", "merle", "tuxedo"];
const BUDDY_FUR_COLORS = [BUDDY_PROTOTYPE, "cream", "golden", "chocolate", "grey", "tan and white", "tricolor"];
const BUDDY_EYE_COLORS = [BUDDY_PROTOTYPE, "brown", "amber", "blue", "green"];

const BUDDY_NOSE_COLORS = [BUDDY_PROTOTYPE, "black", "brown", "pink"];
const BUDDY_SIZES = [BUDDY_PROTOTYPE, "small", "medium", "large"];

// Pronouns, asked on onboarding's buddy step. Stored as the id; the label is
// what a tester reads. Ids stay one short word because they ride in the Useberry
// value trail (js/value-trail.js, key "pro") -- a fixed list, never free text.
// Prose does not use them: the buddy speaks in the first person everywhere.
const BUDDY_PRONOUNS = [
  { id: "he",   label: "He/Him" },
  { id: "she",  label: "She/Her" },
  { id: "they", label: "They/Them" }
];

// A small movement every four to six seconds, never constant. Randomised
// inside that window so the cadence never feels metronomic.
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
  if (prefersReducedMotion()) return;
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

function prefersReducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) { return false; }
}

/**
 * The stage. `opts.compact` shrinks it; `opts.square` makes it a 1:1 tile (used
 * by onboarding's buddy step).
 */
function renderBuddyStage(opts) {
  const compact = !!(opts && opts.compact);
  const square  = !!(opts && opts.square);
  // `cls` lets one caller size the stage without touching the shared rules --
  // onboarding's buddy step needs a shorter one to fit its fields and its footer
  // on a single screen.
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
 * breed or coat -- but onboarding's buddy step asks for a NAME, and a bare picture
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
 * Clear the broken-asset latch. Called by bootApp, because the flag is
 * module-level and a reset would otherwise leave a previous session's missing
 * file suppressing art that is now present -- the stage would show the
 * description forever with nothing in `state` to explain why.
 */
function buddyResetArt() {
  buddyImgBroken = false;
}

// Kept separate so the idle tick can repaint just this, rather than calling
// render() every 4–6 seconds and blowing away focus across the whole screen.
//
// Keep the image/fallback choice inside the content so both paths share the
// frame and idle tick (L22).
function renderBuddyInner() {
  const b = state.buddy || {};
  if (!buddyImgBroken) return renderBuddyImage(b);
  return renderBuddyDescription(b);
}

/** The labelled frame, drawn when the illustration fails to load. */
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

function renderBuddyAdmin() {
  const b = state.buddy || {};
  const fields = [
    ["breed", BUDDY_BREEDS],
    ["bodyType", BUDDY_BODY_TYPES.map(t => t.id)],
    ["furColor", BUDDY_FUR_COLORS],
    ["furPattern", BUDDY_FUR_PATTERNS],
    ["eyeColor", BUDDY_EYE_COLORS],
    ["noseColor", BUDDY_NOSE_COLORS],
    ["size", BUDDY_SIZES]
  ];
  return `
    <div class="admin-card">
      <p class="admin-card-title">Buddy (L22)</p>
      <p class="helper" style="margin-bottom:10px;">
        All attributes are live. Onboarding asks only for a name and
        pronouns; every appearance attribute lives here.
        <strong>The appearance dropdowns do not change the picture</strong> —
        every stage draws the one illustration.
      </p>
      <p class="helper" style="margin-bottom:10px;">
        <strong>Body type:</strong> ${h(buddyBodyLabel(b.bodyType || BUDDY_PROTOTYPE))}.
        Onboarding does not ask for it. It is deliberately INERT — eight of the
        nine have no art, so picking one changes nothing on the stage. It is also
        kept out of <code>breed</code> on purpose: the description card a missing
        image falls back to would print it as the breed, and the breed dropdown
        cannot show it.
      </p>
      <div class="input-group">
        <label>Name</label>
        <input value="${h(b.name || "")}" onchange="state.buddy.name=this.value;render()">
      </div>
      <div class="input-group">
        <label>Pronouns</label>
        <select onchange="state.buddy.pronouns=this.value;render()">
          <option value="" ${b.pronouns ? "" : "selected"}>— not chosen —</option>
          ${BUDDY_PRONOUNS.map(p => `<option value="${h(p.id)}" ${b.pronouns === p.id ? "selected" : ""}>${h(p.label)}</option>`).join("")}
        </select>
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
        Reduced motion: ${prefersReducedMotion() ? "ON — idle stopped" : "off"}.
      </p>
    </div>
  `;
}
