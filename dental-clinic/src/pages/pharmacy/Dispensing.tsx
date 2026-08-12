import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dispensePrescription, listMedicineStock, listPrescriptions } from '@/services/pharmacy';
import { readableError } from '@/lib/supabase';
import { dateTime } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { Prescription } from '@/types/database';
import {
  Avatar, Badge, Button, Card, EmptyState, Input, Modal, QueryBoundary, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const FILTERS = [
  { id: 'open', key: 'disp.filterOpen' },
  { id: 'dispensed', key: 'rx.filterDispensed' },
  { id: 'all', key: 'common.all' },
] as const;

export default function Dispensing() {
  const { can } = useAuth();
  const { t, label } = useI18n();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('open');
  const [active, setActive] = useState<Prescription | null>(null);

  const query = useQuery({
    queryKey: ['prescriptions', filter],
    queryFn: () => listPrescriptions({ status: filter }),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('disp.title')}</h1>
          <p>{t('disp.subtitle')}</p>
        </div>
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <div className="segmented">
            {FILTERS.map((f) => (
              <button key={f.id} className={cx(filter === f.id && 'is-active')} onClick={() => setFilter(f.id)}>
                {t(f.key)}
              </button>
            ))}
          </div>
        </div>

        <QueryBoundary
          query={query}
          skeletonRows={6}
          empty={<EmptyState title={t('disp.empty')}
            description={t('disp.emptyHint')} />}
        >
          {(rows) => (
            <div className="col">
              {rows.map((rx) => {
                const pending = (rx.items ?? []).filter((i) => i.dispensed_quantity < i.quantity).length;
                return (
                  <div key={rx.id} style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
                    <div className="row wrap">
                      <Avatar name={rx.patient?.full_name ?? '?'} size="sm" />
                      <div className="grow">
                        <div className="row row--sm">
                          <b className="text-sm">{rx.patient?.full_name}</b>
                          <span className="text-2xs faint">{rx.patient?.patient_code}</span>
                          {rx.patient?.allergies && (
                            <Badge tone="danger">{t('rx.allergy')}: {rx.patient.allergies}</Badge>
                          )}
                        </div>
                        <div className="text-2xs faint">
                          {rx.prescription_number} · {dateTime(rx.prescribed_at)} · {rx.dentist?.full_name ?? '—'}
                        </div>
                      </div>
                      <Badge tone={rx.status === 'dispensed' ? 'ok' : rx.status === 'cancelled' ? 'danger' : 'warn'}>
                        {label('status', rx.status)}
                      </Badge>
                      {can('pharmacy.write') && rx.status !== 'dispensed' && rx.status !== 'cancelled' && (
                        <Button size="sm" variant="primary" onClick={() => setActive(rx)}>
                          {t('disp.dispense')}{pending ? ` (${pending})` : ''}
                        </Button>
                      )}
                    </div>

                    <ul className="mt-8">
                      {rx.items?.map((item) => (
                        <li key={item.id} className="text-sm muted">
                          • <b>{item.medicine_name}</b> {item.strength} — {item.dose} {item.frequency},
                          {' '}{item.duration} · {t('rx.qty')} {item.quantity}
                          <span className={cx('ml-auto', item.dispensed_quantity >= item.quantity ? 'ok-text' : 'faint')}>
                            {' '}({item.dispensed_quantity}/{item.quantity} {t('disp.dispensedSuffix')})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </QueryBoundary>
      </Card>

      <DispenseModal prescription={active} onClose={() => setActive(null)} />
    </>
  );
}

function DispenseModal({
  prescription, onClose,
}: { prescription: Prescription | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t } = useI18n();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const stock = useQuery({ queryKey: ['stock'], queryFn: () => listMedicineStock({}) });

  if (prescription && loadedFor !== prescription.id) {
    setLoadedFor(prescription.id);
    setQuantities(Object.fromEntries(
      (prescription.items ?? []).map((i) => [i.id, Math.max(i.quantity - i.dispensed_quantity, 0)]),
    ));
    setError(null);
  }

  const dispense = useMutation({
    mutationFn: () => dispensePrescription(
      prescription!.id,
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([item_id, quantity]) => ({ item_id, quantity })),
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notify(t('disp.done'));
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  const stockFor = (medicineId: string | null) =>
    medicineId ? stock.data?.find((m) => m.medicine_id === medicineId) : undefined;

  return (
    <Modal
      open={prescription !== null}
      onClose={onClose}
      title={t('disp.modalTitle')}
      wide
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={dispense.isPending}
            onClick={() => {
              setError(null);
              if (!Object.values(quantities).some((q) => q > 0)) {
                setError(t('disp.errQuantity'));
                return;
              }
              dispense.mutate();
            }}>
            {t('disp.submit')}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      {prescription?.patient?.allergies && (
        <div className="alert tone-danger mb-16">
          <Icon name="alert" />
          <span><b>{t('disp.allergyOnFile')}</b> {prescription.patient.allergies}</span>
        </div>
      )}

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>{t('rx.medicine')}</th><th>{t('disp.colPrescribed')}</th>
              <th>{t('disp.colGiven')}</th><th>{t('disp.colStock')}</th>
              <th>{t('disp.colNow')}</th></tr>
          </thead>
          <tbody>
            {prescription?.items?.map((item) => {
              const available = stockFor(item.medicine_id);
              const remaining = item.quantity - item.dispensed_quantity;
              const shortfall = available && available.usable_quantity < (quantities[item.id] ?? 0);
              return (
                <tr key={item.id}>
                  <td>
                    <b>{item.medicine_name}</b> {item.strength}
                    {!item.medicine_id && (
                      <div className="text-2xs danger-text">{t('disp.notLinked')}</div>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.dispensed_quantity}</td>
                  <td className={cx(shortfall && 'danger-text bold')}>
                    {available ? available.usable_quantity : <span className="faint">—</span>}
                    {available?.stock_status === 'expiring_soon' && (
                      <div className="text-2xs"><Badge tone="warn">{t('disp.expiringSoon')}</Badge></div>
                    )}
                  </td>
                  <td>
                    <Input
                      type="number" min={0} max={remaining} style={{ width: 90 }}
                      value={quantities[item.id] ?? 0}
                      onChange={(e) => setQuantities((q) => ({
                        ...q, [item.id]: Math.max(0, Math.min(remaining, Number(e.target.value))),
                      }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-2xs faint mt-12">{t('disp.footnote')}</p>
      <Link className="text-xs" to="/pharmacy/medicines">{t('disp.openStock')}</Link>
    </Modal>
  );
}
