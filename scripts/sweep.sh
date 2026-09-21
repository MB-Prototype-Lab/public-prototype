#!/usr/bin/env bash
if [ "${MB_VERSION+x}" = x ]; then echo "error: MB_VERSION is retired; tooling uses app/" >&2; exit 2; fi
# Phase 6 correctness sweep — run from the repo root.
#
#   bash scripts/sweep.sh
#
# Concatenates the DOM stub, every <script> in app/index.html in load
# order, and scripts/sweep.js into one file, then runs it under node or jsc —
# whichever this machine has (see check-syntax.sh; the Mac has jsc and no node,
# the Linux/WSL box the reverse). One script rather than separate evaluations,
# because separately-evaluated scripts do not share top-level `const` bindings
# but a browser's <script> tags do.
#
# Exits non-zero if any check fails.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
ENGINE="$(command -v node 2>/dev/null || true)"
# nvm installs sit outside a non-interactive shell's PATH — take the newest.
if [ -z "$ENGINE" ]; then
  for cand in "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$cand" ] && ENGINE="$cand"
  done
fi
[ -n "$ENGINE" ] || ENGINE="$JSC"
[ -x "$ENGINE" ] || { echo "error: no JS engine found — need node or macOS jsc" >&2; exit 2; }

APP="app"
# Explicit template — `mktemp -t <prefix>` is BSD-only; GNU mktemp needs the
# XXXXXX and otherwise fails, leaving OUT as a bare ".js" written to the repo.
OUT="$(mktemp "${TMPDIR:-/tmp}/mb-sweep.XXXXXX").js"
trap 'rm -f "$OUT"' EXIT

# ── The screen inventory, read from the version being swept ─────────────────
# SCREENS used to be a hardcoded list in sweep.js. With two versions whose
# screens differ that list is wrong for at least one of them — v3.1 retired
# lifestyleWizardReview and added two, so the sweep asked v3.1 to render a
# screen it does not have and reported nine failures that were not bugs.
#
# Every id render.js knows about, instead. That is the router, so it cannot go
# stale: add a screen and the sweep finds it; retire one and it stops looking.
# The "not in destinations[]" check keeps its teeth, because a screen routed but
# never added to the jump list still shows up here.
ROUTED=$(grep -ohE 'state\.screen === "[^"]+"' "$APP/js/render.js" \
         | sed 's/.*"\(.*\)"/\1/' | sort -u | sed 's/^/"/;s/$/"/' | paste -sd, -)

# ── DOM stub ────────────────────────────────────────────────────────────────
cat > "$OUT" <<STUB
var ROUTED_SCREENS = [$ROUTED];
STUB
cat >> "$OUT" <<'STUB'
// print() is a jsc builtin and does not exist in node. sweep.js calls it ~21
// times, so shim it here rather than rewriting every call site.
//
// It must write to stdout DIRECTLY: the stub below deliberately silences
// `console` so app-code logging stays out of the sweep output, and a shim built
// on console.log would inherit that silence — the whole report would vanish
// while still exiting 0, which looks exactly like a clean run.
if (typeof print === "undefined") {
  var print = function () {
    var line = Array.prototype.join.call(arguments, " ") + "\n";
    if (typeof process !== "undefined" && process.stdout) process.stdout.write(line);
  };
}
function El(i){this.id=i;this.style={};this.dataset={};this.innerHTML="";this.textContent="";this.value="";
 this.scrollTop=0;this.src="";this.onended=null;
 this.play=function(){return {catch:function(){}};};this.pause=function(){};
 this.classList={toggle:function(){},add:function(){},remove:function(){},contains:function(){return false;}};
 this.focus=function(){};this.setSelectionRange=function(){};this.addEventListener=function(){};
 this.appendChild=function(){};this.querySelector=function(){return new El("q");};
 this.querySelectorAll=function(){return [];};
 this.getBoundingClientRect=function(){return{top:0,left:0,width:0,height:0};};}
var __e={};
var document={getElementById:function(i){if(!__e[i])__e[i]=new El(i);return __e[i];},
 querySelector:function(s){if(!__e[s])__e[s]=new El(s);return __e[s];},
 querySelectorAll:function(){return [];},createElement:function(){return new El("n");},
 addEventListener:function(){},body:new El("b"),documentElement:new El("h")};
