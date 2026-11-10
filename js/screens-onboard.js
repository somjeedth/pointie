// Onboarding & auth screens: Splash (A1), Phone (A2), OTP (A3), Setup (A4),
// Invite (B1), Places (B2), Style (B3), Location (B4).
import { icon } from './icons.js';
import { esc, go, toast, steps, backBtn, avatarHtml, wordmark } from './ui.js';
import { AVATARS, PLACES, STYLES, AREAS, XP, refreshDistances } from './data.js';
import { setOrigin } from './geo.js';
import { t, getLang, setLang } from './i18n.js';
import {
  store, normalizePhone, prettyPhone, isValidPhone, requestOtp, otpInfo, verifyOtp, loginDemo,
  completeSetup, updateProfile, startOAuth, oauthAvailable, isLinking, savePrefs, finishPrefs, saveIdentity, ageOf,
} from './store.js';

export const returnTo = {
  get() { try { return sessionStorage.getItem('pointie.returnTo'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem('pointie.returnTo', v); } catch { /* ignore */ } },
  take() { const v = this.get(); try { sessionStorage.removeItem('pointie.returnTo'); } catch { /* ignore */ } return v; },
};

// Official-style marks for the sign-in buttons (Google "G", Apple logo).
const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const APPLE_LOGO = '<svg width="18" height="20" viewBox="0 0 814 1000" aria-hidden="true"><path fill="currentColor" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>';

// Small "TH 🌐" language toggle (top right of the sign-in screens).
const langBtn = () => `<button class="lang-btn" data-act="lang" aria-label="${t('เปลี่ยนภาษา (ตอนนี้: ไทย)', 'Change language (now: English)')}">${getLang() === 'en' ? 'EN' : 'TH'}${icon('globe', 22, 1.8)}</button>`;
function toggleLang() { setLang(getLang() === 'en' ? 'th' : 'en'); window.dispatchEvent(new Event('rerender')); }

// "or" + Google / Apple, shared by the welcome screen and the phone page.
const socialHtml = () => `<div class="or-line" role="separator"><span>${t('หรือ', 'or')}</span></div>
      <div class="col" style="gap:10px">
        <button class="btn btn-lg btn-google" data-act="oauth" data-p="google">${GOOGLE_G}${t('ดำเนินการต่อด้วย Google', 'Continue with Google')}</button>
        <button class="btn btn-lg btn-apple" data-act="oauth" data-p="apple">${APPLE_LOGO}${t('ดำเนินการต่อด้วย Apple', 'Continue with Apple')}</button>
      </div>`;
async function oauthAction(el) {
        const p = el.dataset.p; const label = el.innerHTML; const name = p === 'apple' ? 'Apple' : 'Google';
        el.disabled = true; el.textContent = t(`กำลังไปหน้า ${name}…`, `Opening ${name}…`);
        const r = await startOAuth(p);
        if (!r.ok) { el.disabled = false; el.innerHTML = label; toast(t(`เข้าสู่ระบบด้วย ${name} ไม่ได้: `, `Could not sign in with ${name}: `) + r.message, 9000); }
}

// ---------- A1 Splash ----------
export function welcome() {
  const d = normalizePhone(phoneDraft);
  const social = oauthAvailable();
  return {
    cls: 'welcome',
    html: `<div class="welcome-lang">${langBtn()}</div>
      <div class="welcome-top">
        <img class="mascot" src="img/pointie-cheer.png" alt="">
        ${wordmark(34)}
      </div>
      ${window.__oauthError ? `<div class="oauth-err" role="alert"><b>${t('เข้าสู่ระบบไม่สำเร็จ', 'Sign-in failed')}</b><span>${esc(window.__oauthError)}</span></div>` : ''}
      <h1 class="welcome-title">${t('เริ่มต้นใช้งาน D Point เพื่อเก็บสิทธิพิเศษ', 'Get started with D Point to collect perks')}</h1>
      ${phoneFormHtml(d)}
      <button class="btn btn-primary btn-lg" id="sendOtp" form="phoneForm" ${isValidPhone(d) ? '' : 'disabled'}>${t('ขอรหัส OTP', 'Get OTP code')}</button>
      ${social ? socialHtml() : ''}
      <div class="col spacer" style="gap:6px">
        <p class="muted xs center">${t('การดำเนินการต่อถือว่าคุณยอมรับ', 'By continuing you agree to the')} <a class="link-u" href="#/terms">${t('ข้อกำหนดการใช้งาน', 'Terms of use')}</a> ${t('และ', 'and')} <a class="link-u" href="#/privacy">${t('นโยบายความเป็นส่วนตัว', 'Privacy policy')}</a></p>
        <button class="btn btn-text" data-act="demo">${t('ลองใช้บัญชีตัวอย่าง', 'Try the demo account')}</button>
      </div>`,
    mount(root) { mountPhoneForm(root); },
    actions: {
      lang: toggleLang,
      oauth: oauthAction,
      async demo(el) {
        el.disabled = true; el.textContent = t('กำลังเตรียมบัญชีตัวอย่าง…', 'Preparing the demo account…');
        try { await loginDemo(); } catch (e) {
          console.warn('[pointie] demo sign-in failed', e);
          el.disabled = false; el.textContent = t('ลองใช้บัญชีตัวอย่าง', 'Try the demo account');
          toast(serverErrorText(e.message), 9000); return;
        }
        toast('เข้าสู่ระบบด้วยบัญชีตัวอย่าง "มายด์"'); go(returnTo.take() || '/home');
      },
    },
  };
}

// Phone number form shared by the welcome screen and /login (verify number from Profile).
function phoneFormHtml(d) {
  return `      <form class="col" id="phoneForm" style="gap:8px" novalidate>
        <label class="field-label" for="phone">${t('เบอร์มือถือ', 'Mobile number')}</label>
        <div class="phone-field ${d ? 'on' : ''}" id="pf">
          <span class="cc">TH +66</span>
          <input id="phone" inputmode="numeric" autocomplete="tel" placeholder="08X XXX XXXX" value="${esc(prettyPhone(d))}" maxlength="12">
        </div>
        <p class="alert" id="perr" hidden style="justify-content:flex-start">${icon('alert', 16)}${t('กรอกเบอร์มือถือ 10 หลักให้ถูกต้อง', 'Enter a valid 10-digit mobile number')}</p>
      </form>`;
}
function mountPhoneForm(root) {
      const input = root.querySelector('#phone'), btn = root.querySelector('#sendOtp'), pf = root.querySelector('#pf');
      input.addEventListener('input', () => {
        const v = normalizePhone(input.value);
        phoneDraft = v;
        input.value = prettyPhone(v);
        pf.classList.toggle('on', !!v);
        btn.disabled = !isValidPhone(v);
        root.querySelector('#perr').hidden = true;
      });
      root.querySelector('#phoneForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = normalizePhone(input.value);
        if (!isValidPhone(v)) { root.querySelector('#perr').hidden = false; return; }
        if (btn.dataset.busy) return;
        btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = t('กำลังส่งรหัส…', 'Sending code…');
        const r = await requestOtp(v);
        delete btn.dataset.busy; btn.disabled = false; btn.textContent = t('ขอรหัส OTP', 'Get OTP code');
        if (!r.ok) { toast(smsErrorText(r.message) + (smsTestMode() ? ` (${r.message})` : ''), 12000); console.warn('[pointie] OTP request failed:', r.message); return; }
        resetOtpScreen();
        go('/otp');
      });
  return input;
}

