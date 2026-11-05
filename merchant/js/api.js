// Merchant data layer. Two backends behind the same functions:
//  - Supabase (remote): one `merchant_bundle` call fills an in-memory cache that
//    the (synchronous) views read; every write is an RPC followed by a refresh.
//  - localStorage demo (local): shares data with the customer app on the same origin.
import { BASE_SHOPS, SAMPLE_REVIEWS, CAT, tierFor, xpNeed } from '../../js/data.js';
const levelFromXp = (xp) => { let lv = 1; while (xp >= xpNeed(lv)) { xp -= xpNeed(lv); lv += 1; } return lv; };
import {
  loadCatalog, patchShop, newShopId, blankShop, mergeShop, loadEvents, saveEvents, updateEvent,
} from '../../js/catalog.js';
import * as remote from '../../js/remote.js';
import { siteUrl } from '../../js/sites.js';

let remoteMode = false;
let R = null; // cached merchant_bundle()
let remoteEmail = null;
export const isRemote = () => remoteMode;
const call = (name, args) => remote.rpc('merchant', name, args);

// Start-up: decide the backend and load the signed-in merchant's data.
export async function init() {
  if (remote.configured()) {
    try {
      await remote.rpc('merchant', 'merchant_samples_available', undefined, 8000); // reachability check (anon ok)
      remoteMode = true;
    } catch (e) { console.warn('[pointie] Supabase unavailable, merchant web in local demo mode', e); }
  }
  if (!remoteMode) { await ensureDemo(); return 'local'; }
  const s = await remote.session('merchant');
  remoteEmail = s?.user?.email || null;
  if (s) await refresh().catch((e) => { if (!/no_shop/.test(e.message)) console.warn(e); });
  return 'remote';
}
export async function refresh() {
  if (!remoteMode) return;
  try { R = await call('merchant_bundle', { p_days: 30 }); }
  catch (e) { R = null; throw e; }
}
export async function samplesAvailable() { return remoteMode ? call('merchant_samples_available') : []; }
export async function createShop({ shopName, shopNameEn, cat, area, sample }) {
  if (sample) await call('merchant_claim_sample', { p_shop: sample });
  else await call('merchant_create_shop', { p_name: shopName, p_name_en: shopNameEn, p_cat: cat, p_area: area });
  await refresh();
}
const errText = (m) => ({
  'Invalid login credentials': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'Email not confirmed': 'ยังไม่ได้ยืนยันอีเมล เปิดลิงก์ในอีเมลก่อนนะ',
  'User already registered': 'อีเมลนี้มีบัญชีแล้ว',
}[m] || m);

const KEY_MERCHANTS = 'pointie.merchants.v1';
const KEY_SESSION = 'pointie.merchant.session.v1';
const KEY_ACCOUNTS = 'pointie.accounts.v1'; // customer accounts (customer app)
const DEMO_EMAIL = 'owner@baan.cafe';
const DEMO_PASS = 'demo1234';
export const DEMO = { email: DEMO_EMAIL, password: DEMO_PASS };

const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

async function hash(email, pw) {
  const data = new TextEncoder().encode(`pointie:${email.toLowerCase()}:${pw}`);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0; for (const b of data) h = (h * 31 + b) >>> 0; return 'weak' + h; // non-secure context fallback
}

