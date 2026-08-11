import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmPurchase, createPurchase, listMedicineStock, listPurchases,
  listSuppliers, upsertSupplier,
} from '@/services/pharmacy';
import { readableError } from '@/lib/supabase';
import { dateOnly, isoDate, money, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { Supplier } from '@/types/database';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, Tabs, Textarea, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

export default function Purchases() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [tab, setTab] = useState('purchases');
  const [creating, setCreating] = useState(false);
  const [supplierTarget, setSupplierTarget] = useState<Supplier | 'new' | null>(null);

  const purchases = useQuery({ queryKey: ['purchases'], queryFn: listPurchases });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const confirm = useMutation({
    mutationFn: confirmPurchase,
    onSuccess: (purchase) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      notify(`${purchase.purchase_number} confirmed — stock updated`);
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Purchases & suppliers</h1>
          <p>Bring medicine into stock. Quantities only move when a purchase is confirmed.</p>
        </div>
        {can('pharmacy.write') && (
          <div className="page__actions">
            <Button onClick={() => setSupplierTarget('new')}><Icon name="plus" /> Add supplier</Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> New purchase
            </Button>
          </div>
        )}
      </div>

      <Card padded={false}>
        <Tabs
          tabs={[
            { id: 'purchases', label: 'Purchases', count: purchases.data?.length },
            { id: 'suppliers', label: 'Suppliers', count: suppliers.data?.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'purchases' && (
          <QueryBoundary
            query={purchases}
            skeletonRows={6}
            empty={<EmptyState title="No purchases recorded"
              description="Record a purchase with batch numbers and expiry dates, then confirm it to add the stock." />}
          >
            {(rows) => (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Purchase</th><th>Supplier</th><th>Invoice</th><th>Date</th>
                      <th className="right">Total</th><th>Status</th><th /></tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id}>
                        <td className="bold">{p.purchase_number}</td>
                        <td>{p.supplier?.name ?? <span className="faint">—</span>}</td>
                        <td>{p.invoice_reference ?? '—'}</td>
                        <td>{dateOnly(p.purchase_date)}</td>
                        <td className="right">{money(p.total_amount)}</td>
                        <td>
                          <Badge tone={p.status === 'confirmed' ? 'ok' : p.status === 'cancelled' ? 'danger' : 'warn'}>
                            {titleCase(p.status)}
                          </Badge>
                        </td>
                        <td className="right">
                          {can('pharmacy.write') && p.status === 'draft' && (
                            <Button size="sm" variant="primary" loading={confirm.isPending}
                              onClick={() => confirm.mutate(p.id)}>
                              Confirm & add stock
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
        )}

        {tab === 'suppliers' && (
          <QueryBoundary
            query={suppliers}
            skeletonRows={5}
            empty={<EmptyState title="No suppliers yet"
              description="Add the pharmacies and wholesalers the clinic buys from." />}
          >
            {(rows) => (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Supplier</th><th>Phone</th><th>Address</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td><b>{s.name}</b>{s.notes && <div className="text-2xs faint">{s.notes}</div>}</td>
                        <td>{s.phone ?? '—'}</td>
                        <td>{s.address ?? '—'}</td>
                        <td><Badge tone={s.is_active ? 'ok' : 'muted'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></td>
                        <td className="right">
                          {can('pharmacy.write') && (
                            <Button size="sm" onClick={() => setSupplierTarget(s)}>Edit</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryBoundary>
        )}
      </Card>

      <PurchaseModal open={creating} onClose={() => setCreating(false)} />
      <SupplierModal target={supplierTarget} onClose={() => setSupplierTarget(null)} />
    </>
  );
}

interface PurchaseLine {
  medicine_id: string; name: string; batch_number: string;
  expiry_date: string; quantity: number; purchase_price: number;
}

function PurchaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const stock = useQuery({ queryKey: ['stock'], queryFn: () => listMedicineStock({}) });

  const [supplierId, setSupplierId] = useState('');
  const [invoice, setInvoice] = useState('');
  const [date, setDate] = useState(isoDate());
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createPurchase({
      supplier_id: supplierId || null,
      invoice_reference: invoice.trim() || null,
      purchase_date: date,
      items: lines.map((l) => ({
        medicine_id: l.medicine_id,
        batch_number: l.batch_number.trim() || 'NA',
        expiry_date: l.expiry_date || null,
        quantity: l.quantity,
        purchase_price: l.purchase_price,
      })),
    }),
    onSuccess: (purchase) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      notify(`${purchase.purchase_number} saved as a draft — confirm it to add the stock`);
      setLines([]); setInvoice('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function addLine(medicineId: string) {
    const m = stock.data?.find((x) => x.medicine_id === medicineId);
    if (!m) return;
    setLines((prev) => [...prev, {
      medicine_id: m.medicine_id,
      name: `${m.name} ${m.strength ?? ''}`.trim(),
      batch_number: '',
      expiry_date: '',
      quantity: 1,
      purchase_price: Number(m.purchase_price),
    }]);
    setPick('');
  }

  const total = lines.reduce((t, l) => t + l.quantity * l.purchase_price, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New purchase"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending}
            onClick={() => {
              setError(null);
              if (!lines.length) { setError('Add at least one medicine.'); return; }
              if (lines.some((l) => l.quantity <= 0)) { setError('Quantities must be greater than zero.'); return; }
              create.mutate();
            }}>
            Save purchase · {money(total)}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      <div className="form-grid mb-16">
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Not specified</option>
            {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Invoice reference">
          <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
        </Field>
        <Field label="Purchase date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Add medicine">
          <Select value={pick} onChange={(e) => addLine(e.target.value)}>
            <option value="">Choose…</option>
            {stock.data?.map((m) => (
              <option key={m.medicine_id} value={m.medicine_id}>{m.name} {m.strength}</option>
            ))}
          </Select>
        </Field>
      </div>

      {lines.length === 0 ? (
        <EmptyState title="No items yet" description="Choose a medicine to add it to this purchase." />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Quantity</th>
                <th>Unit cost</th><th className="right">Total</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={`${l.medicine_id}-${i}`}>
                  <td><b>{l.name}</b></td>
                  <td>
                    <Input style={{ width: 110 }} value={l.batch_number} placeholder="Batch"
                      onChange={(e) => setLines((p) => p.map((x, idx) =>
                        idx === i ? { ...x, batch_number: e.target.value } : x))} />
                  </td>
                  <td>
                    <Input type="date" style={{ width: 150 }} value={l.expiry_date}
                      onChange={(e) => setLines((p) => p.map((x, idx) =>
                        idx === i ? { ...x, expiry_date: e.target.value } : x))} />
                  </td>
                  <td>
                    <Input type="number" min={1} style={{ width: 90 }} value={l.quantity}
                      onChange={(e) => setLines((p) => p.map((x, idx) =>
                        idx === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))} />
                  </td>
                  <td>
                    <Input type="number" min={0} step="0.01" style={{ width: 110 }} value={l.purchase_price}
                      onChange={(e) => setLines((p) => p.map((x, idx) =>
                        idx === i ? { ...x, purchase_price: Number(e.target.value) } : x))} />
                  </td>
                  <td className="right bold">{money(l.quantity * l.purchase_price)}</td>
                  <td className="right">
                    <Button size="sm" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-2xs faint mt-12">
        Saving creates a draft. Stock quantities only change when you confirm the purchase,
        and each confirmation writes a stock movement entry.
      </p>
    </Modal>
  );
}

function SupplierModal({
  target, onClose,
}: { target: Supplier | 'new' | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const isNew = target === 'new';
  const existing = target !== 'new' ? target : null;

  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = isNew ? 'new' : existing?.id ?? null;
  if (target && loadedFor !== key) {
    setLoadedFor(key);
    setForm({
      name: existing?.name ?? '',
      phone: existing?.phone ?? '',
      address: existing?.address ?? '',
      notes: existing?.notes ?? '',
    });
    setError(null);
  }

  const save = useMutation({
    mutationFn: () => upsertSupplier({
      ...(existing ? { id: existing.id } : {}),
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      notify(isNew ? 'Supplier added' : 'Supplier updated');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={isNew ? 'Add supplier' : 'Edit supplier'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending}
            onClick={() => {
              setError(null);
              if (form.name.trim().length < 2) { setError('Enter the supplier name.'); return; }
              save.mutate();
            }}>
            Save
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </Field>
        <div className="full">
          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>
        </div>
        <div className="full">
          <Field label="Notes">
            <Textarea rows={2} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
