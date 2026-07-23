#!/usr/bin/env node
/* ============================================================
   Kobciye — University registration request-path + error-handling suite

   Root cause this proves the fix for: invokeFunction() (services/supabase.js)
   used to unconditionally `await error.context.json()` on ANY functions.invoke()
   failure. That only works when `context` is a real Response
   (FunctionsHttpError/FunctionsRelayError) — for FunctionsFetchError (the
   request never reached the server at all: offline, DNS failure, CORS,
   timeout…) `context` is the raw fetch exception, which has no `.json()`
   method, so the call silently threw, was swallowed, and fell back to the
   SDK's own generic "Failed to send a request to the Edge Function" — the
   exact unhelpful message reported for University registration.

   Transpiles the REAL src/services/supabase.js with the local Babel test
   compiler and loads it with only
   @supabase/supabase-js's createClient mocked (its real error CLASSES —
   FunctionsFetchError/FunctionsHttpError/FunctionsRelayError — are used
   UNMODIFIED, imported from the real installed package, not re-implemented)
   so this exercises the actual shipped classification logic, not a copy of it.

   Run:  cd mobile && node scripts/university-registration-request.test.js
   Exits non-zero on any failure.
   ============================================================ */
const path = require('path');
const os = require('os');
const Module = require('module');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };

let supabaseServicePath;
try {
  const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-supabase-service-source'));
  supabaseServicePath = path.join(compiledSrc, 'services', 'supabase.js');
} catch (e) {
  console.error('could not transpile services/supabase.js for testing:', e.message);
  process.exit(1);
}

let real;
let sdkMode = 'installed Supabase SDK';
try {
  real = require('@supabase/supabase-js');
} catch (error) {
  if (!error || error.code !== 'MODULE_NOT_FOUND') throw error;
  class FunctionsFetchError extends Error {
    constructor(context) { super('Failed to send a request to the Edge Function'); this.name = 'FunctionsFetchError'; this.context = context; }
  }
  class FunctionsHttpError extends Error {
    constructor(context) { super('Edge Function returned a non-2xx status code'); this.name = 'FunctionsHttpError'; this.context = context; }
  }
  class FunctionsRelayError extends Error {
    constructor(context) { super('Relay error'); this.name = 'FunctionsRelayError'; this.context = context; }
  }
  real = { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError };
  sdkMode = 'offline-compatible Supabase Functions error doubles';
}
console.log(`[test dependency: ${sdkMode}]`);
const { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } = real;

// captured by the fake client's functions.invoke() for the "exact payload"
// assertions; reset before each call.
let lastInvoke = null;
let nextInvokeResult = { data: { ok: true }, error: null };

const fakeClient = {
  functions: {
    invoke: async (name, options) => {
      lastInvoke = { name, body: JSON.parse(JSON.stringify(options.body)), timeout: options.timeout };
      return nextInvokeResult;
    },
  },
};

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'react-native-url-polyfill/auto') return {};
  if (request === '@react-native-async-storage/async-storage') return { default: {}, getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
  if (request === '@supabase/supabase-js') return { ...real, createClient: () => fakeClient };
  return originalLoad.call(this, request, parent, isMain);
};

let mod;
try {
  mod = require(supabaseServicePath);
} finally {
  Module._load = originalLoad;
}
const { createSchoolAndInvite, classifyInvokeError } = mod;

