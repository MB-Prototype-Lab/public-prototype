#!/usr/bin/env bash
# Generates versions/v3/data/*.js from the sibling *.json files.
#
# WHY THIS EXISTS (L13, architecture.md §1): the app is opened as a file:// page
# with no dev server, and browsers block fetch()/XHR against local files. So the
# spec's JSON cannot be loaded over the network — it ships wrapped in a plain
# `const NAME = {...};` assignment and loads via a <script> tag like every other
# file in the app.
#
# The .json files stay byte-identical to v3 Files/spec/data/ so drift from the
# spec is always one `diff -rq` away. The .js files are GENERATED — never
# hand-edit them; edit nothing, or edit the .json and re-run this.
#
#   bash scripts/wrap-data.sh
#
# Run it after changing any data file. Nothing about opening index.html depends
# on it having been run recently — it is not a build step in the npm sense.

set -euo pipefail

# Same MB_VERSION switch as sweep.sh -- v3 and v3.1 each have their own data/,
# and wrapping the wrong one leaves the edited JSON with a stale .js beside it.
DIR="versions/${MB_VERSION:-v3.1}/data"
[ -d "$DIR" ] || { echo "error: $DIR not found (run from repo root)" >&2; exit 1; }

# json basename -> global const name. Keep in sync with architecture.md §1.
global_for() {
  case "$1" in
    persona)           echo "PERSONA" ;;
    seed-state)        echo "SEED_STATE" ;;
    journal-questions) echo "JOURNAL_QUESTIONS" ;;
    estimator-questions) echo "ESTIMATOR_QUESTIONS" ;;
    help-me-out)       echo "HELP_ME_OUT" ;;
    emergency-fund)    echo "EMERGENCY_FUND" ;;
    test-profiles)     echo "TEST_PROFILES" ;;
    card-apr)          echo "CARD_APR" ;;
    onboarding-script) echo "ONBOARDING_SCRIPT" ;;
    peer-benchmarks)   echo "PEER_BENCHMARKS" ;;
    zip-cost-of-living) echo "ZIP_COST_OF_LIVING" ;;
    daily-scripts)     echo "DAILY_SCRIPTS" ;;
    buddy-responses)   echo "BUDDY_RESPONSES" ;;
    buddy-esf)         echo "BUDDY_ESF" ;;
    lessons)           echo "LESSONS_V3" ;;   # not LESSONS — v2's state.lessons still exists
    *)                 echo "" ;;
  esac
}

count=0
for json in "$DIR"/*.json; do
  base="$(basename "$json" .json)"
  name="$(global_for "$base")"
  if [ -z "$name" ]; then
    echo "error: no global mapped for $base — add it to global_for()" >&2
    exit 1
  fi
  out="$DIR/$base.js"
  {
    echo "// GENERATED from $base.json — do not hand-edit."
    echo "// Regenerate: bash scripts/wrap-data.sh"
    echo "//"
    echo "// The app runs on file://, where fetch() is blocked and there is no dev"
    echo "// server, so spec data ships as a script-loadable assignment (L13)."
    echo "// The .json beside this file is the byte-identical spec copy."
    echo "const $name ="
    cat "$json"
    echo ";"
  } > "$out"
  echo "  $base.json -> $base.js  ($name)"
  count=$((count + 1))
done

echo "─────────────────────────────────"
echo "$count wrappers generated"
