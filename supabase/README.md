# Pointie × Supabase — ติดตั้งหลังบ้าน

โปรเจกต์: `vcerkaqjagvciuxjgktg` (ค่าเชื่อมต่ออยู่ใน `js/config.js`)

## 1. สร้างตารางและฟังก์ชัน (ครั้งเดียว)
Supabase Dashboard → **SQL Editor** → New query
1. วางเนื้อหา `schema.sql` ทั้งไฟล์ → **Run**
2. วางเนื้อหา `seed.sql` ทั้งไฟล์ → **Run** (ร้านตัวอย่าง 8 ร้าน + รีวิว + กิจกรรมย้อนหลัง 70 วันสำหรับ Dashboard)

รันซ้ำได้ ไม่ทำให้ข้อมูลซ้ำ (seed จะแทนที่เฉพาะข้อมูลตัวอย่าง)
ถ้าแก้ข้อมูลร้านตัวอย่างใน `js/data.js` ให้สร้าง seed ใหม่ด้วย `node supabase/gen-seed.mjs`

## 2. ตั้งค่า Authentication
Dashboard → **Authentication**
- **Sign In / Providers → Allow anonymous sign-ins: เปิด** — ลูกค้าใช้บัญชีแบบไม่ระบุตัวตนผูกกับเครื่อง (ระหว่างที่ยังไม่มี SMS OTP จริง)
- **Sign In / Providers → Email**: เปิดไว้ (ร้านค้าเข้าด้วยอีเมล + รหัสผ่าน)
  - ถ้าเปิด **Confirm email** ร้านต้องกดลิงก์ในอีเมลก่อน แล้วกลับมาเข้าสู่ระบบเพื่อสร้างร้าน
- **URL Configuration → Site URL**: `https://store.getpointie.com/` (ลิงก์ยืนยันอีเมลของร้านจะพากลับมาที่นี่)
- **URL Configuration → Redirect URLs**: เพิ่ม `https://store.getpointie.com/**`, `https://app.getpointie.com/**` (และ `https://pointie-steel.vercel.app/**` ถ้ายังใช้)

## 2.1 เปิด SMS OTP จริง (boost-sms)
Supabase เป็นคนสร้างรหัส 6 หลักและตรวจรหัสเอง เราแค่ส่ง SMS ผ่าน boost-sms ด้วย Edge Function `send-sms`
1. **Edge Functions → Deploy a new function → Via Editor** ชื่อ `send-sms` วางโค้ดจาก `supabase/functions/send-sms/index.ts`
   - ปิด **Verify JWT** ของฟังก์ชันนี้ (Supabase Auth เซ็นคำขอเอง ฟังก์ชันตรวจลายเซ็นให้แล้ว)
2. **Authentication → Hooks → Add hook → Send SMS hook** → แบบ HTTPS
   - URL: `https://vcerkaqjagvciuxjgktg.supabase.co/functions/v1/send-sms`
   - กด Generate secret แล้วคัดลอกค่า `v1,whsec_...`
3. **Edge Functions → Secrets** เพิ่ม
   - `SEND_SMS_HOOK_SECRET` = ค่าจากข้อ 2
   - `BOOST_SMS_API_KEY` = API Key ที่สร้างใน boost-sms → คีย์ API (ขึ้นต้น `sk_live_`; ต้องซื้อแพ็กเกจก่อน แพ็กเกจทดลองใช้ API ไม่ได้)
   - `BOOST_SMS_SENDER` = **ต้องใส่** ชื่อผู้ส่งที่อนุมัติแล้วใน boost-sms → ชื่อผู้ส่ง เช่น `DPoint` (boost-sms ไม่ส่งถ้าไม่มีชื่อผู้ส่ง)
4. **Authentication → Sign In / Providers → Phone: เปิด** · SMS OTP Expiry = `300` วินาที · ความยาวรหัส 6 หลัก
   - ยังเปิด **Allow anonymous sign-ins** ไว้ (ปุ่ม "ลองใช้บัญชีตัวอย่าง" และบัญชีเดิมที่ยังไม่ยืนยันเบอร์)
5. รัน `schema.sql` ใหม่ (เบอร์ของลูกค้าจะเอามาจากเบอร์ที่ยืนยันแล้วเท่านั้น)
6. แก้ `js/config.js` → `SMS_OTP = true` แล้ว deploy
- ลูกค้าเดิมที่สมัครก่อนเปิด SMS: หน้า **ตั้งค่า → ยืนยันเบอร์ด้วย SMS** ผูกเบอร์เข้ากับบัญชีเดิม แสตมป์ไม่หาย และเข้าจากเครื่องอื่นได้
- ดูว่าส่ง SMS สำเร็จไหม: Edge Functions → send-sms → Logs
- ข้อจำกัดของ boost-sms: ส่ง SMS ได้ 10 ครั้ง/นาที ต่อ API key (เกินแล้วแอพจะบอกให้รอสักครู่) — ถ้าคนสมัครพร้อมกันเยอะ ขอเพิ่มลิมิตกับ boost-sms
- ฟังก์ชันเรียก `POST https://app.boost-sms.com/api/v1/sms/send` ด้วย `{ to: "+66…", message, sender }` ข้อความ: "รหัส D Point: 123456 ใช้ได้ 5 นาที ห้ามบอกรหัสนี้กับผู้อื่น" (1 ข้อความ SMS)

