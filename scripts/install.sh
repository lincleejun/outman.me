#!/usr/bin/env bash
# Set up this machine to use the outman.cc infra. Idempotent. Does not touch cloud state.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v bun >/dev/null || { echo "need bun:  curl -fsSL https://bun.sh/install | bash"; exit 1; }
command -v gh  >/dev/null || { echo "need gh:   brew install gh && gh auth login"; exit 1; }
[ -f .env ] || { cp .env.example .env; echo "created .env → fill it (INSTALL.md → Secrets)"; }
mkdir -p ~/.claude/skills
ln -sfn "$PWD/skills/share-page" ~/.claude/skills/share-page && echo "skill: ~/.claude/skills/share-page → repo"
if ! grep -qs 'share-page' ~/.claude/CLAUDE.md; then { echo; cat skills/share-page/RULE.md; } >> ~/.claude/CLAUDE.md; echo "rule: appended skills/share-page/RULE.md to ~/.claude/CLAUDE.md"; fi
echo
echo "next:"
echo "  bunx vercel login                  # only if you will deploy the site from here"
echo "  (cd share && bunx wrangler login)  # only if you will deploy the worker from here"
echo "  scripts/doctor.sh                  # verify everything"
