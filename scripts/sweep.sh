#!/usr/bin/env bash
# Correctness sweep — run from the repo root: bash scripts/sweep.sh
# Concatenate the DOM stub, ordered app scripts and sweep.js for node or jsc.
# One bundle preserves shared top-level const bindings like browser scripts.
# Exit non-zero on a failed check or a run that stops before its last line.

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
# Explicit template — `mktemp -t <prefix>` is BSD-only, and BSD wants the X's
# last, so the bundle is the temp file's name plus .js. The trap removes both.
TMP="$(mktemp "${TMPDIR:-/tmp}/mb-sweep.XXXXXX")" || exit 1
OUT="$TMP.js"
trap 'rm -f "$TMP" "$OUT" "$OUT.log"' EXIT

# Read the router so adding or retiring a screen updates the inventory.
# A routed screen missing from destinations[] still needs its Tools wiring check.
ROUTED=$(grep -ohE 'state\.screen === "[^"]+"' "$APP/js/render.js" \
         | sed 's/.*"\(.*\)"/\1/' | sort -u | sed 's/^/"/;s/$/"/' | paste -sd, -)

# ── DOM stub ────────────────────────────────────────────────────────────────
cat > "$OUT" <<STUB
var ROUTED_SCREENS = [$ROUTED];
STUB
cat >> "$OUT" <<'STUB'
// Shim jsc's print() in node. Write directly to stdout because the stub
// silences console to keep app logging out of the sweep report.
if (typeof print === "undefined") {
  var print = function () {
    var line = Array.prototype.join.call(arguments, " ") + "\n";
    if (typeof process !== "undefined" && process.stdout) process.stdout.write(line);
  };
}
function El(i){this.id=i;this.style={};this.dataset={};this.innerHTML="";this.textContent="";this.value="";
 this.scrollTop=0;this.src="";this.onended=null;
 this.attributes={};this.setAttribute=function(k,v){this.attributes[k]=String(v);};
 this.removeAttribute=function(k){delete this.attributes[k];};
 this.getAttribute=function(k){return this.attributes[k] == null ? null : this.attributes[k];};
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
// Queue timers so debounced work can be exercised and flushed explicitly.
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

# Assert the film tool's output root against the one editable app.
FILM_DEFAULT="$(sed -n 's/^const APP = path.join(REPO, "\(.*\)");/\1/p' tools/film/build-films.mjs)"
printf '\nvar __FILM_TOOL_VERSION = "%s";\nvar __DEFAULT_VERSION = "app";\n' "$FILM_DEFAULT" >> "$OUT"

# Compare the viewBox, CSS aspect ratio and film canvas so the stage cannot
# expose coloured bars around a differently shaped picture.
HF_W="$(sed -n 's/^const HF_VIEW_W = \([0-9]*\);/\1/p' "$APP/components/hyperframes.js")"
HF_H="$(sed -n 's/^const HF_VIEW_H = \([0-9]*\);/\1/p' "$APP/components/hyperframes.js")"
printf '\nvar __HF_VIEW = { w: %s, h: %s };\n' "${HF_W:-0}" "${HF_H:-0}" >> "$OUT"

# js/render.js as a string. §7h needs the journal-mode class lists, and those
# are toggle() arguments rather than a named constant -- there is nothing to
# read at runtime because the DOM stub's classList does not record.
printf '\nvar __RENDER_JS = ' >> "$OUT"
python3 -c "import json,sys;print(json.dumps(open(sys.argv[1],encoding='utf-8').read())+';')" "$APP/js/render.js" >> "$OUT"

# The paywall's source. §7g checks the discount figures are COMPUTED
# from the prices: a "was" price typed into the file would be an invented
# discount the day the monthly price moves.
printf '\nvar __PAYWALL_JS = ' >> "$OUT"
python3 -c "import json,sys,os;p=sys.argv[1];print(json.dumps(open(p,encoding='utf-8').read() if os.path.exists(p) else '')+';')" "$APP/screens/budget-paywall.js" >> "$OUT"

# ── the stylesheets, as strings ─────────────────────────────────────────────
# The theme and layout checks need to read variables.css and components.css,
# and jsc has no file access from the concatenated bundle. Inject each as a
# JSON-escaped literal instead.
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
#
# Comments are stripped first: a function named only in a comment is still
# dead. Strings, template literals and regex literals are kept whole, because
# onclick handlers live in templates and `https://` is not a comment.
#
# One step deep: dead functions that call each other or themselves, or a name
# that appears only in a string, still count as referenced, and only top-level
# `function` declarations are checked.
printf '\nvar __UNREFERENCED = ' >> "$OUT"
python3 - "$APP" <<'PY' >> "$OUT"
import re, sys, glob, json, os
app = sys.argv[1]

# Keywords after which a `/` starts a regex literal, not a division.
REGEX_AFTER = {'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
               'void', 'throw', 'case', 'do', 'else', 'yield', 'await'}
WORD = re.compile(r'[\w$]+')

def strip_comments(s):
    out, i, n = [], 0, len(s)
    stack = [0]   # per code level: open-brace count; None while in template text
    last = ''     # the previous token, to tell a regex literal from a division
    while i < n:
        c = s[i]
        if stack[-1] is None:                       # template literal text
            if c == '\\':
                out.append(s[i:i + 2]); i += 2
            elif c == '`':
                stack.pop(); out.append(c); i += 1; last = ')'
            elif s.startswith('${', i):
                stack.append(0); out.append('${'); i += 2; last = '('
            else:
                out.append(c); i += 1
            continue
        if s.startswith('//', i):
            j = s.find('\n', i)
            i = n if j < 0 else j
            continue
        if s.startswith('/*', i):
            j = s.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append('\n' * s.count('\n', i, j) or ' ')
            i = j
            continue
        if c in '"\'':
            j = i + 1
            while j < n and s[j] != c and s[j] != '\n':
                j += 2 if s[j] == '\\' else 1
            out.append(s[i:j + 1]); i = j + 1; last = ')'
            continue
        if c == '`':
            stack.append(None); out.append(c); i += 1
            continue
        if c == '/' and (last in REGEX_AFTER or not re.match(r'[\w$)\]}]', last[-1:] or '(')):
            j, in_class = i + 1, False
            while j < n and s[j] != '\n':
                if s[j] == '\\':
                    j += 2; continue
                if s[j] == '[':
                    in_class = True
                elif s[j] == ']':
                    in_class = False
                elif s[j] == '/' and not in_class:
                    break
                j += 1
            out.append(s[i:j + 1]); i = j + 1; last = ')'
            continue
        m = WORD.match(s, i)
        if m:
            out.append(m.group()); i = m.end(); last = m.group()
            continue
        if c == '{':
            stack[-1] += 1
        elif c == '}':
            if stack[-1] == 0 and len(stack) > 1:   # closes a template's ${
                stack.pop(); out.append(c); i += 1
                continue
            stack[-1] -= 1
        if not c.isspace():
            last = c
        out.append(c); i += 1
    return ''.join(out)

files = sorted(glob.glob(app+'/js/*.js') + glob.glob(app+'/screens/*.js') + glob.glob(app+'/components/*.js'))
src = {p: strip_comments(open(p, encoding='utf-8').read()) for p in files}
html = re.sub(r'<!--[\s\S]*?-->', '', open(app+'/index.html', encoding='utf-8').read())
corpus = "\n".join(src.values()) + "\n" + html
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
# Report distinct files, and use scope to distinguish a repeated declaration
# in one file from shadowing across scripts.
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
# manifest is missing, which §7c reports as a failure.
printf '\nvar __FILM_MANIFEST = ' >> "$OUT"
MANIFEST="$APP/assets/video/onboarding/manifest.json"
if [ -f "$MANIFEST" ]; then cat "$MANIFEST" >> "$OUT"; else printf 'null' >> "$OUT"; fi
printf ';\n' >> "$OUT"

printf '\n// ══ sweep ══\n' >> "$OUT"
cat scripts/sweep.js >> "$OUT"

echo "Money Buddy sweep ($n app files)"
"$ENGINE" "$OUT" | tee "$OUT.log"
rc=${PIPESTATUS[0]}
[ "$rc" -eq 0 ] || exit "$rc"
# A top-level `return` in an app file ends the bundle early and still exits 0.
grep -qx 'SWEEP COMPLETE' "$OUT.log" || {
  echo "error: the sweep stopped before its last line; most checks never ran" >&2
  exit 1
}
