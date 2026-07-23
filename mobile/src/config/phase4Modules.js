/* ============================================================
   Kobciye — Phase 4 module catalogs (School Mode + University Mode)

   Each module drives the generic P4ModuleScreen: which table it manages,
   which fields its form shows, and how a row is rendered in the list.
   Somali labels throughout. Wording isolation is structural:

     - SCHOOL_MODULES never contains a university-only term
       (Kulliyad / Semester / Programme / Course / Lecturer / Transcript).
     - UNIVERSITY_MODULES never contains a school-only term
       (Fasal / Form / Waalid / Ardayda dugsiga / Stream).

   The classes module label is stage-aware: Fasallada (primary/middle) vs
   Formamka (secondary) — resolved by the hub screen via
   terminologyForStage(), the same single source Phase 3 introduced.
   ============================================================ */

const ACTIVE = { key: 'is_active', kind: 'boolean' };
const STATUS = { key: 'status', kind: 'record_status' }; // 'active' | 'archived'

/* field: { key, label, required?, placeholder?, date?, number?, phone?,
            upper?, options? [{value,label}], fk? { table, labelKey } } */

export const SCHOOL_MODULES = [
  {
    key: 'academic_years', table: 'academic_years', icon: 'clock',
    title: 'Sannad-dugsiyeedka', single: 'Sannad-dugsiyeed',
    active: STATUS,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: 2026/2027' },
      { key: 'starts_on', label: 'BILOW (YYYY-MM-DD)', date: true, placeholder: '2026-09-01' },
      { key: 'ends_on', label: 'DHAMMAAD (YYYY-MM-DD)', date: true, placeholder: '2027-06-30' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => [r.starts_on, r.ends_on].filter(Boolean).join(' → ') || 'Taariikho la\'aan',
  },
  {
    key: 'terms', table: 'terms', icon: 'pin',
    title: 'Xilliyada (Terms)', single: 'Xilli',
    active: STATUS,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Term 1' },
      { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', fk: { table: 'academic_years', labelKey: 'name' } },
      { key: 'starts_on', label: 'BILOW (YYYY-MM-DD)', date: true, placeholder: '2026-09-01' },
      { key: 'ends_on', label: 'DHAMMAAD (YYYY-MM-DD)', date: true, placeholder: '2026-12-15' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => [r.starts_on, r.ends_on].filter(Boolean).join(' → ') || '—',
  },
  {
    key: 'school_sections', table: 'school_sections', icon: 'building',
    title: 'Qaybaha Dugsiga (Levels)', single: 'Qayb',
    active: ACTIVE,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Dugsiga Hoose' },
      { key: 'level_type', label: 'HEERKA', required: true, options: [
        { value: 'primary', label: 'Hoose (Primary)' },
        { value: 'middle', label: 'Dhexe (Middle)' },
        { value: 'secondary', label: 'Sare (Secondary)' },
      ] },
      { key: 'description', label: 'FAAHFAAHIN', placeholder: 'ikhtiyaari' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => ({ primary: 'Hoose', middle: 'Dhexe', secondary: 'Sare' }[r.level_type] || r.level_type),
  },
  {
    key: 'classes', table: 'classes', icon: 'classes',
    title: 'Fasallada', single: 'Fasal', stageAware: true,
    stageTitleKey: 'classLabelPlural', stageSingleKey: 'classLabel',
    active: STATUS,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Fasalka 1', stagePlaceholderKey: 'classPlaceholder' },
      { key: 'code', label: 'KOODHKA', upper: true, placeholder: 'tusaale: G1', stagePlaceholderKey: 'classCodePlaceholder' },
      { key: 'school_section_id', label: 'QAYBTA DUGSIGA', fk: { table: 'school_sections', labelKey: 'name' } },
      { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', fk: { table: 'academic_years', labelKey: 'name' } },
      { key: 'display_order', label: 'KALA HORREYNTA', number: true, placeholder: '1' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.code || '—',
  },
  {
    key: 'class_streams', table: 'class_streams', icon: 'more',
    title: 'Qaybaha Fasalka', single: 'Qayb',
    stageTitleKey: 'streamLabelPlural', stageSingleKey: 'streamLabel',
    active: ACTIVE,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Qayb A', stagePlaceholderKey: 'streamPlaceholder' },
      { key: 'class_id', label: 'FASALKA', stageLabelKey: 'classFieldLabel', required: true, fk: { table: 'classes', labelKey: 'name' } },
      { key: 'code', label: 'KOODHKA', upper: true, placeholder: 'tusaale: G1A', stagePlaceholderKey: 'streamCodePlaceholder' },
      { key: 'capacity', label: 'QADKA ARDAYDA', number: true, placeholder: '40' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.code || '—',
  },
  {
    key: 'subjects', table: 'subjects', icon: 'lessons',
    title: 'Maadooyinka', single: 'Maado',
    active: ACTIVE,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Xisaab' },
      { key: 'code', label: 'KOODHKA', upper: true, placeholder: 'tusaale: MATH (gaar)' },
      { key: 'school_section_id', label: 'QAYBTA DUGSIGA', fk: { table: 'school_sections', labelKey: 'name' } },
      { key: 'class_id', label: 'FASALKA', stageLabelKey: 'classFieldLabel', fk: { table: 'classes', labelKey: 'name' } },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.code || '—',
  },
  {
    key: 'teachers', table: 'teachers', icon: 'teachers',
    title: 'Macallimiinta', single: 'Macallin',
    active: STATUS,
    fields: [
      { key: 'full_name', label: 'MAGACA OO DHAMMEYSTIRAN', required: true, placeholder: 'Magaca macallinka' },
      { key: 'email', label: 'EMAIL (casuumaad mustaqbal)', placeholder: 'tusaale: macallin@dugsi.edu' },
      { key: 'phone', label: 'TELEFOON', phone: true, placeholder: '+252 …' },
    ],
    listTitle: (r) => r.full_name,
    listSub: (r) => r.email || r.phone || '—',
  },
  {
    key: 'teacher_assignments', table: 'teacher_assignments', icon: 'teachers',
    title: 'Qoondaynta Macallimiinta', single: 'Qoondayn', active: ACTIVE,
    fields: [
      { key: 'teacher_id', label: 'MACALLINKA', required: true, fk: { table: 'teachers', labelKey: 'full_name' } },
      { key: 'subject_id', label: 'MAADADA', required: true, fk: { table: 'subjects', labelKey: 'name' } },
      { key: 'class_id', label: 'FASALKA', stageLabelKey: 'classFieldLabel', required: true, fk: { table: 'classes', labelKey: 'name' } },
      { key: 'stream_id', label: 'QAYBTA FASALKA', stageLabelKey: 'streamFieldLabel', fk: { table: 'class_streams', labelKey: 'name' } },
      { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', required: true, fk: { table: 'academic_years', labelKey: 'name' } },
      { key: 'term_id', label: 'XILLIGA (TERM)', fk: { table: 'terms', labelKey: 'name' } },
    ],
    listTitle: () => 'Qoondayn Macallin',
    listSub: (r) => [r.teacher_id, r.subject_id, r.class_id].filter(Boolean).join(' · '),
  },
  {
    key: 'students', table: 'students', icon: 'students',
    title: 'Ardayda', single: 'Arday',
    fields: [
      { key: 'full_name', label: 'MAGACA OO DHAMMEYSTIRAN', required: true, placeholder: 'Magaca ardayga' },
      { key: 'admission_number', label: 'LAMBARKA DIIWAANGELINTA', placeholder: 'tusaale: ADM-001 (gaar)' },
      { key: 'gender', label: 'JINSIGA', options: [
        { value: 'male', label: 'Lab' }, { value: 'female', label: 'Dhedig' },
      ] },
      { key: 'date_of_birth', label: 'TAARIIKHDA DHALASHADA (YYYY-MM-DD)', date: true, placeholder: '2015-01-01' },
      { key: 'class_id', label: 'FASALKA', stageLabelKey: 'classFieldLabel', fk: { table: 'classes', labelKey: 'name' } },
      { key: 'stream_id', label: 'QAYBTA FASALKA', stageLabelKey: 'streamFieldLabel', fk: { table: 'class_streams', labelKey: 'name' } },
      { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', fk: { table: 'academic_years', labelKey: 'name' } },
    ],
    listTitle: (r) => r.full_name,
    listSub: (r) => [r.student_id, r.admission_number].filter(Boolean).join(' · ') || '—',
  },
  {
    key: 'parents', table: 'parents', icon: 'profile',
    title: 'Waalidiinta / Mas\'uuliyiinta', single: 'Waalid',
    active: STATUS,
    fields: [
      { key: 'full_name', label: 'MAGACA OO DHAMMEYSTIRAN', required: true, placeholder: 'Magaca waalidka' },
      { key: 'phone', label: 'TELEFOON', required: true, phone: true, placeholder: '+252 …' },
      { key: 'email', label: 'EMAIL (ikhtiyaari)', placeholder: 'waalid@email.com' },
    ],
    listTitle: (r) => r.full_name,
    listSub: (r) => r.phone || '—',
  },
  {
    key: 'admissions', table: 'admissions', icon: 'mail',
    title: 'Diiwaangelinta (Admissions)', single: 'Codsi',
    // saving with status 'enrolled' runs the atomic admission (student +
    // enrollment + admission + parent + guardian link in ONE transaction)
    enrollAtomic: true,
    fields: [
      { key: 'applicant_name', label: 'MAGACA CODSADAHA', required: true, placeholder: 'Magaca ardayga cusub' },
      { key: 'desired_class_id', label: 'FASALKA', stageLabelKey: 'classFieldLabel', fk: { table: 'classes', labelKey: 'name' } },
      // guardian linking (Phase 1–4 foundation): pick an existing same-school
      // guardian OR enter a new one below — `virtual` fields feed the atomic
      // admission RPC and are never written to the admissions table itself
      { key: 'parent_id', label: 'WAALID JIRA (XULO HADDII UU JIRO)', virtual: true, fk: { table: 'parents', labelKey: 'full_name' } },
      { key: 'guardian_name', label: 'MAGACA WAALIDKA (CUSUB)', placeholder: 'ikhtiyaari' },
      { key: 'guardian_phone', label: 'TELEFOONKA WAALIDKA', phone: true, placeholder: '+252 …' },
      { key: 'guardian_email', label: 'EMAIL WAALIDKA (IKHTIYAARI)', virtual: true, placeholder: 'waalid@email.com' },
      { key: 'relationship', label: 'XIRIIRKA ARDAYGA', virtual: true, options: [
        { value: 'father', label: 'Aabbe' },
        { value: 'mother', label: 'Hooyo' },
        { value: 'guardian', label: 'Mas\'uul' },
        { value: 'other', label: 'Kale' },
      ] },
      { key: 'status', label: 'XAALADDA', options: [
        { value: 'draft', label: 'Qabyo (Draft)' },
        { value: 'pending', label: 'Sugaya' },
        { value: 'accepted', label: 'La aqbalay' },
        { value: 'rejected', label: 'La diiday' },
        { value: 'enrolled', label: 'La diiwaangeliyay' },
      ] },
    ],
    listTitle: (r) => r.applicant_name,
    listSub: (r) => r.status,
  },
];

export const UNIVERSITY_MODULES = [
  {
    key: 'faculties', table: 'faculties', icon: 'building',
    title: 'Kulliyadaha', single: 'Kulliyad',
    active: ACTIVE,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Kulliyadda Caafimaadka' },
      { key: 'code', label: 'KOODHKA', upper: true, placeholder: 'tusaale: MED (gaar)' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.code || '—',
  },
  {
    key: 'departments', table: 'departments', icon: 'classes',
    title: 'Departments', single: 'Department',
    active: ACTIVE,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Public Health' },
      { key: 'faculty_id', label: 'KULLIYADDA', fk: { table: 'faculties', labelKey: 'name' } },
      { key: 'code', label: 'KOODHKA', upper: true, placeholder: 'tusaale: PH' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.code || '—',
  },
  {
    key: 'programmes', table: 'programmes', icon: 'note',
    title: 'Programmes', single: 'Programme',
    active: ACTIVE,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: BSc Public Health' },
      { key: 'department_id', label: 'DEPARTMENT', fk: { table: 'departments', labelKey: 'name' } },
      { key: 'code', label: 'KOODHKA', upper: true, placeholder: 'tusaale: BPH' },
      { key: 'degree_level', label: 'HEERKA SHAHAADADA', required: true, options: [
        { value: 'certificate', label: 'Certificate' },
        { value: 'diploma', label: 'Diploma' },
        { value: 'bachelor', label: 'Bachelor' },
        { value: 'master', label: 'Master' },
        { value: 'phd', label: 'PhD' },
      ] },
      { key: 'duration_years', label: 'MUDDADA (SANNADO)', number: true, placeholder: '4' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.degree_level,
  },
  {
    key: 'academicYears', table: 'academic_years', icon: 'clock',
    title: 'Academic Years', single: 'Academic Year',
    active: STATUS,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: 2026/2027' },
      { key: 'starts_on', label: 'BILOW (YYYY-MM-DD)', date: true, placeholder: '2026-09-01' },
      { key: 'ends_on', label: 'DHAMMAAD (YYYY-MM-DD)', date: true, placeholder: '2027-08-31' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => [r.starts_on, r.ends_on].filter(Boolean).join(' → ') || '—',
  },
  {
    key: 'semesters', table: 'semesters', icon: 'pin',
    title: 'Semesters', single: 'Semester',
    active: STATUS,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Semester 1' },
      { key: 'academic_year_id', label: 'ACADEMIC YEAR', required: true, fk: { table: 'academic_years', labelKey: 'name' } },
      { key: 'starts_on', label: 'BILOW (YYYY-MM-DD)', date: true, placeholder: '2026-09-01' },
      { key: 'ends_on', label: 'DHAMMAAD (YYYY-MM-DD)', date: true, placeholder: '2027-01-15' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => [r.starts_on, r.ends_on].filter(Boolean).join(' → ') || '—',
  },
  {
    key: 'courses', table: 'courses', icon: 'lessons',
    title: 'Courses', single: 'Course',
    active: ACTIVE,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Intro to Epidemiology' },
      { key: 'code', label: 'KOODHKA', upper: true, placeholder: 'tusaale: PH101 (gaar)' },
      { key: 'programme_id', label: 'PROGRAMME', fk: { table: 'programmes', labelKey: 'name' } },
      { key: 'department_id', label: 'DEPARTMENT', fk: { table: 'departments', labelKey: 'name' } },
      { key: 'credit_hours', label: 'CREDIT HOURS', number: true, placeholder: '3' },
      { key: 'level_year', label: 'SANNADKA (LEVEL)', number: true, placeholder: '1' },
      { key: 'semester_number', label: 'SEMESTER #', number: true, placeholder: '1' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.code || '—',
  },
  {
    key: 'lecturers', table: 'lecturers', icon: 'teachers',
    title: 'Lecturers', single: 'Lecturer',
    active: STATUS,
    fields: [
      { key: 'full_name', label: 'MAGACA OO DHAMMEYSTIRAN', required: true, placeholder: 'Dr. …' },
      { key: 'email', label: 'EMAIL', placeholder: 'lecturer@uni.edu' },
      { key: 'phone', label: 'TELEFOON', phone: true, placeholder: '+252 …' },
      { key: 'department_id', label: 'DEPARTMENT', fk: { table: 'departments', labelKey: 'name' } },
    ],
    listTitle: (r) => r.full_name,
    listSub: (r) => r.email || '—',
  },
  {
    key: 'students', table: 'university_students', icon: 'students',
    title: 'Students', single: 'Student',
    fields: [
      { key: 'full_name', label: 'MAGACA OO DHAMMEYSTIRAN', required: true, placeholder: 'Magaca ardayga' },
      { key: 'student_code', label: 'KOODHKA ARDAYGA', upper: true, placeholder: 'tusaale: STU-001 (gaar)' },
      { key: 'admission_number', label: 'LAMBARKA DIIWAANGELINTA', placeholder: 'tusaale: UADM-1 (gaar)' },
      { key: 'gender', label: 'JINSIGA', options: [
        { value: 'male', label: 'Lab' }, { value: 'female', label: 'Dhedig' },
      ] },
      { key: 'date_of_birth', label: 'TAARIIKHDA DHALASHADA (YYYY-MM-DD)', date: true, placeholder: '2004-01-01' },
      { key: 'programme_id', label: 'PROGRAMME', fk: { table: 'programmes', labelKey: 'name' } },
      { key: 'cohort', label: 'COHORT', placeholder: 'tusaale: 2026' },
      { key: 'level_year', label: 'SANNADKA (LEVEL)', number: true, placeholder: '1' },
    ],
    listTitle: (r) => r.full_name,
    listSub: (r) => [r.student_code, r.cohort].filter(Boolean).join(' · ') || '—',
  },
  {
    key: 'registration', table: 'admissions', icon: 'mail',
    title: 'Registration / Admissions', single: 'Application',
    fields: [
      { key: 'applicant_name', label: 'MAGACA CODSADAHA', required: true, placeholder: 'Magaca ardayga cusub' },
      { key: 'guardian_phone', label: 'TELEFOONKA XIRIIRKA', phone: true, placeholder: '+252 …' },
      { key: 'status', label: 'XAALADDA', options: [
        { value: 'draft', label: 'Draft' },
        { value: 'pending', label: 'Pending' },
        { value: 'accepted', label: 'Accepted' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'enrolled', label: 'Enrolled' },
      ] },
    ],
    listTitle: (r) => r.applicant_name,
    listSub: (r) => r.status,
  },
];

/* dashboard zero-count tiles */
export const SCHOOL_COUNT_TABLES = ['students', 'classes', 'teachers', 'subjects'];
export const UNIVERSITY_COUNT_TABLES = ['university_students', 'faculties', 'programmes', 'courses'];
