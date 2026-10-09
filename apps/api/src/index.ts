import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from './config.js';
import {
  createMeeting,
  ensureUser,
  getDashboardSummary,
  persistTelemetryRecord,
  supabaseReady,
  upsertAttendance,
} from './supabase.js';
import { recordTelemetry } from './telemetry.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const roomSchema = z.object({
  roomName: z.string().min(3).max(80),
  userId: z.string().uuid(),
  userName: z.string().min(1).max(120),
  email: z.string().email().optional(),
  meetingId: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(160).optional(),
});

const attendanceSchema = z.object({
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().optional(),
  presenceSeconds: z.number().int().nonnegative().optional(),
});

const telemetrySchema = z.object({
  eventType: z.enum(['CONFERENCE_JOINED', 'AUDIO_MUTED', 'AUDIO_UNMUTED', 'SCREEN_SHARE_STARTED', 'SCREEN_SHARE_STOPPED', 'CONFERENCE_LEFT']),
  meetingId: z.string().min(1),
  userId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'daraja-api',
    jitsiDomain: config.jitsiDomain,
    supabaseReady,
  });
});

app.post('/api/v1/rooms/token', async (req, res) => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid room payload', details: parsed.error.flatten() });
  }

  const { roomName, userId, userName, email, meetingId, title } = parsed.data;
  const nowSeconds = Math.floor(Date.now() / 1000);
  let meeting: { id: string };

  try {
    await ensureUser({
      id: userId,
      email: email ?? `${userId}@daraja.local`,
      fullName: userName,
      role: 'host',
    });
    meeting = await createMeeting({
      roomKey: roomName,
      title: title ?? roomName,
      hostId: userId,
    });
  } catch (error) {
    console.error('Meeting persistence failed', error);
    return res.status(503).json({ error: 'Meeting persistence is unavailable' });
  }

  const token = jwt.sign(
    {
      iss: config.jwtIssuer,
      sub: roomName,
      aud: 'jitsi-component',
      room: roomName,
      exp: nowSeconds + 60 * 60,
      nbf: nowSeconds - 10,
      context: {
        user: {
          id: userId,
          name: userName,
          email: email ?? `${userId}@daraja.local`,
          avatar: `${config.publicBaseUrl}/assets/default-avatar.png`,
          affiliation: 'participant',
        },
        features: {
          recording: 'false',
          livestreaming: 'false',
          screenSharing: 'true',
        },
      },
      meetingId: meeting.id,
    },
    config.jwtSecret,
    { algorithm: 'HS256' }
  );

  return res.json({
    roomName,
    meetingId: meeting.id,
    jitsiDomain: config.jitsiDomain,
    token,
  });
});

app.post('/api/v1/attendance', async (req, res) => {
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid attendance payload', details: parsed.error.flatten() });
  }

  try {
    const attendance = await upsertAttendance(parsed.data);
    return res.status(201).json({ attendance });
  } catch (error) {
    console.error('Attendance persistence failed', error);
    return res.status(503).json({ error: 'Attendance persistence is unavailable' });
  }
});

app.post('/api/v1/telemetry', async (req, res) => {
  const parsed = telemetrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid telemetry payload', details: parsed.error.flatten() });
  }

  const event = recordTelemetry(parsed.data);

  try {
    await persistTelemetryRecord({
      event_type: parsed.data.eventType,
      meeting_id: parsed.data.meetingId,
      user_id: parsed.data.userId,
      created_at: new Date(parsed.data.timestamp).toISOString(),
      payload: parsed.data,
    });
  } catch (error) {
    console.warn('Supabase telemetry persistence unavailable', error);
  }

  return res.status(202).json({ ok: true, message: 'Telemetry received', event, supabaseReady });
});

app.get('/api/v1/telemetry', (_req, res) => {
  res.json({ count: 0, events: [] });
});

app.get('/api/v1/dashboard/summary', async (_req, res) => {
  try {
    return res.json(await getDashboardSummary());
  } catch (error) {
    console.error('Dashboard summary failed', error);
    return res.status(503).json({ error: 'Dashboard data is unavailable' });
  }
});

app.listen(config.port, () => {
  console.log(`Daraja API listening at http://localhost:${config.port}`);
});
