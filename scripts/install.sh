#!/usr/bin/env bash
# Install (or update) this repo's Claude skills and rules on this machine. Copies, never links:
# the repo is the source of truth, this machine gets a snapshot. Re-run after `git pull` to update.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null || { echo "need gh:  brew install gh && gh auth login"; exit 1; }

# 1. skills → ~/.claude/skills/<name> (replace whole dir)
for d in skills/*/; do n=$(basename "$d"); rm -rf ~/.claude/skills/"$n"; mkdir -p ~/.claude/skills; cp -R "$d" ~/.claude/skills/"$n"; echo "skill: $n installed"; done

# 2. rules → ~/.claude/CLAUDE.md, between markers so re-install replaces the block
for r in skills/*/RULE.md; do
  tag=$(sed -n 's/<!-- \(outman:[^:]*\):start -->/\1/p' "$r")
  python3 - "$r" "$tag" <<'PY'
import os,re,sys
rule=open(sys.argv[1]).read().strip(); tag=re.escape(sys.argv[2])
p=os.path.expanduser('~/.claude/CLAUDE.md'); s=open(p).read() if os.path.exists(p) else ''
new,n=re.subn(rf'<!-- {tag}:start -->.*?<!-- {tag}:end -->',rule,s,flags=re.S)
if n==0: new=s.rstrip()+'\n\n'+rule+'\n'
open(p,'w').write(new); print(f"rule: {sys.argv[2]} {'updated' if n else 'added'} in ~/.claude/CLAUDE.md")
PY
done

# 3. per-user config for the skills (token only; infra secrets stay in the repo .env)
cfg="${XDG_CONFIG_HOME:-$HOME/.config}/outman/env"; mkdir -p "$(dirname "$cfg")"
if [ -f .env ] && grep -q '^SHARE_TOKEN=.' .env; then grep '^SHARE_TOKEN=' .env > "$cfg"; chmod 600 "$cfg"; echo "config: $cfg written from .env"
elif [ ! -f "$cfg" ]; then echo 'SHARE_TOKEN=' > "$cfg"; chmod 600 "$cfg"; echo "config: $cfg created — fill SHARE_TOKEN"; fi

[ -f .env ] || { cp .env.example .env; echo ".env created from example — only needed on machines that run infra scripts"; }
echo; echo "verify: scripts/doctor.sh"
