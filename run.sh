#!/usr/bin/env bash
# stampede/run.sh — CLI entrypoint for Stampede load tests.
#
# Usage:
#   ./run.sh run --profile <name> --pattern <name> [options]
#   ./run.sh list profiles|patterns
#   ./run.sh help
#
# CLI args override STAMPEDE_* env vars. Env vars are fallbacks for
# non-secret tunables and the primary source for secrets (credentials, keys).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

show_help() {
  cat << 'EOF'
Stampede — Config-driven k6 load testing

Usage:
  ./run.sh run --profile <name> --pattern <name> [options]
  ./run.sh list profiles|patterns
  ./run.sh help

Subcommands:
  run     Execute a load test
  list    Show available profiles or patterns
  help    Show this help message

Run options:
  --profile <name>       Profile to activate (required)
  --pattern <name>       Pattern to run (required)
  --max-vus <n>          Override peak VU count
  --duration <time>      Override duration (e.g., 5m, 30s)
  --base-url <url>       Override profile's base URL
  --auth-strategy <s>    Override auth strategy
  --step <n>             Override step size (breakpoint pattern)
  --hold <time>          Override hold duration per step

Env vars (secrets only — never pass these as CLI args):
  EMAIL, PASSWORD        Form login credentials
  HMAC_SECRET            HMAC secret key
  ACCESS_TOKEN           Pre-computed access token
  LESSON_ID, INST_DOMAIN HMAC message parameters
  API_KEY                API key for api_key strategy
  AUTH_TOKEN             Bearer token

Env var fallbacks (CLI args take precedence):
  STAMPEDE_PROFILE       Fallback for --profile
  STAMPEDE_PATTERN       Fallback for --pattern
  STAMPEDE_MAX_VUS       Fallback for --max-vus
  STAMPEDE_DURATION      Fallback for --duration
  STAMPEDE_BASE_URL      Fallback for --base-url
  STAMPEDE_AUTH_STRATEGY  Fallback for --auth-strategy

Examples:
  ./run.sh run --profile myapp --pattern smoke
  ./run.sh run --profile myapp --pattern spike --max-vus 2000
  ./run.sh run --profile myapp --pattern stress --duration 5m
  ./run.sh list profiles
  ./run.sh list patterns
EOF
}

show_run_help() {
  cat << 'EOF'
Usage: ./run.sh run --profile <name> --pattern <name> [options]

Required:
  --profile <name>       Profile to activate
  --pattern <name>       Pattern to run

Options:
  --max-vus <n>          Override peak VU count
  --duration <time>      Override duration (e.g., 5m, 30s)
  --base-url <url>       Override profile's base URL
  --auth-strategy <s>    Override auth strategy
  --step <n>             Override step size (breakpoint pattern)
  --hold <time>          Override hold duration per step

Secrets (env vars only):
  EMAIL, PASSWORD, HMAC_SECRET, ACCESS_TOKEN, LESSON_ID,
  INST_DOMAIN, API_KEY, AUTH_TOKEN
EOF
}

# ---------------------------------------------------------------------------
# List subcommand
# ---------------------------------------------------------------------------

cmd_list() {
  local what="${1:-}"

  case "$what" in
    profiles)
      echo "Available profiles:"
      for f in "$SCRIPT_DIR/profiles/"*.js; do
        local name
        name=$(basename "$f" .js)
        case "$name" in
          _base|target) continue ;;
          *) echo "  $name" ;;
        esac
      done
      ;;
    patterns)
      echo "Available patterns:"
      for f in "$SCRIPT_DIR/patterns/"*.js; do
        echo "  $(basename "$f" .js)"
      done
      ;;
    "")
      echo "Usage: ./run.sh list profiles|patterns"
      exit 1
      ;;
    *)
      echo "ERROR: Unknown list target: $what"
      echo "Usage: ./run.sh list profiles|patterns"
      exit 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Run subcommand
# ---------------------------------------------------------------------------

