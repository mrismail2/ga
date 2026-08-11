import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/services/admin';
import { listTreatmentTypes, upsertTreatmentType } from '@/services/clinical';
import { readableError } from '@/lib/supabase';
import { money, titleCase } from '@/lib/format';
import type { ClinicSettings, TreatmentType } from '@/types/database';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, Skeleton, Tabs, Textarea, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

export default function Settings() {
  const [tab, setTab] = useState('clinic');
  return (
    <>
      <div className="page__head">
        <div>
          <h1>Settings</h1>
          <p>Clinic details, treatment price list and pharmacy thresholds.</p>
        </div>
      </div>

      <Card padded={false} className="mb-16">
        <Tabs
          tabs={[
            { id: 'clinic', label: 'Clinic information' },
            { id: 'treatments', label: 'Treatments & prices' },
            { id: 'pharmacy', label: 'Pharmacy' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Card>

      {tab === 'clinic' && <ClinicSettingsForm />}
      {tab === 'treatments' && <TreatmentPrices />}
      {tab === 'pharmacy' && <PharmacySettings />}
    </>
  );
}

function useSettingsForm() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const save = useMutation({
    mutationFn: (patch: Partial<ClinicSettings>) => updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      notify('Settings saved');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return { settings, save };
}

function ClinicSettingsForm() {
  const { settings, save } = useSettingsForm();
  const [form, setForm] = useState<Partial<ClinicSettings>>({});
  const [loaded, setLoaded] = useState(false);

  if (settings.isPending) return <Skeleton rows={6} />;
  if (!settings.data) {
    return <EmptyState title="Clinic settings row is missing"
      description="Run the 0004_reference_data migration to create it." />;
  }
  if (!loaded) {
    setLoaded(true);
    setForm(settings.data);
  }

  const set = (key: keyof ClinicSettings, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card title="Clinic information" subtitle="Shown on receipts and patient statements">
      <div className="form-grid">
        <Field label="Clinic name" required>
          <Input value={form.clinic_name ?? ''} onChange={(e) => set('clinic_name', e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Currency symbol" hint="Used across the whole system">
          <Input value={form.currency_symbol ?? '$'} onChange={(e) => set('currency_symbol', e.target.value)} />
        </Field>
        <div className="full">
          <Field label="Address">
            <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
        <div className="full">
          <Field label="Receipt footer">
            <Textarea rows={2} value={form.receipt_footer ?? ''}
              onChange={(e) => set('receipt_footer', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="row mt-16">
        <Button variant="primary" className="ml-auto" loading={save.isPending}
          onClick={() => save.mutate({
            clinic_name: form.clinic_name,
            phone: form.phone,
            email: form.email,
            address: form.address,
            currency_symbol: form.currency_symbol,
            receipt_footer: form.receipt_footer,
          })}>
          <Icon name="check" /> Save changes
        </Button>
      </div>
    </Card>
  );
}

function PharmacySettings() {
  const { settings, save } = useSettingsForm();
  const [low, setLow] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);

  if (settings.isPending) return <Skeleton rows={4} />;
  const s = settings.data;

  return (
    <Card title="Pharmacy thresholds" subtitle="Control when the dashboard raises alerts">
      <div className="form-grid">
        <Field label="Low stock threshold"
          hint="Default minimum used when a medicine has no specific minimum">
          <Input type="number" min={0}
            value={low ?? String(s?.low_stock_threshold ?? 10)}
            onChange={(e) => setLow(e.target.value)} />
        </Field>
        <Field label="Expiry warning (days)"
          hint="Medicine expiring within this many days is flagged">
          <Input type="number" min={0}
            value={expiry ?? String(s?.expiry_warning_days ?? 30)}
            onChange={(e) => setExpiry(e.target.value)} />
        </Field>
      </div>
      <div className="row mt-16">
        <Button variant="primary" className="ml-auto" loading={save.isPending}
          onClick={() => save.mutate({
            low_stock_threshold: Number(low ?? s?.low_stock_threshold ?? 10),
            expiry_warning_days: Number(expiry ?? s?.expiry_warning_days ?? 30),
          })}>
          <Icon name="check" /> Save changes
        </Button>
      </div>
    </Card>
  );
}

function TreatmentPrices() {
  const [editing, setEditing] = useState<TreatmentType | 'new' | null>(null);
  const types = useQuery({ queryKey: ['treatment-types', 'all'], queryFn: () => listTreatmentTypes(false) });

  return (
    <>
      <Card
        title="Treatment price list"
        subtitle="Prices suggested when a treatment is created"
        padded={false}
        actions={<Button size="sm" variant="primary" onClick={() => setEditing('new')}>
          <Icon name="plus" /> Add treatment
        </Button>}
      >
        <QueryBoundary
          query={types}
          skeletonRows={8}
          empty={<EmptyState title="No treatment types"
            description="Run the reference data migration or add treatments here." />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Code</th><th>Treatment</th><th>Category</th>
                    <th className="right">Default price</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className="bold">{t.code}</td>
                      <td>{t.name}</td>
                      <td>{titleCase(t.category)}</td>
                      <td className="right">{money(t.default_price)}</td>
                      <td><Badge tone={t.is_active ? 'ok' : 'muted'}>{t.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="right"><Button size="sm" onClick={() => setEditing(t)}>Edit</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>
      </Card>

      <TreatmentTypeModal target={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function TreatmentTypeModal({
  target, onClose,
}: { target: TreatmentType | 'new' | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const isNew = target === 'new';
  const existing = target !== 'new' ? target : null;

  const [form, setForm] = useState({
    code: '', name: '', category: 'general', default_price: '0', is_active: 'true',
  });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = isNew ? 'new' : existing?.id ?? null;
  if (target && loadedFor !== key) {
    setLoadedFor(key);
    setForm({
      code: existing?.code ?? '',
      name: existing?.name ?? '',
      category: existing?.category ?? 'general',
      default_price: String(existing?.default_price ?? 0),
      is_active: String(existing?.is_active ?? true),
    });
    setError(null);
  }

  const save = useMutation({
    mutationFn: () => upsertTreatmentType({
      ...(existing ? { id: existing.id } : {}),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      default_price: Number(form.default_price),
      is_active: form.is_active === 'true',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-types'] });
      notify(isNew ? 'Treatment added' : 'Treatment updated');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={isNew ? 'Add treatment type' : 'Edit treatment type'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending}
            onClick={() => {
              setError(null);
              if (!form.code.trim()) { setError('Enter a short code, e.g. FILLING.'); return; }
              if (!form.name.trim()) { setError('Enter the treatment name.'); return; }
              save.mutate();
            }}>
            Save
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Code" required hint="Unique, e.g. RCT">
          <Input value={form.code} disabled={Boolean(existing)}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        </Field>
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {['general', 'preventive', 'restorative', 'surgical', 'endodontic', 'prosthetic',
              'cosmetic', 'orthodontic', 'pediatric', 'periodontal'].map((c) => (
                <option key={c} value={c}>{titleCase(c)}</option>
              ))}
          </Select>
        </Field>
        <Field label="Default price" required>
          <Input type="number" min={0} step="0.01" value={form.default_price}
            onChange={(e) => setForm((f) => ({ ...f, default_price: e.target.value }))} />
        </Field>
        <Field label="Status">
          <Select value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value }))}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </Field>
      </div>
      <p className="text-2xs faint mt-12">
        Changing a price here only affects new treatments. Treatments already recorded keep the
        price they were created with.
      </p>
    </Modal>
  );
}
