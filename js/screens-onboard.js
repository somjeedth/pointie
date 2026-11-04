// Onboarding & auth screens: Splash (A1), Phone (A2), OTP (A3), Setup (A4),
// Invite (B1), Places (B2), Style (B3), Location (B4).
import { icon } from './icons.js';
import { esc, go, toast, steps, backBtn, avatarHtml } from './ui.js';
import { AVATARS, PLACES, STYLES, AREAS, XP } from './data.js';
import {
  store, normalizePhone, prettyPhone, isValidPhone, requestOtp, otpInfo, verifyOtp, loginDemo,
  completeSetup, updateProfile, savePrefs, finishPrefs,
} from './store.js';

export const returnTo = {
  get() { try { return sessionStorage.getItem('pointie.returnTo'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem('pointie.returnTo', v); } catch { /* ignore */ } },
  take() { const v = this.get(); try { sessionStorage.removeItem('pointie.returnTo'); } catch { /* ignore */ } return v; },
};

// ---------- A1 Splash ----------
export function welcome() {
  const dots = [[12, 18, 10, '#FFC83D'], [82, 14, 8, '#A592FF'], [88, 40, 12, '#3CC7B2'], [8, 52, 8, '#FF9A5C'], [70, 58, 6, '#F7F7F7']]
    .map(([x, y, s, c]) => `<span class="confetti-dot" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;background:${c}"></span>`).join('');
  return {
    cls: 'splash',
    html: `<div class="glow"></div>${dots}
      <div class="col" style="align-items:center;margin-top:auto;gap:6px;position:relative">
        <img class="mascot" src="img/pointie-cheer.png" alt="Pointie">
        <div class="title">Pointie</div>
        <div class="muted" style="font-size:16px">แตะ · สะสม · เลเวลอัป</div>
      </div>
      <div class="col spacer" style="width:100%;position:relative">
        <a class="btn btn-primary btn-lg" href="#/login">เริ่มต้นด้วยเบอร์มือถือ</a>
        <p class="muted small center">สมัครครั้งแรกหรือเข้าสู่ระบบ ใช้เบอร์เดียวกัน</p>
        <button class="btn btn-text" data-act="demo">ลองใช้บัญชีตัวอย่าง</button>
      </div>`,
    actions: { demo() { loginDemo(); toast('เข้าสู่ระบบด้วยบัญชีตัวอย่าง "มายด์"'); go(returnTo.take() || '/home'); } },
  };
}

// ---------- A2 Phone ----------
let phoneDraft = '';
export function login() {
  const d = normalizePhone(phoneDraft);
  return {
    html: `<div class="topbar">${backBtn('/welcome')}${steps(3, 1)}<span style="width:40px"></span></div>
      <div class="row" style="align-items:flex-start;margin-top:8px">
        <div class="col" style="gap:8px;flex:1">
          <h1 class="h1">เบอร์มือถือ<br>ของคุณ</h1>
          <p class="muted">เราจะส่งรหัส 6 หลักทาง SMS<br>ใช้ทั้งสมัครใหม่และเข้าสู่ระบบ</p>
        </div>
        <img src="img/pointie-point.png" alt="" style="width:110px;flex:none;margin-top:-6px">
      </div>
      <form class="col" id="phoneForm" style="gap:8px" novalidate>
        <label class="field-label" for="phone">เบอร์มือถือ</label>
        <div class="phone-field ${d ? 'on' : ''}" id="pf">
          <span class="cc">TH +66</span>
          <input id="phone" inputmode="numeric" autocomplete="tel" placeholder="08X XXX XXXX" value="${esc(prettyPhone(d))}" maxlength="12">
        </div>
        <p class="alert" id="perr" hidden style="justify-content:flex-start">${icon('alert', 16)}กรอกเบอร์มือถือ 10 หลักให้ถูกต้อง</p>
      </form>
      <div class="col spacer">
        <button class="btn btn-primary" id="sendOtp" form="phoneForm" ${isValidPhone(d) ? '' : 'disabled'}>ขอรหัส OTP</button>
        <p class="muted xs center">การดำเนินการต่อถือว่าคุณยอมรับ <a class="link-u" href="#/legal">ข้อกำหนดการใช้งาน</a> และ <a class="link-u" href="#/legal">นโยบายความเป็นส่วนตัว</a></p>
      </div>`,
    mount(root) {
      const input = root.querySelector('#phone'), btn = root.querySelector('#sendOtp'), pf = root.querySelector('#pf');
      input.addEventListener('input', () => {
        const v = normalizePhone(input.value);
        phoneDraft = v;
        input.value = prettyPhone(v);
        pf.classList.toggle('on', !!v);
        btn.disabled = !isValidPhone(v);
        root.querySelector('#perr').hidden = true;
      });
      root.querySelector('#phoneForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = normalizePhone(input.value);
        if (!isValidPhone(v)) { root.querySelector('#perr').hidden = false; return; }
        requestOtp(v);
        go('/otp');
      });
      if (!d) input.focus();
    },
  };
}

