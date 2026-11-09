import { applyCatalog, mergeShop } from './catalog.js';
import { applyDistances } from './geo.js';

// Static catalogue: shops, badges, levels, preferences.

export const CAT = {
  cafe: { label: 'คาเฟ่', color: '#FF7A2E' },
  food: { label: 'อาหาร', color: '#FFC83D' },
  shop: { label: 'ช้อปปิ้ง', color: '#3CC7B2' },
  act: { label: 'กิจกรรม', color: '#A592FF' },
};

const dots = (bg) => ({ bg, photo: false });

export const SHOPS = [
  {
    id: 'baan', name: 'บ้านกาแฟริมคลอง', initials: 'บก', cat: 'cafe', area: 'อารีย์', dist: '350 ม.', distM: 350,
    hours: 'ทุกวัน 08:00–20:00', closed: 'ปิดทุกวันจันทร์', closeAt: 20, openAt: 8, rating: 4.6, reviewsCount: 128,
    address: 'ซ.อารีย์ 1 พญาไท กรุงเทพฯ', phone: '02 123 4567',
    promo: true, promoText: 'แสตมป์ x2 ทุกวันพุธ', promoUntil: 'ถึง 30 พ.ย.',
    event: { title: 'เวิร์กช็อปดริปกาแฟเบื้องต้น', when: 'ส. 15 พ.ย. · 14:00', day: '15', mon: 'พ.ย.' },
    card: { en: 'BAAN KAFAE · ARI', l1: 'บ้านกาแฟ', l2: 'ริมคลอง', need: 10, reward: 'ลาเต้ฟรี 1 แก้ว', bg: '#1F5E45', photo: true, letter: '#FFD23F', glyph: 'cup' },
    summary: 'ส่วนใหญ่ชอบกาแฟคั่วเข้มและบรรยากาศริมคลอง นั่งทำงานได้นาน ขนมโฮมเมดได้รับคำชมบ่อย บางคนบอกว่าที่จอดรถน้อยช่วงเสาร์-อาทิตย์',
    tags: [['กาแฟคั่วเข้ม', 46, 1], ['นั่งทำงานได้', 38, 1], ['วิวริมคลอง', 31, 1], ['ขนมโฮมเมด', 22, 1], ['ที่จอดน้อย', 14, 0]],
    dist5: [72, 18, 6, 3, 1], photos: 48,
  },
  {
    id: 'jae', name: 'ข้าวมันไก่เจ๊หน่อย', initials: 'ขม', cat: 'food', area: 'อารีย์', dist: '600 ม.', distM: 600,
    hours: 'ทุกวัน 07:00–15:00', closed: 'ปิดวันอาทิตย์', closeAt: 15, openAt: 7, rating: 4.4, reviewsCount: 86,
    address: 'ซ.พหลโยธิน 7 พญาไท กรุงเทพฯ', phone: '08 9123 4567',
    promo: false,
    card: { en: 'KHAO MAN GAI · JAE NOI', l1: 'ข้าวมันไก่', l2: 'เจ๊หน่อย', need: 8, reward: 'ข้าวมันไก่ฟรี 1 จาน', ...dots('#8C2F1C'), letter: '#FFD23F', glyph: 'star' },
    summary: 'ไก่นุ่ม น้ำจิ้มเข้มข้น ได้ปริมาณเยอะคุ้มราคา ช่วงเที่ยงคิวยาว แนะนำมาก่อน 11 โมง',
    tags: [['ไก่นุ่ม', 40, 1], ['น้ำจิ้มเด็ด', 33, 1], ['คุ้มราคา', 25, 1], ['คิวยาวช่วงเที่ยง', 18, 0]],
    dist5: [64, 22, 9, 3, 2], photos: 21,
  },
  {
    id: 'plant', name: 'ร้านต้นไม้เล็ก', initials: 'ตม', cat: 'shop', area: 'อารีย์', dist: '1.2 กม.', distM: 1200,
    hours: 'ทุกวัน 10:00–19:00', closed: 'เปิดทุกวัน', closeAt: 19, openAt: 10, rating: 4.8, reviewsCount: 54,
    address: 'ซ.อารีย์ 4 พญาไท กรุงเทพฯ', phone: '09 8765 4321',
    promo: true, promoText: 'ตลาดนัดต้นไม้ 22 พ.ย. แสตมป์พิเศษ', promoUntil: 'ส. 22 พ.ย.',
    event: { title: 'ตลาดนัดต้นไม้ สะสมแสตมป์พิเศษ', when: 'ส. 22 พ.ย. · 09:00', day: '22', mon: 'พ.ย.' },
    card: { en: 'LITTLE PLANT SHOP', l1: 'ร้านต้นไม้', l2: 'เล็ก', need: 6, reward: 'กระถางเล็กฟรี 1 ใบ', ...dots('#0E6B5C'), letter: '#F6EEDF', glyph: 'star' },
    summary: 'ต้นไม้สุขภาพดี เจ้าของร้านใจดีให้คำแนะนำการดูแลละเอียด มีมุมถ่ายรูปน่ารัก',
    tags: [['ต้นไม้สวย', 28, 1], ['ให้คำแนะนำดี', 21, 1], ['มุมถ่ายรูป', 15, 1]],
    dist5: [82, 12, 4, 1, 1], photos: 33,
  },
  {
    id: 'climb', name: 'ปีนผาในเมือง', initials: 'ปน', cat: 'act', area: 'อารีย์', dist: '900 ม.', distM: 900,
    hours: 'ทุกวัน 12:00–22:00', closed: 'เปิดทุกวัน', closeAt: 22, openAt: 12, rating: 4.7, reviewsCount: 61,
    address: 'ถ.พหลโยธิน พญาไท กรุงเทพฯ', phone: '02 765 4321',
    promo: false,
    card: { en: 'CITY CLIMB', l1: 'ปีนผา', l2: 'ในเมือง', need: 5, reward: 'ปีนฟรี 1 รอบ', ...dots('#1E3A6B'), letter: '#F7F7F7', glyph: 'star' },
    summary: 'ผนังหลากหลายระดับ เหมาะทั้งมือใหม่และมือโปร ครูฝึกเป็นกันเอง อุปกรณ์สะอาด',
    tags: [['ครูใจดี', 26, 1], ['มือใหม่ได้', 22, 1], ['อุปกรณ์สะอาด', 17, 1], ['คนเยอะช่วงเย็น', 9, 0]],
    dist5: [74, 16, 6, 2, 2], photos: 19,
  },
  {
    id: 'noodle', name: 'ก๋วยเตี๋ยวเรือซอย 5', initials: 'กว', cat: 'food', area: 'อารีย์', dist: '700 ม.', distM: 700,
    hours: 'ทุกวัน 09:00–17:00', closed: 'ปิดวันพุธ', closeAt: 17, openAt: 9, rating: 4.3, reviewsCount: 102,
    address: 'ซ.อารีย์ 5 พญาไท กรุงเทพฯ', phone: '08 1111 2222',
    promo: true, promoText: 'ชาม 2 ได้แสตมป์เพิ่ม', promoUntil: 'ทุกวัน',
    card: { en: 'BOAT NOODLE · SOI 5', l1: 'ก๋วยเตี๋ยว', l2: 'เรือซอย 5', need: 8, reward: 'ก๋วยเตี๋ยวฟรี 1 ชาม', ...dots('#5A2A14'), letter: '#FFC83D', glyph: 'star' },
    summary: 'น้ำซุปเข้มข้นกลมกล่อม ชามเล็กกินได้หลายชาม ราคาน่ารัก',
    tags: [['น้ำซุปเข้ม', 37, 1], ['ราคาดี', 30, 1], ['ร้อนช่วงบ่าย', 11, 0]],
    dist5: [58, 25, 11, 4, 2], photos: 27,
  },
  {
    id: 'roast', name: 'Roast Lab', initials: 'RL', cat: 'cafe', area: 'อารีย์', dist: '450 ม.', distM: 450,
    hours: 'ทุกวัน 07:30–18:00', closed: 'เปิดทุกวัน', closeAt: 18, openAt: 7.5, rating: 4.5, reviewsCount: 77,
    address: 'ซ.อารีย์ 2 พญาไท กรุงเทพฯ', phone: '02 222 3333',
    promo: false,
    card: { en: 'ROAST LAB', l1: 'Roast', l2: 'Lab', need: 10, reward: 'อเมริกาโน่ฟรี 1 แก้ว', ...dots('#2B2B2B'), letter: '#FF9A5C', glyph: 'cup' },
    summary: 'เมล็ดคั่วเองหลายตัว บาริสต้าเล่าโปรไฟล์กาแฟเก่ง ที่นั่งน้อยแต่บรรยากาศดี',
    tags: [['เมล็ดคั่วเอง', 31, 1], ['บาริสต้าเก่ง', 24, 1], ['ที่นั่งน้อย', 12, 0]],
    dist5: [66, 20, 9, 3, 2], photos: 25,
  },
  {
    id: 'book', name: 'ร้านหนังสือมุมเงียบ', initials: 'มง', cat: 'shop', area: 'อารีย์', dist: '1.0 กม.', distM: 1000,
    hours: 'ทุกวัน 11:00–20:00', closed: 'ปิดวันอังคาร', closeAt: 20, openAt: 11, rating: 4.9, reviewsCount: 43,
    address: 'ซ.ประดิพัทธ์ 3 พญาไท กรุงเทพฯ', phone: '09 0000 1111',
    promo: false,
    card: { en: 'QUIET CORNER BOOKS', l1: 'ร้านหนังสือ', l2: 'มุมเงียบ', need: 6, reward: 'ส่วนลด 100 บาท', ...dots('#3B2A20'), letter: '#FF9A5C', glyph: 'star' },
    summary: 'หนังสือคัดมาอย่างดี มีมุมนั่งอ่านเงียบสงบ เจ้าของร้านแนะนำหนังสือเก่ง',
    tags: [['คัดหนังสือดี', 20, 1], ['เงียบสงบ', 18, 1], ['แนะนำเก่ง', 12, 1]],
    dist5: [88, 9, 2, 1, 0], photos: 14,
  },
  {
    id: 'clay', name: 'คลาสปั้นดินบ่ายวันเสาร์', initials: 'ปด', cat: 'act', area: 'อารีย์', dist: '1.4 กม.', distM: 1400,
    hours: 'ส.–อา. 13:00–17:00', closed: 'เปิดเฉพาะเสาร์-อาทิตย์', closeAt: 17, openAt: 13, rating: 4.8, reviewsCount: 38,
    address: 'ซ.ราชครู พญาไท กรุงเทพฯ', phone: '08 3333 4444',
    promo: true, promoText: 'สมัครคู่ลด 15%', promoUntil: 'ถึง 31 ธ.ค.',
    card: { en: 'CLAY CLASS', l1: 'ปั้นดิน', l2: 'บ่ายวันเสาร์', need: 5, reward: 'ลดคลาสถัดไป 50%', ...dots('#6B4A2B'), letter: '#F6EEDF', glyph: 'star' },
    summary: 'ครูสอนละเอียด ได้ชิ้นงานกลับบ้าน บรรยากาศสบายๆ เหมาะมากับเพื่อนหรือแฟน',
    tags: [['ครูสอนดี', 19, 1], ['ได้ของกลับบ้าน', 15, 1], ['ที่จอดน้อย', 6, 0]],
    dist5: [80, 14, 4, 1, 1], photos: 22,
  },
];
// Real coordinates around Ari (Bangkok) for the sample shops.
const COORDS = {
  baan: [13.78105, 100.54392], jae: [13.77921, 100.54203], plant: [13.77748, 100.54688], climb: [13.77645, 100.54145],
  noodle: [13.78236, 100.54712], roast: [13.78002, 100.54318], book: [13.78198, 100.54051], clay: [13.77566, 100.54803],
};
for (const s of SHOPS) { [s.lat, s.lng] = COORDS[s.id]; s.located = true; }
export const BASE_SHOPS = JSON.parse(JSON.stringify(SHOPS)); // pristine defaults (merchant web)
applyCatalog(SHOPS); // merchant edits (demo backend)
applyDistances(SHOPS); // distance from the user's last known location (or BTS Ari)
export const refreshDistances = () => applyDistances(SHOPS);
export const shopById = (id) => SHOPS.find((s) => s.id === id);
// Remote mode: swap the built-in list for the server catalogue (same shape).
export function replaceShops(list) {
  const norm = (list || []).map((s) => mergeShop({ ...s, card: s.card || {} }, null));
  SHOPS.splice(0, SHOPS.length, ...norm);
  applyDistances(SHOPS);
}

