// Pointie for business — live numbers, ROI calculator, small interactions.
import { icon } from '../js/icons.js';
import * as remote from '../js/remote.js';

const nf = new Intl.NumberFormat('th-TH');
const baht = (n) => `฿${nf.format(Math.round(n))}`;

// Icons in the problem cards
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, 22); });

// ---------------- live platform numbers ----------------
// Only real activity (see public_stats in supabase/schema.sql). A number is shown
// once it is big enough to mean something; if none is, the strip stays hidden.
const LIVE = [
  ['shops', 'ร้านที่ใช้ Pointie', 3],
  ['customers', 'ลูกค้าที่สมัครแล้ว', 20],
  ['stamps', 'แสตมป์ที่แจกไปแล้ว', 50],
  ['redemptions', 'รางวัลที่ลูกค้าแลกแล้ว', 5],
  ['reviews', 'รีวิวจากคนที่ไปจริง', 10],
];
function countUp(el, to) {
  const start = performance.now(); const dur = 1200;
  const step = (t) => {
    const k = Math.min(1, (t - start) / dur);
    el.textContent = nf.format(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
async function loadLive() {
  if (!remote.configured()) return;
  let s;
  try { s = await remote.rpc('landing', 'public_stats', undefined, 6000); } catch { return; }
  const shown = LIVE.filter(([k, , min]) => Number(s?.[k]) >= min);
  if (!shown.length) return;
  const grid = document.getElementById('liveGrid');
  grid.innerHTML = shown.map(([k, label]) => `<div><b data-to="${Number(s[k])}">0</b><span>${label}</span></div>`).join('');
  document.getElementById('live').hidden = false;
  grid.querySelectorAll('b').forEach((b) => countUp(b, +b.dataset.to));
}
loadLive();

// ---------------- ROI calculator ----------------
const form = document.getElementById('calcForm');
function calc() {
  const v = Object.fromEntries([...new FormData(form)].map(([k, x]) => [k, Math.max(0, Number(x) || 0)]));
  document.getElementById('liftOut').textContent = `${v.lift}%`;
  const visits = v.cust * v.days;                       // all visits per month
  const members = visits * (v.part / 100);              // visits by card holders
  const extra = members * (v.lift / 100);               // extra visits from members coming back more
  const revenue = extra * v.bill;
  const rewards = v.need > 0 ? ((members + extra) / v.need) * v.cost : 0; // cards completed per month × cost
  const net = revenue - rewards;
  document.getElementById('outRev').textContent = baht(revenue);
  document.getElementById('outCost').textContent = baht(rewards);
  document.getElementById('outNet').textContent = (net < 0 ? '−' : '') + baht(Math.abs(net));
}
form.addEventListener('input', calc);
calc();

// ---------------- reveal on scroll ----------------
const targets = document.querySelectorAll('.card, .feat, .steps li, .screens figure, .mlist li, .facts-grid div, .shot');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  targets.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => io.observe(el));
}

// ---------------- sign-up request ----------------
const dlg = document.getElementById('apply');
const af = document.getElementById('applyForm');
const errEl = document.getElementById('applyErr');
const openApply = (e) => {
  e?.preventDefault();
  af.hidden = false; document.getElementById('applyDone').hidden = true;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  setTimeout(() => af.querySelector('[name=first]').focus(), 50);
};
const closeApply = () => { if (dlg.open) dlg.close(); if (location.hash === '#apply') history.replaceState(null, '', location.pathname); };
document.querySelectorAll('[data-apply]').forEach((a) => a.addEventListener('click', openApply));
dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) closeApply(); });
if (location.hash === '#apply') openApply();
af.addEventListener('change', (e) => {
  if (e.target.name === 'type') { const other = af.querySelector('.other'); other.hidden = e.target.value !== 'อื่นๆ'; if (!other.hidden) other.focus(); }
  af.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
});
const phoneDigits = (s) => { let d = s.replace(/\D/g, ''); if (d.startsWith('66') && d.length === 11) d = '0' + d.slice(2); return d; };
af.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.hidden = true;
  const v = Object.fromEntries(new FormData(af));
  if (v.website) return; // bot
  const bad = [];
  for (const k of ['first', 'last', 'shop']) if (!String(v[k] || '').trim()) bad.push(af.querySelector(`[name=${k}]`));
  if (!/^0\d{8,9}$/.test(phoneDigits(v.phone || ''))) bad.push(af.querySelector('[name=phone]'));
  const type = v.type === 'อื่นๆ' ? (v.typeOther || '').trim() : v.type;
  if (!type) bad.push(af.querySelector('.types'));
  if (!v.consent) bad.push(af.querySelector('.consent'));
  if (bad.length) {
    bad.forEach((x) => x.classList.add('bad'));
    errEl.textContent = bad.some((x) => x.name === 'phone') ? 'ตรวจเบอร์โทรอีกครั้ง (เช่น 081 234 5678)' : 'กรอกข้อมูลให้ครบก่อนนะครับ';
    errEl.hidden = false; bad[0].focus?.(); return;
  }
  const btn = document.getElementById('applySubmit');
  btn.disabled = true; btn.textContent = 'กำลังส่ง…';
  try {
    if (!remote.configured()) throw new Error('offline');
    const r = await remote.rpc('landing', 'submit_lead', {
      p_first: v.first, p_last: v.last, p_phone: v.phone, p_shop: v.shop, p_type: type,
      p_source: (new URLSearchParams(location.search).get('utm_source') || document.referrer || 'landing').slice(0, 120),
    }, 10000);
    if (!r?.ok) throw new Error(r?.reason || 'failed');
    af.reset(); af.querySelector('.other').hidden = true;
    af.hidden = true; document.getElementById('applyDone').hidden = false;
  } catch (err) {
    errEl.textContent = err.message === 'phone' ? 'ตรวจเบอร์โทรอีกครั้ง' : err.message === 'busy' ? 'ตอนนี้มีคนสมัครเยอะ ลองใหม่อีกครั้งในอีกสักครู่' : 'ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะครับ';
    errEl.hidden = false;
  } finally { btn.disabled = false; btn.textContent = 'ส่งข้อมูล'; }
});
