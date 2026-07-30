#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 4 correction-pass regression tests

   Guards the invariants the correction pass must NOT have broken:
     • the browser tab title is the real app name, never "undefined"
     • Phase 5 modules stay suppressed in Live Mode
     • Class Detail's only real Live tab is still Ardayda
     • no Demo Mode / fake data returns
     • no non-Kobciye (Gabiley Ice) files are present
     • the approved landing page and dashboard design are untouched
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
function ok(name, condition) { console.log(condition ? 'PASS' : 'FAIL', name); if (!condition) failures += 1; }

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const read = (rel, base = root) => fs.readFileSync(path.join(base, rel), 'utf8');
const exists = (rel, base = root) => fs.existsSync(path.join(base, rel));

/* ---------- D1. browser title is never "undefined" ---------- */
const appJson = JSON.parse(read('app.json'));
ok('app.json declares the web app name', appJson.expo.web && appJson.expo.web.name === 'Kobciye School Management');
ok('the web app name is not undefined/empty', typeof appJson.expo.web.name === 'string' && appJson.expo.web.name.trim().length > 0);

const webTitleSource = read('src/utils/webTitle.js');
ok('a runtime title setter exists', /export function setWebTitle/.test(webTitleSource));
ok('the runtime title is the approved product name',
  /APP_TITLE = 'Kobciye School Management'/.test(webTitleSource));
ok('the title setter never writes the literal "undefined"', !/document\.title = undefined/.test(webTitleSource));

const appSource = read('App.js');
ok('App.js sets the browser title at startup', /setWebTitle\(\)/.test(appSource));

const landingHtml = read('index.html', path.join(repoRoot, 'landing'));
ok('the standalone landing page has a <title>', /<title>[^<]+<\/title>/.test(landingHtml));
ok('the landing title is the approved product name',
  /<title>\s*Kobciye School Management\s*<\/title>/.test(landingHtml));
ok('the landing title is not "undefined"', !/<title>\s*undefined\s*<\/title>/i.test(landingHtml));

/* ---------- D2. Phase 5 stays suppressed in Live Mode ---------- */
const classDetailSource = read('src/screens/ClassDetailScreen.js');
const liveTabsMatch = classDetailSource.match(/const LIVE_TABS = \[([^\]]*)\]/);
ok('Class Detail declares an explicit Live tab list', !!liveTabsMatch);
const liveTabs = liveTabsMatch ? liveTabsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean) : [];
ok('the only real Live Mode class tab is still Ardayda',
  liveTabs.length === 1 && liveTabs[0] === 'Ardayda');
for (const phase5 of ['Xaadiris', 'Natiijada', 'Lacagta', 'Kiisaska']) {
  ok(`Phase 5 tab "${phase5}" is NOT restored in Live Mode`, !liveTabs.includes(phase5));
}
ok('Live Mode tabs are chosen by the existing mechanism, not new UI',
  /allowedTabs = isLive \? \(allowed \? LIVE_TABS : \[\]\)/.test(classDetailSource));

/* the Phase 4 school module catalog must not have grown Phase 5 modules */
const modulesSource = read('src/config/phase4Modules.js');
const schoolModuleKeys = [...modulesSource.split('export const UNIVERSITY_MODULES')[0]
  .matchAll(/^\s*key: '([a-z_]+)', table:/gm)].map((m) => m[1]);
const PHASE5_KEYS = ['attendance', 'timetable', 'exams', 'results', 'finance', 'fees',
  'discipline', 'cases', 'assignments', 'transcripts', 'sms', 'whatsapp'];
for (const key of PHASE5_KEYS) {
  ok(`no Phase 5 module "${key}" was added`, !schoolModuleKeys.includes(key));
}
ok('the Phase 1–4 school modules are still the approved set',
  schoolModuleKeys.includes('students') && schoolModuleKeys.includes('classes')
  && schoolModuleKeys.includes('admissions') && schoolModuleKeys.includes('parents'));

