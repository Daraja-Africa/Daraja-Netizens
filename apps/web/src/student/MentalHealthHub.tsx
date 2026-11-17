import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { handleLinkClick } from '../router';
import { loadGuides } from './contentApi';
import { fallbackGuides } from './fallbackGuides';
import ResourceCards from './ResourceCards';
import { STUDENT_CATEGORIES, type Guide } from './types';

const filters = ['All', ...STUDENT_CATEGORIES];

export default function MentalHealthHub() {
  const [guides, setGuides] = useState<Guide[]>(fallbackGuides);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');

  useEffect(() => {
    let active = true;
    void loadGuides().then((items) => {
      if (active) setGuides(items);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guides.filter((guide) => {
      if (category !== 'All' && guide.category !== category) return false;
      if (!needle) return true;
      const haystack = [guide.title, guide.summary, guide.category, ...guide.sections.map((section) => section.heading)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [category, guides, query]);

  return (
    <section className="hub">
      <div className="hub-hero">
        <div>
          <p className="viewer-kicker">Mental Health Educative Hub</p>
          <h3>Guides for the days that feel heavy.</h3>
          <p className="muted">
            Read at your own pace. Nothing here is a test, and nobody is marking how long you stay. If a guide brings
            something up, the Reach-Out page connects you to a real person.
          </p>
        </div>
        <a className="primary-link" href="/student/reach-out" onClick={(event) => handleLinkClick(event, '/student/reach-out')}>
          Talk to someone →
        </a>
      </div>

      <div className="hub-toolbar">
        <label className="hub-search">
          <span className="visually-hidden">Search guides</span>
          <input
            type="search"
            placeholder="Search guides, feelings, topics…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="category-chips" role="group" aria-label="Filter guides by category">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? 'chip active' : 'chip'}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <p className="hub-count" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'guide' : 'guides'} {category === 'All' ? 'in the hub' : `in ${category}`}
      </p>

      {filtered.length ? (
        <div className="hub-grid">
          {filtered.map((guide) => (
            <a
              key={guide.id}
              className="guide-card"
              href={`/student/hub/${guide.slug}`}
              onClick={(event) => handleLinkClick(event, `/student/hub/${guide.slug}`)}
              style={{ '--accent': guide.accent } as CSSProperties}
            >
              <span className="guide-motif" aria-hidden="true">{guide.motif}</span>
              <span className="tag">{guide.category}</span>
              <h4>{guide.title}</h4>
              <p>{guide.summary}</p>
              <div className="guide-footer">
                <span className="read-time">{guide.readMinutes} min read</span>
                <span className="read-guide">Read Guide →</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No guides match that yet.</strong>
          <span>Try another word, or clear the filters to see everything.</span>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setQuery('');
              setCategory('All');
            }}
          >
            Clear search and filters
          </button>
        </div>
      )}

      <ResourceCards />

      <div className="hub-note">
        <p className="viewer-kicker">If today is an emergency</p>
        <p className="muted">
          Guides are education, not emergency care. If you or someone else is in danger right now, call{' '}
          <a href="tel:999">999</a> or reach a helpline on the{' '}
          <a href="/student/reach-out" onClick={(event) => handleLinkClick(event, '/student/reach-out')}>
            Reach-Out page
          </a>
          .
        </p>
      </div>
    </section>
  );
}
