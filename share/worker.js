// share.outman.cc — POST an HTML page, get a public link. Cloudflare Worker + KV.
// Hard retention: a page is deleted TTL_DAYS after creation, viewed or not (0 = keep forever). Ids are content hashes.
const MAX = 4 << 20;

async function hashId(buf) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const ttlOpts = (env) => {
  const days = Number(env.TTL_DAYS ?? 90);
  return days > 0 ? { expirationTtl: days * 86400 } : {};
};
const authed = (req, env) => env.SHARE_TOKEN && req.headers.get("authorization") === `Bearer ${env.SHARE_TOKEN}`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/share(?:\/([0-9a-f]{16}))?$/);
    if (!m) return env.ASSETS.fetch(req);

    if (req.method === "POST" && !m[1]) {
      if (env.SHARE_TOKEN && !authed(req, env)) return new Response("unauthorized", { status: 401 });
      const body = await req.arrayBuffer();
      if (!body.byteLength || body.byteLength > MAX) return new Response("empty or >4MB", { status: 413 });
      const id = await hashId(body);
      const title = url.searchParams.get("title")
        || new TextDecoder().decode(body.slice(0, 4096)).match(/<title>([^<]*)</i)?.[1].trim()
        || "";
      const metadata = { title, at: new Date().toISOString(), bytes: body.byteLength };
      await env.SHARES.put(id, body, { ...ttlOpts(env), metadata });
      return Response.json({ id, url: `${url.origin}/share/${id}` });
    }

    // Audit list: only with a token. Newest first.
    if (req.method === "GET" && !m[1]) {
      if (!authed(req, env)) return new Response("not found", { status: 404 });
      const { keys } = await env.SHARES.list({ limit: 1000 });
      const items = keys
        .map((k) => ({ id: k.name, url: `${url.origin}/share/${k.name}`, ...k.metadata }))
        .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
      return Response.json({ count: items.length, items });
    }

    if (req.method === "GET" && m[1]) {
      const value = await env.SHARES.get(m[1], "arrayBuffer");
      if (!value) return new Response("expired", { status: 410 });
      return new Response(value, {
        headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
      });
    }

    if (req.method === "DELETE" && m[1]) {
      if (!authed(req, env)) return new Response("not found", { status: 404 });
      await env.SHARES.delete(m[1]);
      return new Response(null, { status: 204 });
    }
    return new Response("method not allowed", { status: 405 });
  },
};
