export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = isJson ? (body?.error || JSON.stringify(body)) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!isJson) throw new Error("Unexpected non-JSON response");
  return body as T;
}
