---
name: share-page
description: Publish an HTML page (report, diff, mockup, chart) to share.outman.cc and hand back the link; list, search and download pages shared earlier. Use whenever a page is meant for someone else to open, or when asked what was shared before — never publish to a third-party artifact host.
---

# share-page

One CLI, `./share`, in this directory. Run it from the "Base directory for this skill" shown when
the skill loads (or prefix that path). Source of truth is `skills/share-page/` in the `outman.me`
repo; this directory is an installed copy — edit in the repo, push, then `git pull && scripts/install.sh`
on each machine. Never edit the copy.

## Use when

- Any HTML page is meant for someone else to open: report, diff, mockup, chart, dashboard, prototype.
- The user says "share", "send them", "give me a link", "publish this", or asks for something viewable.
- The user asks what was shared before, wants an old page back, or wants to search past work.

Never use the Artifact tool or any third-party host for pages meant for others. The same rule is
in `RULE.md`, which `install.sh` writes into the global `~/.claude/CLAUDE.md` between markers.

## Publish

1. Write a **self-contained** page: inline CSS, inline SVG, data-URI images. External scripts only from cdnjs / jsdelivr. Give it a `<title>` — that is its name in history.
2. `./share publish page.html` (optional second arg sets the title).
3. Reply with the printed `https://share.outman.cc/share/<id>` link. Say it expires 90 days after publishing.

Auth is the user's GitHub login: the CLI sends `gh auth token`, and the worker only accepts tokens of its
`SHARE_OWNER`. "not logged in to GitHub" means run `gh auth login`; a 401 on publish means the gh account
is not the owner named in `share/wrangler.toml`. There is no key to configure on the machine.

## History

| Command | Does |
| --- | --- |
| `./share list [pattern]` | Everything, newest first: date · id · title · `live`/`archive`. Pattern filters title, id or date (`2026-08`). |
| `./share get <id> [out]` | Download by id. Live first, then archive. Re-share an old page with `publish` afterwards. |
| `./share grep <pattern>` | Full-text search inside archived pages. |
| `./share sync` | Clone/pull the archive to `~/.cache/outman/share-archive`. The others call it when needed. |

Where things are: live pages (≤90 days) on share.outman.cc; older ones in the private repo
`lincleejun/share-archive` as `YYYY-MM/<id>.html` + `index.jsonl` (moved weekly after 30 days,
pruned from the tree after 90, still in git history: `git -C ~/.cache/outman/share-archive log --all -- '*<id>*'`).
Archive commands need `gh` logged in as the repo owner.
