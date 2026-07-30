/* Source-level security regression for the ACTUAL Kobciye auth runtime.
   This intentionally uses no Babel/npm dependency so it can run in a clean
   source-only archive. Database/Edge behavior still requires the Postgres and
   live-browser suites before production sign-off. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.resolve(ROOT, '..');
let failed = 0;
function read(rel) { return fs.readFileSync(path.join(PROJECT, rel), 'utf8'); }
function ok(name, cond) { if (cond) console.log(`PASS ${name}`); else { console.error(`FAIL ${name}`); failed += 1; } }

const landing = read('mobile/src/screens/LandingScreen.js');
const panel = read('mobile/src/components/AuthForgotPasswordPanel.js');
const svc = read('mobile/src/services/supabase.js');
const requestFn = read('supabase/functions/request-identifier-password-reset/index.ts');
const verifyFn = read('supabase/functions/verify-identifier-password-reset/index.ts');
const identifierFn = read('supabase/functions/identifier-login/index.ts');
const whatsapp = read('supabase/functions/_shared/whatsapp.ts');
const twilio = read('supabase/functions/_shared/twilio_verify.ts');
const m11 = read('supabase/migrations/20260726000011_phase5_whatsapp_password_reset_and_activation.sql');
const m13 = read('supabase/migrations/20260726000013_phase5_assignment_and_otp_security.sql');
const m14 = read('supabase/migrations/20260726000014_phase5_final_rls_and_identity_hardening.sql');

console.log('\n[Actual landing runtime]');
ok('LandingScreen renders the shared role-aware Forgot Password panel', /AuthForgotPasswordPanel/.test(landing));
ok('normal Student/Parent login still uses School ID + Student ID + password', /studentId/.test(landing) && /identifierPw/.test(landing) && /signInWithSchoolIdentifier/.test(landing));
ok('Forgot Password is not a Coming Soon action', !/submitComingSoon|Galitaanka ID-ga waa dhawaan/.test(landing));

console.log('\n[Requested recovery fields]');
ok('Student recovery asks full name', /MAGACA ARDAYGA OO BUUXA/.test(panel));
ok('Student recovery asks public School ID', /ID-GA DUGSIGA/.test(panel));
ok('Student recovery asks current class', /FASALKA HADDA/.test(panel));
ok('Student recovery asks linked Parent mobile', /MOBILE-KA WAALIDKA/.test(panel));
ok('Parent recovery asks School ID + own mobile without child Student ID', /fullName: method === 'student' \? fullName\.trim\(\) : null/.test(panel) && /className: method === 'student' \? className\.trim\(\) : null/.test(panel) && !/CHILD STUDENT ID/.test(panel));
ok('recovery has OTP, resend, expiry countdown and new-password confirmation', /KOODHKA WHATSAPP/.test(panel) && /Dib u dir koodhka/.test(panel) && /confirmPassword/.test(panel));
ok('client calls real request + verify services', /requestIdentifierPasswordReset/.test(panel) && /verifyIdentifierPasswordReset/.test(panel));
ok('services invoke both server functions', /request-identifier-password-reset/.test(svc) && /verify-identifier-password-reset/.test(svc));

console.log('\n[OTP server security]');
ok('request response is generic and does not expose a masked phone', /Haddii xogtu sax tahay/.test(requestFn) && !/masked_phone|maskedPhone/.test(requestFn));
ok('Twilio owns the OTP and Kobciye stores only a keyed provider marker', /p_otp_hash: providerProofHash/.test(requestFn) && /twilio-verify-managed/.test(requestFn) && !/generateOtp|const otp =/.test(requestFn));
ok('wrong attempts increment atomically through an RPC', /record_password_reset_otp_failure/.test(verifyFn) && /least\(failed_attempts \+ 1, 5\)/.test(m13));
ok('successful verification claims a challenge atomically before Auth update', /claim_password_reset_otp_challenge/.test(verifyFn) && /set consumed_at = now\(\)/i.test(m11));
ok('Twilio Verify starts a WhatsApp verification server-side', /Channel: \"whatsapp\"/.test(twilio) && /TWILIO_ACCOUNT_SID/.test(twilio) && /TWILIO_AUTH_TOKEN/.test(twilio) && /TWILIO_VERIFY_SERVICE_SID/.test(twilio));
ok('Twilio Verification Check uses the provider SID and code', /VerificationSid: verificationSid/.test(twilio) && /Code: code/.test(twilio) && /checkTwilioWhatsAppVerification/.test(verifyFn));
ok('Edge Functions never log or return an OTP value', !/console\.(log|info)[^\n]*(otp|code)/i.test(requestFn + verifyFn + twilio));
ok('service-role secret is not referenced by mobile source', !/SERVICE_ROLE/i.test(panel + landing + svc));

console.log('\n[Identity matching]');
ok('Student resolver requires school + full name + active class + linked Parent phone', /resolve_student_password_reset_target/.test(m11) && /normalize_kobciye_text\(st\.full_name\)/.test(m11) && /se\.status = 'active'/.test(m11) && /pa\.login_phone_e164 = v_phone/.test(m11));
ok('Parent resolver requires school + active canonical login phone', /resolve_parent_password_reset_target/.test(m11) && /pa\.status = 'active'/.test(m11) && /pa\.login_phone_e164 = v_phone/.test(m11));
ok('zero or ambiguous matches return null instead of selecting the first row', (m11.match(/jsonb_array_length\(v_rows\) <> 1/g) || []).length >= 2);
ok('OTP table has no authenticated client policy', /No authenticated-client policy is created/.test(m11));

console.log('\n[Normal identifier login hardening]');
ok('identifier input is normalized case-insensitively', /toUpperCase\(\)/.test(identifierFn) && /upper\(trim\(student_id\)\)/.test(m14));
ok('identifier login stores a hashed IP and reserves attempts atomically', /hmacHex\(`identifier-ip:/.test(identifierFn) && /begin_identifier_login_attempt/.test(identifierFn));
ok('case-insensitive duplicate Student IDs block migration', /duplicate case-insensitive Student IDs/.test(m14));

console.log('\n[Phase 5 RLS hardening]');
ok('Teacher assignment access is exact class+subject', /phase5_teacher_assigned_pair/.test(m14));
ok('Student assignment writes are RPC-only', /drop policy if exists "student creates own submissions"/.test(m14) && /submit_assignment_work/.test(m13));
ok('Teachers cannot directly write arbitrary results', /drop policy if exists "staff write results"/.test(m14) && /teacher reads assigned results/.test(m14));
ok('Teachers no longer read school-wide payment data', /drop policy if exists "finance staff read payments"/.test(m14) && /finance team manages payments/.test(m14));

if (failed) {
  console.error(`\nphase5-auth-recovery: ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nphase5-auth-recovery: all assertions passed');
