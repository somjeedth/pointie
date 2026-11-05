// Stamp & reward flows: Tap/collect (1, 1b, E1, E2), Offline (E6), Store (3),
// Redeem (C2/C3), Level up (C4).
import { icon } from './icons.js';
import {
  esc, go, toast, bigStampCard, starsHtml, sheet, fireworks, playFireworks, cardBg, cardBgStyle, letterHtml, cardEn, stampGrid,
} from './ui.js';
import { shopById, CAT, SAMPLE_REVIEWS, MISSIONS, XP, levelTitle, unlocksFor, tierFor, tierById, GENS, GEN_ORDER, GEN_MIN_REVIEWS, genEmoji, genMood } from './data.js';
import { loadEvents } from './catalog.js';
import {
  store, collectStamp, cardFor, canStampToday, untilMidnight, missionProgress, isDoubleDay, setPendingTap, pendingTap, clearPendingTap,
  hasVisited, myReview, addReview, toggleFav, redeem as doRedeem, thMonthYear, agoText, thDateTime, takeLevelUp, peekLevelUp, isRemote,
} from './store.js';
import { returnTo } from './screens-onboard.js';
import { openText, mapsUrl } from './screens-main.js';

const brandBar = () => `<div class="topbar"><div class="brand"><img src="img/app-icon.png" alt="">Pointie</div><div class="nfc-ok">แตะ NFC สำเร็จ</div></div>`;

