import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPatient, findPossibleDuplicates } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateOnly } from '@/lib/format';
import type { Gender, PatientInput } from '@/types/database';
import { Button, Card, Field, Input, Select, Textarea, useToast } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const EMPTY: PatientInput = {
  full_name: '', gender: 'female', date_of_birth: null, age_years: null,
  phone: '', alt_phone: null, address: null,
  emergency_contact_name: null, emergency_contact_phone: null, photo_url: null,
  allergies: null, medical_conditions: null, current_medications: null,
  notes: null, status: 'active',
};

export default function PatientRegister() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t } = useI18n();

  const [form, setForm] = useState<PatientInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateAck, setDuplicateAck] = useState(false);
  const [probe, setProbe] = useState({ name: '', phone: '' });

  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Duplicate check runs while typing — the paper book's worst failure was the
  // same patient entered twice under slightly different spellings.
  useEffect(() => {
    const id = setTimeout(() => setProbe({ name: form.full_name, phone: form.phone }), 400);
    return () => clearTimeout(id);
  }, [form.full_name, form.phone]);

  const duplicates = useQuery({
    queryKey: ['duplicates', probe],
    queryFn: () => findPossibleDuplicates(probe.name, probe.phone),
    enabled: probe.name.trim().length >= 3 || probe.phone.trim().length >= 6,
  });

  const mutation = useMutation({
    mutationFn: createPatient,
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notify(`${patient.full_name} ${t('register.success')} ${patient.patient_code}`);
      navigate(`/patients/${patient.id}`);
    },
    onError: (error) => notify(readableError(error), 'danger'),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.full_name.trim().length < 2) next.full_name = t('register.errName');
    if (form.phone.trim().length < 6) next.phone = t('register.errPhone');
    if (!form.date_of_birth && form.age_years == null) {
      next.age_years = t('register.errAge');
    }
    if (form.age_years != null && (form.age_years < 0 || form.age_years > 130)) {
      next.age_years = t('register.errAgeRange');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;          // guards double-click
    if (!validate()) return;
    if ((duplicates.data?.length ?? 0) > 0 && !duplicateAck) {
      notify(t('register.duplicateConfirm'), 'danger');
      return;
    }
    mutation.mutate({
      ...form,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
    });
  }

  return (
    <>
      <div className="crumbs">
        <Link to="/patients">{t('patients.title')}</Link><Icon name="chevronRight" size={12} /><span>{t('register.title')}</span>
      </div>
      <div className="page__head">
        <div>
          <h1>{t('register.title')}</h1>
          <p>{t('register.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        {(duplicates.data?.length ?? 0) > 0 && (
          <div className="alert tone-warn mb-16" style={{ display: 'block' }}>
            <div className="row mb-8">
              <Icon name="alert" />
              <b>{t('register.duplicateTitle')}</b>
            </div>
            <div className="col" style={{ gap: 6 }}>
              {duplicates.data?.map((d) => (
                <Link key={d.id} to={`/patients/${d.id}`} className="row text-sm">
                  <b>{d.full_name}</b>
                  <span className="faint">{d.patient_code} · {d.phone} · {t('register.registeredOn')} {dateOnly(d.registered_at)}</span>
                  <span className="ml-auto text-xs">{t('register.openRecord')}</span>
                </Link>
              ))}
            </div>
            <label className="checkbox mt-12">
              <input
                type="checkbox"
                checked={duplicateAck}
                onChange={(e) => setDuplicateAck(e.target.checked)}
              />
              <span>{t('register.duplicateAck')}</span>
            </label>
          </div>
        )}

        <div className="grid grid--2">
          <Card title={t('register.details')}>
            <div className="form-grid">
              <Field label={t('register.fullName')} required error={errors.full_name}>
                <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
                  placeholder={t('register.fullNamePlaceholder')} autoFocus />
              </Field>
              <Field label={t('register.gender')} required>
                <Select value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
                  <option value="female">{t('register.female')}</option>
                  <option value="male">{t('register.male')}</option>
                </Select>
              </Field>
              <Field label={t('register.dob')} hint={t('register.dobHint')}>
                <Input type="date" value={form.date_of_birth ?? ''}
                  onChange={(e) => set('date_of_birth', e.target.value || null)} />
              </Field>
              <Field label={t('register.age')} error={errors.age_years}>
                <Input type="number" min={0} max={130} value={form.age_years ?? ''}
                  onChange={(e) => set('age_years', e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
              <Field label={t('register.phone')} required error={errors.phone}>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+252 …" />
              </Field>
              <Field label={t('register.altPhone')}>
                <Input value={form.alt_phone ?? ''} onChange={(e) => set('alt_phone', e.target.value || null)} />
              </Field>
              <Field label={t('common.address')}>
                <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value || null)} />
              </Field>
              <Field label={t('common.status')}>
                <Select value={form.status} onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}>
                  <option value="active">{t('status.active')}</option>
                  <option value="inactive">{t('status.inactive')}</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title={t('register.medical')} subtitle={t('register.medicalHint')}>
            <div className="col" style={{ gap: 14 }}>
              <Field label={t('register.allergies')} hint={t('register.allergiesHint')}>
                <Input value={form.allergies ?? ''} onChange={(e) => set('allergies', e.target.value || null)} />
              </Field>
              <Field label={t('register.conditions')} hint={t('register.conditionsHint')}>
                <Textarea rows={2} value={form.medical_conditions ?? ''}
                  onChange={(e) => set('medical_conditions', e.target.value || null)} />
              </Field>
              <Field label={t('register.medications')}>
                <Textarea rows={2} value={form.current_medications ?? ''}
                  onChange={(e) => set('current_medications', e.target.value || null)} />
              </Field>
              <div className="form-grid">
                <Field label={t('register.emergencyName')}>
                  <Input value={form.emergency_contact_name ?? ''}
                    onChange={(e) => set('emergency_contact_name', e.target.value || null)} />
                </Field>
                <Field label={t('register.emergencyPhone')}>
                  <Input value={form.emergency_contact_phone ?? ''}
                    onChange={(e) => set('emergency_contact_phone', e.target.value || null)} />
                </Field>
              </div>
              <Field label={t('common.notes')}>
                <Textarea rows={2} value={form.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value || null)} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="row mt-16">
          <Button type="button" onClick={() => navigate('/patients')}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending} className="ml-auto">
            <Icon name="check" /> {t('register.submit')}
          </Button>
        </div>
      </form>
    </>
  );
}
