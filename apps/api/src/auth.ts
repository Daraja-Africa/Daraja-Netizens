import type { NextFunction, Request, Response } from 'express';

import { getSupabaseClient, resolveOrSyncAuthorizedUser } from './supabase.js';

export type AppRole = 'admin' | 'facilitator' | 'student' | 'participant';

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string;
    role: AppRole;
    name?: string;
  };
};

const NOT_ALLOWLISTED_MESSAGE = 'Your Google account is not registered on the Daraja Facilitator allowlist.';

export function requireAuth(allowedRoles?: AppRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authorization = req.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const supabase = getSupabaseClient();

    if (!token || !supabase) {
      if (process.env.NODE_ENV !== 'production') {
        // Local fallback identity; it still has to satisfy the route's role list
        // so an admin-only route is never served without an admin session.
        const localRole: AppRole = 'facilitator';
        if (allowedRoles && !allowedRoles.includes(localRole)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        req.user = { id: '00000000-0000-4000-8000-000000000001', role: localRole, name: 'Local facilitator' };
        return next();
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    let profile: Awaited<ReturnType<typeof resolveOrSyncAuthorizedUser>>;
    try {
      profile = await resolveOrSyncAuthorizedUser({
        id: data.user.id,
        email: data.user.email,
        fullName: typeof data.user.user_metadata?.full_name === 'string' ? data.user.user_metadata.full_name : undefined,
      });
    } catch (profileError) {
      console.error('Profile resolution failed', profileError);
      return res.status(503).json({ error: 'Profile resolution unavailable' });
    }

    // Module 1 is limited to the profiles already on the roster.
    if (!profile) {
      return res.status(403).json({ error: 'NOT_ALLOWLISTED', message: NOT_ALLOWLISTED_MESSAGE });
    }

    const role = profile.role as AppRole;
    if (allowedRoles && !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.user = { id: profile.id, email: profile.email, role, name: profile.full_name };
    return next();
  };
}
