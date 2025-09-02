#!/usr/bin/env bash
set -euo pipefail

# Script to update homebrew-tap formula after a new release
# Usage: ./scripts/update-homebrew-tap.sh

# Get the latest version from npm
VERSION=$(npm view gh-manager-cli version)
echo "Latest npm version: $VERSION"

# Calculate SHA256
echo "Calculating SHA256..."
SHA256=$(bash scripts/brew-sha.sh "$VERSION" | grep "sha256:" | cut -d' ' -f2)
echo "SHA256: $SHA256"

# Path to tap repo (adjust if needed)
TAP_DIR="$HOME/projects/wiiiimm/gh-manager-cli/homebrew-tap"

if [ ! -d "$TAP_DIR" ]; then
  echo "Error: Tap directory not found at $TAP_DIR"
  echo "Please clone https://github.com/wiiiimm/homebrew-tap first"
  exit 1
fi

# Update formula
FORMULA="$TAP_DIR/Formula/gh-manager-cli.rb"

echo "Updating formula at $FORMULA..."

# Update version and sha256 in formula
sed -i.bak -E "s|url \"https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-[0-9.]+\.tgz\"|url \"https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-${VERSION}.tgz\"|" "$FORMULA"
sed -i.bak -E "s|sha256 \"[a-f0-9]{64}\"|sha256 \"${SHA256}\"|" "$FORMULA"

# Remove backup files
rm -f "$FORMULA.bak"

echo "Formula updated!"
echo ""
echo "Next steps:"
echo "1. cd $TAP_DIR"
echo "2. git add Formula/gh-manager-cli.rb"
echo "3. git commit -m \"Update gh-manager-cli to $VERSION\""
echo "4. git push origin main"
echo ""
echo "Or run this command to do it all:"
echo "cd $TAP_DIR && git add Formula/gh-manager-cli.rb && git commit -m \"Update gh-manager-cli to $VERSION\" && git push"