export const SAMPLE_REVIEWS = {
  baan: [
    { initial: 'ป', name: 'ปอนด์', lv: 12, ago: '2 วันก่อน', visits: 8, stars: 5, text: 'ลาเต้เข้มกำลังดี นั่งริมหน้าต่างเห็นคลองชิลมาก มาทำงานทุกเช้าวันอังคาร' },
    { initial: 'น', name: 'นุ่น', lv: 5, ago: '1 สัปดาห์ก่อน', visits: 2, stars: 4, text: 'บราวนี่อร่อย ร้านน่ารัก แต่วันเสาร์คนเยอะ หาที่จอดยากหน่อย' },
  ],
  jae: [{ initial: 'ต', name: 'ต้น', lv: 9, ago: '3 วันก่อน', visits: 15, stars: 5, text: 'ข้าวมันไก่ที่ดีที่สุดในย่าน น้ำจิ้มเต้าเจี้ยวคือเด็ด' }],
  plant: [{ initial: 'ฟ', name: 'ฟ้า', lv: 6, ago: '5 วันก่อน', visits: 3, stars: 5, text: 'ได้มอนสเตอร่ามา สุขภาพดีมาก เจ้าของร้านสอนวิธีดูแลละเอียด' }],
  climb: [{ initial: 'บ', name: 'บอส', lv: 11, ago: '1 วันก่อน', visits: 20, stars: 5, text: 'ผนังเปลี่ยนเส้นทางบ่อย ไม่เบื่อ ครูใจดี' }],
  noodle: [{ initial: 'ม', name: 'มิ้นท์', lv: 4, ago: '4 วันก่อน', visits: 6, stars: 4, text: 'น้ำตกเข้มข้น ชามเล็กกิน 5 ชามสบายๆ' }],
  roast: [{ initial: 'เ', name: 'เจ', lv: 8, ago: '2 วันก่อน', visits: 7, stars: 5, text: 'ฟิลเตอร์เอธิโอเปียหอมดอกไม้มาก บาริสต้าเล่าเรื่องเมล็ดสนุก' }],
  book: [{ initial: 'แ', name: 'แพร', lv: 7, ago: '1 สัปดาห์ก่อน', visits: 5, stars: 5, text: 'มุมอ่านหนังสือเงียบจริง ได้หนังสือดีๆ กลับบ้านทุกครั้ง' }],
  clay: [{ initial: 'ก', name: 'กิ๊ฟ', lv: 3, ago: '2 สัปดาห์ก่อน', visits: 1, stars: 5, text: 'ครั้งแรกที่ปั้นดิน ครูสอนใจเย็น ได้แก้วกลับบ้าน 1 ใบ' }],
};

