// Where each Pointie site lives. On getpointie.com every site has its own domain;
// anywhere else (vercel.app previews, localhost) they are folders of one origin.
const PROD = {
  landing: 'https://getpointie.com/',
  app: 'https://app.getpointie.com/',
  store: 'https://store.getpointie.com/',
};
const LOCAL = { landing: '/business/', app: '/', store: '/merchant/' };
export const onProd = () => /(^|\.)getpointie\.com$/i.test(location.hostname);
// siteUrl('app', '#/tap/baan') → absolute URL of that site (+ optional hash/path)
export function siteUrl(site, suffix = '') {
  const base = onProd() ? PROD[site] : location.origin + LOCAL[site];
  return base + suffix;
}
