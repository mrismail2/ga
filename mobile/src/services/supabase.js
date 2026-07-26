/* ============================================================
   Kobciye — Supabase client (Phase 2 backend foundation)

   Reads the project URL + anon key from Expo public env vars
   (mobile/.env — see mobile/.env.example). Sessions persist in
   AsyncStorage so login survives app restarts.

   isSupabaseConfigured() lets screens keep working against the
   local AsyncStorage prototype store until the backend is wired.
   ============================================================ */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { isUuid } from '../utils/uuid';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
// only the PUBLIC anon / publishable key is ever read here — never a
// service-role key (that lives only in Edge Function secrets, server-side).
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

// detectSessionInUrl is ALWAYS off, on every platform. We parse invite/
// recovery/reset callback URLs ourselves (src/utils/deepLink.js) and
// explicitly exchange them (AuthContext) before ever considering an existing
// persisted session — letting supabase-js auto-detect the URL races against
// that check and can silently let an old session win, which is exactly the
// bug this app must not have: a password-reset link must always open
// SetPasswordScreen, never the dashboard, even for an already-signed-in user.
export const supabase = isSupabaseConfigured()
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

/* ---- auth helpers (role comes from the profiles table) ---- */
function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured (see mobile/.env.example)');
  return supabase;
}

/* Create an account. `meta` may only carry display fields (e.g. full_name) —
   the handle_new_user() trigger reads full_name but ALWAYS sets
   role = 'pending' and school_id = null, ignoring anything else in `meta`
   (never send role/school_id here; the server would ignore them anyway).
   Use provisionSchool() or wait for an admin to call assignRole() next. */
export async function signUpWithEmail(email, password, meta = {}) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: meta.full_name || '' } },
  });
  if (error) throw error;
  return data;
}

/* DISABLED server-side as of migration 0008 — self-service "sign up and
   become admin of your own new school" is not the product's rule; only a
   verified super_admin may create a school (see createSchoolAsSuperAdmin
   below). Calling this now always fails with a permission error; kept only
   so nothing throws a ReferenceError if something still imports it. */
export async function provisionSchool(name, slug, location) {
  const { data, error } = await requireClient().rpc('provision_school', {
    p_name: name,
    p_slug: slug,
    p_location: location || null,
  });
  if (error) throw error;
  return data;
}

/* super_admin-only: create a school and assign a specific PENDING profile
   as its first school_admin. The database re-checks the caller is really
   super_admin and the target is really pending with no school — this call
   cannot itself grant privileges the caller doesn't have. institutionType
   ('school'|'university') and, for a school, schoolStage
   ('primary_middle'|'secondary') are REQUIRED — the database rejects an
   unclassified school the same way it does for createSchoolAndInvite (see
   supabase/migrations/20260705000001_institution_type.sql). Not used by any
   screen today (the live onboarding flow is createSchoolAndInvite); kept for
   completeness since the underlying RPC is still reachable. Returns the new
   school id. */
export async function createSchoolAsSuperAdmin(name, slug, location, initialAdminProfileId, institutionType, schoolStage) {
  const { data, error } = await requireClient().rpc('create_school_as_super_admin', {
    p_name: name,
    p_slug: slug,
    p_location: location || null,
    p_initial_admin_profile_id: initialAdminProfileId,
    p_institution_type: institutionType,
    p_school_stage: schoolStage ?? null,
  });
  if (error) throw error;
  return data;
}

/* Admin-only: assign a role (and optionally a school) to another profile.
   The database re-checks the caller is a school_admin of that school or a
   super_admin — this call cannot itself grant privileges it doesn't have. */
