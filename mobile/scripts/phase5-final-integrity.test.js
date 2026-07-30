const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
function check(name, ok) {
  if (ok) console.log('PASS', name);
  else { console.error('FAIL', name); failed += 1; }
}

const finance = read('supabase/migrations/20260726000015_phase5_finance_integrity_completion.sql');
const otp = read('supabase/migrations/20260726000016_phase5_password_reset_rate_limit_hardening.sql');
const discipline = read('supabase/migrations/20260726000017_phase5_discipline_privacy_hardening.sql');
const delay = read('supabase/migrations/20260726000018_phase5_notification_delay_enforcement.sql');
const requestFn = read('supabase/functions/request-identifier-password-reset/index.ts');
const wa = read('supabase/functions/_shared/whatsapp.ts');
const service = read('mobile/src/services/phase5.js');
const screen = read('mobile/src/screens/phase5/DisciplineScreen.js');

console.log('\n[Finance integrity]');
check('invoice generation requires an active enrollment', /student has no active enrollment/.test(finance));
check('invoice generation requires positive fee items', /fee structure has no fee items/.test(finance) && /total must be greater than zero/.test(finance));
check('one invoice per Student and fee structure is DB-enforced', /student_invoices_student_structure_unique/.test(finance));
check('invoice notification fan-out uses a set insert, not a scalar multi-row subquery', /select distinct[\s\S]*sp\.parent_profile_id/.test(finance) && !/perform\s*\(\s*select 1 from \(\s*select distinct sp\.parent_profile_id/.test(finance));
check('payment reversal restores each allocated invoice', /select pa\.invoice_id, sum\(pa\.amount\)/.test(finance) && /where id = v_alloc\.invoice_id/.test(finance));
check('payment reversal requires an audit reason', /a reversal reason is required/.test(finance));

console.log('\n[Forgot Password OTP hardening]');
check('Parent login phone is constrained to E.164 for new writes', /parents_login_phone_e164_format/.test(otp) && /\\\+\[1-9\]\[0-9\]\{7,14\}/.test(otp));
check('challenge creation rate limits are atomic under advisory locks', /pg_advisory_xact_lock/.test(otp) && /create_password_reset_otp_challenge/.test(otp));
check('request Edge Function uses atomic challenge RPC', /rpc\(\s*"create_password_reset_otp_challenge"/.test(requestFn));
check('request Edge Function no longer performs racy client-side count checks', !/ipCount|requestCount|dailyCount/.test(requestFn));
check('phone normalizer rejects invalid E.164 output', /\^\\\+\[1-9\]\[0-9\]\{7,14\}\$/.test(wa));

console.log('\n[Discipline privacy]');
check('Teacher case visibility is assigned-Student-only', /is_teacher_of_student\(student_id\)/.test(discipline));
check('Teacher confidential notes are denied', /only a school admin may add a confidential note/.test(discipline));
check('Teacher confidential attachments are denied', /only a school admin may add a confidential attachment/.test(discipline));
check('case creation derives historical enrollment and reporter server-side', /create_student_incident/.test(discipline) && /reported_by/.test(discipline) && /enrolled_on <= v_date/.test(discipline));
check('incident child writes use actor-setting RPCs', /rpc\('create_incident_action'/.test(service) && /rpc\('create_incident_note'/.test(service) && /rpc\('create_incident_attachment'/.test(service));
check('Student is not offered discipline detail action', !/roles:\s*\[[^\]]*'student'[^\]]*\]/.test(screen));
check('Parent detail avoids confidential child-table reads', /roleKey === 'parent'/.test(screen) && /setData\(\{ actions, notes: \[\], history: \[\], attachments: \[\] \}\)/.test(screen));

console.log('\n[Attendance notification delay]');
check('notifications carry a real availability timestamp', /add column if not exists available_at/.test(delay));
check('absence delay reads attendance settings', /notification_delay_minutes/.test(delay) && /make_interval\(mins/.test(delay));
check('recipient cannot see or mark a scheduled notification early', /available_at <= now\(\)/.test(delay));
check('recipient cannot alter available_at', /new\.available_at is distinct from old\.available_at/.test(delay));

if (failed) {
  console.error(`\nphase5-final-integrity: ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nphase5-final-integrity: all assertions passed');
