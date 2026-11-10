// Shared UI helpers and components.
import { t } from './i18n.js';
import { icon, cupStamp, starStamp, giftStamp } from './icons.js';
import { AVATARS } from './data.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const go = (path) => { if (location.hash !== '#' + path) location.hash = path; else window.dispatchEvent(new HashChangeEvent('hashchange')); };
export const back = (fallback = '/home') => { if (history.length > 1 && document.referrer !== '' ) history.back(); else go(fallback); };

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export const toneStyle = (tone) => ({
  soft: 'background: var(--soft); color: var(--accent);',
  violet: 'background: var(--violet-soft); color: var(--violet);',
  teal: 'background: var(--teal-soft); color: var(--teal);',
  gold: 'background: var(--gold-soft); color: var(--gold);',
  green: 'background: var(--green-soft); color: var(--green);',
}[tone] || '');

export function avatarHtml(user, cls = 'avatar') {
  const a = user.avatar != null ? AVATARS[user.avatar] : null;
  const initial = esc((user.nick || '?').trim().charAt(0));
  if (user.photo && /^data:image\//.test(user.photo)) return `<div class="${cls}"><img src="${esc(user.photo)}" alt="" style="object-fit:cover"></div>`;
  return `<div class="${cls}">${a ? `<img src="${a.src}" alt="" style="object-fit:contain;background:var(--soft)">` : initial}</div>`;
}

export const backBtn = (to, label = 'ย้อนกลับ') =>
  `<a class="icon-btn" href="#${to}" aria-label="${label}">${icon('back')}</a>`;
export const closeBtn = (to) => `<a class="icon-btn" href="#${to}" aria-label="ปิด">${icon('close')}</a>`;

export function steps(total, current) {
  let s = '';
  for (let i = 1; i <= total; i++) s += `<span class="${i === current ? 'on' : i < current ? 'done' : ''}"></span>`;
  return `<div class="steps" aria-label="ขั้นตอนที่ ${current} จาก ${total}">${s}</div>`;
}

// Floating pill nav: the active tab grows into a labelled pill; the mascot circle (NFC badge + 'สแกน') on the right opens the scanner.
export const SCAN_STYLE = 'pill';
const NFC_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><g transform="translate(-0.8 0)"><path d="M5 9a4.5 4.5 0 0 1 0 6"/><path d="M8.5 6.5a8.5 8.5 0 0 1 0 11"/><path d="M12 4a12.5 12.5 0 0 1 0 16"/><path d="M15.5 1.8a16 16 0 0 1 0 20.4"/></g></svg>';
export function nav(active) {
  const item = (key, to, ic, label, full = label) =>
    `<a href="#${to}" class="tab ${active === key ? 'on' : ''}" aria-label="${full}" ${active === key ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span class="lbl">${label}</span></a>`;
  return `<nav class="nav" aria-label="เมนูหลัก"><div class="nav-pill">
    ${item('home', '/home', 'home', t('หน้าแรก', 'Home'))}
    ${item('cards', '/cards', 'card', t('บัตรของฉัน', 'My cards'))}
    ${item('profile', '/profile', 'user', t('โปรไฟล์', 'Profile'))}
    <a href="#/scan" class="scan ${active === 'scan' ? 'on' : ''}" aria-label="${t('สแกนรับแสตมป์ (NFC / QR)', 'Scan for a stamp (NFC / QR)')}"><span class="scan-btn"><img class="scan-face" src="img/pointie-face.png" width="52" height="52" alt=""></span><span class="scan-nfc">${NFC_ICON}</span><span class="scan-lbl">${t('สแกน', 'Scan')}</span></a>
  </div></nav>`;
}

// Full-card artwork uploaded by the shop (recommended 1080 × 1600 px, ~2:3 portrait).
export const isCardArt = (src) => typeof src === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src);
export const hasArt = (card) => isCardArt(card.art);
export const cardBg = (card) => hasArt(card) ? 'bg-art' : card.photo ? 'bg-photo' : 'bg-dots';
export const cardBgStyle = (card) => hasArt(card)
  ? `background-image: linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,.45) 100%), url('${card.art}');`
  : card.photo ? '' : `background-color: ${card.bg};`;
// Lettering is only drawn when there is no artwork (the art already carries the branding).
export const letterHtml = (card, size) => hasArt(card)
  ? '<div class="art-space"></div>'
  : `<div class="letter" style="color:${card.letter};${size ? `font-size:${size}px;` : ''}">${esc(card.l1)}<br><span class="l2">${esc(card.l2)}</span></div>`;
export const cardEn = (card) => hasArt(card) ? '' : esc(card.en);

