// App state, persistence and domain actions.
// Two backends: Supabase (remote, the real one) and a self-contained localStorage demo.
// In remote mode the server owns cards, redemptions and reviews; the game state
// (XP, missions, badges, prefs) lives in the customer's `profile` JSON and is synced.
import { SHOPS, shopById, xpNeed, MISSIONS, BADGES, XP, levelTitle, replaceShops, tierFor, genOf } from './data.js';
import { logEvent } from './catalog.js';
import * as remote from './remote.js';
import { SMS_OTP } from './config.js';

const KEY_ACCOUNTS = 'pointie.accounts.v1';
const KEY_SESSION = 'pointie.session.v1';
const KEY_THEME = 'dpoint.theme';
export const DEMO_PHONE = '0812345678';

const safe = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// ---------- dates ----------
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t - y0) / 86400000 + 1) / 7)}`;
}
const prevWeekKey = () => weekKey(new Date(Date.now() - 7 * 86400000));
export const daysLeftInWeek = () => { const d = new Date().getDay(); return d === 0 ? 1 : 8 - d; };
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const thMonthYear = (iso) => { const d = new Date(iso); return `${TH_MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const thDateTime = (iso) => { const d = new Date(iso); return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function agoText(dateKey) {
  if (!dateKey) return '-';
  const days = Math.round((new Date(todayKey()) - new Date(dateKey)) / 86400000);
  if (days <= 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  if (days < 7) return `${days} วันก่อน`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
  return `${Math.floor(days / 30)} เดือนก่อน`;
}
export function untilMidnight() {
  const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((m - n) / 60000));
  return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
}
const daysAgoKey = (n) => todayKey(new Date(Date.now() - n * 86400000));

// ---------- profile factory ----------
function blankProfile(phone) {
  return {
    phone,
    user: {
      nick: '', avatar: 0, handle: '', joined: new Date().toISOString(), lv: 1, xp: 0, streak: 0, frame: 'default',
      prefsDone: false, prefs: { places: [], styles: [], areas: [] }, setupDone: false, seedVisits: 0, seedCat: {},
    },
    cards: {}, reviews: [], redeemed: [], favs: [], badges: [], pinned: [],
    week: { key: weekKey(), newCafes: [], stamps: 0, reviews: 0, claimed: [] },
    notifications: [{ id: 1, text: 'ยินดีต้อนรับสู่ D Point! แตะ NFC ที่ร้านเพื่อรับแสตมป์แรก', at: new Date().toISOString(), read: false }],
    pending: {},
  };
}

function demoProfile() {
  const p = blankProfile(DEMO_PHONE);
  Object.assign(p.user, {
    nick: 'มายด์', handle: 'mind.explores', avatar: null, joined: '2026-03-08T10:00:00', lv: 7, xp: 340, streak: 3,
    prefsDone: true, setupDone: true, prefs: { places: ['cafe', 'bakery', 'workshop'], styles: ['chill', 'photo'], areas: ['ari', 'siam'] },
    seedVisits: 21, seedCat: { cafe: 2, food: 3, shop: 1, act: 0 },
  });
  p.cards = {
    baan: { have: 6, visits: 11, first: '2026-03-08', last: daysAgoKey(3), lastStamp: daysAgoKey(3), redeemedCount: 0 },
    jae: { have: 8, visits: 9, first: '2026-03-20', last: daysAgoKey(2), lastStamp: daysAgoKey(2), redeemedCount: 0 },
    climb: { have: 3, visits: 3, first: '2026-08-02', last: daysAgoKey(9), lastStamp: daysAgoKey(9), redeemedCount: 0 },
    plant: { have: 2, visits: 2, first: '2026-09-14', last: daysAgoKey(12), lastStamp: daysAgoKey(12), redeemedCount: 0 },
    book: { have: 2, visits: 2, first: '2026-10-01', last: daysAgoKey(6), lastStamp: daysAgoKey(6), redeemedCount: 0 },
  };
  p.reviews = [
    { shopId: 'climb', stars: 5, text: 'ผนังสนุก ครูใจดีมาก', date: daysAgoKey(9) },
    { shopId: 'plant', stars: 5, text: 'ต้นไม้สวย ราคาน่ารัก', date: daysAgoKey(12) },
    { shopId: 'book', stars: 4, text: 'มุมอ่านเงียบดี', date: daysAgoKey(6) },
  ];
  p.favs = ['baan', 'jae', 'climb'];
  p.identity = { firstName: 'ณัฐชา', lastName: 'ตัวอย่าง', birthDate: '1999-03-08' };
  p.week = { key: weekKey(), newCafes: ['x1', 'x2'], stamps: 3, reviews: 0, claimed: [] };
  p.badges = ['coffee', 'streak3', 'ari', 'reviewer', 'first'];
  p.pinned = ['streak3', 'reviewer', 'ari'];
  p.notifications = [
    { id: 2, text: 'บัตรข้าวมันไก่เจ๊หน่อยครบ 8 ดวงแล้ว แลกรางวัลได้เลย!', at: new Date().toISOString(), read: false },
    { id: 1, text: 'บ้านกาแฟริมคลอง: แสตมป์ x2 ทุกวันพุธ', at: new Date().toISOString(), read: true },
  ];
  return p;
}

// ---------- store ----------
const listeners = new Set();
export const store = {
  accounts: safe.get(KEY_ACCOUNTS, {}),
  session: safe.get(KEY_SESSION, null), // { phone }
  theme: safe.get(KEY_THEME, 'light'),
  get me() { return this.session && this.accounts[this.session.phone]; },
  get loggedIn() { return !!this.me; },
};
export const subscribe = (fn) => listeners.add(fn);
export function save() {
  safe.set(KEY_ACCOUNTS, store.accounts);
  safe.set(KEY_SESSION, store.session);
  safe.set(KEY_THEME, store.theme);
}
function commit() { save(); listeners.forEach((fn) => fn()); if (remoteOk) schedulePush(); }

// ---------- remote (Supabase) ----------
let remoteOk = false;
export const isRemote = () => remoteOk;
const PROFILE_KEYS = ['favs', 'badges', 'pinned', 'week', 'notifications'];
const profilePayload = (acc) => ({ user: acc.user, ...Object.fromEntries(PROFILE_KEYS.map((k) => [k, k === 'notifications' ? acc[k].slice(0, 30) : acc[k]])) });
let pushTimer;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const me = store.me; if (!me) return;
    remote.rpc('customer', 'save_profile', { p_profile: profilePayload(me), p_nick: me.user.nick || null })
      .then((lvl) => { if (lvl?.lv && syncLevel(lvl)) { save(); window.dispatchEvent(new Event('rerender')); } })
      .catch((e) => console.warn('[pointie] save_profile failed', e));
  }, 700);
}
// Server state → local account object (keeps the same shape the screens use).
function hydrate(st) {
  const phone = st.phone || `u:${st.id}`;
  const prev = store.accounts[phone];
  const base = blankProfile(phone);
  const prof = st.profile || {};
  const acc = { ...base };
  for (const k of PROFILE_KEYS) if (prof[k] !== undefined) acc[k] = prof[k];
  acc.user = { ...base.user, ...(prof.user || {}) };
  if (st.nick) acc.user.nick = st.nick;
  acc.cards = {};
  for (const [id, c] of Object.entries(st.cards || {})) {
    acc.cards[id] = { have: c.have, visits: c.visits, first: c.first, last: c.last, lastStamp: c.lastStamp, redeemedCount: c.redeemedCount };
  }
  acc.redeemed = (st.redeemed || []).map((r) => ({ shopId: r.shopId, reward: r.reward, at: r.at, code: r.code, status: r.status }));
  acc.reviews = (st.reviews || []).map((r) => ({ shopId: r.shopId, stars: r.stars, text: r.text, date: r.date, reply: r.reply }));
  acc.pending = prev?.pending || {};
  acc.remoteId = st.id;
  acc.identity = st.identity ? { firstName: st.identity.firstName, lastName: st.identity.lastName, birthDate: st.identity.birthDate } : prev?.identity || null;
  if (st.level) Object.assign(acc.user, { lv: st.level.lv, xp: st.level.inLevel, totalXp: st.level.xp, tier: st.level.tier });
  store.accounts[phone] = acc;
  store.session = { phone };
}
// Called once at start-up. Returns 'remote' | 'local' | 'fallback'.
export async function bootRemote() {
  if (!remote.configured()) return 'local';
  try {
    replaceShops(await remote.rpc('customer', 'get_catalog', undefined, 8000));
    remoteOk = true;
  } catch (e) {
    console.warn('[pointie] Supabase unavailable, using local demo data', e);
    return 'fallback';
  }
  await finishOAuth();
  try {
    const s = await remote.session('customer');
    let st = s ? await remote.rpc('customer', 'my_state') : null;
    if (!st && s && oauthResult?.ok) {
      // first Google / Apple sign-in: create the customer row
      st = await remote.rpc('customer', 'customer_upsert', { p_nick: '', p_phone: null, p_profile: profilePayload(blankProfile(`u:${s.user.id}`)) });
    }
    if (st && s && oauthResult?.ok && !st.profile?.user?.setupDone && !st.identity?.birthDate) {
      // new, or came back before finishing sign-up: prefill the name step from Google / Apple
      const m = s.user?.user_metadata || {};
      const full = String(m.full_name || m.name || '').trim();
      const first = m.given_name || full.split(/\s+/)[0] || '';
      const last = m.family_name || full.split(/\s+/).slice(1).join(' ') || '';
      try { if (first || last) sessionStorage.setItem('dpoint.join', JSON.stringify({ nick: first.slice(0, 20), first, last, bd: '', bm: '', by: '' })); } catch { /* ignore */ }
    }
    if (st) { hydrate(st); ensureWeek(); save(); } else { store.session = null; save(); }
  } catch (e) { console.warn('[pointie] could not load profile', e); if (oauthResult?.ok) oauthResult = { ok: false, message: e.message }; }
  return 'remote';
}

