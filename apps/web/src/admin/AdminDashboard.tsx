import WorkspaceFrame, { type WorkspaceNavItem } from '../layout/WorkspaceFrame';
import { navigate, type AdminPage } from '../router';
import type { StaffDashboardProps } from '../roles';
import CheckIn from '../staff/CheckIn';
import Scanner from '../staff/Scanner';
import SessionAttendance from '../staff/SessionAttendance';
import TrainingRoom from '../staff/TrainingRoom';
import AdminOverview from './AdminOverview';
import AttendanceData from './AttendanceData';
import FacilitatorDirectory from './FacilitatorDirectory';
import MemberDirectory from './MemberDirectory';
import ProgramSessions from './ProgramSessions';

const adminNav: WorkspaceNavItem[] = [
  { key: 'overview', label: 'Overview', path: '/admin' },
  { key: 'members', label: 'Members', path: '/admin/members' },
  { key: 'facilitators', label: 'Staff access', path: '/admin/facilitators' },
  { key: 'program', label: 'Programme', path: '/admin/program' },
  { key: 'attendance', label: 'Attendance', path: '/admin/attendance' },
  { key: 'data', label: 'Data imports', path: '/admin/data' },
  { key: 'check-in', label: 'Check-in', path: '/admin/check-in' },
  { key: 'scanner', label: 'Scanner', path: '/admin/scanner' },
  { key: 'training', label: 'Training room', path: '/admin/training' },
];

const adminPages: Record<AdminPage, { kicker: string; heading: string }> = {
  overview: { kicker: 'Programme health', heading: 'Admin dashboard' },
  members: { kicker: 'Roster', heading: 'Member directory' },
  facilitators: { kicker: 'Staff access', heading: 'Facilitators and admins' },
  program: { kicker: 'Programme plan', heading: 'Sessions and schedule' },
  attendance: { kicker: 'Session records', heading: 'Record attendance' },
  data: { kicker: 'Imports', heading: 'Attendance data' },
  'check-in': { kicker: 'Physical attendance', heading: 'QR check-in' },
  scanner: { kicker: 'Scanner mode', heading: 'Scan a check-in' },
  training: { kicker: 'Virtual training', heading: 'Training room' },
};

/** The administrator workspace: every management screen, none of them shared with facilitators. */
export default function AdminDashboard({ page, user, accessToken, status, onSignOut }: StaffDashboardProps & { page: AdminPage }) {
  const meta = adminPages[page];

  return (
    <WorkspaceFrame
      area="admin"
      workspaceName="Admin dashboard"
      nav={adminNav}
      activeKey={page}
      user={user}
      status={status}
      kicker={meta.kicker}
      heading={meta.heading}
      badge="Administrator"
      badgeTone="indigo"
      onSwitchRole={onSignOut}
      onOpenStudentPortal={() => navigate('/student')}
      onSignOut={onSignOut}
    >
      {page === 'overview' && <AdminOverview accessToken={accessToken} />}
      {page === 'members' && <MemberDirectory accessToken={accessToken} />}
      {page === 'facilitators' && <FacilitatorDirectory accessToken={accessToken} />}
      {page === 'program' && <ProgramSessions accessToken={accessToken} />}
      {page === 'attendance' && <SessionAttendance accessToken={accessToken} />}
      {page === 'data' && <AttendanceData accessToken={accessToken} />}
      {page === 'check-in' && <CheckIn accessToken={accessToken} />}
      {page === 'scanner' && <Scanner accessToken={accessToken} />}
      {page === 'training' && <TrainingRoom accessToken={accessToken} userId={user.id} defaultName={user.name ?? 'Administrator'} />}
    </WorkspaceFrame>
  );
}
