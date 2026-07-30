/* ============================================================
   Kobciye Mobile — Shared datasets ported from the web app.
   Teachers, payments, incidents, exams, lessons, messages,
   notices, and the platform / finance snapshots used by the
   role dashboards.
   ============================================================ */

/* ---- Platform (Super Admin) ---- */
export const PLATFORM = {
  totalSchools: 42,
  activeSchools: 35,
  pendingRequests: 5,
  suspendedSchools: 2,
  monthlyRevenue: 4280,
  activeSubscriptions: 35,
  revenueTrend: [2100, 2480, 2950, 3320, 3870, 4280],
  revenueLabels: ['Jan', 'Feb', 'Mar', 'Abr', 'May', 'Juun'],
  planSplit: { Free: 7, Basic: 18, Pro: 13, Enterprise: 4 },
  recentActivity: [
    ['Dugsiga Hidaayada', 'Cusbooneysiiyay qorshaha Pro', '10 daqiiqo'],
    ['Dugsiga Nuur', 'Codsi cusub oo diiwaangelin ah', '1 saac'],
    ['Dugsiga Iftiin', 'Lacag-bixin la xaqiijiyay', '3 saac'],
    ['Dugsiga Barwaaqo', 'La hakiyay — lacag dib u dhac', 'Shalay'],
  ],
};

/* ---- Finance (Accountant / School Admin) ---- */
export const FINANCE = {
  expected: 6675,
  collected: 4820,
  remaining: 1855,
  methods: { 'EVC Plus': 2400, Zaad: 1520, Cash: 900 },
};

/* ---- Teachers: [name, subject, classes, experience(yrs), color] ---- */
export const TEACHERS = [
  ['Maxamuud Faraax', 'Xisaab & Sayniska', '5A, 6B', '12', '#5B5BD6'],
  ['Saynab Khaliif', 'Af-Soomaali', '7A', '9', '#16A34A'],
  ['Cabdullahi Nuur', 'Ingiriis', '5A, 7A', '11', '#CFAD5E'],
  ['Khadiija Warsame', 'Cilmiga Diinta', 'Dhammaan', '14', '#2F6BF0'],
  ['Yuusuf Geedi', 'Juqraafi & Taariikh', '6B', '8', '#0891B2'],
  ['Faadumo Aadan', 'Farshaxan & Riyaada', 'Dhammaan', '10', '#7C3AED'],
];

/* ---- Payments: [student, class, amount, method, date, status] ---- */
/* Payments: [name, class, amount, method, date, status, student_id, school_id].
   student_id links a record to the student so Parent/Student see only their
   own; school_id isolates by school. */
export const PAYMENTS = [
  ['Aaliyah Maxamed Cali', '5A', '$25', 'EVC Plus', '22 Abriil', 'paid', null, 'school_001', 'student_001'],
  ['Ahmed Cali Xuseen', '4A', '$25', 'EVC Plus', '21 Abriil', 'paid', null, 'school_001', 'student_002'],
  ['Zakariye Cali Xuseen', '5A', '$25', '—', '—', 'due', null, 'school_001', 'student_003'],
  ['Hodan Faarax', '6B', '$25', 'EVC Plus', '22 Abriil', 'paid', null, 'school_001', null],
  ['Mariam Ibraahim', '7A', '$25', 'Cash', '22 Abriil', 'paid', null, 'school_001', null],
  ['Liibaan Cumar', '6B', '$15', 'Zaad', '21 Abriil', 'partial', null, 'school_001', null],
  ['Nuur Daahir', '5A', '$25', '—', '—', 'due', null, 'school_001', null],
  ['Filsan Cali', '7A', '$25', 'EVC Plus', '20 Abriil', 'paid', null, 'school_001', null],
  ['Yaasiin Khaliil', '6B', '$12', 'Cash', '19 Abriil', 'partial', null, 'school_001', null],
  ['Sahra Cabdi', '7A', '$25', 'EVC Plus', '19 Abriil', 'paid', null, 'school_001', null],
  // a different school — only Super Admin (or a school_002 user) may see this
  ['Cumar Faarax', '1B', '$25', 'EVC Plus', '20 Abriil', 'paid', null, 'school_002', null],
];

