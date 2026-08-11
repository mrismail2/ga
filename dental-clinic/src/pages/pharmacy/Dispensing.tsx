import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dispensePrescription, listMedicineStock, listPrescriptions } from '@/services/pharmacy';
import { readableError } from '@/lib/supabase';
import { dateTime, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { Prescription } from '@/types/database';
import {
  Avatar, Badge, Button, Card, EmptyState, Input, Modal, QueryBoundary, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const FILTERS = [
  { id: 'open', label: 'To dispense' },
  { id: 'dispensed', label: 'Dispensed' },
  { id: 'all', label: 'All' },
] as const;

export default function Dispensing() {
  const { can } = useAuth();
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
          <h1>Pharmacy dispensing</h1>
          <p>Prescriptions written by the dentists arrive here immediately.</p>
        </div>
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <div className="segmented">
            {FILTERS.map((f) => (
              <button key={f.id} className={cx(filter === f.id && 'is-active')} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <QueryBoundary
          query={query}
          skeletonRows={6}
          empty={<EmptyState title="Nothing waiting to be dispensed"
            description="New prescriptions appear here as soon as a dentist writes them." />}
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
                            <Badge tone="danger">Allergy: {rx.patient.allergies}</Badge>
                          )}
                        </div>
                        <div className="text-2xs faint">
                          {rx.prescription_number} · {dateTime(rx.prescribed_at)} · {rx.dentist?.full_name ?? '—'}
                        </div>
                      </div>
                      <Badge tone={rx.status === 'dispensed' ? 'ok' : rx.status === 'cancelled' ? 'danger' : 'warn'}>
                        {titleCase(rx.status)}
                      </Badge>
                      {can('pharmacy.write') && rx.status !== 'dispensed' && rx.status !== 'cancelled' && (
                        <Button size="sm" variant="primary" onClick={() => setActive(rx)}>
                          Dispense{pending ? ` (${pending})` : ''}
                        </Button>
                      )}
                    </div>

                    <ul className="mt-8">
                      {rx.items?.map((item) => (
                        <li key={item.id} className="text-sm muted">
                          • <b>{item.medicine_name}</b> {item.strength} — {item.dose} {item.frequency},
                          {' '}{item.duration} · qty {item.quantity}
                          <span className={cx('ml-auto', item.dispensed_quantity >= item.quantity ? 'ok-text' : 'faint')}>
                            {' '}({item.dispensed_quantity}/{item.quantity} dispensed)
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
      notify('Medicine dispensed and stock updated');
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
      title="Dispense prescription"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={dispense.isPending}
            onClick={() => {
              setError(null);
              if (!Object.values(quantities).some((q) => q > 0)) {
                setError('Enter at least one quantity to dispense.');
                return;
              }
              dispense.mutate();
            }}>
            Dispense and update stock
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      {prescription?.patient?.allergies && (
        <div className="alert tone-danger mb-16">
          <Icon name="alert" />
          <span><b>Allergy on file:</b> {prescription.patient.allergies}</span>
        </div>
      )}

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Medicine</th><th>Prescribed</th><th>Already given</th>
              <th>In stock</th><th>Dispense now</th></tr>
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
                      <div className="text-2xs danger-text">Not linked to a stocked medicine</div>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.dispensed_quantity}</td>
                  <td className={cx(shortfall && 'danger-text bold')}>
                    {available ? available.usable_quantity : <span className="faint">—</span>}
                    {available?.stock_status === 'expiring_soon' && (
                      <div className="text-2xs"><Badge tone="warn">Expiring soon</Badge></div>
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

      <p className="text-2xs faint mt-12">
        Stock is deducted first-expiring-first. Expired batches are never used, and the
        database refuses to dispense more than is available.
      </p>
      <Link className="text-xs" to="/pharmacy/medicines">Open medicine stock</Link>
    </Modal>
  );
}
