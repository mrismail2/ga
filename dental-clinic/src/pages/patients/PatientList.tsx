import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listPatients } from '@/services/patients';
import { ageOf, dateOnly, titleCase } from '@/lib/format';
import {
  Avatar, Badge, Card, EmptyState, Input, Pagination, QueryBoundary, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const PAGE_SIZE = 25;
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
] as const;

export default function PatientList() {
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
          <h1>Patients</h1>
          <p>The clinic's digital registration book — search by name, patient ID or phone number.</p>
        </div>
        <div className="page__actions">
          <Link className="btn btn--primary" to="/patients/new"><Icon name="plus" /> Register patient</Link>
        </div>
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input
            value={search}
            placeholder="Search name, patient ID or phone…"
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search patients"
          />
          <div className="segmented">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={cx(status === f.id && 'is-active')}
                onClick={() => { setStatus(f.id); setPage(1); }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs faint">
            {query.data ? `${query.data.total} patient${query.data.total === 1 ? '' : 's'}` : ''}
          </span>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={8}
          empty={
            <EmptyState
              title={debounced ? `No patient matches “${debounced}”` : 'No patients registered yet'}
              description={debounced
                ? 'Check the spelling, or try the phone number instead. If this is a new patient, register them now.'
                : 'Register the first patient to start replacing the paper book.'}
              action={<Link className="btn btn--primary btn--sm" to="/patients/new">Register patient</Link>}
            />
          }
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Patient</th><th>Phone</th><th>Age / gender</th>
                    <th>Registered</th><th>Allergies</th><th>Status</th><th />
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
                      <td>{ageOf(p)} · {titleCase(p.gender)}</td>
                      <td>{dateOnly(p.registered_at)}</td>
                      <td>
                        {p.allergies
                          ? <Badge tone="danger">{p.allergies}</Badge>
                          : <span className="faint">None recorded</span>}
                      </td>
                      <td><Badge tone={p.status === 'active' ? 'ok' : 'muted'}>{titleCase(p.status)}</Badge></td>
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
