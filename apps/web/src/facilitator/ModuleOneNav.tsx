import './ModuleOneNav.css';

export type ModuleOneNavKey = 'overview' | 'qr' | 'scanner' | 'training' | 'data' | 'flashcards';

const items: Array<{ key: ModuleOneNavKey; label: string; glyph: string }> = [
  { key: 'overview', label: 'Overview', glyph: '◉' },
  { key: 'qr', label: 'Check-in', glyph: '▦' },
  { key: 'scanner', label: 'Scanner', glyph: '⌗' },
  { key: 'training', label: 'Training', glyph: '◎' },
  { key: 'data', label: 'Data', glyph: '▤' },
  { key: 'flashcards', label: 'Flashcards', glyph: '❑' },
];

export default function ModuleOneNav({ active, onSelect }: { active: ModuleOneNavKey; onSelect: (key: ModuleOneNavKey) => void }) {
  return (
    <nav className="module-one-nav" aria-label="Module 1 navigation">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={active === item.key ? 'module-one-nav-item active' : 'module-one-nav-item'}
          aria-current={active === item.key ? 'page' : undefined}
          onClick={() => onSelect(item.key)}
        >
          <span className="module-one-nav-glyph" aria-hidden="true">{item.glyph}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