export const LEVEL_TITLES = [
  [1, 'มือใหม่หัดแตะ'], [3, 'นักเก็บแสตมป์'], [5, 'ขาประจำ'], [6, 'นักสำรวจคาเฟ่'], [8, 'นักล่าคาเฟ่'], [10, 'ตำนานแห่งย่าน'],
];
export const levelTitle = (lv) => LEVEL_TITLES.filter(([n]) => lv >= n).pop()[1];
export const xpNeed = (lv) => Math.max(100, 150 * lv - 550);
// Member tiers by level. Perks marked (server) are enforced by Supabase functions.
export const TIERS = [
  { id: 'explorer', name: 'Explorer', th: 'นักสำรวจ', min: 1, color: '#A9A9A9', perks: ['สะสมแสตมป์ทุกร้านในบัตรเดียว', 'ภารกิจรายสัปดาห์ รับ XP'] },
  { id: 'regular', name: 'Regular', th: 'ขาประจำ', min: 5, color: '#3CC7B2', perks: ['+1 แสตมป์โบนัส ครั้งแรกที่ไปร้านใหม่'] },
  { id: 'pro', name: 'Pro', th: 'มือโปร', min: 10, color: '#A592FF', perks: ['ใช้โปรสมาชิก Pro ของร้านได้'] },
  { id: 'legend', name: 'Legend', th: 'ตำนาน', min: 15, color: '#FFC83D', perks: ['ใช้โปรระดับ Legend ของร้านได้', 'กรอบนามบัตรทอง'] },
];
export const tierFor = (lv) => [...TIERS].reverse().find((t) => lv >= t.min) || TIERS[0];
export const tierById = (id) => TIERS.find((t) => t.id === id) || TIERS[0];
export const nextTier = (lv) => TIERS.find((t) => t.min > lv) || null;
// Perks of a tier include everything below it.
export const tierPerks = (id) => TIERS.slice(0, TIERS.findIndex((t) => t.id === id) + 1).flatMap((t) => t.perks);

