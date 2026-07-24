/* ============================================================
   Kobciye Mobile — Mock data (frontend prototype only)
   Ported from the web app's js/data.js + js/app.js.
   No real credentials or private data.
   ============================================================ */

export const APP = {
  name: 'Kobciye',
  tagline: 'School Management SaaS',
  version: '1.0.0-prototype',
  currency: 'USD',
};

/* The platform's schools. `school_id` is the canonical isolation key used
   across every record (school_001, school_002, …). The legacy `id` is kept
   for the branch-switcher UI. Only the Super Admin sees more than one. */
export const SCHOOLS = [
  { id: 'hidaayada', school_id: 'school_001', code: 'KOB-SCH-001', name: 'Dugsiga Hidaayada', type: 'Primary School', city: 'Gabiley', students: 267, status: 'active' },
  { id: 'nuur', school_id: 'school_002', code: 'KOB-SCH-002', name: 'Dugsiga Nuur', type: 'Secondary School', city: 'Hargeysa', students: 412, status: 'active' },
  { id: 'iftiin', school_id: 'school_003', code: 'KOB-SCH-003', name: 'Dugsiga Iftiin', type: 'Primary School', city: 'Burco', students: 188, status: 'trial' },
];

/* Dashboard KPI snapshot (school-admin context) */
export const DASH_STATS = [
  { label: 'Tirada Ardayda', value: '267', tone: 'blue', delta: '+12' },
  { label: 'Macalimiin', value: '24', tone: 'gold', delta: '+2' },
  { label: 'Xaadiris Maanta', value: '94%', tone: 'green', delta: '+3%' },
  { label: 'Lacag La Uruuriyay', value: '$4,820', tone: 'navy', delta: '+8%' },
];

export const REVENUE_TREND = [2100, 2480, 2950, 3320, 3870, 4280];
export const REVENUE_LABELS = ['Jan', 'Feb', 'Mar', 'Abr', 'May', 'Juun'];

export const NOTIFICATIONS = [
  { icon: 'alert', color: '#E5484D', title: 'Kiis culus oo cusub', text: 'Cabdiraxmaan Y. — dagaal fasalka 5A', time: '10 daqiiqo' },
  { icon: 'cash', color: '#16A34A', title: 'Lacag la helay', text: 'Hodan Faarax — $25 (EVC Plus)', time: '45 daqiiqo' },
  { icon: 'msg', color: '#2F6BF0', title: 'Fariin cusub', text: "Macalin Saynab — su'aal jadwal", time: '1 saac' },
  { icon: 'exam', color: '#7C3AED', title: 'Natiijo la gudbiyay', text: 'Imtixaanka dhexe ee Xisaab', time: '2 saac' },
];

/* Classes: [name, grade, teacher, students, capacity, color, attendance%] */
export const CLASSES = [
  ['Form 1A', 'Dugsi Hoose', 'Macalin Axmed Cali', 45, 50, '#5B5BD6', 96],
  ['Form 2A', 'Dugsi Hoose', 'Macalin Sahra Nuur', 48, 50, '#16A34A', 92],
  ['Form 3A', 'Dugsi Dhexe', 'Macalin Faadumo Geele', 42, 48, '#CFAD5E', 88],
  ['Form 4A', 'Dugsi Dhexe', 'Macalin Cali Warsame', 50, 52, '#2F6BF0', 94],
  ['Form 5A', 'Dugsi Sare', 'Macalin Hodan Daahir', 38, 45, '#0891B2', 90],
  ['Form 6A', 'Dugsi Sare', 'Macalin Bile Jaamac', 44, 48, '#7C3AED', 86],
];

