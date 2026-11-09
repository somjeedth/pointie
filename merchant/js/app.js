// D Point merchant web: router, layout and views.
import { icon } from '../../js/icons.js';
import { esc, toast, bigStampCard, starsHtml, cardBg, cardBgStyle, letterHtml, isCardArt, wordmark } from '../../js/ui.js';
import { morphChildren, runMount } from '../../js/dom.js';
import qrcode from './vendor/qrcode.js';
import * as api from './api.js';
import { siteUrl } from '../../js/sites.js';
import { embedUrl, embedFor, parseLatLng, isShortMapsLink, hasCoords, locateMe } from '../../js/geo.js';
import { TIERS, tierById, GENS, GEN_ORDER, genEmoji, genMood } from '../../js/data.js';

const root = document.getElementById('m-app');
const go = (p) => { if (location.hash !== '#' + p) location.hash = p; else render(true); };
const rerender = () => render(true);
// Run a save/update, show the outcome, then re-render with fresh data.
async function act(p, okMsg) {
  try {
    const r = await p;
    if (r === null) throw new Error('พื้นที่เก็บข้อมูลเต็ม ลองใช้รูปที่เล็กลง');
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    console.warn('[pointie]', e);
    toast('ทำรายการไม่สำเร็จ: ' + (e.message || 'ลองใหม่อีกครั้ง'), 4000);
    return false;
  } finally { rerender(); }
}
const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const fmtDT = (iso) => { const d = new Date(iso); return `${d.getDate()} ${TH_M[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'เมื่อสักครู่'; if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60); if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
};
const customerAppUrl = (hash = '') => siteUrl('app', hash);

// ======================= layout =======================
const NAV = [
  ['dashboard', 'Dashboard', 'home'],
  ['redeem', 'ยืนยันแลกรางวัล', 'checkCircle'],
  ['shop', 'ข้อมูลร้าน & แมพ', 'pin'],
  ['card', 'ออกแบบบัตรสะสม', 'card'],
  ['promos', 'โปรและกิจกรรม', 'tag'],
  ['stands', 'จุดแตะ NFC / QR', 'nfc'],
  ['reviews', 'รีวิว', 'review'],
  ['customers', 'ลูกค้า', 'user'],
  ['settings', 'ตั้งค่า', 'settings'],
];
function shell(active, me, shop, body) {
  const pending = api.redemptions(shop.id).filter((e) => e.status === 'pending').length;
  const unreplied = api.reviews(shop.id).filter((r) => !r.reply).length;
  const badge = { redeem: pending, reviews: unreplied };
  return `<div class="m-shell" id="shell">
    <aside class="m-side" aria-label="เมนูร้านค้า">
      <div class="brand">${wordmark(26)} <span class="pill soft" style="font-size:11px">ร้านค้า</span></div>
      <div class="shopname">ร้านของคุณ<b>${esc(shop.name)}</b>${shop.paused ? '<span class="status void">ซ่อนจากแอพ</span>' : ''}</div>
      <nav class="m-nav">${NAV.map(([k, l, ic]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${icon(ic, 18)}${l}${badge[k] ? `<span class="badge-n">${badge[k]}</span>` : ''}</a>`).join('')}</nav>
      <div class="foot m-nav">
        <a href="${customerAppUrl('#/store/' + shop.id)}" target="_blank" rel="noopener">${icon('share', 18)}ดูหน้าร้านในแอพ</a>
        <span class="xs muted" style="padding:6px 12px">${esc(me.email)}</span>
      </div>
    </aside>
    <div class="scrim" data-act="closeNav"></div>
    <div style="min-width:0">
      <div class="m-top"><button class="icon-btn" data-act="openNav" aria-label="เมนู">${icon('filter')}</button><div class="brand" style="font-size:16px"><img src="/img/app-icon.png" alt="" style="width:28px;height:28px">${esc(shop.name)}</div></div>
      <main class="m-main">${body}</main>
    </div>
  </div>`;
}
const head = (title, sub, right = '') => `<div class="m-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;

// ======================= auth views =======================
function loginView() {
  return {
    html: `<div class="auth">
      <div class="hero"><img src="/img/pointie-cheer.png" alt=""><h1 class="h1">D Point สำหรับร้านค้า</h1><p class="muted">ดูลูกค้าประจำ ออกแบบบัตรสะสม ตั้งโปร และยืนยันการแลกรางวัล<br>ในที่เดียว</p><a class="link-u" href="${siteUrl('landing')}">รู้จัก D Point สำหรับร้านค้า →</a></div>
      <div class="box"><form class="form" id="f">
        <h2 class="h1" style="font-size:24px">เข้าสู่ระบบร้านค้า</h2>
        <label class="field"><span>อีเมล</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>รหัสผ่าน</span><input class="inp" name="password" type="password" autocomplete="current-password" required></label>
        <p class="alert" id="err" hidden style="justify-content:flex-start"></p>
        <button class="btn btn-primary">เข้าสู่ระบบ</button>
        ${api.isRemote()
          ? '<div class="demo-hint">อยากลองก่อน? กด <b>สมัครร้านใหม่</b> แล้วเลือก "ใช้ร้านตัวอย่าง" จะได้ร้านพร้อมข้อมูล Dashboard ย้อนหลังไว้ทดลอง</div>'
          : `<div class="demo-hint">ลองใช้บัญชีตัวอย่างของ <b>บ้านกาแฟริมคลอง</b><br><span class="muted">${api.DEMO.email} / ${api.DEMO.password}</span><br><button type="button" class="link" data-act="demo" style="margin-top:6px">เข้าด้วยบัญชีตัวอย่าง →</button></div>`}
        <p class="small muted center">ยังไม่มีบัญชีร้าน? <a class="link-u" href="#/signup">สมัครร้านใหม่</a></p>
      </form></div></div>`,
    mount(r) {
      r.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const res = await api.login(fd.get('email'), fd.get('password'));
        if (!res.ok) { const el = r.querySelector('#err'); el.textContent = res.error; el.hidden = false; return; }
        go('/dashboard');
      });
    },
    actions: { async demo() { await api.login(api.DEMO.email, api.DEMO.password); go('/dashboard'); } },
  };
}
// Shop fields shared by sign-up and "create your shop" (remote: can start from a sample shop).
function shopFields() {
  return `${api.isRemote() ? `<label class="field"><span>เริ่มจาก</span><select class="inp" name="sample" id="sampleSel"><option value="">ร้านใหม่ของฉัน</option></select>
      <small>เลือกร้านตัวอย่างเพื่อทดลอง: ได้ร้านพร้อมบัตร โปร และข้อมูล Dashboard ย้อนหลัง</small></label>` : ''}
    <fieldset class="form new-only" style="border:0;padding:0;margin:0">
      <label class="field"><span>ชื่อร้าน (ภาษาไทย)</span><input class="inp" name="shopName" required maxlength="40" placeholder="เช่น ขนมปังบ้านสวน"></label>
      <label class="field"><span>ชื่อร้าน (อังกฤษ) — ใช้บนบัตรสะสม</span><input class="inp" name="shopNameEn" required maxlength="30" placeholder="BAAN SUAN BAKERY"></label>
      <div class="row2">
        <label class="field"><span>หมวด</span><select class="inp" name="cat">${Object.entries(api.CAT).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
        <label class="field"><span>ย่าน</span><input class="inp" name="area" value="อารีย์" maxlength="30"></label>
      </div>
    </fieldset>`;
}
function mountShopFields(r) {
  const sel = r.querySelector('#sampleSel'); if (!sel) return;
  const fs = r.querySelector('.new-only');
  sel.addEventListener('change', () => { fs.disabled = !!sel.value; fs.style.opacity = sel.value ? 0.4 : 1; });
  api.samplesAvailable().then((list) => {
    for (const s of list || []) sel.insertAdjacentHTML('beforeend', `<option value="${esc(s.id)}">ร้านตัวอย่าง: ${esc(s.name)}</option>`);
    if (!list?.length) sel.closest('.field').hidden = true;
  }).catch(() => { sel.closest('.field').hidden = true; });
}
function showErr(r, msg) { const el = r.querySelector('#err'); el.textContent = msg; el.hidden = false; }
function signupView() {
  return {
    html: `<div class="auth">
      <div class="hero"><img src="/img/pointie-point.png" alt=""><h1 class="h1">เปิดร้านบน D Point</h1><p class="muted">ตั้งค่าเสร็จในไม่กี่นาที แล้ววางสแตนด์ NFC ให้ลูกค้าแตะรับแสตมป์ได้เลย</p></div>
      <div class="box"><form class="form" id="f">
        <h2 class="h1" style="font-size:24px">สมัครร้านใหม่</h2>
        ${shopFields()}
        <label class="field"><span>ชื่อผู้ดูแล</span><input class="inp" name="name" required maxlength="40"></label>
        <label class="field"><span>อีเมล</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>รหัสผ่าน (อย่างน้อย 8 ตัว)</span><input class="inp" name="password" type="password" minlength="8" autocomplete="new-password" required></label>
        <p class="alert" id="err" hidden style="justify-content:flex-start"></p>
        <button class="btn btn-primary" id="submit">สร้างร้าน</button>
        <p class="small muted center">มีบัญชีแล้ว? <a class="link-u" href="#/login">เข้าสู่ระบบ</a></p>
      </form></div></div>`,
    mount(r) {
      mountShopFields(r);
      r.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = r.querySelector('#submit'); btn.disabled = true; btn.textContent = 'กำลังสร้างร้าน…';
        const res = await api.signup(Object.fromEntries(new FormData(e.target)));
        btn.disabled = false; btn.textContent = 'สร้างร้าน';
        if (!res.ok) { showErr(r, res.error); return; }
        toast('สร้างร้านแล้ว! เริ่มจากตั้งค่าข้อมูลร้านและปักหมุดบนแมพ');
        go('/shop');
      });
    },
  };
}
// Signed in (Supabase) but no shop yet — e.g. after confirming the e-mail.
function createShopView(me) {
  return {
    html: `<div class="auth">
      <div class="hero"><img src="/img/pointie-cheer.png" alt=""><h1 class="h1">อีกขั้นเดียว!</h1><p class="muted">${esc(me.email)}<br>ตั้งชื่อร้านของคุณเพื่อเริ่มใช้งาน</p></div>
      <div class="box"><form class="form" id="f">
        <h2 class="h1" style="font-size:24px">สร้างร้าน</h2>
        ${shopFields()}
        <p class="alert" id="err" hidden style="justify-content:flex-start"></p>
        <button class="btn btn-primary" id="submit">สร้างร้าน</button>
        <button type="button" class="btn btn-text" data-act="logout">ออกจากระบบ</button>
      </form></div></div>`,
    mount(r) {
      mountShopFields(r);
      r.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = r.querySelector('#submit'); btn.disabled = true;
        try { await api.createShop(Object.fromEntries(new FormData(e.target))); }
        catch (err) { btn.disabled = false; showErr(r, 'สร้างร้านไม่สำเร็จ: ' + err.message); return; }
        toast('สร้างร้านแล้ว!'); go('/shop');
      });
    },
    actions: { async logout() { await api.logout(); go('/login'); } },
  };
}

// ======================= dashboard =======================
let period = 30;
function barChart(series) {
  const max = Math.max(4, ...series.map((d) => d.n));
  const nice = Math.ceil(max / 4) * 4;
  const W = 700, H = 220, L = 30, B = 24, T = 8;
  const bw = (W - L) / series.length;
  const y = (v) => T + (H - T - B) * (1 - v / nice);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${L}" x2="${W}" y1="${y(nice * f)}" y2="${y(nice * f)}"/>`).join('');
  const ylab = [0, 0.5, 1].map((f) => `<text x="${L - 6}" y="${y(nice * f) + 4}" text-anchor="end">${Math.round(nice * f)}</text>`).join('');
  const bars = series.map((d, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64, top = y(d.n), h = Math.max(0, H - B - top);
    const r = Math.min(4, w / 2, h);
    const path = h > 0 ? `M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${H - B} Z` : '';
    const label = `${DAYS[d.date.getDay()]} ${d.date.getDate()} ${TH_M[d.date.getMonth()]}`;
    return `<rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-i="${i}" data-tip="${label} · ${d.n} ครั้ง"/>
      <path class="bar ${i === series.length - 1 ? 'today' : ''}" data-b="${i}" d="${path}"/>
      ${i % 2 === series.length % 2 ? '' : `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${d.date.getDate()}</text>`}`;
  }).join('');
  return `<div class="chart" id="bars"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="จำนวนแตะรับแสตมป์รายวัน 14 วันล่าสุด">
    <g class="grid">${grid}</g><g class="axis">${ylab}${bars}</g></svg><div class="tip" hidden></div></div>`;
}
function heatmap(heat) {
  const max = Math.max(1, ...heat.flat());
  const lvl = (v) => (v === 0 ? 'background:var(--track)' : `background:rgba(8,101,245,${[0.28, 0.45, 0.62, 0.8, 1][Math.min(4, Math.floor((v / max) * 4.999))]})`);
  let h = '<span></span>' + Array.from({ length: 14 }, (_, i) => `<span class="hd">${i % 2 ? '' : 8 + i}</span>`).join('');
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    h += `<span class="rl">${DAYS[d]}</span>` + heat[d].map((v, i) => `<span class="cell" style="${lvl(v)}" data-tip="${DAYS_FULL[d]} ${8 + i}:00–${9 + i}:00 · ${v} ครั้ง"></span>`).join('');
  }
  return `<div class="chart" id="heat"><div class="heat" role="img" aria-label="ช่วงเวลาที่ลูกค้ามาบ่อย">${h}</div><div class="tip" hidden></div></div>
    <div class="legend-scale">น้อย${[0.28, 0.45, 0.62, 0.8, 1].map((a) => `<i style="background:rgba(8,101,245,${a})"></i>`).join('')}มาก</div>`;
}
function bindTips(rootEl) {
  rootEl.querySelectorAll('.chart').forEach((ch) => {
    const tip = ch.querySelector('.tip');
    ch.addEventListener('pointermove', (e) => {
      const t = e.target.closest('[data-tip]');
      ch.querySelectorAll('.bar.hover').forEach((b) => b.classList.remove('hover'));
      if (!t) { tip.hidden = true; return; }
      if (t.dataset.i) ch.querySelector(`[data-b="${t.dataset.i}"]`)?.classList.add('hover');
      const r = ch.getBoundingClientRect();
      tip.textContent = t.dataset.tip; tip.hidden = false;
      tip.style.left = `${Math.min(r.width - 60, Math.max(60, e.clientX - r.left))}px`;
      tip.style.top = `${e.clientY - r.top}px`;
    });
    ch.addEventListener('pointerleave', () => { tip.hidden = true; ch.querySelectorAll('.bar.hover').forEach((b) => b.classList.remove('hover')); });
  });
}
function dashboardView(me, shop) {
  const s = api.stats(shop.id, period);
  const cs = api.customers(shop.id);
  const near = cs.filter((c) => c.left > 0 && c.left <= 2 && Date.now() - new Date(c.last) < 45 * 86400000).slice(0, 6);
  const recent = api.shopEvents(shop.id).slice(-8).reverse();
  const delta = s.tapsPrev ? Math.round(((s.taps - s.tapsPrev) / s.tapsPrev) * 100) : null;
  const evText = (e) => e.type === 'stamp' ? `รับแสตมป์ (${e.have}/${shop.card.need})` : e.type === 'redeem' ? `แลก ${esc(e.reward)}` : `รีวิว ${e.stars} ดาว`;
  return {
    html: head('Dashboard', `ภาพรวมของ ${esc(shop.name)}`, `<div class="seg" role="tablist">${[7, 30].map((p) => `<button class="${period === p ? 'on' : ''}" data-act="period" data-p="${p}">${p} วัน</button>`).join('')}</div>`) +
      (s.pendingRedeems ? `<a class="card-soft row" href="#/redeem" style="text-decoration:none;color:inherit;border:1px solid var(--soft-line)"><span class="accent">${icon('checkCircle', 22)}</span><span><b>มี ${s.pendingRedeems} รายการแลกรางวัลรอยืนยัน</b><br><span class="small muted">ให้ลูกค้าโชว์รหัส 4 หลักบนจอ แล้วกดยืนยัน</span></span><span class="muted" style="margin-left:auto">${icon('chev')}</span></a>` : '') +
      `<div class="tiles">
        <div class="tile hl"><span class="lbl">แตะรับแสตมป์วันนี้</span><span class="val">${s.today}</span><span class="delta">${shop.card.need} ดวง = 1 รางวัล</span></div>
        <div class="tile"><span class="lbl">แตะ ${period} วัน</span><span class="val">${s.taps}</span><span class="delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta == null ? '—' : `${delta > 0 ? '▲' : delta < 0 ? '▼' : ''} ${Math.abs(delta)}% จากช่วงก่อน`}</span></div>
        <div class="tile"><span class="lbl">ลูกค้า</span><span class="val">${s.customers}</span><span class="delta">ใหม่ ${s.newCustomers} คน</span></div>
        <div class="tile"><span class="lbl">อัตรากลับมาซ้ำ</span><span class="val">${s.returnRate}<small>%</small></span><span class="delta">มามากกว่า 1 ครั้งใน ${period} วัน</span></div>
        <div class="tile"><span class="lbl">แลกรางวัล</span><span class="val">${s.redeems}</span><span class="delta">${esc(shop.card.reward)}</span></div>
        <div class="tile"><span class="lbl">คะแนนรีวิว</span><span class="val">${s.rating ? s.rating.toFixed(1) : '—'}</span><span class="delta">${s.reviews} รีวิวใน ${period} วัน</span></div>
      </div>
      <div class="m-grid g-side">
        <div class="panel"><div class="between"><h2>แตะรับแสตมป์รายวัน</h2><span class="sub">14 วันล่าสุด</span></div>${barChart(s.series)}</div>
        <div class="panel"><h2>ลูกค้าที่บัตรใกล้ครบ</h2><p class="sub">ขาดอีก 1–2 ดวง เหมาะส่งโปรชวนกลับมา</p>
          <div class="list">${near.length ? near.map((c) => `<div class="li"><span class="initials sm" style="border-radius:50%">${esc(c.nick[0])}</span><div class="col" style="gap:0;flex:1"><b class="small">${esc(c.nick)}</b><span class="xs muted">มาล่าสุด ${ago(c.last)}</span></div><span class="pill soft">อีก ${c.left} ดวง</span></div>`).join('') : '<p class="sub">ยังไม่มี</p>'}</div>
          <a class="link" href="#/customers?f=near">ดูทั้งหมด</a></div>
      </div>
      <div class="m-grid g-2">
        <div class="panel"><div class="between"><h2>ลูกค้าแยกตามเจน</h2><span class="sub">${period} วันล่าสุด · ${s.genKnown} คนที่ระบุวันเกิด</span></div>
          ${s.genKnown ? `<div class="genbars">${GEN_ORDER.filter((g) => s.genCust[g]).map((g) => { const n = s.genCust[g]; const pct = Math.round((n / s.genKnown) * 100); return `<div class="genbar"><span class="gl">${GENS[g].name}</span><div class="gt"><i style="width:${pct}%"></i></div><span class="gv">${pct}% <small>${n} คน</small></span></div>`; }).join('')}</div>` : '<p class="sub">ยังไม่มีข้อมูล</p>'}
        </div>
        <div class="panel"><div class="between"><h2>คะแนนรีวิวแยกเจน</h2><span class="sub">${period} วันล่าสุด</span></div>
          ${Object.keys(s.genRev).length ? `<div class="list">${GEN_ORDER.filter((g) => s.genRev[g]).map((g) => { const v = s.genRev[g]; const avg = v.sum / v.n; return `<div class="li"><span class="gen-emoji">${genEmoji(avg)}</span><div class="col" style="gap:0;flex:1"><b class="small">${GENS[g].name}</b><span class="xs muted">${genMood(avg)} · ${v.n} รีวิว</span></div><b>${avg.toFixed(1)}</b></div>`; }).join('')}</div>` : '<p class="sub">ยังไม่มีรีวิวในช่วงนี้</p>'}
          <p class="xs muted">ร้านเห็นเฉพาะภาพรวมตามเจน ไม่เห็นวันเกิดหรือชื่อจริงของลูกค้า</p>
        </div>
      </div>
      <div class="m-grid g-side">
        <div class="panel"><div class="between"><h2>ช่วงเวลาที่ลูกค้ามา</h2><span class="sub">${period} วันล่าสุด</span></div>${heatmap(s.heat)}</div>
        <div class="panel"><h2>กิจกรรมล่าสุด</h2><div class="list">${recent.length ? recent.map((e) => `<div class="li"><span class="initials sm" style="border-radius:50%">${esc((e.nick || '?')[0])}</span><div class="col" style="gap:0;flex:1;min-width:0"><span class="small"><b>${esc(e.nick || 'ลูกค้า')}</b> ${evText(e)}</span><span class="xs muted">${ago(e.at)}</span></div></div>`).join('') : '<p class="sub">ยังไม่มีกิจกรรม</p>'}</div></div>
      </div>`,
    mount(r) { bindTips(r); },
    actions: { period(el) { period = +el.dataset.p; rerender(); } },
  };
}

// ======================= redeem =======================
let redeemCode = '';
let lookup = { code: '', result: null };
function redeemView(me, shop) {
  const found = redeemCode.length === 4 && lookup.code === redeemCode ? lookup.result : null;
  const searching = redeemCode.length === 4 && lookup.code !== redeemCode;
  const list = api.redemptions(shop.id).slice(0, 30);
  return {
    html: head('ยืนยันแลกรางวัล', 'ให้ลูกค้ากด "แลกรางวัล" ในแอพ แล้วใส่รหัส 4 หลักที่ขึ้นบนจอลูกค้า') +
      `<div class="m-grid g-2">
        <div class="panel">
          <label class="field"><span>รหัสจากจอลูกค้า</span>
            <div class="code-in"><input class="inp" id="code" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(redeemCode)}" placeholder="••••"></div></label>
          ${searching ? '<p class="sub">กำลังค้นหา…</p>' : redeemCode.length === 4 ? (found
            ? `<div class="card col" style="border-color:var(--primary)"><div class="row"><span class="initials" style="border-radius:50%">${esc(found.nick[0])}</span><div class="col" style="gap:0"><b style="font-size:18px">${esc(found.nick)}</b><span class="small muted">ขอแลกเมื่อ ${ago(found.at)}</span></div></div>
                <div class="card-soft"><span class="xs muted">รางวัล</span><br><b style="font-size:18px">${esc(found.reward)}</b></div>
                <div class="actions"><button class="btn btn-primary" data-act="confirm" data-id="${found.id}">${icon('check', 18, 3)}ยืนยันส่งมอบรางวัล</button><button class="btn btn-ghost" data-act="void" data-id="${found.id}">ไม่ถูกต้อง</button></div></div>`
            : `<div class="alert-box"><b style="color:var(--red)">ไม่พบรหัสนี้</b><span class="small muted">รหัสอาจผิด ถูกใช้ไปแล้ว หรือเกิน 24 ชั่วโมง</span></div>`) : ''}
        </div>
        <div class="panel"><h2>ขั้นตอนหน้าร้าน</h2>
          <div class="howto"><div><b class="n">1</b><span>ลูกค้าเปิดบัตรที่ครบแล้ว กด <b>แลกรางวัล</b></span></div><div><b class="n">2</b><span>จอลูกค้าขึ้น <b>รหัสยืนยัน 4 หลัก</b></span></div><div><b class="n">3</b><span>พนักงานใส่รหัสที่นี่ ตรวจชื่อและรางวัล แล้วกด <b>ยืนยัน</b></span></div></div></div>
      </div>
      <div class="panel"><h2>ประวัติการแลก</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>เวลา</th><th>ลูกค้า</th><th>รางวัล</th><th>รหัส</th><th>สถานะ</th></tr></thead><tbody>
        ${list.length ? list.map((e) => `<tr><td>${fmtDT(e.at)}</td><td>${esc(e.nick)}</td><td>${esc(e.reward)}</td><td class="num">${e.code}</td><td><span class="status ${e.status}">${{ pending: 'รอยืนยัน', confirmed: 'ส่งมอบแล้ว', void: 'ยกเลิก' }[e.status]}</span></td></tr>`).join('') : '<tr><td colspan="5" class="muted">ยังไม่มีการแลก</td></tr>'}
      </tbody></table></div></div>`,
    mount(r) {
      const inp = r.querySelector('#code');
      inp.addEventListener('input', async () => {
        const v = inp.value.replace(/\D/g, '').slice(0, 4); inp.value = v;
        const changed = v.length === 4 || redeemCode.length === 4;
        redeemCode = v;
        if (!changed) return;
        rerender();
        if (v.length === 4) {
          let result = null;
          try { result = await api.findPending(shop.id, v); } catch (e) { console.warn(e); toast('ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง'); }
          if (redeemCode === v) { lookup = { code: v, result: result || null }; rerender(); }
        }
      });
      if (!redeemCode) inp.focus();
    },
    actions: {
      confirm(el) { el.disabled = true; const id = el.dataset.id; redeemCode = ''; lookup = { code: '', result: null }; act(api.confirmRedeem(id, me.email), 'ยืนยันส่งมอบรางวัลแล้ว'); },
      void(el) { if (confirm('ทำเครื่องหมายว่ารายการนี้ไม่ถูกต้อง?')) { const id = el.dataset.id; redeemCode = ''; lookup = { code: '', result: null }; act(api.voidRedeem(id, me.email), 'ยกเลิกรายการแล้ว'); } },
    },
  };
}

// ======================= shop info & map =======================
let shopDraft = null;
let locDraft = null; // { id, lat, lng } while the merchant is choosing a location
function hhmm(v) { const h = Math.floor(v); return `${String(h).padStart(2, '0')}:${v % 1 ? '30' : '00'}`; }
function shopView(me, shop) {
  if (!shopDraft || shopDraft.id !== shop.id) shopDraft = { id: shop.id, name: shop.name, initials: shop.initials, cat: shop.cat, area: shop.area, address: shop.address, phone: shop.phone, hours: shop.hours, closed: shop.closed, openAt: shop.openAt, closeAt: shop.closeAt, summary: shop.summary || '' };
  const d = shopDraft;
  if (!locDraft || locDraft.id !== shop.id) locDraft = { id: shop.id, lat: shop.lat, lng: shop.lng, dirty: false };
  const loc = locDraft;
  const located = shop.located !== false && hasCoords(shop);
  const f = (k, label, attrs = '') => `<label class="field"><span>${label}</span><input class="inp" name="${k}" value="${esc(d[k] ?? '')}" ${attrs}></label>`;
  return {
    html: head('ข้อมูลร้าน & แมพ', 'ข้อมูลนี้แสดงในหน้าร้านและแมพของแอพลูกค้า') +
      `<div class="m-grid g-2">
        <form class="panel form" id="f">
          <h2>ข้อมูลทั่วไป</h2>
          <div class="row2">${f('name', 'ชื่อร้าน', 'required maxlength="40"')}${f('initials', 'ตัวย่อ (2 ตัวอักษร)', 'maxlength="2"')}</div>
          <div class="row2"><label class="field"><span>หมวด</span><select class="inp" name="cat">${Object.entries(api.CAT).map(([k, v]) => `<option value="${k}" ${d.cat === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>${f('area', 'ย่าน', 'maxlength="30"')}</div>
          ${f('address', 'ที่อยู่', 'maxlength="120"')}
          ${f('phone', 'เบอร์โทรร้าน', 'inputmode="tel" maxlength="20"')}
          <h2 style="margin-top:6px">เวลาเปิด-ปิด</h2>
          <div class="row2"><label class="field"><span>เปิด</span><input class="inp" type="time" name="openT" step="1800" value="${hhmm(d.openAt)}"></label><label class="field"><span>ปิด</span><input class="inp" type="time" name="closeT" step="1800" value="${hhmm(d.closeAt)}"></label></div>
          <div class="row2">${f('hours', 'ข้อความเวลาทำการ', 'maxlength="40"')}${f('closed', 'วันหยุด', 'maxlength="40"')}</div>
          <label class="field"><span>แนะนำร้าน</span><textarea class="inp" name="summary" maxlength="300" placeholder="เล่าจุดเด่นของร้านสั้นๆ">${esc(d.summary)}</textarea></label>
          <div class="actions"><button class="btn btn-primary">บันทึกข้อมูลร้าน</button></div>
        </form>
        <div class="panel col-gap">
          <div class="between"><h2>ตำแหน่งบน Google Maps</h2><span class="sub ${located ? 'ok' : 'warn'}">${located ? 'ปักหมุดแล้ว' : 'ยังไม่ได้ปักหมุด'}</span></div>
          <div class="gpreview"><iframe id="gprev" title="ตัวอย่างตำแหน่งร้าน" src="${hasCoords(loc) ? embedUrl(loc.lat, loc.lng, 17) : embedFor(shop, 15)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
          <label class="field"><span>วางลิงก์ Google Maps หรือพิกัด</span><input class="inp" id="locIn" placeholder="เช่น 13.78105, 100.54392 หรือ https://www.google.com/maps/place/…" autocomplete="off"></label>
          <p class="sub" id="locMsg">${hasCoords(loc) ? `พิกัดปัจจุบัน ${loc.lat}, ${loc.lng}` : ''}</p>
          <details class="sub"><summary>หาพิกัดร้านยังไง</summary>
            <ol class="howto"><li>เปิด Google Maps แล้วค้นหาร้าน (หรือกดค้างตรงที่ตั้งร้าน)</li><li>บนมือถือ: ตัวเลขพิกัดจะขึ้นในช่องค้นหา กดคัดลอก · บนคอม: คลิกขวาที่หมุด แล้วคลิกตัวเลขพิกัดบรรทัดแรก</li><li>วางในช่องด้านบน แผนที่จะขยับไปที่ร้านทันที</li></ol></details>
          <div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="here">${icon('locate', 16)}ใช้ตำแหน่งปัจจุบัน</button><button type="button" class="btn btn-primary btn-sm" data-act="savePin" ${loc.dirty ? '' : 'disabled'}>บันทึกตำแหน่ง</button></div>
        </div>
      </div>`,
    mount(r) {
      const form = r.querySelector('#f');
      form.addEventListener('input', (e) => { if (e.target.name) shopDraft[e.target.name] = e.target.value; });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(form));
        const t = (v) => { const [h, m] = v.split(':').map(Number); return h + (m >= 30 ? 0.5 : 0); };
        act(api.saveShop(shop.id, { name: fd.name.trim(), initials: fd.initials.trim() || fd.name.slice(0, 2), cat: fd.cat, area: fd.area.trim(), address: fd.address.trim(), phone: fd.phone.trim(), hours: fd.hours.trim(), closed: fd.closed.trim(), summary: fd.summary.trim(), openAt: t(fd.openT), closeAt: t(fd.closeT) }), 'บันทึกข้อมูลร้านแล้ว');
        shopDraft = null;
      });
      const inp = r.querySelector('#locIn'), msg = r.querySelector('#locMsg'), prev = r.querySelector('#gprev'), save = r.querySelector('[data-act=savePin]');
      inp.addEventListener('input', () => {
        const t = inp.value.trim(); if (!t) return;
        const ll = parseLatLng(t);
        if (ll) {
          Object.assign(locDraft, ll, { dirty: true });
          prev.src = embedUrl(ll.lat, ll.lng, 17); save.disabled = false;
          msg.className = 'sub ok'; msg.textContent = `พบตำแหน่ง ${ll.lat}, ${ll.lng} — ตรวจหมุดบนแผนที่แล้วกดบันทึก`;
        } else {
          msg.className = 'sub warn';
          msg.textContent = isShortMapsLink(t)
            ? 'ลิงก์แบบย่อ (maps.app.goo.gl) อ่านพิกัดไม่ได้ — เปิดลิงก์นั้นในเบราว์เซอร์ แล้วคัดลอกลิงก์เต็มจากช่องที่อยู่ หรือคัดลอกตัวเลขพิกัดมาวาง'
            : 'ยังอ่านพิกัดไม่ได้ วางตัวเลขพิกัด เช่น 13.78105, 100.54392 หรือลิงก์ Google Maps แบบเต็ม';
        }
      });
    },
    actions: {
      savePin() {
        if (!hasCoords(locDraft)) return;
        const pos = { lat: locDraft.lat, lng: locDraft.lng, located: true }; locDraft = null;
        act(api.saveShop(shop.id, pos), 'บันทึกตำแหน่งแล้ว ลูกค้าจะเห็นร้านบนแผนที่ตรงจุดนี้');
      },
      async here(el) {
        el.disabled = true;
        try {
          const ll = await locateMe(); Object.assign(locDraft, ll, { dirty: true }); render();
          toast('ใช้ตำแหน่งปัจจุบันแล้ว ตรวจหมุดบนแผนที่แล้วกดบันทึก');
        } catch (e) { toast(e.message); el.disabled = false; }
      },
    },
  };
}

// ======================= card designer =======================
// Downscale an uploaded image so it fits comfortably in storage (keeps transparency).
function shrinkImage(file, maxW = 720, maxH = 1040) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.width, maxH / img.height);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/webp', 0.82);
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.85);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}
const BG_PRESETS = ['#8C2F1C', '#1F5E45', '#1E3A6B', '#0E6B5C', '#3B2A20', '#5A2A14', '#2B2B2B', '#4B2A6B', '#6B4A2B'];
const INK_PRESETS = ['#FFD23F', '#FFC83D', '#F7F7F7', '#F6EEDF', '#FF9A5C', '#A592FF'];
let cardDraft = null;
function cardView(me, shop) {
  if (!cardDraft || cardDraft._id !== shop.id) cardDraft = { ...shop.card, _id: shop.id };
  const c = cardDraft;
  const preview = { ...shop, card: c };
  const changed = JSON.stringify({ ...c, _id: undefined }) !== JSON.stringify({ ...shop.card, _id: undefined });
  return {
    html: head('ออกแบบบัตรสะสม', 'พรีวิวด้านขวาคือหน้าตาที่ลูกค้าเห็นในแอพ') +
      `<div class="m-grid g-side">
        <form class="panel form" id="f">
          <h2>รูปบนบัตร (เต็มใบ)</h2>
          <div class="field">
            <div class="art-up">
              <div class="art-thumb ${cardBg(c)}" style="${cardBgStyle(c)}">${isCardArt(c.art) ? '<span class="safe-line" aria-hidden="true">ช่องแสตมป์</span>' : '<span class="xs" style="color:rgba(255,255,255,.75);text-align:center;padding:8px">ยังไม่มีรูป</span>'}</div>
              <div class="col" style="gap:8px">
                <label class="btn btn-ghost btn-sm" style="height:40px;cursor:pointer">${icon('camera', 16)}${isCardArt(c.art) ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}<input type="file" accept="image/png,image/jpeg,image/webp" id="artFile" class="sr-only"></label>
                ${isCardArt(c.art) ? `<button type="button" class="btn btn-danger btn-sm" style="height:40px" data-act="artRemove">${icon('trash', 16)}ลบรูป</button>` : ''}
                <div class="size-spec"><b>ขนาดแนะนำ 1080 × 1560 px</b><span>แนวตั้ง สัดส่วนประมาณ 2:3 · JPG / PNG / WebP</span></div>
              </div>
            </div>
            <small>รูปจะเต็มทั้งใบบัตร ครึ่งล่างมีช่องแสตมป์ทับ ให้วางโลโก้หรือข้อความสำคัญไว้ <b>ครึ่งบน</b> และเว้นขอบซ้าย-ขวาไว้เล็กน้อย เพราะบางหน้าจอจะตัดขอบรูปนิดหน่อย${isCardArt(c.art) ? '' : ' · ถ้ายังไม่ใส่รูป บัตรจะใช้สีพื้นและชื่อร้านด้านล่างแทน'}</small>
          </div>
          ${isCardArt(c.art) ? '' : `<label class="field"><span>ชื่อภาษาอังกฤษ (บรรทัดบนของบัตร)</span><input class="inp" name="en" value="${esc(c.en)}" maxlength="32"></label>`}
          <h2 style="margin-top:6px">กติกา</h2>
          <div class="field"><span>จำนวนแสตมป์ที่ต้องสะสม</span><div class="seg">${[5, 6, 8, 10].map((n) => `<button type="button" class="${+c.need === n ? 'on' : ''}" data-act="need" data-n="${n}">${n} ดวง</button>`).join('')}</div></div>
          <label class="field"><span>รางวัลเมื่อครบ</span><input class="inp" name="reward" value="${esc(c.reward)}" maxlength="40"></label>
          <h2 style="margin-top:6px">หน้าตา</h2>
          ${isCardArt(c.art) ? '' : `<div class="field"><span>พื้นหลัง (เมื่อยังไม่มีรูป)</span><div class="seg"><button type="button" class="${!c.photo ? 'on' : ''}" data-act="style" data-v="dots">สีพื้น + ลายจุด</button><button type="button" class="${c.photo ? 'on' : ''}" data-act="style" data-v="photo">รูปหน้าร้าน</button></div></div>`}
          ${c.photo || isCardArt(c.art) ? '' : `<div class="field"><span>สีบัตร</span><div class="swatches">${BG_PRESETS.map((v) => `<button type="button" class="${c.bg === v ? 'on' : ''}" style="background:${v}" data-act="bg" data-v="${v}" aria-label="สี ${v}"></button>`).join('')}<input class="inp" type="color" name="bg" value="${esc(c.bg)}" aria-label="เลือกสีเอง"></div></div>`}
          ${isCardArt(c.art) ? '' : `<div class="field"><span>สีชื่อร้าน (ใช้เมื่อยังไม่มีรูป)</span><div class="swatches">${INK_PRESETS.map((v) => `<button type="button" class="${c.letter === v ? 'on' : ''}" style="background:${v}" data-act="ink" data-v="${v}" aria-label="สี ${v}"></button>`).join('')}<input class="inp" type="color" name="letter" value="${esc(c.letter)}" aria-label="เลือกสีเอง"></div></div>`}
          <div class="field"><span>ไอคอนแสตมป์</span><div class="seg"><button type="button" class="${c.glyph === 'cup' ? 'on' : ''}" data-act="glyph" data-v="cup">ถ้วยกาแฟ</button><button type="button" class="${c.glyph !== 'cup' ? 'on' : ''}" data-act="glyph" data-v="star">ดาว</button></div></div>
          <p class="small muted">${icon('alert', 14)} เปลี่ยนจำนวนดวงแล้ว บัตรที่ลูกค้าสะสมอยู่จะใช้กติกาใหม่ทันที (เวอร์ชันเดโม)</p>
          <div class="actions"><button class="btn btn-primary" ${changed ? '' : 'disabled'}>บันทึกบัตร</button><button type="button" class="btn btn-ghost" data-act="resetCard" ${changed ? '' : 'disabled'}>ยกเลิกการแก้ไข</button></div>
        </form>
        <div class="preview">
          <div class="phone">${bigStampCard(preview, Math.min(c.need - 1, Math.ceil(c.need * 0.6)), { foot: 'ครั้งที่ 12' })}</div>
          <div class="row" style="gap:10px"><div class="minicard ${cardBg(c)}" style="${cardBgStyle(c)}width:96px;flex:none">${letterHtml(c)}<span class="minibar">${Array.from({ length: c.need }, (_, j) => `<i class="${j < 3 ? 'f' : ''}"></i>`).join('')}</span><span class="n">3/${c.need}</span></div><p class="small muted">หน้าตาในหน้า "บัตรของฉัน"</p></div>
        </div>
      </div>`,
    mount(r) {
      const form = r.querySelector('#f');
      form.addEventListener('input', (e) => { if (e.target.name) { cardDraft[e.target.name] = e.target.value; rerender(); } });
      r.querySelector('#artFile').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 8 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 8MB'); return; }
        try { cardDraft.art = await shrinkImage(f); rerender(); } catch { toast('เปิดรูปนี้ไม่ได้ ลองไฟล์ PNG หรือ JPG'); }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const { _id, ...card } = cardDraft;
        if (!card.reward.trim()) { toast('กรอกรางวัลเมื่อครบก่อนนะ'); return; }
        act(api.saveShop(shop.id, { card: { ...card, need: +card.need } }), 'บันทึกบัตรแล้ว ลูกค้าจะเห็นบัตรใหม่ในแอพ').then((ok) => { if (ok) { cardDraft = null; rerender(); } });
      });
    },
    actions: {
      need(el) { cardDraft.need = +el.dataset.n; rerender(); },
      style(el) { cardDraft.photo = el.dataset.v === 'photo'; rerender(); },
      bg(el) { cardDraft.bg = el.dataset.v; rerender(); },
      ink(el) { cardDraft.letter = el.dataset.v; rerender(); },
      glyph(el) { cardDraft.glyph = el.dataset.v; rerender(); },
      resetCard() { cardDraft = null; rerender(); },
      artRemove() { cardDraft.art = null; rerender(); },
    },
  };
}

// ======================= promos & events =======================
let promoDraft = null;
function promosView(me, shop) {
  if (!promoDraft || promoDraft._id !== shop.id) {
    promoDraft = { _id: shop.id, promo: !!shop.promo, promoText: shop.promoText || '', promoUntil: shop.promoUntil || '', double: shop.promoRule?.type === 'double', days: [...(shop.promoRule?.days || [])],
      hasEvent: !!shop.event, evTitle: shop.event?.title || '', evDate: shop.event?.date || '', evTime: shop.event?.time || '14:00',
      tpActive: !!shop.tierPromo?.active, tpTier: shop.tierPromo?.minTier || 'pro', tpText: shop.tierPromo?.text || '' };
  }
  const p = promoDraft;
  const evPreview = p.hasEvent && p.evTitle ? (() => { const d = p.evDate ? new Date(p.evDate) : null; return { day: d ? d.getDate() : '?', mon: d ? TH_M[d.getMonth()] : '' }; })() : null;
  return {
    html: head('โปรและกิจกรรม', 'โปรจะขึ้นป้าย "โปร" บนแมพ และแสดงในหน้าแรกกับหน้าร้านของลูกค้า') +
      `<div class="m-grid g-side">
        <form class="col" id="f" style="gap:16px">
          <div class="panel form">
            <button type="button" class="toggle" data-act="tgPromo"><span class="switch ${p.promo ? 'on' : ''}"></span>เปิดโปรโมชั่น</button>
            ${p.promo ? `
            <label class="field"><span>ข้อความโปร</span><input class="inp" name="promoText" value="${esc(p.promoText)}" maxlength="60" placeholder="เช่น แสตมป์ x2 ทุกวันพุธ"></label>
            <label class="field"><span>ระยะเวลา</span><input class="inp" name="promoUntil" value="${esc(p.promoUntil)}" maxlength="30" placeholder="เช่น ถึง 30 พ.ย."></label>
            <button type="button" class="toggle" data-act="tgDouble"><span class="switch ${p.double ? 'on' : ''}"></span>ให้แสตมป์ x2 อัตโนมัติ</button>
            ${p.double ? `<div class="field"><span>วันที่ได้ x2</span><div class="daypick">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="${p.days.includes(d) ? 'on' : ''}" data-act="day" data-d="${d}">${DAYS[d]}</button>`).join('')}</div><small>ลูกค้าที่แตะในวันนี้จะได้ 2 ดวงทันที</small></div>` : ''}` : ''}
          </div>
          <div class="panel form">
            <button type="button" class="toggle" data-act="tgEvent"><span class="switch ${p.hasEvent ? 'on' : ''}"></span>มีกิจกรรมพิเศษ</button>
            ${p.hasEvent ? `
            <label class="field"><span>ชื่อกิจกรรม</span><input class="inp" name="evTitle" value="${esc(p.evTitle)}" maxlength="60" placeholder="เช่น เวิร์กช็อปดริปกาแฟ"></label>
            <div class="row2"><label class="field"><span>วันที่</span><input class="inp" type="date" name="evDate" value="${esc(p.evDate)}"></label><label class="field"><span>เวลา</span><input class="inp" type="time" name="evTime" value="${esc(p.evTime)}"></label></div>` : ''}
          </div>
          <div class="panel form">
            <button type="button" class="toggle" data-act="tgTier"><span class="switch ${p.tpActive ? 'on' : ''}"></span>โปรสำหรับสมาชิกระดับสูง</button>
            <p class="sub">สิทธิ์พิเศษเฉพาะลูกค้าที่ไปร้านต่างๆ บ่อย (เลเวลคำนวณจากการไปร้านจริงและรีวิว แก้เองไม่ได้)</p>
            ${p.tpActive ? `
            <div class="field"><span>ระดับขั้นต่ำ</span><div class="seg">${TIERS.filter((x) => x.id !== 'explorer').map((x) => `<button type="button" class="${p.tpTier === x.id ? 'on' : ''}" data-act="tpTier" data-v="${x.id}">${x.name} (Lv.${x.min}+)</button>`).join('')}</div></div>
            <label class="field"><span>สิทธิ์ที่ได้</span><input class="inp" name="tpText" value="${esc(p.tpText)}" maxlength="60" placeholder="เช่น ท็อปปิ้งฟรี 1 อย่าง"></label>
            <small class="sub">ลูกค้าจะแสดงบัตรสมาชิก (หน้าโปรไฟล์ในแอพ) ที่มีระดับกับพนักงาน</small>` : ''}
          </div>
          <div class="actions"><button class="btn btn-primary">บันทึกโปรและกิจกรรม</button></div>
        </form>
        <div class="preview"><div class="phone">
          <span class="xs muted semi">พรีวิวในหน้าแรกของลูกค้า</span>
          ${p.promo && p.promoText ? `<div class="card event"><div class="date"><b>${p.double && p.days.length === 1 ? 'ทุก' : '★'}</b><span>${p.double && p.days.length === 1 ? 'วัน' + DAYS_FULL[p.days[0]] : 'โปร'}</span></div><div class="col" style="flex:1;min-width:0;gap:3px"><span class="tag" style="background:var(--soft);color:var(--accent)">โปร</span><span class="semi">${esc(p.promoText)}</span><span class="small muted">${esc(shop.name)}</span></div></div>` : ''}
          ${evPreview ? `<div class="card event"><div class="date"><b>${evPreview.day}</b><span>${evPreview.mon}</span></div><div class="col" style="flex:1;min-width:0;gap:3px"><span class="tag" style="background:var(--teal-soft);color:var(--teal)">กิจกรรม</span><span class="semi">${esc(p.evTitle)}</span><span class="small muted">${esc(shop.name)}</span></div></div>` : ''}
          ${p.tpActive && p.tpText ? `<span class="xs muted semi">พรีวิวในหน้าร้าน</span><div class="tier-promo" style="--tc:${tierById(p.tpTier).color}"><span class="tp-badge">${tierById(p.tpTier).name}+</span><div class="col" style="gap:2px;flex:1"><b>${esc(p.tpText)}</b><span class="xs muted">สำหรับสมาชิก Lv.${tierById(p.tpTier).min} ขึ้นไป</span></div></div>` : ''}
          ${!(p.promo && p.promoText) && !evPreview && !(p.tpActive && p.tpText) ? '<p class="small muted">ยังไม่มีโปรหรือกิจกรรม</p>' : ''}
        </div></div>
      </div>`,
    mount(r) {
      const form = r.querySelector('#f');
      form.addEventListener('input', (e) => { if (e.target.name) { promoDraft[e.target.name] = e.target.value; rerender(); } });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (p.promo && !p.promoText.trim()) { toast('ใส่ข้อความโปรก่อนนะ'); return; }
        if (p.double && !p.days.length) { toast('เลือกวันที่ได้ x2 อย่างน้อย 1 วัน'); return; }
        let event = null;
        if (p.hasEvent && p.evTitle.trim()) {
          const d = p.evDate ? new Date(p.evDate) : null;
          event = { title: p.evTitle.trim(), date: p.evDate, time: p.evTime, day: d ? String(d.getDate()) : '★', mon: d ? TH_M[d.getMonth()] : 'เร็วๆ นี้', when: d ? `${DAYS[d.getDay()]} ${d.getDate()} ${TH_M[d.getMonth()]} · ${p.evTime}` : p.evTime };
        }
        if (p.tpActive && !p.tpText.trim()) { toast('ใส่สิทธิ์ที่สมาชิกได้ก่อนนะ'); return; }
        promoDraft = null;
        const tierPromo = { active: p.tpActive, minTier: p.tpTier, text: p.tpText.trim() };
        act(api.saveShop(shop.id, { promo: p.promo, promoText: p.promoText.trim(), promoUntil: p.promoUntil.trim(), promoRule: p.double ? { type: 'double', days: p.days } : null, event, tierPromo }), 'บันทึกแล้ว ลูกค้าจะเห็นในแอพทันที');
      });
    },
    actions: {
      tgPromo() { promoDraft.promo = !promoDraft.promo; rerender(); },
      tgDouble() { promoDraft.double = !promoDraft.double; rerender(); },
      tgEvent() { promoDraft.hasEvent = !promoDraft.hasEvent; rerender(); },
      tgTier() { promoDraft.tpActive = !promoDraft.tpActive; rerender(); },
      tpTier(el) { promoDraft.tpTier = el.dataset.v; rerender(); },
      day(el) { const d = +el.dataset.d; promoDraft.days = promoDraft.days.includes(d) ? promoDraft.days.filter((x) => x !== d) : [...promoDraft.days, d]; rerender(); },
    },
  };
}

