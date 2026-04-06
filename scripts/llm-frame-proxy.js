#!/usr/bin/env node
/**
 * Local proxy that strips X-Frame-Options and CSP frame-ancestors
 * so blocked pages can load inside an iframe.
 *
 * Usage: node scripts/llm-frame-proxy.js [port]
 * Default port: 3111
 *
 * Then in ShELF settings, set LLM Console URL to:
 *   http://localhost:3111/proxy/<encoded-target-url>
 *
 * Example for https://example.com:
 *   http://localhost:3111/proxy/https%3A%2F%2Fexample.com%2F
 */

const http = require("http");
const https = require("https");
const url = require("url");

const PORT = parseInt(process.argv[2] || "3111", 10);
const PROXY_PATH_PREFIX = "/proxy/";

const BLOCKED_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "frame-ancestors",
  "x-content-type-options",
];

function stripFrameBlockingHeaders(headers) {
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    if (BLOCKED_HEADERS.some((b) => key.toLowerCase().includes(b))) {
      if (key.toLowerCase() === "content-security-policy") {
        const v = out[key];
        if (v && /frame-ancestors/i.test(v)) {
          const rewritten = v.replace(/frame-ancestors[^;]*;?/gi, "");
          if (rewritten.trim()) out[key] = rewritten.trim();
          else delete out[key];
        }
      } else {
        delete out[key];
      }
    }
  }
  delete out["x-frame-options"];
  delete out["X-Frame-Options"];
  return out;
}

function fetchTarget(targetUrl, res) {
  const parsed = url.parse(targetUrl);
  const isHttps = parsed.protocol === "https:";
  const lib = isHttps ? https : http;

  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.path || "/",
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ShELF-Frame-Proxy/1.0)",
      Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
    },
  };

  const req = lib.request(opts, (targetRes) => {
    const safeHeaders = stripFrameBlockingHeaders(targetRes.headers);
    res.writeHead(targetRes.statusCode || 200, safeHeaders);
    targetRes.pipe(res);
  });

  req.on("error", (err) => {
    console.error("[proxy] fetch error:", err.message);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Proxy error: ${err.message}`);
  });
  req.end();
}

function extractTargetFromPath(pathname) {
  if (!pathname.startsWith(PROXY_PATH_PREFIX)) return null;
  const rest = pathname.slice(PROXY_PATH_PREFIX.length).replace(/^\/+/, "");
  const segments = rest.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const encodedBase = segments[0];
  const pathSuffix = segments.length > 1 ? "/" + segments.slice(1).join("/") : null;
  try {
    const base = decodeURIComponent(encodedBase);
    if (base.startsWith("http://") || base.startsWith("https://")) {
      if (pathSuffix) {
        return new URL(pathSuffix, base.replace(/\/?$/, "/")).href;
      }
      return base.includes("?") || base.includes("#") ? base : base.replace(/\/?$/, "/") || base;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function extractTargetFromReferer(referer) {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    if (u.pathname.startsWith(PROXY_PATH_PREFIX)) {
      const rest = u.pathname.slice(PROXY_PATH_PREFIX.length).replace(/^\/+/, "");
      const segments = rest.split("/").filter(Boolean);
      if (segments.length > 0) {
        const base = decodeURIComponent(segments[0]);
        if (base.startsWith("http://") || base.startsWith("https://")) {
          return new URL(".", base).href;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || "/";

  let targetUrl = extractTargetFromPath(pathname);
  if (!targetUrl && pathname !== "/" && pathname !== "/proxy") {
    const refererBase = extractTargetFromReferer(req.headers.referer);
    if (refererBase) {
      targetUrl = new URL(pathname + (parsed.search || ""), refererBase).href;
    }
  }

  if (targetUrl) {
    fetchTarget(targetUrl, res);
    return;
  }

  res.writeHead(400, { "Content-Type": "text/plain" });
  res.end(
    "ShELF frame proxy. Use: /proxy/<url-encoded-base>/path\n" +
      "Example: /proxy/" +
      encodeURIComponent("https://example.com/")
  );
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ShELF frame proxy on http://127.0.0.1:${PORT}`);
  console.log(`Example: http://127.0.0.1:${PORT}/proxy/${encodeURIComponent("https://example.com/")}`);
});
