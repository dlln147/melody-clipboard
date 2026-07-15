#!/usr/bin/env bash
# Generates the full platform icon set (macOS .icns, Windows .ico, and PNG
# variants) from icons-src/icon-base.png using the Tauri CLI.
#
# Usage:
#   python3 scripts/generate-base-icon.py   # (re)generate the base PNG
#   ./scripts/generate-icons.sh             # expand it into src-tauri/icons
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f icons-src/icon-base.png ]; then
  echo "icons-src/icon-base.png not found; generating it first..."
  python3 scripts/generate-base-icon.py
fi

npx tauri icon icons-src/icon-base.png -o src-tauri/icons
echo "Icons written to src-tauri/icons"
