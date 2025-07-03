// 1. i18n 설정 파일 (예: /lib/i18n.js 또는 /i18n.js)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../public/locales/en/translation.json'
import ko from '../public/locales/ko/translation.json';
import vi from '../public/locales/vi/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      vi: { translation: vi },
    },
    lng: 'ko', // 초기 언어
    fallbackLng: 'ko',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;