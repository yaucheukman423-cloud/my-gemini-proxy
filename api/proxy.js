export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const parsedUrl = new URL(req.url, "http://localhost");
    let path = parsedUrl.searchParams.get("__path");
    if (path) {
      parsedUrl.searchParams.delete("__path");
    } else {
      path = req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"] || parsedUrl.pathname;
    }
    path = String(path || "").replace(/^\/+/, "");
    if (path === "api/proxy") path = "";
    const targetUrl = "https://generativelanguage.googleapis.com/" + path + parsedUrl.search;

    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (["host", "connection", "content-length", "transfer-encoding", "x-forwarded-for"].includes(lower)) continue;
      forwardHeaders[key] = value;
    }
    forwardHeaders["host"] = "generativelanguage.googleapis.com";

    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();
      if (["content-encoding", "content-length", "transfer-encoding", "connection"].includes(lower)) continue;
      res.setHeader(key, value);
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.statusCode = upstream.status;

    if (!upstream.body) return res.end();
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.statusCode = 502;
      res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }));
    } else {
      res.end();
    }
  }
}
