#!/usr/bin/env bash
# Host bootstrap: only Bash built-ins, Git and Docker are required.
# Parse the entire launcher before execution so edits during a long check cannot
# change the commands still waiting to run.
main() {
set -uo pipefail

fail() { printf 'BLOCKED  %s\n' "$*" >&2; exit 2; }
command -v git >/dev/null || fail 'Git is unavailable.'
command -v docker >/dev/null || fail 'Docker is unavailable in this environment.'
ROOT=$(git rev-parse --show-toplevel) || fail 'Run from a MoneyBuddy checkout.'
cd "$ROOT" || exit 2
# Git Bash rewrites Docker's Linux arguments unless explicitly disabled.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
HOST_ROOT=$ROOT
RUN_UID=${UID:-0}
case "$ROOT" in
  /[a-zA-Z]/*) if [[ ${OSTYPE:-} == msys* ]]; then HOST_ROOT="${ROOT:1:1}:${ROOT:2}"; RUN_UID=0; fi ;;
esac
IMAGE=moneybuddy-checks:local
MODE=${1:-all}
if (( $# )); then shift; fi
case "$MODE" in build|doctor|all|compare|exec|review|helper|ci-app|ci-publication|ci-browser|ci-deploy) ;; *) fail "Unknown command: $MODE" ;; esac
if [[ $MODE != build ]]; then
  BUILD_TAG="moneybuddy-checks:run-$$-$RANDOM"
  IMAGE=$BUILD_TAG
  trap 'docker image rm "$BUILD_TAG" >/dev/null 2>&1 || true' EXIT
fi
docker info --format '{{.OSType}}' > /dev/null 2>&1 || fail 'Docker is not running or this client cannot reach it. Start Docker with Linux containers.'
DOCKER_OS=$(docker info --format '{{.OSType}}') || exit 2
[[ $DOCKER_OS == linux ]] || fail 'Switch Docker to Linux containers.'
# BuildKit caches unchanged layers; always checking build inputs avoids stale tags.
docker build --platform linux/amd64 --tag "$IMAGE" --file container/Dockerfile container || exit 2
[[ $MODE == build ]] && exit 0
IMAGE=$(docker image inspect --format '{{.Id}}' "$IMAGE") || exit 2

if [[ $MODE == doctor ]]; then
  docker run --rm --init --platform linux/amd64 --network none --shm-size 1g \
    --mount "type=bind,source=$HOST_ROOT,target=/input/source,readonly" --env MB_CHECK_MOUNT_PROBE=1 "$IMAGE" doctor
  exit $?
fi

if [[ $MODE == review || $MODE == helper ]]; then
  [[ -d .git ]] || fail 'Lifecycle/helper commands currently require the primary checkout with its own .git directory; linked checkouts remain supported for isolated tests.'
  [[ ! -e .git/moneybuddy-managed.json && ! -L .git/moneybuddy-managed.json ]] || fail 'Run lifecycle/helpers from the primary task checkout; managed checkouts are for editing and isolated checks.'
  NAME=${ROOT##*/}
  HOST_REVIEWS="${HOST_ROOT}-reviews"
  # A separate bounded mount contains independent managed review repositories.
  docker run --rm --platform linux/amd64 --network none --user "$RUN_UID" --mount "type=bind,source=${HOST_ROOT%/*},target=/parent" --entrypoint python3 "$IMAGE" -c 'import pathlib,sys; p=pathlib.Path("/parent")/(sys.argv[1]+"-reviews");
