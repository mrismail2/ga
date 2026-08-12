import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adjustStock, listBatches, listMedicineCategories, listMedicineStock,
  listStockMovements, upsertMedicine,
} from '@/services/pharmacy';
import { readableError } from '@/lib/supabase';
import { dateOnly, dateTime, money } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { MedicineStock, StockMovementType } from '@/types/database';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, StatCard, Tabs, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const STATUS_TONE = {
  in_stock: 'ok', low_stock: 'warn', out_of_stock: 'danger', expiring_soon: 'warn',
} as const;

const FILTERS = [
  { id: 'all', key: 'common.all' },
  { id: 'low_stock', key: 'med.filterLow' },
  { id: 'out_of_stock', key: 'med.filterOut' },
  { id: 'expiring_soon', key: 'med.filterExpiring' },
] as const;

const DOSAGE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'gel', 'mouthwash', 'cartridge', 'other'];

export default function Medicines() {
  const { can } = useAuth();
  const { t, label } = useI18n();
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
          <h1>{t('med.title')}</h1>
          <p>{t('med.subtitle')}</p>
        </div>
        {can('pharmacy.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Icon name="plus" /> {t('med.add')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label={t('med.statMedicines')} value={rows.length} />
        <StatCard tone="warn" label={t('med.statLow')}
          value={rows.filter((m) => m.stock_status === 'low_stock' || m.stock_status === 'out_of_stock').length} />
        <StatCard tone="danger" label={t('med.statExpiring')}
          value={rows.filter((m) => m.stock_status === 'expiring_soon').length} />
        <StatCard tone="ok" label={t('med.statValue')} value={money(value)} hint={t('med.statValueHint')} />
      </div>

      <Card padded={false}>
        <Tabs
          tabs={[{ id: 'stock', label: t('med.tabStock') }, { id: 'batches', label: t('med.tabBatches') },
                 { id: 'movements', label: t('med.tabMovements') }]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'stock' && (
          <>
            <div className="toolbar">
              <Input value={search} placeholder={t('med.searchPlaceholder')}
                onChange={(e) => setSearch(e.target.value)} />
              <div className="segmented">
                {FILTERS.map((f) => (
                  <button key={f.id} className={cx(filter === f.id && 'is-active')} onClick={() => setFilter(f.id)}>
                    {t(f.key)}
                  </button>
                ))}
              </div>
            </div>
            <QueryBoundary
              query={stock}
              skeletonRows={8}
              empty={<EmptyState title={t('med.empty')}
                description={t('med.emptyHint')} />}
            >
              {(list) => (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr><th>{t('rx.medicine')}</th><th>{t('common.category')}</th><th>{t('med.colForm')}</th>
                        <th className="right">{t('med.colInStock')}</th>
                        <th className="right">{t('med.colMinimum')}</th>
                        <th>{t('med.colEarliestExpiry')}</th>
                        <th className="right">{t('med.colSelling')}</th>
                        <th>{t('common.status')}</th><th /></tr>
                    </thead>
                    <tbody>
                      {list.map((m) => (
                        <tr key={m.medicine_id}>
                          <td>
                            <b>{m.name}</b> {m.strength}
                            {m.generic_name && <div className="text-2xs faint">{m.generic_name}</div>}
                          </td>
                          <td>{m.category_name ?? '—'}</td>
                          <td>{label('form', m.dosage_form)}</td>
                          <td className={cx('right bold', m.usable_quantity <= m.minimum_stock && 'danger-text')}>
                            {m.usable_quantity}
                            {m.expired_quantity > 0 && (
                              <div className="text-2xs danger-text">{m.expired_quantity} {t('med.expired')}</div>
                            )}
                          </td>
                          <td className="right">{m.minimum_stock}</td>
                          <td>{m.earliest_expiry ? dateOnly(m.earliest_expiry) : <span className="faint">—</span>}</td>
                          <td className="right">{money(m.selling_price)}</td>
                          <td><Badge tone={STATUS_TONE[m.stock_status]}>{label('status', m.stock_status)}</Badge></td>
                          <td className="right">
                            {can('pharmacy.write') && (
                              <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                                <Button size="sm" onClick={() => setEditing(m)}>{t('common.edit')}</Button>
                                <Button size="sm" onClick={() => setAdjusting(m)}>{t('med.adjust')}</Button>
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
            empty={<EmptyState title={t('med.noMovements')}
              description={t('med.noMovementsHint')} />}
          >
            {(list) => (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>{t('common.when')}</th><th>{t('rx.medicine')}</th>
                      <th>{t('med.colType')}</th><th className="right">{t('med.colBefore')}</th>
                      <th className="right">{t('med.colChange')}</th>
                      <th className="right">{t('med.colAfter')}</th>
                      <th>{t('common.reason')}</th><th>{t('med.colBy')}</th></tr>
                  </thead>
                  <tbody>
                    {list.map((mv) => (
                      <tr key={mv.id}>
                        <td>{dateTime(mv.created_at)}</td>
                        <td>{mv.medicine?.name ?? '—'}</td>
                        <td><Badge tone={mv.quantity_change > 0 ? 'ok' : 'warn'}>{label('move', mv.movement_type)}</Badge></td>
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
  const { t } = useI18n();
  const batches = useQuery({ queryKey: ['batches'], queryFn: () => listBatches() });
  return (
    <QueryBoundary
      query={batches}
      skeletonRows={7}
      empty={<EmptyState title={t('med.noBatches')}
        description={t('med.noBatchesHint')} />}
    >
      {(rows) => (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>{t('rx.medicine')}</th><th>{t('med.batch')}</th><th>{t('med.expiry')}</th>
                <th className="right">{t('common.quantity')}</th>
                <th className="right">{t('med.purchasePrice')}</th><th>{t('med.received')}</th></tr>
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
                      {expired && <Badge tone="danger">{t('med.expiredBadge')}</Badge>}
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
  const { t, label } = useI18n();
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
      notify(isNew ? t('med.added') : t('med.updated'));
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={isNew ? t('med.addTitle') : t('med.editTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={save.isPending}
            onClick={() => {
              setError(null);
              if (form.name.trim().length < 2) { setError(t('med.errName')); return; }
              save.mutate();
            }}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label={t('med.medicineName')} required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('med.genericName')}>
          <Input value={form.generic_name} onChange={(e) => set('generic_name', e.target.value)} />
        </Field>
        <Field label={t('common.category')}>
          <Select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">{t('med.uncategorised')}</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label={t('med.dosageForm')}>
          <Select value={form.dosage_form} onChange={(e) => set('dosage_form', e.target.value)}>
            {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{label('form', f)}</option>)}
          </Select>
        </Field>
        <Field label={t('rx.strength')}>
          <Input value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="500mg" />
        </Field>
        <Field label={t('med.barcode')}>
          <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
        </Field>
        <Field label={t('med.purchasePrice')}>
          <Input type="number" min={0} step="0.01" value={form.purchase_price}
            onChange={(e) => set('purchase_price', e.target.value)} />
        </Field>
        <Field label={t('med.sellingPrice')}>
          <Input type="number" min={0} step="0.01" value={form.selling_price}
            onChange={(e) => set('selling_price', e.target.value)} />
        </Field>
        <Field label={t('med.minimumStock')} hint={t('med.minimumStockHint')}>
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
  const { t, label } = useI18n();
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
      notify(t('med.adjusted'));
      setReason('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  return (
    <Modal
      open={medicine !== null}
      onClose={onClose}
      title={`${t('med.adjustTitle')} — ${medicine?.name ?? ''}`}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={apply.isPending}
            onClick={() => {
              setError(null);
              if (!batchId) { setError(t('med.errBatch')); return; }
              if (!Number(change)) { setError(t('med.errChange')); return; }
              if (reason.trim().length < 3) { setError(t('med.errReason')); return; }
              apply.mutate();
            }}>
            {t('med.applyAdjustment')}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <div className="full">
          <Field label={t('med.batch')} required>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">{t('med.chooseBatch')}</option>
              {batches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} · {b.quantity} {t('rx.inStock')}
                  {b.expiry_date ? ` · ${t('med.expires')} ${b.expiry_date}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t('med.colChange')} required hint={t('med.changeHint')}>
          <Input type="number" value={change} onChange={(e) => setChange(e.target.value)} />
        </Field>
        <Field label={t('med.reasonType')} required>
          <Select value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>
            {(['adjustment', 'damaged', 'expired', 'returned'] as StockMovementType[]).map((mt) => (
              <option key={mt} value={mt}>{label('move', mt)}</option>
            ))}
          </Select>
        </Field>
        <div className="full">
          <Field label={t('common.reason')} required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={t('med.reasonPlaceholder')} />
          </Field>
        </div>
      </div>
      <p className="text-2xs faint mt-12">{t('med.adjustFootnote')}</p>
    </Modal>
  );
}
