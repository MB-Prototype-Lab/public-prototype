#!/usr/bin/env bash
# Every automated check, in CI order, with one line per check:
#
#   bash scripts/check-all.sh
#
# PASS     the check ran and passed; any warnings it printed are listed under it
# FAIL     the check ran and failed (the end of its output is printed)
# BLOCKED  this machine lacks what the check needs; it did NOT pass
#
# Exits 1 if anything failed, 2 if nothing failed but something was blocked,
# 0 only when every check ran and passed.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

NODE="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE" ]; then
  for cand in "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$cand" ] && NODE="$cand"
  done
fi
PYTHON="$(command -v python3 2>/dev/null || true)"
# The node-based scripts below find node the same way; put it on PATH for them.
[ -n "$NODE" ] && export PATH="$(dirname "$NODE"):$PATH"

LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mb-check-all.XXXXXX")"
SERVER_PID=""
trap '[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null; rm -rf "$LOG_DIR"' EXIT

# One Playwright module for the probe below and every browser check.
export MB_PLAYWRIGHT_MODULE="${MB_PLAYWRIGHT_MODULE:-$PWD/tests/browser/node_modules/playwright}"
BROWSER_FIX="cd tests/browser && npm ci && npx playwright install --with-deps chromium"
BROWSER_MISSING="unchecked"

# Says what the browser checks lack, or nothing when Chromium launches.
browser_missing() {
  if ! "$NODE" -e 'require(process.argv[1])' "$MB_PLAYWRIGHT_MODULE" >/dev/null 2>&1; then
    echo "the Playwright module, not found at $MB_PLAYWRIGHT_MODULE; fix: $BROWSER_FIX"
    return
  fi
  local err
  err="$("$NODE" -e '
    const env = process.env;
    require(process.argv[1]).chromium.launch({ headless: true, args: JSON.parse(env.MB_CHROMIUM_ARGS || "[]"),
      ...(env.MB_CHROMIUM_EXECUTABLE ? { executablePath: env.MB_CHROMIUM_EXECUTABLE } : {}) })
      .then(b => b.close(), e => { console.log(String(e && e.message || e)); process.exit(1); });
  ' "$MB_PLAYWRIGHT_MODULE" 2>&1)" && return
  case "$err" in
    *"Executable doesn't exist"*) echo "Chromium, which is not installed; fix: $BROWSER_FIX" ;;
    *"shared libraries"*|*"missing dependencies"*)
      local lib
      lib="$(printf '%s' "$err" | grep -o 'lib[^ :/]*\.so[^ :]*' | head -n 1)"
      echo "Chromium's system libraries${lib:+ ($lib is missing)}; fix: $BROWSER_FIX" ;;
    *) echo "a Chromium that launches ($(printf '%s' "$err" | head -n 1)); fix: $BROWSER_FIX" ;;
  esac
}

FAILED=0
BLOCKED=0
WARNED=0
n=0

# A log's warnings with their indented detail lines: the sweep's "  warn  "
# lines and the journey harness's "WARNING  " lines.
warn_lines() {
  awk '/^(  warn  |WARNING  )/ { on = 1; print; next }
       on && /^          / { print; next }
       { on = 0 }' "$1"
}

# run <name> <needs: node|python|both|browser> <command...>
run() {
  local name="$1" needs="$2"; shift 2
  n=$((n + 1))
  local missing=""
  case "$needs" in
    node)   [ -z "$NODE" ] && missing="node" ;;
    python) [ -z "$PYTHON" ] && missing="python3" ;;
    both|browser)
      [ -z "$NODE" ] && missing="node"; [ -z "$PYTHON" ] && missing="${missing:+$missing, }python3" ;;
  esac
  if [ "$needs" = browser ] && [ -z "$missing" ]; then
    [ "$BROWSER_MISSING" = unchecked ] && BROWSER_MISSING="$(browser_missing)"
    missing="$BROWSER_MISSING"
  fi
  if [ -n "$missing" ]; then
    printf 'BLOCKED  %s  (needs %s)\n' "$name" "$missing"
    BLOCKED=$((BLOCKED + 1))
    return
  fi
  local log="$LOG_DIR/$n.log"
  if "$@" >"$log" 2>&1; then
    local count
    count="$(grep -cE '^(  warn  |WARNING  )' "$log")"
    if [ "$count" -gt 0 ]; then
      printf 'PASS     %s  (%s warning%s)\n' "$name" "$count" "$([ "$count" -eq 1 ] || echo s)"
      WARNED=$((WARNED + 1))
      warn_lines "$log" | sed 's/^/         | /'
    else
      printf 'PASS     %s\n' "$name"
    fi
  else
    printf 'FAIL     %s\n' "$name"
    tail -n 25 "$log" | sed 's/^/         | /'
    FAILED=$((FAILED + 1))
  fi
}

