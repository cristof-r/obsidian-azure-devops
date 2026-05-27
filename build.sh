#!/usr/bin/env bash
# Build and deploy the obsidian-azure-devops plugin to an Obsidian vault.
#
# Usage:
#   ./build.sh "/home/you/Documents/MyVault"
#
# VaultDir: Path to the root of the Obsidian vault (the folder containing .obsidian).

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <VaultDir>"
    exit 1
fi

VAULT_DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/manifest.json"

PLUGIN_ID=$(node -e "const m = require('$MANIFEST'); process.stdout.write(m.id)")
PLUGIN_NAME=$(node -e "const m = require('$MANIFEST'); process.stdout.write(m.name)")
TARGET_DIR="$VAULT_DIR/.obsidian/plugins/$PLUGIN_ID"

echo "Building $PLUGIN_NAME ($PLUGIN_ID)..."

cd "$SCRIPT_DIR"

echo "  Installing dependencies..."
npm install --silent

echo "  Building..."
npm run build

mkdir -p "$TARGET_DIR"

cp "$SCRIPT_DIR/main.js"       "$TARGET_DIR/"
cp "$SCRIPT_DIR/manifest.json" "$TARGET_DIR/"

if [[ -f "$SCRIPT_DIR/styles.css" ]]; then
    cp "$SCRIPT_DIR/styles.css" "$TARGET_DIR/"
fi

echo "Deployed to $TARGET_DIR"
