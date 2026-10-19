#!/usr/bin/env bash
# Rehearses two Flow snapshots in a disposable clone, builds the site offline,
# and runs tests/flows-snapshot-browser.cjs against it over HTTP and file:// (a
# path with spaces). Nothing is pushed, tagged or published.
#
#   bash tests/browser/snapshot-smoke.sh [WORK_DIR]
#
# Needs Playwright (tests/browser: npm ci) and the commit to test checked out.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${1:-$(mktemp -d "${TMPDIR:-/tmp}/mb-snapshot-smoke.XXXXXX")}"
CLONE="$WORK/clone"
SITE="$WORK/site with spaces"
mkdir -p "$WORK"

git clone --quiet --no-hardlinks "$REPO" "$CLONE"
cd "$CLONE"
# Publication only snapshots commits on main; in this throwaway clone, main is
# the commit under test.
git checkout --quiet -B main "$(git -C "$REPO" rev-parse HEAD)"
COMMIT="$(git rev-parse HEAD)"

# prepare prints a catalog row; add each one to this clone's catalog.
add_row() {
  python3 scripts/publish.py prepare "$@" --main-ref main --commit "$COMMIT" > "$WORK/row.json"
  python3 -c '
import json, sys
row = json.load(open(sys.argv[1]))
path = "publication/catalog.json"
catalog = json.load(open(path))
catalog["snapshots"].append(row)
open(path, "w").write(json.dumps(catalog, indent=2) + "\n")
' "$WORK/row.json"
}
add_row --flow emergency-fund --id rehearsal-emergency-fund --label "Rehearsal emergency fund" --tracking on
add_row --flow big-purchase --id rehearsal-big-purchase --label "Rehearsal big purchase" --tracking off
git add publication/catalog.json
git -c user.name="Snapshot smoke" -c user.email="smoke@example.invalid" commit --quiet -m "Rehearse Flow snapshots"
python3 scripts/publish.py build --offline --output "$SITE"

PORT="${MB_SNAPSHOT_PORT:-8766}"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SITE" >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS "http://127.0.0.1:$PORT/index.html" >/dev/null 2>&1 && break
  sleep 0.5
done

export MB_PLAYWRIGHT_MODULE="${MB_PLAYWRIGHT_MODULE:-$REPO/tests/browser/node_modules/playwright}"
MB_FLOW_SNAPSHOT_BASE_URL="http://127.0.0.1:$PORT/" MB_FLOW_SNAPSHOT_FILE_ROOT="$SITE" \
  node "$REPO/tests/flows-snapshot-browser.cjs"
