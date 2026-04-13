const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://reve-backend.onrender.com/api";

const getAuthToken = () => localStorage.getItem("admin_token");
const mutationInFlight = new Map<string, Promise<unknown>>();

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
    });

  mutationInFlight.set(key, request);
  return request;
};

export const apiGet = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
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

export const apiUpload = async (path: string, file: File): Promise<{ url: string }> => {
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

  return { url };
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
