#!/usr/bin/env bash
# fetch-page guard (PreToolUse / WebFetch) — WebFetch hands the agent a small-model rewrite of the page,
# not the page. Block it and point at the `fetch` CLI, which returns the full text.
# Registered in ~/.claude/settings.json by scripts/install.sh (outman.me repo). Exit 2 = block, stderr → agent.
input=$(cat)
url=$(printf '%s' "$input" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
here=$(cd "$(dirname "$0")" && pwd)
{
  echo "BLOCKED by fetch-page guard: WebFetch summarises the page with a small model and drops details."
  echo "Get the full text instead (Bash):  $here/fetch '${url:-<url>}'"
  echo "It prints markdown and keeps html+md under ~/.cache/outman/fetch/. Add --all if content looks cut off;"
  echo "if it warns the page is JS-rendered, use the agent-browser skill."
} >&2
exit 2
