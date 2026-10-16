# ผลตรวจโค้ดและเอกสารก่อน Commit

วันที่ 16 ตุลาคม 2026 บน Branch feature/microservices ผลด้านล่างเป็นการตรวจในเครื่อง ไม่ใช่ผล Deploy สองบริการบน Render

## ขอบเขตที่ตรวจ

| ส่วน | สิ่งที่ตรวจและผล |
|---|---|
| สมาชิกและ session | สมัคร/Login/Logout, CSRF, อายุ session, rate limit และ hash รหัสผ่าน ผ่านชุดทดสอบ |
| เจ้าของลิงก์ | ประวัติ ค้นหา แก้ชื่อ และลบ กรองเจ้าของจาก session ไม่ใช้ user_id ที่ผู้ใช้ส่งมา ผ่าน |
| ค้นหาและแบ่งหน้า | กรองก่อนแบ่งหน้า, 10/11 รายการ, ค้น URL ของรายการเก่าที่อยู่นอกหน้าแรก ผ่าน; ช่องว่างกลางคำต้องตรง |
| Redirect | GET เพิ่มคลิก, HEAD ไม่เพิ่ม, 404 ไม่พบ, 410 หมดอายุ/ถูกลบ และไม่คืน code ให้ใช้ซ้ำ ผ่าน |
| คำขอพร้อมกัน | GET พร้อมกัน 20 ครั้ง เพิ่ม clicks ครบ 20 ทั้ง monolith rollback และสองบริการ ผ่าน |
| การสื่อสารระหว่างบริการ | token ผิด/ขาดถูกปฏิเสธ, ไม่ส่ง cookie ผู้ใช้, ไม่ตาม Location อัตโนมัติ, timeout/บริการล่มเป็น 503 และไม่ retry ผ่าน |
| Browser | Login สร้าง ค้นหา แก้ชื่อ ลบ และ Redirect ด้วยสอง process จริง ผ่าน; หยุด Redirect แล้วบริการหลักยังใช้ได้; Desktop/Mobile ไม่มีแนวนอนล้นในการทดสอบ |
| ฐานข้อมูลและ ER | users/links/sessions, FK, nullable legacy owner, expiry และ soft delete ตรง SQL; ไม่มี migration ใหม่ |
| DFD และ Architecture | logical processes เดิม, QR อยู่ Browser, Redirect แยก process ผ่าน Gateway, PostgreSQL ใช้ร่วมกัน; Mermaid 5 ภาพเรนเดอร์ผ่าน |
| Dependencies | npm audit ของ server, redirect-service และ client รายงาน 0 vulnerabilities ณ เวลาตรวจ ไม่ใช่การรับรองว่าปราศจากช่องโหว่ทั้งหมด |
| ไฟล์ที่จะส่ง | รายการไฟล์ Git พบเฉพาะ .env.example ไม่พบ .env จริง, node_modules, dist หรือ .backup; ประวัติ refs ในเครื่องไม่พบชื่อไฟล์ .env จริง ไม่ใช่การสแกน secrets ทุกชนิดในเนื้อหาประวัติ |

## สิ่งที่แก้จากการตรวจ

- กำหนด DATABASE_URL และ PG* ที่ผ่านการตรวจ localhost ให้ทั้งสอง process ของ local launcher ป้องกัน .env เก่าของ Redirect เติมค่าฐานข้อมูลอื่นภายหลัง เพิ่ม regression test สำหรับกรณีนี้ และใช้ค่าฐานข้อมูลที่แน่นอนในชุด integration tests
- คู่มือ Deploy ระบุ NODE_VERSION=22.21.0 ของบริการใหม่ให้ตรงกับเวอร์ชันทดสอบ
- README ระบุ Branch ที่มีบริการใหม่และวิธีรันสองบริการ แยกจากวิธี Vite/rollback รวมความหมายของการค้นหา
- แก้สถานะ Backend เดียวที่ล้าสมัยใน PRODUCT และข้อความเสียในเอกสารส่งงาน

## หลักฐานการตรวจ

- `npm.cmd test --prefix server`: ผ่าน 4/4 ชุด รวม regression และ concurrent requests
- `npm.cmd run build --prefix client`: ผ่าน
- Mermaid: 5/5 ภาพเรนเดอร์ผ่าน
- `git diff --check`: ผ่าน (มีเพียงคำเตือนแปลง LF/CRLF ของ Git)
- ตรวจลิงก์ไฟล์ภายในเอกสารหลักและข้อความเสีย: ผ่าน
- ข้อจำกัด Free Web Service และการกำหนด Node version ตรวจจาก [Render Free](https://render.com/docs/free) และ [Node version](https://render.com/docs/node-version)

## สิ่งที่ยังต้องยืนยัน

- Commit/Push Branch และทดลองติดตั้งสองบริการจาก clone ใหม่ คู่มือปัจจุบันต้องใช้ Branch ที่ Push แล้ว
- Deploy Redirect แยก ตั้ง token/URL ในบริการหลัก และตรวจรายการออนไลน์ใน [MICROSERVICES.md](MICROSERVICES.md)
- ใช้ PostgreSQL ร่วมกัน จึงยังมี schema coupling ไม่ใช่ database-per-service; timeout อาจเกิดหลังเพิ่มคลิกสำเร็จแล้ว การลองใหม่ด้วยตนเองอาจนับเพิ่ม
- รายงานนี้ตรวจโค้ด เอกสาร และหลักฐานในบทสนทนา ไม่ได้เปิดโจทย์ PDF ต้นฉบับซ้ำ เพราะไม่มีไฟล์นั้นใน workspace
- ยังไม่ได้ Commit, Push หรือเปลี่ยนบริการออนไลน์ระหว่างการตรวจนี้