publication_rehearsal() {
  local out="$LOG_DIR/rehearsal"
  "$PYTHON" scripts/publish.py build --offline --output "$out"
}

free_port() {
  "$PYTHON" -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}

# Both Flows on file:// and over HTTP, from a local server on the repository root.
flow_browser_tests() {
  local port rc
  port="$(free_port)" || return 1
  "$PYTHON" -m http.server "$port" --bind 127.0.0.1 --directory . >/dev/null 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 50); do
    "$PYTHON" -c 'import sys, urllib.request; urllib.request.urlopen(sys.argv[1], timeout=1)' \
      "http://127.0.0.1:$port/index.html" >/dev/null 2>&1 && break
    sleep 0.2
  done
  MB_FLOW_BASE_URL="http://127.0.0.1:$port/" "$NODE" tests/flows-browser.cjs
  rc=$?
  kill "$SERVER_PID" 2>/dev/null
  wait "$SERVER_PID" 2>/dev/null
  SERVER_PID=""
  return "$rc"
}

# Works on a clone, so it checks the last commit, not uncommitted edits.
snapshot_rehearsal() {
  MB_SNAPSHOT_PORT="$(free_port)" bash tests/browser/snapshot-smoke.sh "$LOG_DIR/snapshot-smoke"
}

run "JS syntax (app, gate)"            node   bash scripts/check-syntax.sh
run "Sweep"                            both   bash scripts/sweep.sh
run "Local paths"                      python "$PYTHON" scripts/check-paths.py
run "Release runtime"                  node   "$NODE" tests/release-runtime.cjs
run "Local variants selector"          node   "$NODE" tests/local-variants.cjs
run "Flows selector"                   node   "$NODE" tests/flows-selector.cjs
run "Selector tabs"                    node   "$NODE" tests/gate-tabs.cjs
run "Flows runtime"                    node   "$NODE" tests/flows-runtime.cjs
run "Flows check"                      python "$PYTHON" scripts/flows.py check
run "Flow script syntax"               node   bash scripts/check-syntax.sh flows
run "Journey harness self-checks"      node   "$NODE" tests/app-journeys.cjs --selftest
run "Journeys (every flow, twice)"     node   "$NODE" tests/app-journeys.cjs
run "Python tests"                     python "$PYTHON" -m unittest discover -s tests
CATALOG_BASE="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)"
if [ -n "$CATALOG_BASE" ]; then
  run "Catalog policy" python "$PYTHON" scripts/publish.py check --base "$CATALOG_BASE"
else
  n=$((n + 1))
  BLOCKED=$((BLOCKED + 1))
  printf 'BLOCKED  Catalog policy  (needs a merge base with origin/main or main)\n'
fi
run "Publication rehearsal"            python publication_rehearsal
run "Browser journeys (one tree)"      browser "$NODE" tests/browser/app-journeys-browser.cjs
run "Flow browser tests (file + HTTP)" browser flow_browser_tests
run "Flow snapshot rehearsal (last commit)" browser snapshot_rehearsal

echo
if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED of $n checks failed."
  exit 1
fi
if [ "$BLOCKED" -gt 0 ]; then
  echo "$BLOCKED of $n checks were blocked: not verified on this machine."
  exit 2
fi
if [ "$WARNED" -gt 0 ]; then
  echo "All $n checks passed ($WARNED with warnings — read them above)."
else
  echo "All $n checks passed."
fi
