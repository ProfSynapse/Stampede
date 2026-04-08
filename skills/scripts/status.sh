#!/usr/bin/env bash
# stampede skill: status
# Show available profiles, patterns, and current configuration.
#
# Usage:
#   status.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMPEDE_DIR="$(cd "$SCRIPT_DIR/__STAMPEDE_ROOT__" && pwd)"

echo "========================================="
echo "  STAMPEDE Status"
echo "========================================="
echo ""

# -- Active profile -----------------------------------------------------------

echo "Active profile:"
if [[ -L "$STAMPEDE_DIR/profiles/target.js" ]]; then
  TARGET=$(readlink "$STAMPEDE_DIR/profiles/target.js")
  echo "  $TARGET"
elif [[ -f "$STAMPEDE_DIR/profiles/target.js" ]]; then
  echo "  target.js (not a symlink — direct file)"
else
  echo "  None — run setup.sh to create a profile"
fi
echo ""

# -- Available profiles -------------------------------------------------------

echo "Available profiles:"
for f in "$STAMPEDE_DIR/profiles/"*.js; do
  name=$(basename "$f" .js)
  case "$name" in
    _base|example|target) continue ;;
    *) echo "  $name" ;;
  esac
done 2>/dev/null || echo "  None"
echo ""

# -- Available patterns -------------------------------------------------------

echo "Available patterns:"
for f in "$STAMPEDE_DIR/patterns/"*.js; do
  name=$(basename "$f" .js)
  echo "  $name"
done
echo ""

# -- Docker image -------------------------------------------------------------

echo "Docker image:"
if docker image inspect stampede &>/dev/null 2>&1; then
  SIZE=$(docker image inspect stampede --format '{{.Size}}' 2>/dev/null | awk '{printf "%.1f MB", $1/1024/1024}')
  echo "  stampede — $SIZE"
else
  echo "  Not built — run: setup.sh --docker"
fi
echo ""

# -- k6 installation ----------------------------------------------------------

echo "k6:"
if command -v k6 &>/dev/null; then
  echo "  $(k6 version 2>/dev/null || echo 'installed')"
else
  echo "  Not installed — install from https://k6.io/docs/get-started/installation/"
fi
echo ""
echo "========================================="
