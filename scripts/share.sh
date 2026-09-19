#!/usr/bin/env bash
# Publish a self-contained HTML file, print the public URL.
# usage: scripts/share.sh page.html
set -euo pipefail
file=${1:?usage: share.sh page.html}
base=${SHARE_URL:-https://share.outman.cc}
envf="$(dirname "$0")/../.env"
[ -z "${SHARE_TOKEN:-}" ] && [ -f "$envf" ] && SHARE_TOKEN=$(grep '^SHARE_TOKEN=' "$envf" | cut -d= -f2-)
curl -sf -X POST "$base/share" ${SHARE_TOKEN:+-H "Authorization: Bearer $SHARE_TOKEN"} \
  --data-binary @"$file" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p'
