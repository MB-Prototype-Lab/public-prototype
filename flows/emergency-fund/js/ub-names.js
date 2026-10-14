// ─── Naming what a tester clicked ────────────────────────────────────────────
// v4 only. Phase 2 of the usability-tracking work; Phase 1 (js/screen-url.js)
// made each SCREEN visible, this makes each CONTROL on it identifiable.
//
// Without it a click report is a dot at x=140,y=612 on a screen, and a Useberry
// "Trigger" task-completion criterion — click this element and the task counts
// as done — has nothing stable to hold onto, because render() replaces the
// whole screen's innerHTML and every element is a new node each time.
//
// ── DERIVED, NOT HAND-WRITTEN ───────────────────────────────────────────────
// There are ~270 interactive controls across 47 screen files. Typing a name
// onto each is a diff nobody can review, and every one of them is a thing that
// can go stale when the handler beneath it changes.
//
// So the name is computed from the handler that is already on the element. It
// cannot drift from the code, because it IS the code: rename bbToggleHelp and
// the reports rename themselves. New screens are covered the day they are
// written, with nothing to remember.
//
// The stamping runs against the LIVE DOM, after render() has written it, so
// every `${...}` in a screen's template literal has already been substituted —
// `goToCategory('${catArg}')` arrives here as `goToCategory('Groceries')`.
//
// ── AN EXPLICIT NAME ALWAYS WINS ────────────────────────────────────────────
// A hand-placed data-ub is never overwritten. That is the escape hatch for the
// handful of controls whose derived name reads badly; use it sparingly, because
// a hand-written name is the thing that goes stale.

// Statements that are repaint plumbing rather than anything a tester did. They
// appear on about a third of the handlers and would otherwise be the name.
const UB_NOISE = ["render", "debouncedRender", "event.stopPropagation", "return false"];

// How many statements of a compound handler survive into the name.
// `topbarToggleMenu();navAdminJump('settings')` is genuinely two things, and
// naming it after only the first collapses every menu item onto one name.
const UB_MAX_STATEMENTS = 2;
const UB_MAX_ARG = 24;

/** One statement → `fn:arg:arg`, or `lhs=rhs` for an assignment. */
function ubStatementName(stmt) {
  const s = String(stmt || "").trim();
  if (!s) return "";

  const call = s.match(/^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)\s*$/);
  if (call) {
    const args = ubSplitArgs(call[2]).map(ubCleanArg).filter(Boolean);
    return [call[1]].concat(args).join(":");
  }

  // `state.onboarding.householdSize=2` — an assignment IS the action here, and
  // the last path segment is the only readable part of it.
  const assign = s.match(/^([\w$.[\]'"]+)\s*=\s*([\s\S]*)$/);
  if (assign) {
    const lhs = assign[1].split(".").pop().replace(/\[.*$/, "");
    const rhs = ubCleanArg(assign[2]);
    return rhs ? lhs + "=" + rhs : lhs;
  }

  return ubCleanArg(s);
}

/** Split on top-level commas only — an arg can be an object or a call. */
function ubSplitArgs(src) {
  const out = [];
  let depth = 0, quote = null, cur = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
      cur += c; continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// `this.value` is the tester's input, which belongs in the value trail
// (js/value-trail.js), never in the control's NAME — a name that changes with
// the value is a different control on every keystroke.
const UB_DROP_ARGS = ["this", "this.value", "this.checked", "event", "e", "{}", "[]", "null", "undefined", "true", "false"];

function ubCleanArg(raw) {
  let a = String(raw || "").trim().replace(/^['"]|['"]$/g, "").trim();
  if (!a || UB_DROP_ARGS.indexOf(a) !== -1) return "";
  if (/^this\./.test(a)) return "";
  a = a.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return a.slice(0, UB_MAX_ARG);
}

/**
 * A handler string → the action part of a name.
 *
 * Pure, and deliberately so: this is the half worth testing, and the DOM walk
 * below is glue thin enough to read.
 */
function ubActionName(handler) {
  const stmts = String(handler || "")
    .split(";")
    .map(function (s) { return s.trim(); })
    .filter(function (s) {
      if (!s) return false;
      const bare = s.replace(/\(\s*\)$/, "");
      return UB_NOISE.indexOf(bare) === -1 && UB_NOISE.indexOf(s) === -1;
    })
    .slice(0, UB_MAX_STATEMENTS)
    .map(ubStatementName)
    .filter(Boolean);
  return stmts.join("+");
}

/** Structural fallback for a control with no inline handler. */
function ubStructuralName(tag, type, hint, ordinal) {
  const parts = [String(tag || "el").toLowerCase()];
  if (type) parts.push(String(type).toLowerCase());
  const h = hint ? ubCleanArg(hint) : "";
  parts.push(h || "n" + (ordinal || 0));
  return parts.join(":");
}

/** `<screen-slug>/<action>` — the screen half makes the same button on step 1
 *  and step 2 two different things, which is what a flow report needs. */
function ubFullName(screenPart, action) {
  const a = action || "unnamed";
  return (screenPart ? screenPart + "/" : "") + a;
}

// ─── The DOM pass ────────────────────────────────────────────────────────────
// Called from render() once the three roots have been written. Everything here
// is guarded: the headless sweep runs against a DOM stub whose querySelectorAll
// returns nothing, and this must be a no-op there rather than a crash.

const UB_STAMP_SELECTOR =
  "[onclick],[oninput],[onchange],button,a,input,select,textarea";

function ubStampRoot(root, screenPart) {
  if (!root || typeof root.querySelectorAll !== "function") return 0;
  let list;
  try { list = root.querySelectorAll(UB_STAMP_SELECTOR); } catch (e) { return 0; }
  if (!list || !list.length) return 0;

  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (!el || typeof el.setAttribute !== "function") continue;
    let existing = null;
    try { existing = el.getAttribute("data-ub"); } catch (e) {}
    if (existing) continue;                     // hand-placed names are final

    let handler = null;
    try {
      handler = el.getAttribute("onclick") || el.getAttribute("oninput") ||
                el.getAttribute("onchange");
    } catch (e) {}

    let action = handler ? ubActionName(handler) : "";
    if (!action) {
      let type = null, hint = null;
      try {
        type = el.getAttribute("type");
        hint = el.getAttribute("name") || el.getAttribute("id") ||
               el.getAttribute("placeholder") || el.getAttribute("href");
      } catch (e) {}
      action = ubStructuralName(el.tagName, type, hint, i);
    }
    try { el.setAttribute("data-ub", ubFullName(screenPart, action)); n++; } catch (e) {}
  }
  return n;
}

/**
 * Stamp every control the tester can reach. One call, from render().
 *
 * The top bar and nav are stamped with their own prefixes rather than the
 * screen's: they are the same controls on every screen, and prefixing them per
 * screen would scatter one button's clicks across forty names.
 */
function ubStampControls() {
  if (typeof document === "undefined") return 0;
  const part = (typeof screenSlug === "function" && typeof scrollKey === "function")
    ? screenSlug(scrollKey()) : "";
  let n = 0;
  n += ubStampRoot(document.getElementById("screenRoot"), part);
  n += ubStampRoot(document.getElementById("topbarRoot"), "topbar");
  n += ubStampRoot(document.getElementById("navRoot"), "nav");
  return n;
}