// ---------- A3 OTP ----------
let otpState = { code: '', status: 'normal', tries: 3 };
let otpTimer;
export function otp() {
  const info = otpInfo();
  if (!info) { go('/login'); return { html: '' }; }
  const st = otpState;
  const expired = st.status === 'expired' || Date.now() > info.expiresAt;
  const boxes = Array.from({ length: 6 }, (_, i) => {
    const dch = st.code[i] || '';
    let cls = 'box';
    if (dch && st.status === 'wrong') cls += ' err';
    else if (dch) cls += ' fill';
    else if (i === st.code.length && !expired) cls += ' cur';
    return `<div class="${cls}">${esc(dch)}</div>`;
  }).join('');
  return {
    html: `<div class="topbar">${backBtn('/login')}${steps(3, 2)}<span style="width:40px"></span></div>
      <div class="card-soft row" style="gap:10px;padding:10px 14px">
        ${icon('phone', 18)}<span class="small">SMS (จำลอง): รหัส Pointie ของคุณคือ <b style="letter-spacing:.12em">${info.code}</b></span>
      </div>
      <div class="col" style="align-items:center;text-align:center;gap:8px">
        <img src="img/pointie-wink.png" alt="" style="height:120px">
        <h1 class="h1" style="font-size:24px">กรอกรหัส 6 หลัก</h1>
        <p class="muted">ส่งไปที่ <b style="color:var(--ink)">${prettyPhone(info.phone)}</b> แล้ว<br><a class="link-u" href="#/login">เปลี่ยนเบอร์</a></p>
      </div>
      <label class="sr-only" for="otp">รหัส OTP 6 หลัก</label>
      <div class="otp ${expired ? 'expired' : ''}">
        ${boxes}
        <input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${esc(st.code)}" ${expired ? 'disabled' : ''} aria-describedby="otpMsg">
      </div>
      <div id="otpMsg">
      ${st.status === 'wrong' ? `<p class="alert" role="alert">${icon('alert', 16)}รหัสไม่ถูกต้อง ลองได้อีก ${st.tries} ครั้ง</p>` : ''}
      ${expired ? `<div class="alert-box" role="alert"><b style="color:var(--red)">รหัสหมดอายุแล้ว</b><span class="small muted">กดส่งรหัสใหม่ แล้วกรอกภายใน 5 นาที</span></div>` : ''}
      ${!expired ? `<p class="center small muted row" style="justify-content:center;gap:6px">${icon('clock', 16)}<span id="resend"></span></p>` : ''}
      </div>
      <div class="col spacer">
        ${expired
          ? '<button class="btn btn-primary" data-act="resend">ส่งรหัสใหม่</button>'
          : `<button class="btn btn-primary" id="verify" data-act="verify" ${st.code.length === 6 ? '' : 'disabled'}>ยืนยัน</button>
             <p class="muted xs center">รหัสจะหมดอายุใน 5 นาที</p>`}
      </div>`,
    mount(root, ctx) {
      const input = root.querySelector('#otp');
      if (input && !expired) {
        input.focus();
        input.addEventListener('input', () => {
          otpState = { ...otpState, code: input.value.replace(/\D/g, '').slice(0, 6), status: 'normal' };
          ctx.rerender();
          if (otpState.code.length === 6) setTimeout(() => this.actions.verify(), 120);
        });
      }
      const resendEl = root.querySelector('#resend');
      clearInterval(otpTimer);
      const tick = () => {
        const i = otpInfo(); if (!i) return clearInterval(otpTimer);
        if (Date.now() > i.expiresAt && otpState.status !== 'expired') { otpState.status = 'expired'; ctx.rerender(); return; }
        const left = Math.max(0, 60 - Math.floor((Date.now() - i.sentAt) / 1000));
        if (resendEl) resendEl.innerHTML = left > 0 ? `ส่งรหัสใหม่ได้ใน <b style="color:var(--ink)">0:${String(left).padStart(2, '0')}</b>` : '<button class="link" data-act="resend">ส่งรหัสใหม่</button>';
      };
      tick(); otpTimer = setInterval(tick, 1000);
      return () => clearInterval(otpTimer);
    },
    actions: {
      verify() {
        if (otpState.code.length !== 6) return;
        const r = verifyOtp(otpState.code);
        if (r.ok) {
          otpState = { code: '', status: 'normal', tries: 3 };
          if (r.isNew || !store.me.user.setupDone) go('/setup');
          else { toast(`ยินดีต้อนรับกลับ ${store.me.user.nick}!`); go(returnTo.take() || '/home'); }
        } else if (r.reason === 'wrong') {
          otpState = { ...otpState, status: 'wrong', tries: r.tries };
          window.dispatchEvent(new Event('rerender'));
        } else {
          otpState = { ...otpState, status: 'expired' };
          window.dispatchEvent(new Event('rerender'));
        }
      },
      resend() {
        const i = otpInfo();
        requestOtp(i ? i.phone : normalizePhone(phoneDraft));
        otpState = { code: '', status: 'normal', tries: 3 };
        toast('ส่งรหัสใหม่แล้ว');
        window.dispatchEvent(new Event('rerender'));
      },
    },
  };
}
export const resetOtpScreen = () => { otpState = { code: '', status: 'normal', tries: 3 }; };

