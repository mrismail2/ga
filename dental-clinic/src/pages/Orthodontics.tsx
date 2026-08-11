import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createOrthoCase, listOrthoCases, listTreatmentBalances } from '@/services/clinical';
import { listDentists } from '@/services/admin';
import { quickSearchPatients } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateOnly, isoDate, money, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal,
  QueryBoundary, Select, Textarea, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

export default function Orthodontics() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const cases = useQuery({ queryKey: ['ortho-cases'], queryFn: () => listOrthoCases() });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Braces / orthodontics</h1>
          <p>Long-running cases with repeat adjustment visits and installment payments.</p>
        </div>
        {can('clinical.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> New braces case
            </Button>
          </div>
        )}
      </div>

      <QueryBoundary
        query={cases}
        skeletonRows={5}
        empty={<EmptyState title="No orthodontic cases yet"
          description="Start a case when a patient begins braces treatment. Cost, visits and payments are tracked together." />}
      >
        {(rows) => (
          <div className="grid grid--auto">
            {rows.map((c) => (
              <CaseCard key={c.id} caseRow={c} onOpen={() => navigate(`/orthodontics/${c.id}`)} />
            ))}
          </div>
        )}
      </QueryBoundary>

      <NewCaseModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function CaseCard({
  caseRow, onOpen,
}: {
  caseRow: Awaited<ReturnType<typeof listOrthoCases>>[number];
  onOpen: () => void;
}) {
  // Balance comes from the treatment the case bills through.
  const balances = useQuery({
    queryKey: ['treatment-balances', caseRow.patient_id],
    queryFn: () => listTreatmentBalances(caseRow.patient_id),
  });
  const balance = balances.data?.find((b) => b.treatment_id === caseRow.treatment_id);
  const progress = balance && balance.final_cost > 0
    ? Math.min(100, (balance.amount_paid / balance.final_cost) * 100) : 0;

  return (
    <Card
      title={caseRow.patient?.full_name ?? 'Patient'}
      subtitle={`${caseRow.braces_type} · started ${dateOnly(caseRow.start_date)}`}
      actions={<Badge tone={caseRow.status === 'active' ? 'info' : caseRow.status === 'completed' ? 'ok' : 'muted'}>
        {titleCase(caseRow.status)}
      </Badge>}
    >
      <div className="kv">
        <div><small>Patient ID</small><b>{caseRow.patient?.patient_code}</b></div>
        <div><small>Dentist</small><b>{caseRow.dentist?.full_name ?? '—'}</b></div>
        <div><small>Arches</small>
          <b>{[caseRow.upper_arch && 'Upper', caseRow.lower_arch && 'Lower'].filter(Boolean).join(' + ')}</b></div>
        <div><small>Duration</small><b>{caseRow.estimated_months ?? '—'} months</b></div>
      </div>

      <div className="mt-16">
        {balance ? (
          <>
            <div className="row between text-sm bold">
              <span>{money(balance.amount_paid)} paid</span>
              <span className={balance.balance > 0 ? 'danger-text' : 'ok-text'}>
                {money(balance.balance)} remaining
              </span>
            </div>
            <div className="progress mt-8"><i style={{ width: `${progress}%` }} /></div>
            <div className="text-2xs faint mt-8">Total {money(balance.final_cost)}</div>
          </>
        ) : (
          <span className="text-xs faint">Loading balance…</span>
        )}
      </div>

      <Button className="w-full mt-16" onClick={onOpen}>Open case</Button>
    </Card>
  );
}

function NewCaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [term, setTerm] = useState('');
  const [patient, setPatient] = useState<{ id: string; full_name: string; patient_code: string } | null>(null);
  const [dentistId, setDentistId] = useState('');
  const [bracesType, setBracesType] = useState('Metal fixed');
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [cost, setCost] = useState('500');
  const [months, setMonths] = useState('18');
  const [start, setStart] = useState(isoDate());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dentists = useQuery({ queryKey: ['dentists'], queryFn: listDentists });
  const results = useQuery({
    queryKey: ['quick-search', term],
    queryFn: () => quickSearchPatients(term),
    enabled: term.trim().length >= 2 && !patient,
  });

  const create = useMutation({
    mutationFn: createOrthoCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ortho-cases'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-balances'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding'] });
      notify('Braces case created');
      setPatient(null); setTerm('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function submit() {
    setError(null);
    if (!patient) { setError('Select a patient.'); return; }
    if (!upper && !lower) { setError('Choose at least one arch.'); return; }
    const total = Number(cost);
    if (!Number.isFinite(total) || total <= 0) { setError('Enter the total treatment cost.'); return; }

    create.mutate({
      patient_id: patient.id,
      dentist_id: dentistId || null,
      total_cost: total,
      braces_type: bracesType,
      upper_arch: upper,
      lower_arch: lower,
      estimated_months: Number(months) || 18,
      start_date: start,
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New braces case"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>Create case</Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      <Field label="Patient" required>
        {patient ? (
          <div className="row">
            <Avatar name={patient.full_name} size="sm" />
            <b className="text-sm">{patient.full_name}</b>
            <span className="text-xs faint">{patient.patient_code}</span>
            <Button size="sm" className="ml-auto" onClick={() => setPatient(null)}>Change</Button>
          </div>
        ) : (
          <>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search patient…" />
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

      <div className="form-grid mt-16">
        <Field label="Braces type" required>
          <Select value={bracesType} onChange={(e) => setBracesType(e.target.value)}>
            {['Metal fixed', 'Ceramic fixed', 'Self-ligating', 'Lingual', 'Clear aligners'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Dentist">
          <Select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
            <option value="">Unassigned</option>
            {dentists.data?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Total treatment cost" required
          hint="The patient can pay this in installments over the treatment.">
          <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Estimated duration (months)">
          <Input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
        </Field>
        <Field label="Start date">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Arches">
          <div className="row">
            <Checkbox label="Upper" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
            <Checkbox label="Lower" checked={lower} onChange={(e) => setLower(e.target.checked)} />
          </div>
        </Field>
        <div className="full">
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>

      <p className="text-2xs faint mt-12">
        A billable treatment is created with the case, so payments and the remaining
        balance are tracked from the first deposit onwards.
      </p>
    </Modal>
  );
}
