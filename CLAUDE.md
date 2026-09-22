# outman.me — agent notes

This repo is the infra for **outman.cc**. Read this first; `README.md` has the human version.

## Map

| Want to… | Go to |
| --- | --- |
| Change the homepage | `site/data/projects.json` (content) · `site/index.html` (layout). Push to `main` → Vercel redeploys. |
| Add a redirect on outman.cc | `site/vercel.json` |
| Add a sub-project at `<name>.outman.cc` | `scripts/new-project.sh <name> <dir>` (needs `bunx vercel login` + `gh` login; the CNAME is made by `.github/workflows/dns.yml`), then add an entry to `projects.json` |
| Share an HTML page with someone | `skills/share-page/share publish page.html` → `https://share.outman.cc/share/<id>`. Skill dir is the source of truth; machines run `scripts/install.sh` to get a copy. one CLI `share publish|list|get|grep|sync`, `RULE.md` |
| Read a web page's full text (never WebFetch, it summarises) | `skills/fetch-page/fetch <url>` → markdown on stdout, html+md kept in `~/.cache/outman/fetch/`. `--all` for whole body. `guard.sh` + `hook.json` block WebFetch (PreToolUse); `install.sh` registers it. |
| Change the share worker | `share/worker.js` · run `node share/test.mjs` · push to `main` → `.github/workflows/share.yml` deploys |
| Change share retention | `share/wrangler.toml` → `TTL_DAYS` (hard cap from creation, `0` = forever) |
| Archive rules | `share/archive.mjs` (`MAX_DAYS` 30, `MAX_MB` 500, `KEEP_DAYS` 90) · `.github/workflows/archive.yml` (Mon 03:00 UTC) |
| Change who may publish / list / delete shares | `share/wrangler.toml` → `SHARE_OWNER` (a GitHub login). The worker verifies the bearer token against `api.github.com/user`; there is no shared secret |
| See what is currently stored | `share list`, or `curl -H "Authorization: Bearer $(gh auth token)" https://share.outman.cc/share` |
| Archived pages | private repo `lincleejun/share-archive`, `YYYY-MM/<id>.html` + `index.jsonl` |
| Check that everything works / find what broke | `scripts/doctor.sh` — every FAIL prints a `fix:` line. Same script runs daily on GitHub (`.github/workflows/health.yml`) |
| Set up a new machine / rebuild from zero | `INSTALL.md` · `scripts/install.sh` |
| Update skills/rules on a machine after changing them here | push, then on that machine `git pull && scripts/install.sh` (copies, replaces the rule block) |

## Secrets

None on any machine. The four GitHub Actions secrets on this repo (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ZONE_ID`, `ARCHIVE_TOKEN`) are the only copies; anything that needs one runs as a workflow (`share.yml`, `dns.yml`, `archive.yml`, `health.yml`).
A machine holds only CLI logins: `gh` (the `share` CLI sends `gh auth token`; the worker accepts tokens of `SHARE_OWNER`), plus Vercel / wrangler OAuth only where sub-projects are created or the worker is deployed by hand.
Never introduce a `.env` or a key file; if a new flow needs a key, give it a workflow and a GitHub secret.

## How deploys happen

- **Site**: Vercel Git integration, root directory `site`. Every push to `main` → production. No workflow file involved.
- **Worker**: `.github/workflows/share.yml` on push touching `share/**`. Runs the test, then `wrangler deploy`.
- **Archive**: `.github/workflows/archive.yml` in *this* repo. It checks out `share-archive` with `ARCHIVE_TOKEN`, runs `archive.mjs`, and pushes straight to that repo's `main` as `archive-bot`. No PR, no merge step. Manual run: `gh workflow run archive.yml -f max_days=0`.
- **DNS**: Cloudflare, records are DNS-only (proxy off) for anything on Vercel. `share.outman.cc` is created by wrangler as a custom domain.

## Slogan

**event in, context out.** Everything is built as harness/infra: an event (push, cron, curl) goes in, a deployed and checked result comes out. Keep new work in that shape: one script per flow, a check for every flow.

## Rules

- Never write private hostnames into this repo (files, JSON, commits, this doc). They exist only in the Cloudflare dashboard.
- The site must not call GitHub or social APIs. No follower/repo counts, no social handles unless deliberately added to `projects.json`.
- Shared pages must be self-contained HTML. Share via `share.outman.cc`, never a third-party artifact host.
- Keep it small: static HTML, one worker, one script per flow. Add a build step only when a real need shows up.
