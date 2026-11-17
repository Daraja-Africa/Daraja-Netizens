import WorkspaceFrame, { type WorkspaceNavItem } from '../layout/WorkspaceFrame';
import { navigate, type FacilitatorPage } from '../router';
import type { StaffDashboardProps } from '../roles';
import CheckIn from '../staff/CheckIn';
import Scanner from '../staff/Scanner';
import TrainingRoom from '../staff/TrainingRoom';
import FacilitatorOverview from './FacilitatorOverview';
import Meetings from './Meetings';
import StudyFlashcards from './StudyFlashcards';

const facilitatorNav: WorkspaceNavItem[] = [
  { key: 'overview', label: 'Overview', path: '/facilitator' },
  { key: 'meetings', label: 'My sessions', path: '/facilitator/meetings' },
  { key: 'check-in', label: 'Check-in', path: '/facilitator/check-in' },
  { key: 'scanner', label: 'Scanner', path: '/facilitator/scanner' },
  { key: 'training', label: 'Training room', path: '/facilitator/training' },
  { key: 'flashcards', label: 'Flashcards', path: '/facilitator/flashcards' },
];

const facilitatorPages: Record<FacilitatorPage, { kicker: string; heading: string }> = {
  overview: { kicker: 'Your sessions', heading: 'Facilitator dashboard' },
  meetings: { kicker: 'Sessions and rooms', heading: 'My sessions' },
  'check-in': { kicker: 'Physical attendance', heading: 'QR check-in' },
  scanner: { kicker: 'Scanner mode', heading: 'Scan a check-in' },
  training: { kicker: 'Virtual training', heading: 'Training room' },
  flashcards: { kicker: 'Study', heading: 'Training flashcards' },
};

/** The facilitator workspace: their sessions and the tools to run them. No administrative screens. */
export default function FacilitatorDashboard({ page, user, accessToken, status, onSignOut }: StaffDashboardProps & { page: FacilitatorPage }) {
  const meta = facilitatorPages[page];

  return (
    <WorkspaceFrame
      area="facilitator"
      workspaceName="Facilitator dashboard"
      nav={facilitatorNav}
      activeKey={page}
      user={user}
      status={status}
      kicker={meta.kicker}
      heading={meta.heading}
      badge="Facilitator"
      badgeTone="sage"
      onSwitchRole={onSignOut}
      onOpenStudentPortal={() => navigate('/student')}
      onSignOut={onSignOut}
    >
      {page === 'overview' && <FacilitatorOverview accessToken={accessToken} name={user.name} />}
      {page === 'meetings' && <Meetings accessToken={accessToken} />}
      {page === 'check-in' && <CheckIn accessToken={accessToken} />}
      {page === 'scanner' && <Scanner accessToken={accessToken} />}
      {page === 'training' && <TrainingRoom accessToken={accessToken} userId={user.id} defaultName={user.name ?? 'Facilitator'} />}
      {page === 'flashcards' && <StudyFlashcards />}
    </WorkspaceFrame>
  );
}
