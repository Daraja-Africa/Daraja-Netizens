import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthGuard, requireAuth, type AuthenticatedRequest } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { FirstLoginSetupError } from '../src/supabase.js';

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function request() {
  return { header: () => undefined } as unknown as AuthenticatedRequest;
}

test('an anonymous request without a token is rejected by default', async () => {
  const previous = process.env.ALLOW_DEMO_AUTH;
  delete process.env.ALLOW_DEMO_AUTH;

  const req = request();
  const res = response();

  await requireAuth()(req, res as never, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Authentication required' });
  assert.equal(req.user, undefined);

  if (previous) process.env.ALLOW_DEMO_AUTH = previous;
});

test('the demo identity needs an explicit opt-in', async () => {
  const previous = process.env.ALLOW_DEMO_AUTH;
  process.env.ALLOW_DEMO_AUTH = '1';
  const previousRole = process.env.DEMO_AUTH_ROLE;
  delete process.env.DEMO_AUTH_ROLE;

  const req = request();
  let called = false;
  await requireAuth()(req, response() as never, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(req.user?.role, 'facilitator');

  if (previous) process.env.ALLOW_DEMO_AUTH = previous;
  else delete process.env.ALLOW_DEMO_AUTH;
  if (previousRole) process.env.DEMO_AUTH_ROLE = previousRole;
});

test('the demo identity still obeys the route role list', async () => {
  const previous = process.env.ALLOW_DEMO_AUTH;
  const previousRole = process.env.DEMO_AUTH_ROLE;
  process.env.ALLOW_DEMO_AUTH = '1';
  process.env.DEMO_AUTH_ROLE = 'student';

  const res = response();
  await requireAuth(['admin', 'facilitator'])(request(), res as never, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 403);

  if (previous) process.env.ALLOW_DEMO_AUTH = previous;
  else delete process.env.ALLOW_DEMO_AUTH;
  if (previousRole) process.env.DEMO_AUTH_ROLE = previousRole;
  else delete process.env.DEMO_AUTH_ROLE;
});

test('profile resolution failures show the exact unavailable state', async () => {
  const guarded = createAuthGuard(async () => ({
    status: 'unavailable',
    detail: 'Profile database timed out',
  }));
  const res = response();

  await guarded()(requestWithBearer(), res as never, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'Profile resolution unavailable' });
});

function requestWithBearer() {
  return {
    header(name: string) {
      return name.toLowerCase() === 'authorization' ? 'Bearer ' + 'test-token' : undefined;
    },
  } as unknown as AuthenticatedRequest;
}

async function postFirstLogin(path: string, body: Record<string, string>, deps: Parameters<typeof createApp>[0]) {
  const app = createApp(deps);
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('first-login check reports allowlist and password states', async () => {
  const states = new Map([
    ['missing@example.com', { status: 'not_allowlisted' as const }],
    ['new@example.com', { status: 'needs_password' as const, email: 'new@example.com', fullName: 'New Member', role: 'facilitator' }],
    ['member@example.com', { status: 'has_password' as const, email: 'member@example.com', fullName: 'Existing Member', role: 'facilitator' }],
  ]);
  const deps = { checkMemberPasswordStatus: async (email: string) => states.get(email) ?? { status: 'not_allowlisted' as const } };

  assert.deepEqual(await postFirstLogin('/api/v1/auth/first-login/check', { email: 'missing@example.com' }, deps), {
    status: 200, body: { status: 'not_allowlisted' },
  });
  assert.deepEqual(await postFirstLogin('/api/v1/auth/first-login/check', { email: 'new@example.com' }, deps), {
    status: 200, body: { status: 'needs_password', fullName: 'New Member' },
  });
  assert.deepEqual(await postFirstLogin('/api/v1/auth/first-login/check', { email: 'member@example.com' }, deps), {
    status: 200, body: { status: 'has_password', fullName: 'Existing Member' },
  });
});

test('first-login setup provisions a new password and cannot overwrite one', async () => {
  const success = await postFirstLogin('/api/v1/auth/first-login/setup', { email: 'new@example.com', password: 'password123' }, {
    completeFirstLoginPasswordSetup: async (email) => ({ ok: true as const, email }),
  });
  assert.deepEqual(success, { status: 200, body: { ok: true, email: 'new@example.com' } });

  const conflict = await postFirstLogin('/api/v1/auth/first-login/setup', { email: 'member@example.com', password: 'password123' }, {
    completeFirstLoginPasswordSetup: async () => {
      throw new FirstLoginSetupError(409, 'A password is already configured for this account. Sign in with your password.');
    },
  });
  assert.deepEqual(conflict, {
    status: 409,
    body: { error: 'A password is already configured for this account. Sign in with your password.' },
  });
});
