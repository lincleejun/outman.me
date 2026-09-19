// node share/test.mjs — one check that fails if the worker logic breaks.
import assert from "node:assert/strict";
import worker from "./worker.js";

const kv = new Map();
const env = {
  SHARES: {
    put: async (k, v, o = {}) => kv.set(k, { v, m: o.metadata }),
    get: async (k) => kv.get(k)?.v ?? null,
    delete: async (k) => kv.delete(k),
    list: async () => ({ keys: [...kv].map(([name, { m }]) => ({ name, metadata: m })) }),
  },
  ASSETS: { fetch: async () => new Response("landing") },
};
const ctx = { waitUntil() {} };
const post = (body, headers = {}, q = "") => new Request("https://share.test/share" + q, { method: "POST", body, headers });

const html = "<html><head><title>Q3 report</title></head><h1>hi</h1></html>";
const { id, url } = await (await worker.fetch(post(html), env, ctx)).json();
assert.equal(url, `https://share.test/share/${id}`);
assert.equal(kv.get(id).m.title, "Q3 report");
assert.equal(await (await worker.fetch(new Request(url), env, ctx)).text(), html);
assert.equal((await worker.fetch(new Request("https://share.test/share/0000000000000000"), env, ctx)).status, 410);
assert.equal((await worker.fetch(post(""), env, ctx)).status, 413);
assert.equal(await (await worker.fetch(new Request("https://share.test/"), env, ctx)).text(), "landing");
// list/delete are hidden without a token
assert.equal((await worker.fetch(new Request("https://share.test/share"), env, ctx)).status, 404);

const locked = { ...env, SHARE_TOKEN: "s3cret" };
const auth = { authorization: "Bearer s3cret" };
assert.equal((await worker.fetch(post(html), locked, ctx)).status, 401);
assert.equal((await worker.fetch(post("<p>x</p>", auth, "?title=custom"), locked, ctx)).status, 200);
const list = await (await worker.fetch(new Request("https://share.test/share", { headers: auth }), locked, ctx)).json();
assert.equal(list.count, 2);
assert.ok(list.items.some((i) => i.title === "custom"));
assert.equal((await worker.fetch(new Request(url, { method: "DELETE", headers: auth }), locked, ctx)).status, 204);
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
