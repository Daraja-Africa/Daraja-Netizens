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

export type RoomTokenRequest = { roomName: string; title?: string; sessionId?: string };
export type RoomTokenResponse = {
  roomName: string;
  meetingId: string;
  sessionId: string | null;
  jitsiDomain: string;
  token: string;
  user: { id: string; name: string; email: string; role: string; isModerator: boolean };
};

export type ActiveRoom = {
  id: string;
  room_key: string;
  title: string;
  scheduled_start: string;
  status: string;
  host_id: string;
};

export type ActiveRoomsResponse = { meetings: ActiveRoom[]; source: 'memory' | 'supabase' };

export type AttendanceHeartbeat = {
  meetingId: string;
  sessionId?: string;
  deltaSeconds: number;
  timestamp?: string;
};

export type FinalAttendance = {
  meetingId: string;
  userId: string;
  joinedAt: string;
  leftAt: string;
  presenceSeconds: number;
};

export type JitsiTelemetry = {
  eventType: 'CONFERENCE_JOINED' | 'CONFERENCE_LEFT' | 'PARTICIPANT_JOINED' | 'PARTICIPANT_LEFT' | 'ROLE_CHANGED' | 'CONFERENCE_FAILED' | 'HEARTBEAT';
  meetingId: string;
  userId: string;
  timestamp: number;
  payload?: Record<string, unknown>;
};

export function requestRoomToken(accessToken: string, input: RoomTokenRequest) {
  return apiFetch('/api/v1/rooms/token', accessToken, { method: 'POST', body: JSON.stringify(input) }) as Promise<RoomTokenResponse>;
}

export function fetchActiveRooms(accessToken: string) {
  return apiFetch('/api/v1/rooms/active', accessToken) as Promise<ActiveRoomsResponse>;
}

export function sendAttendanceHeartbeat(accessToken: string, input: AttendanceHeartbeat, options: { keepalive?: boolean } = {}) {
  return apiFetch('/api/v1/attendance/heartbeat', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
    keepalive: options.keepalive,
  });
}

export function recordFinalAttendance(accessToken: string, input: FinalAttendance) {
  return apiFetch('/api/v1/attendance', accessToken, { method: 'POST', body: JSON.stringify(input) });
}

export function sendJitsiTelemetry(accessToken: string, input: JitsiTelemetry) {
  return apiFetch('/api/v1/telemetry', accessToken, { method: 'POST', body: JSON.stringify(input) });
}