// ---------- A2 Phone ----------
let phoneDraft = '';
export function login() {
  const d = normalizePhone(phoneDraft);
  return {
    html: `<div class="topbar">${backBtn('/welcome')}${steps(5, 1)}${langBtn()}</div>
      <div class="row" style="align-items:flex-start;margin-top:8px">
        <div class="col" style="gap:8px;flex:1">
          <h1 class="h1">${t('เบอร์มือถือ<br>ของคุณ', 'Your mobile<br>number')}</h1>
          <p class="muted">${t('เราจะส่งรหัส 6 หลักทาง SMS<br>ใช้ทั้งสมัครใหม่และเข้าสู่ระบบ', 'We will text you a 6-digit code<br>to sign up or sign in')}</p>
        </div>
        <img src="img/pointie-point.png" alt="" style="width:110px;flex:none;margin-top:-6px">
      </div>
      ${phoneFormHtml(d)}
      <button class="btn btn-primary btn-lg" id="sendOtp" form="phoneForm" ${isValidPhone(d) ? '' : 'disabled'}>${t('ขอรหัส OTP', 'Get OTP code')}</button>
      ${oauthAvailable() && !isLinking() ? socialHtml() : ''}
      <div class="col spacer">
        <p class="muted xs center">${t('การดำเนินการต่อถือว่าคุณยอมรับ', 'By continuing you agree to the')} <a class="link-u" href="#/terms">${t('ข้อกำหนดการใช้งาน', 'Terms of use')}</a> ${t('และ', 'and')} <a class="link-u" href="#/privacy">${t('นโยบายความเป็นส่วนตัว', 'Privacy policy')}</a></p>
      </div>`,
    mount(root) {
      const input = mountPhoneForm(root);
      if (!d) input.focus();
    },
    actions: { oauth: oauthAction, lang: toggleLang },
  };
}