// ---------------- auth ----------------
export async function ensureDemo() {
  const m = read(KEY_MERCHANTS, {});
  if (!m[DEMO_EMAIL]) {
    m[DEMO_EMAIL] = { hash: await hash(DEMO_EMAIL, DEMO_PASS), shopId: 'baan', name: 'เจ้าของบ้านกาแฟ', role: 'owner', createdAt: new Date().toISOString() };
    write(KEY_MERCHANTS, m);
  }
  if (!loadEvents().some((e) => e.demo)) seedDemoEvents();
}
export const session = () => read(KEY_SESSION, null);
export function currentMerchant() {
  if (remoteMode) return remoteEmail ? { email: remoteEmail, shopId: R?.shop?.id || null, role: 'owner' } : null;
  const s = session(); if (!s) return null;
  const m = read(KEY_MERCHANTS, {})[s.email];
  return m ? { email: s.email, ...m } : null;
}
export async function login(email, password) {
  email = email.trim().toLowerCase();
  if (remoteMode) {
    const { data, error } = await remote.client('merchant').auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: errText(error.message) };
    remoteEmail = data.user?.email || email;
    await refresh().catch(() => {});
    return { ok: true };
  }
  const m = read(KEY_MERCHANTS, {})[email];
  if (!m || m.hash !== await hash(email, password)) return { ok: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  write(KEY_SESSION, { email });
  return { ok: true };
}
export async function signup({ email, password, name, shopName, shopNameEn, cat, area, sample }) {
  email = email.trim().toLowerCase();
  if (remoteMode) {
    const { data, error } = await remote.client('merchant').auth.signUp({ email, password, options: { data: { name: (name || '').trim() } } });
    if (error) return { ok: false, error: errText(error.message) };
    if (!data.session) return { ok: false, confirm: true, error: 'ส่งอีเมลยืนยันไปที่ ' + email + ' แล้ว เปิดลิงก์ในอีเมล แล้วกลับมาเข้าสู่ระบบเพื่อสร้างร้าน' };
    remoteEmail = data.user?.email || email;
    try { await createShop({ shopName, shopNameEn, cat, area, sample }); } catch (e) { return { ok: false, error: 'สร้างร้านไม่สำเร็จ: ' + e.message }; }
    return { ok: true, shopId: R?.shop?.id };
  }
  const all = read(KEY_MERCHANTS, {});
  if (all[email]) return { ok: false, error: 'อีเมลนี้มีบัญชีแล้ว' };
  const id = newShopId(shopNameEn || email.split('@')[0]);
  const c = loadCatalog();
  c.shops[id] = blankShop(id, { name: shopName.trim(), nameEn: shopNameEn.trim(), cat, area });
  localStorage.setItem('pointie.catalog.v1', JSON.stringify(c));
  all[email] = { hash: await hash(email, password), shopId: id, name: name.trim(), role: 'owner', createdAt: new Date().toISOString() };
  write(KEY_MERCHANTS, all);
  write(KEY_SESSION, { email });
  return { ok: true, shopId: id };
}
export async function logout() {
  if (remoteMode) { await remote.client('merchant').auth.signOut().catch(() => {}); R = null; remoteEmail = null; return; }
  try { localStorage.removeItem(KEY_SESSION); } catch { /* ignore */ }
}

// ---------------- shop ----------------
export function getShop(id) {
  if (remoteMode) {
    if (!R?.shop) return null;
    const s = mergeShop({ ...R.shop, card: R.shop.card || {} }, null);
    s.stands = R.stands || [];
    return s;
  }
  const base = BASE_SHOPS.find((s) => s.id === id);
  return mergeShop(base ? JSON.parse(JSON.stringify(base)) : null, loadCatalog().shops[id]);
}
export async function saveShop(id, patch) {
  if (remoteMode) { await call('merchant_update_shop', { p_patch: patch }); await refresh(); return true; }
  return patchShop(id, patch);
}
export { CAT };

// ---------------- stands (NFC / QR) ----------------
const token = () => Math.random().toString(36).slice(2, 8);
export async function addStand(shopId, name) {
  if (remoteMode) { await call('merchant_add_stand', { p_name: name || '' }); return refresh(); }
  const s = getShop(shopId);
  const stands = [...s.stands, { id: token(), token: token(), name: name || `สแตนด์ ${s.stands.length + 1}`, active: true, createdAt: new Date().toISOString() }];
  patchShop(shopId, { stands });
}
export async function updateStand(shopId, standId, patch) {
  if (remoteMode) { await call('merchant_update_stand', { p_id: standId, p_active: patch.active ?? null, p_rotate: false }); return refresh(); }
  const s = getShop(shopId);
  patchShop(shopId, { stands: s.stands.map((x) => (x.id === standId ? { ...x, ...patch } : x)) });
}
export async function rotateStand(shopId, standId) {
  if (remoteMode) { await call('merchant_update_stand', { p_id: standId, p_active: null, p_rotate: true }); return refresh(); }
  return updateStand(shopId, standId, { token: token(), rotatedAt: new Date().toISOString() });
}
export async function removeStand(shopId, standId) {
  if (remoteMode) { await call('merchant_delete_stand', { p_id: standId }); return refresh(); }
  const s = getShop(shopId);
  patchShop(shopId, { stands: s.stands.filter((x) => x.id !== standId) });
}
export const tapUrl = (shopId, stand) => siteUrl('app', `#/tap/${shopId}${stand ? `?s=${stand.token}` : ''}`);

