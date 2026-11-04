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
