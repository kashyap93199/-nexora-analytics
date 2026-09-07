import type { AuthResponse } from "../types";

// Same-origin by default (vite dev proxy / nginx). Set VITE_API_URL for
// cross-origin deployments, e.g. https://api.nexora.example.
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const ACCESS_KEY = "nexora_access_token";
const REFRESH_KEY = "nexora_refresh_token";

/**
 * Attach the access token. It is sent as the standard `Authorization: Bearer`
 * header AND as `X-Access-Token`: some hosted preview / tunnel proxies strip
 * `Authorization` before it reaches the API, which would otherwise make every
 * request after login fail with 401. The backend accepts either.
 */
function withAuth(headers: Headers, token: string | null): Headers {
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Access-Token", token);
  }
  return headers;
}

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (auth: Pick<AuthResponse, "access_token" | "refresh_token">) => {
    localStorage.setItem(ACCESS_KEY, auth.access_token);
    localStorage.setItem(REFRESH_KEY, auth.refresh_token);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshPromise: Promise<string | null> | null = null;

/** Single-flight token refresh so concurrent 401s share one call. */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = tokenStore.getRefresh();
      if (!refresh) return null;
      try {
        const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok) {
          tokenStore.clear();
          window.dispatchEvent(new Event("nexora:session-expired"));
          return null;
        }
        const data = (await res.json()) as AuthResponse;
        tokenStore.set(data);
        return data.access_token;
      } catch {
        tokenStore.clear();
        window.dispatchEvent(new Event("nexora:session-expired"));
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  withAuth(headers, tokenStore.getAccess());

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !retried && tokenStore.getRefresh()) {
    const fresh = await refreshAccessToken();
    if (fresh) return request<T>(path, options, true);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : null;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => (d as { msg?: string }).msg ?? "Invalid value").join("; ")
          : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, detail, message);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Trigger a CSV download from an authenticated GET endpoint. */
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const headers = withAuth(new Headers(), tokenStore.getAccess());
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, null, `Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
