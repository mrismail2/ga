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
import { useI18n } from '@/i18n';

const FILTERS = [
  { id: 'all', key: 'common.all' },
  { id: 'unpaid', key: 'out.filterUnpaid' },
  { id: 'partial', key: 'out.filterPartial' },
  { id: 'overdue', key: 'out.filterOverdue' },
  { id: 'braces', key: 'out.filterBraces' },
  { id: 'other', key: 'out.filterOther' },
] as const;

const PAGE_SIZE = 25;

/**
 * The page that answers "who still owes us money?" — the second problem the
 * paper book could not solve.
 */
export default function Outstanding() {
  const { can } = useAuth();
  const { t } = useI18n();
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
          <h1>{t('out.title')}</h1>
          <p>{t('out.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label={t('out.totalBilled')}
          value={totals.data ? money(totals.data.billed) : '…'}
          hint={t('out.totalBilledHint')} />
        <StatCard tone="ok" label={t('out.collected')}
          value={totals.data ? money(totals.data.collected) : '…'} />
        <StatCard tone="danger" label={t('out.stillOutstanding')}
          value={totals.data ? money(totals.data.outstanding) : '…'} />
        <StatCard tone="warn" label={t('out.openBalances')}
          value={totals.data ? totals.data.count : '…'}
          hint={t('out.openBalancesHint')} />
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input
            value={search}
            placeholder={t('patients.searchPlaceholder')}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="segmented">
            {FILTERS.map((f) => (
              <button key={f.id} className={cx(filter === f.id && 'is-active')}
                onClick={() => { setFilter(f.id); setPage(1); }}>
                {t(f.key)}
              </button>
            ))}
          </div>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={8}
          empty={<EmptyState title={t('out.empty')}
            description={t('out.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('common.patient')}</th><th>{t('common.treatment')}</th>
                    <th className="right">{t('common.total')}</th><th className="right">{t('common.paid')}</th>
                    <th className="right">{t('common.balance')}</th><th>{t('common.status')}</th>
                    <th>{t('out.lastPayment')}</th><th>{t('out.nextAppointment')}</th><th />
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
                        <b>{row.treatment_name ?? t('common.treatment')}</b>
                        {row.is_orthodontic && (
                          <div><Badge tone="violet">{t('out.braces')}</Badge></div>
                        )}
                      </td>
                      <td className="right">{money(row.final_cost)}</td>
                      <td className="right">{money(row.amount_paid)}</td>
                      <td className="right bold danger-text">{money(row.balance)}</td>
                      <td><PaymentBadge status={row.payment_status} /></td>
                      <td>
                        {row.last_payment_at
                          ? <span title={dateOnly(row.last_payment_at)}>{relative(row.last_payment_at)}</span>
                          : <span className="faint">{t('out.never')}</span>}
                      </td>
                      <td>
                        {row.next_appointment_at
                          ? smartDate(row.next_appointment_at)
                          : <span className="faint">{t('out.noneBooked')}</span>}
                      </td>
                      <td className="right">
                        {can('finance.write') && (
                          <Button size="sm" variant="primary" onClick={() => setPayRow(row)}>
                            <Icon name="payment" /> {t('profile.payment')}
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
