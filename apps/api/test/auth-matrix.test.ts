import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';

import { createApp } from '../src/app.js';
import type { IdentityResolver } from '../src/auth.js';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const FACILITATOR_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const HOST_ID = '55555555-5555-4555-8555-555555555555';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';

const resolveIdentity: IdentityResolver = async (token) => {
  if (token === 'student-token') return { status: 'ok', user: { id: STUDENT_ID, role: 'student', name: 'Student' } };
  if (token === 'facilitator-token') return { status: 'ok', user: { id: FACILITATOR_ID, role: 'facilitator', name: 'Facilitator' } };
  if (token === 'admin-token') return { status: 'ok', user: { id: ADMIN_ID, role: 'admin', name: 'Named admin' } };
  if (token === 'host-token') return { status: 'ok', user: { id: HOST_ID, role: 'host', name: 'Sheila Ngumi' } };
  if (token === 'unlisted-token') return { status: 'not_allowlisted' };
  return { status: 'invalid' };
};

let server: Server;
let baseUrl = '';

test.before(async () => {
  server = createServer(createApp({ resolveIdentity }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to bind');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function call(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = 'Bearer ' + options.token;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    body: (await response.json().catch(() => null)) as Record<string, unknown> | null,
    requestId: response.headers.get('x-request-id'),
  };
}

const roomPayload = {
  roomName: 'daraja-training-room',
  userId: STUDENT_ID,
  userName: 'Student',
  title: 'Training',
};

/** Every route that is not deliberately public, with a body that would otherwise pass validation. */
const protectedRoutes: Array<{ method: string; path: string; body?: unknown; facilitatorOnly: boolean; adminOnly?: boolean }> = [
  { method: 'GET', path: '/api/v1/auth/me', facilitatorOnly: false },
  { method: 'GET', path: '/api/v1/facilitator/dashboard', facilitatorOnly: true },
  { method: 'GET', path: '/api/v1/facilitator/reach-out', facilitatorOnly: true },
  { method: 'GET', path: '/api/v1/facilitator/attendance/data', facilitatorOnly: true },
  { method: 'GET', path: '/api/v1/dashboard/summary', facilitatorOnly: true },
  { method: 'GET', path: '/api/v1/telemetry', facilitatorOnly: true },
  { method: 'POST', path: '/api/v1/attendance/qr', body: { sessionId: SESSION_ID }, facilitatorOnly: true },
  { method: 'POST', path: '/api/v1/rooms/token', body: roomPayload, facilitatorOnly: true },
  { method: 'GET', path: '/api/v1/facilitator/eligibility', facilitatorOnly: false },
  { method: 'POST', path: '/api/v1/attendance', body: { meetingId: SESSION_ID, userId: STUDENT_ID, joinedAt: new Date().toISOString() }, facilitatorOnly: false },
  { method: 'POST', path: '/api/v1/telemetry', body: { eventType: 'CONFERENCE_JOINED', meetingId: SESSION_ID, userId: STUDENT_ID, timestamp: Date.now() }, facilitatorOnly: false },
  { method: 'POST', path: '/api/v1/attendance/qr/redeem', body: { token: 'a-valid-length-qr-token' }, facilitatorOnly: false },
  { method: 'POST', path: '/api/v1/discord/linked-roles', body: { providerToken: 'discord-provider-credential' }, facilitatorOnly: true },
  { method: 'GET', path: '/api/v1/admin/overview', facilitatorOnly: false, adminOnly: true },
  { method: 'GET', path: '/api/v1/admin/members', facilitatorOnly: false, adminOnly: true },
  { method: 'GET', path: '/api/v1/admin/facilitators', facilitatorOnly: false, adminOnly: true },
  { method: 'GET', path: '/api/v1/admin/program', facilitatorOnly: false, adminOnly: true },
];

test('every protected route rejects an anonymous caller', async () => {
  for (const route of protectedRoutes) {
    const result = await call(route.method, route.path, { body: route.body });
    assert.equal(result.status, 401, `${route.method} ${route.path} should require a token`);
    assert.deepEqual(result.body, { error: 'Authentication required' });
    assert.ok(result.requestId, `${route.path} should carry a request id`);
  }
});

test('a token Supabase does not accept is rejected', async () => {
  const result = await call('GET', '/api/v1/auth/me', { token: 'not-a-real-token' });
  assert.equal(result.status, 401);
});

test('an account that is not on the roster is denied', async () => {
  const result = await call('GET', '/api/v1/auth/me', { token: 'unlisted-token' });
  assert.equal(result.status, 403);
  assert.equal(result.body?.error, 'NOT_ALLOWLISTED');
});

test('a student is denied every facilitator-only route', async () => {
  for (const route of protectedRoutes.filter((entry) => entry.facilitatorOnly)) {
    const result = await call(route.method, route.path, { token: 'student-token', body: route.body });
    assert.equal(result.status, 403, `${route.method} ${route.path} must not be reachable by a student`);
    assert.equal(result.body?.error, 'Insufficient permissions');
  }
});

test('a student keeps access to the student-facing routes', async () => {
  for (const route of protectedRoutes.filter((entry) => !entry.facilitatorOnly && !entry.adminOnly)) {
    const result = await call(route.method, route.path, { token: 'student-token', body: route.body });
    assert.notEqual(result.status, 403, `${route.method} ${route.path} should stay open to a student`);
    assert.ok(result.status < 500, `${route.method} ${route.path} returned ${result.status}`);
  }
});

test('a facilitator reaches the facilitator console routes', async () => {
  for (const route of protectedRoutes.filter((entry) => entry.facilitatorOnly)) {
    const result = await call(route.method, route.path, { token: 'facilitator-token', body: route.body });
    // Some of these need a database; what this asserts is that the guard let the
    // facilitator through instead of turning them away.
    assert.ok(
      result.status !== 401 && result.status !== 403,
      `${route.method} ${route.path} rejected a facilitator with ${result.status}`
    );
  }
});

test('named admin accounts reach facilitator and admin-only routes', async () => {
  for (const route of protectedRoutes.filter((entry) => entry.facilitatorOnly || entry.adminOnly)) {
    const result = await call(route.method, route.path, { token: 'admin-token', body: route.body });
    assert.notEqual(result.status, 401, `${route.method} ${route.path} rejected a named admin`);
    assert.notEqual(result.status, 403, `${route.method} ${route.path} rejected a named admin`);
  }
});

test('facilitator-only and host-only accounts cannot reach admin-only routes', async () => {
  for (const route of protectedRoutes.filter((entry) => entry.adminOnly)) {
    for (const token of ['facilitator-token', 'host-token']) {
      const result = await call(route.method, route.path, { token, body: route.body });
      assert.equal(result.status, 403, `${token} must not reach ${route.method} ${route.path}`);
      assert.equal(result.body?.error, 'Insufficient permissions');
    }
  }
});

test('a host-only account does not receive facilitator routes', async () => {
  for (const route of protectedRoutes.filter((entry) => entry.facilitatorOnly)) {
    const result = await call(route.method, route.path, { token: 'host-token', body: route.body });
    assert.equal(result.status, 403, `${route.method} ${route.path} must not be reachable by a host`);
  }
});

test('the room token endpoint no longer promotes the caller', async () => {
  // The handler used to upsert role = facilitator onto whoever called it. With a
  // student token the request must not even reach the handler.
  const result = await call('POST', '/api/v1/rooms/token', { token: 'student-token', body: roomPayload });
  assert.equal(result.status, 403);

  const facilitatorResult = await call('POST', '/api/v1/rooms/token', { token: 'facilitator-token', body: roomPayload });
  assert.equal(facilitatorResult.status, 200);
  assert.equal(facilitatorResult.body?.roomName, roomPayload.roomName);
});

test('health is liveness-only and readiness checks the database', async () => {
  const health = await call('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body?.status, 'ok');
  assert.equal(health.body?.supabaseReady, undefined);

  const ready = await call('GET', '/api/ready');
  assert.equal(ready.status, 503);
  assert.equal(ready.body?.status, 'not_ready');
  const database = ready.body?.database as { ok?: boolean; detail?: string } | undefined;
  assert.equal(database?.ok, false);
  assert.match(String(database?.detail), /credentials/i);
});
