#!/usr/bin/env bash
# stampede skill: run
# Execute a load test pattern against a profile via the Stampede CLI.
#
# Usage:
#   run.sh <pattern> [options]
#
# Options:
#   --profile <name>     Profile to use (default: current target)
#   --max-vus <n>        Override max VUs
#   --duration <time>    Override duration (e.g., 5m, 30s)
#   --base-url <url>     Override target URL
#   --auth <strategy>    Override auth strategy
#   --step <n>           Override step size (breakpoint)
#   --hold <time>        Override hold duration per step
#   --docker             Run in Docker container
#
# Examples:
#   run.sh smoke --profile myapp
#   run.sh spike --profile myapp --max-vus 2000
#   run.sh stress --docker --profile myapp

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMPEDE_DIR="$(cd "$SCRIPT_DIR/__STAMPEDE_ROOT__" && pwd)"

# -- Parse arguments ----------------------------------------------------------

PATTERN=""
PROFILE=""
MAX_VUS=""
DURATION=""
BASE_URL=""
AUTH_STRATEGY=""
STEP=""
HOLD=""
USE_DOCKER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)    PROFILE="$2"; shift 2 ;;
    --max-vus)    MAX_VUS="$2"; shift 2 ;;
    --duration)   DURATION="$2"; shift 2 ;;
    --base-url)   BASE_URL="$2"; shift 2 ;;
    --auth)       AUTH_STRATEGY="$2"; shift 2 ;;
    --step)       STEP="$2"; shift 2 ;;
    --hold)       HOLD="$2"; shift 2 ;;
    --docker)     USE_DOCKER=true; shift ;;
    -*)           echo "Unknown option: $1"; exit 1 ;;
    *)
      if [[ -z "$PATTERN" ]]; then
        PATTERN="$1"
      else
        echo "Unexpected argument: $1"; exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$PATTERN" ]]; then
  echo "Usage: run.sh <pattern> [options]"
  echo ""
  echo "Available patterns:"
  "$STAMPEDE_DIR/run.sh" list patterns 2>/dev/null | grep "^  " || \
    ls -1 "$STAMPEDE_DIR/patterns/" | sed 's/\.js$//' | sed 's/^/  /'
  echo ""
  echo "Options:"
  echo "  --profile <name>     Profile to use"
  echo "  --max-vus <n>        Override max VUs"
  echo "  --duration <time>    Override duration"
  echo "  --base-url <url>     Override target URL"
  echo "  --auth <strategy>    Override auth strategy"
  echo "  --step <n>           Step size (breakpoint)"
  echo "  --hold <time>        Hold duration per step"
  echo "  --docker             Run in Docker"
  exit 1
fi

# -- Build CLI args for run.sh ------------------------------------------------

RUN_ARGS="run --pattern $PATTERN"
[[ -n "$PROFILE" ]]       && RUN_ARGS="$RUN_ARGS --profile $PROFILE"
[[ -n "$MAX_VUS" ]]       && RUN_ARGS="$RUN_ARGS --max-vus $MAX_VUS"
[[ -n "$DURATION" ]]      && RUN_ARGS="$RUN_ARGS --duration $DURATION"
[[ -n "$BASE_URL" ]]      && RUN_ARGS="$RUN_ARGS --base-url $BASE_URL"
[[ -n "$AUTH_STRATEGY" ]] && RUN_ARGS="$RUN_ARGS --auth-strategy $AUTH_STRATEGY"
[[ -n "$STEP" ]]          && RUN_ARGS="$RUN_ARGS --step $STEP"
[[ -n "$HOLD" ]]          && RUN_ARGS="$RUN_ARGS --hold $HOLD"

# -- Run ----------------------------------------------------------------------

if [[ "$USE_DOCKER" == true ]]; then
  # Build Docker env args for secrets only.
  DOCKER_ENV=""
  for var in EMAIL PASSWORD HMAC_SECRET ACCESS_TOKEN LESSON_ID INST_DOMAIN API_KEY AUTH_TOKEN; do
    if [[ -n "${!var:-}" ]]; then
      DOCKER_ENV="$DOCKER_ENV -e $var=${!var}"
    fi
  done

  echo "[stampede] Running in Docker: $PATTERN"

  # shellcheck disable=SC2086
  docker run --rm $DOCKER_ENV \
    -v "$STAMPEDE_DIR/profiles:/stampede/profiles" \
    stampede $RUN_ARGS
else
  echo "[stampede] Running: $PATTERN"

  # shellcheck disable=SC2086
  "$STAMPEDE_DIR/run.sh" $RUN_ARGS
fi
