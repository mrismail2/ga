/* ============================================================
   Kobciye Mobile — Roles & per-role access
   Ported from the web app's js/roles.js + js/data.js profiles.

   6 roles, each with its own dashboard, nav scope and data scope:
   Super Admin · School Admin · Teacher · Accountant · Parent · Student
   ============================================================ */

const { MANAGEMENT_ITEM, withManagementNavigation } = require('../domain/navigationPolicy');

export const ROLES = {
  superadmin: {
    key: 'superadmin', label: 'Super Admin', labelSo: 'Maamulaha Guud',
    name: 'Maxamed Cabdi', avatar: 'MC', sub: 'Kobciye Platform · Maamulka Guud',
    nav: ['dashboard', 'schoolonboarding', 'advisor', 'simulator', 'students', 'teachers', 'classes', 'attendance', 'finance', 'billing', 'exams', 'lessons', 'incidents', 'notice', 'reports', 'permissions', 'messages', 'settings'],
  },
  schooladmin: {
    key: 'schooladmin', label: 'School Admin', labelSo: 'Maamulaha Dugsiga',
    name: 'Faadumo Cali', avatar: 'FC', sub: 'Dugsiga Hidaayada · Gabiley',
    nav: withManagementNavigation('schooladmin', ['dashboard', 'advisor', 'simulator', 'students', 'teachers', 'classes', 'attendance', 'finance', 'billing', 'exams', 'lessons', 'incidents', 'notice', 'reports', 'permissions', 'messages', 'settings']),
  },
  teacher: {
    key: 'teacher', label: 'Teacher', labelSo: 'Macalin',
    name: 'Maxamuud Faraax', avatar: 'MF', sub: 'Xisaab & Sayniska · Dugsiga Hidaayada',
    profile_id: 'teacher_profile_001', teacher_id: 'teacher_001',
    school_id: 'school_001', scope: 'assigned',
    // CANONICAL access keys — class_id / subject_id (never class names)
    assigned_class_ids: ['school_001_class_form_1a', 'school_001_class_form_2a'],
    assigned_subject_ids: ['subject_xisaab', 'subject_sayniska'],
    // display-only label (NOT used for access control)
    assignedSubjectNames: ['Xisaab', 'Sayniska'],
    // permissions are granted by the School Admin (UI-preview Permissions screen).
    // Anything not listed shows a "School Admin permission required" locked state.
    permissions: [
      'attendance.view', 'attendance.mark',
      'results.view', 'results.create',
      'incidents.view', 'incidents.create',
      'messages.send', 'reports.view',
    ],
    // a teacher marks attendance INSIDE each class (ClassDetail · Xaadiris tab),
    // so the standalone 'attendance' sidebar item is admin-only — not in nav here.
    nav: ['dashboard', 'classes', 'exams', 'lessons', 'incidents', 'reports', 'messages', 'settings'],
  },
  accountant: {
    key: 'accountant', label: 'Accountant', labelSo: 'Xisaabiye',
    name: 'Cabdi Jaamac', avatar: 'CJ', sub: 'Maaliyadda · Dugsiga Hidaayada',
    school_id: 'school_001', scope: 'finance',
    nav: ['dashboard', 'finance', 'billing', 'reports', 'settings'],
  },
  parent: {
    key: 'parent', label: 'Parent', labelSo: 'Waalid',
    name: 'Cali Xuseen', avatar: 'CX', sub: 'Caruur: Ahmed, Zakariye',
    profile_id: 'parent_profile_001', parent_id: 'parent_001',
    school_id: 'school_001', scope: 'children',
    // ownership uses STABLE child_student_ids ONLY (resolved via identity.js)
    child_student_ids: ['student_002', 'student_003'],
    // display-only labels (NOT used for access control)
    childNames: ['Ahmed', 'Zakariye'],
    // a parent has NO direct teacher–student chat: 'messages' is not in nav.
    nav: ['dashboard', 'attendance', 'finance', 'exams', 'incidents', 'notice', 'settings'],
  },
  student: {
    key: 'student', label: 'Student', labelSo: 'Arday — Form 5A',
    name: 'Aaliyah Maxamed', avatar: 'AM', sub: 'Dugsiga Hidaayada',
    profile_id: 'student_profile_001',
    school_id: 'school_001', scope: 'self',
    // CANONICAL identity: internal id (relations) + visible student_id + class_id
    student_internal_id: 'student_001', student_id: 'HID-000142', class_id: 'school_001_class_form_5a',
    // display-only labels (NOT used for access control)
    studentName: 'Aaliyah', studentClass: 'Form 5A',
    // a student does NOT see the full Incidents module: 'incidents' is not in nav.
    nav: ['dashboard', 'attendance', 'finance', 'exams', 'notice', 'messages', 'settings'],
  },
};

/* superadmin & schooladmin see everything in scope; add school_id */
ROLES.superadmin.school_id = '*';
ROLES.superadmin.scope = 'platform';
ROLES.schooladmin.school_id = 'school_001';
ROLES.schooladmin.scope = 'school';

export const ROLE_ORDER = ['superadmin', 'schooladmin', 'teacher', 'accountant', 'parent', 'student'];

/* nav metadata: key -> [iconName, Somali label, route] */
export const NAV_META = {
  dashboard: ['dashboard', 'Dashboard', 'Dashboard'],
  schoolonboarding: ['building', 'Dugsiyada', 'SchoolOnboarding'],
  schools: ['building', 'Dugsiyada', 'Schools'],
  advisor: ['advisor', 'AI Advisor', 'Advisor'],
  simulator: ['advisor', 'Teacher Simulator', 'Simulator'],
  students: ['students', 'Ardayda', 'Ardayda'],
  teachers: ['teachers', 'Macalimiin', 'Teachers'],
  classes: ['classes', 'Fasallada', 'Fasallada'],
  attendance: ['attendance', 'Xaadirinta', 'Attendance'],
  finance: ['finance', 'Maaliyadda', 'Finance'],
  billing: ['billing', 'Biilasha', 'Billing'],
  exams: ['exams', 'Imtixaanada', 'Exams'],
  lessons: ['lessons', 'Casharrada', 'Lessons'],
  incidents: ['incidents', 'Kiisaska', 'Incidents'],
  notice: ['notice', 'Ogeysiisyada', 'Notices'],
  reports: ['reports', 'Warbixinno', 'Reports'],
  permissions: ['shield', 'Permissions', 'Permissions'],
  messages: ['messages', 'Fariimaha', 'Messages'],
  [MANAGEMENT_ITEM.key]: [MANAGEMENT_ITEM.icon, MANAGEMENT_ITEM.label, MANAGEMENT_ITEM.route],
  settings: ['settings', 'Goobaha', 'Settings'],
};
