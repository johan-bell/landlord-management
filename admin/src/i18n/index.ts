import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import fr from './locales/fr.json';

const stored =
    typeof localStorage !== 'undefined'
        ? localStorage.getItem('lm_admin_locale')
        : null;
const initial = stored === 'fr' ? 'fr' : 'en';

export const i18n = createI18n({
    legacy: false,
    locale: initial,
    fallbackLocale: 'en',
    messages: { en, fr },
});

export function setAdminLocale(code: 'en' | 'fr') {
    localStorage.setItem('lm_admin_locale', code);
    i18n.global.locale.value = code;
}