// ================= TAP / COLLECT =================
let tapResult = null; // { shopId, res }
const standOffShops = new Set(); // shops whose stand link the server rejected this session
export function tap({ id }, query) {
  const shop = shopById(id);
  if (!shop) { toast('ไม่พบร้านนี้'); go('/home'); return { html: '' }; }
  const me = store.me;

  // E2 — tapped while signed out
  if (!me) {
    returnTo.set('/tap/' + id);
    return {
      html: `${brandBar()}
        <div style="position:relative;margin:4px 6px 0">
          <div style="border-radius:22px;overflow:hidden;transform:rotate(-4deg);opacity:.85">${bigStampCard(shop, 0).replace('class="stampcard"', 'class="stampcard" style="min-height:220px"')}</div>
          <img src="img/pointie-point.png" alt="" style="position:absolute;right:-6px;bottom:-30px;height:150px">
        </div>
        <div class="col center" style="gap:6px;margin-top:20px"><h1 class="h1" style="font-size:24px">เข้าสู่ระบบเพื่อรับแสตมป์</h1><p class="muted">ใช้เบอร์มือถือ ไม่ต้องโหลดแอพ<br>ใช้เวลาไม่ถึง 1 นาที</p></div>
        <div class="card col">${['สะสมแสตมป์ทุกร้านในบัตรเดียว', 'ได้ XP ทำภารกิจ ปลดล็อก Badge', 'แลกรางวัลได้ทันทีเมื่อครบ'].map((t) => `<div class="row small" style="gap:10px"><span class="green">${icon('check', 18, 2.6)}</span>${t}</div>`).join('')}</div>
        <div class="col spacer"><a class="btn btn-primary" href="#/login">เข้าสู่ระบบ / สมัครด้วยเบอร์มือถือ</a><p class="center xs muted">เข้าสู่ระบบแล้วจะกลับมาที่หน้านี้อัตโนมัติ</p></div>`,
    };
  }

  const standTok = query.get('s');
  const stand = standTok && shop.stands.find((x) => x.token === standTok);
  // Remote mode: the server checks the stand when stamping (tokens are never sent to the browser).
  if (standOffShops.has(`${id}|${standTok}`) || (standTok && !isRemote() && (!stand || !stand.active))) {
    return { html: `${brandBar().replace('nfc-ok', 'nfc-ok" style="color:var(--red)')}<div class="col center" style="align-items:center;gap:10px;margin-top:40px"><img src="img/pointie-wow.png" alt="" style="height:140px"><h1 class="h1" style="font-size:22px">สแตนด์นี้ปิดใช้งานแล้ว</h1><p class="muted small">ลองแตะสแตนด์อื่นของ ${esc(shop.name)} หรือแจ้งพนักงานร้าน</p></div><a class="btn btn-primary spacer" href="#/home">กลับหน้าแรก</a>` };
  }
  const justDone = tapResult && tapResult.shopId === id ? tapResult.res : null;
  const card = cardFor(id);
  const need = shop.card.need;

  // E1 — already stamped today
  if (!justDone && card && !canStampToday(id)) {
    return {
      html: `${brandBar()}
        <div class="stampcard-wrap">${bigStampCard(shop, card.have, { todayIdx: card.have, foot: `ครั้งที่ ${card.visits}` })}</div>
        <div class="card row" style="align-items:flex-start;gap:10px">
          <img src="img/pointie-wink.png" alt="" style="height:72px;margin-top:-20px">
          <div class="col" style="gap:4px"><b style="font-size:17px">วันนี้รับแสตมป์ร้านนี้แล้ว</b><span class="small muted">ร้านละ 1 ดวงต่อวัน กลับมาใหม่ได้อีกใน <b class="accent">${untilMidnight()}</b></span></div>
        </div>
        <div class="btns spacer"><a class="btn btn-ghost" href="#/store/${id}?review=1">เขียนรีวิว</a><a class="btn btn-primary grow" href="#/home">ดูภารกิจอื่น</a></div>`,
    };
  }

  // Card already full — must redeem first
  if (!justDone && card && card.have >= need) {
    return {
      html: `${brandBar()}
        <div class="stampcard-wrap"><img class="peek" src="img/pointie-cheer.png" alt="">${bigStampCard(shop, card.have, { foot: `ครั้งที่ ${card.visits}` })}</div>
        <div class="card-soft col" style="gap:4px"><b style="font-size:17px">บัตรครบ ${need} ดวงแล้ว!</b><span class="small muted">แลก${esc(shop.card.reward)}ก่อน แล้วเริ่มสะสมใบใหม่ได้เลย</span></div>
        <div class="btns spacer"><a class="btn btn-ghost" href="#/home">ไว้ทีหลัง</a><a class="btn btn-primary grow" href="#/redeem/${id}">แลกรางวัล</a></div>`,
    };
  }

  const have = justDone ? justDone.have : card?.have || 0;
  const visits = justDone ? justDone.visits : (card?.visits || 0) + 1;
  const stampMission = MISSIONS.find((m) => m.id === 'stamp5');
  const mp = Math.min(stampMission.goal, missionProgress('stamp5'));
  const dbl = isDoubleDay(shop);

  if (justDone) {
    const r = justDone;
    const full = r.full;
    const nextHref = full ? `#/redeem/${id}` : peekLevelUp() ? '#/levelup' : !me.user.prefsDone && !me.user.prefsAsked ? '#/invite' : '#/home';
    return {
      html: `${brandBar()}
        <div class="stampcard-wrap">${bigStampCard(shop, have, { newIdx: have, foot: `ครั้งที่ ${visits}` })}</div>
        <div class="row" style="position:relative;gap:10px;padding:8px 14px 8px 8px;border-radius:18px;background:var(--soft);border:1px solid var(--soft-line)">
          <img src="img/pointie-jump.png" alt="Pointie กระโดดดีใจ" style="height:72px;margin-top:-26px;flex:none">
          <div class="col" style="gap:4px;flex:1;min-width:0">
            <b style="font-size:18px">${r.isNewShop && Object.keys(me.cards).length === 1 ? 'ได้แสตมป์แรกแล้ว!' : 'ได้แสตมป์แล้ว!'}</b>
            <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill primary">+${r.added} แสตมป์${r.added - (r.tierBonus || 0) > 1 ? ' (x2)' : ''}</span>${r.tierBonus ? `<span class="pill teal">โบนัส ${tierFor(me.user.lv).name} +${r.tierBonus}</span>` : ''}<span class="pill violet">+${XP.stamp} XP</span><span class="pill dark">ภารกิจ ${mp}/${stampMission.goal}</span></div>
            ${r.missions.length ? `<span class="xs semi green">ภารกิจสำเร็จ: ${r.missions.map((m) => esc(m.title)).join(', ')}</span>` : ''}
            ${r.badges.length ? `<span class="xs semi accent">ได้ Badge: ${r.badges.map((b) => esc(b.name)).join(', ')}</span>` : ''}
          </div>
        </div>
        <div class="btns spacer">
          ${full ? `<a class="btn btn-ghost" href="#/home">ไว้ทีหลัง</a><a class="btn btn-primary grow" href="${nextHref}">แลกรางวัลเลย!</a>`
            : `<a class="btn btn-ghost" href="#/store/${id}?review=1">เขียนรีวิว</a><a class="btn btn-primary grow" href="${nextHref}">ไปหน้าแรก</a>`}
        </div>`,
      leave() { tapResult = null; },
    };
  }

  let busy = false;
  const collect = async (btn) => {
    if (busy) return;
    if (!navigator.onLine) { setPendingTap(id); go('/offline/' + id); return; }
    busy = true;
    const b = btn instanceof Element ? btn : document.querySelector('[data-act="collect"]');
    if (b) { b.disabled = true; b.querySelector('span:last-child').textContent = 'กำลังบันทึก…'; }
    const res = await collectStamp(id, standTok);
    busy = false;
    if (!res.ok) {
      if (res.reason === 'offline') { setPendingTap(id); go('/offline/' + id); return; }
      if (res.reason === 'stand_off') standOffShops.add(`${id}|${standTok}`);
      else if (res.reason === 'already') toast('วันนี้รับแสตมป์ร้านนี้แล้ว');
      else if (res.reason === 'full') toast('บัตรครบแล้ว แลกรางวัลก่อนนะ');
      else toast('บันทึกแสตมป์ไม่สำเร็จ ลองใหม่อีกครั้ง');
      window.dispatchEvent(new Event('rerender'));
      return;
    }
    clearPendingTap();
    tapResult = { shopId: id, res };
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    window.dispatchEvent(new Event('rerender'));
  };

  return {
    html: `${brandBar()}
      <div class="stampcard-wrap"><img class="peek" src="img/pointie-wink.png" alt="">${bigStampCard(shop, have, { foot: `ครั้งที่ ${visits}` })}</div>
      ${dbl ? '<div class="card-soft row small semi" style="padding:10px 14px">' + icon('sparkle', 18) + 'วันนี้แสตมป์ x2 ที่ร้านนี้!</div>' : ''}
      <div class="card" style="padding:10px 14px"><div class="col" style="gap:6px">
        <div class="between small"><span class="semi">ภารกิจ: สะสมแสตมป์ ${stampMission.goal} ดวงสัปดาห์นี้</span><span class="bold accent">${mp}/${stampMission.goal}</span></div>
        <div class="bar" style="height:6px"><i style="width:${(mp / stampMission.goal) * 100}%"></i></div>
      </div></div>
      <div class="spacer"><button class="btn btn-primary btn-lg" data-act="collect">${icon('star', 22)}<span>รับแสตมป์</span></button></div>`,
    mount() { if (query.get('auto') === '1') { history.replaceState(null, '', '#/tap/' + id); collect(); } },
    actions: { collect },
  };
}

