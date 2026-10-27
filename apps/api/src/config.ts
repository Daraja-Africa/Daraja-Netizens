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
};

if (config.nodeEnv === 'production' && (!config.jwtSecret || !config.supabaseServiceRoleKey)) {
  throw new Error('JWT_SECRET and SUPABASE_SERVICE_ROLE_KEY are required in production');
}
