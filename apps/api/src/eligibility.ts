/**
 * Module 1 eligibility — the single source of truth.
 *
 * Two implementations used to disagree: the facilitator dashboard derived its
 * thresholds from the number of required sessions and matched attendance on
 * `session_id ?? meeting_id`, while the student endpoint hard-coded 7-of-8 and
 * 4-of-6 weeks and matched on `session_id` only. The same member could be
 * eligible on one screen and not on the other, on a stipend decision.
 *
 * Both consumers now call this function. The rules:
 *
 * - One matching rule: an attendance row counts for a session when its
 *   `session_id` or `meeting_id` equals the session id.
 * - One threshold source: 7/8 of required training sessions, 2/3 of required
 *   stipend weeks, never below the module's 8 sessions / 6 weeks baseline.
 * - Stipend counts weeks, not sessions: a make-up session recorded in the same
 *   week does not count twice. Records without a week key fall back to the
 *   session id so nothing is silently dropped.
 */

export type TrainingSessionInput = {
  id: string;
  required_for_training?: boolean | null;
  required_for_stipend?: boolean | null;
  session_type?: string | null;
  week_key?: string | null;
};

export type AttendanceInput = {
  session_id?: string | null;
  meeting_id?: string | null;
  presence_seconds?: number | null;
};

const TRAINING_BASELINE = 8;
const STIPEND_BASELINE_WEEKS = 6;
const TRAINING_RATIO = 7 / 8;
const STIPEND_RATIO = 2 / 3;

export type ModuleOneEligibility = {
  attendanceCount: number;
  requiredTraining: number;
  requiredStipend: number;
  trainingThreshold: number;
  stipendThreshold: number;
  trainingProgress: number;
  stipendProgress: number;
  trainingEligible: boolean;
  stipendEligible: boolean;
  attendedTraining: number;
  attendedStipend: number;
  trainingTotal: number;
  stipendTotalWeeks: number;
};

function attendedKey(record: AttendanceInput) {
  return record.session_id ?? record.meeting_id ?? null;
}

export function calculateModuleOneEligibility(input: {
  trainingSessions: TrainingSessionInput[];
  attendanceRecords: AttendanceInput[];
}): ModuleOneEligibility {
  const sessions = input.trainingSessions ?? [];
  const present = new Set(
    (input.attendanceRecords ?? [])
      .filter((record) => (record.presence_seconds ?? 0) > 0)
      .map(attendedKey)
      .filter((key): key is string => Boolean(key))
  );

  const requiredTraining = sessions.filter((session) => session.required_for_training);
  const requiredStipend = sessions.filter((session) => session.required_for_stipend);

  const attendedTraining = requiredTraining.filter((session) => present.has(session.id)).length;
  const attendedStipendWeeks = new Set(
    requiredStipend.filter((session) => present.has(session.id)).map((session) => session.week_key ?? session.id)
  );

  const trainingTotal = Math.max(requiredTraining.length, TRAINING_BASELINE);
  const stipendTotalWeeks = requiredStipend.length ? Math.max(requiredStipend.length, STIPEND_BASELINE_WEEKS) : 0;
  const trainingThreshold = Math.max(1, Math.ceil(trainingTotal * TRAINING_RATIO));
  const stipendThreshold = stipendTotalWeeks ? Math.max(1, Math.ceil(stipendTotalWeeks * STIPEND_RATIO)) : 0;

  return {
    attendanceCount: (input.attendanceRecords ?? []).filter((record) => (record.presence_seconds ?? 0) > 0).length,
    requiredTraining: requiredTraining.length,
    requiredStipend: requiredStipend.length,
    trainingThreshold,
    stipendThreshold,
    trainingProgress: trainingTotal ? Math.round((attendedTraining / trainingTotal) * 100) : 0,
    stipendProgress: stipendTotalWeeks ? Math.round((attendedStipendWeeks.size / stipendTotalWeeks) * 100) : 0,
    trainingEligible: requiredTraining.length > 0 && attendedTraining >= trainingThreshold,
    stipendEligible: requiredStipend.length > 0 && attendedStipendWeeks.size >= stipendThreshold,
    attendedTraining,
    attendedStipend: attendedStipendWeeks.size,
    trainingTotal,
    stipendTotalWeeks,
  };
}
