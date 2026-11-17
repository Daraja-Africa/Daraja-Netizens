import { useEffect, useState, type CSSProperties } from 'react';

import { handleLinkClick } from '../router';
import { loadGuides } from './contentApi';
import { fallbackGuides } from './fallbackGuides';
import type { Guide } from './types';

export default function GuideReader({ slug }: { slug: string }) {
  const [guides, setGuides] = useState<Guide[]>(fallbackGuides);

  useEffect(() => {
    let active = true;
    void loadGuides().then((items) => {
      if (active) setGuides(items);
    });
    return () => {
      active = false;
    };
  }, []);

  const guide = guides.find((item) => item.slug === slug);

  if (!guide) {
    return (
      <section className="reader">
        <a className="back-link" href="/student/hub" onClick={(event) => handleLinkClick(event, '/student/hub')}>
          ← Back to Mental Health Hub
        </a>
        <div className="empty-state">
          <strong>That guide is not in the hub yet.</strong>
          <span>It may have been renamed. Everything available is listed on the hub.</span>
          <a className="primary-link" href="/student/hub" onClick={(event) => handleLinkClick(event, '/student/hub')}>
            Browse all guides
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="reader" style={{ '--accent': guide.accent } as CSSProperties}>
      <a className="back-link" href="/student/hub" onClick={(event) => handleLinkClick(event, '/student/hub')}>
        ← Back to Mental Health Hub
      </a>

      <article className="reader-sheet">
        <header className="reader-head">
          <span className="guide-motif" aria-hidden="true">{guide.motif}</span>
          <span className="tag">{guide.category}</span>
          <h3>{guide.title}</h3>
          <p className="reader-meta">{guide.readMinutes} min read · Written for Daraja Netizens students</p>
          <p className="muted">{guide.summary}</p>
        </header>

        <div className="reader-body">
          {guide.sections.map((section) => (
            <div className="reader-section" key={section.heading}>
              <h4>{section.heading}</h4>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        <aside className="takeaways">
          <p className="viewer-kicker">Key takeaways</p>
          <ul>
            {guide.keyTakeaways.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>

        <div className="grounding">
          <p className="viewer-kicker">3-Step Grounding Exercise</p>
          <h4>When the feeling gets loud, do this</h4>
          <ol>
            {guide.grounding.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="reflections">
          <p className="viewer-kicker">Reflection prompts</p>
          <ul>
            {guide.reflections.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
          <p className="muted small">You can answer these in your head, in a note, or with someone you trust.</p>
        </div>

        <div className="reader-cta">
          <div>
            <p className="viewer-kicker">Need to talk it through?</p>
            <p className="muted">A Daraja wellness supporter can reach you privately, in whichever way feels easiest.</p>
          </div>
          <a className="primary-link" href="/student/reach-out" onClick={(event) => handleLinkClick(event, '/student/reach-out')}>
            Reach out confidentially →
          </a>
        </div>
      </article>
    </section>
  );
}
