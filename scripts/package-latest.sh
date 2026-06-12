#!/usr/bin/env bash
# Zip just the latest releases/<version>/ folder into releases/<version>.zip
# (and .tar.gz). Same archive layout as scripts/release.js: a top-level
# <version>/ folder inside the archive.
# Usage:
#   ./scripts/package-latest.sh          # picks the highest version folder in releases/
#   ./scripts/package-latest.sh 1.0.13   # or package a specific version
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-}"
VERSION="${VERSION#v}"

if [ -z "$VERSION" ]; then
  VERSION="$(find releases -maxdepth 1 -type d -name '[0-9]*.[0-9]*.[0-9]*' \
    | sed 's|releases/||' \
    | sort -t. -k1,1n -k2,2n -k3,3n \
    | tail -1)"
fi

if [ -z "$VERSION" ] || [ ! -d "releases/$VERSION" ]; then
  echo "No releases/${VERSION:-<version>} folder found — run 'npm run release:new' first." >&2
  exit 1
fi

rm -f "releases/$VERSION.zip" "releases/$VERSION.tar.gz"
(cd releases && zip -rq "$VERSION.zip" "$VERSION" && tar -czf "$VERSION.tar.gz" "$VERSION")

echo "Created releases/$VERSION.zip"
echo "Created releases/$VERSION.tar.gz"
