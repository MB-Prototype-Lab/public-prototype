#!/usr/bin/env bash
# JS syntax checker — the automated gate for this repo.
#
# WHY THIS EXISTS: this repo gets worked on from more than one machine, and the
# two do not agree on which JS engine exists. The Mac has no node but ships
# JavaScriptCore (`jsc`, which exposes checkSyntax()); the Linux/WSL box has node
# (often only under ~/.nvm, off PATH for non-interactive shells) and no jsc.
# Hardcoding either one makes the repo's only automated gate fail outright on the
# other machine, which is exactly what happened. So: use whichever is present.
# Both were verified with a positive and a negative control — each correctly
# rejects `function broken( {` and correctly accepts valid source.
#
# NOTE: jsc's checkSyntax() takes a FILE PATH, not source text. Passing source
# makes it fail with "Could not open file", which looks like a syntax error and
# isn't.
#
#   bash scripts/check-syntax.sh                 # all JS under versions/v3 + gate
#   bash scripts/check-syntax.sh path/to/file.js # specific files
#   bash scripts/check-syntax.sh versions/v3     # everything under a directory
#
# Exits non-zero if anything fails to parse.

set -uo pipefail

JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
NODE="$(command -v node 2>/dev/null || true)"
# nvm installs land outside a non-interactive shell's PATH — take the newest.
if [ -z "$NODE" ]; then
  for cand in "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$cand" ] && NODE="$cand"
  done
fi

if [ -n "$NODE" ]; then
  ENGINE="node"
elif [ -x "$JSC" ]; then
  ENGINE="jsc"
else
  echo "error: no JS engine found — need either node or macOS jsc" >&2
  echo "       looked for: node on PATH, $HOME/.nvm/versions/node/*/bin/node," >&2
  echo "                   $JSC" >&2
  exit 2
fi

# Collect targets: explicit args, or the default set.
files=()
if [ "$#" -eq 0 ]; then
  # Every live version, not just one. v3 and v3.1 are an A/B pair and v4 is the
  # copy new work goes into; all three ship, and checking only one lets a syntax
  # error reach the gate in the others.
  while IFS= read -r f; do files+=("$f"); done < <(find versions/v3 versions/v3.1 versions/v4 gate -name '*.js' 2>/dev/null | sort)
else
  for arg in "$@"; do
    if [ -d "$arg" ]; then
      while IFS= read -r f; do files+=("$f"); done < <(find "$arg" -name '*.js' | sort)
    else
      files+=("$arg")
    fi
  done
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "no .js files matched"; exit 0
fi

pass=0; fail=0
for f in "${files[@]}"; do
  # Absolute path — jsc resolves relative to its own cwd, not necessarily ours.
  abs="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  if [ "$ENGINE" = "node" ]; then
    err_cmd() { "$NODE" --check "$abs" 2>&1; }
  else
    err_cmd() { "$JSC" -e "checkSyntax('$abs')" 2>&1; }
  fi
  if err=$(err_cmd); then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAIL $f"
    echo "     $(echo "$err" | head -1)"
  fi
done

echo "─────────────────────────────────"
echo "$pass passed, $fail failed  (${#files[@]} files)"
[ "$fail" -eq 0 ]
