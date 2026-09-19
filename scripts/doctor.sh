#!/usr/bin/env bash
# Health check for outman.cc infra. Prints ok/FAIL per item and, for each FAIL, where to fix it.
# Local: loads .env and also checks CLI logins. CI (CI=true): env comes from secrets, machine checks skipped.
cd "$(dirname "$0")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }
fail=0
ok()    { printf '  ok    %s\n' "$1"; }
bad()   { printf '  FAIL  %s\n        fix: %s\n' "$1" "$2"; fail=1; }
check() { if eval "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1" "$3"; fi; }
http()  { curl -s -o /dev/null --max-time 20 -w '%{http_code}' "$@"; }
S=https://share.outman.cc

echo "env"
for v in CF_API_TOKEN CF_ZONE_ID CLOUDFLARE_ACCOUNT_ID SHARE_TOKEN ARCHIVE_TOKEN; do
  check "$v set" "[ -n \"\${$v:-}\" ]" "add $v to .env (INSTALL.md → Secrets)"
done

echo "cloudflare"
check "CF_API_TOKEN active" "curl -sf -H 'Authorization: Bearer $CF_API_TOKEN' https://api.cloudflare.com/client/v4/user/tokens/verify | grep -q '\"status\":\"active\"'" \
  "regenerate: dash.cloudflare.com → API Tokens. Then update .env AND: gh secret set CLOUDFLARE_API_TOKEN --repo lincleejun/outman.me"
check "zone readable" "curl -sf -H 'Authorization: Bearer $CF_API_TOKEN' https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID | grep -q '\"success\":true'" \
  "CF_ZONE_ID wrong (outman.cc → Overview → API → Zone ID) or token lacks Zone:DNS:Edit on outman.cc"

echo "dns"
check "outman.cc A → 76.76.21.21" "dig +short outman.cc @1.1.1.1 | grep -q 76.76.21.21" "Cloudflare DNS: A outman.cc → 76.76.21.21, proxy OFF"
check "www CNAME → vercel" "dig +short www.outman.cc @1.1.1.1 | grep -q cname.vercel-dns.com" "Cloudflare DNS: CNAME www → cname.vercel-dns.com, proxy OFF"
check "share.outman.cc resolves" "[ -n \"\$(dig +short share.outman.cc @1.1.1.1)\" ]" "cd share && bunx wrangler deploy  (wrangler creates the custom domain)"

echo "http"
check "https://outman.cc → 200" "[ \$(http https://outman.cc/) = 200 ]" "bunx vercel ls outman-site. 525/526 = A record is proxied, turn proxy OFF"
check "https://www.outman.cc → 200" "[ \$(http https://www.outman.cc/) = 200 ]" "cd site && bunx vercel domains inspect www.outman.cc"
check "/gh redirect → 307" "[ \$(http https://outman.cc/gh) = 307 ]" "site/vercel.json redirects; push to main redeploys"
check "share landing → 200" "[ \$(http $S/) = 200 ]" "cd share && bunx wrangler deploy"

echo "share api"
check "POST without token → 401" "[ \$(http -X POST --data-binary '<p>x</p>' $S/share) = 401 ]" \
  "worker has no SHARE_TOKEN: cd share && bunx wrangler secret put SHARE_TOKEN  (same value as .env)"
id=$(curl -sf -X POST -H "Authorization: Bearer $SHARE_TOKEN" --data-binary '<title>doctor</title>' $S/share | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "POST with token" "[ -n '$id' ]" ".env SHARE_TOKEN differs from the worker's: re-put both (INSTALL.md → Rotate)"
if [ -n "$id" ]; then
  check "GET page → 200" "[ \$(http $S/share/$id) = 200 ]" "KV binding: share/wrangler.toml [[kv_namespaces]] id"
  check "list with token" "curl -sf -H 'Authorization: Bearer $SHARE_TOKEN' $S/share | grep -q '\"count\"'" "worker.js list route"
  curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $SHARE_TOKEN" $S/share/$id
fi

echo "github"
check "ARCHIVE_TOKEN reads share-archive" "curl -sf -H 'Authorization: Bearer $ARCHIVE_TOKEN' https://api.github.com/repos/lincleejun/share-archive" \
  "fine-grained PATs expire: github.com/settings/personal-access-tokens → regenerate. Then .env AND: gh secret set ARCHIVE_TOKEN --repo lincleejun/outman.me"

if [ -z "${CI:-}" ]; then
  check "4 GitHub Actions secrets" "[ \$(gh secret list --repo lincleejun/outman.me | grep -cE '^(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|SHARE_TOKEN|ARCHIVE_TOKEN)\b') = 4 ]" \
    "gh secret set <NAME> --repo lincleejun/outman.me --body <value>"
  check "last archive run ok" "gh run list --repo lincleejun/outman.me --workflow=archive.yml --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success" \
    "gh run list --repo lincleejun/outman.me --workflow=archive.yml ; gh run view <id> --log"
  check "last health run ok" "gh run list --repo lincleejun/outman.me --workflow=health.yml --limit 1 --json conclusion -q '.[0].conclusion' | grep -qE 'success|^\$'" \
    "gh run view <id> --log  (same checks as this script, run on GitHub)"
  echo "local cli"
  check "vercel logged in" "bunx vercel whoami" "bunx vercel login"
  check "wrangler logged in" "bunx wrangler whoami | grep -qi 'logged in'" "cd share && bunx wrangler login"
  check "share-page skill installed & current" "diff -rq skills/share-page ~/.claude/skills/share-page" "scripts/install.sh  (installed copy differs from repo)"
  check "global rule current" "python3 -c \"import os,re;s=open(os.path.expanduser('~/.claude/CLAUDE.md')).read();r=open('skills/share-page/RULE.md').read().strip();assert r in s\"" "scripts/install.sh  (rule block in ~/.claude/CLAUDE.md is stale)"
  check "~/.config/outman/env has SHARE_TOKEN" "grep -q '^SHARE_TOKEN=.' \"\${XDG_CONFIG_HOME:-\$HOME/.config}/outman/env\"" "scripts/install.sh  (seeds it from .env)"
fi
echo
if [ $fail = 0 ]; then echo "all good"; else echo "FAILURES above — each has a fix: line"; exit 1; fi
