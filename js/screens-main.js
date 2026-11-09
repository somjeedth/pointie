// Main tab screens: Home, Map, Scan, My cards, Profile (+ sub pages).
import { icon } from './icons.js';
import {
  esc, go, toast, nav, avatarHtml, wordmark, toneStyle, cardBg, cardBgStyle, hasArt, letterHtml, cardEn, stampGrid, starsHtml, sheet, backBtn,
} from './ui.js';
import { getOrigin, setOrigin, locateMe, embedFor, mapsUrl } from './geo.js';
import { SHOPS, CAT, shopById, MISSIONS, BADGES, xpNeed, levelTitle, unlocksFor, totalVisits, catVisitStats, STYLES, TIERS, tierFor, nextTier, refreshDistances } from './data.js';
import {
  store, missionProgress, daysLeftInWeek, cardFor, thMonthYear, thDateTime, agoText, togglePin, pinSlots,
  markNotificationsRead, setTheme, logout, deleteAccount, resetDemo, DEMO_PHONE, prettyPhone, myReview, hasIdentity,
  needsPhoneLink, setLinking,
} from './store.js';

const shopStampText = (s) => { const c = cardFor(s.id); return c ? `${c.have}/${s.card.need} แสตมป์` : 'ยังไม่เคยไป'; };
const badgeIcon = (kind, size = 26) => icon({ cup: 'cafe', flame: 'flame', map: 'map', star: 'star', gift: 'sparkle', cafe: 'cafe', tag: 'tag', compass: 'compass' }[kind] || 'star', size);

