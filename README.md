# Short URL

เว็บย่อ URL พร้อมคัดลอกลิงก์ แสดงและดาวน์โหลด QR Code ดูประวัติและจำนวนคลิก รองรับมือถือและคีย์บอร์ด

**เว็บที่ Deploy แล้ว:** https://short-url-4xil.onrender.com

ใช้ Vue + CSS, Node.js + Express (JavaScript) และ PostgreSQL เวอร์ชันออนไลน์ที่ยืนยันแล้วเป็น Backend เดียว ส่วน Branch นี้รองรับการแยก Redirect service

## โหมด Microservices (Branch พัฒนา)

`feature/microservices` แยกบริการ Redirect ที่รัน/Deploy อิสระ พร้อม Gateway รักษา URL และ QR เดิม โหมดสองบริการทดสอบในเครื่อง ยังไม่ได้ Deploy บน Render อ่าน [วิธีติดตั้ง รัน Deploy และ rollback](docs/MICROSERVICES.md) และ [Architecture](docs/ARCHITECTURE.md) ก่อนใช้โหมดนี้

ต้องติดตั้ง dependencies ใน redirect-service เพิ่มและรันสอง process ที่ใช้ token เดียวกัน หากยังไม่ตั้ง REDIRECT_SERVICE_URL ขั้นตอนเดิมด้านล่างจะรัน local rollback mode (monolith) ได้ตามเดิม ไม่ถือว่าทดสอบ Microservice ครบจากโหมดนี้

## การจัดการลิงก์

Merge PR #5 เข้า `main` แล้ว และ Deploy commit `abb74ac` บน Render สำเร็จวันที่ 16 ตุลาคม 2026 ตาม Logs ที่ผู้ใช้ส่ง หลังสำรองและรัน migration 002 → 003 บนฐานข้อมูลปลายทาง ผู้ใช้แสดงหลักฐานออนไลน์ว่าการลบบันทึก deleted_at แล้ว ส่วนผลทดสอบฟังก์ชันอื่นดู [รายการตรวจออนไลน์](docs/SUBMISSION.md#รายการตรวจฟังก์ชันออนไลน์หลัง-deploy-pr-5)

- ตั้งชื่อแสดงผลไม่เกิน 120 ตัวอักษร และแก้ชื่อในประวัติได้โดยไม่เปลี่ยน URL/QR
- ค้นหาชื่อ URL ต้นฉบับ หรือรหัสลิงก์ ครอบคลุมข้อมูลทุกหน้า เฉพาะบัญชีตนเอง หน้าละ 10 รายการ
- ค้นหาแบบมีคำค้นเป็นส่วนหนึ่งของข้อมูล ไม่แยกตัวพิมพ์เล็ก/ใหญ่ แต่ช่องว่างยังต้องตรง เช่น `ทดสอบ2` ไม่ตรงกับ `ทดสอบ 2` และค้น `1` จะพบ URL ที่มี `start_radio=1` ด้วย ไม่ค้นจากจำนวนคลิก
- เลือกรหัส URL ตอนสร้างได้ 3–48 ตัว ใช้ A–Z, a–z, 0–9, - และ _ แยกตัวพิมพ์เล็ก/ใหญ่ รหัสต้องไม่ซ้ำทั้งระบบ ไม่กรอกจะสุ่ม 8 ตัวตามเดิม รหัสแก้ภายหลังไม่ได้
- เลือกวันหมดอายุในอนาคตตามเวลาเครื่อง Browser ส่งเป็น UTC ให้ Server ไม่กำหนดหมายถึงไม่มีวันหมดอายุ
- หมดอายุแล้ว GET/HEAD ตอบ HTTP 410 พร้อมหน้าอธิบาย ไม่ Redirect และไม่เพิ่มคลิก ลิงก์เก่ายังทำงานตามเดิม
- ลบลิงก์พร้อมยืนยันก่อนลบได้เฉพาะเจ้าของ ใช้ soft delete (deleted_at) ซ่อนจากประวัติ/ค้นหา ลิงก์และ QR เดิมตอบ 410 ว่าถูกลบแล้ว ไม่เพิ่มคลิก เก็บ code ไม่ให้ใช้ซ้ำ และไม่มีปุ่มกู้คืน
- Login/Logout มีการเปลี่ยนหน้าพร้อมแอนิเมชัน รองรับ prefers-reduced-motion

