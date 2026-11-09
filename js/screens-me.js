// Profile editing (name, birthday, style) and the privacy policy / terms pages.
import { icon } from './icons.js';
import { esc, go, toast, backBtn } from './ui.js';
import { PLACES, STYLES } from './data.js';
import { store, saveIdentity, ageOf, savePrefs, updateProfile } from './store.js';
import { serverErrorText } from './screens-onboard.js';
import { t, getLang } from './i18n.js';

const pad2 = (n) => String(n).padStart(2, '0');
const rerender = () => window.dispatchEvent(new Event('rerender'));
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const top = (title) => `<div class="topbar">${backBtn('/profile')}<h1>${title}</h1><span style="width:40px"></span></div>`;
function fail(root, names, msg) {
  const err = root.querySelector('.join-err'); err.textContent = msg; err.hidden = false;
  names.forEach((n) => root.querySelector(`[name=${n}]`)?.classList.add('bad'));
  root.querySelector(`[name=${names[0]}]`)?.focus();
}
const errText = (r) => (r.reason === 'too_young' ? t('D Point ใช้งานได้ตั้งแต่อายุ 13 ปีขึ้นไป', 'You must be 13 or older to use D Point')
  : r.reason === 'server' ? serverErrorText(r.message) : t('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'Could not save, please try again'));

// Names typed on /me/name are kept here when the account has no birthday yet (identity needs both).
const PENDING = 'dpoint.me.names';
const pendingNames = () => { try { return JSON.parse(sessionStorage.getItem(PENDING)); } catch { return null; } };

// ---------- name ----------
let busy = false;
export function editName() {
  const me = store.me; const id = me.identity || {}; const p = pendingNames() || {};
  const d = { nick: me.user.nick || '', first: p.first ?? id.firstName ?? '', last: p.last ?? id.lastName ?? '' };
  return {
    html: `${top(t('แก้ไขชื่อ', 'Edit name'))}
      <form class="col join-form" id="f" novalidate>
        <label class="fld"><span class="between">${t('ชื่อเล่น', 'Nickname')} <small id="cnt">${d.nick.length}/20</small></span><input name="nick" maxlength="20" autocomplete="nickname" value="${esc(d.nick)}"></label>
        <div class="row2f">
          <label class="fld"><span>${t('ชื่อจริง', 'First name')}</span><input name="first" autocomplete="given-name" maxlength="60" value="${esc(d.first)}"></label>
          <label class="fld"><span>${t('นามสกุล', 'Last name')}</span><input name="last" autocomplete="family-name" maxlength="60" value="${esc(d.last)}"></label>
        </div>
        <p class="alert join-err" hidden></p>
        <p class="muted xs row" style="gap:6px;align-items:flex-start">${icon('lock', 14)}<span>${t('ร้านค้าเห็นแค่ชื่อเล่น ชื่อจริงใช้ยืนยันตัวตนเท่านั้น', 'Shops only see your nickname. Your real name is only used to verify you.')}</span></p>
      </form>
      <div class="col spacer"><button class="btn btn-primary" id="go" form="f">${t('บันทึก', 'Save')}</button></div>`,
    mount(root) {
      const f = root.querySelector('#f');
      f.addEventListener('input', (e) => {
        if (e.target.name === 'nick') root.querySelector('#cnt').textContent = `${e.target.value.length}/20`;
        e.target.classList.remove('bad'); root.querySelector('.join-err').hidden = true;
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy) return;
        const v = Object.fromEntries(new FormData(f));
        const missing = ['nick', 'first', 'last'].filter((n) => !String(v[n] || '').trim());
        if (missing.length) return fail(root, missing, t('กรอกให้ครบทั้ง 3 ช่องนะ', 'Please fill in all 3 fields'));
        const birth = store.me.identity?.birthDate;
        if (!birth) {
          // identity needs a birthday too: keep the names and ask for it next
          try { sessionStorage.setItem(PENDING, JSON.stringify({ first: v.first, last: v.last })); } catch { /* ignore */ }
          updateProfile({ nick: v.nick.trim().slice(0, 20) });
          toast(t('ใส่วันเกิดอีกขั้นเดียว', 'One more step: your birthday'));
          return go('/me/birthday');
        }
        busy = true; const btn = root.querySelector('#go'); btn.disabled = true;
        const r = await saveIdentity({ firstName: v.first, lastName: v.last, birthDate: birth });
        busy = false; btn.disabled = false;
        if (!r.ok) return fail(root, ['first'], errText(r));
        updateProfile({ nick: v.nick.trim().slice(0, 20) });
        toast(t('บันทึกชื่อแล้ว', 'Name saved')); go('/profile');
      });
    },
  };
}

// ---------- birthday ----------
export function editBirthday() {
  const me = store.me; const id = me.identity || {};
  const b = id.birthDate ? new Date(id.birthDate) : null;
  const en = getLang() === 'en';
  const nowY = new Date().getFullYear();
  const years = []; for (let y = nowY - 13; y >= 1920; y--) years.push(y);
  const sel = (name, ph, opts, cur) => `<select class="sel" name="${name}" aria-label="${ph}"><option value="">${ph}</option>${opts.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return {
    html: `${top(t('วันเกิด', 'Birthday'))}
      <div class="join-hero"><div class="join-art"><span class="join-gift" aria-hidden="true">🎂</span><img src="img/pointie-cheer.png" alt=""></div>
        <p class="muted">${t('ใส่วันเกิด รับสิทธิพิเศษในวันเกิดของคุณ', 'Add your birthday to get birthday treats')}</p></div>
      <form class="col join-form" id="f" novalidate>
        <div class="fld"><span>${t('วันเกิด', 'Date of birth')}</span>
          <div class="bday">${sel('bd', t('วัน', 'Day'), Array.from({ length: 31 }, (_, i) => [i + 1, i + 1]), b ? b.getDate() : '')}${sel('bm', t('เดือน', 'Month'), (en ? MONTHS_EN : MONTHS_TH).map((m, i) => [i + 1, m]), b ? b.getMonth() + 1 : '')}${sel('by', t('ปี พ.ศ.', 'Year'), years.map((y) => [y, en ? y : y + 543]), b ? b.getFullYear() : '')}</div>
        </div>
        <p class="alert join-err" hidden></p>
        <p class="muted xs row" style="gap:6px;align-items:flex-start">${icon('lock', 14)}<span>${t('ร้านค้าไม่เห็นวันเกิดของคุณ เห็นแค่ช่วงวัย (Gen) แบบไม่ระบุตัวตน', 'Shops never see your birthday, only your generation, anonymously.')}</span></p>
      </form>
      <div class="col spacer"><button class="btn btn-primary" id="go" form="f">${t('บันทึก', 'Save')}</button></div>`,
    mount(root) {
      const f = root.querySelector('#f');
      f.addEventListener('change', (e) => { e.target.classList.remove('bad'); root.querySelector('.join-err').hidden = true; });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy) return;
        const v = Object.fromEntries(new FormData(f));
        const missing = ['bd', 'bm', 'by'].filter((n) => !v[n]);
        if (missing.length) return fail(root, missing, t('เลือกวัน เดือน ปีเกิดให้ครบนะ', 'Please pick day, month and year'));
        const y = +v.by, m = +v.bm, day = +v.bd;
        if (new Date(y, m - 1, day).getMonth() !== m - 1) return fail(root, ['bd'], t('วันเกิดไม่ถูกต้อง ตรวจวันที่อีกครั้ง', 'That date does not exist'));
        const birth = `${y}-${pad2(m)}-${pad2(day)}`;
        if (ageOf(birth) < 13) return fail(root, ['by'], t('D Point ใช้งานได้ตั้งแต่อายุ 13 ปีขึ้นไป', 'You must be 13 or older to use D Point'));
        const p = pendingNames() || {}; const idn = store.me.identity || {};
        const first = p.first || idn.firstName, last = p.last || idn.lastName;
        if (!first || !last) { toast(t('ใส่ชื่อจริงก่อนนะ', 'Add your name first')); return go('/me/name'); }
        busy = true; const btn = root.querySelector('#go'); btn.disabled = true;
        const r = await saveIdentity({ firstName: first, lastName: last, birthDate: birth });
        busy = false; btn.disabled = false;
        if (!r.ok) return fail(root, ['bd'], errText(r));
        try { sessionStorage.removeItem(PENDING); } catch { /* ignore */ }
        toast(t('บันทึกวันเกิดแล้ว', 'Birthday saved')); go('/profile');
      });
    },
  };
}

// ---------- style & interests ----------
const LIKE_EMOJI = { cafe: '☕', food: '🍜', street: '🍢', bakery: '🧁', shop: '🛍️', plant: '🪴', book: '📚', workshop: '🎨', sport: '🧗',
  chill: '🛋️', photo: '📸', eat: '😋', deal: '🏷️', active: '⚡', new: '✨' };
const LIKE_EN = { cafe: 'Cafés', food: 'Restaurants', street: 'Street food', bakery: 'Desserts', shop: 'Shopping', plant: 'Plant shops', book: 'Bookshops', workshop: 'Workshops', sport: 'Sports',
  chill: 'Chill', photo: 'Photo spots', eat: 'Foodie', deal: 'Deal hunter', active: 'Active', new: 'New & trendy' };
export function editStyle() {
  const me = store.me;
  const on = new Set([...(me.user.prefs.places || []), ...(me.user.prefs.styles || [])]);
  const chip = ([k, label]) => `<button type="button" class="like ${on.has(k) ? 'on' : ''}" data-act="toggle" data-k="${k}" aria-pressed="${on.has(k)}"><span class="e" aria-hidden="true">${LIKE_EMOJI[k] || '•'}</span>${t(label, LIKE_EN[k] || label)}</button>`;
  return {
    html: `${top(t('สไตล์และความชอบ', 'Style & interests'))}
      <p class="muted">${t('เลือกได้หลายอย่าง เราจะแนะนำร้านและโปรที่ตรงใจ', 'Pick as many as you like, we will suggest shops and deals that fit.')}</p>
      <section class="col" style="gap:10px"><h2 class="like-h">${t('ชอบไปที่แบบไหน', 'Places you like')}</h2><div class="likes">${PLACES.map(chip).join('')}</div></section>
      <section class="col" style="gap:10px"><h2 class="like-h">${t('คุณเป็นสายไหน', 'Your style')}</h2><div class="likes">${STYLES.map(chip).join('')}</div></section>
      <div class="col spacer"><a class="btn btn-primary" href="#/profile">${t('เสร็จแล้ว', 'Done')}</a></div>`,
    actions: {
      toggle(el) {
        const k = el.dataset.k;
        const key = PLACES.some(([p]) => p === k) ? 'places' : 'styles';
        const cur = new Set(me.user.prefs[key] || []);
        if (cur.has(k)) cur.delete(k); else cur.add(k);
        savePrefs({ [key]: [...cur] });
        rerender();
      },
    },
  };
}

// ---------- privacy policy & terms ----------
// Set this to the address people can write to about their data before launch.
export const PRIVACY_CONTACT = '';
const UPDATED = { th: '9 พฤศจิกายน 2569', en: '9 November 2026' };
const doc = (title, sections) => ({
  cls: 'doc',
  html: `<div class="topbar">${backBtn(store.me ? '/profile' : '/welcome')}<h1>${title}</h1><span style="width:40px"></span></div>
    <p class="xs muted">${t('ปรับปรุงล่าสุด', 'Last updated')} ${t(UPDATED.th, UPDATED.en)}</p>
    ${sections.map(([h, body]) => `<section class="doc-sec"><h2>${h}</h2>${body}</section>`).join('')}`,
});
const ul = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;

export function privacy() {
  const contact = PRIVACY_CONTACT ? `<a href="mailto:${esc(PRIVACY_CONTACT)}">${esc(PRIVACY_CONTACT)}</a>` : '';
  if (getLang() === 'en') {
    return doc('Privacy policy', [
      ['Summary', '<p>D Point is a digital stamp card for local shops. We only collect what is needed to run your cards, levels and rewards. Shops see your nickname and your activity at their own shop, never your real name, phone number or birthday.</p>'],
      ['What we collect', ul([
        '<b>Account:</b> mobile number (to sign in with a one-time code), nickname, profile picture.',
        '<b>Identity:</b> first name, last name and date of birth (to confirm you are 13 or older, for birthday treats and anonymous per-generation summaries).',
        '<b>Preferences:</b> the places and styles you pick.',
        '<b>Activity:</b> stamps, visits, rewards you redeem, reviews you write, badges, level and XP.',
        '<b>Location:</b> only if you allow it, used on your device to show distances. It is not sent to our server or to shops.',
      ])],
      ['How we use it', ul(['Run your stamp cards, rewards, levels and member tiers', 'Stop abuse (one stamp per shop per day, stand codes, redemption codes)', 'Suggest shops and deals that fit you', 'Show shops overall statistics so they can improve'])],
      ['What shops can see', ul([
        'Your nickname, level, member tier and generation (e.g. Gen Z), not your age or birthday',
        'Your stamps, visits, redemptions and reviews at <b>their</b> shop only',
        'They <b>cannot</b> see your real name, phone number, birthday, location or activity at other shops',
      ])],
      ['Who processes the data', `<p>We use service providers to run D Point: Supabase (database and sign-in), Vercel (website hosting) and an SMS provider (to send your sign-in code, which receives only your phone number and the code). We do not sell your data.</p>`],
      ['How long we keep it', '<p>For as long as you have an account. When you delete your account, your profile, identity, cards, stamps and reviews are deleted immediately. Shops keep only anonymous totals (e.g. number of stamps that day) without your nickname.</p>'],
      ['Your rights (Thai PDPA)', ul(['See and correct your data in Profile', 'Delete your account at any time: Profile → Delete account', 'Withdraw consent, object, or ask for a copy of your data', 'Complain to the Office of the Personal Data Protection Committee'])],
      ['Contact', contact ? `<p>Questions about your data: ${contact}</p>` : '<p>Questions about your data: contact the D Point team.</p>'],
    ]);
  }
  return doc('นโยบายความเป็นส่วนตัว', [
    ['สรุปสั้นๆ', '<p>D Point เป็นบัตรสะสมแต้มดิจิทัลสำหรับร้านค้า เราเก็บเฉพาะข้อมูลที่จำเป็นต่อการสะสมแต้ม เลเวล และรางวัลของคุณ ร้านค้าเห็นแค่ชื่อเล่นและกิจกรรมของคุณที่ร้านของเขาเท่านั้น ไม่เห็นชื่อจริง เบอร์โทร หรือวันเกิด</p>'],
    ['ข้อมูลที่เราเก็บ', ul([
      '<b>บัญชี:</b> เบอร์มือถือ (ใช้เข้าสู่ระบบด้วยรหัส OTP) ชื่อเล่น รูปโปรไฟล์',
      '<b>ข้อมูลยืนยันตัวตน:</b> ชื่อ นามสกุล และวันเกิด (ใช้ยืนยันว่าอายุ 13 ปีขึ้นไป ให้สิทธิพิเศษวันเกิด และสรุปรีวิวตามช่วงวัยแบบไม่ระบุตัวตน)',
      '<b>ความชอบ:</b> สถานที่และสไตล์ที่คุณเลือก',
      '<b>กิจกรรม:</b> แสตมป์ การไปร้าน รางวัลที่แลก รีวิวที่เขียน Badge เลเวล และ XP',
      '<b>ตำแหน่ง:</b> เฉพาะเมื่อคุณอนุญาต ใช้ในเครื่องของคุณเพื่อคำนวณระยะทางเท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์และร้านค้าไม่เห็น',
    ])],
    ['เราใช้ข้อมูลเพื่อ', ul(['ให้บริการบัตรสะสม รางวัล เลเวล และระดับสมาชิก', 'ป้องกันการโกง (ร้านละ 1 แสตมป์ต่อวัน รหัสสแตนด์ รหัสแลกรางวัล)', 'แนะนำร้านและโปรที่ตรงกับความชอบ', 'แสดงสถิติภาพรวมให้ร้านค้าเพื่อปรับปรุงบริการ'])],
    ['ร้านค้าเห็นอะไรบ้าง', ul([
      'ชื่อเล่น เลเวล ระดับสมาชิก และช่วงวัย (เช่น Gen Z) ไม่เห็นอายุหรือวันเกิด',
      'แสตมป์ การมาร้าน การแลกรางวัล และรีวิว เฉพาะที่<b>ร้านของเขา</b>',
      'ร้านค้า<b>ไม่เห็น</b>ชื่อจริง เบอร์โทร วันเกิด ตำแหน่ง หรือกิจกรรมที่ร้านอื่น',
    ])],
    ['ผู้ให้บริการที่ประมวลผลข้อมูล', '<p>เราใช้ผู้ให้บริการเพื่อให้ D Point ทำงานได้ ได้แก่ Supabase (ฐานข้อมูลและระบบเข้าสู่ระบบ) Vercel (โฮสต์เว็บไซต์) และผู้ให้บริการ SMS (ส่งรหัส OTP โดยได้รับเฉพาะเบอร์โทรและรหัส) เราไม่ขายข้อมูลของคุณ</p>'],
    ['ระยะเวลาเก็บข้อมูล', '<p>เก็บตราบที่คุณยังมีบัญชี เมื่อลบบัญชี ข้อมูลโปรไฟล์ ข้อมูลยืนยันตัวตน บัตรสะสม แสตมป์ และรีวิวจะถูกลบทันที ร้านค้าจะเหลือเพียงยอดรวมแบบไม่ระบุตัวตน (เช่น จำนวนแสตมป์ในวันนั้น) โดยไม่มีชื่อเล่นของคุณ</p>'],
    ['สิทธิของคุณตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)', ul(['ดูและแก้ไขข้อมูลได้ที่หน้าโปรไฟล์', 'ลบบัญชีได้ทุกเมื่อ: โปรไฟล์ → ลบบัญชี', 'ถอนความยินยอม คัดค้าน หรือขอสำเนาข้อมูลของคุณ', 'ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล'])],
    ['ติดต่อเรา', contact ? `<p>สอบถามเรื่องข้อมูลส่วนบุคคล: ${contact}</p>` : '<p>สอบถามเรื่องข้อมูลส่วนบุคคล: ติดต่อทีมงาน D Point</p>'],
  ]);
}

export function terms() {
  if (getLang() === 'en') {
    return doc('Terms of use', [
      ['Using D Point', ul(['You must be 13 or older.', 'One account per person and phone number.', 'Keep your sign-in code private.'])],
      ['Stamps & rewards', ul(['One stamp per shop per day, unless the shop runs a promotion (e.g. double stamps).', 'Rewards are redeemed in front of shop staff with a 4-digit code.', 'Each shop sets its own card, rewards and promotions and may change or end them.', 'Stamps and rewards have no cash value and cannot be transferred.'])],
      ['Reviews', ul(['Only customers who have visited can review.', 'Be honest and respectful; we may remove reviews that are abusive, fake or off-topic.'])],
      ['Fair use', '<p>Collecting stamps without a real visit, sharing stand links, or any other abuse may lead to stamps being removed or the account being closed.</p>'],
      ['Changes', '<p>We may update these terms. We will show the new date on this page.</p>'],
    ]);
  }
  return doc('ข้อกำหนดการใช้งาน', [
    ['การใช้งาน D Point', ul(['ผู้ใช้ต้องมีอายุ 13 ปีขึ้นไป', 'หนึ่งคนหนึ่งบัญชีต่อหนึ่งเบอร์มือถือ', 'อย่าบอกรหัส OTP ของคุณกับผู้อื่น'])],
    ['แสตมป์และรางวัล', ul(['ได้ร้านละ 1 แสตมป์ต่อวัน เว้นแต่ร้านจัดโปร เช่น แสตมป์ x2', 'แลกรางวัลต่อหน้าพนักงานร้านด้วยรหัส 4 หลัก', 'แต่ละร้านกำหนดบัตร รางวัล และโปรของตัวเอง และอาจเปลี่ยนแปลงหรือยกเลิกได้', 'แสตมป์และรางวัลไม่มีมูลค่าเป็นเงินและโอนให้ผู้อื่นไม่ได้'])],
    ['รีวิว', ul(['รีวิวได้เฉพาะลูกค้าที่เคยมาร้านจริง', 'เขียนอย่างสุภาพและตรงความจริง เราอาจลบรีวิวที่หยาบคาย ปลอม หรือไม่เกี่ยวข้อง'])],
    ['การใช้งานอย่างเป็นธรรม', '<p>การเก็บแสตมป์โดยไม่ได้ไปร้านจริง การแชร์ลิงก์สแตนด์ หรือการใช้งานในทางที่ผิดอื่นๆ อาจทำให้แสตมป์ถูกลบหรือบัญชีถูกระงับ</p>'],
    ['การเปลี่ยนแปลง', '<p>เราอาจปรับปรุงข้อกำหนดนี้ และจะแสดงวันที่ปรับปรุงล่าสุดไว้ในหน้านี้</p>'],
  ]);
}
