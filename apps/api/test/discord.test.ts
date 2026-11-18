import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import test from 'node:test';

import type { IdentityResolver } from '../src/auth.js';
import type { Logger } from '../src/logger.js';

// A throwaway Ed25519 pair stands in for the Discord application key. The public
// key is configured before the app (and therefore src/config.ts) is imported.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
process.env.DISCORD_PUBLIC_KEY = publicKeyHex;
process.env.DISCORD_CLIENT_ID = '123456789012345678';

const { createApp } = await import('../src/app.js');
const { buildReachOutAlert, sendDiscordAlert, syncDiscordRoleConnection, verifyDiscordRequest } = await import(
  '../src/discord.js'
);
const quiet: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => quiet,
};

let server: Server;
let baseUrl = '';

test.before(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to bind');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function signedHeaders(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(body, 'utf8')]),
    privateKey
  ).toString('hex');
  return { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp };
}

async function postWebhook(body: string, headers: Record<string, string>) {
  const response = await fetch(`${baseUrl}/api/v1/discord/webhooks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
  return { status: response.status, text: await response.text() };
}

test('a webhook without signature headers is rejected', async () => {
  const result = await postWebhook(JSON.stringify({ type: 0 }), {});
  assert.equal(result.status, 401);
});

test('a webhook whose body changed after signing is rejected', async () => {
  const headers = signedHeaders(JSON.stringify({ type: 0 }));
  const result = await postWebhook(JSON.stringify({ type: 7 }), headers);
  assert.equal(result.status, 401);
});

test('a signed PING verification probe answers 204 with no body', async () => {
  const body = JSON.stringify({ type: 0 });
  const result = await postWebhook(body, signedHeaders(body));
  assert.equal(result.status, 204);
  assert.equal(result.text, '');
});

test('a signed application event is acknowledged', async () => {
  const body = JSON.stringify({ type: 1, event: 'APPLICATION_AUTHORIZED', t: '2026-11-18T08:00:00.000Z' });
  const result = await postWebhook(body, signedHeaders(body));
  assert.equal(result.status, 204);
});

async function postInteraction(body: string, headers: Record<string, string>) {
  const response = await fetch(`${baseUrl}/api/v1/discord/interactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
  return { status: response.status, payload: (await response.json().catch(() => null)) as Record<string, unknown> | null };
}

test('the interactions endpoint rejects an unsigned probe with 401', async () => {
  const result = await postInteraction(JSON.stringify({ type: 1 }), {});
  assert.equal(result.status, 401);
});

test('a signed PING answers with a PONG so Discord can save the endpoint URL', async () => {
  const body = JSON.stringify({ type: 1 });
  const result = await postInteraction(body, signedHeaders(body));
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, { type: 1 });
});

test('a signature from a foreign key is refused', async () => {
  const body = JSON.stringify({ type: 1 });
  const stranger = generateKeyPairSync('ed25519');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]), stranger.privateKey).toString('hex');
  const result = await postInteraction(body, { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp });
  assert.equal(result.status, 401);
});

test('an application command gets the Daraja message and other types are acknowledged', async () => {
  const command = JSON.stringify({ type: 2, data: { name: 'daraja' } });
  const commandResult = await postInteraction(command, signedHeaders(command));
  assert.equal(commandResult.status, 200);
  assert.equal(commandResult.payload?.type, 4);
  assert.match(String((commandResult.payload?.data as { content?: string })?.content), /darajanetizens\.cc\.cd/);

  const other = JSON.stringify({ type: 3 });
  const otherResult = await postInteraction(other, signedHeaders(other));
  assert.deepEqual(otherResult.payload, { type: 4, data: { content: 'Interaction received.' } });
});

async function withApp(
  resolveIdentity: IdentityResolver,
  run: (url: string) => Promise<void>
) {
  const app = createApp({ resolveIdentity, logger: quiet });
  const local = createServer(app);
  await new Promise<void>((resolve) => local.listen(0, '127.0.0.1', resolve));
  const address = local.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to bind');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => local.close(() => resolve()));
  }
}

const facilitator: IdentityResolver = async () => ({
  status: 'ok',
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'faith@daraja.test', role: 'facilitator', name: 'Faith W.' },
});

const student: IdentityResolver = async () => ({
  status: 'ok',
  user: { id: '22222222-2222-4222-8222-222222222222', email: 'student@daraja.test', role: 'student' },
});

