import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/services/admin';
import { createTreatmentType, listTreatmentTypes, updateTreatmentType } from '@/services/clinical';
import { readableError } from '@/lib/supabase';
import { money } from '@/lib/format';
import type { ClinicSettings, TreatmentType } from '@/types/database';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, Skeleton, Tabs, Textarea, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const TREATMENT_CATEGORIES = [
  'general', 'preventive', 'restorative', 'surgical', 'endodontic',
  'prosthetic', 'cosmetic', 'orthodontic', 'pediatric', 'periodontal',
];

export default function Settings() {
  const { t } = useI18n();
  const [tab, setTab] = useState('clinic');
  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('set.title')}</h1>
          <p>{t('set.subtitle')}</p>
        </div>
      </div>

      <Card padded={false} className="mb-16">
        <Tabs
          tabs={[
            { id: 'clinic', label: t('set.tabClinic') },
            { id: 'treatments', label: t('set.tabTreatments') },
            { id: 'pharmacy', label: t('set.tabPharmacy') },
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
  const { t } = useI18n();

  const save = useMutation({
    mutationFn: (patch: Partial<ClinicSettings>) => updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      notify(t('set.saved'));
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return { settings, save };
}

function ClinicSettingsForm() {
  const { t } = useI18n();
  const { settings, save } = useSettingsForm();
  const [form, setForm] = useState<Partial<ClinicSettings>>({});
  const [loaded, setLoaded] = useState(false);

  if (settings.isPending) return <Skeleton rows={6} />;
  if (!settings.data) {
    return <EmptyState title={t('set.missing')}
      description={t('set.missingHint')} />;
  }
  if (!loaded) {
    setLoaded(true);
    setForm(settings.data);
  }

  const set = (key: keyof ClinicSettings, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card title={t('set.clinicInfo')} subtitle={t('set.clinicInfoHint')}>
      <div className="form-grid">
        <Field label={t('set.clinicName')} required>
          <Input value={form.clinic_name ?? ''} onChange={(e) => set('clinic_name', e.target.value)} />
        </Field>
        <Field label={t('common.phone')}>
          <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('common.email')}>
          <Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label={t('set.currencySymbol')} hint={t('set.currencySymbolHint')}>
          <Input value={form.currency_symbol ?? '$'} onChange={(e) => set('currency_symbol', e.target.value)} />
        </Field>
        <div className="full">
          <Field label={t('common.address')}>
            <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
        <div className="full">
          <Field label={t('set.receiptFooter')}>
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
          <Icon name="check" /> {t('common.saveChanges')}
        </Button>
      </div>
    </Card>
  );
}

function PharmacySettings() {
  const { t } = useI18n();
  const { settings, save } = useSettingsForm();
  const [low, setLow] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);

  if (settings.isPending) return <Skeleton rows={4} />;
  const s = settings.data;

  return (
    <Card title={t('set.thresholds')} subtitle={t('set.thresholdsHint')}>
      <div className="form-grid">
        <Field label={t('set.lowStock')} hint={t('set.lowStockHint')}>
          <Input type="number" min={0}
            value={low ?? String(s?.low_stock_threshold ?? 10)}
            onChange={(e) => setLow(e.target.value)} />
        </Field>
        <Field label={t('set.expiryWarning')} hint={t('set.expiryWarningHint')}>
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
          <Icon name="check" /> {t('common.saveChanges')}
        </Button>
      </div>
    </Card>
  );
}

function TreatmentPrices() {
  const { t, label } = useI18n();
  const [editing, setEditing] = useState<TreatmentType | 'new' | null>(null);
  const types = useQuery({ queryKey: ['treatment-types', 'all'], queryFn: () => listTreatmentTypes(false) });

  return (
    <>
      <Card
        title={t('set.priceList')}
        subtitle={t('set.priceListHint')}
        padded={false}
        actions={<Button size="sm" variant="primary" onClick={() => setEditing('new')}>
          <Icon name="plus" /> {t('set.addTreatment')}
        </Button>}
      >
        <div className="alert tone-brand" style={{ margin: 14, display: 'block' }}>
          <b className="text-sm">{t('set.serviceMenuTitle')}</b>
          <p className="text-xs mt-8">{t('set.serviceMenuIntro')}</p>
        </div>

        <QueryBoundary
          query={types}
          skeletonRows={8}
          empty={<EmptyState title={t('set.noTypes')}
            description={t('set.noTypesHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('set.serviceName')}</th><th>{t('common.category')}</th>
                    <th className="right">{t('set.defaultPrice')}</th>
                    <th>{t('set.offeredHere')}</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={row.is_active ? undefined : 'faint'}>
                      <td>
                        <b>{row.name}</b>
                        <div className="text-2xs faint">{row.code}</div>
                      </td>
                      <td>{label('tcat', row.category)}</td>
                      <td className="right bold">{money(row.default_price)}</td>
                      <td><Badge tone={row.is_active ? 'ok' : 'muted'}>
                        {row.is_active ? t('set.offered') : t('set.notOffered')}
                      </Badge></td>
                      <td className="right">
                        <Button size="sm" onClick={() => setEditing(row)}>{t('common.edit')}</Button>
                      </td>
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
  const { t, label } = useI18n();
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
    mutationFn: () => (existing
      ? updateTreatmentType(existing.id, {
        name: form.name.trim(),
        category: form.category,
        default_price: Number(form.default_price),
        is_active: form.is_active === 'true',
      })
      : createTreatmentType({
        name: form.name.trim(),
        category: form.category,
        default_price: Number(form.default_price),
        is_active: form.is_active === 'true',
      })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-types'] });
      notify(isNew ? t('set.typeAdded') : t('set.typeUpdated'));
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={isNew ? t('set.typeAddTitle') : t('set.typeEditTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={save.isPending}
            onClick={() => {
              setError(null);
              if (!form.name.trim()) { setError(t('set.errName')); return; }
              save.mutate();
            }}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <div className="full">
          <Field label={t('set.serviceName')} required hint={t('set.serviceNameHint')}>
            <Input value={form.name} autoFocus placeholder={t('set.serviceNamePlaceholder')}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
        </div>
        <Field label={t('set.defaultPrice')} required hint={t('set.defaultPriceHint')}>
          <Input type="number" min={0} step="0.01" value={form.default_price}
            onChange={(e) => setForm((f) => ({ ...f, default_price: e.target.value }))} />
        </Field>
        <Field label={t('common.category')} hint={t('set.categoryHint')}>
          <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {TREATMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{label('tcat', c)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.status')} hint={t('set.statusHint')}>
          <Select value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value }))}>
            <option value="true">{t('set.offered')}</option>
            <option value="false">{t('set.notOffered')}</option>
          </Select>
        </Field>
        {existing && (
          <Field label={t('set.code')} hint={t('set.codeReadOnlyHint')}>
            <Input value={existing.code} disabled />
          </Field>
        )}
      </div>
      <p className="text-2xs faint mt-12">{t('set.typeFootnote')}</p>
    </Modal>
  );
}
