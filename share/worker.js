// share.outman.cc — POST an HTML page, get a public link. Cloudflare Worker + KV.
// Links expire after one idle day; every view re-arms the clock. Ids are content hashes.
const TTL = 86400;
const MAX = 4 << 20;

async function hashId(buf) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/share(?:\/([0-9a-f]{16}))?$/);
    if (!m) return env.ASSETS.fetch(req);

    if (req.method === "POST" && !m[1]) {
      if (env.SHARE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.SHARE_TOKEN}`)
        return new Response("unauthorized", { status: 401 });
      const body = await req.arrayBuffer();
      if (!body.byteLength || body.byteLength > MAX) return new Response("empty or >4MB", { status: 413 });
      const id = await hashId(body);
      await env.SHARES.put(id, body, { expirationTtl: TTL });
      return Response.json({ id, url: `${url.origin}/share/${id}` });
    }

    if (req.method === "GET" && m[1]) {
      const html = await env.SHARES.get(m[1], "arrayBuffer");
      if (!html) return new Response("expired", { status: 410 });
      ctx.waitUntil(env.SHARES.put(m[1], html, { expirationTtl: TTL }));
      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
        },
      });
    }
    return new Response("method not allowed", { status: 405 });
  },
};
