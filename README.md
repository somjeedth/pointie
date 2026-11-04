# Pointie — Customer Web App

เว็บแอพฝั่งลูกค้าของ **Pointie** (แตะ · สะสม · เลเวลอัป) สร้างจากดีไซน์ `Pointie — Customer App` ทั้ง 26 หน้าจอ
เป็น HTML/CSS/JS ล้วน (ES modules, ไม่ต้อง build) ติดตั้งเป็นแอพบนมือถือได้ (PWA) และใช้งานออฟไลน์ได้บางส่วน

## เปิดใช้งาน

```bash
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000/
```

ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ (ไม่ใช่ `file://`) เพราะใช้ ES modules และ service worker

## Deploy บน Vercel

1. vercel.com → **Add New → Project** → เลือก repo `somjeedth/pointie`
2. Framework Preset → **Other** · ไม่ต้องมี Build Command / Root Directory
3. **Deploy** → แอพจะอยู่ที่หน้าแรกของโดเมน (เช่น `pointie-xxx.vercel.app`)

header ความปลอดภัย (CSP, เปิดกล้อง/ตำแหน่งให้แอพ) อยู่ใน `vercel.json`

## ลิงก์สำหรับสแตนด์ NFC / QR ของร้าน

เขียน URL นี้ลงแท็ก NFC หรือทำเป็น QR: `https://<โดเมน Pointie>/#/tap/<shopId>`
เช่น `#/tap/baan` · `jae` · `plant` · `climb` · `noodle` · `roast` · `book` · `clay`

- แตะแล้วยังไม่ล็อกอิน → หน้าเข้าสู่ระบบ แล้วกลับมารับแสตมป์อัตโนมัติ
- Android Chrome อ่าน NFC ในแอพได้ (Web NFC) · เบราว์เซอร์ที่มี `BarcodeDetector` สแกน QR ด้วยกล้องในแอพได้
- เบราว์เซอร์อื่นมีปุ่มเลือกร้านเพื่อจำลองการแตะ

## หน้าจอ ↔ ดีไซน์

| ดีไซน์ | Route |
|---|---|
| A1 Splash · A2 เบอร์มือถือ · A3 OTP (+E4 ผิด, E5 หมดเวลา) · A4 ชื่อเล่น/รูป | `#/welcome` `#/login` `#/otp` `#/setup` |
| 1 แตะรับแสตมป์ · 1b รับแล้ว · E1 วันนี้รับแล้ว · E2 ยังไม่ล็อกอิน | `#/tap/:shop` |
| B1 ชวนทำภารกิจแรก · B2 ชอบไปที่แบบไหน · B3 สไตล์ · B4 ตำแหน่ง | `#/invite` `#/prefs/places` `#/prefs/style` `#/prefs/location` |
| 2 หน้าแรก · 5 แมพ · สแกน (+E3 NFC อ่านไม่ติด) | `#/home` `#/map` `#/scan` |
| 3 หน้าร้าน (+เขียนรีวิว) | `#/store/:shop` |
| C1 บัตรของฉัน (+E7 ยังไม่มีบัตร) · C2/C3 แลกรางวัล · C4 เลเวลอัป | `#/cards` `#/redeem/:shop` `#/levelup` |
| 4 โปรไฟล์/นามบัตรดิจิทัล · E8 รีวิวของฉัน · Badge · ตั้งค่า | `#/profile` `#/reviews` `#/badges` `#/settings` |
| E6 เน็ตหลุด | `#/offline/:shop` (อัตโนมัติเมื่อกดรับแสตมป์ตอนออฟไลน์) |

## กติกาที่ทำไว้
- แสตมป์ได้ร้านละ 1 ดวงต่อวัน · บ้านกาแฟริมคลองได้ x2 ทุกวันพุธ · บัตรครบต้องแลกก่อนเริ่มใบใหม่
- XP: แสตมป์ +20 · รีวิว +30 · ตอบความชอบ +30 · สมัครใหม่ +50 · ภารกิจรายสัปดาห์ +30 ถึง +100
- รีวิวได้เฉพาะร้านที่เคยรับแสตมป์ (ป้าย "ไปจริง")
- กดรับแสตมป์ตอนออฟไลน์ ระบบจะเก็บการแตะไว้ 10 นาที แล้วบันทึกให้เมื่อกลับมาออนไลน์
- เลเวลอัปปลดล็อกช่องปักหมุด Badge และกรอบนามบัตร (Lv.8 = ลายส้มทอง) · สลับธีมมืด/สว่างได้ที่ ตั้งค่า

## โครงสร้าง
```
./
├── index.html, manifest.webmanifest, sw.js, vercel.json
├── css/app.css            ธีม (มืด/สว่าง) และคอมโพเนนต์
├── img/                   มาสคอต Pointie และไอคอนแอพ
└── js/
    ├── app.js             router (hash) + event delegation
    ├── store.js           state, localStorage, กติกาแสตมป์/XP/ภารกิจ/Badge
    ├── data.js            ร้าน, Badge, เลเวล, ตัวเลือกความชอบ
    ├── ui.js, icons.js    คอมโพเนนต์และไอคอน SVG
    └── screens-*.js       หน้าจอ (onboard / main / flow)
```