export function stampGrid(card, have, { newIdx = -1, todayIdx = -1, sizeClass = '' } = {}) {
  const need = card.need;
  const cols = need <= 5 ? need : need === 6 ? 3 : need === 8 ? 4 : 5;
  let cells = '';
  for (let i = 1; i <= need; i++) {
    const filled = i <= have;
    const gift = !filled && i === need && need >= 8;
    const glyph = filled ? (card.glyph === 'cup' ? cupStamp(need > 8 ? 30 : 32) : starStamp(26)) : gift ? giftStamp() : '';
    cells += `<div class="stamp ${sizeClass} ${filled ? '' : 'empty'} ${i === newIdx ? 'new' : ''}">${glyph}${i === todayIdx ? '<span class="today">วันนี้</span>' : ''}</div>`;
  }
  return `<div class="stamps" style="grid-template-columns: repeat(${cols}, minmax(0,1fr))">${cells}</div>`;
}

export function bigStampCard(shop, have, opts = {}) {
  const c = shop.card;
  return `<div class="stampcard">
    <div class="bgfill ${cardBg(c)}" style="${cardBgStyle(c)}"></div>
    ${c.photo && !hasArt(c) ? '<div class="photo-tag">[รูปหน้าร้าน]</div>' : ''}
    <div class="shade"></div>
    <div class="en">${cardEn(c)}</div>
    ${letterHtml(c)}
    ${stampGrid(c, have, opts)}
    <div class="foot"><span><b>${have}</b>/${c.need} · ครบรับ${esc(c.reward)}</span><span class="muted2">${opts.foot || ''}</span></div>
  </div>`;
}

export function starsHtml(n, size = 14) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="${i <= Math.round(n) ? '' : 'off'}">${icon('star', size)}</span>`;
  return `<span class="stars" aria-label="${n} ดาว">${s}</span>`;
}

export function sheet(inner, { id = 'sheet' } = {}) {
  return `<div class="sheet-backdrop" data-act="closeSheet" id="${id}"><div class="sheet" role="dialog" aria-modal="true" data-stop>${'<div class="grab"></div>'}${inner}</div></div>`;
}

// Firework / confetti particle generator for celebration screens.
export function fireworks(bursts) {
  let html = '';
  bursts.forEach((b, bi) => {
    const n = b.n || 12;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + bi * 0.4;
      const r = (b.r || 72) + (k % 2) * 20;
      const dx = Math.round(Math.cos(ang) * r), dy = Math.round(Math.sin(ang) * r);
      const star = k % 2 === 0;
      const s = star ? (b.big ? 20 : 14) : 7;
      const color = k % 3 === 0 ? '#17D8F8' : b.c;
      html += `<span class="fw" data-dx="${dx}" data-dy="${dy}" data-k="${k}" data-d="${b.d}" style="left:${b.x}%;top:${b.y}px;width:${s}px;height:${s}px;margin:-${s / 2}px 0 0 -${s / 2}px;border-radius:50%;background:${star ? 'transparent' : color};color:${color};transform:scale(0);">${star ? `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>` : ''}</span>`;
    }
    html += `<span class="ring" data-d="${b.d}" data-big="${b.big ? 1 : 0}" style="left:${b.x}%;top:${b.y}px;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid ${b.c};transform:scale(0);"></span>`;
  });
  return `<div class="fx" aria-hidden="true">${html}</div>`;
}
export function playFireworks(root, phase) {
  root.querySelectorAll('.fx .fw').forEach((el) => {
    const dx = +el.dataset.dx, dy = +el.dataset.dy, k = +el.dataset.k, d = +el.dataset.d;
    if (phase === 2) {
      el.style.transition = `transform .8s cubic-bezier(.05,.75,.25,1) ${d}s`;
      el.style.transform = `translate(${dx}px,${dy}px) scale(1) rotate(${k * 30}deg)`;
      el.style.opacity = 1;
    } else if (phase === 3) {
      el.style.transition = `transform 1.2s ease-in ${d * 0.5}s, opacity 1.1s ease-in ${d * 0.5}s`;
      el.style.transform = `translate(${Math.round(dx * 1.15)}px,${Math.round(dy * 1.15) + 60}px) scale(.5) rotate(${k * 30 + 90}deg)`;
      el.style.opacity = 0;
    } else { el.style.transition = 'none'; el.style.transform = 'scale(0)'; el.style.opacity = 1; }
  });
  root.querySelectorAll('.fx .ring').forEach((el) => {
    const d = +el.dataset.d;
    if (phase >= 2) { el.style.transition = `transform .7s ease-out ${d}s, opacity .85s ease-in ${d}s`; el.style.transform = `scale(${el.dataset.big === '1' ? 6 : 4})`; el.style.opacity = 0; }
    else { el.style.transition = 'none'; el.style.transform = 'scale(0)'; el.style.opacity = 1; }
  });
}

// D Point wordmark: blue on light surfaces, white (orange spark kept) on dark ones.
export const wordmark = (h = 28, cls = '') => `<span class="wordmark ${cls}" style="height:${h}px" role="img" aria-label="D Point"><img class="wm-light" src="/img/logo-dpoint.png" alt="" height="${h}"><img class="wm-dark" src="/img/logo-dpoint-white.png" alt="" height="${h}"></span>`;
