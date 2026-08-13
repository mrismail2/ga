import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePatient } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import type { Gender, Patient, PatientInput } from '@/types/database';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { useI18n } from '@/i18n';

/** Every field the registration form collects, editable after the fact. */
function formFrom(p: Patient): PatientInput {
  return {
    full_name: p.full_name,
    gender: p.gender,
    date_of_birth: p.date_of_birth,
    age_years: p.age_years,
    phone: p.phone,
    alt_phone: p.alt_phone,
    address: p.address,
    emergency_contact_name: p.emergency_contact_name,
    emergency_contact_phone: p.emergency_contact_phone,
    photo_url: p.photo_url,
    allergies: p.allergies,
    medical_conditions: p.medical_conditions,
    current_medications: p.current_medications,
    notes: p.notes,
    status: p.status,
  };
}

export default function EditPatientModal({
  patient, open, onClose,
}: { patient: Patient; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState<PatientInput>(() => formFrom(patient));
  const [loadedFor, setLoadedFor] = useState(patient.id);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the dialog is opened for a different patient.
  if (loadedFor !== patient.id) {
    setLoadedFor(patient.id);
    setForm(formFrom(patient));
    setError(null);
  }

  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: () => updatePatient(patient.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      notify(t('profile.updated'));
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function submit() {
    setError(null);
    if (form.full_name.trim().length < 2) { setError(t('register.errName')); return; }
    if (form.phone.trim().length < 6) { setError(t('register.errPhone')); return; }
    if (!form.date_of_birth && !form.age_years) { setError(t('register.errAge')); return; }
    save.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('profile.editTitle')}
      wide
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {t('common.saveChanges')}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      <div className="form-grid">
        <div className="full">
          <Field label={t('register.fullName')} required>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
        </div>
        <Field label={t('register.gender')} required>
          <Select value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
            <option value="female">{t('gender.female')}</option>
            <option value="male">{t('gender.male')}</option>
          </Select>
        </Field>
        <Field label={t('register.dob')} hint={t('register.dobHint')}>
          <Input type="date" value={form.date_of_birth ?? ''}
            onChange={(e) => set('date_of_birth', e.target.value || null)} />
        </Field>
        <Field label={t('register.age')}>
          <Input type="number" min={0} max={120} value={form.age_years ?? ''}
            onChange={(e) => set('age_years', e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label={t('register.phone')} required>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('register.altPhone')}>
          <Input value={form.alt_phone ?? ''} onChange={(e) => set('alt_phone', e.target.value || null)} />
        </Field>
        <Field label={t('common.status')}>
          <Select value={form.status} onChange={(e) => set('status', e.target.value as Patient['status'])}>
            <option value="active">{t('status.active')}</option>
            <option value="inactive">{t('status.inactive')}</option>
          </Select>
        </Field>
        <div className="full">
          <Field label={t('common.address')}>
            <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value || null)} />
          </Field>
        </div>
        <Field label={t('register.emergencyName')}>
          <Input value={form.emergency_contact_name ?? ''}
            onChange={(e) => set('emergency_contact_name', e.target.value || null)} />
        </Field>
        <Field label={t('register.emergencyPhone')}>
          <Input value={form.emergency_contact_phone ?? ''}
            onChange={(e) => set('emergency_contact_phone', e.target.value || null)} />
        </Field>
        <div className="full">
          <Field label={t('register.allergies')} hint={t('register.allergiesHint')}>
            <Input value={form.allergies ?? ''} onChange={(e) => set('allergies', e.target.value || null)} />
          </Field>
        </div>
        <Field label={t('register.conditions')} hint={t('register.conditionsHint')}>
          <Input value={form.medical_conditions ?? ''}
            onChange={(e) => set('medical_conditions', e.target.value || null)} />
        </Field>
        <Field label={t('register.medications')}>
          <Input value={form.current_medications ?? ''}
            onChange={(e) => set('current_medications', e.target.value || null)} />
        </Field>
        <div className="full">
          <Field label={t('common.notes')}>
            <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
