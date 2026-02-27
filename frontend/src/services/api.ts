const BASE =
  import.meta.env.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ""
    ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, "")}/api`
    : "https://ai-jukebox-backend-production.up.railway.app/api";
console.log("import.meta.env.VITE_API_URL", import.meta.env.VITE_API_URL);
console.log("BASE", BASE);
function getToken(): string | null {
  return localStorage.getItem("jukebox_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