// ================= OFFLINE (E6) =================
let offTimer;
export function offline({ id }) {
  const shop = shopById(id);
  const pt = pendingTap();
  if (!shop || !pt) { go(shop ? '/tap/' + id : '/home'); return { html: '' }; }
  return {
    html: `<div class="offline-banner" role="status">${icon('wifiOff', 18)}ไม่มีการเชื่อมต่ออินเทอร์เน็ต</div>
      <div class="halo" style="margin-top:30px"><img src="img/pointie-wow.png" alt=""></div>
      <div class="col center" style="gap:8px"><h1 class="h1" style="font-size:24px">เน็ตหลุดนิดนึง</h1>
        <p class="muted small">แตะที่ <b style="color:var(--ink)">${esc(shop.name)}</b> แล้ว แต่ยังบันทึกแสตมป์ไม่ได้<br>เชื่อมต่อเน็ตแล้วกดลองใหม่ ไม่ต้องแตะซ้ำ</p></div>
      <span class="timer-pill">${icon('clock', 14)}การแตะนี้ยังใช้ได้อีก <b id="left">--:--</b> นาที</span>
      <div class="col spacer"><button class="btn btn-primary" data-act="retry">${icon('refresh', 18)}ลองใหม่</button><a class="btn btn-ghost" href="#/cards">ดูบัตรของฉัน (ข้อมูลล่าสุด)</a></div>`,
    mount(root) {
      const el = root.querySelector('#left');
      const tick = () => {
        const ms = Math.max(0, pt.at + 10 * 60000 - Date.now());
        el.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
        if (!ms) { clearInterval(offTimer); clearPendingTap(); toast('การแตะหมดอายุแล้ว แตะสแตนด์ใหม่อีกครั้งนะ'); go('/scan'); }
      };
      tick(); clearInterval(offTimer); offTimer = setInterval(tick, 1000);
      const online = () => go(`/tap/${id}?auto=1`);
      window.addEventListener('online', online);
      return () => { clearInterval(offTimer); window.removeEventListener('online', online); };
    },
    actions: { retry() { if (navigator.onLine) go(`/tap/${id}?auto=1`); else toast('ยังไม่มีอินเทอร์เน็ต ลองเชื่อมต่อ Wi-Fi หรือเน็ตมือถือ'); } },
  };
}

