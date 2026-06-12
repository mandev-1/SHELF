#!/usr/bin/env bash
# Cut a release in one command: bump + build + commit + tag + push.
# Usage:
#   ./scripts/ship-release.sh          # patch bump (1.0.12 -> 1.0.13)
#   ./scripts/ship-release.sh 1.1.0    # explicit version (minor/major bumps)
set -euo pipefail

cd "$(dirname "$0")/.."

REQUESTED="${1:-}"
REQUESTED="${REQUESTED#v}"

if [ -n "$REQUESTED" ] && ! [[ "$REQUESTED" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version '$REQUESTED' — expected X.Y.Z (e.g. 1.1.0)." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean — commit or stash first so the release commit only contains release changes." >&2
  exit 1
fi

if [ -n "$REQUESTED" ]; then
  VERSION="$REQUESTED"
else
  CURRENT="$(cat .release-version 2>/dev/null || node -p "require('./package.json').version")"
  VERSION="$(echo "$CURRENT" | awk -F. '{printf "%d.%d.%d", $1, $2, $3 + 1}')"
fi
TAG="v$VERSION"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Tag $TAG already exists — pick another version." >&2
  exit 1
fi

echo "Releasing $VERSION (tag $TAG)..."
RELEASE_VERSION="$VERSION" npm run release:new

git add -A
git commit -m "release $VERSION"

echo
echo "Committed. About to tag $TAG and push — this triggers the GitHub Release."
read -r -p "Continue? [y/N] " ANSWER
if [ "$ANSWER" != "y" ] && [ "$ANSWER" != "Y" ]; then
  echo "Stopped before pushing. The release commit is local; push later with:"
  echo "  git tag $TAG && git push && git push origin $TAG"
  exit 0
fi

git tag "$TAG"
git push
git push origin "$TAG"

echo
echo "Done. Watch the workflow at https://github.com/mandev-1/SHELF/actions"
echo "Release will appear at https://github.com/mandev-1/SHELF/releases/tag/$TAG"
