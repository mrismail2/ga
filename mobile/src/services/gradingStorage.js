/* ============================================================
   Kobciye — Grading rules & calculations (Phase 1/2 foundation)

   A school-scoped grading scale plus pure helpers to turn a raw score into
   a percentage, letter grade and pass/fail verdict. Used by the exam/result
   workflow so every result is computed the same way.

   Persisted per school in AsyncStorage — no backend.
   ============================================================ */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kobciye_grading_rules_v1';

/* default A–F scale (min percentage for each grade) */
export const DEFAULT_GRADE_SCALE = [
  { grade: 'A', min: 80 },
  { grade: 'B', min: 70 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 50 },
  { grade: 'F', min: 0 },
];

export const DEFAULT_GRADING = {
  pass_mark: 50,           // default pass percentage
  scale: DEFAULT_GRADE_SCALE,
};

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) { return {}; }
}

/* the grading rules for one school (storage → defaults) */
export async function getGradingRules(schoolId) {
  const all = await readAll();
  return { ...DEFAULT_GRADING, ...(all[schoolId] || {}) };
}

export async function saveGradingRules(schoolId, rules) {
  const all = await readAll();
  all[schoolId] = { ...DEFAULT_GRADING, ...(all[schoolId] || {}), ...rules };
  await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => {});
  return all[schoolId];
}

/* ---- pure calculation helpers (no storage) ---- */

export function percentageOf(score, fullMarks) {
  const f = Number(fullMarks) || 100;
  return Math.max(0, Math.round(((Number(score) || 0) / f) * 100));
}

export function gradeForPercentage(percentage, scale = DEFAULT_GRADE_SCALE) {
  const pct = Number(percentage) || 0;
  const ordered = [...scale].sort((a, b) => b.min - a.min);
  const hit = ordered.find((g) => pct >= g.min);
  return hit ? hit.grade : 'F';
}

export function resultStatus(percentage, passMark = 50) {
  return (Number(percentage) || 0) >= passMark ? 'passed' : 'failed';
}

/* one-shot: turn a raw score into { percentage, grade, result_status } */
export function computeResult(score, fullMarks, rules = DEFAULT_GRADING) {
  const percentage = percentageOf(score, fullMarks);
  return {
    percentage,
    grade: gradeForPercentage(percentage, rules.scale || DEFAULT_GRADE_SCALE),
    result_status: resultStatus(percentage, rules.pass_mark != null ? rules.pass_mark : 50),
  };
}

/* aggregate a student's results across subjects → total, average, overall */
export function summarizeStudentResults(results, rules = DEFAULT_GRADING) {
  const rows = results || [];
  if (!rows.length) return { total: 0, average: 0, overall: 'failed', grade: 'F', count: 0 };
  const total = rows.reduce((a, r) => a + (Number(r.score) || 0), 0);
  const fullTotal = rows.reduce((a, r) => a + (Number(r.full_marks) || 100), 0);
  const average = Math.round(rows.reduce((a, r) => a + (Number(r.percentage) || 0), 0) / rows.length);
  const overallPct = percentageOf(total, fullTotal);
  return {
    total,
    average,
    overallPercentage: overallPct,
    grade: gradeForPercentage(average, rules.scale || DEFAULT_GRADE_SCALE),
    overall: resultStatus(average, rules.pass_mark != null ? rules.pass_mark : 50),
    count: rows.length,
  };
}
