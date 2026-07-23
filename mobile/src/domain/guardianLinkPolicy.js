function assertGuardianLinkScope(profile, guardian, student) {
  if (!profile || profile.role !== 'school_admin' || !profile.school_id) throw new Error('school_admin profile required');
  if (!guardian || guardian.school_id !== profile.school_id) throw new Error('guardian belongs to another school');
  if (!student || student.school_id !== profile.school_id) throw new Error('student belongs to another school');
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
