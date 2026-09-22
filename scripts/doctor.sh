#!/usr/bin/env bash
# Health check for outman.cc infra. Prints ok/FAIL per item and, for each FAIL, where to fix it.
# No keys live on a machine. CI (CI=true): secrets arrive as env and the Cloudflare + PAT checks run there.
# Local: your gh login stands in for every key; also checks CLI logins and the installed skills.
cd "$(dirname "$0")/.."
fail=0
ok()    { printf '  ok    %s\n' "$1"; }
bad()   { printf '  FAIL  %s\n        fix: %s\n' "$1" "$2"; fail=1; }
check() { if eval "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1" "$3"; fi; }
http()  { curl -s -o /dev/null --max-time 20 -w '%{http_code}' "$@"; }
S=https://share.outman.cc
REPO=lincleejun/outman.me

if [ -n "${CI:-}" ]; then
  echo "env"
  for v in CF_API_TOKEN CF_ZONE_ID CLOUDFLARE_ACCOUNT_ID GH_TOKEN; do
    check "$v set" "[ -n \"\${$v:-}\" ]" "gh secret set <NAME> --repo $REPO (INSTALL.md → Secrets); health.yml maps secrets to these names"
  done

  echo "cloudflare"
  check "CF_API_TOKEN active" "curl -sf -H 'Authorization: Bearer $CF_API_TOKEN' https://api.cloudflare.com/client/v4/user/tokens/verify | grep -q '\"status\":\"active\"'" \
    "regenerate: dash.cloudflare.com → API Tokens. Then: gh secret set CLOUDFLARE_API_TOKEN --repo $REPO"
  check "zone readable" "curl -sf -H 'Authorization: Bearer $CF_API_TOKEN' https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID | grep -q '\"success\":true'" \
    "CF_ZONE_ID wrong (outman.cc → Overview → API → Zone ID) or token lacks Zone:DNS:Edit on outman.cc"
fi

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
tok=$(gh auth token 2>/dev/null || true)
check "GitHub token present" "[ -n '$tok' ]" "local: gh auth login as the worker's SHARE_OWNER · CI: GH_TOKEN secret (health.yml)"
check "POST without token → 401" "[ \$(http -X POST --data-binary '<p>x</p>' $S/share) = 401 ]" \
  "worker has no SHARE_OWNER: share/wrangler.toml [vars], then push share/** to deploy"
id=$(curl -sf -X POST -H "Authorization: Bearer $tok" --data-binary '<title>doctor</title>' $S/share | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "POST as owner" "[ -n '$id' ]" "this token's GitHub login must equal SHARE_OWNER in share/wrangler.toml: gh auth status (local) / regenerate ARCHIVE_TOKEN (CI)"
if [ -n "$id" ]; then
  check "GET page → 200" "[ \$(http $S/share/$id) = 200 ]" "KV binding: share/wrangler.toml [[kv_namespaces]] id"
  check "list as owner" "curl -sf -H 'Authorization: Bearer $tok' $S/share | grep -q '\"count\"'" "worker.js list route"
  curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $tok" $S/share/$id
fi

echo "github"
if [ -n "${CI:-}" ]; then
  check "GH_TOKEN reads share-archive" "curl -sf -H 'Authorization: Bearer $GH_TOKEN' https://api.github.com/repos/lincleejun/share-archive" \
    "fine-grained PATs expire: github.com/settings/personal-access-tokens → regenerate → gh secret set ARCHIVE_TOKEN --repo $REPO"
else
  check "gh reads share-archive" "gh repo view lincleejun/share-archive" "gh auth login as the repo owner"
  check "4 GitHub Actions secrets" "[ \$(gh secret list --repo $REPO | grep -cE '^(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|CF_ZONE_ID|ARCHIVE_TOKEN)\b') = 4 ]" \
    "gh secret set <NAME> --repo $REPO --body <value>  (INSTALL.md → Secrets)"
  check "last archive run ok" "gh run list --repo $REPO --workflow=archive.yml --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success" \
    "gh run list --repo $REPO --workflow=archive.yml ; gh run view <id> --log"
  check "last health run ok" "gh run list --repo $REPO --workflow=health.yml --limit 1 --json conclusion -q '.[0].conclusion' | grep -qE 'success|^\$'" \
    "gh run view <id> --log  (same checks as this script, run on GitHub with the secrets)"
  echo "local cli"
  check "vercel logged in" "bunx vercel whoami" "bunx vercel login  (only needed for scripts/new-project.sh)"
  check "wrangler logged in" "bunx wrangler whoami | grep -qi 'logged in'" "cd share && bunx wrangler login  (only needed to deploy the worker by hand)"
  for d in skills/*/; do n=$(basename "$d")
    check "$n skill installed & current" "diff -rq skills/$n ~/.claude/skills/$n" "scripts/install.sh  (installed copy differs from repo)"
    check "$n global rule current" "python3 -c \"import os,re;s=open(os.path.expanduser('~/.claude/CLAUDE.md')).read();r=open('skills/$n/RULE.md').read().strip();assert r in s\"" "scripts/install.sh  (rule block in ~/.claude/CLAUDE.md is stale)"
    [ -f "skills/$n/hook.json" ] && check "$n hook registered" "grep -q 'skills/$n/guard.sh' ~/.claude/settings.json" "scripts/install.sh  (adds the PreToolUse hook to ~/.claude/settings.json)"
  done
fi
echo
if [ $fail = 0 ]; then echo "all good"; else echo "FAILURES above — each has a fix: line"; exit 1; fi