const M_NAMES = ['Cabdiraxmaan', 'Liibaan', 'Nuur', 'Yaasiin', 'Zakariye', 'Cali', 'Maxamed', 'Khaliil', 'Ismaaciil', 'Bashiir', 'Cumar', 'Daahir', 'Axmed', 'Guuleed', 'Saleebaan'];
const F_NAMES = ['Aaliyah', 'Hodan', 'Mariam', 'Saynab', 'Khadiija', 'Faadumo', 'Sahra', 'Ayaan', 'Naima', 'Ifrah', 'Suad', 'Hibo', 'Caasha', 'Deeqa', 'Ubax'];
const LAST = ['Maxamed', 'Yuusuf', 'Faarax', 'Cumar', 'Ibraahim', 'Daahir', 'Cabdi', 'Khaliil', 'Aadan', 'Cali', 'Warsame', 'Geele', 'Nuur', 'Jaamac', 'Diiriye'];

export const FEE_LABELS = {
  full: { tone: 'green', label: 'Bixiyay' },
  partial: { tone: 'gold', label: 'Qayb ahaan' },
  due: { tone: 'rose', label: 'Ma Bixin' },
  exempt: { tone: 'blue', label: 'Bilaash' },
};

const DISTRICTS = ['Xaafadda Sheekh Nuur', 'Xaafadda Koodbuur', 'Xaafadda Ceegaag', 'Xaafadda Horseed', 'Xaafadda Daami'];
const CITIES = ['Gabiley', 'Hargeysa', 'Burco', 'Berbera'];
const PREV_SCHOOLS = ['Dugsiga Iftiin', 'Dugsiga Nuur', 'Dugsiga Barwaaqo', 'Dugsiga Horseed', '—'];

/* Full deterministic detail for any student (DOB, contact, address, …).
   Used by the profile screen so every student has complete information. */
export function studentDetail(name, code, extra = {}) {
  const s = code.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const day = String(1 + (s % 27)).padStart(2, '0');
  const month = String(1 + (s % 12)).padStart(2, '0');
  const year = 2008 + (s % 6);
  return {
    name,
    code,
    gender: extra.gender || (s % 2 === 0 ? 'Wiil' : 'Gabar'),
    dob: `${day}/${month}/${year}`,
    age: 2026 - year,
    parent: extra.parent || `${LAST[s % LAST.length]} ${LAST[(s + 3) % LAST.length]}`,
    phone: extra.phone || '+252 63 ' + (4000000 + (s % 5999999)),
    email: extra.email || code.toLowerCase() + '@hidaayada.edu',
    city: extra.city || CITIES[s % CITIES.length],
    address: extra.address || DISTRICTS[s % DISTRICTS.length],
    prevSchool: extra.prevSchool || PREV_SCHOOLS[s % PREV_SCHOOLS.length],
    enrolled: `${2020 + (s % 5)}`,
    fee: extra.fee || 'full',
    att: extra.att != null ? extra.att : 78 + (s % 22),
    bus: s % 3 === 0 ? 'Haa' : 'Maya',
    notes: 'Arday firfircoon. Wax akhriska iyo ka-qaybgalka fasalka way fiican yihiin.',
    // secondary-school intake (Form 1 from primary) — empty for normal students
    entry: extra.entry || 'normal',
    examResult: extra.examResult || '',
    examYear: extra.examYear || '',
    certNo: extra.certNo || '',
  };
}

/* GLOBALLY-UNIQUE class_id from a class name + school.
   "Form 5A" @ school_001 -> "school_001_class_form_5a".

   Two schools can both have a "Form 1A", so the class_id MUST embed the
   school. This is the single source of truth for class identity (shared via
   identity.js). The function is:
     • tuple-aware  — classId(tuple) reads school_id from tuple[7]
     • idempotent   — classId("school_001_class_form_5a") returns it unchanged
     • school-keyed — classId("Form 5A", "school_002") prefixes school_002
   `name` / className is display-only and never used as a relationship key. */