export const PAY_STATUS = {
  paid: { tone: 'green', label: 'La bixiyay' },
  partial: { tone: 'gold', label: 'Qayb ahaan' },
  due: { tone: 'rose', label: 'La sugayo' },
  free: { tone: 'blue', label: 'La dhaafay' },
};

/* ---- Incidents. Display indices [0..8]:
   [student, class, type, severity, internal_note(desc), reporter, when, status, parentNotified]
   Ownership/isolation indices [9..12]:
   [9]=school_id  [10]=class_id  [11]=student_internal_id  [12]=parent_visible_note
   Filtering MUST use school_id + class_id + student_internal_id, never the
   class-name string (two schools can both have a "Form 1A"). ---- */
export const INCIDENTS = [
  ['Cabdiraxmaan Yuusuf Diiriye', 'Form 5A', 'Cay/dulmi (bullying)', 'critical', 'Wuxuu dhaftay arday kale oo yar wuuna ka qaaday qadadiisii. Markhaatiyaal jiraan.', 'Macalin Maxamuud', '15 Juun · 09:40', 'escalated', 'Haa', 'school_001', 'school_001_class_form_5a', null, 'Dhacdo la xalliyay — waalidka waa la ogeysiiyay.'],
  ['Nuur Daahir Warsame', 'Form 7A', 'Khilaaf macalin', 'high', 'Wuu ka soo horjeestay amarka macalinka oo cod sare ku hadlay fasalka dhexdiisa.', 'Macalin Saynab', '14 Juun · 11:15', 'open', 'Haa', 'school_001', 'school_001_class_form_7a', null, 'Khilaaf yar oo la xalliyay.'],
  ['Liibaan Cumar Saleebaan', 'Form 6B', 'Soo daahid joogto ah', 'medium', 'Toddobaadkan 4 jeer ayuu soo daahay, mid kasta in ka badan 20 daqiiqo.', 'Macalin Cabdullahi', '13 Juun · 08:05', 'review', 'Maya', 'school_001', 'school_001_class_form_6b', null, 'Soo daahid joogto ah.'],
  ['Yaasiin Khaliil Maxamuud', 'Form 6B', 'Diidmo shaqo-guri', 'low', 'Ma uu dhammaystirin shaqada guriga ee Xisaabta saddex maalmood oo isku xigta.', 'Macalin Khadiija', '12 Juun · 13:20', 'resolved', 'Maya', 'school_001', 'school_001_class_form_6b', null, 'Shaqo-guri la dhammaystiray.'],
  ['Mariam Ibraahim Nuur', 'Form 7A', 'Carqalad fasalka', 'medium', 'Way la hadashay asxaabteeda inta casharku socday oo carqaladaysay dabaqa.', 'Macalin Yuusuf', '11 Juun · 10:50', 'resolved', 'Haa', 'school_001', 'school_001_class_form_7a', null, 'Carqalad yar oo la xalliyay.'],
  ['Aaliyah Maxamed Cali', 'Form 5A', 'Soo daahid joogto ah', 'low', 'Saddex maalmood oo isku xigta ayay ku soo daahday fasalka subaxnimo.', 'Macalin Maxamuud', '15 Juun · 08:10', 'open', 'Maya', 'school_001', 'school_001_class_form_5a', 'student_001', 'Soo daahid yar oo la xuray.'],
  ['Hodan Faarax Geele', 'Form 6A', 'Hadal xun', 'medium', 'Erayo aan habboonayn ayay u adeegsatay arday la dhigata markii ay isku qabsadeen.', 'Macalin Bile', '14 Juun · 12:05', 'review', 'Haa', 'school_001', 'school_001_class_form_6a', null, 'Hadal xun oo la hagaajiyay.'],
  ['Cumar Saleebaan Aadan', 'Form 1A', 'Burburin hanti dugsi', 'high', 'Wuxuu jebiyay daaqad fasalka inta ay nasashadu socotay isagoo ciyaaraya.', 'Macalin Axmed', '13 Juun · 10:30', 'open', 'Haa', 'school_001', 'school_001_class_form_1a', null, 'Hanti dugsi oo la burburiyay.'],
  // parent's children (parent-visible summaries only)
  ['Ahmed Cali Xuseen', 'Form 4A', 'Soo daahid', 'low', 'XOG GUDAHA: 2 maalmood oo soo daahid ah.', 'Macalin Cali', '16 Juun · 08:00', 'open', 'Haa', 'school_001', 'school_001_class_form_4a', 'student_002', 'Wiilku wuxuu soo daahay 2 maalmood — fadlan la soco.'],
  ['Zakariye Cali Xuseen', 'Form 5A', 'Ka qaybgal wanaagsan', 'low', 'XOG GUDAHA: hagaajin wanaagsan.', 'Macalin Hodan', '16 Juun · 09:00', 'resolved', 'Haa', 'school_001', 'school_001_class_form_5a', 'student_003', 'Zakariye wuxuu muujiyay hagaajin wanaagsan.'],
  // DIFFERENT school, SAME class name "Form 1A" — must NOT leak to school_001
  ['Maxamed Cumar Faarax', 'Form 1A', 'Khilaaf', 'medium', 'XOG GUDAHA: dugsi kale.', 'Macalin Naima', '15 Juun · 10:00', 'open', 'Haa', 'school_002', 'school_002_class_form_1a', null, 'Khilaaf yar (Dugsiga Nuur).'],
];

