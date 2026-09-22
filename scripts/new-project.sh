#!/usr/bin/env bash
# Add a sub-project: Vercel project + <name>.outman.cc + Cloudflare CNAME (created by GitHub, no keys here) + first deploy.
# usage: scripts/new-project.sh <name> [project-dir=.]
# needs: `bunx vercel login` once; `gh auth login` (the CNAME is made by .github/workflows/dns.yml with the repo's secrets).
set -euo pipefail
name=${1:?usage: new-project.sh <name> [dir]}
dir=${2:-.}
host="$name.outman.cc"
repo=lincleejun/outman.me

cd "$dir"
bunx vercel project add "$name" 2>/dev/null || true
bunx vercel link --yes --project "$name"
bunx vercel domains add "$host" "$name" || true

gh workflow run dns.yml --repo "$repo" -f "name=$name" \
  && echo "dns: $host -> cname.vercel-dns.com requested  (gh run list --repo $repo --workflow dns.yml)" \
  || echo "dns: could not start dns.yml — gh auth login, or add the record in the Cloudflare dashboard"

bunx vercel deploy --prod --yes
echo "live: https://$host  (DNS lands within a minute)"
