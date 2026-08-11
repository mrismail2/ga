import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPatient, findPossibleDuplicates } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateOnly } from '@/lib/format';
import type { Gender, PatientInput } from '@/types/database';
import { Button, Card, Field, Input, Select, Textarea, useToast } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

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
      notify(`${patient.full_name} registered as ${patient.patient_code}`);
      navigate(`/patients/${patient.id}`);
    },
    onError: (error) => notify(readableError(error), 'danger'),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.full_name.trim().length < 2) next.full_name = 'Enter the patient’s full name.';
    if (form.phone.trim().length < 6) next.phone = 'A reachable phone number is required.';
    if (!form.date_of_birth && form.age_years == null) {
      next.age_years = 'Enter either a date of birth or an age.';
    }
    if (form.age_years != null && (form.age_years < 0 || form.age_years > 130)) {
      next.age_years = 'Age must be between 0 and 130.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;          // guards double-click
    if (!validate()) return;
    if ((duplicates.data?.length ?? 0) > 0 && !duplicateAck) {
      notify('Confirm this is not one of the existing patients listed above.', 'danger');
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
        <Link to="/patients">Patients</Link><Icon name="chevronRight" size={12} /><span>Register</span>
      </div>
      <div className="page__head">
        <div>
          <h1>Register patient</h1>
          <p>A patient ID is generated automatically once the record is saved.</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        {(duplicates.data?.length ?? 0) > 0 && (
          <div className="alert tone-warn mb-16" style={{ display: 'block' }}>
            <div className="row mb-8">
              <Icon name="alert" />
              <b>Possible duplicate — this person may already be registered</b>
            </div>
            <div className="col" style={{ gap: 6 }}>
              {duplicates.data?.map((d) => (
                <Link key={d.id} to={`/patients/${d.id}`} className="row text-sm">
                  <b>{d.full_name}</b>
                  <span className="faint">{d.patient_code} · {d.phone} · registered {dateOnly(d.registered_at)}</span>
                  <span className="ml-auto text-xs">Open record</span>
                </Link>
              ))}
            </div>
            <label className="checkbox mt-12">
              <input
                type="checkbox"
                checked={duplicateAck}
                onChange={(e) => setDuplicateAck(e.target.checked)}
              />
              <span>This is a different person — continue registering.</span>
            </label>
          </div>
        )}

        <div className="grid grid--2">
          <Card title="Patient details">
            <div className="form-grid">
              <Field label="Full name" required error={errors.full_name}>
                <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
                  placeholder="e.g. Ahmed Mohamed Ali" autoFocus />
              </Field>
              <Field label="Gender" required>
                <Select value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </Select>
              </Field>
              <Field label="Date of birth" hint="Use age instead if the date is unknown.">
                <Input type="date" value={form.date_of_birth ?? ''}
                  onChange={(e) => set('date_of_birth', e.target.value || null)} />
              </Field>
              <Field label="Age (years)" error={errors.age_years}>
                <Input type="number" min={0} max={130} value={form.age_years ?? ''}
                  onChange={(e) => set('age_years', e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
              <Field label="Phone number" required error={errors.phone}>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+252 …" />
              </Field>
              <Field label="Alternative phone">
                <Input value={form.alt_phone ?? ''} onChange={(e) => set('alt_phone', e.target.value || null)} />
              </Field>
              <Field label="Address">
                <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value || null)} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Medical information" subtitle="Shown as a warning before prescribing">
            <div className="col" style={{ gap: 14 }}>
              <Field label="Allergies" hint="Penicillin, latex, local anaesthetic…">
                <Input value={form.allergies ?? ''} onChange={(e) => set('allergies', e.target.value || null)} />
              </Field>
              <Field label="Medical conditions" hint="Diabetes, hypertension, pregnancy…">
                <Textarea rows={2} value={form.medical_conditions ?? ''}
                  onChange={(e) => set('medical_conditions', e.target.value || null)} />
              </Field>
              <Field label="Current medications">
                <Textarea rows={2} value={form.current_medications ?? ''}
                  onChange={(e) => set('current_medications', e.target.value || null)} />
              </Field>
              <div className="form-grid">
                <Field label="Emergency contact name">
                  <Input value={form.emergency_contact_name ?? ''}
                    onChange={(e) => set('emergency_contact_name', e.target.value || null)} />
                </Field>
                <Field label="Emergency contact phone">
                  <Input value={form.emergency_contact_phone ?? ''}
                    onChange={(e) => set('emergency_contact_phone', e.target.value || null)} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea rows={2} value={form.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value || null)} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="row mt-16">
          <Button type="button" onClick={() => navigate('/patients')}>Cancel</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending} className="ml-auto">
            <Icon name="check" /> Register patient
          </Button>
        </div>
      </form>
    </>
  );
}