// ---------- Google / Apple sign-in ----------
let oauthResult = null; // set when the page was opened as the OAuth redirect: { ok, provider?, message? }
export const takeOAuthResult = () => { const r = oauthResult; oauthResult = null; return r; };
export const oauthAvailable = () => remote.configured();
export async function startOAuth(provider) {
  try {
    const c = remote.client('customer');
    const { data, error } = await remote.timed(c.auth.signInWithOAuth({
      provider,
      options: { redirectTo: location.origin + location.pathname, skipBrowserRedirect: true, ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}) },
    }));
    if (error) return { ok: false, message: error.message };
    try { sessionStorage.setItem('dpoint.oauth', JSON.stringify({ provider, at: Date.now() })); } catch { /* ignore */ }
    location.assign(data.url);
    return { ok: true };
  } catch (e) { return { ok: false, message: e.message }; }
}
// Captured at module load, before any await, so nothing can change the address first.
const BOOT_URL = { search: location.search, hash: location.hash, href: location.href };
async function finishOAuth() {
  let q; try { q = new URLSearchParams(BOOT_URL.search); } catch { return; }
  const code = q.get('code'); const err = q.get('error_description') || q.get('error');
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('dpoint.oauth')); sessionStorage.removeItem('dpoint.oauth'); } catch { /* ignore */ }
  // Implicit-flow return (#access_token=…&refresh_token=…), e.g. from an older cached script or some in-app browsers
  let hp = null; try { hp = new URLSearchParams(BOOT_URL.hash.replace(/^#/, '')); } catch { /* ignore */ }
  if (!code && !err && hp && hp.get('access_token') && hp.get('refresh_token')) {
    history.replaceState(null, '', location.pathname);
    try {
      const c = remote.client('customer');
      const { data, error } = await remote.timed(c.auth.setSession({ access_token: hp.get('access_token'), refresh_token: hp.get('refresh_token') }));
      oauthResult = error ? { ok: false, message: error.message } : { ok: true, provider: data?.session?.user?.app_metadata?.provider };
    } catch (e) { oauthResult = { ok: false, message: e.message }; }
    return;
  }
  if (!code && !err && hp && (hp.get('error_description') || hp.get('error'))) {
    history.replaceState(null, '', location.pathname);
    oauthResult = { ok: false, message: hp.get('error_description') || hp.get('error') };
    return;
  }
  if (!code && !err) {
    // came back from Google / Apple without a code: say so instead of silently showing the sign-in page again
    if (pending && Date.now() - pending.at < 10 * 60000) {
      let opened = ''; try { opened = performance.getEntriesByType('navigation')[0]?.name || ''; } catch { /* ignore */ }
      oauthResult = { ok: false, message: `no sign-in code came back from ${pending.provider} · opened: ${opened || BOOT_URL.href} · from: ${document.referrer || '-'}` };
    }
    return;
  }
  history.replaceState(null, '', location.pathname + location.hash); // drop ?code=… from the address bar
  if (err) { oauthResult = { ok: false, message: err }; return; }
  try {
    const c = remote.client('customer');
    const { data, error } = await remote.timed(c.auth.exchangeCodeForSession(code));
    oauthResult = error ? { ok: false, message: error.message } : { ok: true, provider: data?.session?.user?.app_metadata?.provider };
  } catch (e) { oauthResult = { ok: false, message: e.message }; }
}
// How this account signs in, for the profile page: { provider, email }
export async function signInMethod() {
  if (!remoteOk) return null;
  try { const s = await remote.session('customer'); const u = s?.user; return u ? { provider: u.app_metadata?.provider || (u.is_anonymous ? 'anonymous' : 'phone'), email: u.email || '' } : null; } catch { return null; }
}
async function ensureAnonSession(fresh = false) {
  const c = remote.client('customer');
  if (fresh) await c.auth.signOut().catch(() => {});
  if (!fresh && await remote.session('customer')) return;
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new remote.RemoteError(error.message, 'auth');
}

export function setTheme(t) { store.theme = t; save(); }

// ---------- auth ----------
export const normalizePhone = (s) => {
  let d = String(s).replace(/\D/g, '');
  if (d.startsWith('66')) d = '0' + d.slice(2);
  if (d && !d.startsWith('0')) d = '0' + d;
  return d.slice(0, 10);
};
export const prettyPhone = (d) => d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
export const isValidPhone = (d) => /^0[689]\d{8}$/.test(d);

// Real SMS (config SMS_OTP + Supabase) or the on-screen simulated code.
// ?sms=1 (remembered for the tab) turns real SMS on for testing before SMS_OTP is switched on for everyone; ?sms=0 turns it off.
let smsForce = null;
try {
  const q = new URLSearchParams(location.search).get('sms');
  if (q === '1' || q === '0') sessionStorage.setItem('dpoint.sms', q);
  const v = sessionStorage.getItem('dpoint.sms'); if (v === '1' || v === '0') smsForce = v === '1';
} catch { /* ignore */ }
export const realSms = () => remoteOk && (smsForce ?? SMS_OTP);
const e164 = (d) => '+66' + d.slice(1);
let otp = null; // { phone, code (simulated only), sentAt, expiresAt, tries, real, link }
const OTP_TTL = 5 * 60000;
// → { ok: true } | { ok: false, message }
export async function requestOtp(phone) {
  if (!realSms()) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otp = { phone, code, sentAt: Date.now(), expiresAt: Date.now() + OTP_TTL, tries: 3 };
    return { ok: true };
  }
  const c = remote.client('customer');
  // Signed in on an anonymous (per-device) account → attach the number to it and keep its stamps.
  let link = false;
  try { const s = await remote.session('customer'); link = !!(store.me && s?.user?.is_anonymous); } catch { /* ignore */ }
  try {
    let error;
    if (link) {
      ({ error } = await remote.timed(c.auth.updateUser({ phone: e164(phone) })));
      // Number already belongs to another account → sign in to that one instead.
      if (error && /already|registered|exists/i.test(error.message)) { link = false; error = null; }
      else if (!error) { otp = { phone, sentAt: Date.now(), expiresAt: Date.now() + OTP_TTL, tries: 3, real: true, link }; return { ok: true }; }
    }
    if (!error) ({ error } = await remote.timed(c.auth.signInWithOtp({ phone: e164(phone), options: { channel: 'sms' } })));
    if (error) return { ok: false, message: error.message };
  } catch (e) { return { ok: false, message: e.message }; }
  otp = { phone, sentAt: Date.now(), expiresAt: Date.now() + OTP_TTL, tries: 3, real: true, link };
  return { ok: true };
}
export const otpInfo = () => otp;
const wrongCode = () => {
  otp.tries -= 1;
  if (otp.tries <= 0) { otp.expiresAt = 0; return { ok: false, reason: 'expired' }; }
  return { ok: false, reason: 'wrong', tries: otp.tries };
};
async function loadOrCreate(phone) {
  let st = await remote.rpc('customer', 'my_state');
  if (!st || (st.phone || '') !== phone) {
    st = await remote.rpc('customer', 'customer_upsert', { p_nick: st?.nick || '', p_phone: phone, p_profile: st ? null : profilePayload(blankProfile(phone)) });
  }
  if (store.session && store.session.phone !== (st.phone || `u:${st.id}`)) delete store.accounts[store.session.phone];
  hydrate(st); ensureWeek(); commit();
  return { ok: true, isNew: !store.me.user.setupDone };
}
export async function verifyOtp(code) {
  if (!otp) return { ok: false, reason: 'expired' };
  if (Date.now() > otp.expiresAt) return { ok: false, reason: 'expired' };
  if (otp.real) {
    try {
      const c = remote.client('customer');
      const { error } = await remote.timed(c.auth.verifyOtp({ phone: e164(otp.phone), token: code, type: otp.link ? 'phone_change' : 'sms' }));
      if (error) return /invalid|expired|token/i.test(error.message) ? wrongCode() : { ok: false, reason: 'server', message: error.message };
      const phone = otp.phone; otp = null; linking = false;
      return await loadOrCreate(phone);
    } catch (e) { return { ok: false, reason: 'server', message: e.message }; }
  }
  if (code !== otp.code) return wrongCode();
  const phone = otp.phone; otp = null;
  if (remoteOk) {
    try {
      await ensureAnonSession();
      return await loadOrCreate(phone);
    } catch (e) { return { ok: false, reason: 'server', message: e.message }; }
  }
  const isNew = !store.accounts[phone];
  if (isNew) store.accounts[phone] = phone === DEMO_PHONE ? demoProfile() : blankProfile(phone);
  store.session = { phone };
  ensureWeek();
  commit();
  return { ok: true, isNew: isNew && phone !== DEMO_PHONE };
}
// Signed-in user verifying their number from Settings (login/otp screens allowed while signed in).
let linking = false;
export const isLinking = () => linking && !!store.me;
export const setLinking = (v) => { linking = !!v; };
// Account still tied to one device (no verified phone yet)?
export async function needsPhoneLink() {
  if (!realSms() || !store.me) return false;
  try { return !!(await remote.session('customer'))?.user?.is_anonymous; } catch { return false; }
}
async function remoteDemo() {
  await ensureAnonSession(true);
  const p = demoProfile();
  await remote.rpc('customer', 'customer_upsert', { p_nick: p.user.nick, p_phone: DEMO_PHONE, p_profile: profilePayload(p) });
  hydrate(await remote.rpc('customer', 'seed_demo_cards'));
  ensureWeek(); commit();
}
export async function loginDemo() {
  if (remoteOk) return remoteDemo();
  if (!store.accounts[DEMO_PHONE]) store.accounts[DEMO_PHONE] = demoProfile();
  store.session = { phone: DEMO_PHONE };
  ensureWeek();
  commit();
}
export async function resetDemo() {
  if (remoteOk) return remoteDemo();
  store.accounts[DEMO_PHONE] = demoProfile();
  store.session = { phone: DEMO_PHONE };
  commit();
}
export async function logout() {
  linking = false;
  if (remoteOk) { clearTimeout(pushTimer); await remote.client('customer').auth.signOut().catch(() => {}); if (store.session) delete store.accounts[store.session.phone]; }
  store.session = null; save(); listeners.forEach((fn) => fn());
}
export async function deleteAccount() {
  if (!store.session) return;
  if (remoteOk) {
    clearTimeout(pushTimer);
    await remote.rpc('customer', 'delete_my_account');
    await remote.client('customer').auth.signOut().catch(() => {});
  }
  delete store.accounts[store.session.phone];
  store.session = null;
  commit();
}

// ---------- profile ----------
// Real name + birth date (13+). Kept apart from the synced game profile; shops never see it.
export const hasIdentity = () => !!store.me?.identity?.birthDate;
export const ageOf = (birthDate) => {
  const b = new Date(birthDate); const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
};
export async function saveIdentity({ firstName, lastName, birthDate }) {
  const me = store.me; if (!me) return { ok: false, reason: 'no_profile' };
  if (!firstName.trim() || !lastName.trim() || !birthDate) return { ok: false, reason: 'missing' };
  if (ageOf(birthDate) < 13) return { ok: false, reason: 'too_young' };
  if (remoteOk) {
    let r;
    try { r = await remote.rpc('customer', 'save_identity', { p_first: firstName, p_last: lastName, p_birth: birthDate }); }
    catch (e) { return { ok: false, reason: 'server', message: e.message }; }
    if (!r.ok) return r;
  }
  me.identity = { firstName: firstName.trim().slice(0, 60), lastName: lastName.trim().slice(0, 60), birthDate };
  save();
  return { ok: true };
}
export function completeSetup({ nick, avatar }) {
  const me = store.me; if (!me) return;
  me.user.nick = nick.trim().slice(0, 20);
  me.user.avatar = avatar;
  me.user.handle = me.user.handle || ('pointie' + me.phone.slice(-4));
  if (!me.user.setupDone) { me.user.setupDone = true; addXp(XP.signup); }
  commit();
}
export function updateProfile(patch) { Object.assign(store.me.user, patch); commit(); }
export function savePrefs(part) {
  const me = store.me; if (!me) return;
  Object.assign(me.user.prefs, part);
  commit();
}
export function finishPrefs() {
  const me = store.me; if (!me) return;
  if (!me.user.prefsDone) {
    me.user.prefsDone = true;
    addXp(XP.prefs);
    awardBadge('newbie');
    notify('ทำภารกิจแรกสำเร็จ! +30 XP');
  }
  commit();
}

// ---------- XP / levels ----------
// Server-computed level (remote mode). Returns true when something changed.
function syncLevel(info) {
  const me = store.me; if (!me || !info) return false;
  const u = me.user; const from = u.lv;
  const changed = u.lv !== info.lv || u.xp !== info.inLevel;
  Object.assign(u, { lv: info.lv, xp: info.inLevel, totalXp: info.xp, tier: info.tier });
  if (info.lv > from) {
    me.pending.levelUp = { from, to: info.lv, xp: info.inLevel, need: info.need, oldTitle: levelTitle(from), oldTier: tierFor(from).id };
    if (info.lv >= 8) u.frame = 'gold';
    notify(`เลเวลอัปเป็น Lv.${info.lv} · ${levelTitle(info.lv)}!`);
  }
  return changed;
}
export function addXp(n) {
  if (remoteOk) return; // XP is computed by the server from real activity
  const u = store.me.user;
  const from = u.lv;
  u.xp += n;
  while (u.xp >= xpNeed(u.lv)) { u.xp -= xpNeed(u.lv); u.lv += 1; }
  if (u.lv > from) {
    store.me.pending.levelUp = { from, to: u.lv, xp: u.xp, need: xpNeed(u.lv), oldTitle: levelTitle(from), oldTier: tierFor(from).id };
    if (u.lv >= 8) u.frame = 'gold';
    notify(`เลเวลอัปเป็น Lv.${u.lv} · ${levelTitle(u.lv)}!`);
  }
}
export function takeLevelUp() {
  const lu = store.me?.pending.levelUp; if (lu) { delete store.me.pending.levelUp; save(); }
  return lu;
}
export const peekLevelUp = () => store.me?.pending.levelUp;

function notify(text) {
  const me = store.me; if (!me) return;
  me.notifications.unshift({ id: Date.now() + Math.random(), text, at: new Date().toISOString(), read: false });
  me.notifications = me.notifications.slice(0, 30);
}
export function markNotificationsRead() { store.me.notifications.forEach((n) => { n.read = true; }); commit(); }

// ---------- weekly missions ----------
export function ensureWeek() {
  const me = store.me; if (!me) return;
  const k = weekKey();
  if (me.week.key === k) return;
  const wasActive = me.week.stamps > 0 && me.week.key === prevWeekKey();
  if (!wasActive) me.user.streak = 0;
  me.week = { key: k, newCafes: [], stamps: 0, reviews: 0, claimed: [] };
}
export function missionProgress(id) {
  const w = store.me.week;
  if (id === 'new3') return w.newCafes.length;
  if (id === 'stamp5') return w.stamps;
  if (id === 'review1') return w.reviews;
  return 0;
}
function checkMissions() {
  const me = store.me; const done = [];
  for (const m of MISSIONS) {
    if (!me.week.claimed.includes(m.id) && missionProgress(m.id) >= m.goal) {
      me.week.claimed.push(m.id);
      addXp(m.xp);
      notify(`ภารกิจสำเร็จ: ${m.title} +${m.xp} XP`);
      done.push(m);
    }
  }
  return done;
}

// ---------- badges ----------
function awardBadge(id) {
  const me = store.me;
  if (me.badges.includes(id)) return false;
  me.badges.push(id);
  if (me.pinned.length < pinSlots(me.user.lv)) me.pinned.push(id);
  return true;
}
export const pinSlots = (lv) => (lv >= 8 ? 4 : lv >= 6 ? 3 : lv >= 5 ? 2 : lv >= 2 ? 1 : 0);
function checkBadges() {
  const me = store.me; const got = [];
  for (const b of BADGES) if (!me.badges.includes(b.id) && b.test(me) && awardBadge(b.id)) { got.push(b); notify(`ได้ Badge ใหม่: ${b.name}`); }
  return got;
}
export function togglePin(id) {
  const me = store.me;
  if (me.pinned.includes(id)) me.pinned = me.pinned.filter((x) => x !== id);
  else if (me.pinned.length < pinSlots(me.user.lv)) me.pinned.push(id);
  else return false;
  commit();
  return true;
}

// ---------- stamps ----------
export function cardFor(shopId) { return store.me?.cards[shopId]; }
export function canStampToday(shopId) { return cardFor(shopId)?.lastStamp !== todayKey(); }
export const isDoubleDay = (shop) => !!(shop.promo && shop.promoRule?.type === 'double' && shop.promoRule.days?.includes(new Date().getDay()));

export async function collectStamp(shopId, token) {
  const me = store.me; const shop = shopById(shopId);
  if (!me || !shop) return { ok: false, reason: 'unknown' };
  ensureWeek();
  let c = me.cards[shopId];
  if (remoteOk) {
    let r;
    try { r = await remote.rpc('customer', 'collect_stamp', { p_shop: shopId, p_token: token || null }); }
    catch (e) { return { ok: false, reason: navigator.onLine ? 'server' : 'offline', message: e.message }; }
    if (!r.ok) {
      if (r.reason === 'already' && c) { c.lastStamp = todayKey(); commit(); }
      return r;
    }
    const isNewShop = !c;
    if (!c) c = me.cards[shopId] = { have: 0, visits: 0, first: todayKey(), last: null, lastStamp: null, redeemedCount: 0 };
    const before = c.have;
    Object.assign(c, { have: r.have, visits: r.visits, last: todayKey(), lastStamp: todayKey() });
    const res = stampRewards(me, shop, c, before, isNewShop);
    if (r.level) { const lvBefore = me.user.lv; syncLevel(r.level); res.leveled = me.user.lv > lvBefore; save(); }
    return { ...res, tierBonus: r.tierBonus || 0 };
  }
  if (c && c.lastStamp === todayKey()) return { ok: false, reason: 'already' };
  if (c && c.have >= shop.card.need) return { ok: false, reason: 'full' };
  const isNewShop = !c;
  if (!c) c = me.cards[shopId] = { have: 0, visits: 0, first: todayKey(), last: null, lastStamp: null, redeemedCount: 0 };
  const tierBonus = isNewShop && tierFor(me.user.lv).id !== 'explorer' ? 1 : 0; // Regular+ perk
  const add = (isDoubleDay(shop) ? 2 : 1) + tierBonus;
  const before = c.have;
  c.have = Math.min(shop.card.need, c.have + add);
  c.visits += 1;
  c.last = todayKey();
  c.lastStamp = todayKey();
  logEvent({ type: 'stamp', shopId, customer: me.phone, nick: me.user.nick, lv: me.user.lv, gen: genOf(me.identity?.birthDate), n: c.have - before, have: c.have, visit: c.visits, firstVisit: isNewShop });
  return { ...stampRewards(me, shop, c, before, isNewShop), tierBonus };
}
// XP, streak, missions and badges after a stamp (same for both backends).
function stampRewards(me, shop, c, before, isNewShop) {
  const shopId = shop.id;
  if (me.week.stamps === 0) me.user.streak += 1;
  me.week.stamps += c.have - before;
  if (isNewShop && shop.cat === 'cafe' && !me.week.newCafes.includes(shopId)) me.week.newCafes.push(shopId);
  const lvBefore = me.user.lv;
  addXp(XP.stamp);
  const missions = checkMissions();
  const badges = checkBadges();
  if (c.have >= shop.card.need) notify(`บัตร${shop.name}ครบแล้ว! แลก${shop.card.reward}ได้เลย`);
  commit();
  return { ok: true, added: c.have - before, have: c.have, full: c.have >= shop.card.need, visits: c.visits, missions, badges, leveled: me.user.lv > lvBefore, isNewShop };
}

export async function redeem(shopId) {
  const me = store.me; const shop = shopById(shopId); const c = me.cards[shopId];
  if (!c || c.have < shop.card.need) return false;
  if (remoteOk) {
    let r;
    try { r = await remote.rpc('customer', 'redeem_card', { p_shop: shopId }); } catch (e) { console.warn(e); return false; }
    if (!r.ok) return false;
    c.have = 0; c.redeemedCount += 1;
    me.redeemed.unshift({ shopId, reward: r.reward, at: r.at, code: r.code, status: 'pending' });
    checkBadges(); commit();
    return { code: r.code };
  }
  c.have = 0;
  c.redeemedCount += 1;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const ev = logEvent({ type: 'redeem', shopId, customer: me.phone, nick: me.user.nick, reward: shop.card.reward, code, status: 'pending' });
  me.redeemed.unshift({ shopId, reward: shop.card.reward, at: ev.at, code, eventId: ev.id });
  checkBadges();
  commit();
  return { code };
}

// ---------- reviews / favourites ----------
export const hasVisited = (shopId) => !!cardFor(shopId)?.visits;
export const myReview = (shopId) => store.me?.reviews.find((r) => r.shopId === shopId);
export async function addReview(shopId, stars, text) {
  const me = store.me;
  if (!hasVisited(shopId)) return { ok: false };
  ensureWeek();
  const existing = myReview(shopId);
  if (remoteOk) {
    let r;
    try { r = await remote.rpc('customer', 'submit_review', { p_shop: shopId, p_stars: stars, p_text: text }); }
    catch (e) { return { ok: false, reason: 'server', message: e.message }; }
    if (!r.ok) return r;
    if (existing) { Object.assign(existing, { stars, text, date: todayKey() }); if (r.level) syncLevel(r.level); commit(); return { ok: true, updated: true }; }
    me.reviews.unshift({ shopId, stars, text, date: todayKey() });
    me.week.reviews += 1; checkMissions(); checkBadges();
    if (r.level) syncLevel(r.level);
    commit();
    return { ok: true };
  }
  if (existing) { Object.assign(existing, { stars, text, date: todayKey() }); commit(); return { ok: true, updated: true }; }
  me.reviews.unshift({ shopId, stars, text, date: todayKey() });
  logEvent({ type: 'review', shopId, customer: me.phone, nick: me.user.nick, gen: genOf(me.identity?.birthDate), stars });
  me.week.reviews += 1;
  addXp(XP.review);
  checkMissions();
  checkBadges();
  commit();
  return { ok: true };
}
export function toggleFav(shopId) {
  const me = store.me;
  me.favs = me.favs.includes(shopId) ? me.favs.filter((x) => x !== shopId) : [...me.favs, shopId];
  commit();
  return me.favs.includes(shopId);
}

// ---------- pending stamps (offline) ----------
export function setPendingTap(shopId) { store.me.pending.tap = { shopId, at: Date.now() }; save(); }
export function pendingTap() { const t = store.me?.pending.tap; return t && Date.now() - t.at < 10 * 60000 ? t : null; }
export function clearPendingTap() { if (store.me) { delete store.me.pending.tap; save(); } }

export { SHOPS };
