import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../api';
import { formatDate } from '../staff/format';

type Member = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cohort: string | null;
  member_code: string | null;
  status: string | null;
  sessionsAttended: number;
  trainingAttended: number;
  trainingRequired: number;
  trainingEligible: boolean;
  stipendAttended: number;
  stipendEligible: boolean;
  attendanceRate: number;
  lastAttendedAt: string | null;
};

type MemberDirectoryData = {
  members: Member[];
  totals: { members: number; trainingEligible: number; stipendEligible: number; averageAttendanceRate: number };
};

/** Admin-only roster: eligibility per member, searchable by name, email or cohort. */
export default function MemberDirectory({ accessToken }: { accessToken: string | null }) {
  const [data, setData] = useState<MemberDirectoryData | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [cohort, setCohort] = useState('all');
  const [eligibility, setEligibility] = useState<'all' | 'training' | 'stipend'>('all');

  useEffect(() => {
    let active = true;
    void apiFetch('/api/v1/admin/members', accessToken)
      .then((directory: MemberDirectoryData) => {
        if (active) {
          setData(directory);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'The member directory is unavailable');
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const cohorts = useMemo(
    () => [...new Set((data?.members ?? []).map((member) => member.cohort).filter((name): name is string => Boolean(name)))].sort(),
    [data]
  );

  const members = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.members ?? []).filter((member) => {
      if (cohort !== 'all' && member.cohort !== cohort) return false;
      if (eligibility === 'training' && !member.trainingEligible) return false;
      if (eligibility === 'stipend' && !member.stipendEligible) return false;
      if (!term) return true;
      return [member.full_name, member.email, member.phone ?? '', member.cohort ?? '', member.member_code ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [cohort, data, eligibility, query]);

  return (
    <section className="panel-grid">
      <div className="metric-grid">
        <div className="metric-card"><span>Members</span><strong>{data?.totals.members ?? '—'}</strong></div>
        <div className="metric-card"><span>Training eligible</span><strong>{data?.totals.trainingEligible ?? '—'}</strong></div>
        <div className="metric-card"><span>Stipend eligible</span><strong>{data?.totals.stipendEligible ?? '—'}</strong></div>
        <div className="metric-card"><span>Average attendance</span><strong>{data ? `${data.totals.averageAttendanceRate}%` : '—'}</strong></div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="feature-card">
        <div className="panel-head">
          <div>
            <p className="viewer-kicker">Member directory</p>
            <h3>{members.length} of {data?.members.length ?? 0} members</h3>
          </div>
        </div>
        <div className="filter-row">
          <input
            type="search"
            placeholder="Search name, email, phone or member code"
            aria-label="Search members"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={cohort} onChange={(event) => setCohort(event.target.value)} aria-label="Filter by cohort">
            <option value="all">All cohorts</option>
            {cohorts.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={eligibility}
            onChange={(event) => setEligibility(event.target.value as 'all' | 'training' | 'stipend')}
            aria-label="Filter by eligibility"
          >
            <option value="all">All eligibility</option>
            <option value="training">Training eligible</option>
            <option value="stipend">Stipend eligible</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Cohort</th>
                <th scope="col">Attended</th>
                <th scope="col">Training</th>
                <th scope="col">Stipend</th>
                <th scope="col">Rate</th>
                <th scope="col">Last session</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{member.full_name}</strong>
                      <span>{member.email}</span>
                      {member.phone && <span>{member.phone}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="tag-row">
                      {member.cohort && <span className="tag">{member.cohort}</span>}
                      {member.member_code && <span className="tag">{member.member_code}</span>}
                    </div>
                  </td>
                  <td className="num">{member.sessionsAttended}</td>
                  <td>
                    <span className={member.trainingEligible ? 'tag ok' : 'tag warn'}>
                      {member.trainingAttended}/{member.trainingRequired}
                    </span>
                  </td>
                  <td>
                    <span className={member.stipendEligible ? 'tag ok' : 'tag'}>{member.stipendEligible ? 'On track' : 'Not yet'}</span>
                  </td>
                  <td className="num">{member.attendanceRate}%</td>
                  <td>{formatDate(member.lastAttendedAt)}</td>
                </tr>
              ))}
              {!members.length && (
                <tr><td colSpan={7} className="muted">{data ? 'No members match those filters.' : 'Loading the roster…'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
