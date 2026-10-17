// The film's two LOOKS, derived from the app's own palette.
//
// ── Two, not four ────────────────────────────────────────────────────────────
// The app has four themes; the film has two renders — one dark, one light — and
// each serves the two themes on its side. That is deliberate: the brief is CNBC
// crossed with TikTok, and that energy comes from a committed broadcast palette
// with one hot accent. Rendering the film in Natural Light's calm cream would
// have produced a visibly lower-energy film for half the testers.
//
//   dark  → themes `dark` and `naturalDark`
//   light → themes `light` and `naturalLight`
//
// ── Derived, not copied ──────────────────────────────────────────────────────
// The grounds and inks are PUSHED past the app's tokens: broadcast wants more
// contrast than a reading surface does, so the dark ground goes deeper than any
// theme's and the light ink goes darker. What is not invented is the ACCENT —
// that is the app's brand green, read straight out of variables.css, so the film
// cannot drift from the product by being retyped here.
//
// One film serves two themes, so it cannot use both of their accents. It uses
// the natural pair's green, because Natural Light is the default theme (L21) and
// the D36 repaint is the design the product actually stands behind.

import fs from "node:fs";

function declarations(body) {
  const out = {};
  for (const [, k, v] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[k] = v.trim();
  return out;
}

function scopes(css) {
  const found = [];
  for (const m of css.matchAll(/(^:root(?![^{]*\[)|^\.theme-[a-z-]+)\s*\{(.*?)^\}/gms)) {
    found.push({ selector: m[1].trim(), vars: declarations(m[2]) });
  }
  return found;
}

function resolve(value, table, depth = 0) {
  if (depth > 12) return value;
  const m = /^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i.exec(String(value).trim());
  if (!m) return value;
  const next = table[m[1]];
  if (next == null) return (m[2] || value).trim();
  return resolve(next, table, depth + 1);
}

/** #rrggbb → [r,g,b]. */
function rgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hex = (c) => "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Blend `a` toward `b` by `t`. */
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  if (!A || !B) return b;
  return hex(A.map((v, i) => v + (B[i] - v) * t));
}

/** Relative luminance, for the contrast guard below. */
function lum(c) {
  const [r, g, b] = rgb(c).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Darken/lighten `c` against `ground` until it clears `ratio`. */
function ensure(c, ground, ratio) {
  const toward = lum(ground) > 0.5 ? "#000000" : "#ffffff";
  let out = c;
  for (let i = 0; i < 24 && contrast(out, ground) < ratio; i++) out = mix(out, toward, 0.06);
  return out;
}

function flatten(cssPath, selector) {
  const blocks = scopes(fs.readFileSync(cssPath, "utf8"));
  const table = {};
  for (const b of blocks) if (b.selector === ":root") Object.assign(table, b.vars);
  if (selector) {
    const hit = blocks.find(b => b.selector === selector);
    if (!hit) throw new Error(`variables.css has no "${selector}" block — the look map is stale`);
    Object.assign(table, hit.vars);
  }
  const flat = {};
  for (const k of Object.keys(table)) flat[k] = resolve(table[k], table);
  return flat;
}

export const LOOKS = ["dark", "light"];

// Which app theme each render serves. The app picks its film by theme id: a
// theme missing here plays another look's render (onbFilmAnyLook in
// app/screens/onboarding.js) and gets its own look only once it is mapped here.
export const LOOK_FOR_THEME = {
  dark: "dark", naturalDark: "dark",
  light: "light", naturalLight: "light"
};

export function look(cssPath, id) {
  if (!LOOKS.includes(id)) throw new Error(`unknown look "${id}"`);
  const natural = flatten(cssPath, null);                    // :root = Natural Light
  const naturalDark = flatten(cssPath, ".theme-natural-dark");

  if (id === "dark") {
    // Deeper than any theme's ground. A reading surface wants a soft dark; a
    // broadcast frame wants the accent to burn against near-black.
    const ground = mix(naturalDark["--cream"], "#000000", 0.55);
    const accent = naturalDark["--accent"];
    return {
      id, isDark: true, ground,
      panel:   mix(ground, "#ffffff", 0.06),
      rule:    mix(ground, "#ffffff", 0.14),
      ink:     mix(naturalDark["--ink"], "#ffffff", 0.35),
      inkSoft: ensure(naturalDark["--ink-soft"], ground, 4.5),
      accent,
      accentSoft: mix(ground, accent, 0.22),
      onAccent: mix(ground, "#000000", 0.4),
      hot:     ensure(naturalDark["--warn"], ground, 4.5),
      wash:    accent
    };
  }

  const ground = mix(natural["--cream"], "#ffffff", 0.45);
  const accent = natural["--accent"];
  return {
    id, isDark: false, ground,
    panel:   mix(ground, "#000000", 0.05),
    rule:    mix(ground, "#000000", 0.12),
    ink:     mix(natural["--ink"], "#000000", 0.35),
    inkSoft: ensure(natural["--ink-soft"], ground, 4.5),
    accent,
    accentSoft: mix(ground, accent, 0.16),
    onAccent: "#ffffff",
    hot:     ensure(natural["--warn"], ground, 4.5),
    wash:    accent
  };
}