export async function assignRole(profileId, role, schoolId) {
  const { error } = await requireClient().rpc('assign_role', {
    p_profile_id: profileId,
    p_role: role,
    p_school_id: schoolId || null,
  });
  if (error) throw error;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/* Restore the persisted session on app start (null when logged out). */
export async function restoreSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/* Subscribe to login/logout/refresh events; returns an unsubscribe fn. */
export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

/* Email a password-reset link. `redirectTo` must be listed under
   Auth → URL Configuration in the Supabase dashboard (e.g. kobciye://reset).
   NOT used by the forgot-password UI anymore — that goes through the
   request-password-reset Edge Function (requestPasswordResetSecure below) so
   the server can refuse to send recovery email to a pending-invite-only
   account. Kept for completeness/tests. */
export async function resetPassword(email, redirectTo) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/* After following a reset link (or while signed in): set a new password. */
export async function updatePassword(newPassword) {
  const { error } = await requireClient().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export const INSTITUTION_RESOLUTION = Object.freeze({
  VALID_SCHOOL: 'valid_school',
  VALID_UNIVERSITY: 'valid_university',
  UNCLASSIFIED: 'unclassified',
  PLATFORM: 'platform',
  PENDING: 'pending',
});

function stableProfileError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function institutionResolutionFor(profile, school) {
  if (profile.role === 'super_admin') return INSTITUTION_RESOLUTION.PLATFORM;
  if (profile.role === 'pending') return INSTITUTION_RESOLUTION.PENDING;
  if (school && school.institution_type === 'school'
      && (school.school_stage === 'primary_middle' || school.school_stage === 'secondary')) {
    return INSTITUTION_RESOLUTION.VALID_SCHOOL;
  }
  if (school && school.institution_type === 'university' && school.school_stage == null) {
    return INSTITUTION_RESOLUTION.VALID_UNIVERSITY;
  }
  return INSTITUTION_RESOLUTION.UNCLASSIFIED;
}

export async function getMyProfile() {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw stableProfileError('profile_load_failed', 'Profile could not be loaded.');
  const user = userData && userData.user;
  if (!user) throw stableProfileError('no_authenticated_user', 'Authenticated user was not found.');

  // Keep the profile and institution reads separate so AuthContext can expose
  // a stable, useful failure category instead of collapsing both into one
  // PostgREST join error.
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, full_name, phone, avatar_url, role, school_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw stableProfileError('profile_load_failed', 'Profile could not be loaded.');
  if (!profile) throw stableProfileError('profile_not_found', 'Profile was not found.');

  let school = null;
  if (profile.role !== 'super_admin' && profile.role !== 'pending' && profile.school_id) {
    const { data: institution, error: institutionError } = await client
      .from('schools')
      .select('id, name, location, student_id_prefix, next_student_sequence, institution_type, school_stage')
      .eq('id', profile.school_id)
      .maybeSingle();
    if (institutionError || !institution) {
      throw stableProfileError('institution_load_failed', 'Institution could not be loaded.');
    }
    school = institution;
  }

  return {
    ...profile,
    school,
    institution_resolution: institutionResolutionFor(profile, school),
  };
}

/* Update the caller's own SAFE profile fields only. role/school_id are
   deliberately not accepted here — even if a caller passed them, the
   database's guard_profile_privileged_fields() trigger rejects the write.
   Use assignRole() (admin) or provisionSchool() (self-service) for those. */
export async function updateMyProfile({ full_name, phone, avatar_url } = {}) {
  const client = requireClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const patch = {};
  if (full_name !== undefined) patch.full_name = full_name;
  if (phone !== undefined) patch.phone = phone;
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;
  const { error } = await client.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
}

/* Set the session explicitly from tokens extracted from an implicit-flow
   invite/recovery/reset link (#access_token=...&refresh_token=...). */
export async function setSessionFromTokens(access_token, refresh_token) {
  const { data, error } = await requireClient().auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

/* Exchange a PKCE authorization code (?code=... from an invite/recovery/reset
   link) for a real session. This is the ONLY way those links are consumed —
   detectSessionInUrl is off everywhere, so nothing happens automatically. */
export async function exchangeCodeForSession(code) {
  const { data, error } = await requireClient().auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.session;
}

/* Verify a token_hash + type (?token_hash=...&type=invite|recovery from a
   Supabase email template using {{ .TokenHash }}) and establish a real
   session. A THIRD callback style alongside hash-tokens (setSessionFromTokens)
   and PKCE code (exchangeCodeForSession) — some project email-template
   configurations use it instead, particularly for a native app's custom URL
   scheme, since Supabase's own hosted verify-redirect can only target an
   https:// site, not `kobciye://`. */
export async function verifyTokenHash(tokenHash, type) {
  const client = requireClient();
  // A template that emits token_hash without &type= would otherwise fail
  // outright. When type is missing, try the two password-setup types this
  // app actually sends (recovery first — the resend channel — then invite).
  // A type-mismatch lookup failure does not consume the token, so the
  // second attempt is safe.
  const typesToTry = type ? [type] : ['recovery', 'invite'];
  let lastError = null;
  for (const t of typesToTry) {
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: t });
    if (!error) return data.session;
    lastError = error;
  }
  throw lastError;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

/* ---- Phase 3: secure school onboarding via Edge Functions ----
   The mobile app NEVER creates schools or mutates invitations by writing
   tables directly. It calls these Edge Functions, which verify the JWT,
   re-check the caller's real role in the database, and perform the
   service-role work (Auth invite + email) server-side. */
const INVOKE_TIMEOUT_MS = 20000;

// Client-side-only reference id shown to the user for support purposes when
// the request never reached the server at all (network/timeout failure) — it
// will NOT appear in server logs, since the server never saw the request.
// Contrast with the server-generated correlation_id below, which DOES match
// server logs (the request did reach the function, which then failed).
function genClientRefId() {
  return 'c-' + Math.random().toString(36).slice(2, 10);
}

/* Classifies a functions.invoke() failure into a SAFE, non-sensitive result
   the UI can show directly — never a raw stack trace, header, token, or
   service-role detail. The previous version unconditionally awaited
   `error.context.json()`, which only works when context is a real Response
   (FunctionsHttpError/FunctionsRelayError); for FunctionsFetchError (the
   request never reached the server at all — offline, DNS failure, CORS,
   timeout…) context is the raw fetch exception with no `.json()` method, so
   that call silently threw, was swallowed by the try/catch, and fell back to
   the SDK's own generic "Failed to send a request to the Edge Function" —
   exactly the unhelpful message this replaces. */
export async function classifyInvokeError(error) {
  if (error instanceof FunctionsFetchError) {
    const isTimeout = error.context && error.context.name === 'AbortError';
    return isTimeout
      ? { code: 'timeout', message: 'Server-ku wuu raagay inuu jawaabo. Fadlan isku day mar kale.' }
      : { code: 'network_error', message: 'Xiriirka server-ka ayaa fashilmay. Hubi internet-ka kadib isku day mar kale.', refId: genClientRefId() };
  }
  if (error instanceof FunctionsRelayError) {
    return { code: 'service_unavailable', message: 'Adeegga server-ku hadda lama gaarsiin karo. Fadlan isku day mar kale.', refId: genClientRefId() };
  }
  if (error instanceof FunctionsHttpError) {
    const status = error.context && typeof error.context.status === 'number' ? error.context.status : null;
    let payload = null;
    try { payload = await error.context.json(); } catch (e) { /* non-JSON body — fall through to a safe generic message */ }
    const serverCode = payload && payload.error ? payload.error.code : null;
    const serverMessage = payload && payload.error ? payload.error.message : null;
    const correlationId = payload && payload.error ? payload.error.correlation_id : null;
    if (status === 401 || serverCode === 'unauthenticated') {
      return { code: 'unauthenticated', message: 'Fadhigaaga login-ka wuu dhacay. Fadlan mar kale gal.', correlationId };
    }
    if (status === 403 || serverCode === 'forbidden') {
      return { code: serverCode || 'forbidden', message: serverMessage || 'Ma haysatid ogolaansho aad ku samayso ficilkan.', correlationId };
    }
    if (serverCode && serverMessage) {
      // an already-safe, specific validation/business message the function wrote
      return { code: serverCode, message: serverMessage, correlationId };
    }
    return { code: 'server_error', message: 'Wax qalad server ah ayaa dhacay. Fadlan isku day mar kale.', correlationId };
  }
  return { code: 'unknown_error', message: 'Wax qalad ah ayaa dhacay. Fadlan isku day mar kale.', refId: genClientRefId() };
}

async function invokeFunction(name, body) {
  const client = requireClient();
  const { data, error } = await client.functions.invoke(name, { body: body || {}, timeout: INVOKE_TIMEOUT_MS });
  if (error) {
    const { code, message, correlationId, refId } = await classifyInvokeError(error);
    const err = new Error(message);
    err.code = code;
    if (correlationId) err.correlationId = correlationId;
    if (refId) err.refId = refId;
    throw err;
  }
  return data;
}

/* super_admin: create a school + trial + invite its first admin (one call).
   institutionType: 'school' | 'university' (required). schoolStage:
   'primary_middle' | 'secondary' (required when institutionType==='school',
   must be omitted/null for 'university') — see
   supabase/migrations/20260705000001_institution_type.sql.
   Returns { school_id, invitation_id, invitee_email, idempotent, institution_type, school_stage, email_channel }. */
export function createSchoolAndInvite({ name, slug, location, adminName, adminEmail, adminPhone, institutionType, schoolStage }) {
  return invokeFunction('create-school-and-invite-admin', {
    name, slug, location, admin_name: adminName, admin_email: adminEmail, admin_phone: adminPhone,
    // `|| null` (not `?? null`) deliberately — normalizes '' as well as
    // null/undefined to null, so a university call can never accidentally
    // send an empty string for school_stage (`??` alone would let '' through
    // unchanged, since it only coalesces null/undefined).
    institution_type: institutionType, school_stage: schoolStage || null,
  });
}

/* Forgot-password (public). The server decides whether a recovery email may
   actually be sent: an ACTIVE account gets one; a pending-invite-only account
   gets NOTHING (recovery must never bypass invitation activation); an unknown
   email gets NOTHING. The response is identical in every case — no email
   enumeration. */
export function requestPasswordResetSecure(email) {
  return invokeFunction('request-password-reset', { email });
}

export function resendSchoolInvite(invitationId) {
  return invokeFunction('resend-school-admin-invite', { invitation_id: invitationId });
}

export function cancelSchoolInvite(invitationId) {
  return invokeFunction('cancel-school-invite', { invitation_id: invitationId });
}

/* invited admin: accept (called AFTER the user has set their own password).
   invitationId is optional — the server finds the pending invite by the
   caller's verified email when omitted. */
export function acceptSchoolInvite(invitationId) {
  return invokeFunction('accept-school-invite', invitationId ? { invitation_id: invitationId } : {});
}

/* super_admin: real school list (RLS returns all schools for super_admin). */
export async function listSchools() {
  const { data, error } = await requireClient()
    .from('schools')
    .select('id, name, slug, location, logo_url, plan, status, institution_type, school_stage, created_at, subscriptions(status, trial_ends_at)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/* super_admin: invitations (RLS: only super_admin can read this table). */
export async function listInvitations() {
  const { data, error } = await requireClient()
    .from('school_invitations')
    .select('id, school_id, invitee_email, invitee_name, invitee_phone, status, email_delivery_status, expires_at, accepted_at, created_at, school:schools(name, slug)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/* Live counts for a school (all zero for a brand-new school). Each count is
   an independent head query so a new admin sees genuine zero states. The
   student count uses the canonical ACTIVE student_enrollments collection
   (never the raw students table, which can include transferred/inactive
   history) — the same source ClassesScreen/ClassDetail/School Management
   use, so every count agrees. */
export async function getSchoolCounts(schoolId) {
  // a non-uuid school id ("*", "all", a demo id, null) means "no real school
  // scope" — return honest zeroes rather than sending it to a uuid column.
  if (!supabase || !isUuid(schoolId)) return { students: 0, classes: 0, teachers: 0, subjects: 0 };
  const tables = ['classes', 'teachers', 'subjects'];
  const out = {};
  await Promise.all([
    ...tables.map(async (t) => {
      const { count, error } = await supabase.from(t)
        .select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
      if (error) throw error;
      out[t] = count || 0;
    }),
    (async () => {
      const { count, error } = await supabase.from('student_enrollments')
        .select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active');
      if (error) throw error;
      out.students = count || 0;
    })(),
  ]);
  return out;
}

/* ---- storage helpers ---- */
export function schoolLogoUrl(schoolId, ext = 'png') {
  if (!supabase) return null;
  const { data } = supabase.storage
    .from('school-logos')
    .getPublicUrl(`${schoolId}/logo.${ext}`);
  return data ? data.publicUrl : null;
}

export async function studentPhotoUrl(schoolId, studentId, ext = 'jpg') {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from('student-photos')
    .createSignedUrl(`${schoolId}/${studentId}.${ext}`, 3600);
  if (error) return null;
  return data.signedUrl;
}
