const JSON_GET: RequestInit = {
  method: 'GET',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json',
  },
  cache: 'no-store',
};

// Null on a network error, an HTTP error or a body that is not JSON: a poller
// tries again on the next tick and a one-off read falls back to its default.
export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, JSON_GET);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
