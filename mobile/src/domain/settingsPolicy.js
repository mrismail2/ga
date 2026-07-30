const SCHOOL_MANAGEMENT_DESTINATIONS = Object.freeze([
  Object.freeze({ key: 'academic', icon: 'clock', label: 'Academic Years & Terms', sub: 'Sannad-dugsiyeedka iyo xilliyada', route: 'Management', moduleKey: 'academic_years', moduleKeys: ['academic_years', 'terms'] }),
  Object.freeze({ key: 'classesSubjects', icon: 'classes', label: 'Classes & Subjects', sub: 'Qaybaha waxbarashada iyo maadooyinka', route: 'Management', moduleKey: 'classes', moduleKeys: ['classes', 'subjects'] }),
  Object.freeze({ key: 'assignments', icon: 'teachers', label: 'Teacher Assignments', sub: 'Qoondaynta macallimiinta', route: 'Management', moduleKey: 'teacher_assignments', moduleKeys: ['teacher_assignments'] }),
]);

function activateSettingsDestination(item, navigate) {
  if (!item || item.route !== 'Management' || typeof navigate !== 'function') return null;
  const params = { moduleKey: item.moduleKey, moduleKeys: [...item.moduleKeys], source: 'settings' };
  navigate(item.route, params);
  return { route: item.route, params };
}

module.exports = { SCHOOL_MANAGEMENT_DESTINATIONS, activateSettingsDestination };
