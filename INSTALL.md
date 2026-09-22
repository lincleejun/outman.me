# INSTALL

Two situations. Pick one.

No key ever lives on a machine. Your `gh` login is the only credential a machine holds: the share
worker checks the GitHub identity behind the token, and everything that needs a Cloudflare or
GitHub key runs on GitHub Actions with the repo's secrets.

## A. New machine, infra already exists (the usual case)

```bash
gh auth login             # as the repo owner (the worker's SHARE_OWNER in share/wrangler.toml)
git clone https://github.com/lincleejun/outman.me ~/workspace/personal/outman.me
cd ~/workspace/personal/outman.me
scripts/install.sh        # copies skills to ~/.claude/skills, writes the rule blocks into ~/.claude/CLAUDE.md, registers skill hooks in ~/.claude/settings.json
scripts/doctor.sh         # everything should be ok
```

Only if this machine will create sub-projects: `bunx vercel login`. Only if it will deploy the worker
by hand: `cd share && bunx wrangler login`. Pushing to `main` deploys from GitHub either way, so most
machines never need those.

## Update a machine

```bash
cd ~/workspace/personal/outman.me && git pull && scripts/install.sh
```

Skills and rules are copied, not linked. The repo is the only place to edit them.
A machine that only shares pages needs just `gh auth login` and the installed skill.

## Secrets

All four are GitHub Actions secrets on this repo. None is needed on a machine.

| Name | Get it from | Used by |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create → template **Edit Cloudflare Workers** + add `Zone → DNS → Edit` on outman.cc | `share.yml` (deploy worker) · `dns.yml` (CNAME for a sub-project) · `health.yml` |
| `CF_ZONE_ID` | Cloudflare → outman.cc → Overview → right column *API* | `dns.yml` · `health.yml` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages → right column | `share.yml` · `health.yml` |
| `ARCHIVE_TOKEN` | GitHub → Settings → Developer settings → Fine-grained tokens → repo `share-archive` only, Contents: read/write. **They expire** (max 1 year) | `archive.yml` (checkout + share API) · `health.yml` (as `GH_TOKEN`) |

Set one: `gh secret set NAME --repo lincleejun/outman.me --body VALUE`.
The daily `health` workflow runs `scripts/doctor.sh` on GitHub and emails you when a token dies; the FAIL line says where to fix it.

The share worker has no secret of its own. Its `SHARE_OWNER` var (`share/wrangler.toml`) names the
GitHub account whose tokens may publish, list and delete; `share` uses `gh auth token`, CI uses
`ARCHIVE_TOKEN`. Change the owner: edit the var, push `share/**`.

### Rotate

- Cloudflare token: new token → `gh secret set CLOUDFLARE_API_TOKEN`.
- `ARCHIVE_TOKEN`: regenerate on GitHub → `gh secret set ARCHIVE_TOKEN`.
- Your own `gh` login: `gh auth refresh` or `gh auth login`; nothing else to update.

## B. Rebuild from zero (domain on Cloudflare, nothing else exists)

Done once on 2026-09-19. Repeat only if the Vercel project, worker, or repos are gone.
This is the one time the Cloudflare values are typed on a machine; they go into GitHub secrets and
are not kept.

```bash
# 0. accounts
gh auth login && bunx vercel login && (cd share && bunx wrangler login)
export CF_API_TOKEN=… CF_ZONE_ID=… CLOUDFLARE_ACCOUNT_ID=… ARCHIVE_TOKEN=…    # from the Secrets table, this shell only

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

# 3. share worker (creates KV + custom domain share.outman.cc; commit the kv id wrangler writes). SHARE_OWNER is in wrangler.toml.
cd share && bunx wrangler deploy && cd ..

# 4. archive repo + CI secrets
gh repo create lincleejun/share-archive --private     # needs one initial commit (README) so checkout works
for s in CLOUDFLARE_ACCOUNT_ID CF_ZONE_ID ARCHIVE_TOKEN; do gh secret set $s --repo lincleejun/outman.me --body "${!s}"; done
gh secret set CLOUDFLARE_API_TOKEN --repo lincleejun/outman.me --body "$CF_API_TOKEN"

# 5. verify
scripts/doctor.sh
gh workflow run archive.yml --repo lincleejun/outman.me -f max_days=0   # archives whatever is in KV right now
```

## When something breaks

1. `scripts/doctor.sh` — read the `fix:` line.
2. `gh run list --repo lincleejun/outman.me` — four workflows: `deploy share worker` (push to share/**), `archive share pages` (Mon 03:00 UTC), `health` (daily 04:00 UTC), `dns record` (manual, from `new-project.sh`). `gh run view <id> --log`.
3. Site deploys have no workflow; check `bunx vercel ls outman-site` or the Vercel dashboard.
