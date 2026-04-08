#!/usr/bin/env bash
# stampede skill: teardown
# Clean up Docker images and Railway deployments.
#
# Usage:
#   teardown.sh [--docker] [--railway] [--all]
#
# Options:
#   --docker     Remove the stampede Docker image
#   --railway    Remove Railway deployment (requires railway CLI)
#   --all        Remove both Docker image and Railway deployment
#
# With no flags, shows what can be cleaned up.

set -euo pipefail

REMOVE_DOCKER=false
REMOVE_RAILWAY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker)  REMOVE_DOCKER=true; shift ;;
    --railway) REMOVE_RAILWAY=true; shift ;;
    --all)     REMOVE_DOCKER=true; REMOVE_RAILWAY=true; shift ;;
    *)         echo "Unknown option: $1"; exit 1 ;;
  esac
done

# If no flags, show status.
if [[ "$REMOVE_DOCKER" == false && "$REMOVE_RAILWAY" == false ]]; then
  echo "[stampede] Teardown — what can be cleaned up:"
  echo ""

  if docker image inspect stampede &>/dev/null 2>&1; then
    echo "  Docker image 'stampede' exists — use --docker to remove"
  else
    echo "  Docker image: not found"
  fi

  if command -v railway &>/dev/null; then
    echo "  Railway CLI available — use --railway to remove deployment"
  else
    echo "  Railway CLI: not installed"
  fi

  echo ""
  echo "Usage: teardown.sh [--docker] [--railway] [--all]"
  exit 0
fi

# -- Docker cleanup -----------------------------------------------------------

if [[ "$REMOVE_DOCKER" == true ]]; then
  echo "[stampede] Removing Docker image..."
  docker rmi stampede 2>/dev/null && echo "[stampede] Docker image removed." || echo "[stampede] Docker image not found."
fi

# -- Railway cleanup ----------------------------------------------------------

if [[ "$REMOVE_RAILWAY" == true ]]; then
  if ! command -v railway &>/dev/null; then
    echo "[stampede] Railway CLI not installed. Install from https://railway.com/cli"
    exit 1
  fi

  echo "[stampede] Removing Railway deployment..."
  railway down 2>/dev/null && echo "[stampede] Railway deployment removed." || echo "[stampede] No active Railway deployment found."
fi

echo "[stampede] Teardown complete."
