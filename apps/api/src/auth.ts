import type { NextFunction, Request, Response } from 'express';

import { logger, type Logger } from './logger.js';
import { getSupabaseClient, resolveOrSyncAuthorizedUser } from './supabase.js';

export type AppRole = 'admin' | 'facilitator' | 'student' | 'participant' | 'host';

export type AuthenticatedUser = {
  id: string;
  email?: string;
  role: AppRole;
  name?: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  log?: Logger;
};

const NOT_ALLOWLISTED_MESSAGE = 'Your email address is not registered on the Daraja allowlist.';

/**
 * The demo identity is a local-development convenience, never a default.
 *
 * It used to appear whenever `NODE_ENV !== 'production'`, which meant any
 * preview or staging deployment that forgot that variable served an open
 * facilitator console: roster, attendance imports, member PII and QR issuance.
 * It now needs an explicit `ALLOW_DEMO_AUTH=1`, and boot refuses that flag in
 * production.
 */
export function isDemoAuthEnabled() {
  return process.env.ALLOW_DEMO_AUTH === '1';
}

function demoIdentity(): AuthenticatedUser {
  const requested = process.env.DEMO_AUTH_ROLE;
  const role: AppRole = requested === 'admin' || requested === 'student' ? requested : 'facilitator';
  return {
    id: '00000000-0000-4000-8000-000000000001',
    role,
    name: role === 'facilitator' ? 'Local facilitator' : 'Local user',
  };
}

export type IdentityResult =
  | { status: 'ok'; user: AuthenticatedUser }
  | { status: 'invalid' }
  | { status: 'not_allowlisted' }
  | { status: 'unavailable'; detail: string };

export type IdentityResolver = (token: string) => Promise<IdentityResult>;

/** Verifies the bearer token with Supabase and resolves the allowlisted profile behind it. */
export const resolveIdentityFromToken: IdentityResolver = async (token) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { status: 'unavailable', detail: 'Supabase is not configured' };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { status: 'invalid' };

  try {
    const profile = await resolveOrSyncAuthorizedUser({
      id: data.user.id,
      email: data.user.email,
      fullName: typeof data.user.user_metadata?.full_name === 'string' ? data.user.user_metadata.full_name : undefined,
    });
    // Module 1 is limited to the profiles already on the roster.
    if (!profile) return { status: 'not_allowlisted' };
    return {
      status: 'ok',
      user: { id: profile.id, email: profile.email, role: profile.role as AppRole, name: profile.full_name },
    };
  } catch (profileError) {
    return {
      status: 'unavailable',
      detail: profileError instanceof Error ? profileError.message : 'Profile resolution failed',
    };
  }
};

export function createAuthGuard(resolve: IdentityResolver = resolveIdentityFromToken) {
  return function requireAuth(allowedRoles?: AppRole[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const log = req.log ?? logger;
      const authorization = req.header('authorization');
      const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

      if (!token) {
        if (isDemoAuthEnabled()) {
          const user = demoIdentity();
          if (allowedRoles && !allowedRoles.includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
          req.user = user;
          return next();
        }
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await resolve(token);
      if (result.status === 'invalid') {
        log.warn('auth.token_rejected');
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      if (result.status === 'unavailable') {
        log.error('auth.profile_resolution_failed', { detail: result.detail });
        return res.status(503).json({ error: 'Profile resolution unavailable' });
      }
      if (result.status === 'not_allowlisted') {
        return res.status(403).json({ error: 'NOT_ALLOWLISTED', message: NOT_ALLOWLISTED_MESSAGE });
      }

      if (allowedRoles && !allowedRoles.includes(result.user.role)) {
        log.warn('auth.role_rejected', { role: result.user.role, route: req.originalUrl, allowed: allowedRoles });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user = result.user;
      return next();
    };
  };
}

/** Guard that resolves identities through Supabase, as the running API uses it. */
export const requireAuth = createAuthGuard();
