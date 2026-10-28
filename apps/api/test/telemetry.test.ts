import assert from 'node:assert/strict';
import test from 'node:test';

import { eventStore, recordTelemetry } from '../src/telemetry.js';

test('telemetry records preserve event order and count', () => {
  eventStore.length = 0;
  const first = recordTelemetry({
    eventType: 'CONFERENCE_JOINED',
    meetingId: 'meeting-1',
    userId: 'user-1',
    timestamp: 1,
  });
  const second = recordTelemetry({
    eventType: 'CONFERENCE_LEFT',
    meetingId: 'meeting-1',
    userId: 'user-1',
    timestamp: 2,
  });

  assert.equal(first.recorded, 1);
  assert.equal(second.recorded, 2);
  assert.equal(eventStore[0].eventType, 'CONFERENCE_JOINED');
  assert.equal(eventStore[1].eventType, 'CONFERENCE_LEFT');
});
