import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { config } from './config.js';
import {
  createMeeting,
  createQrChallenge,
  createStudentReachOutRequest,
  ensureUser,
  getContentFeed,
  getDashboardSummary,
  getEligibility,
  listTrainingSessions,
  getRoleDashboard,
  getStudentSupportContacts,
  getSupportContacts,
  persistTelemetryRecord,
  redeemQrChallenge,
  createTrainingSession,
  supabaseReady,
  upsertAttendance,
} from './supabase.js';
import {
  studentGuides,
  studentReachOutMethods,
  studentReachOutTopics,
  studentReachOutUrgencies,
} from './studentContent.js';
import { recordTelemetry } from './telemetry.js';
import { requireAuth, type AuthenticatedRequest } from './auth.js';
import {
  applyLessonImport,
  applyMemberImport,
  getAttendanceOverview,
  ImportInputError,
  MigrationRequiredError,
  parseLessonDocument,
  parseMemberWorkbook,
  loadRoster,
  resolveEntries,
} from './memberImport.js';

const app = express();
const writeRequests = new Map<string, { startedAt: number; count: number }>();
// Reach-out submissions are confidential and rare, so they get a tighter limit
// than the general write limiter: a handful per contact detail, so one person
// cannot flood the wellness team while everyone else stays unaffected.
const reachOutRequests = new Map<string, { startedAt: number; count: number }>();
const reachOutWindowMs = 15 * 60_000;
const reachOutMax = 3;

app.disable('x-powered-by');
app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.trim() || randomUUID();
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  next();
});
app.use(cors({ origin: config.corsOrigin }));

// Attendance imports post the roster spreadsheet and lesson documents as base64,
// so they parse their own (larger) body. Registered before the small JSON
// parser every other route uses.
const attendanceUploadSchema = z.object({
  kind: z.enum(['members', 'attendance']),
  files: z
    .array(z.object({ name: z.string().min(1).max(200), data: z.string().min(1) }))
    .min(1)
    .max(6),
});

type AttendanceUpload = z.infer<typeof attendanceUploadSchema>;

function decodeUpload(file: { name: string; data: string }) {
  const base64 = file.data.startsWith('data:') ? file.data.slice(file.data.indexOf(',') + 1) : file.data;
  return { name: file.name, buffer: Buffer.from(base64, 'base64') };
}

async function readAttendanceUpload(upload: AttendanceUpload) {
  if (upload.kind === 'members') {
    const [file] = upload.files;
    if (upload.files.length !== 1 || !/\.(xlsx|xls)$/i.test(file.name)) {
      throw new ImportInputError('Upload one .xlsx or .xls member spreadsheet');
    }
    return { kind: 'members' as const, workbook: parseMemberWorkbook(decodeUpload(file).buffer) };
  }
  if (upload.files.some((file) => !/\.docx$/i.test(file.name))) {
    throw new ImportInputError('Upload .docx attendance documents only');
  }
  const lessons = await Promise.all(
    upload.files.map(async (file) => parseLessonDocument(decodeUpload(file).buffer, file.name))
  );
  return { kind: 'attendance' as const, lessons };
}

function importFailure(res: express.Response, error: unknown) {
  if (error instanceof MigrationRequiredError) {
    return res.status(409).json({ error: error.message, detail: error.detail, migrationRequired: true });
  }
  if (error instanceof ImportInputError) return res.status(400).json({ error: error.message });
  console.error('Attendance import failed', error);
  return res.status(503).json({ error: 'Attendance import failed. Check the API logs and try again.' });
}

const attendanceRouter = express.Router();
attendanceRouter.use(express.json({ limit: '25mb' }));

attendanceRouter.get('/data', requireAuth(['admin', 'facilitator']), async (_req, res) => {
  try {
    return res.json(await getAttendanceOverview());
  } catch (error) {
    if (error instanceof MigrationRequiredError) return importFailure(res, error);
    console.error('Attendance overview failed', error);
    return res.status(503).json({ error: 'Attendance data is unavailable' });
  }
});