test('a verified facilitator gets their own Discord role connection written', async () => {
  const calls: Array<{ url: string; authorization: string | undefined; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://discord.com/')) return originalFetch(input, init);
    calls.push({
      url,
      authorization: new Headers(init?.headers).get('authorization') ?? undefined,
      body: JSON.parse(String(init?.body ?? '{}')) as unknown,
    });
    return new Response('{"metadata":{}}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    await withApp(facilitator, async (url) => {
      const response = await fetch(`${url}/api/v1/discord/linked-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer supabase-jwt' },
        body: JSON.stringify({ providerToken: 'discord-provider-credential' }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { verified: true, role: 'facilitator' });
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/users\/@me\/applications\/\d+\/role-connection$/);
  assert.equal(calls[0].authorization, 'Bearer discord-provider-credential');
  assert.deepEqual(calls[0].body, {
    platform_name: 'Daraja Netizens',
    platform_username: 'Faith W.',
    metadata: { verified_facilitator: 1 },
  });
});

test('a student account cannot write a facilitator role connection', async () => {
  let discordCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('https://discord.com/')) return originalFetch(input, init);
    discordCalled = true;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  try {
    await withApp(student, async (url) => {
      const response = await fetch(`${url}/api/v1/discord/linked-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer supabase-jwt' },
        body: JSON.stringify({ providerToken: 'discord-provider-credential' }),
      });
      assert.equal(response.status, 403);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(discordCalled, false, 'Discord must never be called for a non-facilitator');
});

test('an account missing from the roster is refused', async () => {
  let discordCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('https://discord.com/')) return originalFetch(input, init);
    discordCalled = true;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  const notListed: IdentityResolver = async () => ({ status: 'not_allowlisted' });

  try {
    await withApp(notListed, async (url) => {
      const listed = await fetch(`${url}/api/v1/discord/linked-roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer supabase-jwt' },
        body: JSON.stringify({ providerToken: 'discord-provider-credential' }),
      });
      assert.equal(listed.status, 403);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(discordCalled, false);
});

test('syncDiscordRoleConnection reports a missing application id without calling Discord', async () => {
  const result = await syncDiscordRoleConnection({
    providerToken: 'discord-provider-credential',
    clientId: '',
    platformUsername: 'Faith W.',
    log: quiet,
  });
  assert.deepEqual(result, { ok: false, reason: 'not_configured' });
});

test('verifyDiscordRequest only accepts a signature from the configured application key', () => {
  const timestamp = '1763481600';
  const body = Buffer.from(JSON.stringify({ type: 0 }), 'utf8');
  const stranger = generateKeyPairSync('ed25519');
  const foreignSignature = sign(
    null,
    Buffer.concat([Buffer.from(timestamp, 'utf8'), body]),
    stranger.privateKey
  ).toString('hex');

  assert.equal(verifyDiscordRequest({ publicKey: publicKeyHex, signature: foreignSignature, timestamp, body }), false);
  assert.equal(verifyDiscordRequest({ publicKey: publicKeyHex, signature: undefined, timestamp, body }), false);
  assert.equal(verifyDiscordRequest({ publicKey: publicKeyHex, signature: foreignSignature, timestamp: undefined, body }), false);
  assert.equal(verifyDiscordRequest({ publicKey: 'not-a-public-key', signature: foreignSignature, timestamp, body }), false);
  assert.equal(verifyDiscordRequest({ publicKey: publicKeyHex, signature: foreignSignature, timestamp, body: Buffer.alloc(0) }), false);
});

test('the reach-out alert shows triage fields and no student free text', () => {
  const alert = buildReachOutAlert({
    reference: 'DN-ABC123',
    supportTopic: 'stress-anxiety',
    urgency: 'within-24-hours',
    contactMethod: 'whatsapp',
    createdAt: '2026-11-18T08:00:00.000Z',
    dueAt: '2026-11-19T08:00:00.000Z',
  });

  const embed = alert.embeds[0];
  const fields = Object.fromEntries((embed.fields ?? []).map((field) => [field.name, field.value]));
  assert.equal(fields['Support topic'], 'Stress & anxiety');
  assert.equal(fields['Urgency'], 'Within 24 hours');
  assert.equal(fields['Preferred contact channel'], 'WhatsApp');
  assert.ok(fields.Submitted.startsWith('<t:'), 'submitted timestamp is rendered in Discord local time');
  assert.ok(fields['First contact due'].startsWith('<t:'));

  const serialised = JSON.stringify(alert);
  assert.ok(!serialised.includes('+254'), 'the contact detail must never be posted');
  assert.ok(!serialised.includes('struggling'), 'the note body must never be posted');
});

test('sendDiscordAlert degrades to a warning when no webhook is configured', async () => {
  const warnings: string[] = [];
  const quiet: Logger = {
    info: () => {},
    warn: (message) => { warnings.push(message); },
    error: () => {},
    child: () => quiet,
  };

  const result = await sendDiscordAlert(
    buildReachOutAlert({
      reference: 'DN-ABC123',
      supportTopic: 'other',
      urgency: 'general-check-in',
      contactMethod: 'email',
      createdAt: '2026-11-18T08:00:00.000Z',
      dueAt: null,
    }),
    quiet
  );

  assert.deepEqual(result, { delivered: false, reason: 'not_configured' });
  assert.deepEqual(warnings, ['discord.alert_not_configured']);
});
