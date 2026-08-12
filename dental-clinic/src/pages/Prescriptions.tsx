import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPrescription, listMedicineStock, listPrescriptions, type PrescriptionDraftItem,
} from '@/services/pharmacy';
import { quickSearchPatients } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateTime } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, Textarea, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const FILTERS = [
  { id: 'all', key: 'common.all' },
  { id: 'open', key: 'rx.filterOpen' },
  { id: 'dispensed', key: 'rx.filterDispensed' },
] as const;

export default function Prescriptions() {
  const { can } = useAuth();
  const { t, label } = useI18n();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [writing, setWriting] = useState(false);

  const query = useQuery({
    queryKey: ['prescriptions', filter],
    queryFn: () => listPrescriptions({ status: filter }),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('rx.title')}</h1>
          <p>{t('rx.subtitle')}</p>
        </div>
        {can('clinical.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setWriting(true)}>
              <Icon name="plus" /> {t('rx.write')}
            </Button>
          </div>
        )}
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
          <Link className="btn ml-auto" to="/pharmacy/prescriptions">
            <Icon name="pharmacy" /> {t('rx.pharmacyDispensing')}
          </Link>
        </div>

        <QueryBoundary
          query={query}
          skeletonRows={6}
          empty={<EmptyState title={t('rx.empty')}
            description={t('rx.emptyHint')} />}
        >
          {(rows) => (
            <div className="col">
              {rows.map((rx) => (
                <div key={rx.id} style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
                  <div className="row wrap">
                    <Avatar name={rx.patient?.full_name ?? '?'} size="sm" />
                    <div className="grow">
                      <div className="row row--sm">
                        <Link to={`/patients/${rx.patient_id}`}>
                          <b className="text-sm">{rx.patient?.full_name}</b>
                        </Link>
                        <span className="text-2xs faint">{rx.patient?.patient_code}</span>
                        {rx.patient?.allergies && <Badge tone="danger">{t('rx.allergy')}: {rx.patient.allergies}</Badge>}
                      </div>
                      <div className="text-2xs faint">
                        {rx.prescription_number} · {dateTime(rx.prescribed_at)} · {rx.dentist?.full_name ?? '—'}
                      </div>
                    </div>
                    <Badge tone={rx.status === 'dispensed' ? 'ok' : rx.status === 'cancelled' ? 'danger' : 'warn'}>
                      {label('status', rx.status)}
                    </Badge>
                  </div>
                  <ul className="mt-8">
                    {rx.items?.map((item) => (
                      <li key={item.id} className="text-sm muted">
                        • <b>{item.medicine_name}</b> {item.strength} — {item.dose} {item.frequency},
                        {' '}{item.duration} · {t('rx.qty')} {item.quantity}
                        {item.instructions && <span className="faint"> — {item.instructions}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </Card>

      <WriteModal open={writing} onClose={() => setWriting(false)} />
    </>
  );
}

function WriteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { notify } = useToast();
  const { t } = useI18n();
  const stock = useQuery({ queryKey: ['stock'], queryFn: () => listMedicineStock({}) });

  const [term, setTerm] = useState('');
  const [patient, setPatient] = useState<{
    id: string; full_name: string; patient_code: string;
  } | null>(null);
  const [items, setItems] = useState<PrescriptionDraftItem[]>([]);
  const [pick, setPick] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['quick-search', term],
    queryFn: () => quickSearchPatients(term),
    enabled: term.trim().length >= 2 && !patient,
  });

  const create = useMutation({
    mutationFn: () => createPrescription({
      patient_id: patient!.id,
      dentist_id: profile?.id ?? null,
      notes: notes.trim() || null,
      items,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      notify(t('rx.sent'));
      setItems([]); setPatient(null); setTerm(''); setNotes('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function addItem(medicineId: string) {
    const m = stock.data?.find((x) => x.medicine_id === medicineId);
    if (!m) return;
    setItems((prev) => [...prev, {
      medicine_id: m.medicine_id,
      medicine_name: m.name,
      strength: m.strength,
      dose: t('rx.defaultDose'),
      frequency: t('rx.defaultFrequency'),
      duration: t('rx.defaultDuration'),
      quantity: 15,
      instructions: t('rx.defaultInstructions'),
    }]);
    setPick('');
  }

  function addFreeText() {
    setItems((prev) => [...prev, {
      medicine_id: null, medicine_name: '', strength: '', dose: '',
      frequency: '', duration: '', quantity: 1, instructions: '',
    }]);
  }

  const update = (i: number, patch: Partial<PrescriptionDraftItem>) =>
    setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('rx.write')}
      wide
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.isPending}
            onClick={() => {
              setError(null);
              if (!patient) { setError(t('common.selectPatient')); return; }
              if (!items.length) { setError(t('rx.errItems')); return; }
              if (items.some((i) => !i.medicine_name.trim())) { setError(t('rx.errName')); return; }
              if (items.some((i) => i.quantity <= 0)) { setError(t('rx.errQuantity')); return; }
              create.mutate();
            }}>
            {t('rx.send')}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      <Field label={t('common.patient')} required>
        {patient ? (
          <div className="row">
            <Avatar name={patient.full_name} size="sm" />
            <b className="text-sm">{patient.full_name}</b>
            <span className="text-xs faint">{patient.patient_code}</span>
            <Button size="sm" className="ml-auto" onClick={() => setPatient(null)}>{t('common.change')}</Button>
          </div>
        ) : (
          <>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('common.searchPatient')} />
            <div className="col mt-8" style={{ gap: 4 }}>
              {results.data?.map((p) => (
                <button key={p.id} type="button" className="gsearch__item"
                  onClick={() => setPatient({ id: p.id, full_name: p.full_name, patient_code: p.patient_code })}>
                  <Avatar name={p.full_name} size="sm" />
                  <span className="text-sm bold">{p.full_name}</span>
                  <span className="text-2xs faint">{p.patient_code}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </Field>

      <div className="row mt-16 mb-12">
        <Select value={pick} onChange={(e) => addItem(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">{t('rx.addFromStock')}</option>
          {stock.data?.map((m) => (
            <option key={m.medicine_id} value={m.medicine_id}>
              {m.name} {m.strength} — {m.usable_quantity} {t('rx.inStock')}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={addFreeText}>{t('rx.addOther')}</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('rx.noMedicines')}
          description={t('rx.noMedicinesHint')} />
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {items.map((item, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <div className="form-grid">
                <Field label={t('rx.medicine')} required>
                  <Input value={item.medicine_name} disabled={Boolean(item.medicine_id)}
                    onChange={(e) => update(i, { medicine_name: e.target.value })} />
                </Field>
                <Field label={t('rx.strength')}>
                  <Input value={item.strength ?? ''} onChange={(e) => update(i, { strength: e.target.value })} />
                </Field>
                <Field label={t('rx.dose')}>
                  <Input value={item.dose ?? ''} onChange={(e) => update(i, { dose: e.target.value })} />
                </Field>
                <Field label={t('rx.frequency')}>
                  <Input value={item.frequency ?? ''} onChange={(e) => update(i, { frequency: e.target.value })} />
                </Field>
                <Field label={t('rx.durationLabel')}>
                  <Input value={item.duration ?? ''} onChange={(e) => update(i, { duration: e.target.value })} />
                </Field>
                <Field label={t('common.quantity')} required>
                  <Input type="number" min={1} value={item.quantity}
                    onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value)) })} />
                </Field>
                <div className="full">
                  <Field label={t('rx.instructions')}>
                    <Input value={item.instructions ?? ''}
                      onChange={(e) => update(i, { instructions: e.target.value })} />
                  </Field>
                </div>
              </div>
              <Button size="sm" className="mt-12"
                onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                {t('rx.removeMedicine')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Field label={t('rx.notesToPharmacy')}>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