export const LEVEL_UNLOCKS = {
  2: [['frame', 'ปักหมุด Badge', 'โชว์บนนามบัตรได้ 1 อัน']],
  3: [['frame', 'กรอบนามบัตรใหม่', 'ลายจุดส้ม']],
  5: [['star', 'ระดับ Regular', '+1 แสตมป์ ร้านใหม่ครั้งแรก'], ['frame', 'ปักหมุด Badge +1', 'โชว์ได้ 2 อัน']],
  6: [['star', 'ปักหมุด Badge +1', 'โชว์ได้ 3 อัน']],
  8: [['frame', 'กรอบนามบัตรใหม่', 'ลายส้มทอง'], ['star', 'ปักหมุด Badge +1', 'โชว์ได้ 4 อัน']],
  10: [['star', 'ระดับ Pro', 'ใช้โปรสมาชิก Pro ของร้าน'], ['frame', 'ป้าย Pro', 'บนนามบัตรและรีวิว']],
  15: [['star', 'ระดับ Legend', 'ใช้โปรระดับ Legend'], ['frame', 'กรอบนามบัตรทอง', 'ลายทองประกาย']],
};
export const unlocksFor = (lv) => {
  if (LEVEL_UNLOCKS[lv]) return LEVEL_UNLOCKS[lv];
  const nt = nextTier(lv);
  return nt ? [['star', `ใกล้ระดับ ${nt.name}`, `อีก ${nt.min - lv} เลเวล`], ['frame', 'ฉายาใหม่', levelTitle(lv)]] : [['star', 'ระดับสูงสุดแล้ว', 'Legend'], ['frame', 'ฉายา', levelTitle(lv)]];
};

