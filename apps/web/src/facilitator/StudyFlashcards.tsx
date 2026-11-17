import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';

import { FLASHCARD_DECKS, FLASHCARDS, type Flashcard, type FlashcardDeckId } from './flashcards';
import './flashcards.css';

type DeckFilter = 'all' | FlashcardDeckId;
type Mastery = Record<string, string[]>;

const STORAGE_KEY = 'daraja.module1.flashcards.mastered.v1';
const ACCENTS: Record<'ochre' | 'sage', { border: string; ink: string }> = {
  ochre: { border: '#c2652a', ink: '#8a4518' },
  sage: { border: '#2f6f5e', ink: '#1f5546' },
};

function cardsFor(filter: DeckFilter) {
  return filter === 'all' ? FLASHCARDS : FLASHCARDS.filter((card) => card.deckId === filter);
}

function readMastery(): Mastery {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Mastery = {};
    for (const [deckId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) result[deckId] = value.filter((id): id is string => typeof id === 'string');
    }
    return result;
  } catch {
    return {};
  }
}

function shuffled<T>(input: T[]) {
  const output = [...input];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export default function StudyFlashcards() {
  const [filter, setFilter] = useState<DeckFilter>('all');
  const [order, setOrder] = useState<Flashcard[]>(() => cardsFor('all'));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastery, setMastery] = useState<Mastery>(readMastery);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mastery));
    } catch {
      // Storage can be unavailable (private mode); progress then lives for this session only.
    }
  }, [mastery]);

  const card = order[index];
  const deck = card ? FLASHCARD_DECKS.find((item) => item.id === card.deckId) : undefined;
  const palette = ACCENTS[deck?.accent ?? 'ochre'];
  const masteredCount = useMemo(
    () => order.filter((item) => (mastery[item.deckId] ?? []).includes(item.id)).length,
    [mastery, order]
  );
  const progress = order.length ? Math.round((masteredCount / order.length) * 100) : 0;
  const isMastered = card ? (mastery[card.deckId] ?? []).includes(card.id) : false;

  const flip = useCallback(() => setFlipped((value) => !value), []);

  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((current) => (order.length ? (current + 1) % order.length : 0));
  }, [order.length]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((current) => (order.length ? (current - 1 + order.length) % order.length : 0));
  }, [order.length]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        flip();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flip, goNext, goPrev]);

  function chooseFilter(next: DeckFilter) {
    if (next === filter) return;
    setFilter(next);
    setOrder(cardsFor(next));
    setIndex(0);
    setFlipped(false);
  }

  function updateMastery(cardId: string, deckId: FlashcardDeckId, mastered: boolean) {
    setMastery((previous) => {
      const current = previous[deckId] ?? [];
      const nextIds = mastered ? Array.from(new Set([...current, cardId])) : current.filter((id) => id !== cardId);
      return { ...previous, [deckId]: nextIds };
    });
  }

  function markMastered() {
    if (!card) return;
    updateMastery(card.id, card.deckId, true);
    setFlipped(false);
    setIndex((current) => (order.length ? (current + 1) % order.length : 0));
  }

  function reviewAgain() {
    if (!card) return;
    updateMastery(card.id, card.deckId, false);
    setFlipped(false);
  }

  function shuffleCards() {
    setOrder(shuffled(cardsFor(filter)));
    setIndex(0);
    setFlipped(false);
  }

  function resetProgress() {
    setMastery((previous) => {
      if (filter === 'all') return {};
      const next = { ...previous };
      delete next[filter];
      return next;
    });
    setOrder(cardsFor(filter));
    setIndex(0);
    setFlipped(false);
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      flip();
    }
  }

  if (!card) return null;

  return (
    <section className="flashcards" style={{ '--accent': palette.border, '--accent-ink': palette.ink } as CSSProperties}>
      <header className="flashcards-hero">
        <div>
          <p className="viewer-kicker">Module 1 study deck</p>
          <h3>Practise the room before you stand in it.</h3>
          <p className="muted">
            All Daraja training material as flashcards. Answer the scenario out loud, then flip for the facilitator
            key points, do&apos;s and don&apos;ts. Mark what you have mastered so you know what to revisit.
          </p>
        </div>
        <div className="mastery-panel">
          <div className="mastery-head">
            <span>{filter === 'all' ? 'All material mastery' : 'Deck mastery'}</span>
            <strong>{masteredCount} / {order.length}</strong>
          </div>
          <div className="mastery-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Mastery progress for the active deck">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="mastery-caption">{progress}% mastered · saved on this device</p>
        </div>
      </header>

      <div className="deck-selector" role="group" aria-label="Choose a study deck">
        <button
          type="button"
          className={filter === 'all' ? 'chip deck-chip active' : 'chip deck-chip'}
          aria-pressed={filter === 'all'}
          onClick={() => chooseFilter('all')}
        >
          All material <span className="deck-count">{FLASHCARDS.length}</span>
        </button>
        {FLASHCARD_DECKS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'chip deck-chip active' : 'chip deck-chip'}
            aria-pressed={filter === item.id}
            onClick={() => chooseFilter(item.id)}
            style={{ '--deck-accent': ACCENTS[item.accent].border } as CSSProperties}
          >
            <span className="deck-dot" aria-hidden="true" />
            {item.name} <span className="deck-count">{FLASHCARDS.filter((entry) => entry.deckId === item.id).length}</span>
          </button>
        ))}
      </div>

      <div className="flashcard-toolbar">
        <div className="flashcard-counter" aria-live="polite">
          <strong>Card {index + 1} of {order.length}</strong>
          <span>{filter === 'all' ? 'All material' : deck?.name}</span>
        </div>
        <div className="flashcard-controls">
          <button type="button" className="ghost-button" onClick={shuffleCards}>Shuffle</button>
          <button type="button" className="ghost-button" onClick={resetProgress}>Reset progress</button>
        </div>
      </div>

      <div className="flashcard-stage">
        <div
          className={flipped ? 'flashcard is-flipped' : 'flashcard'}
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          aria-label={flipped ? 'Flashcard key points. Activate to return to the question.' : 'Flashcard question. Activate to reveal facilitator key points.'}
          onClick={flip}
          onKeyDown={onCardKeyDown}
        >
          <div className="flashcard-face flashcard-front" aria-hidden={flipped}>
            <div className="flashcard-face-inner">
              <div className="flashcard-tags">
                <span className="flashcard-deck">{deck?.short}</span>
                {isMastered && <span className="flashcard-mastered">✓ Mastered</span>}
              </div>
              <h4 className="flashcard-question">{card.question}</h4>
              <div className="flashcard-scenario">
                <p className="viewer-kicker">Classroom scenario</p>
                <p>{card.scenario}</p>
              </div>
              <span className="flashcard-hint">Tap the card or press Space to flip</span>
            </div>
          </div>

          <div className="flashcard-face flashcard-back" aria-hidden={!flipped}>
            <div className="flashcard-face-inner">
              <p className="viewer-kicker">Facilitator key points</p>
              <ul className="flashcard-points">
                {card.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="flashcard-dodont">
                <div className="dodont do">
                  <p className="viewer-kicker">Do</p>
                  <ul>
                    {card.dos.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="dodont dont">
                  <p className="viewer-kicker">Don&apos;t</p>
                  <ul>
                    {card.donts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <span className="flashcard-hint">Tap the card or press Space to see the question again</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flashcard-assessment" aria-live="polite">
        {flipped ? (
          <>
            <button type="button" className="assess-button review" onClick={reviewAgain}>Review Again</button>
            <button type="button" className="assess-button mastered" onClick={markMastered}>Got It / Mastered</button>
          </>
        ) : (
          <p className="assess-hint">Flip the card to record whether you have mastered it.</p>
        )}
      </div>

      <div className="flashcard-nav">
        <button type="button" className="ghost-button" onClick={goPrev}>← Previous</button>
        <button type="button" className="ghost-button" onClick={flip}>{flipped ? 'Show question' : 'Flip card'}</button>
        <button type="button" className="ghost-button" onClick={goNext}>Next →</button>
      </div>

      <p className="flashcard-keys">
        <span><kbd>Space</kbd> flip</span>
        <span><kbd>←</kbd> previous</span>
        <span><kbd>→</kbd> next</span>
      </p>
    </section>
  );
}