// ======================= stands =======================
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
function standsView(me, shop) {
  const canNfc = 'NDEFReader' in window;
  return {
    html: head('จุดแตะ NFC / QR', 'แต่ละสแตนด์มีลิงก์ของตัวเอง ปิดหรือเปลี่ยนรหัสได้ถ้าแท็กหายหรือถูกแชร์ต่อ', `<form id="add" class="row" style="gap:8px"><input class="inp" name="name" placeholder="ชื่อสแตนด์ เช่น เคาน์เตอร์" maxlength="30" style="width:220px"><button class="btn btn-primary btn-sm" style="height:44px">${icon('sparkle', 16)}เพิ่มสแตนด์</button></form>`) +
      (shop.stands.length ? shop.stands.map((s) => {
        const url = api.tapUrl(shop.id, s);
        return `<div class="panel stand ${s.active ? '' : 'off'}">
          <div class="qrbox">${qrSvg(url)}</div>
          <div class="col" style="gap:10px;min-width:0">
            <div class="between"><b style="font-size:17px">${esc(s.name)}</b><button type="button" class="toggle small" data-act="tgStand" data-id="${s.id}"><span class="switch ${s.active ? 'on' : ''}"></span>${s.active ? 'เปิดใช้งาน' : 'ปิดอยู่'}</button></div>
            <div class="urlbox">${esc(url)}</div>
            <div class="actions">
              <button class="btn btn-ghost btn-sm" data-act="copy" data-url="${esc(url)}">คัดลอกลิงก์</button>
              <button class="btn btn-ghost btn-sm" data-act="print" data-id="${s.id}">พิมพ์ป้าย QR</button>
              ${canNfc ? `<button class="btn btn-ghost btn-sm" data-act="nfc" data-url="${esc(url)}">${icon('nfc', 16)}เขียนลงแท็ก NFC</button>` : ''}
              <a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">ทดลองแตะ</a>
              <button class="btn btn-ghost btn-sm" data-act="rotate" data-id="${s.id}">${icon('refresh', 16)}เปลี่ยนรหัส</button>
              <button class="btn btn-danger btn-sm" data-act="delStand" data-id="${s.id}">${icon('trash', 16)}</button>
            </div>
            <span class="xs muted">สร้างเมื่อ ${fmtDT(s.createdAt)}${s.rotatedAt ? ` · เปลี่ยนรหัสล่าสุด ${fmtDT(s.rotatedAt)}` : ''}</span>
          </div></div>`;
      }).join('') : `<div class="panel center" style="align-items:center"><img src="/img/pointie-point.png" alt="" style="height:110px"><b>ยังไม่มีสแตนด์</b><p class="sub">เพิ่มสแตนด์แรก แล้วพิมพ์ QR หรือเขียนลงแท็ก NFC วางที่เคาน์เตอร์</p></div>`) +
      `<div class="panel"><h2>วิธีเขียนลิงก์ลงแท็ก NFC</h2><div class="howto">
        <div><b class="n">1</b><span>${canNfc ? 'กด <b>เขียนลงแท็ก NFC</b> แล้วแตะแท็กเปล่าที่ด้านหลังมือถือ' : 'ใช้ Android Chrome กดปุ่ม <b>เขียนลงแท็ก NFC</b> ในหน้านี้ หรือใช้แอพ NFC Tools (iPhone/Android)'}</span></div>
        <div><b class="n">2</b><span>ถ้าใช้แอพอื่น: เลือก “เขียน URL” แล้ววางลิงก์ของสแตนด์</span></div>
        <div><b class="n">3</b><span>แปะแท็กบนสแตนด์คู่กับ QR — iPhone และ Android จะเปิดแอพ D Point ให้ลูกค้าทันที</span></div></div></div>
      <div class="print-area" id="printArea"></div>`,
    mount(r) {
      r.querySelector('#add').addEventListener('submit', (e) => {
        e.preventDefault(); const name = new FormData(e.target).get('name').trim();
        act(api.addStand(shop.id, name), 'เพิ่มสแตนด์แล้ว');
      });
    },
    actions: {
      async copy(el) { try { await navigator.clipboard.writeText(el.dataset.url); toast('คัดลอกลิงก์แล้ว'); } catch { toast('คัดลอกไม่ได้ ลองเลือกข้อความแทน'); } },
      tgStand(el) { const s = shop.stands.find((x) => x.id === el.dataset.id); act(api.updateStand(shop.id, s.id, { active: !s.active }), s.active ? 'ปิดสแตนด์แล้ว ลิงก์นี้จะใช้รับแสตมป์ไม่ได้' : 'เปิดสแตนด์แล้ว'); },
      rotate(el) { if (confirm('เปลี่ยนรหัสสแตนด์? QR/แท็กเดิมจะใช้ไม่ได้ ต้องพิมพ์หรือเขียนใหม่')) act(api.rotateStand(shop.id, el.dataset.id), 'เปลี่ยนรหัสแล้ว อย่าลืมพิมพ์ QR ใหม่'); },
      delStand(el) { if (confirm('ลบสแตนด์นี้?')) act(api.removeStand(shop.id, el.dataset.id), 'ลบสแตนด์แล้ว'); },
      print(el) {
        const s = shop.stands.find((x) => x.id === el.dataset.id);
        const pa = document.getElementById('printArea');
        pa.innerHTML = `<h1 style="font-size:36px;margin:0">${esc(shop.name)}</h1><p style="font-size:20px;margin:0">แตะมือถือ หรือสแกน QR เพื่อรับแสตมป์</p><div style="width:320px">${qrSvg(api.tapUrl(shop.id, s))}</div><p style="font-size:14px;margin:0">D Point · ${esc(s.name)}</p>`;
        window.print();
      },
      async nfc(el) {
        try { await new window.NDEFReader().write({ records: [{ recordType: 'url', data: el.dataset.url }] }); toast('เขียนแท็กสำเร็จ'); } catch (e) { toast('เขียนแท็กไม่สำเร็จ: ' + (e.message || 'ลองใหม่')); }
      },
    },
  };
}

