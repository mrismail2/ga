import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  checkIn, createAppointment, listAppointments, updateAppointmentStatus,
} from '@/services/appointments';
import { listDentists } from '@/services/admin';
import { listTreatmentTypes } from '@/services/clinical';
import { quickSearchPatients } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateOnly, isoDate, timeOnly, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { AppointmentStatus } from '@/types/database';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, Textarea, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const STATUS_TONE: Record<AppointmentStatus, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  scheduled: 'muted', confirmed: 'info', checked_in: 'info', waiting: 'warn',
  in_treatment: 'info', completed: 'ok', cancelled: 'danger', no_show: 'danger',
};

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
] as const;

function rangeFor(id: (typeof RANGES)[number]['id']) {
  const now = new Date();
  if (id === 'today') return { from: isoDate(now), to: isoDate(now) };
  if (id === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: isoDate(start), to: isoDate(end) };
  }
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export default function Appointments() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('today');
  const [dentistId, setDentistId] = useState('');
  const [booking, setBooking] = useState(false);

  const { from, to } = rangeFor(range);
  const appointments = useQuery({
    queryKey: ['appointments', from, to, dentistId],
    queryFn: () => listAppointments({ from, to, dentistId: dentistId || undefined }),
  });
  const dentists = useQuery({ queryKey: ['dentists'], queryFn: listDentists });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notify('Appointment updated');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  const doCheckIn = useMutation({
    mutationFn: checkIn,
    onSuccess: (appt) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      notify(`Checked in — queue number ${appt.queue_number}`);
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Appointments</h1>
          <p>Schedule visits, check patients in and track how the day is running.</p>
        </div>
        {can('appointments.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setBooking(true)}>
              <Icon name="plus" /> Book appointment
            </Button>
          </div>
        )}
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <div className="segmented">
            {RANGES.map((r) => (
              <button key={r.id} className={cx(range === r.id && 'is-active')} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <Select value={dentistId} onChange={(e) => setDentistId(e.target.value)} style={{ width: 190 }}>
            <option value="">All dentists</option>
            {dentists.data?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
          <span className="ml-auto text-xs faint">
            {dateOnly(from)} – {dateOnly(to)}
          </span>
        </div>

        <QueryBoundary
          query={appointments}
          skeletonRows={7}
          empty={<EmptyState title="No appointments in this period"
            description="Change the date range, or book a new appointment." />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>When</th><th>Patient</th><th>Dentist</th><th>Treatment</th>
                    <th>Duration</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <b>{timeOnly(a.scheduled_at)}</b>
                        <div className="text-2xs faint">{dateOnly(a.scheduled_at)}</div>
                      </td>
                      <td className="clickable" onClick={() => navigate(`/patients/${a.patient_id}`)}>
                        <div className="cell-user">
                          <Avatar name={a.patient?.full_name ?? '?'} size="sm" />
                          <div>
                            <b>{a.patient?.full_name}</b>
                            <small>{a.patient?.patient_code} · {a.patient?.phone}</small>
                          </div>
                        </div>
                      </td>
                      <td>{a.dentist?.full_name ?? <span className="faint">Unassigned</span>}</td>
                      <td>{a.treatment_type?.name ?? <span className="faint">—</span>}</td>
                      <td>{a.duration_minutes} min</td>
                      <td><Badge tone={STATUS_TONE[a.status]}>{titleCase(a.status)}</Badge></td>
                      <td className="right">
                        {can('appointments.write') && (
                          <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                            {(a.status === 'scheduled' || a.status === 'confirmed') && (
                              <Button size="sm" variant="primary"
                                loading={doCheckIn.isPending}
                                onClick={() => doCheckIn.mutate(a.id)}>Check in</Button>
                            )}
                            {a.status !== 'completed' && a.status !== 'cancelled' && (
                              <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: 'completed' })}>
                                Complete
                              </Button>
                            )}
                            {a.status === 'scheduled' && (
                              <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: 'no_show' })}>
                                No show
                              </Button>
                            )}
                          </div>
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

      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  );
}

function BookingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [term, setTerm] = useState('');
  const [patient, setPatient] = useState<{ id: string; full_name: string; patient_code: string } | null>(null);
  const [dentistId, setDentistId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [date, setDate] = useState(isoDate());
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dentists = useQuery({ queryKey: ['dentists'], queryFn: listDentists });
  const types = useQuery({ queryKey: ['treatment-types'], queryFn: () => listTreatmentTypes() });
  const results = useQuery({
    queryKey: ['quick-search', term],
    queryFn: () => quickSearchPatients(term),
    enabled: term.trim().length >= 2 && !patient,
  });

  const create = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notify('Appointment booked');
      setPatient(null); setTerm(''); setNotes('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function submit() {
    setError(null);
    if (!patient) { setError('Select a patient first.'); return; }
    create.mutate({
      patient_id: patient.id,
      dentist_id: dentistId || null,
      treatment_type_id: typeId || null,
      scheduled_at: new Date(`${date}T${time}`).toISOString(),
      duration_minutes: duration,
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book appointment"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>Confirm booking</Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      <Field label="Patient" required hint="Search by name, patient ID or phone">
        {patient ? (
          <div className="row">
            <Avatar name={patient.full_name} size="sm" />
            <b className="text-sm">{patient.full_name}</b>
            <span className="text-xs faint">{patient.patient_code}</span>
            <Button size="sm" className="ml-auto" onClick={() => setPatient(null)}>Change</Button>
          </div>
        ) : (
          <>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Start typing…" />
            {term.trim().length >= 2 && (
              <div className="col mt-8" style={{ gap: 4 }}>
                {results.isPending && <span className="text-xs faint">Searching…</span>}
                {results.data?.length === 0 && <span className="text-xs faint">No match found.</span>}
                {results.data?.map((p) => (
                  <button key={p.id} type="button" className="gsearch__item"
                    onClick={() => setPatient({ id: p.id, full_name: p.full_name, patient_code: p.patient_code })}>
                    <Avatar name={p.full_name} size="sm" />
                    <span className="text-sm bold">{p.full_name}</span>
                    <span className="text-2xs faint">{p.patient_code} · {p.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Field>

      <div className="form-grid mt-16">
        <Field label="Date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time" required>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Dentist" hint="Overlapping bookings are blocked by the database">
          <Select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
            <option value="">Unassigned</option>
            {dentists.data?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Treatment">
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Not specified</option>
            {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Duration (minutes)">
          <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </Select>
        </Field>
        <div className="full">
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
