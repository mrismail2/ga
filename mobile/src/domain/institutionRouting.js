/* Pure institution gate used by App.js and executable behavior tests. */
const SHELLS = Object.freeze({
  LOADING: 'loading', ERROR: 'error', UNCLASSIFIED: 'unclassified',
  SCHOOL: 'school', UNIVERSITY: 'university', PLATFORM: 'platform',
});

function resolveInstitutionShell({ authStatus, roleKey, profileStatus, profile } = {}) {
  if (authStatus !== 'signed_in') return SHELLS.LOADING;
  if (profileStatus === 'error') return SHELLS.ERROR;
  if (profileStatus !== 'ready') return SHELLS.LOADING;
  if (roleKey === 'superadmin') return SHELLS.PLATFORM;
  const school = profile && profile.school;
  if (!school) return SHELLS.UNCLASSIFIED;
  if (school.institution_type === 'school'
      && (school.school_stage === 'primary_middle' || school.school_stage === 'secondary')) return SHELLS.SCHOOL;
  if (school.institution_type === 'university' && school.school_stage == null) return SHELLS.UNIVERSITY;
  return SHELLS.UNCLASSIFIED;
}

module.exports = { SHELLS, resolveInstitutionShell };
