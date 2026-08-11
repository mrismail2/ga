import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrthoVisit, getOrthoCase, listOrthoVisits, listTreatmentBalances, updateOrthoCase,
} from '@/services/clinical';
import { listDentists } from '@/services/admin';
import { readableError } from '@/lib/supabase';
import { dateOnly, isoDate, money, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { OrthoStatus, TreatmentBalance } from '@/types/database';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, Skeleton, StatCard, Textarea, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import Receipt from '@/components/finance/Receipt';

export default function OrthodonticCase() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [visitOpen, setVisitOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const caseQuery = useQuery({ queryKey: ['ortho-case', id], queryFn: () => getOrthoCase(id) });
  const visits = useQuery({ queryKey: ['ortho-visits', id], queryFn: () => listOrthoVisits(id) });
  const balances = useQuery({
    queryKey: ['treatment-balances', caseQuery.data?.patient_id],
    queryFn: () => listTreatmentBalances(caseQuery.data!.patient_id),
    enabled: Boolean(caseQuery.data?.patient_id),
  });

  const setStatus = useMutation({
    mutationFn: (status: OrthoStatus) => updateOrthoCase(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ortho-case', id] });
      queryClient.invalidateQueries({ queryKey: ['ortho-cases'] });
      notify('Case updated');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  if (caseQuery.isPending) return <Skeleton rows={8} />;
  if (caseQuery.isError || !caseQuery.data) {
    return <EmptyState title="Case not found"
      action={<Link className="btn btn--sm" to="/orthodontics">Back to cases</Link>} />;
  }

  const c = caseQuery.data;
  const balance: TreatmentBalance | undefined =
    balances.data?.find((b) => b.treatment_id === c.treatment_id);
  const nextVisit = visits.data?.find((v) => v.next_visit_date)?.next_visit_date;

  return (
    <>
      <div className="crumbs">
        <Link to="/orthodontics">Orthodontics</Link>
        <Icon name="chevronRight" size={12} />
        <span>{c.patient?.full_name}</span>
      </div>

      <div className="page__head">
        <div>
          <h1>{c.patient?.full_name}</h1>
          <p>{c.braces_type} · started {dateOnly(c.start_date)} · {c.patient?.patient_code}</p>
        </div>
        <div className="page__actions">
          <Link className="btn" to={`/patients/${c.patient_id}`}>
            <Icon name="patients" /> Patient record
          </Link>
          {can('clinical.write') && (
            <Button onClick={() => setVisitOpen(true)}><Icon name="plus" /> Record visit</Button>
          )}
          {can('finance.write') && balance && balance.balance > 0 && (
            <Button variant="primary" onClick={() => setPayOpen(true)}>
              <Icon name="payment" /> Record payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label="Total cost" value={balance ? money(balance.final_cost) : '…'} />
        <StatCard tone="ok" label="Paid so far" value={balance ? money(balance.amount_paid) : '…'}
          hint={balance ? `${balance.payment_count ?? 0} payment(s)` : undefined} />
        <StatCard tone="danger" label="Remaining balance" value={balance ? money(balance.balance) : '…'}
          hint={balance?.payment_status ? titleCase(balance.payment_status) : undefined} />
        <StatCard tone="violet" label="Next visit"
          value={nextVisit ? dateOnly(nextVisit) : 'Not set'}
          hint={`${visits.data?.length ?? 0} visits recorded`} />
      </div>

      <div className="grid grid--wide">
        <Card title="Adjustment history" subtitle="Every visit is kept permanently" padded={false}>
          <QueryBoundary
            query={visits}
            empty={<EmptyState title="No visits recorded yet"
              description="Record the first adjustment when the patient comes back." />}
          >
            {(rows) => (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Date</th><th>Dentist</th><th>Adjustment</th><th>Archwire</th>
                      <th>Compliance</th><th>Next visit</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => (
                      <tr key={v.id}>
                        <td><b>{dateOnly(v.visit_date)}</b></td>
                        <td>{v.dentist?.full_name ?? '—'}</td>
                        <td>
                          {v.adjustment ?? '—'}
                          {v.observation && <div className="text-2xs faint">{v.observation}</div>}
                        </td>
                        <td>{v.archwire_change ?? '—'}</td>
                        <td>{v.compliance ?? '—'}</td>
                        <td>{v.next_visit_date ? dateOnly(v.next_visit_date) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryBoundary>
        </Card>

        <div className="col" style={{ gap: 16 }}>
          <Card title="Case details" actions={
            <Badge tone={c.status === 'active' ? 'info' : c.status === 'completed' ? 'ok' : 'muted'}>
              {titleCase(c.status)}
            </Badge>
          }>
            <div className="row mb-16">
              <Avatar name={c.patient?.full_name ?? '?'} size="lg" />
              <div>
                <b className="text-sm">{c.patient?.full_name}</b>
                <div className="text-2xs faint">{c.patient?.phone}</div>
              </div>
            </div>
            <div className="kv">
              <div><small>Braces type</small><b>{c.braces_type}</b></div>
              <div><small>Arches</small>
                <b>{[c.upper_arch && 'Upper', c.lower_arch && 'Lower'].filter(Boolean).join(' + ')}</b></div>
              <div><small>Start date</small><b>{dateOnly(c.start_date)}</b></div>
              <div><small>Estimated</small><b>{c.estimated_months ?? '—'} months</b></div>
              <div><small>Dentist</small><b>{c.dentist?.full_name ?? '—'}</b></div>
              <div><small>Stage</small><b>{c.current_stage ?? 'Not set'}</b></div>
            </div>
            {c.notes && <p className="text-xs muted mt-16">{c.notes}</p>}

            {can('clinical.write') && c.status === 'active' && (
              <Button className="w-full mt-16" loading={setStatus.isPending}
                onClick={() => setStatus.mutate('completed')}>
                Mark case completed
              </Button>
            )}
          </Card>

          {balance && (
            <Card title="Installment progress">
              <div className="row between text-sm bold mb-8">
                <span>{money(balance.amount_paid)} of {money(balance.final_cost)}</span>
                <span className={balance.balance > 0 ? 'danger-text' : 'ok-text'}>
                  {money(balance.balance)} left
                </span>
              </div>
              <div className="progress">
                <i style={{ width: `${balance.final_cost ? Math.min(100, (balance.amount_paid / balance.final_cost) * 100) : 0}%` }} />
              </div>
              <p className="text-2xs faint mt-12">
                The remaining balance is calculated from the recorded payments — it is never typed in by hand.
              </p>
            </Card>
          )}
        </div>
      </div>

      <VisitModal caseId={id} open={visitOpen} onClose={() => setVisitOpen(false)} />
      <RecordPaymentModal
        open={payOpen}
        treatment={balance ?? null}
        orthoCaseId={id}
        onClose={() => setPayOpen(false)}
        onRecorded={setReceiptId}
      />
      <Receipt paymentId={receiptId} open={receiptId !== null} onClose={() => setReceiptId(null)} />
    </>
  );
}

function VisitModal({ caseId, open, onClose }: { caseId: string; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const dentists = useQuery({ queryKey: ['dentists'], queryFn: listDentists });

  const [form, setForm] = useState({
    visit_date: isoDate(),
    dentist_id: '',
    adjustment: '',
    archwire_change: '',
    elastics: '',
    observation: '',
    compliance: 'Good',
    next_visit_date: '',
    notes: '',
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const create = useMutation({
    mutationFn: createOrthoVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ortho-visits', caseId] });
      notify('Visit recorded');
      onClose();
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record adjustment visit"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending}
            onClick={() => create.mutate({
              case_id: caseId,
              visit_date: form.visit_date,
              dentist_id: form.dentist_id || null,
              adjustment: form.adjustment.trim() || null,
              archwire_change: form.archwire_change.trim() || null,
              elastics: form.elastics.trim() || null,
              observation: form.observation.trim() || null,
              compliance: form.compliance || null,
              next_visit_date: form.next_visit_date || null,
              notes: form.notes.trim() || null,
            })}>
            Save visit
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Visit date" required>
          <Input type="date" value={form.visit_date} onChange={(e) => set('visit_date', e.target.value)} />
        </Field>
        <Field label="Dentist">
          <Select value={form.dentist_id} onChange={(e) => set('dentist_id', e.target.value)}>
            <option value="">Unassigned</option>
            {dentists.data?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Adjustment performed">
          <Input value={form.adjustment} onChange={(e) => set('adjustment', e.target.value)}
            placeholder="Tightened upper arch…" />
        </Field>
        <Field label="Archwire change">
          <Input value={form.archwire_change} onChange={(e) => set('archwire_change', e.target.value)}
            placeholder="0.016 NiTi → 0.018 SS" />
        </Field>
        <Field label="Elastics">
          <Input value={form.elastics} onChange={(e) => set('elastics', e.target.value)} />
        </Field>
        <Field label="Patient compliance">
          <Select value={form.compliance} onChange={(e) => set('compliance', e.target.value)}>
            {['Excellent', 'Good', 'Fair', 'Poor'].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Next visit">
          <Input type="date" value={form.next_visit_date}
            onChange={(e) => set('next_visit_date', e.target.value)} />
        </Field>
        <div className="full">
          <Field label="Clinical observation">
            <Textarea rows={2} value={form.observation} onChange={(e) => set('observation', e.target.value)} />
          </Field>
        </div>
        <div className="full">
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </div>
      <p className="text-2xs faint mt-12">
        Record any payment collected at this visit with the “Record payment” button on the case —
        it is added to the same installment balance.
      </p>
    </Modal>
  );
}
