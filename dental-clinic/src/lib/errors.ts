/**
 * Turns a PostgREST/Postgres error into something a receptionist can act on.
 * Kept separate from the client so the demo build can reuse it.
 */
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
