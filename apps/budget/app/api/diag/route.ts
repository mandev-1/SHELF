import type { NextRequest } from "next/server";

// Safe self-diagnostic for the proxy → Go API wiring. Visit /api/diag in the
// browser. It NEVER returns the token or URL value — only whether they're set,
// the token's length (to catch a stray space / truncation), and the upstream's
// responses. A static route, so it takes precedence over the [...path] catch-all.
//
// Remove this route once the deployment is healthy if you'd rather not expose
// even this much (it reveals that a token is configured and its length).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const url = process.env.BUDGET_API_URL;
  const token = process.env.BUDGET_API_TOKEN;

  const out: Record<string, unknown> = {
    urlConfigured: !!url,
    tokenConfigured: !!token,
    tokenLength: token ? token.length : 0,
  };

  if (!url) {
    out.verdict = "Set BUDGET_API_URL on Vercel (Settings → Environment Variables) and redeploy.";
    return Response.json(out);
  }

  const base = url.replace(/\/+$/, "");

  // (a) Is the API reachable at all? /healthz needs no auth.
  try {
    const h = await fetch(`${base}/healthz`, { cache: "no-store" });
    out.upstreamHealthz = h.status; // 200 = reachable
  } catch (e) {
    out.upstreamHealthz = `unreachable: ${e instanceof Error ? e.message : "error"}`;
  }

  // (b) Does the configured token get past the API's auth gate?
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const a = await fetch(`${base}/api/budget`, { headers, cache: "no-store" });
    out.authStatus = a.status; // 200 = token accepted; 401 = token wrong/missing
  } catch (e) {
    out.authStatus = `unreachable: ${e instanceof Error ? e.message : "error"}`;
  }

  out.verdict =
    out.authStatus === 200
      ? "OK — proxy is configured and the API accepts the token."
      : out.authStatus === 401
        ? "Token rejected: BUDGET_API_TOKEN does not match the Go API's API_TOKEN. Fix it on Vercel + redeploy."
        : "Check upstreamHealthz — the API may be unreachable from Vercel.";

  return Response.json(out);
}
