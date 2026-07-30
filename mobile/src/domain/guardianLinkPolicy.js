/* School Admin manages their OWN school only. Super Admin may manage a
   school's guardians too, but only the ONE they explicitly picked (their
   own profile carries no school_id to compare against) — the caller passes
   that resolved school as `effectiveSchoolId`. Either way, guardian and
   student must be in the SAME school as each other and as the acting scope
   — cross-school linking is rejected before Supabase is ever called. */
function assertGuardianLinkScope(profile, guardian, student) {
  const isSchoolAdmin = !!profile && profile.role === 'school_admin' && !!profile.school_id;
  const isSuperAdmin = !!profile && profile.role === 'super_admin' && !!profile.effectiveSchoolId;
  if (!isSchoolAdmin && !isSuperAdmin) throw new Error('school_admin profile required');
  const scopeSchoolId = isSchoolAdmin ? profile.school_id : profile.effectiveSchoolId;
  if (!guardian || guardian.school_id !== scopeSchoolId) throw new Error('guardian belongs to another school');
  if (!student || student.school_id !== scopeSchoolId) throw new Error('student belongs to another school');
  return true;
}
function buildParentStudentLinkInsert(profile, guardian, student, input = {}) {
  assertGuardianLinkScope(profile, guardian, student);
  return {
    parent_id: guardian.id,
    student_id: student.id,
    relationship: String(input.relationship || '').trim() || null,
    is_primary: Boolean(input.is_primary),
    can_receive_messages: input.can_receive_messages === undefined ? true : Boolean(input.can_receive_messages),
  };
}
function buildParentStudentLinkPatch(input = {}) {
  const patch = {};
  if (input.relationship !== undefined) patch.relationship = String(input.relationship || '').trim() || null;
  if (input.is_primary !== undefined) patch.is_primary = Boolean(input.is_primary);
  if (input.can_receive_messages !== undefined) patch.can_receive_messages = Boolean(input.can_receive_messages);
  return patch;
}
function guardianLinkIdentity(parentId, studentId) { return `${parentId}:${studentId}`; }
module.exports = { assertGuardianLinkScope, buildParentStudentLinkInsert, buildParentStudentLinkPatch, guardianLinkIdentity };