สำหรับติดตั้งใหม่: ฐานข้อมูลในเครื่องใช้ `npm.cmd run migrate:local --prefix server` ซึ่งรัน migration 001 → 002 → 003 ตามลำดับ บน Hosting สำรองก่อนแล้วรัน [002_link_management.sql](server/migrations/002_link_management.sql) หลัง 001 แล้วรัน [003_soft_delete.sql](server/migrations/003_soft_delete.sql) ก่อน Deploy โค้ดใหม่ ห้ามรันชุดทดสอบกับฐานข้อมูลออนไลน์

## สถานะ Login / Sign up

**ออนไลน์ Deploy จาก `main` แล้ว** ผู้ใช้ยืนยันว่ารัน migration บน Render สำเร็จ และทดสอบ QR มือถือกับการแยกสองบัญชีผ่าน วันที่ 16 ตุลาคม 2026

วิธีใช้เวอร์ชันใหม่:

1. กด **Sign up** กรอก Email และ Password ยาว 6–12 ตัวอักษร มีตัวพิมพ์ใหญ่ A–Z อย่างน้อย 1 ตัว พร้อมยืนยันรหัสผ่าน บัญชีเดิมที่ใช้รหัสผ่านยาวกว่านี้ยัง Login ได้ด้วยรหัสเดิม
2. สมัครสำเร็จแล้ว **Login** ด้วยบัญชีใหม่ ไม่มีการ Login อัตโนมัติหรือยืนยันอีเมล
3. สร้างลิงก์และดูประวัติส่วนตัว API กรองตามเจ้าของจาก session
4. หน้า Login เลือก **จำ Email และการเข้าสู่ระบบ 7 วัน** ได้ ระบบเก็บ session cookie ไม่เก็บรหัสผ่าน หากไม่เลือก cookie จะเป็นแบบ session และ session ฝั่ง Server หมดอายุใน 12 ชั่วโมง (บางเบราว์เซอร์อาจคืน cookie เมื่อกู้คืนหน้าต่าง) กด **Logout** เพื่อเพิกถอนทันที Email ที่เลือกจำเก็บใน localStorage การบันทึกรหัสผ่านใช้ Password Manager ของเบราว์เซอร์ ขึ้นกับการรองรับและการตั้งค่าของผู้ใช้
5. ผู้รับลิงก์ยังเปิด Redirect หรือสแกน QR ได้โดยไม่ต้อง Login

ลิงก์เก่าไม่มีเจ้าของ จึงไม่แสดงในบัญชีใหม่ แต่ยังเปิด Redirect ได้ ไม่มีการยกประวัติรวมให้บัญชีใดอัตโนมัติ ยังไม่มีระบบลืมรหัสผ่าน ยืนยันอีเมล หรือลบบัญชี

Session ใช้ HttpOnly cookie (Secure บน production) ไม่เก็บ token ใน localStorage ฐานข้อมูลเก็บเฉพาะ password hash แบบ scrypt พร้อม salt และ hash ของ session token

## เอกสารออกแบบ

- [ER Diagram และพจนานุกรมข้อมูล](docs/ER.md)
- [Context Diagram และ DFD Level 0](docs/DFD.md)
- [Architecture Diagram](docs/ARCHITECTURE.md)
- [คู่มือ Microservices](docs/MICROSERVICES.md)
- [ผลทดสอบและรายการเตรียมส่งงาน](docs/SUBMISSION.md)

