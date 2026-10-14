#!/usr/bin/env bash
# Every automated check, in CI order, with one line per check:
#
#   bash scripts/check-all.sh
#
# PASS     the check ran and passed
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
trap 'rm -rf "$LOG_DIR"' EXIT

FAILED=0
BLOCKED=0
n=0

# run <name> <needs: node|python|both> <command...>
run() {
  local name="$1" needs="$2"; shift 2
  n=$((n + 1))
  local missing=""
  case "$needs" in
    node)   [ -z "$NODE" ] && missing="node" ;;
    python) [ -z "$PYTHON" ] && missing="python3" ;;
    both)   [ -z "$NODE" ] && missing="node"; [ -z "$PYTHON" ] && missing="${missing:+$missing, }python3" ;;
  esac
  if [ -n "$missing" ]; then
    printf 'BLOCKED  %s  (needs %s)\n' "$name" "$missing"
    BLOCKED=$((BLOCKED + 1))
    return
  fi
  local log="$LOG_DIR/$n.log"
  if "$@" >"$log" 2>&1; then
    printf 'PASS     %s\n' "$name"
  else
    printf 'FAIL     %s\n' "$name"
    tail -n 25 "$log" | sed 's/^/         | /'
    FAILED=$((FAILED + 1))
  fi
}

flow_script_syntax() {
  find flows -type f -name '*.js' -print0 | xargs -0 -r -n 1 "$NODE" --check
}

publication_rehearsal() {
  local out="$LOG_DIR/rehearsal"
  "$PYTHON" scripts/publish.py build --offline --output "$out"
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
run "Flow script syntax"               node   flow_script_syntax
run "Journey harness self-checks"      node   "$NODE" tests/app-journeys.cjs --selftest
run "Journeys (every flow, twice)"     node   "$NODE" tests/app-journeys.cjs
run "Python tests"                     python "$PYTHON" -m unittest discover -s tests
run "Catalog policy"                   python "$PYTHON" scripts/publish.py check
run "Publication rehearsal"            python publication_rehearsal

echo
if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED of $n checks failed."
  exit 1
fi
if [ "$BLOCKED" -gt 0 ]; then
  echo "$BLOCKED of $n checks were blocked: not verified on this machine."
  exit 2
fi
echo "All $n checks passed."
