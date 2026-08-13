import { supabase } from '@/lib/supabase';
import type { Appointment, AppointmentStatus, QueueStatus } from '@/types/database';

const APPOINTMENT_SELECT = `
  *,
  patient:patients(id, full_name, patient_code, phone),
  dentist:profiles!appointments_dentist_id_fkey(id, full_name),
  treatment_type:treatment_types(id, name)
`;

export interface AppointmentParams {
  from?: string;
  to?: string;
  patientId?: string;
  dentistId?: string;
  status?: AppointmentStatus | 'all';
  search?: string;
}

export async function listAppointments({
  from, to, patientId, dentistId, status = 'all',
}: AppointmentParams) {
  let query = supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .order('scheduled_at', { ascending: true });

  if (from) query = query.gte('scheduled_at', `${from}T00:00:00`);
  if (to) query = query.lte('scheduled_at', `${to}T23:59:59`);
  if (patientId) query = query.eq('patient_id', patientId);
  if (dentistId) query = query.eq('dentist_id', dentistId);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Appointment[];
}

export async function createAppointment(input: {
  patient_id: string;
  dentist_id: string | null;
  treatment_type_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  notes?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('appointments')
    .insert({ ...input, created_by: auth.user?.id ?? null })
    .select(APPOINTMENT_SELECT).single();
  if (error) throw error;
  return data as unknown as Appointment;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === 'in_treatment') { patch.started_at = new Date().toISOString(); patch.queue_state = 'in_treatment'; }
  if (status === 'completed') { patch.completed_at = new Date().toISOString(); patch.queue_state = 'completed'; }
  if (status === 'cancelled' || status === 'no_show') patch.queue_state = null;

  const { data, error } = await supabase
    .from('appointments').update(patch).eq('id', id).select(APPOINTMENT_SELECT).single();
  if (error) throw error;
  return data as unknown as Appointment;
}

/** Cancelling needs a reason — the database rejects a blank one. */
export async function cancelAppointment(id: string, reason: string) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancel_reason: reason.trim() })
    .eq('id', id).select('*').single();
  if (error) throw error;
  return data as Appointment;
}

export async function rescheduleAppointment(id: string, scheduledAt: string, duration: number) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ scheduled_at: scheduledAt, duration_minutes: duration })
    .eq('id', id).select(APPOINTMENT_SELECT).single();
  if (error) throw error;
  return data as unknown as Appointment;
}

/** Check-in assigns the day's next queue number inside the database. */
export async function checkIn(appointmentId: string) {
  const { data, error } = await supabase.rpc('check_in_appointment', {
    p_appointment_id: appointmentId,
  });
  if (error) throw error;
  return data as Appointment;
}

export async function setQueueState(id: string, queueState: QueueStatus) {
  const patch: Record<string, unknown> = { queue_state: queueState };
  if (queueState === 'called') patch.called_at = new Date().toISOString();
  if (queueState === 'in_treatment') { patch.started_at = new Date().toISOString(); patch.status = 'in_treatment'; }
  if (queueState === 'completed') { patch.completed_at = new Date().toISOString(); patch.status = 'completed'; }

  const { data, error } = await supabase
    .from('appointments').update(patch).eq('id', id).select(APPOINTMENT_SELECT).single();
  if (error) throw error;
  return data as unknown as Appointment;
}

export async function listQueue() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .not('queue_state', 'is', null)
    .order('queue_number', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Appointment[];
}

export async function nextAppointmentFor(patientId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('patient_id', patientId)
    .gte('scheduled_at', new Date().toISOString())
    .not('status', 'in', '("cancelled","no_show")')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Appointment | null;
}
