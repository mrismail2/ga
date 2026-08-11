import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/services/admin';
import { dateTime, isoDate, titleCase } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/permissions';
import {
  Badge, Card, EmptyState, Input, Pagination, QueryBoundary, Select,
} from '@/components/ui';

const ENTITIES = [
  'all', 'patients', 'treatments', 'payments', 'prescriptions',
  'expenses', 'medicines', 'profiles', 'user_permissions', 'clinic_settings',
];
const PAGE_SIZE = 50;

export default function AuditLog() {
  const [entity, setEntity] = useState('all');
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 7 * 86_400_000)));
  const [to, setTo] = useState(isoDate());
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['audit', entity, from, to, page],
    queryFn: () => listAuditLogs({ entity, from, to, page, pageSize: PAGE_SIZE }),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Audit log</h1>
          <p>Who did what and when. Written by the database, so it cannot be edited from the app.</p>
        </div>
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            style={{ width: 190 }}>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>{e === 'all' ? 'All records' : titleCase(e)}</option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={10}
          empty={<EmptyState title="No activity in this period"
            description="Patient, treatment, payment and pharmacy changes are all recorded here." />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {rows.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap">{dateTime(log.created_at)}</td>
                      <td>
                        {log.user ? (
                          <>
                            <b>{log.user.full_name}</b>
                            <div className="text-2xs faint">{ROLE_LABEL[log.user.role]}</div>
                          </>
                        ) : <span className="faint">System</span>}
                      </td>
                      <td>
                        <Badge tone={
                          log.action.includes('delete') || log.action.includes('void') ? 'danger'
                            : log.action.includes('insert') || log.action.includes('record') ? 'ok' : 'info'
                        }>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="text-xs">{titleCase(log.entity)}</td>
                      <td className="text-2xs faint">
                        <code style={{ wordBreak: 'break-all' }}>
                          {summarise(log.details)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>

        <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
      </Card>
    </>
  );
}

/** Audit rows carry whole record snapshots — show only the useful fields. */
function summarise(details: Record<string, unknown>): string {
  const interesting = [
    'full_name', 'patient_code', 'amount', 'method', 'receipt_number', 'reason',
    'status', 'balance_before', 'total', 'permission', 'granted', 'role', 'tooth', 'condition',
  ];
  const parts = interesting
    .filter((key) => details[key] !== undefined && details[key] !== null)
    .map((key) => `${key}: ${String(details[key])}`);
  if (parts.length) return parts.join(' · ');
  const keys = Object.keys(details).slice(0, 3);
  return keys.length ? keys.map((k) => `${k}: ${String(details[k])}`).join(' · ') : '—';
}