// ---------------- events / analytics ----------------
const DAY = 86400000;
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
export function shopEvents(shopId) {
  if (remoteMode) return (R?.events || []).map((e) => ({ ...e, shopId }));
  return loadEvents().filter((e) => e.shopId === shopId);
}

export function stats(shopId, days = 30) {
  const ev = shopEvents(shopId);
  const now = Date.now();
  const since = now - days * DAY;
  const prevSince = since - days * DAY;
  const stamps = ev.filter((e) => e.type === 'stamp');
  const inWin = stamps.filter((e) => +new Date(e.at) >= since);
  const inPrev = stamps.filter((e) => { const t = +new Date(e.at); return t >= prevSince && t < since; });
  const today = stamps.filter((e) => dayKey(e.at) === dayKey(now)).length;
  const custWin = new Map();
  for (const e of inWin) custWin.set(e.customer, (custWin.get(e.customer) || 0) + 1);
  const firstSeen = new Map();
  for (const e of stamps) { const t = +new Date(e.at); if (!firstSeen.has(e.customer) || t < firstSeen.get(e.customer)) firstSeen.set(e.customer, t); }
  const newC = [...custWin.keys()].filter((c) => firstSeen.get(c) >= since).length;
  const returning = [...custWin.values()].filter((n) => n >= 2).length;
  const redeems = ev.filter((e) => e.type === 'redeem' && +new Date(e.at) >= since);
  const reviews = ev.filter((e) => e.type === 'review' && +new Date(e.at) >= since);
  // daily series (last 14 days)
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    series.push({ date: d, n: stamps.filter((e) => dayKey(e.at) === dayKey(d)).length });
  }
  // heatmap weekday x hour (8..21)
  const heat = Array.from({ length: 7 }, () => Array(14).fill(0));
  for (const e of inWin) { const d = new Date(e.at); const h = d.getHours() - 8; if (h >= 0 && h < 14) heat[d.getDay()][h]++; }
  // generations: unique customers and review scores in the window
  const genCust = {}; const genRev = {};
  const seen = new Set();
  for (const e of inWin) { if (!e.gen || seen.has(e.customer)) continue; seen.add(e.customer); genCust[e.gen] = (genCust[e.gen] || 0) + 1; }
  for (const e of reviews) { if (!e.gen) continue; (genRev[e.gen] ||= { n: 0, sum: 0 }).n++; genRev[e.gen].sum += e.stars; }
  return {
    genCust, genRev, genKnown: seen.size,
    taps: inWin.length, tapsPrev: inPrev.length, today, customers: custWin.size, newCustomers: newC,
    returnRate: custWin.size ? Math.round((returning / custWin.size) * 100) : 0,
    redeems: redeems.length, pendingRedeems: redemptions(shopId).filter((e) => e.status === 'pending').length,
    rating: reviews.length ? reviews.reduce((a, e) => a + e.stars, 0) / reviews.length : null, reviews: reviews.length,
    series, heat,
  };
}

