import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getPatient, getPatientBalance, listDocuments, listExaminations, listToothRecords,
  signedDocumentUrl,
} from '@/services/patients';
import { listOrthoCases, listTreatmentBalances } from '@/services/clinical';
import { listAppointments, nextAppointmentFor } from '@/services/appointments';
import { listPayments } from '@/services/finance';
import { listPrescriptions } from '@/services/pharmacy';
import { ageOf, dateOnly, dateTime, money, smartDate, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar, Badge, Button, Card, EmptyState, PaymentBadge, QueryBoundary, Skeleton, Tabs,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import ToothChart, { CONDITIONS } from '@/components/dental/ToothChart';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import Receipt from '@/components/finance/Receipt';
import PatientStatement from '@/components/finance/PatientStatement';
import type { TreatmentBalance } from '@/types/database';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'chart', label: 'Dental chart' },
  { id: 'treatments', label: 'Treatments' },
  { id: 'notes', label: 'Clinical notes' },
  { id: 'payments', label: 'Payments' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'prescriptions', label: 'Prescriptions' },
  { id: 'documents', label: 'Documents' },
];

export default function PatientProfile() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState('overview');
  const [payFor, setPayFor] = useState<TreatmentBalance | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);

  const patient = useQuery({ queryKey: ['patient', id], queryFn: () => getPatient(id) });
  const balance = useQuery({ queryKey: ['patient-balance', id], queryFn: () => getPatientBalance(id) });
  const nextAppt = useQuery({ queryKey: ['next-appointment', id], queryFn: () => nextAppointmentFor(id) });
  const treatments = useQuery({
    queryKey: ['treatment-balances', id], queryFn: () => listTreatmentBalances(id),
  });

  if (patient.isPending) return <Skeleton rows={8} />;
  if (patient.isError || !patient.data) {
    return <EmptyState title="Patient not found"
      description="This record may have been archived."
      action={<Link className="btn btn--sm" to="/patients">Back to patients</Link>} />;
  }

  const p = patient.data;

  return (
    <>
      <div className="crumbs">
        <Link to="/patients">Patients</Link>
        <Icon name="chevronRight" size={12} />
        <span>{p.full_name}</span>
      </div>

      <div className="page__head">
        <div>
          <h1>{p.full_name}</h1>
          <p>{p.patient_code} · {ageOf(p)} · {titleCase(p.gender)} · {p.phone}</p>
        </div>
        <div className="page__actions">
          {can('finance.read') && (
            <Button onClick={() => setStatementOpen(true)}><Icon name="print" /> Statement</Button>
          )}
          {can('appointments.write') && (
            <Link className="btn" to="/appointments"><Icon name="calendar" /> Book appointment</Link>
          )}
        </div>
      </div>

      {p.allergies && (
        <div className="alert tone-danger mb-16">
          <Icon name="alert" />
          <span><b>Allergy on file:</b> {p.allergies}. Check before prescribing or anaesthetising.</span>
        </div>
      )}

      <Card padded={false} className="mb-16">
        <div className="row wrap" style={{ padding: 16, gap: 16 }}>
          <Avatar name={p.full_name} size="lg" />
          <div className="grow">
            <div className="row row--sm">
              <b className="text-md">{p.full_name}</b>
              <Badge tone={p.status === 'active' ? 'ok' : 'muted'}>{titleCase(p.status)}</Badge>
            </div>
            <div className="text-xs faint mt-8">
              Registered {dateOnly(p.registered_at)} · {p.address ?? 'No address on file'}
            </div>
          </div>
          <div className="row row--lg wrap">
            <div>
              <div className="eyebrow">Outstanding</div>
              <b className={`text-md ${Number(balance.data?.total_balance ?? 0) > 0 ? 'danger-text' : ''}`}>
                {balance.isPending ? '…' : money(balance.data?.total_balance ?? 0)}
              </b>
            </div>
            <div>
              <div className="eyebrow">Total paid</div>
              <b className="text-md">{balance.isPending ? '…' : money(balance.data?.total_paid ?? 0)}</b>
            </div>
            <div>
              <div className="eyebrow">Next appointment</div>
              <b className="text-md">
                {nextAppt.isPending ? '…' : nextAppt.data ? smartDate(nextAppt.data.scheduled_at) : 'None booked'}
              </b>
            </div>
          </div>
        </div>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </Card>

      {tab === 'overview' && <Overview patientId={id} patient={p} treatments={treatments} />}
      {tab === 'chart' && <Card title="Dental chart" subtitle="FDI numbering · click a tooth to record its condition"><ToothChart patientId={id} /></Card>}
      {tab === 'treatments' && (
        <TreatmentsTab patientId={id} treatments={treatments} onPay={setPayFor} canPay={can('finance.write')} />
      )}
      {tab === 'notes' && <NotesTab patientId={id} />}
      {tab === 'payments' && <PaymentsTab patientId={id} onReceipt={setReceiptId} />}
      {tab === 'appointments' && <AppointmentsTab patientId={id} />}
      {tab === 'prescriptions' && <PrescriptionsTab patientId={id} />}
      {tab === 'documents' && <DocumentsTab patientId={id} />}

      <RecordPaymentModal
        open={payFor !== null}
        treatment={payFor}
        onClose={() => setPayFor(null)}
        onRecorded={setReceiptId}
      />
      <Receipt paymentId={receiptId} open={receiptId !== null} onClose={() => setReceiptId(null)} />
      <PatientStatement patientId={id} open={statementOpen} onClose={() => setStatementOpen(false)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
function Overview({
  patientId, patient, treatments,
}: {
  patientId: string;
  patient: ReturnType<typeof getPatient> extends Promise<infer T> ? T : never;
  treatments: ReturnType<typeof useQuery<TreatmentBalance[]>>;
}) {
  const teeth = useQuery({
    queryKey: ['tooth-records', patientId, 'current'],
    queryFn: () => listToothRecords(patientId, true),
  });
  const ortho = useQuery({ queryKey: ['ortho-cases', patientId], queryFn: () => listOrthoCases(patientId) });

  const flagged = (teeth.data ?? []).filter((t) => t.condition !== 'healthy');
  const active = (treatments.data ?? []).filter((t) => t.status === 'in_progress' || t.status === 'planned');

  return (
    <div className="grid grid--3">
      <Card title="Medical record">
        <div className="kv">
          <div><small>Gender</small><b>{titleCase(patient.gender)}</b></div>
          <div><small>Age</small><b>{ageOf(patient)}</b></div>
          <div><small>Phone</small><b>{patient.phone}</b></div>
          <div><small>Alt phone</small><b>{patient.alt_phone ?? '—'}</b></div>
          <div><small>Emergency contact</small>
            <b>{patient.emergency_contact_name ?? '—'}{patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ''}</b></div>
          <div><small>Registered</small><b>{dateOnly(patient.registered_at)}</b></div>
        </div>
        <div className="col mt-16" style={{ gap: 10 }}>
          <div>
            <div className="eyebrow">Allergies</div>
            <div className={`text-sm ${patient.allergies ? 'danger-text bold' : 'faint'}`}>
              {patient.allergies ?? 'None recorded'}
            </div>
          </div>
          <div>
            <div className="eyebrow">Medical conditions</div>
            <div className="text-sm muted">{patient.medical_conditions ?? 'None recorded'}</div>
          </div>
          <div>
            <div className="eyebrow">Current medications</div>
            <div className="text-sm muted">{patient.current_medications ?? 'None recorded'}</div>
          </div>
        </div>
      </Card>

      <Card title="Teeth needing attention" subtitle={`${flagged.length} recorded`}>
        <QueryBoundary
          query={{ ...teeth, data: flagged }}
          empty={<EmptyState title="Chart is clear" description="No tooth has been flagged yet." />}
        >
          {(rows) => (
            <ul className="timeline">
              {rows.map((t) => (
                <li key={t.id} className="tone-warn">
                  <b>Tooth {t.tooth_number} — {CONDITIONS[t.condition].label}</b>
                  <small>{dateOnly(t.recorded_at)}{t.recorded_by_profile ? ` · ${t.recorded_by_profile.full_name}` : ''}</small>
                  {t.proposed_treatment && <div className="text-xs muted">Proposed: {t.proposed_treatment}</div>}
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>

      <Card title="Active treatment" subtitle={`${active.length} in progress or planned`}>
        <QueryBoundary
          query={{ ...treatments, data: active }}
          empty={<EmptyState title="No active treatment" />}
        >
          {(rows) => (
            <div className="col" style={{ gap: 12 }}>
              {rows.map((t) => (
                <div key={t.treatment_id}>
                  <div className="row between text-sm bold">
                    <span>{t.treatment_name ?? 'Treatment'}</span>
                    <span>{money(t.amount_paid)} / {money(t.final_cost)}</span>
                  </div>
                  <div className="progress mt-8">
                    <i style={{ width: `${t.final_cost ? Math.min(100, (t.amount_paid / t.final_cost) * 100) : 0}%` }} />
                  </div>
                  <div className="row between text-2xs faint mt-8">
                    <span>{t.tooth_numbers?.length ? `Tooth ${t.tooth_numbers.join(', ')}` : 'No tooth recorded'}</span>
                    <PaymentBadge status={t.payment_status} />
                  </div>
                </div>
              ))}
              {(ortho.data ?? []).map((c) => (
                <Link key={c.id} to={`/orthodontics/${c.id}`} className="alert tone-violet">
                  <Icon name="braces" />
                  <span className="grow">Braces case — {c.braces_type}, started {dateOnly(c.start_date)}</span>
                  <Icon name="chevronRight" />
                </Link>
              ))}
            </div>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function TreatmentsTab({
  treatments, onPay, canPay,
}: {
  patientId: string;
  treatments: ReturnType<typeof useQuery<TreatmentBalance[]>>;
  onPay: (t: TreatmentBalance) => void;
  canPay: boolean;
}) {
  return (
    <Card title="Treatment history" subtitle="Every treatment, its cost and what is still owed" padded={false}>
      <QueryBoundary
        query={treatments}
        empty={<EmptyState title="No treatments recorded"
          description="Treatments created for this patient will appear here with their payment status." />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Treatment</th><th>Tooth</th><th>Status</th>
                  <th className="right">Total</th><th className="right">Paid</th>
                  <th className="right">Balance</th><th>Payment</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.treatment_id}>
                    <td>
                      <b>{t.treatment_name ?? 'Treatment'}</b>
                      <div className="text-2xs faint">Created {dateOnly(t.created_at)}</div>
                    </td>
                    <td>{t.tooth_numbers?.length ? t.tooth_numbers.join(', ') : <span className="faint">—</span>}</td>
                    <td><Badge tone={t.status === 'completed' ? 'ok' : t.status === 'cancelled' ? 'danger' : 'info'}>
                      {titleCase(t.status)}</Badge></td>
                    <td className="right">{money(t.final_cost)}</td>
                    <td className="right">{money(t.amount_paid)}</td>
                    <td className={`right bold ${t.balance > 0 ? 'danger-text' : ''}`}>{money(t.balance)}</td>
                    <td><PaymentBadge status={t.payment_status} /></td>
                    <td className="right">
                      {canPay && t.balance > 0 && (
                        <Button size="sm" variant="primary" onClick={() => onPay(t)}>Record payment</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
function NotesTab({ patientId }: { patientId: string }) {
  const exams = useQuery({
    queryKey: ['examinations', patientId], queryFn: () => listExaminations(patientId),
  });
  return (
    <Card title="Clinical notes and examinations">
      <QueryBoundary
        query={exams}
        empty={<EmptyState title="No examinations recorded"
          description="Examination findings, diagnosis and recommendations will be listed here." />}
      >
        {(rows) => (
          <ul className="timeline">
            {rows.map((e) => (
              <li key={e.id} className="tone-brand">
                <b>{e.diagnosis || e.chief_complaint || 'Examination'}</b>
                <small>{dateOnly(e.exam_date)}{e.dentist ? ` · ${e.dentist.full_name}` : ''}</small>
                {e.chief_complaint && <div className="text-sm mt-8"><b>Complaint:</b> {e.chief_complaint}</div>}
                {e.findings && <div className="text-sm"><b>Findings:</b> {e.findings}</div>}
                {e.recommended_treatment && <div className="text-sm"><b>Recommended:</b> {e.recommended_treatment}</div>}
                {e.notes && <div className="text-xs muted mt-8">{e.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
function PaymentsTab({ patientId, onReceipt }: { patientId: string; onReceipt: (id: string) => void }) {
  const payments = useQuery({
    queryKey: ['payments', patientId], queryFn: () => listPayments({ patientId, pageSize: 100 }),
  });
  return (
    <Card title="Payment history" subtitle="Every installment recorded against this patient" padded={false}>
      <QueryBoundary
        query={{ ...payments, data: payments.data?.rows }}
        empty={<EmptyState title="No payments yet" />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Receipt</th><th>Date</th><th>Treatment</th><th>Method</th>
                  <th className="right">Amount</th><th>Received by</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={p.voided_at ? 'faint' : undefined}>
                    <td className="bold">{p.receipt_number}</td>
                    <td>{dateTime(p.paid_at)}</td>
                    <td>{p.treatment?.treatment_type?.name ?? p.treatment?.description ?? '—'}</td>
                    <td>{titleCase(p.method)}</td>
                    <td className="right bold">{money(p.amount)}</td>
                    <td>{p.received_by_profile?.full_name ?? '—'}</td>
                    <td className="right">
                      {p.voided_at
                        ? <Badge tone="danger">Voided</Badge>
                        : <Button size="sm" onClick={() => onReceipt(p.id)}>Receipt</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
function AppointmentsTab({ patientId }: { patientId: string }) {
  const appts = useQuery({
    queryKey: ['appointments', 'patient', patientId], queryFn: () => listAppointments({ patientId }),
  });
  return (
    <Card title="Appointment history" padded={false}>
      <QueryBoundary
        query={appts}
        empty={<EmptyState title="No appointments" description="Booked visits will appear here." />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>Dentist</th><th>Treatment</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.scheduled_at)}</td>
                    <td>{a.dentist?.full_name ?? '—'}</td>
                    <td>{a.treatment_type?.name ?? '—'}</td>
                    <td>{a.duration_minutes} min</td>
                    <td><Badge tone={a.status === 'completed' ? 'ok' : a.status === 'cancelled' || a.status === 'no_show' ? 'danger' : 'info'}>
                      {titleCase(a.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
function PrescriptionsTab({ patientId }: { patientId: string }) {
  const rx = useQuery({
    queryKey: ['prescriptions', patientId], queryFn: () => listPrescriptions({ patientId }),
  });
  return (
    <Card title="Prescriptions" padded={false}>
      <QueryBoundary
        query={rx}
        empty={<EmptyState title="No prescriptions" description="Medicines prescribed by a dentist appear here." />}
      >
        {(rows) => (
          <div className="col">
            {rows.map((r) => (
              <div key={r.id} style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
                <div className="row">
                  <b className="text-sm">{r.prescription_number}</b>
                  <span className="text-xs faint">{dateTime(r.prescribed_at)} · {r.dentist?.full_name ?? '—'}</span>
                  <span className="ml-auto">
                    <Badge tone={r.status === 'dispensed' ? 'ok' : r.status === 'cancelled' ? 'danger' : 'warn'}>
                      {titleCase(r.status)}
                    </Badge>
                  </span>
                </div>
                <ul className="mt-8">
                  {r.items?.map((item) => (
                    <li key={item.id} className="text-sm muted">
                      • {item.medicine_name} {item.strength} — {item.dose} {item.frequency} for {item.duration}
                      <span className="faint"> ({item.dispensed_quantity}/{item.quantity} dispensed)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
function DocumentsTab({ patientId }: { patientId: string }) {
  const docs = useQuery({ queryKey: ['documents', patientId], queryFn: () => listDocuments(patientId) });

  async function openDocument(path: string) {
    const url = await signedDocumentUrl(path);
    window.open(url, '_blank', 'noopener');
  }

  return (
    <Card title="Documents" subtitle="X-rays, photos, consent forms and lab results" padded={false}>
      <QueryBoundary
        query={docs}
        empty={<EmptyState title="No documents uploaded"
          description="Files are stored in a private bucket; links expire after a few minutes." />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Title</th><th>Type</th><th>Uploaded</th><th>By</th><th /></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.title}</b></td>
                    <td><Badge tone="info">{titleCase(d.doc_type)}</Badge></td>
                    <td>{dateTime(d.uploaded_at)}</td>
                    <td>{d.uploaded_by_profile?.full_name ?? '—'}</td>
                    <td className="right">
                      <Button size="sm" onClick={() => openDocument(d.storage_path)}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}