เอกสารอธิบายระบบปัจจุบัน แบบก่อนพัฒนาอยู่ในประวัติ Git

## สิ่งที่ต้องติดตั้ง

- Git และบัญชีที่เข้าถึง Repository ได้
- Node.js ตาม `.node-version` (22.21.0) พร้อม npm
- PostgreSQL (ระบบเดิมใช้เวอร์ชัน 18) และ pgAdmin หรือเครื่องมือรัน SQL

คำสั่งด้านล่างใช้ PowerShell บน Windows จากรากโปรเจกต์ บน macOS/Linux ใช้ `npm` แทน `npm.cmd`

## ติดตั้ง

```powershell
git clone https://github.com/Nawaphon05/Short-Url.git
cd Short-Url
git switch feature/microservices
npm.cmd ci --prefix server
npm.cmd ci --prefix client
npm.cmd ci --prefix redirect-service
```

ขั้นตอนนี้ใช้ Branch `feature/microservices` ซึ่งต้อง Push ก่อนผู้ตรวจจะติดตั้งจาก GitHub ได้ ส่วน `main` เป็นเวอร์ชันออนไลน์เดิม หากต้องการตรวจเวอร์ชันนั้นให้ข้ามคำสั่งสลับ Branch และไม่ต้องติดตั้ง redirect-service

## สร้างฐานข้อมูล

ใน pgAdmin เปิด Query Tool ของ PostgreSQL ในเครื่อง แล้วรันแยกต่างหาก หากยังไม่มีฐานข้อมูลนี้:

```sql
CREATE DATABASE short_url;
```

จากนั้นเปิด Query Tool **ของฐานข้อมูล short_url** แล้วรัน:

```sql
CREATE TABLE IF NOT EXISTS public.links (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code varchar(8) NOT NULL UNIQUE,
    original_url text NOT NULL,
    clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
```

โครงสร้างนี้ตรงกับตารางเดิมที่ใช้ในโปรเจกต์ Server ไม่สร้างตารางอัตโนมัติ และ `IF NOT EXISTS` ไม่แก้โครงสร้างตารางที่มีอยู่แล้ว ตรวจด้วย `SELECT * FROM public.links LIMIT 5;` ฐานข้อมูลใหม่ควรมีห้าคอลัมน์และศูนย์แถว

**เพิ่มโครงสร้างสมาชิกและการจัดการลิงก์:** หลังตั้งค่า `server/.env` และสร้างตารางเดิมแล้ว สำรองข้อมูลก่อนรัน `npm.cmd run migrate:local --prefix server` เพื่อเพิ่ม users, sessions, links.user_id รวมถึง title, expires_at, deleted_at และขยาย code โดยคงลิงก์เดิม คำสั่งนี้ยอมรับเฉพาะ PostgreSQL ที่ host เป็น localhost/127.0.0.1/::1

บน Hosting ต้องตรวจและรัน [SQL migration](server/migrations/001_auth.sql) และ [migration จัดการลิงก์](server/migrations/002_link_management.sql) และ [migration ลบลิงก์](server/migrations/003_soft_delete.sql) ตามลำดับ 001 → 002 → 003 ด้วยตนเองหลังสำรอง ก่อน Deploy โค้ดใหม่ ห้ามใช้คำสั่งทดสอบกับฐานข้อมูลออนไลน์

บน Render ใช้ฐานข้อมูลที่บริการสร้างให้ สร้างตาราง links และรัน migration 001 → 002 → 003 ตามลำดับ ไม่ต้อง CREATE DATABASE และไม่ต้องย้ายประวัติทดสอบจากเครื่อง

## ตั้งค่าตัวแปรแวดล้อม

สร้าง `server/.env` จากตัวอย่าง **เฉพาะเมื่อยังไม่มีไฟล์นี้** เพื่อไม่ทับค่าเดิม:

```powershell
Copy-Item server/.env.example server/.env
```

