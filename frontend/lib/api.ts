const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("xeno_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.message || "Request failed");
  }
  return res.json();
}

export const api = {
  get: (path: string) =>
    fetch(`${BASE}${path}`, { headers: getAuthHeaders() }).then(handleResponse),

  post: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    }).then(handleResponse),

  delete: (path: string) =>
    fetch(`${BASE}${path}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

export const apiBase = BASE;
