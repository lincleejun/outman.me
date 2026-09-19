// node share/test.mjs — one check that fails if the worker logic breaks.
import assert from "node:assert/strict";
import worker from "./worker.js";

const kv = new Map();
const env = {
  SHARES: { put: async (k, v) => kv.set(k, v), get: async (k) => kv.get(k) ?? null },
  ASSETS: { fetch: async () => new Response("landing") },
};
const ctx = { waitUntil() {} };
const post = (body, headers = {}) => new Request("https://share.test/share", { method: "POST", body, headers });

const html = "<h1>hi</h1>";
const { id, url } = await (await worker.fetch(post(html), env, ctx)).json();
assert.equal(url, `https://share.test/share/${id}`);
assert.equal(await (await worker.fetch(new Request(url), env, ctx)).text(), html);
assert.equal((await worker.fetch(new Request("https://share.test/share/0000000000000000"), env, ctx)).status, 410);
assert.equal((await worker.fetch(post(""), env, ctx)).status, 413);
assert.equal(await (await worker.fetch(new Request("https://share.test/"), env, ctx)).text(), "landing");

const locked = { ...env, SHARE_TOKEN: "s3cret" };
assert.equal((await worker.fetch(post(html), locked, ctx)).status, 401);
assert.equal((await worker.fetch(post(html, { authorization: "Bearer s3cret" }), locked, ctx)).status, 200);
console.log("ok");