export const SEVERITY = {
  low: { tone: 'green', label: 'Hoose' },
  medium: { tone: 'gold', label: 'Dhexe' },
  high: { tone: 'gold', label: 'Sare' },
  critical: { tone: 'rose', label: 'Halis' },
};
export const INC_STATUS = {
  open: { tone: 'blue', label: 'Furan' },
  review: { tone: 'gold', label: 'Dib-u-eegis' },
  resolved: { tone: 'green', label: 'La xalliyay' },
  escalated: { tone: 'rose', label: 'Kor loo qaaday' },
};

/* ---- Exams: [class, subject, term, avg, pass%, school_id, subject_id, published]
   published=false is a DRAFT — hidden from Parent/Student. ---- */
export const EXAMS = [
  ['Form 5A', 'Xisaab', 'Term 2', 72, 88, 'school_001', 'Xisaab', true],
  ['Form 5A', 'Af-Soomaali', 'Term 2', 80, 95, 'school_001', 'Af-Soomaali', true],
  ['Form 6B', 'Sayniska', 'Term 2', 65, 78, 'school_001', 'Sayniska', true],
  ['Form 6B', 'Ingiriis', 'Term 2', 70, 84, 'school_001', 'Ingiriis', false],   // draft
  ['Form 7A', 'Cilmiga Diinta', 'Term 2', 85, 97, 'school_001', 'Cilmiga Diinta', true],
  ['Form 7A', 'Juqraafi', 'Term 2', 68, 80, 'school_001', 'Juqraafi', true],
  ['Form 1A', 'Xisaab', 'Term 2', 75, 90, 'school_001', 'Xisaab', true],         // teacher's assigned
  ['Form 2A', 'Sayniska', 'Term 2', 70, 86, 'school_001', 'Sayniska', false],    // teacher's draft
  ['Grade 1B', 'Xisaab', 'Term 2', 77, 91, 'school_002', 'Xisaab', true],        // different school
];