attendanceRouter.post('/import/preview', requireAuth(['admin', 'facilitator']), async (req, res) => {
  const parsed = attendanceUploadSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Choose a file to preview' });
  try {
    const upload = await readAttendanceUpload(parsed.data);
    const roster = await loadRoster();
    if (upload.kind === 'members') {
      const known = new Set(roster.members.map((member) => member.email.toLowerCase()));
      const members = upload.workbook.members;
      return res.json({
        kind: 'members',
        total: members.length,
        toCreate: members.filter((member) => !known.has(member.email)).map((member) => member.name),
        toUpdate: members.filter((member) => known.has(member.email)).map((member) => member.name),
        skipped: upload.workbook.skipped,
      });
    }
    return res.json({
      kind: 'attendance',
      lessons: upload.lessons.map((lesson) => {
        const resolved = resolveEntries(lesson, roster);
        return {
          title: resolved.title,
          date: resolved.date,
          meetingCode: resolved.meetingCode,
          sourceFile: resolved.sourceFile,
          matched: resolved.resolved.filter((entry) => entry.member).length,
          unmatched: resolved.resolved.filter((entry) => entry.status === 'unmatched').length,
          excluded: resolved.resolved.filter((entry) => entry.status === 'excluded').length,
          entries: resolved.resolved.map((entry) => ({
            displayName: entry.displayName,
            memberName: entry.member?.full_name ?? null,
            status: entry.status,
          })),
        };
      }),
    });
  } catch (error) {
    return importFailure(res, error);
  }
});

attendanceRouter.post('/import/apply', requireAuth(['admin', 'facilitator']), async (req, res) => {
  const parsed = attendanceUploadSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Choose a file to import' });
  try {
    const upload = await readAttendanceUpload(parsed.data);
    if (upload.kind === 'members') {
      const summary = await applyMemberImport(upload.workbook.members, upload.workbook.skipped);
      return res.json({ kind: 'members', ...summary });
    }
    const roster = await loadRoster();
    const summaries = await applyLessonImport(upload.lessons.map((lesson) => resolveEntries(lesson, roster)));
    return res.json({ kind: 'attendance', lessons: summaries });
  } catch (error) {
    return importFailure(res, error);
  }
});

app.use('/api/v1/facilitator/attendance', attendanceRouter);

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const current = writeRequests.get(key);
  if (!current || now - current.startedAt >= config.writeRateLimitWindowMs) {
    writeRequests.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= config.writeRateLimitMax) {
    res.setHeader('retry-after', Math.ceil((config.writeRateLimitWindowMs - (now - current.startedAt)) / 1000));
    return res.status(429).json({ error: 'Too many write requests' });
  }
  current.count += 1;
  return next();
});

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

const reachOutSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    contactMethod: z.enum(studentReachOutMethods),
    contactDetail: z.string().trim().min(5).max(160),
    topic: z.enum(studentReachOutTopics),
    urgency: z.enum(studentReachOutUrgencies),
    message: z.string().trim().min(10).max(2000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.contactMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.contactDetail)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contactDetail'], message: 'Enter a valid email address' });
    }
    if (value.contactMethod !== 'email' && !/^\+?[0-9][0-9\s-]{6,19}$/.test(value.contactDetail)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contactDetail'], message: 'Enter a valid phone number' });
    }
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

