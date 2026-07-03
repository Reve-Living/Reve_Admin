const DEFAULT_API_BASE_URL = "https://reve-backend.onrender.com/api";

const normalizeApiBaseUrl = (value?: string) => value?.trim().replace(/\/+$/, "");

const resolveApiBaseUrl = () => {
  const configuredApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const hostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const isHostedAdmin =
    hostname === "reve-admin.vercel.app" || hostname === "www.reve-admin.vercel.app";
  const pointsToLegacyKoyeb = (configuredApiBaseUrl || "").includes("koyeb.app");

  if (isHostedAdmin && pointsToLegacyKoyeb) {
    console.warn(
      "Ignoring legacy Koyeb admin API configuration on the live admin domain and using Render instead."
    );
    return DEFAULT_API_BASE_URL;
  }

  return configuredApiBaseUrl || DEFAULT_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl();

const getAuthToken = () => localStorage.getItem("admin_token");
const mutationInFlight = new Map<string, Promise<unknown>>();
const getCache = new Map<string, { ts: number; data: unknown }>();
const getInFlight = new Map<string, Promise<unknown>>();
const GET_CACHE_TTL_MS = 15 * 1000;
const LONG_GET_CACHE_TTL_MS = 60 * 1000;

const normalizeGetCacheKey = (path: string) => {
  const [pathname, query = ""] = path.split("?");
  if (!query) return pathname;
  const params = new URLSearchParams(query);
  params.sort();
  const normalizedQuery = params.toString();
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
};

const cloneData = <T>(data: T): T => {
  try {
    return structuredClone(data);
  } catch {
    return JSON.parse(JSON.stringify(data));
  }
};

const getCacheTtlMs = (path: string) => {
  if (
    path.startsWith("/categories/") ||
    path === "/categories/" ||
    path.startsWith("/subcategories/") ||
    path === "/subcategories/" ||
    path.startsWith("/filter-types/") ||
    path === "/filter-types/" ||
    path.startsWith("/filter-options/") ||
    path === "/filter-options/" ||
    path.startsWith("/category-filters/") ||
    path === "/category-filters/" ||
    path.startsWith("/mattress-options/") ||
    path === "/mattress-options/"
  ) {
    return LONG_GET_CACHE_TTL_MS;
  }
  return GET_CACHE_TTL_MS;
};

const getMutationKey = (method: string, path: string, body?: unknown) =>
  `${method}:${path}:${body === undefined ? "" : JSON.stringify(body)}`;

const buildHeaders = (hasBody: boolean) => {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const runMutation = async <T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> => {
  const key = getMutationKey(method, path, body);
  const existing = mutationInFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(await res.text());
      }
      if (method === "DELETE" || res.status === 204) {
        return undefined as T;
      }
      return res.json() as Promise<T>;
    })
    .finally(() => {
      mutationInFlight.delete(key);
      getCache.clear();
      getInFlight.clear();
    });

  mutationInFlight.set(key, request);
  return request;
};

export const apiGet = async <T>(path: string): Promise<T> => {
  const cacheKey = normalizeGetCacheKey(path);
  const now = Date.now();
  const cached = getCache.get(cacheKey);
  if (cached && now - cached.ts < getCacheTtlMs(path)) {
    return cloneData(cached.data) as T;
  }

  const existing = getInFlight.get(cacheKey);
  if (existing) {
    return cloneData((await existing) as T);
  }

  const request = fetch(`${API_BASE_URL}${path}`, {
    headers: buildHeaders(false),
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as T;
      getCache.set(cacheKey, { ts: Date.now(), data });
      return data;
    })
    .finally(() => {
      getInFlight.delete(cacheKey);
    });

  getInFlight.set(cacheKey, request);
  return cloneData(await request);
};

export const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
  return runMutation<T>("POST", path, body);
};

export const apiPut = async <T>(path: string, body: unknown): Promise<T> => {
  return runMutation<T>("PUT", path, body);
};

export const apiPatch = async <T>(path: string, body: unknown): Promise<T> => {
  return runMutation<T>("PATCH", path, body);
};

export const apiDelete = async (path: string): Promise<void> => {
  await runMutation<void>("DELETE", path);
};

export const apiUpload = async (
  path: string,
  file: File
): Promise<{ url: string; type?: string; name?: string; mime_type?: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: headers,
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const payload = await res.json();
  const url =
    (typeof payload?.url === "string" && payload.url) ||
    (typeof payload?.publicUrl === "string" && payload.publicUrl) ||
    (typeof payload?.publicURL === "string" && payload.publicURL) ||
    (typeof payload?.data?.url === "string" && payload.data.url) ||
    (typeof payload?.data?.publicUrl === "string" && payload.data.publicUrl) ||
    (typeof payload?.data?.publicURL === "string" && payload.data.publicURL);

  if (!url) {
    throw new Error("Upload succeeded but no valid URL was returned");
  }

  return { ...payload, url };
};

export const apiDownload = async (path: string): Promise<Blob> => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildHeaders(false),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.blob();
};
