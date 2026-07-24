/* ============================================================
   Kobciye — Teacher Replacement Simulator engine (frontend prototype)

   Decision-SUPPORT only. This NEVER judges teacher quality — it surfaces
   data signals to help leadership plan staffing changes carefully.
   Rule-based, no AI API. Mock data; ready to connect to a DB later.

   Future: send summarized teacher/class metrics to an AI model for a
   deeper staffing recommendation (summary only, no private details).
   ============================================================ */

export const SIM_TEACHERS = [
  { id: 't1', name: 'Maxamuud Faraax', subjects: ['Xisaab', 'Sayniska'], classes: ['Form 5A', 'Form 6B'], attendanceRate: 94, syllabus: 82, parentComplaints: 1, years: 12, workload: 'High', strengths: ['Syllabus completion', 'Xisaab'], support: ['Marka fasalku weyn yahay'] },
  { id: 't2', name: 'Saynab Khaliif', subjects: ['Af-Soomaali'], classes: ['Form 7A'], attendanceRate: 91, syllabus: 76, parentComplaints: 0, years: 9, workload: 'Medium', strengths: ['Af-Soomaali', 'Xiriirka waalidka'], support: ['Sayniska khibrad yar'] },
  { id: 't3', name: 'Hodan Cali', subjects: ['Ingiriis'], classes: ['Form 4A'], attendanceRate: 96, syllabus: 88, parentComplaints: 0, years: 7, workload: 'Low', strengths: ['Ingiriis', 'Xaadiris sare'], support: ['Form 4 khibrad yar'] },
  { id: 't4', name: 'Cabdullahi Nuur', subjects: ['Ingiriis', 'Taariikh'], classes: ['Form 5A', 'Form 7A'], attendanceRate: 88, syllabus: 61, parentComplaints: 3, years: 11, workload: 'Medium', strengths: ['Khibrad badan'], support: ['Syllabus completion', 'Jawaab waalid'] },
  { id: 't5', name: 'Faadumo Aadan', subjects: ['Sayniska', 'Farshaxan'], classes: ['Form 6B'], attendanceRate: 92, syllabus: 79, parentComplaints: 1, years: 10, workload: 'Low', strengths: ['Sayniska', 'Diyaar imtixaan'], support: ['Imtixaan diyaarin'] },
];

export const SIM_CLASSES = [
  { id: 'c1', name: 'Form 5A', grade: 'Dugsi Sare', students: 38, teacherIds: ['t1'], examPrep: true },
  { id: 'c2', name: 'Form 6B', grade: 'Dugsi Sare', students: 44, teacherIds: ['t1', 't5'], examPrep: false },
  { id: 'c3', name: 'Form 7A', grade: 'Dugsi Sare', students: 41, teacherIds: ['t2', 't4'], examPrep: true },
  { id: 'c4', name: 'Form 4A', grade: 'Dugsi Dhexe', students: 50, teacherIds: ['t3'], examPrep: false },
];

export const SIM_SUBJECTS = ['Xisaab', 'Sayniska', 'Af-Soomaali', 'Ingiriis', 'Taariikh', 'Farshaxan'];
export const CHANGE_TYPES = ['Beddel ku-meelgaar ah', 'Beddel joogto ah', 'Maadda dib-u-qoondayn', 'Fasal dib-u-qoondayn', 'Daboolid degdeg'];
export const PERIODS = ['1 toddobaad', '1 bil', '1 term', 'Sanad dhan'];

export const tFind = (id) => SIM_TEACHERS.find((t) => t.id === id);
export const cFind = (name) => SIM_CLASSES.find((c) => c.name === name);

/* exam trend per (class) — mock improvement under current teacher */
const TREND = { 'Form 5A': { before: 58, after: 71 }, 'Form 6B': { before: 64, after: 68 }, 'Form 7A': { before: 70, after: 66 }, 'Form 4A': { before: 60, after: 73 } };