// ---------- A4 Setup / edit profile ----------
let setupDraft = null;
export function setup(params, query) {
  const me = store.me;
  const edit = query.get('edit') === '1';
  if (!setupDraft) setupDraft = { nick: me.user.nick || '', avatar: me.user.avatar ?? 0, photo: me.user.photo || null };
  const d = setupDraft;
  const ok = d.nick.trim().length > 0;
  const pickedSrc = d.photo || (d.avatar != null ? AVATARS[d.avatar].src : AVATARS[0].src);
  return {
    html: `<div class="topbar">${edit ? backBtn('/profile') : '<span style="width:40px"></span>'}${edit ? '<h1 style="text-align:center">แก้ไขโปรไฟล์</h1>' : steps(3, 3)}<span style="width:40px"></span></div>
      ${edit ? '' : `<div class="col" style="gap:6px"><h1 class="h1" style="font-size:24px">ให้เรารู้จักคุณหน่อย</h1><p class="muted">ชื่อเล่นและรูปนี้จะอยู่บนนามบัตรและรีวิวของคุณ</p></div>`}
      <div class="avatar-big">
        <img src="${pickedSrc}" alt="รูปโปรไฟล์ที่เลือก" style="${d.photo ? 'object-fit:cover' : ''}">
        <label class="cam" aria-label="อัปโหลดรูปจากเครื่อง">${icon('camera', 18)}<input type="file" accept="image/*" id="upload" class="sr-only"></label>
      </div>
      <p class="muted small center">อัปโหลดรูปตัวเอง หรือเลือก Pointie ด้านล่าง</p>
      <div class="avatar-pick">
        ${AVATARS.map((a, i) => `<button class="${!d.photo && d.avatar === i ? 'on' : ''}" data-act="pick" data-i="${i}" aria-label="${a.label}"><img src="${a.src}" alt=""></button>`).join('')}
      </div>
      <div class="col" style="gap:8px">
        <div class="between"><label class="field-label" for="nick">ชื่อเล่น</label><span class="muted small" id="cnt">${d.nick.length}/20</span></div>
        <div class="phone-field ${ok ? 'on' : ''}" id="nf" style="height:56px"><input id="nick" maxlength="20" placeholder="เช่น มายด์" value="${esc(d.nick)}" style="font-size:17px"></div>
        <p class="muted xs">เปลี่ยนได้ภายหลังในหน้าโปรไฟล์</p>
      </div>
      <div class="col spacer">
        ${edit || me.user.setupDone ? '' : `<p class="row small" style="justify-content:center;gap:8px"><span class="pill violet">+${XP.signup} XP</span><span>โบนัสต้อนรับสมาชิกใหม่</span></p>`}
        <button class="btn btn-primary" id="go" data-act="save" ${ok ? '' : 'disabled'}>${edit ? 'บันทึก' : 'ไปรับแสตมป์แรกกันเลย'}</button>
      </div>`,
    mount(root) {
      const nick = root.querySelector('#nick');
      nick.addEventListener('input', () => {
        setupDraft.nick = nick.value;
        const v = nick.value.trim().length > 0;
        root.querySelector('#cnt').textContent = `${nick.value.length}/20`;
        root.querySelector('#nf').classList.toggle('on', v);
        root.querySelector('#go').disabled = !v;
      });
      root.querySelector('#upload').addEventListener('change', (e) => {
        const f = e.target.files[0]; if (!f) return;
        const img = new Image();
        const url = URL.createObjectURL(f);
        img.onload = () => {
          const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
          const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
          c.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
          setupDraft.photo = c.toDataURL('image/jpeg', 0.85);
          URL.revokeObjectURL(url);
          window.dispatchEvent(new Event('rerender'));
        };
        img.onerror = () => toast('เปิดรูปนี้ไม่ได้ ลองรูปอื่นนะ');
        img.src = url;
      });
    },
    actions: {
      pick(el) { setupDraft.avatar = +el.dataset.i; setupDraft.photo = null; window.dispatchEvent(new Event('rerender')); },
      save() {
        const { nick, avatar, photo } = setupDraft;
        if (!nick.trim()) return;
        if (edit) { updateProfile({ nick: nick.trim().slice(0, 20), avatar, photo }); setupDraft = null; toast('บันทึกโปรไฟล์แล้ว'); go('/profile'); return; }
        completeSetup({ nick, avatar });
        updateProfile({ photo });
        setupDraft = null;
        toast(`ยินดีต้อนรับ ${nick.trim()}! +${XP.signup} XP`);
        go(returnTo.take() || '/scan');
      },
    },
    leave() { setupDraft = null; },
  };
}

