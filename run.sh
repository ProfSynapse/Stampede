#!/usr/bin/env bash
# stampede/run.sh — Entrypoint for Stampede load tests.
# Reads env vars for profile and pattern selection, then runs k6.
#
# Required env vars:
#   STAMPEDE_PROFILE  — Profile name (matches a file in profiles/, e.g., "myapp")
#   STAMPEDE_PATTERN  — Pattern name (matches a file in patterns/, e.g., "smoke")
#
# Optional env vars:
#   STAMPEDE_MAX_VUS  — Override max VUs for the pattern
#   STAMPEDE_DURATION — Override duration for the pattern
#   STAMPEDE_BASE_URL — Override the profile's base URL
#   K6_EXTRA_ARGS     — Additional k6 arguments (e.g., "--out cloud")
#
# Auth-related env vars (profile-dependent):
#   EMAIL, PASSWORD               — For form_login auth
#   LESSON_ID, INST_DOMAIN        — For HMAC auth
#   HMAC_SECRET or ACCESS_TOKEN   — For HMAC auth
#   STAMPEDE_AUTH_STRATEGY         — Override auth strategy (form_login, hmac, api_key, bearer, none)
#
# Usage:
#   STAMPEDE_PROFILE=myapp STAMPEDE_PATTERN=smoke ./run.sh
#   STAMPEDE_PROFILE=myapp STAMPEDE_PATTERN=spike STAMPEDE_MAX_VUS=2000 ./run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# -- Validate required env vars -----------------------------------------------

PROFILE="${STAMPEDE_PROFILE:-}"
PATTERN="${STAMPEDE_PATTERN:-}"

if [[ -z "$PROFILE" ]]; then
  echo "ERROR: STAMPEDE_PROFILE is required."
  echo "  Available profiles:"
  ls -1 "$SCRIPT_DIR/profiles/" | sed 's/\.js$//' | sed 's/^/    /'
  exit 1
fi

if [[ -z "$PATTERN" ]]; then
  echo "ERROR: STAMPEDE_PATTERN is required."
  echo "  Available patterns:"
  ls -1 "$SCRIPT_DIR/patterns/" | sed 's/\.js$//' | sed 's/^/    /'
  exit 1
fi

PROFILE_FILE="$SCRIPT_DIR/profiles/${PROFILE}.js"
PATTERN_FILE="$SCRIPT_DIR/patterns/${PATTERN}.js"

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "ERROR: Profile not found: $PROFILE_FILE"
  echo "  Available profiles:"
  ls -1 "$SCRIPT_DIR/profiles/" | sed 's/\.js$//' | sed 's/^/    /'
  exit 1
fi

if [[ ! -f "$PATTERN_FILE" ]]; then
  echo "ERROR: Pattern not found: $PATTERN_FILE"
  echo "  Available patterns:"
  ls -1 "$SCRIPT_DIR/patterns/" | sed 's/\.js$//' | sed 's/^/    /'
  exit 1
fi

# -- Activate profile as target.js --------------------------------------------
# Patterns import from profiles/target.js. Symlink the selected profile.

TARGET_FILE="$SCRIPT_DIR/profiles/target.js"
ln -sf "${PROFILE}.js" "$TARGET_FILE"

# -- Build k6 env var args ----------------------------------------------------

K6_ENV_ARGS=""

# Forward all STAMPEDE_ env vars and known auth env vars to k6.
for var in STAMPEDE_PROFILE STAMPEDE_PATTERN STAMPEDE_MAX_VUS STAMPEDE_DURATION \
           STAMPEDE_BASE_URL STAMPEDE_AUTH_STRATEGY STAMPEDE_EMAIL STAMPEDE_PASSWORD \
           STAMPEDE_STEP STAMPEDE_HOLD \
           BASE_URL EMAIL PASSWORD \
           LESSON_ID INST_DOMAIN HMAC_SECRET ACCESS_TOKEN API_KEY AUTH_TOKEN; do
  if [[ -n "${!var:-}" ]]; then
    K6_ENV_ARGS="$K6_ENV_ARGS -e $var=${!var}"
  fi
done

# -- Run k6 -------------------------------------------------------------------

echo "========================================="
echo "  STAMPEDE Load Test"
echo "========================================="
echo "  Profile: $PROFILE"
echo "  Pattern: $PATTERN"
echo "  Max VUs: ${STAMPEDE_MAX_VUS:-<pattern default>}"
echo "  Duration: ${STAMPEDE_DURATION:-<pattern default>}"
echo "  Base URL: ${STAMPEDE_BASE_URL:-${BASE_URL:-<profile default>}}"
echo "========================================="
echo ""

# shellcheck disable=SC2086
exec k6 run $K6_ENV_ARGS ${K6_EXTRA_ARGS:-} "$PATTERN_FILE"
