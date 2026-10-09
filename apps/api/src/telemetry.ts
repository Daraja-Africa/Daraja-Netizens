export type TelemetryEvent = {
  eventType: 'CONFERENCE_JOINED' | 'AUDIO_MUTED' | 'AUDIO_UNMUTED' | 'SCREEN_SHARE_STARTED' | 'SCREEN_SHARE_STOPPED' | 'CONFERENCE_LEFT';
  meetingId: string;
  userId: string;
  timestamp: number;
};

export const eventStore: TelemetryEvent[] = [];

export function recordTelemetry(event: TelemetryEvent) {
  eventStore.push(event);
  return {
    ok: true,
    recorded: eventStore.length,
  };
}
