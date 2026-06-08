export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const cf = request.cf || {};
      return Response.json({
        status: "ok",
        edge: {
          colo:    cf.colo    || "unknown",
          country: cf.country || "unknown",
          city:    cf.city    || "unknown",
        },
        timestamp: new Date().toISOString(),
      });
    }

    return env.ASSETS.fetch(request);
  },
};