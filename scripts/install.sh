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

# 3. hooks → ~/.claude/settings.json: any skills/*/hook.json is a PreToolUse entry, added once (matched by its command)
for h in skills/*/hook.json; do
  [ -f "$h" ] || continue
  python3 - "$h" <<'PY'
import json,os,sys
entry=json.load(open(sys.argv[1])); cmd=entry['hooks'][0]['command']
p=os.path.expanduser('~/.claude/settings.json'); s=json.load(open(p)) if os.path.exists(p) else {}
pre=s.setdefault('hooks',{}).setdefault('PreToolUse',[])
if any(h.get('command')==cmd for e in pre for h in e.get('hooks',[])): print(f"hook: {cmd} already registered"); sys.exit()
pre.append(entry); json.dump(s,open(p,'w'),indent=2,ensure_ascii=False); open(p,'a').write('\n')
print(f"hook: {cmd} registered in ~/.claude/settings.json (restart Claude Code to load it)")
PY
done

# No keys on this machine: the skills authenticate with your gh login, the infra secrets live in GitHub Actions.
echo; echo "verify: scripts/doctor.sh"
