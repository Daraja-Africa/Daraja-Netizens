import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import test from 'node:test';

import type { Logger } from '../src/logger.js';

// A throwaway Ed25519 pair stands in for the Discord application key. The public
// key is configured before the app (and therefore src/config.ts) is imported.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
process.env.DISCORD_PUBLIC_KEY = publicKeyHex;

const { createApp } = await import('../src/app.js');
const { buildReachOutAlert, sendDiscordAlert, verifyDiscordRequest } = await import('../src/discord.js');

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
