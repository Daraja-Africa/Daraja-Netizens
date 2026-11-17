import type { Portal } from './portal';

const roleOptions: Array<{ portal: Portal; label: string; copy: string; action: string; motif: string }> = [
  {
    portal: 'student',
    label: 'Student / Young person',
    copy: 'Explore mental health resources, post-training guides, and confidential counselor support.',
    action: 'Enter the student portal',
    motif: '✦',
  },
  {
    portal: 'facilitator',
    label: 'Facilitator / Admin',
    copy: 'Access training flashcards, QR attendance check-in, admin scanner, and Jitsi training rooms.',
    action: 'Continue to Module 1',
    motif: '◈',
  },
];

export function RoleSelector({ onSelect }: { onSelect: (portal: Portal) => void }) {
  return (
    <main className="role-gate">
      <div className="role-gate-inner">
        <header className="role-gate-header">
          <img className="brand-badge" src="/daraja-logo.png" alt="" />
          <p className="eyebrow">Daraja Netizens</p>
          <h1>Where would you like to begin?</h1>
          <p className="muted">
            Choose the space that fits you today. Young people explore wellness resources openly,
            while facilitators and admins sign in to run training.
          </p>
        </header>

        <div className="role-grid">
          {roleOptions.map((option) => (
            <button
              key={option.portal}
              type="button"
              className={`role-card ${option.portal}`}
              onClick={() => onSelect(option.portal)}
            >
              <span className="role-motif" aria-hidden="true">{option.motif}</span>
              <span className="role-label">{option.label}</span>
              <span className="role-copy">{option.copy}</span>
              <span className="role-action">
                {option.action} <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </div>

        <p className="role-footnote">You can switch roles at any time from the header.</p>
      </div>
    </main>
  );
}
