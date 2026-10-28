import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from './config.js';
import {
  createMeeting,
  createQrChallenge,
  ensureUser,
  getContentFeed,
  getDashboardSummary,
  getEligibility,
  listTrainingSessions,
  getRoleDashboard,
  getSupportContacts,
  persistTelemetryRecord,
  redeemQrChallenge,
  createTrainingSession,
  supabaseReady,
  upsertAttendance,
} from './supabase.js';
import { recordTelemetry } from './telemetry.js';
import { requireAuth, type AuthenticatedRequest } from './auth.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
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

app.get('/api/v1/auth/me', requireAuth(), (req: AuthenticatedRequest, res) => {
    return res.json({ user: req.user });
});

app.get('/api/v1/facilitator/dashboard', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    try {
      return res.json(await getRoleDashboard(req.user!.id));
    } catch (error) {
      console.error('Facilitator dashboard failed', error);
      return res.status(503).json({ error: 'Facilitator dashboard unavailable' });
    }
});

app.get('/api/v1/sessions', requireAuth(['admin', 'facilitator', 'student', 'participant']), async (_req, res) => {
  try {
    return res.json(await listTrainingSessions());
  } catch (error) {
    console.error('Training sessions failed', error);
    return res.status(503).json({ error: 'Training sessions unavailable' });
  }
});

app.post('/api/v1/sessions', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
  const parsed = z.object({
    title: z.string().min(1).max(160),
    sessionType: z.enum(['physical', 'online']),
    scheduledAt: z.string().datetime(),
    requiredForTraining: z.boolean().default(true),
    requiredForStipend: z.boolean().default(false),
    weekKey: z.string().max(32).optional(),
    isMakeup: z.boolean().default(false),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid training session payload', details: parsed.error.flatten() });
  try {
    return res.status(201).json(await createTrainingSession(parsed.data));
  } catch (error) {
    console.error('Training session creation failed', error);
    return res.status(503).json({ error: 'Training session creation unavailable' });
  }
});

app.get('/api/v1/eligibility/me', requireAuth(['admin', 'facilitator', 'student', 'participant']), async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await getEligibility(req.user!.id));
  } catch (error) {
    console.error('Eligibility calculation failed', error);
    return res.status(503).json({ error: 'Eligibility unavailable' });
  }
});

app.post('/api/v1/attendance/qr', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid QR session payload' });
    try {
      return res.status(201).json(await createQrChallenge({ sessionId: parsed.data.sessionId, facilitatorId: req.user!.id }));
    } catch (error) {
      console.error('QR challenge creation failed', error);
      return res.status(503).json({ error: 'QR challenge unavailable' });
    }
});

app.post('/api/v1/attendance/qr/redeem', requireAuth(['admin', 'facilitator', 'student', 'participant']), async (req: AuthenticatedRequest, res) => {
    const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid QR token' });
    try {
      return res.status(201).json(await redeemQrChallenge({ token: parsed.data.token, studentId: req.user!.id }));
    } catch (error) {
      console.error('QR redemption failed', error);
      return res.status(409).json({ error: error instanceof Error ? error.message : 'QR redemption failed' });
    }
});

app.get('/api/v1/content', requireAuth(['student', 'participant', 'facilitator', 'admin']), async (_req, res) => {
    try {
      return res.json(await getContentFeed());
    } catch (error) {
      console.error('Content feed failed', error);
      return res.status(503).json({ error: 'Content feed unavailable' });
    }
});

app.get('/api/v1/support/contacts', requireAuth(['student', 'participant', 'facilitator', 'admin']), async (_req, res) => {
    try {
      return res.json(await getSupportContacts());
    } catch (error) {
      console.error('Support contacts failed', error);
      return res.status(503).json({ error: 'Support contacts unavailable' });
    }
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
      role: 'facilitator',
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
