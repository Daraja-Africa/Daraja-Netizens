import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { config } from './config.js';
import {
  AdminError,
  getAdminOverview,
  getFacilitatorDirectory,
  getFacilitatorOverview,
  getMemberDirectory,
  getProgramData,
  getSessionAttendance,
  setSessionAttendance,
  updateTrainingSession,
  updateUserRole,
  type ManagedRole,
  type SessionPatch,
} from './admin.js';
import {
  checkSupabaseReadiness,
  createMeeting,
  createQrChallenge,
  createStudentReachOutRequest,
  createTrainingSession,
  ensureUser,
  getContentFeed,
  getDashboardSummary,
  getEligibility,
  listTrainingSessions,
  getReachOutNote,
  getRoleDashboard,
  getStudentSupportContacts,
  getSupportContacts,
  isMissingReachOutSchema,
  listReachOutNotes,
  persistTelemetryRecord,
  recordReachOutAccess,
  redeemQrChallenge,
  supabaseConfigured,
  updateReachOutNote,
  upsertAttendance,
} from './supabase.js';
import {
  studentGuides,
  studentReachOutMethods,
  studentReachOutTopics,
  studentReachOutUrgencies,
} from './studentContent.js';
import { recordTelemetry } from './telemetry.js';
import { createAuthGuard, type AuthenticatedRequest, type IdentityResolver, resolveIdentityFromToken } from './auth.js';
import { buildReachOutAlert, sendDiscordAlert, verifyDiscordRequest } from './discord.js';
import { logger as rootLogger, type Logger } from './logger.js';
import {
  buildNotePatch,
  notifyNewNote,
  REACH_OUT_STATUSES,
  slaDueAt,
  slaState,
  sortForTriage,
  summariseNotes,
  type ReachOutNote,
} from './reachOut.js';
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

export type AppDeps = {
  /** Swappable so the auth matrix test can drive every protected route. */
  resolveIdentity?: IdentityResolver;
  logger?: Logger;
};

