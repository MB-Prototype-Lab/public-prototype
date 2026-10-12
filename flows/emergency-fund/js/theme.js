// ─── Theme selection (L21) ───────────────────────────────────────────────────
// Four themes, picked from the Admin Tools panel. Two reproduce v2's palette,
// two are the D36 repaint; each pair has a light and a dark. Dark is the
// default — see plan.md L21 for why that overrides D36's cream-first intent.
//
// This list is the SINGLE SOURCE OF TRUTH. Before it existed, the two-way
// assumption was hardcoded in four places (state's default, render's class
// toggle, the admin button's label, and the sweep), and a third theme would
// have had to be added to all four. Add a theme here and everything follows.
//
// The class goes on `.screen` only. It must never reach the page, the bezel or
// the admin panel — those are chrome and hold still while the app repaints
// (variables.css explains the contract; scripts/sweep.sh enforces it).

const THEMES = [
  { id: "light",        label: "Light",         cls: "theme-light",        family: "v2"      },
  { id: "dark",         label: "Dark",          cls: "theme-dark",         family: "v2"      },
  { id: "naturalLight", label: "Natural Light", cls: "",                   family: "natural" },
  { id: "naturalDark",  label: "Natural Dark",  cls: "theme-natural-dark", family: "natural" }
];

// Natural Light is the empty string: it IS :root, so it applies no class.
const THEME_CLASSES = THEMES.map(t => t.cls).filter(Boolean);

// Natural Light. L21 originally made this Dark, deliberately — so a tester's
// first screen was not the D36 cream and the repaint had to be chosen rather
// than defaulted into. That trade has been called the other way now: the cream
// IS the design (D36), and defaulting to a v2 palette meant most testers never
// saw it.
//
// ONE THING THIS COSTS, worth knowing before debugging a theme problem:
// Natural Light's class is the EMPTY STRING — it is :root, so it applies no
// class at all. Now that it is also the default, "themeApply never ran" and
// "the theme is correct" look identical on screen. The comment below used to
// warn that an unclassed .screen would silently render as Natural Light and
// look deliberate; that failure is now genuinely invisible, so the sweep's
// theme checks are the only thing standing between it and a silent regression.
const THEME_DEFAULT = "naturalLight";

/**
 * Resolve an id to a theme. An unknown id (stale state, a hand-edited value)
 * falls back to the default rather than leaving .screen unclassed. Both now
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

/** Is the active theme a dark one? For anything that needs to branch on it. */
function themeIsDark() {
  const id = themeCurrent().id;
  return id === "dark" || id === "naturalDark";
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
