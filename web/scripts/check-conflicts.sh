#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SEARCH_TOOL=""
if command -v rg >/dev/null 2>&1; then
  SEARCH_TOOL="rg"
elif command -v grep >/dev/null 2>&1; then
  SEARCH_TOOL="grep"
else
  echo "❌ Neither 'rg' nor 'grep' is available. Cannot run conflict checks."
  exit 1
fi

search_matches() {
  local pattern="$1"
  shift
  local out_file="$1"
  shift

  if [ "$SEARCH_TOOL" = "rg" ]; then
    rg -n "$pattern" "$@" --glob '!**/*.md' --glob '!**/*.txt' >"$out_file"
  else
    grep -R -n -E --exclude='*.md' --exclude='*.txt' "$pattern" "$@" >"$out_file"
  fi
}

# 1) Detect unresolved merge markers in source files.
if search_matches "^(<<<<<<<|=======|>>>>>>>)" /tmp/merge_markers.log app components lib; then
  echo "❌ Found unresolved merge markers:"
  cat /tmp/merge_markers.log
  exit 1
fi

# 2) Ensure main/stage live output do not show duplicate Bible metadata lines.
if search_matches "text-blue-300 text-4xl font-semibold|text-gray-400 text-2xl" /tmp/duplicate_bible_meta.log "app/(protected)/live-output/main/page.tsx" "app/(protected)/live-output/stage/page.tsx"; then
  echo "❌ Found duplicate Bible metadata lines in live output pages (top ref / separate version line):"
  cat /tmp/duplicate_bible_meta.log
  exit 1
fi

# 3) Ensure sidebar stage preview stays parity-focused (no old message/time row renderer).
if search_matches "case 'message':|case 'time':|config\.element_order\.map" /tmp/stage_preview_legacy.log components/operator/LiveOutputPanel.tsx; then
  echo "❌ Found legacy stage preview row-rendering logic that breaks parity with main output:"
  cat /tmp/stage_preview_legacy.log
  exit 1
fi

echo "✅ Conflict guards passed (merge markers, duplicate Bible metadata, preview parity checks)."
