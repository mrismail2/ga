import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * The browser only ever sees the anon key; every table is protected by RLS and
 * every money/stock mutation goes through a SECURITY DEFINER RPC. A
 * service-role key must never appear in this bundle.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Turns a PostgREST/Postgres error into something a receptionist can act on. */
export function readableError(error: unknown): string {
  if (!error) return 'Something went wrong.';
  const err = error as { message?: string; code?: string; details?: string };
  const message = err.message ?? String(error);

  if (err.code === '42501' || /row-level security|not authorised/i.test(message)) {
    return 'You do not have permission to do that.';
  }
  if (err.code === '23505') {
    if (/client_token/.test(message)) return 'This payment was already recorded.';
    return 'That record already exists.';
  }
  if (err.code === '23514' || /insufficient stock|usable unit/i.test(message)) {
    return message.replace(/^.*?:\s*/, '');
  }
  if (err.code === '22003' || /exceeds the remaining balance/i.test(message)) {
    return message.replace(/^.*?:\s*/, '');
  }
  if (/appointments_no_double_booking/.test(message)) {
    return 'That dentist already has an appointment overlapping this time.';
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return 'Cannot reach the server. Check the internet connection and try again.';
  }
  return message;
}