/* ---------- D3. no Demo Mode / fake data returns ---------- */
const CORRECTED_FILES = [
  'src/context/SchoolContext.js',
  'src/components/SchoolSelector.js',
  'src/hooks/useActiveSchoolId.js',
  'src/hooks/useCanonicalRows.js',
  'src/services/phase4.js',
  'src/services/guardianLinks.js',
  'src/components/P4ModuleView.js',
];
for (const rel of CORRECTED_FILES) {
  const src = read(rel);
  ok(`${rel} introduces no demo/seed student data`,
    !/SEED_STUDENTS|DEMO_STUDENTS|from '\.\.\/data\/seedData'|from '\.\.\/data\/mock'/.test(src));
}
const selectorSource = read('src/components/SchoolSelector.js');
ok('the school selector lists REAL Supabase schools, never a hardcoded list',
  !/Dugsiga Hidaayada|Dugsiga Nuur|Dugsiga Iftiin/.test(selectorSource));
const schoolContextSource = read('src/context/SchoolContext.js');
ok('live Super Admin never falls back to a demo branch',
  /listSchools/.test(schoolContextSource) && !/DEFAULT\[0\]\.id;?\s*\/\/ live/.test(schoolContextSource));

/* ---------- D4. no non-Kobciye deployable/runtime files ---------- */
const NON_KOBCIYE = ['index.html', 'main.js', 'styles.css', 'assets/banner-1.png', 'assets/header.png'];
for (const rel of NON_KOBCIYE) {
  ok(`the non-Kobciye root file "${rel}" is gone`, !exists(rel, repoRoot));
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}
// Scan only deployable/runtime locations. Audit/correction Markdown files may
// legitimately mention the historical removal and must not cause a false
// failure. Test scripts are also excluded because assertion text necessarily
// contains the forbidden brand string.
const runtimeRoots = [
  path.join(repoRoot, 'mobile/src'),
  path.join(repoRoot, 'landing'),
  path.join(repoRoot, 'supabase/functions'),
];
const runtimeSingles = [
  path.join(repoRoot, 'mobile/App.js'),
  path.join(repoRoot, 'mobile/index.js'),
  path.join(repoRoot, 'mobile/app.json'),
];
const runtimeFiles = runtimeRoots.flatMap((dir) => walk(dir))
  .concat(runtimeSingles.filter((f) => fs.existsSync(f)))
  .filter((f) => /\.(js|jsx|ts|tsx|json|html|css|sql)$/.test(f));
const iceHits = runtimeFiles.filter((f) => {
  try { return /gabiley\s*ice|GABILEY<span>ICE/i.test(fs.readFileSync(f, 'utf8')); } catch (e) { return false; }
});
ok('no Gabiley Ice content remains in deployable/runtime source', iceHits.length === 0);

// Runtime imports must not point at any of the removed non-Kobciye asset
// names. Legitimate Kobciye imports from mobile/src/assets remain allowed.
const removedAssetImports = runtimeFiles.filter((f) => {
  try { return /(?:from\s+|require\()[^\n]*(?:gabiley\s*ice|ice[-_ ]?cream|banner-1\.png)/i.test(fs.readFileSync(f, 'utf8')); } catch (e) { return false; }
});
ok('no Kobciye runtime file imports removed non-Kobciye assets', removedAssetImports.length === 0);

const textFiles = runtimeFiles;

/* ---------- D5. the approved UI is preserved ---------- */
const classesSource = read('src/screens/ClassesScreen.js');
ok('the Fasallada card grid is unchanged (2 columns)', /numColumns=\{2\}/.test(classesSource));
ok('the Fasallada create FAB is preserved', /styles\.fab/.test(classesSource));
const dashboardSource = read('src/screens/dashboards/RoleDashboards.js');
ok('the dashboard stat-tile grid is preserved', /const grid = \(cards\)/.test(dashboardSource));
ok('the School Admin dashboard tiles are unchanged',
  /Tirada Ardayda/.test(dashboardSource) && /Macalimiin/.test(dashboardSource));
ok('the landing page still ships its approved markup', landingHtml.length > 50000);

/* ---------- D6. no remote database work was performed ---------- */
const migrationsDir = path.join(repoRoot, 'supabase/migrations');
const migrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
ok('the existing verified migrations are all still present', migrations.length >= 21);
const resetHits = textFiles.filter((f) => {
  if (/\.md$/.test(f)) return false; // reports may *mention* the prohibition
  try { return /supabase db reset/.test(fs.readFileSync(f, 'utf8')); } catch (e) { return false; }
});
ok('no code or config runs `supabase db reset`', resetHits.length === 0);

console.log(failures === 0
  ? '\nphase4-correction-regression: all assertions passed'
  : `\nphase4-correction-regression: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
