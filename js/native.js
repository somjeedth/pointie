// Bridge to the iOS / Android app (Capacitor). On the web every function here is a no-op or returns null.
// Plugins: DPointNfc (our own, Core NFC "Ready to Scan" sheet), SocialLogin (@capgo, native Apple/Google),
// App (@capacitor/app, universal links /t/<shop>).
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config.js';

export const isNative = () => !!window.Capacitor?.isNativePlatform?.();

let core = null;
async function plugin(name) {
  if (!isNative()) return null;
  core = core || await import('./vendor/capacitor-core.js');
  return core.registerPlugin(name);
}

// ---------- NFC: native "Ready to Scan" sheet → the URL written on the tag ----------
export async function scanNfcTag() {
  const nfc = await plugin('DPointNfc');
  const r = await nfc.scan({ message: 'แตะด้านบนของ iPhone ที่ป้าย D Point' });
  return r?.url || '';
}

// ---------- Sign in with Apple / Google (native) → Supabase ID token sign-in ----------
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
let socialReady = false;
export async function nativeSignIn(provider) {
  const sl = await plugin('SocialLogin');
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
  const app = await plugin('App');
  if (!app) return;
  const open = (url) => { const route = tagUrlToRoute(url); if (route) go(route); };
  app.addListener('appUrlOpen', (e) => open(e.url));
  try { const l = await app.getLaunchUrl(); if (l?.url) open(l.url); } catch { /* ignore */ }
}