// ======================= reviews =======================
function reviewsView(me, shop) {
  const list = api.reviews(shop.id);
  return {
    html: head('รีวิว', 'ตอบกลับรีวิวได้ คำตอบจะแสดงใต้รีวิวในหน้าร้านของลูกค้า') +
      (list.length ? list.map((r) => `<div class="panel">
        <div class="between"><div class="row" style="gap:10px"><span class="initials sm" style="border-radius:50%">${esc(r.nick[0])}</span><div class="col" style="gap:0"><b>${esc(r.nick)}</b><span class="xs muted">${esc(r.date)}${r.sample ? ' · รีวิวตัวอย่าง' : ''}</span></div></div><span class="real">${icon('check', 11, 3)}ไปจริง</span></div>
        ${starsHtml(r.stars)}<p>${esc(r.text)}</p>
        <form class="col reply" data-key="${esc(r.key)}" style="gap:8px"><textarea class="inp" name="reply" placeholder="ตอบกลับลูกค้า…" maxlength="300">${esc(r.reply || '')}</textarea>
        <div class="actions"><button class="btn btn-primary btn-sm">${r.reply ? 'อัปเดตคำตอบ' : 'ตอบกลับ'}</button>${r.reply ? '<span class="status confirmed">ตอบแล้ว</span>' : ''}</div></form>
      </div>`).join('') : '<div class="panel"><p class="sub">ยังไม่มีรีวิว</p></div>'),
    mount(r) {
      r.querySelectorAll('form.reply').forEach((f) => f.addEventListener('submit', (e) => {
        e.preventDefault(); act(api.reply(shop.id, f.dataset.key, new FormData(f).get('reply')), 'บันทึกคำตอบแล้ว');
      }));
    },
  };
}

