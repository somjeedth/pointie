// Router & bootstrap for the Pointie customer web app.
import { store, ensureWeek, peekLevelUp } from './store.js';
import { nav, toast } from './ui.js';
import { welcome, login, otp, setup, invite, prefPlaces, prefStyle, prefLocation, returnTo, resetOtpScreen } from './screens-onboard.js';
import { home, notifications, map, scan, cards, profile, badges, reviews, settings, legal } from './screens-main.js';
import { tap, offline, storePage, redeemPage, levelup } from './screens-flow.js';

const ROUTES = [
  // [pattern, screen, { auth: needs login, public: reachable when logged in too }]
  [/^\/welcome$/, welcome, { guest: true }],
  [/^\/login$/, login, { guest: true }],
  [/^\/otp$/, otp, { guest: true }],
  [/^\/legal$/, legal, { open: true }],
  [/^\/tap\/(?<id>[\w-]+)$/, tap, { open: true }],
  [/^\/setup$/, setup, {}],
  [/^\/invite$/, invite, {}],
  [/^\/prefs\/places$/, prefPlaces, {}],
  [/^\/prefs\/style$/, prefStyle, {}],
  [/^\/prefs\/location$/, prefLocation, {}],
  [/^\/home$/, home, {}],
  [/^\/notifications$/, notifications, {}],
  [/^\/map$/, map, {}],
  [/^\/scan$/, scan, {}],
  [/^\/cards$/, cards, {}],
  [/^\/profile$/, profile, {}],
  [/^\/badges$/, badges, {}],
  [/^\/reviews$/, reviews, {}],
  [/^\/settings$/, settings, {}],
  [/^\/store\/(?<id>[\w-]+)$/, storePage, {}],
  [/^\/redeem\/(?<id>[\w-]+)$/, redeemPage, {}],
  [/^\/levelup$/, levelup, {}],
  [/^\/offline\/(?<id>[\w-]+)$/, offline, {}],
];
const LEVELUP_INTERCEPT = new Set(['/home', '/profile', '/cards', '/map']);

const app = document.getElementById('app');
let current = null; // { screen, cleanup, path }

function applyTheme() {
  document.documentElement.dataset.theme = store.theme;
  document.querySelector('meta[name="theme-color"]').content = store.theme === 'dark' ? '#000000' : '#FFF8F2';
}

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs || '') };
}

function resolve() {
  let { path, query } = parse();
  const me = store.me;
  if (path === '/' || path === '') path = me ? '/home' : '/welcome';
  if (path.startsWith('/u/')) path = me ? '/profile' : '/welcome';
  const hit = ROUTES.find(([re]) => re.test(path));
  if (!hit) return { redirect: me ? '/home' : '/welcome' };
  const [re, fn, opt] = hit;
  if (!me && !opt.guest && !opt.open) { returnTo.set(path); return { redirect: '/welcome' }; }
  if (me && opt.guest) return { redirect: '/home' };
  if (me && !me.user.setupDone && path !== '/setup' && !opt.open) return { redirect: '/setup' };
  if (me && LEVELUP_INTERCEPT.has(path) && peekLevelUp()) return { redirect: '/levelup' };
  return { fn, params: path.match(re).groups || {}, query, path };
}

// ---- In-place DOM patching ------------------------------------------------
// Re-renders within the same screen patch the existing DOM instead of
// replacing it, so CSS transitions actually run (carousel slide, pin select,
// toggles), images aren't re-decoded and scroll position/focus are kept.
function syncAttrs(from, to) {
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
}
function morph(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName || (from.id || to.id) && from.id !== to.id) {
    from.replaceWith(to); return;
  }
  if (from.nodeType === Node.TEXT_NODE || from.nodeType === Node.COMMENT_NODE) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  syncAttrs(from, to);
  if (from.tagName === 'INPUT' || from.tagName === 'TEXTAREA') {
    if (document.activeElement !== from && from.value !== (to.value ?? '')) from.value = to.value ?? '';
    if (from.tagName === 'INPUT') return;
  }
  morphChildren(from, to);
}
function morphChildren(from, to) {
  const a = [...from.childNodes], b = [...to.childNodes];
  b.forEach((nb, i) => { if (a[i]) morph(a[i], nb); else from.appendChild(nb); });
  for (let i = b.length; i < a.length; i++) a[i].remove();
}

// Listeners added inside mount() are tied to this AbortController and dropped
// on the next render, so patched (reused) elements never get duplicates.
let mountAbort = null;
function runMount(screen, root, ctx) {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const { signal } = mountAbort;
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const o = typeof opts === 'object' && opts ? { ...opts, signal } : { capture: !!opts, signal };
    return orig.call(this, type, fn, o);
  };
  try { return screen.mount?.(root, ctx) || null; } finally { EventTarget.prototype.addEventListener = orig; }
}

function render(keepState = false) {
  const r = resolve();
  if (r.redirect) { location.replace('#' + r.redirect); return; }
  const leaving = current && current.path !== r.path;
  if (current) {
    try { current.cleanup?.(); } catch { /* ignore */ }
    if (leaving) try { current.screen.leave?.(); } catch { /* ignore */ }
  }
  if (leaving && current.path === '/otp') resetOtpScreen();
  if (store.me) ensureWeek();
  const screen = r.fn(r.params, r.query);
  if (!screen || !screen.html) { current = null; return; }
  const markup = `<main class="screen ${screen.nav ? 'has-nav' : ''} ${screen.cls || ''}">${screen.html}</main>${screen.nav ? nav(screen.nav) : ''}`;
  const patch = keepState && !leaving && app.querySelector('.screen');
  if (patch) {
    const tpl = document.createElement('div');
    tpl.innerHTML = markup;
    tpl.querySelector('.screen').classList.add('no-enter');
    morphChildren(app, tpl);
  } else {
    app.innerHTML = markup;
  }
  const root = app.querySelector('.screen');
  current = { screen, path: r.path, cleanup: null };
  current.cleanup = runMount(screen, root, { rerender: () => render(true) });
  if (!patch) {
    const h1 = root.querySelector('h1');
    document.title = h1 ? `${h1.textContent.trim()} · Pointie` : 'Pointie';
  }
}

// Event delegation for [data-act] elements; actions live on the current screen.
app.addEventListener('click', (e) => {
  const backdrop = e.target.closest('.sheet-backdrop');
  if (backdrop && e.target === backdrop && backdrop.dataset.act === 'closeSheet') { backdrop.remove(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.dataset.act === 'closeSheet') return;
  if (el.dataset.act === 'shareCard') {
    const url = el.dataset.url;
    (navigator.share ? navigator.share({ title: 'นามบัตร Pointie', url }) : navigator.clipboard.writeText(url).then(() => toast('คัดลอกลิงก์นามบัตรแล้ว'))).catch(() => {});
    return;
  }
  const fn = current?.screen.actions?.[el.dataset.act];
  if (fn) { e.preventDefault(); fn.call(current.screen.actions, el, e); }
});
app.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') app.querySelector('.sheet-backdrop')?.remove();
});

window.addEventListener('hashchange', () => render(false));
window.addEventListener('rerender', () => render(true));
window.addEventListener('themechange', applyTheme);
window.addEventListener('offline', () => toast('ออฟไลน์อยู่ บางอย่างอาจยังบันทึกไม่ได้'));

applyTheme();
render(false);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
