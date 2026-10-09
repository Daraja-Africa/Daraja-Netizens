import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'development-secret',
  jwtIssuer: process.env.JWT_ISSUER ?? 'daraja-netizens',
  jitsiDomain: process.env.JITSI_DOMAIN ?? 'meet.jit.si',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
};
