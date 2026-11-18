/**
 * Discord integration, server side only.
 *
 * Two directions, two very different trust models:
 *
 * - Outgoing: `sendDiscordAlert` posts rich embeds to a channel webhook so the
 *   counselling/moderation team hears about a confidential note immediately.
 *   The webhook URL is a bearer credential, so it stays in the API environment
 *   and is never handed to the web app.
 * - Incoming: `verifyDiscordRequest` checks the Ed25519 signature Discord puts
 *   on every interaction/webhook request, using the application's public key.
 *
 * Neither path may ever fail a user's request: a note is stored before the alert
 * is attempted, and Discord outages only produce a warning in the log.
 */

import { createPublicKey, verify as verifyEd25519 } from 'node:crypto';

import { config } from './config.js';
import type { Logger } from './logger.js';
import type { ReachOutUrgency } from './reachOut.js';

/** Discord is a courtesy notification, never a dependency of the request. */
const ALERT_TIMEOUT_MS = 5_000;

/** DER prefix that turns a raw 32-byte Ed25519 key into an SPKI public key. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export type DiscordEmbedField = { name: string; value: string; inline?: boolean };

export type DiscordEmbed = {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
};

export type DiscordAlert = { embeds: DiscordEmbed[] };

/**
 * Posts an embed to the configured channel webhook.
 *
 * Never throws and never blocks the caller: unset configuration, a Discord
 * outage, a rate limit or a hung connection all end in a logged warning.
 */
export async function sendDiscordAlert(
  alert: DiscordAlert,
  log: Logger
): Promise<{ delivered: boolean; reason?: string }> {
  const url = config.discordAlertWebhookUrl;
  if (!url) {
    log.warn('discord.alert_not_configured', {
      title: alert.embeds[0]?.title,
      hint: 'Set DISCORD_ALERT_WEBHOOK_URL to post alerts to a Discord channel',
    });
    return { delivered: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Mentions are never parsed: nothing a student typed can ping the server.
      body: JSON.stringify({ ...alert, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });
    if (!response.ok) {
      log.warn('discord.alert_failed', { status: response.status, title: alert.embeds[0]?.title });
      return { delivered: false, reason: `status ${response.status}` };
    }
    log.info('discord.alert_sent', { title: alert.embeds[0]?.title });
    return { delivered: true };
  } catch (error) {
    log.warn('discord.alert_failed', { error, title: alert.embeds[0]?.title });
    return { delivered: false, reason: 'network' };
  }
}

const topicLabels: Record<string, string> = {
  'stress-anxiety': 'Stress & anxiety',
  'low-mood': 'Low mood',
  relationships: 'Relationships',
  grief: 'Grief',
  'digital-wellbeing': 'Digital wellbeing',
  'supporting-a-friend': 'Supporting a friend',
  other: 'Other',
};

const urgencyLabels: Record<ReachOutUrgency, string> = {
  'within-24-hours': 'Within 24 hours',
  'this-week': 'This week',
  'general-check-in': 'General check-in',
};

const urgencyColors: Record<ReachOutUrgency, number> = {
  'within-24-hours': 0xa34e1c,
  'this-week': 0xc2652a,
  'general-check-in': 0x176b43,
};

const methodLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Phone call',
  sms: 'SMS',
  email: 'Email',
};

export type ReachOutAlertInput = {
  reference: string;
  supportTopic: string;
  urgency: ReachOutUrgency;
  contactMethod: string;
  createdAt: string;
  dueAt: string | null;
};

/**
 * The triage embed: just enough for a supporter to act, and nothing a student
 * would not want read in a chat channel. The note itself, the contact detail and
 * the student's name stay in the database behind the audited inbox.
 */
export function buildReachOutAlert(input: ReachOutAlertInput): DiscordAlert {
  const fields: DiscordEmbedField[] = [
    { name: 'Support topic', value: topicLabels[input.supportTopic] ?? input.supportTopic, inline: true },
    { name: 'Urgency', value: urgencyLabels[input.urgency] ?? input.urgency, inline: true },
    { name: 'Preferred contact channel', value: methodLabels[input.contactMethod] ?? input.contactMethod, inline: true },
    { name: 'Submitted', value: `<t:${Math.floor(new Date(input.createdAt).getTime() / 1000)}:f>`, inline: false },
  ];
  if (input.dueAt) {
    fields.push({ name: 'First contact due', value: `<t:${Math.floor(new Date(input.dueAt).getTime() / 1000)}:R>`, inline: false });
  }

  return {
    embeds: [
      {
        title: `New confidential reach-out note ${input.reference}`,
        description:
          'Read it in the facilitator Reach-out inbox. The note and contact detail are never posted here.',
        color: urgencyColors[input.urgency] ?? urgencyColors['this-week'],
        fields,
        footer: { text: 'Daraja Netizens · confidential' },
        timestamp: input.createdAt,
      },
    ],
  };
}

export type DiscordSignatureInput = {
  publicKey: string;
  signature: string | undefined;
  timestamp: string | undefined;
  body: Buffer;
};

/**
 * Discord signs `timestamp + raw body` with its application private key. The
 * body must be the untouched bytes, which is why the route buffers it raw.
 */
export function verifyDiscordRequest(input: DiscordSignatureInput): boolean {
  const { publicKey, signature, timestamp, body } = input;
  if (!publicKey || !signature || !timestamp || body.length === 0) return false;
  if (!/^[0-9a-f]{64}$/i.test(publicKey)) return false;

  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    return verifyEd25519(
      null,
      Buffer.concat([Buffer.from(timestamp, 'utf8'), body]),
      key,
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}
