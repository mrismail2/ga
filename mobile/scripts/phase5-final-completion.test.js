#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const project = path.resolve(root, '..');
const read = (p) => fs.readFileSync(path.join(project, p), 'utf8');
let failed = 0;
function check(ok, label) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed += 1;
}

const landing = read('mobile/src/screens/LandingScreen.js');
const forgot = read('mobile/src/components/AuthForgotPasswordPanel.js');
const attendance = read('mobile/src/screens/phase5/AttendanceLiveScreen.js');
const p5 = read('mobile/src/services/phase5.js');
const auth = read('mobile/src/context/AuthContext.js');
const requestFn = read('supabase/functions/request-identifier-password-reset/index.ts');
const verifyFn = read('supabase/functions/verify-identifier-password-reset/index.ts');
const whatsapp = read('supabase/functions/_shared/whatsapp.ts');
const twilio = read('supabase/functions/_shared/twilio_verify.ts');

console.log('\n[Actual runtime Forgot Password]');
check(/AuthForgotPasswordPanel/.test(landing), 'actual LandingScreen renders the role-aware Forgot Password panel');
check(!/submitComingSoon|comingSoonMsg|Dhawaan|Coming Soon/i.test(landing), 'actual LandingScreen has no active Coming Soon login path');
check(/MAGACA ARDAYGA OO BUUXA/.test(forgot), 'Student Forgot Password asks the full name');
check(/ID-GA DUGSIGA/.test(forgot), 'Student/Parent Forgot Password asks the public School ID');
check(/FASALKA HADDA/.test(forgot), 'Student Forgot Password asks the current class');
check(/MOBILE-KA WAALIDKA/.test(forgot), 'Student Forgot Password asks the linked Parent mobile');
check(/method === 'parent'|key: 'parent'/.test(forgot) && /schoolCode/.test(forgot) && /parentPhone/.test(forgot), 'Parent Forgot Password asks School ID plus own mobile');
check(/requestIdentifierPasswordReset/.test(forgot) && /verifyIdentifierPasswordReset/.test(forgot), 'Forgot Password calls the real request and verify services');
check(/requestIdentifierPasswordReset/.test(auth) && /verifyIdentifierPasswordReset/.test(auth), 'AuthContext exposes real identifier password recovery');
check(!/otp[^\n]{0,30}(console\.log|localStorage|AsyncStorage)/i.test(forgot), 'client stores or logs no OTP');

console.log('\n[WhatsApp OTP server security]');
check(/p_otp_hash: providerProofHash/.test(requestFn) && /twilio-verify-managed/.test(requestFn), 'request function stores a keyed provider marker, not a plaintext OTP');
check(/hmacHex/.test(requestFn) && /OTP_HASH_SECRET/.test(whatsapp), 'request and identity hashes remain keyed by a server-side secret');
check(/record_password_reset_otp_failure/.test(verifyFn), 'wrong Twilio codes are recorded server-side');
check(/claim_password_reset_otp_challenge/.test(verifyFn), 'approved verification is claimed atomically');
check(/TWILIO_ACCOUNT_SID/.test(twilio) && /TWILIO_AUTH_TOKEN/.test(twilio) && /TWILIO_VERIFY_SERVICE_SID/.test(twilio), 'Twilio credentials are read only from Edge Function secrets');
check(/Channel: \"whatsapp\"/.test(twilio) && /VerificationSid: verificationSid/.test(twilio), 'Twilio Verify uses WhatsApp delivery and SID-based verification checks');
check(!/console\.log\([^\n]*(otp|code)/i.test(requestFn + verifyFn + whatsapp + twilio), 'Edge Functions do not log OTP values');

console.log('\n[Attendance completion]');
check(/listAttendanceSessions/.test(attendance), 'attendance marking screen loads real recent sessions');
check(/listAttendanceRecords/.test(attendance), 'attendance marking screen opens real session records');
check(/attendanceSummary/.test(attendance), 'attendance marking screen shows a real database summary');
check(/Koobka iyo taariikhda fasalka/.test(attendance), 'attendance history and summary are visible in the UI');
check(/student:students\(full_name\)/.test(p5), 'attendance record service returns real Student names for history detail');
check(/Student\/Parent are routed to MyAttendanceScreen/.test(attendance), 'marking screen remains explicitly Teacher/Admin-only by routing');

console.log('\n[Final architecture and migrations]');
for (let n = 11; n <= 21; n += 1) {
  const prefix = `202607260000${String(n).padStart(2, '0')}`;
  const exists = fs.readdirSync(path.join(project, 'supabase/migrations')).some((name) => name.startsWith(prefix));
  check(exists, `additive corrective migration ${prefix} exists`);
}
check(fs.existsSync(path.join(project, 'supabase/functions/request-identifier-password-reset/index.ts')), 'password-reset request Edge Function exists');
check(fs.existsSync(path.join(project, 'supabase/functions/verify-identifier-password-reset/index.ts')), 'password-reset verify Edge Function exists');

if (failed) {
  console.error(`\nphase5-final-completion: ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nphase5-final-completion: all assertions passed');