// ---------- B1 Invite ----------
export function invite() {
  const me = store.me;
  return {
    cls: 'flush',
    html: `<div style="position:absolute;inset:0;padding:16px 20px;opacity:.35;filter:blur(1px)">
        <div class="brand"><img src="img/app-icon.png" alt="">Pointie</div>
        <div class="col" style="align-items:center;margin-top:40px">
          <img src="img/pointie-jump.png" alt="" style="height:150px">
          <div class="h1" style="font-size:30px">ได้แสตมป์แรกแล้ว!</div>
        </div>
      </div>
      <div class="sheet-backdrop" style="background:rgba(0,0,0,.55)">
        <div class="sheet" role="dialog" aria-labelledby="inviteTitle" style="align-items:center;text-align:center;overflow:visible">
          <img src="img/pointie-cheer.png" alt="Pointie ดีใจ" style="height:130px;margin-top:-80px">
          <span class="pill soft">ภารกิจแรกของคุณ</span>
          <h2 id="inviteTitle" class="h1" style="font-size:24px">บอก Pointie หน่อย<br>ว่าชอบอะไร</h2>
          <p class="muted small">จะได้แนะนำร้าน โปร และภารกิจที่ตรงใจ${esc(me?.user.nick ? 'คุณ' + me.user.nick : 'คุณ')}<br>ใช้เวลาไม่ถึง 30 วินาที</p>
          <div class="invite-stats" style="width:100%">
            <div><b>3 ข้อ</b>แตะเลือก ไม่ต้องพิมพ์</div>
            <div class="v"><b>+${XP.prefs} XP</b>เมื่อทำเสร็จ</div>
            <div><b>Badge</b>นักสำรวจหน้าใหม่</div>
          </div>
          <a class="btn btn-primary" href="#/prefs/places">เริ่มเลย</a>
          <button class="btn btn-text" data-act="later">ไว้ทีหลัง</button>
        </div>
      </div>`,
    actions: { later() { updateProfile({ prefsAsked: true }); go('/home'); } },
  };
}

