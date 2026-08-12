import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPayments, voidPayment } from '@/services/finance';
import { readableError } from '@/lib/supabase';
import { dateTime, isoDate, money } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentMethod } from '@/types/database';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination,
  QueryBoundary, Select, StatCard, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import Receipt from '@/components/finance/Receipt';
import { useI18n } from '@/i18n';

const METHODS: (PaymentMethod | 'all')[] = ['all', 'cash', 'evc_plus', 'zaad', 'edahab', 'bank', 'other'];
const PAGE_SIZE = 25;

export default function Payments() {
  const { profile } = useAuth();
  const { t, label } = useI18n();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(isoDate());
  const [method, setMethod] = useState<PaymentMethod | 'all'>('all');
  const [page, setPage] = useState(1);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const query = useQuery({
    queryKey: ['payments', from, to, method, page],
    queryFn: () => listPayments({ from, to, method, page, pageSize: PAGE_SIZE }),
  });

  const rows = query.data?.rows ?? [];
  const total = rows.filter((p) => !p.voided_at).reduce((t, p) => t + Number(p.amount), 0);

  const doVoid = useMutation({
    mutationFn: () => voidPayment(voidId!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-balances'] });
      notify(t('payments.voided'));
      setVoidId(null); setReason('');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('payments.title')}</h1>
          <p>{t('payments.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid--3 mb-16">
        <StatCard tone="ok" label={t('payments.collected')} value={money(total)}
          hint={`${rows.filter((p) => !p.voided_at).length} ${t('payments.count')}`} />
        <StatCard tone="brand" label={t('common.period')}
          value={`${dateTime(from).split(',')[0]} – ${dateTime(to).split(',')[0]}`} />
        <StatCard tone="warn" label={t('payments.voidedCount')}
          value={rows.filter((p) => p.voided_at).length} />
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          <Select value={method} onChange={(e) => { setMethod(e.target.value as PaymentMethod | 'all'); setPage(1); }}
            style={{ width: 160 }}>
            {METHODS.map((m) => (
              <option key={m} value={m}>{m === 'all' ? t('payments.allMethods') : label('method', m)}</option>
            ))}
          </Select>
          <Link className="btn ml-auto" to="/outstanding"><Icon name="balance" /> {t('out.title')}</Link>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={8}
          empty={<EmptyState title={t('payments.empty')}
            description={t('payments.emptyHint')} />}
        >
          {(list) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('common.receipt')}</th><th>{t('common.date')}</th>
                    <th>{t('common.patient')}</th><th>{t('common.treatment')}</th>
                    <th>{t('common.method')}</th><th>{t('common.reference')}</th>
                    <th className="right">{t('common.amount')}</th><th /></tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className={p.voided_at ? 'faint' : undefined}>
                      <td className="bold">{p.receipt_number}</td>
                      <td>{dateTime(p.paid_at)}</td>
                      <td>
                        {p.patient
                          ? <Link to={`/patients/${p.patient.id}`}>
                              <b>{p.patient.full_name}</b>
                              <div className="text-2xs faint">{p.patient.patient_code}</div>
                            </Link>
                          : '—'}
                      </td>
                      <td>{p.treatment?.treatment_type?.name ?? p.treatment?.description ?? '—'}</td>
                      <td>{label('method', p.method)}</td>
                      <td className="text-xs faint">{p.reference ?? '—'}</td>
                      <td className="right bold">{money(p.amount)}</td>
                      <td className="right">
                        {p.voided_at ? (
                          <Badge tone="danger">{t('payments.voidedBadge')}</Badge>
                        ) : (
                          <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                            <Button size="sm" onClick={() => setReceiptId(p.id)}>{t('payments.receiptBtn')}</Button>
                            {profile?.role === 'admin' && (
                              <Button size="sm" onClick={() => setVoidId(p.id)}>{t('payments.void')}</Button>
                            )}
                          </div>
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

      <Receipt paymentId={receiptId} open={receiptId !== null} onClose={() => setReceiptId(null)} />

      <Modal
        open={voidId !== null}
        onClose={() => { setVoidId(null); setReason(''); }}
        title={t('payments.voidTitle')}
        footer={
          <>
            <Button onClick={() => { setVoidId(null); setReason(''); }}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              loading={doVoid.isPending}
              onClick={() => {
                if (reason.trim().length < 3) { notify(t('payments.voidNeedReason'), 'danger'); return; }
                doVoid.mutate();
              }}
            >
              {t('payments.voidTitle')}
            </Button>
          </>
        }
      >
        <p className="text-sm muted mb-16">{t('payments.voidExplain')}</p>
        <Field label={t('common.reason')} required>
          <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={t('payments.voidReasonPlaceholder')} />
        </Field>
      </Modal>

    </>
  );
}