var window={addEventListener:function(){},__navLog:[],__lastError:null,
 matchMedia:function(){return{matches:false,addEventListener:function(){}};},
 scrollTo:function(){},getComputedStyle:function(){return {};}};
var history={pushState:function(){},replaceState:function(){},back:function(){}};
var performance={getEntriesByType:function(){return[{type:"navigate"}];},navigation:{type:0},now:function(){return 0;}};
var navigator={clipboard:{writeText:function(){return{then:function(f){f();return{catch:function(){}};}};}},userAgent:"jsc"};
var sessionStorage={getItem:function(){return null;},setItem:function(){}};
var localStorage=sessionStorage;
var location={href:"",replace:function(){}};
var alert=function(){},prompt=function(){},confirm=function(){return true;};
// setTimeout QUEUES rather than discarding, so debounced work can be flushed.
// It used to be `function(){return 0;}` — which made debouncedRender() a silent
// no-op and left every slider handler untested: misspell the call and the sweep
// still passed 54/54 while a browser threw on the first pointer move.
var __timers=[],__timerId=0;
var setTimeout=function(fn,ms){__timers.push({id:++__timerId,fn:fn,ms:ms||0});return __timerId;};
var clearTimeout=function(id){__timers=__timers.filter(function(t){return t.id!==id;});};
function flushTimers(){var q=__timers;__timers=[];q.forEach(function(t){if(typeof t.fn==="function")t.fn();});return q.length;}
var setInterval=function(){return 0;},clearInterval=function(){};
var requestAnimationFrame=function(){return 0;},cancelAnimationFrame=function(){};
var Audio=function(){return new El("audio");};
var console={warn:function(){},log:function(){},error:function(){}};
STUB

# ── the app, in index.html's load order ─────────────────────────────────────
n=0
while read -r src; do
  [ -f "$APP/$src" ] || { echo "error: index.html references missing $src" >&2; exit 1; }
  printf '\n// ══ %s ══\n' "$src" >> "$OUT"
  cat "$APP/$src" >> "$OUT"
  n=$((n + 1))
done < <(grep -o 'src="[^"]*\.js"' "$APP/index.html" | sed 's/src="//;s/"//')

# ── the stylesheet, as a string ─────────────────────────────────────────────
# The theme checks need to read variables.css, and jsc has no file access from
# the concatenated bundle. Inject it as a JSON-escaped literal instead.
# gate/gate.js as a string. The gate is OUTSIDE every version (it must never
# load a version's scripts — two versions' globals in one document would
# collide), so it keeps its own copy of which builds carry a usability tracker.
# Injecting the source lets §7d assert that copy against the real flag instead
# of trusting anyone to update both.
# Assert the film tool's output root against the one editable app.
FILM_DEFAULT="$(sed -n 's/^const APP = path.join(REPO, "\(.*\)");/\1/p' tools/film/build-films.mjs)"
printf '\nvar __FILM_TOOL_VERSION = "%s";\nvar __DEFAULT_VERSION = "app";\n' "$FILM_DEFAULT" >> "$OUT"

# js/render.js as a string. §7f needs the journal-mode class lists, and those
# are toggle() arguments rather than a named constant -- there is nothing to
# read at runtime because the DOM stub's classList does not record.
printf '\nvar __RENDER_JS = ' >> "$OUT"
python3 -c "import json,sys;print(json.dumps(open(sys.argv[1],encoding='utf-8').read())+';')" "$APP/js/render.js" >> "$OUT"

printf '\nvar __GATE_JS = ' >> "$OUT"
python3 -c "import json,sys;print(json.dumps(open('gate/gate.js',encoding='utf-8').read())+';')" >> "$OUT"

printf '\nvar __COMPONENTS_CSS = ' >> "$OUT"
python3 -c "import json,sys;print(json.dumps(open(sys.argv[1],encoding='utf-8').read())+';')" "$APP/css/components.css" >> "$OUT"

printf '\nvar __VARS_CSS = ' >> "$OUT"
python3 -c 'import json,sys; sys.stdout.write(json.dumps(open("'"$APP"'/css/variables.css").read()))' >> "$OUT"
printf ';\n' >> "$OUT"

