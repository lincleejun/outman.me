#!/usr/bin/env bash
# Set up this machine to use the outman.cc infra. Idempotent. Does not touch cloud state.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v bun >/dev/null || { echo "need bun:  curl -fsSL https://bun.sh/install | bash"; exit 1; }
command -v gh  >/dev/null || { echo "need gh:   brew install gh && gh auth login"; exit 1; }
[ -f .env ] || { cp .env.example .env; echo "created .env → fill it (INSTALL.md → Secrets)"; }
mkdir -p ~/.claude/skills
ln -sfn "$PWD/skills/share-page" ~/.claude/skills/share-page && echo "skill: ~/.claude/skills/share-page → repo"
if ! grep -qs 'share-page' ~/.claude/CLAUDE.md; then cat >> ~/.claude/CLAUDE.md <<'RULE'

# Sharing pages
When an HTML page (report, diff, mockup, chart) is meant for someone else to open, publish it with the `share-page` skill (`~/workspace/personal/outman.me/scripts/share.sh`) and give the `share.outman.cc` link. Do not use the Artifact tool or any third-party host for that.
RULE
echo "rule: appended to ~/.claude/CLAUDE.md"; fi
echo
echo "next:"
echo "  bunx vercel login                  # only if you will deploy the site from here"
echo "  (cd share && bunx wrangler login)  # only if you will deploy the worker from here"
echo "  scripts/doctor.sh                  # verify everything"