if p.is_symlink(): raise SystemExit("Refusing symlink review directory")
p.mkdir(exist_ok=True)' "$NAME" || exit 2
  if [[ $MODE == review ]]; then
    SCRIPT=pre-pr-review
  else
    SCRIPT=${1:-}
    case "$SCRIPT" in flows|local-variants|publish) shift ;; *) fail 'helper expects flows, local-variants, or publish.' ;; esac
  fi
  # Carry effective author/checkout policy without mounting host credentials.
  GIT_ENV=()
  CONFIG_COUNT=0
  for CONFIG_KEY in user.name user.email core.autocrlf core.eol commit.gpgsign tag.gpgsign user.signingkey gpg.format; do
    CONFIG_VALUE=$(git config --get "$CONFIG_KEY")
    CONFIG_STATUS=$?
    [[ $CONFIG_STATUS == 0 || $CONFIG_STATUS == 1 ]] || fail "Cannot read Git setting $CONFIG_KEY."
    if [[ $CONFIG_KEY == core.eol && ( $CONFIG_STATUS == 1 || $CONFIG_VALUE == native ) ]]; then
      CONFIG_VALUE=lf
      [[ ${OSTYPE:-} == msys* ]] && CONFIG_VALUE=crlf
      CONFIG_STATUS=0
    fi
    if [[ $CONFIG_STATUS == 0 ]]; then
      GIT_ENV+=(--env "GIT_CONFIG_KEY_$CONFIG_COUNT=$CONFIG_KEY" --env "GIT_CONFIG_VALUE_$CONFIG_COUNT=$CONFIG_VALUE")
      CONFIG_COUNT=$((CONFIG_COUNT + 1))
    fi
  done
  GIT_ENV+=(--env "GIT_CONFIG_COUNT=$CONFIG_COUNT")
  for AUTHOR_ENV in GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_AUTHOR_DATE GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_COMMITTER_DATE; do
    GIT_ENV+=(--env "$AUTHOR_ENV")
  done
  docker run --rm --init --platform linux/amd64 --network none --shm-size 1g \
    --user "$RUN_UID" --env HOME=/tmp --env PYTHONDONTWRITEBYTECODE=1 "${GIT_ENV[@]}" \
    --mount "type=bind,source=$HOST_ROOT,target=/workspace/$NAME" \
    --mount "type=bind,source=$HOST_REVIEWS,target=/workspace/$NAME-reviews" \
    --workdir "/workspace/$NAME" --env "MB_HOST_ROOT=$HOST_ROOT" \
    --env MB_CONTAINER_PARENT=/workspace --env "MB_WSL_DISTRO=${WSL_DISTRO_NAME:-}" \
    --entrypoint python3 "$IMAGE" "scripts/$SCRIPT.py" "$@"
  exit $?
fi

INPUT_MODE=working-copy
ARGS=()
LITERAL_ARGS=0
for ARG in "$@"; do
  if [[ $ARG == -- && $LITERAL_ARGS == 0 ]]; then
    LITERAL_ARGS=1
    ARGS+=("$ARG")
  elif [[ $ARG == --committed && $LITERAL_ARGS == 0 ]]; then
    INPUT_MODE=committed
  else
    ARGS+=("$ARG")
  fi
