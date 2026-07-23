import { supabase, getMyProfile, updateMyProfile, updatePassword } from './supabase';

const PROTECTED_SETTINGS_FIELDS = ['institution_type', 'school_stage', 'school_id', 'role'];

function rejectProtectedSettingsFields(input) {
  const protectedField = PROTECTED_SETTINGS_FIELDS.find((field) => (
    input && Object.prototype.hasOwnProperty.call(input, field)
  ));
  if (!protectedField) return;
  const error = new Error(`Goobta ${protectedField} lagama beddeli karo Settings.`);
  error.code = 'settings_protected_field';
  throw error;
}

async function requireSchoolAdminProfile() {
  const profile = await getMyProfile();
  if (!profile || profile.role !== 'school_admin' || !profile.school_id || !profile.school
      || profile.school.institution_type !== 'school') {
    const error = new Error('Kaliya Maamulaha Dugsiga ayaa beddeli kara goobahan.');
    error.code = 'settings_access_denied';
    throw error;
  }
  return profile;
}

export async function updateLivePersonalProfile(input = {}) {
  rejectProtectedSettingsFields(input);
  const { full_name, phone } = input || {};
  const patch = {};
  if (full_name !== undefined) {
    patch.full_name = String(full_name).trim();
    if (!patch.full_name) throw new Error('Magaca profile-ku waa qasab.');
  }
  if (phone !== undefined) patch.phone = String(phone).trim() || null;
  if (!Object.keys(patch).length) throw new Error('Wax isbeddel ah lama soo dirin.');
  await updateMyProfile(patch);
  return getMyProfile();
}

export async function getLiveSchoolPreferences() {
  const profile = await requireSchoolAdminProfile();
  return {
    name: profile.school.name || '', location: profile.school.location || '',
    student_id_prefix: profile.school.student_id_prefix || 'KOB',
    next_student_sequence: profile.school.next_student_sequence || 1,
  };
}

export async function updateLiveSchoolProfile(input = {}) {
  rejectProtectedSettingsFields(input);
  const { name, location } = input || {};
  const profile = await requireSchoolAdminProfile();
  const patch = {};
  if (name !== undefined) {
    const clean = String(name).trim();
    if (!clean) throw new Error('Magaca dugsigu waa qasab.');
    patch.name = clean;
  }
  if (location !== undefined) patch.location = String(location).trim() || null;
  if (!Object.keys(patch).length) throw new Error('Wax isbeddel ah lama soo dirin.');
  const { data, error } = await supabase.from('schools').update(patch)
    .eq('id', profile.school_id)
    .select('id, name, location, student_id_prefix, next_student_sequence, institution_type, school_stage').single();
  if (error) throw error;
  return data;
}

export async function updateLiveStudentIdPrefix(prefix) {
  const profile = await requireSchoolAdminProfile();
  const value = String(prefix || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{2,12}$/.test(value)) throw new Error('Prefix-ku waa inuu noqdaa 2–12 xaraf waaweyn, lambarro ama xariiq (-).');
  const { data, error } = await supabase.from('schools').update({ student_id_prefix: value })
    .eq('id', profile.school_id)
    .select('id, student_id_prefix, next_student_sequence').single();
  if (error) throw error;
  return data;
}

export async function updateLiveAccountPassword(password, confirmation) {
  if (!password || password.length < 8) throw new Error('Password-ku waa inuu ugu yaraan 8 xaraf noqdaa.');
  if (password !== confirmation) throw new Error('Labada password isma laha.');
  await updatePassword(password);
}