function band(score, hi, mid) {
  if (score >= hi) return 'High';
  if (score >= mid) return 'Moderate';
  return 'Low';
}

/* ---- class dependency on its current teacher ---- */
export function calculateClassDependency(className) {
  const tr = TREND[className] || { before: 60, after: 65 };
  const delta = tr.after - tr.before;
  const score = Math.max(0, Math.min(100, 40 + delta * 3));
  const level = band(score, 70, 45);
  return {
    score, level,
    text: `${className} wuxuu u muuqdaa ${level === 'High' ? 'aad ugu tiirsan' : level === 'Moderate' ? 'qayb ahaan ku tiirsan' : 'aan aad ugu tiirsanayn'} macalinka hadda, maadaama natiijadu kor u kacday ${delta}% intii uu wax dhigayay.`,
  };
}

/* ---- teacher↔class/subject fit score (out of 100) ---- */
export function calculateTeacherClassFit(teacher, className, subject) {
  if (!teacher) return { score: 0, confidence: 'Low', missing: ['xog macalin'] };
  let s = 0;
  const why = [], risks = [], support = [];
  if (teacher.subjects.indexOf(subject) !== -1) { s += 30; why.push(`Maadda ${subject} wuu dhigaa`); } else { risks.push(`${subject} khibrad yar`); }
  s += Math.round((teacher.syllabus / 100) * 15);
  s += Math.round((teacher.attendanceRate / 100) * 10);
  s += teacher.parentComplaints === 0 ? 10 : Math.max(0, 10 - teacher.parentComplaints * 3);
  s += teacher.workload === 'Low' ? 10 : teacher.workload === 'Medium' ? 6 : 2;
  s += teacher.years >= 8 ? 20 : 12;
  if (teacher.syllabus >= 80) why.push('Syllabus completion sare'); else support.push('La-socod syllabus');
  if (teacher.attendanceRate >= 92) why.push('Xaadiris sare');
  if (teacher.classes.indexOf(className) === -1) { risks.push(`Khibrad yar ${className}`); support.push('Hordhac bil ah la-socod'); }
  const confidence = teacher.parentComplaints != null && teacher.syllabus != null ? 'High' : 'Medium';
  return { score: Math.min(100, s), why, risks, support, confidence };
}