// ======================= customers =======================
let custFilter = 'all';
function customersView(me, shop, q) {
  if (q.get('f')) { custFilter = q.get('f'); history.replaceState(null, '', '#/customers'); }
  const all = api.customers(shop.id);
  const DAY = 86400000;
  const F = {
    all: ['ทั้งหมด', () => true],
    near: ['บัตรใกล้ครบ', (c) => c.left > 0 && c.left <= 2],
    ready: ['ครบรอแลก', (c) => c.left <= 0],
    new: ['ลูกค้าใหม่ (14 วัน)', (c) => Date.now() - new Date(c.first) < 14 * DAY],
    lapsed: ['หายไปนาน (21 วัน+)', (c) => Date.now() - new Date(c.last) > 21 * DAY],
    pro: ['Pro ขึ้นไป', (c) => c.lv >= 10],
  };
  const list = all.filter(F[custFilter][1]);
  return {
    html: head('ลูกค้า', `${all.length} คนเคยแตะรับแสตมป์ที่ร้าน · แสดงเฉพาะชื่อเล่น ไม่แสดงเบอร์โทร`) +
      `<div class="seg">${Object.entries(F).map(([k, [l, fn]]) => `<button class="${custFilter === k ? 'on' : ''}" data-act="filter" data-k="${k}">${l} · ${all.filter(fn).length}</button>`).join('')}</div>
      <div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ลูกค้า</th><th>เจน</th><th>ระดับ</th><th class="num">มาแล้ว</th><th>บัตรปัจจุบัน</th><th class="num">แลกแล้ว</th><th>มาครั้งแรก</th><th>ล่าสุด</th></tr></thead><tbody>
      ${list.length ? list.slice(0, 200).map((c) => `<tr><td><div class="row" style="gap:8px"><span class="initials sm" style="border-radius:50%;width:30px;height:30px">${esc(c.nick[0])}</span>${esc(c.nick)}${c.demo ? '' : ' <span class="pill green" style="font-size:10px">จากแอพ</span>'}</div></td>
        <td class="small">${c.gen ? GENS[c.gen].name : '<span class="muted">—</span>'}</td>
        <td><span class="tier-tag" style="--tc:${tierById(c.tier).color}">${c.lv ? `Lv.${c.lv} ` : ''}${tierById(c.tier).name}</span></td>
        <td class="num">${c.visits}</td><td><div class="row" style="gap:8px"><div class="bar" style="width:80px;height:6px"><i style="width:${Math.min(100, (c.have / c.need) * 100)}%"></i></div><span class="small">${c.have}/${c.need}</span></div></td>
        <td class="num">${c.redeemed}</td><td class="small muted">${fmtDT(c.first)}</td><td class="small">${ago(c.last)}</td></tr>`).join('') : '<tr><td colspan="8" class="muted">ไม่มีลูกค้าในกลุ่มนี้</td></tr>'}
      </tbody></table></div></div>`,
    actions: { filter(el) { custFilter = el.dataset.k; rerender(); } },
  };
}

