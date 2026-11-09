// Tiny i18n: Thai (default) / English. Use t('ไทย', 'English') inline in templates.
const KEY = 'dpoint.lang';
let lang = 'th';
try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'th'; } catch { /* ignore */ }
document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'th';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
}
export const t = (th, en) => (lang === 'en' ? en : th);
