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

// ---------- privacy policy & terms of use ----------
// Issued by the operator of D Point. Keep both languages in step when editing.
export const COMPANY = { th: 'บริษัท ทรีพีเอ็น บิสซิเนส โซลูชั่น จำกัด', en: '3PN Business Solution Co., Ltd.' };
export const PRIVACY_CONTACT = 'work@3pnbusinesssolution.com';
const UPDATED = { th: '9 พฤศจิกายน 2569', en: '9 November 2026' };
const mail = `<a href="mailto:${PRIVACY_CONTACT}">${PRIVACY_CONTACT}</a>`;
const ul = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const doc = (title, intro, sections) => ({
  cls: 'doc',
  html: `<div class="topbar">${backBtn(store.me ? '/profile' : '/welcome')}<h1>${title}</h1><span style="width:40px"></span></div>
    <div class="doc-intro"><p class="xs muted">${t('มีผลบังคับใช้ / ปรับปรุงล่าสุด', 'Effective / last updated')}: ${t(UPDATED.th, UPDATED.en)}</p>${intro}</div>
    ${sections.map(([h, body], i) => `<section class="doc-sec"><h2>${i + 1}. ${h}</h2>${body}</section>`).join('')}
    <p class="center xs muted">© ${new Date().getFullYear()} ${t(COMPANY.th, COMPANY.en)}</p>`,
});