// ================= STORE =================
// "แต่ละเจนว่ายังไง": average review score per generation (from sign-up birth dates).
function genStats(s) {
  if (Array.isArray(s.gens)) return s.gens; // server (Supabase)
  const acc = {}; // local demo: demo review events that carry a generation
  for (const e of loadEvents()) {
    if (e.shopId !== s.id || e.type !== 'review' || !e.gen) continue;
    (acc[e.gen] ||= { gen: e.gen, n: 0, sum: 0 }).n++; acc[e.gen].sum += e.stars;
  }
  return Object.values(acc).map((g) => ({ gen: g.gen, n: g.n, avg: Math.round((g.sum / g.n) * 10) / 10 }));
}
function genSection(s) {
  const stats = genStats(s);
  if (!stats.length) return '';
  const by = Object.fromEntries(stats.map((g) => [g.gen, g]));
  const rows = GEN_ORDER.filter((k) => k !== 'alpha' || by[k]).map((k) => {
    const g = by[k]; const ok = g && g.n >= GEN_MIN_REVIEWS;
    return `<div class="gen-row ${ok ? '' : 'few'}"><span class="gen-emoji" aria-hidden="true">${ok ? genEmoji(g.avg) : '·'}</span>
      <div class="col" style="gap:0;flex:1"><b>${GENS[k].name}</b><span class="xs muted">เกิด ${GENS[k].years}</span></div>
      ${ok ? `<div class="col" style="gap:0;align-items:flex-end"><b>${g.avg.toFixed(1)} <span class="xs muted" style="font-weight:500">${genMood(g.avg)}</span></b><span class="xs muted">${g.n} รีวิว</span></div>` : '<span class="xs muted">รีวิวยังน้อย</span>'}</div>`;
  }).join('');
  return `<section class="col"><div class="section-h"><h2>แต่ละเจนว่ายังไง</h2></div>
    <div class="card gens">${rows}</div>
    <p class="xs muted">คิดจากรีวิวของคนที่มาจริง แยกตามปีเกิดที่ลงทะเบียน (แสดงเมื่อมี ${GEN_MIN_REVIEWS} รีวิวขึ้นไป · ไม่ระบุตัวตน)</p></section>`;
}
let reviewDraft = { stars: 0, text: '' };
export function storePage({ id }, query) {
  const s = shopById(id);
  if (!s) { go('/home'); return { html: '' }; }
  const me = store.me; const c = cardFor(id); const k = s.card;
  const fav = me.favs.includes(id);
  const mine = myReview(id);
  // Remote catalogue carries the public reviews (real + sample, with shop replies); local demo uses samples.
  const others = Array.isArray(s.reviews)
    ? s.reviews.filter((r) => !(me.remoteId && r.customerId === me.remoteId)).map((r) => ({ initial: (r.nick || '?')[0], name: r.nick || 'ลูกค้า', lv: r.lv || 1, ago: agoText(String(r.at).slice(0, 10)), stars: r.stars, text: r.text, reply: r.reply }))
    : (SAMPLE_REVIEWS[id] || []).map((r, i) => ({ ...r, reply: s.replies?.['sample:' + i] }));
  const left = k.need - (c?.have || 0);
  const tags = s.tags.map(([l, n, pos]) => `<span class="pill ${pos ? 'green' : 'soft'}" style="font-size:13px;padding:6px 12px;font-weight:600">${l} · ${n}</span>`).join('');
  const replyHtml = (text) => text ? `<div class="card-soft" style="padding:10px 12px;border-radius:12px"><span class="xs bold accent">ร้านตอบกลับ</span><p class="small">${esc(text)}</p></div>` : '';
  const reviewItem = (r, isMine) => `<div class="card review">
      <div class="row" style="gap:10px"><span class="initials sm" style="border-radius:50%">${esc(r.initial)}</span>
        <div class="col" style="gap:0;flex:1"><span><b>${esc(r.name)}</b> <span class="pill violet" style="font-size:11px;padding:0 6px">Lv.${esc(r.lv)}</span>${isMine ? ' <span class="pill soft" style="font-size:11px;padding:0 6px">ของฉัน</span>' : ''}</span>
        <span class="xs muted">${esc(r.ago)}${r.visits ? ` · มาแล้ว ${r.visits} ครั้ง` : ''}</span></div><span class="real">${icon('check', 11, 3)}ไปจริง</span></div>
      ${starsHtml(r.stars)}<p class="small">${esc(r.text)}</p>${replyHtml(r.reply)}</div>`;
  const open = openText(s);
  const html = `
    <div class="cover ${cardBg(k)}" style="${cardBgStyle(k)}">
      <span>[รูปปกร้าน]</span>
      <div class="tb"><a class="icon-btn" href="#/back" data-act="back" aria-label="ย้อนกลับ">${icon('back')}</a><span style="flex:1"></span>
        <button class="icon-btn ${fav ? 'fav' : ''}" data-act="fav" aria-pressed="${fav}" aria-label="บันทึกเป็นร้านโปรด">${icon(fav ? 'heart' : 'heart', 20)}</button>
        <button class="icon-btn" data-act="share" aria-label="แชร์ร้าน">${icon('share')}</button></div>
    </div>
    <div class="store-body">
      <div class="store-head">
        <div class="row"><span class="initials" style="${cardBgStyle(k)}${k.photo ? 'background:#2E3A33;' : ''}color:${k.letter}">${s.initials}</span>
          <div class="col" style="gap:2px"><h1 style="font-size:20px">${esc(s.name)}</h1><span class="small muted">${CAT[s.cat].label} · ${s.area} · ${s.dist}</span></div></div>
        <div class="row small" style="gap:10px;flex-wrap:wrap"><span class="row semi" style="gap:4px"><span style="color:var(--gold)">${icon('star', 16)}</span>${s.rating} <span class="muted" style="font-weight:400">(${s.reviewsCount + (mine ? 1 : 0)} รีวิว)</span></span>
          <span class="row semi ${open === 'เปิดอยู่' ? 'green' : ''}" style="gap:4px;${open === 'เปิดอยู่' ? '' : 'color:var(--red)'}"><span style="width:8px;height:8px;border-radius:50%;background:currentColor"></span>${open}</span>
          <span class="muted">ปิด ${String(Math.floor(s.closeAt)).padStart(2, '0')}:${s.closeAt % 1 ? '30' : '00'}</span></div>
      </div>
      ${c ? `<div class="visits-card">
          <div class="between"><span class="xs semi">คุณมาร้านนี้แล้ว</span><span class="xs semi" style="text-align:right">ครั้งแรก ${thMonthYear(c.first)}<br>ล่าสุด ${agoText(c.last)}</span></div>
          <div class="big">${c.visits} <span style="font-size:16px">ครั้ง</span></div>
          <div class="segbar">${Array.from({ length: k.need }, (_, i) => `<i class="${i < c.have ? 'f' : ''}"></i>`).join('')}</div>
          <div class="between small semi"><span>${c.have}/${k.need} · ${left > 0 ? `อีก ${left} ดวง รับ${esc(k.reward)}` : `ครบแล้ว! แลก${esc(k.reward)}`}</span><a class="btn btn-sm" style="height:32px;background:var(--on-primary);color:var(--primary)" href="#/cards?shop=${id}">ดูบัตร</a></div>
        </div>` : `<div class="card-soft col" style="gap:4px"><b>ยังไม่เคยมาร้านนี้</b><span class="small muted">แตะ NFC ที่สแตนด์หน้าร้านเพื่อรับแสตมป์แรก · ครบ ${k.need} ดวงรับ${esc(k.reward)}</span></div>`}
      <section class="col">
        <h2 class="h2">ข้อมูลร้าน</h2>
        <div class="card" style="padding:12px 14px">
          <div class="mapmini" aria-hidden="true">
            <div class="m" style="position:absolute;left:0;right:0;top:60px;height:10px;background:var(--map-main)"></div>
            <div class="m" style="position:absolute;top:0;bottom:0;left:30%;width:8px;background:var(--map-road)"></div>
            <div class="m" style="position:absolute;top:0;bottom:0;left:70%;width:12px;background:var(--map-water)"></div>
            <span style="position:absolute;left:50%;top:44px;transform:translate(-50%,-50%);color:var(--primary)">${icon('pin', 36)}</span>
            <a class="btn btn-sm" style="position:absolute;right:10px;bottom:10px;height:32px;background:var(--surface);color:var(--ink);border:1px solid var(--line)" href="${mapsUrl(s)}" target="_blank" rel="noopener">${icon('nav', 14)}นำทาง</a>
          </div>
          <div class="info-row" style="border-top:0;margin-top:6px"><span class="muted">${icon('clock', 18)}</span><div class="col" style="gap:0"><span class="small">${s.hours}</span><span class="xs muted">${s.closed}</span></div></div>
          <div class="info-row"><span class="muted">${icon('pin', 18)}</span><span class="small">${esc(s.address)}</span></div>
          <a class="info-row" href="tel:${s.phone.replace(/\s/g, '')}" style="text-decoration:none"><span class="muted">${icon('phone', 18)}</span><span class="small">${s.phone}</span></a>
        </div>
      </section>
      <section class="col">
        <h2 class="h2">คนพูดถึงร้านนี้ยังไง</h2>
        <div class="card col">
          <div class="row" style="gap:16px"><div class="col center" style="gap:2px;align-items:center"><span class="rating-big">${s.rating}</span>${starsHtml(s.rating, 12)}<span class="xs muted">${s.reviewsCount} รีวิว</span></div>
            <div class="col" style="flex:1;gap:4px">${s.dist5.map((p, i) => `<div class="dist-row"><span>${5 - i}</span><div class="bar"><i style="width:${p}%"></i></div></div>`).join('')}</div></div>
          <div class="ai-sum"><div class="row" style="gap:8px"><img src="img/pointie-point.png" alt=""><span class="xs bold accent">Pointie สรุปจากรีวิวของคนที่ไปจริง</span></div><p class="small">${esc(s.summary)}</p></div>
          <div class="row" style="flex-wrap:wrap;gap:6px">${tags}</div>
        </div>
      </section>
      ${genSection(s)}
      <section class="col">
        <div class="section-h"><h2>รูปจากลูกค้า</h2><span class="link">ทั้งหมด ${s.photos}</span></div>
        <div class="photos">${['[รูป]', '[รูป]', '[รูป]', '[รูป]', '[รูป]', '+' + (s.photos - 5)].map((l) => `<div>${l}</div>`).join('')}</div>
      </section>
      <section class="col">
        <div class="section-h"><h2>รีวิวล่าสุด</h2></div>
        ${mine ? reviewItem({ initial: (me.user.nick || '?')[0], name: me.user.nick, lv: me.user.lv, ago: agoText(mine.date), visits: c?.visits || 1, stars: mine.stars, text: mine.text, reply: mine.reply ?? s.replies?.[me.phone] }, true) : ''}
        ${others.map((r) => reviewItem(r, false)).join('')}
      </section>
      ${s.tierPromo?.active && s.tierPromo.text ? (() => {
        const t = tierById(s.tierPromo.minTier); const ok = me.user.lv >= t.min;
        return `<section class="col"><h2 class="h2">โปรสำหรับสมาชิก</h2>
        <div class="tier-promo" style="--tc:${t.color}"><span class="tp-badge">${t.name}+</span>
          <div class="col" style="gap:2px;flex:1"><b>${esc(s.tierPromo.text)}</b>
          <span class="xs ${ok ? 'green' : 'muted'}">${ok ? `คุณใช้สิทธิ์ได้ · แสดงบัตรสมาชิก (หน้าโปรไฟล์) กับพนักงาน` : `ถึงระดับ ${t.name} (Lv.${t.min}) เพื่อปลดล็อก · ตอนนี้ Lv.${me.user.lv}`}</span></div>
          ${ok ? icon('checkCircle', 22) : icon('lock', 20)}</div></section>`;
      })() : ''}
      ${s.promo || s.event ? `<section class="col"><h2 class="h2">โปรและกิจกรรม</h2>
        ${s.promo ? `<div class="card row"><span class="tag" style="background:var(--soft);color:var(--accent)">โปร</span><span class="semi" style="flex:1">${esc(s.promoText)}</span><span class="xs muted">${s.promoUntil}</span></div>` : ''}
        ${s.event ? `<div class="card row"><span class="tag" style="background:var(--teal-soft);color:var(--teal)">กิจกรรม</span><span class="semi" style="flex:1">${esc(s.event.title)}</span><span class="xs muted">${s.event.when}</span></div>` : ''}</section>` : ''}
    </div>
    <div class="sticky-cta">
      <button class="btn btn-ghost" data-act="review">${icon('edit', 18)}${mine ? 'แก้ไขรีวิว' : 'เขียนรีวิว'}</button>
      ${c ? `<a class="btn btn-primary grow" href="#/cards?shop=${id}">ดูบัตรสะสมแต้ม</a>` : `<a class="btn btn-primary grow" href="#/tap/${id}">แตะรับแสตมป์ (เดโม)</a>`}
    </div>`;

  const openReview = () => {
    if (!hasVisited(id)) { toast('รีวิวได้เฉพาะร้านที่ไปจริง แตะรับแสตมป์ที่ร้านก่อนนะ'); return; }
    reviewDraft = mine ? { stars: mine.stars, text: mine.text } : { stars: 0, text: '' };
    const draw = () => `<div class="col center" style="gap:4px"><h2 class="h2">รีวิว ${esc(s.name)}</h2><span class="real" style="align-self:center">${icon('check', 11, 3)}ไปจริง ${c?.visits || 1} ครั้ง</span></div>
      <div class="star-input" id="starIn">${[1, 2, 3, 4, 5].map((n) => `<button data-act="star" data-n="${n}" class="${n <= reviewDraft.stars ? 'on' : ''}" aria-label="${n} ดาว">${icon('star', 36)}</button>`).join('')}</div>
      <textarea class="ta" id="revText" maxlength="500" placeholder="เล่าให้เพื่อนฟังหน่อย ชอบอะไร ควรสั่งอะไร">${esc(reviewDraft.text)}</textarea>
      ${mine ? '' : `<p class="center small"><span class="pill violet">+${XP.review} XP</span> เมื่อส่งรีวิว</p>`}
      <button class="btn btn-primary" data-act="submitReview" id="revSubmit" ${reviewDraft.stars ? '' : 'disabled'}>ส่งรีวิว</button>`;
    document.querySelector('.app').insertAdjacentHTML('beforeend', sheet(draw(), { id: 'reviewSheet' }));
    const ta = document.getElementById('revText');
    ta.addEventListener('input', () => { reviewDraft.text = ta.value; });
  };

  return {
    cls: 'flush',
    html,
    mount() { if (query.get('review') === '1') { history.replaceState(null, '', '#/store/' + id); setTimeout(openReview, 250); } },
    actions: {
      back() { if (history.length > 2) history.back(); else go('/home'); },
      fav() { const on = toggleFav(id); toast(on ? 'บันทึกเป็นร้านโปรดแล้ว' : 'เอาออกจากร้านโปรดแล้ว'); window.dispatchEvent(new Event('rerender')); },
      async share() {
        const url = `${location.origin}${location.pathname}#/store/${id}`;
        try {
          if (navigator.share) await navigator.share({ title: s.name, text: `${s.name} บน Pointie`, url });
          else { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์ร้านแล้ว'); }
        } catch { /* cancelled */ }
      },
      review: openReview,
      star(el) {
        reviewDraft.stars = +el.dataset.n;
        document.querySelectorAll('#starIn button').forEach((b) => b.classList.toggle('on', +b.dataset.n <= reviewDraft.stars));
        document.getElementById('revSubmit').disabled = false;
      },
      async submitReview(el) {
        const text = reviewDraft.text.trim();
        if (!reviewDraft.stars) return;
        if (text.length < 5) { toast('เขียนอีกนิดนะ อย่างน้อย 5 ตัวอักษร'); return; }
        el.disabled = true; el.textContent = 'กำลังส่ง…';
        const r = await addReview(id, reviewDraft.stars, text);
        if (!r.ok) { el.disabled = false; el.textContent = 'ส่งรีวิว'; toast(r.reason === 'not_visited' ? 'รีวิวได้เฉพาะร้านที่ไปจริง' : 'ส่งรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง'); return; }
        document.getElementById('reviewSheet')?.remove();
        toast(r.updated ? 'แก้ไขรีวิวแล้ว' : `ขอบคุณสำหรับรีวิว! +${XP.review} XP`);
        if (peekLevelUp()) go('/levelup'); else window.dispatchEvent(new Event('rerender'));
      },
    },
  };
}

// ================= REDEEM (C2 / C3) =================
let redeemPhase = 0; let redeemTimers = [];
let redeemInfo = null;
let redeemApply = () => {};
export function redeemPage({ id }) {
  const s = shopById(id); const c = cardFor(id);
  if (!s) { go('/cards'); return { html: '' }; }
  const k = s.card;
  const isDone = redeemInfo?.shopId === id;
  if (!isDone && (!c || c.have < k.need)) { toast('บัตรนี้ยังสะสมไม่ครบ'); go('/cards'); return { html: '' }; }
  const phase = redeemPhase;
  const have = isDone && phase >= 2 ? 0 : k.need;
  const confetti = Array.from({ length: 12 }, (_, i) => {
    const colors = ['#FFC83D', '#FF7A2E', '#A592FF', '#3CC7B2', '#F7F7F7', '#FF9A5C'];
    const w = i % 2 ? 10 : 14, h = i % 2 ? 10 : 6;
    return `<span class="cf" data-i="${i}" style="position:absolute;left:50%;top:200px;width:${w}px;height:${h}px;margin:-${h / 2}px 0 0 -${w / 2}px;border-radius:${i % 2 ? '50%' : '3px'};background:${colors[i % 6]};z-index:4;transform:scale(0);opacity:0;transition:transform .7s cubic-bezier(.1,.8,.3,1),opacity .6s"></span>`;
  }).join('');
  const slots = stampGrid(k, k.need).replace(/class="stamp /g, 'class="stamp rs ');
  return {
    html: `<div class="topbar"><a class="icon-btn" href="#/cards" aria-label="ย้อนกลับ">${icon('back')}</a><h1>แลกรางวัล</h1></div>
      <div style="position:relative;height:430px;flex:none">
        <img id="rPointie" src="img/pointie-cheer.png" alt="" style="position:absolute;right:-6px;top:-40px;height:104px;z-index:5;transition:transform .5s cubic-bezier(.2,1.6,.4,1) .15s,opacity .3s .15s;transform:translateY(60px) scale(.5);opacity:0">
        <div id="rCard" class="${cardBg(k)}" style="position:relative;height:100%;border-radius:26px;overflow:hidden;${cardBgStyle(k)}box-shadow:var(--shadow);transition:transform .18s ease-out;color:#fff;display:flex;flex-direction:column;padding:18px 16px 16px">
          <div class="between"><span class="xs bold" style="letter-spacing:.08em">${cardEn(k)}</span><span class="full-tag" id="rBadge" style="padding:2px 8px;border-radius:999px;background:#fff;color:#000;font-size:11px;font-weight:700">${isDone ? 'บัตรใบใหม่' : 'ครบแล้ว!'}</span></div>
          ${letterHtml(k, 44).replace('class="letter"', 'class="letter" style="margin-top:40px"')}
          <div id="rSlots" style="margin-top:auto">${isDone ? stampGrid(k, 0) : slots}</div>
          <div class="between small semi" style="margin-top:12px"><span><b style="font-size:16px" id="rHave">${have}</b>/${k.need}</span><span id="rCap">${isDone ? `อีก ${k.need} ดวง` : 'พร้อมแลก'}</span></div>
          <div id="rRubber" style="position:absolute;left:50%;top:140px;width:210px;margin-left:-105px;padding:12px 10px;border:4px solid #F6EEDF;border-radius:18px;color:#F6EEDF;background:rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;gap:4px;z-index:3;transition:transform .4s cubic-bezier(.2,1.5,.4,1),opacity .2s;transform:scale(2.6) rotate(-24deg);opacity:0">
            ${icon('checkCircle', 26)}<span style="font-family:Kanit,sans-serif;font-style:italic;font-weight:800;font-size:30px;line-height:1">แลกแล้ว</span><span class="xs semi">${redeemInfo ? thDateTime(redeemInfo.at) : ''}</span>
          </div>
        </div>
        ${confetti}
      </div>
      <div style="position:relative;flex:1;min-height:170px">
        <div id="askLayer" style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:16px;transition:opacity .25s,transform .25s;${isDone ? 'opacity:0;pointer-events:none' : ''}">
          <div class="card between"><div class="col" style="gap:0"><span class="xs muted">รางวัลของคุณ</span><b style="font-size:17px">${esc(k.reward)}</b></div><span class="xs muted" style="text-align:right">กดต่อหน้า<br>พนักงาน</span></div>
          <button class="btn btn-primary btn-lg" data-act="redeem">แลกรางวัล</button>
        </div>
        <div id="doneLayer" role="status" style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:12px;transition:opacity .4s,transform .4s cubic-bezier(.2,1.3,.4,1);opacity:0;transform:translateY(30px);pointer-events:none">
          <div class="card row" style="background:var(--green-soft);border-color:transparent"><span class="green">${icon('checkCircle', 28)}</span><div class="col" style="gap:0"><b>แลกสำเร็จ! ${esc(k.reward)}</b><span class="xs muted">ใช้ ${k.need} แสตมป์แล้ว · เริ่มสะสมใหม่ได้เลย</span></div></div>
          <div class="card between"><span class="small">รหัสยืนยันสำหรับพนักงาน</span><b id="rCode" style="font-size:26px;letter-spacing:.2em;color:var(--accent)">${redeemInfo?.code || '----'}</b></div>
          <a class="btn btn-primary" href="#/cards">กลับไปบัตรของฉัน</a>
        </div>
      </div>
      ${fireworks([{ x: 24, y: 210, c: '#FFC83D', d: 0.1 }, { x: 77, y: 170, c: '#A592FF', d: 0.32 }, { x: 51, y: 110, c: '#3CC7B2', d: 0.55, r: 86 }])}`,
    mount(root) {
      const apply = (ph) => {
        redeemPhase = ph;
        root.querySelectorAll('.rs').forEach((el, i) => {
          el.style.transition = `transform .35s cubic-bezier(.5,-0.4,.8,.4) ${i * 0.06}s, opacity .35s ${i * 0.06}s`;
          if (ph >= 1) { el.style.transform = 'scale(0) rotate(120deg)'; el.style.opacity = 0; }
        });
        const hit = ph >= 2;
        if (hit) {
          root.querySelector('#rSlots').innerHTML = stampGrid(k, 0);
          root.querySelector('#rHave').textContent = '0';
          root.querySelector('#rBadge').textContent = 'บัตรใบใหม่';
          root.querySelector('#rCap').textContent = `อีก ${k.need} ดวง`;
          root.querySelector('#rRubber').style.cssText += ';transform:scale(1) rotate(-12deg);opacity:1';
          root.querySelector('#rPointie').style.cssText += ';transform:none;opacity:1';
          root.querySelector('#rCard').style.transform = ph === 2 ? 'scale(.97)' : 'scale(1)';
          root.querySelectorAll('.cf').forEach((el) => {
            const i = +el.dataset.i; const ang = (i / 12) * Math.PI * 2; const dist = 120 + (i % 3) * 40;
            const dx = Math.round(Math.cos(ang) * dist), dy = Math.round(Math.sin(ang) * dist * 0.8);
            el.style.transform = `translate(${dx}px,${dy + (ph >= 3 ? 40 : 0)}px) rotate(${i * 47}deg) scale(1)`;
            el.style.opacity = ph >= 3 ? 0 : 1;
          });
        }
        const ask = root.querySelector('#askLayer');
        if (ph >= 1) { ask.style.opacity = 0; ask.style.transform = 'translateY(20px)'; ask.style.pointerEvents = 'none'; }
        const done = root.querySelector('#doneLayer');
        if (ph >= 3) { done.style.opacity = 1; done.style.transform = 'none'; done.style.pointerEvents = 'auto'; }
        playFireworks(root, ph);
      };
      if (isDone) { root.querySelector('#rRubber').style.cssText += ';transform:scale(1) rotate(-12deg);opacity:1'; root.querySelector('#rPointie').style.cssText += ';transform:none;opacity:1'; apply(3); }
      redeemApply = apply;
      return () => { redeemTimers.forEach(clearTimeout); };
    },
    actions: {
      async redeem(el) {
        if (!confirm(`ยืนยันแลก "${k.reward}" ต่อหน้าพนักงาน?`)) return;
        el.disabled = true;
        const res = await doRedeem(id);
        if (!res) { el.disabled = false; toast('แลกไม่สำเร็จ ลองใหม่อีกครั้ง'); return; }
        redeemInfo = { shopId: id, at: new Date().toISOString(), code: res.code };
        document.getElementById('rCode').textContent = res.code;
        document.querySelector('#rRubber span.xs').textContent = thDateTime(redeemInfo.at);
        const apply = redeemApply;
        apply(1);
        redeemTimers = [setTimeout(() => apply(2), 700), setTimeout(() => apply(3), 1900)];
        if (navigator.vibrate) navigator.vibrate([20, 60, 80]);
      },
    },
    leave() { redeemTimers.forEach(clearTimeout); redeemPhase = 0; redeemInfo = null; },
  };
}

// ================= LEVEL UP (C4) =================
let lvTimers = [];
let lvData = null;
export function levelup() {
  if (!lvData) lvData = takeLevelUp();
  const d = lvData;
  if (!d) { go('/home'); return { html: '' }; }
  const unlocks = unlocksFor(d.to);
  const pct = Math.round((d.xp / d.need) * 100);
  return {
    cls: 'celebrate',
    html: `<div style="position:absolute;left:50%;top:140px;width:520px;height:520px;margin-left:-260px;border-radius:50%;background:radial-gradient(circle,rgba(255,122,46,.38) 0%,rgba(255,122,46,.1) 40%,rgba(0,0,0,0) 68%);transition:transform .6s ease-out,opacity .6s;transform:scale(.3);opacity:0" id="lvGlow"></div>
      <div class="topbar" style="width:100%;position:relative;z-index:3"><span></span><a class="icon-btn" href="#/home" aria-label="ปิด">${icon('close')}</a></div>
      <img id="lvP" src="img/pointie-cheer.png" alt="Pointie ฉลอง" style="height:200px;position:relative;z-index:2;transition:transform .6s cubic-bezier(.2,1.6,.4,1),opacity .3s;transform:translateY(80px) scale(.6);opacity:0">
      <div id="lvT" style="position:relative;z-index:2;margin-top:14px;font-family:Kanit,sans-serif;font-style:italic;font-weight:800;font-size:56px;line-height:1;color:#FFD23F;text-shadow:0 4px 0 #8C2F1C;transition:transform .5s cubic-bezier(.2,1.6,.4,1) .1s,opacity .2s .1s;transform:scale(2.2) rotate(-10deg);opacity:0">LEVEL UP!</div>
      <div class="row" style="position:relative;z-index:2;justify-content:center;margin-top:12px;gap:10px"><span class="bold muted" style="font-size:20px">Lv.</span>
        <span class="lv-num"><span id="lvOld" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:700;transition:transform .45s cubic-bezier(.2,1.6,.4,1) .25s">${d.from}</span><span id="lvNew" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:700;transition:transform .45s cubic-bezier(.2,1.6,.4,1) .25s;transform:translateY(64px)">${d.to}</span></span></div>
      <div id="lvRank" style="position:relative;z-index:2;margin-top:10px;font-size:18px;font-weight:700;transition:opacity .4s .45s,transform .4s .45s;opacity:0;transform:translateY(10px)">${levelTitle(d.to)} <span class="muted small" style="font-weight:500">· จาก${d.oldTitle}</span>${d.oldTier && d.oldTier !== tierFor(d.to).id ? `<div style="margin-top:6px;color:${tierFor(d.to).color}">ขึ้นระดับ ${tierFor(d.to).name}!</div>` : ''}</div>
      <div style="position:relative;z-index:2;align-self:stretch;margin-top:18px" class="col"><div class="bar"><i id="lvBar" style="width:92%"></i></div><div class="between xs muted"><span id="lvXp">ก่อนหน้า</span><span id="lvNext">ถัดไป Lv.${d.to}</span></div></div>
      <div id="lvRewards" style="position:relative;z-index:2;align-self:stretch;margin-top:auto;display:flex;flex-direction:column;gap:12px;text-align:left;transition:opacity .45s,transform .45s cubic-bezier(.2,1.3,.4,1);opacity:0;transform:translateY(40px);pointer-events:none">
        <span class="xs muted semi">ปลดล็อกแล้ว</span>
        <div class="unlock">${unlocks.map(([ic, t, sub], i) => `<div style="${i % 2 ? 'background:var(--violet-soft)' : 'background:var(--soft)'}"><span class="${i % 2 ? 'violet' : 'accent'}">${icon(ic, 20)}</span><b class="small">${t}</b><span class="xs muted">${sub}</span></div>`).join('')}</div>
        <a class="btn btn-primary" href="#/profile">ดูนามบัตรใหม่</a>
      </div>
      ${fireworks([{ x: 50, y: 190, c: '#FFC83D', d: 0, r: 110, n: 16, big: true }, { x: 18, y: 120, c: '#A592FF', d: 0.3 }, { x: 82, y: 140, c: '#3CC7B2', d: 0.5 }, { x: 23, y: 330, c: '#FF9A5C', d: 0.75 }, { x: 80, y: 300, c: '#FFC83D', d: 0.95 }])}`,
    mount(root) {
      const $ = (s) => root.querySelector(s);
      const set = (ph) => {
        const boom = ph >= 2;
        if (ph >= 1) { $('#lvP').style.opacity = 1; $('#lvP').style.transform = boom ? 'none' : 'translateY(30px) scale(.85)'; }
        const bar = $('#lvBar');
        if (ph === 1) { bar.style.transition = 'width .7s ease-in'; bar.style.width = '100%'; $('#lvXp').textContent = 'XP เต็มหลอด!'; }
        if (boom) {
          $('#lvGlow').style.transform = 'scale(1)'; $('#lvGlow').style.opacity = 1;
          $('#lvT').style.transform = 'scale(1) rotate(-4deg)'; $('#lvT').style.opacity = 1;
          $('#lvOld').style.transform = 'translateY(-64px)'; $('#lvNew').style.transform = 'none';
          $('#lvRank').style.opacity = 1; $('#lvRank').style.transform = 'none';
          bar.style.transition = 'width .6s ease-out .3s'; bar.style.width = Math.max(4, pct) + '%';
          $('#lvXp').textContent = `${d.xp} / ${d.need} XP`; $('#lvNext').textContent = `ถัดไป Lv.${d.to + 1}`;
          if (navigator.vibrate) navigator.vibrate([40, 50, 80]);
        }
        if (ph >= 3) { const r = $('#lvRewards'); r.style.opacity = 1; r.style.transform = 'none'; r.style.pointerEvents = 'auto'; }
        playFireworks(root, ph);
      };
      lvTimers.forEach(clearTimeout);
      lvTimers = [setTimeout(() => set(1), 250), setTimeout(() => set(2), 1050), setTimeout(() => set(3), 2500)];
      return () => lvTimers.forEach(clearTimeout);
    },
    leave() { lvData = null; },
  };
}
