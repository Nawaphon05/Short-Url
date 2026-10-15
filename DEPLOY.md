# เตรียม Deploy Short URL

## ก่อน Deploy Branch ล็อกอิน

Branch `Feature/login` ต้องใช้ schema ใหม่: สำรองข้อมูลแล้วรัน `server/migrations/001_auth.sql` บนฐานข้อมูลปลายทางด้วยบัญชีเจ้าของตาราง ก่อน Deploy โค้ดใหม่ คงลิงก์เดิมที่ user_id เป็น NULL ไม่โอนให้บัญชีแรก
ยังไม่ได้อัปเดตฐานข้อมูล Render หรือ Deploy ล็อกอินในรอบนี้ Cookie ใช้ Secure บน production จึงต้องทดสอบผ่าน HTTPS และตั้ง PUBLIC_BASE_URL ให้ตรงกับ Origin จริง
ทดสอบสองบัญชีและ Logout หลัง Deploy อย่าใช้ `npm test` หรือ migrate:local กับ Hosting

ระบบนี้เป็น Vue + Express + PostgreSQL แบบ Backend เดียว ยังไม่ใช่ Microservice
Express เสิร์ฟไฟล์ `client/dist` และ API จาก URL เดียวกัน จึงไม่ต้องเพิ่ม CORS

## ทดสอบแบบ Production ในเครื่อง

1. เปิด PostgreSQL และตั้งค่า `server/.env` ตาม `server/.env.example`
2. จากโฟลเดอร์โปรเจกต์ รัน `npm.cmd run build --prefix client`
3. รัน `npm.cmd start --prefix server` แล้วเปิด `http://localhost:3000`
4. ตั้ง `PUBLIC_BASE_URL=http://localhost:3000` เพื่อให้ลิงก์สั้นชี้กลับมาที่เครื่องนี้

Vite dev server (`npm.cmd run dev` ใน client) ยังใช้พัฒนาได้ตามเดิม

## ตัวอย่างตั้งค่า Render Web Service

Deploy แล้วที่ https://short-url-4xil.onrender.com จาก Branch `Setup-Deploy` ตามขั้นตอนของโปรเจกต์
ค่าลับจริงตั้งใน Render Environment เท่านั้น ขั้นตอนด้านล่างใช้ติดตั้งใหม่หรืออ้างอิง
เลือก GitHub repository และ Branch ที่ต้องการทดสอบ เช่น `Setup-Deploy`

- Runtime: Node
- Root Directory: เว้นว่าง (ใช้ราก repository)
- Build Command: `npm ci --prefix server && npm ci --prefix client --include=dev && npm run build --prefix client`
- Start Command: `npm start --prefix server`
- Health Check Path: `/api/health`
- Environment: `NODE_ENV=production`, `DATABASE_URL`, `PUBLIC_BASE_URL`
- เลือกแผน Free หากยังมีให้เลือก และปิด Auto Deploy ระหว่างตรวจงานหากไม่ต้องการให้ Push แล้วเผยแพร่ทันที

`DATABASE_URL` ต้องเป็นค่าลับจาก PostgreSQL บน Hosting ไม่ใช่ localhost
ใช้การตั้งค่า SSL ตามผู้ให้บริการ ห้ามปิดการตรวจ certificate เพื่อแก้ปัญหาแบบเหมารวม
ตั้ง `PUBLIC_BASE_URL` เป็น URL จริงของ Web Service เช่น `https://your-app.onrender.com`
ไม่ใช้ URL ของ Vite, IP ในวง LAN หรือ URL ของฐานข้อมูล และไม่ใส่ path ต่อท้าย
Hosting จะกำหนด `PORT` ให้ ไม่จำเป็นต้องตั้งเป็น 3000

## ย้ายโครงสร้างฐานข้อมูล

ฐานข้อมูลปลายทางต้องมีตาราง `links` ก่อนเริ่ม Server ระบบไม่สร้างตารางให้อัตโนมัติ
ใช้ pgAdmin Backup แบบ Plain เลือก **Only schema** แล้ว Restore ลงฐานข้อมูลใหม่
หรือใช้ `pg_dump --schema-only --no-owner --no-privileges` กับฐานข้อมูลต้นทาง
เก็บทั้ง identity/sequence, primary key และ unique constraint ของ code ให้ครบ
ตรวจไฟล์ SQL ก่อนรัน ห้าม Restore ทับฐานข้อมูลที่มีข้อมูลโดยไม่สำรองก่อน
ไม่จำเป็นต้องย้ายประวัติทดสอบในเครื่อง หากต้องการเริ่มฐานข้อมูลออนไลน์ว่าง

Branch ล็อกอินมี migration `server/migrations/001_auth.sql` ที่ทดสอบในเครื่องแล้ว ส่วน schema ตั้งต้นของ links อยู่ใน README ต้องตรวจฐานข้อมูลปลายทางจริงก่อนนำขึ้น Hosting
ไม่มีการเปลี่ยนหรือย้ายข้อมูลในฐานข้อมูลจริงระหว่างเตรียมไฟล์ชุดนี้

## ตรวจหลัง Deploy

- เปิดหน้าแรกผ่าน HTTPS และเปิด `/api/health`
- สร้างลิงก์ เปิดลิงก์ ตรวจปลายทาง แล้วรีเฟรชจำนวนคลิก
- คัดลอกแล้ววาง ตรวจว่าเป็นโดเมน Hosting ไม่ใช่ localhost หรือ IP ในบ้าน
- ดาวน์โหลด QR และสแกนจากมือถือที่ใช้เครือข่ายอื่น
- ตรวจประวัติ สถานะผิดพลาด และ URL ที่ไม่มีอยู่ต้องตอบ 404
- HEAD ของลิงก์ต้อง Redirect โดยไม่เพิ่มคลิก

เวอร์ชันเดิมบน Render มีประวัติรวม หลัง Deploy Branch ล็อกอิน API จะคืนเฉพาะลิงก์ของเจ้าของตาม session อย่าส่ง URL ที่มี token ลับลงเดโม

## ข้อจำกัดแผนฟรี

Render Free Web Service อาจพักเมื่อไม่มีการใช้งาน ทำให้คำขอแรกช้า
Render Free PostgreSQL มีวันหมดอายุ (เอกสารปัจจุบันระบุ 30 วัน)
ตรวจวันส่งงานและเงื่อนไขล่าสุดก่อนสร้างฐานข้อมูล อย่าเลือกบริการเสียเงินโดยไม่ได้ตั้งใจ

อ้างอิง: https://render.com/docs/deploy-node-express-app และ https://render.com/docs/free