/* ---- Lessons: [subject, class, title, status] ---- */
// [subject, class, title, status, teacher, submitted_at]
export const LESSONS = [
  ['Xisaab', 'Form 5A', 'Jajab & Boqolkiiba', 'approved', 'Maxamuud Faraax', '12 Jan'],
  ['Sayniska', 'Form 6B', 'Qaybaha Unugga', 'pending', 'Khadiija Warsame', 'Maanta 09:14'],
  ['Af-Soomaali', 'Form 7A', 'Suugaanta Hore', 'approved', 'Saynab Khaliif', '10 Jan'],
  ['Ingiriis', 'Form 5A', 'Present Perfect Tense', 'draft', 'Cabdullahi Nuur', '—'],
  ['Juqraafi', 'Form 6B', 'Cimilada Soomaaliya', 'pending', 'Yuusuf Geedi', 'Shalay 14:02'],
];
export const LESSON_STATUS = {
  approved: { tone: 'green', label: 'La ansixiyay' },
  pending: { tone: 'gold', label: 'La sugayo' },
  draft: { tone: 'blue', label: 'Qabyo' },
  rejected: { tone: 'rose', label: 'La diiday' },
};

// full lesson-plan detail (keyed by title) shown in the "Faahfaahin" modal
export const LESSON_DETAILS = {
  'Jajab & Boqolkiiba': {
    topic: 'Cutubka 3 — Jajabka iyo Boqolkiiba',
    objectives: 'Ardaydu waxay baran doonaan sida loo beddelo jajab oo loo rogo boqolkiiba, iyo sida loo isticmaalo nolosha maalinlaha ah.',
    materials: 'Sabuurad, kalkulaytar, buug-hawleed, projector',
    duration: '40', week: 'W3',
    homework: 'Samee jufooyinka 1-15 ee bogga 42; rog jajabyada boqolkiiba.',
    notes: 'Diirad saar ardayda dib uga dhacday qaybtii hore.',
  },
  'Qaybaha Unugga': {
    topic: 'Bayoloji — Qaab-dhismeedka Unugga',
    objectives: 'In la garto qaybaha unugga (membrane, cytoplasm, nucleus) iyo hawlaha kala duwan ee mid walba.',
    materials: 'Mikroskoob, sawirro unug, jaantusyo',
    duration: '45', week: 'W4',
    homework: 'Sawir oo calaamadee qaybaha unugga; qor 3 farqi u dhexeeya unugga xayawaanka iyo dhirta.',
    notes: 'Tijaabo mikroskoob haddii waqtigu ogolaado.',
  },
  'Suugaanta Hore': {
    topic: 'Suugaanta Soomaaliyeed ee Hore — Gabayga',
    objectives: 'In ardaydu fahmaan qaababka gabayga hore, miisaanka, iyo macnaha guud.',
    materials: 'Buugga suugaanta, cajalad maqal ah',
    duration: '40', week: 'W3',
    homework: 'Xafid afar maahmaah; sharax macnahooda.',
    notes: 'Ka wada hadla taariikhda gabayaaga caanka ah.',
  },
  'Present Perfect Tense': {
    topic: 'English Grammar — Present Perfect',
    objectives: 'Students will form and use the present perfect (have/has + past participle) correctly.',
    materials: 'Whiteboard, worksheet, flashcards',
    duration: '40', week: 'W5',
    homework: 'Complete exercises 1–10 on page 28.',
    notes: 'Draft — not yet submitted for review.',
  },
  'Cimilada Soomaaliya': {
    topic: 'Juqraafi — Cimilada iyo Deegaanka',
    objectives: 'In la garto noocyada cimilada Soomaaliya iyo saamaynta ay ku leedahay beeraha.',
    materials: 'Khariidad, jaantus cimilo',
    duration: '45', week: 'W4',
    homework: 'Qor warbixin gaaban oo ku saabsan cimilada gobolkaaga.',
    notes: 'Isticmaal khariidadda dabiiciga ah.',
  },
};