// ======================= settings =======================
function settingsView(me, shop) {
  return {
    html: head('ตั้งค่า') +
      `<div class="panel" style="max-width:640px"><div class="menu-list">
        <div>${icon('user')}บัญชี<span class="chev small">${esc(me.email)}</span></div>
        <button data-act="pause">${icon('lock')}ซ่อนร้านจากแอพลูกค้าชั่วคราว<span class="switch ${shop.paused ? 'on' : ''}" aria-hidden="true"></span></button>
        <button data-act="theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'moon' : 'sun')}โหมดมืด<span class="switch ${document.documentElement.dataset.theme === 'dark' ? 'on' : ''}" aria-hidden="true"></span></button>
        <a href="${customerAppUrl()}" target="_blank" rel="noopener">${icon('share')}เปิดแอพลูกค้า<span class="chev">${icon('chev', 18)}</span></a>
        ${api.isRemote() ? '' : `<button data-act="resetDemo">${icon('refresh')}สร้างข้อมูลตัวอย่าง (Dashboard) ใหม่</button>`}
        <button data-act="logout" style="color:var(--red)">${icon('logout')}ออกจากระบบ</button>
      </div></div>
      <p class="small muted" style="max-width:640px">${api.isRemote() ? 'ข้อมูลซิงก์กับเซิร์ฟเวอร์ (Supabase) — เห็นการแตะจากมือถือลูกค้าทุกเครื่อง' : 'เวอร์ชันเดโม: ข้อมูลร้านและกิจกรรมของลูกค้าเก็บในเบราว์เซอร์นี้ ใช้ร่วมกับแอพลูกค้าบนโดเมนเดียวกัน'}</p>`,
    actions: {
      pause() { act(api.saveShop(shop.id, { paused: !shop.paused }), shop.paused ? 'ร้านกลับมาแสดงในแอพแล้ว' : 'ซ่อนร้านจากแอพลูกค้าแล้ว'); },
      theme() { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('dpoint.theme', JSON.stringify(t)); } catch { /* ignore */ } rerender(); },
      resetDemo() { api.resetDemoData(); toast('สร้างข้อมูลตัวอย่างใหม่แล้ว'); go('/dashboard'); },
      async logout() { await api.logout(); go('/login'); },
    },
  };
}