export const BADGES = [
  { id: 'coffee', name: 'คอกาแฟตัวจริง', kind: 'cup', tone: 'soft', test: (s) => catVisits(s, 'cafe') >= 10 },
  { id: 'streak3', name: 'ไฟไม่มอด 3 สัปดาห์', kind: 'flame', tone: 'gold', test: (s) => s.user.streak >= 3 },
  { id: 'ari', name: 'นักสำรวจย่านอารีย์', kind: 'map', tone: 'teal', test: (s) => Object.keys(s.cards).length >= 5 },
  { id: 'reviewer', name: 'รีวิวเวอร์ตัวจริง', kind: 'star', tone: 'violet', test: (s) => s.reviews.length >= 3 },
  { id: 'newbie', name: 'นักสำรวจหน้าใหม่', kind: 'compass', tone: 'teal', test: (s) => s.user.prefsDone },
  { id: 'first', name: 'แสตมป์แรก', kind: 'star', tone: 'soft', test: (s) => totalVisits(s) >= 1 },
  { id: 'redeem', name: 'แลกรางวัลแรก', kind: 'gift', tone: 'gold', test: (s) => s.redeemed.length >= 1 },
  { id: 'eater', name: 'สายกิน 10 ร้าน', kind: 'cafe', tone: 'gold', test: (s) => shopsInCat(s, 'food') >= 10 },
  { id: 'shopper', name: 'นักช้อปมือโปร', kind: 'tag', tone: 'teal', test: (s) => catVisits(s, 'shop') >= 15 },
  { id: 'active', name: 'สายกิจกรรม', kind: 'compass', tone: 'violet', test: (s) => catVisits(s, 'act') >= 10 },
  { id: 'legend', name: 'ตำนาน Lv.20', kind: 'flame', tone: 'soft', test: (s) => s.user.lv >= 20 },
];
function catVisits(s, cat) {
  return Object.entries(s.cards).reduce((n, [id, c]) => n + (shopById(id)?.cat === cat ? c.visits : 0), 0) + (s.user.seedCat?.[cat] || 0);
}
function shopsInCat(s, cat) { return Object.keys(s.cards).filter((id) => shopById(id)?.cat === cat).length; }
export function totalVisits(s) { return Object.values(s.cards).reduce((n, c) => n + c.visits, 0) + (s.user.seedVisits || 0); }
export function catVisitStats(s) {
  return Object.keys(CAT).map((k) => ({ key: k, label: CAT[k].label, n: catVisits(s, k) }));
}