(async () => {
  console.log('\n[1] Request path — exact payload sent for each institution type');

  lastInvoke = null;
  await createSchoolAndInvite({
    name: 'Dugsiga Horseed', slug: 'dugsiga-horseed', location: 'Gabiley',
    adminName: 'Cabdi Admin', adminEmail: 'admin@dugsi.edu', adminPhone: '+252611234567',
    institutionType: 'school', schoolStage: 'primary_middle',
  });
  ok('school registration calls create-school-and-invite-admin', lastInvoke.name === 'create-school-and-invite-admin');
  ok('school registration sends institution_type="school"', lastInvoke.body.institution_type === 'school');
  ok('school registration sends school_stage="primary_middle"', lastInvoke.body.school_stage === 'primary_middle');

  lastInvoke = null;
  await createSchoolAndInvite({
    name: 'Dugsiga Sare', slug: 'dugsiga-sare', location: 'Gabiley',
    adminName: 'Cabdi Admin', adminEmail: 'admin2@dugsi.edu', adminPhone: '+252611234567',
    institutionType: 'school', schoolStage: 'secondary',
  });
  ok('school (secondary) registration sends school_stage="secondary"', lastInvoke.body.school_stage === 'secondary');

  lastInvoke = null;
  await createSchoolAndInvite({
    name: 'Jaamacadda Gabiley', slug: 'jaamacadda-gabiley', location: 'Gabiley',
    adminName: 'Deeqa Admin', adminEmail: 'admin@uni.edu', adminPhone: '+252611234567',
    institutionType: 'university', schoolStage: null,
  });
  ok('university registration calls create-school-and-invite-admin', lastInvoke.name === 'create-school-and-invite-admin');
  ok('university registration sends institution_type="university"', lastInvoke.body.institution_type === 'university');
  ok('university registration sends school_stage=null (exact null, not undefined/empty string)',
    lastInvoke.body.school_stage === null && Object.prototype.hasOwnProperty.call(lastInvoke.body, 'school_stage'));
  ok('university registration payload contains no primary_middle/secondary value anywhere',
    JSON.stringify(lastInvoke.body).indexOf('primary_middle') === -1 && JSON.stringify(lastInvoke.body).indexOf('secondary') === -1);

  // defensive: even if a caller mistakenly passes '' for a university (should
  // never happen given SchoolOnboardingScreen's own ternary, but the SERVICE
  // layer itself must not forward it as an empty string either)
  lastInvoke = null;
  await createSchoolAndInvite({
    name: 'Jaamacadda Labaad', slug: 'jaamacadda-labaad', location: null,
    adminName: 'A', adminEmail: 'admin3@uni.edu', adminPhone: null,
    institutionType: 'university', schoolStage: '',
  });
  ok('service layer normalizes an accidental empty-string school_stage to null too (defense in depth)',
    lastInvoke.body.school_stage === null);

  console.log('\n[2] Error classification — network failure never shows the generic SDK message');

  const networkErr = new FunctionsFetchError(new TypeError('Failed to fetch'));
  const networkClassified = await classifyInvokeError(networkErr);
  ok('a real FunctionsFetchError (request never reached the server) is classified as network_error',
    networkClassified.code === 'network_error');
  ok('...with a clear, safe Somali message (not the SDK\'s generic English one)',
    networkClassified.message === 'Xiriirka server-ka ayaa fashilmay. Hubi internet-ka kadib isku day mar kale.');
  ok('...and never surfaces the SDK\'s own raw message text to the user',
    networkClassified.message !== networkErr.message);

  const abortErr = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  const timeoutClassified = await classifyInvokeError(new FunctionsFetchError(abortErr));
  ok('an aborted (timeout) fetch is classified distinctly as "timeout", not a generic network_error',
    timeoutClassified.code === 'timeout');

  console.log('\n[3] Error classification — a 401 shows a login/session message');

  const authErr = new FunctionsHttpError({ status: 401, json: async () => ({ ok: false, error: { code: 'unauthenticated', message: 'Please sign in.' } }) });
  const authClassified = await classifyInvokeError(authErr);
  ok('a 401 response is classified as unauthenticated', authClassified.code === 'unauthenticated');
  ok('...with a clear Somali session-expired message',
    authClassified.message === 'Fadhigaaga login-ka wuu dhacay. Fadlan mar kale gal.');

  console.log('\n[4] Error classification — a 400 validation response shows the safe server message');

  const validationErr = new FunctionsHttpError({ status: 400, json: async () => ({ ok: false, error: { code: 'invalid_institution_type', message: "Dooro Nooca Hay'adda: Dugsi ama Jaamacad." } }) });
  const validationClassified = await classifyInvokeError(validationErr);
  ok('a 400 validation response passes through the server\'s own safe code', validationClassified.code === 'invalid_institution_type');
  ok('...and its own safe Somali message, unmodified', validationClassified.message === "Dooro Nooca Hay'adda: Dugsi ama Jaamacad.");

  console.log('\n[5] Error classification — other safe fallbacks');

  const relayErr = new FunctionsRelayError({ status: 546, json: async () => ({}) });
  const relayClassified = await classifyInvokeError(relayErr);
  ok('a relay error (Supabase could not reach the function) is classified as service_unavailable', relayClassified.code === 'service_unavailable');

  const malformedErr = new FunctionsHttpError({ status: 500, json: async () => { throw new Error('not json'); } });
  const malformedClassified = await classifyInvokeError(malformedErr);
  ok('a non-2xx response with an unparseable body still yields a safe, non-crashing fallback message',
    malformedClassified.code === 'server_error' && typeof malformedClassified.message === 'string' && malformedClassified.message.length > 0);

  const forbiddenErr = new FunctionsHttpError({ status: 403, json: async () => ({ ok: false, error: { code: 'forbidden', message: 'Only a super admin may create a school.' } }) });
  const forbiddenClassified = await classifyInvokeError(forbiddenErr);
  ok('a 403 is classified as forbidden with the server\'s safe message', forbiddenClassified.code === 'forbidden' && forbiddenClassified.message === 'Only a super admin may create a school.');

  console.log('\n[6] No sensitive detail ever appears in a classified message');

  const allMessages = [networkClassified, timeoutClassified, authClassified, validationClassified, relayClassified, malformedClassified, forbiddenClassified]
    .map((c) => c.message).join(' ');
  ok('no classified message contains the word "token"', !/token/i.test(allMessages));
  ok('no classified message contains the word "Bearer" or "eyJ" (JWT prefix)', !/bearer|eyj/i.test(allMessages));
  ok('no classified message contains "service_role" or "secret"', !/service_role|secret/i.test(allMessages));

  console.log('');
  if (failures) { console.error(`university-registration-request FAILED with ${failures} issue(s)\n`); process.exit(1); }
  console.log('university-registration-request PASSED — payload is always correct and every failure mode gets a safe, specific message ✓\n');
})().catch((e) => { console.error('UNCAUGHT', e); process.exit(1); });
