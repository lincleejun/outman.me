#!/usr/bin/env bash
# Add a sub-project: Vercel project + <name>.outman.cc + Cloudflare CNAME + first deploy.
# usage: scripts/new-project.sh <name> [project-dir=.]
# needs: CF_API_TOKEN, CF_ZONE_ID (see .env.example); `bunx vercel login` done once.
set -euo pipefail
name=${1:?usage: new-project.sh <name> [dir]}
dir=${2:-.}
host="$name.outman.cc"
: "${CF_API_TOKEN:?}" "${CF_ZONE_ID:?}"

cd "$dir"
bunx vercel project add "$name" 2>/dev/null || true
bunx vercel link --yes --project "$name"
bunx vercel domains add "$host" "$name" || true

curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  --data "{\"type\":\"CNAME\",\"name\":\"$host\",\"content\":\"cname.vercel-dns.com\",\"proxied\":false,\"comment\":\"vercel:$name\"}" \
  >/dev/null && echo "dns: $host -> cname.vercel-dns.com" || echo "dns: record exists or failed (check dashboard)"

bunx vercel deploy --prod --yes
echo "live: https://$host"
