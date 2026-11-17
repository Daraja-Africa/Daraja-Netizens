/**
 * Reach-out triage rules.
 *
 * A reach-out note is a confidential disclosure from a young person, so the
 * operational contract is deliberately explicit: every urgency has a response
 * window, one person owns the note, the first staff reply stops the clock, and
 * every open is recorded. Keeping these rules out of the HTTP layer makes them
 * testable and keeps the routes thin.
 */

import { config } from './config.js';
import type { Logger } from './logger.js';

export const REACH_OUT_URGENCIES = ['within-24-hours', 'this-week', 'general-check-in'] as const;
export type ReachOutUrgency = (typeof REACH_OUT_URGENCIES)[number];

export const REACH_OUT_STATUSES = ['new', 'in_progress', 'closed'] as const;
export type ReachOutStatus = (typeof REACH_OUT_STATUSES)[number];

/** Hours a supporter has to make first contact, by the urgency the student chose. */
export const REACH_OUT_SLA_HOURS: Record<ReachOutUrgency, number> = {
  'within-24-hours': 24,
  'this-week': 24 * 7,
  'general-check-in': 24 * 14,
};

export type ReachOutNote = {
  id: string;
  reference: string;
  name: string | null;
  contact_method: string;
  contact_detail: string;
  support_topic: string;
  urgency: ReachOutUrgency;
  message: string;
  status: ReachOutStatus;
  assigned_to: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type ReachOutSummary = {
  total: number;
  new: number;
  inProgress: number;
  closed: number;
  overdue: number;
  urgent: number;
};

/** When first contact is due. Null once the note has been answered or closed. */
export function slaDueAt(note: Pick<ReachOutNote, 'created_at' | 'urgency' | 'first_response_at' | 'closed_at'>) {
  if (note.first_response_at || note.closed_at) return null;
  const hours = REACH_OUT_SLA_HOURS[note.urgency] ?? REACH_OUT_SLA_HOURS['this-week'];
  return new Date(new Date(note.created_at).getTime() + hours * 3_600_000).toISOString();
}

export function slaState(
  note: Pick<ReachOutNote, 'created_at' | 'urgency' | 'first_response_at' | 'closed_at'>,
  now = Date.now()
): { dueAt: string | null; hoursRemaining: number | null; overdue: boolean } {
  const dueAt = slaDueAt(note);
  if (!dueAt) return { dueAt: null, hoursRemaining: null, overdue: false };
  const hoursRemaining = Math.round((new Date(dueAt).getTime() - now) / 3_600_000);
  return { dueAt, hoursRemaining, overdue: hoursRemaining < 0 };
}

export function summariseNotes(notes: ReachOutNote[], now = Date.now()): ReachOutSummary {
  const open = notes.filter((note) => note.status !== 'closed');
  return {
    total: notes.length,
    new: notes.filter((note) => note.status === 'new').length,
    inProgress: notes.filter((note) => note.status === 'in_progress').length,
    closed: notes.length - open.length,
    overdue: open.filter((note) => slaState(note, now).overdue).length,
    urgent: open.filter((note) => note.urgency === 'within-24-hours').length,
  };
}

/**
 * Sorts for triage: unanswered urgent notes first, then anything already late,
 * then oldest first so nothing starves at the bottom of the list.
 */
export function sortForTriage(notes: ReachOutNote[], now = Date.now()) {
  const statusRank: Record<ReachOutStatus, number> = { new: 0, in_progress: 1, closed: 2 };
  return [...notes].sort((a, b) => {
    if (a.status !== b.status) return statusRank[a.status] - statusRank[b.status];
    const aLate = slaState(a, now).overdue ? 0 : 1;
    const bLate = slaState(b, now).overdue ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export type NoteUpdateInput = {
  status?: ReachOutStatus;
  assignedTo?: string | null;
};

/**
 * Turns a triage decision into the column patch, so the SLA clock and the close
 * timestamp can never drift from the status that was chosen.
 */
export function buildNotePatch(
  note: ReachOutNote,
  input: NoteUpdateInput,
  now = new Date().toISOString()
): Partial<ReachOutNote> {
  const patch: Partial<ReachOutNote> = {};
  if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo;
  if (input.status) {
    patch.status = input.status;
    if (input.status !== 'new' && !note.first_response_at) patch.first_response_at = now;
    if (input.status === 'closed') patch.closed_at = note.closed_at ?? now;
    else patch.closed_at = null;
  }
  return patch;
}

export type ReachOutAlertPayload = {
  reference: string;
  urgency: ReachOutUrgency;
  supportTopic: string;
  dueAt: string | null;
  createdAt: string;
};

/**
 * Tells the wellness team that a new note exists.
 *
 * The destination is the `REACH_OUT_ALERT_WEBHOOK` environment variable — an
 * email/SMS relay, a chat webhook, or the incident tool the programme already
 * runs. Only the reference, urgency and topic travel: the student's words and
 * contact detail stay in the database and are read in the console by an
 * authorised supporter.
 *
 * Never throws and never blocks the submission: a student's note must be stored
 * even when the alert channel is down.
 */
export async function notifyNewNote(
  payload: ReachOutAlertPayload,
  log: Logger
): Promise<{ delivered: boolean; reason?: string }> {
  const url = config.reachOutAlertWebhook;
  if (!url) {
    log.warn('reach_out.alert_not_configured', { ...payload, hint: 'Set REACH_OUT_ALERT_WEBHOOK to page a human' });
    return { delivered: false, reason: 'not_configured' };
  }

  const text =
    `New confidential reach-out note ${payload.reference} ` +
    `(${payload.urgency.replace(/-/g, ' ')}, topic ${payload.supportTopic}). ` +
    (payload.dueAt ? `First contact due ${payload.dueAt}. ` : '') +
    'Open the facilitator Reach-out inbox to read it.';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'reach_out_new', text, ...payload }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      log.error('reach_out.alert_failed', { reference: payload.reference, status: response.status });
      return { delivered: false, reason: `status ${response.status}` };
    }
    log.info('reach_out.alert_sent', { reference: payload.reference, urgency: payload.urgency });
    return { delivered: true };
  } catch (error) {
    log.error('reach_out.alert_failed', { reference: payload.reference, error });
    return { delivered: false, reason: 'network' };
  }
}
