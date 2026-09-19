# outman.me — agent notes

This repo is the infra for **outman.cc**. Read this first; `README.md` has the human version.

## Map

| Want to… | Go to |
| --- | --- |
| Change the homepage | `site/data/projects.json` (content) · `site/index.html` (layout). Push to `main` → Vercel redeploys. |
| Add a redirect on outman.cc | `site/vercel.json` |
| Add a sub-project at `<name>.outman.cc` | `scripts/new-project.sh <name> <dir>` (needs `.env` loaded), then add an entry to `projects.json` |
| Share an HTML page with someone | `scripts/share.sh page.html` → `https://share.outman.cc/share/<id>`. Skill: `skills/share-page` |
| Change the share worker | `share/worker.js` · run `node share/test.mjs` · push to `main` → `.github/workflows/share.yml` deploys |
| Change share retention | `share/wrangler.toml` → `TTL_DAYS` (hard cap from creation, `0` = forever) |
| Archive rules | `share/archive.mjs` (`MAX_DAYS` 30, `MAX_MB` 500, `KEEP_DAYS` 90) · `.github/workflows/archive.yml` (Mon 03:00 UTC) |
| See what is currently stored | `curl -H "Authorization: Bearer $SHARE_TOKEN" https://share.outman.cc/share` |
| Archived pages | private repo `lincleejun/share-archive`, `YYYY-MM/<id>.html` + `index.jsonl` |

## Secrets

Local: `.env` (gitignored) holds `CF_API_TOKEN`, `CF_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `SHARE_TOKEN`, `ARCHIVE_TOKEN`.
Load with `set -a; source .env; set +a`. `scripts/share.sh` reads `SHARE_TOKEN` from `.env` on its own.
CI: the same four (minus `CF_ZONE_ID`) are GitHub Actions secrets on this repo. Vercel and wrangler are logged in via CLI OAuth on this machine.

## How deploys happen

- **Site**: Vercel Git integration, root directory `site`. Every push to `main` → production. No workflow file involved.
- **Worker**: `.github/workflows/share.yml` on push touching `share/**`. Runs the test, then `wrangler deploy`.
- **Archive**: `.github/workflows/archive.yml` in *this* repo. It checks out `share-archive` with `ARCHIVE_TOKEN`, runs `archive.mjs`, and pushes straight to that repo's `main` as `archive-bot`. No PR, no merge step. Manual run: `gh workflow run archive.yml -f max_days=0`.
- **DNS**: Cloudflare, records are DNS-only (proxy off) for anything on Vercel. `share.outman.cc` is created by wrangler as a custom domain.

## Rules

- Never write private hostnames into this repo (files, JSON, commits, this doc). They exist only in the Cloudflare dashboard.
- The site must not call GitHub or social APIs. No follower/repo counts, no social handles unless deliberately added to `projects.json`.
- Shared pages must be self-contained HTML. Share via `share.outman.cc`, never a third-party artifact host.
- Keep it small: static HTML, one worker, one script per flow. Add a build step only when a real need shows up.