ตัวอย่างสำหรับเครื่องตัวเอง ทุกค่าเป็นค่าตัวอย่าง ให้แก้ข้อมูล PostgreSQL ให้ตรงกับเครื่อง:

```dotenv
PGHOST=localhost
PGPORT=5432
PGDATABASE=short_url
PGUSER=postgres
PGPASSWORD=replace-with-your-local-password
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
```

| ตัวแปร | หน้าที่ |
|---|---|
| PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD | ข้อมูล PostgreSQL ในเครื่อง |
| DATABASE_URL | Connection string ของฐานข้อมูลออนไลน์ ถ้ามีจะใช้แทนค่าการเชื่อมต่อ PG* |
| PORT | พอร์ต Express ค่าเริ่มต้น 3000 บน Hosting ใช้ค่าที่ผู้ให้บริการกำหนด |
| PUBLIC_BASE_URL | URL หลักสำหรับสร้างลิงก์ ต้องเป็น HTTP(S) origin ไม่มี path, query หรือ username/password |
| NODE_ENV | ตั้ง production บน Hosting |

บน Render ตั้งในหน้า Environment ของ Web Service:

- `NODE_ENV` = `production`
- `DATABASE_URL` = Internal Database URL จริงของฐานข้อมูลใน Region เดียวกับเว็บ คัดลอกจาก Render ไปใส่โดยตรง ไม่เก็บใน Repository
- `PUBLIC_BASE_URL` = `https://short-url-4xil.onrender.com`

ใช้ credentials ชุดใหม่ที่ยังใช้งานได้และไม่ได้เปิดเผย สำหรับ pgAdmin จากเครื่องให้ใช้ External connection และ SSL ตามที่ผู้ให้บริการกำหนด ไม่ปิดการตรวจ certificate แบบเหมารวม

ห้าม Commit `.env`, รหัสผ่าน หรือ connection string จริง ไฟล์ `.env.example` มีเฉพาะตัวอย่างและเก็บใน Git ได้ Backend อ่าน `.env` จากโฟลเดอร์ server ไม่ขึ้นกับโฟลเดอร์ที่สั่งเริ่มระบบ

## รันระหว่างพัฒนา

**ทดลองสองบริการ:** หลังสร้างฐานข้อมูล ตั้งค่า `server/.env` และรัน migration แล้ว ให้ Build และเริ่มระบบจากรากโปรเจกต์:

```powershell
npm.cmd run build --prefix client
npm.cmd run dev:services --prefix server
```

เปิด http://localhost:3062 บริการ Redirect อยู่ที่พอร์ต 3063 คำสั่งนี้ใช้เฉพาะ PostgreSQL localhost และสร้าง token ชั่วคราวให้ทั้งสองบริการ กด Ctrl+C เพื่อหยุด ดูการตั้งค่าแต่ละบริการและ Deploy ใน [คู่มือ Microservices](docs/MICROSERVICES.md)

**พัฒนา UI ด้วย Vite:** วิธีด้านล่างรัน Backend พอร์ต 3000 หากไม่ตั้ง `REDIRECT_SERVICE_URL` จะเป็น monolith สำหรับ rollback หากต้องการสองบริการพร้อม Vite ให้เริ่ม Redirect และตั้งค่า Backend ตามคู่มือ Microservices ด้วยตนเอง

เปิด PostgreSQL ก่อน เปิด Terminal สองอันจากรากโปรเจกต์

**Terminal 1 — Backend:**

```powershell
npm.cmd start --prefix server
```

ต้องเห็น `Connected to PostgreSQL` และ Server เริ่มทำงานที่พอร์ต 3000

**Terminal 2 — Frontend:**

```powershell
npm.cmd run dev --prefix client
```

เปิด URL ที่ Vite แสดง ปกติคือ http://localhost:5173 เส้นทาง `/api` จะ proxy ไป Backend พอร์ต 3000 ส่วน Redirect ใช้ `PUBLIC_BASE_URL=http://localhost:3000` ไม่ใช่พอร์ต Vite

