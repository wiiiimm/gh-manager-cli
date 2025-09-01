#!/usr/bin/env bash
set -euo pipefail

# Get version from package.json or use provided version
if [ $# -eq 1 ]; then
  VERSION="$1"
else
  VERSION=$(node -e "console.log(require('./package.json').version)")
fi

URL="https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-${VERSION}.tgz"

echo "Fetching: $URL" >&2
TMPFILE=$(mktemp -t gh-manager-cli.XXXXXX.tgz)

if ! curl -sSL "$URL" -o "$TMPFILE"; then
  echo "Error: Failed to download tarball from $URL" >&2
  rm -f "$TMPFILE"
  exit 1
fi

if command -v shasum >/dev/null 2>&1; then
  SHA=$(shasum -a 256 "$TMPFILE" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  SHA=$(sha256sum "$TMPFILE" | awk '{print $1}')
else
  echo "Error: neither shasum nor sha256sum found" >&2
  rm -f "$TMPFILE"
  exit 1
fi

echo "sha256: $SHA"
echo "version: $VERSION"
echo "url: $URL"

rm -f "$TMPFILE"

