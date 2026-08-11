import { supabase } from '@/lib/supabase';
import type { AuditLog, ClinicSettings, DashboardSummary, Profile, UserRole } from '@/types/database';

const EMPTY_SUMMARY: DashboardSummary = {
  patients_total: 0, patients_today: 0, appointments_today: 0, appointments_done: 0,
  waiting_now: 0, treatments_today: 0, treatment_income: 0, pharmacy_income: 0,
  expenses_today: 0, outstanding_total: 0, outstanding_patients: 0,
  partial_patients: 0, unpaid_patients: 0, low_stock: 0, expiring_soon: 0,
};

/**
 * dashboard_summary() returns null for a caller with no active staff profile,
 * and zeroes the sections the caller is not allowed to see.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('dashboard_summary');
  if (error) throw error;
  return { ...EMPTY_SUMMARY, ...((data ?? {}) as Partial<DashboardSummary>) };
}

// --- Staff ------------------------------------------------------------------
export async function listStaff(includeInactive = true) {
  let query = supabase.from('profiles').select('*').order('full_name');
  if (!includeInactive) query = query.eq('status', 'active');
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function listDentists() {
  const { data, error } = await supabase
    .from('profiles').select('id, full_name, specialty, role')
    .in('role', ['dentist', 'admin']).eq('status', 'active').order('full_name');
  if (error) throw error;
  return (data ?? []) as Pick<Profile, 'id' | 'full_name' | 'specialty' | 'role'>[];
}

export async function updateStaff(id: string, patch: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Profile;
}

export async function listPermissionOverrides(userId: string) {
  const { data, error } = await supabase
    .from('user_permissions').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as { id: string; permission: string; granted: boolean }[];
}

export async function setPermissionOverride(userId: string, permission: string, granted: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('user_permissions')
    .upsert(
      { user_id: userId, permission, granted, granted_by: auth.user?.id ?? null },
      { onConflict: 'user_id,permission' },
    );
  if (error) throw error;
}

/**
 * Staff accounts are created by signing the person up; the profiles row is made
 * automatically by the on_auth_user_created trigger, then an admin sets the role.
 */
export async function inviteStaff(input: {
  email: string; password: string; full_name: string; role: UserRole;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.full_name, role: input.role } },
  });
  if (error) throw error;
  return data.user;
}

// --- Settings ---------------------------------------------------------------
export async function getSettings() {
  const { data, error } = await supabase.from('clinic_settings').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ClinicSettings | null;
}

export async function updateSettings(patch: Partial<ClinicSettings>) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('clinic_settings')
    .update({ ...patch, updated_by: auth.user?.id ?? null })
    .eq('id', true).select('*').single();
  if (error) throw error;
  return data as ClinicSettings;
}

// --- Audit ------------------------------------------------------------------
export async function listAuditLogs(params: {
  entity?: string; from?: string; to?: string; page?: number; pageSize?: number;
} = {}) {
  const { entity, from, to, page = 1, pageSize = 50 } = params;
  let query = supabase
    .from('audit_logs')
    .select('*, user:profiles(id, full_name, role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (entity && entity !== 'all') query = query.eq('entity', entity);
  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AuditLog[], total: count ?? 0 };
}

// --- Reports ----------------------------------------------------------------
export async function patientReport(from: string, to: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('id, gender, age_years, date_of_birth, registered_at')
    .is('archived_at', null)
    .gte('registered_at', `${from}T00:00:00`)
    .lte('registered_at', `${to}T23:59:59`);
  if (error) throw error;

  const rows = data ?? [];
  const ageOf = (r: { age_years: number | null; date_of_birth: string | null }) => {
    if (r.age_years != null) return r.age_years;
    if (!r.date_of_birth) return null;
    return Math.floor((Date.now() - new Date(r.date_of_birth).getTime()) / (365.25 * 864e5));
  };
  const buckets = [
    { label: '0-17', min: 0, max: 17 }, { label: '18-29', min: 18, max: 29 },
    { label: '30-44', min: 30, max: 44 }, { label: '45-59', min: 45, max: 59 },
    { label: '60+', min: 60, max: 200 },
  ];

  return {
    total: rows.length,
    male: rows.filter((r) => r.gender === 'male').length,
    female: rows.filter((r) => r.gender === 'female').length,
    ageGroups: buckets.map((b) => ({
      label: b.label,
      value: rows.filter((r) => {
        const age = ageOf(r);
        return age != null && age >= b.min && age <= b.max;
      }).length,
    })),
  };
}

export async function treatmentReport(from: string, to: string) {
  const { data, error } = await supabase
    .from('v_treatment_balances')
    .select('treatment_name, treatment_category, dentist_id, final_cost, amount_paid, status, created_at')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`);
  if (error) throw error;

  const rows = data ?? [];
  const byName = new Map<string, { name: string; count: number; revenue: number }>();
  for (const r of rows) {
    const name = r.treatment_name ?? 'Other';
    const entry = byName.get(name) ?? { name, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(r.amount_paid ?? 0);
    byName.set(name, entry);
  }
  return {
    total: rows.length,
    completed: rows.filter((r) => r.status === 'completed').length,
    billed: rows.reduce((t, r) => t + Number(r.final_cost ?? 0), 0),
    collected: rows.reduce((t, r) => t + Number(r.amount_paid ?? 0), 0),
    byTreatment: [...byName.values()].sort((a, b) => b.count - a.count),
  };
}

export async function appointmentReport(from: string, to: string) {
  const { data, error } = await supabase
    .from('appointments').select('status')
    .gte('scheduled_at', `${from}T00:00:00`).lte('scheduled_at', `${to}T23:59:59`);
  if (error) throw error;
  const rows = data ?? [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    completed: count('completed'),
    cancelled: count('cancelled'),
    noShow: count('no_show'),
    scheduled: count('scheduled') + count('confirmed'),
  };
}
