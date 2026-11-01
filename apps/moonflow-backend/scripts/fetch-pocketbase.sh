#!/bin/sh
# Downloads the PocketBase binary the tests run against into .bin/, pinned to
# the instance's minor version and verified by checksum. Re-run after bumping.
set -e
VERSION=0.40.6
case "$(uname -s)_$(uname -m)" in
  Darwin_arm64) target=darwin_arm64; sha=7f2f7544e9ee5994ab69f84b22a4ab9a3bcfed58c1dad7206d05ebeb753f968b ;;
  Linux_x86_64) target=linux_amd64; sha=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f ;;
  *) echo "fetch-pocketbase: no pinned checksum for $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac
dir="$(cd "$(dirname "$0")/.." && pwd)/.bin"
if [ -x "$dir/pocketbase" ] && "$dir/pocketbase" --version | grep -q "$VERSION"; then
  exit 0
fi
mkdir -p "$dir"
zip="$dir/pocketbase_${VERSION}_$target.zip"
curl -fsSL -o "$zip" "https://github.com/pocketbase/pocketbase/releases/download/v$VERSION/pocketbase_${VERSION}_$target.zip"
if command -v sha256sum >/dev/null; then actual=$(sha256sum "$zip" | cut -d' ' -f1); else actual=$(shasum -a 256 "$zip" | cut -d' ' -f1); fi
if [ "$actual" != "$sha" ]; then
  rm -f "$zip"
  echo "fetch-pocketbase: checksum mismatch for $zip" >&2
  exit 1
fi
unzip -oq "$zip" pocketbase -d "$dir"
rm -f "$zip"
"$dir/pocketbase" --version
