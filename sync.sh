#!/usr/bin/env bash
# sync.sh — Distribute canonical agent config from skills/ to provider directories.
#
# The skills/ directory is the single source of truth. This script copies and
# transforms content into provider-specific locations (.claude/, .codex/, etc.).
#
# Usage:
#   ./sync.sh           Sync all providers
#   ./sync.sh --check   Dry-run: show what would change (exit 1 if out of sync)
#
# To add a new provider:
#   1. Add a sync_<provider> function below
#   2. Call it from the main block at the bottom

set -euo pipefail

STAMPEDE_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$STAMPEDE_DIR/skills"
CHECK_MODE=false

if [[ "${1:-}" == "--check" ]]; then
  CHECK_MODE=true
fi

CHANGES=0

# -- Helpers ------------------------------------------------------------------

# Copy a file, replacing __STAMPEDE_ROOT__ with the correct relative path.
# Args: <source> <dest> <stampede_root_relative_path>
copy_with_root() {
  local src="$1" dest="$2" root_path="$3"
  local content
  content=$(sed "s|__STAMPEDE_ROOT__|${root_path}|g" "$src")

  if [[ -f "$dest" ]]; then
    local existing
    existing=$(cat "$dest")
    if [[ "$content" == "$existing" ]]; then
      return 0
    fi
  fi

  CHANGES=$((CHANGES + 1))

  if [[ "$CHECK_MODE" == true ]]; then
    echo "  [out of sync] $dest"
  else
    mkdir -p "$(dirname "$dest")"
    echo "$content" > "$dest"
    echo "  [synced] $dest"
  fi
}

# Copy a file without transformation.
# Args: <source> <dest>
copy_plain() {
  local src="$1" dest="$2"

  if [[ -f "$dest" ]] && cmp -s "$src" "$dest"; then
    return 0
  fi

  CHANGES=$((CHANGES + 1))

  if [[ "$CHECK_MODE" == true ]]; then
    echo "  [out of sync] $dest"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "  [synced] $dest"
  fi
}

# -- Claude Code (.claude/) --------------------------------------------------
# Structure: .claude/CLAUDE.md, .claude/skills/stampede/{skill.md,scripts/,templates/}

sync_claude() {
  echo "Claude Code (.claude/):"
  local claude_dir="$STAMPEDE_DIR/.claude"
  local skill_dir="$claude_dir/skills/stampede"

  # Agent instructions -> .claude/CLAUDE.md
  copy_plain "$SKILLS_DIR/agent-instructions.md" "$claude_dir/CLAUDE.md"

  # Skill definition -> .claude/skills/stampede/skill.md
  copy_plain "$SKILLS_DIR/skill.md" "$skill_dir/skill.md"

  # Scripts (with __STAMPEDE_ROOT__ replaced for .claude/skills/stampede/scripts/ -> ../../../..)
  for script in "$SKILLS_DIR/scripts/"*.sh; do
    local name
    name=$(basename "$script")
    copy_with_root "$script" "$skill_dir/scripts/$name" "../../../.."
    chmod +x "$skill_dir/scripts/$name" 2>/dev/null || true
  done

  # Templates
  for tmpl in "$SKILLS_DIR/templates/"*; do
    local name
    name=$(basename "$tmpl")
    copy_plain "$tmpl" "$skill_dir/templates/$name"
  done
}

# -- Codex (.codex/) ----------------------------------------------------------
# Structure: .codex/instructions.md (condensed version of agent instructions)

sync_codex() {
  echo "Codex (.codex/):"
  local codex_dir="$STAMPEDE_DIR/.codex"
  local dest="$codex_dir/instructions.md"
  local tmpfile
  tmpfile=$(mktemp)

  # Build Codex instructions from canonical source.
  # Header + body sections (from first ## onward) + rules appendix.
  {
    cat << 'HEADER'
# Stampede — Codex Instructions

Stampede is a config-driven k6 load testing tool. It separates **profiles** (target configuration) from **patterns** (test shapes).

HEADER
    awk '
      BEGIN { found=0 }
      /^## / { found=1 }
      found { print }
    ' "$SKILLS_DIR/agent-instructions.md"
    cat << 'RULES'

## Rules

- Never commit credentials. Profiles except example.js are gitignored.
- Profiles must export `contentPath(template)` as a named export.
- k6 has no dynamic imports. Profile selection is via symlink.
RULES
  } > "$tmpfile"

  if [[ -f "$dest" ]] && cmp -s "$tmpfile" "$dest"; then
    rm "$tmpfile"
    return 0
  fi

  CHANGES=$((CHANGES + 1))

  if [[ "$CHECK_MODE" == true ]]; then
    echo "  [out of sync] $dest"
    rm "$tmpfile"
  else
    mkdir -p "$codex_dir"
    mv "$tmpfile" "$dest"
    echo "  [synced] $dest"
  fi
}

# -- Main ---------------------------------------------------------------------

echo "=== Stampede Skill Sync ==="
echo ""

sync_claude
echo ""
sync_codex
echo ""

if [[ "$CHECK_MODE" == true ]]; then
  if [[ $CHANGES -gt 0 ]]; then
    echo "$CHANGES file(s) out of sync. Run ./sync.sh to update."
    exit 1
  else
    echo "All providers in sync."
  fi
else
  if [[ $CHANGES -gt 0 ]]; then
    echo "$CHANGES file(s) synced."
  else
    echo "Already in sync. No changes needed."
  fi
fi