done
case "$MODE" in ci-*) INPUT_MODE=committed ;; esac
RUN_ID=${MB_CHECK_RUN_ID:-"run-$$-$RANDOM"}
[[ $RUN_ID =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]] || fail 'MB_CHECK_RUN_ID must contain only letters, numbers, underscores and hyphens.'
OUTPUT_BASE=$ROOT
HOST_OUTPUT=$HOST_ROOT
OUTPUT_PREFIX=.container-checks/
if [[ -n ${MB_CHECK_OUTPUT_ROOT:-} ]]; then
  [[ $MB_CHECK_OUTPUT_ROOT == /* || $MB_CHECK_OUTPUT_ROOT == [a-zA-Z]:/* ]] || fail 'MB_CHECK_OUTPUT_ROOT must be absolute.'
  [[ -d $MB_CHECK_OUTPUT_ROOT && ! -L $MB_CHECK_OUTPUT_ROOT ]] || fail 'MB_CHECK_OUTPUT_ROOT must be an existing directory, not a symlink.'
  OUTPUT_BASE=$(cd "$MB_CHECK_OUTPUT_ROOT" && pwd -P) || exit 2
  HOST_OUTPUT=$OUTPUT_BASE
  if [[ ${OSTYPE:-} == msys* && $HOST_OUTPUT == /[a-zA-Z]/* ]]; then HOST_OUTPUT="${HOST_OUTPUT:1:1}:${HOST_OUTPUT:2}"; fi
  OUTPUT_PREFIX=
fi
RUN_REL="${OUTPUT_PREFIX}inputs/$RUN_ID"
REPORT_REL="${OUTPUT_PREFIX}reports/$RUN_ID"
RUN_LOCAL="$OUTPUT_BASE/$RUN_REL"
REPORT_LOCAL="$OUTPUT_BASE/$REPORT_REL"
[[ ! -e $RUN_LOCAL && ! -e $REPORT_LOCAL ]] || fail 'Run ID already exists; choose a new ID to preserve evidence.'
# Directory creation and permissions happen using Python inside the image.
docker run --rm --platform linux/amd64 --network none --mount "type=bind,source=$HOST_OUTPUT,target=/host" --entrypoint python3 "$IMAGE" -c 'import os,pathlib,sys; root=pathlib.Path("/host"); uid=int(sys.argv[3]); paths=[]
for name in sys.argv[1:3]:
 path=pathlib.Path(name)
 for rel in (*reversed(path.parents),path):
  if str(rel)!="." and rel not in paths: paths.append(rel)
for name in paths:
 p=root/name
 if p.is_symlink(): raise SystemExit("Refusing symlink output directory")
 p.mkdir(exist_ok=True)
 os.chown(p,uid,-1)
' "$RUN_REL" "$REPORT_REL" "$RUN_UID" || exit 2
HEAD_SHA_INPUT=$(git rev-parse HEAD) || exit 2
CAPTURE_STATE=$(git status --porcelain=v1 --untracked-files=all) || exit 2
printf '%s\n' "$HEAD_SHA_INPUT" > "$RUN_LOCAL/head.txt"
printf '%s\n' "$INPUT_MODE" > "$RUN_LOCAL/mode.txt"
git bundle create "$RUN_LOCAL/repo.bundle" --all HEAD || exit 2
git config --get remote.origin.url > "$RUN_LOCAL/origin.txt" || true
git ls-files -z --cached --others --exclude-standard > "$RUN_LOCAL/files.z" || exit 2
git ls-files -z --deleted > "$RUN_LOCAL/deleted.z" || exit 2
git ls-files --stage -z > "$RUN_LOCAL/index.z" || exit 2
NETWORK=none
[[ $MODE == ci-deploy ]] && NETWORK=bridge
IMAGE_ID=$IMAGE
docker run --rm --init --platform linux/amd64 --network "$NETWORK" --shm-size 1g \
  --user "$RUN_UID" --env HOME=/tmp --mount type=volume,target=/work \
  --mount "type=bind,source=$HOST_ROOT,target=/input/source,readonly" \
  --mount "type=bind,source=$HOST_OUTPUT/$RUN_REL,target=/input/git,readonly" \
  --mount "type=bind,source=$HOST_OUTPUT/$REPORT_REL,target=/reports" \
  --env BASE --env HEAD_SHA --env PR_BODY --env BEFORE --env PUBLICATION_REF --env MB_FETCHED_MAIN --env "MB_CHECK_IMAGE_ID=$IMAGE_ID" \
  "$IMAGE" "$MODE" "${ARGS[@]}"
RESULT=$?
FINAL_HEAD=$(git rev-parse HEAD) || exit 2
FINAL_STATE=$(git status --porcelain=v1 --untracked-files=all) || exit 2
if [[ $FINAL_HEAD != "$HEAD_SHA_INPUT" || $FINAL_STATE != "$CAPTURE_STATE" ]]; then
  printf 'BLOCKED: checkout changed during verification; repeat checks.\n' > "$REPORT_LOCAL/host-capture-status.txt"
  printf 'BLOCKED  Checkout changed during verification; repeat checks.\n' >&2
  RESULT=2
fi
printf 'Reports: %s/%s\n' "$HOST_OUTPUT" "$REPORT_REL"
exit "$RESULT"

}
main "$@"