export function createApp(deps: AppDeps = {}) {
  const baseLog = deps.logger ?? rootLogger;
  const requireAuth = createAuthGuard(deps.resolveIdentity ?? resolveIdentityFromToken);

  const app = express();
  // Bounded, self-expiring write counter. The previous Map grew without limit
  // and never forgot an IP.
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
    const log = baseLog.child({ requestId });
    (req as AuthenticatedRequest).log = log;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');

    const startedAt = Date.now();
    res.on('finish', () => {
      log.info('http.request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
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

  function importFailure(req: express.Request, res: express.Response, error: unknown) {
    if (error instanceof MigrationRequiredError) {
      return res.status(409).json({ error: error.message, detail: error.detail, migrationRequired: true });
    }
    if (error instanceof ImportInputError) return res.status(400).json({ error: error.message });
    (req as AuthenticatedRequest).log?.error('attendance.import_failed', { error });
    return res.status(503).json({ error: 'Attendance import failed. Check the API logs and try again.' });
  }

  const attendanceRouter = express.Router();
  attendanceRouter.use(express.json({ limit: '25mb' }));

  attendanceRouter.get('/data', requireAuth(['admin', 'facilitator']), async (req, res) => {
    try {
      return res.json(await getAttendanceOverview());
    } catch (error) {
      if (error instanceof MigrationRequiredError) return importFailure(req, res, error);
      (req as AuthenticatedRequest).log?.error('attendance.overview_failed', { error });
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
      return importFailure(req, res, error);
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
      return importFailure(req, res, error);
    }
  });

  app.use('/api/v1/facilitator/attendance', attendanceRouter);

  // ── Discord platform webhooks ────────────────────────────────────────────
  // Discord signs `timestamp + raw body` with Ed25519, so this route must see
  // the untouched bytes: it buffers them with express.raw and is registered
  // before the shared JSON parser and the write limiter, since the signature is
  // the only gate it needs and a re-encoded body would fail verification.
  app.post('/api/v1/discord/webhooks', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
    const log = (req as AuthenticatedRequest).log ?? baseLog;
    if (!config.discordPublicKey) {
      log.warn('discord.webhook_not_configured', { hint: 'Set DISCORD_PUBLIC_KEY to accept Discord webhooks' });
      return res.status(503).json({ error: 'Discord webhook is not configured' });
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const signatureValid = verifyDiscordRequest({
      publicKey: config.discordPublicKey,
      signature: req.header('x-signature-ed25519'),
      timestamp: req.header('x-signature-timestamp'),
      body,
    });
    if (!signatureValid) {
      log.warn('discord.webhook_rejected', { reason: 'invalid signature' });
      return res.status(401).json({ error: 'Invalid request signature' });
    }

    let payload: { type?: number; t?: string; event?: string };
    try {
      payload = JSON.parse(body.toString('utf8')) as typeof payload;
    } catch {
      log.warn('discord.webhook_rejected', { reason: 'malformed payload' });
      return res.status(400).json({ error: 'Malformed payload' });
    }

    // Discord's endpoint-verification probe. The type is read from the signed
    // payload, so only Discord itself can make us answer it.
    if (payload.type === 0) return res.status(204).end();

    // Application events such as APPLICATION_AUTHORIZED carry no user data we
    // act on; they are logged so a verification review can see them arrive.
    log.info('discord.webhook_event', { type: payload.type, event: payload.event, delivery: payload.t });
    return res.status(204).end();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    if (writeRequests.size > 2_000) {
      for (const [entryKey, entry] of writeRequests) {
        if (now - entry.startedAt >= config.writeRateLimitWindowMs) writeRequests.delete(entryKey);
      }
    }
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

  const reachOutListSchema = z.object({
    status: z.enum(['all', ...REACH_OUT_STATUSES]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  });

  const reachOutUpdateSchema = z
    .object({
      status: z.enum(REACH_OUT_STATUSES).optional(),
      assignedTo: z.string().uuid().nullable().optional(),
    })
    .strict()
    .refine((value) => value.status !== undefined || value.assignedTo !== undefined, {
      message: 'Nothing to update',
    });

  const telemetrySchema = z.object({
    eventType: z.enum(['CONFERENCE_JOINED', 'AUDIO_MUTED', 'AUDIO_UNMUTED', 'SCREEN_SHARE_STARTED', 'SCREEN_SHARE_STOPPED', 'CONFERENCE_LEFT']),
    meetingId: z.string().min(1),
    userId: z.string().min(1),
    timestamp: z.number().int().nonnegative(),
  });

  const roleSchema = z.object({ role: z.enum(['admin', 'facilitator', 'student', 'participant']) });
  const createSessionSchema = z.object({
    title: z.string().trim().min(1).max(160),
    sessionType: z.enum(['physical', 'online']),
    scheduledAt: z.string().datetime({ offset: true }),
    requiredForTraining: z.boolean().default(true),
    requiredForStipend: z.boolean().default(false),
    weekKey: z.string().trim().max(40).optional(),
    isMakeup: z.boolean().default(false),
  });
  const sessionPatchSchema = z.object({
    title: z.string().trim().min(1).max(160).optional(),
    session_type: z.enum(['physical', 'online']).optional(),
    scheduled_at: z.string().datetime({ offset: true }).optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
    required_for_training: z.boolean().optional(),
    required_for_stipend: z.boolean().optional(),
    week_key: z.string().trim().max(40).nullable().optional(),
    is_makeup: z.boolean().optional(),
  }).strict();

  function adminFailure(req: express.Request, res: express.Response, error: unknown, label: string) {
    if (error instanceof AdminError) return res.status(error.status).json({ error: error.message });
    (req as AuthenticatedRequest).log?.error('admin.request_failed', { error, label });
    return res.status(503).json({ error: `${label} is unavailable` });
  }

  function reachOutFailure(req: express.Request, res: express.Response, error: unknown) {
    if (isMissingReachOutSchema(error)) {
      return res.status(409).json({
        error: 'Reach-out triage needs the latest database migration',
        detail: 'Apply supabase/migrations/20261117130000_reach_out_triage.sql, then reload this screen.',
        migrationRequired: true,
      });
    }
    (req as AuthenticatedRequest).log?.error('reach_out.query_failed', { error });
    return res.status(503).json({ error: 'Reach-out inbox is unavailable' });
  }

  /** Liveness only. Postgres is checked by /api/ready. */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'daraja-api', jitsiDomain: config.jitsiDomain });
  });

  app.get('/api/ready', async (_req, res) => {
    const database = await checkSupabaseReadiness();
    return res.status(database.ok ? 200 : 503).json({
      status: database.ok ? 'ready' : 'not_ready',
      service: 'daraja-api',
      database,
    });
  });

  app.get('/api/v1/auth/me', requireAuth(), (req: AuthenticatedRequest, res) => {
    return res.json({ user: req.user });
  });

  app.get('/api/v1/facilitator/dashboard', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    try {
      return res.json(await getRoleDashboard(req.user!.id));
    } catch (error) {
      req.log?.error('dashboard.failed', { error });
      return res.status(503).json({ error: 'Facilitator dashboard unavailable' });
    }
  });

  app.get('/api/v1/sessions', requireAuth(['admin', 'facilitator']), async (req, res) => {
    try {
      return res.json(await listTrainingSessions());
    } catch (error) {
      return adminFailure(req, res, error, 'Training sessions');
    }
  });

  app.get('/api/v1/admin/overview', requireAuth(['admin']), async (req, res) => {
    try { return res.json(await getAdminOverview()); } catch (error) { return adminFailure(req, res, error, 'Admin overview'); }
  });
  app.get('/api/v1/admin/members', requireAuth(['admin']), async (req, res) => {
    try { return res.json(await getMemberDirectory()); } catch (error) { return adminFailure(req, res, error, 'Member directory'); }
  });
  app.get('/api/v1/admin/facilitators', requireAuth(['admin']), async (req, res) => {
    try { return res.json(await getFacilitatorDirectory()); } catch (error) { return adminFailure(req, res, error, 'Facilitator directory'); }
  });
  app.patch('/api/v1/admin/users/:id/role', requireAuth(['admin']), async (req: AuthenticatedRequest, res) => {
    const parsed = roleSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Choose a valid role' });
    try { return res.json({ user: await updateUserRole(req.user!.id, req.params.id, parsed.data.role as ManagedRole) }); }
    catch (error) { return adminFailure(req, res, error, 'Role change'); }
  });
  app.get('/api/v1/admin/program', requireAuth(['admin']), async (req, res) => {
    try { return res.json(await getProgramData()); } catch (error) { return adminFailure(req, res, error, 'Programme data'); }
  });
  app.post('/api/v1/admin/sessions', requireAuth(['admin']), async (req, res) => {
    const parsed = createSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Check the session details', details: parsed.error.flatten().fieldErrors });
    try {
      const session = await createTrainingSession({
        title: parsed.data.title, sessionType: parsed.data.sessionType, scheduledAt: parsed.data.scheduledAt,
        requiredForTraining: parsed.data.requiredForTraining, requiredForStipend: parsed.data.requiredForStipend,
        weekKey: parsed.data.weekKey, isMakeup: parsed.data.isMakeup,
      });
      return res.status(201).json({ session });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return res.status(409).json({ error: 'A session with that title and start time already exists' });
      return adminFailure(req, res, error, 'Session creation');
    }
  });
  app.patch('/api/v1/admin/sessions/:id', requireAuth(['admin']), async (req, res) => {
    const parsed = sessionPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Check the session details', details: parsed.error.flatten().fieldErrors });
    try { return res.json({ session: await updateTrainingSession(req.params.id, parsed.data as SessionPatch) }); }
    catch (error) { return adminFailure(req, res, error, 'Session update'); }
  });
  app.get('/api/v1/sessions/:id/attendance', requireAuth(['admin', 'facilitator']), async (req, res) => {
    try { return res.json(await getSessionAttendance(req.params.id)); } catch (error) { return adminFailure(req, res, error, 'Session attendance'); }
  });
  app.put('/api/v1/sessions/:id/attendance', requireAuth(['admin', 'facilitator']), async (req, res) => {
    const parsed = z.object({ memberId: z.string().uuid(), present: z.boolean() }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Choose a member and whether they attended' });
    try {
      return res.json({ attendance: await setSessionAttendance({ sessionId: req.params.id, memberId: parsed.data.memberId, present: parsed.data.present }) });
    } catch (error) { return adminFailure(req, res, error, 'Attendance update'); }
  });
  app.get('/api/v1/facilitator/overview', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    try { return res.json(await getFacilitatorOverview(req.user!.id)); } catch (error) { return adminFailure(req, res, error, 'Facilitator overview'); }
  });

  app.get('/api/v1/facilitator/eligibility', requireAuth(['admin', 'facilitator', 'student']), async (req: AuthenticatedRequest, res) => {
    try {
      return res.json(await getEligibility(req.user!.id));
    } catch (error) {
      req.log?.error('eligibility.failed', { error });
      return res.status(503).json({ error: 'Eligibility is unavailable' });
    }
  });

  // ── Confidential reach-out triage ────────────────────────────────────────
  // A student is promised that a supporter will act on their note, so these are
  // the routes that make that true: list, open (audited), claim and resolve.

  app.get('/api/v1/facilitator/reach-out', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    const parsed = reachOutListSchema.safeParse(req.query ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid triage filter' });
    try {
      const { notes } = await listReachOutNotes(parsed.data);
      return res.json({
        notes: sortForTriage(notes),
        summary: summariseNotes(notes),
        triagedBy: req.user!.id,
      });
    } catch (error) {
      return reachOutFailure(req, res, error);
    }
  });

  app.get('/api/v1/facilitator/reach-out/:id', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid note id' });
    try {
      const note = await getReachOutNote(id.data);
      if (!note) return res.status(404).json({ error: 'Note not found' });
      // Every open is recorded: a confidential note is not read without a trace.
      await recordReachOutAccess({ noteId: note.id, actorId: req.user!.id, action: 'opened' }).catch((auditError) => {
        req.log?.error('reach_out.audit_failed', { error: auditError, noteId: note.id });
      });
      return res.json({ note, sla: slaState(note) });
    } catch (error) {
      return reachOutFailure(req, res, error);
    }
  });

  app.patch('/api/v1/facilitator/reach-out/:id', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid note id' });
    const parsed = reachOutUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid triage update', details: parsed.error.flatten() });
    }
    try {
      const existing = await getReachOutNote(id.data);
      if (!existing) return res.status(404).json({ error: 'Note not found' });
      const patch = buildNotePatch(existing as ReachOutNote, parsed.data);
      const note = await updateReachOutNote(existing.id, patch);
      await recordReachOutAccess({
        noteId: existing.id,
        actorId: req.user!.id,
        action: parsed.data.status ? 'status_changed' : 'assigned',
        detail: JSON.stringify({ from: existing.status, to: note?.status ?? existing.status, assignedTo: patch.assigned_to ?? existing.assigned_to }),
      }).catch((auditError) => {
        req.log?.error('reach_out.audit_failed', { error: auditError, noteId: existing.id });
      });
      return res.json({ note: note ?? existing, sla: slaState((note ?? existing) as ReachOutNote) });
    } catch (error) {
      return reachOutFailure(req, res, error);
    }
  });

  app.post('/api/v1/attendance/qr', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid QR session payload' });
    try {
      return res.status(201).json(await createQrChallenge({ sessionId: parsed.data.sessionId, facilitatorId: req.user!.id }));
    } catch (error) {
      req.log?.error('qr.create_failed', { error });
      return res.status(503).json({ error: 'QR challenge unavailable' });
    }
  });

  app.post('/api/v1/attendance/qr/redeem', requireAuth(['admin', 'facilitator', 'student']), async (req: AuthenticatedRequest, res) => {
    const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid QR token' });
    try {
      return res.status(201).json(await redeemQrChallenge({ token: parsed.data.token, studentId: req.user!.id }));
    } catch (error) {
      req.log?.warn('qr.redeem_failed', { error });
      return res.status(409).json({ error: error instanceof Error ? error.message : 'QR redemption failed' });
    }
  });

  app.get('/api/v1/content', async (_req, res) => {
    try {
      return res.json(await getContentFeed());
    } catch (error) {
      return res.status(503).json({ error: 'Content feed unavailable' });
    }
  });

  app.get('/api/v1/support/contacts', async (_req, res) => {
    try {
      return res.json(await getSupportContacts());
    } catch (error) {
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
    const createdAt = new Date().toISOString();
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
      (req as AuthenticatedRequest).log?.error('reach_out.create_failed', { error, reference });
      return res.status(503).json({ error: 'We could not record that just now. Please try again.' });
    }

    const dueAt = slaDueAt({
      created_at: createdAt,
      urgency: parsed.data.urgency,
      first_response_at: null,
      closed_at: null,
    });
    const log = (req as AuthenticatedRequest).log ?? baseLog;

    // Pages the wellness team. Never blocks or fails the submission, and carries
    // only the reference, urgency and topic — the student's words stay in the DB.
    await notifyNewNote(
      {
        reference,
        urgency: parsed.data.urgency,
        supportTopic: parsed.data.topic,
        createdAt,
        dueAt,
      },
      log
    );

    // Optional Discord channel alert for the counselling/moderation team. Not
    // awaited: the note is stored, so a slow or missing Discord must not delay
    // the student's confirmation. Same triage fields, no free text.
    void sendDiscordAlert(
      buildReachOutAlert({
        reference,
        supportTopic: parsed.data.topic,
        urgency: parsed.data.urgency,
        contactMethod: parsed.data.contactMethod,
        createdAt,
        dueAt,
      }),
      log
    );

    return res.status(201).json({ ok: true, reference, receivedAt: createdAt });
  });

  app.post('/api/v1/rooms/token', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    const parsed = roomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid room payload', details: parsed.error.flatten() });
    }

    const { roomName, userName, email, title } = parsed.data;
    const userId = req.user!.id;
    const nowSeconds = Math.floor(Date.now() / 1000);
    let meeting: { id: string };

    try {
      // Create-if-absent only: this path may never change the caller's role.
      await ensureUser({
        id: userId,
        email: req.user!.email ?? email ?? `${userId}@daraja.local`,
        fullName: req.user!.name ?? userName,
      });
      meeting = await createMeeting({
        roomKey: roomName,
        title: title ?? roomName,
        hostId: userId,
      });
    } catch (error) {
      req.log?.error('meeting.persistence_failed', { error });
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
      req.log?.error('attendance.write_failed', { error });
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
      req.log?.error('telemetry.write_failed', { error });
      return res.status(503).json({ error: 'Telemetry persistence is unavailable' });
    }

    return res.status(202).json({ ok: true, message: 'Telemetry received', event, supabaseConfigured });
  });

  app.get('/api/v1/telemetry', requireAuth(['admin', 'facilitator']), (_req, res) => {
    res.json({ count: 0, events: [] });
  });

  // Roster-wide meetings and attendance: facilitator/admin scope, not public.
  app.get('/api/v1/dashboard/summary', requireAuth(['admin', 'facilitator']), async (req: AuthenticatedRequest, res) => {
    try {
      return res.json(await getDashboardSummary());
    } catch (error) {
      req.log?.error('dashboard.summary_failed', { error });
      return res.status(503).json({ error: 'Dashboard data is unavailable' });
    }
  });

  return app;
}
