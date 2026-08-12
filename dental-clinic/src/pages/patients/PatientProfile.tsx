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
import { ageOf, dateOnly, dateTime, money, smartDate } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar, Badge, Button, Card, EmptyState, PaymentBadge, QueryBoundary, Skeleton, Tabs,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import ToothChart from '@/components/dental/ToothChart';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import Receipt from '@/components/finance/Receipt';
import PatientStatement from '@/components/finance/PatientStatement';
import type { TreatmentBalance } from '@/types/database';
import { useI18n } from '@/i18n';

const TAB_KEYS = [
  ['overview', 'profile.tabOverview'],
  ['chart', 'profile.tabChart'],
  ['treatments', 'profile.tabTreatments'],
  ['notes', 'profile.tabNotes'],
  ['payments', 'profile.tabPayments'],
  ['appointments', 'profile.tabAppointments'],
  ['prescriptions', 'profile.tabPrescriptions'],
  ['documents', 'profile.tabDocuments'],
] as const;

export default function PatientProfile() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const { t, label } = useI18n();
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
    return <EmptyState title={t('profile.notFound')}
      description={t('profile.notFoundHint')}
      action={<Link className="btn btn--sm" to="/patients">{t('profile.backToPatients')}</Link>} />;
  }

  const p = patient.data;

  return (
    <>
      <div className="crumbs">
        <Link to="/patients">{t('patients.title')}</Link>
        <Icon name="chevronRight" size={12} />
        <span>{p.full_name}</span>
      </div>

      <div className="page__head">
        <div>
          <h1>{p.full_name}</h1>
          <p>{p.patient_code} · {ageOf(p)} · {label('gender', p.gender)} · {p.phone}</p>
        </div>
        <div className="page__actions">
          {can('finance.read') && (
            <Button onClick={() => setStatementOpen(true)}><Icon name="print" /> {t('profile.statement')}</Button>
          )}
          {can('appointments.write') && (
            <Link className="btn" to="/appointments"><Icon name="calendar" /> {t('dash.bookAppointment')}</Link>
          )}
        </div>
      </div>

      {p.allergies && (
        <div className="alert tone-danger mb-16">
          <Icon name="alert" />
          <span><b>{t('profile.allergyWarning')}:</b> {p.allergies}. {t('profile.allergyWarningHint')}</span>
        </div>
      )}

      <Card padded={false} className="mb-16">
        <div className="row wrap" style={{ padding: 16, gap: 16 }}>
          <Avatar name={p.full_name} size="lg" />
          <div className="grow">
            <div className="row row--sm">
              <b className="text-md">{p.full_name}</b>
              <Badge tone={p.status === 'active' ? 'ok' : 'muted'}>{label('status', p.status)}</Badge>
            </div>
            <div className="text-xs faint mt-8">
              {t('profile.registeredOn')} {dateOnly(p.registered_at)} · {p.address ?? t('profile.noAddress')}
            </div>
          </div>
          <div className="row row--lg wrap">
            <div>
              <div className="eyebrow">{t('profile.outstanding')}</div>
              <b className={`text-md ${Number(balance.data?.total_balance ?? 0) > 0 ? 'danger-text' : ''}`}>
                {balance.isPending ? '…' : money(balance.data?.total_balance ?? 0)}
              </b>
            </div>
            <div>
              <div className="eyebrow">{t('profile.totalPaid')}</div>
              <b className="text-md">{balance.isPending ? '…' : money(balance.data?.total_paid ?? 0)}</b>
            </div>
            <div>
              <div className="eyebrow">{t('profile.nextAppointment')}</div>
              <b className="text-md">
                {nextAppt.isPending ? '…' : nextAppt.data ? smartDate(nextAppt.data.scheduled_at) : t('profile.noneBooked')}
              </b>
            </div>
          </div>
        </div>
        <Tabs tabs={TAB_KEYS.map(([id, key]) => ({ id, label: t(key) }))} value={tab} onChange={setTab} />
      </Card>

      {tab === 'overview' && <Overview patientId={id} patient={p} treatments={treatments} />}
      {tab === 'chart' && <Card title={t('chart.title')} subtitle={t('chart.subtitle')}><ToothChart patientId={id} /></Card>}
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

  const { t, label } = useI18n();
  const flagged = (teeth.data ?? []).filter((x) => x.condition !== 'healthy');
  const active = (treatments.data ?? []).filter((x) => x.status === 'in_progress' || x.status === 'planned');

  return (
    <div className="grid grid--3">
      <Card title={t('profile.medicalRecord')}>
        <div className="kv">
          <div><small>{t('register.gender')}</small><b>{label('gender', patient.gender)}</b></div>
          <div><small>{t('register.age')}</small><b>{ageOf(patient)}</b></div>
          <div><small>{t('common.phone')}</small><b>{patient.phone}</b></div>
          <div><small>{t('profile.altPhone')}</small><b>{patient.alt_phone ?? '—'}</b></div>
          <div><small>{t('profile.emergencyContact')}</small>
            <b>{patient.emergency_contact_name ?? '—'}{patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ''}</b></div>
          <div><small>{t('profile.registeredOn')}</small><b>{dateOnly(patient.registered_at)}</b></div>
        </div>
        <div className="col mt-16" style={{ gap: 10 }}>
          <div>
            <div className="eyebrow">{t('register.allergies')}</div>
            <div className={`text-sm ${patient.allergies ? 'danger-text bold' : 'faint'}`}>
              {patient.allergies ?? t('patients.noneRecorded')}
            </div>
          </div>
          <div>
            <div className="eyebrow">{t('profile.conditions')}</div>
            <div className="text-sm muted">{patient.medical_conditions ?? t('patients.noneRecorded')}</div>
          </div>
          <div>
            <div className="eyebrow">{t('profile.medications')}</div>
            <div className="text-sm muted">{patient.current_medications ?? t('patients.noneRecorded')}</div>
          </div>
        </div>
      </Card>

      <Card title={t('profile.teethAttention')} subtitle={`${flagged.length} ${t('profile.recorded')}`}>
        <QueryBoundary
          query={{ ...teeth, data: flagged }}
          empty={<EmptyState title={t('profile.chartClear')} description={t('profile.chartClearHint')} />}
        >
          {(rows) => (
            <ul className="timeline">
              {rows.map((row) => (
                <li key={row.id} className="tone-warn">
                  <b>{t('chart.toothLabel')} {row.tooth_number} — {label('tooth', row.condition)}</b>
                  <small>{dateOnly(row.recorded_at)}{row.recorded_by_profile ? ` · ${row.recorded_by_profile.full_name}` : ''}</small>
                  {row.proposed_treatment && <div className="text-xs muted">{t('profile.proposed')}: {row.proposed_treatment}</div>}
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>

      <Card title={t('profile.activeTreatment')} subtitle={`${active.length} ${t('profile.activeTreatmentHint')}`}>
        <QueryBoundary
          query={{ ...treatments, data: active }}
          empty={<EmptyState title={t('profile.noActive')} />}
        >
          {(rows) => (
            <div className="col" style={{ gap: 12 }}>
              {rows.map((row) => (
                <div key={row.treatment_id}>
                  <div className="row between text-sm bold">
                    <span>{row.treatment_name ?? t('common.treatment')}</span>
                    <span>{money(row.amount_paid)} / {money(row.final_cost)}</span>
                  </div>
                  <div className="progress mt-8">
                    <i style={{ width: `${row.final_cost ? Math.min(100, (row.amount_paid / row.final_cost) * 100) : 0}%` }} />
                  </div>
                  <div className="row between text-2xs faint mt-8">
                    <span>{row.tooth_numbers?.length ? `${t('chart.toothLabel')} ${row.tooth_numbers.join(', ')}` : t('profile.noToothRecorded')}</span>
                    <PaymentBadge status={row.payment_status} />
                  </div>
                </div>
              ))}
              {(ortho.data ?? []).map((c) => (
                <Link key={c.id} to={`/orthodontics/${c.id}`} className="alert tone-violet">
                  <Icon name="braces" />
                  <span className="grow">{t('profile.bracesCase')} — {label('braces', c.braces_type)}, {t('profile.started')} {dateOnly(c.start_date)}</span>
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
  onPay: (row: TreatmentBalance) => void;
  canPay: boolean;
}) {
  const { t, label } = useI18n();
  return (
    <Card title={t('profile.treatmentHistory')} subtitle={t('profile.treatmentHistoryHint')} padded={false}>
      <QueryBoundary
        query={treatments}
        empty={<EmptyState title={t('profile.noTreatments')}
          description={t('profile.noTreatmentsHint')} />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('common.treatment')}</th><th>{t('common.tooth')}</th><th>{t('common.status')}</th>
                  <th className="right">{t('common.total')}</th><th className="right">{t('common.paid')}</th>
                  <th className="right">{t('common.balance')}</th><th>{t('profile.payment')}</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.treatment_id}>
                    <td>
                      <b>{row.treatment_name ?? t('common.treatment')}</b>
                      <div className="text-2xs faint">{t('profile.created')} {dateOnly(row.created_at)}</div>
                    </td>
                    <td>{row.tooth_numbers?.length ? row.tooth_numbers.join(', ') : <span className="faint">—</span>}</td>
                    <td><Badge tone={row.status === 'completed' ? 'ok' : row.status === 'cancelled' ? 'danger' : 'info'}>
                      {label('status', row.status)}</Badge></td>
                    <td className="right">{money(row.final_cost)}</td>
                    <td className="right">{money(row.amount_paid)}</td>
                    <td className={`right bold ${row.balance > 0 ? 'danger-text' : ''}`}>{money(row.balance)}</td>
                    <td><PaymentBadge status={row.payment_status} /></td>
                    <td className="right">
                      {canPay && row.balance > 0 && (
                        <Button size="sm" variant="primary" onClick={() => onPay(row)}>{t('profile.recordPayment')}</Button>
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
  const { t } = useI18n();
  return (
    <Card title={t('profile.notesTitle')}>
      <QueryBoundary
        query={exams}
        empty={<EmptyState title={t('profile.noExams')}
          description={t('profile.noExamsHint')} />}
      >
        {(rows) => (
          <ul className="timeline">
            {rows.map((e) => (
              <li key={e.id} className="tone-brand">
                <b>{e.diagnosis || e.chief_complaint || t('profile.examination')}</b>
                <small>{dateOnly(e.exam_date)}{e.dentist ? ` · ${e.dentist.full_name}` : ''}</small>
                {e.chief_complaint && <div className="text-sm mt-8"><b>{t('profile.complaint')}:</b> {e.chief_complaint}</div>}
                {e.findings && <div className="text-sm"><b>{t('profile.findings')}:</b> {e.findings}</div>}
                {e.recommended_treatment && <div className="text-sm"><b>{t('profile.recommended')}:</b> {e.recommended_treatment}</div>}
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
  const { t, label } = useI18n();
  const payments = useQuery({
    queryKey: ['payments', patientId], queryFn: () => listPayments({ patientId, pageSize: 100 }),
  });
  return (
    <Card title={t('profile.paymentHistory')} subtitle={t('profile.paymentHistoryHint')} padded={false}>
      <QueryBoundary
        query={{ ...payments, data: payments.data?.rows }}
        empty={<EmptyState title={t('profile.noPaymentsYet')} />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t('common.receipt')}</th><th>{t('common.date')}</th><th>{t('common.treatment')}</th>
                  <th>{t('common.method')}</th><th className="right">{t('common.amount')}</th>
                  <th>{t('profile.receivedBy')}</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={p.voided_at ? 'faint' : undefined}>
                    <td className="bold">{p.receipt_number}</td>
                    <td>{dateTime(p.paid_at)}</td>
                    <td>{p.treatment?.treatment_type?.name ?? p.treatment?.description ?? '—'}</td>
                    <td>{label('method', p.method)}</td>
                    <td className="right bold">{money(p.amount)}</td>
                    <td>{p.received_by_profile?.full_name ?? '—'}</td>
                    <td className="right">
                      {p.voided_at
                        ? <Badge tone="danger">{t('profile.voided')}</Badge>
                        : <Button size="sm" onClick={() => onReceipt(p.id)}>{t('common.receipt')}</Button>}
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
  const { t, label } = useI18n();
  const appts = useQuery({
    queryKey: ['appointments', 'patient', patientId], queryFn: () => listAppointments({ patientId }),
  });
  return (
    <Card title={t('profile.appointmentHistory')} padded={false}>
      <QueryBoundary
        query={appts}
        empty={<EmptyState title={t('profile.noAppointments')} description={t('profile.noAppointmentsHint')} />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>{t('common.when')}</th><th>{t('common.dentist')}</th><th>{t('common.treatment')}</th>
                <th>{t('common.duration')}</th><th>{t('common.status')}</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.scheduled_at)}</td>
                    <td>{a.dentist?.full_name ?? '—'}</td>
                    <td>{a.treatment_type?.name ?? '—'}</td>
                    <td>{a.duration_minutes} {t('common.min')}</td>
                    <td><Badge tone={a.status === 'completed' ? 'ok' : a.status === 'cancelled' || a.status === 'no_show' ? 'danger' : 'info'}>
                      {label('status', a.status)}</Badge></td>
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
  const { t, label } = useI18n();
  const rx = useQuery({
    queryKey: ['prescriptions', patientId], queryFn: () => listPrescriptions({ patientId }),
  });
  return (
    <Card title={t('profile.tabPrescriptions')} padded={false}>
      <QueryBoundary
        query={rx}
        empty={<EmptyState title={t('profile.noPrescriptions')} description={t('profile.noPrescriptionsHint')} />}
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
                      {label('status', r.status)}
                    </Badge>
                  </span>
                </div>
                <ul className="mt-8">
                  {r.items?.map((item) => (
                    <li key={item.id} className="text-sm muted">
                      • {item.medicine_name} {item.strength} — {item.dose} {item.frequency} for {item.duration}
                      <span className="faint"> ({item.dispensed_quantity}/{item.quantity} {t('profile.dispensed')})</span>
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
  const { t, label } = useI18n();
  const docs = useQuery({ queryKey: ['documents', patientId], queryFn: () => listDocuments(patientId) });

  async function openDocument(path: string) {
    const url = await signedDocumentUrl(path);
    window.open(url, '_blank', 'noopener');
  }

  return (
    <Card title={t('profile.tabDocuments')} subtitle={t('profile.documentsHint')} padded={false}>
      <QueryBoundary
        query={docs}
        empty={<EmptyState title={t('profile.noDocuments')}
          description={t('profile.noDocumentsHint')} />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>{t('profile.docTitle')}</th><th>{t('profile.docType')}</th>
                <th>{t('profile.uploaded')}</th><th>{t('profile.uploadedBy')}</th><th /></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.title}</b></td>
                    <td><Badge tone="info">{label('doctype', d.doc_type)}</Badge></td>
                    <td>{dateTime(d.uploaded_at)}</td>
                    <td>{d.uploaded_by_profile?.full_name ?? '—'}</td>
                    <td className="right">
                      <Button size="sm" onClick={() => openDocument(d.storage_path)}>{t('common.open')}</Button>
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
