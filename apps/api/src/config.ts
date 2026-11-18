import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'development-secret'),
  jwtIssuer: process.env.JWT_ISSUER ?? 'daraja-netizens',
  jitsiDomain: process.env.JITSI_DOMAIN ?? 'meet.jit.si',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  writeRateLimitWindowMs: Number(process.env.WRITE_RATE_LIMIT_WINDOW_MS ?? 60_000),
  writeRateLimitMax: Number(process.env.WRITE_RATE_LIMIT_MAX ?? 120),
  // Optional external channel (email/SMS relay, chat or incident webhook) used
  // to page the wellness team when a confidential note arrives. Unset means the
  // alert is written to the structured log only.
  reachOutAlertWebhook: process.env.REACH_OUT_ALERT_WEBHOOK ?? '',
  // Discord integration, both optional. The channel webhook URL is a credential
  // and stays server-side; the application public key verifies incoming webhook
  // signatures (see src/discord.ts). Unset means the integration is off.
  discordAlertWebhookUrl: process.env.DISCORD_ALERT_WEBHOOK_URL ?? '',
  discordPublicKey: process.env.DISCORD_PUBLIC_KEY ?? '',
  // The application id from the Discord Developer Portal. Used to write the
  // Linked Roles connection for a verified facilitator, so unset means the
  // /discord/verify-user flow answers 503.
  discordClientId: process.env.DISCORD_CLIENT_ID ?? '',
};

if (config.nodeEnv === 'production' && (!config.jwtSecret || !config.supabaseServiceRoleKey)) {
  throw new Error('JWT_SECRET and SUPABASE_SERVICE_ROLE_KEY are required in production');
}

if (config.nodeEnv === 'production' && process.env.ALLOW_DEMO_AUTH === '1') {
  throw new Error('ALLOW_DEMO_AUTH must never be set in production: it serves an unauthenticated facilitator console');
}
