import { en } from './en';
import { so } from './so';

export type Language = 'en' | 'so';

const translations = { en, so };

let currentLang: Language = 'en';

export const setLanguage = (lang: Language) => {
  currentLang = lang;
};

export const t = (key: keyof typeof en): string => {
  return translations[currentLang][key] ?? translations.en[key] ?? key;
};

export { en, so };
