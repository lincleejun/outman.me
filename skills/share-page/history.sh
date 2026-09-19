#!/usr/bin/env bash
# What has been shared, live and archived. Optional case-insensitive filter on title/id/date.
# usage: history.sh [pattern]        e.g. history.sh report   ·   history.sh 2026-08
# Fetch an archived page:  history.sh --get 2026-09/<id>.html > page.html
set -euo pipefail
here=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)
base=${SHARE_URL:-https://share.outman.cc}
ARCHIVE=${SHARE_ARCHIVE_REPO:-lincleejun/share-archive}
[ -z "${SHARE_TOKEN:-}" ] && [ -f "$here/../../.env" ] && SHARE_TOKEN=$(grep '^SHARE_TOKEN=' "$here/../../.env" | cut -d= -f2-)

if [ "${1:-}" = "--get" ]; then
  gh api "repos/$ARCHIVE/contents/${2:?path like 2026-09/<id>.html}" -q .content | base64 -d; exit
fi
pat=${1:-.}

echo "# live (KV, ≤90 days)"
[ -n "${SHARE_TOKEN:-}" ] && curl -sf -H "Authorization: Bearer $SHARE_TOKEN" "$base/share" \
  | python3 -c 'import json,sys;[print(f"{i.get("at","")[:10]}  {i["id"]}  {i.get("title","")}  {i["url"]}") for i in json.load(sys.stdin)["items"]]' \
  | grep -i -- "$pat" || echo "(none or no token)"

echo; echo "# archived ($ARCHIVE, file = path for --get)"
gh api "repos/$ARCHIVE/contents/index.jsonl" -q .content 2>/dev/null | base64 -d \
  | python3 -c 'import json,sys;[print(f"{e.get("at","")[:10]}  {e["id"]}  {e.get("title","")}  {e["file"]}") for e in map(json.loads,filter(None,sys.stdin.read().splitlines()))]' \
  | grep -i -- "$pat" || echo "(none)"
