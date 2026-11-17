export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function apiFetch(path: string, accessToken?: string | null, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Request failed');
  return response.json();
}
