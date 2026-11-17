import type { CSSProperties } from 'react';

import { HUB_RESOURCES, KENYA_HELPLINES, RESOURCE_TRACKS, type ResourceCard } from './resources';

/**
 * Outbound link cards for the hub. Every card names its source, opens in a new
 * tab with `noopener noreferrer`, and carries a Kenyan helpline note so foreign
 * crisis numbers on the destination page are never the only help offered.
 */
export default function ResourceCards() {
  return (
    <section className="resource-library" aria-labelledby="resource-library-title">
      <div className="resource-library-head">
        <p className="viewer-kicker">Vetted outside resources</p>
        <h4 id="resource-library-title">Trusted reading from organisations we checked</h4>
        <p className="muted">
          These cards open another organisation’s website in a new tab. You never need to sign in, and nothing here is
          tracked. Some of these sites show their own country’s helplines — for Kenya, use these:
        </p>
        <p className="resource-helplines">
          {KENYA_HELPLINES.map((line) => (
            <a key={line.value} href={`tel:${line.value}`} title={line.detail}>
              {line.label}
            </a>
          ))}
          <span className="resource-helplines-note">Free to call from a Kenyan line, day or night.</span>
        </p>
      </div>

      {RESOURCE_TRACKS.map((track) => {
        const cards = HUB_RESOURCES.filter((resource) => resource.track === track.id);
        if (!cards.length) return null;
        return (
          <div className="resource-track" key={track.id}>
            <p className="resource-track-label">{track.label}</p>
            <p className="resource-track-blurb">{track.blurb}</p>
            <div className="resource-grid">
              {cards.map((resource) => (
                <ResourceItem key={resource.id} resource={resource} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ResourceItem({ resource }: { resource: ResourceCard }) {
  return (
    <article className="resource-card" style={{ '--accent': resource.accent } as CSSProperties}>
      <span className="tag">{resource.category}</span>
      <h5>{resource.title}</h5>
      <p>{resource.summary}</p>
      <div className="resource-meta">
        <span>{resource.source}</span>
        <span>{resource.readMinutes} min read</span>
      </div>
      {resource.needsReview ? (
        <p className="resource-review">Editor review pending — {resource.needsReview}</p>
      ) : (
        <a className="read-guide" href={resource.url} target="_blank" rel="noopener noreferrer">
          Open on {resource.domain} ↗
        </a>
      )}
      <p className="resource-support">
        If this brings something up, call <a href="tel:116">116</a> or <a href="tel:1199">1199</a> — free.
      </p>
    </article>
  );
}
