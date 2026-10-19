import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import bn from '../locales/bn.json';
import hi from '../locales/hi.json';
import ur from '../locales/ur.json';

const supported = ['en', 'bn', 'hi', 'ur'];
const stored = typeof window !== 'undefined' ? window.localStorage.getItem('openlearn.language') : null;
const initialLanguage = supported.includes(stored) ? stored : 'en';

const rtlLanguages = new Set(['ur', 'ar', 'fa']);

export function applyDocumentLanguage(language) {
  if (typeof document === 'undefined') return;
  const lang = supported.includes(language) ? language : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = rtlLanguages.has(lang) ? 'rtl' : 'ltr';
  document.body.classList.toggle('lang-urdu', lang === 'ur');
  document.body.classList.toggle('lang-bangla', lang === 'bn');
  window.localStorage.setItem('openlearn.language', lang);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bn: { translation: bn },
    hi: { translation: hi },
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
