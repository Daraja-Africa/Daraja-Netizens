import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthGuard, requireAuth, type AuthenticatedRequest } from '../src/auth.js';

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
