#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const project = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(project, p), 'utf8');
let failed = 0;
function check(condition, label) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) failed += 1;
}

const request = read('supabase/functions/request-identifier-password-reset/index.ts');
const verify = read('supabase/functions/verify-identifier-password-reset/index.ts');
const twilio = read('supabase/functions/_shared/twilio_verify.ts');
const crypto = read('supabase/functions/_shared/whatsapp.ts');
const envExample = read('supabase/functions/.env.example');

check(fs.existsSync(path.join(project, 'supabase/functions/request-identifier-password-reset/index.ts')), 'request function entrypoint exists');
check(fs.existsSync(path.join(project, 'supabase/functions/verify-identifier-password-reset/index.ts')), 'verify function entrypoint exists');
check(fs.existsSync(path.join(project, 'supabase/functions/_shared/twilio_verify.ts')), 'Twilio Verify helper exists');
check(/TWILIO_ACCOUNT_SID/.test(twilio) && /TWILIO_AUTH_TOKEN/.test(twilio) && /TWILIO_VERIFY_SERVICE_SID/.test(twilio), 'helper reads the exact Twilio secret names');
check(!/TWILIO_ACCOUNT_TOKEN/.test(twilio + envExample), 'misspelled TWILIO_ACCOUNT_TOKEN is absent');
check(/Channel: "whatsapp"/.test(twilio), 'request channel is WhatsApp');
check(/\/Verifications/.test(twilio) && /\/VerificationCheck/.test(twilio), 'Twilio Verify start/check endpoints are used');
check(/VerificationSid: verificationSid/.test(twilio), 'verification uses the non-secret VE SID');
check(/provider_message_id: verificationSid/.test(request) || /provider_message_id: verificationSid/.test(request.replace(/\s+/g, ' ')), 'request stores the Twilio Verification SID');
check(/provider_message_id/.test(verify) && /checkTwilioWhatsAppVerification/.test(verify), 'verify reads and checks the provider SID');
check(/claim_password_reset_otp_challenge/.test(verify), 'approved code is atomically claimed before password update');
check(/record_password_reset_otp_failure/.test(verify), 'invalid code increments the existing failure counter');
check(/providerProofHash/.test(request) && !/generateOtp|const otp\s*=/.test(request), 'Kobciye does not generate or store the Twilio OTP');
check(!/WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID|graph\.facebook\.com/.test(request + verify + twilio + crypto + envExample), 'direct Meta provider credentials/API are absent');
check(!/console\.(log|info)[^\n]*(otp|code)/i.test(request + verify + twilio), 'OTP values are not logged');

if (failed) {
  console.error(`\nphase5-twilio-verify: ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nphase5-twilio-verify: all assertions passed');
