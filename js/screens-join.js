// New-member onboarding after phone + OTP:
//   /join/name → /join/birthday → /join/likes → /join/tour (2 slides) → /cards (empty card, "scan at your favourite shop")
// Editing the profile later still uses /setup?edit=1 and /prefs/*?edit=1.
import { icon } from './icons.js';
import { esc, go, toast, steps, backBtn, wordmark } from './ui.js';
import { PLACES, STYLES, XP } from './data.js';
import { store, completeSetup, saveIdentity, ageOf, savePrefs, finishPrefs, updateProfile } from './store.js';
import { returnTo, serverErrorText } from './screens-onboard.js';

const TOTAL = 5; // phone, OTP, name, birthday, likes
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const pad2 = (n) => String(n).padStart(2, '0');
const rerender = () => window.dispatchEvent(new Event('rerender'));

// Draft kept across the name/birthday steps (survives a reload within the tab).
const KEY = 'dpoint.join';
function draft() {
  let d = null;
  try { d = JSON.parse(sessionStorage.getItem(KEY)); } catch { /* ignore */ }
  if (!d) {
    const me = store.me; const id = me?.identity || {};
    const b = id.birthDate ? new Date(id.birthDate) : null;
    d = { nick: me?.user.nick || '', first: id.firstName || '', last: id.lastName || '',
      bd: b ? String(b.getDate()) : '', bm: b ? String(b.getMonth() + 1) : '', by: b ? String(b.getFullYear() + 543) : '' };
  }
  return d;
}
const keep = (d) => { try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } };
const clearDraft = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

const head = (step, back) => `<div class="topbar">${back ? backBtn(back) : '<span style="width:40px"></span>'}${steps(TOTAL, step)}<span style="width:40px"></span></div>`;
const hero = (img, title, sub, extra = '') => `<div class="join-hero">
    <div class="join-art">${extra}<img src="${img}" alt=""></div>
    <h1 class="h1">${title}</h1><p class="muted">${sub}</p>
  </div>`;
function markBad(root, names, msg) {
  const err = root.querySelector('.join-err'); err.textContent = msg; err.hidden = false;
  names.forEach((n) => root.querySelector(`[name=${n}]`)?.classList.add('bad'));
  root.querySelector(`[name=${names[0]}]`)?.focus();
}

// ---------- 1. Name ----------
export function joinName() {
  const d = draft();
  return {
    cls: 'join',
    html: `${head(3)}
      ${hero('img/pointie-point.png', 'แนะนำตัวให้เรา<br>รู้จักหน่อย', 'เพื่อนๆ และร้านโปรดจะเห็นชื่อเล่นของคุณ')}
      <form class="col join-form" id="f" novalidate>
        <label class="fld"><span class="between">ชื่อเล่น <small id="cnt">${d.nick.length}/20</small></span><input name="nick" maxlength="20" placeholder="เช่น มายด์" autocomplete="nickname" value="${esc(d.nick)}"></label>
        <div class="row2f">
          <label class="fld"><span>ชื่อจริง</span><input name="first" autocomplete="given-name" maxlength="60" value="${esc(d.first)}"></label>
          <label class="fld"><span>นามสกุล</span><input name="last" autocomplete="family-name" maxlength="60" value="${esc(d.last)}"></label>
        </div>
        <p class="alert join-err" hidden></p>
      </form>
      <div class="col spacer"><button class="btn btn-primary" id="go" form="f">ต่อไป</button></div>`,
    mount(root) {
      const f = root.querySelector('#f');
      f.addEventListener('input', (e) => {
        const dd = draft(); dd[e.target.name] = e.target.value; keep(dd);
        if (e.target.name === 'nick') root.querySelector('#cnt').textContent = `${e.target.value.length}/20`;
        e.target.classList.remove('bad'); root.querySelector('.join-err').hidden = true;
      });
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const dd = draft();
        const missing = ['nick', 'first', 'last'].filter((n) => !String(dd[n] || '').trim());
        if (missing.length) return markBad(root, missing, 'กรอกให้ครบทั้ง 3 ช่องนะ');
        go('/join/birthday');
      });
      if (!d.nick) root.querySelector('[name=nick]').focus();
    },
  };
}

