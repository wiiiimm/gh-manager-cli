#!/usr/bin/env bash
set -euo pipefail

# Script to update homebrew-tap formula after a new release
# Usage: ./scripts/update-homebrew-tap.sh [tap-directory] [version]

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(dirname "$SCRIPT_DIR")
TAP_DIR="${1:-$REPO_DIR/homebrew-tap}"

# Get the latest version from npm
VERSION="${2:-$(npm view gh-manager-cli version --registry=https://registry.npmjs.org)}"
echo "Latest npm version: $VERSION"

# Calculate SHA256
echo "Calculating SHA256..."
SHA256=$(bash "$SCRIPT_DIR/brew-sha.sh" "$VERSION" | awk '/^sha256:/ {print $2}')
echo "SHA256: $SHA256"

if [ ! -d "$TAP_DIR" ]; then
  echo "Error: Tap directory not found at $TAP_DIR"
  echo "Please clone https://github.com/stealth-factory/homebrew-tap into $TAP_DIR first"
  exit 1
fi

# Update formula
FORMULA="$TAP_DIR/Formula/gh-manager-cli.rb"

echo "Updating formula at $FORMULA..."

# Accepts both existing unscoped and scoped URLs.
node "$SCRIPT_DIR/update-homebrew-formula.js" "$FORMULA" "$VERSION" "$SHA256"

echo "Formula updated!"
echo ""
echo "Next steps:"
echo "1. cd $TAP_DIR"
echo "2. git add Formula/gh-manager-cli.rb"
echo "3. git commit -m \"chore: update gh-manager-cli to $VERSION\""
echo "4. git push origin main"
echo ""
echo "Or run this command to do it all:"
echo "cd \"$TAP_DIR\" && git add Formula/gh-manager-cli.rb && git commit -m \"chore: update gh-manager-cli to $VERSION\" && git push"