export function privacy() {
  if (getLang() === 'en') {
    return doc('Privacy policy', `<p>${COMPANY.en} (the "<b>Company</b>", "<b>we</b>"), the provider of D Point, respects your privacy. This policy explains how we collect, use, disclose and protect your personal data when you use the D Point customer app (app.getpointie.com), the merchant website (store.getpointie.com) and our website (getpointie.com) (together, the "<b>Service</b>"), in line with Thailand's Personal Data Protection Act B.E. 2562 (2019) ("<b>PDPA</b>"). We are the data controller for the data described here.</p>`, [
      ['Personal data we collect', ul([
        '<b>Account data:</b> mobile number, nickname, profile picture or avatar; if you sign in with Google or Apple, we receive your name, email address (Apple may give a private relay address) and account ID from that service.',
        '<b>Identity data:</b> first name, last name and date of birth.',
        '<b>Preferences:</b> the places and styles you choose.',
        '<b>Usage data:</b> stamps, shop visits (date and time), rewards and redemption codes, reviews and ratings, badges, level, XP, missions and notifications.',
        '<b>Location:</b> only if you allow it, processed on your device to show distances; it is not sent to our servers or to shops.',
        '<b>Technical data:</b> sign-in session data, device and browser type and error logs needed to run and secure the Service.',
        '<b>Shop owners and business enquiries:</b> name, email, phone number and shop details given when you register a shop or fill in our sign-up form.',
      ])],
      ['How we collect it', '<p>Directly from you when you sign up, edit your profile, tap or scan a D Point stand, redeem rewards or write reviews, and automatically from your device while you use the Service.</p>'],
      ['Purposes and legal bases', ul([
        '<b>To provide the Service</b> (contract): create and secure your account, sign you in with a one-time code, keep your stamp cards, rewards, levels and member tiers.',
        '<b>To prevent fraud and abuse</b> (legitimate interests): one stamp per shop per day, stand codes, redemption codes, checking reviews come from real visits.',
        '<b>To personalise</b> (legitimate interests): suggest shops, missions and deals that fit your preferences.',
        '<b>To give shops insights</b> (legitimate interests): statistics such as visits, returning customers and anonymous summaries by generation.',
        '<b>Birthday treats and age check</b> (contract / consent): confirm you are at least 13 and offer birthday benefits.',
        '<b>To comply with law</b> (legal obligation) and to establish or defend legal claims.',
      ])],
      ['Who we share it with', ul([
        '<b>Participating shops</b> see your nickname, level, member tier, generation (e.g. Gen Z, not your age or birthday) and your stamps, visits, redemptions and reviews <b>at their shop only</b>. Shops never see your real name, mobile number, birthday, location or activity at other shops.',
        '<b>Other users</b> can see your nickname, level and reviews you publish.',
        '<b>Service providers</b> acting on our instructions: Supabase (database and authentication), Vercel (hosting), BoostSMS (sending sign-in codes; it receives only your mobile number and the code), and Google / Apple when you choose to sign in with them.',
        '<b>Authorities</b> where required by law or a court order.',
        'We do <b>not</b> sell your personal data.',
      ])],
      ['International transfers', '<p>Our service providers may store or process data on servers outside Thailand. Where this happens we rely on providers with appropriate safeguards as required by the PDPA.</p>'],
      ['How long we keep it', '<p>We keep your data while your account is active. When you delete your account, your profile, identity data, cards, stamps, rewards and reviews are deleted immediately, and your nickname is removed from shop records; shops keep only anonymous totals. Copies in system backups are overwritten in the normal backup cycle. We may keep data longer only where the law requires it.</p>'],
      ['Children', '<p>The Service is for users aged 13 and over. Users under 20 should use the Service with the knowledge and consent of a parent or guardian. If we learn that we hold data of a child under 13, we will delete it.</p>'],
      ['Security', '<p>Data is encrypted in transit (HTTPS). Database tables cannot be read directly from the app: every action goes through server functions that check who you are, and shops can only reach data about their own shop. Access by our staff is limited to what is needed to run the Service.</p>'],
      ['Cookies and device storage', '<p>We use your browser\'s local storage to keep you signed in and to remember settings such as language and dark mode. We do not use advertising trackers. Shop pages include a Google Maps map, which is provided by Google under its own privacy policy.</p>'],
      ['Your rights', ul([
        'Access and get a copy of your data, and ask how we obtained it',
        'Correct your data (most of it in Profile)',
        'Delete your account and data (Profile → Delete account)',
        'Object to or restrict processing, and ask to receive or transfer your data',
        'Withdraw consent at any time (this does not affect processing already carried out)',
        'Complain to the Office of the Personal Data Protection Committee (PDPC)',
      ]) + `<p>Email us at ${mail} to use these rights. We will respond within 30 days.</p>`],
      ['Changes to this policy', '<p>We may update this policy. The effective date at the top shows the latest version, and we will tell you in the app about significant changes.</p>'],
      ['Contact us', `<p><b>${COMPANY.en}</b><br>Provider of D Point<br>Email: ${mail}</p>`],
    ]);
  }
  return doc('นโยบายความเป็นส่วนตัว', `<p>${COMPANY.th} (“<b>บริษัท</b>” หรือ “<b>ผู้ให้บริการ</b>”) ในฐานะผู้ให้บริการ D Point ให้ความสำคัญกับความเป็นส่วนตัวของคุณ นโยบายนี้อธิบายวิธีที่บริษัทเก็บรวบรวม ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคลของคุณ เมื่อคุณใช้แอพ D Point สำหรับลูกค้า (app.getpointie.com) เว็บไซต์สำหรับร้านค้า (store.getpointie.com) และเว็บไซต์ getpointie.com (รวมเรียกว่า “<b>บริการ</b>”) ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (“<b>PDPA</b>”) โดยบริษัทเป็นผู้ควบคุมข้อมูลส่วนบุคคลตามนโยบายนี้</p>`, [
    ['ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม', ul([
      '<b>ข้อมูลบัญชี:</b> เบอร์โทรศัพท์มือถือ ชื่อเล่น รูปโปรไฟล์หรือรูปอวาตาร์ และหากคุณเข้าสู่ระบบด้วย Google หรือ Apple บริษัทจะได้รับชื่อ อีเมล (Apple อาจเป็นอีเมลแบบซ่อน) และรหัสบัญชีจากบริการนั้น',
      '<b>ข้อมูลยืนยันตัวตน:</b> ชื่อ นามสกุล และวันเดือนปีเกิด',
      '<b>ข้อมูลความชอบ:</b> ประเภทสถานที่และสไตล์ที่คุณเลือก',
      '<b>ข้อมูลการใช้บริการ:</b> แสตมป์ การเข้าร้าน (วันและเวลา) รางวัลและรหัสแลกรางวัล รีวิวและคะแนน Badge เลเวล XP ภารกิจ และการแจ้งเตือน',
      '<b>ข้อมูลตำแหน่ง:</b> เฉพาะเมื่อคุณอนุญาต และประมวลผลในเครื่องของคุณเพื่อคำนวณระยะทางเท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์และร้านค้าไม่เห็น',
      '<b>ข้อมูลทางเทคนิค:</b> ข้อมูลการเข้าสู่ระบบ ประเภทอุปกรณ์และเบราว์เซอร์ และบันทึกข้อผิดพลาดที่จำเป็นต่อการให้บริการและการรักษาความปลอดภัย',
      '<b>เจ้าของร้านและผู้ติดต่อเชิงธุรกิจ:</b> ชื่อ อีเมล เบอร์โทรศัพท์ และข้อมูลร้าน ที่ให้ไว้ตอนสมัครร้านค้าหรือกรอกแบบฟอร์มสมัครใช้งาน',
    ])],
    ['แหล่งที่มาของข้อมูล', '<p>บริษัทได้รับข้อมูลจากคุณโดยตรงเมื่อคุณสมัคร แก้ไขโปรไฟล์ แตะหรือสแกนสแตนด์ D Point แลกรางวัล หรือเขียนรีวิว และจากอุปกรณ์ของคุณโดยอัตโนมัติระหว่างใช้บริการ</p>'],
    ['วัตถุประสงค์และฐานทางกฎหมายในการประมวลผล', ul([
      '<b>เพื่อให้บริการตามสัญญา:</b> สร้างและดูแลบัญชี ยืนยันตัวตนด้วยรหัส OTP บันทึกบัตรสะสม แสตมป์ รางวัล เลเวล และระดับสมาชิก',
      '<b>เพื่อป้องกันการทุจริตและการใช้งานผิดวัตถุประสงค์ (ประโยชน์โดยชอบด้วยกฎหมาย):</b> จำกัดร้านละ 1 แสตมป์ต่อวัน ตรวจรหัสสแตนด์และรหัสแลกรางวัล และตรวจว่ารีวิวมาจากลูกค้าที่มาร้านจริง',
      '<b>เพื่อปรับบริการให้ตรงกับคุณ (ประโยชน์โดยชอบด้วยกฎหมาย):</b> แนะนำร้าน ภารกิจ และโปรโมชันที่ตรงกับความชอบ',
      '<b>เพื่อให้ข้อมูลเชิงสถิติแก่ร้านค้า (ประโยชน์โดยชอบด้วยกฎหมาย):</b> เช่น จำนวนการมาร้าน ลูกค้าที่กลับมาซ้ำ และสรุปตามช่วงวัยแบบไม่ระบุตัวตน',
      '<b>เพื่อตรวจสอบอายุและมอบสิทธิพิเศษวันเกิด (สัญญา/ความยินยอม):</b> ยืนยันว่าคุณอายุ 13 ปีขึ้นไป และมอบสิทธิประโยชน์ในวันเกิด',
      '<b>เพื่อปฏิบัติตามกฎหมาย</b> และเพื่อก่อตั้งสิทธิเรียกร้องหรือต่อสู้ข้อเรียกร้องตามกฎหมาย',
    ])],
    ['การเปิดเผยข้อมูลส่วนบุคคล', ul([
      '<b>ร้านค้าที่เข้าร่วม</b> เห็นชื่อเล่น เลเวล ระดับสมาชิก ช่วงวัย (เช่น Gen Z โดยไม่เห็นอายุหรือวันเกิด) และแสตมป์ การมาร้าน การแลกรางวัล และรีวิว <b>เฉพาะที่ร้านของตน</b> ร้านค้าไม่เห็นชื่อจริง เบอร์โทรศัพท์ วันเกิด ตำแหน่ง หรือกิจกรรมของคุณที่ร้านอื่น',
      '<b>ผู้ใช้อื่น</b> เห็นชื่อเล่น เลเวล และรีวิวที่คุณเผยแพร่',
      '<b>ผู้ให้บริการที่ประมวลผลข้อมูลแทนบริษัท</b> ตามคำสั่งของบริษัท ได้แก่ Supabase (ฐานข้อมูลและระบบยืนยันตัวตน) Vercel (โฮสต์เว็บไซต์) BoostSMS (ส่งรหัส OTP โดยได้รับเฉพาะเบอร์โทรศัพท์และรหัส) และ Google / Apple เมื่อคุณเลือกเข้าสู่ระบบด้วยบริการนั้น',
      '<b>หน่วยงานของรัฐ</b> เมื่อกฎหมายหรือคำสั่งศาลกำหนด',
      'บริษัท<b>ไม่ขาย</b>ข้อมูลส่วนบุคคลของคุณ',
    ])],
    ['การส่งหรือโอนข้อมูลไปต่างประเทศ', '<p>ผู้ให้บริการของบริษัทอาจจัดเก็บหรือประมวลผลข้อมูลบนเซิร์ฟเวอร์ที่ตั้งอยู่นอกประเทศไทย ในกรณีดังกล่าวบริษัทจะเลือกใช้ผู้ให้บริการที่มีมาตรการคุ้มครองข้อมูลที่เหมาะสมตามที่ PDPA กำหนด</p>'],
    ['ระยะเวลาการเก็บรักษาข้อมูล', '<p>บริษัทเก็บข้อมูลตลอดระยะเวลาที่คุณมีบัญชี เมื่อคุณลบบัญชี ข้อมูลโปรไฟล์ ข้อมูลยืนยันตัวตน บัตรสะสม แสตมป์ รางวัล และรีวิวจะถูกลบทันที และชื่อเล่นของคุณจะถูกลบออกจากบันทึกของร้านค้า ร้านค้าจะเหลือเพียงยอดรวมแบบไม่ระบุตัวตน สำเนาในระบบสำรองข้อมูลจะถูกเขียนทับตามรอบปกติของระบบ บริษัทอาจเก็บข้อมูลนานกว่านี้เฉพาะเมื่อกฎหมายกำหนด</p>'],
    ['ผู้เยาว์', '<p>บริการนี้สำหรับผู้ที่มีอายุ 13 ปีขึ้นไป ผู้ใช้ที่อายุต่ำกว่า 20 ปีควรใช้บริการโดยผู้ปกครองรับทราบและให้ความยินยอม หากบริษัทพบว่ามีข้อมูลของผู้ที่อายุต่ำกว่า 13 ปี บริษัทจะลบข้อมูลนั้น</p>'],
    ['การรักษาความปลอดภัยของข้อมูล', '<p>ข้อมูลถูกเข้ารหัสระหว่างการรับส่ง (HTTPS) แอพไม่สามารถอ่านตารางข้อมูลได้โดยตรง ทุกการทำงานต้องผ่านฟังก์ชันบนเซิร์ฟเวอร์ที่ตรวจสอบตัวตนของผู้ใช้ และร้านค้าเข้าถึงได้เฉพาะข้อมูลของร้านตนเอง พนักงานของบริษัทเข้าถึงข้อมูลได้เท่าที่จำเป็นต่อการให้บริการเท่านั้น</p>'],
    ['คุกกี้และการจัดเก็บข้อมูลในอุปกรณ์', '<p>บริษัทใช้พื้นที่จัดเก็บในเบราว์เซอร์ (local storage) เพื่อให้คุณอยู่ในระบบและจดจำการตั้งค่า เช่น ภาษาและโหมดมืด บริษัทไม่ใช้เครื่องมือติดตามเพื่อการโฆษณา หน้าร้านค้ามีแผนที่ Google Maps ซึ่งให้บริการโดย Google ภายใต้นโยบายความเป็นส่วนตัวของ Google</p>'],
    ['สิทธิของเจ้าของข้อมูลส่วนบุคคล', ul([
      'สิทธิขอเข้าถึงและขอรับสำเนาข้อมูล รวมถึงขอให้เปิดเผยการได้มาซึ่งข้อมูล',
      'สิทธิขอแก้ไขข้อมูลให้ถูกต้อง (ทำได้เองส่วนใหญ่ที่หน้าโปรไฟล์)',
      'สิทธิขอลบข้อมูล (ลบบัญชีได้ที่ โปรไฟล์ → ลบบัญชี)',
      'สิทธิคัดค้านหรือขอระงับการประมวลผล และสิทธิขอรับหรือขอให้ส่งโอนข้อมูล',
      'สิทธิถอนความยินยอมได้ทุกเมื่อ (ไม่กระทบการประมวลผลที่ได้ทำไปแล้ว)',
      'สิทธิร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล',
    ]) + `<p>ใช้สิทธิได้โดยส่งอีเมลมาที่ ${mail} บริษัทจะดำเนินการภายใน 30 วัน</p>`],
    ['การเปลี่ยนแปลงนโยบาย', '<p>บริษัทอาจปรับปรุงนโยบายนี้เป็นครั้งคราว วันที่มีผลบังคับใช้ด้านบนแสดงฉบับล่าสุด และหากมีการเปลี่ยนแปลงที่สำคัญ บริษัทจะแจ้งให้ทราบในแอพ</p>'],
    ['ช่องทางติดต่อ', `<p><b>${COMPANY.th}</b><br>ผู้ให้บริการ D Point<br>อีเมล: ${mail}</p>`],
  ]);
}