/* ---- best-fit teacher suggestions for a class/subject ---- */
export function suggestBestFitTeachers(className, subject) {
  return SIM_TEACHERS
    .map((t) => ({ teacher: t, ...calculateTeacherClassFit(t, className, subject) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/* ---- full simulation ---- */
export function runTeacherReplacementSimulation({ current, proposed, fromClass, subject, changeType, period }) {
  if (!current || !proposed || !fromClass || !subject) {
    return { ok: false, message: 'Xog kuma filna in si sax ah loo simo. Fadlan dhammaystir macalimiinta, fasalka iyo maadda.' };
  }
  const dep = calculateClassDependency(fromClass);
  const tr = TREND[fromClass] || { before: 60, after: 65 };
  const examPrep = (cFind(fromClass) || {}).examPrep;
  const newFit = calculateTeacherClassFit(proposed, fromClass, subject);

  const academic = {
    label: 'Saamaynta Tacliinta',
    level: dep.level === 'High' ? 'Medium' : 'Low',
    text: `${fromClass} ${subject} wuxuu ka kacay ${tr.before}% ilaa ${tr.after}% macalinka hadda. Beddel term-dhexe ah wuxuu hakin karaa horumarka.`,
  };
  const attendance = { label: 'Saamaynta Xaadiriska', level: 'Low', text: 'Xaadiristu way deggan tahay iyada oo aan loo eegin macalinka — khatar hooseeya.' };
  const syllabus = {
    label: 'Horumarka Syllabus',
    level: proposed.syllabus < current.syllabus - 10 ? 'High' : 'Medium',
    text: `Macalinka hadda wuxuu dhammeeyay ${current.syllabus}% syllabus-ka, halka macalinka cusub celceliskiisu yahay ${proposed.syllabus}%.`,
  };
  const parent = { label: 'Khatarta Qancinta Waalidka', level: proposed.parentComplaints > 1 ? 'Medium' : 'Low', text: `Macalinka cusub wuxuu leeyahay ${proposed.parentComplaints} cabasho waalid. Fasalkanina wuxuu u baahan yahay xiriir wanaagsan.` };
  const transition = { label: 'Khatarta Kala-guurka', level: examPrep ? 'High' : 'Medium', text: examPrep ? 'Fasalku wuxuu ku jiraa diyaarinta imtixaanka — beddelku wuxuu kordhin karaa carqalad.' : 'Wakhtigu ku habboon yahay, khatar dhexe.' };

  const missing = [];
  if (proposed.subjects.indexOf(subject) === -1) missing.push(`xog imtixaan hore oo ${proposed.name} ${subject}`);
  const confidence = missing.length ? 'Medium' : 'High';

  return {
    ok: true,
    summary: `${current.name} laga rarayo ${fromClass} ${subject} wuxuu abuuri karaa khatar tacliin dhexe haddii aan qorshe kala-guur la sameyn.`,
    evidence: [
      `${fromClass} ${subject} natiijo: ${tr.before}% → ${tr.after}%`,
      `Syllabus hadda: ${current.syllabus}%`,
      `Xaadiris macalin: ${current.attendanceRate}%`,
      `Cabashada waalidka: ${current.parentComplaints}`,
    ],
    impacts: [academic, attendance, syllabus, parent, transition],
    dependency: dep,
    newFit,
    risks: [
      examPrep ? 'Carqalad term-dhexe / imtixaan' : 'Carqalad yar',
      proposed.syllabus < current.syllabus ? 'Syllabus completion oo hoosaysa' : null,
      dep.level === 'High' ? `${fromClass} aad ugu tiirsan macalinka hadda` : null,
    ].filter(Boolean),
    recommendation: examPrep
      ? 'Ka fogow beddel degdeg ah ilaa imtixaanku dhammaado. Haddii lama huraan, samee qorshe kala-guur 2-toddobaad ah oo toddobaadle la kormeero.'
      : 'Haddii beddelku lagama maarmaan yahay, samee qorshe kala-guur 2-toddobaad ah oo la kormeero usbuuc kasta.',
    confidence,
    missing,
  };
}

/* ---- handover plan ---- */
export function generateHandoverPlan(current, proposed, className) {
  return [
    `Toddobaadka 1: ${current ? current.name : 'Macalinka hadda'} wuxuu wadaagaa xaaladda syllabus & mawduucyada adag.`,
    `Toddobaadka 1: ${proposed ? proposed.name : 'Macalinka cusub'} wuxuu daawadaa hal cashar.`,
    `Toddobaadka 2: Macalinka cusub wuu dhigaa, maamulkuna wuu kormeeraa.`,
    'Toddobaadka 2: Dib-u-eegis fahamka ardayda.',
    'Toddobaadka 3: Hubi xaadiris, shaqo-guri iyo cabashada waalidka.',
    `Toddobaadka 4: Isbarbardhig isbeddelka natiijada ${className}.`,
  ];
}

/* ---- emergency cover ---- */
export function emergencyCover(className, subject) {
  const fit = suggestBestFitTeachers(className, subject).filter((f) => f.teacher.workload !== 'High');
  const best = fit[0];
  if (!best) return { ok: false, message: 'Macalin diyaar ah lama helin xilligan.' };
  return {
    ok: true,
    teacher: best.teacher,
    score: best.score,
    text: `${best.teacher.name} ayaa ah daboolid degdeg ugu fiican ${className} ${subject} maadaama uu khibrad u leeyahay maadda, culayskiisuna yahay ${best.teacher.workload}.`,
    checklist: ['Sii qorshe cashar ku-meelgaar', 'Hubi syllabus halka uu marayo', 'La-socod toddobaadkii hore', 'Ogeysii waalidka haddii loo baahdo'],
  };
}
