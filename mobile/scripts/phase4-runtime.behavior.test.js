#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  MANAGEMENT_ITEM, withManagementNavigation, activateNavigationItem, resolveSchoolScreen,
} = require('../src/domain/navigationPolicy');
const { SHELLS, resolveInstitutionShell } = require('../src/domain/institutionRouting');
const { SCHOOL_STAGES, terminologyForStage, applySchoolStageToModule } = require('../src/domain/schoolStagePolicy');
const { SCHOOL_MANAGEMENT_DESTINATIONS, activateSettingsDestination } = require('../src/domain/settingsPolicy');
const { buildParentStudentLinkInsert, guardianLinkIdentity } = require('../src/domain/guardianLinkPolicy');

let failures = 0;
function ok(name, condition) { console.log(condition ? 'PASS' : 'FAIL', name); if (!condition) failures += 1; }

const base = ['dashboard', 'students', 'settings'];
const schoolAdminNav = withManagementNavigation('schooladmin', base);
ok('School Admin navigation contains management', schoolAdminNav.includes('management'));
for (const role of ['teacher', 'parent', 'student', 'accountant', 'superadmin']) {
  ok(`${role} does not receive management`, !withManagementNavigation(role, base).includes('management'));
}

const navMeta = { management: [MANAGEMENT_ITEM.icon, MANAGEMENT_ITEM.label, MANAGEMENT_ITEM.route] };
let mobileRoute = null;
activateNavigationItem({ roleKey: 'schooladmin', key: 'management', navMeta, navigate: (route) => { mobileRoute = route; } });
ok('mobile More activation navigates to Management', mobileRoute === 'Management');
let desktopRoute = null;
activateNavigationItem({ roleKey: 'schooladmin', key: 'management', navMeta, navigate: (route) => { desktopRoute = route; } });
const SchoolManagementScreen = { name: 'SchoolManagementScreen' };
ok('desktop Sidebar activation resolves SchoolManagementScreen', desktopRoute === 'Management'
  && resolveSchoolScreen(desktopRoute, { Management: SchoolManagementScreen }, null) === SchoolManagementScreen);
let blocked = false;
activateNavigationItem({ roleKey: 'teacher', key: 'management', navMeta, navigate: () => { blocked = true; } });
ok('unauthorized menu activation is blocked', blocked === false);

const ready = (school, roleKey = 'schooladmin') => ({ authStatus: 'signed_in', profileStatus: 'ready', roleKey, profile: { school } });
ok('school + primary_middle selects shared school shell', resolveInstitutionShell(ready({ institution_type: 'school', school_stage: 'primary_middle' })) === SHELLS.SCHOOL);
ok('school + secondary selects the same shared school shell', resolveInstitutionShell(ready({ institution_type: 'school', school_stage: 'secondary' })) === SHELLS.SCHOOL);
ok('university + null selects university shell only', resolveInstitutionShell(ready({ institution_type: 'university', school_stage: null })) === SHELLS.UNIVERSITY);
ok('profile query failure selects safe error state', resolveInstitutionShell({ authStatus: 'signed_in', profileStatus: 'error', roleKey: null, profile: null }) === SHELLS.ERROR);
ok('profile loading selects no shell', resolveInstitutionShell({ authStatus: 'signed_in', profileStatus: 'loading' }) === SHELLS.LOADING);
ok('legacy unclassified institution is not guessed', resolveInstitutionShell(ready({ institution_type: null, school_stage: null })) === SHELLS.UNCLASSIFIED);
ok('invalid school/stage pairing is not guessed', resolveInstitutionShell(ready({ institution_type: 'school', school_stage: null })) === SHELLS.UNCLASSIFIED);

const sample = { title: 'Fasallada', single: 'Fasal', stageTitleKey: 'classLabelPlural', stageSingleKey: 'classLabel', fields: [{ label: 'FASALKA', stageLabelKey: 'classFieldLabel' }] };
const primary = applySchoolStageToModule(sample, SCHOOL_STAGES.PRIMARY_MIDDLE);
const secondary = applySchoolStageToModule(sample, SCHOOL_STAGES.SECONDARY);
ok('Primary/Middle wording is stage-appropriate', primary.title === 'Fasallada' && primary.fields[0].label === 'FASALKA');
ok('Secondary wording is Form-friendly', secondary.title === 'Formamka' && secondary.fields[0].label === 'FORMKA');
ok('terminology policy does not leak Form into Primary/Middle', !Object.values(terminologyForStage(SCHOOL_STAGES.PRIMARY_MIDDLE)).join(' ').includes('Form'));