// ---------- A3 OTP ----------
let otpState = { code: '', status: 'normal', tries: 3 };
let otpTimer;
let verifying = false;
let resending = false;
// Explain the real reason a sign-in failed (raw message kept so it can be reported).
export function serverErrorText(msg = '') {
  if (/anonymous/i.test(msg)) return 'Supabase ยังไม่เปิด "Allow anonymous sign-ins" (Authentication → Sign In / Providers)';
  if (/captcha/i.test(msg)) return 'Supabase เปิด CAPTCHA ไว้ แอพยังไม่รองรับ ให้ปิดที่ Authentication → Attack Protection';
  if (/rate limit|too many/i.test(msg)) return 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่';
  if (/function .* does not exist|could not find the function/i.test(msg)) return 'ฐานข้อมูลยังไม่มีฟังก์ชันของ D Point ให้รัน schema.sql ใหม่';
  if (/timeout|failed to fetch|network/i.test(msg)) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่';
  return `เข้าสู่ระบบไม่สำเร็จ: ${msg || 'ไม่ทราบสาเหตุ'}`;
}
// Why sending the SMS failed.
// ?sms=1 testing: also show the raw error so problems can be read off the screen.
const smsTestMode = () => { try { return sessionStorage.getItem('dpoint.sms') === '1'; } catch { return false; } };
export function smsErrorText(msg = '') {
  if (/provider|phone.*(disabled|not enabled)|unsupported/i.test(msg)) return 'Supabase ยังไม่เปิดเข้าสู่ระบบด้วยเบอร์โทร (Authentication → Sign In / Providers → Phone)';
  if (/hook/i.test(msg)) return 'ส่ง SMS ไม่สำเร็จ (Send SMS hook) ลองใหม่อีกครั้ง';
  if (/rate limit|too many|seconds/i.test(msg)) return 'ขอรหัสบ่อยเกินไป รอสักครู่แล้วลองใหม่';
  if (/invalid.*phone|phone.*invalid/i.test(msg)) return 'เบอร์มือถือไม่ถูกต้อง';
  if (/timeout|failed to fetch|network/i.test(msg)) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่';
  return `ส่งรหัสไม่สำเร็จ: ${msg || 'ไม่ทราบสาเหตุ'}`;
}
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
    html: `<div class="topbar">${backBtn(isLinking() ? '/login' : '/welcome')}${steps(5, 2)}${langBtn()}</div>
      ${info.real ? '' : `<div class="card-soft row" style="gap:10px;padding:10px 14px">
        ${icon('phone', 18)}<span class="small">${t('SMS (จำลอง): รหัส D Point ของคุณคือ', 'SMS (demo): your D Point code is')} <b style="letter-spacing:.12em">${info.code}</b></span>
      </div>`}
      <div class="col" style="align-items:center;text-align:center;gap:8px">
        <img src="img/pointie-wink.png" alt="" style="height:120px">
        <h1 class="h1" style="font-size:24px">${t('กรอกรหัส 6 หลัก', 'Enter the 6-digit code')}</h1>
        <p class="muted">${t('ส่งไปที่', 'Sent to')} <b style="color:var(--ink)">${prettyPhone(info.phone)}</b> ${t('แล้ว', '')}<br><a class="link-u" href="#/${isLinking() ? 'login' : 'welcome'}">${t('เปลี่ยนเบอร์', 'Change number')}</a></p>
      </div>
      <label class="sr-only" for="otp">${t('รหัส OTP 6 หลัก', '6-digit OTP code')}</label>
      <div class="otp ${expired ? 'expired' : ''}">
        ${boxes}
        <input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${esc(st.code)}" ${expired ? 'disabled' : ''} aria-describedby="otpMsg">
      </div>
      <div id="otpMsg">
      ${st.status === 'wrong' ? `<p class="alert" role="alert">${icon('alert', 16)}${t(`รหัสไม่ถูกต้อง ลองได้อีก ${st.tries} ครั้ง`, `Wrong code, ${st.tries} tries left`)}</p>` : ''}
      ${expired ? `<div class="alert-box" role="alert"><b style="color:var(--red)">${t('รหัสหมดอายุแล้ว', 'This code has expired')}</b><span class="small muted">${t('กดส่งรหัสใหม่ แล้วกรอกภายใน 5 นาที', 'Tap send a new code, then enter it within 5 minutes')}</span></div>` : ''}
      ${!expired ? `<p class="center small muted row" style="justify-content:center;gap:6px">${icon('clock', 16)}<span id="resend"></span></p>` : ''}
      </div>
      <div class="col spacer">
        ${expired
          ? `<button class="btn btn-primary" data-act="resend">${t('ส่งรหัสใหม่', 'Send a new code')}</button>`
          : `<button class="btn btn-primary" id="verify" data-act="verify" ${st.code.length === 6 ? '' : 'disabled'}>${t('ยืนยัน', 'Verify')}</button>
             <p class="muted xs center">${t('รหัสจะหมดอายุใน 5 นาที', 'The code expires in 5 minutes')}</p>`}
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
        if (resendEl) resendEl.innerHTML = left > 0 ? `${t('ส่งรหัสใหม่ได้ใน', 'Resend in')} <b style="color:var(--ink)">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>` : `<button class="link" data-act="resend">${t('ส่งรหัสใหม่', 'Resend code')}</button>`;
      };
      tick(); otpTimer = setInterval(tick, 1000);
      return () => clearInterval(otpTimer);
    },
    actions: {
      lang: toggleLang,
      async verify() {
        if (otpState.code.length !== 6 || verifying) return;
        verifying = true;
        const btn = document.getElementById('verify');
        if (btn) { btn.disabled = true; btn.textContent = t('กำลังตรวจสอบ…', 'Checking…'); }
        const r = await verifyOtp(otpState.code);
        verifying = false;
        if (r.reason === 'server') {
          if (btn) { btn.disabled = false; btn.textContent = t('ยืนยัน', 'Verify'); }
          toast(serverErrorText(r.message), 9000);
          console.warn('[pointie] sign-in failed:', r.message);
          return;
        }
        if (r.ok) {
          otpState = { code: '', status: 'normal', tries: 3 };
          if (r.isNew || !store.me.user.setupDone) go('/join/name');
          else { toast(t(`ยินดีต้อนรับกลับ ${store.me.user.nick}!`, `Welcome back, ${store.me.user.nick}!`)); go(returnTo.take() || '/home'); }
        } else if (r.reason === 'wrong') {
          otpState = { ...otpState, status: 'wrong', tries: r.tries };
          window.dispatchEvent(new Event('rerender'));
        } else {
          otpState = { ...otpState, status: 'expired' };
          window.dispatchEvent(new Event('rerender'));
        }
      },
      async resend() {
        if (resending) return;
        const i = otpInfo();
        resending = true;
        const r = await requestOtp(i ? i.phone : normalizePhone(phoneDraft));
        resending = false;
        if (!r.ok) { toast(smsErrorText(r.message) + (smsTestMode() ? ` (${r.message})` : ''), 12000); return; }
        otpState = { code: '', status: 'normal', tries: 3 };
        toast(t('ส่งรหัสใหม่แล้ว', 'New code sent'));
        window.dispatchEvent(new Event('rerender'));
      },
    },
  };
}
export const resetOtpScreen = () => { otpState = { code: '', status: 'normal', tries: 3 }; };

// ---------- A4 Setup / edit profile ----------
// First sign-up asks for: name, surname, nickname, birth date (13+), avatar → then preferences.
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const pad2 = (n) => String(n).padStart(2, '0');
let setupDraft = null;
let setupBusy = false;
function birthIso(d) {
  if (!d.bd || !d.bm || !d.by) return null;
  const y = +d.by - 543, m = +d.bm, day = +d.bd;
  const dt = new Date(y, m - 1, day);
  if (dt.getMonth() !== m - 1) return 'bad'; // e.g. 31 Feb
  return `${y}-${pad2(m)}-${pad2(day)}`;
}
export function setup(params, query) {
  const me = store.me;
  const edit = query.get('edit') === '1';
  if (!setupDraft) {
    const id = me.identity || {};
    const b = id.birthDate ? new Date(id.birthDate) : null;
    setupDraft = { nick: me.user.nick || '', avatar: me.user.avatar ?? 0, photo: me.user.photo || null,
      first: id.firstName || '', last: id.lastName || '', bd: b ? String(b.getDate()) : '', bm: b ? String(b.getMonth() + 1) : '', by: b ? String(b.getFullYear() + 543) : '' };
  }
  const d = setupDraft;
  const pickedSrc = d.photo || (d.avatar != null ? AVATARS[d.avatar].src : AVATARS[0].src);
  const thisYearBE = new Date().getFullYear() + 543;
  const years = []; for (let y = thisYearBE - 13; y >= 2463; y--) years.push(y);
  const sel = (name, ph, opts) => `<select class="sel" name="${name}" aria-label="${ph}"><option value="">${ph}</option>${opts.map(([v, l]) => `<option value="${v}" ${String(d[name]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return {
    html: `<div class="topbar">${edit ? backBtn('/profile') : '<span style="width:40px"></span>'}${edit ? '<h1 style="text-align:center">แก้ไขโปรไฟล์</h1>' : steps(3, 3)}<span style="width:40px"></span></div>
      ${edit ? '' : `<div class="col" style="gap:6px"><h1 class="h1" style="font-size:24px">ให้เรารู้จักคุณหน่อย</h1><p class="muted">ชื่อเล่นและรูปจะอยู่บนนามบัตรและรีวิวของคุณ</p></div>`}
      <div class="avatar-big">
        <img src="${pickedSrc}" alt="รูปโปรไฟล์ที่เลือก" style="${d.photo ? 'object-fit:cover' : ''}">
        <label class="cam" aria-label="อัปโหลดรูปจากเครื่อง">${icon('camera', 18)}<input type="file" accept="image/*" id="upload" class="sr-only"></label>
      </div>
      <div class="avatar-pick">
        ${AVATARS.map((a, i) => `<button class="${!d.photo && d.avatar === i ? 'on' : ''}" data-act="pick" data-i="${i}" aria-label="${a.label}"><img src="${a.src}" alt=""></button>`).join('')}
      </div>
      <form class="col" id="idForm" style="gap:12px" novalidate>
        <div class="row2f">
          <label class="fld"><span>ชื่อ</span><input name="first" autocomplete="given-name" maxlength="60" value="${esc(d.first)}"></label>
          <label class="fld"><span>นามสกุล</span><input name="last" autocomplete="family-name" maxlength="60" value="${esc(d.last)}"></label>
        </div>
        <label class="fld"><span class="between">ชื่อเล่น <small id="cnt">${d.nick.length}/20</small></span><input name="nick" id="nick" maxlength="20" placeholder="เช่น มายด์" value="${esc(d.nick)}"></label>
        <div class="fld"><span>วันเกิด</span>
          <div class="bday">${sel('bd', 'วัน', Array.from({ length: 31 }, (_, i) => [i + 1, i + 1]))}${sel('bm', 'เดือน', TH_MONTHS_FULL.map((m, i) => [i + 1, m]))}${sel('by', 'ปี พ.ศ.', years.map((y) => [y, y]))}</div>
        </div>
        <p class="alert" id="idErr" hidden style="justify-content:flex-start"></p>
        <p class="muted xs row" style="gap:6px;align-items:flex-start">${icon('lock', 14)}<span>ร้านค้าเห็นแค่ชื่อเล่นของคุณ ชื่อจริงกับวันเกิดใช้ยืนยันตัวตน และใช้สรุปรีวิวตามช่วงวัยแบบไม่ระบุตัวตน · ใช้งานได้ตั้งแต่อายุ 13 ปีขึ้นไป</span></p>
      </form>
      <div class="col spacer">
        ${edit || me.user.setupDone ? '' : `<p class="row small" style="justify-content:center;gap:8px"><span class="pill violet">+${XP.signup} XP</span><span>โบนัสต้อนรับสมาชิกใหม่</span></p>`}
        <button class="btn btn-primary" id="go" data-act="save">${edit ? 'บันทึก' : 'ต่อไป'}</button>
      </div>`,
    mount(root) {
      const form = root.querySelector('#idForm');
      form.addEventListener('input', (e) => {
        if (!e.target.name) return;
        setupDraft[e.target.name] = e.target.value;
        if (e.target.name === 'nick') root.querySelector('#cnt').textContent = `${e.target.value.length}/20`;
        e.target.classList.remove('bad');
        root.querySelector('#idErr').hidden = true;
      });
      form.addEventListener('submit', (e) => { e.preventDefault(); this.actions.save(); });
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
      async save() {
        if (setupBusy) return;
        const dd = setupDraft;
        const err = document.getElementById('idErr');
        const fail = (msg, names) => {
          err.textContent = msg; err.hidden = false;
          names.forEach((n) => document.querySelector(`#idForm [name=${n}]`)?.classList.add('bad'));
          document.querySelector(`#idForm [name=${names[0]}]`)?.focus();
        };
        const missing = ['first', 'last', 'nick', 'bd', 'bm', 'by'].filter((n) => !String(dd[n] || '').trim());
        if (missing.length) return fail('กรอกข้อมูลให้ครบทุกช่องนะ', missing);
        const birth = birthIso(dd);
        if (birth === 'bad') return fail('วันเกิดไม่ถูกต้อง ตรวจวันที่อีกครั้ง', ['bd']);
        if (ageOf(birth) < 13) return fail('D Point ใช้งานได้ตั้งแต่อายุ 13 ปีขึ้นไป', ['by']);
        setupBusy = true;
        const btn = document.getElementById('go'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
        const r = await saveIdentity({ firstName: dd.first, lastName: dd.last, birthDate: birth });
        setupBusy = false; btn.disabled = false; btn.textContent = edit ? 'บันทึก' : 'ต่อไป';
        if (!r.ok) return fail(r.reason === 'too_young' ? 'D Point ใช้งานได้ตั้งแต่อายุ 13 ปีขึ้นไป' : r.reason === 'server' ? serverErrorText(r.message) : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', ['first']);
        const { nick, avatar, photo } = dd;
        if (edit) { updateProfile({ nick: nick.trim().slice(0, 20), avatar, photo }); setupDraft = null; toast('บันทึกโปรไฟล์แล้ว'); go('/profile'); return; }
        const first = !store.me.user.setupDone;
        completeSetup({ nick, avatar });
        updateProfile({ photo });
        setupDraft = null;
        if (first) toast(`ยินดีต้อนรับ ${nick.trim()}! +${XP.signup} XP`);
        if (!store.me.user.prefsDone) { store.me.pending.onboarding = true; go('/prefs/places'); }
        else go(returnTo.take() || '/scan');
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
        <div class="brand">${wordmark(26)}</div>
        <div class="col" style="align-items:center;margin-top:40px">
          <img src="img/pointie-jump.png" alt="" style="height:150px">
          <div class="h1" style="font-size:30px">ได้แสตมป์แรกแล้ว!</div>
        </div>
      </div>
      <div class="sheet-backdrop" style="background:rgba(0,0,0,.55)">
        <div class="sheet" role="dialog" aria-labelledby="inviteTitle" style="align-items:center;text-align:center;overflow:visible">
          <img src="img/pointie-cheer.png" alt="D Point ดีใจ" style="height:130px;margin-top:-80px">
          <span class="pill soft">ภารกิจแรกของคุณ</span>
          <h2 id="inviteTitle" class="h1" style="font-size:24px">บอก D Point หน่อย<br>ว่าชอบอะไร</h2>
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
  next: '/prefs/style', prev: store.me?.pending?.onboarding ? '/setup' : '/invite', cols: 3, edit: q.get('edit') === '1',
});
export const prefStyle = (p, q) => prefScreen({
  step: 2, title: 'คุณเป็นสายไหน?', sub: 'เลือกได้สูงสุด 3 แบบ', img: 'img/pointie-point.png', list: STYLES, key: 'styles', max: 3,
  next: '/prefs/location', prev: '/prefs/places', cols: 2, edit: q.get('edit') === '1', tagsNote: true,
});

// Where to go when the preference questions end: settings (edit), the first stamp
// (right after sign-up) or home.
function afterPrefs(edit) {
  if (edit) return '/settings';
  if (store.me?.pending?.onboarding) { delete store.me.pending.onboarding; return returnTo.take() || '/scan'; }
  return '/home';
}

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
    go(afterPrefs(edit));
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
        skip() { locView = 'ask'; updateProfile({ prefsAsked: true }); go(afterPrefs(edit)); },
      },
    };
  }
  return {
    html: `${top}
      <div class="loc-hero"><img src="img/pointie-point.png" alt=""></div>
      <div class="col center" style="gap:6px"><h1 class="h1" style="font-size:24px">ให้ D Point หาร้านใกล้คุณ</h1><p class="muted">อนุญาตตำแหน่งเพื่อให้แนะนำได้แม่นขึ้น</p></div>
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
          (p) => { setOrigin(+p.coords.latitude.toFixed(6), +p.coords.longitude.toFixed(6)); refreshDistances(); updateProfile({ locationOk: true }); done(); },
          () => { toast('ไม่ได้รับอนุญาตตำแหน่ง เลือกย่านเองแทนนะ'); locView = 'manual'; window.dispatchEvent(new Event('rerender')); },
          { timeout: 8000, maximumAge: 600000 },
        );
      },
      toManual() { locView = 'manual'; window.dispatchEvent(new Event('rerender')); },
      skip() { updateProfile({ prefsAsked: true }); go(afterPrefs(edit)); },
    },
  };
}
