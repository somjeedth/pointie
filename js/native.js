// Bridge to the iOS / Android app (Capacitor). On the web every function here is a no-op or returns null.
// Plugins: DPointNfc (our own: iOS Core NFC "Ready to Scan" sheet / Android reader mode), SocialLogin (@capgo, native
// Apple/Google on iOS), Browser (@capacitor/browser, Google/Apple sign-in on Android), App (@capacitor/app, links /t/<shop>).
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config.js';

export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const isAndroid = () => isNative() && window.Capacitor?.getPlatform?.() === 'android';

let core = null;
const proxies = {};
// A Capacitor plugin proxy answers every property, `then` included, so it looks like a promise: returning it from an
// async function (or awaiting it) waits forever. Hand it out wrapped and unwrap it with `.p` at the call site.
async function plugin(name) {
  if (!isNative()) return null;
  core = core || await import('./vendor/capacitor-core.js');
  proxies[name] = proxies[name] || core.registerPlugin(name);
  return { p: proxies[name] };
}

// ---------- NFC: native "Ready to Scan" sheet → the URL written on the tag ----------
// Android: no system sheet, the scan screen itself is the prompt. Errors carry code NO_NFC / NFC_OFF / CANCELLED.
export async function scanNfcTag() {
  const nfc = (await plugin('DPointNfc'))?.p;
  const r = await nfc.scan({ message: 'แตะด้านบนของ iPhone ที่ป้าย D Point' });
  return r?.url || '';
}
export async function stopNfcScan() {
  if (!isAndroid()) return;
  try { await (await plugin('DPointNfc')).p.stop(); } catch { /* ignore */ }
}
export async function openNfcSettings() {
  try { await ((await plugin('DPointNfc'))?.p).openSettings(); } catch { /* ignore */ }
}

// ---------- Android: Google / Apple sign-in in a browser tab that comes back to com.dpointapp.th://auth ----------
export const APP_AUTH_REDIRECT = 'com.dpointapp.th://auth';
let authWait = null; // { resolve, reject } while a sign-in tab is open
export function takeAuthCallback(url) {
  if (!String(url || '').startsWith(APP_AUTH_REDIRECT) || !authWait) return false;
  authWait.resolve(url); authWait = null;
  plugin('Browser').then((w) => w?.p?.close?.()).catch(() => {});
  return true;
}
export async function browserSignIn(url) {
  const browser = (await plugin('Browser'))?.p;
  if (authWait) authWait.reject(new Error('cancelled'));
  const done = new Promise((resolve, reject) => { authWait = { resolve, reject }; });
  // Closing the tab without finishing = cancelled (wait a moment: the return link can arrive just after the tab closes)
  const h = await browser.addListener('browserFinished', () => setTimeout(() => { if (authWait) { authWait.reject(new Error('cancelled')); authWait = null; } }, 1500));
  try { await browser.open({ url, toolbarColor: '#F4F9FF' }); return await done; }
  finally { h?.remove?.(); }
}

// ---------- Sign in with Apple / Google (native) → Supabase ID token sign-in ----------
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
let socialReady = false;
export async function nativeSignIn(provider) {
  const sl = (await plugin('SocialLogin'))?.p;
  if (!socialReady) {
    await sl.initialize({
      apple: {},
      ...(GOOGLE_IOS_CLIENT_ID ? { google: { iOSClientId: GOOGLE_IOS_CLIENT_ID, iOSServerClientId: GOOGLE_WEB_CLIENT_ID || undefined, mode: 'online' } } : {}),
    });
    socialReady = true;
  }
  if (provider === 'google' && !GOOGLE_IOS_CLIENT_ID) throw new Error('Google sign-in is not set up in the app yet (GOOGLE_IOS_CLIENT_ID)');
  // Apple / Google get the SHA-256 of the nonce; Supabase gets the raw nonce and checks it against the token.
  const raw = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  const res = await sl.login({ provider, options: { scopes: ['email', 'name', 'profile'].filter((s) => provider === 'apple' ? s !== 'profile' : s !== 'name'), nonce: hashed } });
  const r = res?.result || {};
  const p = r.profile || {};
  return { idToken: r.idToken, nonce: raw, givenName: p.givenName || p.given_name || '', familyName: p.familyName || p.family_name || '', name: p.name || '' };
}

// ---------- Universal links: https://app.getpointie.com/t/<shop>?s=<token> → '#/tap/<shop>?s=<token>' ----------
export function tagUrlToRoute(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/t\/([a-z0-9-]+)\/?$/i);
    if (m) return `/tap/${m[1]}${u.search}`;
    const h = u.hash.match(/^#(\/tap\/[a-z0-9-]+(?:\?.*)?)$/i);
    if (h) return h[1];
  } catch { /* not a URL */ }
  return null;
}
export async function onAppLinks(go) {
  const app = (await plugin('App'))?.p;
  if (!app) return;
  const open = (url) => { if (takeAuthCallback(url)) return; const route = tagUrlToRoute(url); if (route) go(route); };
  app.addListener('appUrlOpen', (e) => open(e.url));
  try { const l = await app.getLaunchUrl(); if (l?.url) open(l.url); } catch { /* ignore */ }
}
