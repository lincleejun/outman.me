// node share/test.mjs — one check that fails if the worker logic breaks.
import assert from "node:assert/strict";
import worker from "./worker.js";

const kv = new Map();
const env = {
  SHARE_OWNER: "owner",
  SHARES: {
    put: async (k, v, o = {}) => kv.set(k, { v, m: o.metadata }),
    get: async (k) => kv.get(k)?.v ?? null,
    delete: async (k) => kv.delete(k),
    list: async () => ({ keys: [...kv].map(([name, { m }]) => ({ name, metadata: m })) }),
  },
  ASSETS: { fetch: async () => new Response("landing") },
};
const ctx = { waitUntil() {} };
// fake api.github.com: one token belongs to the owner, one to someone else
const OWNER_TOKEN = "gho_" + "a".repeat(36), OTHER_TOKEN = "ghp_" + "b".repeat(36);
let ghCalls = 0;
globalThis.fetch = async (url, init = {}) => {
  assert.equal(String(url), "https://api.github.com/user");
  assert.ok(init.headers["user-agent"], "GitHub rejects requests without a User-Agent");
  ghCalls++;
  const t = init.headers.authorization.replace("Bearer ", "");
  if (t === OWNER_TOKEN) return Response.json({ login: "owner" });
  if (t === OTHER_TOKEN) return Response.json({ login: "other" });
  return new Response("bad credentials", { status: 401 });
};
const auth = { authorization: `Bearer ${OWNER_TOKEN}` };
const post = (body, headers = auth, q = "") => new Request("https://share.test/share" + q, { method: "POST", body, headers });

const html = "<html><head><title>Q3 report</title></head><h1>hi</h1></html>";
const { id, url } = await (await worker.fetch(post(html), env, ctx)).json();
assert.equal(url, `https://share.test/share/${id}`);
assert.equal(kv.get(id).m.title, "Q3 report");
assert.equal(await (await worker.fetch(new Request(url), env, ctx)).text(), html);
assert.equal((await worker.fetch(new Request("https://share.test/share/0000000000000000"), env, ctx)).status, 410);
assert.equal((await worker.fetch(post(""), env, ctx)).status, 413);
assert.equal(await (await worker.fetch(new Request("https://share.test/"), env, ctx)).text(), "landing");

// not the owner: no token, garbage (never forwarded to GitHub), someone else's token, no SHARE_OWNER configured
const before = ghCalls;
assert.equal((await worker.fetch(post(html, {}), env, ctx)).status, 401);
assert.equal((await worker.fetch(post(html, { authorization: "Bearer not-a-github-token" }), env, ctx)).status, 401);
assert.equal(ghCalls, before, "malformed tokens must not reach GitHub");
assert.equal((await worker.fetch(post(html, { authorization: `Bearer ${OTHER_TOKEN}` }), env, ctx)).status, 401);
assert.equal((await worker.fetch(post(html), { ...env, SHARE_OWNER: "" }, ctx)).status, 401);
// list/delete are hidden from anyone but the owner
assert.equal((await worker.fetch(new Request("https://share.test/share"), env, ctx)).status, 404);
assert.equal((await worker.fetch(new Request(url, { method: "DELETE", headers: { authorization: `Bearer ${OTHER_TOKEN}` } }), env, ctx)).status, 404);
assert.equal(await (await worker.fetch(new Request(url), env, ctx)).text(), html, "a stranger's DELETE must not remove the page");

assert.equal((await worker.fetch(post("<p>x</p>", auth, "?title=custom"), env, ctx)).status, 200);
const list = await (await worker.fetch(new Request("https://share.test/share", { headers: auth }), env, ctx)).json();
assert.equal(list.count, 2);
assert.ok(list.items.some((i) => i.title === "custom"));
assert.equal((await worker.fetch(new Request(url, { method: "DELETE", headers: auth }), env, ctx)).status, 204);
assert.equal((await worker.fetch(new Request(url), env, ctx)).status, 410);
console.log("ok");

// archive selection rule
const { select } = await import("./archive.mjs");
const now = Date.parse("2026-09-19T00:00:00Z");
const day = (n) => new Date(now - n * 86400e3).toISOString();
const items = [
  { id: "a", at: day(40), bytes: 1 },
  { id: "b", at: day(10), bytes: 3 * 1048576 },
  { id: "c", at: day(5), bytes: 3 * 1048576 },
  { id: "d", at: day(1), bytes: 3 * 1048576 },
];
assert.deepEqual(select(items, { maxDays: 30, maxMB: 100, now }).map((i) => i.id), ["a"]);
assert.deepEqual(select(items, { maxDays: 30, maxMB: 7, now }).map((i) => i.id), ["a", "b"]);
assert.deepEqual(select(items, { maxDays: 30, maxMB: 0.5, now }).map((i) => i.id), ["a", "b", "c", "d"]);

// prune: files past KEEP_DAYS leave the tree and the index
const { prune } = await import("./archive.mjs");
const { mkdtemp, writeFile: wf, readFile: rf, stat } = await import("node:fs/promises");
const tmp = await mkdtemp("/tmp/arch-");
await wf(`${tmp}/old.html`, "x"); await wf(`${tmp}/new.html`, "y");
await wf(`${tmp}/index.jsonl`, [{ id: "o", at: day(100), file: "old.html" }, { id: "n", at: day(3), file: "new.html" }].map((e) => JSON.stringify(e)).join("\n") + "\n");
assert.equal(await prune(tmp, 90, now), 1);
assert.equal(await stat(`${tmp}/old.html`).catch(() => null), null);
assert.ok(await stat(`${tmp}/new.html`));
assert.equal((await rf(`${tmp}/index.jsonl`, "utf8")).trim().split("\n").length, 1);
console.log("ok archive");
