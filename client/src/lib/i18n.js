import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import bn from '../locales/bn.json';
import ur from '../locales/ur.json';

// Active UI languages. To add another language later, drop a new JSON file in
// ../locales and append its code here (plus add it to LanguageSwitcher).
const supported = ['en', 'bn', 'ur'];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'bn', label: 'বাংলা', short: 'বাং' },
  { code: 'ur', label: 'اردو', short: 'اردو' }
];

const stored = typeof window !== 'undefined' ? window.localStorage.getItem('openlearn.language') : null;
const initialLanguage = supported.includes(stored) ? stored : 'en';

const rtlLanguages = new Set(['ur', 'ar', 'fa']);

export function applyDocumentLanguage(language) {
  if (typeof document === 'undefined') return;
  const lang = supported.includes(language) ? language : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = rtlLanguages.has(lang) ? 'rtl' : 'ltr';
  if (document.body) {
    document.body.classList.toggle('lang-urdu', lang === 'ur');
    document.body.classList.toggle('lang-bangla', lang === 'bn');
  }
  window.localStorage.setItem('openlearn.language', lang);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bn: { translation: bn },
    ur: { translation: ur }
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: supported,
  interpolation: { escapeValue: false },
  returnNull: false
});

applyDocumentLanguage(initialLanguage);

i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
