# Short URL

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

ย่อ URL เพื่อแชร์ คัดลอก เปิดลิงก์ และดาวน์โหลด QR Code เป็นโปรเจกต์สำหรับนำเสนอผลงาน

## Capabilities and Constraints

- Vue + CSS, Node.js/Express JavaScript และ PostgreSQL คงเทคโนโลยีเดิม
- ระบบบน main มี Sign up, Login, Logout และประวัติส่วนตัว ลิงก์เก่ายังเปิดได้แต่ไม่มีเจ้าของ จำนวนคลิกรวมการเปิดซ้ำ
- Deploy บน Render จาก main แล้ว พร้อม migration สมาชิก ผู้ใช้ยืนยัน QR มือถือและการแยกบัญชีผ่าน
- Architecture Diagram อยู่ใน docs/ARCHITECTURE.md เวอร์ชันออนไลน์ที่ยืนยันยังเป็น Backend เดียว ส่วน Branch feature/microservices แยกบริการหลักและ Redirect เป็นสอง process โดยใช้ PostgreSQL ร่วมกัน

## Brand Commitments

ภาษาไทยเป็นหลัก ใช้ Login/Sign up/Logout ในส่วนสมาชิก ธีมล่าสุดใช้สีจากโลโก้ SYNERRY ที่ผู้ใช้ส่งเป็นแนวทาง: แดง ดำชาร์โคล ขาว และเทาอ่อน โดยคงชื่อ Short URL หัวเว็บกระชับ เน้นช่อง URL และปุ่มสร้างลิงก์ เปิด QR เมื่อกด อ้างอิง Template ที่ผู้ใช้เลือกภายหลัง: พื้นขาวโปร่ง หัวเรื่องใหญ่และองค์ประกอบสองฝั่ง ใช้งานฟอร์มได้ทันที พร้อมงานเส้นลิงก์เคลื่อนไหว คงแดง–ชาร์โคล ไม่ใช้ข้อมูลสถิติสมมติ

## Accessibility & Inclusion

รองรับมือถือและคีย์บอร์ด มี label, focus ที่เห็นชัด สีอ่านง่าย สถานะโหลด สำเร็จ ข้อผิดพลาด และข้อมูลว่าง ป้องกันการส่งซ้ำ

## Open Decisions

ยังไม่ระบุกลุ่มผู้ใช้เฉพาะ ใช้ Hosting Render ระบบชื่อ/แก้ชื่อ ค้นหา รหัส URL กำหนดเอง วันหมดอายุ และ soft delete พร้อม transition Login/Logout Merge เข้า main และ Deploy แล้วหลัง migration 002/003 ผู้ใช้ยืนยันการบันทึก deleted_at ออนไลน์ ผลออนไลน์อื่นยังต้องเก็บให้ครบ

## งานรอบ Microservices

Branch feature/microservices แยก Redirect service พร้อม Gateway รักษา URL เดิมและ token ระหว่างบริการ ใช้ PostgreSQL ร่วมกัน ไม่มี migration ใหม่ ทดสอบสอง process ในเครื่องแล้ว ยังไม่ Deploy ออนไลน์ ธีมแดง–ชาร์โคลและ animation Login/Logout เดิมคงไว้ เพิ่ม feedback หลังแก้ชื่อ/ลบ และปุ่มลองใหม่ในหน้า 503