เมื่อแก้ server/.env หรือโค้ด Backend ให้หยุด Terminal ของ Backend ด้วย Ctrl+C แล้วเริ่มใหม่ เพราะคำสั่ง start ใช้ node index.js และไม่โหลดโค้ดใหม่อัตโนมัติ

## Build และรันแบบ Production ในเครื่อง

```powershell
npm.cmd run build --prefix client
npm.cmd start --prefix server
```

เปิด http://localhost:3000 Express เสิร์ฟทั้ง client/dist และ API ไม่ต้องเปิด Vite แยก หยุด Backend เดิมก่อนหากมีโปรเซสใช้พอร์ต 3000 อยู่

## วิธีใช้งานและทดสอบ

1. วาง URL แบบ HTTP หรือ HTTPS ที่ไม่มี username/password แล้วกดสร้างลิงก์สั้น
2. คัดลอกแล้ววางในแท็บใหม่ ตรวจว่า Redirect ไปปลายทางถูกต้อง เบราว์เซอร์อาจปฏิเสธสิทธิ์ Clipboard ได้
3. เปิด QR ดาวน์โหลด PNG และสแกนด้วยมือถือ
4. กดรีเฟรชประวัติ ตรวจจำนวนเปิดและเวลาอัปเดต จำนวนเปิดรวมการเปิดซ้ำ ไม่ใช่จำนวนคนหรือยอดขาย
5. ประวัติของเวอร์ชันล็อกอินเป็นข้อมูลเฉพาะเจ้าของ API หน้าละ 10 รายการ ปุ่มเปลี่ยนหน้าแสดงเมื่อมีอย่างน้อย 11 รายการที่ตรงคำค้นและยังไม่ถูกลบในบัญชีเดียวกัน
6. เว็บออนไลน์ต้องสร้างลิงก์โดเมน Render ไม่ใช่ localhost ลองเปิดผ่านเน็ตมือถือเพื่อยืนยันว่าไม่พึ่ง LAN

ลิงก์ localhost เปิดจากเครื่องอื่นไม่ได้ ใช้เว็บออนไลน์สำหรับแชร์ทั่วไป

## API ปัจจุบัน

| Method | Path | หน้าที่ |
|---|---|---|
| GET | /api/health | สถานะ API ไม่ได้ตรวจฐานข้อมูลใหม่ทุกครั้ง |
| POST | /api/links | สร้างลิงก์ รับ JSON เช่น `{"url":"https://example.com","title":"โปรโมชัน","custom_code":"summer-sale","expires_at":null}` |
| DELETE | /api/links/:id | JSON `{}`; soft delete เฉพาะเจ้าของ ตอบ 204; ไม่คืนรหัสให้ใช้ซ้ำ |
| PATCH | /api/links/:id | JSON title; แก้ชื่อเฉพาะเจ้าของ ต้อง Login |
| GET | /api/links?page=1&q=คำค้น | ประวัติเฉพาะเจ้าของเรียงจากใหม่ไปเก่า ต้อง Login |
| GET | /r/:code | ลิงก์ใช้งานได้เพิ่มคลิกและตอบ 302; หมดอายุ/ถูกลบตอบ 410 ไม่เพิ่มคลิก; ไม่พบตอบ 404 |
| HEAD | /r/:code | สถานะเหมือน GET แต่ไม่มี response body และไม่เพิ่มคลิก |
| POST | /api/auth/signup | JSON email, password; สมัครแล้วต้อง Login |
| POST | /api/auth/login | JSON email, password และ remember แบบ boolean; ส่ง session cookie |
| GET | /api/auth/me | ตรวจ session ปัจจุบัน ไม่รับรหัสผ่าน |
| POST | /api/auth/logout | JSON `{}`; เพิกถอน session และล้าง cookie |

สร้างลิงก์และอ่านประวัติต้องมี session ข้อมูลเจ้าของมาจาก session ฝั่ง Server

