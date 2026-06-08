const MAX_UPLOADS_PER_MIN = 5;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cf  = request.cf || {};

    if (url.pathname === "/api/health" && request.method === "GET") {
      return Response.json({
        status: "ok",
        edge: { colo: cf.colo, country: cf.country, city: cf.city },
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT COUNT(*) AS total_posts, COUNT(DISTINCT country) AS total_countries FROM posts"
      ).all();
      return Response.json(results[0]);
    }

    if (url.pathname === "/api/posts" && request.method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT id, photo_key, caption, author,
               colo, city, country, r2_ms, ai_ms, cached, created_at
        FROM posts ORDER BY created_at DESC LIMIT 50
      `).all();
      return Response.json({ posts: results });
    }

    if (url.pathname === "/api/posts" && request.method === "POST") {
      const ip    = request.headers.get("CF-Connecting-IP") || "anon";
      const rlKey = `rl:${ip}`;
      const count = parseInt((await env.RATE_LIMIT.get(rlKey)) || "0", 10);
      if (count >= MAX_UPLOADS_PER_MIN) {
        return Response.json({ error: "Rate limit exceeded." }, { status: 429 });
      }

      const form   = await request.formData();
      const file   = form.get("photo");
      const author = (form.get("author") || "Guest").toString().slice(0, 40);
      if (!file || typeof file === "string") {
        return Response.json({ error: "photo file is required" }, { status: 400 });
      }

      const bytes    = await file.arrayBuffer();
      const id       = crypto.randomUUID();
      const ext      = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const photoKey = `photos/${id}.${ext}`;
      const r2Start  = Date.now();
      await env.PHOTOS.put(photoKey, bytes, { httpMetadata: { contentType: file.type } });
      const r2Ms = Date.now() - r2Start;

      await env.DB.prepare(`
        INSERT INTO posts (id, photo_key, caption, author, colo, city, country, r2_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, photoKey, "", author, cf.colo||"", cf.city||"", cf.country||"", r2Ms).run();

      await env.RATE_LIMIT.put(rlKey, String(count + 1), { expirationTtl: 60 });

      return Response.json({
        id, photo_key: photoKey, author,
        meta: { colo: cf.colo||"", city: cf.city||"", country: cf.country||"", r2_ms: r2Ms },
      });
    }

    if (url.pathname.startsWith("/api/photo/")) {
      const key = decodeURIComponent(url.pathname.replace("/api/photo/", ""));
      const obj = await env.PHOTOS.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "Content-Type":  obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
