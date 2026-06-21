import type { NextRequest } from "next/server";

// Server-side proxy. The browser calls same-origin `/api/*`; this handler runs on
// Vercel's server and forwards to the Go Budget API with the SECRET bearer token
// injected here — the token (and the upstream URL) never reach the client. This
// is the single seam in front of the database; the browser never touches
// Supabase directly.
//
// Server-only env (NOT NEXT_PUBLIC_, so it stays out of the client bundle):
//   BUDGET_API_URL    e.g. https://shelf-yh5b.onrender.com
//   BUDGET_API_TOKEN  the API_TOKEN set on the Go service (optional — if the API
//                     is open, leave it empty).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx): Promise<Response> {
  const upstream = process.env.BUDGET_API_URL;
  const token = process.env.BUDGET_API_TOKEN;

  if (!upstream) {
    return Response.json(
      {
        error:
          "Missing BUDGET_API_URL. Set it in Vercel → Settings → Environment Variables, then redeploy.",
      },
      { status: 500 },
    );
  }

  const { path = [] } = await ctx.params;

  // Guard against encoded path-traversal (e.g. %2f.. segments that Next keeps
  // inside one segment and fetch later re-decodes) escaping the /api/ prefix on
  // the upstream — which would leak the injected bearer token to another path.
  const segOk = (s: string) =>
    s.length > 0 && s !== "." && s !== ".." && !s.includes("/") && !s.includes("\\");
  if (path.length === 0 || !path.every(segOk)) {
    return Response.json({ error: "bad request path" }, { status: 400 });
  }

  const base = upstream.replace(/\/+$/, "");
  const search = req.nextUrl.search; // "" or "?..."
  const target = `${base}/api/${path.join("/")}${search}`;

  // Defense in depth: the resolved URL must stay on the upstream origin, under /api/.
  try {
    const resolved = new URL(target);
    if (resolved.origin !== new URL(base).origin || !resolved.pathname.startsWith("/api/")) {
      return Response.json({ error: "bad request path" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "bad request path" }, { status: 400 });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();

  let res: Response;
  try {
    res = await fetch(target, { method, headers, body, cache: "no-store" });
  } catch (e) {
    return Response.json(
      {
        error: `Could not reach the budget API: ${
          e instanceof Error ? e.message : "network error"
        }`,
      },
      { status: 502 },
    );
  }

  // Pass the upstream status + body straight through to the browser.
  const text = await res.text();
  const outHeaders = new Headers();
  const resCT = res.headers.get("content-type");
  if (resCT) outHeaders.set("content-type", resCT);
  return new Response(text, { status: res.status, headers: outHeaders });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
