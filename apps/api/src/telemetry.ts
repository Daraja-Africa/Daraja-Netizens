export type TelemetryEvent = {
  eventType:
    | 'CONFERENCE_JOINED'
    | 'CONFERENCE_LEFT'
    | 'PARTICIPANT_JOINED'
    | 'PARTICIPANT_LEFT'
    | 'ROLE_CHANGED'
    | 'CONFERENCE_FAILED'
    | 'HEARTBEAT';
  meetingId: string;
  userId: string;
  timestamp: number;
  payload?: Record<string, unknown>;
};

export const eventStore: TelemetryEvent[] = [];
const MAX_STORED_EVENTS = 1_000;

export function recordTelemetry(event: TelemetryEvent) {
  eventStore.push(event);
  if (eventStore.length > MAX_STORED_EVENTS) eventStore.splice(0, eventStore.length - MAX_STORED_EVENTS);
  return {
    ok: true,
    recorded: eventStore.length,
  };
}
