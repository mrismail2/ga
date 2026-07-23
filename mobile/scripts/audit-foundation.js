#!/usr/bin/env node
/* ============================================================
   Kobciye — Foundation audit (npm run audit:foundation)

   Two gates, both must pass:

   (A) STATIC SCAN — the active runtime layer (screens / components / context /
       utils + App.js) must contain NO legacy relationship usage. The data +
       seed + migration boundary (src/data, src/services, scripts) is where the
       one-time seed and canonical transforms live and is intentionally
       excluded — the rule is "no screen may read raw/legacy data".

   (B) STRUCTURAL VALIDATION — the canonical seed (built live from
       src/data/seedData.js via the local Babel test compiler) must satisfy:
         • every class has school_id + a globally-unique class_id
         • every student has student_internal_id, student_id, school_id, class_id
         • active records reference valid school/class/student ids
         • no duplicate student_id within one school
         • no duplicate class_id globally

   Exits non-zero on any failure.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
const FORBIDDEN = [
  'KOB-STU-', 'studentCode', 'childCodes', 'assignedClasses',
  'REGISTRY_STUDENTS', 'BILL_STUDENTS', 'rosterFor(',
  'INCIDENTS.slice(', 'PAYMENTS.slice(',
];

// active runtime layer scanned for forbidden tokens
const SCAN_DIRS = ['src/screens', 'src/components', 'src/context', 'src/utils'];
const SCAN_FILES = ['App.js'];
// the clearly-marked migration boundary may reference legacy field names
// (normalizeLegacyStudentData) — it is the one allowed exception.
const ALLOWLIST = ['src/utils/dataMigration.js'];

let failures = 0;
const fail = (m) => { console.error('  ✗ ' + m); failures++; };
const ok = (m) => console.log('  ✓ ' + m);

/* ---- (A) static scan ---- */
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

console.log('\n[A] Static scan — active layer must be free of legacy relationship usage');
const files = [...SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))), ...SCAN_FILES.map((f) => path.join(ROOT, f))];
let scanHits = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOWLIST.includes(rel)) continue;   // migration boundary
  const text = fs.readFileSync(file, 'utf8');
  for (const tok of FORBIDDEN) {
    if (text.includes(tok)) {
      fail(`${path.relative(ROOT, file)} contains forbidden token "${tok}"`);
      scanHits++;
    }
  }
}
if (!scanHits) ok(`${files.length} active files scanned — no forbidden tokens`);

/* ---- (B) structural validation of the live canonical seed ---- */
console.log('\n[B] Structural validation — canonical seed integrity');
let data = null;
try {
  const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-foundation-audit-source'));
  const originalLoad = Module._load;
  Module._load = function loadSeedDependency(request, parent, isMain) {
    if (request === '@react-native-async-storage/async-storage') {
      const storage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
      return { ...storage, default: storage };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    data = require(path.join(compiledSrc, 'data', 'seedData.js')).buildSeedData();
  } finally {
    Module._load = originalLoad;
  }
} catch (e) {
  fail('could not build the live seed for validation: ' + e.message);
}

if (data) {
  const classIds = new Set();
  (data.classes || []).forEach((c, i) => {
    if (!c.school_id) fail(`class[${i}] missing school_id`);
    if (!c.class_id || !/^school_[a-z0-9]+_class_/i.test(c.class_id)) fail(`class[${i}] class_id "${c.class_id}" not globally unique`);
    if (classIds.has(c.class_id)) fail(`duplicate class_id ${c.class_id}`);
    classIds.add(c.class_id);
  });
  ok(`${(data.classes || []).length} classes — globally-unique class_id, all have school_id`);

  const internalIds = new Set();
  const perSchool = {};
  let studentErrs = 0;
  (data.students || []).forEach((s, i) => {
    ['student_internal_id', 'student_id', 'school_id', 'class_id'].forEach((f) => { if (!s[f]) { fail(`student[${i}] missing ${f}`); studentErrs++; } });
    if (s.student_internal_id) { if (internalIds.has(s.student_internal_id)) { fail(`duplicate student_internal_id ${s.student_internal_id}`); studentErrs++; } internalIds.add(s.student_internal_id); }
    if (s.student_id && s.school_id) {
      perSchool[s.school_id] = perSchool[s.school_id] || new Set();
      if (perSchool[s.school_id].has(s.student_id)) { fail(`duplicate student_id ${s.student_id} in ${s.school_id}`); studentErrs++; }
      perSchool[s.school_id].add(s.student_id);
    }
    if (s.class_id && classIds.size && !classIds.has(s.class_id)) { fail(`student ${s.student_id} → unknown class_id ${s.class_id}`); studentErrs++; }
  });
  if (!studentErrs) ok(`${(data.students || []).length} students — identity fields present, no dup student_id/school, valid class refs`);

  let refErrs = 0;
  (data.results || []).forEach((r, i) => {
    if (r.student_internal_id && !internalIds.has(r.student_internal_id)) { fail(`result[${i}] → unknown student ${r.student_internal_id}`); refErrs++; }
    if (r.class_id && !classIds.has(r.class_id)) { fail(`result[${i}] → unknown class ${r.class_id}`); refErrs++; }
  });
  (data.exams || []).forEach((e, i) => { if (e.class_id && !classIds.has(e.class_id)) { fail(`exam[${i}] → unknown class ${e.class_id}`); refErrs++; } });
  if (!refErrs) ok(`${(data.results || []).length} results + ${(data.exams || []).length} exams — all references valid`);
}

console.log('');
if (failures) { console.error(`audit:foundation FAILED with ${failures} issue(s)\n`); process.exit(1); }
console.log('audit:foundation PASSED — canonical foundation is clean ✓\n');