คำขอ POST, PATCH และ DELETE ต้องมี `Content-Type: application/json`, `X-Short-URL-Client: web` และ Origin ที่อนุญาต (PUBLIC_BASE_URL; ระหว่างพัฒนาเพิ่ม localhost:5173 และ 127.0.0.1:5173) Frontend ส่งให้แล้ว ไม่เปิด CORS ข้ามเว็บไซต์

Login/Sign up จำกัดรวม 15 ครั้งต่อ IP ต่อ 15 นาทีในหน่วยความจำของ Server รีเซ็ตเมื่อ Server restart หากขยายหลาย instance ต้องเปลี่ยนไปใช้ rate-limit store ร่วมกัน ระบบล้าง session หมดอายุเมื่อ Login สำเร็จ และตรวจ expires_at ทุกคำขอ

## การทดสอบอัตโนมัติ

ติดตั้ง dependencies ของ redirect-service ด้วยก่อนทดสอบ เพราะชุดทดสอบจะรันสองบริการจริงควบคู่กับโหมด rollback จากนั้นรัน `npm.cmd test --prefix server` เมื่อ PostgreSQL ในเครื่องทำงานและตั้ง .env แล้ว ชุดทดสอบสร้าง schema ชั่วคราวแยกจาก public ทดสอบ migration, สมัคร/Login, CSRF, แยกเจ้าของ, Logout, session หมดอายุ, rate limit, pagination, ชื่อ/แก้ชื่อ/ค้นหา, รหัสกำหนดเอง, วันหมดอายุ, soft delete และ Redirect แล้วล้าง schema ทดสอบ ไม่รันทดสอบกับฐานข้อมูล Hosting

## Deploy และข้อจำกัด

อ่าน [DEPLOY.md](DEPLOY.md) สำหรับคำสั่ง Build/Start และตั้งค่า Render เว็บออนไลน์ Deploy จาก `main` การสร้าง Branch ใหม่ไม่เปลี่ยนเว็บออนไลน์จนกว่าจะ Deploy โค้ดนั้น

- Free Web Service อาจพักเมื่อไม่มีผู้ใช้ คำขอแรกจึงช้า
- ฐานข้อมูล Render ของงานนี้แสดงวันหมดอายุ **15 พฤศจิกายน 2026** ต้องสำรองและวางแผนก่อนถึงวันนั้น
- URL ที่สร้างอาจยาวกว่าต้นฉบับที่สั้นอยู่แล้ว เพราะโดเมน Hosting ยาว
- ยังไม่มีการติดตามยอดขายหรือตรวจความปลอดภัยของเว็บไซต์ปลายทาง
- Build ผ่านไม่เท่ากับทุกฟังก์ชันผ่าน ต้องทดสอบเว็บจริงหลัง Deploy ด้วย

## โครงสร้างหลัก

```text
client/src/App.vue                 ฟอร์มและผลลัพธ์
client/src/components/             ประวัติ คัดลอก และ QR
client/src/style.css               รูปแบบพื้นฐานและอนิเมชัน
client/src/redesign.css            ธีมแดง–ชาร์โคลล่าสุด
server/index.js                    เริ่ม Server และเสิร์ฟ Vue build
server/linkRoutes.js               สร้าง ค้นหา แก้ชื่อ และ soft delete
server/redirectRoutes.js           Gateway ไปบริการ Redirect
server/localRedirectRoutes.js      Redirect ในโหมด monolith สำหรับ rollback
server/redirectConfig.js           ตรวจค่าการเชื่อมต่อระหว่างบริการ
server/devServices.js              เริ่มสองบริการสำหรับทดสอบในเครื่อง
redirect-service/index.js          ตรวจสถานะลิงก์และนับคลิก แยก process
server/db.js                       เชื่อม PostgreSQL
server/.env.example                ตัวอย่างตั้งค่า ไม่มีค่าลับจริง
```
