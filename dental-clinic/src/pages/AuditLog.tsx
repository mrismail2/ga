import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/services/admin';
import { dateTime, isoDate } from '@/lib/format';
import {
  Badge, Card, EmptyState, Input, Pagination, QueryBoundary, Select,
} from '@/components/ui';
import { useI18n } from '@/i18n';

const ENTITIES = [
  'all', 'patients', 'treatments', 'payments', 'prescriptions',
  'expenses', 'medicines', 'profiles', 'user_permissions', 'clinic_settings',
];
const PAGE_SIZE = 50;

export default function AuditLog() {
  const { t, label } = useI18n();
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
          <h1>{t('audit.title')}</h1>
          <p>{t('audit.subtitle')}</p>
        </div>
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            style={{ width: 190 }}>
            {ENTITIES.map((name) => (
              <option key={name} value={name}>
                {name === 'all' ? t('audit.allRecords') : label('entity', name)}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={10}
          empty={<EmptyState title={t('audit.empty')}
            description={t('audit.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('common.when')}</th><th>{t('audit.user')}</th><th>{t('audit.action')}</th>
                    <th>{t('audit.record')}</th><th>{t('audit.details')}</th></tr>
                </thead>
                <tbody>
                  {rows.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap">{dateTime(log.created_at)}</td>
                      <td>
                        {log.user ? (
                          <>
                            <b>{log.user.full_name}</b>
                            <div className="text-2xs faint">{label('role', log.user.role)}</div>
                          </>
                        ) : <span className="faint">{t('audit.system')}</span>}
                      </td>
                      <td>
                        <Badge tone={
                          log.action.includes('delete') || log.action.includes('void') ? 'danger'
                            : log.action.includes('insert') || log.action.includes('record') ? 'ok' : 'info'
                        }>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="text-xs">{label('entity', log.entity)}</td>
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
