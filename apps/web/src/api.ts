export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

/**
 * Keeps the HTTP status and body so a screen can explain a specific failure, and
 * carries the server's request id so a supporter can quote one reference instead
 * of a vague "it did not work".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown> | null;
  readonly requestId: string | null;

  constructor(message: string, status: number, payload: Record<string, unknown> | null, requestId: string | null = null) {
    super(requestId ? `${message} (reference ${requestId.slice(0, 8)})` : message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.requestId = requestId;
  }
}

export async function apiFetch(path: string, accessToken?: string | null, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    throw new ApiError(
      typeof payload?.error === 'string' ? payload.error : 'Request failed',
      response.status,
      payload,
      requestId
    );
  }
  return response.json();
}
