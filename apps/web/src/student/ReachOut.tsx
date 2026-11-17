import { useEffect, useState, type FormEvent } from 'react';

import { apiFetch } from '../api';
import { handleLinkClick } from '../router';
import { contactActionLabel, contactHref, loadSupportContacts } from './contentApi';
import { fallbackSupportContacts } from './fallbackGuides';
import {
  REACH_OUT_METHODS,
  REACH_OUT_TOPICS,
  REACH_OUT_URGENCIES,
  type ContactMethod,
  type SupportContact,
  type SupportTopic,
  type Urgency,
} from './types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^\+?[0-9][0-9\s-]{6,19}$/;

type FormState = {
  name: string;
  contactMethod: ContactMethod;
  contactDetail: string;
  topic: SupportTopic;
  urgency: Urgency;
  message: string;
};

const emptyForm: FormState = {
  name: '',
  contactMethod: 'whatsapp',
  contactDetail: '',
  topic: 'stress-anxiety',
  urgency: 'within-24-hours',
  message: '',
};

const methodLabels: Record<ContactMethod, string> = {
  whatsapp: 'WhatsApp',
  phone: 'phone call',
  sms: 'SMS',
  email: 'email',
};

export default function ReachOut() {
  const [contacts, setContacts] = useState<SupportContact[]>(fallbackSupportContacts);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ reference: string; method: ContactMethod } | null>(null);

  useEffect(() => {
    let active = true;
    void loadSupportContacts().then((items) => {
      if (active) setContacts(items);
    });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const detail = form.contactDetail.trim();
    const message = form.message.trim();

    if (!detail) {
      setError(`Add the ${form.contactMethod === 'email' ? 'email address' : 'phone number'} we should use, so a supporter can reach you.`);
      return;
    }
    if (form.contactMethod === 'email' && !emailPattern.test(detail)) {
      setError('That email address looks incomplete. Check it and try again.');
      return;
    }
    if (form.contactMethod !== 'email' && !phonePattern.test(detail)) {
      setError('Use a phone number with at least 7 digits, for example +254 712 345 678.');
      return;
    }
    if (message.length < 10) {
      setError('Share a little more in your message — even one sentence helps the wellness team prepare.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const data = await apiFetch('/api/v1/student/reach-out', null, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          contactMethod: form.contactMethod,
          contactDetail: detail,
          topic: form.topic,
          urgency: form.urgency,
          message,
        }),
      });
      setConfirmation({ reference: typeof data?.reference === 'string' ? data.reference : '', method: form.contactMethod });
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not send that just now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="reach-out">
      <div className="hub-hero">
        <div>
          <p className="viewer-kicker">Confidential Reach-Out</p>
          <h3>You do not have to carry this alone.</h3>
          <p className="muted">
            Reach the Daraja wellness team in whichever way feels easiest. You can use your name, a nickname, or stay
            completely anonymous — the supporter who reads your note is trained to help, not to judge.
          </p>
        </div>
        <span className="reach-out-mark" aria-hidden="true">♡</span>
      </div>

      <div className="contact-grid">
        {contacts.map((contact) => (
          <div className="contact-card" key={contact.id}>
            <span className="tag">{contact.channel === 'whatsapp' ? 'WhatsApp' : 'Call'}</span>
            <h4>{contact.label}</h4>
            {contact.detail ? <p className="muted small">{contact.detail}</p> : null}
            <code>{contact.value}</code>
            <a className="contact-action" href={contactHref(contact)} target={contact.channel === 'url' ? '_blank' : undefined} rel={contact.channel === 'url' ? 'noreferrer' : undefined}>
              {contactActionLabel(contact)}
            </a>
          </div>
        ))}
      </div>

      <div className="reach-out-layout">
        {confirmation ? (
          <div className="confirm-card" role="status">
            <span className="confirm-mark" aria-hidden="true">✓</span>
            <p className="viewer-kicker">Note received</p>
            <h3>Thank you for trusting us with this.</h3>
            <p className="muted">
              A Daraja wellness supporter will reach you by {methodLabels[confirmation.method]} on the details you shared,
              following the urgency you chose. You do not have to do anything else right now.
            </p>
            {confirmation.reference ? (
              <p className="confirm-ref">
                Reference <strong>{confirmation.reference}</strong>
              </p>
            ) : null}
            <div className="confirm-actions">
              <a className="primary-link" href="/student/hub" onClick={(event) => handleLinkClick(event, '/student/hub')}>
                Browse the hub while you wait
              </a>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setConfirmation(null);
                  setError('');
                  setForm(emptyForm);
                }}
              >
                Send another note
              </button>
            </div>
            <p className="muted small">If you are in immediate danger, call 999 or one of the support lines above now.</p>
          </div>
        ) : (
          <form className="reach-form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="reach-name">
                Name or nickname <span className="optional">optional</span>
              </label>
              <input
                id="reach-name"
                value={form.name}
                maxLength={80}
                placeholder="Leave blank to stay anonymous"
                onChange={(event) => update('name', event.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="reach-method">Preferred contact method</label>
                <select
                  id="reach-method"
                  value={form.contactMethod}
                  onChange={(event) => update('contactMethod', event.target.value as ContactMethod)}
                >
                  {REACH_OUT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="reach-detail">{form.contactMethod === 'email' ? 'Email address' : 'Phone number'}</label>
                <input
                  id="reach-detail"
                  type={form.contactMethod === 'email' ? 'email' : 'tel'}
                  value={form.contactDetail}
                  maxLength={160}
                  placeholder={form.contactMethod === 'email' ? 'you@example.com' : '+254 712 345 678'}
                  onChange={(event) => update('contactDetail', event.target.value)}
                />
                <span className="field-hint">Only the wellness team sees this.</span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="reach-topic">Support topic</label>
              <select id="reach-topic" value={form.topic} onChange={(event) => update('topic', event.target.value as SupportTopic)}>
                {REACH_OUT_TOPICS.map((topic) => (
                  <option key={topic.value} value={topic.value}>{topic.label}</option>
                ))}
              </select>
            </div>

            <fieldset className="field urgency-field">
              <legend>Urgency</legend>
              <div className="urgency-options">
                {REACH_OUT_URGENCIES.map((urgency) => (
                  <label key={urgency.value} className={form.urgency === urgency.value ? 'urgency-chip active' : 'urgency-chip'}>
                    <input
                      type="radio"
                      name="urgency"
                      value={urgency.value}
                      checked={form.urgency === urgency.value}
                      onChange={() => update('urgency', urgency.value)}
                    />
                    {urgency.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <label htmlFor="reach-message">What is on your mind?</label>
              <textarea
                id="reach-message"
                rows={5}
                maxLength={2000}
                value={form.message}
                placeholder="Share as much or as little as you want. There is no right way to do this."
                onChange={(event) => update('message', event.target.value)}
              />
            </div>

            {error ? <p className="error-text" role="alert">{error}</p> : null}

            <button type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send to the wellness team'}</button>
            <p className="form-note">
              Your note goes only to the Daraja wellness team. It is never shown anywhere else in the portal, and you can
              stay anonymous.
            </p>
          </form>
        )}

        <aside className="privacy-card">
          <p className="viewer-kicker">How this works</p>
          <ul className="check-list">
            <li>Only the wellness team can open your note.</li>
            <li>Your name is optional — a nickname is enough.</li>
            <li>Choose the contact method that feels safest to you.</li>
            <li>Marked urgent notes are reviewed first.</li>
            <li>Nothing you write appears anywhere else in the portal.</li>
          </ul>
          <p className="muted small">
            If you are in immediate danger, do not wait for a reply — call{' '}
            <a href="tel:999">999</a> or the helplines above.
          </p>
        </aside>
      </div>
    </section>
  );
}