/* ---- Messages: [from, avatar, preview, time, unread] ---- */
/* ---- Messages: teacher ↔ student only. Each thread carries context so the
   UI can show the subject/exam a question is about. school_id isolates the
   thread; class_id/subject/student_id drive the teacher↔student filtering. */
export const MESSAGES = [
  { id: 'msg_1', from: 'Macalin Saynab Khaliif', avatar: 'SK', role: 'teacher',
    preview: "Su'aal ku saabsan jadwalka imtixaanka…", time: '10:24', unread: true,
    school_id: 'school_001', class_id: 'school_001_class_form_5a', subject: 'Xisaab', subject_id: 'subject_xisaab',
    exam: 'Imtixaanka Dhexe', student_internal_id: 'student_001' },
  { id: 'msg_2', from: 'Macalin Cabdullahi Nuur', avatar: 'CN', role: 'teacher',
    preview: 'Natiijada cusub eeg, su\'aal ma qabtaa?', time: 'Shalay', unread: true,
    school_id: 'school_001', class_id: 'school_001_class_form_5a', subject: 'Sayniska', subject_id: 'subject_sayniska',
    exam: null, student_internal_id: 'student_001' },
  { id: 'msg_3', from: 'Aaliyah Maxamed (Arday)', avatar: 'AM', role: 'student',
    preview: 'Mudane, maxaan u diyaargaroobaa imtixaanka?', time: '09:10', unread: false,
    school_id: 'school_001', class_id: 'school_001_class_form_5a', subject: 'Xisaab', subject_id: 'subject_xisaab',
    exam: 'Imtixaanka Dhexe', student_internal_id: 'student_001' },
  { id: 'msg_4', from: 'Macalin Hodan Daahir', avatar: 'HD', role: 'teacher',
    preview: 'Shaqada guriga ee Af-Soomaali ha illaawin.', time: '2 maalmo', unread: false,
    school_id: 'school_001', class_id: 'school_001_class_form_5a', subject: 'Af-Soomaali', subject_id: 'subject_af_soomaali',
    exam: null, student_internal_id: 'student_001' },
];

/* ---- Notices ---- */
export const NOTICES = [
  ['Ku soo dhawoow Dugsiga Cusub!', 'Maamulaha Faadumo', 'Sannad cusub oo waxbarasho — ha seegin shirka furitaanka 1 Sept.', '1 Sept 2025'],
  ['Jadwalka Imtixaanka Dhexe', 'Maamulka', 'Imtixaanka dhexe wuxuu bilaabmayaa 20 Juun. Diyaar garow.', '10 Juun 2026'],
  ['Shirka Macalimiinta', 'Maamulaha Faadumo', 'Shir guud oo macalimiinta ah berri 2:00 galabnimo qolka shirarka.', '18 Juun 2026'],
  ['Fasaxa Ciidda', 'Maamulka', 'Dugsigu wuu xirnaan doonaa muddo 3 maalmood ah Ciidda awgeed.', '5 Juun 2026'],
];

/* ---- Teacher permission matrix: [code, label, granted] ----
   Granted by the School Admin. results.update / results.publish are OFF by
   default so the teacher sees a "School Admin permission required" lock. */
export const PERMISSIONS = [
  ['attendance.view', 'Eeg xaadirinta', true],
  ['attendance.mark', 'Calaamadi xaadirinta', true],
  ['results.view', 'Eeg natiijada', true],
  ['results.create', 'Samee natiijo', true],
  ['results.update', 'Wax ka bedel natiijada', false],
  ['results.publish', 'Daabac natiijada', false],
  ['incidents.view', 'Eeg kiisaska', true],
  ['incidents.create', 'Soo sheeg kiis', true],
  ['messages.send', 'Dir fariimaha', true],
  ['reports.view', 'Eeg warbixinta', true],
];

