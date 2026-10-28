import type { NextFunction, Request, Response } from 'express';

import { getSupabaseClient } from './supabase.js';

export type AppRole = 'admin' | 'facilitator' | 'student' | 'participant';

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string;
    role: AppRole;
    name?: string;
  };
};

export function requireAuth(allowedRoles?: AppRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authorization = req.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const supabase = getSupabaseClient();

    if (!token || !supabase) {
      if (process.env.NODE_ENV !== 'production') {
        req.user = { id: '00000000-0000-4000-8000-000000000001', role: 'facilitator', name: 'Local facilitator' };
        return next();
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const profile = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', data.user.id)
      .maybeSingle();
    const role = (profile.data?.role as AppRole | undefined) ?? 'student';

    if (allowedRoles && !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.user = { id: data.user.id, email: data.user.email, role, name: profile.data?.full_name };
    return next();
  };
}
