// Typed client for the same-origin API proxy (app/api/[...path]/route.ts). The
// browser only ever calls /api/* on its own origin — it never sees the upstream
// Go API URL or the bearer token (the server-side proxy injects those).
//
// Every method returns parsed JSON, or throws an ApiError carrying the HTTP
// status so callers can branch on conflicts (e.g. 404 = the row was already
// deleted) and tell the user.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(`/api${path}`, {
    method,
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : typeof data === "string" && data
          ? data
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: (path: string) => request<void>("DELETE", path),
};

/** True when an error is an ApiError with the given HTTP status. */
export function isStatus(e: unknown, status: number): boolean {
  return e instanceof ApiError && e.status === status;
}

/** True when an error means "the row is gone" (HTTP 404). */
export function isNotFound(e: unknown): boolean {
  return isStatus(e, 404);
}
