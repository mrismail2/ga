import { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns';

let currencySymbol = '$';
export function setCurrencySymbol(symbol: string) {
  currencySymbol = symbol || '$';
}

export function money(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${currencySymbol}${n.toLocaleString('en-US', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateOnly(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy') : '—';
}

export function dateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy, HH:mm') : '—';
}

export function timeOnly(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'HH:mm') : '—';
}

export function relative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${formatDistanceToNowStrict(d)} ago` : '—';
}

export function smartDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  if (isToday(d)) return `Today, ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'HH:mm')}`;
  return format(d, 'dd MMM, HH:mm');
}

export function waitedFor(since: string | null | undefined): string {
  const d = toDate(since);
  if (!d) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function ageOf(patient: { date_of_birth: string | null; age_years: number | null }): string {
  if (patient.date_of_birth) {
    const dob = toDate(patient.date_of_birth);
    if (dob) {
      const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
      return `${years} yrs`;
    }
  }
  return patient.age_years != null ? `${patient.age_years} yrs` : '—';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Stable per-name accent so avatars do not change colour between renders. */
export function toneFor(seed: string): string {
  const tones = ['brand', 'ok', 'warn', 'danger', 'violet', 'teal', 'pink'];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}

export const isoDate = (d: Date = new Date()) => format(d, 'yyyy-MM-dd');
