import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adjustStock, listBatches, listMedicineCategories, listMedicineStock,
  listStockMovements, upsertMedicine,
} from '@/services/pharmacy';
import { readableError } from '@/lib/supabase';
import { dateOnly, dateTime, money, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { MedicineStock, StockMovementType } from '@/types/database';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, StatCard, Tabs, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const STATUS_TONE = {
  in_stock: 'ok', low_stock: 'warn', out_of_stock: 'danger', expiring_soon: 'warn',
} as const;

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'low_stock', label: 'Low stock' },
  { id: 'out_of_stock', label: 'Out of stock' },
  { id: 'expiring_soon', label: 'Expiring soon' },
] as const;

export default function Medicines() {
  const { can } = useAuth();
  const [tab, setTab] = useState('stock');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [editing, setEditing] = useState<MedicineStock | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<MedicineStock | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(id);
  }, [search]);

  const stock = useQuery({
    queryKey: ['stock', filter, debounced],
    queryFn: () => listMedicineStock({ status: filter, search: debounced }),
  });
  const movements = useQuery({
    queryKey: ['stock-movements'], queryFn: () => listStockMovements(undefined, 150),
    enabled: tab === 'movements',
  });

  const rows = stock.data ?? [];
  const value = rows.reduce((t, m) => t + m.usable_quantity * Number(m.purchase_price), 0);

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Medicines & stock</h1>
          <p>The clinic's single internal pharmacy — quantities, batches and expiry dates.</p>
        </div>
        {can('pharmacy.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Icon name="plus" /> Add medicine
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label="Medicines" value={rows.length} />
        <StatCard tone="warn" label="Low or out of stock"
          value={rows.filter((m) => m.stock_status === 'low_stock' || m.stock_status === 'out_of_stock').length} />
        <StatCard tone="danger" label="Expiring soon"
          value={rows.filter((m) => m.stock_status === 'expiring_soon').length} />
        <StatCard tone="ok" label="Stock value" value={money(value)} hint="At purchase price" />
      </div>

      <Card padded={false}>
        <Tabs
          tabs={[{ id: 'stock', label: 'Stock' }, { id: 'batches', label: 'Batches' },
                 { id: 'movements', label: 'Movement history' }]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'stock' && (
          <>
            <div className="toolbar">
              <Input value={search} placeholder="Search medicine, generic name or barcode…"
                onChange={(e) => setSearch(e.target.value)} />
              <div className="segmented">
                {FILTERS.map((f) => (
                  <button key={f.id} className={cx(filter === f.id && 'is-active')} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <QueryBoundary
              query={stock}
              skeletonRows={8}
              empty={<EmptyState title="No medicines yet"
                description="Add the medicines the clinic keeps, then record a purchase to bring stock in." />}
            >
              {(list) => (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr><th>Medicine</th><th>Category</th><th>Form</th>
                        <th className="right">In stock</th><th className="right">Minimum</th>
                        <th>Earliest expiry</th><th className="right">Selling price</th>
                        <th>Status</th><th /></tr>
                    </thead>
                    <tbody>
                      {list.map((m) => (
                        <tr key={m.medicine_id}>
                          <td>
                            <b>{m.name}</b> {m.strength}
                            {m.generic_name && <div className="text-2xs faint">{m.generic_name}</div>}
                          </td>
                          <td>{m.category_name ?? '—'}</td>
                          <td>{titleCase(m.dosage_form)}</td>
                          <td className={cx('right bold', m.usable_quantity <= m.minimum_stock && 'danger-text')}>
                            {m.usable_quantity}
                            {m.expired_quantity > 0 && (
                              <div className="text-2xs danger-text">{m.expired_quantity} expired</div>
                            )}
                          </td>
                          <td className="right">{m.minimum_stock}</td>
                          <td>{m.earliest_expiry ? dateOnly(m.earliest_expiry) : <span className="faint">—</span>}</td>
                          <td className="right">{money(m.selling_price)}</td>
                          <td><Badge tone={STATUS_TONE[m.stock_status]}>{titleCase(m.stock_status)}</Badge></td>
                          <td className="right">
                            {can('pharmacy.write') && (
                              <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                                <Button size="sm" onClick={() => setEditing(m)}>Edit</Button>
                                <Button size="sm" onClick={() => setAdjusting(m)}>Adjust</Button>
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
          </>
        )}

        {tab === 'batches' && <BatchTable />}

        {tab === 'movements' && (
          <QueryBoundary
            query={movements}
            skeletonRows={8}
            empty={<EmptyState title="No stock movements yet"
              description="Purchases, sales, dispensing and adjustments are all recorded here." />}
          >
            {(list) => (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>When</th><th>Medicine</th><th>Type</th><th className="right">Before</th>
                      <th className="right">Change</th><th className="right">After</th><th>Reason</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {list.map((mv) => (
                      <tr key={mv.id}>
                        <td>{dateTime(mv.created_at)}</td>
                        <td>{mv.medicine?.name ?? '—'}</td>
                        <td><Badge tone={mv.quantity_change > 0 ? 'ok' : 'warn'}>{titleCase(mv.movement_type)}</Badge></td>
                        <td className="right">{mv.quantity_before}</td>
                        <td className={cx('right bold', mv.quantity_change > 0 ? 'ok-text' : 'danger-text')}>
                          {mv.quantity_change > 0 ? '+' : ''}{mv.quantity_change}
                        </td>
                        <td className="right">{mv.quantity_after}</td>
                        <td className="text-xs">{mv.reason ?? '—'}</td>
                        <td className="text-xs">{mv.performed_by_profile?.full_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryBoundary>
        )}
      </Card>

      <MedicineModal
        target={editing}
        onClose={() => setEditing(null)}
      />
      <AdjustModal medicine={adjusting} onClose={() => setAdjusting(null)} />
    </>
  );
}

function BatchTable() {
  const batches = useQuery({ queryKey: ['batches'], queryFn: () => listBatches() });
  return (
    <QueryBoundary
      query={batches}
      skeletonRows={7}
      empty={<EmptyState title="No stock batches"
        description="Confirm a purchase to bring medicine into stock with a batch number and expiry date." />}
    >
      {(rows) => (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Medicine</th><th>Batch</th><th>Expiry</th>
                <th className="right">Quantity</th><th className="right">Purchase price</th><th>Received</th></tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const expired = b.expiry_date ? new Date(b.expiry_date) <= new Date() : false;
                return (
                  <tr key={b.id}>
                    <td><b>{b.medicine?.name}</b> {b.medicine?.strength}</td>
                    <td>{b.batch_number}</td>
                    <td className={cx(expired && 'danger-text bold')}>
                      {b.expiry_date ? dateOnly(b.expiry_date) : '—'}
                      {expired && <Badge tone="danger">Expired</Badge>}
                    </td>
                    <td className="right">{b.quantity}</td>
                    <td className="right">{money(b.purchase_price)}</td>
                    <td>{dateOnly(b.received_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </QueryBoundary>
  );
}

function MedicineModal({
  target, onClose,
}: { target: MedicineStock | 'new' | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const categories = useQuery({ queryKey: ['medicine-categories'], queryFn: listMedicineCategories });
  const isNew = target === 'new';
  const existing = target !== 'new' ? target : null;

  const [form, setForm] = useState({
    name: '', generic_name: '', category_id: '', dosage_form: 'tablet',
    strength: '', barcode: '', purchase_price: '0', selling_price: '0', minimum_stock: '10',
  });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = isNew ? 'new' : existing?.medicine_id ?? null;
  if (target && loadedFor !== key) {
    setLoadedFor(key);
    setForm({
      name: existing?.name ?? '',
      generic_name: existing?.generic_name ?? '',
      category_id: existing?.category_id ?? '',
      dosage_form: existing?.dosage_form ?? 'tablet',
      strength: existing?.strength ?? '',
      barcode: existing?.barcode ?? '',
      purchase_price: String(existing?.purchase_price ?? 0),
      selling_price: String(existing?.selling_price ?? 0),
      minimum_stock: String(existing?.minimum_stock ?? 10),
    });
    setError(null);
  }

  const save = useMutation({
    mutationFn: () => upsertMedicine({
      ...(existing ? { id: existing.medicine_id } : {}),
      name: form.name.trim(),
      generic_name: form.generic_name.trim() || null,
      category_id: form.category_id || null,
      dosage_form: form.dosage_form,
      strength: form.strength.trim() || null,
      barcode: form.barcode.trim() || null,
      purchase_price: Number(form.purchase_price),
      selling_price: Number(form.selling_price),
      minimum_stock: Number(form.minimum_stock),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      notify(isNew ? 'Medicine added' : 'Medicine updated');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={isNew ? 'Add medicine' : 'Edit medicine'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending}
            onClick={() => {
              setError(null);
              if (form.name.trim().length < 2) { setError('Enter the medicine name.'); return; }
              save.mutate();
            }}>
            Save
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Medicine name" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Generic name">
          <Input value={form.generic_name} onChange={(e) => set('generic_name', e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">Uncategorised</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Dosage form">
          <Select value={form.dosage_form} onChange={(e) => set('dosage_form', e.target.value)}>
            {['tablet', 'capsule', 'syrup', 'injection', 'gel', 'mouthwash', 'cartridge', 'other']
              .map((f) => <option key={f} value={f}>{titleCase(f)}</option>)}
          </Select>
        </Field>
        <Field label="Strength">
          <Input value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="500mg" />
        </Field>
        <Field label="Barcode">
          <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
        </Field>
        <Field label="Purchase price">
          <Input type="number" min={0} step="0.01" value={form.purchase_price}
            onChange={(e) => set('purchase_price', e.target.value)} />
        </Field>
        <Field label="Selling price">
          <Input type="number" min={0} step="0.01" value={form.selling_price}
            onChange={(e) => set('selling_price', e.target.value)} />
        </Field>
        <Field label="Minimum stock" hint="Below this the medicine shows as low stock">
          <Input type="number" min={0} value={form.minimum_stock}
            onChange={(e) => set('minimum_stock', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function AdjustModal({ medicine, onClose }: { medicine: MedicineStock | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const batches = useQuery({
    queryKey: ['batches', medicine?.medicine_id],
    queryFn: () => listBatches(medicine!.medicine_id),
    enabled: Boolean(medicine),
  });

  const [batchId, setBatchId] = useState('');
  const [change, setChange] = useState('-1');
  const [type, setType] = useState<StockMovementType>('adjustment');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: () => adjustStock(batchId, Number(change), type, reason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      notify('Stock adjusted');
      setReason('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  return (
    <Modal
      open={medicine !== null}
      onClose={onClose}
      title={`Adjust stock — ${medicine?.name ?? ''}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={apply.isPending}
            onClick={() => {
              setError(null);
              if (!batchId) { setError('Choose the batch to adjust.'); return; }
              if (!Number(change)) { setError('Enter a non-zero change.'); return; }
              if (reason.trim().length < 3) { setError('A reason is required.'); return; }
              apply.mutate();
            }}>
            Apply adjustment
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <div className="full">
          <Field label="Batch" required>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Choose a batch…</option>
              {batches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} · {b.quantity} in stock
                  {b.expiry_date ? ` · expires ${b.expiry_date}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Change" required hint="Negative removes stock, positive adds it">
          <Input type="number" value={change} onChange={(e) => setChange(e.target.value)} />
        </Field>
        <Field label="Reason type" required>
          <Select value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>
            {(['adjustment', 'damaged', 'expired', 'returned'] as StockMovementType[]).map((t) => (
              <option key={t} value={t}>{titleCase(t)}</option>
            ))}
          </Select>
        </Field>
        <div className="full">
          <Field label="Reason" required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. broken vial during handling" />
          </Field>
        </div>
      </div>
      <p className="text-2xs faint mt-12">
        Every adjustment is written to the stock movement log with your name and the quantity
        before and after.
      </p>
    </Modal>
  );
}
