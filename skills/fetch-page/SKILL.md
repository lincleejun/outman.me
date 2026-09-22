---
name: fetch-page
description: Read a web page's full text (blog post, docs, article, README) as markdown via curl + pandoc, with no summarising model in between. Use whenever a URL needs to be read, quoted, translated or analysed — instead of the WebFetch tool, which returns a lossy rewrite.
---

# fetch-page

One CLI, `./fetch`, in this directory. Run it from the "Base directory for this skill" shown when
the skill loads (or prefix that path). Source of truth is `skills/fetch-page/` in the `outman.me`
repo; this directory is an installed copy — edit in the repo, push, then `git pull && scripts/install.sh`
on each machine. Never edit the copy.

## Use when

- Any URL has to be read: "explain this post", "what does this doc say", "translate this page", "compare with the article".
- You are about to call WebFetch. Don't: it hands you a small model's summary and drops specifics
  (numbers, quotes, examples, config snippets). A PreToolUse hook (`guard.sh`) blocks it and repeats this.

## Commands

| Command | Does |
| --- | --- |
| `./fetch <url>` | Main content (`<article>` / `<main>`, else body) → markdown on stdout. Saves `<stamp>-<slug>.html` and `.md` under `~/.cache/outman/fetch/`; the path is on stderr. |
| `./fetch <url> --all` | Whole `<body>`, no main-content pick. Use when a section seems missing. |
| `./fetch <url> --html` | Raw html only. |

Read the printed markdown in full before answering; it is the article. Quote from it, don't paraphrase from memory.
Grep the saved `.md` to verify a detail later.

## When it can't

- **JS-rendered / bot-blocked**: stderr warns "near-empty text from a large page". Load it with the agent-browser skill instead.
- **PDF**: saved as `.pdf`, path printed. Open it with the Read tool.
- **Login-walled**: use the authenticated tool for that service (lark-doc, bytedance-cloud-docs, gh …).
