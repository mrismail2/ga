import { supabase } from '@/lib/supabase';
import type {
  DentalExamination, Patient, PatientBalance, PatientDocument, PatientInput, ToothRecord,
} from '@/types/database';

const PATIENT_COLUMNS = '*';

export interface PatientListParams {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  pageSize?: number;
}

export async function listPatients({
  search = '', status = 'all', page = 1, pageSize = 25,
}: PatientListParams) {
  let query = supabase
    .from('patients')
    .select(PATIENT_COLUMNS, { count: 'exact' })
    .is('archived_at', null)
    .order('registered_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status !== 'all') query = query.eq('status', status);

  const term = search.trim();
  if (term) {
    // One index-friendly OR across the three things staff actually search by:
    // the code on the old book, the patient's name, or a phone number.
    const escaped = term.replace(/[,%()]/g, ' ');
    query = query.or(
      `patient_code.ilike.%${escaped}%,full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,alt_phone.ilike.%${escaped}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as Patient[], total: count ?? 0 };
}

/** Fast lookup for the global search bar. */
export async function quickSearchPatients(term: string, limit = 8) {
  const value = term.trim();
  if (value.length < 2) return [];
  const escaped = value.replace(/[,%()]/g, ' ');
  const { data, error } = await supabase
    .from('patients')
    .select('id, patient_code, full_name, phone, gender, age_years, date_of_birth')
    .is('archived_at', null)
    .or(`patient_code.ilike.%${escaped}%,full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPatient(id: string) {
  const { data, error } = await supabase
    .from('patients').select(PATIENT_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return data as Patient;
}

export async function getPatientBalance(id: string) {
  const { data, error } = await supabase
    .from('v_patient_balances').select('*').eq('patient_id', id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as PatientBalance | null;
}

/**
 * Same phone or a very similar name means the person is probably already in the
 * system — the old book's biggest failure was the same patient written twice.
 */
export async function findPossibleDuplicates(fullName: string, phone: string) {
  const name = fullName.trim();
  const tel = phone.trim();
  if (!name && !tel) return [];
  const filters: string[] = [];
  if (tel.length >= 6) filters.push(`phone.eq.${tel}`, `alt_phone.eq.${tel}`);
  if (name.length >= 3) filters.push(`full_name.ilike.%${name.replace(/[,%()]/g, ' ')}%`);
  if (!filters.length) return [];

  const { data, error } = await supabase
    .from('patients')
    .select('id, patient_code, full_name, phone, registered_at')
    .is('archived_at', null)
    .or(filters.join(','))
    .limit(5);
  if (error) throw error;
  return data ?? [];
}

export async function createPatient(input: PatientInput) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('patients')
    .insert({ ...input, created_by: auth.user?.id ?? null })
    .select(PATIENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as Patient;
}

export async function updatePatient(id: string, patch: Partial<PatientInput>) {
  const { data, error } = await supabase
    .from('patients').update(patch).eq('id', id).select(PATIENT_COLUMNS).single();
  if (error) throw error;
  return data as Patient;
}

/** Patients are archived, never deleted — the history has to survive. */
export async function archivePatient(id: string) {
  const { error } = await supabase
    .from('patients')
    .update({ archived_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id);
  if (error) throw error;
}

// --- Examinations -----------------------------------------------------------
export async function listExaminations(patientId: string) {
  const { data, error } = await supabase
    .from('dental_examinations')
    .select('*, dentist:profiles!dental_examinations_dentist_id_fkey(id, full_name)')
    .eq('patient_id', patientId)
    .order('exam_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DentalExamination[];
}

export async function createExamination(
  input: Omit<DentalExamination, 'id' | 'created_at' | 'dentist'>,
) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('dental_examinations')
    .insert({ ...input, created_by: auth.user?.id ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as DentalExamination;
}

// --- Tooth chart ------------------------------------------------------------
export async function listToothRecords(patientId: string, currentOnly = true) {
  let query = supabase
    .from('tooth_records')
    .select('*, recorded_by_profile:profiles!tooth_records_recorded_by_fkey(id, full_name)')
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: false });
  if (currentOnly) query = query.eq('is_current', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ToothRecord[];
}

export async function recordToothCondition(input: {
  patient_id: string;
  tooth_number: number;
  condition: ToothRecord['condition'];
  proposed_treatment?: string | null;
  existing_treatment?: string | null;
  surface?: string | null;
  notes?: string | null;
  examination_id?: string | null;
}) {
  const { data, error } = await supabase.rpc('record_tooth_condition', {
    p_patient_id: input.patient_id,
    p_tooth_number: input.tooth_number,
    p_condition: input.condition,
    p_proposed_treatment: input.proposed_treatment ?? null,
    p_existing_treatment: input.existing_treatment ?? null,
    p_surface: input.surface ?? null,
    p_notes: input.notes ?? null,
    p_examination_id: input.examination_id ?? null,
  });
  if (error) throw error;
  return data as ToothRecord;
}

// --- Documents --------------------------------------------------------------
export const DOCUMENT_BUCKET = 'patient-documents';

export async function listDocuments(patientId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*, uploaded_by_profile:profiles!documents_uploaded_by_fkey(id, full_name)')
    .eq('patient_id', patientId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatientDocument[];
}

export async function uploadDocument(
  patientId: string,
  file: File,
  meta: { title: string; doc_type: PatientDocument['doc_type']; notes?: string },
) {
  const path = `${patientId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('documents')
    .insert({
      patient_id: patientId,
      title: meta.title,
      doc_type: meta.doc_type,
      notes: meta.notes ?? null,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: auth.user?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PatientDocument;
}

/** Documents live in a private bucket; links are short-lived signed URLs. */
export async function signedDocumentUrl(path: string, seconds = 300) {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
