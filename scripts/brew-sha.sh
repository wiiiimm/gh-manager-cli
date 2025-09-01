#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -e "console.log(require('./package.json').version)")
URL="https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-${VERSION}.tgz"

echo "Fetching: $URL" >&2
TMPFILE=$(mktemp -t gh-manager-cli.XXXXXX.tgz)
curl -sSL "$URL" -o "$TMPFILE"

if command -v shasum >/dev/null 2>&1; then
  SHA=$(shasum -a 256 "$TMPFILE" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  SHA=$(sha256sum "$TMPFILE" | awk '{print $1}')
else
  echo "Error: neither shasum nor sha256sum found" >&2
  exit 1
fi

echo "sha256: $SHA"
echo "version: $VERSION"
echo "url: $URL"

rm -f "$TMPFILE"

