// Archive share pages to disk, then delete them from KV.
// Rule: anything older than MAX_DAYS, plus the oldest until the rest fits in MAX_MB.
// Then prune archived files older than KEEP_DAYS from the archive tree (git history still has them).
// usage: SHARE_TOKEN=… node share/archive.mjs [dir=./archive]
import { mkdir, writeFile, appendFile, access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const num = (v, d) => (v === undefined || v === "" ? d : +v);

export function select(items, { maxDays = 30, maxMB = 500, now = Date.now() } = {}) {
  const old = items.filter((i) => now - Date.parse(i.at) > maxDays * 86400e3);
  const rest = items.filter((i) => !old.includes(i)).sort((a, b) => a.at.localeCompare(b.at));
  let total = rest.reduce((s, i) => s + (i.bytes || 0), 0);
  while (total > maxMB * 1048576 && rest.length) total -= rest.shift().bytes || 0;
  return [...old, ...items.filter((i) => !old.includes(i) && !rest.includes(i))];
}

async function main(dir = process.argv[2] || "./archive") {
  const base = process.env.SHARE_URL || "https://share.outman.cc";
  const headers = { authorization: `Bearer ${process.env.SHARE_TOKEN}` };
  const { items } = await (await fetch(`${base}/share`, { headers })).json();
  const picked = select(items, { maxDays: num(process.env.MAX_DAYS, 30), maxMB: num(process.env.MAX_MB, 500) });
  for (const it of picked) {
    const sub = join(dir, it.at.slice(0, 7));
    const file = join(sub, `${it.id}.html`);
    await mkdir(sub, { recursive: true });
    if (!(await access(file).then(() => true, () => false))) {
      const r = await fetch(it.url);
      if (!r.ok) { console.warn(`skip ${it.id}: ${r.status}`); continue; }
      await writeFile(file, Buffer.from(await r.arrayBuffer()));
      await appendFile(join(dir, "index.jsonl"), JSON.stringify({ ...it, file: file.slice(dir.length + 1), archivedAt: new Date().toISOString() }) + "\n");
    }
    await fetch(it.url, { method: "DELETE", headers });
    console.log(`archived ${it.id}  ${it.title || ""}`);
  }
  console.log(`${picked.length}/${items.length} archived`);
  await prune(dir, num(process.env.KEEP_DAYS, 90));
}

export async function prune(dir, keepDays, now = Date.now()) {
  const idx = join(dir, "index.jsonl");
  const lines = await readFile(idx, "utf8").then((t) => t.trim().split("\n").filter(Boolean), () => []);
  const keep = [];
  for (const l of lines) {
    const e = JSON.parse(l);
    if (now - Date.parse(e.at) > keepDays * 86400e3) { await rm(join(dir, e.file), { force: true }); console.log(`pruned ${e.id}`); }
    else keep.push(l);
  }
  if (keep.length !== lines.length) await writeFile(idx, keep.map((l) => l + "\n").join(""));
  return lines.length - keep.length;
}
if (process.argv[1] === new URL(import.meta.url).pathname) main();
