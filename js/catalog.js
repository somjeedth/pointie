// Shared catalogue layer between the customer app and the merchant web.
// Demo backend: everything lives in this browser's localStorage, so both apps
// must be served from the same origin. Swap this module for a Supabase-backed
// one later; the rest of the code only talks to these functions.

const KEY_CATALOG = 'pointie.catalog.v1'; // { shops: { [id]: override | newShop } }
const KEY_EVENTS = 'pointie.events.v1'; // [{ id, type, shopId, customer, nick, at, ... }]
const MAX_EVENTS = 8000;

const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const loadCatalog = () => read(KEY_CATALOG, { shops: {} });
export const saveCatalog = (c) => write(KEY_CATALOG, c);

// Merchant-side patch of one shop (deep-merges `card`).
export function patchShop(id, patch) {
  const c = loadCatalog();
  const cur = c.shops[id] || {};
  c.shops[id] = { ...cur, ...patch, card: patch.card ? { ...(cur.card || {}), ...patch.card } : cur.card };
  if (!c.shops[id].card) delete c.shops[id].card;
  if (!saveCatalog(c)) return null; // storage full
  return c.shops[id];
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
export function newShopId(nameEn) {
  const base = slug(nameEn) || 'shop';
  const taken = new Set(Object.keys(loadCatalog().shops));
  let id = base; let n = 2;
  while (taken.has(id) || ['baan', 'jae', 'plant', 'climb', 'noodle', 'roast', 'book', 'clay'].includes(id)) id = `${base}-${n++}`;
  return id;
}

// Defaults for a shop created from the merchant web.
export function blankShop(id, { name, cat = 'cafe', area = 'อารีย์', nameEn = '' }) {
  const words = name.trim().split(/\s+/);
  return {
    id, created: true, name, initials: name.replace(/\s/g, '').slice(0, 2), cat, area, x: 200, y: 360,
    hours: 'ทุกวัน 09:00–18:00', closed: 'เปิดทุกวัน', openAt: 9, closeAt: 18, rating: 0, reviewsCount: 0,
    address: '', phone: '', promo: false, promoText: '', promoUntil: '', promoRule: null,
    card: {
      en: (nameEn || name).toUpperCase(), l1: words[0] || name, l2: words.slice(1).join(' '), need: 8,
      reward: 'ส่วนลด 50 บาท', bg: '#8C2F1C', photo: false, letter: '#FFD23F', glyph: 'star',
    },
    summary: '', tags: [], dist5: [0, 0, 0, 0, 0], photos: 0, stands: [], replies: {},
  };
}

// Distance label from the map pin (customer "me" dot sits at 172,442 on the 390px map).
export function distFromPin(x, y) {
  const m = Math.round(Math.hypot(x - 172, y - 442) * 3.2 / 50) * 50 || 50;
  return { distM: m, dist: m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${m} ม.` };
}

// Effective shop = built-in defaults (if any) + merchant override.
export function mergeShop(base, o) {
  if (!base && !(o && o.created)) return null;
  const s = base ? { ...base, ...(o || {}), card: { ...base.card, ...((o && o.card) || {}) } } : { ...o, card: { ...o.card } };
  if (s.created) Object.assign(s, distFromPin(s.x, s.y));
  if (s.promoRule === undefined) s.promoRule = s.id === 'baan' ? { type: 'double', days: [3] } : null;
  s.stands = s.stands || [];
  s.replies = s.replies || {};
  return s;
}

// Applied by js/data.js at load: mutates the built-in SHOPS list in place.
export function applyCatalog(shops) {
  const c = loadCatalog().shops || {};
  for (let i = 0; i < shops.length; i++) shops[i] = mergeShop(shops[i], c[shops[i].id]);
  for (const [id, o] of Object.entries(c)) if (o.created && o.name && !shops.some((s) => s.id === id)) shops.push(mergeShop(null, o));
  // paused shops disappear from the customer app
  for (let i = shops.length - 1; i >= 0; i--) if (shops[i].paused) shops.splice(i, 1);
}

// ---------- events ----------
export const loadEvents = () => read(KEY_EVENTS, []);
export function logEvent(ev) {
  const list = loadEvents();
  const e = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), ...ev };
  list.push(e);
  write(KEY_EVENTS, list.slice(-MAX_EVENTS));
  return e;
}
export function updateEvent(id, patch) {
  const list = loadEvents(); const e = list.find((x) => x.id === id);
  if (e) { Object.assign(e, patch); write(KEY_EVENTS, list); }
  return e;
}
export const saveEvents = (list) => write(KEY_EVENTS, list.slice(-MAX_EVENTS));
