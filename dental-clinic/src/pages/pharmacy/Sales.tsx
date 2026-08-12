import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSale, listMedicineStock, listSales } from '@/services/pharmacy';
import { quickSearchPatients } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateTime, isoDate, money } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentMethod } from '@/types/database';
import {
  Avatar, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, StatCard, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const METHODS: PaymentMethod[] = ['cash', 'evc_plus', 'zaad', 'edahab', 'bank', 'other'];

export default function Sales() {
  const { can } = useAuth();
  const { t, label } = useI18n();
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 7 * 86_400_000)));
  const [to, setTo] = useState(isoDate());
  const [selling, setSelling] = useState(false);

  const sales = useQuery({ queryKey: ['sales', from, to], queryFn: () => listSales({ from, to }) });
  const total = (sales.data ?? []).filter((s) => !s.voided_at)
    .reduce((t, s) => t + Number(s.total_amount), 0);

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('sale.title')}</h1>
          <p>{t('sale.subtitle')}</p>
        </div>
        {can('pharmacy.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setSelling(true)}><Icon name="plus" /> {t('sale.new')}</Button>
          </div>
        )}
      </div>

      <div className="grid grid--3 mb-16">
        <StatCard tone="ok" label={t('sale.statSales')} value={money(total)} />
        <StatCard tone="brand" label={t('sale.statTransactions')} value={(sales.data ?? []).length} />
        <StatCard tone="warn" label={t('common.period')} value={`${from} → ${to}`} />
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <QueryBoundary
          query={sales}
          skeletonRows={7}
          empty={<EmptyState title={t('sale.empty')}
            description={t('sale.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('sale.colSale')}</th><th>{t('common.when')}</th>
                    <th>{t('common.patient')}</th><th>{t('common.method')}</th>
                    <th>{t('sale.soldBy')}</th><th className="right">{t('common.total')}</th></tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td className="bold">{s.sale_number}</td>
                      <td>{dateTime(s.sold_at)}</td>
                      <td>{s.patient?.full_name ?? <span className="faint">{t('sale.walkIn')}</span>}</td>
                      <td>{label('method', s.payment_method)}</td>
                      <td>{s.sold_by_profile?.full_name ?? '—'}</td>
                      <td className="right bold">{money(s.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>
      </Card>

      <SaleModal open={selling} onClose={() => setSelling(false)} />
    </>
  );
}

interface Line { medicine_id: string; name: string; quantity: number; unit_price: number; available: number }

function SaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t, label } = useI18n();
  const stock = useQuery({ queryKey: ['stock'], queryFn: () => listMedicineStock({}) });

  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [term, setTerm] = useState('');
  const [patient, setPatient] = useState<{ id: string; full_name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(crypto.randomUUID());

  const results = useQuery({
    queryKey: ['quick-search', term],
    queryFn: () => quickSearchPatients(term),
    enabled: term.trim().length >= 2 && !patient,
  });

  const sell = useMutation({
    mutationFn: () => createSale({
      items: lines.map((l) => ({ medicine_id: l.medicine_id, quantity: l.quantity, unit_price: l.unit_price })),
      patient_id: patient?.id ?? null,
      method,
      client_token: tokenRef.current,
    }),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notify(`${t('sale.recorded', { number: sale.sale_number })} — ${money(sale.total_amount)}`);
      tokenRef.current = crypto.randomUUID();
      setLines([]); setPatient(null); setTerm('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function addLine(medicineId: string) {
    const m = stock.data?.find((x) => x.medicine_id === medicineId);
    if (!m) return;
    if (lines.some((l) => l.medicine_id === medicineId)) return;
    setLines((prev) => [...prev, {
      medicine_id: m.medicine_id,
      name: `${m.name} ${m.strength ?? ''}`.trim(),
      quantity: 1,
      unit_price: Number(m.selling_price),
      available: m.usable_quantity,
    }]);
    setPick('');
  }

  const total = lines.reduce((t, l) => t + l.quantity * l.unit_price, 0);
  const overStock = lines.find((l) => l.quantity > l.available);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sale.modalTitle')}
      wide
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={sell.isPending}
            onClick={() => {
              setError(null);
              if (!lines.length) { setError(t('sale.errItems')); return; }
              if (overStock) {
                setError(t('sale.errStock', { available: overStock.available, name: overStock.name }));
                return;
              }
              sell.mutate();
            }}>
            {t('sale.submit')} · {money(total)}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      <div className="form-grid mb-16">
        <Field label={t('rx.medicine')} hint={t('sale.medicineHint')}>
          <Select value={pick} onChange={(e) => addLine(e.target.value)}>
            <option value="">{t('sale.addMedicine')}</option>
            {stock.data?.filter((m) => m.usable_quantity > 0).map((m) => (
              <option key={m.medicine_id} value={m.medicine_id}>
                {m.name} {m.strength} — {m.usable_quantity} {t('rx.inStock')} · {money(m.selling_price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('pay.methodLabel')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => <option key={m} value={m}>{label('method', m)}</option>)}
          </Select>
        </Field>
        <div className="full">
          <Field label={t('sale.patientOptional')} hint={t('sale.patientHint')}>
            {patient ? (
              <div className="row">
                <Avatar name={patient.full_name} size="sm" />
                <b className="text-sm">{patient.full_name}</b>
                <Button size="sm" className="ml-auto" onClick={() => setPatient(null)}>{t('sale.clear')}</Button>
              </div>
            ) : (
              <>
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('common.searchPatient')} />
                <div className="col mt-8" style={{ gap: 4 }}>
                  {results.data?.map((p) => (
                    <button key={p.id} type="button" className="gsearch__item"
                      onClick={() => setPatient({ id: p.id, full_name: p.full_name })}>
                      <Avatar name={p.full_name} size="sm" />
                      <span className="text-sm bold">{p.full_name}</span>
                      <span className="text-2xs faint">{p.patient_code}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>
        </div>
      </div>

      {lines.length === 0 ? (
        <EmptyState title={t('sale.noItems')} description={t('sale.noItemsHint')} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>{t('rx.medicine')}</th><th className="right">{t('med.colInStock')}</th>
                <th>{t('common.quantity')}</th><th>{t('sale.unitPrice')}</th>
                <th className="right">{t('sale.lineTotal')}</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.medicine_id}>
                  <td><b>{l.name}</b></td>
                  <td className="right">{l.available}</td>
                  <td>
                    <Input type="number" min={1} max={l.available} style={{ width: 90 }}
                      value={l.quantity}
                      onChange={(e) => setLines((prev) => prev.map((x, idx) =>
                        idx === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))} />
                  </td>
                  <td>
                    <Input type="number" min={0} step="0.01" style={{ width: 110 }}
                      value={l.unit_price}
                      onChange={(e) => setLines((prev) => prev.map((x, idx) =>
                        idx === i ? { ...x, unit_price: Number(e.target.value) } : x))} />
                  </td>
                  <td className="right bold">{money(l.quantity * l.unit_price)}</td>
                  <td className="right">
                    <Button size="sm" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                      {t('common.remove')}
                    </Button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="right bold">{t('common.total')}</td>
                <td className="right bold">{money(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