export function terms() {
  if (getLang() === 'en') {
    return doc('Terms of use', `<p>These terms are an agreement between you and ${COMPANY.en} (the "<b>Company</b>"), the provider of D Point. By signing up for or using D Point you agree to these terms and to our Privacy policy.</p>`, [
      ['Definitions', ul(['"<b>Service</b>" means the D Point app, the merchant website and getpointie.com.', '"<b>Participating shop</b>" means a business that uses D Point to run its stamp card.', '"<b>Stamp</b>" and "<b>reward</b>" mean the points and benefits each participating shop offers on its card.'])],
      ['Eligibility and your account', ul(['You must be at least 13 years old. Users under 20 should have a parent\'s or guardian\'s consent.', 'One account per person and per mobile number. The information you give must be true and up to date.', 'Keep your one-time code and your device secure; you are responsible for activity on your account.'])],
      ['Stamps and rewards', ul([
        'You can collect one stamp per shop per day, unless the shop runs a promotion such as double stamps.',
        'Each participating shop sets its own card, rewards, promotions and member perks and may change or end them.',
        'Rewards are redeemed in front of shop staff using a 4-digit code.',
        'Stamps and rewards have no cash value, cannot be exchanged for cash and cannot be transferred or sold.',
        'Goods and services are provided by the participating shop, which is responsible for their quality. The Company is not a party to your purchase.',
      ])],
      ['Levels, tiers and badges', '<p>XP, levels, member tiers and badges are calculated by the system from your real activity. We may adjust how they are calculated to keep them fair; perks of each tier are set by participating shops.</p>'],
      ['Reviews and your content', ul(['Only customers who have visited a shop can review it. Reviews must be honest, respectful and about your own experience.', 'You keep ownership of your reviews and allow the Company and the shop to display them in the Service.', 'We may remove content that is false, offensive, unlawful, infringes others\' rights or is off-topic.'])],
      ['Prohibited use', ul(['Collecting stamps without a real visit, or sharing, copying or reusing stand links or QR codes', 'Using bots, scripts or multiple accounts, or interfering with the Service', 'Impersonating others or using other people\'s data', 'Reverse engineering or copying the Service'])],
      ['Suspension and termination', '<p>We may remove stamps or rewards obtained improperly, and suspend or close accounts that break these terms. You can delete your account at any time in Profile; unredeemed stamps and rewards are then lost.</p>'],
      ['Intellectual property', '<p>The D Point name, logo, mascot, design and software belong to the Company or its licensors. Shop names and artwork belong to the respective shops.</p>'],
      ['Service availability and liability', '<p>We aim to keep the Service running but provide it "as is" and may change, pause or stop features. To the extent permitted by law, the Company is not liable for indirect losses, for the acts of participating shops, or for interruptions beyond our reasonable control.</p>'],
      ['Changes to these terms', '<p>We may update these terms. The effective date at the top shows the latest version. If you keep using the Service after a change, you accept the updated terms.</p>'],
      ['Governing law', '<p>These terms are governed by the laws of Thailand, and the Thai courts have jurisdiction.</p>'],
      ['Contact us', `<p><b>${COMPANY.en}</b><br>Provider of D Point<br>Email: ${mail}</p>`],
    ]);
  }
  return doc('ข้อกำหนดการใช้งาน', `<p>ข้อกำหนดนี้เป็นข้อตกลงระหว่างคุณกับ${COMPANY.th} (“<b>บริษัท</b>” หรือ “<b>ผู้ให้บริการ</b>”) ผู้ให้บริการ D Point การสมัครหรือใช้งาน D Point ถือว่าคุณยอมรับข้อกำหนดนี้และนโยบายความเป็นส่วนตัวของบริษัท</p>`, [
    ['คำนิยาม', ul(['“<b>บริการ</b>” หมายถึง แอพ D Point เว็บไซต์สำหรับร้านค้า และเว็บไซต์ getpointie.com', '“<b>ร้านค้าที่เข้าร่วม</b>” หมายถึง ผู้ประกอบการที่ใช้ D Point ทำบัตรสะสมแต้มของร้าน', '“<b>แสตมป์</b>” และ “<b>รางวัล</b>” หมายถึง แต้มและสิทธิประโยชน์ที่ร้านค้าที่เข้าร่วมกำหนดไว้บนบัตรของร้าน'])],
    ['คุณสมบัติผู้ใช้และบัญชี', ul(['ผู้ใช้ต้องมีอายุ 13 ปีขึ้นไป ผู้ที่อายุต่ำกว่า 20 ปีควรได้รับความยินยอมจากผู้ปกครอง', 'หนึ่งคนมีได้หนึ่งบัญชีต่อหนึ่งเบอร์มือถือ ข้อมูลที่ให้ไว้ต้องเป็นความจริงและเป็นปัจจุบัน', 'คุณต้องเก็บรหัส OTP และอุปกรณ์ของคุณให้ปลอดภัย และรับผิดชอบการใช้งานที่เกิดขึ้นในบัญชีของคุณ'])],
    ['แสตมป์และรางวัล', ul([
      'สะสมได้ร้านละ 1 แสตมป์ต่อวัน เว้นแต่ร้านจัดโปรโมชัน เช่น แสตมป์ x2',
      'ร้านค้าที่เข้าร่วมแต่ละร้านกำหนดบัตร รางวัล โปรโมชัน และสิทธิ์สมาชิกของตนเอง และอาจเปลี่ยนแปลงหรือยกเลิกได้',
      'การแลกรางวัลต้องทำต่อหน้าพนักงานร้านโดยใช้รหัส 4 หลัก',
      'แสตมป์และรางวัลไม่มีมูลค่าเป็นเงิน แลกเป็นเงินสดไม่ได้ และโอนหรือขายต่อไม่ได้',
      'สินค้าและบริการเป็นของร้านค้าที่เข้าร่วม ซึ่งรับผิดชอบต่อคุณภาพของสินค้าและบริการนั้น บริษัทไม่ได้เป็นคู่สัญญาในการซื้อขายระหว่างคุณกับร้านค้า',
    ])],
    ['เลเวล ระดับสมาชิก และ Badge', '<p>XP เลเวล ระดับสมาชิก และ Badge คำนวณโดยระบบจากกิจกรรมจริงของคุณ บริษัทอาจปรับวิธีคำนวณเพื่อความเป็นธรรม ส่วนสิทธิประโยชน์ของแต่ละระดับกำหนดโดยร้านค้าที่เข้าร่วม</p>'],
    ['รีวิวและเนื้อหาของผู้ใช้', ul(['รีวิวได้เฉพาะลูกค้าที่เคยมาร้านจริง รีวิวต้องตรงความจริง สุภาพ และมาจากประสบการณ์ของคุณเอง', 'คุณยังเป็นเจ้าของรีวิวของคุณ และอนุญาตให้บริษัทและร้านค้าแสดงรีวิวนั้นในบริการ', 'บริษัทอาจลบเนื้อหาที่ไม่เป็นความจริง หยาบคาย ผิดกฎหมาย ละเมิดสิทธิผู้อื่น หรือไม่เกี่ยวข้อง'])],
    ['ข้อห้ามในการใช้งาน', ul(['เก็บแสตมป์โดยไม่ได้ไปร้านจริง หรือแชร์ คัดลอก หรือนำลิงก์และ QR ของสแตนด์ไปใช้ซ้ำ', 'ใช้บอท สคริปต์ หรือหลายบัญชี หรือรบกวนการทำงานของบริการ', 'แอบอ้างเป็นผู้อื่นหรือใช้ข้อมูลของผู้อื่น', 'ทำวิศวกรรมย้อนกลับหรือคัดลอกบริการ'])],
    ['การระงับและยกเลิกบัญชี', '<p>บริษัทอาจลบแสตมป์หรือรางวัลที่ได้มาโดยไม่ถูกต้อง และระงับหรือปิดบัญชีที่ฝ่าฝืนข้อกำหนดนี้ คุณลบบัญชีได้ทุกเมื่อที่หน้าโปรไฟล์ โดยแสตมป์และรางวัลที่ยังไม่ได้แลกจะสิ้นสุดลง</p>'],
    ['ทรัพย์สินทางปัญญา', '<p>ชื่อ D Point โลโก้ มาสคอต การออกแบบ และซอฟต์แวร์เป็นของบริษัทหรือผู้อนุญาตให้ใช้สิทธิ ชื่อร้านและภาพบนบัตรเป็นของร้านค้าแต่ละราย</p>'],
    ['การให้บริการและข้อจำกัดความรับผิด', '<p>บริษัทพยายามให้บริการได้อย่างต่อเนื่อง แต่ให้บริการ “ตามสภาพ” และอาจเปลี่ยนแปลง หยุดชั่วคราว หรือยุติฟีเจอร์บางส่วนได้ เท่าที่กฎหมายอนุญาต บริษัทไม่ต้องรับผิดต่อความเสียหายทางอ้อม การกระทำของร้านค้าที่เข้าร่วม หรือการหยุดชะงักที่อยู่นอกเหนือการควบคุมตามสมควรของบริษัท</p>'],
    ['การเปลี่ยนแปลงข้อกำหนด', '<p>บริษัทอาจปรับปรุงข้อกำหนดนี้ วันที่มีผลบังคับใช้ด้านบนแสดงฉบับล่าสุด การใช้บริการต่อหลังการเปลี่ยนแปลงถือว่าคุณยอมรับข้อกำหนดฉบับใหม่</p>'],
    ['กฎหมายที่ใช้บังคับ', '<p>ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย และให้ศาลไทยมีเขตอำนาจในการพิจารณาข้อพิพาท</p>'],
    ['ช่องทางติดต่อ', `<p><b>${COMPANY.th}</b><br>ผู้ให้บริการ D Point<br>อีเมล: ${mail}</p>`],
  ]);
}
