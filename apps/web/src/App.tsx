import { useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

import AdminDashboard from './admin/AdminDashboard';
import { ApiError, apiFetch } from './api';
import FacilitatorDashboard from './facilitator/FacilitatorDashboard';
import { RoleSelector } from './RoleSelector';
import { navigate, parseStudentRoute, parseWorkspaceRoute, usePathname } from './router';
import { homePathForRole, isStaffRole, roleLabel, type AppRole, type AppUser } from './roles';
import StaffSignIn from './staff/StaffSignIn';
import StudentPortal from './student/StudentPortal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/** Without Supabase credentials the app runs as a local demo facilitator. */
const demoQueryRole = new URLSearchParams(window.location.search).get('role');
const demoRole: AppRole = demoQueryRole === 'student' || demoQueryRole === 'participant' ? demoQueryRole : 'facilitator';
const notAllowlistedNotice =
  'This Google account is not listed as an approved Daraja facilitator. Please sign in with your registered Daraja email or switch to the Student Portal.';

/**
 * The app shell: it resolves the signed-in account once, then hands the route to
 * the dashboard that account is allowed to open. Admins get the admin dashboard,
 * facilitators get the facilitator dashboard, members get the student portal.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [accessNotice, setAccessNotice] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authReady, setAuthReady] = useState(!supabase);

  const pathname = usePathname();
  const staffRoute = parseWorkspaceRoute(pathname);
  const studentRoute = parseStudentRoute(pathname);
  const accessToken = session?.access_token ?? null;
  const isDemo = !supabase;

  useEffect(() => {
    if (!supabase) {
      setUser({
        id: '00000000-0000-4000-8000-000000000001',
        role: demoRole,
        name: demoRole === 'facilitator' ? 'Local facilitator' : 'Local student',
      });
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!session) {
      setUser(null);
      return;
    }
    let active = true;
    void apiFetch('/api/v1/auth/me', accessToken)
      .then((data: { user: AppUser }) => {
        if (!active) return;
        setAccessNotice('');
        setUser(data.user);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 403 && error.payload?.error === 'NOT_ALLOWLISTED') {
          setAccessNotice(notAllowlistedNotice);
          setUser(null);
          void supabase?.auth.signOut();
          return;
        }
        setAuthError(error instanceof Error ? error.message : 'Your profile could not be loaded');
        setUser(null);
      });
    return () => {
      active = false;
    };
  }, [accessToken, session]);

  // Role gates the route: a facilitator is sent to their own dashboard, and a
  // member is sent to the student portal, so no staff screen renders for them.
  useEffect(() => {
    if (!user) return;
    if (staffRoute) {
      if (!isStaffRole(user.role)) {
        navigate('/student');
        return;
      }
      if (staffRoute.area === 'admin' && user.role !== 'admin') {
        navigate('/facilitator');
      }
      return;
    }
    if (!studentRoute && pathname === '/') navigate(homePathForRole(user.role));
  }, [pathname, staffRoute, studentRoute, user]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  async function signIn(email: string, password: string) {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError('');
    const result = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (result.error) setAuthError(result.error.message);
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setAuthError('');
    setAccessNotice('');
    const result = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (result.error) setAuthError(result.error.message);
  }

  function signOut() {
    void supabase?.auth.signOut();
    setUser(null);
    setAccessNotice('');
    navigate('/');
  }

  if (staffRoute) {
    if (!user) {
      if (!authReady) return <StatusScreen message="Checking your session…" />;
      if (session) return <StatusScreen message="Checking your access…" />;
      if (supabase) {
        return (
          <StaffSignIn
            accessNotice={accessNotice}
            authError={authError}
            busy={authBusy}
            onSignIn={(email, password) => void signIn(email, password)}
            onGoogle={() => void signInWithGoogle()}
            onBack={() => navigate('/')}
          />
        );
      }
      return <StatusScreen message="Preparing your workspace…" />;
    }

    if (!isStaffRole(user.role)) return <StatusScreen message="Taking you to the student portal…" />;

    const status = isDemo ? 'Local demo data' : `Signed in as ${roleLabel(user.role)}`;
    const dashboardProps = { user, accessToken, status, onSignOut: signOut };

    if (staffRoute.area === 'admin') {
      if (user.role !== 'admin') return <StatusScreen message="Taking you to your facilitator dashboard…" />;
      return <AdminDashboard page={staffRoute.page} {...dashboardProps} />;
    }
    return <FacilitatorDashboard page={staffRoute.page} {...dashboardProps} />;
  }

  if (studentRoute) return <StudentPortal />;

  return (
    <RoleSelector
      onSelect={(portal) => navigate(portal === 'student' ? '/student' : '/facilitator')}
    />
  );
}

function StatusScreen({ message }: { message: string }) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">Daraja Netizens</p>
        <p className="muted">{message}</p>
      </div>
    </main>
  );
}