// ================= HOME =================
let homeCat = 'all';
let homeQ = '';
export function home() {
  const me = store.me; const u = me.user;
  const need = xpNeed(u.lv);
  const unread = me.notifications.some((n) => !n.read);
  const fullCard = Object.entries(me.cards).find(([id, c]) => shopById(id) && c.have >= shopById(id).card.need);
  const hasCards = Object.keys(me.cards).length > 0;
  const m1 = MISSIONS[0]; const left1 = m1.goal - missionProgress(m1.id);
  let tip;
  if (fullCard) tip = `บัตร${shopById(fullCard[0]).name}ครบแล้ว ไปแลกรางวัลกันเลย!`;
  else if (!hasCards) tip = 'แตะ NFC ที่ร้านที่ร่วมรายการ รับแสตมป์ดวงแรกกันเลย!';
  else if (left1 > 0 && !me.week.claimed.includes(m1.id)) tip = `ลองคาเฟ่ใหม่อีกแค่ ${left1} ร้าน ก็ได้ +${m1.xp} XP แล้วนะ!`;
  else tip = `อีก ${need - u.xp} XP ก็เลเวลอัปแล้ว สู้ๆ!`;

  const missions = MISSIONS.map((m) => {
    const p = Math.min(m.goal, missionProgress(m.id)); const done = me.week.claimed.includes(m.id);
    return `<div class="card mission ${done ? 'done' : ''}">
      <div class="ic" style="${toneStyle(m.tone)}">${done ? icon('check', 22, 2.6) : icon(m.icon, 22)}</div>
      <div style="flex:1;min-width:0" class="col" >
        <div class="between" style="gap:8px"><span class="semi">${m.title}</span><span class="small bold ${done ? 'green' : 'violet'}" style="white-space:nowrap">${done ? 'สำเร็จ' : `+${m.xp} XP`}</span></div>
        <div class="row" style="gap:10px"><div class="bar" style="flex:1"><i style="width:${(p / m.goal) * 100}%;${done ? 'background:var(--green)' : ''}"></i></div><span class="small semi muted">${p}/${m.goal}</span></div>
      </div></div>`;
  }).join('');

  const events = SHOPS.filter((s) => s.promo || s.event).flatMap((s) => [
    s.promo && { day: s.promoRule?.days?.length === 1 ? 'ทุก' : '★', mon: s.promoRule?.days?.length === 1 ? 'วัน' + ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'][s.promoRule.days[0]] : 'โปร', tag: 'โปร', tone: 'soft', title: s.promoText, shop: s },
    s.event && { day: s.event.day, mon: s.event.mon, tag: 'กิจกรรม', tone: 'teal', title: s.event.title, shop: s },
  ].filter(Boolean)).slice(0, 4);

  return {
    nav: 'home',
    html: `
      <div class="row">
        <a href="#/profile" aria-label="โปรไฟล์" style="text-decoration:none">${avatarHtml(u)}</a>
        <div style="flex:1;min-width:0"><div class="h2" style="font-size:20px">สวัสดี ${esc(u.nick)}</div><div class="muted small">วันนี้ไปเก็บแสตมป์ที่ไหนดี?</div></div>
        <a class="icon-btn" href="#/notifications" aria-label="การแจ้งเตือน" style="width:44px;height:44px">${icon('bell')}${unread ? '<span class="dot"></span>' : ''}</a>
      </div>
      <label class="input-wrap">${icon('search')}<span class="sr-only">ค้นหา</span><input id="homeQ" type="search" placeholder="ค้นหาร้าน คาเฟ่ กิจกรรม" value="${esc(homeQ)}"></label>
      ${hasIdentity() ? '' : `<a class="card-soft row" href="#/setup?edit=1" style="text-decoration:none;color:inherit;gap:10px;padding:10px 14px;border:1px solid var(--soft-line)"><span style="font-size:22px">🎂</span><span class="small" style="flex:1"><b>เพิ่มชื่อและวันเกิด</b><br><span class="muted">ยืนยันตัวตน และให้รีวิวของคุณนับในสรุปตามเจน</span></span><span class="muted">${icon('chev', 18)}</span></a>`}
      <a class="level-card" href="#/profile">
        <div class="ring"></div>
        <div class="between">
          <div class="row" style="gap:10px"><div class="lv">Lv.${u.lv}</div><div><div class="bold" style="font-size:17px">${levelTitle(u.lv)} <span class="tier-chip">${tierFor(u.lv).name}</span></div><div class="small semi">อีก ${need - u.xp} XP จะเลเวลอัป</div></div></div>
          ${u.streak > 0 ? `<div class="streak">${icon('flame', 16)}<span>${u.streak} สัปดาห์ติด</span></div>` : ''}
        </div>
        <div class="bar"><i style="width:${Math.round((u.xp / need) * 100)}%"></i></div>
        <div class="between xs semi"><span>${u.xp} / ${need} XP</span><span>${nextTier(u.lv) ? `อีก ${nextTier(u.lv).min - u.lv} เลเวลถึงระดับ ${nextTier(u.lv).name}` : 'ระดับสูงสุด Legend'}</span></div>
      </a>
      <${fullCard ? `a href="#/cards?shop=${fullCard[0]}"` : 'div'} class="pointie-says" style="text-decoration:none;color:inherit">
        <img src="img/pointie-point.png" alt="D Point">
        <div class="col" style="gap:2px;flex:1;min-width:0"><span class="xs bold accent">D Point บอกว่า</span><span class="semi" style="font-size:14px;line-height:1.45">${esc(tip)}</span></div>
      </${fullCard ? 'a' : 'div'}>
      <section class="col">
        <div class="section-h"><h2>ภารกิจประจำสัปดาห์</h2><span class="pill soft">เหลือ ${daysLeftInWeek()} วัน</span></div>
        ${missions}
      </section>
      <section class="col">
        <div class="section-h"><h2>ร้านใกล้ตัว</h2><a class="link" href="#/map">ดูบนแมพ</a></div>
        <div class="hscroll" role="tablist">${[['all', 'ทั้งหมด'], ...Object.entries(CAT).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button class="chip ${homeCat === k ? 'on' : ''}" data-act="cat" data-k="${k}" role="tab" aria-selected="${homeCat === k}">${l}</button>`).join('')}</div>
        <div class="hscroll" id="shopList" style="gap:12px"></div>
      </section>
      <section class="col">
        <div class="section-h"><h2>โปรโมชั่นและกิจกรรม</h2></div>
        ${events.map((e) => `<a class="card event" href="#/store/${e.shop.id}">
          <div class="date"><b>${e.day}</b><span>${e.mon}</span></div>
          <div class="col" style="flex:1;min-width:0;gap:3px"><span class="tag" style="${toneStyle(e.tone)}">${e.tag}</span><span class="semi">${esc(e.title)}</span><span class="small muted">${esc(e.shop.name)}</span></div>
          <span class="muted">${icon('chev', 18)}</span></a>`).join('')}
      </section>`,
    mount(root) {
      const list = root.querySelector('#shopList');
      const draw = () => {
        const q = homeQ.trim();
        const shops = SHOPS.filter((s) => (homeCat === 'all' || s.cat === homeCat) && (!q || s.name.includes(q) || CAT[s.cat].label.includes(q) || s.area.includes(q)))
          .sort((a, b) => a.distM - b.distM);
        list.innerHTML = shops.length ? shops.map((s) => `<a class="shopcard" href="#/store/${s.id}">
          <div class="ph ${cardBg(s.card)}" style="${cardBgStyle(s.card)}"><span>[รูปร้าน]</span>${s.promo ? '<span class="pill primary ph-badge">มีโปร</span>' : ''}</div>
          <div class="col" style="padding:12px;gap:4px"><div class="bold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div><div class="small muted">${CAT[s.cat].label} · ${s.dist}</div>
          <div class="row small semi accent" style="gap:6px;margin-top:4px">${icon('star', 14)}<span>${shopStampText(s)}</span></div></div></a>`).join('')
          : `<div class="empty-note">ไม่พบร้านที่ตรงกับ “${esc(q)}”</div>`;
      };
      draw();
      root.querySelector('#homeQ').addEventListener('input', (e) => { homeQ = e.target.value; draw(); });
    },
    actions: { cat(el) { homeCat = el.dataset.k; window.dispatchEvent(new Event('rerender')); } },
  };
}

// ================= NOTIFICATIONS =================
export function notifications() {
  const me = store.me;
  const list = me.notifications;
  setTimeout(() => markNotificationsRead(), 1500);
  return {
    html: `<div class="topbar">${backBtn('/home')}<h1>การแจ้งเตือน</h1></div>
      ${list.length ? list.map((n) => `<div class="card row" style="align-items:flex-start">
        <span class="initials sm" style="${n.read ? '' : 'background:var(--primary);color:var(--on-primary)'}">${icon('bell', 18)}</span>
        <div class="col" style="gap:2px;flex:1"><span class="semi" style="font-size:14px">${esc(n.text)}</span><span class="xs muted">${thDateTime(n.at)}</span></div></div>`).join('')
        : '<div class="empty-note">ยังไม่มีการแจ้งเตือน</div>'}`,
  };
}

// ================= MAP =================
let mapState = { cat: 'all', promo: false, sel: 'baan', q: '' };
export function map() {
  const s = mapState;
  const visible = SHOPS.filter((sh) => (s.cat === 'all' || sh.cat === s.cat) && (!s.promo || sh.promo) && (!s.q || sh.name.includes(s.q) || (sh.area || '').includes(s.q)))
    .sort((a, b) => (a.distM ?? 1e9) - (b.distM ?? 1e9));
  const selId = visible.find((v) => v.id === s.sel) ? s.sel : visible[0]?.id;
  const sel = shopById(selId);
  const chip = (key, label, color) => {
    const on = key === 'promo' ? s.promo : s.cat === key;
    return `<button class="chip ${on ? 'on' : ''}" data-act="chip" data-k="${key}" aria-pressed="${on}" style="height:38px;padding:0 14px;font-weight:600">${color ? `<span class="cdot" style="background:${color}"></span>` : ''}${label}</button>`;
  };
  const shopChips = visible.map((sh) => `<button class="shop-chip ${sh.id === selId ? 'on' : ''}" data-act="sel" data-id="${sh.id}" aria-pressed="${sh.id === selId}">
      <span class="cdot" style="background:${CAT[sh.cat].color}"></span><span class="nm">${esc(sh.name)}</span><span class="xs muted">${sh.dist || ''}</span>${sh.promo ? '<span class="pro">โปร</span>' : ''}</button>`).join('');
  const c = sel && cardFor(sel.id);
  const origin = getOrigin();
  return {
    nav: 'map', cls: 'flush',
    html: `<div class="map gmap">
        ${sel ? `<iframe class="gframe" title="แผนที่ ${esc(sel.name)}" src="${embedFor(sel)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>` : '<div class="gframe empty"></div>'}
      </div>
      <div class="map-top">
        <div class="row" style="gap:8px">
          <label class="input-wrap">${icon('search')}<span class="sr-only">ค้นหาร้าน</span><input id="mapQ" placeholder="ค้นหาร้านหรือย่าน" value="${esc(s.q)}"></label>
          <button class="icon-btn" style="width:48px;height:48px" data-act="filters" aria-label="ล้างตัวกรอง">${icon('filter')}</button>
        </div>
        <div class="hscroll">${chip('all', 'ทั้งหมด')}${chip('promo', 'มีโปร', 'var(--ink)')}${Object.entries(CAT).map(([k, v]) => chip(k, v.label, v.color)).join('')}</div>
        <div class="hscroll shop-chips" aria-label="ร้านใกล้คุณ ${visible.length} ร้าน">${shopChips}</div>
      </div>
      ${sel ? `<button class="icon-btn round map-locate" style="bottom:calc(${sel.promo ? 300 : 256}px + env(safe-area-inset-bottom));width:44px;height:44px;color:#4C9BFF" data-act="locate" aria-label="ใช้ตำแหน่งของฉันคำนวณระยะทาง">${icon('locate')}</button>
      <div class="map-sheet">
        <div class="row" style="align-items:flex-start">
          <div class="ph ${cardBg(sel.card)}" style="${cardBgStyle(sel.card)}width:72px;height:72px;border-radius:14px;flex:none;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.7)">${hasArt(sel.card) ? '' : esc(sel.initials || '')}</div>
          <div class="col" style="gap:3px;flex:1;min-width:0">
            <div class="bold" style="font-size:16px">${esc(sel.name)}</div>
            <div class="small muted">${CAT[sel.cat].label} · ${sel.dist || sel.area} ${origin.real ? 'จากคุณ' : 'จาก BTS อารีย์'} · <span class="green semi">${openText(sel)}</span></div>
            <div class="row small" style="gap:8px"><span class="row semi" style="gap:3px;color:var(--gold)">${icon('star', 14)}${sel.rating}</span><span class="pill soft">${c ? `${c.have}/${sel.card.need} แสตมป์` : 'ยังไม่เคยไป'}</span></div>
          </div>
        </div>
        ${sel.promo ? `<div class="row card-soft" style="padding:8px 10px;gap:8px;border-radius:12px"><span class="tag" style="background:var(--primary);color:var(--on-primary)">โปร</span><span class="small semi">${esc(sel.promoText)}</span></div>` : ''}
        <div class="btns"><a class="btn btn-ghost btn-sm" style="height:44px" href="${mapsUrl(sel)}" target="_blank" rel="noopener">${icon('nav', 16)}นำทาง</a><a class="btn btn-primary btn-sm grow" style="height:44px" href="#/store/${sel.id}">ดูร้าน</a></div>
      </div>` : '<div class="map-sheet center muted">ไม่พบร้านที่ตรงกับตัวกรอง</div>'}`,
    mount(root) {
      const q = root.querySelector('#mapQ');
      q.addEventListener('change', () => { mapState.q = q.value.trim(); window.dispatchEvent(new Event('rerender')); });
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') q.blur(); });
      root.querySelector('.shop-chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    },
    actions: {
      sel(el) { mapState.sel = el.dataset.id; window.dispatchEvent(new Event('rerender')); },
      chip(el) { const k = el.dataset.k; if (k === 'promo') mapState.promo = !mapState.promo; else mapState.cat = k; window.dispatchEvent(new Event('rerender')); },
      async locate(el) {
        el.disabled = true;
        try {
          const o = await locateMe(); setOrigin(o.lat, o.lng); refreshDistances();
          mapState.sel = null; toast('อัปเดตระยะทางจากตำแหน่งของคุณแล้ว');
        } catch (e) { toast(e.message); }
        el.disabled = false; window.dispatchEvent(new Event('rerender'));
      },
      filters() { mapState = { cat: 'all', promo: false, sel: mapState.sel, q: '' }; toast('ล้างตัวกรองแล้ว'); window.dispatchEvent(new Event('rerender')); },
    },
  };
}
export function openText(s) {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h >= s.openAt && h < s.closeAt ? 'เปิดอยู่' : 'ปิดแล้ว';
}
export { mapsUrl };

// ================= SCAN =================
let scanState = { tab: 'nfc', fail: false, reading: false };
let nfcAbort = null; let camStream = null; let camLoop = null;
const stopScan = () => {
  try { nfcAbort?.abort(); } catch { /* ignore */ }
  nfcAbort = null;
  camStream?.getTracks().forEach((t) => t.stop()); camStream = null;
  cancelAnimationFrame(camLoop);
};
export function parseTagUrl(text) {
  const m = String(text).match(/#\/tap\/([a-z0-9-]+)/i) || String(text).match(/^pointie:([a-z0-9-]+)$/i);
  return m && shopById(m[1]) ? m[1] : null;
}
export function scan() {
  const s = scanState;
  const hasNfc = 'NDEFReader' in window;
  const hasQr = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  const tabs = `<div class="tabs" role="tablist" style="flex:1">
    <button role="tab" aria-selected="${s.tab === 'nfc'}" class="${s.tab === 'nfc' ? 'on' : ''}" data-act="tab" data-k="nfc">แตะ NFC</button>
    <button role="tab" aria-selected="${s.tab === 'qr'}" class="${s.tab === 'qr' ? 'on' : ''}" data-act="tab" data-k="qr">สแกน QR</button></div>`;
  const shopsList = `<div class="col" style="gap:8px">${SHOPS.map((sh) => `<button class="shop-pick" data-act="pickShop" data-id="${sh.id}">
      <span class="initials sm ${cardBg(sh.card)}" style="${cardBgStyle(sh.card)}color:${sh.card.letter}">${sh.initials}</span>
      <span class="col" style="gap:0;flex:1"><b style="font-size:14px">${esc(sh.name)}</b><span class="xs muted">${CAT[sh.cat].label} · ${sh.dist}</span></span>${icon('chev', 18)}</button>`).join('')}</div>`;
  let body;
  if (s.tab === 'nfc' && s.fail) {
    body = `<div class="nfc-stage"><div class="nfc-stand">สแตนด์ NFC</div><div class="nfc-phone" style="animation:none;transform:rotate(-14deg) translate(-30px,0)"></div><img class="mascot" src="img/pointie-wow.png" alt=""></div>
      <div class="col center" style="gap:8px;align-items:center"><span class="pill" style="background:var(--red-soft);color:var(--red)">${icon('alert', 14)}อ่านไม่ติด</span><h1 class="h1" style="font-size:22px">ลองแตะใหม่อีกครั้งนะ</h1></div>
      <div class="card howto">
        <div><b class="n">1</b><span>แนบ<b>ด้านหลังส่วนบน</b>ของมือถือกับสแตนด์ ค้างไว้ 2 วินาที</span></div>
        <div><b class="n">2</b><span>เคสหนาหรือมีแม่เหล็ก ลองถอดเคสก่อน</span></div>
        <div><b class="n">3</b><span>Android: เปิด NFC ในการตั้งค่าก่อน</span></div>
      </div>
      <div class="col spacer"><button class="btn btn-primary" data-act="tab" data-k="qr">${icon('qr', 20)}สแกน QR บนสแตนด์แทน</button><button class="btn btn-ghost" data-act="retry">ลองแตะอีกครั้ง</button></div>`;
  } else if (s.tab === 'nfc') {
    body = `<div class="nfc-stage"><div class="nfc-stand">สแตนด์ NFC</div><div class="nfc-wave"></div><div class="nfc-phone"></div><img class="mascot" src="img/pointie-point.png" alt=""></div>
      <div class="col center" style="gap:6px"><h1 class="h1" style="font-size:22px">แตะมือถือที่สแตนด์ NFC</h1>
      <p class="muted small">${hasNfc ? 'กด “เริ่มอ่าน NFC” แล้วแนบด้านหลังมือถือกับสแตนด์ของร้าน' : 'iPhone และ Android แตะสแตนด์ได้เลย ระบบจะเปิดหน้านี้ให้อัตโนมัติ'}</p></div>
      ${hasNfc ? `<button class="btn btn-primary" data-act="nfc" ${s.reading ? 'disabled' : ''}>${icon('nfc', 20)}${s.reading ? 'กำลังรออ่าน NFC…' : 'เริ่มอ่าน NFC'}</button>` : ''}
      <div class="col" style="gap:8px"><div class="between"><span class="semi">จำลองการแตะที่ร้าน (เดโม)</span><button class="link" data-act="simFail">จำลองอ่านไม่ติด</button></div>${shopsList}</div>`;
  } else {
    body = hasQr ? `<div style="position:relative;border-radius:22px;overflow:hidden;background:#000;aspect-ratio:1">
        <video id="cam" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
        <div style="position:absolute;inset:18%;border:3px solid var(--primary);border-radius:18px;box-shadow:0 0 0 999px rgba(0,0,0,.35)"></div></div>
        <p class="center muted small" id="camMsg">เล็งกล้องไปที่ QR บนสแตนด์ของร้าน</p>
        <div class="col" style="gap:8px"><span class="semi">หรือเลือกร้าน (เดโม)</span>${shopsList}</div>`
      : `<div class="card col center" style="align-items:center;gap:8px">${icon('qr', 40)}<b>สแกน QR บนสแตนด์ของร้าน</b><p class="muted small">ใช้แอพกล้องของมือถือสแกน QR ได้เลย ลิงก์จะพามาที่หน้านี้</p></div>
         <div class="col" style="gap:8px"><span class="semi">เลือกร้าน (เดโม)</span>${shopsList}</div>`;
  }
  return {
    nav: 'scan',
    html: `<div class="topbar">${'<a class="icon-btn" href="#/home" aria-label="ปิด">' + icon('close') + '</a>'}${tabs}</div>${body}`,
    mount(root) {
      if (s.tab === 'qr' && hasQr) {
        const video = root.querySelector('#cam'); const msg = root.querySelector('#camMsg');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((stream) => {
          camStream = stream; video.srcObject = stream; video.play();
          const det = new window.BarcodeDetector({ formats: ['qr_code'] });
          const loop = async () => {
            if (!camStream) return;
            try {
              const codes = await det.detect(video);
              const id = codes.map((c) => parseTagUrl(c.rawValue)).find(Boolean);
              if (id) { stopScan(); go('/tap/' + id); return; }
              if (codes.length) msg.textContent = 'QR นี้ไม่ใช่ของร้านใน D Point';
            } catch { /* frame not ready */ }
            camLoop = requestAnimationFrame(loop);
          };
          loop();
        }).catch(() => { msg.textContent = 'เปิดกล้องไม่ได้ ใช้แอพกล้องสแกน หรือเลือกร้านด้านล่างแทน'; });
      }
      return stopScan;
    },
    actions: {
      tab(el) { stopScan(); scanState = { tab: el.dataset.k, fail: false, reading: false }; window.dispatchEvent(new Event('rerender')); },
      retry() { scanState.fail = false; window.dispatchEvent(new Event('rerender')); },
      simFail() { scanState.fail = true; window.dispatchEvent(new Event('rerender')); },
      pickShop(el) { stopScan(); go('/tap/' + el.dataset.id); },
      async nfc() {
        try {
          const reader = new window.NDEFReader();
          nfcAbort = new AbortController();
          await reader.scan({ signal: nfcAbort.signal });
          scanState.reading = true; window.dispatchEvent(new Event('rerender'));
          reader.onreading = (ev) => {
            const dec = new TextDecoder();
            const id = ev.message.records.map((r) => { try { return parseTagUrl(dec.decode(r.data)); } catch { return null; } }).find(Boolean);
            stopScan(); scanState.reading = false;
            if (id) go('/tap/' + id); else { scanState.fail = true; window.dispatchEvent(new Event('rerender')); }
          };
          reader.onreadingerror = () => { stopScan(); scanState = { tab: 'nfc', fail: true, reading: false }; window.dispatchEvent(new Event('rerender')); };
        } catch {
          scanState = { tab: 'nfc', fail: true, reading: false };
          toast('เปิด NFC ไม่ได้ ตรวจว่าเปิด NFC และอนุญาตแล้ว');
          window.dispatchEvent(new Event('rerender'));
        }
      },
    },
    leave() { stopScan(); scanState.reading = false; },
  };
}

// ================= MY CARDS =================
let cardsState = { idx: 0, tab: 'all' };
export function cards(p, query) {
  const me = store.me;
  const all = Object.entries(me.cards).map(([id, c]) => ({ shop: shopById(id), c })).filter((x) => x.shop)
    .sort((a, b) => (b.c.have >= b.shop.card.need) - (a.c.have >= a.shop.card.need) || (b.c.last || '').localeCompare(a.c.last || ''));
  const want = query.get('shop');
  if (want) { const i = all.findIndex((x) => x.shop.id === want); if (i >= 0) { cardsState = { idx: i, tab: 'all' }; history.replaceState(null, '', '#/cards'); } }
  const readyN = all.filter((x) => x.c.have >= x.shop.card.need).length;
  const tabs = `<div class="tabs" role="tablist">
    <button role="tab" class="${cardsState.tab === 'all' ? 'on' : ''}" data-act="tab" data-k="all">ทั้งหมด</button>
    <button role="tab" class="${cardsState.tab === 'ready' ? 'on' : ''}" data-act="tab" data-k="ready">พร้อมแลก${readyN ? ` <span class="count">${readyN}</span>` : ''}</button>
    <button role="tab" class="${cardsState.tab === 'used' ? 'on' : ''}" data-act="tab" data-k="used">ใช้แล้ว</button></div>`;
  const head = `<div class="between"><h1 class="h2" style="font-size:22px">บัตรของฉัน</h1><span class="muted small">${all.length} ใบ</span></div>`;

  if (!all.length && !me.redeemed.length) {
    return {
      nav: 'cards',
      html: `${head}
        <div class="col" style="align-items:center;text-align:center;gap:10px;margin-top:30px">
          <svg width="150" height="120" viewBox="0 0 150 120" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 6" aria-hidden="true"><rect x="18" y="14" width="70" height="96" rx="12" transform="rotate(-10 53 62)"/><rect x="62" y="8" width="70" height="96" rx="12" transform="rotate(8 97 56)"/></svg>
          <h2 class="h2">ยังไม่มีบัตรสะสมแต้ม</h2>
          <p class="muted small">แตะมือถือที่จุด NFC ของร้านที่ร่วมรายการ<br>บัตรใบแรกจะมาอยู่ที่นี่ทันที</p>
        </div>
        <div class="card row"><span class="initials sm">${icon('pin', 18)}</span><span class="small"><b>มี ${SHOPS.length} ร้าน</b> ใกล้คุณที่สะสมแต้มได้</span></div>
        <a class="btn btn-primary" href="#/map">ดูร้านบนแมพ</a>`,
    };
  }

  if (cardsState.tab === 'used') {
    return {
      nav: 'cards',
      html: `${head}${tabs}
        ${me.redeemed.length ? me.redeemed.filter((r) => shopById(r.shopId)).map((r) => { const s = shopById(r.shopId); return `<div class="card row">
          <span class="initials ${cardBg(s.card)}" style="${cardBgStyle(s.card)}color:${s.card.letter}">${s.initials}</span>
          <div class="col" style="gap:2px;flex:1"><b>${esc(r.reward)}</b><span class="small muted">${esc(s.name)}</span><span class="xs muted">แลกเมื่อ ${thDateTime(r.at)}${r.code ? ` · รหัส ${r.code}` : ''}</span></div>
          <span class="pill green">${icon('check', 12, 3)}ใช้แล้ว</span></div>`; }).join('') : '<div class="empty-note">ยังไม่เคยแลกรางวัล<br>สะสมแสตมป์ให้ครบแล้วกลับมาแลกที่นี่</div>'}`,
      actions: { tab(el) { cardsState.tab = el.dataset.k; cardsState.idx = 0; window.dispatchEvent(new Event('rerender')); } },
    };
  }

  const list = cardsState.tab === 'ready' ? all.filter((x) => x.c.have >= x.shop.card.need) : all;
  const idx = Math.min(cardsState.idx, Math.max(0, list.length - 1));
  const cur = list[idx];
  const big = list.map(({ shop, c }, i) => {
    const full = c.have >= shop.card.need; const k = shop.card;
    return `<button class="bigcard ${i === idx ? '' : 'off'}" data-act="pick" data-i="${i}" aria-label="${esc(shop.name)}">
      <span class="bgfill ${cardBg(k)}" style="position:absolute;inset:0;border-radius:26px;${cardBgStyle(k)}"></span>
      ${full ? '<img class="peek" src="img/pointie-wink.png" alt="">' : ''}
      <span class="inner">
        <span class="between"><span class="xs bold" style="letter-spacing:.08em">${cardEn(k)}</span>${full ? '<span class="full-tag">ครบแล้ว!</span>' : ''}</span>
        ${letterHtml(k)}
        ${stampGrid(k, c.have, { sizeClass: k.need > 8 ? 'sm' : '' })}
        <span class="between small semi" style="margin-top:12px"><span><b style="font-size:16px">${c.have}</b>/${k.need}</span><span>${full ? 'พร้อมแลก' : `อีก ${k.need - c.have} ดวง`}</span></span>
      </span></button>`;
  }).join('');
  return {
    nav: 'cards',
    html: `${head}${tabs}
      ${list.length ? `<div class="carousel" id="car"><div class="track" id="track" style="transform:translateX(calc(50% - 145px - ${idx * 304}px))">${big}</div></div>
      <div class="dots">${list.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>
      <div class="card between">
        <div class="col" style="gap:0"><span class="xs muted">รางวัลเมื่อครบ</span><b>${esc(cur.shop.card.reward)}</b></div>
        ${cur.c.have >= cur.shop.card.need ? `<a class="btn btn-primary btn-sm" href="#/redeem/${cur.shop.id}">แลกรางวัล</a>` : `<a class="btn btn-ghost btn-sm" href="#/store/${cur.shop.id}">ดูร้าน</a>`}
      </div>` : '<div class="empty-note">ยังไม่มีบัตรที่พร้อมแลก</div>'}
      ${cardsState.tab === 'all' ? `<h2 class="h2" style="font-size:16px">บัตรทั้งหมด</h2>
      <div class="mini-grid">${all.map(({ shop, c }, i) => `<button class="minicard ${cardBg(shop.card)} ${i === idx ? 'on' : ''}" style="${cardBgStyle(shop.card)}" data-act="pick" data-i="${i}" aria-label="${esc(shop.name)}">
        ${letterHtml(shop.card)}<span class="minibar">${Array.from({ length: shop.card.need }, (_, j) => `<i class="${j < c.have ? 'f' : ''}"></i>`).join('')}</span><span class="n">${c.have}/${shop.card.need}</span></button>`).join('')}</div>` : ''}`,
    mount(root) {
      const car = root.querySelector('#car'); if (!car) return;
      const track = root.querySelector('#track');
      const STEP = 304; // card width 290 + gap 14
      const base = () => `calc(50% - 145px - ${idx * STEP}px)`;
      let x0 = null, y0 = 0, dx = 0, horiz = null;
      car.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        x0 = e.clientX; y0 = e.clientY; dx = 0; horiz = null;
      });
      car.addEventListener('pointermove', (e) => {
        if (x0 == null) return;
        dx = e.clientX - x0;
        if (horiz == null && (Math.abs(dx) > 8 || Math.abs(e.clientY - y0) > 8)) horiz = Math.abs(dx) > Math.abs(e.clientY - y0);
        if (!horiz) return;
        track.classList.add('dragging');
        const edge = (idx === 0 && dx > 0) || (idx === list.length - 1 && dx < 0) ? 0.35 : 1; // rubber-band at ends
        track.style.transform = `translateX(calc(${base()} + ${dx * edge}px))`;
      });
      const end = () => {
        if (x0 == null) return;
        x0 = null; track.classList.remove('dragging');
        if (!horiz || Math.abs(dx) < 50) { track.style.transform = `translateX(${base()})`; return; }
        cardsState.idx = Math.max(0, Math.min(list.length - 1, idx + (dx < 0 ? 1 : -1)));
        window.dispatchEvent(new Event('rerender'));
      };
      car.addEventListener('pointerup', end);
      car.addEventListener('pointercancel', end);
      car.addEventListener('pointerleave', end);
      // a drag shouldn't also count as a tap on the card
      car.addEventListener('click', (e) => { if (horiz && Math.abs(dx) >= 8) { e.stopPropagation(); e.preventDefault(); } }, true);
    },
    actions: {
      pick(el) { const fromMini = el.classList.contains('minicard'); cardsState.idx = +el.dataset.i; if (cardsState.tab !== 'all') cardsState.tab = 'all'; window.dispatchEvent(new Event('rerender')); if (fromMini) root().scrollTo({ top: 0, behavior: 'smooth' }); },
      tab(el) { cardsState.tab = el.dataset.k; cardsState.idx = 0; window.dispatchEvent(new Event('rerender')); },
    },
  };
}
const root = () => document.querySelector('.screen');

// ================= PROFILE =================
function qrSvg(seed) {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 25; let rects = '';
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#000"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) continue;
    h = (h * 1103515245 + 12345) >>> 0;
    if ((h >> 16) & 1) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return `<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR นามบัตร"><g fill="#000">${rects}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}

export function profile() {
  const me = store.me; const u = me.user; const need = xpNeed(u.lv);
  const earned = BADGES.filter((b) => me.badges.includes(b.id));
  const locked = BADGES.filter((b) => !me.badges.includes(b.id));
  const shown = [...earned, ...locked].slice(0, 8);
  const pinned = me.pinned.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
  const favIds = (me.favs.length ? me.favs : Object.entries(me.cards).sort((a, b) => b[1].visits - a[1].visits).slice(0, 3).map(([id]) => id)).filter((id) => shopById(id));
  const stats = catVisitStats(me); const maxStat = Math.max(1, ...stats.map((s) => s.n));
  const styleTags = STYLES.filter(([k]) => u.prefs.styles.includes(k)).map(([, l]) => l);
  return {
    nav: 'profile',
    html: `<div class="between"><h1 class="h2" style="font-size:22px">โปรไฟล์</h1><a class="icon-btn" href="#/settings" aria-label="ตั้งค่า">${icon('settings')}</a></div>
      <div class="member ${u.frame === 'gold' ? 'frame-gold' : ''}">
        <div class="ring"></div>
        <div class="between xs bold" style="letter-spacing:.08em"><span>MEMBER CARD</span>${wordmark(16, 'on-blue')}</div>
        <div class="row">${avatarHtml(u)}<div class="col" style="gap:2px;min-width:0"><b style="font-size:22px;line-height:1.2">${esc(u.nick)}</b><span class="small semi">@${esc(u.handle)}</span><span class="row" style="gap:6px;flex-wrap:wrap"><span class="lvpill">Lv.${u.lv} · ${levelTitle(u.lv)}</span><span class="lvpill">${tierFor(u.lv).name}</span></span></div></div>
        ${styleTags.length ? `<div class="row xs bold" style="gap:6px;flex-wrap:wrap">${styleTags.map((t) => `<span>#${t}</span>`).join('')}</div>` : ''}
        <div class="bar"><i style="width:${Math.round((u.xp / need) * 100)}%"></i></div>
        <div class="between xs semi"><span>${u.xp} / ${need} XP</span><span>สมาชิกตั้งแต่ ${thMonthYear(u.joined)}</span></div>
        <div class="between"><div class="pins">${pinned.length ? pinned.map((b) => `<span style="${toneStyle(b.tone)}">${badgeIcon(b.kind, 16)}</span>`).join('') : '<span style="border-style:dashed;opacity:.6"></span>'}</div><span class="xs semi">Badge ที่ปักหมุด</span></div>
      </div>
      <div class="btns"><button class="btn btn-sm" style="height:48px;background:var(--ink);color:var(--bg)" data-act="qr">${icon('qr', 18)}แชร์นามบัตรด้วย QR</button><a class="btn btn-ghost btn-sm" style="height:48px" href="#/setup?edit=1">แก้ไขโปรไฟล์</a></div>
      <div class="stats">
        <div><b>${totalVisits(me)}</b><span>ครั้งที่ไป</span></div>
        <div><b>${Object.keys(me.cards).length}</b><span>ร้าน</span></div>
        <a href="#/badges" style="text-decoration:none;color:inherit;display:contents"><div><b>${earned.length}</b><span>Badge</span></div></a>
        <a href="#/reviews" style="text-decoration:none;color:inherit;display:contents"><div><b>${me.reviews.length}</b><span>รีวิว</span></div></a>
      </div>
      <section class="col">
        <div class="section-h"><h2>ระดับสมาชิก</h2><span class="pill soft">${tierFor(u.lv).name}</span></div>
        <div class="tiers">${TIERS.map((t) => { const cur = tierFor(u.lv).id === t.id; const got = u.lv >= t.min; return `<div class="tier ${cur ? 'cur' : ''} ${got ? '' : 'locked'}" style="--tc:${t.color}">
          <div class="between"><b>${t.name} <span class="muted small" style="font-weight:500">${t.th}</span></b><span class="xs semi muted">${cur ? 'ระดับของคุณ' : got ? 'ผ่านแล้ว' : `Lv.${t.min}+`}</span></div>
          <ul>${t.perks.map((x) => `<li>${got ? icon('check', 13, 3) : icon('lock', 13)}<span>${esc(x)}</span></li>`).join('')}</ul></div>`; }).join('')}</div>
        <p class="xs muted">XP นับจากการไปร้านจริง รีวิว และภารกิจรายสัปดาห์ · ระดับสูงขึ้นได้สิทธิ์ของระดับก่อนหน้าด้วย</p>
      </section>
      <section class="col">
        <div class="section-h"><h2>Badge ที่เก็บได้ <span class="muted small">${earned.length}/${BADGES.length}</span></h2><a class="link" href="#/badges">ดูทั้งหมด</a></div>
        <div class="badges">${shown.map((b) => { const got = me.badges.includes(b.id); return `<a href="#/badges" class="badge ${got ? '' : 'locked'}" style="text-decoration:none;color:inherit"><span class="bi" style="${got ? toneStyle(b.tone) : ''}">${got ? badgeIcon(b.kind) : icon('lock', 22)}</span><span>${b.name}</span></a>`; }).join('')}</div>
      </section>
      <section class="col">
        <div class="section-h"><h2>ร้านที่ชอบ</h2></div>
        <div class="card" style="padding:4px 14px">${favIds.length ? favIds.map((id) => { const s = shopById(id); const c = cardFor(id); return `<a class="fav-row" href="#/store/${id}">
          <span class="initials sm">${s.initials}</span><div class="col" style="gap:0;flex:1;min-width:0"><b style="font-size:15px">${esc(s.name)}</b><span class="xs muted">${CAT[s.cat].label} · มา ${c?.visits || 0} ครั้ง</span></div>
          <span class="bold accent small">${c ? `${c.have}/${s.card.need}` : '-'}</span></a>`; }).join('') : '<div class="empty-note">กดหัวใจที่หน้าร้านเพื่อเพิ่มร้านโปรด</div>'}</div>
      </section>
      <section class="col">
        <div class="section-h"><h2>สถิติการไปร้าน</h2></div>
        <div class="card col">${stats.map((k) => `<div class="statrow"><span>${k.label}</span><div class="bar"><i style="width:${Math.round((k.n / maxStat) * 100)}%;background:${CAT[k.key].color}"></i></div><b style="text-align:right">${k.n}</b></div>`).join('')}
        ${totalVisits(me) >= 5 ? `<div class="row small muted" style="gap:8px;padding-top:8px;border-top:1px solid var(--line)">${icon('clock', 16)}<span>ไปบ่อยสุดช่วง <b style="color:var(--ink)">เช้าวันธรรมดา 08:00–10:00</b></span></div>` : ''}</div>
      </section>`,
    actions: {
      qr() {
        const url = `${location.origin}${location.pathname}#/u/${u.handle}`;
        document.querySelector('.app').insertAdjacentHTML('beforeend', sheet(`<h2 class="h2 center">นามบัตรของ ${esc(u.nick)}</h2>${qrSvg(u.handle)}<p class="center muted small">ให้เพื่อนสแกนเพื่อดูนามบัตรและ Badge ของคุณ</p>
          <button class="btn btn-primary" data-act="shareCard" data-url="${esc(url)}">${icon('share', 18)}แชร์ลิงก์นามบัตร</button>`));
      },
    },
  };
}

// ================= BADGES =================
export function badges() {
  const me = store.me; const slots = pinSlots(me.user.lv);
  return {
    html: `<div class="topbar">${backBtn('/profile')}<h1>Badge ของฉัน</h1></div>
      <p class="muted small">แตะ Badge ที่ได้แล้วเพื่อปักหมุดบนนามบัตร · ปักได้ ${slots} อัน (เพิ่มได้เมื่อเลเวลสูงขึ้น)</p>
      <div class="badges">${BADGES.map((b) => { const got = me.badges.includes(b.id); const pin = me.pinned.includes(b.id); return `<button class="badge ${got ? '' : 'locked'}" ${got ? `data-act="pin" data-id="${b.id}"` : 'disabled'} aria-pressed="${pin}">
        <span class="bi" style="${got ? toneStyle(b.tone) : ''};${pin ? 'outline:3px solid var(--primary);outline-offset:2px' : ''}">${got ? badgeIcon(b.kind) : icon('lock', 22)}</span><span>${b.name}</span>${pin ? '<span class="pill primary" style="font-size:10px;padding:0 6px">ปักหมุด</span>' : ''}</button>`; }).join('')}</div>`,
    actions: {
      pin(el) {
        const ok = togglePin(el.dataset.id);
        if (!ok) toast(slots ? `ปักหมุดได้สูงสุด ${slots} อัน ถอนอันเดิมก่อนนะ` : 'ปลดล็อกการปักหมุดที่ Lv.2');
        window.dispatchEvent(new Event('rerender'));
      },
    },
  };
}

// ================= MY REVIEWS (E8) =================
export function reviews() {
  const me = store.me;
  const pending = Object.entries(me.cards).filter(([id]) => shopById(id) && !myReview(id)).sort((a, b) => (b[1].last || '').localeCompare(a[1].last || ''));
  return {
    html: `<div class="topbar">${backBtn('/profile')}<h1>รีวิวของฉัน</h1></div>
      ${me.reviews.length ? me.reviews.filter((r) => shopById(r.shopId)).map((r) => { const s = shopById(r.shopId); return `<a class="card review" href="#/store/${s.id}" style="text-decoration:none;color:inherit">
        <div class="between"><b>${esc(s.name)}</b><span class="real">${icon('check', 11, 3)}ไปจริง</span></div>
        <div class="row" style="gap:8px">${starsHtml(r.stars)}<span class="xs muted">${agoText(r.date)}</span></div><p class="small">${esc(r.text)}</p></a>`; }).join('')
      : `<div class="col" style="align-items:center;text-align:center;gap:8px">
          <span class="pill dark" style="border:1px solid var(--line)">${starsHtml(3)}</span>
          <img src="img/pointie-point.png" alt="" style="height:110px">
          <h2 class="h2">ยังไม่มีรีวิว</h2>
          <p class="muted small">รีวิวได้เฉพาะร้านที่ไปจริง รีวิวจะติดป้าย "ไปจริง"<br>และได้ <b class="violet">+30 XP</b> ทุกรีวิว</p></div>`}
      ${pending.length ? `<h2 class="h2" style="font-size:16px">ร้านที่คุณไปแล้ว รอรีวิว</h2>
      ${pending.map(([id, c]) => { const s = shopById(id); return `<div class="card row"><span class="initials sm ${cardBg(s.card)}" style="${cardBgStyle(s.card)}color:${s.card.letter}">${s.initials}</span>
        <div class="col" style="gap:0;flex:1"><b style="font-size:15px">${esc(s.name)}</b><span class="xs muted">ไปล่าสุด ${agoText(c.last)}</span></div>
        <a class="btn btn-primary btn-sm" href="#/store/${id}?review=1">รีวิว</a></div>`; }).join('')}` : ''}`,
  };
}

// ================= SETTINGS =================
export function settings() {
  const me = store.me;
  const isDemo = me.phone === DEMO_PHONE;
  return {
    html: `<div class="topbar">${backBtn('/profile')}<h1>ตั้งค่า</h1></div>
      <div class="card" style="padding:4px 16px"><div class="menu-list">
        <button data-act="theme">${icon(store.theme === 'dark' ? 'moon' : 'sun')}โหมดมืด<span class="switch ${store.theme === 'dark' ? 'on' : ''}" aria-hidden="true"></span></button>
        <a href="#/setup?edit=1">${icon('edit')}แก้ไขชื่อและรูป<span class="chev">${icon('chev', 18)}</span></a>
        <a href="#/prefs/places?edit=1">${icon('sparkle')}ความชอบและย่านที่ไปบ่อย<span class="chev">${icon('chev', 18)}</span></a>
        <a href="#/reviews">${icon('review')}รีวิวของฉัน<span class="chev">${icon('chev', 18)}</span></a>
        <a href="#/notifications">${icon('bell')}การแจ้งเตือน<span class="chev">${icon('chev', 18)}</span></a>
      </div></div>
      <div class="card" style="padding:4px 16px"><div class="menu-list">
        <div>${icon('phone')}เบอร์มือถือ<span class="chev small">${prettyPhone(me.phone)}</span></div>
        <button data-act="linkPhone" id="linkPhone" hidden>${icon('lock')}ยืนยันเบอร์ด้วย SMS<span class="chev small" style="color:var(--primary)">ใช้ได้ทุกเครื่อง</span></button>
        ${isDemo ? `<button data-act="resetDemo">${icon('refresh')}รีเซ็ตข้อมูลตัวอย่าง</button>` : ''}
        <button data-act="logout">${icon('logout')}ออกจากระบบ</button>
        <button data-act="delete" style="color:var(--red)">${icon('trash')}ลบบัญชีและข้อมูลทั้งหมด</button>
      </div></div>
      <p class="center xs muted">D Point เวอร์ชันเว็บ · ${document.documentElement.dataset.backend === 'remote' ? 'ข้อมูลซิงก์กับเซิร์ฟเวอร์' : 'โหมดเดโม ข้อมูลเก็บในเครื่องนี้เท่านั้น'}</p>`,
    mount(root, ctx) {
      needsPhoneLink().then((v) => { const b = root.querySelector('#linkPhone'); if (b) b.hidden = !v; });
    },
    actions: {
      linkPhone() { setLinking(true); go('/login'); },
      theme() { setTheme(store.theme === 'dark' ? 'light' : 'dark'); window.dispatchEvent(new Event('themechange')); window.dispatchEvent(new Event('rerender')); },
      async resetDemo() { if (confirm('รีเซ็ตข้อมูลตัวอย่างกลับเป็นค่าเริ่มต้น?')) { try { await resetDemo(); toast('รีเซ็ตข้อมูลแล้ว'); } catch { toast('รีเซ็ตไม่สำเร็จ ลองใหม่อีกครั้ง'); } go('/home'); } },
      async logout() { await logout(); toast('ออกจากระบบแล้ว'); go('/welcome'); },
      async delete() {
        if (!confirm('ลบบัญชีนี้และข้อมูลทั้งหมด (บัตร แสตมป์ รีวิว)? การกระทำนี้ย้อนกลับไม่ได้')) return;
        try { await deleteAccount(); toast('ลบบัญชีแล้ว'); go('/welcome'); } catch { toast('ลบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง'); }
      },
    },
  };
}

export function legal() {
  return {
    html: `<div class="topbar">${backBtn('/login')}<h1>ข้อกำหนดและความเป็นส่วนตัว</h1></div>
      <div class="card col small"><b>ข้อกำหนดการใช้งาน (ฉบับย่อ)</b><p class="muted">แสตมป์ได้ร้านละ 1 ดวงต่อวัน รางวัลแลกได้เมื่อสะสมครบตามบัตร และต้องกดแลกต่อหน้าพนักงานร้าน</p></div>
      <div class="card col small"><b>นโยบายความเป็นส่วนตัว (ฉบับย่อ)</b><p class="muted">เวอร์ชันเว็บนี้เก็บข้อมูลบัญชี บัตรสะสม และรีวิวไว้ในเบราว์เซอร์ของคุณเท่านั้น ตำแหน่งใช้เฉพาะตอนเปิดแอพ ร้านค้าไม่เห็นตำแหน่งของคุณ</p></div>`,
  };
}

export { unlocksFor };
