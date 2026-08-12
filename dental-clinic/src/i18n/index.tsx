import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { dictionaries, en, type Language, type TranslationKey } from './dictionary';
import { setFormatLanguage } from '@/lib/format';

const STORAGE_KEY = 'dc_lang';

/** Somali is the clinic's working language; English is available as a toggle. */
const DEFAULT_LANGUAGE: Language = 'so';

interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  /** `t('key')`, with optional `{placeholder}` substitution. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Translates a database enum value, e.g. label('status', 'in_treatment'). */
  label: (group: string, value: string | null | undefined) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'en' || stored === 'so' ? stored : DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLanguage);

  // Dates and durations are formatted by plain functions, so the language has
  // to be registered before the first render that uses them.
  setFormatLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text: string = dictionaries[lang][key] ?? en[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
        }
      }
      return text;
    },
    [lang],
  );

  // Enum values arrive from the database as snake_case; fall back to a
  // readable version of the raw value if a translation is ever missing.
  const label = useCallback(
    (group: string, value: string | null | undefined) => {
      if (!value) return '—';
      const key = `${group}.${value}` as TranslationKey;
      const translated = dictionaries[lang][key] ?? en[key];
      if (translated) return translated;
      return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang: setLangState, t, label }),
    [lang, t, label],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export type { Language, TranslationKey };