## 2.2 เข้าสู่ระบบด้วย Google และ Apple
แอพใช้ OAuth แบบ PKCE ของ Supabase (ปุ่มอยู่หน้าแรกของแอพลูกค้า) — Callback URL ของ Supabase คือ
`https://vcerkaqjagvciuxjgktg.supabase.co/auth/v1/callback`
และ Redirect URLs ใน Authentication → URL Configuration ต้องมี `https://app.getpointie.com/**`

**Google**
1. Google Cloud Console → APIs & Services → **OAuth consent screen**: External · ชื่อแอพ D Point · อีเมลซัพพอร์ต · Authorized domain `getpointie.com` · ใส่ลิงก์นโยบาย `https://app.getpointie.com/#/privacy` และข้อกำหนด `https://app.getpointie.com/#/terms` → Publish app
2. **Credentials → Create credentials → OAuth client ID** → Web application
   - Authorized JavaScript origins: `https://app.getpointie.com`
   - Authorized redirect URIs: `https://vcerkaqjagvciuxjgktg.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Sign In / Providers → **Google**: เปิด แล้ววาง Client ID และ Client Secret

**Apple** (Apple Developer → Certificates, Identifiers & Profiles)
1. **Identifiers → App IDs**: สร้าง (หรือใช้ของแอพ iOS) แล้วติ๊ก **Sign in with Apple**
2. **Identifiers → Services IDs**: สร้างใหม่ เช่น `com.dpointapp.web` → ติ๊ก Sign in with Apple → Configure
   - Primary App ID: App ID จากข้อ 1
   - Domains: `vcerkaqjagvciuxjgktg.supabase.co`
   - Return URLs: `https://vcerkaqjagvciuxjgktg.supabase.co/auth/v1/callback`
3. **Keys**: สร้าง key ใหม่ ติ๊ก Sign in with Apple → ดาวน์โหลดไฟล์ `.p8` (โหลดได้ครั้งเดียว) จด Key ID และ Team ID (มุมขวาบน)
4. Supabase → Authentication → Sign In / Providers → **Apple**: เปิด
   - Client IDs: Services ID จากข้อ 2 (ภายหลังเพิ่ม Bundle ID ของแอพ iOS คั่นด้วยคอมมา)
   - Secret Key: JWT ที่สร้างจากไฟล์ `.p8` + Key ID + Team ID + Services ID (ใช้เครื่องมือสร้างในเอกสาร Supabase หัวข้อ Login with Apple) — **หมดอายุทุก 6 เดือน ต้องสร้างใหม่**
- ลูกค้าที่เข้าด้วย Google/Apple ไม่มีเบอร์ในบัญชี (ร้านไม่เห็นเบอร์อยู่แล้ว) ชื่อจาก Google/Apple จะเติมให้ในหน้าสมัคร
- คนเดียวกันที่เข้าด้วยเบอร์และด้วย Google จะเป็นคนละบัญชี (ยังไม่มีการเชื่อมบัญชี)

## 3. ตรวจว่าใช้งานได้
- เปิด `https://app.getpointie.com/` → ถ้าต่อสำเร็จ หน้า ตั้งค่า จะเขียนว่า "ข้อมูลซิงก์กับเซิร์ฟเวอร์"
- ถ้าต่อไม่ได้ (ยังไม่ได้รัน SQL หรือเน็ตมีปัญหา) แอพจะสลับไปใช้ข้อมูลตัวอย่างในเครื่องเองโดยไม่พัง
- บังคับใช้โหมดเดโมในเครื่องได้ด้วย `?local=1` ต่อท้ายลิงก์

## อัปเดต schema
เมื่อ `schema.sql` มีการเปลี่ยน ให้วางทั้งไฟล์แล้วกด Run ใหม่ได้เลย (อัปเกรดทับของเดิม ข้อมูลไม่หาย)

## เลเวลและระดับสมาชิก
XP คำนวณที่เซิร์ฟเวอร์จากกิจกรรมจริง (`_xp_of`): ไปร้าน +20/ครั้ง · รีวิว +30 · สมัคร +50 · ตอบความชอบ +30 ·
ภารกิจรายสัปดาห์ (แสตมป์ 5 ดวง +50, รีวิว 1 ร้าน +30, คาเฟ่ใหม่ 3 ร้าน +100) — แก้เลเวลในโปรไฟล์เองไม่ได้
ระดับ: Explorer (Lv.1–4) · Regular (Lv.5+, +1 แสตมป์ครั้งแรกที่ไปร้านใหม่) · Pro (Lv.10+) · Legend (Lv.15+)
ร้านตั้ง "โปรสำหรับสมาชิก" ตามระดับได้ที่เว็บร้านค้า → โปรและกิจกรรม

