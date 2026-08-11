import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPayments, voidPayment } from '@/services/finance';
import { readableError } from '@/lib/supabase';
import { dateTime, isoDate, money, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentMethod } from '@/types/database';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination,
  QueryBoundary, Select, StatCard, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import Receipt from '@/components/finance/Receipt';

const METHODS: (PaymentMethod | 'all')[] = ['all', 'cash', 'evc_plus', 'zaad', 'edahab', 'bank', 'other'];
const PAGE_SIZE = 25;

export default function Payments() {
  const { profile } = useAuth();
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
      notify('Payment voided — the original entry is kept for the audit trail');
      setVoidId(null); setReason('');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Payments</h1>
          <p>Every receipt issued by the clinic. Payments are never deleted — mistakes are voided.</p>
        </div>
      </div>

      <div className="grid grid--3 mb-16">
        <StatCard tone="ok" label="Collected in this period" value={money(total)}
          hint={`${rows.filter((p) => !p.voided_at).length} payments`} />
        <StatCard tone="brand" label="Period"
          value={`${dateTime(from).split(',')[0]} – ${dateTime(to).split(',')[0]}`} />
        <StatCard tone="warn" label="Voided in this period"
          value={rows.filter((p) => p.voided_at).length} />
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          <Select value={method} onChange={(e) => { setMethod(e.target.value as PaymentMethod | 'all'); setPage(1); }}
            style={{ width: 160 }}>
            {METHODS.map((m) => <option key={m} value={m}>{m === 'all' ? 'All methods' : titleCase(m)}</option>)}
          </Select>
          <Link className="btn ml-auto" to="/outstanding"><Icon name="balance" /> Outstanding balances</Link>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={8}
          empty={<EmptyState title="No payments in this period"
            description="Change the date range, or record a payment from a patient's treatment." />}
        >
          {(list) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Receipt</th><th>Date</th><th>Patient</th><th>Treatment</th>
                    <th>Method</th><th>Reference</th><th className="right">Amount</th><th /></tr>
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
                      <td>{titleCase(p.method)}</td>
                      <td className="text-xs faint">{p.reference ?? '—'}</td>
                      <td className="right bold">{money(p.amount)}</td>
                      <td className="right">
                        {p.voided_at ? (
                          <Badge tone="danger">Voided</Badge>
                        ) : (
                          <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                            <Button size="sm" onClick={() => setReceiptId(p.id)}>Receipt</Button>
                            {profile?.role === 'admin' && (
                              <Button size="sm" onClick={() => setVoidId(p.id)}>Void</Button>
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
        title="Void this payment"
        footer={
          <>
            <Button onClick={() => { setVoidId(null); setReason(''); }}>Cancel</Button>
            <Button
              variant="danger"
              loading={doVoid.isPending}
              onClick={() => {
                if (reason.trim().length < 3) { notify('Enter a reason first.', 'danger'); return; }
                doVoid.mutate();
              }}
            >
              Void payment
            </Button>
          </>
        }
      >
        <p className="text-sm muted mb-16">
          Voiding keeps the original record and restores the treatment balance. The action is
          written to the audit log with your name.
        </p>
        <Field label="Reason" required>
          <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. entered twice by mistake" />
        </Field>
      </Modal>

    </>
  );
}
