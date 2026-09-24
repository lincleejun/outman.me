# outman.me

*event in, context out.*

Infrastructure for **outman.cc**: the site, the share service, and the one-command flow for
adding a new sub-project. Everything public lives here; everything private lives only in the
Cloudflare dashboard.

```
outman.cc            static site        Vercel   ← site/
share.outman.cc      HTML share worker  CF Worker ← share/
<name>.outman.cc     any sub-project    Vercel   ← scripts/new-project.sh
outman.cc/setup      → bootstrap script for a fresh machine (infra repo)
outman.cc/gh         → this repo
```

DNS for every hostname is Cloudflare. Apps are Vercel. The share service is a Cloudflare
Worker because it needs KV, not a build.

## Layout

| Path | What |
| --- | --- |
| `site/` | Static site. Content is `site/data/projects.json`; the page renders it with no external API calls. |
| `site/vercel.json` | Redirects: `/setup`, `/gh`, `/share`. |
| `share/` | Worker: `POST /share` → `{id,url}`, `GET /share/<id>`. Retention = `TTL_DAYS` in wrangler.toml (default 90, hard cap from creation, `0` = forever). Auth is your GitHub identity: a token of `SHARE_OWNER` (wrangler.toml) may `POST`, `GET /share` (list: title, date, size) and `DELETE /share/<id>`; no shared secret. `node share/test.mjs` is the check. |
| `scripts/new-project.sh` | New Vercel project + `<name>.outman.cc` + deploy. The Cloudflare CNAME is made by `.github/workflows/dns.yml`, so no key on the machine. |
| `.github/workflows/share.yml` | Deploys the worker on push to `share/**`. |
| `share/archive.mjs` + `.github/workflows/archive.yml` | Weekly: pages older than 30 days (or the oldest once KV passes 500MB) are copied into the private `share-archive` repo (pushed straight to its `main`, no PR), then deleted from KV. Archived files older than `KEEP_DAYS` (90) are pruned from the tree. Short-term stays in KV, long-term lives in git. |

## Setup

New machine: `scripts/install.sh` then `scripts/doctor.sh`. Full story, secrets table and rebuild-from-zero: **[INSTALL.md](INSTALL.md)**.

## Bootstrap (once)

```bash
export CF_API_TOKEN=… CF_ZONE_ID=… CLOUDFLARE_ACCOUNT_ID=…   # this shell only; they end up as GitHub secrets, never in a file

# 1. site → Vercel, root directory = site
cd site && bunx vercel login && bunx vercel link --yes --project outman-site
bunx vercel domains add outman.cc outman-site
bunx vercel domains add www.outman.cc outman-site
bunx vercel deploy --prod --yes && cd ..
#    Cloudflare DNS (both DNS-only, proxy OFF — proxied apex blocks Vercel cert issuance with a 525):
#      A outman.cc → 76.76.21.21 · CNAME www → cname.vercel-dns.com
#    Vercel Git integration on this repo → every push to main redeploys the site.

# 2. share worker
cd share && bunx wrangler login && bunx wrangler deploy   # provisions KV, writes its id into wrangler.toml → commit it
cd ..                                                       # who may publish = SHARE_OWNER in wrangler.toml (GitHub login)
#    GitHub → Settings → Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CF_ZONE_ID,
#    ARCHIVE_TOKEN (fine-grained PAT, contents:write on share-archive; also CI's share credential)

# 3. agent skills + global rules + hooks
scripts/install.sh
```

## Daily

```bash
scripts/new-project.sh myapp ~/code/myapp      # live at https://myapp.outman.cc, then add it to site/data/projects.json
~/.claude/skills/share-page/share publish report.html   # https://share.outman.cc/share/<id>  (installed copy)
~/.claude/skills/share-page/share list                  # everything shared, live + archived
~/.claude/skills/fetch-page/fetch https://…            # full page text as markdown (agents use this instead of WebFetch)
curl -H "Authorization: Bearer $(gh auth token)" https://share.outman.cc/share   # audit: everything still stored
```

Edit `site/data/projects.json`, push, done.

## Fresh machine

```bash
curl -fsSL https://outman.cc/setup | sh
```

`/setup` redirects to the public bootstrap script in the `infra` repo, which installs tools and
pulls the private half with `gh` after login. Keep secrets and personal hostnames out of the
public half.

## Privacy rules

- Private subdomains are created in the Cloudflare dashboard only and never named in this repo,
  `projects.json`, or commit messages. Put them behind Cloudflare Access.
- The site makes no calls to GitHub or any social API. Nothing here lists follower counts,
  repo counts, or social handles. Add links to `projects.json` only when you want them public.
- Share links are unlisted (`noindex`, content-hash ids). Treat a link as a capability token; the
  audit list and delete only answer to a GitHub token of `SHARE_OWNER`.

## Birding feed

`site/birding/` serves [湾区鸟讯](https://outman.cc/birding/): newest-first community reports with automatic scrolling, search and area filters. The homepage links to it.

The separate [birding repository](https://github.com/lincleejun/birding) collects hourly and commits `data/feed.json`. Vercel rewrites `/birding/feed.json` to the static GitHub Pages JSON; the site does not call GitHub APIs or carry credentials. Source failure and stale data are visible in the page. eBird observation ingestion is not enabled yet.

Verify after deployment: `node scripts/check-birding.mjs` (or supply a local origin). This checks routing, JSON schema, deduplication, ordering and source freshness. The existing Vercel integration deploys pushes to `main`; revert the birding commit and push to roll it back.

## Lens lab

`toy/lens-lab/` is a single-file optical bench: a Leica Summilux-M 35mm f/1.4 Aspherical (US 5,161,060) traced ray by ray in the browser. It is its own Vercel project at [lens.outman.cc](https://lens.outman.cc) (created with `scripts/new-project.sh lens toy/lens-lab`); redeploy with `cd toy/lens-lab && bunx vercel deploy --prod --yes`. [outman.cc/lens/](https://outman.cc/lens/) is the write-up. `node toy/lens-lab/test.mjs` checks the tracer against the patent's numbers.
