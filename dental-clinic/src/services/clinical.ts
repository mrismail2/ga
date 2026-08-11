import { supabase } from '@/lib/supabase';
import type {
  OrthodonticCase, OrthodonticVisit, Treatment, TreatmentBalance,
  TreatmentPlan, TreatmentType,
} from '@/types/database';

// --- Treatment catalogue ----------------------------------------------------
export async function listTreatmentTypes(activeOnly = true) {
  let query = supabase.from('treatment_types').select('*').order('sort_order');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TreatmentType[];
}

export async function upsertTreatmentType(input: Partial<TreatmentType> & { name: string; code: string }) {
  const { data, error } = await supabase
    .from('treatment_types').upsert(input, { onConflict: 'code' }).select('*').single();
  if (error) throw error;
  return data as TreatmentType;
}

// --- Treatment plans --------------------------------------------------------
export async function listPlans(patientId: string) {
  const { data, error } = await supabase
    .from('treatment_plans').select('*').eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TreatmentPlan[];
}

export async function createPlan(input: { patient_id: string; dentist_id: string | null; title: string; notes?: string | null }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('treatment_plans')
    .insert({ ...input, created_by: auth.user?.id ?? null })
    .select('*').single();
  if (error) throw error;
  return data as TreatmentPlan;
}

// --- Treatments -------------------------------------------------------------
export interface TreatmentInput {
  patient_id: string;
  plan_id?: string | null;
  treatment_type_id: string | null;
  dentist_id: string | null;
  tooth_numbers: number[];
  description?: string | null;
  estimated_cost: number;
  discount: number;
  priority?: Treatment['priority'];
  planned_date?: string | null;
  status?: Treatment['status'];
  notes?: string | null;
}

export async function createTreatment(input: TreatmentInput) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('treatments')
    .insert({ ...input, created_by: auth.user?.id ?? null })
    .select('*').single();
  if (error) throw error;
  return data as Treatment;
}

export async function updateTreatment(id: string, patch: Partial<TreatmentInput> & {
  status?: Treatment['status']; is_waived?: boolean;
}) {
  const body: Record<string, unknown> = { ...patch };
  if (patch.status === 'in_progress') body.started_at = new Date().toISOString();
  if (patch.status === 'completed') body.completed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('treatments').update(body).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Treatment;
}

/** Balances always come from the view so paid/remaining can never drift. */
export async function listTreatmentBalances(patientId: string) {
  const { data, error } = await supabase
    .from('v_treatment_balances').select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TreatmentBalance[];
}

export interface TreatmentFeedParams {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  dentistId?: string;
  page?: number;
  pageSize?: number;
}

export async function listAllTreatments({
  status = 'all', from, to, dentistId, page = 1, pageSize = 25,
}: TreatmentFeedParams) {
  let query = supabase
    .from('v_treatment_balances')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status !== 'all') query = query.eq('status', status);
  if (dentistId) query = query.eq('dentist_id', dentistId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as TreatmentBalance[], total: count ?? 0 };
}

// --- Orthodontics -----------------------------------------------------------
export async function listOrthoCases(patientId?: string) {
  let query = supabase
    .from('orthodontic_cases')
    .select('*, patient:patients(id, full_name, patient_code, phone), dentist:profiles!orthodontic_cases_dentist_id_fkey(id, full_name)')
    .order('start_date', { ascending: false });
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as (OrthodonticCase & {
    patient: { id: string; full_name: string; patient_code: string; phone: string } | null;
    dentist: { id: string; full_name: string } | null;
  })[];
}

export async function getOrthoCase(id: string) {
  const { data, error } = await supabase
    .from('orthodontic_cases')
    .select('*, patient:patients(id, full_name, patient_code, phone, allergies), dentist:profiles!orthodontic_cases_dentist_id_fkey(id, full_name)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

/** Creates the billable treatment and the case together, in one transaction. */
export async function createOrthoCase(input: {
  patient_id: string;
  dentist_id: string | null;
  total_cost: number;
  braces_type: string;
  upper_arch: boolean;
  lower_arch: boolean;
  estimated_months: number;
  start_date: string;
  discount?: number;
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc('create_orthodontic_case', {
    p_patient_id: input.patient_id,
    p_dentist_id: input.dentist_id,
    p_total_cost: input.total_cost,
    p_braces_type: input.braces_type,
    p_upper_arch: input.upper_arch,
    p_lower_arch: input.lower_arch,
    p_estimated_months: input.estimated_months,
    p_start_date: input.start_date,
    p_discount: input.discount ?? 0,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as OrthodonticCase;
}

export async function updateOrthoCase(id: string, patch: Partial<OrthodonticCase>) {
  const { data, error } = await supabase
    .from('orthodontic_cases').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as OrthodonticCase;
}

export async function listOrthoVisits(caseId: string) {
  const { data, error } = await supabase
    .from('orthodontic_visits')
    .select('*, dentist:profiles!orthodontic_visits_dentist_id_fkey(id, full_name)')
    .eq('case_id', caseId)
    .order('visit_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrthodonticVisit[];
}

export async function createOrthoVisit(input: Omit<OrthodonticVisit, 'id' | 'created_at' | 'dentist'>) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('orthodontic_visits')
    .insert({ ...input, created_by: auth.user?.id ?? null })
    .select('*').single();
  if (error) throw error;
  return data as OrthodonticVisit;
}