# ── unreferenced functions ──────────────────────────────────────────────────
# Computed here rather than in sweep.js: it needs each file's text separately
# plus index.html, and injecting all of that would double the bundle.
#
# A bare-identifier match, NOT `name(`. Functions in this app are reached four
# ways — ordinary calls, onclick inside screen template literals, onclick in
# index.html, and bare identifiers in dispatch tables. Only the first looks like
# a call. Matching on `name(` misreads the other three as unused.
printf '\nvar __UNREFERENCED = ' >> "$OUT"
python3 - "$APP" <<'PY' >> "$OUT"
import re, sys, glob, json, os
app = sys.argv[1]
files = sorted(glob.glob(app+'/js/*.js') + glob.glob(app+'/screens/*.js') + glob.glob(app+'/components/*.js'))
src = {p: open(p, encoding='utf-8').read() for p in files}
corpus = "\n".join(src.values()) + "\n" + open(app+'/index.html', encoding='utf-8').read()
out = []
for p, s in src.items():
    for m in re.finditer(r'^function\s+([A-Za-z_]\w*)', s, re.M):
        f = m.group(1)
        if len(re.findall(r'\b'+re.escape(f)+r'\b', corpus)) - 1 <= 0:
            out.append({"name": f, "file": os.path.relpath(p, app)})
json.dump(sorted(out, key=lambda d: d["name"]), sys.stdout)
PY
printf ';\n' >> "$OUT"

# ── duplicate top-level declarations ────────────────────────────────────────
# Everything is global here: files are plain <script> tags sharing one
# namespace, so two files declaring the same function name is not an error —
# the later <script> silently wins and the earlier one becomes unreachable.
#
# §7b's REFERENCE COUNT cannot catch this — a shadowed function is still
# referenced, so its count looks healthy; it just never runs. Hence a separate
# query, reported under the same §7b heading.
printf '\nvar __DUPLICATE_DECLS = ' >> "$OUT"
python3 - "$APP" <<'PY' >> "$OUT"
import re, sys, glob, json, os, collections
app = sys.argv[1]
order = re.findall(r'src="([^"]*\.js)"', open(app+'/index.html', encoding='utf-8').read())
seen = collections.defaultdict(list)
for rel in order:
    p = os.path.join(app, rel)
    if not os.path.exists(p): continue
    s = open(p, encoding='utf-8').read()
    for m in re.finditer(r'^(?:function\s+([A-Za-z_]\w*)|(?:const|let|var)\s+([A-Za-z_]\w*)\s*=)', s, re.M):
        seen[m.group(1) or m.group(2)].append(rel)
# Report DISTINCT files. Appending per-occurrence made a name declared twice in
# one file print as "x.js , x.js — last one wins", which reads as a cross-file
# shadow and is a false positive on a check whose whole worth is being trusted.
# Both are still worth flagging, so `scope` says which it is.
out = []
for k, v in sorted(seen.items()):
    if len(v) < 2: continue
    files = sorted(set(v))
    out.append({"name": k, "files": files,
                "scope": "one file" if len(files) == 1 else "across files"})
json.dump(out, sys.stdout)
PY
printf ';\n' >> "$OUT"

# ── the rendered films' manifest ────────────────────────────────────────────
# tools/film writes it next to the .mp4s. It carries every film's per-segment
# durations, which the sweep compares against the app's own onbVideoSegMs — the
# app narrates LIVE over a silent film, so those two numbers are computed twice
# and nothing but this check notices when they stop agreeing. `null` when the
# films have not been rendered (v3 never has any).
printf '\nvar __FILM_MANIFEST = ' >> "$OUT"
MANIFEST="$APP/assets/video/onboarding/manifest.json"
if [ -f "$MANIFEST" ]; then cat "$MANIFEST" >> "$OUT"; else printf 'null' >> "$OUT"; fi
printf ';\n' >> "$OUT"

printf '\n// ══ sweep ══\n' >> "$OUT"
cat scripts/sweep.js >> "$OUT"

echo "Money Buddy v3 — Phase 6 sweep  ($n app files)"
"$ENGINE" "$OUT"
