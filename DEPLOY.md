# Deploy Short URL บน Render

เว็บ https://short-url-4xil.onrender.com Deploy จาก `main` แล้ว ผู้ใช้ยืนยัน migration สำเร็จ และทดสอบ QR มือถือกับการแยกบัญชีผ่าน วันที่ 16 ตุลาคม 2026

## Web Service

- Repository: Nawaphon05/Short-Url; Branch: `main`; Root Directory: ราก Repository
- Build Command: `npm ci --prefix server && npm ci --prefix client && npm run build --prefix client`
- Start Command: `npm start --prefix server`
- Node ตาม [.node-version](.node-version)
- Environment: `NODE_ENV=production`, `PUBLIC_BASE_URL=https://short-url-4xil.onrender.com`
- DATABASE_URL ใช้ Internal Database URL ของ PostgreSQL Region เดียวกัน ใส่ค่าจริงใน Render Environment เท่านั้น
- ใช้ PORT ที่ Render กำหนด Express เสิร์ฟทั้ง Vue build และ API ไม่ต้องเปิด Vite

## ฐานข้อมูล

สำหรับฐานข้อมูลใหม่ สร้าง links ตาม [README](README.md#สร้างฐานข้อมูล) แล้วรัน [migration สมาชิก](server/migrations/001_auth.sql) บนฐานข้อมูลปลายทางด้วยบัญชีที่มีสิทธิ์ ไม่ต้อง CREATE DATABASE บน Render

ฐานข้อมูลเดิมต้องสำรองก่อน migration คงลิงก์ user_id NULL ไว้ ไม่ยกให้บัญชีใหม่ IF NOT EXISTS ไม่แก้โครงสร้างเดิมที่ผิดโดยอัตโนมัติ ฐานข้อมูลของงานนี้รัน migration แล้ว ไม่ต้องรันซ้ำทุก Deploy

pgAdmin เป็นเครื่องมือดูข้อมูล ฐานข้อมูลจริงอยู่บน Render ปิดคอมพิวเตอร์ได้ เว็บยังใช้ฐานข้อมูลออนไลน์ จากเครื่องใช้ External connection พร้อม SSL ส่วน Web Service ใช้ Internal connection

## สำรองและ Deploy

1. ใน pgAdmin คลิกขวาฐานข้อมูล เลือก Backup รูปแบบ Custom บันทึกนอก Repository ตรวจสถานะสำเร็จและไฟล์ที่ได้
2. ผู้ใช้สำรองก่อน migration ที่ `D:\Backup-ShortURL\short-url-before-login.backup` แล้ว ไฟล์นี้ไม่ใช่สำเนาข้อมูลล่าสุดตลอดเวลา
3. ตรวจโค้ดและ migration ก่อน Merge เข้า main การอัปเดต Branch ที่ผูกกับ Render อาจเริ่ม Deploy ตาม Auto Deploy ที่ตั้งไว้
4. รอ Deploy succeeded ตรวจ Logs ว่าเชื่อม PostgreSQL สำเร็จ แล้วทดสอบบน HTTPS เพราะ cookie production ใช้ Secure
5. ทดสอบตาม [รายการเตรียมส่ง](docs/SUBMISSION.md)

หากย้อนเวอร์ชันให้ตรวจโค้ดกับ schema ก่อน ไม่ลบตารางหรือ Restore ทับฐานข้อมูลจริงทันที เพราะข้อมูลหลัง Backup อาจสูญหาย ควรทดลอง Restore ในฐานข้อมูลแยกเพื่อยืนยันว่าสำเนากู้คืนได้

## ข้อจำกัดที่บันทึกไว้

Dashboard ของงานนี้แจ้งว่า instance ฟรีพักเมื่อไม่มีผู้ใช้และคำขอแรกอาจช้า ฐานข้อมูลแสดงหมดอายุ 15 พฤศจิกายน 2026 ตรวจ Dashboard ปัจจุบันและสำรองใหม่ก่อนส่งงาน

ไม่ใช้ชุดทดสอบกับฐานข้อมูลออนไลน์ ห้าม Commit connection string, cookie, รหัสผ่าน หรือไฟล์ Backup
