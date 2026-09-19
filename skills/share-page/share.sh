#!/usr/bin/env bash
# Publish a self-contained HTML file to share.outman.cc, print the public URL.
# usage: share.sh page.html [title]
# Token: $SHARE_TOKEN, else SHARE_TOKEN= in the repo .env (this file lives at <repo>/skills/share-page/).
set -euo pipefail
file=${1:?usage: share.sh page.html [title]}
here=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)
base=${SHARE_URL:-https://share.outman.cc}
[ -z "${SHARE_TOKEN:-}" ] && [ -f "$here/../../.env" ] && SHARE_TOKEN=$(grep '^SHARE_TOKEN=' "$here/../../.env" | cut -d= -f2-)
[ -n "${SHARE_TOKEN:-}" ] || { echo "no SHARE_TOKEN (env or <repo>/.env)" >&2; exit 1; }
q=""; [ -n "${2:-}" ] && q="?title=$(printf %s "$2" | sed 's/ /+/g')"
curl -sf -X POST "$base/share$q" -H "Authorization: Bearer $SHARE_TOKEN" --data-binary @"$file" \
  | sed -n 's/.*"url":"\([^"]*\)".*/\1/p'
