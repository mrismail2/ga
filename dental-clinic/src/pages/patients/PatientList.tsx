import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listPatients } from '@/services/patients';
import { ageOf, dateOnly } from '@/lib/format';
import {
  Avatar, Badge, Card, EmptyState, Input, Pagination, QueryBoundary, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const PAGE_SIZE = 25;
const FILTERS = [
  { id: 'all', key: 'common.all' },
  { id: 'active', key: 'status.active' },
  { id: 'inactive', key: 'status.inactive' },
] as const;

export default function PatientList() {
  const { t, label } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => { setDebounced(search); setPage(1); }, 200);
    return () => clearTimeout(id);
  }, [search]);

  const query = useQuery({
    queryKey: ['patients', debounced, status, page],
    queryFn: () => listPatients({ search: debounced, status, page, pageSize: PAGE_SIZE }),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('patients.title')}</h1>
          <p>{t('patients.subtitle')}</p>
        </div>
        <div className="page__actions">
          <Link className="btn btn--primary" to="/patients/new"><Icon name="plus" /> {t('dash.registerPatient')}</Link>
        </div>
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input
            value={search}
            placeholder={t('patients.searchPlaceholder')}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('common.search')}
          />
          <div className="segmented">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={cx(status === f.id && 'is-active')}
                onClick={() => { setStatus(f.id); setPage(1); }}
              >
                {t(f.key)}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs faint">
            {query.data ? `${query.data.total} ${t(query.data.total === 1 ? 'patients.countOne' : 'patients.count')}` : ''}
          </span>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={8}
          empty={
            <EmptyState
              title={debounced ? `${t('patients.noMatch')} “${debounced}”` : t('patients.empty')}
              description={debounced ? t('patients.noMatchHint') : t('patients.emptyHint')}
              action={<Link className="btn btn--primary btn--sm" to="/patients/new">{t('dash.registerPatient')}</Link>}
            />
          }
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('common.patient')}</th><th>{t('common.phone')}</th><th>{t('patients.colAgeGender')}</th>
                    <th>{t('patients.colRegistered')}</th><th>{t('patients.colAllergies')}</th>
                    <th>{t('common.status')}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => navigate(`/patients/${p.id}`)}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={p.full_name} />
                          <div>
                            <b>{p.full_name}</b>
                            <small>{p.patient_code}</small>
                          </div>
                        </div>
                      </td>
                      <td>{p.phone}</td>
                      <td>{ageOf(p)} · {label('gender', p.gender)}</td>
                      <td>{dateOnly(p.registered_at)}</td>
                      <td>
                        {p.allergies
                          ? <Badge tone="danger">{p.allergies}</Badge>
                          : <span className="faint">{t('patients.noneRecorded')}</span>}
                      </td>
                      <td><Badge tone={p.status === 'active' ? 'ok' : 'muted'}>{label('status', p.status)}</Badge></td>
                      <td className="right"><Icon name="chevronRight" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </Card>
    </>
  );
}