export function classId(nameOrCls, schoolId) {
  // tuple form: [name, …, school_id?] — read the school from index 7
  if (Array.isArray(nameOrCls)) {
    const sid = nameOrCls[7] || schoolId || 'school_001';
    return classId(nameOrCls[0], sid);
  }
  const raw = String(nameOrCls || '');
  // already a global class_id ("school_xxx_class_…") — return unchanged
  if (/^school_[a-z0-9]+_class_/i.test(raw)) return raw;
  const sid = schoolId || 'school_001';
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${sid}_class_${slug}`;
}

/* the bare class slug WITHOUT the school prefix (for legacy comparisons only) */
export function bareClassSlug(globalOrName) {
  const raw = String(globalOrName || '');
  const m = raw.match(/_class_(.+)$/);
  if (m) return 'class_' + m[1];
  return 'class_' + raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/* The canonical student records for the demo's Parent/Student relations.
   These carry the stable `student_internal_id` + visible `student_id` and are
   merged into their class roster so a teacher marks them and the saved
   attendance flows back to the Parent/Student by student_internal_id. */
export const REGISTRY_STUDENTS = [
  { student_internal_id: 'student_001', student_id: 'HID-000142', school_id: 'school_001', class_id: 'school_001_class_form_5a', full_name: 'Aaliyah Maxamed Cali', fee: 'full', att: 92, gender: 'Gabar', status: 'active', photo_uri: null },
  { student_internal_id: 'student_002', student_id: 'HID-000150', school_id: 'school_001', class_id: 'school_001_class_form_4a', full_name: 'Ahmed Cali Xuseen', fee: 'full', att: 96, gender: 'Wiil', status: 'active', photo_uri: null },
  { student_internal_id: 'student_003', student_id: 'HID-000151', school_id: 'school_001', class_id: 'school_001_class_form_5a', full_name: 'Zakariye Cali Xuseen', fee: 'due', att: 88, gender: 'Wiil', status: 'active', photo_uri: null },
];

/* shape a registry record into a roster row (relation key = student_internal_id) */
function registryToRosterRow(r) {
  return {
    name: r.full_name, student_internal_id: r.student_internal_id, student_id: r.student_id,
    class_id: r.class_id, school_id: r.school_id, gender: r.gender, parent: 'Cali Xuseen', fee: r.fee, att: r.att,
  };
}

/* Deterministic roster generator (mirrors web app's rosterFor).
   Every student carries school_id + class_id + a stable student_internal_id
   (+ a visible student_id). Registry students for the class are merged in so
   relations (attendance/payments/incidents) work by student_internal_id. */
export function rosterFor(cls, schoolId = 'school_001') {
  const [name, , , students] = cls;
  const cid = classId(name, cls[7] || schoolId);
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = Math.max(8, Math.min(students || 12, 14));
  const fees = ['full', 'full', 'partial', 'due', 'full', 'partial'];
  // registry students that belong to THIS class + school come first
  const registry = REGISTRY_STUDENTS.filter((r) => r.class_id === cid && r.school_id === schoolId).map(registryToRosterRow);
  const taken = new Set(registry.map((r) => r.student_internal_id));
  const out = [...registry];
  const slug = cid.replace(/^school_[a-z0-9]+_class_/, '');
  for (let i = 0; i < n && out.length < n; i++) {
    const isM = (seed + i) % 2 === 0;
    const first = isM ? M_NAMES[(seed + i) % M_NAMES.length] : F_NAMES[(seed + i * 3) % F_NAMES.length];
    const mid = LAST[(seed + i * 2) % LAST.length];
    const last = LAST[(seed + i * 5 + 3) % LAST.length];
    const full = `${first} ${mid} ${last}`;
    // neutral, deterministic INTERNAL id (never shown). student_id is assigned
    // by the seed from the school prefix — no KOB-STU, no code field.
    const internalId = `gen_${schoolId}_${slug}_${i}`;
    if (taken.has(internalId)) continue;
    const gender = isM ? 'Wiil' : 'Gabar';
    const parent = `${LAST[(seed + i) % LAST.length]} ${LAST[(seed + i * 4) % LAST.length]}`;
    const fee = fees[(seed + i) % fees.length];
    const att = 78 + ((seed + i * 7) % 22);
    out.push({
      name: full, gender, parent, fee, att, school_id: schoolId, class_id: cid,
      student_internal_id: internalId, photo_uri: null,
    });
  }
  return out;
}

/* A second school's classes (school_002 — Dugsiga Nuur). Used to prove the
   isolation rule: a school_001 user must never see these records. */
export const SCHOOL2_CLASSES = [
  ['Grade 1B', 'Dugsi Hoose', 'Macalin Cumar Faarax', 40, 45, '#2F6BF0', 93, 'school_002'],
  ['Grade 2B', 'Dugsi Dhexe', 'Macalin Naima Cali', 38, 44, '#16A34A', 90, 'school_002'],
];

/* find a class tuple by school_id + class_id (multi-school safe) */
export function classTupleByClassId(schoolId, cid) {
  const pool = schoolId === 'school_002' ? SCHOOL2_CLASSES : CLASSES;
  return pool.find((c) => classId(c, schoolId) === cid && (c[7] || 'school_001') === schoolId) || null;
}

/* the generated roster for a class identified by school_id + class_id —
   NEVER defaults to school_001 and never keys off the class display name. */
export function rosterByClassId(schoolId, cid) {
  const tuple = classTupleByClassId(schoolId, cid);
  return tuple ? rosterFor(tuple, schoolId).map((s) => ({ ...s, className: tuple[0] })) : [];
}

/* Flatten all students for a given school (school_001 by default). */
export function studentsForSchool(schoolId = 'school_001') {
  const classes = schoolId === 'school_002' ? SCHOOL2_CLASSES : CLASSES;
  const out = [];
  classes.forEach((cls) => {
    rosterFor(cls, schoolId).forEach((s) => out.push({ ...s, className: cls[0] }));
  });
  return out;
}

/* Every student across every school — only the Super Admin sees this whole set. */
export function allStudentsAllSchools() {
  return [...studentsForSchool('school_001'), ...studentsForSchool('school_002')];
}

/* Deterministic daily attendance history for a student (read-only views).
   Returns the last `days` school days (Friday is the weekend, skipped),
   each { date, dayLabel, weekday, status } where status is one of
   present | late | excused | absent. The mix follows the att% so a
   high-attendance student is mostly present. Used by Parent / Student. */
const WEEKDAYS_SO = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
const MONTHS_SO = ['Jan', 'Feb', 'Mar', 'Abr', 'May', 'Juun', 'Lul', 'Agos', 'Sebt', 'Okt', 'Nof', 'Dis'];
export function attendanceHistory(code, attPct = 90, days = 12) {
  const seed = String(code).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const out = [];
  const d = new Date(2026, 5, 22); // today (deterministic for the prototype)
  let i = 0;
  // how many of the recent days are NOT a plain "present" — scales with att%
  // so even a strong student shows a couple of late/excused/absent marks.
  const offDays = Math.max(2, Math.round((100 - attPct) / 8) + 2);
  while (out.length < days) {
    const cur = new Date(d.getTime() - i * 86400000);
    i++;
    if (cur.getDay() === 5) continue; // skip Jimce (Friday weekend)
    const idx = out.length;
    // spread the off-days across the window deterministically
    const isOff = (idx * 31 + seed) % days < offDays && idx !== 0;
    let status = 'present';
    if (isOff) {
      const k = (seed + idx * 7) % 3;
      status = k === 0 ? 'absent' : k === 1 ? 'late' : 'excused';
    }
    out.push({
      date: `${String(cur.getDate()).padStart(2, '0')} ${MONTHS_SO[cur.getMonth()]}`,
      weekday: WEEKDAYS_SO[cur.getDay()],
      status,
    });
  }
  return out;
}