export function customers(shopId) {
  const need = getShop(shopId).card.need;
  const map = new Map();
  const ev = shopEvents(shopId).slice().sort((a, b) => a.at.localeCompare(b.at));
  for (const e of ev) {
    if (!e.customer) continue;
    const c = map.get(e.customer) || { id: e.customer, nick: e.nick || 'ลูกค้า', visits: 0, have: 0, redeemed: 0, first: e.at, last: e.at, demo: !!e.demo };
    if (e.nick) c.nick = e.nick;
    if (e.lv) c.lv = e.lv;
    if (e.gen) c.gen = e.gen;
    if (e.type === 'stamp') { c.visits++; c.have = e.have ?? Math.min(need, c.have + (e.n || 1)); c.last = e.at; }
    if (e.type === 'redeem') { c.have = 0; c.redeemed++; }
    map.set(e.customer, c);
  }
  const lvOf = (c) => {
    if (remoteMode && R?.levels?.[c.id]) return R.levels[c.id];
    if (c.lv) return { lv: c.lv, tier: tierFor(c.lv).id };
    // demo/sample customers: estimate from visits (20 XP each + sign-up bonus)
    const lv = levelFromXp(50 + 20 * c.visits * 3);
    return { lv, tier: tierFor(lv).id, estimated: true };
  };
  return [...map.values()].map((c) => ({ ...c, need, left: need - c.have, ...lvOf(c) })).sort((a, b) => b.last.localeCompare(a.last));
}

// ---------------- redemptions ----------------
export function redemptions(shopId) {
  if (remoteMode) return R?.redemptions || [];
  return shopEvents(shopId).filter((e) => e.type === 'redeem').sort((a, b) => b.at.localeCompare(a.at));
}
export async function findPending(shopId, code) {
  if (remoteMode) return call('merchant_find_redemption', { p_code: code });
  return redemptions(shopId).find((e) => e.code === code && e.status === 'pending' && Date.now() - +new Date(e.at) < DAY);
}
export async function confirmRedeem(id, by) {
  if (remoteMode) { await call('merchant_set_redemption', { p_id: id, p_status: 'confirmed' }); return refresh(); }
  return updateEvent(id, { status: 'confirmed', confirmedAt: new Date().toISOString(), confirmedBy: by });
}
export async function voidRedeem(id, by) {
  if (remoteMode) { await call('merchant_set_redemption', { p_id: id, p_status: 'void' }); return refresh(); }
  return updateEvent(id, { status: 'void', confirmedAt: new Date().toISOString(), confirmedBy: by });
}

// ---------------- reviews ----------------
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const fmtDate = (iso) => { const d = new Date(iso); return `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear()}`; };
export function reviews(shopId) {
  if (remoteMode) return (R?.reviews || []).map((r) => ({ key: r.id, nick: r.nick || 'ลูกค้า', stars: r.stars, text: r.text, date: fmtDate(r.at), sample: r.sample, reply: r.reply || '' }));
  const replies = getShop(shopId)?.replies || {};
  const out = [];
  const accounts = read(KEY_ACCOUNTS, {});
  for (const [phone, acc] of Object.entries(accounts)) {
    for (const r of acc.reviews || []) {
      if (r.shopId === shopId) out.push({ key: phone, nick: acc.user?.nick || 'ลูกค้า', stars: r.stars, text: r.text, date: r.date, real: true, reply: replies[phone] || '' });
    }
  }
  (SAMPLE_REVIEWS[shopId] || []).forEach((r, i) => out.push({ key: 'sample:' + i, nick: r.name, stars: r.stars, text: r.text, date: r.ago, sample: true, reply: replies['sample:' + i] || '' }));
  return out;
}
export async function reply(shopId, key, text) {
  if (remoteMode) { await call('merchant_reply_review', { p_id: key, p_reply: text }); return refresh(); }
  const s = getShop(shopId);
  const replies = { ...s.replies };
  if (text.trim()) replies[key] = text.trim(); else delete replies[key];
  patchShop(shopId, { replies });
}