export const PLACES = [
  ['cafe', 'คาเฟ่', 'กาแฟ ชา'], ['food', 'ร้านอาหาร', 'นั่งทาน'], ['street', 'สตรีทฟู้ด', 'ร้านริมทาง'],
  ['bakery', 'ขนม', 'เบเกอรี่ ของหวาน'], ['shop', 'ช้อปปิ้ง', 'แฟชั่น ของแต่งบ้าน'], ['plant', 'ร้านต้นไม้', 'ดอกไม้'],
  ['book', 'ร้านหนังสือ', 'เครื่องเขียน'], ['workshop', 'เวิร์กช็อป', 'กิจกรรม คลาส'], ['sport', 'กีฬา', 'ฟิตเนส ปีนผา'],
];
export const STYLES = [
  ['chill', 'สายชิล', 'นั่งนาน ทำงาน อ่านหนังสือ'], ['photo', 'สายถ่ายรูป', 'มุมสวย แสงดี ต้องได้รูป'],
  ['eat', 'สายกิน', 'อร่อยมาก่อน บรรยากาศรอง'], ['deal', 'สายล่าโปร', 'คุ้มต้องไป แสตมป์ x2 ต้องมา'],
  ['active', 'สายแอคทีฟ', 'เวิร์กช็อป กีฬา กิจกรรม'], ['new', 'สายลองของใหม่', 'ร้านเปิดใหม่ ไปก่อนใคร'],
];
export const AREAS = [
  ['ari', 'อารีย์'], ['siam', 'สยาม'], ['thonglor', 'ทองหล่อ-เอกมัย'], ['asok', 'อโศก'], ['silom', 'สีลม-สาทร'], ['ladprao', 'ลาดพร้าว'],
  ['chatuchak', 'จตุจักร'], ['bangna', 'บางนา'], ['thonburi', 'ฝั่งธนฯ'], ['nonthaburi', 'นนทบุรี'], ['oldtown', 'เมืองเก่า'], ['ratchada', 'รัชดา'],
];

export const AVATARS = [
  { src: 'img/pointie-point.png', label: 'D Point ชูมือ' },
  { src: 'img/pointie-wink.png', label: 'D Point ขยิบตา' },
  { src: 'img/pointie-jump.png', label: 'D Point กระโดด' },
  { src: 'img/pointie-wow.png', label: 'D Point ตกใจ' },
  { src: 'img/pointie-cheer.png', label: 'D Point ดีใจ' },
];

export const MISSIONS = [
  { id: 'new3', title: 'ลองคาเฟ่ใหม่ 3 ร้าน', xp: 100, goal: 3, icon: 'cafe', tone: 'soft' },
  { id: 'stamp5', title: 'สะสมแสตมป์ 5 ดวง', xp: 50, goal: 5, icon: 'star', tone: 'violet' },
  { id: 'review1', title: 'รีวิวร้านที่ไปจริง 1 ร้าน', xp: 30, goal: 1, icon: 'review', tone: 'teal' },
];

export const XP = { stamp: 20, review: 30, prefs: 30, signup: 50 };

// ---------------- generations (from the birth date given at sign-up) ----------------
export const GENS = {
  alpha: { name: 'Gen Alpha', years: '2013+' },
  z: { name: 'Gen Z', years: '1997–2012' },
  y: { name: 'Gen Y', years: '1981–1996' },
  x: { name: 'Gen X', years: '1965–1980' },
  boomer: { name: 'Boomer', years: '≤1964' },
};
export const GEN_ORDER = ['alpha', 'z', 'y', 'x', 'boomer'];
export const GEN_MIN_REVIEWS = 5; // below this a generation is not shown (anonymity + noise)
export function genOf(birthDate) {
  if (!birthDate) return null;
  const y = new Date(birthDate).getFullYear();
  if (y >= 2013) return 'alpha';
  if (y >= 1997) return 'z';
  if (y >= 1981) return 'y';
  if (y >= 1965) return 'x';
  return 'boomer';
}
export const genEmoji = (avg) => (avg >= 4.5 ? '😍' : avg >= 4 ? '😊' : avg >= 3.5 ? '🙂' : avg >= 3 ? '😐' : '😕');
export const genMood = (avg) => (avg >= 4.5 ? 'ชอบมาก' : avg >= 4 ? 'ชอบ' : avg >= 3.5 ? 'ค่อนข้างโอเค' : avg >= 3 ? 'เฉยๆ' : 'ยังไม่ปลื้ม');

