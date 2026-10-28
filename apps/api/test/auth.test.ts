import assert from 'node:assert/strict';
import test from 'node:test';

import { requireAuth, type AuthenticatedRequest } from '../src/auth.js';

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

test('local auth mode supplies the facilitator demo identity', async () => {
  const previous = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  const req = {
    header: () => undefined,
  } as unknown as AuthenticatedRequest;
  const res = response();
  let called = false;

  await requireAuth()(req, res as never, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(req.user?.role, 'facilitator');
  if (previous) process.env.NODE_ENV = previous;
});

test('production auth rejects requests without a bearer token', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const req = {
    header: () => undefined,
  } as unknown as AuthenticatedRequest;
  const res = response();

  await requireAuth()(req, res as never, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Authentication required' });
  if (previous) process.env.NODE_ENV = previous;
  else delete process.env.NODE_ENV;
});
