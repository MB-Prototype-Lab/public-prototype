#!/usr/bin/env bash
# JS syntax checker for classic browser scripts.
# Use node or macOS jsc so the check works on machines with either engine.
# nvm installations may be outside a non-interactive shell's PATH.
# jsc checkSyntax() takes a file path, not source text.
#
#   bash scripts/check-syntax.sh                 # all JS under app + gate
#   bash scripts/check-syntax.sh path/to/file.js # specific files
#   bash scripts/check-syntax.sh app             # directory
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
  # Historical blobs are validated by publication digests.
  while IFS= read -r f; do files+=("$f"); done < <(find app gate -name '*.js' 2>/dev/null | sort)
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

# node: compile each file as a classic browser <script>, all in one process.
# `node --check` parses a .js file as a CommonJS or ES module, so it accepts a
# top-level `return` or `export` that stops the file loading in a page.
if [ "$ENGINE" = "node" ]; then
  exec "$NODE" -e '
    const fs = require("fs"), vm = require("vm");
    const files = process.argv.slice(1);
    let fail = 0;
    for (const f of files) {
      try {
        new vm.Script(fs.readFileSync(f, "utf8"), { filename: f });
      } catch (e) {
        fail++;
        const at = e instanceof SyntaxError ? e.stack.split("\n")[0] + "  " : "";
        console.log("FAIL " + f);
        console.log("     " + at + e.name + ": " + e.message);
      }
    }
    console.log("─────────────────────────────────");
    console.log((files.length - fail) + " passed, " + fail + " failed  (" + files.length + " files)");
    process.exitCode = fail ? 1 : 0;
  ' -- "${files[@]}"
fi

pass=0; fail=0
for f in "${files[@]}"; do
  # Absolute path — jsc resolves relative to its own cwd, not necessarily ours.
  abs="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  if err=$("$JSC" -e "checkSyntax('$abs')" 2>&1); then
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
