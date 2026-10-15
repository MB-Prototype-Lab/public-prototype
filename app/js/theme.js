// ─── Theme selection (L21) ───────────────────────────────────────────────────
// Tools offers cool and Natural palettes, each in light and dark. Natural
// Light is the default (L21). Add themes here so the picker and classes agree.
//
// The class goes on `.screen` only. It must never reach the page, the bezel or
// the admin panel — those are chrome and hold still while the app repaints
// (variables.css explains the contract; scripts/sweep.sh enforces it).

const THEMES = [
  { id: "light",        label: "Light",         cls: "theme-light"        },
  { id: "dark",         label: "Dark",          cls: "theme-dark"         },
  { id: "naturalLight", label: "Natural Light", cls: ""                   },
  { id: "naturalDark",  label: "Natural Dark",  cls: "theme-natural-dark" }
];

// Natural Light is the empty string: it IS :root, so it applies no class.
const THEME_CLASSES = THEMES.map(t => t.cls).filter(Boolean);

// An unclassed .screen looks like the default even if themeApply never ran;
// the sweep must verify theme switching, not just the initial appearance.
const THEME_DEFAULT = "naturalLight";

/**
 * Resolve an id to a theme. An unknown id (stale state, a hand-edited value)
 * falls back to the default rather than leaving .screen unclassed. Both
 * render Natural Light, but they are not the same thing: one is a resolved
 * theme, the other is no theme at all, and only the first survives a switch
 * away and back.
 */
function themeById(id) {
  const hit = THEMES.filter(t => t.id === id)[0];
  if (hit) return hit;
  return THEMES.filter(t => t.id === THEME_DEFAULT)[0] || THEMES[0];
}

function themeCurrent() {
  return themeById(state.settings && state.settings.colorMode);
}

/** Put the right class on .screen. Called from render(). */
function themeApply() {
  const el = document.querySelector(".screen");
  if (!el) return;
  const cls = themeCurrent().cls;
  THEME_CLASSES.forEach(c => el.classList.toggle(c, c === cls));
}

function themeSet(id) {
  if (!state.settings) state.settings = {};
  state.settings.colorMode = themeById(id).id;
  render();
}
