# D Point — แอพ iOS (Capacitor)

แอพนี้คือแอพลูกค้าเดิม (ไฟล์ที่ root ของ repo) ห่อด้วย Capacitor แล้วเพิ่มส่วนที่เป็นของ iPhone:

| ในแอพ | ทำงานอย่างไร |
|---|---|
| สแกน NFC | เปิดหน้าสแกนแล้วขึ้นหน้าต่าง **Ready to Scan** ของ iOS เอง (`DPointNfcPlugin.swift`) |
| Sign in with Apple | หน้าต่าง Apple ในเครื่อง → `supabase.auth.signInWithIdToken` |
| Google | หน้าต่าง Google ในเครื่อง (ต้องใส่ iOS Client ID ก่อน ดูข้อ 5) |
| แตะป้าย / สแกน QR ด้วยกล้อง | ลิงก์ `https://app.getpointie.com/t/<ร้าน>?s=<รหัส>` เปิดแอพตรงหน้ารับแสตมป์ (Universal Links) |

- Bundle ID: `com.dpointapp.th` · Team: `8VXGSBRNHW` · ชื่อแอพ: D Point
- ไฟล์เว็บถูก**คัดลอกเข้าแอพ** (ไม่โหลดจากเว็บ) → แก้หน้าเว็บแล้วต้อง build แอพใหม่ถึงจะเห็นในแอพ

## สิ่งที่ต้องมี
- Mac + **Xcode 16** ขึ้นไป (App Store) · **Node.js 20+** (https://nodejs.org)
- iPhone จริงสำหรับทดสอบ NFC (Simulator อ่าน NFC ไม่ได้)

## 1. เปิดโปรเจกต์ครั้งแรก
```bash
git clone https://github.com/somjeedth/pointie.git   # หรือ git pull ถ้ามีแล้ว
cd pointie/mobile
npm install
npm run ios        # คัดลอกเว็บเข้าแอพ + sync + เปิด Xcode
```
Xcode จะเปิด `ios/App/App.xcodeproj` และโหลด Swift packages เอง (รอแถบด้านบนโหลดเสร็จ)

## 2. Signing & Capabilities (ครั้งเดียว)
Xcode → เลือก **App** (โปรเจกต์ด้านซ้าย) → target **App** → แท็บ **Signing & Capabilities**
- ติ๊ก **Automatically manage signing** · Team: บัญชีของ 3PN (8VXGSBRNHW)
- ต้องเห็น 3 capability (มาจาก `App.entitlements` แล้ว): **Near Field Communication Tag Reading**, **Associated Domains** (`applinks:app.getpointie.com`), **Sign in with Apple**
- ถ้า Xcode ขึ้น error เรื่อง capability ให้ไปเปิดใน developer.apple.com → Identifiers → `com.dpointapp.th` → ติ๊ก NFC Tag Reading, Associated Domains, Sign In with Apple → Save แล้วกลับมากด Try Again

## 3. ลงเครื่อง
เสียบ iPhone → เลือกเครื่องที่แถบบนของ Xcode → กด ▶︎ Run
(ครั้งแรกบน iPhone: Settings → General → VPN & Device Management → เชื่อถือนักพัฒนา และเปิด Developer Mode)

## 4. Supabase (ให้ Sign in with Apple ในแอพใช้ได้)
Authentication → Sign In / Providers → **Apple** → Client IDs ใส่ `com.dpointapp.web,com.dpointapp.th` (เพิ่ม Bundle ID ต่อท้าย คั่นด้วยคอมมา) → Save

## 5. Google ในแอพ (ไม่บังคับ)
1. Google Cloud Console → Clients → **Create client** → Application type **iOS** → Bundle ID `com.dpointapp.th` → Create → คัดลอก Client ID
2. แก้ `js/config.js`: `GOOGLE_IOS_CLIENT_ID` = iOS Client ID, `GOOGLE_WEB_CLIENT_ID` = Web Client ID (ตัวที่ใส่ใน Supabase อยู่แล้ว)
3. Supabase → Providers → **Google** → Client IDs: ใส่ Web Client ID ตามด้วย `,` แล้ว iOS Client ID → Save
4. `npm run ios` อีกครั้ง (สคริปต์จะใส่ URL scheme ของ Google ใน Info.plist ให้เอง)

ถ้ายังไม่ใส่ ปุ่ม Google จะซ่อนในแอพ (มีแค่ Apple)

## 6. ป้าย NFC / QR
- ลิงก์ป้ายแบบใหม่สร้างจากเว็บร้านค้า → จุดแตะ NFC / QR (`https://app.getpointie.com/t/<ร้าน>?s=<รหัส>`)
- เขียนลิงก์นี้ลงแท็ก NFC (NTAG213/215) เป็น **URL record** · ป้ายเก่า (`/#/tap/…`) ยังใช้ได้ แต่จะเปิดเว็บแทนแอพ
- iPhone อ่านแท็กเองได้ตอนปลดล็อกจอ (iPhone XS ขึ้นไป) → มีแอพ = เปิดแอพ · ไม่มีแอพ = เปิดเว็บ
- ไฟล์ยืนยันโดเมน: https://app.getpointie.com/.well-known/apple-app-site-association

## 7. ส่ง TestFlight / App Store
1. App Store Connect → My Apps → **+ New App** → iOS · ชื่อ `D Point` (ถ้าซ้ำ ใช้ `D Point – สะสมแต้ม`) · ภาษาหลัก Thai · Bundle ID `com.dpointapp.th` · SKU เช่น `dpoint-ios`
2. Xcode → เลือกอุปกรณ์ **Any iOS Device (arm64)** → Product → **Archive** → Distribute App → **App Store Connect** → Upload
3. App Store Connect → TestFlight → เพิ่มผู้ทดสอบ
4. ก่อนส่งรีวิว: Privacy Policy URL `https://app.getpointie.com/#/privacy` · App Privacy: ข้อมูลที่เก็บ = ชื่อ, อีเมล, เบอร์โทร, วันเกิด, User ID, เนื้อหาที่ผู้ใช้สร้าง (รีวิว), ประวัติการใช้งานในแอพ (แสตมป์) — ไม่ใช้ติดตามข้ามแอพ
5. บัญชีสำหรับทีมรีวิวของ Apple: ทีมรีวิวเข้าด้วย Sign in with Apple ได้เอง ระบุใน App Review Notes ว่า "Sign in with Apple to create an account; stamps are collected by tapping a D Point NFC tag at participating shops"

## อัปเดตแอพ
แก้หน้าเว็บ → `cd mobile && npm run ios` → Xcode: เพิ่ม **Build** (target App → General → Build +1) → Archive → Upload