// ---------- B2/B3 preference pickers ----------
function prefScreen({ step, title, sub, img, list, key, max, next, prev, cols, edit, tagsNote }) {
  const me = store.me;
  const on = new Set(me.user.prefs[key]);
  const n = on.size;
  const items = list.map(([k, label, s]) => {
    const a = on.has(k);
    const dim = !a && max && n >= max;
    const chk = `<span class="chk">${a ? icon('check', 14, 3) : ''}</span>`;
    return `<button class="pref ${a ? 'on' : ''} ${dim ? 'dim' : ''}" data-act="toggle" data-k="${k}" aria-pressed="${a}">
      ${cols === 2 ? `<span class="between" style="width:100%"><b>${label}</b>${chk}</span>` : `${chk}<b>${label}</b>`}<small>${s}</small></button>`;
  }).join('');
  const tags = tagsNote ? list.filter(([k]) => on.has(k)).map(([, l]) => `<span class="pill soft">#${l}</span>`).join(' ') : '';
  return {
    html: `<div class="topbar">${backBtn(edit ? '/settings' : prev)}${steps(3, step)}<a class="skip" href="#${edit ? '/settings' : next}">${edit ? '' : 'ข้าม'}</a></div>
      <div class="row" style="align-items:flex-start">
        <div class="col" style="gap:4px;flex:1"><h1 class="h1" style="font-size:24px">${title}</h1><p class="muted">${sub}</p></div>
        <img src="${img}" alt="" style="height:80px;flex:none">
      </div>
      <div class="pref-grid ${cols === 2 ? 'two' : ''}">${items}</div>
      ${tagsNote ? `<div class="card col" style="gap:8px"><span class="muted xs">จะโชว์บนนามบัตรของคุณ</span><div class="row" style="flex-wrap:wrap;gap:6px">${tags || '<span class="muted small">ยังไม่ได้เลือก</span>'}</div></div>` : ''}
      <div class="col spacer">
        ${!tagsNote ? `<p class="center small muted">เลือกแล้ว <b style="color:var(--ink)">${n}</b> อย่าง</p>` : ''}
        <a class="btn btn-primary ${n ? '' : 'disabled'}" href="#${edit ? next + '?edit=1' : next}">ต่อไป</a>
      </div>`,
    actions: {
      toggle(el) {
        const k = el.dataset.k;
        if (on.has(k)) on.delete(k); else if (!max || on.size < max) on.add(k); else return toast(`เลือกได้สูงสุด ${max} แบบ`);
        savePrefs({ [key]: [...on] });
        window.dispatchEvent(new Event('rerender'));
      },
    },
  };
}
export const prefPlaces = (p, q) => prefScreen({
  step: 1, title: 'ชอบไปที่แบบไหน?', sub: 'เลือกได้หลายอย่าง', img: 'img/pointie-wow.png', list: PLACES, key: 'places',
  next: '/prefs/style', prev: '/invite', cols: 3, edit: q.get('edit') === '1',
});
export const prefStyle = (p, q) => prefScreen({
  step: 2, title: 'คุณเป็นสายไหน?', sub: 'เลือกได้สูงสุด 3 แบบ', img: 'img/pointie-point.png', list: STYLES, key: 'styles', max: 3,
  next: '/prefs/location', prev: '/prefs/places', cols: 2, edit: q.get('edit') === '1', tagsNote: true,
});

