#!/usr/bin/env bash
# stampede skill: run
# Execute a load test pattern against the active (or specified) profile.
#
# Usage:
#   run.sh <pattern> [options]
#
# Options:
#   --profile <name>     Profile to activate (default: current target)
#   --max-vus <n>        Override max VUs
#   --duration <time>    Override duration (e.g., 5m, 30s)
#   --base-url <url>     Override target URL
#   --auth <strategy>    Override auth strategy
#   --docker             Run in Docker container
#
# Examples:
#   run.sh smoke
#   run.sh spike --profile myapp --max-vus 2000
#   run.sh stress --docker --profile myapp

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMPEDE_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# -- Parse arguments ----------------------------------------------------------

PATTERN=""
PROFILE=""
MAX_VUS=""
DURATION=""
BASE_URL=""
AUTH_STRATEGY=""
USE_DOCKER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)    PROFILE="$2"; shift 2 ;;
    --max-vus)    MAX_VUS="$2"; shift 2 ;;
    --duration)   DURATION="$2"; shift 2 ;;
    --base-url)   BASE_URL="$2"; shift 2 ;;
    --auth)       AUTH_STRATEGY="$2"; shift 2 ;;
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
  ls -1 "$STAMPEDE_DIR/patterns/" | sed 's/\.js$//' | sed 's/^/  /'
  echo ""
  echo "Options:"
  echo "  --profile <name>     Profile to use"
  echo "  --max-vus <n>        Override max VUs"
  echo "  --duration <time>    Override duration"
  echo "  --base-url <url>     Override target URL"
  echo "  --auth <strategy>    Override auth strategy"
  echo "  --docker             Run in Docker"
  exit 1
fi

PATTERN_FILE="$STAMPEDE_DIR/patterns/${PATTERN}.js"
if [[ ! -f "$PATTERN_FILE" ]]; then
  echo "ERROR: Pattern not found: $PATTERN"
  echo "Available patterns:"
  ls -1 "$STAMPEDE_DIR/patterns/" | sed 's/\.js$//' | sed 's/^/  /'
  exit 1
fi

# -- Activate profile ---------------------------------------------------------

if [[ -n "$PROFILE" ]]; then
  PROFILE_FILE="$STAMPEDE_DIR/profiles/${PROFILE}.js"
  if [[ ! -f "$PROFILE_FILE" ]]; then
    echo "ERROR: Profile not found: $PROFILE"
    echo "Available profiles:"
    ls -1 "$STAMPEDE_DIR/profiles/" | grep -v '^_' | grep -v '^target' | sed 's/\.js$//' | sed 's/^/  /'
    exit 1
  fi
  ln -sf "${PROFILE}.js" "$STAMPEDE_DIR/profiles/target.js"
  echo "[stampede] Activated profile: $PROFILE"
fi

# Check that target.js exists.
if [[ ! -f "$STAMPEDE_DIR/profiles/target.js" ]]; then
  echo "ERROR: No active profile. Run setup.sh first or use --profile."
  exit 1
fi

# -- Build env var args -------------------------------------------------------

ENV_ARGS=""
[[ -n "$MAX_VUS" ]] && ENV_ARGS="$ENV_ARGS -e STAMPEDE_MAX_VUS=$MAX_VUS"
[[ -n "$DURATION" ]] && ENV_ARGS="$ENV_ARGS -e STAMPEDE_DURATION=$DURATION"
[[ -n "$BASE_URL" ]] && ENV_ARGS="$ENV_ARGS -e STAMPEDE_BASE_URL=$BASE_URL"
[[ -n "$AUTH_STRATEGY" ]] && ENV_ARGS="$ENV_ARGS -e STAMPEDE_AUTH_STRATEGY=$AUTH_STRATEGY"

# Forward common auth env vars if set.
for var in EMAIL PASSWORD LESSON_ID INST_DOMAIN HMAC_SECRET ACCESS_TOKEN API_KEY AUTH_TOKEN; do
  if [[ -n "${!var:-}" ]]; then
    ENV_ARGS="$ENV_ARGS -e $var=${!var}"
  fi
done

# -- Run ----------------------------------------------------------------------

echo ""
echo "[stampede] Running: $PATTERN"
echo "[stampede] Profile: $(readlink "$STAMPEDE_DIR/profiles/target.js" 2>/dev/null || echo 'target.js')"
[[ -n "$MAX_VUS" ]] && echo "[stampede] Max VUs: $MAX_VUS"
[[ -n "$DURATION" ]] && echo "[stampede] Duration: $DURATION"
echo ""

if [[ "$USE_DOCKER" == true ]]; then
  DOCKER_ENV=""
  [[ -n "$PROFILE" ]] && DOCKER_ENV="$DOCKER_ENV -e STAMPEDE_PROFILE=$PROFILE"
  [[ -n "$MAX_VUS" ]] && DOCKER_ENV="$DOCKER_ENV -e STAMPEDE_MAX_VUS=$MAX_VUS"
  [[ -n "$DURATION" ]] && DOCKER_ENV="$DOCKER_ENV -e STAMPEDE_DURATION=$DURATION"
  [[ -n "$BASE_URL" ]] && DOCKER_ENV="$DOCKER_ENV -e STAMPEDE_BASE_URL=$BASE_URL"
  [[ -n "$AUTH_STRATEGY" ]] && DOCKER_ENV="$DOCKER_ENV -e STAMPEDE_AUTH_STRATEGY=$AUTH_STRATEGY"

  # shellcheck disable=SC2086
  docker run --rm $DOCKER_ENV \
    -e STAMPEDE_PATTERN="$PATTERN" \
    -v "$STAMPEDE_DIR/profiles:/stampede/profiles" \
    stampede
else
  # shellcheck disable=SC2086
  k6 run $ENV_ARGS "$PATTERN_FILE"
fi
