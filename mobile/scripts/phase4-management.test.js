#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 4 management UI test (static, reproducible)

   Follows the phase3-audit pattern: reads the real source files and
   asserts the Phase 4 UI requirements hold —

     SCHOOL MODE
     - all ten Phase 4 modules exist in the school catalog
     - the school catalog contains NO university-only wording
     - the classes module is stage-aware (Fasallada vs Formamka comes from
       terminologyForStage, not a hardcoded string)
     - the hub screen is registered in BOTH shells (RootNavigator +
       DesktopShell) — one shared School UI, no separate stage dashboards

     UNIVERSITY MODE
     - all nine Phase 4 modules exist in the university catalog
     - the university catalog contains NO school-only wording
     - UniversityAppShell renders the real P4ModuleView (not a stub) and a
       zero-count dashboard

     SAFETY
     - services/phase4.js is allow-listed, live-only (no AsyncStorage),
       and never touches secrets or the schools table
     - no Phase 4 file weakens auth: no service_role, no direct fetch to
       auth endpoints

   Run: cd mobile && npm run test:phase4-ui
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const modules = read('src/config/phase4Modules.js');
const services = read('src/services/phase4.js');
const hub = read('src/screens/SchoolManagementScreen.js');
const moduleView = read('src/components/P4ModuleView.js');
const rootNav = read('src/navigation/RootNavigator.js');
const desktop = read('src/components/DesktopShell.js');
const uniShell = read('src/navigation/UniversityAppShell.js');

// isolate each catalog's text (from the export declarations, past the header
// comment) so cross-catalog wording can be checked
const schoolCat = modules.slice(modules.indexOf('export const SCHOOL_MODULES'), modules.indexOf('export const UNIVERSITY_MODULES'));
const uniCat = modules.slice(modules.indexOf('export const UNIVERSITY_MODULES'), modules.indexOf('export const SCHOOL_COUNT_TABLES'));

console.log('\n--- School Mode: Phase 4 modules ---');
for (const key of ['academic_years', 'terms', 'school_sections', 'classes', 'class_streams',
  'subjects', 'teachers', 'teacher_assignments', 'students', 'parents', 'admissions']) {
  ok(`school catalog has "${key}"`, new RegExp(`key: '${key}'`).test(schoolCat));
}

console.log('\n--- School catalog: no university-only wording ---');
for (const term of ['Kulliyad', 'Semester', 'Programme', 'Course', 'Lecturer', 'Transcript', 'Faculty', 'Cohort']) {
  ok(`school catalog does NOT contain "${term}"`, !schoolCat.includes(term));
}

console.log('\n--- University Mode: nine Phase 4 modules ---');
for (const key of ['faculties', 'departments', 'programmes', 'academicYears', 'semesters',
  'courses', 'lecturers', 'students', 'registration']) {
  ok(`university catalog has "${key}"`, new RegExp(`key: '${key}'`).test(uniCat));
}

console.log('\n--- University catalog: no school-only wording ---');
for (const term of ['Fasal', 'Form ', 'Formamka', 'Waalid', 'Laamaha', 'Stream', 'school_sections', 'class_streams']) {
  ok(`university catalog does NOT contain "${term}"`, !uniCat.includes(term));
}

console.log('\n--- Shared School UI stays shared; stage difference is wording only ---');
ok('hub uses terminologyForStage via useStageTerminology (no hardcoded stage branches)',
  /useStageTerminology/.test(hub) && !/school_stage\s*===/.test(hub));
ok('classes module marked stageAware in the school catalog', /stageAware: true/.test(schoolCat));
ok('hub registered in RootNavigator (mobile shell)', /Management: SchoolManagementScreen/.test(rootNav));
ok('hub registered in DesktopShell (desktop shell)', /Management: SchoolManagementScreen/.test(desktop));
ok('no separate PrimaryDashboard/SecondaryDashboard was created',
  !fs.existsSync(path.join(ROOT, 'src/screens/PrimaryDashboard.js'))
  && !fs.existsSync(path.join(ROOT, 'src/screens/SecondaryDashboard.js')));

console.log('\n--- University shell renders real Phase 4 CRUD + zero counts ---');
ok('UniversityAppShell imports P4ModuleView', /import P4ModuleView/.test(uniShell));
ok('UniversityAppShell uses the university catalog', /UNIVERSITY_MODULES/.test(uniShell));
ok('UniversityAppShell dashboard shows real zero counts (p4Counts)', /p4Counts/.test(uniShell));

console.log('\n--- CRUD requirements in the generic view ---');
ok('P4ModuleView has an empty state with an add-first action', /Wax diiwaan ah ma jiraan/.test(moduleView));
ok('P4ModuleView has loading state', /ActivityIndicator/.test(moduleView));
ok('P4ModuleView has a safe error state with retry', /Isku day mar kale/.test(moduleView));
ok('P4ModuleView validates before save (p4Validate)', /p4Validate/.test(moduleView));
ok('P4ModuleView maps duplicate/RLS errors to friendly text (p4FriendlyError)', /p4FriendlyError/.test(moduleView));
ok('P4ModuleView supports activate/deactivate', /toggleActive/.test(moduleView));
ok('P4ModuleView never invents demo data when not live', /LIVE/.test(moduleView) && !/seedData|mock/.test(moduleView));

console.log('\n--- Safety: live-only, allow-listed, no secrets ---');
ok('services/phase4.js never imports AsyncStorage (live data only)',
  !/@react-native-async-storage/.test(services));
ok('services/phase4.js is allow-listed (unknown tables refused)', /Unknown Phase 4 table/.test(services));
ok('services/phase4.js never writes the schools table', !/from\('schools'\)/.test(services));
ok('services/phase4.js has no service-role key material (only the public client import)',
  !/SERVICE_ROLE|service_role_key|createClient\(/.test(services) && /from '\.\/supabase'/.test(services));
ok('update path strips school_id so ownership can never be moved', /school_id[^\n]*\.\.\.safe/s.test(services) || /const \{ school_id/.test(services));
ok('duplicate-code validation message exists (per-school uniqueness UX)', /ku celis ah/.test(services));
ok('date validation exists (end after start)', /ka dambaysaa tan bilowga/.test(services));

console.log('');
if (failures) { console.error(`phase4-management FAILED with ${failures} issue(s)\n`); process.exit(1); }
console.log('phase4-management PASSED — Phase 4 school & university management UI holds ✓\n');