// ======================= router =======================
const VIEWS = { dashboard: dashboardView, redeem: redeemView, shop: shopView, card: cardView, promos: promosView, stands: standsView, reviews: reviewsView, customers: customersView, settings: settingsView };
let current = null;
function render(keep = false) {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '');
  const me = api.currentMerchant();
  let view; let key = path || 'dashboard';
  if (!me) {
    if (key !== 'signup') key = 'login';
    view = key === 'signup' ? signupView() : loginView();
  } else if (!me.shopId || !api.getShop(me.shopId)) {
    key = 'create-shop';
    view = createShopView(me);
  } else {
    if (!VIEWS[key]) { location.replace('#/dashboard'); return; }
    const shop = api.getShop(me.shopId);
    const v = VIEWS[key](me, shop, q);
    view = { ...v, html: shell(key, me, shop, v.html) };
  }
  const same = keep && current?.key === key;
  if (current && !same) { cardDraft = key === 'card' ? cardDraft : null; }
  const tpl = document.createElement('div'); tpl.innerHTML = view.html;
  if (same) { tpl.querySelector('.m-main')?.classList.add('no-enter'); morphChildren(root, tpl); } else { root.innerHTML = view.html; window.scrollTo(0, 0); }
  current = { key, view };
  runMount(view, root, { rerender });
  document.title = `${(root.querySelector('h1')?.textContent || 'D Point').trim()} · D Point ร้านค้า`;
}
root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'openNav') { document.getElementById('shell').classList.add('nav-open'); return; }
  if (act === 'closeNav') { document.getElementById('shell').classList.remove('nav-open'); return; }
  const fn = current?.view.actions?.[act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
// Show the page straight away from cache, then refresh it with the latest server data.
let navSeq = 0;
window.addEventListener('hashchange', async () => {
  render(false);
  if (!api.isRemote() || !api.currentMerchant()?.shopId) return;
  const seq = ++navSeq;
  try { await api.refresh(); } catch { return; }
  if (seq === navSeq) render(true);
});
window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('pointie.')) render(true); }); // live updates from the customer app tab

try { const t = JSON.parse(localStorage.getItem('dpoint.theme') || '"light"'); document.documentElement.dataset.theme = t; } catch { /* ignore */ }
api.init().then((mode) => {
  document.documentElement.dataset.backend = mode;
  render(false);
}).catch((e) => { console.error(e); render(false); });
// Keep live data fresh (new taps, pending redemptions) while the page is open.
setInterval(async () => {
  if (!api.isRemote() || document.hidden || !api.currentMerchant()?.shopId) return;
  if (!['dashboard', 'redeem', 'customers', 'reviews'].includes(current?.key)) return;
  if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  try { await api.refresh(); render(true); } catch { /* keep showing cached data */ }
}, 30000);
