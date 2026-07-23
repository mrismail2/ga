import { supabase, getMyProfile } from './supabase';
const { buildParentStudentLinkInsert, buildParentStudentLinkPatch } = require('../domain/guardianLinkPolicy');

function accessError(message) {
  const error = new Error(message);
  error.code = 'guardian_access_denied';
  return error;
}

async function requireSchoolAdmin() {
  const profile = await getMyProfile();
  if (!profile || profile.role !== 'school_admin' || !profile.school_id
      || !profile.school || profile.school.institution_type !== 'school') {
    throw accessError('Kaliya Maamulaha Dugsiga ayaa maamuli kara xiriirka waalidka iyo ardayga.');
  }
  return profile;
}

async function guardianInSchool(parentId, schoolId) {
  const { data, error } = await supabase.from('parents')
    .select('id, school_id, profile_id, full_name, phone, email, status')
    .eq('id', parentId).eq('school_id', schoolId).single();
  if (error) throw error;
  return data;
}

async function studentInSchool(studentId, schoolId) {
  const { data, error } = await supabase.from('students')
    .select('id, school_id, full_name, student_id, admission_number, class_id')
    .eq('id', studentId).eq('school_id', schoolId).single();
  if (error) throw error;
  return data;
}

async function linkInSchool(linkId, schoolId) {
  const { data, error } = await supabase.from('student_parents')
    .select('id, parent_id, student_id, relationship, is_primary, can_receive_messages')
    .eq('id', linkId).single();
  if (error) throw error;
  await Promise.all([guardianInSchool(data.parent_id, schoolId), studentInSchool(data.student_id, schoolId)]);
  return data;
}

export async function listGuardians() {
  const profile = await requireSchoolAdmin();
  const { data, error } = await supabase.from('parents')
    .select('id, full_name, phone, email, status, profile_id')
    .eq('school_id', profile.school_id).order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function loadGuardianManagementData() {
  const profile = await requireSchoolAdmin();
  const [parentsResult, studentsResult, linksResult] = await Promise.all([
    supabase.from('parents')
      .select('id, full_name, phone, email, status, profile_id')
      .eq('school_id', profile.school_id).order('full_name', { ascending: true }),
    supabase.from('students')
      .select('id, full_name, student_id, admission_number, class_id')
      .eq('school_id', profile.school_id).order('full_name', { ascending: true }),
    supabase.from('student_parents')
      .select('id, parent_id, student_id, relationship, is_primary, can_receive_messages, parent:parents!inner(id, school_id), student:students!inner(id, full_name, student_id, admission_number, school_id)')
      .eq('parent.school_id', profile.school_id).eq('student.school_id', profile.school_id)
      .order('student_id', { ascending: true }),
  ]);
  const error = parentsResult.error || studentsResult.error || linksResult.error;
  if (error) throw error;
  return { guardians: parentsResult.data || [], students: studentsResult.data || [], links: linksResult.data || [] };
}

export async function createGuardian({ full_name, phone, email } = {}) {
  const profile = await requireSchoolAdmin();
  const name = String(full_name || '').trim();
  const mobile = String(phone || '').trim();
  if (!name || !mobile) throw new Error('Magaca iyo telefoonka waalidku waa qasab.');
  const { data, error } = await supabase.from('parents').insert({
    school_id: profile.school_id, full_name: name, phone: mobile,
    email: String(email || '').trim() || null,
  }).select('id, full_name, phone, email, status, profile_id').single();
  if (error) throw error;
  return data;
}

export async function updateGuardian(parentId, { full_name, phone, email } = {}) {
  const profile = await requireSchoolAdmin();
  await guardianInSchool(parentId, profile.school_id);
  const patch = {};
  if (full_name !== undefined) {
    patch.full_name = String(full_name).trim();
    if (!patch.full_name) throw new Error('Magaca waalidku waa qasab.');
  }
  if (phone !== undefined) {
    patch.phone = String(phone).trim();
    if (!patch.phone) throw new Error('Telefoonka waalidku waa qasab.');
  }
  if (email !== undefined) patch.email = String(email).trim() || null;
  if (!Object.keys(patch).length) throw new Error('Wax isbeddel ah lama soo dirin.');
  const { data, error } = await supabase.from('parents').update(patch)
    .eq('id', parentId).eq('school_id', profile.school_id)
    .select('id, full_name, phone, email, status, profile_id').single();
  if (error) throw error;
  return data;
}

export async function listSchoolStudents() {
  const profile = await requireSchoolAdmin();
  const { data, error } = await supabase.from('students')
    .select('id, full_name, student_id, admission_number, class_id')
    .eq('school_id', profile.school_id).order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listParentStudentLinks(parentId) {
  const profile = await requireSchoolAdmin();
  await guardianInSchool(parentId, profile.school_id);
  const { data, error } = await supabase.from('student_parents')
    .select('id, parent_id, student_id, relationship, is_primary, can_receive_messages, student:students(id, full_name, student_id, admission_number, school_id)')
    .eq('parent_id', parentId).order('student_id', { ascending: true });
  if (error) throw error;
  return (data || []).filter((link) => link.student && link.student.school_id === profile.school_id);
}

export async function createParentStudentLink(parentId, {
  student_id, relationship, is_primary = false, can_receive_messages = true,
} = {}) {
  const profile = await requireSchoolAdmin();
  const [guardian, student] = await Promise.all([
    guardianInSchool(parentId, profile.school_id),
    studentInSchool(student_id, profile.school_id),
  ]);
  const payload = buildParentStudentLinkInsert(profile, guardian, student, { relationship, is_primary, can_receive_messages });
  const { data, error } = await supabase.from('student_parents').insert(payload)
    .select('id, parent_id, student_id, relationship, is_primary, can_receive_messages').single();
  if (error) throw error;
  return data;
}

export async function updateParentStudentLink(linkId, {
  relationship, is_primary, can_receive_messages,
} = {}) {
  const profile = await requireSchoolAdmin();
  await linkInSchool(linkId, profile.school_id);
  const patch = buildParentStudentLinkPatch({ relationship, is_primary, can_receive_messages });
  if (!Object.keys(patch).length) throw new Error('Wax isbeddel ah lama soo dirin.');
  const { data, error } = await supabase.from('student_parents').update(patch).eq('id', linkId)
    .select('id, parent_id, student_id, relationship, is_primary, can_receive_messages').single();
  if (error) throw error;
  return data;
}

export async function deleteParentStudentLink(linkId) {
  const profile = await requireSchoolAdmin();
  await linkInSchool(linkId, profile.school_id);
  const { data, error } = await supabase.from('student_parents').delete().eq('id', linkId).select('id').single();
  if (error) throw error;
  return data;
}