app.get('/api/ready', (_req, res) => {
  const ready = config.nodeEnv !== 'production' || supabaseReady;
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: 'daraja-api',
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

app.post('/api/v1/attendance/qr/redeem', requireAuth(['admin', 'facilitator', 'student']), async (req: AuthenticatedRequest, res) => {
  const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid QR token' });
  try {
    return res.status(201).json(await redeemQrChallenge({ token: parsed.data.token, studentId: req.user!.id }));
  } catch (error) {
    console.error('QR redemption failed', error);
    return res.status(409).json({ error: error instanceof Error ? error.message : 'QR redemption failed' });
  }
});

app.get('/api/v1/content', async (_req, res) => {
  try {
    return res.json(await getContentFeed());
  } catch (error) {
    console.error('Content feed failed', error);
    return res.status(503).json({ error: 'Content feed unavailable' });
  }
});

app.get('/api/v1/support/contacts', async (_req, res) => {
  try {
    return res.json(await getSupportContacts());
  } catch (error) {
    console.error('Support contacts failed', error);
    return res.status(503).json({ error: 'Support contacts unavailable' });
  }
});

// Student Portal: Mental Health Educative Hub library. Public by design — the
// module boundary keeps facilitator/stipend reporting out of this surface.
app.get('/api/v1/student/content', (_req, res) => {
  res.setHeader('cache-control', 'public, max-age=300');
  return res.json({ items: studentGuides, source: 'curated' });
});

app.get('/api/v1/student/support-contacts', async (_req, res) => {
  try {
    return res.json(await getStudentSupportContacts());
  } catch (error) {
    console.error('Student support contacts failed', error);
    return res.status(503).json({ error: 'Support contacts unavailable' });
  }
});

// Confidential reach-out. Deliberately public so a student can ask for help
// without signing in, and rate limited per contact detail so one person cannot
// flood the wellness team (an IP key would lump every student behind the same
// reverse proxy into a single bucket). Rows are written with the service-role
// key only.
app.post('/api/v1/student/reach-out', async (req, res) => {
  const parsed = reachOutSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Please check the form and try again.',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const rateKey = parsed.data.contactDetail.toLowerCase().replace(/[^a-z0-9]/g, '');
  const now = Date.now();
  if (reachOutRequests.size > 500) {
    for (const [entryKey, entry] of reachOutRequests) {
      if (now - entry.startedAt >= reachOutWindowMs) reachOutRequests.delete(entryKey);
    }
  }
  const current = reachOutRequests.get(rateKey);
  if (!current || now - current.startedAt >= reachOutWindowMs) {
    reachOutRequests.set(rateKey, { startedAt: now, count: 1 });
  } else if (current.count >= reachOutMax) {
    res.setHeader('retry-after', Math.ceil((reachOutWindowMs - (now - current.startedAt)) / 1000));
    return res.status(429).json({ error: 'You have already sent a few notes. Please try again later.' });
  } else {
    current.count += 1;
  }

  const reference = `DN-${randomUUID().slice(0, 6).toUpperCase()}`;
  try {
    await createStudentReachOutRequest({
      reference,
      name: parsed.data.name,
      contactMethod: parsed.data.contactMethod,
      contactDetail: parsed.data.contactDetail,
      supportTopic: parsed.data.topic,
      urgency: parsed.data.urgency,
      message: parsed.data.message,
    });
  } catch (error) {
    console.error('Student reach-out request failed', error);
    return res.status(503).json({ error: 'We could not record that just now. Please try again.' });
  }

  return res.status(201).json({ ok: true, reference, receivedAt: new Date().toISOString() });
});

app.post('/api/v1/rooms/token', requireAuth(), async (req: AuthenticatedRequest, res) => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid room payload', details: parsed.error.flatten() });
  }

  const { roomName, userName, email, title } = parsed.data;
  const userId = req.user!.id;
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

app.post('/api/v1/attendance', requireAuth(), async (req: AuthenticatedRequest, res) => {
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid attendance payload', details: parsed.error.flatten() });
  }

  try {
    const attendance = await upsertAttendance({ ...parsed.data, userId: req.user!.id });
    return res.status(201).json({ attendance });
  } catch (error) {
    console.error('Attendance persistence failed', error);
    return res.status(503).json({ error: 'Attendance persistence is unavailable' });
  }
});

app.post('/api/v1/telemetry', requireAuth(), async (req: AuthenticatedRequest, res) => {
  const parsed = telemetrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid telemetry payload', details: parsed.error.flatten() });
  }

  const event = recordTelemetry({ ...parsed.data, userId: req.user!.id });

  try {
    await persistTelemetryRecord({
      event_type: parsed.data.eventType,
      meeting_id: parsed.data.meetingId,
      user_id: req.user!.id,
      created_at: new Date(parsed.data.timestamp).toISOString(),
      payload: parsed.data,
    });
  } catch (error) {
    console.error('Telemetry persistence failed', error);
    return res.status(503).json({ error: 'Telemetry persistence is unavailable' });
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
