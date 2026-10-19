#!/usr/bin/env bash
# Runs inside the shared image, in the runner's isolated repository.
set -euo pipefail
: "${MB_REPORT_DIR:?runner must provide report directory}"
case "${1:-}" in
  ci-app)
    bash scripts/check-syntax.sh
    bash scripts/sweep.sh
    python3 scripts/check-paths.py
    python3 scripts/check-markdown-links.py
    for test in release-runtime local-variants flows-selector gate-tabs flows-runtime; do
      node "tests/$test.cjs"
    done
    python3 scripts/flows.py check
    bash scripts/check-syntax.sh flows
    node tests/app-journeys.cjs --selftest
    node tests/app-journeys.cjs
    if [[ -n "${HEAD_SHA:-}" ]]; then
      node tests/app-journeys.cjs --justify --base "$BASE" --out "$MB_REPORT_DIR/journeys"
      node tests/app-journeys.cjs --series "$BASE..$HEAD_SHA" --report --out "$MB_REPORT_DIR/journeys"
    elif [[ -n "${BEFORE:-}" && "$BEFORE" != 0000000000000000000000000000000000000000 ]]; then
      node tests/app-journeys.cjs --against "$BEFORE" --report --out "$MB_REPORT_DIR/journeys"
    fi
    ;;
  ci-publication)
    python3 -m unittest discover -s tests -v
    python3 scripts/publish.py check --base "$BASE"
    python3 scripts/publish.py build --offline --output "$MB_REPORT_DIR/rehearsal"
    ;;
  ci-browser)
    result=0
    if [[ -n "${HEAD_SHA:-}" ]]; then
      if git worktree add --detach /work/ci-base "$BASE"; then
        node tests/browser/app-journeys-browser.cjs --base /work/ci-base --head . --out "$MB_REPORT_DIR/browser" --allow-declared || result=1
      else
        result=1
      fi
    elif [[ -n "${BEFORE:-}" && "$BEFORE" != 0000000000000000000000000000000000000000 ]]; then
      if git worktree add --detach /work/ci-base "$BEFORE"; then
        node tests/browser/app-journeys-browser.cjs --base /work/ci-base --head . --out "$MB_REPORT_DIR/browser" --report || result=1
      else
        result=1
      fi
    fi
    python3 -m http.server 8765 --bind 127.0.0.1 --directory . >"$MB_REPORT_DIR/http.log" 2>&1 &
    server=$!
    trap 'kill "$server" 2>/dev/null || true' EXIT
    ready=0
    for ((attempt=0; attempt<50; attempt++)); do
      if curl -fsS http://127.0.0.1:8765/index.html >/dev/null 2>&1; then ready=1; break; fi
      sleep 0.2
    done
    if [[ "$ready" == 1 ]]; then
      MB_FLOW_BASE_URL=http://127.0.0.1:8765/ node tests/flows-browser.cjs || result=1
    else
      echo 'FAIL: Flow HTTP server did not start' >&2
      result=1
    fi
    bash tests/browser/snapshot-smoke.sh "$RUNNER_TEMP/snapshot-smoke" || result=1
    exit "$result"
    ;;
  ci-deploy)
    bash scripts/check-syntax.sh
    bash scripts/sweep.sh
    python3 scripts/check-paths.py
    node tests/release-runtime.cjs
    node tests/local-variants.cjs
    python3 -m unittest discover -s tests -v
    python3 scripts/deploy-prepare.py --fetched-origin-main "${MB_FETCHED_MAIN:?authenticated host fetch required}"
    mv publication-output "$MB_REPORT_DIR/publication-output"
    ;;
  *) echo "Unknown CI check group: ${1:-}" >&2; exit 2 ;;
esac