// ---------- B4 Location ----------
let locView = 'ask';
export function prefLocation(p, q) {
  const me = store.me;
  const edit = q.get('edit') === '1';
  const done = () => {
    const first = !me.user.prefsDone;
    finishPrefs();
    if (first) toast(`ทำภารกิจแรกสำเร็จ! +${XP.prefs} XP · ได้ Badge นักสำรวจหน้าใหม่`);
    else toast('บันทึกความชอบแล้ว');
    locView = 'ask';
    go(edit ? '/settings' : '/home');
  };
  const on = new Set(me.user.prefs.areas);
  const top = `<div class="topbar">${backBtn(edit ? '/prefs/style?edit=1' : '/prefs/style')}${steps(3, 3)}<button class="skip" data-act="skip">${edit ? '' : 'ข้าม'}</button></div>`;
  if (locView === 'manual') {
    return {
      html: `${top}
        <div class="row" style="align-items:flex-start"><div class="col" style="gap:4px;flex:1"><h1 class="h1" style="font-size:24px">ไปย่านไหนบ่อย?</h1><p class="muted">เลือกได้หลายย่าน</p></div><img src="img/pointie-point.png" alt="" style="height:80px"></div>
        <label class="input-wrap">${icon('search')}<span class="sr-only">ค้นหาย่าน</span><input id="areaQ" placeholder="ค้นหาย่าน หรือจังหวัด"></label>
        <div class="area-chips" id="areas">${AREAS.map(([k, l]) => `<button class="${on.has(k) ? 'on' : ''}" data-act="area" data-k="${k}" aria-pressed="${on.has(k)}">${l}</button>`).join('')}</div>
        <div class="col spacer">
          <button class="btn btn-primary" data-act="done">${me.user.prefsDone ? 'บันทึก' : `เสร็จแล้ว รับ +${XP.prefs} XP`}</button>
          <button class="btn btn-text" data-act="toAsk">ใช้ตำแหน่งแทน</button>
        </div>`,
      mount(root) {
        root.querySelector('#areaQ').addEventListener('input', (e) => {
          const qv = e.target.value.trim();
          root.querySelectorAll('#areas button').forEach((b) => { b.hidden = qv && !b.textContent.includes(qv); });
        });
      },
      actions: {
        area(el) { const k = el.dataset.k; on.has(k) ? on.delete(k) : on.add(k); savePrefs({ areas: [...on] }); el.classList.toggle('on', on.has(k)); el.setAttribute('aria-pressed', on.has(k)); },
        done, toAsk() { locView = 'ask'; window.dispatchEvent(new Event('rerender')); },
        skip() { locView = 'ask'; updateProfile({ prefsAsked: true }); go(edit ? '/settings' : '/home'); },
      },
    };
  }
  return {
    html: `${top}
      <div class="loc-hero"><img src="img/pointie-point.png" alt=""></div>
      <div class="col center" style="gap:6px"><h1 class="h1" style="font-size:24px">ให้ Pointie หาร้านใกล้คุณ</h1><p class="muted">อนุญาตตำแหน่งเพื่อให้แนะนำได้แม่นขึ้น</p></div>
      <div class="col" style="gap:12px">
        <div class="feat-li"><span class="ic">${icon('pin', 18)}</span>ร้านที่ชอบ ใกล้ตัวคุณตอนนี้</div>
        <div class="feat-li"><span class="ic">${icon('tag', 18)}</span>โปรและกิจกรรมในย่านที่คุณไปบ่อย</div>
        <div class="feat-li"><span class="ic">${icon('compass', 18)}</span>ภารกิจสำรวจย่านใหม่ๆ</div>
      </div>
      <div class="col spacer">
        <p class="muted xs row" style="gap:6px;justify-content:center">${icon('lock', 14)}ใช้ตำแหน่งเฉพาะตอนเปิดแอพ ร้านค้าไม่เห็นตำแหน่งของคุณ</p>
        <button class="btn btn-primary" data-act="allow">อนุญาตตำแหน่ง</button>
        <button class="btn btn-text" data-act="toManual">ไม่เป็นไร ขอเลือกย่านเอง</button>
      </div>`,
    actions: {
      allow(el) {
        if (!('geolocation' in navigator)) { toast('อุปกรณ์นี้ไม่รองรับตำแหน่ง เลือกย่านเองแทนนะ'); locView = 'manual'; return window.dispatchEvent(new Event('rerender')); }
        el.disabled = true; el.textContent = 'กำลังขอตำแหน่ง…';
        navigator.geolocation.getCurrentPosition(
          () => { updateProfile({ locationOk: true }); done(); },
          () => { toast('ไม่ได้รับอนุญาตตำแหน่ง เลือกย่านเองแทนนะ'); locView = 'manual'; window.dispatchEvent(new Event('rerender')); },
          { timeout: 8000, maximumAge: 600000 },
        );
      },
      toManual() { locView = 'manual'; window.dispatchEvent(new Event('rerender')); },
      skip() { updateProfile({ prefsAsked: true }); go(edit ? '/settings' : '/home'); },
    },
  };
}