// ---------- 2. Birthday ----------
let busy = false;
export function joinBirthday() {
  const d = draft();
  if (!d.nick || !d.first || !d.last) { go('/join/name'); return { html: '' }; }
  const thisBE = new Date().getFullYear() + 543;
  const years = []; for (let y = thisBE - 13; y >= 2463; y--) years.push(y);
  const sel = (name, ph, opts) => `<select class="sel" name="${name}" aria-label="${ph}"><option value="">${ph}</option>${opts.map(([v, l]) => `<option value="${v}" ${String(d[name]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return {
    cls: 'join',
    html: `${head(4, '/join/name')}
      ${hero('img/pointie-cheer.png', `สวัสดี ${esc(d.nick.trim())}!<br>วันเกิดของคุณคือวันไหน?`, 'ใส่วันเกิด รับสิทธิพิเศษในวันเกิดของคุณ', '<span class="join-gift" aria-hidden="true">🎂</span>')}
      <form class="col join-form" id="f" novalidate>
        <div class="fld"><span>วันเกิด</span>
          <div class="bday">${sel('bd', 'วัน', Array.from({ length: 31 }, (_, i) => [i + 1, i + 1]))}${sel('bm', 'เดือน', TH_MONTHS.map((m, i) => [i + 1, m]))}${sel('by', 'ปี พ.ศ.', years.map((y) => [y, y]))}</div>
        </div>
        <p class="alert join-err" hidden></p>
      </form>
      <div class="col spacer">
        ${store.me.user.setupDone ? '' : `<p class="row small" style="justify-content:center;gap:8px"><span class="pill violet">+${XP.signup} XP</span><span>โบนัสต้อนรับสมาชิกใหม่</span></p>`}
        <button class="btn btn-primary" id="go" form="f">ต่อไป</button>
      </div>`,
    mount(root) {
      const f = root.querySelector('#f');
      f.addEventListener('change', (e) => { const dd = draft(); dd[e.target.name] = e.target.value; keep(dd); e.target.classList.remove('bad'); root.querySelector('.join-err').hidden = true; });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy) return;
        const dd = draft();
        const missing = ['bd', 'bm', 'by'].filter((n) => !dd[n]);
        if (missing.length) return markBad(root, missing, 'เลือกวัน เดือน ปีเกิดให้ครบนะ');
        const y = +dd.by - 543, m = +dd.bm, day = +dd.bd;
        if (new Date(y, m - 1, day).getMonth() !== m - 1) return markBad(root, ['bd'], 'วันเกิดไม่ถูกต้อง ตรวจวันที่อีกครั้ง');
        const birth = `${y}-${pad2(m)}-${pad2(day)}`;
        if (ageOf(birth) < 13) return markBad(root, ['by'], 'D Point ใช้งานได้ตั้งแต่อายุ 13 ปีขึ้นไป');
        busy = true;
        const btn = root.querySelector('#go'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
        const r = await saveIdentity({ firstName: dd.first, lastName: dd.last, birthDate: birth });
        busy = false; btn.disabled = false; btn.textContent = 'ต่อไป';
        if (!r.ok) return markBad(root, ['bd'], r.reason === 'too_young' ? 'D Point ใช้งานได้ตั้งแต่อายุ 13 ปีขึ้นไป' : r.reason === 'server' ? serverErrorText(r.message) : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
        const first = !store.me.user.setupDone;
        completeSetup({ nick: dd.nick, avatar: store.me.user.avatar ?? 0 });
        clearDraft();
        if (first) toast(`ยินดีต้อนรับ ${dd.nick.trim()}! +${XP.signup} XP`);
        go('/join/likes');
      });
    },
  };
}

// ---------- 3. Likes ----------
const LIKE_EMOJI = { cafe: '☕', food: '🍜', street: '🍢', bakery: '🧁', shop: '🛍️', plant: '🪴', book: '📚', workshop: '🎨', sport: '🧗',
  chill: '🛋️', photo: '📸', eat: '😋', deal: '🏷️', active: '⚡', new: '✨' };
export function joinLikes() {
  const me = store.me;
  const on = new Set([...(me.user.prefs.places || []), ...(me.user.prefs.styles || [])]);
  const chip = ([k, label]) => `<button type="button" class="like ${on.has(k) ? 'on' : ''}" data-act="toggle" data-k="${k}" aria-pressed="${on.has(k)}"><span class="e" aria-hidden="true">${LIKE_EMOJI[k] || '•'}</span>${label}</button>`;
  return {
    cls: 'join',
    html: `${head(5, '/join/birthday').replace('<span style="width:40px"></span></div>', '<button class="skip" data-act="skip">ข้าม</button></div>')}
      ${hero('img/pointie-wow.png', 'คุณชอบอะไรบ้าง?', 'เลือกได้หลายอย่าง เราจะแนะนำร้านและโปรที่ตรงใจ')}
      <section class="col" style="gap:10px"><h2 class="like-h">ชอบไปที่แบบไหน</h2><div class="likes">${PLACES.map(chip).join('')}</div></section>
      <section class="col" style="gap:10px"><h2 class="like-h">คุณเป็นสายไหน</h2><div class="likes">${STYLES.map(chip).join('')}</div></section>
      <div class="col spacer">
        <p class="center small muted">${on.size ? `เลือกแล้ว <b style="color:var(--ink)">${on.size}</b> อย่าง · รับ +${XP.prefs} XP` : 'แตะเลือกอย่างน้อย 1 อย่าง'}</p>
        <button class="btn btn-primary" data-act="next" ${on.size ? '' : 'disabled'}>ต่อไป</button>
      </div>`,
    actions: {
      toggle(el) {
        const k = el.dataset.k;
        const key = PLACES.some(([p]) => p === k) ? 'places' : 'styles';
        const cur = new Set(me.user.prefs[key] || []);
        if (cur.has(k)) cur.delete(k); else cur.add(k);
        savePrefs({ [key]: [...cur] });
        rerender();
      },
      next() { finishPrefs(); go('/join/tour'); },
      skip() { updateProfile({ prefsAsked: true }); go('/join/tour'); },
    },
  };
}

// ---------- 4. Tutorial ----------
let slide = 0;
const SLIDES = [
  {
    art: `<div class="tour-art scan-art">
        <div class="tour-stand">${wordmark(22)}<span class="tour-nfc">${icon('nfc', 30, 2.4)}</span><small>แตะ หรือ สแกน</small></div>
        <span class="tour-wave w1"></span><span class="tour-wave w2"></span>
        <img src="img/pointie-point.png" alt="" class="tour-mascot">
      </div>`,
    title: 'สำรวจร้านใหม่ๆ',
    sub: 'สแกนป้ายที่หน้าร้าน มองหาโลโก้ D Point<br>เพื่อสะสมแต้มและปลดล็อกสิทธิพิเศษ',
  },
  {
    art: `<div class="tour-art review-art">
        <div class="tour-review">
          <div class="row" style="gap:8px"><span class="tour-av">ม</span><div class="col" style="gap:0"><b>มายด์</b><span class="xs muted">Lv.7 · Gen Z</span></div></div>
          <div class="tour-stars">★★★★★</div>
          <p>ลาเต้เข้มกำลังดี มุมริมหน้าต่างชิลมาก ต้องมาอีก!</p>
        </div>
        <img src="img/pointie-jump.png" alt="" class="tour-mascot">
      </div>`,
    title: 'รีวิวร้านโปรดของคุณ',
    sub: 'ให้เพื่อนได้เห็นว่าร้านไหนดี<br>ทุกรีวิวได้ XP เลเวลอัปไปพร้อมกัน',
  },
];
export function joinTour() {
  const last = slide === SLIDES.length - 1;
  return {
    cls: 'join tour',
    html: `<div class="topbar"><span style="width:40px"></span><span></span><button class="skip" data-act="start">${last ? '' : 'ข้าม'}</button></div>
      <div class="tour-track" id="track">
        ${SLIDES.map((s, i) => `<section class="tour-slide" aria-hidden="${i !== slide}">${s.art}<h1 class="h1">${s.title}</h1><p class="muted">${s.sub}</p></section>`).join('')}
      </div>
      <div class="tour-dots" role="tablist">${SLIDES.map((_, i) => `<button class="${i === slide ? 'on' : ''}" data-act="goto" data-i="${i}" aria-label="หน้า ${i + 1}"></button>`).join('')}</div>
      <div class="col spacer">
        ${last ? '<button class="btn btn-primary" data-act="start">เริ่มกันเลย</button>' : '<button class="btn btn-primary" data-act="next">ต่อไป</button>'}
      </div>`,
    mount(root) {
      const track = root.querySelector('#track');
      track.scrollTo({ left: slide * track.clientWidth, behavior: 'instant' });
      let t;
      track.addEventListener('scroll', () => {
        clearTimeout(t);
        t = setTimeout(() => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== slide) { slide = i; rerender(); } }, 80);
      });
    },
    actions: {
      next() { const tr = document.getElementById('track'); tr.scrollTo({ left: (slide + 1) * tr.clientWidth, behavior: 'smooth' }); },
      goto(el) { const tr = document.getElementById('track'); tr.scrollTo({ left: +el.dataset.i * tr.clientWidth, behavior: 'smooth' }); },
      start() {
        slide = 0;
        updateProfile({ toured: true });
        // Came in from a shop's NFC/QR link? Finish that first stamp; otherwise the (empty) card wallet.
        const back = returnTo.take();
        go(back && /^\/(tap|store)\//.test(back) ? back : '/cards?welcome=1');
      },
    },
    leave() { slide = 0; },
  };
}
