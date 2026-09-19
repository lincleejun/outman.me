# INSTALL

Two situations. Pick one.

## A. New machine, infra already exists (the usual case)

```bash
git clone https://github.com/lincleejun/outman.me ~/workspace/personal/outman.me
cd ~/workspace/personal/outman.me
scripts/install.sh        # copies skills to ~/.claude/skills, writes the rule block into ~/.claude/CLAUDE.md, seeds ~/.config/outman/env
$EDITOR .env              # fill from the Secrets table below
scripts/doctor.sh         # everything should be ok
```

Only if this machine will also deploy: `bunx vercel login` and `cd share && bunx wrangler login`.
Pushing to `main` deploys from GitHub either way, so most machines never need those.

## Update a machine

```bash
cd ~/workspace/personal/outman.me && git pull && scripts/install.sh
```

Skills and rules are copied, not linked. The repo is the only place to edit them.
A machine that only shares pages needs just `~/.config/outman/env` with `SHARE_TOKEN=…` and `gh auth login` for history.

## Secrets

| Name | Get it from | Lives in |
| --- | --- | --- |
| `CF_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create → template **Edit Cloudflare Workers** + add `Zone → DNS → Edit` on outman.cc | `.env` · GitHub secret `CLOUDFLARE_API_TOKEN` |
| `CF_ZONE_ID` | Cloudflare → outman.cc → Overview → right column *API* | `.env` · GitHub secret `CF_ZONE_ID` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages → right column | `.env` · GitHub secret |
| `SHARE_TOKEN` | you invent it: `openssl rand -hex 24` | `.env` · GitHub secret · worker secret (`wrangler secret put SHARE_TOKEN`) |
| `ARCHIVE_TOKEN` | GitHub → Settings → Developer settings → Fine-grained tokens → repo `share-archive` only, Contents: read/write. **They expire** (max 1 year) | `.env` · GitHub secret |

GitHub secrets: `gh secret set NAME --repo lincleejun/outman.me --body VALUE`.
The daily `health` workflow runs `scripts/doctor.sh` on GitHub and emails you when a token dies; the FAIL line says where to fix it.

### Rotate

- Cloudflare token: new token → `.env` → `gh secret set CLOUDFLARE_API_TOKEN`.
- `SHARE_TOKEN`: new value → `.env` → `gh secret set SHARE_TOKEN` → `cd share && bunx wrangler secret put SHARE_TOKEN`. All three must match.
- `ARCHIVE_TOKEN`: regenerate on GitHub → `.env` → `gh secret set ARCHIVE_TOKEN`.

## B. Rebuild from zero (domain on Cloudflare, nothing else exists)

Done once on 2026-09-19. Repeat only if the Vercel project, worker, or repos are gone.

```bash
# 0. accounts
gh auth login && bunx vercel login && (cd share && bunx wrangler login)
cp .env.example .env && $EDITOR .env      # fill CF_API_TOKEN, CF_ZONE_ID, CLOUDFLARE_ACCOUNT_ID; SHARE_TOKEN=$(openssl rand -hex 24)
set -a; source .env; set +a

# 1. site on Vercel
cd site
bunx vercel project add outman-site && bunx vercel link --yes --project outman-site
bunx vercel domains add outman.cc outman-site && bunx vercel domains add www.outman.cc outman-site
bunx vercel deploy --prod --yes
cd ..
#    Root Directory must be "site": Vercel → project → Settings → Build and Deployment → Root Directory.
#    Git auto-deploy: Vercel → project → Settings → Git → Connect Git Repository → GitHub → install app for lincleejun/outman.me.

# 2. DNS (both proxy OFF — a proxied apex breaks Vercel's certificate issuance with 525)
api=https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records
curl -X POST $api -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' -d '{"type":"A","name":"outman.cc","content":"76.76.21.21","proxied":false}'
curl -X POST $api -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' -d '{"type":"CNAME","name":"www","content":"cname.vercel-dns.com","proxied":false}'

# 3. share worker (creates KV + custom domain share.outman.cc; commit the kv id wrangler writes)
cd share && bunx wrangler deploy && echo -n "$SHARE_TOKEN" | bunx wrangler secret put SHARE_TOKEN && cd ..

# 4. archive repo + CI secrets
gh repo create lincleejun/share-archive --private     # needs one initial commit (README) so checkout works
for s in CLOUDFLARE_ACCOUNT_ID CF_ZONE_ID SHARE_TOKEN ARCHIVE_TOKEN; do gh secret set $s --repo lincleejun/outman.me --body "${!s}"; done
gh secret set CLOUDFLARE_API_TOKEN --repo lincleejun/outman.me --body "$CF_API_TOKEN"

# 5. verify
scripts/doctor.sh
gh workflow run archive.yml --repo lincleejun/outman.me -f max_days=0   # archives whatever is in KV right now
```

## When something breaks

1. `scripts/doctor.sh` — read the `fix:` line.
2. `gh run list --repo lincleejun/outman.me` — three workflows: `deploy share worker` (push to share/**), `archive share pages` (Mon 03:00 UTC), `health` (daily 04:00 UTC). `gh run view <id> --log`.
3. Site deploys have no workflow; check `bunx vercel ls outman-site` or the Vercel dashboard.
