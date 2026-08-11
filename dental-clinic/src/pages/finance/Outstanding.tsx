import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listOutstanding, outstandingTotals } from '@/services/finance';
import { dateOnly, money, relative, smartDate } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { OutstandingBalance } from '@/types/database';
import {
  Avatar, Badge, Button, Card, EmptyState, Input, Pagination, PaymentBadge,
  QueryBoundary, StatCard, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import Receipt from '@/components/finance/Receipt';
import { listTreatmentBalances } from '@/services/clinical';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partial' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'braces', label: 'Braces' },
  { id: 'other', label: 'Other treatments' },
] as const;

const PAGE_SIZE = 25;

/**
 * The page that answers "who still owes us money?" — the second problem the
 * paper book could not solve.
 */
export default function Outstanding() {
  const { can } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [payRow, setPayRow] = useState<OutstandingBalance | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => { setDebounced(search); setPage(1); }, 200);
    return () => clearTimeout(id);
  }, [search]);

  const query = useQuery({
    queryKey: ['outstanding', filter, debounced, page],
    queryFn: () => listOutstanding({ filter, search: debounced, page, pageSize: PAGE_SIZE }),
  });
  const totals = useQuery({ queryKey: ['outstanding-totals'], queryFn: outstandingTotals });

  // The payment dialog needs the full balance row for the selected treatment.
  const balances = useQuery({
    queryKey: ['treatment-balances', payRow?.patient_id],
    queryFn: () => listTreatmentBalances(payRow!.patient_id),
    enabled: Boolean(payRow?.patient_id),
  });
  const treatment = balances.data?.find((b) => b.treatment_id === payRow?.treatment_id) ?? null;

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Outstanding balances</h1>
          <p>Patients paying in installments and anyone who still owes the clinic money.</p>
        </div>
      </div>

      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label="Total billed"
          value={totals.data ? money(totals.data.billed) : '…'}
          hint="Across unsettled treatments" />
        <StatCard tone="ok" label="Collected"
          value={totals.data ? money(totals.data.collected) : '…'} />
        <StatCard tone="danger" label="Still outstanding"
          value={totals.data ? money(totals.data.outstanding) : '…'} />
        <StatCard tone="warn" label="Open balances"
          value={totals.data ? totals.data.count : '…'}
          hint="Treatments not fully paid" />
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input
            value={search}
            placeholder="Search name, patient ID or phone…"
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="segmented">
            {FILTERS.map((f) => (
              <button key={f.id} className={cx(filter === f.id && 'is-active')}
                onClick={() => { setFilter(f.id); setPage(1); }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={8}
          empty={<EmptyState title="Nothing outstanding"
            description="Every treatment in this filter is fully paid." />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Patient</th><th>Treatment</th>
                    <th className="right">Total</th><th className="right">Paid</th>
                    <th className="right">Balance</th><th>Status</th>
                    <th>Last payment</th><th>Next appointment</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.treatment_id}>
                      <td>
                        <Link to={`/patients/${row.patient_id}`} className="cell-user">
                          <Avatar name={row.full_name} size="sm" />
                          <div>
                            <b>{row.full_name}</b>
                            <small>{row.patient_code} · {row.phone}</small>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <b>{row.treatment_name ?? 'Treatment'}</b>
                        {row.is_orthodontic && (
                          <div><Badge tone="violet">Braces</Badge></div>
                        )}
                      </td>
                      <td className="right">{money(row.final_cost)}</td>
                      <td className="right">{money(row.amount_paid)}</td>
                      <td className="right bold danger-text">{money(row.balance)}</td>
                      <td><PaymentBadge status={row.payment_status} /></td>
                      <td>
                        {row.last_payment_at
                          ? <span title={dateOnly(row.last_payment_at)}>{relative(row.last_payment_at)}</span>
                          : <span className="faint">Never</span>}
                      </td>
                      <td>
                        {row.next_appointment_at
                          ? smartDate(row.next_appointment_at)
                          : <span className="faint">None booked</span>}
                      </td>
                      <td className="right">
                        {can('finance.write') && (
                          <Button size="sm" variant="primary" onClick={() => setPayRow(row)}>
                            <Icon name="payment" /> Payment
                          </Button>
                        )}
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

      <RecordPaymentModal
        open={payRow !== null && treatment !== null}
        treatment={treatment}
        orthoCaseId={payRow?.ortho_case_id ?? null}
        onClose={() => setPayRow(null)}
        onRecorded={setReceiptId}
      />
      <Receipt paymentId={receiptId} open={receiptId !== null} onClose={() => setReceiptId(null)} />
    </>
  );
}
