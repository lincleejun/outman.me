// node share/test.mjs — one check that fails if the worker logic breaks.
import assert from "node:assert/strict";
import worker from "./worker.js";

const kv = new Map();
const env = {
  SHARES: {
    put: async (k, v, o = {}) => kv.set(k, { v, m: o.metadata }),
    getWithMetadata: async (k) => ({ value: kv.get(k)?.v ?? null, metadata: kv.get(k)?.m ?? null }),
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
