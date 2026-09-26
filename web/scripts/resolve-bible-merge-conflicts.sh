#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Target files that repeatedly conflict in this feature stream.
FILES=(
  "app/(protected)/live-output/main/page.tsx"
  "app/(protected)/live-output/stage/page.tsx"
  "components/operator/BibleBrowser.tsx"
  "components/operator/LiveOutputPanel.tsx"
)

if ! git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  echo "⚠️ No merge in progress (MERGE_HEAD not found)."
  echo "   Nothing to resolve automatically."
  exit 0
fi

echo "Resolving known Bible/live-output conflicts by keeping branch version (ours)..."
for f in "${FILES[@]}"; do
  if [ -e "$f" ]; then
    git checkout --ours -- "$f"
    git add "$f"
    echo "  ✓ $f"
  fi
done

echo "Running conflict safety checks..."
bash scripts/check-conflicts.sh

echo "✅ Done. Review with: git status && git diff --cached"
