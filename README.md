# Short URL

เว็บย่อ URL พร้อมคัดลอกลิงก์ แสดงและดาวน์โหลด QR Code ดูประวัติและจำนวนคลิก รองรับมือถือและคีย์บอร์ด

**เว็บที่ Deploy แล้ว:** https://short-url-4xil.onrender.com

ใช้ Vue + CSS, Node.js + Express (JavaScript) และ PostgreSQL เป็น Backend เดียว ยังไม่ใช่ Microservice

## สถานะ Login / Sign up

**โค้ดปัจจุบันยังไม่มี Login, Sign up หรือ Logout** แม้ Branch จะชื่อ `Feature/login` ยังไม่มี API ยืนยันตัวตน session หรือตาราง users จึงยังไม่มีขั้นตอนสมัครสมาชิกหรือเข้าสู่ระบบที่ใช้งานได้

เปิดเว็บแล้วสร้างลิงก์ได้ทันที ประวัติเป็นข้อมูลรวมของทุกคน ไม่ใช่ประวัติส่วนตัว อย่าใส่ URL ส่วนตัวหรือมี token ลับ เมื่อพัฒนาล็อกอินจริงแล้วต้องอัปเดตคู่มือและขั้นตอนฐานข้อมูลส่วนนี้

## เอกสารออกแบบ

- [ER Diagram และพจนานุกรมข้อมูล](docs/ER.md): แยกฐานข้อมูลปัจจุบันออกจากแบบเพิ่ม users, sessions และเจ้าของลิงก์
- [Context Diagram และ DFD แตกกระบวนการ](docs/DFD.md): แบบก่อนพัฒนาล็อกอิน พร้อมขอบเขตและเกณฑ์ทดสอบ

ภาพสำหรับล็อกอินเป็นแผนงาน ยังไม่ได้เปลี่ยน schema หรือ API จริง

## สิ่งที่ต้องติดตั้ง

- Git และบัญชีที่เข้าถึง Repository ได้
- Node.js ตาม `.node-version` (22.21.0) พร้อม npm
- PostgreSQL (ระบบเดิมใช้เวอร์ชัน 18) และ pgAdmin หรือเครื่องมือรัน SQL

คำสั่งด้านล่างใช้ PowerShell บน Windows จากรากโปรเจกต์ บน macOS/Linux ใช้ `npm` แทน `npm.cmd`

## ติดตั้ง

```powershell
git clone https://github.com/Nawaphon05/Short-Url.git
cd Short-Url
npm.cmd ci --prefix server
npm.cmd ci --prefix client
```

Branch เตรียม Deploy คือ `Setup-Deploy` และ Branch งานล็อกอินที่ตรวจครั้งนี้คือ `Feature/login` ชื่อ Branch ต้องตรงตัวพิมพ์ใหญ่เล็ก เลือก Branch ที่ต้องการด้วย `git switch <ชื่อจริง>` ก่อนติดตั้ง dependencies

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

บน Render ใช้ฐานข้อมูลที่บริการสร้างให้ รันเฉพาะ CREATE TABLE ไม่ต้อง CREATE DATABASE และไม่ต้องย้ายประวัติทดสอบจากเครื่อง

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

เมื่อแก้ server/.env ให้รีสตาร์ต Backend หยุดแต่ละ Terminal ด้วย Ctrl+C

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
5. ประวัติเป็นข้อมูลรวม API หน้าละ 20 รายการ ปุ่มเปลี่ยนหน้าแสดงเมื่อมีหลายหน้า
6. เว็บออนไลน์ต้องสร้างลิงก์โดเมน Render ไม่ใช่ localhost ลองเปิดผ่านเน็ตมือถือเพื่อยืนยันว่าไม่พึ่ง LAN

ลิงก์ localhost เปิดจากเครื่องอื่นไม่ได้ ใช้เว็บออนไลน์สำหรับแชร์ทั่วไป

## API ปัจจุบัน

| Method | Path | หน้าที่ |
|---|---|---|
| GET | /api/health | สถานะ API ไม่ได้ตรวจฐานข้อมูลใหม่ทุกครั้ง |
| POST | /api/links | สร้างลิงก์ รับ JSON เช่น `{"url":"https://example.com"}` |
| GET | /api/links?page=1 | ประวัติรวมเรียงจากใหม่ไปเก่า |
| GET | /r/:code | เพิ่มคลิกและ Redirect ด้วย HTTP 302 |
| HEAD | /r/:code | ตรวจ Redirect โดยไม่เพิ่มคลิก |

## Deploy และข้อจำกัด

อ่าน [DEPLOY.md](DEPLOY.md) สำหรับคำสั่ง Build/Start และตั้งค่า Render เว็บออนไลน์ Deploy จาก `Setup-Deploy` ตามขั้นตอนที่ผ่านมา การสร้าง Branch ใหม่ไม่เปลี่ยนเว็บออนไลน์จนกว่าจะ Deploy โค้ดนั้น

- Free Web Service อาจพักเมื่อไม่มีผู้ใช้ คำขอแรกจึงช้า
- ฐานข้อมูล Render ของงานนี้แสดงวันหมดอายุ **15 พฤศจิกายน 2026** ต้องสำรองและวางแผนก่อนถึงวันนั้น
- URL ที่สร้างอาจยาวกว่าต้นฉบับที่สั้นอยู่แล้ว เพราะโดเมน Hosting ยาว
- ยังไม่มีการแยกเจ้าของลิงก์ ติดตามยอดขาย หรือตรวจความปลอดภัยของเว็บไซต์ปลายทาง
- `npm test` ของ server ยังเป็น placeholder ไม่ใช่ชุดทดสอบอัตโนมัติ Build ผ่านไม่เท่ากับทุกฟังก์ชันผ่าน

## โครงสร้างหลัก

```text
client/src/App.vue                 ฟอร์มและผลลัพธ์
client/src/components/             ประวัติ คัดลอก และ QR
client/src/style.css               ธีมและอนิเมชัน
server/index.js                    เริ่ม Server และเสิร์ฟ Vue build
server/linkRoutes.js               สร้างลิงก์และอ่านประวัติ
server/redirectRoutes.js           Redirect และนับคลิก
server/db.js                       เชื่อม PostgreSQL
server/.env.example                ตัวอย่างตั้งค่า ไม่มีค่าลับจริง
```