// Sample written reviews per generation for the demo shops (shared by seed.sql and the local demo).
const GEN_REVIEW_TEXT = {
  cafe: {
    z: [['มุมถ่ายรูปเยอะมาก แสงสวย ลาเต้อาร์ตน่ารัก', 5], ['นั่งทำงานได้นาน ปลั๊กเยอะ แต่เพลงดังไปนิด', 4]],
    y: [['กาแฟคั่วเข้มกำลังดี บาริสต้าเป็นกันเอง แวะทุกเช้า', 5], ['ขนมโฮมเมดอร่อย ราคาสมเหตุสมผล', 4]],
    x: [['บรรยากาศสงบ นั่งคุยงานได้ แต่ที่จอดรถน้อย', 4], ['กาแฟดี แต่โต๊ะเตี้ยไปหน่อย นั่งนานแล้วเมื่อย', 3]],
    boomer: [['พนักงานสุภาพ แนะนำเมนูไม่หวานให้ ชอบมาก', 4], ['เมนูตัวหนังสือเล็ก อ่านยาก แต่กาแฟอร่อย', 3]],
  },
  food: {
    z: [['ราคาน่ารัก ปริมาณเยอะ กินอิ่มแน่นอน', 5], ['คิวยาวช่วงเที่ยง แต่รอได้ คุ้ม', 4]],
    y: [['รสชาติคงที่ทุกครั้ง มากินกับเพื่อนที่ทำงานบ่อย', 5], ['อร่อย แต่ช่วงเที่ยงหาที่นั่งยาก', 4]],
    x: [['รสชาติแบบดั้งเดิม เหมือนที่เคยกินตอนเด็ก', 5], ['สะอาด บริการเร็ว พาครอบครัวมาได้', 4]],
    boomer: [['ไม่เค็มเกินไป ขอปรับรสได้ เจ้าของใจดี', 5], ['อร่อยดี อยากให้มีเก้าอี้มีพนักพิง', 4]],
  },
  shop: {
    z: [['ของน่ารัก ถ่ายรูปลงสตอรี่ได้ทุกมุม', 5], ['ราคาสูงนิดนึง แต่ของคุณภาพดี', 4]],
    y: [['เจ้าของให้คำแนะนำดีมาก ได้ของถูกใจ', 5], ['มีของใหม่มาทุกเดือน แวะบ่อย', 4]],
    x: [['ของคุณภาพดี เลือกเป็นของฝากได้', 4], ['ร้านเล็กไปหน่อย เดินไม่ค่อยสะดวก', 3]],
    boomer: [['พนักงานใจเย็น อธิบายละเอียด', 5], ['ชอบที่มีของให้เลือกเยอะ', 4]],
  },
  act: {
    z: [['สนุกมาก มากับเพื่อนแล้วติดใจ', 5], ['ครูเป็นกันเอง เหมาะกับมือใหม่', 5]],
    y: [['คลายเครียดหลังเลิกงานได้ดีมาก', 5], ['คนเยอะช่วงเย็น ควรจองก่อน', 4]],
    x: [['ครูดูแลเรื่องความปลอดภัยดี', 4], ['หนักไปนิดสำหรับวัยนี้ แต่สนุก', 3]],
    boomer: [['ได้ลองอะไรใหม่ๆ ครูใจเย็นมาก', 4], ['อยากให้มีรอบที่ช้าลงสำหรับผู้สูงวัย', 3]],
  },
};
const GEN_NAMES = { z: ['เฟิร์น', 'ภูมิ', 'มุก', 'ไอซ์'], y: ['แพร', 'เจ', 'บีม', 'ฝน'], x: ['พี่ต้อย', 'พี่หน่อง', 'คุณเอก', 'คุณจิ๋ม'], boomer: ['ลุงชัย', 'ป้าศรี', 'ยายมาลี', 'ลุงพงษ์'] };
const GEN_LV = { z: [4, 9], y: [5, 12], x: [3, 8], boomer: [2, 6] };
export function sampleGenReviews(shop, shopIndex = 0) {
  const t = GEN_REVIEW_TEXT[shop.cat] || GEN_REVIEW_TEXT.cafe;
  const out = [];
  ['z', 'y', 'x', 'boomer'].forEach((g, gi) => {
    t[g].forEach(([text, stars], k) => {
      const names = GEN_NAMES[g]; const [a, b] = GEN_LV[g];
      out.push({ gen: g, name: names[(shopIndex + k) % names.length], lv: a + ((shopIndex * 3 + k * 5 + gi) % (b - a + 1)), stars, text, daysAgo: 2 + ((shopIndex * 7 + gi * 5 + k * 11) % 40) });
    });
  });
  return out;
}