cmd_run() {
  # Defaults from env vars (CLI args override these below).
  local profile="${STAMPEDE_PROFILE:-}"
  local pattern="${STAMPEDE_PATTERN:-}"
  local max_vus="${STAMPEDE_MAX_VUS:-}"
  local duration="${STAMPEDE_DURATION:-}"
  local base_url="${STAMPEDE_BASE_URL:-}"
  local auth_strategy="${STAMPEDE_AUTH_STRATEGY:-}"
  local step="${STAMPEDE_STEP:-}"
  local hold="${STAMPEDE_HOLD:-}"

  # Parse CLI args (override env vars).
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --profile)       profile="$2"; shift 2 ;;
      --pattern)       pattern="$2"; shift 2 ;;
      --max-vus)       max_vus="$2"; shift 2 ;;
      --duration)      duration="$2"; shift 2 ;;
      --base-url)      base_url="$2"; shift 2 ;;
      --auth-strategy) auth_strategy="$2"; shift 2 ;;
      --step)          step="$2"; shift 2 ;;
      --hold)          hold="$2"; shift 2 ;;
      --help|-h)       show_run_help; exit 0 ;;
      *)               echo "ERROR: Unknown option: $1"; show_run_help; exit 1 ;;
    esac
  done

  # Validate required args.
  if [[ -z "$profile" ]]; then
    echo "ERROR: --profile is required."
    cmd_list profiles
    exit 1
  fi

  if [[ -z "$pattern" ]]; then
    echo "ERROR: --pattern is required."
    cmd_list patterns
    exit 1
  fi

  local profile_file="$SCRIPT_DIR/profiles/${profile}.js"
  local pattern_file="$SCRIPT_DIR/patterns/${pattern}.js"

  if [[ ! -f "$profile_file" ]]; then
    echo "ERROR: Profile not found: $profile"
    cmd_list profiles
    exit 1
  fi

  if [[ ! -f "$pattern_file" ]]; then
    echo "ERROR: Pattern not found: $pattern"
    cmd_list patterns
    exit 1
  fi

  # Activate profile as target.js (symlink).
  ln -sf "${profile}.js" "$SCRIPT_DIR/profiles/target.js"

  # Build k6 -e flags for tunables.
  local k6_env=""
  [[ -n "$max_vus" ]]       && k6_env="$k6_env -e STAMPEDE_MAX_VUS=$max_vus"
  [[ -n "$duration" ]]      && k6_env="$k6_env -e STAMPEDE_DURATION=$duration"
  [[ -n "$base_url" ]]      && k6_env="$k6_env -e STAMPEDE_BASE_URL=$base_url"
  [[ -n "$auth_strategy" ]] && k6_env="$k6_env -e STAMPEDE_AUTH_STRATEGY=$auth_strategy"
  [[ -n "$step" ]]          && k6_env="$k6_env -e STAMPEDE_STEP=$step"
  [[ -n "$hold" ]]          && k6_env="$k6_env -e STAMPEDE_HOLD=$hold"

  # Forward secret env vars to k6 (never passed as CLI args).
  for var in EMAIL PASSWORD HMAC_SECRET ACCESS_TOKEN LESSON_ID INST_DOMAIN API_KEY AUTH_TOKEN; do
    if [[ -n "${!var:-}" ]]; then
      k6_env="$k6_env -e $var=${!var}"
    fi
  done

  # Print banner.
  echo "========================================="
  echo "  STAMPEDE Load Test"
  echo "========================================="
  echo "  Profile:  $profile"
  echo "  Pattern:  $pattern"
  [[ -n "$max_vus" ]]       && echo "  Max VUs:  $max_vus"
  [[ -n "$duration" ]]      && echo "  Duration: $duration"
  [[ -n "$base_url" ]]      && echo "  Base URL: $base_url"
  [[ -n "$auth_strategy" ]] && echo "  Auth:     $auth_strategy"
  [[ -n "$step" ]]          && echo "  Step:     $step"
  [[ -n "$hold" ]]          && echo "  Hold:     $hold"
  echo "========================================="
  echo ""

  # shellcheck disable=SC2086
  exec k6 run $k6_env ${K6_EXTRA_ARGS:-} "$pattern_file"
}

# ---------------------------------------------------------------------------
# Main dispatch
# ---------------------------------------------------------------------------

SUBCOMMAND="${1:-help}"
shift 2>/dev/null || true

case "$SUBCOMMAND" in
  run)   cmd_run "$@" ;;
  list)  cmd_list "$@" ;;
  help)  show_help ;;
  -h|--help) show_help ;;
  *)
    echo "ERROR: Unknown subcommand: $SUBCOMMAND"
    echo ""
    show_help
    exit 1
    ;;
esac