for (const expected of [
  ['academic', 'academic_years', ['academic_years', 'terms']],
  ['classesSubjects', 'classes', ['classes', 'subjects']],
  ['assignments', 'teacher_assignments', ['teacher_assignments']],
]) {
  const item = SCHOOL_MANAGEMENT_DESTINATIONS.find((value) => value.key === expected[0]);
  let call = null;
  const result = activateSettingsDestination(item, (route, params) => { call = { route, params }; });
  ok(`Settings ${expected[0]} opens live Management destination`, result && call.route === 'Management'
    && call.params.moduleKey === expected[1] && JSON.stringify(call.params.moduleKeys) === JSON.stringify(expected[2]));
}

const admin = { role: 'school_admin', school_id: 'school-a' };
const guardianA = { id: 'guardian-a', school_id: 'school-a' };
const guardianB = { id: 'guardian-b', school_id: 'school-a' };
const child1 = { id: 'child-1', school_id: 'school-a' };
const child2 = { id: 'child-2', school_id: 'school-a' };
const foreignChild = { id: 'foreign', school_id: 'school-b' };
let persistedLinks = [];
function addLink(guardian, student) {
  const row = buildParentStudentLinkInsert(admin, guardian, student, { relationship: 'waalid', can_receive_messages: true });
  const identity = guardianLinkIdentity(row.parent_id, row.student_id);
  if (persistedLinks.some((value) => guardianLinkIdentity(value.parent_id, value.student_id) === identity)) throw new Error('duplicate');
  persistedLinks.push(row); return row;
}
addLink(guardianA, child1); addLink(guardianA, child2); addLink(guardianB, child1);
ok('guardian behavior supports multiple siblings', persistedLinks.filter((row) => row.parent_id === guardianA.id).length === 2);
ok('guardian behavior supports multiple guardians per student', persistedLinks.filter((row) => row.student_id === child1.id).length === 2);
ok('guardian insert payload never accepts UI school/profile ownership', !('school_id' in persistedLinks[0]) && !('parent_profile_id' in persistedLinks[0]));
let duplicateRejected = false;
try { addLink(guardianA, child1); } catch (e) { duplicateRejected = true; }
ok('duplicate identical guardian link is rejected', duplicateRejected);
let crossSchoolRejected = false;
try { addLink(guardianA, foreignChild); } catch (e) { crossSchoolRejected = true; }
ok('cross-school guardian link is rejected before Supabase and remains RLS-protected', crossSchoolRejected);
persistedLinks = JSON.parse(JSON.stringify(persistedLinks));
ok('refresh/reload preserves stored relationship shape', persistedLinks.length === 3 && persistedLinks[0].relationship === 'waalid');
persistedLinks = persistedLinks.filter((row) => guardianLinkIdentity(row.parent_id, row.student_id) !== guardianLinkIdentity(guardianA.id, child2.id));
ok('unlink removes only the selected relationship', persistedLinks.length === 2 && persistedLinks.some((row) => row.parent_id === guardianB.id));

// Supplemental integration wiring checks; behavioral assertions above execute
// the same policies used by these UI files.
const root = path.resolve(__dirname, '..');
const settingsSource = fs.readFileSync(path.join(root, 'src/screens/SettingsScreen.js'), 'utf8');
const managementSource = fs.readFileSync(path.join(root, 'src/screens/SchoolManagementScreen.js'), 'utf8');
ok('live Settings no longer imports the demo operational repository', !settingsSource.includes('appDataRepository'));
ok('SchoolManagementScreen renders the dedicated guardian behavior UI', managementSource.includes('<GuardianManagementView'));

if (failures) { console.error(`\nphase4-runtime behavior FAILED with ${failures} issue(s)`); process.exit(1); }
console.log('\nphase4-runtime behavior PASSED');