// ---------------- demo data ----------------
const NICKS = ['ปอนด์', 'นุ่น', 'ต้น', 'ฟ้า', 'บอส', 'มิ้นท์', 'เจ', 'แพร', 'กิ๊ฟ', 'เบล', 'ออม', 'ภูมิ', 'ใบเตย', 'ไอซ์', 'แบงค์', 'พลอย', 'ก้อง', 'น้ำ', 'ปาล์ม', 'เฟิร์น',
  'โอ๊ต', 'แนน', 'ตาล', 'กาย', 'ข้าวหอม', 'เอิร์ธ', 'มุก', 'ฝน', 'บีม', 'ปั้น', 'จูน', 'เกด', 'นัท', 'โบว์', 'ภีม', 'หลิว', 'ต่อ', 'นิว', 'แอน', 'อาร์ม'];
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function seedDemoEvents() {
  const r = rng(20261104);
  const out = loadEvents().filter((e) => !e.demo);
  const now = Date.now();
  const hours = { cafe: [8, 8, 9, 9, 10, 11, 13, 15, 16, 17], food: [11, 11, 12, 12, 12, 13, 13, 17, 18, 19], shop: [11, 13, 14, 15, 16, 17, 18, 19], act: [13, 15, 17, 18, 19, 19, 20, 20] };
  for (const s of BASE_SHOPS) {
    const pop = { baan: 7, jae: 9, noodle: 6, roast: 5, plant: 3, climb: 3, book: 2, clay: 2 }[s.id] || 3;
    const mix = { cafe: [['z', .45], ['y', .38], ['x', .13], ['boomer', .04]], food: [['z', .25], ['y', .35], ['x', .27], ['boomer', .13]],
      shop: [['z', .30], ['y', .37], ['x', .23], ['boomer', .10]], act: [['z', .52], ['y', .36], ['x', .10], ['boomer', .02]] }[s.cat];
    const pickGen = () => { let x = r(); for (const [g, w] of mix) { if ((x -= w) <= 0) return g; } return 'y'; };
    const lean = Object.fromEntries(['z', 'y', 'x', 'boomer'].map((g) => [g, r()]));
    const pool = [...NICKS, ...NICKS.map((n) => `${n} ${'กขคจชดตนบปพมรสอ'[Math.floor(r() * 15)]}.`)].map((n, i) => ({ id: `demo:${s.id}:${i}`, nick: n, gen: pickGen() }));
    const st = new Map();
    for (let d = 69; d >= 0; d--) {
      const day = new Date(now - d * DAY);
      const wk = day.getDay();
      const n = Math.round(pop * (0.6 + r() * 0.8) * (wk === 0 || wk === 6 ? 1.3 : 1));
      const used = new Set();
      for (let k = 0; k < n; k++) {
        const c = pool[Math.floor(Math.pow(r(), 1.25) * pool.length)];
        if (used.has(c.id)) continue; used.add(c.id);
        const hrs = hours[s.cat]; const h = hrs[Math.floor(r() * hrs.length)];
        const at = new Date(day); at.setHours(h, Math.floor(r() * 60), 0, 0);
        if (+at > now) continue;
        const cur = st.get(c.id) || { have: 0, visits: 0 };
        if (cur.have >= s.card.need) {
          out.push({ id: `d${out.length}`, demo: true, type: 'redeem', shopId: s.id, customer: c.id, nick: c.nick, reward: s.card.reward, code: String(1000 + Math.floor(r() * 9000)), status: 'confirmed', gen: c.gen, at: new Date(+at - 60000).toISOString() });
          cur.have = 0;
        }
        cur.have += 1; cur.visits += 1;
        st.set(c.id, cur);
        out.push({ id: `d${out.length}`, demo: true, type: 'stamp', shopId: s.id, customer: c.id, nick: c.nick, gen: c.gen, n: 1, have: cur.have, visit: cur.visits, firstVisit: cur.visits === 1, at: at.toISOString() });
        if (r() < 0.09) {
          const x = r() * 0.6 + lean[c.gen] * 0.55;
          out.push({ id: `d${out.length}`, demo: true, type: 'review', shopId: s.id, customer: c.id, nick: c.nick, gen: c.gen, stars: x > 0.75 ? 5 : x > 0.42 ? 4 : 3, at: new Date(+at + 3600000).toISOString() });
        }
      }
    }
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  saveEvents(out);
}
export function resetDemoData() {
  saveEvents(loadEvents().filter((e) => !e.demo));
  seedDemoEvents();
}
