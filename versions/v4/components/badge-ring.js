// ─── Badge Ring Component ─────────────────────────────────────────────────────
// Single implementation of the horseshoe progress ring used across the Learn
// badge board, Topic page header, and Reward screen badge gain cards.
//
// Ring geometry (270° arc, 90° gap at bottom):
//   r = 32, viewBox = "0 0 80 80"
//   circumference  = 2π × 32 = 201.06
//   arc_length     = (270/360) × 201.06 = 150.80  ← the 270° visible span
//   gap            = 90° centered at 6 o'clock → arc runs from 7:30 to 4:30
//   rotation       = 135°  (SVG strokes start at 3 o'clock by default;
//                           rotating 135° clockwise puts the start at 7:30)
//   dashoffset(p%) = 150.80 × (1 - p/100)
//                    → 0 = full arc filled, 150.80 = nothing filled
//
// Animation: CSS transition on stroke-dashoffset. No JS animation loop needed.
// Supported in all modern browsers — sufficient for user testing context.

const RING_R        = 32;
const RING_CIRC     = 201.06;  // 2π × 32
const RING_ARC      = 150.80;  // (270/360) × 201.06
const RING_ROTATION = 135;     // degrees — positions arc start at 7:30

// Returns the hex fill color for a given tier name.
// Reads from state.tiers so changing tiers in state.js propagates automatically.
function tierColor(tierName) {
  const tier = state.tiers.find(t => t.name === tierName);
  return tier ? tier.color : "var(--tier-copper)"; // fallback to Copper
}

// Returns whether any lesson tied to this badge is a daily task bonus lesson.
// Derived from lesson data rather than stored on badge — stays in sync automatically.
function badgeHasBonus(badgeName) {
  return state.lessons.some(l => l.dailyTask && l.badges.includes(badgeName));
}

// Renders a horseshoe SVG progress ring for a badge.
//
// badge: badge object from state.badges (needs .tier, .level, .progress)
// size:  "sm" | "md" | "lg" — maps to CSS .ring-wrap size variants
//          sm = small inline context (reward row, recently active)
//          md = badge board grid (default)
//          lg = topic page header (prominent)
// pct:   explicit progress % override — reward screen passes newProgress here
//          so the ring shows post-XP state rather than the badge's current value
function renderBadgeRing(badge, size = "md", pct = null) {
  const fill        = pct !== null ? pct : badge.progress;
  const color       = tierColor(badge.tier);
  const tierInitial = badge.tier ? badge.tier[0] : "?";

  // dashoffset controls how much of the arc is revealed.
  // 0 = entire 270° arc filled; RING_ARC = arc completely empty.
  const dashoffset = (RING_ARC * (1 - fill / 100)).toFixed(2);

  // Pixel dimensions keyed to size variant (matches .ring-wrap.{size} in CSS)
  const px = size === "sm" ? 48 : size === "lg" ? 90 : 72;

  return `
    <div class="ring-wrap ${h(size)}">
      <svg viewBox="0 0 80 80" width="${px}" height="${px}" style="display:block;">
        <!-- Track: permanent 270° gray arc — always visible as the "empty" rail -->
        <circle cx="40" cy="40" r="${RING_R}"
                fill="none"
                style="stroke:var(--progress-bg)"
                stroke-width="8"
                stroke-dasharray="${RING_ARC} ${RING_CIRC}"
                transform="rotate(${RING_ROTATION}, 40, 40)" />
        <!-- Fill: tier-colored arc that grows as XP is applied.
             stroke-dashoffset transitions smoothly via CSS — no JS loop. -->
        <circle cx="40" cy="40" r="${RING_R}"
                fill="none"
                style="stroke:${color};transition:stroke-dashoffset 0.8s ease;"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${RING_ARC} ${RING_CIRC}"
                stroke-dashoffset="${dashoffset}"
                transform="rotate(${RING_ROTATION}, 40, 40)" />
      </svg>
      <!-- Label: centered over the SVG via absolute positioning in .ring-wrap -->
      <div class="ring-label">
        <span>${h(tierInitial)}${badge.level}</span>
        <span class="ring-pct">${fill}%</span>
      </div>
    </div>
  `;
}