## รายชื่อร้านที่สมัครจากหน้า landing
ฟอร์ม "สมัครใช้งาน" ที่ `/business/` บันทึกลงตาราง **`leads`** (ชื่อ นามสกุล เบอร์ ชื่อร้าน ประเภทร้าน แหล่งที่มา)
ดูได้ที่ Supabase → **Table Editor → leads** · แก้คอลัมน์ `status` (new / contacted / won / lost) และ `note` เพื่อติดตามการโทรกลับ
เบอร์เดิมส่งซ้ำภายใน 24 ชม. จะไม่สร้างแถวใหม่ · จากหน้าเว็บอ่านตารางนี้ไม่ได้

## ออกแบบความปลอดภัย
- ไม่ต้องใช้ส่วนเสริม (extension) ใดๆ
- ทุกตารางเปิด RLS แต่ **ไม่มี policy** → เข้าตารางตรงๆ จาก API ไม่ได้เลย
- หน้าเว็บเรียกได้เฉพาะฟังก์ชัน (`rpc`) ที่ตรวจ `auth.uid()` เอง:
  - ลูกค้า: `collect_stamp` (วันละ 1 ดวง/ร้านตามเวลาไทย, x2 วันโปร, ตรวจรหัสสแตนด์), `redeem_card` (ออกรหัส 4 หลัก), `submit_review` (เฉพาะคนที่เคยมาจริง), `my_state`, `save_profile`, `delete_my_account`
  - ร้าน: `merchant_*` ทำได้เฉพาะร้านของตัวเอง (`owner_id = auth.uid()`)
  - สาธารณะ: `get_catalog`, `check_stand`, `merchant_samples_available`
- publishable key ในหน้าเว็บเปิดเผยได้ตามปกติ สิทธิ์จริงคุมด้วยฟังก์ชันข้างบน

## ข้อจำกัดตอนนี้
- ถ้ายังไม่เปิด SMS OTP (ข้อ 2.1) ลูกค้าเป็นบัญชีต่อเครื่อง: ใช้เบอร์เดิมบนเครื่องใหม่จะได้บัญชีใหม่
- รูปบนบัตรเก็บใน `shops.data` (ย่อแล้วราว 20–60 KB) — ภายหลังควรย้ายไป Supabase Storage
- ร้านตัวอย่างให้ "รับไปทดลอง" ได้ร้านละ 1 บัญชี (`merchant_claim_sample`) — ปิดฟังก์ชันนี้ก่อนเปิดใช้จริง

## ข้อมูลส่วนตัวและเจน
- ตอนสมัคร ลูกค้ากรอก ชื่อ นามสกุล ชื่อเล่น วันเกิด (อายุ 13+) แล้วตอบความชอบ — ชื่อจริง/วันเกิดเก็บในคอลัมน์ `customers.first_name / last_name / birth_date` ผ่าน `save_identity()` แยกจากโปรไฟล์เกม
- ร้านค้าเห็นแค่ชื่อเล่นและ **เจน** (คำนวณจากปีเกิดด้วย `_gen_of`): Gen Z 1997–2012 · Gen Y 1981–1996 · Gen X 1965–1980 · Boomer ≤1964 · Gen Alpha 2013+
- หน้าร้านในแอพแสดง "แต่ละเจนว่ายังไง" (คะแนนเฉลี่ย + อิโมจิ) เฉพาะเจนที่มีรีวิว ≥ 5 รีวิว
- Dashboard ร้าน: ลูกค้าแยกตามเจน และคะแนนรีวิวแยกเจน

## แผนที่ (Google Maps)
- ร้านเก็บพิกัดจริง `lat` / `lng` ใน `shops.data` (ร้านตัวอย่างอยู่ใน `seed.sql` ย่านอารีย์)
- แอพลูกค้าใช้ Google Maps แบบฝัง (embed) ไม่ต้องมี API key และไม่มีค่าใช้จ่าย: หน้าแมพแสดงร้านที่เลือกทีละร้าน + แถบรายชื่อร้านเรียงตามระยะ, หน้าร้านมีแผนที่ย่อ + ปุ่มนำทาง
- ระยะทางคิดจากตำแหน่งของลูกค้า (ถ้าอนุญาต) ไม่งั้นคิดจาก BTS อารีย์ — คำนวณในเครื่อง ไม่ส่งตำแหน่งขึ้นเซิร์ฟเวอร์
- ร้านตั้งตำแหน่งที่เว็บร้านค้า → ข้อมูลร้าน & แมพ: วางลิงก์ Google Maps / ตัวเลขพิกัด หรือกด "ใช้ตำแหน่งปัจจุบัน"
- อัปเดต: รัน `schema.sql` และ `seed.sql` ใหม่ (ร้านตัวอย่างจะได้พิกัด)
