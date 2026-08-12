import { format, isToday, isTomorrow, parseISO } from 'date-fns';

let currencySymbol = '$';
export function setCurrencySymbol(symbol: string) {
  currencySymbol = symbol || '$';
}

/**
 * These helpers are plain functions called from render code, so the active
 * language is registered once by <I18nProvider> instead of being threaded
 * through every call site.
 */
type FormatLanguage = 'en' | 'so';
let lang: FormatLanguage = 'so';
export function setFormatLanguage(next: FormatLanguage) {
  lang = next;
}

const MONTHS: Record<FormatLanguage, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  so: ['Jan', 'Feb', 'Mar', 'Abr', 'Maj', 'Jun', 'Lul', 'Agu', 'Seb', 'Okt', 'Nof', 'Dis'],
};

const WORDS = {
  en: {
    today: 'Today', tomorrow: 'Tomorrow', ago: 'ago', min: 'min',
    hourShort: 'h', minuteShort: 'm', years: 'yrs',
    second: 'second', seconds: 'seconds', minute: 'minute', minutes: 'minutes',
    hour: 'hour', hours: 'hours', day: 'day', days: 'days',
    month: 'month', months: 'months', year: 'year', years_: 'years',
  },
  so: {
    today: 'Maanta', tomorrow: 'Berri', ago: 'kahor', min: 'daq',
    hourShort: 'saac', minuteShort: 'daq', years: 'sano',
    second: 'ilbiriqsi', seconds: 'ilbiriqsi', minute: 'daqiiqad', minutes: 'daqiiqadood',
    hour: 'saac', hours: 'saacadood', day: 'maalin', days: 'maalmood',
    month: 'bil', months: 'bilood', year: 'sano', years_: 'sano',
  },
} as const;

const MONTHS_LONG: Record<FormatLanguage, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'],
  so: ['Jannaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maajo', 'Juun',
    'Luulyo', 'Agoosto', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Diseembar'],
};

const WEEKDAYS: Record<FormatLanguage, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  so: ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'],
};

const pad = (n: number) => String(n).padStart(2, '0');

function day(d: Date) { return pad(d.getDate()); }
function monthName(d: Date) { return MONTHS[lang][d.getMonth()]; }
function clock(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

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
  return d ? `${day(d)} ${monthName(d)} ${d.getFullYear()}` : '—';
}

/** Weekday + full month, for the dashboard heading. */
export function longDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${WEEKDAYS[lang][d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[lang][d.getMonth()]} ${d.getFullYear()}`;
}

export function dateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${day(d)} ${monthName(d)} ${d.getFullYear()}, ${clock(d)}` : '—';
}

export function timeOnly(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? clock(d) : '—';
}

export function relative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  const w = WORDS[lang];
  const seconds = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  // Largest unit that still gives a whole number, matching how staff speak.
  const units: [seconds: number, one: string, many: string][] = [
    [31_536_000, w.year, w.years_],
    [2_592_000, w.month, w.months],
    [86_400, w.day, w.days],
    [3600, w.hour, w.hours],
    [60, w.minute, w.minutes],
    [1, w.second, w.seconds],
  ];
  const [size, one, many] = units.find(([s]) => seconds >= s) ?? units[units.length - 1];
  const amount = Math.floor(seconds / size);
  return `${amount} ${amount === 1 ? one : many} ${w.ago}`;
}

export function smartDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  const w = WORDS[lang];
  if (isToday(d)) return `${w.today}, ${clock(d)}`;
  if (isTomorrow(d)) return `${w.tomorrow}, ${clock(d)}`;
  return `${day(d)} ${monthName(d)}, ${clock(d)}`;
}

export function waitedFor(since: string | null | undefined): string {
  const d = toDate(since);
  if (!d) return '—';
  const w = WORDS[lang];
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 60) return `${minutes} ${w.min}`;
  return `${Math.floor(minutes / 60)}${w.hourShort} ${minutes % 60}${w.minuteShort}`;
}

export function ageOf(patient: { date_of_birth: string | null; age_years: number | null }): string {
  if (patient.date_of_birth) {
    const dob = toDate(patient.date_of_birth);
    if (dob) {
      const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
      return `${years} ${WORDS[lang].years}`;
    }
  }
  return patient.age_years != null ? `${patient.age_years} ${WORDS[lang].years}` : '—';
}

const TITLES = ['dr.', 'dr', 'mr.', 'mrs.', 'ms.', 'prof.'];

/** Drops honorifics so "Dr. Amina Warsame" initials as AW, not DA. */
export function initials(name: string): string {
  return nameParts(name).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function nameParts(name: string): string[] {
  return name.split(' ').filter((w) => w && !TITLES.includes(w.toLowerCase()));
}

/** First name for greetings, ignoring any title. */
export function firstName(name: string | null | undefined): string {
  return name ? (nameParts(name)[0] ?? name) : '';
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
