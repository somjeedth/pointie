// App state, persistence (localStorage) and domain actions.
import { SHOPS, shopById, xpNeed, MISSIONS, BADGES, XP, levelTitle } from './data.js';

const KEY_ACCOUNTS = 'pointie.accounts.v1';
const KEY_SESSION = 'pointie.session.v1';
const KEY_THEME = 'pointie.theme';
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
    notifications: [{ id: 1, text: 'ยินดีต้อนรับสู่ Pointie! แตะ NFC ที่ร้านเพื่อรับแสตมป์แรก', at: new Date().toISOString(), read: false }],
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
  theme: safe.get(KEY_THEME, 'dark'),
  get me() { return this.session && this.accounts[this.session.phone]; },
  get loggedIn() { return !!this.me; },
};
export const subscribe = (fn) => listeners.add(fn);
export function save() {
  safe.set(KEY_ACCOUNTS, store.accounts);
  safe.set(KEY_SESSION, store.session);
  safe.set(KEY_THEME, store.theme);
}
function commit() { save(); listeners.forEach((fn) => fn()); }

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

let otp = null; // { phone, code, sentAt, expiresAt, tries }
export function requestOtp(phone) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otp = { phone, code, sentAt: Date.now(), expiresAt: Date.now() + 5 * 60000, tries: 3 };
  return code;
}
export const otpInfo = () => otp;
export function verifyOtp(code) {
  if (!otp) return { ok: false, reason: 'expired' };
  if (Date.now() > otp.expiresAt) return { ok: false, reason: 'expired' };
  if (code !== otp.code) {
    otp.tries -= 1;
    if (otp.tries <= 0) { otp.expiresAt = 0; return { ok: false, reason: 'expired' }; }
    return { ok: false, reason: 'wrong', tries: otp.tries };
  }
  const phone = otp.phone; otp = null;
  const isNew = !store.accounts[phone];
  if (isNew) store.accounts[phone] = phone === DEMO_PHONE ? demoProfile() : blankProfile(phone);
  store.session = { phone };
  ensureWeek();
  commit();
  return { ok: true, isNew: isNew && phone !== DEMO_PHONE };
}
export function loginDemo() {
  if (!store.accounts[DEMO_PHONE]) store.accounts[DEMO_PHONE] = demoProfile();
  store.session = { phone: DEMO_PHONE };
  ensureWeek();
  commit();
}
export function resetDemo() {
  store.accounts[DEMO_PHONE] = demoProfile();
  store.session = { phone: DEMO_PHONE };
  commit();
}
export function logout() { store.session = null; commit(); }
export function deleteAccount() {
  if (!store.session) return;
  delete store.accounts[store.session.phone];
  store.session = null;
  commit();
}

// ---------- profile ----------
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
export function addXp(n) {
  const u = store.me.user;
  const from = u.lv;
  u.xp += n;
  while (u.xp >= xpNeed(u.lv)) { u.xp -= xpNeed(u.lv); u.lv += 1; }
  if (u.lv > from) {
    store.me.pending.levelUp = { from, to: u.lv, xp: u.xp, need: xpNeed(u.lv), oldTitle: levelTitle(from) };
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
export const isDoubleDay = (shop) => shop.id === 'baan' && new Date().getDay() === 3;

export function collectStamp(shopId) {
  const me = store.me; const shop = shopById(shopId);
  if (!me || !shop) return { ok: false, reason: 'unknown' };
  ensureWeek();
  let c = me.cards[shopId];
  if (c && c.lastStamp === todayKey()) return { ok: false, reason: 'already' };
  if (c && c.have >= shop.card.need) return { ok: false, reason: 'full' };
  const isNewShop = !c;
  if (!c) c = me.cards[shopId] = { have: 0, visits: 0, first: todayKey(), last: null, lastStamp: null, redeemedCount: 0 };
  const add = isDoubleDay(shop) ? 2 : 1;
  const before = c.have;
  c.have = Math.min(shop.card.need, c.have + add);
  c.visits += 1;
  c.last = todayKey();
  c.lastStamp = todayKey();
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

export function redeem(shopId) {
  const me = store.me; const shop = shopById(shopId); const c = me.cards[shopId];
  if (!c || c.have < shop.card.need) return false;
  c.have = 0;
  c.redeemedCount += 1;
  me.redeemed.unshift({ shopId, reward: shop.card.reward, at: new Date().toISOString() });
  checkBadges();
  commit();
  return true;
}

// ---------- reviews / favourites ----------
export const hasVisited = (shopId) => !!cardFor(shopId)?.visits;
export const myReview = (shopId) => store.me?.reviews.find((r) => r.shopId === shopId);
export function addReview(shopId, stars, text) {
  const me = store.me;
  if (!hasVisited(shopId)) return { ok: false };
  ensureWeek();
  const existing = myReview(shopId);
  if (existing) { Object.assign(existing, { stars, text, date: todayKey() }); commit(); return { ok: true, updated: true }; }
  me.reviews.unshift({ shopId, stars, text, date: todayKey() });
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
