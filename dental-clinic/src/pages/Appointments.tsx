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
import { dateOnly, isoDate, timeOnly } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { AppointmentStatus } from '@/types/database';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, QueryBoundary,
  Select, Textarea, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const STATUS_TONE: Record<AppointmentStatus, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  scheduled: 'muted', confirmed: 'info', checked_in: 'info', waiting: 'warn',
  in_treatment: 'info', completed: 'ok', cancelled: 'danger', no_show: 'danger',
};

const RANGES = [
  { id: 'today', key: 'common.today' },
  { id: 'week', key: 'common.thisWeek' },
  { id: 'month', key: 'common.thisMonth' },
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
  const { t, label } = useI18n();
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
      notify(t('appt.updated'));
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  const doCheckIn = useMutation({
    mutationFn: checkIn,
    onSuccess: (appt) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      notify(`${t('appt.checkedIn')} ${appt.queue_number}`);
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('appt.title')}</h1>
          <p>{t('appt.subtitle')}</p>
        </div>
        {can('appointments.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setBooking(true)}>
              <Icon name="plus" /> {t('appt.book')}
            </Button>
          </div>
        )}
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <div className="segmented">
            {RANGES.map((r) => (
              <button key={r.id} className={cx(range === r.id && 'is-active')} onClick={() => setRange(r.id)}>
                {t(r.key)}
              </button>
            ))}
          </div>
          <Select value={dentistId} onChange={(e) => setDentistId(e.target.value)} style={{ width: 190 }}>
            <option value="">{t('appt.allDentists')}</option>
            {dentists.data?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
          <span className="ml-auto text-xs faint">
            {dateOnly(from)} – {dateOnly(to)}
          </span>
        </div>

        <QueryBoundary
          query={appointments}
          skeletonRows={7}
          empty={<EmptyState title={t('appt.empty')}
            description={t('appt.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('common.when')}</th><th>{t('common.patient')}</th><th>{t('common.dentist')}</th>
                    <th>{t('common.treatment')}</th><th>{t('common.duration')}</th>
                    <th>{t('common.status')}</th><th /></tr>
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
                      <td>{a.dentist?.full_name ?? <span className="faint">{t('common.unassigned')}</span>}</td>
                      <td>{a.treatment_type?.name ?? <span className="faint">—</span>}</td>
                      <td>{a.duration_minutes} {t('common.min')}</td>
                      <td><Badge tone={STATUS_TONE[a.status]}>{label('status', a.status)}</Badge></td>
                      <td className="right">
                        {can('appointments.write') && (
                          <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                            {(a.status === 'scheduled' || a.status === 'confirmed') && (
                              <Button size="sm" variant="primary"
                                loading={doCheckIn.isPending}
                                onClick={() => doCheckIn.mutate(a.id)}>{t('appt.checkIn')}</Button>
                            )}
                            {a.status !== 'completed' && a.status !== 'cancelled' && (
                              <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: 'completed' })}>
                                {t('appt.complete')}
                              </Button>
                            )}
                            {a.status === 'scheduled' && (
                              <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: 'no_show' })}>
                                {t('appt.noShow')}
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
  const { t } = useI18n();
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
      notify(t('appt.booked'));
      setPatient(null); setTerm(''); setNotes('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function submit() {
    setError(null);
    if (!patient) { setError(t('common.selectPatient')); return; }
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
      title={t('appt.book')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>{t('appt.confirmBooking')}</Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      <Field label={t('common.patient')} required hint={t('appt.searchHint')}>
        {patient ? (
          <div className="row">
            <Avatar name={patient.full_name} size="sm" />
            <b className="text-sm">{patient.full_name}</b>
            <span className="text-xs faint">{patient.patient_code}</span>
            <Button size="sm" className="ml-auto" onClick={() => setPatient(null)}>{t('common.change')}</Button>
          </div>
        ) : (
          <>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('appt.startTyping')} />
            {term.trim().length >= 2 && (
              <div className="col mt-8" style={{ gap: 4 }}>
                {results.isPending && <span className="text-xs faint">{t('common.searching')}</span>}
                {results.data?.length === 0 && <span className="text-xs faint">{t('common.noMatch')}</span>}
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
        <Field label={t('common.date')} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('common.time')} required>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label={t('common.dentist')} hint={t('appt.doubleBookHint')}>
          <Select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
            <option value="">{t('common.unassigned')}</option>
            {dentists.data?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label={t('common.treatment')}>
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{t('common.notSpecified')}</option>
            {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label={t('common.duration')}>
          <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} {t('common.minutes')}</option>)}
          </Select>
        </Field>
        <div className="full">
          <Field label={t('common.notes')}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
