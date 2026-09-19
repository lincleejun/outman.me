---
name: share-page
description: Publish an HTML page (report, diff, mockup, chart) to share.outman.cc and hand back the link; look up pages shared earlier. Use whenever a page is meant for someone else to open, or when asked what was shared before — never publish to a third-party artifact host.
---

# share-page

Self-contained: everything it needs is in this directory. Paths below are relative to the
skill directory shown as "Base directory for this skill" — run them from there, or prefix it.

## Use when

- Any HTML page is meant for someone else to open: report, diff, mockup, chart, dashboard, prototype.
- The user says "share", "send them", "give me a link", "publish this", or asks for something viewable.
- The user asks what was shared before, wants to find an old page, or needs history from past work.

Never use the Artifact tool or any third-party host for pages meant for others. Same rule lives
in `RULE.md`, which `install.sh` appends to the global `~/.claude/CLAUDE.md`; keep the two in sync.

## Publish

1. Write a **self-contained** page: inline CSS, inline SVG, data-URI images. External scripts only from cdnjs / jsdelivr. Give it a `<title>` — that is what shows up in history.
2. Run `./share.sh page.html` (optional second arg overrides the title).
3. Reply with the printed `https://share.outman.cc/share/<id>` link. Say it expires 90 days after publishing.

The script reads `SHARE_TOKEN` from the shell, else from `<repo>/.env` (two levels up). If it errors
with "no SHARE_TOKEN", the machine is not set up: see `INSTALL.md` at the repo root.

## History

- `./history.sh` — everything, newest live pages first, then archived. `./history.sh <pattern>` filters by title, id, or date (`2026-08`).
- Live pages (≤90 days) are read straight from the share service. Archived pages live in the private
  repo `lincleejun/share-archive` as `YYYY-MM/<id>.html`, indexed by `index.jsonl`. Pages older than
  30 days are moved there weekly; archived files past 90 days are pruned from the tree but remain in git history.
- Fetch an archived page: `./history.sh --get 2026-09/<id>.html > page.html`. Re-share it with `./share.sh page.html` if a link is needed again.
- Needs `gh` logged in as the repo owner. Older than the pruning window: `git log` in a clone of `share-archive`.
